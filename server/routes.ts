import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerAudioRoutes } from "./replit_integrations/audio/routes";
import { claudeJSON } from "./replit_integrations/anthropic/client";
import { getFullMonthlyReport, generateNarrative, getCommunityComparison, getTamakiOraAlignment, getReachMetrics, getDeliveryMetrics, getImpactMetrics, type ReportFilters } from "./reporting";
import { getNZWeekStart, getNZWeekEnd } from "@shared/nz-week";
import { insertCommunitySpendSchema, insertFunderSchema, insertFunderDocumentSchema, insertMeetingTypeSchema, insertMentoringRelationshipSchema, insertMentoringApplicationSchema, insertProjectSchema, insertProjectUpdateSchema, insertProjectTaskSchema, insertRegularBookerSchema, insertVenueInstructionSchema, insertSurveySchema, interactions, meetings, actionItems, consentRecords, memberships, mous, milestones, communitySpend, eventAttendance, impactLogContacts, impactLogs, groupMembers, bookings, programmes, contacts, impactLogGroups, events, groups, funderDocuments, dismissedDuplicates, mentorProfiles, meetingTypes, regularBookers, surveys, bookerLinks, SESSION_FREQUENCIES, JOURNEY_STAGES, insertMonthlySnapshotSchema, insertReportHighlightSchema, HIGHLIGHT_CATEGORIES } from "@shared/schema";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { ObjectStorageService } from "./replit_integrations/object_storage";
import crypto from "crypto";
import { db } from "./db";
import { eq, and, sql, gte, lte } from "drizzle-orm";

const reportCache = new Map<string, { data: any; expiresAt: number }>();
const inflightReports = new Map<string, Promise<any>>();

const REPORT_CACHE_TTL_MS = 60_000;

function getReportCacheKey(prefix: string, filters: Record<string, any>): string {
  const stable = JSON.stringify(filters, Object.keys(filters).sort());
  return `${prefix}:${crypto.createHash("sha256").update(stable).digest("hex")}`;
}

function getCachedReport(key: string): any | null {
  const entry = reportCache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.data;
  if (entry) reportCache.delete(key);
  return null;
}

function setCachedReport(key: string, data: any): void {
  reportCache.set(key, { data, expiresAt: Date.now() + REPORT_CACHE_TTL_MS });
}

