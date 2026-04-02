import type { Express } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { events, mentorProfiles } from "@shared/schema";
import { parseId, parseStr, classifyEventFromCalendar } from "./_helpers";

export function registerCalendarRoutes(app: Express) {
  // === Google Calendar API ===

  app.get("/api/google-calendar/events", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { getUncachableGoogleCalendarClient } = await import("../replit_integrations/google-calendar/client");
      const calendar = await getUncachableGoogleCalendarClient(userId);

      const timeMin = (parseStr(req.query.timeMin)) || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const timeMax = (parseStr(req.query.timeMax)) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const scopeCalendarId = req.query.calendarId ? parseStr(req.query.calendarId) : null;

      const additionalCalendars = await storage.getCalendarSettings(userId);
      const defaultCalendarIds = ["primary", ...additionalCalendars.filter(c => c.active).map(c => c.calendarId)];

      let calendarIds: string[];
      if (scopeCalendarId) {
        const allowedCalendarIds = new Set(defaultCalendarIds);
        const allMentorProfs = await db.select().from(mentorProfiles).where(eq(mentorProfiles.userId, userId));
        for (const mp of allMentorProfs) {
          if (mp.googleCalendarId) allowedCalendarIds.add(mp.googleCalendarId);
        }
        if (!allowedCalendarIds.has(scopeCalendarId)) {
          return res.status(403).json({ message: "Calendar not authorized" });
        }
        calendarIds = [scopeCalendarId];
      } else {
        calendarIds = defaultCalendarIds;
      }

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
            if (e.status === "cancelled") continue;

            const isOrganizer = e.organizer?.self === true;
            const userAttendee = (e.attendees || []).find((a: any) => a.self === true);

            if (userAttendee) {
              const rs = userAttendee.responseStatus;
              if (rs === "declined" || rs === "needsAction") continue;
            } else if (e.attendees && e.attendees.length > 0 && !isOrganizer) {
              continue;
            }

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
                organizer: a.organizer === true,
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

      // Auto-classify and match contacts
      const allContacts = await storage.getContacts(userId);
      const emailToContact = new Map<string, { id: number; name: string }>();
      const ownEmails = new Set(["ra@reservetmk.co.nz", "kim@reservetmk.co.nz", "kiaora@reservetmk.co.nz"]);
      for (const c of allContacts) {
        if (!c.email) continue;
        for (const e of c.email.split(/[,;]\s*/)) {
          const em = e.trim().toLowerCase();
          if (em && !ownEmails.has(em)) emailToContact.set(em, { id: c.id, name: c.name });
        }
      }

      for (const ev of allEvents) {
        // Suggested type from source calendar
        ev.suggestedType = classifyEventFromCalendar(ev.calendarId, additionalCalendars.filter(c => c.label).map(c => ({ calendarId: c.calendarId, label: c.label! })), ev.summary);

        // Match attendees to contacts
        const matched: { contactId: number; contactName: string; email: string }[] = [];
        for (const att of (ev.attendees || [])) {
          const em = (att.email || "").toLowerCase();
          if (ownEmails.has(em)) continue;
          const contact = emailToContact.get(em);
          if (contact) {
            matched.push({ contactId: contact.id, contactName: contact.name, email: em });
          }
        }
        ev.matchedContacts = matched;

        // Calendar label for frontend display
        const calSetting = additionalCalendars.find(c => c.calendarId === ev.calendarId);
        ev.calendarLabel = calSetting?.label || (ev.calendarId === "primary" ? "Ra" : null);
      }

      allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      res.json(allEvents);
    } catch (err: any) {
      console.error("Google Calendar fetch error:", err.message);
      res.status(500).json({ message: "Failed to fetch Google Calendar events: " + err.message });
    }
  });

  app.get("/api/google-calendar/status", isAuthenticated, async (req, res) => {
    try {
      const { isCalendarConnected } = await import("../replit_integrations/google-calendar/client");
      const userId = (req as any).user?.claims?.sub;
      res.json({ connected: await isCalendarConnected(userId) });
    } catch {
      res.json({ connected: false });
    }
  });

  app.get("/api/google-calendar/list", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      const { getUncachableGoogleCalendarClient } = await import("../replit_integrations/google-calendar/client");
      const calendar = await getUncachableGoogleCalendarClient(userId);

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
      console.error("Google Calendar list error:", err.message, err.response?.data);
      res.status(500).json({ message: "Failed to list calendars: " + err.message, detail: err.response?.data });
    }
  });

  // One-time repair: fix events with 0-duration (broken initial sync)
  app.post("/api/google-calendar/repair-dates", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { getUncachableGoogleCalendarClient } = await import("../replit_integrations/google-calendar/client");
      const calendar = await getUncachableGoogleCalendarClient(userId);

      // Find events with 0 duration (start === end)
      const broken = await db.select().from(events)
        .where(and(
          eq(events.userId, userId),
          eq(events.source, "google"),
          sql`${events.startTime} = ${events.endTime}`,
        ));

      let fixed = 0;
      const results: { id: number; name: string; status: string; newStart?: string; newEnd?: string }[] = [];

      for (const evt of broken) {
        if (!evt.googleCalendarEventId) continue;
        try {
          // Try each calendar to find the event
          const calSettings = await storage.getCalendarSettings(userId);
          let found = false;
          for (const cal of calSettings) {
            try {
              const gcalEvt = await calendar.events.get({
                calendarId: cal.calendarId,
                eventId: evt.googleCalendarEventId,
              });
              const start = gcalEvt.data.start?.dateTime || gcalEvt.data.start?.date;
              const end = gcalEvt.data.end?.dateTime || gcalEvt.data.end?.date;
              if (start && end) {
                await storage.updateEvent(evt.id, {
                  startTime: new Date(start),
                  endTime: new Date(end),
                });
                results.push({ id: evt.id, name: evt.name, status: "fixed", newStart: start, newEnd: end });
                fixed++;
                found = true;
                break;
              }
            } catch { /* not in this calendar */ }
          }
          if (!found) results.push({ id: evt.id, name: evt.name, status: "not_found" });
        } catch (e: any) {
          results.push({ id: evt.id, name: evt.name, status: `error: ${e.message}` });
        }
      }

      res.json({ total: broken.length, fixed, results });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/google-calendar/reconcile", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { googleCalendarEventId, summary, description, location, start, end, type, attendees } = req.body;

      if (!googleCalendarEventId || !summary || !start || !end) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const existing = await storage.getEventByGoogleCalendarId(googleCalendarEventId, userId);
      if (existing) {
        return res.status(409).json({ message: "This calendar event is already linked to an app event", event: existing });
      }

      const calendarAttendees = Array.isArray(attendees)
        ? attendees
            .filter((a: any) => a && typeof a.email === "string" && a.email.includes("@"))
            .map((a: any) => ({ email: a.email, displayName: a.displayName || a.email, responseStatus: a.responseStatus, organizer: a.organizer === true }))
        : null;

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
        attendeeCount: calendarAttendees ? calendarAttendees.length : null,
        calendarAttendees,
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
    const id = parseId(req.params.id);
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
    const id = parseId(req.params.id);
    await storage.deleteCalendarSetting(id);
    res.json({ success: true });
  });

  app.patch("/api/calendar-settings/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const { autoImport } = req.body;
      const updated = await storage.updateCalendarSetting(id, { autoImport });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Google Calendar link (associate app event with gcal event)
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

  // === GOOGLE CALENDAR OAUTH ===

  app.get("/api/google-calendar/oauth/authorize", isAuthenticated, async (req, res) => {
    const { getGoogleCalendarOAuth2Client } = await import("../replit_integrations/google-calendar/client");
    const oauth2Client = getGoogleCalendarOAuth2Client();
    if (!oauth2Client) {
      return res.status(400).json({ message: "Google OAuth not configured." });
    }

    const cryptoMod = await import('crypto');
    const userId = (req.user as any).claims.sub;
    const nonce = cryptoMod.randomBytes(16).toString('hex');
    const secret = process.env.SESSION_SECRET || 'gcal-oauth-state';
    const payload = JSON.stringify({ userId, nonce, ts: Date.now() });
    const hmac = cryptoMod.createHmac('sha256', secret).update(payload).digest('hex');
    const state = Buffer.from(JSON.stringify({ payload, hmac })).toString('base64');

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      state,
    });

    res.json({ url });
  });

  app.get("/api/google-calendar/oauth/callback", async (req, res) => {
    const { code, state, error: oauthError } = req.query;
    if (!code || !state) {
      return res.redirect(`/calendar?error=${oauthError || 'missing_params'}`);
    }

    let userId: string;
    try {
      const cryptoMod = await import('crypto');
      const decoded = JSON.parse(Buffer.from(state as string, 'base64').toString());
      const { payload, hmac } = decoded;
      const secret = process.env.SESSION_SECRET || 'gcal-oauth-state';
      const expectedHmac = cryptoMod.createHmac('sha256', secret).update(payload).digest('hex');
      if (hmac !== expectedHmac) return res.redirect('/calendar?error=invalid_state');
      const parsed = JSON.parse(payload);
      if (Date.now() - parsed.ts > 10 * 60 * 1000) return res.redirect('/calendar?error=state_expired');
      userId = parsed.userId;
    } catch {
      return res.redirect('/calendar?error=invalid_state');
    }

    const { getGoogleCalendarOAuth2Client, storeCalendarTokens } = await import("../replit_integrations/google-calendar/client");
    const oauth2Client = getGoogleCalendarOAuth2Client();
    if (!oauth2Client) return res.redirect('/calendar?error=not_configured');

    try {
      const { tokens } = await oauth2Client.getToken(code as string);
      storeCalendarTokens(userId, tokens);
      console.log(`[GCal OAuth] Connected for userId=${userId}`);
      res.redirect('/calendar?success=calendar_connected');
    } catch (err: any) {
      console.error('[GCal OAuth] Callback error:', err);
      res.redirect('/calendar?error=auth_failed');
    }
  });

  app.get("/api/google-calendar/oauth/status", isAuthenticated, async (req, res) => {
    const { isCalendarConnected } = await import("../replit_integrations/google-calendar/client");
    const userId = (req.user as any).claims.sub;
    res.json({ connected: await isCalendarConnected(userId) });
  });

  app.get("/api/google-calendar/health", isAuthenticated, async (req, res) => {
    try {
      const { getCalendarHealth } = await import("../replit_integrations/google-calendar/client");
      const userId = (req.user as any).claims.sub;
      const health = await getCalendarHealth(userId);
      res.json(health);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
