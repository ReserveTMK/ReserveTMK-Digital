import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerAudioRoutes } from "./replit_integrations/audio/routes";
import { openai } from "./replit_integrations/audio/client"; // Use standard client

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
        - metrics: Object with 'mindset', 'skill', 'confidence' scores from 1-10 based on the text.
        
        Text: "${text}"
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      
      // Default fallback
      const analysis = {
        summary: result.summary || "No summary generated.",
        keywords: result.keywords || [],
        metrics: {
          mindset: result.metrics?.mindset || 5,
          skill: result.metrics?.skill || 5,
          confidence: result.metrics?.confidence || 5,
        }
      };

      res.json(analysis);

    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ message: "Failed to analyze text" });
    }
  });

  // === Reports API ===

  app.get("/api/reports", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { startDate, endDate, contactId, role } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);

      const userContacts = await storage.getContacts(userId);
      let filteredContacts = userContacts;

      if (contactId) {
        filteredContacts = filteredContacts.filter(c => c.id === parseInt(contactId as string));
      }
      if (role && role !== "all") {
        filteredContacts = filteredContacts.filter(c => c.role === role);
      }

      const contactIds = filteredContacts.map(c => c.id);

      const allInteractions = await Promise.all(
        contactIds.map(id => storage.getInteractions(id))
      );
      const flatInteractions = allInteractions.flat().filter(i => {
        const d = new Date(i.date);
        return d >= start && d <= end;
      });

      const allMeetings = await storage.getMeetings(userId);
      const filteredMeetings = allMeetings.filter(m => {
        const d = new Date(m.startTime);
        return d >= start && d <= end && contactIds.includes(m.contactId);
      });

      const allEvents = await storage.getEvents(userId);
      const filteredEvents = allEvents.filter(ev => {
        const d = new Date(ev.startTime);
        return d >= start && d <= end;
      });

      const eventsByType: Record<string, number> = {};
      let totalAttendees = 0;
      filteredEvents.forEach(ev => {
        eventsByType[ev.type] = (eventsByType[ev.type] || 0) + 1;
        totalAttendees += ev.attendeeCount || 0;
      });

      const interactionsByType: Record<string, number> = {};
      flatInteractions.forEach(i => {
        interactionsByType[i.type] = (interactionsByType[i.type] || 0) + 1;
      });

      const meetingsByStatus: Record<string, number> = {};
      filteredMeetings.forEach(m => {
        meetingsByStatus[m.status] = (meetingsByStatus[m.status] || 0) + 1;
      });

      let totalMindset = 0, totalSkill = 0, totalConfidence = 0, scoredCount = 0;
      flatInteractions.forEach(i => {
        const a = i.analysis as any;
        if (a?.mindsetScore || a?.skillScore || a?.confidenceScore) {
          totalMindset += a.mindsetScore || 0;
          totalSkill += a.skillScore || 0;
          totalConfidence += a.confidenceScore || 0;
          scoredCount++;
        }
      });

      const contactBreakdowns = filteredContacts.map(c => {
        const cInteractions = flatInteractions.filter(i => i.contactId === c.id);
        const cMeetings = filteredMeetings.filter(m => m.contactId === c.id);

        let cMindset = 0, cSkill = 0, cConfidence = 0, cScored = 0;
        cInteractions.forEach(i => {
          const a = i.analysis as any;
          if (a?.mindsetScore || a?.skillScore || a?.confidenceScore) {
            cMindset += a.mindsetScore || 0;
            cSkill += a.skillScore || 0;
            cConfidence += a.confidenceScore || 0;
            cScored++;
          }
        });

        return {
          contactId: c.id,
          contactName: c.name,
          businessName: c.businessName,
          role: c.role,
          interactionCount: cInteractions.length,
          meetingCount: cMeetings.length,
          completedMeetings: cMeetings.filter(m => m.status === "completed").length,
          avgMindset: cScored > 0 ? Math.round((cMindset / cScored) * 10) / 10 : null,
          avgSkill: cScored > 0 ? Math.round((cSkill / cScored) * 10) / 10 : null,
          avgConfidence: cScored > 0 ? Math.round((cConfidence / cScored) * 10) / 10 : null,
          currentMetrics: c.metrics,
        };
      });

      res.json({
        period: { startDate: start.toISOString(), endDate: end.toISOString() },
        summary: {
          totalInteractions: flatInteractions.length,
          totalMeetings: filteredMeetings.length,
          totalContacts: filteredContacts.length,
          totalEvents: filteredEvents.length,
          totalAttendees,
          interactionsByType,
          meetingsByStatus,
          eventsByType,
          avgMindset: scoredCount > 0 ? Math.round((totalMindset / scoredCount) * 10) / 10 : null,
          avgSkill: scoredCount > 0 ? Math.round((totalSkill / scoredCount) * 10) / 10 : null,
          avgConfidence: scoredCount > 0 ? Math.round((totalConfidence / scoredCount) * 10) / 10 : null,
        },
        contactBreakdowns,
      });
    } catch (error) {
      console.error("Report generation error:", error);
      res.status(500).json({ message: "Failed to generate report" });
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
    const existing = await storage.getEvent(id);
    if (!existing) return res.status(404).json({ message: "Event not found" });
    if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

    await storage.deleteEvent(id);
    res.status(204).send();
  });

  return httpServer;
}
