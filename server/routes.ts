import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerAudioRoutes } from "./replit_integrations/audio/routes";
import { openai } from "./replit_integrations/audio/client";
import { getFullMonthlyReport, generateNarrative, type ReportFilters } from "./reporting";

function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(":");
  return parseInt(parts[0]) * 60 + parseInt(parts[1] || "0");
}

function timesOverlap(
  startA: string | null | undefined,
  endA: string | null | undefined,
  startB: string | null | undefined,
  endB: string | null | undefined
): boolean {
  if (!startA || !endA || !startB || !endB) return true;
  const a0 = parseTimeToMinutes(startA);
  const a1 = parseTimeToMinutes(endA);
  const b0 = parseTimeToMinutes(startB);
  const b1 = parseTimeToMinutes(endB);
  return a0 < b1 && b0 < a1;
}

function datesOverlap(
  startA: Date | string | null | undefined,
  endA: Date | string | null | undefined,
  startB: Date | string | null | undefined,
  endB: Date | string | null | undefined
): boolean {
  if (!startA || !startB) return false;
  const a0 = new Date(startA);
  const a1 = endA ? new Date(endA) : a0;
  const b0 = new Date(startB);
  const b1 = endB ? new Date(endB) : b0;
  const dayA0 = a0.toISOString().slice(0, 10);
  const dayA1 = a1.toISOString().slice(0, 10);
  const dayB0 = b0.toISOString().slice(0, 10);
  const dayB1 = b1.toISOString().slice(0, 10);
  return dayA0 <= dayB1 && dayB0 <= dayA1;
}