async function deduplicatedReportCall<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const cached = getCachedReport(key);
  if (cached) return cached as T;

  const inflight = inflightReports.get(key);
  if (inflight) return inflight as Promise<T>;

  const promise = fn()
    .then((result) => {
      setCachedReport(key, result);
      inflightReports.delete(key);
      return result;
    })
    .catch((err) => {
      inflightReports.delete(key);
      throw err;
    });

  inflightReports.set(key, promise);
  return promise;
}
import { scanGmailEmails, startAutoSync, getGmailOAuth2Client, isNoreplyEmail } from "./gmail-import";

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

  // Object Storage Routes
  registerObjectStorageRoutes(app);

  // === Contacts API ===

  app.get(api.contacts.list.path, isAuthenticated, async (req, res) => {
    // req.user is populated by Replit Auth (passport)
    const userId = (req.user as any).claims.sub; 
    const contacts = await storage.getContacts(userId);
    res.json(contacts);
  });

  app.get("/api/contacts/suggested-duplicates", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const allContacts = await storage.getContacts(userId);
      const dismissed = await db.select().from(dismissedDuplicates).where(and(eq(dismissedDuplicates.userId, userId), eq(dismissedDuplicates.entityType, "contact")));
      const dismissedSet = new Set(dismissed.map(d => `${Math.min(d.entityId1, d.entityId2)}-${Math.max(d.entityId1, d.entityId2)}`));

      function normalize(s: string | null | undefined): string {
        return (s || "").toLowerCase().trim().replace(/\s+/g, " ");
      }
      function similarity(a: string, b: string): number {
        if (a === b) return 1;
        if (!a || !b) return 0;
        const longer = a.length > b.length ? a : b;
        const shorter = a.length > b.length ? b : a;
        if (longer.length === 0) return 1;
        const costs: number[] = [];
        for (let i = 0; i <= longer.length; i++) {
          let lastVal = i;
          for (let j = 0; j <= shorter.length; j++) {
            if (i === 0) { costs[j] = j; }
            else if (j > 0) {
              let newVal = costs[j - 1];
              if (longer[i - 1] !== shorter[j - 1]) newVal = Math.min(Math.min(newVal, lastVal), costs[j]) + 1;
              costs[j - 1] = lastVal;
              lastVal = newVal;
            }
          }
          if (i > 0) costs[shorter.length] = lastVal;
        }
        return (longer.length - costs[shorter.length]) / longer.length;
      }

      const clusters: { reason: string; contacts: any[] }[] = [];
      const seen = new Set<string>();

      for (let i = 0; i < allContacts.length; i++) {
        for (let j = i + 1; j < allContacts.length; j++) {
          const a = allContacts[i];
          const b = allContacts[j];
          const pairKey = `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`;
          if (dismissedSet.has(pairKey) || seen.has(pairKey)) continue;

          let reason = "";
          const na = normalize(a.name);
          const nb = normalize(b.name);
          if (na && nb && na === nb) {
            reason = "Same name";
          } else if (na && nb && similarity(na, nb) >= 0.8) {
            reason = "Similar names";
          } else if (a.email && b.email && normalize(a.email) === normalize(b.email)) {
            reason = "Same email";
          } else if (a.phone && b.phone && a.phone.replace(/\D/g, "") === b.phone.replace(/\D/g, "") && a.phone.replace(/\D/g, "").length >= 6) {
            reason = "Same phone";
          }

          if (reason) {
            seen.add(pairKey);
            clusters.push({ reason, contacts: [a, b] });
          }
        }
      }

      res.json(clusters);
    } catch (err: any) {
      console.error("Suggested duplicates error:", err);
      res.status(500).json({ message: "Failed to find duplicates" });
    }
  });

  app.post("/api/contacts/dismiss-duplicate", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { id1, id2 } = req.body;
      if (!id1 || !id2) return res.status(400).json({ message: "id1 and id2 required" });
      await db.insert(dismissedDuplicates).values({
        userId,
        entityType: "contact",
        entityId1: Math.min(id1, id2),
        entityId2: Math.max(id1, id2),
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to dismiss duplicate" });
    }
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
      if (input.role !== "Other") {
        input.roleOther = null;
      }
      
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

      const allowedFields = ["name", "nickname", "businessName", "ventureType", "role", "roleOther", "email", "phone", "age", "ethnicity", "location", "suburb", "localBoard", "tags", "revenueBand", "metrics", "notes", "active", "consentStatus", "consentDate", "consentNotes", "stage", "whatTheyAreBuilding", "relationshipStage", "isCommunityMember", "communityMemberOverride", "isInnovator", "supportType", "connectionStrength", "relationshipCircle", "relationshipCircleOverride"];
      const filteredBody: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          filteredBody[field] = req.body[field];
        }
      }

      const input = api.contacts.update.input.parse(filteredBody);
      if (input.role && input.role !== "Other") {
        input.roleOther = null;
      }
      if (input.stage && input.stage !== existing.stage) {
        await storage.appendStageProgression(id, input.stage);
      }
      const updated = await storage.updateContact(id, input);

      // Auto-create mentoring relationship for innovators with mentoring/workshop support
      if (updated.isInnovator && updated.supportType && 
          (updated.supportType.includes("mentoring") || updated.supportType.includes("workshop_skills"))) {
        const existingRels = await storage.getMentoringRelationshipsByContact(id);
        const hasActiveRel = existingRels.some(r => r.status === "active" || r.status === "application");
        
        if (!hasActiveRel) {
          await storage.createMentoringRelationship({
            contactId: id,
            userId: (req.user as any).claims.sub,
            status: "active",
            startDate: new Date(),
            sessionFrequency: "monthly",
            journeyStage: updated.stage || "kakano",
            focusAreas: []
          });
        }
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

  app.delete(api.contacts.delete.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getContact(id);
    if (!existing) return res.status(404).json({ message: "Contact not found" });
    if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

    await storage.deleteContact(id);
    res.status(204).send();
  });

  app.post("/api/mentoring-relationships/backfill-from-support-type", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const allContacts = await storage.getContacts(userId);
      let createdCount = 0;

      for (const contact of allContacts) {
        if (contact.isInnovator && contact.supportType && 
            (contact.supportType.includes("mentoring") || contact.supportType.includes("workshop_skills"))) {
          const existingRels = await storage.getMentoringRelationshipsByContact(contact.id);
          const hasActiveRel = existingRels.some(r => r.status === "active" || r.status === "application");
          
          if (!hasActiveRel) {
            await storage.createMentoringRelationship({
              contactId: contact.id,
              userId,
              status: "active",
              startDate: new Date(),
              sessionFrequency: "monthly",
              journeyStage: contact.stage || "kakano",
              focusAreas: []
            });
            createdCount++;
          }
        }
      }
      res.json({ success: true, createdCount });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
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
          - skill: Capability level (technical, creative, or business skills)
          - confidence: Personal self-confidence demonstrated
          - bizConfidence: Business confidence — confidence in their venture's viability, market readiness, and business direction
          - systemsInPlace: How well their venture systems and processes are established
          - fundingReadiness: Sustainability readiness — preparedness for funding, revenue, or sustaining their venture
          - networkStrength: Connection strength — quality of their professional/community network
          - communityImpact: Evidence of positive community impact or social contribution
          - digitalPresence: Online presence, content creation, or digital engagement strength
        
        Text: "${text}"
      `;

      const result = await claudeJSON({
        model: "claude-sonnet-4-6",
        prompt,
      });
      
      const analysis = {
        summary: result.summary || "No summary generated.",
        keywords: result.keywords || [],
        metrics: {
          mindset: result.metrics?.mindset || 5,
          skill: result.metrics?.skill || 5,
          confidence: result.metrics?.confidence || 5,
          bizConfidence: result.metrics?.bizConfidence || 5,
          systemsInPlace: result.metrics?.systemsInPlace || 5,
          fundingReadiness: result.metrics?.fundingReadiness || 5,
          networkStrength: result.metrics?.networkStrength || 5,
          communityImpact: result.metrics?.communityImpact || 5,
          digitalPresence: result.metrics?.digitalPresence || 5,
        }
      };

      res.json(analysis);

    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ message: "Failed to analyze text" });
    }
  });

  // === Google Calendar Event Helper ===
  async function createCalendarEventForMeeting(meeting: any, options?: { mentorEmail?: string; coMentorEmail?: string; menteeEmail?: string; calendarId?: string }) {
    try {
      const { getUncachableGoogleCalendarClient } = await import("./replit_integrations/google-calendar/client");
      const calendar = await getUncachableGoogleCalendarClient();

      const attendees: { email: string }[] = [];
      if (options?.mentorEmail) attendees.push({ email: options.mentorEmail });
      if (options?.coMentorEmail) attendees.push({ email: options.coMentorEmail });
      if (options?.menteeEmail) attendees.push({ email: options.menteeEmail });

      const event = await calendar.events.insert({
        calendarId: options?.calendarId || "primary",
        sendUpdates: "all",
        requestBody: {
          summary: meeting.title,
          description: [
            meeting.mentoringFocus ? `Focus: ${meeting.mentoringFocus}` : null,
            meeting.notes ? `Notes: ${meeting.notes}` : null,
            meeting.location ? `Location: ${meeting.location}` : null,
          ].filter(Boolean).join("\n"),
          start: { dateTime: new Date(meeting.startTime).toISOString(), timeZone: "Pacific/Auckland" },
          end: { dateTime: new Date(meeting.endTime).toISOString(), timeZone: "Pacific/Auckland" },
          location: meeting.location || undefined,
          attendees: attendees.length > 0 ? attendees : undefined,
        },
      });

      if (event.data.id) {
        await storage.updateMeeting(meeting.id, { googleCalendarEventId: event.data.id });
      }
      return event.data.id;
    } catch (err: any) {
      console.warn("Google Calendar event creation skipped:", err.message);
      return null;
    }
  }

  async function updateCalendarEventAttendees(googleCalendarEventId: string, attendees: { email: string }[], calendarId?: string) {
    try {
      const { getUncachableGoogleCalendarClient } = await import("./replit_integrations/google-calendar/client");
      const calendar = await getUncachableGoogleCalendarClient();
      const calId = calendarId || "primary";
      
      const existing = await calendar.events.get({ calendarId: calId, eventId: googleCalendarEventId });
      await calendar.events.patch({
        calendarId: calId,
        eventId: googleCalendarEventId,
        sendUpdates: "all",
        requestBody: {
          attendees,
        },
      });
    } catch (err: any) {
      console.warn("Google Calendar event update skipped:", err.message);
    }
  }

  // === Meetings API ===

  app.get('/api/meetings/all-mentors', isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const profiles = await storage.getMentorProfiles(userId);
    const mentorUserIds = new Set<string>();
    mentorUserIds.add(userId);
    for (const p of profiles) {
      if (p.mentorUserId) mentorUserIds.add(p.mentorUserId);
      mentorUserIds.add(`mentor-${p.id}`);
    }
    const profileMap = new Map<number, string>();
    for (const p of profiles) {
      profileMap.set(p.id, p.name);
    }
    const allMeetings = [];
    for (const mid of mentorUserIds) {
      const m = await storage.getMeetings(mid);
      allMeetings.push(...m.map(mtg => ({
        ...mtg,
        mentorName: profiles.find(p => p.mentorUserId === mid || `mentor-${p.id}` === mid)?.name || 'You',
        coMentorName: mtg.coMentorProfileId ? (profileMap.get(mtg.coMentorProfileId) || null) : null,
      })));
    }
    allMeetings.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    res.json(allMeetings);
  });

  app.get('/api/meetings/debrief-summaries', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const profiles = await storage.getMentorProfiles(userId);
      const mentorUserIds = new Set<string>();
      mentorUserIds.add(userId);
      profiles.forEach(p => {
        if (p.mentorUserId) mentorUserIds.add(p.mentorUserId);
        mentorUserIds.add(`mentor-${p.id}`);
      });

      let allMeetings: any[] = [];
      for (const mid of mentorUserIds) {
        const m = await storage.getMeetings(mid);
        allMeetings.push(...m);
      }

      const debriefed = allMeetings.filter(m => m.interactionId && (m.type === "mentoring" || !m.type));
      const summaries: Record<number, any> = {};

      const userContacts = await storage.getContacts(userId);
      const userContactIds = new Set(userContacts.map(c => c.id));

      for (const meeting of debriefed) {
        if (!userContactIds.has(meeting.contactId)) continue;
        const interaction = await storage.getInteraction(meeting.interactionId!);
        if (interaction && userContactIds.has(interaction.contactId)) {
          summaries[meeting.id] = {
            meetingId: meeting.id,
            mindsetScore: interaction.analysis?.mindsetScore,
            skillScore: interaction.analysis?.skillScore,
            confidenceScore: interaction.analysis?.confidenceScore,
            keyInsights: interaction.analysis?.keyInsights || [],
            summary: interaction.summary,
          };
        }
      }

      res.json(summaries);
    } catch (err: any) {
      console.error("Debrief summaries error:", err);
      res.status(500).json({ message: "Failed to fetch debrief summaries" });
    }
  });

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
      let effectiveUserId = userId;

      if (req.body.mentorUserId && req.body.mentorUserId !== userId) {
        const allowed = await isMentorOwner(userId, req.body.mentorUserId);
        if (!allowed) return res.status(403).json({ message: "You do not own that mentor profile" });
        effectiveUserId = req.body.mentorUserId;
      }

      const input = api.meetings.create.input.parse({
        ...req.body,
        userId: effectiveUserId,
        startTime: new Date(req.body.startTime),
        endTime: new Date(req.body.endTime),
      });

      const contact = await storage.getContact(input.contactId);
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      if (contact.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const meeting = await storage.createMeeting(input);

      // Create Google Calendar event asynchronously
      (async () => {
        try {
          const profiles = await storage.getMentorProfiles(userId);
          const mentorProfile = profiles.find(p => p.mentorUserId === effectiveUserId || `mentor-${p.id}` === effectiveUserId) || profiles[0];
          const mentorEmail = mentorProfile?.email || undefined;
          const calendarId = mentorProfile?.googleCalendarId || undefined;
          const menteeEmail = contact.email || undefined;
          await createCalendarEventForMeeting(meeting, {
            mentorEmail,
            menteeEmail,
            calendarId,
          });
        } catch (e) {
          console.warn("Calendar event creation failed silently:", e);
        }
      })();

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
      const userId = (req.user as any).claims.sub;
      const existing = await storage.getMeeting(id);
      if (!existing) return res.status(404).json({ message: "Meeting not found" });
      let authorized = existing.userId === userId;
      if (!authorized) {
        const profiles = await storage.getMentorProfiles(userId);
        const mentorUserIds = new Set<string>();
        for (const p of profiles) {
          if (p.mentorUserId) mentorUserIds.add(p.mentorUserId);
          mentorUserIds.add(`mentor-${p.id}`);
        }
        authorized = mentorUserIds.has(existing.userId);
      }
      if (!authorized) return res.status(403).json({ message: "Forbidden" });

      const updates: any = { ...req.body };
      if (updates.startTime) updates.startTime = new Date(updates.startTime);
      if (updates.endTime) updates.endTime = new Date(updates.endTime);

      // Validate coMentorProfileId ownership
      if (updates.coMentorProfileId && updates.coMentorProfileId !== null) {
        const coMentorProfile = await storage.getMentorProfile(updates.coMentorProfileId);
        if (!coMentorProfile || coMentorProfile.userId !== userId) {
          return res.status(403).json({ message: "Invalid co-mentor profile" });
        }
      }

      const input = api.meetings.update.input.parse(updates);
      const updated = await storage.updateMeeting(id, input);

      // Update Google Calendar attendees when co-mentor changes
      if ('coMentorProfileId' in req.body && updated.googleCalendarEventId) {
        (async () => {
          try {
            const profiles = await storage.getMentorProfiles(userId);
            const attendees: { email: string }[] = [];
            const mentorProfile = profiles.find(p => p.mentorUserId === updated.userId || `mentor-${p.id}` === updated.userId);
            if (mentorProfile?.email) attendees.push({ email: mentorProfile.email });
            if (updated.coMentorProfileId) {
              const coMentor = await storage.getMentorProfile(updated.coMentorProfileId);
              if (coMentor?.email) attendees.push({ email: coMentor.email });
            }
            const contact = await storage.getContact(updated.contactId);
            if (contact?.email) attendees.push({ email: contact.email });
            await updateCalendarEventAttendees(updated.googleCalendarEventId, attendees, mentorProfile?.googleCalendarId || undefined);
          } catch (e) {
            console.warn("Calendar attendee update failed silently:", e);
          }
        })();
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

  app.delete(api.meetings.delete.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const existing = await storage.getMeeting(id);
    if (!existing) return res.status(404).json({ message: "Meeting not found" });
    if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

    await storage.deleteMeeting(id);
    res.status(204).send();
  });

  app.post('/api/meetings/:id/debrief', isAuthenticated, async (req, res) => {
    try {
      const meetingId = parseInt(req.params.id);
      const userId = (req.user as any).claims.sub;
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) return res.status(404).json({ message: "Meeting not found" });
      if (meeting.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const { transcript, summary, analysis, type } = req.body;
      if (!transcript && !summary) {
        return res.status(400).json({ message: "Transcript or summary required" });
      }

      let interaction;
      try {
        interaction = await storage.createInteraction({
          userId,
          contactId: meeting.contactId,
          date: new Date(),
          type: type || "Mentoring Debrief",
          transcript: transcript || null,
          summary: summary || null,
          analysis: analysis || null,
          keywords: analysis?.keyInsights || [],
        });
      } catch (createErr: any) {
        console.error("Failed to create interaction for debrief:", createErr);
        return res.status(500).json({ message: "Failed to create debrief interaction" });
      }

      try {
        await storage.updateMeeting(meetingId, {
          interactionId: interaction.id,
          status: "completed",
        });
      } catch (linkErr: any) {
        console.error("Failed to link interaction to meeting, rolling back:", linkErr);
        try { await storage.deleteInteraction(interaction.id); } catch (_) {}
        return res.status(500).json({ message: "Failed to link debrief to session" });
      }

      res.json({ meeting: { ...meeting, interactionId: interaction.id, status: "completed" }, interaction });
    } catch (err: any) {
      console.error("Debrief error:", err);
      res.status(500).json({ message: "Failed to log debrief" });
    }
  });

  app.get('/api/mentoring-relationships/enriched', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const all = await storage.getMentoringRelationships();
      const userContacts = await storage.getContacts(userId);
      const userContactIds = new Set(userContacts.map(c => c.id));
      const filtered = all.filter(r => userContactIds.has(r.contactId));

      const profiles = await storage.getMentorProfiles(userId);
      const mentorUserIds = new Set<string>();
      mentorUserIds.add(userId);
      profiles.forEach(p => {
        if (p.mentorUserId) mentorUserIds.add(p.mentorUserId);
        mentorUserIds.add(`mentor-${p.id}`);
      });

      let allMeetings: any[] = [];
      for (const mid of mentorUserIds) {
        const m = await storage.getMeetings(mid);
        allMeetings.push(...m.filter(mt => mt.type === "mentoring" || !mt.type));
      }

      const enriched = filtered.map(r => {
        const contact = userContacts.find(c => c.id === r.contactId);
        const sessions = allMeetings.filter(m => m.contactId === r.contactId);
        const completedSessions = sessions.filter(s => s.status === "completed");
        const upcomingSessions = sessions.filter(s => new Date(s.startTime) >= new Date() && s.status !== "cancelled");
        const lastSession = completedSessions.sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];

        return {
          ...r,
          contactName: contact?.name || "Unknown",
          contactEmail: contact?.email,
          stage: contact?.stage,
          ventureType: contact?.ventureType,
          whatTheyAreBuilding: contact?.whatTheyAreBuilding,
          completedSessionCount: completedSessions.length,
          upcomingSessionCount: upcomingSessions.length,
          totalSessionCount: sessions.filter(s => s.status !== "cancelled").length,
          lastSessionDate: lastSession ? lastSession.startTime : null,
          lastSessionFocus: lastSession ? lastSession.mentoringFocus : null,
          recentSessionIds: completedSessions.slice(0, 5).map((s: any) => s.id),
        };
      });

      res.json(enriched);
    } catch (err: any) {
      console.error("Enriched relationships error:", err);
      res.status(500).json({ message: "Failed to fetch enriched relationships" });
    }
  });

  app.post('/api/mentoring-applications/:id/accept', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = (req.user as any).claims.sub;
      const application = await storage.getMentoringApplication(id);
      if (!application) return res.status(404).json({ message: "Application not found" });
      if (!await verifyContactOwnership(application.contactId, userId)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const existingRelationships = await storage.getMentoringRelationshipsByContact(application.contactId);
      const hasActive = existingRelationships.some(r => r.status === "active");
      if (hasActive) {
        return res.status(400).json({ message: "This person already has an active mentoring relationship" });
      }

      const updated = await storage.updateMentoringApplication(id, {
        status: "accepted",
        reviewedBy: userId,
        reviewedDate: new Date(),
        reviewNotes: req.body.reviewNotes || null,
      });

      const reqFocusAreas = req.body.focusAreas && typeof req.body.focusAreas === 'string' && req.body.focusAreas.trim() ? req.body.focusAreas.trim() : null;
      const reqFrequency = req.body.sessionFrequency && (SESSION_FREQUENCIES as readonly string[]).includes(req.body.sessionFrequency) ? req.body.sessionFrequency : "monthly";
      const reqStage = req.body.stage && (JOURNEY_STAGES as readonly string[]).includes(req.body.stage) ? req.body.stage : "kakano";

      const relationship = await storage.createMentoringRelationship({
        contactId: application.contactId,
        status: "active",
        startDate: new Date(),
        focusAreas: reqFocusAreas || application.whatNeedHelpWith || application.ventureDescription || null,
        sessionFrequency: reqFrequency,
      });

      try {
        await storage.updateContact(application.contactId, {
          isCommunityMember: true,
          stage: reqStage,
        });
      } catch (contactErr) {
        console.warn("Failed to update contact on acceptance:", contactErr);
      }

      res.json({ application: updated, relationship });
    } catch (err: any) {
      console.error("Accept application error:", err);
      res.status(500).json({ message: "Failed to accept application" });
    }
  });

  // === Mentor Availability API ===

  async function isMentorOwner(adminUserId: string, targetMentorUserId: string): Promise<boolean> {
    if (adminUserId === targetMentorUserId) return true;
    const profiles = await storage.getMentorProfiles(adminUserId);
    return profiles.some(p => p.mentorUserId === targetMentorUserId || `mentor-${p.id}` === targetMentorUserId);
  }

  app.get('/api/mentor-profiles', isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    let profiles = await storage.getMentorProfiles(userId);
    if (profiles.length === 0) {
      await storage.createMentorProfile({ userId, mentorUserId: userId, name: 'Ra Beazley', email: 'kiaora@reservetmk.co.nz', isActive: true, googleCalendarId: null });
      await storage.createMentorProfile({ userId, mentorUserId: null, name: 'Kim Beazley', email: 'kim@reservetmk.co.nz', isActive: true, googleCalendarId: null });
      profiles = await storage.getMentorProfiles(userId);
    }
    res.json(profiles);
  });

  app.post('/api/mentor-profiles', isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const { name, email, mentorUserId, isActive, googleCalendarId } = req.body;
    if (!name || typeof name !== 'string') return res.status(400).json({ message: "name is required" });
    const profile = await storage.createMentorProfile({
      userId,
      name: name.trim(),
      email: email || null,
      mentorUserId: mentorUserId || null,
      isActive: isActive !== undefined ? isActive : true,
      googleCalendarId: googleCalendarId || null,
    });
    res.status(201).json(profile);
  });

  app.patch('/api/mentor-profiles/:id', isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const userId = (req.user as any).claims.sub;
    const existing = await storage.getMentorProfile(id);
    if (!existing) return res.status(404).json({ message: "Mentor not found" });
    if (existing.userId !== userId) return res.status(403).json({ message: "Forbidden" });
    const { name, email, isActive, googleCalendarId } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (isActive !== undefined) updates.isActive = isActive;
    if (googleCalendarId !== undefined) updates.googleCalendarId = googleCalendarId;
    const updated = await storage.updateMentorProfile(id, updates);
    res.json(updated);
  });

  app.delete('/api/mentor-profiles/:id', isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const userId = (req.user as any).claims.sub;
    const existing = await storage.getMentorProfile(id);
    if (!existing) return res.status(404).json({ message: "Mentor not found" });
    if (existing.userId !== userId) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteMentorProfile(id);
    res.status(204).send();
  });

  app.get('/api/mentor-availability', isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const forMentor = req.query.mentorUserId as string | undefined;
    const category = req.query.category as string | undefined;
    if (forMentor) {
      const allowed = await isMentorOwner(userId, forMentor);
      if (!allowed) return res.status(403).json({ message: "Forbidden" });
      let slots = await storage.getMentorAvailability(forMentor);
      if (category) slots = slots.filter(s => s.category === category);
      return res.json(slots);
    }
    let slots = await storage.getMentorAvailability(userId);
    if (category) slots = slots.filter(s => s.category === category);
    res.json(slots);
  });

  app.post('/api/mentor-availability', isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const targetUserId = req.body.userId || userId;
    const allowed = await isMentorOwner(userId, targetUserId);
    if (!allowed) return res.status(403).json({ message: "Forbidden" });
    const slot = await storage.createMentorAvailability({ ...req.body, userId: targetUserId });
    res.status(201).json(slot);
  });

  app.patch('/api/mentor-availability/:id', isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const userId = (req.user as any).claims.sub;
    const existing = await storage.getMentorAvailabilityById(id);
    if (!existing) return res.status(404).json({ message: "Availability slot not found" });
    const allowed = await isMentorOwner(userId, existing.userId);
    if (!allowed) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.updateMentorAvailability(id, req.body);
    res.json(updated);
  });

  app.delete('/api/mentor-availability/:id', isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const userId = (req.user as any).claims.sub;
    const existing = await storage.getMentorAvailabilityById(id);
    if (!existing) return res.status(404).json({ message: "Availability slot not found" });
    const allowed = await isMentorOwner(userId, existing.userId);
    if (!allowed) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteMentorAvailability(id);
    res.status(204).send();
  });

  // === Meeting Types API ===

  app.get('/api/meeting-types', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const category = req.query.category as string | undefined;
      let types = await storage.getMeetingTypes(userId);
      if (types.length === 0) {
        const defaults = [
          { userId, name: 'Quick Chat', description: 'A brief check-in or introduction', duration: 15, focus: 'general', color: '#22c55e', isActive: true, sortOrder: 0, category: 'mentoring' },
          { userId, name: 'Standard Session', description: 'A regular mentoring session', duration: 30, focus: 'mentoring', color: '#3b82f6', isActive: true, sortOrder: 1, category: 'mentoring' },
          { userId, name: 'Deep Dive', description: 'An in-depth working session', duration: 60, focus: 'strategy', color: '#8b5cf6', isActive: true, sortOrder: 2, category: 'mentoring' },
        ];
        for (const d of defaults) {
          await storage.createMeetingType(d);
        }
        types = await storage.getMeetingTypes(userId);
      }
      if (category) {
        types = types.filter(t => t.category === category);
      }
      res.json(types);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch meeting types" });
    }
  });

  app.post('/api/meeting-types', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const input = insertMeetingTypeSchema.parse({ ...req.body, userId });
      const created = await storage.createMeetingType(input);
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Failed to create meeting type" });
    }
  });

  app.patch('/api/meeting-types/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = (req.user as any).claims.sub;
      const existing = await storage.getMeetingType(id);
      if (!existing) return res.status(404).json({ message: "Meeting type not found" });
      if (existing.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const updated = await storage.updateMeetingType(id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update meeting type" });
    }
  });

  app.delete('/api/meeting-types/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = (req.user as any).claims.sub;
      const existing = await storage.getMeetingType(id);
      if (!existing) return res.status(404).json({ message: "Meeting type not found" });
      if (existing.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteMeetingType(id);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete meeting type" });
    }
  });

  // === Public Booking API (no auth) ===

  app.get('/api/public/mentoring/:userId/meeting-types', async (req, res) => {
    try {
      const { userId } = req.params;
      const category = req.query.category as string | undefined;
      const resolved = await resolveMentorUserId(userId);
      const ownerUserId = resolved.ownerUserId || resolved.availabilityUserId;
      const types = await storage.getMeetingTypes(ownerUserId);
      let activeTypes = types.filter(t => t.isActive);
      if (category) {
        activeTypes = activeTypes.filter(t => t.category === category);
      }
      res.json(activeTypes.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        duration: t.duration,
        focus: t.focus,
        color: t.color,
        sortOrder: t.sortOrder,
        category: t.category,
      })));
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch meeting types" });
    }
  });

  app.get('/api/public/mentoring/:userId/availability', async (req, res) => {
    try {
      const { userId } = req.params;
      const category = req.query.category as string | undefined;
      const slots = await storage.getMentorAvailability(userId);
      let activeSlots = slots.filter(s => s.isActive);
      if (category) {
        activeSlots = activeSlots.filter(s => s.category === category);
      }
      res.json(activeSlots.map(s => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        slotDuration: s.slotDuration,
        bufferMinutes: s.bufferMinutes,
        category: s.category,
      })));
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch availability" });
    }
  });

  async function resolveMentorUserId(rawId: string): Promise<{ availabilityUserId: string; googleCalendarId: string | null; ownerUserId: string | null }> {
    if (rawId.startsWith('mentor-')) {
      const mentorId = parseInt(rawId.replace('mentor-', ''));
      const profile = await storage.getMentorProfile(mentorId);
      if (profile && profile.isActive) {
        return {
          availabilityUserId: profile.mentorUserId || `mentor-${profile.id}`,
          googleCalendarId: profile.googleCalendarId,
          ownerUserId: profile.userId,
        };
      }
    }
    const allProfiles = await db.select().from(mentorProfiles).where(and(eq(mentorProfiles.mentorUserId, rawId), eq(mentorProfiles.isActive, true)));
    const matchingProfile = allProfiles[0];
    return {
      availabilityUserId: rawId,
      googleCalendarId: matchingProfile?.googleCalendarId || null,
      ownerUserId: matchingProfile?.userId || rawId,
    };
  }

  app.get('/api/public/mentoring/:userId/slots', async (req, res) => {
    try {
      const { userId } = req.params;
      const { date, category } = req.query;
      if (!date || typeof date !== 'string') {
        return res.status(400).json({ message: "date query parameter required (YYYY-MM-DD)" });
      }

      const resolved = await resolveMentorUserId(userId);
      const availabilitySlots = await storage.getMentorAvailability(resolved.availabilityUserId);
      let activeSlots = availabilitySlots.filter(s => s.isActive);
      if (category && typeof category === 'string') {
        activeSlots = activeSlots.filter(s => s.category === category);
      }

      const targetDate = new Date(date + 'T00:00:00+13:00');
      const jsDay = targetDate.getDay();
      const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;

      const daySlots = activeSlots.filter(s => s.dayOfWeek === dayOfWeek);
      if (daySlots.length === 0) {
        return res.json({ date, slots: [] });
      }

      const existingMeetings = await storage.getMeetings(resolved.availabilityUserId);
      const dayStart = new Date(date + 'T00:00:00+13:00');
      const dayEnd = new Date(date + 'T23:59:59+13:00');
      const dayMeetings = existingMeetings.filter(m => {
        const mStart = new Date(m.startTime);
        return mStart >= dayStart && mStart <= dayEnd && m.status !== 'cancelled';
      });

      const freeSlots: { time: string; endTime: string }[] = [];

      for (const avail of daySlots) {
        const slotDur = avail.slotDuration || 30;
        const buffer = avail.bufferMinutes || 15;
        const [startH, startM] = avail.startTime.split(':').map(Number);
        const [endH, endM] = avail.endTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        for (let t = startMinutes; t + slotDur <= endMinutes; t += slotDur + buffer) {
          const slotStart = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
          const slotEndMin = t + slotDur;
          const slotEnd = `${String(Math.floor(slotEndMin / 60)).padStart(2, '0')}:${String(slotEndMin % 60).padStart(2, '0')}`;

          const conflict = dayMeetings.some(m => {
            const mStart = new Date(m.startTime);
            const mEnd = new Date(m.endTime);
            const mStartMin = mStart.getHours() * 60 + mStart.getMinutes();
            const mEndMin = mEnd.getHours() * 60 + mEnd.getMinutes();
            return t < mEndMin && slotEndMin > mStartMin;
          });

          if (!conflict) {
            freeSlots.push({ time: slotStart, endTime: slotEnd });
          }
        }

        if (avail.maxDailyBookings) {
          const existingCount = dayMeetings.filter(m => m.bookingSource === 'public_link').length;
          if (existingCount >= avail.maxDailyBookings) {
            return res.json({ date, slots: [] });
          }
        }
      }

      const now = new Date();
      let filteredSlots = freeSlots.filter(s => {
        const slotDate = new Date(date + 'T' + s.time + ':00+13:00');
        return slotDate > now;
      });

      try {
        const { getUncachableGoogleCalendarClient } = await import("./replit_integrations/google-calendar/client");
        const calendar = await getUncachableGoogleCalendarClient();

        const nzOffset = new Date(date + 'T12:00:00').toLocaleString('en-US', { timeZone: 'Pacific/Auckland', timeZoneName: 'shortOffset' });
        const offsetMatch = nzOffset.match(/GMT([+-]\d+)/);
        const tzSuffix = offsetMatch ? `${offsetMatch[1].padStart(3, '0').replace(/^(\+|-)(\d)$/, '$10$2')}:00` : '+13:00';
        const queryStart = new Date(date + 'T00:00:00' + tzSuffix);
        const queryEnd = new Date(date + 'T23:59:59' + tzSuffix);

        const calId = resolved.googleCalendarId || "primary";
        const freeBusyRes = await calendar.freebusy.query({
          requestBody: {
            timeMin: queryStart.toISOString(),
            timeMax: queryEnd.toISOString(),
            items: [{ id: calId }],
          },
        });
        const busyPeriods = freeBusyRes.data.calendars?.[calId]?.busy || [];
        if (busyPeriods.length > 0) {
          filteredSlots = filteredSlots.filter(s => {
            const slotStartUTC = new Date(date + 'T' + s.time + ':00' + tzSuffix);
            const slotEndUTC = new Date(date + 'T' + s.endTime + ':00' + tzSuffix);
            return !busyPeriods.some((bp: any) => {
              const bpStart = new Date(bp.start);
              const bpEnd = new Date(bp.end);
              return slotStartUTC < bpEnd && slotEndUTC > bpStart;
            });
          });
        }
      } catch (calErr: any) {
        console.warn("Google Calendar free/busy check skipped:", calErr.message);
      }

      res.json({ date, slots: filteredSlots });
    } catch (err) {
      console.error("Slots error:", err);
      res.status(500).json({ message: "Failed to fetch slots" });
    }
  });

  app.get('/api/public/mentoring/:userId/info', async (req, res) => {
    try {
      const { userId } = req.params;
      if (userId.startsWith('mentor-')) {
        const mentorId = parseInt(userId.replace('mentor-', ''));
        const profile = await storage.getMentorProfile(mentorId);
        if (!profile) return res.status(404).json({ message: "Not found" });
        const nameParts = profile.name.split(' ');
        return res.json({ firstName: nameParts[0], lastName: nameParts.slice(1).join(' ') || '', orgName: 'ReserveTMK' });
      }
      const { users } = await import("@shared/schema");
      const result = await db.select().from(users).where(eq(users.id, userId));
      if (result.length === 0) return res.status(404).json({ message: "Not found" });
      res.json({ firstName: result[0].firstName, lastName: result[0].lastName, orgName: 'ReserveTMK' });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch info" });
    }
  });

  app.post('/api/public/mentoring/:userId/book', async (req, res) => {
    try {
      const rawId = req.params.userId;
      const resolved = await resolveMentorUserId(rawId);
      const meetingUserId = resolved.availabilityUserId;
      const contactOwnerUserId = resolved.ownerUserId || resolved.availabilityUserId;
      const { name, email, phone, date, time, duration, focus, notes, meetingTypeId, pathway, onboardingAnswers, discoveryGoals } = req.body;

      if (!name || !date || !time) {
        return res.status(400).json({ message: "name, date, and time are required" });
      }

      const slotDuration = duration || 30;
      const startTime = new Date(date + 'T' + time + ':00+13:00');
      const endTime = new Date(startTime.getTime() + slotDuration * 60 * 1000);

      let contact;
      let isNewContact = false;
      if (email) {
        const allContacts = await storage.getContacts(contactOwnerUserId);
        contact = allContacts.find((c: any) => c.email && c.email.toLowerCase() === email.toLowerCase());
      }
      if (!contact) {
        isNewContact = true;
        contact = await storage.createContact({
          userId: contactOwnerUserId,
          name,
          email: email || null,
          phone: phone || null,
          role: 'Entrepreneur',
          active: true,
        });
      }

      const meetingType = (pathway === 'meeting') ? 'catchup' : 'mentoring';
      const meetingTitle = (pathway === 'meeting') ? `Meeting: ${name}` : `Mentoring: ${name}`;

      const meeting = await storage.createMeeting({
        userId: meetingUserId,
        contactId: contact.id,
        title: meetingTitle,
        description: focus || null,
        startTime,
        endTime,
        status: 'scheduled',
        location: null,
        type: meetingType,
        duration: slotDuration,
        bookingSource: 'public_link',
        notes: notes || null,
        mentoringFocus: focus || null,
        meetingTypeId: meetingTypeId ? parseInt(meetingTypeId) : undefined,
      });

      if (pathway === 'mentoring' && isNewContact) {
        try {
          const appData: any = {
            contactId: contact.id,
            status: 'pending',
          };
          if (onboardingAnswers) appData.onboardingAnswers = onboardingAnswers;
          if (discoveryGoals) {
            appData.ventureDescription = discoveryGoals.ventureDescription || null;
            appData.currentStage = discoveryGoals.currentStage || null;
            appData.whatNeedHelpWith = discoveryGoals.whatNeedHelpWith || null;
          }
          await storage.createMentoringApplication(appData);
        } catch (appErr) {
          console.warn("Failed to create mentoring application:", appErr);
        }
      }

      // Create Google Calendar event asynchronously
      (async () => {
        try {
          const mentorEmail = resolved.ownerUserId ? 
            (await storage.getMentorProfiles(resolved.ownerUserId))
              .find(p => p.mentorUserId === meetingUserId || `mentor-${p.id}` === meetingUserId)?.email : undefined;
          await createCalendarEventForMeeting(meeting, {
            mentorEmail: mentorEmail || undefined,
            menteeEmail: email || undefined,
            calendarId: resolved.googleCalendarId || undefined,
          });
        } catch (e) {
          console.warn("Calendar event creation failed silently:", e);
        }
      })();

      res.status(201).json({
        id: meeting.id,
        date,
        time,
        duration: slotDuration,
        focus: focus || null,
        status: meeting.status,
      });
    } catch (err) {
      console.error("Public booking error:", err);
      res.status(500).json({ message: "Failed to book session" });
    }
  });

  app.get('/api/public/mentoring/:userId/check-mentee', async (req, res) => {
    try {
      const { userId } = req.params;
      const email = req.query.email as string;
      const name = req.query.name as string;
      const resolved = await resolveMentorUserId(userId);
      const ownerUserId = resolved.ownerUserId || resolved.availabilityUserId;
      const allContacts = await storage.getContacts(ownerUserId);

      if (email) {
        const contact = allContacts.find((c: any) => c.email && c.email.toLowerCase() === email.toLowerCase());
        if (!contact) return res.json({ isReturning: false });
        const relationships = await storage.getMentoringRelationshipsByContact(contact.id);
        const hasActive = relationships.some((r: any) => r.status === 'active' || r.status === 'on_hold');
        return res.json({ isReturning: hasActive, contactName: contact.name, matchedByEmail: true });
      }

      if (name) {
        const nameLower = name.toLowerCase().trim();
        const nameMatches = allContacts.filter((c: any) => c.name && c.name.toLowerCase().trim() === nameLower);
        if (nameMatches.length === 0) return res.json({ isReturning: false, nameFound: false });
        for (const contact of nameMatches) {
          const relationships = await storage.getMentoringRelationshipsByContact(contact.id);
          const hasActive = relationships.some((r: any) => r.status === 'active' || r.status === 'on_hold');
          if (hasActive) {
            return res.json({ isReturning: true, contactName: contact.name, nameFound: true });
          }
        }
        return res.json({ isReturning: false, nameFound: true, contactName: nameMatches[0].name });
      }

      return res.status(400).json({ message: "email or name query parameter required" });
    } catch (err) {
      res.status(500).json({ message: "Failed to check mentee status" });
    }
  });

  app.get('/api/public/mentoring/:userId/onboarding-questions', async (req, res) => {
    try {
      const { userId } = req.params;
      const resolved = await resolveMentorUserId(userId);
      const ownerUserId = resolved.ownerUserId || resolved.availabilityUserId;
      const questions = await storage.getMentoringOnboardingQuestions(ownerUserId);
      const activeQuestions = questions.filter(q => q.isActive);
      res.json(activeQuestions.map(q => ({
        id: q.id,
        question: q.question,
        fieldType: q.fieldType,
        options: q.options,
        isRequired: q.isRequired,
        sortOrder: q.sortOrder,
      })));
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch onboarding questions" });
    }
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
      const { reason } = req.body;

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

      const prompt = `You are an impact analysis system for Reserve Tāmaki, a Māori and Pasifika entrepreneurship hub in Aotearoa New Zealand. Analyze the following debrief transcript and extract structured data for both community impact tracking and operational management.

IMPACT TAXONOMY (use these categories for tagging):
${taxonomyContext || `- Hub Engagement: Track facility usage and programme participation metrics
- Venture Progress: Capture venture development and economic outcomes across businesses, social enterprises, creative projects, and movements
- Skills & Capability Growth: Measure competency development and confidence building
- Network & Ecosystem Connection: Document relationship formation and ecosystem integration
- Rangatahi Development: Track youth-specific engagement and outcomes`}

SEMANTIC INDICATORS (phrases/meanings that map to categories):
Hub Engagement: registered as member, attended workshop, came to event, used coworking space, participated in programme, joined session, turned up to, booked in for, regular user, used recording studio, booked creative space, joined movement group
Venture Progress: made first sale, got customer, launched business, registered company, earned revenue, hired someone, secured contract, still trading, business growing, sustainable income, wholesale client, repeat customer, launched brand, first sponsorship, content going viral, secured partnership, built audience, social media growth, earned first income, grant received, movement growing
Skills & Capability Growth: learned how to, now understand, figured out how, gained confidence, feel capable, can now do, developed skill in, understand pricing, know how to market, improved at, making better decisions, ready to take next step, learned to create content, built website, designed brand, filmed first video, built portfolio, developed social media strategy
Network & Ecosystem Connection: met someone who, introduced to, connected with, found mentor, got referral to, partnered with, collaborated with, supported by, linked to, now working with, relationships with, found sponsor, connected with brand, partnered with collective
Rangatahi Development: young entrepreneur, rangatahi participated, youth attended, first business idea, school leaver, starting out, early career, young person, student entrepreneur, developing mindset, youth-led initiative, young creative, digital creator, rangatahi movement, first brand

KEYWORD DICTIONARY (additional user-configured phrase mappings):
${keywordContext || 'No additional keywords configured.'}

CLASSIFICATION LOGIC:
1. Multi-label output: Return ALL applicable categories for the transcript
2. Semantic matching: Match on meaning and context, not just literal keyword presence
3. Language handling: Support Te Reo Māori terms and New Zealand colloquialisms
4. Contextual interpretation examples:
   - "met first customer" → Venture Progress + Network & Ecosystem Connection
   - Confidence statements related to venture tasks → Skills & Capability Growth + Venture Progress
   - "launched their brand" → Venture Progress + Skills & Capability Growth
   - "got first sponsorship deal" → Venture Progress + Network & Ecosystem Connection
5. Priority ordering: Return categories ranked by relevance strength in source text

LANGUAGE NOTES:
- Handle te reo Māori: whānau (family), rangatahi (youth), mahi (work), kaupapa (purpose), kōrero (talk/discussion), hui (meeting), wānanga (workshop/learning), aroha (care/compassion), manaaki (hospitality/support), tautoko (support)
- NZ slang: sorted (arranged), keen as (very interested), sweet (confirmed), stoked (very happy), hard out (enthusiastically), all good (fine/ok), buzzing (excited), choice (great)

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
  "communityActions": [
    {
      "task": "follow-up or community action needed (introductions, resources to send, workshop registrations, mentoring bookings)",
      "contactMentioned": "name of person involved or null",
      "priority": "high" | "medium" | "low"
    }
  ],
  "operationalActions": [
    {
      "task": "internal hub task (processes to document, systems to build, admin tasks, marketing needs, financial matters)",
      "category": "process" | "admin" | "marketing" | "financial" | "capacity" | "partnership",
      "priority": "high" | "medium" | "low"
    }
  ],
  "reflections": {
    "wins": ["what worked well in programmes, events, or interactions"],
    "concerns": ["issues, risks, or problems identified"],
    "learnings": ["insights about approach, methods, or community needs"]
  },
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
    "bizConfidence": 1-10,
    "systemsInPlace": 1-10,
    "fundingReadiness": 1-10,
    "networkStrength": 1-10,
    "communityImpact": 1-10,
    "digitalPresence": 1-10
  }
}

