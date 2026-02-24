import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerAudioRoutes } from "./replit_integrations/audio/routes";
import { openai } from "./replit_integrations/audio/client";
import { getFullMonthlyReport, generateNarrative, type ReportFilters } from "./reporting";
import { getNZWeekStart, getNZWeekEnd } from "@shared/nz-week";
import { insertCommunitySpendSchema } from "@shared/schema";
import { scanGmailEmails, startAutoSync, getGmailOAuth2Client } from "./gmail-import";

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

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const LEGACY_METRIC_KEYS = [
  { key: "activations_total", label: "Total Activations", unit: "count" },
  { key: "activations_workshops", label: "Workshops", unit: "count" },
  { key: "activations_mentoring", label: "Mentoring Sessions", unit: "count" },
  { key: "activations_events", label: "Events", unit: "count" },
  { key: "activations_partner_meetings", label: "Partner Meetings", unit: "count" },
  { key: "hub_foottraffic", label: "Hub Foot Traffic", unit: "count" },
  { key: "bookings_total", label: "Total Bookings", unit: "count" },
];

const METRIC_KEY_TO_SNAPSHOT_FIELD: Record<string, string> = {
  activations_total: "activationsTotal",
  activations_workshops: "activationsWorkshops",
  activations_mentoring: "activationsMentoring",
  activations_events: "activationsEvents",
  activations_partner_meetings: "activationsPartnerMeetings",
  hub_foottraffic: "foottrafficUnique",
  bookings_total: "bookingsTotal",
};

