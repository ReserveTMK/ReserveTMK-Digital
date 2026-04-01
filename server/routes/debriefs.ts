import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { api } from "@shared/routes";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { events, impactLogs, impactLogContacts, impactTags, eventAttendance, contacts, impactLogGroups, actionItems, funderTaxonomyClassifications, groupAssociations } from "@shared/schema";
import { claudeJSON, isAnthropicKeyConfigured, AIKeyMissingError } from "../replit_integrations/anthropic/client";
import { classifyForAllFunders } from "../taxonomy-engine";
import { parseId, coerceDateFields } from "./_helpers";

export function registerDebriefRoutes(app: Express) {
  app.get(api.events.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const eventsList = await storage.getEvents(userId);
    res.json(eventsList);
  });

  // === Debrief Queue API (must be before /api/events/:id) ===
  app.get("/api/events/needs-debrief", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userEvents = await storage.getEvents(userId);
      const allDebriefs = await storage.getImpactLogs(userId);
      const now = new Date();

      const needsDebrief = userEvents.filter(e => {
        if (e.eventStatus === "cancelled") return false;
        if (e.debriefSkippedReason) return false;
        const eventEnd = new Date(e.endTime || e.startTime);
        if (eventEnd > now) return false;
        return true;
      });

      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const enriched = needsDebrief.map(e => {
        const eventEnd = new Date(e.endTime || e.startTime);
        // Find best debrief: prefer confirmed > pending_review > draft
        const eventDebriefs = allDebriefs.filter(d => d.eventId === e.id);
        const existingDebrief = eventDebriefs.find(d => d.status === "confirmed")
          || eventDebriefs.find(d => d.status === "pending_review")
          || eventDebriefs.find(d => d.status === "draft")
          || null;
        let queueStatus: "overdue" | "due" | "in_progress" | "confirmed" = "due";
        if (existingDebrief?.status === "confirmed") {
          queueStatus = "confirmed";
        } else if (existingDebrief && (existingDebrief.status === "pending_review" || existingDebrief.status === "draft")) {
          queueStatus = "in_progress";
        } else if (eventEnd < sevenDaysAgo) {
          queueStatus = "overdue";
        }
        return {
          ...e,
          queueStatus,
          existingDebriefId: existingDebrief?.id || null,
          existingDebriefStatus: existingDebrief?.status || null,
        };
      });

      enriched.sort((a, b) => {
        const priority: Record<string, number> = { overdue: 0, due: 1, in_progress: 2, confirmed: 3 };
        if (priority[a.queueStatus] !== priority[b.queueStatus]) {
          return priority[a.queueStatus] - priority[b.queueStatus];
        }
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      });

      res.json(enriched);
    } catch (err) {
      console.error("Debrief queue error:", err);
      res.status(500).json({ message: "Failed to fetch debrief queue" });
    }
  });

  app.post("/api/events/:id/skip-debrief", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const eventId = parseId(req.params.id);
      const { reason } = req.body;

      const event = await storage.getEvent(eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      if (!reason) {
        return res.status(400).json({ message: "Reason is required to skip debrief" });
      }

      await storage.updateEvent(eventId, {
        debriefSkippedReason: reason,
        requiresDebrief: false
      });

      res.json({ message: "Debrief skipped" });
    } catch (err) {
      console.error("Skip debrief error:", err);
      res.status(500).json({ message: "Failed to skip debrief" });
    }
  });

  app.delete("/api/events/:id/skip-debrief", isAuthenticated, async (req, res) => {
    try {
      const eventId = parseId(req.params.id);
      const event = await storage.getEvent(eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      const updated = await storage.undismissEvent(eventId);
      res.json(updated);
    } catch (err) {
      console.error("Un-dismiss debrief error:", err);
      res.status(500).json({ message: "Failed to un-dismiss debrief" });
    }
  });

  app.get("/api/events/dismissed-debriefs", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userEvents = await storage.getEvents(userId);
      const allDebriefs = await storage.getImpactLogs(userId);

      const confirmedEventIds = new Set(
        allDebriefs
          .filter(d => d.eventId && d.status === "confirmed")
          .map(d => d.eventId)
      );

      const dismissed = userEvents.filter(e => {
        if (e.eventStatus === "cancelled") return false;
        if (!e.debriefSkippedReason) return false;
        if (confirmedEventIds.has(e.id)) return false;
        const eventEnd = new Date(e.endTime || e.startTime);
        if (eventEnd > new Date()) return false;
        return true;
      });

      const enriched = dismissed.map(e => ({
        ...e,
        queueStatus: "dismissed" as const,
        existingDebriefId: null,
        existingDebriefStatus: null,
        dismissReason: e.debriefSkippedReason,
      }));

      enriched.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      res.json(enriched);
    } catch (err) {
      console.error("Dismissed debriefs error:", err);
      res.status(500).json({ message: "Failed to fetch dismissed debriefs" });
    }
  });

  app.get(api.events.get.path, isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
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
      const id = parseId(req.params.id);
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
    const id = parseId(req.params.id);
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
      entityId: id as any,
      changes: { reason, deletedEvent: existing.name },
    });

    await storage.deleteEvent(id);
    res.status(204).send();
  });

  // === Event → Programme Linking ===

  app.post("/api/events/:id/link-programme", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
      const event = await storage.getEvent(id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const { programmeId } = req.body;
      if (!programmeId) return res.status(400).json({ message: "programmeId is required" });

      const programme = await storage.getProgramme(programmeId);
      if (!programme || programme.userId !== userId) return res.status(404).json({ message: "Programme not found" });

      const updated = await storage.updateEvent(id, {
        linkedProgrammeId: programmeId,
        requiresDebrief: true,
        type: "Programme Session",
      });
      res.json(updated);
    } catch (err: any) {
      console.error("Link programme error:", err);
      res.status(500).json({ message: "Failed to link programme" });
    }
  });

  app.post("/api/events/:id/convert-to-programme", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
      const event = await storage.getEvent(id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      if (event.linkedProgrammeId) {
        return res.status(400).json({ message: "Event is already linked to a programme" });
      }

      const { classification } = req.body;

      const programme = await storage.createProgramme({
        userId,
        name: event.name,
        description: event.description || undefined,
        classification: classification || "Community Workshop",
        status: new Date(event.startTime) < new Date() ? "completed" : "planned",
        startDate: event.startTime,
        endDate: event.endTime,
        location: event.location || undefined,
      });

      const updated = await storage.updateEvent(id, {
        linkedProgrammeId: programme.id,
        requiresDebrief: true,
        type: "Programme Session",
      });

      res.json({ event: updated, programme });
    } catch (err: any) {
      console.error("Convert to programme error:", err);
      res.status(500).json({ message: "Failed to convert to programme" });
    }
  });

  app.post("/api/events/:id/mark-personal", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
      const event = await storage.getEvent(id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const updated = await storage.updateEvent(id, {
        type: "Personal",
        requiresDebrief: false,
        linkedProgrammeId: null,
        linkedBookingId: null,
      });
      res.json(updated);
    } catch (err: any) {
      console.error("Mark personal error:", err);
      res.status(500).json({ message: "Failed to mark as personal" });
    }
  });

  app.post("/api/events/:id/unlink", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
      const event = await storage.getEvent(id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const updated = await storage.updateEvent(id, {
        linkedProgrammeId: null,
        linkedBookingId: null,
        requiresDebrief: false,
      });
      res.json(updated);
    } catch (err: any) {
      console.error("Unlink error:", err);
      res.status(500).json({ message: "Failed to unlink" });
    }
  });


  // === Event Attendance API ===

  app.get(api.eventAttendance.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const eventId = parseId(req.params.eventId);
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
    const id = parseId(req.params.id);
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
    const id = parseId(req.params.id);
    const log = await storage.getImpactLog(id);
    if (!log) return res.status(404).json({ message: "Impact log not found" });
    if (log.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    res.json(log);
  });

  app.post(api.impactLogs.create.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const gcalEventId = req.body.gcalEventId || null;
      let eventId = req.body.eventId || null;

      // Auto-import: if gcalEventId provided without eventId, ensure internal event exists
      if (gcalEventId && !eventId) {
        try {
          let event = await storage.getEventByGoogleCalendarId(gcalEventId, userId);
          if (!event) {
            event = await storage.createEvent({
              userId,
              name: req.body.title || "Untitled Event",
              type: req.body.eventType || "Meeting",
              startTime: req.body.startTime ? new Date(req.body.startTime) : new Date(),
              endTime: req.body.endTime ? new Date(req.body.endTime) : new Date(),
              location: req.body.location || null,
              description: req.body.description || null,
              googleCalendarEventId: gcalEventId,
              calendarAttendees: req.body.calendarAttendees || null,
              attendeeCount: req.body.attendeeCount || null,
              source: "google",
              requiresDebrief: true,
            });
          }
          eventId = event.id;
        } catch (e) {
          console.warn("[impact-log] Failed to auto-import GCal event:", e);
        }
      }

      // Prevent double debriefs for the same event
      if (eventId) {
        const existing = await storage.getImpactLogs(userId);
        const hasDebrief = existing.find(d => d.eventId === eventId && d.status !== "draft");
        if (hasDebrief) {
          return res.status(409).json({
            message: "This event already has a debrief",
            existingId: hasDebrief.id,
            code: "DUPLICATE_DEBRIEF",
          });
        }
      }

      const input = api.impactLogs.create.input.parse({
        ...req.body,
        userId,
        eventId,
      });
      const log = await storage.createImpactLog(input);

      if (input.eventId) {
        try {
          const event = await storage.getEvent(input.eventId);
          if (event && event.calendarAttendees && Array.isArray(event.calendarAttendees)) {
            const userContacts = await storage.getContacts(userId);
            const emailToContact = new Map<string, { id: number; name: string }>();
            for (const c of userContacts) {
              if (c.email) {
                const emails = c.email.split(/[,;]\s*/).map((e: string) => e.trim().toLowerCase()).filter((e: string) => e.includes("@"));
                for (const em of emails) {
                  emailToContact.set(em, { id: c.id, name: c.name });
                }
              }
            }

            for (const attendee of event.calendarAttendees as Array<{ email: string; displayName?: string; responseStatus?: string; organizer?: boolean }>) {
              if (!attendee.email || typeof attendee.email !== "string") continue;
              const normalizedEmail = attendee.email.trim().toLowerCase();
              if (!normalizedEmail.includes("@")) continue;
              const matchedContact = emailToContact.get(normalizedEmail);
              if (matchedContact) {
                const role = (attendee.organizer === true || attendee.responseStatus === "accepted") ? "primary" : "mentioned";
                try {
                  const existingLink = await db.select().from(impactLogContacts).where(
                    and(eq(impactLogContacts.impactLogId, log.id), eq(impactLogContacts.contactId, matchedContact.id))
                  );
                  if (existingLink.length === 0) {
                    await storage.addImpactLogContact({
                      impactLogId: log.id,
                      contactId: matchedContact.id,
                      role,
                    });
                  }
                } catch (linkErr) {
                  console.warn(`Failed to auto-link contact ${matchedContact.id} to debrief ${log.id}:`, linkErr);
                }
              }
            }
          }
        } catch (autoLinkErr) {
          console.warn("Auto-link calendar attendees failed:", autoLinkErr);
        }
      }

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
      const id = parseId(req.params.id);
      const existing = await storage.getImpactLog(id);
      if (!existing) return res.status(404).json({ message: "Impact log not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const input = api.impactLogs.update.input.parse(coerceDateFields(req.body));
      if (input.status) {
        const validTransitions: Record<string, string[]> = {
          draft: ['pending_review', 'confirmed'],
          pending_review: ['draft', 'confirmed'],
          confirmed: ['confirmed', 'pending_review', 'draft'],
        };
        const currentStatus = existing.status || 'draft';
        const allowed = validTransitions[currentStatus] || [];
        if (!allowed.includes(input.status)) {
          return res.status(400).json({ message: `Cannot transition from '${currentStatus}' to '${input.status}'` });
        }
        if (input.status === 'confirmed') {
          input.confirmedAt = new Date();
        }
      }
      // Clean up when un-confirming: remove action items + taxonomy classifications
      if (input.status && input.status !== 'confirmed' && existing.status === 'confirmed') {
        try {
          await db.delete(actionItems).where(eq(actionItems.impactLogId, id));
          await db.delete(funderTaxonomyClassifications).where(
            and(eq(funderTaxonomyClassifications.entityType, "debrief"), eq(funderTaxonomyClassifications.entityId, id))
          );
        } catch (e) {
          console.warn(`Un-confirm cleanup failed for debrief ${id}:`, e);
        }
      }

      const updated = await storage.updateImpactLog(id, input);

      if (input.status === 'confirmed' && input.reviewedData) {
        const userId = (req.user as any).claims.sub;
        const reviewed = input.reviewedData as Record<string, unknown>;
        const actionItemsArr = Array.isArray(reviewed.actionItems) ? reviewed.actionItems : [];
        const communityArr = Array.isArray(reviewed.communityActions) ? reviewed.communityActions : [];
        const operationalArr = Array.isArray(reviewed.operationalActions) ? reviewed.operationalActions : [];
        const allActions: Array<{ title: string; category: string }> = [
          ...actionItemsArr.map((a: Record<string, unknown>) => ({
            title: String(a.title || a.task || 'Untitled action'),
            category: 'action',
          })),
          ...communityArr.map((a: Record<string, unknown>) => ({
            title: String(a.task || a.title || 'Untitled action'),
            category: 'community',
          })),
          ...operationalArr.map((a: Record<string, unknown>) => ({
            title: String(a.task || a.title || 'Untitled action'),
            category: 'operational',
          })),
        ];
        const actionErrors: string[] = [];
        for (const action of allActions) {
          try {
            await storage.createActionItem({
              userId,
              impactLogId: id,
              title: action.title,
              description: `[${action.category}]`,
              status: 'pending',
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            actionErrors.push(msg);
          }
        }
        if (actionErrors.length > 0) {
          console.error(`Failed to persist ${actionErrors.length} action item(s) for impact log ${id}:`, actionErrors);
          return res.status(207).json({
            ...updated,
            _warnings: [`${actionErrors.length} action item(s) could not be saved`],
          });
        }

        // Snapshot primary contacts' metrics before any changes
        try {
          const logContacts = await storage.getImpactLogContacts(id);
          const primaryContacts = logContacts.filter((c: any) => c.role === "primary");
          for (const pc of primaryContacts) {
            const contact = await storage.getContact(pc.contactId);
            if (contact?.metrics && typeof contact.metrics === "object" && Object.keys(contact.metrics).length > 0) {
              await storage.createMetricSnapshot({
                contactId: pc.contactId,
                userId,
                metrics: contact.metrics as any,
                source: "debrief",
              });
            }
          }
        } catch (e) {
          console.warn(`Metric snapshot failed for debrief ${id}:`, e);
        }

        // Classify through funder taxonomy lenses (fire-and-forget)
        classifyForAllFunders("debrief", id, userId).catch((err) =>
          console.error(`Taxonomy classification failed for debrief ${id}:`, err),
        );
      }

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
    const id = parseId(req.params.id);
    const existing = await storage.getImpactLog(id);
    if (!existing) return res.status(404).json({ message: "Impact log not found" });
    if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteImpactLog(id);
    res.status(204).send();
  });

  // Impact Log Contacts
  app.get(api.impactLogs.contacts.list.path, isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
    const log = await storage.getImpactLog(id);
    if (!log) return res.status(404).json({ message: "Impact log not found" });
    if (log.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    const contacts = await storage.getImpactLogContacts(id);
    res.json(contacts);
  });

  app.post(api.impactLogs.contacts.add.path, isAuthenticated, async (req, res) => {
    try {
      const impactLogId = parseId(req.params.id);
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
      const existing = await db.select().from(impactLogContacts).where(
        and(eq(impactLogContacts.impactLogId, impactLogId), eq(impactLogContacts.contactId, input.contactId))
      );
      if (existing.length > 0) {
        return res.status(200).json(existing[0]);
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
    const id = parseId(req.params.id);
    const userId = (req.user as any).claims.sub;
    const contactLink = await db.select().from(impactLogContacts).where(eq(impactLogContacts.id, id));
    if (!contactLink.length) return res.status(404).json({ message: "Contact link not found" });
    const log = await storage.getImpactLog(contactLink[0].impactLogId);
    if (!log || log.userId !== userId) return res.status(403).json({ message: "Forbidden" });
    await storage.removeImpactLogContact(id);
    res.status(204).send();
  });

  // Impact Log Tags
  app.get(api.impactLogs.tags.list.path, isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
    const log = await storage.getImpactLog(id);
    if (!log) return res.status(404).json({ message: "Impact log not found" });
    if (log.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    const tags = await storage.getImpactTags(id);
    res.json(tags);
  });

  app.post(api.impactLogs.tags.add.path, isAuthenticated, async (req, res) => {
    try {
      const impactLogId = parseId(req.params.id);
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
    const id = parseId(req.params.id);
    const userId = (req.user as any).claims.sub;
    const [tag] = await db.select().from(impactTags).where(eq(impactTags.id, id));
    if (!tag) return res.status(404).json({ message: "Impact tag not found" });
    const log = await storage.getImpactLog(tag.impactLogId);
    if (!log || log.userId !== userId) return res.status(403).json({ message: "Forbidden" });
    await storage.removeImpactTag(id);
    res.status(204).send();
  });

  async function getParentGroupIds(groupId: number): Promise<number[]> {
    const parentAssocs = await db.select().from(groupAssociations).where(
      and(
        eq(groupAssociations.associatedGroupId, groupId),
        eq(groupAssociations.relationshipType, "parent")
      )
    );
    return parentAssocs.map(a => a.groupId);
  }

  app.get("/api/impact-logs/:id/groups", isAuthenticated, async (req, res) => {
    try {
      const impactLogId = parseId(req.params.id);
      const log = await storage.getImpactLog(impactLogId);
      if (!log) return res.status(404).json({ message: "Impact log not found" });
      if (log.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const linkedGroups = await db.select().from(impactLogGroups).where(eq(impactLogGroups.impactLogId, impactLogId));
      res.json(linkedGroups);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/impact-logs/:id/groups", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const impactLogId = parseId(req.params.id);
      const log = await storage.getImpactLog(impactLogId);
      if (!log) return res.status(404).json({ message: "Impact log not found" });
      if (log.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const { groupId } = req.body;
      if (!groupId) return res.status(400).json({ message: "groupId is required" });

      const targetGroup = await storage.getGroup(groupId);
      if (!targetGroup || targetGroup.userId !== userId) {
        return res.status(404).json({ message: "Group not found" });
      }

      const existing = await db.select().from(impactLogGroups).where(
        and(eq(impactLogGroups.impactLogId, impactLogId), eq(impactLogGroups.groupId, groupId))
      );
      if (existing.length > 0) {
        return res.status(409).json({ message: "Group already linked" });
      }
      const [link] = await db.insert(impactLogGroups).values({ impactLogId, groupId }).returning();

      const parentIds = await getParentGroupIds(groupId);
      const autoLinked: any[] = [];
      for (const parentId of parentIds) {
        const parentGroup = await storage.getGroup(parentId);
        if (!parentGroup || parentGroup.userId !== userId) continue;
        const parentExists = await db.select().from(impactLogGroups).where(
          and(eq(impactLogGroups.impactLogId, impactLogId), eq(impactLogGroups.groupId, parentId))
        );
        if (parentExists.length === 0) {
          const [parentLink] = await db.insert(impactLogGroups).values({ impactLogId, groupId: parentId }).returning();
          autoLinked.push(parentLink);
        }
      }

      res.status(201).json({ link, autoLinked });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/impact-logs/:logId/groups/:linkId", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const logId = parseId(req.params.logId);
      const linkId = parseId(req.params.linkId);
      const log = await storage.getImpactLog(logId);
      if (!log) return res.status(404).json({ message: "Impact log not found" });
      if (log.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const [link] = await db.select().from(impactLogGroups).where(
        and(eq(impactLogGroups.id, linkId), eq(impactLogGroups.impactLogId, logId))
      );
      if (!link) return res.status(404).json({ message: "Link not found" });
      await db.delete(impactLogGroups).where(eq(impactLogGroups.id, linkId));
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