Be precise. Only tag impact categories where there is clear evidence in the transcript. Set confidence scores honestly — lower if the evidence is ambiguous. For communityActions, focus on follow-ups with specific people. For operationalActions, focus on internal tasks for running the hub.`;

      const extraction = await claudeJSON({
        model: "claude-sonnet-4-6",
        prompt,
        temperature: 0.3,
      });

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

  app.get("/api/google-calendar/status", isAuthenticated, async (req, res) => {
    try {
      const { getUncachableGoogleCalendarClient } = await import("./replit_integrations/google-calendar/client");
      await getUncachableGoogleCalendarClient();
      res.json({ connected: true });
    } catch {
      res.json({ connected: false });
    }
  });

  app.post("/api/mentor-availability/quick-setup", isAuthenticated, async (req, res) => {
    try {
      const adminUserId = (req.user as any).claims.sub;
      const targetUserId = req.body.mentorUserId || adminUserId;
      const allowed = await isMentorOwner(adminUserId, targetUserId);
      if (!allowed) return res.status(403).json({ message: "Forbidden" });
      const category = req.body.category || "mentoring";
      const existing = await storage.getMentorAvailability(targetUserId);
      const categoryExisting = existing.filter(s => s.category === category);
      if (categoryExisting.length > 0) {
        return res.status(400).json({ message: "Availability already configured for this category" });
      }
      const startTime = req.body.startTime || "09:00";
      const endTime = req.body.endTime || "16:00";
      const defaults = [];
      for (let day = 0; day <= 4; day++) {
        const slot = await storage.createMentorAvailability({
          userId: targetUserId,
          dayOfWeek: day,
          startTime,
          endTime,
          slotDuration: 60,
          bufferMinutes: 0,
          isActive: true,
          category,
        });
        defaults.push(slot);
      }
      res.json(defaults);
    } catch (err: any) {
      console.error("Quick setup error:", err);
      res.status(500).json({ message: "Failed to set up availability" });
    }
  });

  app.post("/api/mentor-availability/quick-setup-all", isAuthenticated, async (req, res) => {
    try {
      const adminUserId = (req.user as any).claims.sub;
      const profiles = await storage.getMentorProfiles(adminUserId);
      if (profiles.length === 0) {
        return res.status(400).json({ message: "No mentor profiles found" });
      }

      const category = req.body.category || "mentoring";
      const startTime = req.body.startTime || "09:00";
      const endTime = req.body.endTime || "16:00";
      let setupCount = 0;
      for (const profile of profiles) {
        const mentorId = profile.mentorUserId || `mentor-${profile.id}`;
        const existing = await storage.getMentorAvailability(mentorId);
        const categoryExisting = existing.filter(s => s.category === category);
        if (categoryExisting.length > 0) continue;
        for (let day = 0; day <= 4; day++) {
          await storage.createMentorAvailability({
            userId: mentorId,
            dayOfWeek: day,
            startTime,
            endTime,
            slotDuration: 60,
            bufferMinutes: 0,
            isActive: true,
            category,
          });
        }
        setupCount++;
      }
      res.json({ message: `Availability set for ${setupCount} mentor(s) \u2014 Mon\u2013Fri, 9am\u20134pm`, setupCount });
    } catch (err: any) {
      console.error("Quick setup all error:", err);
      res.status(500).json({ message: "Failed to set up availability for all mentors" });
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

      const occupiedIntervals: { start: number; end: number }[] = [];
      for (const b of allBookings) {
        if (excludeBookingId && b.id === parseInt(excludeBookingId as string)) continue;
        if (b.status === "cancelled") continue;
        if (b.venueId !== parseInt(venueId as string)) continue;
        if (!datesOverlap(startDate as string, startDate as string, b.startDate, b.endDate || b.startDate)) continue;
        if (b.startTime && b.endTime) {
          occupiedIntervals.push({ start: parseTimeToMinutes(b.startTime), end: parseTimeToMinutes(b.endTime) });
        }
      }
      for (const p of programmes) {
        if (p.status === "cancelled") continue;
        if (!datesOverlap(startDate as string, startDate as string, p.startDate, p.endDate || p.startDate)) continue;
        if (p.startTime && p.endTime) {
          occupiedIntervals.push({ start: parseTimeToMinutes(p.startTime), end: parseTimeToMinutes(p.endTime) });
        }
      }

      occupiedIntervals.sort((a, b) => a.start - b.start);

      const dayStart = parseTimeToMinutes("08:00");
      const dayEnd = parseTimeToMinutes("17:00");
      const availableSlots: { startTime: string; endTime: string }[] = [];
      let cursor = dayStart;
      for (const interval of occupiedIntervals) {
        if (interval.start < dayStart) {
          cursor = Math.max(cursor, interval.end);
          continue;
        }
        if (interval.start > dayEnd) break;
        if (interval.start > cursor) {
          const slotEnd = Math.min(interval.start, dayEnd);
          if (slotEnd > cursor) {
            const sh = Math.floor(cursor / 60).toString().padStart(2, "0");
            const sm = (cursor % 60).toString().padStart(2, "0");
            const eh = Math.floor(slotEnd / 60).toString().padStart(2, "0");
            const em = (slotEnd % 60).toString().padStart(2, "0");
            availableSlots.push({ startTime: `${sh}:${sm}`, endTime: `${eh}:${em}` });
          }
        }
        cursor = Math.max(cursor, interval.end);
      }
      if (cursor < dayEnd) {
        const sh = Math.floor(cursor / 60).toString().padStart(2, "0");
        const sm = (cursor % 60).toString().padStart(2, "0");
        const eh = Math.floor(dayEnd / 60).toString().padStart(2, "0");
        const em = (dayEnd % 60).toString().padStart(2, "0");
        availableSlots.push({ startTime: `${sh}:${sm}`, endTime: `${eh}:${em}` });
      }

      res.json({ conflicts, availableSlots });
    } catch (err) {
      throw err;
    }
  });

  app.post(api.bookings.create.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const conflictOverride = req.body.conflictOverride === true;
      const body = coerceDateFields({ ...req.body, userId });
      delete body.conflictOverride;
      const input = api.bookings.create.input.parse(body);

      if (input.startDate && input.venueId && !conflictOverride) {
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

  // === Venue Instructions API ===
  app.get("/api/venue-instructions", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const instructions = await storage.getVenueInstructions(userId);
    res.json(instructions);
  });

  app.post("/api/venue-instructions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const data = insertVenueInstructionSchema.parse({ ...req.body, userId });
      const instruction = await storage.createVenueInstruction(data);
      res.json(instruction);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/venue-instructions/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseInt(req.params.id);
      const existing = await storage.getVenueInstructions(userId);
      if (!existing.find(i => i.id === id)) return res.status(403).json({ message: "Forbidden" });
      const instruction = await storage.updateVenueInstruction(id, req.body);
      res.json(instruction);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/venue-instructions/:id", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const id = parseInt(req.params.id);
    const existing = await storage.getVenueInstructions(userId);
    if (!existing.find(i => i.id === id)) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteVenueInstruction(id);
    res.json({ success: true });
  });

  // === Regular Bookers API ===
  app.get("/api/regular-bookers", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const bookers = await storage.getRegularBookers(userId);
    res.json(bookers);
  });

  app.get("/api/regular-bookers/:id", isAuthenticated, async (req, res) => {
    const booker = await storage.getRegularBooker(parseInt(req.params.id));
    if (!booker) return res.status(404).json({ message: "Regular booker not found" });
    res.json(booker);
  });

  app.get("/api/regular-bookers/by-contact/:contactId", isAuthenticated, async (req, res) => {
    const booker = await storage.getRegularBookerByContactId(parseInt(req.params.contactId));
    res.json(booker || null);
  });

  app.post("/api/regular-bookers", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const data = insertRegularBookerSchema.parse({ ...req.body, userId });
      const booker = await storage.createRegularBooker(data);
      res.json(booker);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/regular-bookers/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseInt(req.params.id);
      const existing = await storage.getRegularBooker(id);
      if (!existing || existing.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const { userId: _, ...updates } = req.body;
      const booker = await storage.updateRegularBooker(id, updates);
      res.json(booker);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/regular-bookers/:id", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const id = parseInt(req.params.id);
    const existing = await storage.getRegularBooker(id);
    if (!existing || existing.userId !== userId) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteRegularBooker(id);
    res.json({ success: true });
  });

  app.get("/api/regular-bookers/:id/links", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseInt(req.params.id);
      const booker = await storage.getRegularBooker(id);
      if (!booker || booker.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const links = await storage.getBookerLinks(id);
      const baseUrl = process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPL_SLUG
        ? `https://${process.env.REPL_SLUG}.replit.app`
        : "https://app.reservetmk.co.nz";
      const linksWithUrls = links.map(l => ({ ...l, portalUrl: `${baseUrl}/booker/portal/${l.token}` }));
      res.json(linksWithUrls);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/regular-bookers/:id/links", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseInt(req.params.id);
      const booker = await storage.getRegularBooker(id);
      if (!booker || booker.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const token = crypto.randomUUID();
      const label = req.body.label || "Portal link";
      const link = await storage.createBookerLink({
        regularBookerId: id,
        token,
        enabled: true,
        label,
      });

      const baseUrl = process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPL_SLUG
        ? `https://${process.env.REPL_SLUG}.replit.app`
        : "https://app.reservetmk.co.nz";
      const portalUrl = `${baseUrl}/booker/portal/${token}`;

      res.json({ ...link, portalUrl });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/booker-links/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseInt(req.params.id);
      const links = await db.select().from(bookerLinks).where(eq(bookerLinks.id, id));
      if (!links.length) return res.status(404).json({ message: "Link not found" });
      const booker = await storage.getRegularBooker(links[0].regularBookerId);
      if (!booker || booker.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteBookerLink(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === Booking Workflow Actions ===
  const DEFAULT_SURVEY_QUESTIONS = [
    { id: 1, type: "rating", question: "How would you rate your overall experience?", scale: 5, required: true },
    { id: 2, type: "rating", question: "How clean and well-maintained was the space?", scale: 5, required: true },
    { id: 3, type: "yes_no", question: "Did you have everything you needed?", required: true },
    { id: 4, type: "text", question: "What could we improve?", required: false },
    { id: 5, type: "yes_no", question: "Would you book with us again?", required: true },
    { id: 6, type: "text", question: "Any other feedback?", required: false },
    { id: 7, type: "testimonial", question: "Would you like to share a testimonial? (optional)", required: false, consent: true, subtext: "By submitting, you give us permission to share publicly." },
  ];

  app.post("/api/bookings/:id/accept", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      let afterHoursFlag = false;
      try {
        const opHours = await storage.getOperatingHours(userId);
        const hours = opHours.length > 0 ? opHours : await storage.seedDefaultOperatingHours(userId);
        const bookingDate = booking.startDate ? new Date(booking.startDate) : new Date();
        const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        const dayName = dayNames[bookingDate.getDay()];
        const dayConfig = hours.find(h => h.dayOfWeek === dayName);
        if (dayConfig) {
          if (!dayConfig.isStaffed) {
            afterHoursFlag = true;
          } else if (booking.startTime && dayConfig.openTime && dayConfig.closeTime) {
            const startMins = parseTimeToMinutes(booking.startTime);
            const endMins = booking.endTime ? parseTimeToMinutes(booking.endTime) : startMins;
            const openMins = parseTimeToMinutes(dayConfig.openTime);
            const closeMins = parseTimeToMinutes(dayConfig.closeTime);
            if (startMins < openMins || startMins >= closeMins || endMins > closeMins) {
              afterHoursFlag = true;
            }
          }
        }
      } catch (e) {
        console.error("Failed to check after-hours:", e);
      }

      const updated = await storage.updateBooking(bookingId, {
        status: "confirmed",
        confirmedBy: booking.bookerId || undefined,
        confirmedAt: new Date(),
        isAfterHours: afterHoursFlag,
      } as any);

      if (booking.bookerId) {
        const regularBooker = await storage.getRegularBookerByContactId(booking.bookerId);
        if (regularBooker && regularBooker.hasBookingPackage && booking.usePackageCredit) {
          await storage.updateRegularBooker(regularBooker.id, {
            packageUsedBookings: (regularBooker.packageUsedBookings || 0) + 1,
          } as any);
        }
      }

      let emailSent = false;
      try {
        const { sendBookingConfirmationEmail } = await import("./email");
        await sendBookingConfirmationEmail(booking, userId);
        await storage.updateBooking(bookingId, {
          confirmationSent: true,
          instructionsSent: true,
        } as any);
        emailSent = true;
      } catch (emailErr: any) {
        console.error("Failed to send confirmation email:", emailErr.message);
      }

      let invoiceGenerated = false;
      let invoiceNumber = "";
      try {
        const xeroSettings = await storage.getXeroSettings(userId);
        if (xeroSettings?.connected) {
          const { generateXeroInvoice } = await import("./xero");
          const invoiceResult = await generateXeroInvoice(userId, bookingId);
          if (invoiceResult) {
            invoiceGenerated = true;
            invoiceNumber = invoiceResult.invoiceNumber;
          }
        }
      } catch (invoiceErr: any) {
        console.error("Auto-invoice generation failed:", invoiceErr.message);
      }

      res.json({ success: true, booking: updated, emailSent, isAfterHours: afterHoursFlag, invoiceGenerated, invoiceNumber });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/bookings/:id/decline", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const bookingId = parseInt(req.params.id);
      const { reason } = req.body;
      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const updated = await storage.updateBooking(bookingId, {
        status: "cancelled",
        notes: booking.notes ? `${booking.notes}\n\nDeclined: ${reason || "No reason given"}` : `Declined: ${reason || "No reason given"}`,
      } as any);

      res.json({ success: true, booking: updated });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/bookings/:id/complete", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      await storage.updateBooking(bookingId, {
        status: "completed",
        completedBy: booking.bookerId || undefined,
        completedAt: new Date(),
      } as any);

      let shouldSendSurvey = false;
      let surveyCreated = false;
      let isOneOff = true;
      let isFirstBooking = true;

      if (booking.bookerId) {
        const regularBooker = await storage.getRegularBookerByContactId(booking.bookerId);
        isOneOff = !regularBooker || regularBooker.accountStatus !== "active";

        const allBookings = await storage.getBookings(userId);
        const previousCompleted = allBookings.filter(
          b => b.bookerId === booking.bookerId && b.status === "completed" && b.id !== bookingId
        );
        isFirstBooking = previousCompleted.length === 0;
      }

      shouldSendSurvey = isOneOff || isFirstBooking;

      if (shouldSendSurvey && booking.bookerId) {
        const contact = await storage.getContact(booking.bookerId);
        if (contact?.email) {
          const surveyToken = crypto.randomUUID();
          const survey = await storage.createSurvey({
            userId,
            surveyType: "post_booking",
            relatedId: bookingId,
            contactId: booking.bookerId,
            questions: DEFAULT_SURVEY_QUESTIONS,
            status: "pending",
            manuallyTriggered: false,
            surveyToken,
          });

          try {
            const { sendSurveyEmail } = await import("./email");
            await sendSurveyEmail(contact.email, contact.name || contact.email, booking.startDate, surveyToken);
            await storage.updateSurvey(survey.id, { status: "sent", sentAt: new Date() } as any);
            await storage.updateBooking(bookingId, { postSurveySent: true, isFirstBooking } as any);
            surveyCreated = true;
          } catch (emailErr: any) {
            console.error("Failed to send survey email:", emailErr.message);
            surveyCreated = true;
          }
        }
      }

      res.json({
        success: true,
        surveyDecision: shouldSendSurvey
          ? surveyCreated ? "Survey sent" : "Survey created but email failed"
          : "Survey skipped (regular booker, not first booking)",
        isOneOff,
        isFirstBooking,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/bookings/:id/resend-confirmation", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const { sendBookingConfirmationEmail } = await import("./email");
      await sendBookingConfirmationEmail(booking, userId);
      await storage.updateBooking(bookingId, { confirmationSent: true, instructionsSent: true } as any);

      res.json({ success: true, message: "Confirmation email resent" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // === Surveys API ===
  app.get("/api/surveys", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const surveyList = await storage.getSurveys(userId);
    res.json(surveyList);
  });

  app.get("/api/bookings/:id/survey", isAuthenticated, async (req, res) => {
    const survey = await storage.getSurveyByBookingId(parseInt(req.params.id));
    res.json(survey || null);
  });

  app.post("/api/bookings/:id/send-survey", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      if (!booking.bookerId) return res.status(400).json({ message: "Booking has no booker contact" });

      const contact = await storage.getContact(booking.bookerId);
      if (!contact?.email) return res.status(400).json({ message: "Contact has no email" });

      const existingSurvey = await storage.getSurveyByBookingId(bookingId);
      if (existingSurvey) {
        return res.status(400).json({ message: "Survey already exists for this booking" });
      }

      const surveyToken = crypto.randomUUID();
      const survey = await storage.createSurvey({
        userId,
        surveyType: "post_booking",
        relatedId: bookingId,
        contactId: booking.bookerId,
        questions: DEFAULT_SURVEY_QUESTIONS,
        status: "pending",
        manuallyTriggered: true,
        triggeredBy: booking.bookerId,
        surveyToken,
      });

      try {
        const { sendSurveyEmail } = await import("./email");
        await sendSurveyEmail(contact.email, contact.name || contact.email, booking.startDate, surveyToken);
        await storage.updateSurvey(survey.id, { status: "sent", sentAt: new Date() } as any);
        await storage.updateBooking(bookingId, { postSurveySent: true } as any);
      } catch (emailErr: any) {
        console.error("Failed to send survey email:", emailErr.message);
      }

      res.json({ success: true, survey });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // === Public Survey Routes (no auth) ===
  app.get("/api/public/survey/:token", async (req, res) => {
    try {
      const survey = await storage.getSurveyByToken(req.params.token);
      if (!survey) return res.status(404).json({ message: "Survey not found" });
      if (survey.status === "completed") return res.json({ ...survey, alreadyCompleted: true });
      if (survey.status === "expired") return res.status(410).json({ message: "Survey has expired" });
      res.json(survey);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/public/survey/:token/submit", async (req, res) => {
    try {
      const survey = await storage.getSurveyByToken(req.params.token);
      if (!survey) return res.status(404).json({ message: "Survey not found" });
      if (survey.status === "completed") return res.status(400).json({ message: "Survey already completed" });

      const { responses } = req.body;
      if (!responses || !Array.isArray(responses)) {
        return res.status(400).json({ message: "Responses are required" });
      }

      const updated = await storage.updateSurvey(survey.id, {
        responses,
        status: "completed",
        completedAt: new Date(),
      } as any);

      res.json({ success: true, message: "Thank you for your feedback!" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // === Groups API ===
  app.get(api.groups.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const groupsList = await storage.getGroups(userId);
    res.json(groupsList);
  });

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

  app.get("/api/groups/suggested-duplicates", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const allGroups = await storage.getGroups(userId);
      const dismissed = await db.select().from(dismissedDuplicates).where(and(eq(dismissedDuplicates.userId, userId), eq(dismissedDuplicates.entityType, "group")));
      const dismissedSet = new Set(dismissed.map(d => `${Math.min(d.entityId1, d.entityId2)}-${Math.max(d.entityId1, d.entityId2)}`));

      function normalize(s: string | null | undefined): string {
        return (s || "").toLowerCase().trim().replace(/\s+/g, " ");
      }
      function similarity(a: string, b: string): number {
        if (a === b) return 1;
        if (!a || !b) return 0;
        const longer = a.length > b.length ? a : b;
        const shorter = a.length > b.length ? b : a;
        if (longer.length === 0) return 1;
        const costs: number[] = [];
        for (let i = 0; i <= longer.length; i++) {
          let lastVal = i;
          for (let j = 0; j <= shorter.length; j++) {
            if (i === 0) { costs[j] = j; }
            else if (j > 0) {
              let newVal = costs[j - 1];
              if (longer[i - 1] !== shorter[j - 1]) newVal = Math.min(Math.min(newVal, lastVal), costs[j]) + 1;
              costs[j - 1] = lastVal;
              lastVal = newVal;
            }
          }
          if (i > 0) costs[shorter.length] = lastVal;
        }
        return (longer.length - costs[shorter.length]) / longer.length;
      }

      const clusters: { reason: string; groups: any[] }[] = [];
      const seen = new Set<string>();

      for (let i = 0; i < allGroups.length; i++) {
        for (let j = i + 1; j < allGroups.length; j++) {
          const a = allGroups[i];
          const b = allGroups[j];
          const pairKey = `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`;
          if (dismissedSet.has(pairKey) || seen.has(pairKey)) continue;

          let reason = "";
          const na = normalize(a.name);
          const nb = normalize(b.name);
          if (na && nb && na === nb) {
            reason = "Same name";
          } else if (na && nb && similarity(na, nb) >= 0.8) {
            reason = "Similar names";
          } else if (a.contactEmail && b.contactEmail && normalize(a.contactEmail) === normalize(b.contactEmail)) {
            reason = "Same email";
          }

          if (reason) {
            seen.add(pairKey);
            clusters.push({ reason, groups: [a, b] });
          }
        }
      }

      res.json(clusters);
    } catch (err: any) {
      console.error("Group duplicates error:", err);
      res.status(500).json({ message: "Failed to find group duplicates" });
    }
  });

  app.post("/api/groups/dismiss-duplicate", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { id1, id2 } = req.body;
      if (!id1 || !id2) return res.status(400).json({ message: "id1 and id2 required" });
      await db.insert(dismissedDuplicates).values({
        userId,
        entityType: "group",
        entityId1: Math.min(id1, id2),
        entityId2: Math.max(id1, id2),
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to dismiss duplicate" });
    }
  });

  app.get(api.groups.get.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid group ID" });
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

If the organisation has no clear social outcome or community impact, match them to "Venture Progress" as we are simply supporting their economic development/growth.

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
- Every organisation should have at least one kaupapa match — if nothing else fits, use "Venture Progress"`;

      const raw = await claudeJSON({
        model: "claude-haiku-4-5",
        prompt,
        temperature: 0.3,
      });
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
        const fallback = activeCategories.find((c: any) => c.name === "Venture Progress" || c.name === "Business Progress");
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

  app.get("/api/reports/date-range", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const legacyReports = await storage.getLegacyReports(userId);
      const confirmed = legacyReports.filter(r => r.status === "confirmed");
      const liveEvents = await storage.getEvents(userId);
      const liveLogs = await storage.getImpactLogs(userId);

      const dates: Date[] = [];
      for (const r of confirmed) {
        dates.push(new Date(r.periodStart));
      }
      for (const e of liveEvents) {
        if (e.startTime) dates.push(new Date(e.startTime));
      }
      for (const l of liveLogs) {
        if (l.createdAt) dates.push(new Date(l.createdAt));
      }

      if (dates.length === 0) {
        return res.json({ earliestDate: null, latestDate: null });
      }

      dates.sort((a, b) => a.getTime() - b.getTime());
      res.json({
        earliestDate: dates[0].toISOString(),
        latestDate: dates[dates.length - 1].toISOString(),
      });
    } catch (err: any) {
      console.error("Date range error:", err);
      res.status(500).json({ message: "Failed to fetch date range" });
    }
  });

  app.post("/api/reports/generate", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { startDate, endDate, programmeIds, taxonomyIds, demographicSegments, funder, communityLens } = req.body;

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
        communityLens,
      };

      const cacheKey = getReportCacheKey("generate", { userId, startDate, endDate, programmeIds, taxonomyIds, demographicSegments, funder, communityLens });

      const result = await deduplicatedReportCall(cacheKey, async () => {
        const report = await getFullMonthlyReport(filters);

        let legacyMetrics = null;
        let isBlended = false;
        let boundaryDateStr: string | null = null;
        let legacyReportCount = 0;
        let legacyPeriods: string[] = [];
        let legacyHighlights: string[] = [];

        try {
          const settings = await storage.getReportingSettings(userId);
          const boundaryDate = settings?.boundaryDate;
          const reportStart = new Date(startDate);

          const allLegacy = await storage.getLegacyReports(userId);
          const confirmed = allLegacy.filter(r => r.status === "confirmed");
          const reqStart = new Date(startDate);
          const reqEnd = new Date(endDate);

          const overlapping = confirmed.filter(r => {
            const ps = new Date(r.periodStart);
            const pe = new Date(r.periodEnd);
            if (boundaryDate) {
              return ps <= reqEnd && pe >= reqStart && pe <= boundaryDate;
            }
            return ps <= reqEnd && pe >= reqStart;
          });

          if (overlapping.length > 0) {
            const totals = {
              activationsTotal: 0,
              activationsWorkshops: 0,
              activationsMentoring: 0,
              activationsEvents: 0,
              activationsPartnerMeetings: 0,
              foottrafficUnique: 0,
              bookingsTotal: 0,
            };

            for (const lr of overlapping) {
              const snapshot = await storage.getLegacyReportSnapshot(lr.id);
              if (snapshot) {
                totals.activationsTotal += snapshot.activationsTotal || 0;
                totals.activationsWorkshops += snapshot.activationsWorkshops || 0;
                totals.activationsMentoring += snapshot.activationsMentoring || 0;
                totals.activationsEvents += snapshot.activationsEvents || 0;
                totals.activationsPartnerMeetings += snapshot.activationsPartnerMeetings || 0;
                totals.foottrafficUnique += snapshot.foottrafficUnique || 0;
                totals.bookingsTotal += snapshot.bookingsTotal || 0;
              }
              legacyPeriods.push(lr.quarterLabel);

              try {
                const extraction = await storage.getLegacyReportExtraction(lr.id);
                if (extraction?.extractedHighlights) {
                  const highlights = extraction.extractedHighlights as any[];
                  for (const h of highlights) {
                    if (typeof h === "string" && h.trim()) legacyHighlights.push(h);
                    else if (h?.text) legacyHighlights.push(h.text);
                  }
                }
              } catch {}
            }

            legacyMetrics = totals;
            isBlended = true;
            boundaryDateStr = boundaryDate?.toISOString() || null;
            legacyReportCount = overlapping.length;
          }
        } catch (blendErr) {
          console.error("Legacy blend error (non-fatal):", blendErr);
        }

        return {
          ...report,
          isBlended,
          boundaryDate: boundaryDateStr,
          legacyReportCount,
          legacyPeriods,
          legacyMetrics,
          legacyHighlights: legacyHighlights.slice(0, 20),
        };
      });

      res.json(result);
    } catch (err: any) {
      console.error("Report generation error:", err);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  app.post("/api/reports/narrative", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { startDate, endDate, programmeIds, taxonomyIds, demographicSegments, funder, communityLens, narrativeStyle } = req.body;

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
        communityLens,
      };

      const style: "compliance" | "story" = narrativeStyle === "story" ? "story" : "compliance";

      let legacyContext: { metrics: any; highlights: string[]; reportCount: number } | null = null;
      try {
        const settings = await storage.getReportingSettings(userId);
        const boundaryDate = settings?.boundaryDate;
        const allLegacy = await storage.getLegacyReports(userId);
        const confirmed = allLegacy.filter(r => r.status === "confirmed");
        const reqStart = new Date(startDate);
        const reqEnd = new Date(endDate);

        const overlapping = confirmed.filter(r => {
          const ps = new Date(r.periodStart);
          const pe = new Date(r.periodEnd);
          if (boundaryDate) return ps <= reqEnd && pe >= reqStart && pe <= boundaryDate;
          return ps <= reqEnd && pe >= reqStart;
        });

        if (overlapping.length > 0) {
          const totals = {
            activationsTotal: 0, activationsWorkshops: 0, activationsMentoring: 0,
            activationsEvents: 0, activationsPartnerMeetings: 0,
            foottrafficUnique: 0, bookingsTotal: 0,
          };
          const highlights: string[] = [];

          for (const lr of overlapping) {
            const snapshot = await storage.getLegacyReportSnapshot(lr.id);
            if (snapshot) {
              totals.activationsTotal += snapshot.activationsTotal || 0;
              totals.activationsWorkshops += snapshot.activationsWorkshops || 0;
              totals.activationsMentoring += snapshot.activationsMentoring || 0;
              totals.activationsEvents += snapshot.activationsEvents || 0;
              totals.activationsPartnerMeetings += snapshot.activationsPartnerMeetings || 0;
              totals.foottrafficUnique += snapshot.foottrafficUnique || 0;
              totals.bookingsTotal += snapshot.bookingsTotal || 0;
            }
            try {
              const extraction = await storage.getLegacyReportExtraction(lr.id);
              if (extraction?.extractedHighlights) {
                const hl = extraction.extractedHighlights as any[];
                for (const h of hl) {
                  if (typeof h === "string" && h.trim()) highlights.push(h);
                  else if (h?.text) highlights.push(h.text);
                }
              }
            } catch {}
          }

          legacyContext = { metrics: totals, highlights: highlights.slice(0, 10), reportCount: overlapping.length };
        }
      } catch {}

      const result = await generateNarrative(filters, legacyContext, style);
      res.json(result);
    } catch (err: any) {
      console.error("Narrative generation error:", err);
      res.status(500).json({ message: "Failed to generate narrative" });
    }
  });

  app.post("/api/reports/community-comparison", isAuthenticated, async (req, res) => {
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

      const cacheKey = getReportCacheKey("comparison", { userId, startDate, endDate, programmeIds, taxonomyIds, demographicSegments, funder });
      const comparison = await deduplicatedReportCall(cacheKey, () => getCommunityComparison(filters));
      res.json(comparison);
    } catch (err: any) {
      console.error("Community comparison error:", err);
      res.status(500).json({ message: "Failed to generate community comparison" });
    }
  });

  app.post("/api/reports/tamaki-ora", isAuthenticated, async (req, res) => {
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
        communityLens: "maori",
      };

      const cacheKey = getReportCacheKey("tamaki-ora", { userId, startDate, endDate, programmeIds, taxonomyIds, demographicSegments, funder });
      const alignment = await deduplicatedReportCall(cacheKey, () => getTamakiOraAlignment(filters));
      res.json(alignment);
    } catch (err: any) {
      console.error("Tamaki Ora alignment error:", err);
      res.status(500).json({ message: "Failed to generate Tāmaki Ora alignment" });
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
          let parsed: any;
          try {
            parsed = await claudeJSON({
              model: "claude-haiku-4-5",
              prompt,
              temperature: 0.2,
            });
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
                  type: org.type === "community_group" ? "Community Initiative" :
                        org.type === "community_collective" ? "Community Initiative" :
                        org.type === "business" ? "Business" :
                        org.type === "partner" ? "Partner Organization" :
                        org.type === "government" ? "Partner Organization" :
                        org.type === "ngo" ? "Social Enterprise" :
                        org.type === "education" ? "Other" :
                        org.type === "funder" ? "Funder" : "Business",
                  organizationTypeOther: org.type === "education" ? "Education" : (org.type === "resident_company" ? "Resident Company" : (org.type === "iwi" ? "Iwi" : null)),
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
                  role: person.role || "Supporter",
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
                type: org.type === "community_group" ? "Community Initiative" :
                      org.type === "community_collective" ? "Community Initiative" :
                      org.type === "business" ? "Business" :
                      org.type === "partner" ? "Partner Organization" :
                      org.type === "government" ? "Partner Organization" :
                      org.type === "ngo" ? "Social Enterprise" :
                      org.type === "education" ? "Other" :
                      org.type === "funder" ? "Funder" : "Business",
                organizationTypeOther: org.type === "education" ? "Education" : (org.type === "resident_company" ? "Resident Company" : (org.type === "iwi" ? "Iwi" : null)),
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
                role: person.role || "Supporter",
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

      let result: any;
      try {
        result = await claudeJSON({
          model: "claude-haiku-4-5",
          prompt,
          temperature: 0.3,
        });
      } catch {
        result = { suggestions: [] };
      }
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
        foottrafficUnique: number;
        bookingsTotal: number;
        source: "legacy" | "live";
      }> = [];

      for (const { report, snapshot } of snapshots) {
        if (snapshot) {
          quarterlyData.push({
            label: report.quarterLabel,
            periodStart: report.periodStart,
            periodEnd: report.periodEnd,
            activationsTotal: snapshot.activationsTotal || 0,
            foottrafficUnique: snapshot.foottrafficUnique || 0,
            bookingsTotal: snapshot.bookingsTotal || 0,
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

        const liveBookings = await storage.getBookings(userId);
        const liveBookingsInRange = liveBookings.filter(b => {
          const d = new Date(b.startDate);
          return d >= currentStart && d <= currentEnd;
        });

        const liveContacts = await db
          .selectDistinct({ contactId: impactLogContacts.contactId })
          .from(impactLogContacts)
          .innerJoin(impactLogs, eq(impactLogContacts.impactLogId, impactLogs.id))
          .where(and(
            eq(impactLogs.userId, userId),
            eq(impactLogs.status, "confirmed"),
            gte(impactLogs.createdAt, currentStart),
            lte(impactLogs.createdAt, currentEnd),
          ));

        quarterlyData.push({
          label: "Current Period",
          periodStart: currentStart,
          periodEnd: currentEnd,
          activationsTotal: liveInRange.length,
          foottrafficUnique: liveContacts.length,
          bookingsTotal: liveBookingsInRange.length,
          source: "live",
        });
      }

      quarterlyData.sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());

      function computeMetricBenchmarks(values: number[], labels: string[]) {
        const nonZero = values.filter(v => v > 0);
        const avg = nonZero.length > 0 ? Math.round(nonZero.reduce((s, v) => s + v, 0) / nonZero.length) : 0;
        const max = Math.max(...values, 0);
        const maxIdx = values.indexOf(max);
        const currentVal = values[values.length - 1] || 0;
        const prevVal = values.length > 1 ? values[values.length - 2] : null;
        const pop = prevVal && prevVal > 0 ? Math.round(((currentVal - prevVal) / prevVal) * 100) : null;
        const rank = nonZero.length > 0 ? [...nonZero].sort((a, b) => b - a).indexOf(currentVal) + 1 : null;
        const pctVsAvg = avg > 0 ? Math.round(((currentVal - avg) / avg) * 100) : null;
        return {
          historicAverage: avg,
          highestPeriod: maxIdx >= 0 ? labels[maxIdx] : null,
          highestValue: max,
          currentRank: rank,
          totalPeriods: values.length,
          popChange: pop,
          pctVsAverage: pctVsAvg,
        };
      }

      const labels = quarterlyData.map(q => q.label);
      const activationsBenchmarks = computeMetricBenchmarks(quarterlyData.map(q => q.activationsTotal), labels);
      const foottrafficBenchmarks = computeMetricBenchmarks(quarterlyData.map(q => q.foottrafficUnique), labels);
      const bookingsBenchmarks = computeMetricBenchmarks(quarterlyData.map(q => q.bookingsTotal), labels);

      const insights: string[] = [];
      if (activationsBenchmarks.historicAverage > 0) {
        insights.push(`Historic average activations per period: ${activationsBenchmarks.historicAverage}`);
      }
      if (activationsBenchmarks.highestPeriod) {
        insights.push(`Highest activations: ${activationsBenchmarks.highestPeriod} with ${activationsBenchmarks.highestValue}`);
      }
      if (activationsBenchmarks.currentRank && quarterlyData.length > 1) {
        insights.push(`Current period ranks #${activationsBenchmarks.currentRank} out of ${quarterlyData.length} periods`);
      }
      if (activationsBenchmarks.popChange !== null) {
        const dir = activationsBenchmarks.popChange >= 0 ? "up" : "down";
        insights.push(`Activations period-over-period: ${dir} ${Math.abs(activationsBenchmarks.popChange)}%`);
      }
      if (foottrafficBenchmarks.historicAverage > 0) {
        insights.push(`Historic average foot traffic: ${foottrafficBenchmarks.historicAverage} unique people per period`);
      }
      if (foottrafficBenchmarks.highestPeriod) {
        insights.push(`Highest foot traffic: ${foottrafficBenchmarks.highestPeriod} with ${foottrafficBenchmarks.highestValue}`);
      }
      if (bookingsBenchmarks.historicAverage > 0) {
        insights.push(`Historic average bookings: ${bookingsBenchmarks.historicAverage} per period`);
      }

      res.json({
        quarterlyData,
        benchmarks: {
          activations: activationsBenchmarks,
          foottraffic: foottrafficBenchmarks,
          bookings: bookingsBenchmarks,
          historicAverage: activationsBenchmarks.historicAverage,
          highestQuarter: activationsBenchmarks.highestPeriod,
          highestValue: activationsBenchmarks.highestValue,
          currentRank: activationsBenchmarks.currentRank,
          totalQuarters: quarterlyData.length,
          qoqChange: activationsBenchmarks.popChange,
          pctVsAverage: activationsBenchmarks.pctVsAverage,
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

  app.patch("/api/groups/:id/community-status", isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { isCommunity } = req.body;
      if (typeof isCommunity !== "boolean") return res.status(400).json({ message: "isCommunity must be boolean" });
      const group = await storage.getGroup(id);
      if (!group) return res.status(404).json({ message: "Group not found" });
      if (group.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const updated = await storage.updateGroup(id, { isCommunity });
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

        await db.update(impactLogGroups).set({ groupId: primaryId }).where(
          and(eq(impactLogGroups.groupId, mergeId), sql`impact_log_id NOT IN (SELECT impact_log_id FROM impact_log_groups WHERE group_id = ${primaryId})`)
        );
        await db.delete(impactLogGroups).where(eq(impactLogGroups.groupId, mergeId));

        await db.update(memberships).set({ groupId: primaryId }).where(eq(memberships.groupId, mergeId));
        await db.update(mous).set({ groupId: primaryId }).where(eq(mous.groupId, mergeId));
        await db.update(communitySpend).set({ groupId: primaryId }).where(eq(communitySpend.groupId, mergeId));
        await db.update(bookings).set({ bookerGroupId: primaryId }).where(eq(bookings.bookerGroupId, mergeId));
        await db.update(milestones).set({ linkedGroupId: primaryId }).where(eq(milestones.linkedGroupId, mergeId));

        if (source.notes && source.notes !== primary.notes) {
          const combinedNotes = [primary.notes, source.notes].filter(Boolean).join("\n");
          await db.update(groups).set({ notes: combinedNotes }).where(eq(groups.id, primaryId));
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

      let parsed: any;
      try {
        parsed = await claudeJSON({
          model: "claude-haiku-4-5",
          prompt,
          temperature: 0.2,
        });
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

      const outstandingDebriefs = (allDebriefs as any[]).filter((d: any) => {
        if (d.status !== "pending" && d.status !== "draft") return false;
        const created = new Date(d.createdAt);
        return created >= weekStart && created <= weekEnd;
      }).length;
      const backlogDebriefs = (allDebriefs as any[]).filter((d: any) => d.status === "pending" || d.status === "draft").length;

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
        backlogDebriefs,
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
      if (outstandingDebriefs > 0) summaryParts.push(`${outstandingDebriefs} event${outstandingDebriefs > 1 ? "s" : ""} still to be debriefed this week`);
      if (backlogDebriefs > outstandingDebriefs) summaryParts.push(`${backlogDebriefs} total outstanding across all time`);
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

  app.post("/api/weekly-hub-debriefs/:id/refresh", isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await storage.getWeeklyHubDebrief(id);
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.status !== "draft") return res.status(400).json({ message: "Only draft debriefs can be refreshed" });

      const userId = (req.user as any).claims.sub;
      const weekStart = new Date(existing.weekStartDate);
      const weekEnd = new Date(existing.weekEndDate);

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

      const outstandingDebriefs = (allDebriefs as any[]).filter((d: any) => {
        if (d.status !== "pending" && d.status !== "draft") return false;
        const created = new Date(d.createdAt);
        return created >= weekStart && created <= weekEnd;
      }).length;
      const backlogDebriefs = (allDebriefs as any[]).filter((d: any) => d.status === "pending" || d.status === "draft").length;

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
        backlogDebriefs,
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
      if (outstandingDebriefs > 0) summaryParts.push(`${outstandingDebriefs} event${outstandingDebriefs > 1 ? "s" : ""} still to be debriefed this week`);
      if (backlogDebriefs > outstandingDebriefs) summaryParts.push(`${backlogDebriefs} total outstanding across all time`);
      if (upcomingEvents.length > 0) summaryParts.push(`${upcomingEvents.length} event${upcomingEvents.length > 1 ? "s" : ""} upcoming next week`);

      const generatedSummary = summaryParts.join(". ") + ".";

      const updated = await storage.updateWeeklyHubDebrief(id, {
        generatedSummaryText: generatedSummary,
        metricsJson: metrics,
        themesJson: topThemes,
        sentimentJson: {
          average: sentimentAvg,
          sampleSize: sentiments.length,
          breakdown: sentimentBreakdown,
        },
      });

      res.json(updated);
    } catch (err: any) {
      console.error("Refresh weekly debrief error:", err);
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

      let result: any;
      try {
        result = await claudeJSON({
          model: "claude-haiku-4-5",
          prompt,
          temperature: 0.3,
        });
      } catch {
        result = { categorySuggestions: [], keywordSuggestions: [] };
      }
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

  // === MONTHLY SNAPSHOTS ===

  app.get("/api/monthly-snapshots", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const snapshots = await storage.getMonthlySnapshots(userId);
      res.json(snapshots);
    } catch (err: any) {
      console.error("Get monthly snapshots error:", err);
      res.status(500).json({ message: "Failed to fetch monthly snapshots" });
    }
  });

  app.post("/api/monthly-snapshots", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { month, footTraffic, notes } = req.body;
      if (!month) {
        return res.status(400).json({ message: "Month is required" });
      }
      const monthDate = new Date(month);
      monthDate.setDate(1);
      monthDate.setHours(0, 0, 0, 0);
      const snapshot = await storage.upsertMonthlySnapshot(userId, monthDate, { footTraffic, notes });
      res.json(snapshot);
    } catch (err: any) {
      console.error("Upsert monthly snapshot error:", err);
      res.status(500).json({ message: "Failed to save monthly snapshot" });
    }
  });

  app.delete("/api/monthly-snapshots/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteMonthlySnapshot(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete monthly snapshot error:", err);
      res.status(500).json({ message: "Failed to delete monthly snapshot" });
    }
  });

  // === FOOT TRAFFIC TOUCHPOINTS ===

  app.get("/api/monthly-snapshots/:id/touchpoints", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const snapshot = await storage.getMonthlySnapshot(parseInt(req.params.id));
      if (!snapshot || snapshot.userId !== userId) {
        return res.status(404).json({ message: "Snapshot not found" });
      }
      const touchpoints = await storage.getFootTrafficTouchpoints(snapshot.id);
      res.json(touchpoints);
    } catch (err: any) {
      console.error("Get touchpoints error:", err);
      res.status(500).json({ message: "Failed to fetch touchpoints" });
    }
  });

  app.post("/api/monthly-snapshots/:id/touchpoints", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const snapshotId = parseInt(req.params.id);
      const snapshot = await storage.getMonthlySnapshot(snapshotId);
      if (!snapshot || snapshot.userId !== userId) {
        return res.status(404).json({ message: "Snapshot not found" });
      }
      const { contactId, groupId, description } = req.body;
      if (!description) {
        return res.status(400).json({ message: "Description is required" });
      }
      const touchpoint = await storage.createFootTrafficTouchpoint({
        userId,
        snapshotId,
        contactId: contactId || null,
        groupId: groupId || null,
        description,
      });
      res.json(touchpoint);
    } catch (err: any) {
      console.error("Create touchpoint error:", err);
      res.status(500).json({ message: "Failed to create touchpoint" });
    }
  });

  app.delete("/api/monthly-snapshots/:id/touchpoints/:touchpointId", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const snapshot = await storage.getMonthlySnapshot(parseInt(req.params.id));
      if (!snapshot || snapshot.userId !== userId) {
        return res.status(404).json({ message: "Snapshot not found" });
      }
      await storage.deleteFootTrafficTouchpoint(parseInt(req.params.touchpointId));
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete touchpoint error:", err);
      res.status(500).json({ message: "Failed to delete touchpoint" });
    }
  });

  // === CATCH UP LIST ===

  app.get("/api/catch-up-list/history", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const history = await storage.getCatchUpListHistory(userId);
      res.json(history);
    } catch (err: any) {
      console.error("Get catch-up history error:", err);
      res.status(500).json({ message: "Failed to fetch catch-up history" });
    }
  });

  app.get("/api/catch-up-list", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const items = await storage.getCatchUpList(userId);
      res.json(items);
    } catch (err: any) {
      console.error("Get catch-up list error:", err);
      res.status(500).json({ message: "Failed to fetch catch-up list" });
    }
  });

  app.post("/api/catch-up-list", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { contactId, note, priority } = req.body;
      if (!contactId) {
        return res.status(400).json({ message: "Contact ID is required" });
      }
      const item = await storage.addToCatchUpList({
        userId,
        contactId,
        note: note || null,
        priority: priority || "soon",
      });
      res.json(item);
    } catch (err: any) {
      console.error("Add to catch-up list error:", err);
      res.status(500).json({ message: "Failed to add to catch-up list" });
    }
  });

  app.patch("/api/catch-up-list/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseInt(req.params.id);
      const existing = await storage.getCatchUpList(userId);
      const history = await storage.getCatchUpListHistory(userId);
      const allItems = [...existing, ...history];
      if (!allItems.find((item: any) => item.id === id)) {
        return res.status(404).json({ message: "Catch-up item not found" });
      }
      const { note, priority, dismiss } = req.body;
      if (dismiss) {
        const item = await storage.dismissCatchUpItem(id);
        return res.json(item);
      }
      const updates: any = {};
      if (note !== undefined) updates.note = note;
      if (priority !== undefined) updates.priority = priority;
      const item = await storage.updateCatchUpItem(id, updates);
      res.json(item);
    } catch (err: any) {
      console.error("Update catch-up item error:", err);
      res.status(500).json({ message: "Failed to update catch-up item" });
    }
  });

  app.delete("/api/catch-up-list/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const existing = await storage.getCatchUpList(userId);
      const history = await storage.getCatchUpListHistory(userId);
      const allItems = [...existing, ...history];
      const id = parseInt(req.params.id);
      if (!allItems.find((item: any) => item.id === id)) {
        return res.status(404).json({ message: "Catch-up item not found" });
      }
      await storage.removeCatchUpItem(id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete catch-up item error:", err);
      res.status(500).json({ message: "Failed to delete catch-up item" });
    }
  });

  // === REPORT HIGHLIGHTS ===

  app.get("/api/report-highlights", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const highlights = await storage.getReportHighlights(userId);
      res.json(highlights);
    } catch (err: any) {
      console.error("Get report highlights error:", err);
      res.status(500).json({ message: "Failed to fetch report highlights" });
    }
  });

  app.post("/api/report-highlights", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { title, description, category, month, photoUrl } = req.body;
      if (!title || !description || !category || !month) {
        return res.status(400).json({ message: "Title, description, category, and month are required" });
      }
      const monthDate = new Date(month);
      let finalPhotoUrl = photoUrl || null;
      if (finalPhotoUrl) {
        try {
          const objService = new ObjectStorageService();
          finalPhotoUrl = await objService.trySetObjectEntityAclPolicy(finalPhotoUrl, {
            owner: userId,
            visibility: "public",
          });
        } catch (e) {
          console.error("Failed to set ACL on photo:", e);
        }
      }
      const highlight = await storage.createReportHighlight({
        userId,
        title,
        description,
        category,
        month: monthDate,
        photoUrl: finalPhotoUrl,
      });
      res.json(highlight);
    } catch (err: any) {
      console.error("Create report highlight error:", err);
      res.status(500).json({ message: "Failed to create report highlight" });
    }
  });

  app.delete("/api/report-highlights/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteReportHighlight(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete report highlight error:", err);
      res.status(500).json({ message: "Failed to delete report highlight" });
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

  app.get("/api/gmail/cleanup-suggestions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const allContacts = await storage.getContacts(userId);
      const suspects = allContacts.filter(c => {
        if (!c.notes || !c.notes.includes('Imported from Gmail (1 email')) return false;
        if (!c.email) return false;
        if (isNoreplyEmail(c.email)) return true;
        const localPart = c.email.split('@')[0]?.toLowerCase() || '';
        const marketingPrefixes = ['promo', 'deals', 'offers', 'campaign', 'announce', 'weekly', 'daily', 'store', 'shop', 'rewards', 'membership', 'deliver', 'shipment', 'tracking'];
        if (marketingPrefixes.some(p => localPart.startsWith(p))) return true;
        return false;
      });
      res.json(suspects.map(c => ({ id: c.id, name: c.name, email: c.email, notes: c.notes })));
    } catch (err: any) {
      console.error("Gmail cleanup suggestions error:", err);
      res.status(500).json({ message: "Failed to get cleanup suggestions" });
    }
  });

  app.post("/api/gmail/cleanup", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { contactIds } = req.body;
      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ message: "contactIds array required" });
      }
      const allContacts = await storage.getContacts(userId);
      const ownedIds = new Set(allContacts.map(c => c.id));
      let deleted = 0;
      const failed: number[] = [];
      for (const id of contactIds) {
        if (!ownedIds.has(id)) continue;
        try {
          const memberships = await storage.getContactGroups(id);
          for (const m of memberships) {
            await storage.removeGroupMember(m.id);
          }
          const contactInteractions = await storage.getInteractions(id);
          for (const i of contactInteractions) {
            await storage.deleteInteraction(i.id);
          }
          await storage.deleteContact(id);
          deleted++;
        } catch (err) {
          console.error(`Failed to delete contact ${id}:`, err);
          failed.push(id);
        }
      }
      res.json({ deleted, failed: failed.length });
    } catch (err: any) {
      console.error("Gmail cleanup error:", err);
      res.status(500).json({ message: "Failed to cleanup contacts" });
    }
  });

  app.get("/api/gmail/sync-settings", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const settings = await storage.getGmailSyncSettings(userId);
      res.json(settings || { autoSyncEnabled: false, syncIntervalHours: 24, minEmailFrequency: 2, lastSyncAt: null });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch sync settings" });
    }
  });

  app.put("/api/gmail/sync-settings", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const settingsSchema = z.object({
        autoSyncEnabled: z.boolean().optional(),
        minEmailFrequency: z.number().int().min(1).max(10).optional(),
      });
      const parsed = settingsSchema.parse(req.body);
      const updates: any = {};
      if (parsed.autoSyncEnabled !== undefined) updates.autoSyncEnabled = parsed.autoSyncEnabled;
      if (parsed.minEmailFrequency !== undefined) updates.minEmailFrequency = parsed.minEmailFrequency;
      const existing = await storage.getGmailSyncSettings(userId);
      if (existing) {
        const updated = await storage.updateGmailSyncSettings(userId, updates);
        res.json(updated);
      } else {
        const created = await storage.createGmailSyncSettings({
          userId,
          autoSyncEnabled: updates.autoSyncEnabled ?? true,
          syncIntervalHours: 24,
          minEmailFrequency: updates.minEmailFrequency ?? 2,
        });
        res.json(created);
      }
    } catch (err: any) {
      if (err.name === 'ZodError') return res.status(400).json({ message: "Invalid settings values" });
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

  app.get("/api/groups/engagement-metrics", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;

      const metricsResult = await db.execute(sql`
        WITH group_events AS (
          SELECT g.id as group_id,
            COUNT(DISTINCT CASE WHEN ea.id IS NOT NULL THEN e.id END) as event_count,
            MAX(CASE WHEN ea.id IS NOT NULL THEN e.start_time END) as last_event_date
          FROM groups g
          LEFT JOIN group_members gm ON gm.group_id = g.id
          LEFT JOIN event_attendance ea ON ea.contact_id = gm.contact_id
          LEFT JOIN events e ON e.id = ea.event_id AND e.user_id = ${userId}
          WHERE g.user_id = ${userId}
          GROUP BY g.id
        ),
        group_programmes AS (
          SELECT g.id as group_id,
            COUNT(DISTINCT p.id) as programme_count,
            MAX(COALESCE(p.start_date, p.created_at)) as last_programme_date
          FROM groups g
          LEFT JOIN group_members gm ON gm.group_id = g.id
          LEFT JOIN programmes p ON p.user_id = ${userId}
            AND (gm.contact_id = ANY(p.facilitators) OR gm.contact_id = ANY(p.attendees))
          WHERE g.user_id = ${userId}
          GROUP BY g.id
        ),
        group_bookings AS (
          SELECT g.id as group_id,
            COUNT(DISTINCT b.id) as booking_count,
            MAX(COALESCE(b.start_date, b.created_at)) as last_booking_date
          FROM groups g
          LEFT JOIN bookings b ON b.booker_group_id = g.id AND b.user_id = ${userId}
          WHERE g.user_id = ${userId}
          GROUP BY g.id
        ),
        group_spend AS (
          SELECT g.id as group_id,
            COUNT(DISTINCT cs.id) as spend_count,
            MAX(cs.date) as last_spend_date
          FROM groups g
          LEFT JOIN community_spend cs ON cs.group_id = g.id AND cs.user_id = ${userId}
          WHERE g.user_id = ${userId}
          GROUP BY g.id
        ),
        group_impact AS (
          SELECT g.id as group_id,
            COUNT(DISTINCT ilg.impact_log_id) as impact_count,
            MAX(ilg.created_at) as last_impact_date
          FROM groups g
          LEFT JOIN impact_log_groups ilg ON ilg.group_id = g.id
          WHERE g.user_id = ${userId}
          GROUP BY g.id
        ),
        group_agreements AS (
          SELECT g.id as group_id,
            COUNT(DISTINCT m.id) + COUNT(DISTINCT mo.id) as agreement_count
          FROM groups g
          LEFT JOIN memberships m ON m.group_id = g.id AND m.user_id = ${userId}
          LEFT JOIN mous mo ON mo.group_id = g.id AND mo.user_id = ${userId}
          WHERE g.user_id = ${userId}
          GROUP BY g.id
        )
        SELECT
          g.id as group_id,
          COALESCE(ge.event_count, 0)::int as total_events,
          COALESCE(gp.programme_count, 0)::int as total_programmes,
          COALESCE(gb.booking_count, 0)::int as total_bookings,
          COALESCE(gs.spend_count, 0)::int as total_spend_entries,
          COALESCE(gi.impact_count, 0)::int as total_impact_logs,
          COALESCE(ga.agreement_count, 0)::int as total_agreements,
          GREATEST(
            ge.last_event_date,
            gp.last_programme_date,
            gb.last_booking_date,
            gs.last_spend_date,
            gi.last_impact_date
          ) as last_engagement_date
        FROM groups g
        LEFT JOIN group_events ge ON ge.group_id = g.id
        LEFT JOIN group_programmes gp ON gp.group_id = g.id
        LEFT JOIN group_bookings gb ON gb.group_id = g.id
        LEFT JOIN group_spend gs ON gs.group_id = g.id
        LEFT JOIN group_impact gi ON gi.group_id = g.id
        LEFT JOIN group_agreements ga ON ga.group_id = g.id
        WHERE g.user_id = ${userId}
      `);

      const metricsMap: Record<number, any> = {};
      for (const row of metricsResult.rows) {
        metricsMap[row.group_id as number] = {
          totalEvents: Number(row.total_events) || 0,
          totalProgrammes: Number(row.total_programmes) || 0,
          totalBookings: Number(row.total_bookings) || 0,
          totalSpendEntries: Number(row.total_spend_entries) || 0,
          totalImpactLogs: Number(row.total_impact_logs) || 0,
          totalAgreements: Number(row.total_agreements) || 0,
          totalCollaborations: (Number(row.total_events) || 0) + (Number(row.total_programmes) || 0) + (Number(row.total_bookings) || 0),
          lastEngagementDate: row.last_engagement_date || null,
        };
      }

      res.json(metricsMap);
    } catch (err: any) {
      console.error("Engagement metrics error:", err);
      res.status(500).json({ message: "Failed to get engagement metrics" });
    }
  });

  app.get("/api/groups/ecosystem-health", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;

      const healthResult = await db.execute(sql`
        WITH last_engagement AS (
          SELECT g.id as group_id, g.strategic_importance,
            GREATEST(
              (SELECT MAX(e.start_time) FROM events e
               JOIN event_attendance ea ON ea.event_id = e.id
               JOIN group_members gm ON gm.contact_id = ea.contact_id AND gm.group_id = g.id
               WHERE e.user_id = ${userId}),
              (SELECT MAX(COALESCE(b.start_date, b.created_at)) FROM bookings b WHERE b.booker_group_id = g.id AND b.user_id = ${userId}),
              (SELECT MAX(cs.date) FROM community_spend cs WHERE cs.group_id = g.id AND cs.user_id = ${userId}),
              (SELECT MAX(ilg.created_at) FROM impact_log_groups ilg WHERE ilg.group_id = g.id)
            ) as last_date
          FROM groups g
          WHERE g.user_id = ${userId}
        )
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN last_date >= NOW() - INTERVAL '90 days' THEN 1 END) as active,
          COUNT(CASE WHEN last_date < NOW() - INTERVAL '180 days' OR last_date IS NULL THEN 1 END) as dormant,
          COUNT(CASE WHEN strategic_importance = 'high' AND (last_date < NOW() - INTERVAL '90 days' OR last_date IS NULL) THEN 1 END) as at_risk
        FROM last_engagement
      `);

      const row = healthResult.rows[0] || {};
      res.json({
        total: Number(row.total) || 0,
        active: Number(row.active) || 0,
        dormant: Number(row.dormant) || 0,
        atRisk: Number(row.at_risk) || 0,
      });
    } catch (err: any) {
      console.error("Ecosystem health error:", err);
      res.status(500).json({ message: "Failed to get ecosystem health" });
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
      const affectedGroupIds = new Set<number>();
      for (const id of contactIds) {
        const contact = await storage.getContact(id);
        if (contact && contact.userId === userId) {
          await storage.updateContact(id, { isCommunityMember, communityMemberOverride: true });
          updated++;
          const contactGroupLinks = await storage.getContactGroups(id);
          for (const m of contactGroupLinks) {
            affectedGroupIds.add(m.groupId);
          }
        }
      }

      let groupsUpdated = 0;
      for (const groupId of affectedGroupIds) {
        const group = await storage.getGroup(groupId);
        if (!group || group.userId !== userId) continue;

        const members = await storage.getGroupMembers(groupId);
        const allContacts = await Promise.all(members.map(m => storage.getContact(m.contactId)));
        const hasCommunityMembers = allContacts.some(c => c && c.isCommunityMember);

        if (hasCommunityMembers && group.relationshipTier === 'mentioned') {
          await storage.updateGroup(groupId, { relationshipTier: 'collaborate' });
          groupsUpdated++;
        } else if (!hasCommunityMembers && group.relationshipTier !== 'mentioned') {
          await storage.updateGroup(groupId, { relationshipTier: 'mentioned' });
          groupsUpdated++;
        }
      }

      res.json({ updated, groupsUpdated });
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
      const allowedFields = ["role", "activityStatus", "relationshipCircle", "relationshipCircleOverride", "isInnovator"];
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

  app.post("/api/contacts/merge", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { primaryId, mergeIds } = req.body;
      if (!primaryId || !mergeIds || !Array.isArray(mergeIds) || mergeIds.length === 0) {
        return res.status(400).json({ message: "primaryId and mergeIds array required" });
      }

      let primary = await storage.getContact(primaryId);
      if (!primary || primary.userId !== userId) return res.status(404).json({ message: "Primary contact not found" });

      const allEmailsSet = new Set<string>(
        primary.email ? primary.email.split(/,\s*/).map((e: string) => e.trim()).filter(Boolean) : []
      );

      for (const mergeId of mergeIds) {
        if (mergeId === primaryId) continue;
        const source = await storage.getContact(mergeId);
        if (!source || source.userId !== userId) continue;

        await db.update(interactions).set({ contactId: primaryId }).where(eq(interactions.contactId, mergeId));
        await db.update(meetings).set({ contactId: primaryId }).where(eq(meetings.contactId, mergeId));
        await db.update(actionItems).set({ contactId: primaryId }).where(eq(actionItems.contactId, mergeId));
        await db.update(consentRecords).set({ contactId: primaryId }).where(eq(consentRecords.contactId, mergeId));
        await db.update(memberships).set({ contactId: primaryId }).where(eq(memberships.contactId, mergeId));
        await db.update(mous).set({ contactId: primaryId }).where(eq(mous.contactId, mergeId));
        await db.update(milestones).set({ linkedContactId: primaryId }).where(eq(milestones.linkedContactId, mergeId));
        await db.update(communitySpend).set({ contactId: primaryId }).where(eq(communitySpend.contactId, mergeId));

        await db.update(eventAttendance).set({ contactId: primaryId }).where(
          and(eq(eventAttendance.contactId, mergeId), sql`event_id NOT IN (SELECT event_id FROM event_attendance WHERE contact_id = ${primaryId})`)
        );
        await db.delete(eventAttendance).where(eq(eventAttendance.contactId, mergeId));

        await db.update(impactLogContacts).set({ contactId: primaryId }).where(
          and(eq(impactLogContacts.contactId, mergeId), sql`impact_log_id NOT IN (SELECT impact_log_id FROM impact_log_contacts WHERE contact_id = ${primaryId})`)
        );
        await db.delete(impactLogContacts).where(eq(impactLogContacts.contactId, mergeId));

        const sourceGroups = await storage.getContactGroups(mergeId);
        const primaryGroups = await storage.getContactGroups(primaryId);
        const existingGroupIds = new Set(primaryGroups.map((g: any) => g.groupId));
        for (const sg of sourceGroups) {
          if (!existingGroupIds.has(sg.groupId)) {
            await storage.addGroupMember({ groupId: sg.groupId, contactId: primaryId, role: sg.role });
          }
        }
        await db.delete(groupMembers).where(eq(groupMembers.contactId, mergeId));

        await db.update(bookings).set({ bookerId: primaryId }).where(eq(bookings.bookerId, mergeId));

        const progsWithFac = await db.select().from(programmes).where(sql`${primaryId} = ANY(facilitators) OR ${mergeId} = ANY(facilitators)`);
        for (const p of progsWithFac) {
          if (p.facilitators && p.facilitators.includes(mergeId)) {
            const updated = p.facilitators.filter((f: number) => f !== mergeId);
            if (!updated.includes(primaryId)) updated.push(primaryId);
            await db.update(programmes).set({ facilitators: updated }).where(eq(programmes.id, p.id));
          }
        }

        const bookingsWithAtt = await db.select().from(bookings).where(sql`${mergeId} = ANY(attendees)`);
        for (const b of bookingsWithAtt) {
          if (b.attendees && b.attendees.includes(mergeId)) {
            const updated = b.attendees.filter((a: number) => a !== mergeId);
            if (!updated.includes(primaryId)) updated.push(primaryId);
            await db.update(bookings).set({ attendees: updated }).where(eq(bookings.id, b.id));
          }
        }

        if (source.email) {
          source.email.split(/,\s*/).map((e: string) => e.trim()).filter(Boolean).forEach(e => allEmailsSet.add(e));
        }

        const merged: Partial<typeof contacts.$inferInsert> = {};
        if (!primary.phone && source.phone) merged.phone = source.phone;
        if (!primary.businessName && source.businessName) merged.businessName = source.businessName;
        if (!primary.location && source.location) merged.location = source.location;
        if (!primary.ethnicity && source.ethnicity) merged.ethnicity = source.ethnicity;
        if (source.notes && source.notes !== primary.notes) {
          merged.notes = [primary.notes, source.notes].filter(Boolean).join("\n");
        }
        if (Object.keys(merged).length > 0) {
          await db.update(contacts).set(merged).where(eq(contacts.id, primaryId));
          primary = { ...primary, ...merged };
        }

        await db.delete(contacts).where(eq(contacts.id, mergeId));
      }

      const combinedEmail = [...allEmailsSet].join(", ");
      if (combinedEmail && combinedEmail !== (primary.email || "")) {
        await db.update(contacts).set({ email: combinedEmail }).where(eq(contacts.id, primaryId));
      }

      const updated = await storage.getContact(primaryId);
      res.json(updated);
    } catch (err: any) {
      console.error("Merge contacts error:", err);
      res.status(500).json({ message: "Failed to merge contacts" });
    }
  });

  app.post("/api/contacts/auto-link-groups", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const allContacts = await storage.getContacts(userId);
      const allGroups = await storage.getGroups(userId);

      const PUBLIC_DOMAINS = new Set([
        'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.co.nz', 'outlook.com', 'outlook.co.nz',
        'yahoo.com', 'yahoo.co.nz', 'icloud.com', 'live.com', 'msn.com', 'aol.com', 'protonmail.com',
        'mail.com', 'me.com', 'ymail.com', 'rocketmail.com',
      ]);

      const groupNameLower = new Map<string, number>();
      for (const g of allGroups) {
        groupNameLower.set(g.name.toLowerCase().trim(), g.id);
      }

      let linked = 0;

      for (const c of allContacts) {
        if (c.linkedGroupId) continue;

        let matchedGroupId: number | null = null;

        if (c.businessName) {
          const key = c.businessName.toLowerCase().trim();
          if (groupNameLower.has(key)) {
            matchedGroupId = groupNameLower.get(key)!;
          }
        }

        if (!matchedGroupId && c.email) {
          const domain = c.email.split('@')[1]?.toLowerCase();
          if (domain && !PUBLIC_DOMAINS.has(domain)) {
            const domainBase = domain.replace(/\.(co\.nz|org\.nz|com|nz|net|io|co)$/i, '').replace(/\./g, ' ');
            for (const [gName, gId] of groupNameLower) {
              if (gName.includes(domainBase) || domainBase.includes(gName.replace(/\s+/g, ''))) {
                matchedGroupId = gId;
                break;
              }
            }
          }
        }

        if (matchedGroupId) {
          const existing = await storage.getContactGroups(c.id);
          const alreadyLinked = existing.some((m: any) => m.groupId === matchedGroupId);
          if (!alreadyLinked) {
            await storage.addGroupMember({ groupId: matchedGroupId, contactId: c.id, role: 'member' });
            linked++;
          }
        }
      }

      res.json({ linked, total: allContacts.length });
    } catch (err: any) {
      console.error("Auto-link error:", err);
      res.status(500).json({ message: "Failed to auto-link contacts" });
    }
  });

  app.post("/api/contacts/:id/link-group", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const contactId = parseInt(req.params.id);
      const { groupId } = req.body;

      const contact = await storage.getContact(contactId);
      if (!contact || contact.userId !== userId) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const group = await storage.getGroup(groupId);
      if (!group || group.userId !== userId) {
        return res.status(404).json({ message: "Group not found" });
      }

      const existing = await storage.getContactGroups(contactId);
      for (const m of existing) {
        await storage.removeGroupMember(m.id);
      }

      await storage.addGroupMember({ groupId, contactId, role: 'member' });

      if (contact.isCommunityMember && group.relationshipTier === 'mentioned') {
        await storage.updateGroup(groupId, { relationshipTier: 'collaborate' });
      }

      res.json({ linked: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to link contact to group" });
    }
  });

  app.delete("/api/contacts/:id/unlink-group/:groupId", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const contactId = parseInt(req.params.id);
      const groupId = parseInt(req.params.groupId);

      const contact = await storage.getContact(contactId);
      if (!contact || contact.userId !== userId) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const group = await storage.getGroup(groupId);
      if (!group || group.userId !== userId) {
        return res.status(404).json({ message: "Group not found" });
      }

      const memberships = await storage.getContactGroups(contactId);
      const membership = memberships.find((m: any) => m.groupId === groupId);
      if (!membership) {
        return res.status(404).json({ message: "Link not found" });
      }

      await storage.removeGroupMember(membership.id);
      res.json({ unlinked: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to unlink contact from group" });
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

  app.post("/api/groups/bulk-update-type", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { groupIds, type, organizationTypeOther } = req.body;
      if (!Array.isArray(groupIds) || groupIds.length === 0) {
        return res.status(400).json({ message: "No group IDs provided" });
      }
      if (!type) {
        return res.status(400).json({ message: "Type is required" });
      }
      let updated = 0;
      for (const id of groupIds) {
        const group = await storage.getGroup(id);
        if (group && group.userId === userId) {
          await storage.updateGroup(id, {
            type,
            organizationTypeOther: type === "Other" ? (organizationTypeOther || null) : null,
          });
          updated++;
        }
      }
      res.json({ updated });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update group types" });
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

  app.patch("/api/contacts/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const contactId = parseInt(req.params.id);
      const contact = await storage.getContact(contactId);
      if (!contact || contact.userId !== userId) {
        return res.status(404).json({ message: "Contact not found" });
      }
      const allowedFields = ["isInnovator", "name", "email", "phone", "role", "roleOther", "businessName", "nickname", "ventureType", "age", "ethnicity", "location", "suburb", "localBoard", "tags", "revenueBand", "notes", "active", "stage", "whatTheyAreBuilding", "supportType", "connectionStrength"];
      const updates: Record<string, any> = {};
      for (const key of Object.keys(req.body)) {
        if (allowedFields.includes(key)) {
          updates[key] = req.body[key];
        }
      }
      if (updates.role && updates.role !== "Other") {
        updates.roleOther = null;
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      const updated = await storage.updateContact(contactId, updates);

      if (Array.isArray(updates.supportType) && (updates.supportType.includes("mentoring") || updates.supportType.includes("workshop_skills")) && updated.isInnovator) {
        try {
          const existingRels = await storage.getMentoringRelationshipsByContact(contactId);
          const hasActive = existingRels.some(r => r.status === "active" || r.status === "application");
          if (!hasActive) {
            await storage.createMentoringRelationship({
              contactId,
              status: "active",
              startDate: new Date(),
              sessionFrequency: "monthly",
            });
          }
        } catch (err) {
          console.error(`Auto-create mentoring relationship failed for contact ${contactId}:`, err);
        }
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update contact" });
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

      let groupsUpdated = 0;
      if (typeof isCommunityMember === 'boolean') {
        const contactGroupLinks = await storage.getContactGroups(contactId);
        for (const m of contactGroupLinks) {
          const group = await storage.getGroup(m.groupId);
          if (!group || group.userId !== userId) continue;

          const members = await storage.getGroupMembers(m.groupId);
          const allContacts = await Promise.all(members.map(mem => storage.getContact(mem.contactId)));
          const hasCommunityMembers = allContacts.some(c => c && c.isCommunityMember);

          if (hasCommunityMembers && group.relationshipTier === 'mentioned') {
            await storage.updateGroup(m.groupId, { relationshipTier: 'collaborate' });
            groupsUpdated++;
          } else if (!hasCommunityMembers && group.relationshipTier !== 'mentioned') {
            await storage.updateGroup(m.groupId, { relationshipTier: 'mentioned' });
            groupsUpdated++;
          }
        }
      }

      res.json({ ...updated, groupsUpdated });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update community status" });
    }
  });

  app.post("/api/contacts/:id/promote", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const contactId = parseInt(req.params.id);
      const contact = await storage.getContact(contactId);
      if (!contact || contact.userId !== userId) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const updates: any = {};
      let newTier = "";
      if (!contact.isCommunityMember) {
        updates.isCommunityMember = true;
        updates.communityMemberOverride = true;
        updates.movedToCommunityAt = new Date();
        newTier = "our_community";
      } else if (!contact.isInnovator) {
        updates.isInnovator = true;
        updates.movedToInnovatorsAt = new Date();
        newTier = "our_innovators";
      } else {
        return res.json({ contact, newTier: "our_innovators", groupsUpdated: 0, message: "Already at highest tier" });
      }

      const updated = await storage.updateContact(contactId, updates);

      let groupsUpdated = 0;
      const updatedGroupIds = new Set<number>();
      const contactGroupLinks = await storage.getContactGroups(contactId);
      for (const m of contactGroupLinks) {
        const group = await storage.getGroup(m.groupId);
        if (!group || group.userId !== userId) continue;

        if (newTier === "our_community" && !group.isCommunity) {
          await storage.updateGroup(m.groupId, { isCommunity: true, movedToCommunityAt: new Date() });
          updatedGroupIds.add(m.groupId);
          groupsUpdated++;
        } else if (newTier === "our_innovators" && !group.isInnovator) {
          await storage.updateGroup(m.groupId, { isInnovator: true, movedToInnovatorsAt: new Date() });
          updatedGroupIds.add(m.groupId);
          groupsUpdated++;
        }
      }

      if (updated.linkedGroupId && !updatedGroupIds.has(updated.linkedGroupId)) {
        const linkedGroup = await storage.getGroup(updated.linkedGroupId);
        if (linkedGroup && linkedGroup.userId === userId) {
          if (newTier === "our_community" && !linkedGroup.isCommunity) {
            await storage.updateGroup(updated.linkedGroupId, { isCommunity: true, movedToCommunityAt: new Date() });
            groupsUpdated++;
          } else if (newTier === "our_innovators" && !linkedGroup.isInnovator) {
            await storage.updateGroup(updated.linkedGroupId, { isInnovator: true, movedToInnovatorsAt: new Date() });
            groupsUpdated++;
          }
        }
      }

      res.json({ contact: updated, newTier, groupsUpdated });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to promote contact" });
    }
  });

  app.post("/api/contacts/:id/demote", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const contactId = parseInt(req.params.id);
      const contact = await storage.getContact(contactId);
      if (!contact || contact.userId !== userId) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const updates: any = {};
      let newTier = "";
      if (contact.isInnovator) {
        updates.isInnovator = false;
        updates.movedToInnovatorsAt = null;
        newTier = "our_community";
      } else if (contact.isCommunityMember) {
        updates.isCommunityMember = false;
        updates.communityMemberOverride = true;
        updates.movedToCommunityAt = null;
        newTier = "all_contacts";
      } else {
        return res.json({ contact, newTier: "all_contacts", groupsUpdated: 0, message: "Already at lowest tier" });
      }

      const updated = await storage.updateContact(contactId, updates);

      let groupsUpdated = 0;
      const updatedGroupIds = new Set<number>();
      const contactGroupLinks = await storage.getContactGroups(contactId);
      for (const m of contactGroupLinks) {
        const group = await storage.getGroup(m.groupId);
        if (!group || group.userId !== userId) continue;

        const members = await storage.getGroupMembers(m.groupId);
        const otherContacts = await Promise.all(
          members.filter(mem => mem.contactId !== contactId).map(mem => storage.getContact(mem.contactId))
        );

        if (newTier === "our_community" && group.isInnovator) {
          const hasOtherInnovators = otherContacts.some(c => c && c.isInnovator);
          if (!hasOtherInnovators) {
            await storage.updateGroup(m.groupId, { isInnovator: false });
            updatedGroupIds.add(m.groupId);
            groupsUpdated++;
          }
        } else if (newTier === "all_contacts" && group.isCommunity) {
          const hasOtherCommunity = otherContacts.some(c => c && c.isCommunityMember);
          if (!hasOtherCommunity) {
            await storage.updateGroup(m.groupId, { isCommunity: false });
            updatedGroupIds.add(m.groupId);
            groupsUpdated++;
          }
        }
      }

      if (updated.linkedGroupId && !updatedGroupIds.has(updated.linkedGroupId)) {
        const linkedGroup = await storage.getGroup(updated.linkedGroupId);
        if (linkedGroup && linkedGroup.userId === userId) {
          if (newTier === "our_community" && linkedGroup.isInnovator) {
            const members = await storage.getGroupMembers(updated.linkedGroupId);
            const otherContacts = await Promise.all(
              members.filter(mem => mem.contactId !== contactId).map(mem => storage.getContact(mem.contactId))
            );
            const hasOtherInnovators = otherContacts.some(c => c && c.isInnovator);
            if (!hasOtherInnovators) {
              await storage.updateGroup(updated.linkedGroupId, { isInnovator: false });
              groupsUpdated++;
            }
          } else if (newTier === "all_contacts" && linkedGroup.isCommunity) {
            const members = await storage.getGroupMembers(updated.linkedGroupId);
            const otherContacts = await Promise.all(
              members.filter(mem => mem.contactId !== contactId).map(mem => storage.getContact(mem.contactId))
            );
            const hasOtherCommunity = otherContacts.some(c => c && c.isCommunityMember);
            if (!hasOtherCommunity) {
              await storage.updateGroup(updated.linkedGroupId, { isCommunity: false });
              groupsUpdated++;
            }
          }
        }
      }

      res.json({ contact: updated, newTier, groupsUpdated });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to demote contact" });
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

  // === Funders API ===

  app.get("/api/funders", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      let fundersList = await storage.getFunders(userId);

      if (fundersList.length === 0) {
        const defaults = [
          {
            userId,
            name: "Ngā Mātārae",
            organisation: "Ngā Mātārae",
            status: "active_funder" as const,
            communityLens: "maori" as const,
            outcomesFramework: "Tāmaki Ora",
            reportingCadence: "quarterly" as const,
            narrativeStyle: "compliance" as const,
            prioritySections: ["engagement", "outcomes", "milestones"],
            funderTag: "nga-matarae",
            isDefault: true,
          },
          {
            userId,
            name: "EDO / Auckland Council",
            organisation: "Auckland Council",
            status: "active_funder" as const,
            communityLens: "all" as const,
            outcomesFramework: "Auckland Plan",
            reportingCadence: "quarterly" as const,
            narrativeStyle: "compliance" as const,
            prioritySections: ["engagement", "delivery", "value"],
            funderTag: "edo-auckland-council",
            isDefault: true,
          },
          {
            userId,
            name: "Foundation North",
            organisation: "Foundation North",
            status: "active_funder" as const,
            communityLens: "pasifika" as const,
            outcomesFramework: "Community Wellbeing",
            reportingCadence: "annual" as const,
            narrativeStyle: "story" as const,
            prioritySections: ["engagement", "outcomes", "impact"],
            funderTag: "foundation-north",
            isDefault: true,
          },
        ];

        for (const def of defaults) {
          await storage.createFunder(def);
        }
        fundersList = await storage.getFunders(userId);
      }

      res.json(fundersList);
    } catch (err: any) {
      console.error("Error fetching funders:", err);
      res.status(500).json({ message: "Failed to fetch funders" });
    }
  });

  app.get("/api/funders/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const funder = await storage.getFunder(id);
      if (!funder) return res.status(404).json({ message: "Funder not found" });
      if (funder.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      const docs = await storage.getFunderDocuments(id);
      res.json({ ...funder, documentCount: docs.length });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch funder" });
    }
  });

  app.post("/api/funders", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const body = coerceDateFields(req.body);
      const input = insertFunderSchema.parse({ ...body, userId });
      const funder = await storage.createFunder(input);
      res.status(201).json(funder);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Failed to create funder" });
    }
  });

  app.patch("/api/funders/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getFunder(id);
      if (!existing) return res.status(404).json({ message: "Funder not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      const body = coerceDateFields(req.body);
      const updated = await storage.updateFunder(id, body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update funder" });
    }
  });

  app.delete("/api/funders/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getFunder(id);
      if (!existing) return res.status(404).json({ message: "Funder not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      await storage.deleteFunder(id);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete funder" });
    }
  });

  app.get("/api/funders/:id/documents", isAuthenticated, async (req, res) => {
    try {
      const funderId = parseInt(req.params.id);
      const funder = await storage.getFunder(funderId);
      if (!funder) return res.status(404).json({ message: "Funder not found" });
      if (funder.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      const docs = await storage.getFunderDocuments(funderId);
      res.json(docs.map(d => ({ ...d, fileData: undefined })));
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.post("/api/funders/:id/documents", isAuthenticated, async (req, res) => {
    try {
      const funderId = parseInt(req.params.id);
      const userId = (req.user as any).claims.sub;
      const funder = await storage.getFunder(funderId);
      if (!funder) return res.status(404).json({ message: "Funder not found" });
      if (funder.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const input = insertFunderDocumentSchema.parse({
        ...req.body,
        funderId,
        userId,
      });
      const doc = await storage.createFunderDocument(input);
      res.status(201).json({ ...doc, fileData: undefined });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  app.get("/api/funder-documents/:docId/download", isAuthenticated, async (req, res) => {
    try {
      const docId = parseInt(req.params.docId);
      const doc = await storage.getFunderDocument(docId);
      if (!doc) return res.status(404).json({ message: "Document not found" });

      const funder = await storage.getFunder(doc.funderId);
      if (!funder || funder.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      res.json({ id: doc.id, fileName: doc.fileName, documentType: doc.documentType, fileData: doc.fileData, fileSize: doc.fileSize });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  app.delete("/api/funder-documents/:docId", isAuthenticated, async (req, res) => {
    try {
      const docId = parseInt(req.params.docId);
      const doc = await storage.getFunderDocument(docId);
      if (!doc) return res.status(404).json({ message: "Document not found" });

      const funder = await storage.getFunder(doc.funderId);
      if (!funder || funder.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      await storage.deleteFunderDocument(docId);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // === MENTORING RELATIONSHIPS ===

  const verifyContactOwnership = async (contactId: number, userId: string) => {
    const contact = await storage.getContact(contactId);
    return contact && contact.userId === userId;
  };

  app.get("/api/mentoring-relationships", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const all = await storage.getMentoringRelationships();
      const userContacts = await storage.getContacts(userId);
      const userContactIds = new Set(userContacts.map(c => c.id));
      res.json(all.filter(r => userContactIds.has(r.contactId)));
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch mentoring relationships" });
    }
  });

  app.post("/api/mentoring-relationships/backfill-from-support-type", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const allContacts = await storage.getContacts(userId);
      const mentoringContacts = allContacts.filter(c =>
        c.isInnovator && Array.isArray(c.supportType) && (c.supportType.includes("mentoring") || c.supportType.includes("workshop_skills"))
      );
      let created = 0;
      for (const contact of mentoringContacts) {
        const existing = await storage.getMentoringRelationshipsByContact(contact.id);
        const hasActive = existing.some(r => r.status === "active" || r.status === "application");
        if (!hasActive) {
          await storage.createMentoringRelationship({
            contactId: contact.id,
            status: "active",
            startDate: new Date(),
            sessionFrequency: "monthly",
          });
          created++;
        }
      }
      res.json({ checked: mentoringContacts.length, created });
    } catch (err: any) {
      console.error("Backfill mentoring relationships error:", err);
      res.status(500).json({ message: "Failed to backfill mentoring relationships" });
    }
  });

  app.post("/api/mentoring-relationships", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const body = { ...req.body };
      if (typeof body.startDate === "string") body.startDate = new Date(body.startDate);
      if (typeof body.endDate === "string") body.endDate = new Date(body.endDate);
      if (typeof body.lastSessionDate === "string") body.lastSessionDate = new Date(body.lastSessionDate);
      if (typeof body.nextSessionDate === "string") body.nextSessionDate = new Date(body.nextSessionDate);
      const input = insertMentoringRelationshipSchema.parse(body);
      if (!await verifyContactOwnership(input.contactId, userId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const relationship = await storage.createMentoringRelationship(input);
      res.status(201).json(relationship);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Failed to create mentoring relationship" });
    }
  });

  app.get("/api/mentoring-relationships/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const relationship = await storage.getMentoringRelationship(id);
      if (!relationship) return res.status(404).json({ message: "Not found" });
      const userId = (req.user as any).claims.sub;
      if (!await verifyContactOwnership(relationship.contactId, userId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      res.json(relationship);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch mentoring relationship" });
    }
  });

  app.patch("/api/mentoring-relationships/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getMentoringRelationship(id);
      if (!existing) return res.status(404).json({ message: "Not found" });
      const userId = (req.user as any).claims.sub;
      if (!await verifyContactOwnership(existing.contactId, userId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const body = { ...req.body };
      if (typeof body.startDate === "string") body.startDate = new Date(body.startDate);
      if (typeof body.endDate === "string") body.endDate = new Date(body.endDate);
      if (typeof body.lastSessionDate === "string") body.lastSessionDate = new Date(body.lastSessionDate);
      if (typeof body.nextSessionDate === "string") body.nextSessionDate = new Date(body.nextSessionDate);
      const updated = await storage.updateMentoringRelationship(id, body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update mentoring relationship" });
    }
  });

  app.delete("/api/mentoring-relationships/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getMentoringRelationship(id);
      if (!existing) return res.status(404).json({ message: "Not found" });
      const userId = (req.user as any).claims.sub;
      if (!await verifyContactOwnership(existing.contactId, userId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.deleteMentoringRelationship(id);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete mentoring relationship" });
    }
  });

  app.get("/api/contacts/:contactId/mentoring-relationships", isAuthenticated, async (req, res) => {
    try {
      const contactId = parseInt(req.params.contactId);
      const userId = (req.user as any).claims.sub;
      if (!await verifyContactOwnership(contactId, userId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const relationships = await storage.getMentoringRelationshipsByContact(contactId);
      res.json(relationships);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch mentoring relationships" });
    }
  });

  // === MENTORING APPLICATIONS ===

  app.get("/api/mentoring-applications", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const all = await storage.getMentoringApplications();
      const userContacts = await storage.getContacts(userId);
      const userContactIds = new Set(userContacts.map(c => c.id));
      res.json(all.filter(a => userContactIds.has(a.contactId)));
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch mentoring applications" });
    }
  });

  app.post("/api/mentoring-applications", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const input = insertMentoringApplicationSchema.parse(req.body);
      if (!await verifyContactOwnership(input.contactId, userId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const application = await storage.createMentoringApplication(input);
      res.status(201).json(application);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Failed to create mentoring application" });
    }
  });

  app.patch("/api/mentoring-applications/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getMentoringApplication(id);
      if (!existing) return res.status(404).json({ message: "Not found" });
      const userId = (req.user as any).claims.sub;
      if (!await verifyContactOwnership(existing.contactId, userId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const updateData = { ...req.body };
      if (updateData.status === "declined" || updateData.status === "deferred") {
        updateData.reviewedBy = userId;
        updateData.reviewedDate = new Date();
      }
      const updated = await storage.updateMentoringApplication(id, updateData);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update mentoring application" });
    }
  });

  app.delete("/api/mentoring-applications/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getMentoringApplication(id);
      if (!existing) return res.status(404).json({ message: "Not found" });
      const userId = (req.user as any).claims.sub;
      if (!await verifyContactOwnership(existing.contactId, userId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.deleteMentoringApplication(id);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete mentoring application" });
    }
  });

  // === MENTORING ONBOARDING QUESTIONS ===

  app.get("/api/mentoring-onboarding-questions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const questions = await storage.getMentoringOnboardingQuestions(userId);
      if (questions.length === 0) {
        const defaults = [
          { userId, question: "Tell us about what you're building", fieldType: "textarea", isRequired: true, sortOrder: 0, isActive: true },
          { userId, question: "What are you stuck on?", fieldType: "textarea", isRequired: true, sortOrder: 1, isActive: true },
          { userId, question: "What do you need help with?", fieldType: "textarea", isRequired: true, sortOrder: 2, isActive: true },
          { userId, question: "What have you already tried?", fieldType: "textarea", isRequired: false, sortOrder: 3, isActive: true },
          { userId, question: "Why are you looking for mentoring?", fieldType: "textarea", isRequired: true, sortOrder: 4, isActive: true },
          { userId, question: "How many hours per week can you commit?", fieldType: "select", options: ["1-2 hours", "3-5 hours", "5-10 hours", "10+ hours"], isRequired: true, sortOrder: 5, isActive: true },
          { userId, question: "Can you commit to 3 months?", fieldType: "boolean", isRequired: true, sortOrder: 6, isActive: true },
        ];
        for (const d of defaults) {
          await storage.createMentoringOnboardingQuestion(d as any);
        }
        const seeded = await storage.getMentoringOnboardingQuestions(userId);
        return res.json(seeded);
      }
      res.json(questions);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch onboarding questions" });
    }
  });

  app.post("/api/mentoring-onboarding-questions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const created = await storage.createMentoringOnboardingQuestion({ ...req.body, userId });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create onboarding question" });
    }
  });

  app.patch("/api/mentoring-onboarding-questions/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getMentoringOnboardingQuestion(id);
      if (!existing) return res.status(404).json({ message: "Not found" });
      const userId = (req.user as any).claims.sub;
      if (existing.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const updated = await storage.updateMentoringOnboardingQuestion(id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update onboarding question" });
    }
  });

  app.delete("/api/mentoring-onboarding-questions/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getMentoringOnboardingQuestion(id);
      if (!existing) return res.status(404).json({ message: "Not found" });
      const userId = (req.user as any).claims.sub;
      if (existing.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteMentoringOnboardingQuestion(id);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete onboarding question" });
    }
  });

  // === STAGE PROGRESSION ===

  const VALID_STAGES = ["kakano", "tipu", "ora", "inactive"];

  app.post("/api/contacts/:id/stage-progression", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getContact(id);
      if (!existing) return res.status(404).json({ message: "Contact not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      const { stage, notes } = req.body;
      if (!stage || !VALID_STAGES.includes(stage)) {
        return res.status(400).json({ message: "Stage must be one of: kakano, tipu, ora, inactive" });
      }

      const updated = await storage.appendStageProgression(id, stage, notes);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update stage progression" });
    }
  });

  // === PROJECTS ===

  app.get("/api/projects", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const items = await storage.getProjects(userId);
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.getProject(id);
      if (!item) return res.status(404).json({ message: "Project not found" });
      const userId = (req.user as any).claims.sub;
      if (item.createdBy !== userId) return res.status(403).json({ message: "Forbidden" });
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const body = { ...req.body };
      if (body.startDate) body.startDate = new Date(body.startDate);
      if (body.endDate) body.endDate = new Date(body.endDate);
      const validated = insertProjectSchema.parse({ ...body, createdBy: userId });
      const project = await storage.createProject(validated);
      await storage.createProjectUpdate({
        projectId: project.id,
        updateType: "note",
        updateText: "Project created",
        createdBy: userId,
      });
      res.status(201).json(project);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to create project" });
    }
  });

  app.patch("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getProject(id);
      if (!existing) return res.status(404).json({ message: "Project not found" });
      const userId = (req.user as any).claims.sub;
      if (existing.createdBy !== userId) return res.status(403).json({ message: "Forbidden" });
      const body = { ...req.body };
      if (body.startDate) body.startDate = new Date(body.startDate);
      if (body.endDate) body.endDate = new Date(body.endDate);
      const validated = insertProjectSchema.partial().parse(body);
      const updated = await storage.updateProject(id, validated);
      if (body.status && body.status !== existing.status) {
        await storage.createProjectUpdate({
          projectId: id,
          updateType: "status_change",
          updateText: `Status changed from ${existing.status} to ${req.body.status}`,
          createdBy: userId,
        });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getProject(id);
      if (!existing) return res.status(404).json({ message: "Project not found" });
      const userId = (req.user as any).claims.sub;
      if (existing.createdBy !== userId) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteProject(id);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  app.get("/api/projects/:id/updates", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      const userId = (req.user as any).claims.sub;
      if (project.createdBy !== userId) return res.status(403).json({ message: "Forbidden" });
      const updates = await storage.getProjectUpdates(projectId);
      res.json(updates);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch project updates" });
    }
  });

  app.post("/api/projects/:id/updates", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      const userId = (req.user as any).claims.sub;
      if (project.createdBy !== userId) return res.status(403).json({ message: "Forbidden" });
      const validated = insertProjectUpdateSchema.parse({
        ...req.body,
        projectId,
        createdBy: userId,
      });
      const update = await storage.createProjectUpdate(validated);
      await storage.updateProject(projectId, {});
      res.status(201).json(update);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to create project update" });
    }
  });

  app.get("/api/projects/all-tasks", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const tasks = await storage.getAllProjectTasks(userId);
      res.json(tasks);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to get all tasks" });
    }
  });

  app.get("/api/projects/:id/tasks", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      const userId = (req.user as any).claims.sub;
      if (project.createdBy !== userId) return res.status(403).json({ message: "Forbidden" });
      const tasks = await storage.getProjectTasks(projectId);
      res.json(tasks);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to get project tasks" });
    }
  });

  app.post("/api/projects/:id/tasks", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      const userId = (req.user as any).claims.sub;
      if (project.createdBy !== userId) return res.status(403).json({ message: "Forbidden" });
      const body = { ...req.body, projectId };
      if (body.deadline) body.deadline = new Date(body.deadline);
      const validated = insertProjectTaskSchema.parse(body);
      const task = await storage.createProjectTask(validated);
      await storage.updateProject(projectId, {});
      res.status(201).json(task);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to create project task" });
    }
  });

  app.patch("/api/projects/tasks/:taskId", isAuthenticated, async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const task = await storage.getProjectTask(taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      const project = await storage.getProject(task.projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      const userId = (req.user as any).claims.sub;
      if (project.createdBy !== userId) return res.status(403).json({ message: "Forbidden" });
      const body = { ...req.body };
      delete body.projectId;
      if (body.deadline) body.deadline = new Date(body.deadline);
      const validated = insertProjectTaskSchema.partial().parse(body);
      const updated = await storage.updateProjectTask(taskId, validated);
      await storage.updateProject(task.projectId, {});
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to update task" });
    }
  });

  app.delete("/api/projects/tasks/:taskId", isAuthenticated, async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const task = await storage.getProjectTask(taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      const project = await storage.getProject(task.projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      const userId = (req.user as any).claims.sub;
      if (project.createdBy !== userId) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteProjectTask(taskId);
      await storage.updateProject(task.projectId, {});
      res.status(204).end();
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to delete task" });
    }
  });

  app.post("/api/projects/extract-tasks", isAuthenticated, async (req, res) => {
    try {
      const { text, projectName } = req.body;
      if (!text || typeof text !== "string" || text.trim().length < 5) {
        return res.status(400).json({ message: "Please provide some text to extract tasks from" });
      }

      const result = await claudeJSON({
        model: "claude-sonnet-4-6",
        system: `You are a project management assistant for Reserve Tāmaki, a Māori and Pasifika community development organisation in Tāmaki Makaurau (Auckland), Aotearoa New Zealand. You extract actionable tasks from voice debriefs, meeting notes, and freeform text, and organise them into logical groups.

You understand Te Reo Māori terms (whānau, rangatahi, kaitiaki, mahi, kaupapa, etc.) and NZ business context.

Extract clear, specific, actionable tasks. Each task should be something one person can do. Break down vague items into concrete steps where possible. Organise tasks into logical groups based on their nature or domain.`,
        prompt: `Analyze this text and extract all actionable tasks, organised into logical groups:

"""
${text.trim()}
"""

${projectName ? `The project is called "${projectName}".` : "Also suggest a short project name and brief description based on the content."}

Return JSON in this exact format:
{
  ${projectName ? "" : '"suggestedName": "short project name",\n  "suggestedDescription": "one sentence description",\n  '}"tasks": [
    {
      "title": "Clear actionable task title",
      "description": "Brief context or details (optional, can be null)",
      "priority": "high" | "medium" | "low",
      "group": "Group Name"
    }
  ]
}

Rules:
- Extract every actionable item, no matter how small
- Task titles should be clear and start with a verb (e.g. "Set up...", "Contact...", "Review...")
- Priority: high = urgent/deadline-driven, medium = important but flexible, low = nice to have
- If the text mentions deadlines, include them in the task description
- If the text mentions people by name, include them in the task description
- Return at least 1 task, even if the text is vague
- Every task MUST have a "group" — a short, clear category name (e.g. "Design", "Development", "Admin", "Outreach", "Follow-ups", "Planning", "Communications")
- Aim for 2-5 groups depending on the scope of work. Keep group names concise (1-2 words)
- Tasks that are related should share the same group name
- Order tasks within each group by priority (high first)`,
        temperature: 0.2,
        maxTokens: 4096,
      });

      res.json(result);
    } catch (err: any) {
      console.error("Task extraction error:", err);
      res.status(500).json({ message: err.message || "Failed to extract tasks" });
    }
  });

  // === Booker Portal API (Public - token-based auth) ===

  app.post("/api/booker/login", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.json({ success: true, message: "Login link sent" });
      }

      const booker = await storage.getRegularBookerByLoginEmail(email.trim().toLowerCase());
      if (booker && booker.loginEnabled) {
        const token = crypto.randomUUID();
        const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await storage.createBookerLink({
          regularBookerId: booker.id,
          token,
          tokenExpiry: expiry,
          enabled: true,
          label: "Email login link",
        });

        const baseUrl = process.env.REPLIT_DEV_DOMAIN
          ? `https://${process.env.REPLIT_DEV_DOMAIN}`
          : process.env.REPL_SLUG
          ? `https://${process.env.REPL_SLUG}.replit.app`
          : "https://app.reservetmk.co.nz";
        const loginUrl = `${baseUrl}/booker/portal/${token}`;

        const contact = booker.contactId ? await storage.getContact(booker.contactId) : null;
        const name = contact?.name || booker.organizationName || "there";

        try {
          const { sendBookerLoginEmail } = await import("./email");
          await sendBookerLoginEmail(email.trim(), name, loginUrl);
        } catch (emailErr) {
          console.error("Failed to send booker login email:", emailErr);
        }
      }

      res.json({ success: true, message: "Login link sent" });
    } catch (err: any) {
      console.error("Booker login error:", err);
      res.json({ success: true, message: "Login link sent" });
    }
  });

  app.get("/api/booker/auth/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const result = await storage.getBookerByLinkToken(token);
      if (!result) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      const { booker, link } = result;
      if (link.tokenExpiry && new Date(link.tokenExpiry) < new Date()) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      if (!link.enabled) {
        return res.status(401).json({ message: "This link has been disabled" });
      }

      const newToken = crypto.randomUUID();
      await storage.updateBookerLinkToken(link.id, newToken, new Date(Date.now() + 4 * 60 * 60 * 1000));
      await storage.updateBookerLinkAccess(link.id);

      const contact = booker.contactId ? await storage.getContact(booker.contactId) : null;
      let linkedGroupId: number | null = booker.groupId || null;
      let linkedGroupName: string | null = null;
      if (booker.groupId) {
        const group = await storage.getGroup(booker.groupId);
        if (group) linkedGroupName = group.name;
      } else if (booker.contactId) {
        const contactGroups = await storage.getContactGroups(booker.contactId);
        if (contactGroups.length > 0) {
          const group = await storage.getGroup(contactGroups[0].groupId);
          if (group) {
            linkedGroupId = group.id;
            linkedGroupName = group.name;
          }
        }
      }

      let membership = null;
      if (booker.membershipId) {
        membership = await storage.getMembership(booker.membershipId);
      }
      let mou = null;
      if (booker.mouId) {
        mou = await storage.getMou(booker.mouId);
      }

      res.json({
        booker: { ...booker, loginToken: newToken },
        contact,
        linkedGroupId,
        linkedGroupName,
        membership,
        mou,
        userId: booker.userId,
        token: newToken,
      });
    } catch (err: any) {
      console.error("Booker auth error:", err);
      res.status(500).json({ message: "Authentication failed" });
    }
  });

  app.get("/api/booker/venues/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const linkResult = await storage.getBookerByLinkToken(token);
      if (!linkResult || (linkResult.link.tokenExpiry && new Date(linkResult.link.tokenExpiry) < new Date()) || !linkResult.link.enabled) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      const booker = linkResult.booker;

      const allVenues = await storage.getVenues(booker.userId);
      const activeVenues = allVenues.filter(v => v.active);
      res.json(activeVenues);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch venues" });
    }
  });

  app.get("/api/booker/availability/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const linkResult = await storage.getBookerByLinkToken(token);
      if (!linkResult || (linkResult.link.tokenExpiry && new Date(linkResult.link.tokenExpiry) < new Date()) || !linkResult.link.enabled) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      const booker = linkResult.booker;

      const venueId = parseInt(req.query.venueId as string);
      const month = req.query.month as string;
      if (!venueId || !month) {
        return res.status(400).json({ message: "venueId and month required" });
      }

      const [yearStr, monthStr] = month.split("-");
      const year = parseInt(yearStr);
      const mon = parseInt(monthStr) - 1;
      const monthStart = new Date(year, mon, 1);
      const monthEnd = new Date(year, mon + 1, 0, 23, 59, 59);

      const allBookings = await storage.getBookings(booker.userId);
      const venueBookings = allBookings.filter(b => {
        if (b.venueId !== venueId) return false;
        if (b.status === "cancelled") return false;
        if (!b.startDate) return false;
        const sd = new Date(b.startDate);
        return sd >= monthStart && sd <= monthEnd;
      });

      const dates: Record<string, { status: string; bookings: { startTime: string | null; endTime: string | null; title: string | null; isYours: boolean }[] }> = {};

      const daysInMonth = new Date(year, mon + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(mon + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        dates[dateStr] = { status: "available", bookings: [] };
      }

      for (const booking of venueBookings) {
        const sd = new Date(booking.startDate!);
        const dateStr = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, "0")}-${String(sd.getDate()).padStart(2, "0")}`;
        if (!dates[dateStr]) continue;

        const isYours = booking.bookerId === booker.contactId;
        dates[dateStr].bookings.push({
          startTime: booking.startTime,
          endTime: booking.endTime,
          title: isYours ? (booking.title || booking.classification) : "Booked",
          isYours,
        });
      }

      for (const [dateStr, info] of Object.entries(dates)) {
        if (info.bookings.length === 0) {
          info.status = "available";
        } else {
          const hasYours = info.bookings.some(b => b.isYours);
          const totalMinutesCovered = info.bookings.reduce((acc, b) => {
            const start = b.startTime ? parseTimeToMinutes(b.startTime) : 480;
            const end = b.endTime ? parseTimeToMinutes(b.endTime) : 1020;
            return acc + (end - start);
          }, 0);
          const businessDayMinutes = 540;

          if (hasYours) {
            info.status = "yours";
          } else if (totalMinutesCovered >= businessDayMinutes) {
            info.status = "booked";
          } else {
            info.status = "partial";
          }
        }
      }

      res.json({ dates });
    } catch (err: any) {
      console.error("Booker availability error:", err);
      res.status(500).json({ message: "Failed to fetch availability" });
    }
  });

  app.post("/api/booker/book/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const linkResult = await storage.getBookerByLinkToken(token);
      if (!linkResult || (linkResult.link.tokenExpiry && new Date(linkResult.link.tokenExpiry) < new Date()) || !linkResult.link.enabled) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      const booker = linkResult.booker;

      const { venueId, startDate, startTime, endTime, classification, specialRequests, usePackageCredit } = req.body;
      if (!venueId || !startDate || !startTime || !endTime || !classification) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const allBookings = await storage.getBookings(booker.userId);
      const conflicting = allBookings.filter(b => {
        if (b.venueId !== venueId || b.status === "cancelled") return false;
        if (!b.startDate) return false;
        const bDate = new Date(b.startDate).toISOString().split("T")[0];
        const reqDate = new Date(startDate).toISOString().split("T")[0];
        if (bDate !== reqDate) return false;
        const bStart = parseTimeToMinutes(b.startTime || "08:00");
        const bEnd = parseTimeToMinutes(b.endTime || "17:00");
        const rStart = parseTimeToMinutes(startTime);
        const rEnd = parseTimeToMinutes(endTime);
        return bStart < rEnd && rStart < bEnd;
      });
      if (conflicting.length > 0) {
        return res.status(409).json({
          message: "Time slot conflicts with existing booking",
          conflicts: conflicting.map(c => ({
            title: c.title || c.classification,
            startTime: c.startTime,
            endTime: c.endTime,
          })),
        });
      }

      const contactGroups = await storage.getContactGroups(booker.contactId);
      let bookerGroupId: number | null = null;
      if (contactGroups.length > 0) {
        bookerGroupId = contactGroups[0].groupId;
      }

      const startMinutes = parseTimeToMinutes(startTime);
      const endMinutes = parseTimeToMinutes(endTime);
      const durationHours = (endMinutes - startMinutes) / 60;
      let durationType = "hourly";
      if (durationHours >= 8) durationType = "full_day";
      else if (durationHours >= 4) durationType = "half_day";

      let pricingTier = booker.pricingTier || "full_price";
      let amount = "0";
      let membershipId: number | null = booker.membershipId || null;
      let mouId: number | null = booker.mouId || null;
      let discountPercentage = booker.discountPercentage || "0";
      let shouldUsePackageCredit = usePackageCredit === true;

      if (booker.membershipId || booker.mouId) {
        pricingTier = "free_koha";
        amount = "0";
      } else if (shouldUsePackageCredit && booker.hasBookingPackage) {
        const remaining = (booker.packageTotalBookings || 0) - (booker.packageUsedBookings || 0);
        if (remaining > 0) {
          pricingTier = "free_koha";
          amount = "0";
          await storage.updateRegularBooker(booker.id, {
            packageUsedBookings: (booker.packageUsedBookings || 0) + 1,
          } as any);
        }
      } else {
        const defaults = await storage.getBookingPricingDefaults(booker.userId);
        if (defaults) {
          if (durationType === "full_day") {
            amount = defaults.fullDayRate || "0";
          } else if (durationType === "half_day") {
            amount = defaults.halfDayRate || "0";
          } else {
            const hourlyRate = parseFloat(defaults.fullDayRate || "0") / 8;
            amount = String((hourlyRate * durationHours).toFixed(2));
          }
        }
        if (pricingTier === "discounted" && parseFloat(discountPercentage) > 0) {
          const disc = parseFloat(discountPercentage) / 100;
          amount = String((parseFloat(amount) * (1 - disc)).toFixed(2));
        }
      }

      const booking = await storage.createBooking({
        userId: booker.userId,
        venueId,
        title: `${classification} - Portal Booking`,
        classification,
        status: "enquiry",
        startDate: new Date(startDate),
        startTime,
        endTime,
        durationType,
        pricingTier,
        amount,
        bookerId: booker.contactId,
        bookerGroupId,
        membershipId,
        mouId,
        specialRequests: specialRequests || null,
        bookingSource: "regular_booker_portal",
        usePackageCredit: shouldUsePackageCredit,
        discountPercentage,
      } as any);

      res.json(booking);
    } catch (err: any) {
      console.error("Booker booking error:", err);
      res.status(500).json({ message: err.message || "Failed to create booking" });
    }
  });

  app.get("/api/booker/bookings/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const linkResult = await storage.getBookerByLinkToken(token);
      if (!linkResult || (linkResult.link.tokenExpiry && new Date(linkResult.link.tokenExpiry) < new Date()) || !linkResult.link.enabled) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      const booker = linkResult.booker;

      const allBookings = await storage.getBookings(booker.userId);
      const myBookings = allBookings.filter(b => b.bookerId === booker.contactId);
      res.json(myBookings);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  app.get("/api/operating-hours", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      let hours = await storage.getOperatingHours(userId);
      if (hours.length === 0) {
        hours = await storage.seedDefaultOperatingHours(userId);
      }
      res.json(hours);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch operating hours" });
    }
  });

  app.put("/api/operating-hours", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { hours } = req.body;
      if (!Array.isArray(hours)) return res.status(400).json({ message: "hours array required" });
      const validDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
      const validated = hours.filter((h: any) => validDays.includes(h.dayOfWeek)).map((h: any) => ({
        dayOfWeek: h.dayOfWeek,
        openTime: h.isStaffed ? (h.openTime || "09:00") : null,
        closeTime: h.isStaffed ? (h.closeTime || "17:00") : null,
        isStaffed: !!h.isStaffed,
      }));
      const result = await storage.upsertOperatingHours(userId, validated);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update operating hours" });
    }
  });

  app.get("/api/after-hours-settings", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const settings = await storage.getAfterHoursSettings(userId);
      res.json(settings || { autoSendEnabled: true, sendTimingHours: 4 });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch after-hours settings" });
    }
  });

  app.put("/api/after-hours-settings", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { autoSendEnabled, sendTimingHours } = req.body;
      const result = await storage.upsertAfterHoursSettings(userId, { autoSendEnabled, sendTimingHours });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update after-hours settings" });
    }
  });

  app.post("/api/bookings/:id/send-instructions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      if (booking.isAfterHours) {
        const { sendAfterHoursReminderEmail } = await import("./email");
        await sendAfterHoursReminderEmail(booking, userId);
      } else {
        const { sendBookingConfirmationEmail } = await import("./email");
        await sendBookingConfirmationEmail(booking, userId);
      }

      await storage.updateBooking(bookingId, {
        autoInstructionsSent: true,
        autoInstructionsSentAt: new Date(),
      } as any);

      res.json({ success: true, message: "Instructions sent" });
    } catch (err: any) {
      console.error("Failed to send instructions:", err);
      res.status(500).json({ message: err.message || "Failed to send instructions" });
    }
  });

  app.post("/api/xero/save-credentials", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { xeroClientId, xeroClientSecret } = req.body;
      if (!xeroClientId || !xeroClientSecret) {
        return res.status(400).json({ message: "Client ID and Client Secret are required" });
      }
      await storage.upsertXeroSettings(userId, { xeroClientId, xeroClientSecret });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/xero/connect", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const settings = await storage.getXeroSettings(userId);
      if (!settings?.xeroClientId || !settings?.xeroClientSecret) {
        return res.status(400).json({ message: "Xero credentials not configured. Save your Client ID and Secret first." });
      }
      const { getXeroAuthUrl, createOAuthState } = await import("./xero");
      const state = createOAuthState(userId);
      const authUrl = getXeroAuthUrl(settings, state);
      res.json({ authUrl });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/xero/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      if (!code || !state) {
        return res.status(400).send("Missing code or state parameter");
      }
      const { exchangeCodeForTokens, validateOAuthState } = await import("./xero");
      const userId = validateOAuthState(state as string);
      if (!userId) {
        return res.redirect("/bookings?xero=error&message=" + encodeURIComponent("Invalid or expired OAuth state"));
      }
      await exchangeCodeForTokens(userId, code as string);
      res.redirect("/bookings?xero=connected");
    } catch (err: any) {
      console.error("Xero callback error:", err);
      res.redirect("/bookings?xero=error&message=" + encodeURIComponent(err.message));
    }
  });

  app.get("/api/xero/status", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const settings = await storage.getXeroSettings(userId);
      if (!settings) {
        return res.json({ connected: false, hasCredentials: false });
      }
      res.json({
        connected: settings.connected || false,
        hasCredentials: !!(settings.xeroClientId && settings.xeroClientSecret),
        organisationName: settings.organisationName || null,
        connectedAt: settings.connectedAt || null,
        tokenExpiresAt: settings.tokenExpiresAt || null,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/xero/disconnect", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const settings = await storage.getXeroSettings(userId);
      if (settings) {
        await storage.upsertXeroSettings(userId, {
          connected: false,
          accessToken: null,
          refreshToken: null,
          xeroTenantId: null,
          organisationName: null,
          connectedAt: null,
          tokenExpiresAt: null,
        } as any);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/xero/sync-contact/:contactId", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const contactId = parseInt(req.params.contactId);
      const { syncContactToXero } = await import("./xero");
      const xeroContactId = await syncContactToXero(userId, contactId);
      res.json({ success: true, xeroContactId });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/bookings/:id/generate-invoice", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const { generateXeroInvoice } = await import("./xero");
      const result = await generateXeroInvoice(userId, bookingId);
      if (result) {
        res.json({ success: true, ...result });
      } else {
        res.json({ success: true, skipped: true, reason: "No invoice needed (koha/package credit/zero amount)" });
      }
    } catch (err: any) {
      console.error("Failed to generate invoice:", err);
      res.status(500).json({ message: err.message || "Failed to generate invoice" });
    }
  });

  async function runAfterHoursAutoSend() {
    try {
      const allBookings = await db.select().from(bookings).where(
        and(
          eq(bookings.status, "confirmed"),
          eq(bookings.isAfterHours, true),
          eq(bookings.autoInstructionsSent, false),
        )
      );

      const now = new Date();
      const nzNow = new Date(now.toLocaleString("en-US", { timeZone: "Pacific/Auckland" }));

      for (const booking of allBookings) {
        if (!booking.startDate) continue;
        const bookingDate = new Date(new Date(booking.startDate).toLocaleString("en-US", { timeZone: "Pacific/Auckland" }));
        const todayNz = new Date(nzNow.getFullYear(), nzNow.getMonth(), nzNow.getDate());
        if (bookingDate < todayNz) continue;

        const settings = await storage.getAfterHoursSettings(booking.userId);
        if (settings && !settings.autoSendEnabled) continue;

        const sendHoursBefore = settings?.sendTimingHours || 4;
        const bookingStartTime = booking.startTime || "09:00";
        const [bh, bm] = bookingStartTime.split(":").map(Number);
        const bookingDateTime = new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate(), bh, bm);

        const sendAt = new Date(bookingDateTime.getTime() - sendHoursBefore * 60 * 60 * 1000);
        const eightAm = new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate(), 8, 0);
        const effectiveSendAt = sendAt > eightAm ? sendAt : eightAm;

        if (nzNow >= effectiveSendAt) {
          try {
            const { sendAfterHoursReminderEmail } = await import("./email");
            await sendAfterHoursReminderEmail(booking, booking.userId);
            await storage.updateBooking(booking.id, {
              autoInstructionsSent: true,
              autoInstructionsSentAt: new Date(),
            } as any);
            console.log(`After-hours reminder sent for booking ${booking.id}`);
          } catch (emailErr) {
            console.error(`Failed to send after-hours reminder for booking ${booking.id}:`, emailErr);
          }
        }
      }
    } catch (err) {
      console.error("After-hours auto-send error:", err);
    }
  }

  setInterval(runAfterHoursAutoSend, 30 * 60 * 1000);
  setTimeout(runAfterHoursAutoSend, 10000);

  startAutoSync();

  (async () => {
    try {
      const allBookers = await db.select().from(regularBookers);
      for (const booker of allBookers) {
        if (booker.loginToken) {
          const existingLinks = await storage.getBookerLinks(booker.id);
          const tokenExists = existingLinks.some(l => l.token === booker.loginToken);
          if (!tokenExists) {
            await storage.createBookerLink({
              regularBookerId: booker.id,
              token: booker.loginToken,
              tokenExpiry: booker.loginTokenExpiry || undefined,
              enabled: true,
              label: "Migrated portal link",
            });
          }
        }
      }
    } catch (err) {
      console.error("Booker link migration error:", err);
    }
  })();

  return httpServer;
}