function buildExtractionPrompt(pdfText: string): string {
  return `You are an impact data analyst extracting information from a community organisation MONTHLY report.

CRITICAL: These reports often contain YEAR-TO-DATE (YTD) cumulative tallies alongside monthly numbers. You MUST:
- Look for column headers or labels indicating "YTD", "Year to Date", "Total", "Cumulative", quarterly totals
- Extract ONLY the SINGLE MONTH's figures, NOT the YTD/cumulative/quarterly totals
- If only YTD or quarterly figures are available and no single-month breakdown exists, set the value to null rather than guessing
- If there are columns for each month (e.g. Jul, Aug, Sep) and a quarterly/YTD total column, extract ONLY the specific month's column value
- The report title usually says the month (e.g. "August 2025") - extract data for THAT month only

Extract FIVE types of information:

0. REPORT DATE - Look at the document title, header, or first page for the report's month and year. Common patterns:
- "Monthly Report - August 2025"
- "August 2025 Report"
- "Report for the month of August 2025"
- "TMK Monthly Report Aug 2025"
- "The Reserve - September 2024"
Return the detected month (1-12) and year (e.g. 2025). If not found, return null for both.

1. QUANTITATIVE METRICS - For each metric below, find the SINGLE MONTH value:
${LEGACY_METRIC_KEYS.map(m => `- ${m.key} (${m.label}, unit: ${m.unit})`).join("\n")}

2. ORGANISATIONS & PARTNERS - Extract names of organisations, businesses, community groups, partners mentioned in the report. Include:
- Partner organisations
- Businesses mentored or supported
- Community groups engaged
- Community collectives
- Resident companies
- Any named collective, trust, or entity

3. NARRATIVE HIGHLIGHTS - Extract key themes, achievements, and activities described in the report. Capture:
- Major accomplishments or milestones
- Key programmes or events described
- Community outcomes or stories
- Challenges or growth areas mentioned

4. PEOPLE - Extract names of specific individuals mentioned (facilitators, mentees, community leaders, partners). Do NOT include generic titles without names.

Report text:
"""
${pdfText.substring(0, 12000)}
"""

Respond in JSON format only:
{
  "detectedMonth": 8,
  "detectedYear": 2025,
  "metrics": [
    { "metricKey": "activations_total", "metricValue": 42, "metricUnit": "count", "confidence": 85, "evidenceSnippet": "exact text snippet (max 200 chars)" }
  ],
  "organisations": [
    { "name": "Org Name", "type": "partner|business|community_group|community_collective|resident_company|government|iwi|ngo|education|other", "description": "brief context about this org from the report", "relationship": "mentored|partnered|engaged|supported|hosted|other" }
  ],
  "highlights": [
    { "theme": "short theme label", "summary": "2-3 sentence description of this highlight from the report", "activityType": "workshop|mentoring|event|community|partnership|programme|other" }
  ],
  "people": [
    { "name": "Person Name", "role": "facilitator|mentee|partner|leader|other", "context": "brief context about their mention" }
  ]
}

Rules:
- For detectedMonth/detectedYear: Look at the document title, heading, or header for the month and year this report covers. Return null if not found.
- For metrics: confidence 0-100. If not found, set metricValue to null, confidence to 0
- Be conservative: do NOT fabricate numbers. If uncertain between YTD/quarterly and monthly, set to null
- For organisations: only include named entities explicitly mentioned in the text
- For highlights: stick to what the report actually says, do not infer or embellish
- For people: only include people mentioned by name, not generic roles
- Only return the JSON, no other text`;
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

  app.get("/api/contacts/:id/activity", isAuthenticated, async (req, res) => {
    try {
      const contactId = parseInt(req.params.id);
      const contact = await storage.getContact(contactId);
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      const userId = (req.user as any).claims.sub;
      if (contact.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const activities: any[] = [];

      const interactions = await storage.getInteractions(contactId);
      for (const i of interactions) {
        activities.push({
          type: "interaction",
          subType: i.type || "General",
          date: i.date,
          title: i.summary || `${i.type || "Interaction"} logged`,
          details: i.transcript ? i.transcript.substring(0, 200) : null,
          id: i.id,
        });
      }

      const allBookings = await storage.getBookings(userId);
      for (const b of allBookings) {
        if (b.bookerId === contactId) {
          activities.push({
            type: "booking",
            subType: "Booker",
            date: b.startDate,
            title: b.title || "Venue Booking",
            details: b.notes || null,
            id: b.id,
          });
        }
      }

      const allProgrammes = await storage.getProgrammes(userId);
      for (const p of allProgrammes) {
        if ((p as any).facilitatorId === contactId) {
          activities.push({
            type: "programme",
            subType: "Facilitator",
            date: (p as any).startDate || p.createdAt,
            title: p.name || "Programme",
            details: p.status || null,
            id: p.id,
          });
        }
      }

      const contactAttendance = await storage.getContactAttendance(contactId);
      for (const att of contactAttendance) {
        const event = await storage.getEvent(att.eventId);
        if (event) {
          activities.push({
            type: "event",
            subType: event.type || "Event",
            date: event.startTime || event.createdAt,
            title: event.title || "Event",
            details: event.location || null,
            id: event.id,
          });
        }
      }

      const allMemberships = await storage.getMemberships(userId);
      for (const m of allMemberships) {
        if (m.contactId === contactId) {
          activities.push({
            type: "membership",
            subType: "Membership",
            date: m.startDate || m.createdAt,
            title: `${m.type || "Membership"} - ${m.status || "active"}`,
            details: null,
            id: m.id,
          });
        }
      }

      const allMous = await storage.getMous(userId);
      for (const m of allMous) {
        if (m.contactId === contactId) {
          activities.push({
            type: "mou",
            subType: "MOU",
            date: m.startDate || m.createdAt,
            title: m.title || "MOU Agreement",
            details: m.status || null,
            id: m.id,
          });
        }
      }

      const allSpend = await storage.getCommunitySpend(userId);
      for (const s of allSpend) {
        if (s.contactId === contactId) {
          activities.push({
            type: "community_spend",
            subType: s.category || "Spend",
            date: s.date || s.createdAt,
            title: s.description || "Community Spend",
            details: s.amount ? `$${s.amount}` : null,
            id: s.id,
          });
        }
      }

      const legacyReports = await storage.getLegacyReports(userId);
      for (const report of legacyReports) {
        if (report.status !== 'confirmed') continue;
        const extraction = await storage.getLegacyReportExtraction(report.id);
        if (extraction?.extractedPeople) {
          const mentioned = extraction.extractedPeople.some(
            (p: any) => p.name.toLowerCase().trim() === contact.name.toLowerCase().trim()
          );
          if (mentioned) {
            const reportDate = (report.year && report.month)
              ? new Date(report.year, report.month - 1, 15).toISOString()
              : report.createdAt;
            activities.push({
              type: "legacy_report",
              subType: "Report Mention",
              date: reportDate,
              title: `Mentioned in ${report.quarterLabel || "legacy report"}`,
              details: null,
              id: report.id,
            });
          }
        }
      }

      activities.sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return db - da;
      });

      res.json(activities);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch activity" });
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

  // === Debrief Queue API (must be before /api/events/:id) ===
  app.get("/api/events/needs-debrief", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userEvents = await storage.getEvents(userId);
      const allDebriefs = await storage.getImpactLogs(userId);
      const now = new Date();

      const confirmedEventIds = new Set(
        allDebriefs
          .filter(d => d.eventId && d.status === "confirmed")
          .map(d => d.eventId)
      );

      const needsDebrief = userEvents.filter(e => {
        if (!e.requiresDebrief) return false;
        if (e.eventStatus === "cancelled") return false;
        if (e.debriefSkippedReason) return false;
        if (confirmedEventIds.has(e.id)) return false;
        const eventEnd = new Date(e.endTime || e.startTime);
        if (eventEnd > now) return false;
        return true;
      });

      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const enriched = needsDebrief.map(e => {
        const eventEnd = new Date(e.endTime || e.startTime);
        const existingDebrief = allDebriefs.find(d => d.eventId === e.id);
        let queueStatus: "overdue" | "due" | "in_progress" = "due";
        if (existingDebrief && existingDebrief.status === "draft") {
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
        const priority = { overdue: 0, due: 1, in_progress: 2 };
        if (priority[a.queueStatus] !== priority[b.queueStatus]) {
          return priority[a.queueStatus] - priority[b.queueStatus];
        }
        return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
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
      const eventId = parseInt(req.params.id);
      const event = await storage.getEvent(eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const { reason } = req.body;
      const updated = await storage.updateEvent(eventId, {
        debriefSkippedReason: reason || "Skipped by user",
      });
      res.json(updated);
    } catch (err) {
      console.error("Skip debrief error:", err);
      res.status(500).json({ message: "Failed to skip debrief" });
    }
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

  // === Event → Programme Linking ===

  app.post("/api/events/:id/link-programme", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseInt(req.params.id);
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
      const id = parseInt(req.params.id);
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
      const id = parseInt(req.params.id);
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
      const id = parseInt(req.params.id);
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

      if (programme.facilitators && programme.facilitators.length > 0 && programme.facilitatorCost && parseFloat(String(programme.facilitatorCost)) > 0) {
        const costPerFacilitator = parseFloat(String(programme.facilitatorCost)) / programme.facilitators.length;
        for (const contactId of programme.facilitators) {
          try {
            await storage.createCommunitySpend({
              userId,
              amount: String(costPerFacilitator.toFixed(2)),
              date: programme.startDate || new Date(),
              category: "contracting",
              description: `Facilitator for ${programme.name}`,
              contactId,
              programmeId: programme.id,
              paymentStatus: "pending",
            });
          } catch (e) { console.error("Auto community spend error:", e); }
        }
      }

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

      const existingSpend = await storage.getCommunitySpendByProgramme(id);
      const autoSpend = existingSpend.filter(s => s.category === "contracting" && s.description?.includes("Facilitator for"));
      for (const old of autoSpend) {
        await storage.deleteCommunitySpend(old.id);
      }

      if (updated.facilitators && updated.facilitators.length > 0 && updated.facilitatorCost && parseFloat(String(updated.facilitatorCost)) > 0) {
        const costPerFacilitator = parseFloat(String(updated.facilitatorCost)) / updated.facilitators.length;
        for (const contactId of updated.facilitators) {
          try {
            await storage.createCommunitySpend({
              userId: existing.userId,
              amount: String(costPerFacilitator.toFixed(2)),
              date: updated.startDate || new Date(),
              category: "contracting",
              description: `Facilitator for ${updated.name}`,
              contactId,
              programmeId: id,
              paymentStatus: "pending",
            });
          } catch (e) { console.error("Auto community spend update error:", e); }
        }
      }

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
            message: `Conflict: A booking is already scheduled for ${b.startTime || "all day"} on ${b.startDate ? new Date(b.startDate).toLocaleDateString() : "that date"}`,
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
            message: `Conflict: A booking is already scheduled for ${b.startTime || "all day"} on that date`,
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

  app.get("/api/booking-pricing-defaults", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const defaults = await storage.getBookingPricingDefaults(userId);
    res.json(defaults || { fullDayRate: "0", halfDayRate: "0" });
  });

  app.put("/api/booking-pricing-defaults", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const { fullDayRate, halfDayRate } = req.body;
    const result = await storage.upsertBookingPricingDefaults(userId, { fullDayRate, halfDayRate });
    res.json(result);
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

      let legacyBlend = null;
      try {
        const settings = await storage.getReportingSettings(userId);
        const boundaryDate = settings?.boundaryDate;
        const reportStart = new Date(startDate);

        if (boundaryDate && reportStart < boundaryDate) {
          const allLegacy = await storage.getLegacyReports(userId);
          const confirmed = allLegacy.filter(r => r.status === "confirmed");
          const reqStart = new Date(startDate);
          const reqEnd = new Date(endDate);

          const overlapping = confirmed.filter(r => {
            const ps = new Date(r.periodStart);
            const pe = new Date(r.periodEnd);
            return ps <= reqEnd && pe >= reqStart && pe <= boundaryDate;
          });

          const legacyTotals = {
            activationsTotal: 0,
            activationsWorkshops: 0,
            activationsMentoring: 0,
            activationsEvents: 0,
            activationsPartnerMeetings: 0,
            foottrafficUnique: 0,
            bookingsTotal: 0,
            reportCount: overlapping.length,
          };

          const quarters: Array<{ label: string; periodStart: string; periodEnd: string }> = [];

          for (const lr of overlapping) {
            const snapshot = await storage.getLegacyReportSnapshot(lr.id);
            if (snapshot) {
              legacyTotals.activationsTotal += snapshot.activationsTotal || 0;
              legacyTotals.activationsWorkshops += snapshot.activationsWorkshops || 0;
              legacyTotals.activationsMentoring += snapshot.activationsMentoring || 0;
              legacyTotals.activationsEvents += snapshot.activationsEvents || 0;
              legacyTotals.activationsPartnerMeetings += snapshot.activationsPartnerMeetings || 0;
              legacyTotals.foottrafficUnique += snapshot.foottrafficUnique || 0;
              legacyTotals.bookingsTotal += snapshot.bookingsTotal || 0;
            }
            quarters.push({
              label: lr.quarterLabel,
              periodStart: lr.periodStart.toISOString(),
              periodEnd: lr.periodEnd.toISOString(),
            });
          }

          if (overlapping.length > 0) {
            legacyBlend = {
              boundaryDate: boundaryDate.toISOString(),
              legacyTotals,
              quarters,
            };
          }
        }
      } catch (blendErr) {
        console.error("Legacy blend error (non-fatal):", blendErr);
      }

      res.json({ ...report, legacyBlend });
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

  // === Legacy Reports API ===

  app.get("/api/legacy-reports", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const reports = await storage.getLegacyReports(userId);
      const allGroups = await storage.getGroups(userId);
      const allContacts = await storage.getContacts(userId);
      const groupNameSet = new Set(allGroups.map(g => g.name.toLowerCase().trim()));
      const contactNameSet = new Set(allContacts.map(c => c.name.toLowerCase().trim()));
      const reportsWithSnapshots = await Promise.all(
        reports.map(async (r) => {
          const snapshot = await storage.getLegacyReportSnapshot(r.id);
          const extraction = await storage.getLegacyReportExtraction(r.id);
          const hasExtraction = !!extraction;
          const extractedOrgs = (extraction?.extractedOrganisations as any[]) || [];
          const extractedPeople = (extraction?.extractedPeople as any[]) || [];
          const extractedOrgCount = extractedOrgs.length;
          const extractedPeopleCount = extractedPeople.length;
          const groupsImported = extractedOrgs.filter(o => o.name && groupNameSet.has(o.name.toLowerCase().trim())).length;
          const contactsImported = extractedPeople.filter(p => p.name && contactNameSet.has(p.name.toLowerCase().trim())).length;
          const highlights = (extraction?.extractedHighlights as any[]) || [];
          return { ...r, snapshot, highlights, processingStatus: { hasExtraction, extractedOrgCount, extractedPeopleCount, groupsImported, contactsImported } };
        })
      );
      res.json(reportsWithSnapshots);
    } catch (err: any) {
      console.error("Legacy reports error:", err);
      res.status(500).json({ message: "Failed to fetch legacy reports" });
    }
  });

  app.get("/api/legacy-reports/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseInt(req.params.id);
      const report = await storage.getLegacyReport(id);
      if (!report || report.userId !== userId) return res.status(404).json({ message: "Not found" });
      const snapshot = await storage.getLegacyReportSnapshot(id);
      res.json({ ...report, snapshot });
    } catch (err: any) {
      console.error("Legacy report error:", err);
      res.status(500).json({ message: "Failed to fetch legacy report" });
    }
  });

  app.post("/api/legacy-reports", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { year, month, pdfFileName, pdfData, notes, snapshot } = req.body;

      if (!year || !month) {
        return res.status(400).json({ message: "Year and month are required" });
      }

      const now = new Date();
      const currentYear = now.getFullYear();
      if (year < 2023 || year > currentYear + 1) {
        return res.status(400).json({ message: "Year must be between 2023 and current year" });
      }
      if (month < 1 || month > 12) {
        return res.status(400).json({ message: "Month must be between 1 and 12" });
      }

      const monthEndDate = new Date(year, month, 0);
      if (monthEndDate > now) {
        return res.status(400).json({ message: "Cannot create reports for future months" });
      }

      if (year === 2023 && month < 11) {
        return res.status(400).json({ message: "Reports start from November 2023" });
      }

      const existing = await storage.getLegacyReports(userId);
      const duplicate = existing.find(r => r.year === year && r.month === month);
      if (duplicate) {
        return res.status(409).json({ message: `A report for ${MONTH_NAMES[month - 1]} ${year} already exists` });
      }

      const periodStart = new Date(year, month - 1, 1);
      const periodEnd = monthEndDate;
      const quarter = Math.floor((month - 1) / 3) + 1;
      const quarterLabel = `${MONTH_NAMES[month - 1]} ${year}`;

      const report = await storage.createLegacyReport({
        userId,
        year,
        quarter,
        month,
        quarterLabel,
        periodStart,
        periodEnd,
        pdfFileName: pdfFileName || null,
        pdfData: pdfData || null,
        notes: notes || null,
        status: "draft",
      });

      let snapshotRecord = null;
      if (snapshot) {
        snapshotRecord = await storage.createLegacyReportSnapshot({
          legacyReportId: report.id,
          activationsTotal: snapshot.activationsTotal ?? null,
          activationsWorkshops: snapshot.activationsWorkshops ?? null,
          activationsMentoring: snapshot.activationsMentoring ?? null,
          activationsEvents: snapshot.activationsEvents ?? null,
          activationsPartnerMeetings: snapshot.activationsPartnerMeetings ?? null,
          foottrafficUnique: snapshot.foottrafficUnique ?? null,
          bookingsTotal: snapshot.bookingsTotal ?? null,
        });
      }

      if (pdfData) {
        try {
          const { PDFParse } = await import("pdf-parse");
          const pdfBuffer = Buffer.from(pdfData, "base64");
          const parser = new PDFParse({ data: pdfBuffer });
          await parser.load();
          const pdfResult = await parser.getText();
          const pdfText = pdfResult.text || "";

          const prompt = buildExtractionPrompt(pdfText);
          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.2,
            response_format: { type: "json_object" },
          });

          const content = response.choices[0]?.message?.content || "{}";
          let parsed: any;
          try {
            parsed = JSON.parse(content);
          } catch {
            parsed = { metrics: [] };
          }

          const suggestedMetrics = (parsed.metrics || []).map((m: any) => ({
            metricKey: m.metricKey,
            metricValue: m.metricValue,
            metricUnit: m.metricUnit || null,
            confidence: m.confidence || 0,
            evidenceSnippet: m.evidenceSnippet || null,
          }));

          const extractedOrganisations = (parsed.organisations || []).map((o: any) => ({
            name: o.name || "",
            type: o.type || "other",
            description: o.description || null,
            relationship: o.relationship || null,
          })).filter((o: any) => o.name);

          const extractedHighlights = (parsed.highlights || []).map((h: any) => ({
            theme: h.theme || "",
            summary: h.summary || "",
            activityType: h.activityType || null,
          })).filter((h: any) => h.theme && h.summary);

          const extractedPeople = (parsed.people || []).map((p: any) => ({
            name: p.name || "",
            role: p.role || null,
            context: p.context || null,
          })).filter((p: any) => p.name);

          await storage.createLegacyReportExtraction({
            legacyReportId: report.id,
            suggestedMetrics,
            extractedOrganisations,
            extractedHighlights,
            extractedPeople,
            rawText: pdfText.substring(0, 20000),
          });

          const detectedMonth = parsed.detectedMonth ? parseInt(parsed.detectedMonth) : null;
          const detectedYear = parsed.detectedYear ? parseInt(parsed.detectedYear) : null;

          let updatedReport = report;
          if (detectedMonth && detectedYear && detectedMonth >= 1 && detectedMonth <= 12 && detectedYear >= 2023) {
            const isValidDate = !(detectedYear === 2023 && detectedMonth < 11);
            const detectedEnd = new Date(detectedYear, detectedMonth, 0);
            const notFuture = detectedEnd <= new Date();
            const isDifferent = detectedMonth !== report.month || detectedYear !== report.year;

            if (isValidDate && notFuture && isDifferent) {
              const existingReports = await storage.getLegacyReports(userId);
              const wouldDuplicate = existingReports.find(r => r.id !== report.id && r.year === detectedYear && r.month === detectedMonth);

              if (!wouldDuplicate) {
                const periodStart = new Date(detectedYear, detectedMonth - 1, 1);
                const periodEnd = detectedEnd;
                const quarter = Math.floor((detectedMonth - 1) / 3) + 1;
                const quarterLabel = `${MONTH_NAMES[detectedMonth - 1]} ${detectedYear}`;

                updatedReport = await storage.updateLegacyReport(report.id, {
                  year: detectedYear,
                  month: detectedMonth,
                  quarter,
                  quarterLabel,
                  periodStart,
                  periodEnd,
                });
              }
            }
          }

          const snapshotData: Record<string, any> = { legacyReportId: report.id };
          let autoAppliedCount = 0;
          let reviewNeededCount = 0;

          for (const m of suggestedMetrics) {
            if (m.confidence >= 70 && m.metricValue !== null && m.metricValue !== undefined) {
              const field = METRIC_KEY_TO_SNAPSHOT_FIELD[m.metricKey];
              if (field) {
                snapshotData[field] = typeof m.metricValue === "string" ? parseFloat(m.metricValue) : m.metricValue;
                autoAppliedCount++;
              }
            } else if (m.confidence > 0 && m.confidence < 70) {
              reviewNeededCount++;
            }
          }

          if (autoAppliedCount > 0) {
            if (snapshotRecord) {
              snapshotRecord = await storage.updateLegacyReportSnapshot(snapshotRecord.id, snapshotData);
            } else {
              snapshotRecord = await storage.createLegacyReportSnapshot(snapshotData as any);
            }
          }

          return res.status(201).json({
            ...updatedReport,
            snapshot: snapshotRecord,
            autoExtracted: true,
            extraction: { suggestedMetrics, autoAppliedCount, reviewNeededCount, extractedOrganisations, extractedHighlights, extractedPeople, detectedMonth, detectedYear },
          });
        } catch (extractErr: any) {
          console.error("Auto-extraction error (non-fatal):", extractErr);
          return res.status(201).json({
            ...report,
            snapshot: snapshotRecord,
            autoExtracted: false,
            extractionError: "Metric extraction failed — you can retry manually using the Extract button.",
          });
        }
      }

      res.status(201).json({ ...report, snapshot: snapshotRecord });
    } catch (err: any) {
      console.error("Create legacy report error:", err);
      res.status(500).json({ message: "Failed to create legacy report" });
    }
  });

  app.patch("/api/legacy-reports/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseInt(req.params.id);
      const existing = await storage.getLegacyReport(id);
      if (!existing || String(existing.userId) !== String(userId)) return res.status(404).json({ message: "Not found" });

      const { notes, snapshot, status, year, month } = req.body;

      const updateData: any = {};
      if (notes !== undefined) updateData.notes = notes;

      if (year !== undefined && month !== undefined && existing.status === "draft") {
        if (month < 1 || month > 12) {
          return res.status(400).json({ message: "Month must be between 1 and 12" });
        }
        if (year < 2023) {
          return res.status(400).json({ message: "Year must be 2023 or later" });
        }
        if (year === 2023 && month < 11) {
          return res.status(400).json({ message: "Reports start from November 2023" });
        }
        const monthEndDate = new Date(year, month, 0);
        const now = new Date();
        if (monthEndDate > now) {
          return res.status(400).json({ message: "Cannot set date to a future month" });
        }
        const allReports = await storage.getLegacyReports(userId);
        const duplicate = allReports.find(r => r.id !== id && r.year === year && r.month === month);
        if (duplicate) {
          return res.status(409).json({ message: `A report for ${MONTH_NAMES[month - 1]} ${year} already exists` });
        }
        const periodStart = new Date(year, month - 1, 1);
        const periodEnd = monthEndDate;
        const quarter = Math.floor((month - 1) / 3) + 1;
        updateData.year = year;
        updateData.month = month;
        updateData.quarter = quarter;
        updateData.quarterLabel = `${MONTH_NAMES[month - 1]} ${year}`;
        updateData.periodStart = periodStart;
        updateData.periodEnd = periodEnd;
      }

      if (status === "confirmed" && existing.status !== "confirmed") {
        updateData.status = "confirmed";
        updateData.confirmedAt = new Date();
        updateData.confirmedBy = userId;
      } else if (status === "draft") {
        updateData.status = "draft";
        updateData.confirmedAt = null;
        updateData.confirmedBy = null;
      }

      const updated = await storage.updateLegacyReport(id, updateData);

      let snapshotRecord = null;
      if (snapshot) {
        const { id: _sid, legacyReportId: _lrid, createdAt: _ca, ...cleanSnapshot } = snapshot;
        const existingSnapshot = await storage.getLegacyReportSnapshot(id);
        if (existingSnapshot) {
          snapshotRecord = await storage.updateLegacyReportSnapshot(existingSnapshot.id, cleanSnapshot);
        } else {
          snapshotRecord = await storage.createLegacyReportSnapshot({
            legacyReportId: id,
            ...cleanSnapshot,
          });
        }
      }

      const finalSnapshot = snapshotRecord || (await storage.getLegacyReportSnapshot(id));
      const taxonomySuggestionsAvailable = status === "confirmed" && existing.status !== "confirmed";

      let createdGroups: string[] = [];
      if (status === "confirmed" && existing.status !== "confirmed") {
        try {
          const extraction = await storage.getLegacyReportExtraction(id);
          if (extraction?.extractedOrganisations && Array.isArray(extraction.extractedOrganisations)) {
            const existingGroups = await storage.getGroups(userId);
            const existingNames = new Set(existingGroups.map(g => g.name.toLowerCase().trim()));

            for (const org of extraction.extractedOrganisations as any[]) {
              if (!org.name || existingNames.has(org.name.toLowerCase().trim())) continue;
              try {
                await storage.createGroup({
                  userId,
                  name: org.name,
                  type: org.type === "community_group" ? "Community Group" :
                        org.type === "community_collective" ? "Community Collective" :
                        org.type === "resident_company" ? "Resident Company" :
                        org.type === "business" ? "Business" :
                        org.type === "partner" ? "Partner" :
                        org.type === "government" ? "Government" :
                        org.type === "iwi" ? "Iwi" :
                        org.type === "ngo" ? "NGO" :
                        org.type === "education" ? "Education" : "Organisation",
                  description: org.description || null,
                  notes: org.relationship ? `Relationship: ${org.relationship}. Imported from legacy report ${existing.quarterLabel}.` : `Imported from legacy report ${existing.quarterLabel}.`,
                  importSource: `Imported from legacy report ${existing.quarterLabel}`,
                  relationshipTier: org.relationship === "mentored" || org.relationship === "supported" ? "support" :
                                    org.relationship === "partnered" || org.relationship === "engaged" ? "collaborate" : "mentioned",
                  active: true,
                });
                existingNames.add(org.name.toLowerCase().trim());
                createdGroups.push(org.name);
              } catch (groupErr) {
                console.error(`Failed to create group "${org.name}":`, groupErr);
              }
            }
          }
        } catch (extractErr) {
          console.error("Failed to auto-create groups from extraction:", extractErr);
        }
      }

      let createdContacts: string[] = [];
      if (status === "confirmed" && existing.status !== "confirmed") {
        try {
          const extraction = await storage.getLegacyReportExtraction(id);
          if (extraction?.extractedPeople && Array.isArray(extraction.extractedPeople)) {
            const existingContacts = await storage.getContacts(userId);
            const existingContactNames = new Set(existingContacts.map(c => c.name.toLowerCase().trim()));

            for (const person of extraction.extractedPeople as any[]) {
              if (!person.name || existingContactNames.has(person.name.toLowerCase().trim())) continue;
              try {
                await storage.createContact({
                  userId,
                  name: person.name,
                  role: person.role || "Community Member",
                  notes: person.context ? `${person.context}. Imported from legacy report ${existing.quarterLabel}.` : `Imported from legacy report ${existing.quarterLabel}.`,
                });
                existingContactNames.add(person.name.toLowerCase().trim());
                createdContacts.push(person.name);
              } catch (contactErr) {
                console.error(`Failed to create contact "${person.name}":`, contactErr);
              }
            }
          }
        } catch (extractErr) {
          console.error("Failed to auto-create contacts from extraction:", extractErr);
        }
      }

      res.json({ ...updated, snapshot: finalSnapshot, taxonomySuggestionsAvailable, createdGroups, createdContacts });
    } catch (err: any) {
      console.error("Update legacy report error:", err);
      res.status(500).json({ message: "Failed to update legacy report" });
    }
  });

  app.post("/api/legacy-reports/sync-imports", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const reports = await storage.getLegacyReports(userId);
      const confirmedReports = reports.filter(r => r.status === "confirmed");

      const existingGroups = await storage.getGroups(userId);
      const existingGroupNames = new Set(existingGroups.map(g => g.name.toLowerCase().trim()));

      const existingContacts = await storage.getContacts(userId);
      const existingContactNames = new Set(existingContacts.map(c => c.name.toLowerCase().trim()));

      let totalGroupsCreated = 0;
      let totalContactsCreated = 0;
      let reportsProcessed = 0;

      for (const report of confirmedReports) {
        const extraction = await storage.getLegacyReportExtraction(report.id);
        if (!extraction) continue;

        let reportHadWork = false;

        if (extraction.extractedOrganisations && Array.isArray(extraction.extractedOrganisations)) {
          for (const org of extraction.extractedOrganisations as any[]) {
            if (!org.name || existingGroupNames.has(org.name.toLowerCase().trim())) continue;
            try {
              await storage.createGroup({
                userId,
                name: org.name,
                type: org.type === "community_group" ? "Community Group" :
                      org.type === "community_collective" ? "Community Collective" :
                      org.type === "resident_company" ? "Resident Company" :
                      org.type === "business" ? "Business" :
                      org.type === "partner" ? "Partner" :
                      org.type === "government" ? "Government" :
                      org.type === "iwi" ? "Iwi" :
                      org.type === "ngo" ? "NGO" :
                      org.type === "education" ? "Education" : "Organisation",
                description: org.description || null,
                notes: org.relationship ? `Relationship: ${org.relationship}. Imported from legacy report ${report.quarterLabel}.` : `Imported from legacy report ${report.quarterLabel}.`,
                importSource: `Imported from legacy report ${report.quarterLabel}`,
                relationshipTier: org.relationship === "mentored" || org.relationship === "supported" ? "support" :
                                  org.relationship === "partnered" || org.relationship === "engaged" ? "collaborate" : "mentioned",
                active: true,
              });
              existingGroupNames.add(org.name.toLowerCase().trim());
              totalGroupsCreated++;
              reportHadWork = true;
            } catch (groupErr) {
              console.error(`Sync: Failed to create group "${org.name}":`, groupErr);
            }
          }
        }

        if (extraction.extractedPeople && Array.isArray(extraction.extractedPeople)) {
          for (const person of extraction.extractedPeople as any[]) {
            if (!person.name || existingContactNames.has(person.name.toLowerCase().trim())) continue;
            try {
              await storage.createContact({
                userId,
                name: person.name,
                role: person.role || "Community Member",
                notes: person.context ? `${person.context}. Imported from legacy report ${report.quarterLabel}.` : `Imported from legacy report ${report.quarterLabel}.`,
              });
              existingContactNames.add(person.name.toLowerCase().trim());
              totalContactsCreated++;
              reportHadWork = true;
            } catch (contactErr) {
              console.error(`Sync: Failed to create contact "${person.name}":`, contactErr);
            }
          }
        }

        if (reportHadWork) reportsProcessed++;
      }

      res.json({
        groupsCreated: totalGroupsCreated,
        contactsCreated: totalContactsCreated,
        reportsProcessed,
        totalReportsChecked: confirmedReports.length,
      });
    } catch (err: any) {
      console.error("Sync imports error:", err);
      res.status(500).json({ message: "Failed to sync imports" });
    }
  });

  app.get("/api/legacy-reports/:id/taxonomy-suggestions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const reportId = parseInt(req.params.id);
      const report = await storage.getLegacyReport(reportId);
      if (!report) return res.status(404).json({ message: "Legacy report not found" });
      if (report.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const taxonomy = await storage.getTaxonomy(userId);
      const snapshot = await storage.getLegacyReportSnapshot(reportId);

      let pdfText = "";
      if (report.pdfData) {
        try {
          const { PDFParse: PdfParser } = await import("pdf-parse");
          const buffer = Buffer.from(report.pdfData, "base64");
          const parser = new PdfParser({ data: buffer });
          await parser.load();
          const pdfResult = await parser.getText();
          pdfText = pdfResult.text || "";
        } catch (e) {
          pdfText = "";
        }
      }

      const existingCategories = taxonomy.map(t => ({
        id: t.id,
        category: t.name,
        description: t.description,
      }));

      const snapshotInfo = snapshot ? {
        activationsTotal: snapshot.activationsTotal,
        foottrafficUnique: snapshot.foottrafficUnique,
        bookingsTotal: snapshot.bookingsTotal,
      } : {};

      const prompt = `You are analyzing a legacy report to suggest taxonomy categories for impact classification.

Report Period: ${report.quarterLabel} (${report.periodStart} to ${report.periodEnd})
Report Metrics: ${JSON.stringify(snapshotInfo)}
${pdfText ? `Report Text Content:\n${pdfText.slice(0, 3000)}` : "No PDF text available."}

Existing taxonomy categories:
${JSON.stringify(existingCategories, null, 2)}

Analyze the report data and suggest taxonomy categories. For each suggestion:
- If it matches an existing category, reference it
- If it's a new category, explain why it should be added
- Include a confidence score (0-100)

Return a JSON object with this exact structure:
{
  "suggestions": [
    { "category": "category name", "description": "why this category fits the report data", "matchesExisting": "existing category name or null", "confidence": 85 }
  ]
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || '{"suggestions":[]}');
      res.json(result.suggestions || []);
    } catch (err: any) {
      console.error("Taxonomy suggestions GET error:", err);
      res.status(500).json({ message: "Failed to generate taxonomy suggestions" });
    }
  });

  app.delete("/api/legacy-reports/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseInt(req.params.id);
      const existing = await storage.getLegacyReport(id);
      if (!existing || String(existing.userId) !== String(userId)) return res.status(404).json({ message: "Not found" });
      await storage.deleteLegacyReport(id);
      res.status(204).end();
    } catch (err: any) {
      console.error("Delete legacy report error:", err);
      res.status(500).json({ message: "Failed to delete legacy report" });
    }
  });

  // === Reporting Settings API ===

  app.get("/api/reporting-settings", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const settings = await storage.getReportingSettings(userId);
      res.json(settings || { boundaryDate: null });
    } catch (err: any) {
      console.error("Reporting settings error:", err);
      res.status(500).json({ message: "Failed to fetch reporting settings" });
    }
  });

  app.put("/api/reporting-settings", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { boundaryDate } = req.body;
      const settings = await storage.upsertReportingSettings(userId, {
        boundaryDate: boundaryDate ? new Date(boundaryDate) : null,
      });
      res.json(settings);
    } catch (err: any) {
      console.error("Update reporting settings error:", err);
      res.status(500).json({ message: "Failed to update reporting settings" });
    }
  });

  // === Benchmark Insights API ===

  app.get("/api/benchmark-insights", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { startDate, endDate } = req.query as { startDate: string; endDate: string };
      if (!startDate || !endDate) return res.status(400).json({ message: "startDate and endDate required" });

      const legacyReportsData = await storage.getLegacyReports(userId);
      const confirmedReports = legacyReportsData.filter(r => r.status === "confirmed");
      const snapshots = await Promise.all(
        confirmedReports.map(async (r) => {
          const snapshot = await storage.getLegacyReportSnapshot(r.id);
          return { report: r, snapshot };
        })
      );

      const settings = await storage.getReportingSettings(userId);
      const boundaryDate = settings?.boundaryDate;

      const quarterlyData: Array<{
        label: string;
        periodStart: Date;
        periodEnd: Date;
        activationsTotal: number;
        source: "legacy" | "live";
      }> = [];

      for (const { report, snapshot } of snapshots) {
        if (snapshot) {
          quarterlyData.push({
            label: report.quarterLabel,
            periodStart: report.periodStart,
            periodEnd: report.periodEnd,
            activationsTotal: snapshot.activationsTotal || 0,
            source: "legacy",
          });
        }
      }

      if (boundaryDate) {
        const liveEvents = await storage.getEvents(userId);
        const postBoundary = liveEvents.filter(e =>
          new Date(e.startTime) >= boundaryDate && e.type !== "Personal"
        );
        const currentStart = new Date(startDate);
        const currentEnd = new Date(endDate);
        const liveInRange = postBoundary.filter(e => {
          const d = new Date(e.startTime);
          return d >= currentStart && d <= currentEnd;
        });

        quarterlyData.push({
          label: "Current Period",
          periodStart: currentStart,
          periodEnd: currentEnd,
          activationsTotal: liveInRange.length,
          source: "live",
        });
      }

      quarterlyData.sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());

      const activationValues = quarterlyData.map(q => q.activationsTotal).filter(v => v > 0);
      const historicAvg = activationValues.length > 0
        ? Math.round(activationValues.reduce((s, v) => s + v, 0) / activationValues.length)
        : 0;
      const highest = Math.max(...activationValues, 0);
      const highestQuarter = quarterlyData.find(q => q.activationsTotal === highest);
      const current = quarterlyData[quarterlyData.length - 1];
      const previous = quarterlyData.length > 1 ? quarterlyData[quarterlyData.length - 2] : null;
      const qoqChange = previous && previous.activationsTotal > 0
        ? Math.round(((current?.activationsTotal || 0) - previous.activationsTotal) / previous.activationsTotal * 100)
        : null;
      const rank = current
        ? [...activationValues].sort((a, b) => b - a).indexOf(current.activationsTotal) + 1
        : null;
      const pctVsAvg = historicAvg > 0 && current
        ? Math.round(((current.activationsTotal - historicAvg) / historicAvg) * 100)
        : null;

      const insights: string[] = [];
      if (historicAvg > 0) {
        insights.push(`Historic average activations per period: ${historicAvg}`);
      }
      if (highestQuarter) {
        insights.push(`Highest period: ${highestQuarter.label} with ${highest} activations`);
      }
      if (rank && quarterlyData.length > 1) {
        insights.push(`Current period ranks #${rank} out of ${quarterlyData.length} periods`);
      }
      if (qoqChange !== null) {
        const dir = qoqChange >= 0 ? "up" : "down";
        insights.push(`Period-over-period change: ${dir} ${Math.abs(qoqChange)}% from ${previous?.label}`);
      }
      if (pctVsAvg !== null) {
        const rel = pctVsAvg >= 0 ? "above" : "below";
        insights.push(`Current period is ${Math.abs(pctVsAvg)}% ${rel} the historic average`);
      }

      res.json({
        quarterlyData,
        benchmarks: {
          historicAverage: historicAvg,
          highestQuarter: highestQuarter?.label || null,
          highestValue: highest,
          currentRank: rank,
          totalQuarters: quarterlyData.length,
          qoqChange,
          pctVsAverage: pctVsAvg,
        },
        insights,
        boundaryDate: boundaryDate?.toISOString() || null,
      });
    } catch (err: any) {
      console.error("Benchmark insights error:", err);
      res.status(500).json({ message: "Failed to compute benchmark insights" });
    }
  });

  // === Legacy Trend Data API (for dashboard blending) ===

  app.get("/api/legacy-trend-data", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const legacyReportsData = await storage.getLegacyReports(userId);
      const confirmedReports = legacyReportsData.filter(r => r.status === "confirmed");
      const settings = await storage.getReportingSettings(userId);

      const trendData = await Promise.all(
        confirmedReports.map(async (r) => {
          const snapshot = await storage.getLegacyReportSnapshot(r.id);
          return {
            quarterLabel: r.quarterLabel,
            periodStart: r.periodStart,
            periodEnd: r.periodEnd,
            activationsTotal: snapshot?.activationsTotal || 0,
            activationsWorkshops: snapshot?.activationsWorkshops || 0,
            activationsMentoring: snapshot?.activationsMentoring || 0,
            activationsEvents: snapshot?.activationsEvents || 0,
            activationsPartnerMeetings: snapshot?.activationsPartnerMeetings || 0,
            foottrafficUnique: snapshot?.foottrafficUnique || null,
            bookingsTotal: snapshot?.bookingsTotal || null,
          };
        })
      );

      trendData.sort((a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime());

      res.json({
        trendData,
        boundaryDate: settings?.boundaryDate?.toISOString() || null,
      });
    } catch (err: any) {
      console.error("Legacy trend error:", err);
      res.status(500).json({ message: "Failed to fetch legacy trend data" });
    }
  });

  // ── Milestones ──
  app.get("/api/milestones", isAuthenticated, async (req, res) => {
    const milestoneList = await storage.getMilestones(req.user!.id);
    res.json(milestoneList);
  });

  app.get("/api/milestones/:id", isAuthenticated, async (req, res) => {
    const milestone = await storage.getMilestone(Number(req.params.id));
    if (!milestone) return res.status(404).json({ message: "Milestone not found" });
    res.json(milestone);
  });

  app.post("/api/milestones", isAuthenticated, async (req, res) => {
    try {
      const milestone = await storage.createMilestone({ ...req.body, userId: req.user!.id, createdBy: req.user!.id });
      res.status(201).json(milestone);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/milestones/:id", isAuthenticated, async (req, res) => {
    try {
      const milestone = await storage.updateMilestone(Number(req.params.id), req.body);
      res.json(milestone);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/milestones/:id", isAuthenticated, async (req, res) => {
    await storage.deleteMilestone(Number(req.params.id));
    res.json({ success: true });
  });

  // ── Relationship Stage Updates ──
  app.patch("/api/contacts/:id/relationship-stage", isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { stage } = req.body;
      const contact = await storage.getContact(id);
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      const previousStage = contact.relationshipStage || null;
      if (previousStage !== stage) {
        await storage.createRelationshipStageHistory({
          entityType: "contact",
          entityId: id,
          previousStage,
          newStage: stage,
          changedBy: req.user!.id,
        });
      }
      const updated = await storage.updateContact(id, { relationshipStage: stage });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/groups/:id/relationship-tier", isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { tier } = req.body;
      if (!["support", "collaborate", "mentioned"].includes(tier)) {
        return res.status(400).json({ message: "Invalid tier. Must be support, collaborate, or mentioned" });
      }
      const group = await storage.getGroup(id);
      if (!group) return res.status(404).json({ message: "Group not found" });
      const updated = await storage.updateGroup(id, { relationshipTier: tier });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/groups/merge", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { primaryId, mergeIds } = req.body;
      if (!primaryId || !mergeIds || !Array.isArray(mergeIds) || mergeIds.length === 0) {
        return res.status(400).json({ message: "primaryId and mergeIds array required" });
      }

      const primary = await storage.getGroup(primaryId);
      if (!primary || primary.userId !== userId) return res.status(404).json({ message: "Primary group not found" });

      for (const mergeId of mergeIds) {
        if (mergeId === primaryId) continue;
        const source = await storage.getGroup(mergeId);
        if (!source || source.userId !== userId) continue;

        const sourceMembers = await storage.getGroupMembers(mergeId);
        const primaryMembers = await storage.getGroupMembers(primaryId);
        const existingContactIds = new Set(primaryMembers.map((m: any) => m.contactId));

        for (const member of sourceMembers) {
          if (!existingContactIds.has(member.contactId)) {
            await storage.addGroupMember({ groupId: primaryId, contactId: member.contactId, role: member.role });
          }
        }

        const sourceTaxLinks = await storage.getGroupTaxonomyLinks(mergeId);
        const primaryTaxLinks = await storage.getGroupTaxonomyLinks(primaryId);
        const existingTaxIds = new Set(primaryTaxLinks.map((l: any) => l.taxonomyId));

        const newTaxLinks = sourceTaxLinks
          .filter((l: any) => !existingTaxIds.has(l.taxonomyId))
          .map((l: any) => ({ groupId: primaryId, taxonomyId: l.taxonomyId, relevanceScore: l.relevanceScore }));

        if (newTaxLinks.length > 0) {
          const allLinks = [...primaryTaxLinks.map((l: any) => ({ groupId: primaryId, taxonomyId: l.taxonomyId, relevanceScore: l.relevanceScore })), ...newTaxLinks];
          await storage.setGroupTaxonomyLinks(primaryId, allLinks);
        }

        await storage.deleteGroup(mergeId);
      }

      const updated = await storage.getGroup(primaryId);
      res.json(updated);
    } catch (err: any) {
      console.error("Merge groups error:", err);
      res.status(500).json({ message: "Failed to merge groups" });
    }
  });

  app.patch("/api/groups/:id/relationship-stage", isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { stage } = req.body;
      const group = await storage.getGroup(id);
      if (!group) return res.status(404).json({ message: "Group not found" });
      const previousStage = group.relationshipStage || null;
      if (previousStage !== stage) {
        await storage.createRelationshipStageHistory({
          entityType: "group",
          entityId: id,
          previousStage,
          newStage: stage,
          changedBy: req.user!.id,
        });
      }
      const updated = await storage.updateGroup(id, { relationshipStage: stage });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/relationship-stage-history/:entityType/:entityId", isAuthenticated, async (req, res) => {
    const history = await storage.getRelationshipStageHistory(req.params.entityType, Number(req.params.entityId));
    res.json(history);
  });

  // ── Relationship Stage Dashboard Stats ──
  app.get("/api/dashboard/relationship-stages", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const contactsList = await storage.getContacts(userId);
      const groupsList = await storage.getGroups(userId);
      const stages = ["new", "engaged", "active", "deepening", "partner", "alumni"];
      const contactCounts: Record<string, number> = {};
      const groupCounts: Record<string, number> = {};
      stages.forEach(s => { contactCounts[s] = 0; groupCounts[s] = 0; });
      contactsList.forEach((c: any) => {
        const s = c.relationshipStage || "new";
        contactCounts[s] = (contactCounts[s] || 0) + 1;
      });
      groupsList.forEach((g: any) => {
        const s = g.relationshipStage || "new";
        groupCounts[s] = (groupCounts[s] || 0) + 1;
      });
      res.json({ contactCounts, groupCounts });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Milestone Dashboard Stats ──
  app.get("/api/dashboard/milestone-stats", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const allMilestones = await storage.getMilestones(userId);
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : null;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : null;
      const filtered = allMilestones.filter(m => {
        if (startDate && m.createdAt && new Date(m.createdAt) < startDate) return false;
        if (endDate && m.createdAt && new Date(m.createdAt) > endDate) return false;
        return true;
      });
      const byType: Record<string, number> = {};
      let totalValue = 0;
      filtered.forEach(m => {
        byType[m.milestoneType] = (byType[m.milestoneType] || 0) + 1;
        if (m.valueAmount) totalValue += parseFloat(String(m.valueAmount));
      });
      res.json({ total: filtered.length, byType, totalValue });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Programme Effectiveness ──
  app.get("/api/programme-effectiveness", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const programmeList = await storage.getProgrammes(userId);
      const allMilestones = await storage.getMilestones(userId);
      const allImpactLogs = await storage.getImpactLogs(userId);
      const allEvents = await storage.getEvents(userId);

      const effectiveness = await Promise.all(programmeList.map(async (prog) => {
        const progEvents = await storage.getProgrammeEvents(prog.id);
        const eventIds = progEvents.map(pe => pe.eventId);

        let totalAttendance = 0;
        const attendeeSet = new Set<number>();
        for (const eid of eventIds) {
          const att = await storage.getEventAttendance(eid);
          totalAttendance += att.length;
          att.forEach(a => attendeeSet.add(a.contactId));
        }

        const linkedDebriefs = allImpactLogs.filter(il => il.programmeId === prog.id && il.status === "confirmed");
        const sentiments = linkedDebriefs
          .map(d => d.sentiment)
          .filter(Boolean);
        const sentimentMap: Record<string, number> = { positive: 3, neutral: 2, negative: 1 };
        const sentimentAvg = sentiments.length > 0
          ? sentiments.reduce((sum, s) => sum + (sentimentMap[s!] || 2), 0) / sentiments.length
          : null;

        const linkedMilestones = allMilestones.filter(m => m.linkedProgrammeId === prog.id);

        const totalBudget = parseFloat(String(prog.facilitatorCost || 0))
          + parseFloat(String(prog.cateringCost || 0))
          + parseFloat(String(prog.promoCost || 0));
        const uniqueCount = attendeeSet.size;
        const costPerParticipant = uniqueCount > 0 && totalBudget > 0
          ? totalBudget / uniqueCount
          : null;

        const repeatRate = eventIds.length > 1 && uniqueCount > 0
          ? Math.round(((totalAttendance - uniqueCount) / totalAttendance) * 100)
          : null;

        return {
          id: prog.id,
          name: prog.name,
          classification: prog.classification,
          status: prog.status,
          eventCount: eventIds.length,
          totalAttendance,
          uniqueAttendees: uniqueCount,
          repeatParticipationRate: repeatRate,
          confirmedDebriefs: linkedDebriefs.length,
          sentimentAverage: sentimentAvg,
          milestoneCount: linkedMilestones.length,
          totalBudget: totalBudget > 0 ? totalBudget : null,
          costPerParticipant,
        };
      }));

      res.json(effectiveness);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Funder Tags List (distinct values across all entities) ──
  app.get("/api/funder-tags", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const progs = await storage.getProgrammes(userId);
      const debriefs = await storage.getImpactLogs(userId);
      const bookingList = await storage.getBookings(userId);
      const milestoneList = await storage.getMilestones(userId);
      const tagSet = new Set<string>();
      [...progs, ...debriefs, ...bookingList, ...milestoneList].forEach((item: any) => {
        if (item.funderTags && Array.isArray(item.funderTags)) {
          item.funderTags.forEach((t: string) => tagSet.add(t));
        }
      });
      res.json([...tagSet].sort());
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Legacy Report PDF Extraction ──
  app.post("/api/legacy-reports/:id/extract-metrics", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseInt(req.params.id);
      const report = await storage.getLegacyReport(id);
      if (!report || report.userId !== userId) return res.status(404).json({ message: "Not found" });
      if (!report.pdfData) return res.status(400).json({ message: "No PDF data attached to this report" });

      const { PDFParse: PdfParser2 } = await import("pdf-parse");
      const pdfBuffer = Buffer.from(report.pdfData, "base64");
      const parser = new PdfParser2({ data: pdfBuffer });
      await parser.load();
      const pdfResult = await parser.getText();
      const pdfText = pdfResult.text || "";

      const prompt = buildExtractionPrompt(pdfText);

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content || "{}";
      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = { metrics: [] };
      }

      const suggestedMetrics = (parsed.metrics || []).map((m: any) => ({
        metricKey: m.metricKey,
        metricValue: m.metricValue,
        metricUnit: m.metricUnit || null,
        confidence: m.confidence || 0,
        evidenceSnippet: m.evidenceSnippet || null,
      }));

      const extractedOrganisations = (parsed.organisations || []).map((o: any) => ({
        name: o.name || "",
        type: o.type || "other",
        description: o.description || null,
        relationship: o.relationship || null,
      })).filter((o: any) => o.name);

      const extractedHighlights = (parsed.highlights || []).map((h: any) => ({
        theme: h.theme || "",
        summary: h.summary || "",
        activityType: h.activityType || null,
      })).filter((h: any) => h.theme && h.summary);

      const extractedPeople = (parsed.people || []).map((p: any) => ({
        name: p.name || "",
        role: p.role || null,
        context: p.context || null,
      })).filter((p: any) => p.name);

      const extraction = await storage.createLegacyReportExtraction({
        legacyReportId: id,
        suggestedMetrics,
        extractedOrganisations,
        extractedHighlights,
        extractedPeople,
        rawText: pdfText.substring(0, 20000),
      });

      res.json(extraction);
    } catch (err: any) {
      console.error("PDF extraction error:", err);
      res.status(500).json({ message: "Failed to extract metrics from PDF" });
    }
  });

  app.get("/api/legacy-report-extractions/:reportId", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const reportId = parseInt(req.params.reportId);
      const report = await storage.getLegacyReport(reportId);
      if (!report || report.userId !== userId) return res.status(404).json({ message: "Not found" });

      const extraction = await storage.getLegacyReportExtraction(reportId);
      if (!extraction) return res.status(404).json({ message: "No extraction found" });

      res.json(extraction);
    } catch (err: any) {
      console.error("Get extraction error:", err);
      res.status(500).json({ message: "Failed to get extraction" });
    }
  });

  app.post("/api/legacy-report-extractions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { legacyReportId, rawText, suggestedMetrics, extractedOrganisations, extractedHighlights, extractedPeople } = req.body;

      const report = await storage.getLegacyReport(legacyReportId);
      if (!report || report.userId !== userId) return res.status(404).json({ message: "Report not found" });

      const existing = await storage.getLegacyReportExtraction(legacyReportId);
      if (existing) return res.status(409).json({ message: "Extraction already exists for this report" });

      const extraction = await storage.createLegacyReportExtraction({
        legacyReportId,
        rawText: rawText || null,
        suggestedMetrics: suggestedMetrics || [],
        extractedOrganisations: extractedOrganisations || null,
        extractedHighlights: extractedHighlights || null,
        extractedPeople: extractedPeople || null,
      });

      res.status(201).json(extraction);
    } catch (err: any) {
      console.error("Create extraction error:", err);
      res.status(500).json({ message: "Failed to create extraction" });
    }
  });

  app.patch("/api/legacy-report-extractions/:reportId", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const reportId = parseInt(req.params.reportId);
      const report = await storage.getLegacyReport(reportId);
      if (!report || report.userId !== userId) return res.status(404).json({ message: "Not found" });

      const extraction = await storage.getLegacyReportExtraction(reportId);
      if (!extraction) return res.status(404).json({ message: "No extraction found" });

      const { extractedHighlights, extractedPeople, extractedOrganisations } = req.body;
      const updates: any = {};
      if (extractedHighlights) updates.extractedHighlights = extractedHighlights;
      if (extractedPeople) updates.extractedPeople = extractedPeople;
      if (extractedOrganisations) updates.extractedOrganisations = extractedOrganisations;

      const updated = await storage.updateLegacyReportExtraction(extraction.id, updates);
      res.json(updated);
    } catch (err: any) {
      console.error("Update extraction error:", err);
      res.status(500).json({ message: "Failed to update extraction" });
    }
  });

  // ── Weekly Hub Debriefs ──
  app.get("/api/weekly-hub-debriefs", isAuthenticated, async (req, res) => {
    try {
      const debriefs = await storage.getWeeklyHubDebriefs((req.user as any).claims.sub);
      res.json(debriefs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/weekly-hub-debriefs/:id", isAuthenticated, async (req, res) => {
    try {
      const debrief = await storage.getWeeklyHubDebrief(Number(req.params.id));
      if (!debrief) return res.status(404).json({ message: "Not found" });
      res.json(debrief);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/weekly-hub-debriefs/generate", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { weekStartDate } = req.body;
      if (!weekStartDate) return res.status(400).json({ message: "weekStartDate required" });

      const weekStart = getNZWeekStart(new Date(weekStartDate));
      const weekEnd = getNZWeekEnd(new Date(weekStartDate));

      const existing = await storage.getWeeklyHubDebriefByWeek(userId, weekStart);
      if (existing) return res.status(409).json({ message: "A debrief for this week already exists", existing });

      const allDebriefs = await storage.getImpactLogs(userId);
      const confirmedDebriefs = (allDebriefs as any[]).filter((d: any) => {
        if (d.status !== "confirmed") return false;
        const created = new Date(d.createdAt);
        return created >= weekStart && created <= weekEnd;
      });

      const allProgrammes = await storage.getProgrammes(userId);
      const completedProgrammes = allProgrammes.filter((p: any) => {
        if (p.status !== "completed") return false;
        const end = p.endDate ? new Date(p.endDate) : null;
        return end && end >= weekStart && end <= weekEnd;
      });

      const allBookings = await storage.getBookings(userId);
      const completedBookings = allBookings.filter((b: any) => {
        if (b.status !== "completed") return false;
        const d = b.bookingDate ? new Date(b.bookingDate) : null;
        return d && d >= weekStart && d <= weekEnd;
      });

      const allMilestones = await storage.getMilestones(userId);
      const weekMilestones = allMilestones.filter(m => {
        const created = m.createdAt ? new Date(m.createdAt) : null;
        return created && created >= weekStart && created <= weekEnd;
      });

      const allTaxonomy = await storage.getTaxonomy(userId);
      const taxonomyCounts: Record<string, number> = {};
      confirmedDebriefs.forEach((d: any) => {
        const tags = d.taxonomyTags || [];
        tags.forEach((tag: string) => {
          taxonomyCounts[tag] = (taxonomyCounts[tag] || 0) + 1;
        });
      });
      const topThemes = Object.entries(taxonomyCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([theme]) => theme);

      const sentimentMap: Record<string, number> = { positive: 3, neutral: 2, negative: 1 };
      const sentiments = confirmedDebriefs.map((d: any) => d.sentiment).filter(Boolean);
      const sentimentBreakdown: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
      sentiments.forEach((s: string) => { sentimentBreakdown[s] = (sentimentBreakdown[s] || 0) + 1; });
      const sentimentAvg = sentiments.length > 0
        ? sentiments.reduce((sum: number, s: string) => sum + (sentimentMap[s] || 2), 0) / sentiments.length
        : null;

      const outstandingDebriefs = (allDebriefs as any[]).filter((d: any) => d.status === "pending" || d.status === "draft").length;

      const allEvents = await storage.getEvents(userId);
      const nextWeekDate = new Date(weekEnd);
      nextWeekDate.setDate(nextWeekDate.getDate() + 1);
      const nextWeekStart = getNZWeekStart(nextWeekDate);
      const nextWeekEnd = getNZWeekEnd(nextWeekDate);
      const upcomingEvents = allEvents.filter(e => {
        const d = new Date(e.startTime);
        return d >= nextWeekStart && d <= nextWeekEnd;
      });

      const allActionItems = await storage.getActionItems(userId);
      const weekActions = allActionItems.filter(a => {
        const created = a.createdAt ? new Date(a.createdAt) : null;
        return created && created >= weekStart && created <= weekEnd;
      });
      const actionsCreated = weekActions.length;
      const actionsCompleted = weekActions.filter(a => a.status === "completed").length;

      const metrics: Record<string, any> = {
        confirmedDebriefs: confirmedDebriefs.length,
        completedProgrammes: completedProgrammes.length,
        completedBookings: completedBookings.length,
        milestonesCreated: weekMilestones.length,
        outstandingDebriefs,
        upcomingEventsNextWeek: upcomingEvents.length,
        actionsCreated,
        actionsCompleted,
      };

      const summaryParts: string[] = [];
      if (confirmedDebriefs.length > 0) summaryParts.push(`${confirmedDebriefs.length} debrief${confirmedDebriefs.length > 1 ? "s" : ""} confirmed`);
      else summaryParts.push("No debriefs confirmed this week");
      if (completedProgrammes.length > 0) summaryParts.push(`${completedProgrammes.length} programme${completedProgrammes.length > 1 ? "s" : ""} completed`);
      if (completedBookings.length > 0) summaryParts.push(`${completedBookings.length} booking${completedBookings.length > 1 ? "s" : ""} completed`);
      if (weekMilestones.length > 0) summaryParts.push(`${weekMilestones.length} milestone${weekMilestones.length > 1 ? "s" : ""} created`);
      if (actionsCreated > 0) summaryParts.push(`${actionsCreated} action${actionsCreated > 1 ? "s" : ""} created, ${actionsCompleted} completed`);
      if (topThemes.length > 0) summaryParts.push(`Top themes: ${topThemes.join(", ")}`);
      if (sentimentAvg !== null) {
        const label = sentimentAvg >= 2.5 ? "positive" : sentimentAvg >= 1.5 ? "neutral" : "negative";
        summaryParts.push(`Overall sentiment: ${label} (n=${sentiments.length})`);
      }
      if (outstandingDebriefs > 0) summaryParts.push(`${outstandingDebriefs} event${outstandingDebriefs > 1 ? "s" : ""} still to be debriefed`);
      if (upcomingEvents.length > 0) summaryParts.push(`${upcomingEvents.length} event${upcomingEvents.length > 1 ? "s" : ""} upcoming next week`);

      const generatedSummary = summaryParts.join(". ") + ".";

      const debrief = await storage.createWeeklyHubDebrief({
        userId,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        status: "draft",
        generatedSummaryText: generatedSummary,
        finalSummaryText: null,
        metricsJson: metrics,
        themesJson: topThemes,
        sentimentJson: {
          average: sentimentAvg,
          sampleSize: sentiments.length,
          breakdown: sentimentBreakdown,
        },
      });

      res.status(201).json(debrief);
    } catch (err: any) {
      console.error("Generate weekly debrief error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/weekly-hub-debriefs/:id", isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await storage.getWeeklyHubDebrief(id);
      if (!existing) return res.status(404).json({ message: "Not found" });

      const { finalSummaryText, status } = req.body;
      const updates: any = {};
      if (finalSummaryText !== undefined) updates.finalSummaryText = finalSummaryText;
      if (status === "confirmed" && existing.status !== "confirmed") {
        updates.status = "confirmed";
        updates.confirmedAt = new Date();
      } else if (status === "draft") {
        updates.status = "draft";
        updates.confirmedAt = null;
      }

      const updated = await storage.updateWeeklyHubDebrief(id, updates);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/weekly-hub-debriefs/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteWeeklyHubDebrief(Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === Taxonomy Scan - AI-powered suggestion engine ===
  app.post("/api/taxonomy/scan-suggestions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;

      const taxonomy = await storage.getTaxonomy(userId);
      const keywords = await storage.getKeywords(userId);
      const existingCategories = taxonomy.map(t => ({
        name: t.name,
        description: t.description,
        active: t.active,
      }));
      const existingKeywords = keywords.map(k => {
        const cat = taxonomy.find(t => t.id === k.taxonomyId);
        return { phrase: k.phrase, category: cat?.name || "Unknown" };
      });

      const legacyReports = await storage.getLegacyReports(userId);
      const confirmedReports = legacyReports.filter(r => r.status === "confirmed");

      const reportSummaries: string[] = [];
      for (const report of confirmedReports.slice(0, 24)) {
        const extraction = await storage.getLegacyReportExtraction(report.id);
        const parts: string[] = [`Period: ${report.quarterLabel}`];
        if (extraction?.extractedOrganisations) {
          const orgs = extraction.extractedOrganisations as any[];
          parts.push(`Organisations: ${orgs.map((o: any) => `${o.name} (${o.relationshipTier || "unknown"})`).join(", ")}`);
        }
        if (extraction?.extractedHighlights) {
          const highlights = extraction.extractedHighlights as any[];
          parts.push(`Highlights: ${highlights.map((h: any) => `${h.theme}: ${h.summary}`).join("; ")}`);
        }
        if (extraction?.extractedPeople) {
          const people = extraction.extractedPeople as any[];
          if (people.length > 0) {
            parts.push(`People mentioned: ${people.map((p: any) => `${p.name} (${p.role || "unknown"})`).join(", ")}`);
          }
        }
        reportSummaries.push(parts.join("\n"));
      }

      const contacts = await storage.getContacts(userId);
      const interactionSummaries: string[] = [];
      for (const contact of contacts.slice(0, 20)) {
        const interactions = await storage.getInteractions(contact.id);
        const recentInteractions = interactions.slice(0, 5);
        for (const interaction of recentInteractions) {
          if (interaction.notes || interaction.transcript) {
            const text = (interaction.notes || interaction.transcript || "").slice(0, 200);
            interactionSummaries.push(`${contact.name} - ${interaction.type}: ${text}`);
          }
        }
      }

      const prompt = `You are analyzing data from a community hub/mentorship platform to suggest NEW impact taxonomy categories and keywords.

EXISTING CATEGORIES:
${JSON.stringify(existingCategories, null, 2)}

EXISTING KEYWORDS:
${JSON.stringify(existingKeywords, null, 2)}

DATA FROM LEGACY REPORTS (${confirmedReports.length} confirmed reports):
${reportSummaries.join("\n---\n")}

DATA FROM INTERACTIONS (sample):
${interactionSummaries.slice(0, 30).join("\n")}

Your task:
1. Analyze all the data above for recurring themes, activities, and impact areas
2. Suggest NEW categories that are NOT already covered by existing ones
3. Suggest NEW keywords that could map to existing OR new categories
4. Focus on categories relevant to community impact, mentorship, youth development, events, partnerships, and social outcomes
5. Do NOT suggest categories that duplicate existing ones (even with different wording)

Return a JSON object with this exact structure:
{
  "categorySuggestions": [
    { "name": "Category Name", "description": "Why this category should be added", "color": "suggested color (purple/blue/green/amber/red/pink/teal/orange/cyan/indigo)", "confidence": 85, "evidence": "Brief quote or reference from the data" }
  ],
  "keywordSuggestions": [
    { "phrase": "keyword phrase", "suggestedCategory": "category name (existing or new)", "confidence": 80, "evidence": "Where this phrase appears in the data" }
  ]
}

Only suggest items with confidence >= 60. Limit to 10 categories and 15 keywords max.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || '{"categorySuggestions":[],"keywordSuggestions":[]}');
      res.json({
        categorySuggestions: result.categorySuggestions || [],
        keywordSuggestions: result.keywordSuggestions || [],
        scannedReports: confirmedReports.length,
        scannedInteractions: interactionSummaries.length,
      });
    } catch (err: any) {
      console.error("Taxonomy scan error:", err);
      res.status(500).json({ message: "Failed to scan for taxonomy suggestions" });
    }
  });

  // === Dashboard Blended Stats ===
  app.get("/api/dashboard/blended-stats", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const settings = await storage.getReportingSettings(userId);
      const allLegacyReports = await storage.getLegacyReports(userId);
      const confirmedReports = allLegacyReports.filter(r => r.status === "confirmed");

      const legacyTotals = {
        totalActivations: 0,
        totalFoottraffic: 0,
        totalBookings: 0,
        reportCount: confirmedReports.length,
      };

      for (const report of confirmedReports) {
        const snapshot = await storage.getLegacyReportSnapshot(report.id);
        if (snapshot) {
          legacyTotals.totalActivations += snapshot.activationsTotal || 0;
          legacyTotals.totalFoottraffic += snapshot.foottrafficUnique || 0;
          legacyTotals.totalBookings += snapshot.bookingsTotal || 0;
        }
      }

      const allProgrammes = await storage.getProgrammes(userId);
      const completedProgrammes = allProgrammes.filter(p => p.status === "completed").length;

      const allBookings = await storage.getBookings(userId);
      const completedBookings = allBookings.filter(b => b.status === "completed").length;

      const allDebriefs = await storage.getImpactLogs(userId);
      const confirmedDebriefs = allDebriefs.filter(d => d.status === "confirmed").length;

      res.json({
        legacy: legacyTotals,
        live: {
          completedProgrammes,
          completedBookings,
          confirmedDebriefs,
        },
        boundaryDate: settings?.boundaryDate || null,
      });
    } catch (err: any) {
      console.error("Blended stats error:", err);
      res.status(500).json({ message: "Failed to fetch blended stats" });
    }
  });

  // === Dashboard Outstanding Actions ===
  app.get("/api/dashboard/outstanding-actions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const allActions = await storage.getActionItems(userId);
      const outstanding = allActions
        .filter(a => a.status !== "completed")
        .sort((a, b) => {
          const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          if (aDue !== bDue) return aDue - bDue;
          const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bCreated - aCreated;
        })
        .slice(0, 10);

      res.json(outstanding);
    } catch (err: any) {
      console.error("Outstanding actions error:", err);
      res.status(500).json({ message: "Failed to fetch outstanding actions" });
    }
  });

  // === Community Spend API ===

  app.get("/api/community-spend", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const items = await storage.getCommunitySpend(userId);
      const allContacts = await storage.getContacts(userId);
      const allGroups = await storage.getGroups(userId);
      const allProgrammes = await storage.getProgrammes(userId);
      const enriched = items.map(item => ({
        ...item,
        contactName: item.contactId ? allContacts.find(c => c.id === item.contactId)?.name : null,
        groupName: item.groupId ? allGroups.find(g => g.id === item.groupId)?.name : null,
        programmeName: item.programmeId ? allProgrammes.find(p => p.id === item.programmeId)?.name : null,
      }));
      res.json(enriched);
    } catch (err: any) {
      console.error("Community spend error:", err);
      res.status(500).json({ message: "Failed to fetch community spend" });
    }
  });

  app.post("/api/community-spend", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const body = coerceDateFields({ ...req.body, userId });
      if (body.amount !== undefined && typeof body.amount === 'number') body.amount = String(body.amount);
      const input = insertCommunitySpendSchema.parse(body);
      const item = await storage.createCommunitySpend(input);
      res.status(201).json(item);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      console.error("Create community spend error:", err);
      res.status(500).json({ message: "Failed to create community spend" });
    }
  });

  app.put("/api/community-spend/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseInt(req.params.id);
      const existing = await storage.getCommunitySpendItem(id);
      if (!existing || String(existing.userId) !== String(userId)) return res.status(404).json({ message: "Not found" });
      const body = coerceDateFields(req.body);
      if (body.amount !== undefined && typeof body.amount === 'number') body.amount = String(body.amount);
      const updated = await storage.updateCommunitySpend(id, body);
      res.json(updated);
    } catch (err: any) {
      console.error("Update community spend error:", err);
      res.status(500).json({ message: "Failed to update community spend" });
    }
  });

  app.delete("/api/community-spend/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseInt(req.params.id);
      const existing = await storage.getCommunitySpendItem(id);
      if (!existing || String(existing.userId) !== String(userId)) return res.status(404).json({ message: "Not found" });
      await storage.deleteCommunitySpend(id);
      res.status(204).end();
    } catch (err: any) {
      console.error("Delete community spend error:", err);
      res.status(500).json({ message: "Failed to delete community spend" });
    }
  });

  app.get("/api/community-spend/summary", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const items = await storage.getCommunitySpend(userId);
      const totalSpend = items.reduce((sum, i) => sum + parseFloat(String(i.amount)), 0);
      const byCategory: Record<string, number> = {};
      const byGroup: Record<string, number> = {};
      const byMonth: Record<string, number> = {};

      for (const item of items) {
        byCategory[item.category] = (byCategory[item.category] || 0) + parseFloat(String(item.amount));
        if (item.groupId) {
          const groups = await storage.getGroups(userId);
          const group = groups.find(g => g.id === item.groupId);
          if (group) {
            byGroup[group.name] = (byGroup[group.name] || 0) + parseFloat(String(item.amount));
          }
        }
        if (item.date) {
          const monthKey = new Date(item.date).toISOString().slice(0, 7);
          byMonth[monthKey] = (byMonth[monthKey] || 0) + parseFloat(String(item.amount));
        }
      }

      res.json({ totalSpend, byCategory, byGroup, byMonth, totalEntries: items.length });
    } catch (err: any) {
      console.error("Community spend summary error:", err);
      res.status(500).json({ message: "Failed to fetch summary" });
    }
  });

  // === GMAIL IMPORT ===

  app.get("/api/gmail/status", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const syncSettings = await storage.getGmailSyncSettings(userId);
      const history = await storage.getGmailImportHistory(userId);
      const latestImport = history[0] || null;
      const additionalAccounts = await storage.getGmailConnectedAccounts(userId);
      const connected = additionalAccounts.length > 0;

      res.json({
        connected,
        syncSettings: syncSettings || null,
        latestImport,
        totalImports: history.length,
        additionalAccountsCount: additionalAccounts.length,
      });
    } catch (err: any) {
      console.error("Gmail status error:", err);
      res.status(500).json({ message: "Failed to check Gmail status" });
    }
  });

  app.post("/api/gmail/scan", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const scanSchema = z.object({
        daysBack: z.number().min(1).max(730).default(365),
        scanType: z.enum(['initial', 'manual', 'sync']).default('manual'),
        accountId: z.number().optional(),
      });
      const parsed = scanSchema.parse(req.body);
      const result = await scanGmailEmails(userId, parsed.scanType, parsed.daysBack, parsed.accountId);
      res.json(result);
    } catch (err: any) {
      console.error("Gmail scan error:", err);
      if (err.name === 'ZodError') return res.status(400).json({ message: "Invalid parameters" });
      res.status(500).json({ message: err.message || "Failed to start scan" });
    }
  });

  app.get("/api/gmail/history", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const history = await storage.getGmailImportHistory(userId);
      res.json(history);
    } catch (err: any) {
      console.error("Gmail history error:", err);
      res.status(500).json({ message: "Failed to fetch history" });
    }
  });

  app.get("/api/gmail/history/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const item = await storage.getGmailImportHistoryItem(parseInt(req.params.id));
      if (!item || item.userId !== userId) return res.status(404).json({ message: "Not found" });
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch import details" });
    }
  });

  app.get("/api/gmail/exclusions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const exclusions = await storage.getGmailExclusions(userId);
      res.json(exclusions);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch exclusions" });
    }
  });

  app.post("/api/gmail/exclusions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { type, value } = req.body;
      if (!type || !value) return res.status(400).json({ message: "Type and value required" });
      if (!['domain', 'email'].includes(type)) return res.status(400).json({ message: "Type must be 'domain' or 'email'" });

      const exclusion = await storage.createGmailExclusion({
        userId,
        type,
        value: value.toLowerCase().trim(),
      });
      res.json(exclusion);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create exclusion" });
    }
  });

  app.delete("/api/gmail/exclusions/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const exclusions = await storage.getGmailExclusions(userId);
      const exclusion = exclusions.find(e => e.id === parseInt(req.params.id));
      if (!exclusion) return res.status(404).json({ message: "Not found" });
      await storage.deleteGmailExclusion(exclusion.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete exclusion" });
    }
  });

  app.get("/api/gmail/sync-settings", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const settings = await storage.getGmailSyncSettings(userId);
      res.json(settings || { autoSyncEnabled: false, syncIntervalHours: 24, lastSyncAt: null });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch sync settings" });
    }
  });

  app.put("/api/gmail/sync-settings", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { autoSyncEnabled } = req.body;
      const existing = await storage.getGmailSyncSettings(userId);
      if (existing) {
        const updated = await storage.updateGmailSyncSettings(userId, { autoSyncEnabled });
        res.json(updated);
      } else {
        const created = await storage.createGmailSyncSettings({
          userId,
          autoSyncEnabled,
          syncIntervalHours: 24,
        });
        res.json(created);
      }
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update sync settings" });
    }
  });

  // === GMAIL MULTI-ACCOUNT OAUTH ===

  app.get("/api/gmail/oauth/config", isAuthenticated, async (req, res) => {
    const client = getGmailOAuth2Client();
    res.json({ configured: !!client });
  });

  app.get("/api/gmail/oauth/authorize", isAuthenticated, async (req, res) => {
    const oauth2Client = getGmailOAuth2Client();
    if (!oauth2Client) {
      return res.status(400).json({ message: "Google OAuth not configured. Please add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET." });
    }

    const crypto = await import('crypto');
    const userId = (req.user as any).claims.sub;
    const nonce = crypto.randomBytes(16).toString('hex');
    const secret = process.env.SESSION_SECRET || 'gmail-oauth-state';
    const payload = JSON.stringify({ userId, nonce, ts: Date.now() });
    const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const state = Buffer.from(JSON.stringify({ payload, hmac })).toString('base64');

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/userinfo.email'],
      state,
    });

    res.json({ url });
  });

  app.get("/api/gmail/oauth/callback", async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.redirect('/gmail-import?error=missing_params');
    }

    let userId: string;
    try {
      const crypto = await import('crypto');
      const decoded = JSON.parse(Buffer.from(state as string, 'base64').toString());
      const { payload, hmac } = decoded;
      const secret = process.env.SESSION_SECRET || 'gmail-oauth-state';
      const expectedHmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      if (hmac !== expectedHmac) {
        return res.redirect('/gmail-import?error=invalid_state');
      }
      const parsed = JSON.parse(payload);
      if (Date.now() - parsed.ts > 10 * 60 * 1000) {
        return res.redirect('/gmail-import?error=state_expired');
      }
      userId = parsed.userId;
    } catch {
      return res.redirect('/gmail-import?error=invalid_state');
    }

    const oauth2Client = getGmailOAuth2Client();
    if (!oauth2Client) {
      return res.redirect('/gmail-import?error=not_configured');
    }

    try {
      const { tokens } = await oauth2Client.getToken(code as string);
      oauth2Client.setCredentials(tokens);

      const oauth2 = (await import('googleapis')).google.oauth2({ version: 'v2', auth: oauth2Client });
      const { data: userInfo } = await oauth2.userinfo.get();
      const email = userInfo.email || 'unknown';

      const existing = await storage.getGmailConnectedAccountByEmail(userId, email);
      if (existing) {
        await storage.updateGmailConnectedAccount(existing.id, {
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token || existing.refreshToken,
          tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        });
      } else {
        await storage.createGmailConnectedAccount({
          userId,
          email,
          label: email,
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token!,
          tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        });
      }

      res.redirect('/gmail-import?success=account_added');
    } catch (err: any) {
      console.error('Gmail OAuth callback error:', err);
      res.redirect('/gmail-import?error=auth_failed');
    }
  });

  app.get("/api/gmail/accounts", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const accounts = await storage.getGmailConnectedAccounts(userId);
      const safeAccounts = accounts.map(a => ({
        id: a.id,
        email: a.email,
        label: a.label,
        createdAt: a.createdAt,
        tokenExpiry: a.tokenExpiry,
        hasValidToken: !a.tokenExpiry || new Date(a.tokenExpiry).getTime() > Date.now(),
      }));
      res.json(safeAccounts);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch accounts" });
    }
  });

  app.delete("/api/gmail/accounts/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const account = await storage.getGmailConnectedAccount(parseInt(req.params.id));
      if (!account || account.userId !== userId) {
        return res.status(404).json({ message: "Account not found" });
      }
      await storage.deleteGmailConnectedAccount(account.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to remove account" });
    }
  });

  // === COMMUNITY MANAGEMENT ===

  app.get("/api/groups/community-density", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const allGroups = await storage.getGroups(userId);
      const allContacts = await storage.getContacts(userId);

      const communityContactIds = new Set(
        allContacts.filter((c: any) => c.isCommunityMember).map((c: any) => c.id)
      );

      const densityMap: Record<number, { communityCount: number; totalMembers: number }> = {};

      for (const group of allGroups) {
        const members = await storage.getGroupMembers(group.id);
        const communityCount = members.filter(m => communityContactIds.has(m.contactId)).length;
        densityMap[group.id] = { communityCount, totalMembers: members.length };
      }

      res.json(densityMap);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to get community density" });
    }
  });

  app.get("/api/contacts/community/junk-scan", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const allContacts = await storage.getContacts(userId);

      const JUNK_PATTERNS = [
        /^no[-_.]?reply/i, /^do[-_.]?not[-_.]?reply/i, /^noreply/i,
        /^mailer[-_.]?daemon/i, /^postmaster/i, /^bounce/i,
        /^notifications?@/i, /^alerts?@/i, /^news(letter)?@/i,
        /^support@/i, /^admin@/i, /^system@/i, /^automated/i,
        /^billing@/i, /^invoice/i, /^receipt/i, /^orders?@/i,
        /^feedback@/i, /^help@/i, /^contact@/i, /^enquir/i,
        /^sales@/i, /^marketing@/i, /^team@/i, /^accounts?@/i,
        /^subscribe/i, /^unsubscribe/i, /^updates?@/i, /^digest@/i,
        /^daemon@/i, /^root@/i, /^webmaster@/i, /^cron@/i,
        /^nobody@/i, /^mail@/i, /^service@/i, /^payments?@/i,
        /^confirmation/i, /^verify/i, /^security@/i, /^privacy@/i,
        /^compliance@/i, /^calendar-notification/i, /^drive-shares-/i,
        /^info@.*\.(com|org|net|io|co\.\w+)$/i,
        /^hello@.*\.(com|org|net|io|co\.\w+)$/i,
      ];

      const junkContacts = allContacts.filter((c: any) => {
        if (!c.email) return false;
        return JUNK_PATTERNS.some(p => p.test(c.email));
      });

      res.json({ junkContacts, totalContacts: allContacts.length });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to scan for junk contacts" });
    }
  });

  app.post("/api/contacts/community/bulk-delete", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { contactIds } = req.body;
      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ message: "No contact IDs provided" });
      }

      let deleted = 0;
      for (const id of contactIds) {
        const contact = await storage.getContact(id);
        if (contact && contact.userId === userId) {
          await storage.deleteContact(id);
          deleted++;
        }
      }

      res.json({ deleted });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete contacts" });
    }
  });

  app.post("/api/groups/bulk-delete", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { groupIds } = req.body;
      if (!Array.isArray(groupIds) || groupIds.length === 0) {
        return res.status(400).json({ message: "No group IDs provided" });
      }

      let deleted = 0;
      for (const id of groupIds) {
        const group = await storage.getGroup(id);
        if (group && group.userId === userId) {
          await storage.deleteGroup(id);
          deleted++;
        }
      }

      res.json({ deleted });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete groups" });
    }
  });

  app.post("/api/contacts/community/bulk-move", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { contactIds, isCommunityMember } = req.body;
      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ message: "No contact IDs provided" });
      }
      let updated = 0;
      for (const id of contactIds) {
        const contact = await storage.getContact(id);
        if (contact && contact.userId === userId) {
          await storage.updateContact(id, { isCommunityMember, communityMemberOverride: true });
          updated++;
        }
      }
      res.json({ updated });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update contacts" });
    }
  });

  app.post("/api/contacts/community/bulk-update", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { contactIds, updates } = req.body;
      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ message: "No contact IDs provided" });
      }
      const allowedFields = ["role", "activityStatus"];
      const safeUpdates: Record<string, any> = {};
      for (const key of Object.keys(updates || {})) {
        if (allowedFields.includes(key)) {
          safeUpdates[key] = updates[key];
        }
      }
      if (Object.keys(safeUpdates).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      let updated = 0;
      for (const id of contactIds) {
        const contact = await storage.getContact(id);
        if (contact && contact.userId === userId) {
          await storage.updateContact(id, safeUpdates);
          updated++;
        }
      }
      res.json({ updated });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update contacts" });
    }
  });

  app.post("/api/groups/bulk-update-tier", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { groupIds, tier } = req.body;
      if (!Array.isArray(groupIds) || groupIds.length === 0) {
        return res.status(400).json({ message: "No group IDs provided" });
      }
      const validTiers = ["support", "collaborate", "mentioned"];
      if (!validTiers.includes(tier)) {
        return res.status(400).json({ message: "Invalid tier" });
      }
      let updated = 0;
      for (const id of groupIds) {
        const group = await storage.getGroup(id);
        if (group && group.userId === userId) {
          await storage.updateGroup(id, { relationshipTier: tier });
          updated++;
        }
      }
      res.json({ updated });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update groups" });
    }
  });

  app.post("/api/contacts/community/backfill", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const allContacts = await storage.getContacts(userId);

      const contactEngagement = new Map<number, { hasNonEmailEngagement: boolean; lastActiveDate: Date | null }>();

      const trackDate = (contactId: number, date: Date | null | undefined, isNonEmail: boolean) => {
        const existing = contactEngagement.get(contactId) || { hasNonEmailEngagement: false, lastActiveDate: null };
        if (isNonEmail) existing.hasNonEmailEngagement = true;
        if (date && (!existing.lastActiveDate || date > existing.lastActiveDate)) {
          existing.lastActiveDate = date;
        }
        contactEngagement.set(contactId, existing);
      };

      for (const contact of allContacts) {
        const contactInteractions = await storage.getInteractions(contact.id);
        for (const i of contactInteractions) {
          const isEmailInteraction = i.type?.toLowerCase() === 'email';
          trackDate(contact.id, i.date ? new Date(i.date) : null, !isEmailInteraction);
        }
      }

      const allBookings = await storage.getBookings(userId);
      for (const b of allBookings) {
        const bDate = b.startDate ? new Date(b.startDate) : null;
        if (b.bookerId) trackDate(b.bookerId, bDate, true);
        if (b.attendees) {
          for (const a of b.attendees) trackDate(a, bDate, true);
        }
      }

      const allProgrammes = await storage.getProgrammes(userId);
      for (const p of allProgrammes) {
        const pDate = p.startDate ? new Date(p.startDate) : (p.createdAt ? new Date(p.createdAt) : null);
        if (p.facilitators) {
          for (const f of p.facilitators) trackDate(f, pDate, true);
        }
        if (p.attendees) {
          for (const a of p.attendees) trackDate(a, pDate, true);
        }
      }

      const allMemberships = await storage.getMemberships(userId);
      for (const m of allMemberships) {
        if (m.contactId) trackDate(m.contactId, m.createdAt ? new Date(m.createdAt) : null, true);
      }

      const allMous = await storage.getMous(userId);
      for (const m of allMous) {
        if (m.contactId) trackDate(m.contactId, m.createdAt ? new Date(m.createdAt) : null, true);
      }

      const allSpend = await storage.getCommunitySpend(userId);
      for (const s of allSpend) {
        if (s.contactId) trackDate(s.contactId, s.date ? new Date(s.date) : null, true);
      }

      const impactLogs = await storage.getImpactLogs(userId);
      for (const log of impactLogs) {
        if (log.linkedContactId) trackDate(log.linkedContactId, log.createdAt ? new Date(log.createdAt) : null, true);
      }

      const allEvents = await storage.getEvents(userId);
      for (const event of allEvents) {
        const eDate = event.startTime ? new Date(event.startTime) : null;
        const attendance = await storage.getEventAttendance(event.id);
        for (const att of attendance) {
          trackDate(att.contactId, eDate, true);
        }
      }

      const legacyReports = await storage.getLegacyReports(userId);
      const reportPeopleMap = new Map<string, Date>();
      for (const report of legacyReports) {
        if (report.status !== 'confirmed') continue;
        const extraction = await storage.getLegacyReportExtraction(report.id);
        if (extraction?.extractedPeople) {
          const reportDate = (report.year && report.month)
            ? new Date(report.year, report.month - 1, 15)
            : (report.createdAt ? new Date(report.createdAt) : null);
          for (const person of extraction.extractedPeople) {
            const key = person.name.toLowerCase().trim();
            const existing = reportPeopleMap.get(key);
            if (reportDate && (!existing || reportDate > existing)) {
              reportPeopleMap.set(key, reportDate);
            } else if (!existing) {
              reportPeopleMap.set(key, reportDate!);
            }
          }
        }
      }
      for (const contact of allContacts) {
        const reportDate = reportPeopleMap.get(contact.name.toLowerCase().trim());
        if (reportDate !== undefined) {
          trackDate(contact.id, reportDate, true);
        }
      }

      let flagged = 0;
      let unflagged = 0;
      let lastActiveDatesSet = 0;
      for (const contact of allContacts) {
        if (contact.communityMemberOverride) continue;

        const engagement = contactEngagement.get(contact.id);
        const hasNonEmailEngagement = engagement?.hasNonEmailEngagement || false;
        const lastActiveDate = engagement?.lastActiveDate || null;

        const updates: any = {};

        if (hasNonEmailEngagement && !contact.isCommunityMember) {
          updates.isCommunityMember = true;
          flagged++;
        } else if (!hasNonEmailEngagement && contact.isCommunityMember && !contact.communityMemberOverride) {
          updates.isCommunityMember = false;
          unflagged++;
        }

        if (lastActiveDate) {
          updates.lastActiveDate = lastActiveDate;
          lastActiveDatesSet++;
        }

        if (Object.keys(updates).length > 0) {
          await storage.updateContact(contact.id, updates);
        }
      }

      res.json({ flagged, unflagged, lastActiveDatesSet, totalContacts: allContacts.length, totalEngagedContacts: contactEngagement.size });
    } catch (err: any) {
      console.error("Backfill error:", err);
      res.status(500).json({ message: "Failed to backfill community members" });
    }
  });

  app.patch("/api/contacts/:id/community-status", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const contactId = parseInt(req.params.id);
      const contact = await storage.getContact(contactId);
      if (!contact || contact.userId !== userId) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const { isCommunityMember, relationshipCircle } = req.body;

      const updates: any = {};
      if (typeof isCommunityMember === 'boolean') {
        updates.isCommunityMember = isCommunityMember;
        updates.communityMemberOverride = true;
      }
      if (relationshipCircle !== undefined) {
        updates.relationshipCircle = relationshipCircle;
        updates.relationshipCircleOverride = true;
      }

      const updated = await storage.updateContact(contactId, updates);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update community status" });
    }
  });

  app.post("/api/contacts/community/ai-score", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const allContacts = await storage.getContacts(userId);
      const communityMembers = allContacts.filter((c: any) => c.isCommunityMember && !c.relationshipCircleOverride);

      if (communityMembers.length === 0) {
        return res.json({ scored: 0, message: "No community members to score" });
      }

      const allBookings = await storage.getBookings(userId);
      const allProgrammes = await storage.getProgrammes(userId);
      const allMemberships = await storage.getMemberships(userId);
      const allMous = await storage.getMous(userId);
      const allSpend = await storage.getCommunitySpend(userId);
      const allEvents = await storage.getEvents(userId);

      const legacyReports = await storage.getLegacyReports(userId);
      const reportPeopleMap = new Map<string, Date | null>();
      for (const report of legacyReports) {
        if (report.status !== 'confirmed') continue;
        const extraction = await storage.getLegacyReportExtraction(report.id);
        if (extraction?.extractedPeople) {
          const reportDate = (report.year && report.month)
            ? new Date(report.year, report.month - 1, 15)
            : (report.createdAt ? new Date(report.createdAt) : null);
          for (const person of extraction.extractedPeople) {
            const key = person.name.toLowerCase().trim();
            const existing = reportPeopleMap.get(key);
            if (reportDate && (!existing || reportDate > existing)) {
              reportPeopleMap.set(key, reportDate);
            } else if (!reportPeopleMap.has(key)) {
              reportPeopleMap.set(key, reportDate);
            }
          }
        }
      }

      const now = Date.now();
      const sixMonthsMs = 180 * 24 * 60 * 60 * 1000;
      const recencyBonus = (date: Date | string | null | undefined) => {
        if (!date) return 1;
        const d = date instanceof Date ? date : new Date(date);
        const age = now - d.getTime();
        if (age < sixMonthsMs) return 1.5;
        return 1;
      };

      const contactScores = new Map<number, number>();

      for (const contact of communityMembers) {
        let score = 0;

        const contactInteractions = await storage.getInteractions(contact.id);
        for (const i of contactInteractions) {
          if (i.type?.toLowerCase() === 'email') continue;
          score += 3 * recencyBonus(i.date);
        }

        const bookingsAsBooker = allBookings.filter((b: any) => b.bookerId === contact.id);
        const bookingsAsAttendee = allBookings.filter((b: any) => b.attendees?.includes(contact.id));
        for (const b of bookingsAsBooker) score += 4 * recencyBonus(b.startDate);
        for (const b of bookingsAsAttendee) score += 2 * recencyBonus(b.startDate);

        const progAsFacilitator = allProgrammes.filter((p: any) => p.facilitators?.includes(contact.id));
        const progAsAttendee = allProgrammes.filter((p: any) => p.attendees?.includes(contact.id));
        for (const p of progAsFacilitator) score += 5 * recencyBonus(p.startDate || p.createdAt);
        for (const p of progAsAttendee) score += 2 * recencyBonus(p.startDate || p.createdAt);

        const contactMemberships = allMemberships.filter((m: any) => m.contactId === contact.id);
        score += contactMemberships.length * 5;

        const contactMous = allMous.filter((m: any) => m.contactId === contact.id);
        score += contactMous.length * 5;

        const contactSpend = allSpend.filter((s: any) => s.contactId === contact.id);
        for (const s of contactSpend) score += 3 * recencyBonus(s.date);

        for (const event of allEvents) {
          const attendance = await storage.getEventAttendance(event.id);
          const attended = attendance.find(a => a.contactId === contact.id);
          if (attended) {
            score += 2 * recencyBonus(event.startTime);
          }
        }

        const reportDate = reportPeopleMap.get(contact.name.toLowerCase().trim());
        if (reportDate !== undefined) {
          score += 4 * recencyBonus(reportDate);
        }

        contactScores.set(contact.id, Math.round(score));
      }

      const scores = Array.from(contactScores.values()).sort((a, b) => b - a);
      const topThreshold = scores.length > 0 ? scores[Math.floor(scores.length * 0.2)] || 10 : 10;
      const midThreshold = scores.length > 0 ? scores[Math.floor(scores.length * 0.6)] || 3 : 3;

      let scored = 0;
      for (const [contactId, score] of Array.from(contactScores.entries())) {
        let circle: string;
        if (score >= topThreshold && score > 0) {
          circle = 'inner_circle';
        } else if (score >= midThreshold && score > 0) {
          circle = 'active_network';
        } else {
          circle = 'wider_community';
        }

        await storage.updateContact(contactId, { relationshipCircle: circle });
        scored++;
      }

      res.json({ scored, thresholds: { innerCircle: topThreshold, activeNetwork: midThreshold } });
    } catch (err: any) {
      console.error("AI scoring error:", err);
      res.status(500).json({ message: "Failed to score relationships" });
    }
  });

  startAutoSync();

  return httpServer;
}