function coerceDateFields(body: Record<string, any>): Record<string, any> {
  const result = { ...body };
  for (const [key, value] of Object.entries(result)) {
    if (value === null || value === undefined) continue;
    if (
      typeof value === 'string' &&
      (key.endsWith('Date') || key.endsWith('At') || key === 'startTime' || key === 'endTime' || key === 'date')
    ) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        result[key] = parsed;
      }
    }
  }
  return result;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth Setup
  await setupAuth(app);
  registerAuthRoutes(app);
  
  // Audio Routes
  registerAudioRoutes(app);

  // === Contacts API ===

  app.get(api.contacts.list.path, isAuthenticated, async (req, res) => {
    // req.user is populated by Replit Auth (passport)
    const userId = (req.user as any).claims.sub; 
    const contacts = await storage.getContacts(userId);
    res.json(contacts);
  });

  app.get(api.contacts.get.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const contact = await storage.getContact(id);
    
    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }
    
    // Basic authorization check
    if (contact.userId !== (req.user as any).claims.sub) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json(contact);
  });

  app.post(api.contacts.create.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      // Inject userId into the input
      const input = api.contacts.create.input.parse({
        ...req.body,
        userId,
      });
      
      const contact = await storage.createContact(input);
      res.status(201).json(contact);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.patch(api.contacts.update.path, isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getContact(id);
      if (!existing) return res.status(404).json({ message: "Contact not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      const input = api.contacts.update.input.parse(req.body);
      const updated = await storage.updateContact(id, input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.contacts.delete.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getContact(id);
    if (!existing) return res.status(404).json({ message: "Contact not found" });
    if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

    await storage.deleteContact(id);
    res.status(204).send();
  });

  app.get("/api/contacts/:id/debriefs", isAuthenticated, async (req, res) => {
    try {
      const contactId = parseInt(req.params.id);
      const contact = await storage.getContact(contactId);
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      if (contact.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const links = await storage.getContactImpactLogs(contactId);
      const debriefs = [];
      for (const link of links) {
        const log = await storage.getImpactLog(link.impactLogId);
        if (log) {
          debriefs.push({
            ...log,
            linkRole: link.role,
            linkId: link.id,
          });
        }
      }
      res.json(debriefs);
    } catch (err) {
      throw err;
    }
  });

  app.post("/api/contacts/bulk", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { contacts: rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: "No contacts provided" });
      }
      if (rows.length > 500) {
        return res.status(400).json({ message: "Maximum 500 contacts per upload" });
      }

      const results: { created: number; errors: { row: number; message: string }[] } = {
        created: 0,
        errors: [],
      };

      for (let i = 0; i < rows.length; i++) {
        try {
          const row = rows[i];
          const input = api.contacts.create.input.parse({
            name: row.name?.trim(),
            role: row.role?.trim() || "Entrepreneur",
            email: row.email?.trim() || undefined,
            phone: row.phone?.trim() || undefined,
            businessName: row.businessName?.trim() || undefined,
            age: row.age ? parseInt(row.age) || undefined : undefined,
            ethnicity: row.ethnicity
              ? (typeof row.ethnicity === "string" ? row.ethnicity.split(",").map((s: string) => s.trim()).filter(Boolean) : row.ethnicity)
              : undefined,
            location: row.location?.trim() || undefined,
            tags: row.tags
              ? (typeof row.tags === "string" ? row.tags.split(",").map((s: string) => s.trim()).filter(Boolean) : row.tags)
              : undefined,
            notes: row.notes?.trim() || undefined,
            userId,
          });
          await storage.createContact(input);
          results.created++;
        } catch (err) {
          const msg = err instanceof z.ZodError ? err.errors[0].message : (err as Error).message;
          results.errors.push({ row: i + 1, message: msg });
        }
      }

      res.json(results);
    } catch (err) {
      res.status(500).json({ message: "Bulk upload failed" });
    }
  });

  // === Interactions API ===

  app.get(api.interactions.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const contactId = req.query.contactId ? parseInt(req.query.contactId as string) : undefined;
    
    if (contactId) {
      const contact = await storage.getContact(contactId);
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      if (contact.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const interactionsList = await storage.getInteractions(contactId);
      return res.json(interactionsList);
    }

    const userContacts = await storage.getContacts(userId);
    const allInteractions = await Promise.all(
      userContacts.map((c) => storage.getInteractions(c.id))
    );
    res.json(allInteractions.flat().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  });

  app.post(api.interactions.create.path, isAuthenticated, async (req, res) => {
    try {
      // Verify ownership of contact
      const contact = await storage.getContact(req.body.contactId);
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      if (contact.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      const input = api.interactions.create.input.parse(req.body);
      const interaction = await storage.createInteraction(input);
      res.status(201).json(interaction);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // === Analysis API ===
  
  app.post(api.interactions.analyze.path, isAuthenticated, async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ message: "Text required" });

      const prompt = `
        Analyze the following mentorship interaction text and extract key metrics and insights.
        Return a JSON object with:
        - summary: A concise summary of the interaction (max 2 sentences).
        - keywords: Array of 3-5 important tags/keywords.
        - metrics: Object with these scores from 1-10 based on the text:
          - mindset: Growth mindset and mental resilience
          - skill: Technical or business skill level
          - confidence: Overall self-confidence demonstrated
          - confidenceScore: Business confidence and decision-making assurance
          - systemsInPlace: How well their business systems and processes are established
          - fundingReadiness: Readiness and preparedness for seeking or managing funding
          - networkStrength: Quality and strength of their professional network
        
        Text: "${text}"
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      
      const analysis = {
        summary: result.summary || "No summary generated.",
        keywords: result.keywords || [],
        metrics: {
          mindset: result.metrics?.mindset || 5,
          skill: result.metrics?.skill || 5,
          confidence: result.metrics?.confidence || 5,
          confidenceScore: result.metrics?.confidenceScore || 5,
          systemsInPlace: result.metrics?.systemsInPlace || 5,
          fundingReadiness: result.metrics?.fundingReadiness || 5,
          networkStrength: result.metrics?.networkStrength || 5,
        }
      };

      res.json(analysis);

    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ message: "Failed to analyze text" });
    }
  });

  // === Meetings API ===

  app.get(api.meetings.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const meetingsList = await storage.getMeetings(userId);
    res.json(meetingsList);
  });

  app.get(api.meetings.get.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const meeting = await storage.getMeeting(id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    if (meeting.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    res.json(meeting);
  });

  app.post(api.meetings.create.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const input = api.meetings.create.input.parse({
        ...req.body,
        userId,
        startTime: new Date(req.body.startTime),
        endTime: new Date(req.body.endTime),
      });

      const contact = await storage.getContact(input.contactId);
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      if (contact.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const meeting = await storage.createMeeting(input);
      res.status(201).json(meeting);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.patch(api.meetings.update.path, isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getMeeting(id);
      if (!existing) return res.status(404).json({ message: "Meeting not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      const updates: any = { ...req.body };
      if (updates.startTime) updates.startTime = new Date(updates.startTime);
      if (updates.endTime) updates.endTime = new Date(updates.endTime);

      const input = api.meetings.update.input.parse(updates);
      const updated = await storage.updateMeeting(id, input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.meetings.delete.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getMeeting(id);
    if (!existing) return res.status(404).json({ message: "Meeting not found" });
    if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

    await storage.deleteMeeting(id);
    res.status(204).send();
  });

  // === Events API ===

  app.get(api.events.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const eventsList = await storage.getEvents(userId);
    res.json(eventsList);
  });

  app.get(api.events.get.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const event = await storage.getEvent(id);
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (event.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    res.json(event);
  });

  app.post(api.events.create.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const input = api.events.create.input.parse({
        ...req.body,
        userId,
        startTime: new Date(req.body.startTime),
        endTime: new Date(req.body.endTime),
      });
      const event = await storage.createEvent(input);
      res.status(201).json(event);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.patch(api.events.update.path, isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getEvent(id);
      if (!existing) return res.status(404).json({ message: "Event not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      const updates: any = { ...req.body };
      if (updates.startTime) updates.startTime = new Date(updates.startTime);
      if (updates.endTime) updates.endTime = new Date(updates.endTime);

      const input = api.events.update.input.parse(updates);
      const updated = await storage.updateEvent(id, input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.events.delete.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const userId = (req.user as any).claims.sub;
    const existing = await storage.getEvent(id);
    if (!existing) return res.status(404).json({ message: "Event not found" });
    if (existing.userId !== userId) return res.status(403).json({ message: "Forbidden" });

    const reason = req.body?.reason?.trim();
    if (!reason) {
      return res.status(400).json({ message: "A reason is required to delete an event" });
    }
    await storage.createAuditLog({
      userId,
      action: "delete",
      entityType: "event",
      entityId: String(id),
      changes: { reason, deletedEvent: existing.name },
    });

    await storage.deleteEvent(id);
    res.status(204).send();
  });

  // === Event Attendance API ===

  app.get(api.eventAttendance.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const eventId = parseInt(req.params.eventId);
    const event = await storage.getEvent(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (event.userId !== userId) return res.status(403).json({ message: "Forbidden" });
    const attendance = await storage.getEventAttendance(eventId);
    res.json(attendance);
  });

  app.post(api.eventAttendance.add.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const input = api.eventAttendance.add.input.parse(req.body);
      const event = await storage.getEvent(input.eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const contact = await storage.getContact(input.contactId);
      if (contact && contact.consentStatus === 'withdrawn') {
        return res.status(400).json({ message: "Cannot add attendee: consent has been withdrawn" });
      }
      const record = await storage.addEventAttendance(input);
      res.status(201).json(record);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.eventAttendance.remove.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.removeEventAttendance(id);
    res.status(204).send();
  });

  // === Impact Logs API ===

  app.get(api.impactLogs.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const logs = await storage.getImpactLogs(userId);
    res.json(logs);
  });

  app.get(api.impactLogs.get.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const log = await storage.getImpactLog(id);
    if (!log) return res.status(404).json({ message: "Impact log not found" });
    if (log.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    res.json(log);
  });

  app.post(api.impactLogs.create.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const input = api.impactLogs.create.input.parse({
        ...req.body,
        userId,
      });
      const log = await storage.createImpactLog(input);
      res.status(201).json(log);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.patch(api.impactLogs.update.path, isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getImpactLog(id);
      if (!existing) return res.status(404).json({ message: "Impact log not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const input = api.impactLogs.update.input.parse(coerceDateFields(req.body));
      if (input.status) {
        const validTransitions: Record<string, string[]> = {
          draft: ['pending_review', 'confirmed'],
          pending_review: ['draft', 'confirmed'],
          confirmed: ['pending_review', 'draft'],
        };
        const currentStatus = existing.status || 'draft';
        const allowed = validTransitions[currentStatus] || [];
        if (!allowed.includes(input.status)) {
          return res.status(400).json({ message: `Cannot transition from '${currentStatus}' to '${input.status}'` });
        }
      }
      const updated = await storage.updateImpactLog(id, input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.impactLogs.delete.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getImpactLog(id);
    if (!existing) return res.status(404).json({ message: "Impact log not found" });
    if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteImpactLog(id);
    res.status(204).send();
  });

  // Impact Log Contacts
  app.get(api.impactLogs.contacts.list.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const log = await storage.getImpactLog(id);
    if (!log) return res.status(404).json({ message: "Impact log not found" });
    if (log.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    const contacts = await storage.getImpactLogContacts(id);
    res.json(contacts);
  });

  app.post(api.impactLogs.contacts.add.path, isAuthenticated, async (req, res) => {
    try {
      const impactLogId = parseInt(req.params.id);
      const log = await storage.getImpactLog(impactLogId);
      if (!log) return res.status(404).json({ message: "Impact log not found" });
      if (log.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const input = api.impactLogs.contacts.add.input.parse({
        ...req.body,
        impactLogId,
      });
      const contact = await storage.getContact(input.contactId);
      if (contact && contact.consentStatus === 'withdrawn') {
        return res.status(400).json({ message: "Cannot link contact: consent has been withdrawn" });
      }
      const record = await storage.addImpactLogContact(input);
      res.status(201).json(record);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.impactLogs.contacts.remove.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.removeImpactLogContact(id);
    res.status(204).send();
  });

  // Impact Log Tags
  app.get(api.impactLogs.tags.list.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const log = await storage.getImpactLog(id);
    if (!log) return res.status(404).json({ message: "Impact log not found" });
    if (log.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    const tags = await storage.getImpactTags(id);
    res.json(tags);
  });

  app.post(api.impactLogs.tags.add.path, isAuthenticated, async (req, res) => {
    try {
      const impactLogId = parseInt(req.params.id);
      const log = await storage.getImpactLog(impactLogId);
      if (!log) return res.status(404).json({ message: "Impact log not found" });
      if (log.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const input = api.impactLogs.tags.add.input.parse({
        ...req.body,
        impactLogId,
      });
      const tag = await storage.addImpactTag(input);
      res.status(201).json(tag);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.impactLogs.tags.remove.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.removeImpactTag(id);
    res.status(204).send();
  });

  // === Taxonomy API ===

  app.get(api.taxonomy.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const items = await storage.getTaxonomy(userId);
    res.json(items);
  });

  app.post(api.taxonomy.create.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const input = api.taxonomy.create.input.parse({
        ...req.body,
        userId,
      });
      const item = await storage.createTaxonomyItem(input);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.patch(api.taxonomy.update.path, isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.taxonomy.update.input.parse(req.body);
      const updated = await storage.updateTaxonomyItem(id, input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.taxonomy.delete.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteTaxonomyItem(id);
    res.status(204).send();
  });

  // === Keywords API ===

  app.get(api.keywords.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const keywords = await storage.getKeywords(userId);
    res.json(keywords);
  });

  app.post(api.keywords.create.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const input = api.keywords.create.input.parse({
        ...req.body,
        userId,
      });
      const keyword = await storage.createKeyword(input);
      res.status(201).json(keyword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.keywords.delete.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteKeyword(id);
    res.status(204).send();
  });

  // === Action Items API ===

  app.get(api.actionItems.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const contactId = req.query.contactId ? parseInt(req.query.contactId as string) : undefined;
    if (contactId) {
      const items = await storage.getContactActionItems(contactId);
      return res.json(items);
    }
    const items = await storage.getActionItems(userId);
    res.json(items);
  });

  app.post(api.actionItems.create.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const input = api.actionItems.create.input.parse({
        ...req.body,
        userId,
      });
      if (input.contactId) {
        const contact = await storage.getContact(input.contactId);
        if (contact && contact.consentStatus === 'withdrawn') {
          return res.status(400).json({ message: "Cannot link action to contact: consent has been withdrawn" });
        }
      }
      const item = await storage.createActionItem(input);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.patch(api.actionItems.update.path, isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.actionItems.update.input.parse(req.body);
      const updated = await storage.updateActionItem(id, input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.actionItems.delete.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteActionItem(id);
    res.status(204).send();
  });

  // === Consent API ===

  app.get(api.consent.list.path, isAuthenticated, async (req, res) => {
    const contactId = parseInt(req.params.id);
    const contact = await storage.getContact(contactId);
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    if (contact.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    const records = await storage.getConsentRecords(contactId);
    res.json(records);
  });

  app.post(api.consent.create.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const contactId = parseInt(req.params.id);
      const contact = await storage.getContact(contactId);
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      if (contact.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const input = api.consent.create.input.parse({
        ...req.body,
        contactId,
        userId,
      });
      const record = await storage.createConsentRecord(input);
      await storage.updateContact(contactId, {
        consentStatus: input.action,
        consentDate: new Date(),
      });
      res.status(201).json(record);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // === Impact Extraction AI Pipeline ===

  app.post("/api/impact-extract", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { transcript, title, existingLogId } = req.body;
      if (!transcript) return res.status(400).json({ message: "Transcript text required" });

      const taxonomy = await storage.getTaxonomy(userId);
      const keywords = await storage.getKeywords(userId);
      const contacts = await storage.getContacts(userId);

      const taxonomyContext = taxonomy.filter(t => t.active).map(t =>
        `- ${t.name}: ${t.description || 'No description'}`
      ).join('\n');

      const keywordContext = keywords.map(k => {
        const tax = taxonomy.find(t => t.id === k.taxonomyId);
        return `"${k.phrase}" → ${tax?.name || 'unknown'}`;
      }).join('\n');

      const peopleContext = contacts.map(c =>
        `- ${c.name}${c.businessName ? ` (${c.businessName})` : ''} [ID: ${c.id}]`
      ).join('\n');

      const prompt = `You are an impact analysis system for a community development organisation in Aotearoa New Zealand. Analyze the following debrief transcript and extract structured impact data.

IMPACT TAXONOMY (use these categories for tagging):
${taxonomyContext || `- Hub Engagement: Track facility usage and programme participation metrics
- Business Progress: Capture commercial development and revenue outcomes
- Skills & Capability Growth: Measure competency development and confidence building
- Network & Ecosystem Connection: Document relationship formation and ecosystem integration
- Rangatahi Development: Track youth-specific engagement and outcomes`}

SEMANTIC INDICATORS (phrases/meanings that map to categories):
Hub Engagement: registered as member, attended workshop, came to event, used coworking space, participated in programme, joined session, turned up to, booked in for, regular user
Business Progress: made first sale, got customer, launched business, registered company, earned revenue, hired someone, secured contract, still trading, business growing, sustainable income, wholesale client, repeat customer
Skills & Capability Growth: learned how to, now understand, figured out how, gained confidence, feel capable, can now do, developed skill in, understand pricing, know how to market, improved at, making better decisions, ready to take next step
Network & Ecosystem Connection: met someone who, introduced to, connected with, found mentor, got referral to, partnered with, collaborated with, supported by, linked to, now working with, relationships with
Rangatahi Development: young entrepreneur, rangatahi participated, youth attended, first business idea, school leaver, starting out, early career, young person, student entrepreneur, developing mindset

KEYWORD DICTIONARY (additional user-configured phrase mappings):
${keywordContext || 'No additional keywords configured.'}

CLASSIFICATION LOGIC:
1. Multi-label output: Return ALL applicable categories for the transcript
2. Semantic matching: Match on meaning and context, not just literal keyword presence
3. Language handling: Support Te Reo Māori terms and New Zealand colloquialisms
4. Contextual interpretation examples:
   - "met first customer" → Business Progress + Network & Ecosystem Connection
   - Confidence statements related to business tasks → Skills & Capability Growth + Business Progress
5. Priority ordering: Return categories ranked by relevance strength in source text

KNOWN COMMUNITY MEMBERS:
${peopleContext || 'No members in system yet.'}

TRANSCRIPT:
"""
${transcript}
"""

Return a JSON object with EXACTLY this structure:
{
  "summary": "2-3 sentence summary of the debrief",
  "sentiment": "positive" | "neutral" | "negative" | "mixed",
  "impactTags": [
    {
      "category": "taxonomy category name",
      "confidence": 0-100,
      "evidence": "brief quote or paraphrase from transcript supporting this tag"
    }
  ],
  "peopleIdentified": [
    {
      "name": "person name as mentioned",
      "matchedContactId": null or number (ID from KNOWN COMMUNITY MEMBERS if matched),
      "role": "subject" | "mentioned" | "participant",
      "confidence": 0-100
    }
  ],
  "milestones": ["list of specific achievements or stage movements mentioned"],
  "keyQuotes": ["notable direct quotes from the transcript"],
  "actionItems": [
    {
      "title": "action description",
      "owner": "person responsible (if mentioned)",
      "priority": "high" | "medium" | "low"
    }
  ],
  "economicActivity": {
    "mentioned": true/false,
    "details": "description of any economic/revenue/funding activity mentioned",
    "confidence": 0-100
  },
  "metrics": {
    "mindset": 1-10,
    "skill": 1-10,
    "confidence": 1-10,
    "confidenceScore": 1-10,
    "systemsInPlace": 1-10,
    "fundingReadiness": 1-10,
    "networkStrength": 1-10
  }
}

Be precise. Only tag impact categories where there is clear evidence in the transcript. Set confidence scores honestly — lower if the evidence is ambiguous.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const extraction = JSON.parse(response.choices[0].message.content || "{}");

      if (existingLogId) {
        const existing = await storage.getImpactLog(existingLogId);
        if (!existing || existing.userId !== userId) {
          return res.status(404).json({ message: "Impact log not found" });
        }
        const updated = await storage.updateImpactLog(existingLogId, {
          transcript,
          summary: extraction.summary || "",
          rawExtraction: extraction,
          status: "pending_review",
          sentiment: extraction.sentiment || "neutral",
          milestones: extraction.milestones || [],
          keyQuotes: extraction.keyQuotes || [],
        });
        res.status(200).json({ impactLog: updated, extraction });
      } else {
        const impactLog = await storage.createImpactLog({
          userId,
          title: title || "Untitled Debrief",
          transcript,
          summary: extraction.summary || "",
          rawExtraction: extraction,
          status: "pending_review",
          sentiment: extraction.sentiment || "neutral",
          milestones: extraction.milestones || [],
          keyQuotes: extraction.keyQuotes || [],
        });
        res.status(201).json({ impactLog, extraction });
      }
    } catch (error) {
      console.error("Impact extraction error:", error);
      res.status(500).json({ message: "Failed to extract impact data" });
    }
  });

  app.post("/api/impact-transcribe", isAuthenticated, async (req, res) => {
    try {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", async () => {
        try {
          const audioBuffer = Buffer.concat(chunks);
          if (audioBuffer.length === 0) {
            return res.status(400).json({ message: "No audio data received" });
          }

          const { ensureCompatibleFormat, speechToText } = await import("./replit_integrations/audio/client");
          const { buffer, format } = await ensureCompatibleFormat(audioBuffer);
          const transcript = await speechToText(buffer, format);

          res.json({ transcript });
        } catch (err) {
          console.error("Transcription error:", err);
          res.status(500).json({ message: "Failed to transcribe audio" });
        }
      });
    } catch (error) {
      console.error("Transcription route error:", error);
      res.status(500).json({ message: "Failed to process audio" });
    }
  });

  // === Audit Logs API ===

  app.get(api.auditLogs.list.path, isAuthenticated, async (req, res) => {
    const entityType = req.query.entityType as string;
    const entityId = parseInt(req.query.entityId as string);
    if (!entityType || !entityId) {
      return res.status(400).json({ message: "entityType and entityId query params required" });
    }
    const logs = await storage.getAuditLogs(entityType, entityId);
    res.json(logs);
  });

  // === Google Calendar API ===

  app.get("/api/google-calendar/events", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { getUncachableGoogleCalendarClient } = await import("./replit_integrations/google-calendar/client");
      const calendar = await getUncachableGoogleCalendarClient();

      const timeMin = (req.query.timeMin as string) || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const timeMax = (req.query.timeMax as string) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const additionalCalendars = await storage.getCalendarSettings(userId);
      const calendarIds = ["primary", ...additionalCalendars.filter(c => c.active).map(c => c.calendarId)];

      const allEvents: any[] = [];
      const seenKeys = new Set<string>();

      for (const calId of calendarIds) {
        try {
          const response = await calendar.events.list({
            calendarId: calId,
            timeMin,
            timeMax,
            maxResults: 250,
            singleEvents: true,
            orderBy: "startTime",
          });

          for (const e of (response.data.items || [])) {
            const dedupeKey = `${(e.summary || "").trim().toLowerCase()}|${e.start?.dateTime || e.start?.date || ""}|${e.end?.dateTime || e.end?.date || ""}`;
            if (seenKeys.has(dedupeKey)) continue;
            seenKeys.add(dedupeKey);

            allEvents.push({
              id: e.id,
              summary: e.summary || "(No title)",
              description: e.description || "",
              location: e.location || "",
              start: e.start?.dateTime || e.start?.date || "",
              end: e.end?.dateTime || e.end?.date || "",
              attendees: (e.attendees || []).map((a: any) => ({
                email: a.email,
                displayName: a.displayName || a.email,
                responseStatus: a.responseStatus,
              })),
              htmlLink: e.htmlLink,
              status: e.status,
              calendarId: calId,
            });
          }
        } catch (calErr: any) {
          console.warn(`Failed to fetch calendar ${calId}:`, calErr.message);
        }
      }

      allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      res.json(allEvents);
    } catch (err: any) {
      console.error("Google Calendar fetch error:", err.message);
      res.status(500).json({ message: "Failed to fetch Google Calendar events: " + err.message });
    }
  });

  app.get("/api/google-calendar/list", isAuthenticated, async (req, res) => {
    try {
      const { getUncachableGoogleCalendarClient } = await import("./replit_integrations/google-calendar/client");
      const calendar = await getUncachableGoogleCalendarClient();

      const response = await calendar.calendarList.list({
        minAccessRole: "reader",
      });

      const calendars = (response.data.items || []).map((cal: any) => ({
        id: cal.id,
        summary: cal.summary || cal.id,
        description: cal.description || "",
        backgroundColor: cal.backgroundColor || "#4285f4",
        foregroundColor: cal.foregroundColor || "#ffffff",
        primary: cal.primary || false,
        accessRole: cal.accessRole,
      }));

      res.json(calendars);
    } catch (err: any) {
      console.error("Google Calendar list error:", err.message);
      res.status(500).json({ message: "Failed to list calendars: " + err.message });
    }
  });

  app.post("/api/google-calendar/reconcile", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { googleCalendarEventId, summary, description, location, start, end, type } = req.body;

      if (!googleCalendarEventId || !summary || !start || !end) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const existing = await storage.getEventByGoogleCalendarId(googleCalendarEventId, userId);
      if (existing) {
        return res.status(409).json({ message: "This calendar event is already linked to an app event", event: existing });
      }

      const event = await storage.createEvent({
        userId,
        name: summary,
        type: type || "Community Event",
        startTime: new Date(start),
        endTime: new Date(end),
        location: location || null,
        description: description || null,
        googleCalendarEventId,
        tags: [],
        attendeeCount: null,
      });

      res.status(201).json(event);
    } catch (err: any) {
      console.error("Reconcile error:", err.message);
      res.status(500).json({ message: "Failed to reconcile event" });
    }
  });

  // Dismissed Calendar Events
  app.get("/api/dismissed-calendar-events", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const dismissed = await storage.getDismissedCalendarEvents(userId);
    res.json(dismissed);
  });

  app.post("/api/dismissed-calendar-events", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const { gcalEventId, reason } = req.body;
    if (!gcalEventId || !reason) {
      return res.status(400).json({ message: "gcalEventId and reason are required" });
    }
    const record = await storage.dismissCalendarEvent({ userId, gcalEventId, reason });
    res.status(201).json(record);
  });

  app.delete("/api/dismissed-calendar-events/:id", isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.restoreCalendarEvent(id);
    res.json({ success: true });
  });

  // Calendar Settings (additional calendars)
  app.get("/api/calendar-settings", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const settings = await storage.getCalendarSettings(userId);
    res.json(settings);
  });

  app.post("/api/calendar-settings", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const { calendarId, label } = req.body;
    if (!calendarId) {
      return res.status(400).json({ message: "calendarId is required" });
    }
    const record = await storage.addCalendarSetting({ userId, calendarId, label: label || calendarId });
    res.status(201).json(record);
  });

  app.delete("/api/calendar-settings/:id", isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteCalendarSetting(id);
    res.json({ success: true });
  });

  // === Programmes API ===

  app.get(api.programmes.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const programmesList = await storage.getProgrammes(userId);
    res.json(programmesList);
  });

  app.get(api.programmes.get.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const programme = await storage.getProgramme(id);
    if (!programme) return res.status(404).json({ message: "Programme not found" });
    if (programme.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    res.json(programme);
  });

  app.post(api.programmes.create.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const body = coerceDateFields({ ...req.body, userId });
      const input = api.programmes.create.input.parse(body);
      const programme = await storage.createProgramme(input);
      res.status(201).json(programme);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.patch(api.programmes.update.path, isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getProgramme(id);
      if (!existing) return res.status(404).json({ message: "Programme not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const input = api.programmes.update.input.parse(coerceDateFields(req.body));
      const updated = await storage.updateProgramme(id, input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

  app.delete(api.programmes.delete.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getProgramme(id);
    if (!existing) return res.status(404).json({ message: "Programme not found" });
    if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteProgramme(id);
    res.status(204).send();
  });

  app.get(api.programmes.events.list.path, isAuthenticated, async (req, res) => {
    const programmeId = parseInt(req.params.id);
    const programme = await storage.getProgramme(programmeId);
    if (!programme) return res.status(404).json({ message: "Programme not found" });
    if (programme.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    const eventsList = await storage.getProgrammeEvents(programmeId);
    res.json(eventsList);
  });

  app.post(api.programmes.events.add.path, isAuthenticated, async (req, res) => {
    try {
      const programmeId = parseInt(req.params.id);
      const programme = await storage.getProgramme(programmeId);
      if (!programme) return res.status(404).json({ message: "Programme not found" });
      if (programme.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const input = api.programmes.events.add.input.parse({ ...req.body, programmeId });
      const record = await storage.addProgrammeEvent(input);
      res.status(201).json(record);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.programmes.events.remove.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const userId = (req.user as any).claims.sub;
    const allProgrammes = await storage.getProgrammes(userId);
    const programmeIds = new Set(allProgrammes.map(p => p.id));
    const allProgrammeEvents = await Promise.all(
      allProgrammes.map(p => storage.getProgrammeEvents(p.id))
    );
    const flatEvents = allProgrammeEvents.flat();
    const targetEvent = flatEvents.find(pe => pe.id === id);
    if (!targetEvent || !programmeIds.has(targetEvent.programmeId)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.removeProgrammeEvent(id);
    res.status(204).send();
  });

  // === Memberships API ===

  app.get(api.memberships.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const list = await storage.getMemberships(userId);
    res.json(list);
  });

  app.get(api.memberships.get.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const membership = await storage.getMembership(id);
    if (!membership) return res.status(404).json({ message: "Membership not found" });
    if (membership.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    res.json(membership);
  });

  app.post(api.memberships.create.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const body = coerceDateFields({ ...req.body, userId });
      const input = api.memberships.create.input.parse(body);
      const membership = await storage.createMembership(input);
      res.status(201).json(membership);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.patch(api.memberships.update.path, isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getMembership(id);
      if (!existing) return res.status(404).json({ message: "Membership not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const input = api.memberships.update.input.parse(coerceDateFields(req.body));
      const updated = await storage.updateMembership(id, input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.memberships.delete.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getMembership(id);
    if (!existing) return res.status(404).json({ message: "Membership not found" });
    if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteMembership(id);
    res.status(204).send();
  });

  // === MOUs API ===

  app.get(api.mous.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const list = await storage.getMous(userId);
    res.json(list);
  });

  app.get(api.mous.get.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const mou = await storage.getMou(id);
    if (!mou) return res.status(404).json({ message: "MOU not found" });
    if (mou.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    res.json(mou);
  });

  app.post(api.mous.create.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const body = coerceDateFields({ ...req.body, userId });
      const input = api.mous.create.input.parse(body);
      const mou = await storage.createMou(input);
      res.status(201).json(mou);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.patch(api.mous.update.path, isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getMou(id);
      if (!existing) return res.status(404).json({ message: "MOU not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const input = api.mous.update.input.parse(coerceDateFields(req.body));
      const updated = await storage.updateMou(id, input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.mous.delete.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getMou(id);
    if (!existing) return res.status(404).json({ message: "MOU not found" });
    if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteMou(id);
    res.status(204).send();
  });

  // === Venues API ===

  app.get(api.venues.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const venuesList = await storage.getVenues(userId);
    res.json(venuesList);
  });

  app.get(api.venues.get.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const venue = await storage.getVenue(id);
    if (!venue) return res.status(404).json({ message: "Venue not found" });
    if (venue.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    res.json(venue);
  });

  app.post(api.venues.create.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const body = { ...req.body, userId };
      const input = api.venues.create.input.parse(body);
      const venue = await storage.createVenue(input);
      res.status(201).json(venue);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.patch(api.venues.update.path, isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getVenue(id);
      if (!existing) return res.status(404).json({ message: "Venue not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const input = api.venues.update.input.parse(req.body);
      const updated = await storage.updateVenue(id, input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.venues.delete.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getVenue(id);
    if (!existing) return res.status(404).json({ message: "Venue not found" });
    if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteVenue(id);
    res.status(204).send();
  });

  // === Bookings API ===

  app.get(api.bookings.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const bookingsList = await storage.getBookings(userId);
    res.json(bookingsList);
  });

  app.get(api.bookings.get.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    res.json(booking);
  });

  app.get("/api/bookings/:id/allowance", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const booking = await storage.getBooking(id);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      let allowanceInfo = null;
      const linkedId = booking.membershipId || booking.mouId;
      const linkedType = booking.membershipId ? "membership" : booking.mouId ? "mou" : null;

      if (linkedId && linkedType) {
        const agreement = linkedType === "membership"
          ? await storage.getMembership(linkedId)
          : await storage.getMou(linkedId);

        if (agreement) {
          const allowance = (agreement as any).bookingAllowance || 0;
          const period = (agreement as any).allowancePeriod || "quarterly";
          if (allowance > 0) {
            const allBookings = await storage.getBookings(booking.userId);
            const now = new Date();
            let periodStart: Date;
            if (period === "monthly") {
              periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
            } else {
              const q = Math.floor(now.getMonth() / 3) * 3;
              periodStart = new Date(now.getFullYear(), q, 1);
            }
            const usedCount = allBookings.filter(b => {
              const matchesAgreement = linkedType === "membership"
                ? b.membershipId === linkedId
                : b.mouId === linkedId;
              if (!matchesAgreement) return false;
              if (b.status === "cancelled") return false;
              const bDate = b.startDate ? new Date(b.startDate) : b.createdAt ? new Date(b.createdAt) : null;
              return bDate && bDate >= periodStart;
            }).length;
            allowanceInfo = { allowance, period, used: usedCount, remaining: Math.max(0, allowance - usedCount) };
          }
        }
      }
      res.json({ allowanceInfo });
    } catch (err) {
      throw err;
    }
  });

  app.get("/api/venue-conflicts", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { venueId, startDate, endDate, startTime, endTime, excludeBookingId } = req.query;
      if (!venueId || !startDate) return res.json({ conflicts: [] });

      const allBookings = await storage.getBookings(userId);
      const programmes = await storage.getProgrammes(userId);
      const conflicts: { type: string; id: number; title: string; date: string; time: string }[] = [];

      for (const b of allBookings) {
        if (excludeBookingId && b.id === parseInt(excludeBookingId as string)) continue;
        if (b.status === "cancelled") continue;
        if (b.venueId !== parseInt(venueId as string)) continue;
        if (!datesOverlap(startDate as string, (endDate || startDate) as string, b.startDate, b.endDate || b.startDate)) continue;
        if (!timesOverlap(startTime as string, endTime as string, b.startTime, b.endTime)) continue;
        conflicts.push({
          type: "booking",
          id: b.id,
          title: b.title,
          date: b.startDate ? new Date(b.startDate).toISOString().slice(0, 10) : "",
          time: b.startTime && b.endTime ? `${b.startTime} - ${b.endTime}` : "All day",
        });
      }

      for (const p of programmes) {
        if (p.status === "cancelled") continue;
        if (!datesOverlap(startDate as string, (endDate || startDate) as string, p.startDate, p.endDate || p.startDate)) continue;
        if (!timesOverlap(startTime as string, endTime as string, p.startTime, p.endTime)) continue;
        conflicts.push({
          type: "programme",
          id: p.id,
          title: p.name,
          date: p.startDate ? new Date(p.startDate).toISOString().slice(0, 10) : "",
          time: p.startTime && p.endTime ? `${p.startTime} - ${p.endTime}` : "All day",
        });
      }

      res.json({ conflicts });
    } catch (err) {
      throw err;
    }
  });

  app.post(api.bookings.create.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const body = coerceDateFields({ ...req.body, userId });
      const input = api.bookings.create.input.parse(body);

      if (input.startDate && input.venueId) {
        const allBookings = await storage.getBookings(userId);
        const programmes = await storage.getProgrammes(userId);
        for (const b of allBookings) {
          if (b.status === "cancelled") continue;
          if (b.venueId !== input.venueId) continue;
          if (!datesOverlap(input.startDate, input.endDate || input.startDate, b.startDate, b.endDate || b.startDate)) continue;
          if (!timesOverlap(input.startTime, input.endTime, b.startTime, b.endTime)) continue;
          return res.status(409).json({
            message: `Conflict: "${b.title}" is already booked for ${b.startTime || "all day"} on ${b.startDate ? new Date(b.startDate).toLocaleDateString() : "that date"}`,
          });
        }
        for (const p of programmes) {
          if (p.status === "cancelled") continue;
          if (!datesOverlap(input.startDate, input.endDate || input.startDate, p.startDate, p.endDate || p.startDate)) continue;
          if (!timesOverlap(input.startTime, input.endTime, p.startTime, p.endTime)) continue;
          return res.status(409).json({
            message: `Conflict: Programme "${p.name}" is scheduled for ${p.startTime || "all day"} on ${p.startDate ? new Date(p.startDate).toLocaleDateString() : "that date"}`,
          });
        }
      }

      const booking = await storage.createBooking(input);
      res.status(201).json(booking);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.patch(api.bookings.update.path, isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getBooking(id);
      if (!existing) return res.status(404).json({ message: "Booking not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const input = api.bookings.update.input.parse(coerceDateFields(req.body));

      const merged = { ...existing, ...input };
      if (merged.startDate && merged.venueId) {
        const userId = (req.user as any).claims.sub;
        const allBookings = await storage.getBookings(userId);
        const programmes = await storage.getProgrammes(userId);
        for (const b of allBookings) {
          if (b.id === id) continue;
          if (b.status === "cancelled") continue;
          if (b.venueId !== merged.venueId) continue;
          if (!datesOverlap(merged.startDate, merged.endDate || merged.startDate, b.startDate, b.endDate || b.startDate)) continue;
          if (!timesOverlap(merged.startTime, merged.endTime, b.startTime, b.endTime)) continue;
          return res.status(409).json({
            message: `Conflict: "${b.title}" is already booked for ${b.startTime || "all day"} on that date`,
          });
        }
        for (const p of programmes) {
          if (p.status === "cancelled") continue;
          if (!datesOverlap(merged.startDate, merged.endDate || merged.startDate, p.startDate, p.endDate || p.startDate)) continue;
          if (!timesOverlap(merged.startTime, merged.endTime, p.startTime, p.endTime)) continue;
          return res.status(409).json({
            message: `Conflict: Programme "${p.name}" is scheduled for ${p.startTime || "all day"} on that date`,
          });
        }
      }

      const updated = await storage.updateBooking(id, input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.bookings.delete.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getBooking(id);
    if (!existing) return res.status(404).json({ message: "Booking not found" });
    if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteBooking(id);
    res.status(204).send();
  });

  // === Groups API ===
  app.get(api.groups.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const groupsList = await storage.getGroups(userId);
    res.json(groupsList);
  });

  app.get(api.groups.get.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const group = await storage.getGroup(id);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (group.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    res.json(group);
  });

  app.post(api.groups.create.path, isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      if (!user || !user.claims || !user.claims.sub) {
        return res.status(401).json({ message: "Unauthorized: Missing user claims" });
      }
      const userId = user.claims.sub;
      const body = { ...req.body, userId };
      const input = api.groups.create.input.parse(body);
      const group = await storage.createGroup(input);
      res.status(201).json(group);
    } catch (err: any) {
      console.error("Group creation error:", err);
      res.status(400).json({ message: err.message });
    }
  });

  app.patch(api.groups.update.path, isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getGroup(id);
      if (!existing) return res.status(404).json({ message: "Group not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const updates = api.groups.update.input.parse(req.body);
      const group = await storage.updateGroup(id, updates);
      res.json(group);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete(api.groups.delete.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getGroup(id);
    if (!existing) return res.status(404).json({ message: "Group not found" });
    if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteGroup(id);
    res.status(204).send();
  });

  // Group Members
  app.get(api.groups.members.list.path, isAuthenticated, async (req, res) => {
    const groupId = parseInt(req.params.id);
    const members = await storage.getGroupMembers(groupId);
    res.json(members);
  });

  app.post(api.groups.members.add.path, isAuthenticated, async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const body = { ...req.body, groupId };
      const input = api.groups.members.add.input.parse(body);
      const member = await storage.addGroupMember(input);
      res.status(201).json(member);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete(api.groups.members.remove.path, isAuthenticated, async (req, res) => {
    const memberId = parseInt(req.params.memberId);
    await storage.removeGroupMember(memberId);
    res.status(204).send();
  });

  // Contact's group memberships
  app.get("/api/contacts/:id/groups", isAuthenticated, async (req, res) => {
    const contactId = parseInt(req.params.id);
    const memberships = await storage.getContactGroups(contactId);
    res.json(memberships);
  });

  // === Group Taxonomy Links ===
  app.get("/api/groups/:id/taxonomy-links", isAuthenticated, async (req, res) => {
    try {
      const group = await storage.getGroup(parseInt(req.params.id));
      if (!group) return res.status(404).json({ message: "Group not found" });
      if (group.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const links = await storage.getGroupTaxonomyLinks(group.id);
      res.json(links);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/groups/:id/taxonomy-links", isAuthenticated, async (req, res) => {
    try {
      const groupId = parseInt(req.params.id);
      const group = await storage.getGroup(groupId);
      if (!group) return res.status(404).json({ message: "Group not found" });
      const userId = (req.user as any).claims.sub;
      if (group.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const userTaxonomy = await storage.getTaxonomy(userId);
      const validTaxIds = new Set(userTaxonomy.map((t: any) => t.id));

      const links = (req.body.links || [])
        .filter((l: any) => typeof l.taxonomyId === "number" && validTaxIds.has(l.taxonomyId))
        .map((l: any) => ({
          groupId,
          taxonomyId: l.taxonomyId,
          confidence: typeof l.confidence === "number" ? Math.min(100, Math.max(0, l.confidence)) : null,
          reasoning: typeof l.reasoning === "string" ? l.reasoning.trim() : null,
        }));
      const saved = await storage.setGroupTaxonomyLinks(groupId, links);
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === Group Data Enrichment ===
  app.post("/api/groups/:id/enrich", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const group = await storage.getGroup(id);
      if (!group) return res.status(404).json({ message: "Group not found" });
      if (group.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      const userId = (req.user as any).claims.sub;
      const taxonomyCategories = await storage.getTaxonomy(userId);
      const activeCategories = taxonomyCategories.filter((c: any) => c.active);

      const taxonomyList = activeCategories.map((c: any) => `- ${c.name}: ${c.description || "No description"}`).join("\n");

      const prompt = `You are a research assistant for a community development organisation in Aotearoa New Zealand called The Reserve. Given the following organisation/group name and type, look up what you know about them and return structured information.

Organisation Name: "${group.name}"
Type: "${group.type}"
${group.address ? `Known Address: "${group.address}"` : ""}
${group.description ? `Existing Description: "${group.description}"` : ""}

PART 1 - Organisation Info:
Return basic information about this organisation. Use null for any field you cannot confidently determine.

PART 2 - Kaupapa Matching:
The Reserve tracks impact across these taxonomy categories:
${taxonomyList}

Analyse what this organisation does and match it to the relevant impact categories above. For each match, provide:
- The exact category name
- A confidence score (0-100) reflecting how strongly their work aligns
- A brief reasoning explaining the connection (1-2 sentences)

If the organisation has no clear social outcome or community impact, match them to "Business Progress" as we are simply supporting their economic development/growth.

An organisation can match multiple categories. Only include categories with genuine relevance (confidence >= 40).

Return a JSON object with this structure:
{
  "description": "A concise 2-3 sentence description of what this organisation does, their mission, and key activities",
  "contactEmail": "their publicly listed email address or null",
  "contactPhone": "their publicly listed phone number or null",
  "address": "their physical address or null",
  "website": "their website URL or null",
  "notes": "Any additional useful context: founding year, key people, partnerships, sector focus, community they serve. Keep to 2-3 bullet points.",
  "kaupapa": [
    {
      "category": "exact category name from the list above",
      "confidence": 85,
      "reasoning": "Why this organisation's work aligns with this impact area"
    }
  ]
}

Important:
- Only include information you are reasonably confident about
- For NZ organisations, consider checking known databases like Charities Register, Companies Register, community directories
- If you are unsure about the organisation, still provide what you can and note uncertainty in the notes field
- Format phone numbers in NZ format (+64...)
- Keep the description factual and professional
- Every organisation should have at least one kaupapa match — if nothing else fits, use "Business Progress"`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const raw = JSON.parse(response.choices[0].message.content || "{}");
      const ALLOWED_FIELDS = ["description", "contactEmail", "contactPhone", "address", "website", "notes"];
      const enrichment: Record<string, any> = {};
      for (const field of ALLOWED_FIELDS) {
        enrichment[field] = typeof raw[field] === "string" && raw[field].trim() ? raw[field].trim() : null;
      }

      const categoryMap = new Map(activeCategories.map((c: any) => [c.name.toLowerCase(), c]));
      const kaupapa: any[] = [];
      if (Array.isArray(raw.kaupapa)) {
        for (const match of raw.kaupapa) {
          if (!match.category) continue;
          const cat = categoryMap.get(match.category.toLowerCase());
          if (!cat) continue;
          const confidence = typeof match.confidence === "number" ? Math.min(100, Math.max(0, match.confidence)) : 50;
          if (confidence < 40) continue;
          kaupapa.push({
            taxonomyId: cat.id,
            category: cat.name,
            color: cat.color,
            confidence,
            reasoning: typeof match.reasoning === "string" ? match.reasoning.trim() : null,
          });
        }
      }
      if (kaupapa.length === 0) {
        const fallback = activeCategories.find((c: any) => c.name === "Business Progress");
        if (fallback) {
          kaupapa.push({
            taxonomyId: fallback.id,
            category: fallback.name,
            color: fallback.color,
            confidence: 60,
            reasoning: "Supporting economic development and business growth",
          });
        }
      }
      enrichment.kaupapa = kaupapa;

      res.json(enrichment);
    } catch (err: any) {
      console.error("Group enrichment error:", err);
      res.status(500).json({ message: "Failed to enrich group data" });
    }
  });

  app.post("/api/google-calendar/link", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { eventId, googleCalendarEventId } = req.body;

      if (!eventId || !googleCalendarEventId) {
        return res.status(400).json({ message: "eventId and googleCalendarEventId required" });
      }

      const event = await storage.getEvent(eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const updated = await storage.updateEvent(eventId, { googleCalendarEventId });
      res.json(updated);
    } catch (err: any) {
      console.error("Link error:", err.message);
      res.status(500).json({ message: "Failed to link event" });
    }
  });

  // === REPORTING ROUTES ===

  app.post("/api/reports/generate", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { startDate, endDate, programmeIds, taxonomyIds, demographicSegments, funder } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }

      const filters: ReportFilters = {
        userId,
        startDate,
        endDate,
        programmeIds,
        taxonomyIds,
        demographicSegments,
        funder,
      };

      const report = await getFullMonthlyReport(filters);
      res.json(report);
    } catch (err: any) {
      console.error("Report generation error:", err);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  app.post("/api/reports/narrative", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { startDate, endDate, programmeIds, taxonomyIds, demographicSegments, funder } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }

      const filters: ReportFilters = {
        userId,
        startDate,
        endDate,
        programmeIds,
        taxonomyIds,
        demographicSegments,
        funder,
      };

      const result = await generateNarrative(filters);
      res.json(result);
    } catch (err: any) {
      console.error("Narrative generation error:", err);
      res.status(500).json({ message: "Failed to generate narrative" });
    }
  });

  app.get("/api/reports", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const savedReports = await storage.getReports(userId);
      res.json(savedReports);
    } catch (err: any) {
      console.error("Get reports error:", err);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  app.get("/api/reports/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const report = await storage.getReport(parseInt(req.params.id));
      if (!report || report.userId !== userId) return res.status(404).json({ message: "Report not found" });
      res.json(report);
    } catch (err: any) {
      console.error("Get report error:", err);
      res.status(500).json({ message: "Failed to fetch report" });
    }
  });

  app.post("/api/reports/save", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { title, type, startDate, endDate, filters, snapshotData, narrative } = req.body;

      if (!title || !startDate || !endDate) {
        return res.status(400).json({ message: "title, startDate, and endDate are required" });
      }

      const report = await storage.createReport({
        userId,
        title,
        type: type || "monthly",
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        filters: filters || {},
        snapshotData,
        narrative,
        status: "draft",
      });
      res.status(201).json(report);
    } catch (err: any) {
      console.error("Save report error:", err);
      res.status(500).json({ message: "Failed to save report" });
    }
  });

  app.patch("/api/reports/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseInt(req.params.id);
      const report = await storage.getReport(id);
      if (!report || report.userId !== userId) return res.status(404).json({ message: "Report not found" });

      const updated = await storage.updateReport(id, req.body);
      res.json(updated);
    } catch (err: any) {
      console.error("Update report error:", err);
      res.status(500).json({ message: "Failed to update report" });
    }
  });

  app.delete("/api/reports/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseInt(req.params.id);
      const report = await storage.getReport(id);
      if (!report || report.userId !== userId) return res.status(404).json({ message: "Report not found" });
      await storage.deleteReport(id);
      res.status(204).end();
    } catch (err: any) {
      console.error("Delete report error:", err);
      res.status(500).json({ message: "Failed to delete report" });
    }
  });

  return httpServer;
}
