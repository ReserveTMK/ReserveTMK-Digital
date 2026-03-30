import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerAudioRoutes } from "./replit_integrations/audio/routes";
import { claudeJSON, isAnthropicKeyConfigured, AIKeyMissingError } from "./replit_integrations/anthropic/client";
import { getFullMonthlyReport, generateNarrative, getCommunityComparison, getTamakiOraAlignment, getDeliveryMetrics, getImpactMetrics, getTrendMetrics, getCohortMetrics, getProgrammeAttributedOutcomes, getStandoutMoments, getOperatorInsights, getParticipantTransformationStories, getPeopleTierBreakdown, getImpactTagHeatmap, getTheoryOfChangeAlignment, getGrowthStory, getOutcomeChain, getQuarterlyMilestones, evaluateDeliverables, getTaxonomyBreakdown, PASIFIKA_ETHNICITIES, type ReportFilters, type CohortDefinition, type OrgProfileContext, type FunderContext } from "./reporting";
import { renderMonthlyReport, renderQuarterlyReport, type MonthlyReportData, type QuarterlyReportData, type MaoriPipelineData } from "./report-renderer";
import { getNZWeekStart, getNZWeekEnd } from "@shared/nz-week";
import { insertCommunitySpendSchema, insertFunderSchema, insertFunderDocumentSchema, insertMeetingTypeSchema, insertMentoringRelationshipSchema, insertMentoringApplicationSchema, insertProjectSchema, insertProjectUpdateSchema, insertProjectTaskSchema, insertRegularBookerSchema, insertVenueInstructionSchema, insertSurveySchema, insertOrganisationProfileSchema, interactions, meetings, actionItems, consentRecords, memberships, mous, milestones, communitySpend, eventAttendance, impactLogContacts, impactLogs, impactTags, groupMembers, bookings, programmes, contacts, impactLogGroups, events, groups, funderDocuments, dismissedDuplicates, mentorProfiles, meetingTypes, regularBookers, surveys, bookerLinks, SESSION_FREQUENCIES, JOURNEY_STAGES, insertMonthlySnapshotSchema, insertReportHighlightSchema, HIGHLIGHT_CATEGORIES, dailyFootTraffic, groupAssociations, programmeRegistrations, insertProgrammeRegistrationSchema, insertBookableResourceSchema, insertDeskBookingSchema, insertGearBookingSchema, bookableResources, deskBookings, gearBookings, normalizeStage, DEFAULT_AVAILABILITY_SCHEDULE, DEFAULT_VENUE_AVAILABILITY_SCHEDULE, type AvailabilitySchedule, bookingChangeRequests, funderTaxonomyCategories, funderTaxonomyClassifications, funderTaxonomyMappings, funders, } from "@shared/schema";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { ObjectStorageService } from "./replit_integrations/object_storage";
import crypto from "crypto";
import { getBaseUrl } from "./url";
import { fromZonedTime } from "date-fns-tz";
import { db } from "./db";
import { eq, and, or, sql, gte, lte, inArray } from "drizzle-orm";
import { classifyForAllFunders, reclassifyAllForFunder } from "./taxonomy-engine";

function parseId(val: unknown): number {
  if (Array.isArray(val)) return parseInt(String(val[0]), 10);
  return parseInt(String(val ?? ""), 10);
}

function parseStr(val: unknown): string {
  if (Array.isArray(val)) return String(val[0]);
  return String(val ?? "");
}

function parseDate(val: unknown): Date {
  if (Array.isArray(val)) return new Date(String(val[0]));
  return new Date(String(val));
}

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
import { scanGmailEmails, confirmImport, startAutoSync, getGmailOAuth2Client, isNoreplyEmail } from "./gmail-import";
import { startCalendarAutoSync } from "./calendar-sync";

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

async function autoPromoteToInnovator(contactId: number) {
  try {
    const contact = await storage.getContact(contactId);
    if (contact && (!contact.isCommunityMember || !contact.isInnovator)) {
      const now = new Date();
      const updates: any = {
        isCommunityMember: true,
        isInnovator: true,
      };
      if (!contact.isCommunityMember && !contact.movedToCommunityAt) {
        updates.movedToCommunityAt = now;
      }
      if (!contact.isInnovator && !contact.movedToInnovatorsAt) {
        updates.movedToInnovatorsAt = now;
      }
      await storage.updateContact(contactId, updates);
    }
  } catch (err) {
    console.warn(`Failed to auto-promote contact ${contactId} to innovator:`, err);
  }
}

async function getDeskHoursForDay(userId: string, dayName: string): Promise<{ open: boolean; startTime: string; endTime: string } | null> {
  let hours = await storage.getOperatingHours(userId);
  if (hours.length === 0) {
    hours = await storage.seedDefaultOperatingHours(userId);
  }
  const dayHours = hours.find(h => h.dayOfWeek === dayName);
  if (!dayHours || !dayHours.isStaffed) return null;
  return { open: true, startTime: dayHours.openTime || "09:00", endTime: dayHours.closeTime || "17:00" };
}

async function validateDeskBookingWindow(userId: string, date: Date, startTime: string, endTime: string): Promise<string | null> {
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayName = dayNames[date.getDay()];
  const dayHours = await getDeskHoursForDay(userId, dayName);
  if (!dayHours) {
    return `Desks are not available on ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}`;
  }
  const startMins = parseTimeToMinutes(startTime);
  const endMins = parseTimeToMinutes(endTime);
  const windowStart = parseTimeToMinutes(dayHours.startTime);
  const windowEnd = parseTimeToMinutes(dayHours.endTime);
  if (startMins < windowStart || endMins > windowEnd) {
    return `Desks are only available ${dayHours.startTime} – ${dayHours.endTime}`;
  }
  return null;
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
    const userId = (req.user as any).claims.sub;
    const includeArchived = req.query.includeArchived === "true";
    const contacts = await storage.getContacts(userId, includeArchived);
    res.json(contacts);
  });

  app.get("/api/contacts/engagement-scores", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const scores = await db.execute(sql`
        SELECT
          c.id as contact_id,
          COALESCE(i.interaction_count, 0) as interactions,
          COALESCE(d.debrief_count, 0) as debriefs,
          COALESCE(e.event_count, 0) as events,
          (COALESCE(i.interaction_count, 0) + COALESCE(d.debrief_count, 0) + COALESCE(e.event_count, 0)) as total
        FROM contacts c
        LEFT JOIN (
          SELECT contact_id, COUNT(*) as interaction_count FROM interactions GROUP BY contact_id
        ) i ON i.contact_id = c.id
        LEFT JOIN (
          SELECT contact_id, COUNT(*) as debrief_count FROM impact_log_contacts GROUP BY contact_id
        ) d ON d.contact_id = c.id
        LEFT JOIN (
          SELECT contact_id, COUNT(*) as event_count FROM event_attendance GROUP BY contact_id
        ) e ON e.contact_id = c.id
        WHERE c.user_id = ${userId}
          AND c.is_community_member = false
          AND c.is_innovator = false
          AND c.is_archived = false
      `);
      const result: Record<number, { interactions: number; debriefs: number; events: number; total: number }> = {};
      for (const row of (scores as any).rows || []) {
        result[row.contact_id] = {
          interactions: Number(row.interactions),
          debriefs: Number(row.debriefs),
          events: Number(row.events),
          total: Number(row.total),
        };
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to get engagement scores" });
    }
  });

  app.get("/api/contacts/last-engaged", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const rows = await db.execute(sql`
        SELECT c.id as contact_id, GREATEST(
          (SELECT MAX(m.start_time) FROM meetings m WHERE m.contact_id = c.id AND m.status IN ('completed', 'confirmed')),
          (SELECT MAX(e.start_time) FROM events e JOIN event_attendance ea ON ea.event_id = e.id WHERE ea.contact_id = c.id),
          (SELECT MAX(il.created_at) FROM impact_logs il JOIN impact_log_contacts ilc ON ilc.impact_log_id = il.id WHERE ilc.contact_id = c.id AND il.status = 'confirmed'),
          (SELECT MAX(b.start_date) FROM bookings b WHERE b.booker_contact_id = c.id AND b.status IN ('confirmed', 'completed'))
        ) as last_engaged
        FROM contacts c
        WHERE c.user_id = ${userId} AND c.active = true AND c.is_archived = false
          AND (c.is_innovator = true OR c.is_community_member = true)
      `);
      const result: Record<number, string | null> = {};
      for (const row of (rows as any).rows || []) {
        if (row.last_engaged) {
          result[row.contact_id] = new Date(row.last_engaged).toISOString();
        }
      }
      res.json(result);
    } catch (err: any) {
      console.error("Last engaged error:", err);
      res.status(500).json({ message: "Failed to get last engaged dates" });
    }
  });

  app.get("/api/contacts/suggested-duplicates", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const allContacts = await storage.getContacts(userId);
      const dismissed = await db.select().from(dismissedDuplicates).where(and(eq(dismissedDuplicates.userId, userId), eq(dismissedDuplicates.entityType, "contact")));
      const dismissedSet = new Set(dismissed.map(d => `${Math.min(d.entityId1, d.entityId2)}-${Math.max(d.entityId1, d.entityId2)}`));

      const normalize = (s: string | null | undefined): string => {
        return (s || "").toLowerCase().trim().replace(/\s+/g, " ");
      };
      const similarity = (a: string, b: string): number => {
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
          } else if (a.email && b.email) {
            const aEmails = a.email.split(/[,;]\s*/).map(e => normalize(e)).filter(e => e.includes('@'));
            const bEmails = b.email.split(/[,;]\s*/).map(e => normalize(e)).filter(e => e.includes('@'));
            if (aEmails.some(ae => bEmails.includes(ae))) reason = "Same email";
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
    const id = parseId(req.params.id);
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
        role: req.body.role || "",
      });
      if (input.role !== "Other") {
        input.roleOther = null;
      }
      if (input.stage && !input.relationshipStage) {
        input.relationshipStage = input.stage;
      } else if (input.relationshipStage && !input.stage) {
        input.stage = input.relationshipStage;
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
      const id = parseId(req.params.id);
      const existing = await storage.getContact(id);
      if (!existing) return res.status(404).json({ message: "Contact not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      const allowedFields = ["name", "nickname", "businessName", "ventureType", "role", "roleOther", "email", "phone", "age", "ethnicity", "location", "suburb", "area", "localBoard", "tags", "revenueBand", "metrics", "notes", "active", "consentStatus", "consentDate", "consentNotes", "stage", "whatTheyAreBuilding", "relationshipStage", "isCommunityMember", "communityMemberOverride", "isInnovator", "supportType", "connectionStrength", "relationshipCircle", "relationshipCircleOverride", "vipReason"];
      const filteredBody: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          filteredBody[field] = req.body[field];
        }
      }

      if (filteredBody.stage && !filteredBody.relationshipStage) {
        filteredBody.relationshipStage = filteredBody.stage;
      } else if (filteredBody.relationshipStage && !filteredBody.stage) {
        filteredBody.stage = filteredBody.relationshipStage;
      }
      const input = api.contacts.update.input.parse(filteredBody);
      if (input.role && input.role !== "Other") {
        input.roleOther = null;
      }
      if ((input as any).metrics && existing.metrics && typeof existing.metrics === "object" && Object.keys(existing.metrics).length > 0) {
        try {
          await storage.createMetricSnapshot({
            contactId: id,
            userId: existing.userId,
            metrics: existing.metrics as any,
            source: "manual",
          });
        } catch (err) {
          console.error("Failed to create metric snapshot:", err);
        }
      }
      const updated = await storage.updateContact(id, input);

      // Auto-create mentoring relationship for innovators with mentoring support
      if (updated.isInnovator && updated.supportType && 
          updated.supportType.includes("mentoring")) {
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
            focusAreas: "" as any
          } as any);
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
    const id = parseId(req.params.id);
    const existing = await storage.getContact(id);
    if (!existing) return res.status(404).json({ message: "Contact not found" });
    if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

    await storage.archiveContact(id);
    res.status(204).send();
  });

  app.post(api.contacts.restore.path, isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
    const existing = await storage.getContact(id);
    if (!existing) return res.status(404).json({ message: "Contact not found" });
    if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

    await storage.restoreContact(id);
    res.json({ message: "Contact restored" });
  });

  app.post("/api/mentoring-relationships/backfill-from-support-type", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const allContacts = await storage.getContacts(userId);
      let createdCount = 0;

      for (const contact of allContacts) {
        if (contact.isInnovator && contact.supportType && 
            contact.supportType.includes("mentoring")) {
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
              focusAreas: "" as any
            } as any);
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
      const contactId = parseId(req.params.id);
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
      const contactId = parseId(req.params.id);
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
            title: (event as any).title || event.name || "Event",
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
            title: `${(m as any).type || "Membership"} - ${m.status || "active"}`,
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
    const contactId = req.query.contactId ? parseId(req.query.contactId) : undefined;
    
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

    } catch (error: any) {
      if (error instanceof AIKeyMissingError) return res.status(503).json({ message: error.message });
      console.error("Analysis error:", error);
      res.status(500).json({ message: "Failed to analyze text" });
    }
  });

  // === Google Calendar Event Helper ===
  async function createCalendarEventForMeeting(calUserId: string, meeting: any, options?: { mentorEmail?: string; coMentorEmail?: string; menteeEmail?: string; calendarId?: string; sendInvites?: boolean; additionalAttendees?: string[] }) {
    try {
      const { getUncachableGoogleCalendarClient } = await import("./replit_integrations/google-calendar/client");
      const calendar = await getUncachableGoogleCalendarClient(calUserId);

      const attendees: { email: string }[] = [];
      if (options?.mentorEmail) attendees.push({ email: options.mentorEmail });
      if (options?.coMentorEmail) attendees.push({ email: options.coMentorEmail });
      if (options?.menteeEmail) attendees.push({ email: options.menteeEmail });
      if (options?.additionalAttendees) {
        for (const ae of options.additionalAttendees) {
          if (!attendees.some(a => a.email === ae)) attendees.push({ email: ae });
        }
      }

      const calDescription = meeting.description || [
        meeting.mentoringFocus ? `Focus: ${meeting.mentoringFocus}` : null,
        meeting.notes ? `Notes: ${meeting.notes}` : null,
        meeting.location ? `Location: ${meeting.location}` : null,
      ].filter(Boolean).join("\n");

      const event = await calendar.events.insert({
        calendarId: options?.calendarId || "primary",
        sendUpdates: options?.sendInvites ? "all" : "none",
        requestBody: {
          summary: meeting.title,
          description: calDescription || undefined,
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
      console.error("Google Calendar event creation failed:", err.message, err.response?.data || "");
      return null;
    }
  }

  async function updateCalendarEventAttendees(calUserId: string, googleCalendarEventId: string, attendees: { email: string }[], calendarId?: string, sendInvites?: boolean) {
    try {
      const { getUncachableGoogleCalendarClient } = await import("./replit_integrations/google-calendar/client");
      const calendar = await getUncachableGoogleCalendarClient(calUserId);
      const calId = calendarId || "primary";
      
      const existing = await calendar.events.get({ calendarId: calId, eventId: googleCalendarEventId });
      await calendar.events.patch({
        calendarId: calId,
        eventId: googleCalendarEventId,
        sendUpdates: sendInvites ? "all" : "none",
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
    for (const mid of Array.from(mentorUserIds)) {
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
      for (const mid of Array.from(mentorUserIds)) {
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
    const id = parseId(req.params.id);
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

      // Conflict check — prevent double-booking the same mentor slot
      const existingMeetings = await storage.getMeetings(effectiveUserId);
      const hasConflict = existingMeetings.some((m: any) => {
        if (m.status === 'cancelled') return false;
        const mStart = new Date(m.startTime);
        const mEnd = new Date(m.endTime);
        return input.startTime < mEnd && input.endTime > mStart;
      });
      if (hasConflict) {
        return res.status(409).json({
          message: "This time slot conflicts with an existing booking.",
          code: "SLOT_CONFLICT",
        });
      }

      const meeting = await storage.createMeeting(input);

      if (req.body.discoveryGoals && contact) {
        try {
          const existingRelationships = await storage.getMentoringRelationshipsByContact(contact.id);
          const hasActiveOrApplication = existingRelationships.some(r => r.status === "active" || r.status === "application");
          if (!hasActiveOrApplication) {
            const dg = req.body.discoveryGoals;
            await storage.createMentoringApplication({
              contactId: contact.id,
              status: "pending",
              ventureDescription: dg.ventureDescription || null,
              currentStage: dg.currentStage || null,
              whatNeedHelpWith: dg.whatNeedHelpWith || null,
            });
          }
        } catch (appErr) {
          console.warn("Failed to create discovery mentoring application:", appErr);
        }
      }

      // Create Google Calendar event asynchronously
      const sendInvites = req.body.sendInvites === true;
      (async () => {
        try {
          const profiles = await storage.getMentorProfiles(userId);
          const mentorProfile = profiles.find(p => p.mentorUserId === effectiveUserId || `mentor-${p.id}` === effectiveUserId) || profiles[0];
          const mentorEmail = mentorProfile?.email || undefined;
          const calendarId = mentorProfile?.googleCalendarId || undefined;
          const menteeEmail = contact.email || undefined;

          const extraEmails = Array.isArray(req.body.attendees)
            ? req.body.attendees.filter((a: any) => a.email).map((a: any) => a.email as string)
            : [];

          const eventId = await createCalendarEventForMeeting(userId, meeting, {
            mentorEmail,
            menteeEmail,
            calendarId,
            sendInvites,
          });

          if (extraEmails.length > 0 && eventId) {
            const allAttendees: { email: string }[] = [];
            if (mentorEmail) allAttendees.push({ email: mentorEmail });
            if (menteeEmail) allAttendees.push({ email: menteeEmail });
            extraEmails.forEach((email: string) => {
              if (!allAttendees.some(a => a.email === email)) {
                allAttendees.push({ email });
              }
            });
            await updateCalendarEventAttendees(userId, eventId, allAttendees, calendarId, sendInvites);
          }
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
      const id = parseId(req.params.id);
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

      if (('coMentorProfileId' in req.body || 'attendees' in req.body) && updated.googleCalendarEventId) {
        (async () => {
          try {
            const profiles = await storage.getMentorProfiles(userId);
            const calAttendees: { email: string }[] = [];
            const mentorProfile = profiles.find(p => p.mentorUserId === updated.userId || `mentor-${p.id}` === updated.userId);
            if (mentorProfile?.email) calAttendees.push({ email: mentorProfile.email });
            if (updated.coMentorProfileId) {
              const coMentor = await storage.getMentorProfile(updated.coMentorProfileId);
              if (coMentor?.email) calAttendees.push({ email: coMentor.email });
            }
            const contact = await storage.getContact(updated.contactId);
            if (contact?.email) calAttendees.push({ email: contact.email });
            const extraAttendees = Array.isArray(updated.attendees) ? (updated.attendees as any[]) : [];
            extraAttendees.forEach((a: any) => {
              if (a.email && !calAttendees.some(e => e.email === a.email)) {
                calAttendees.push({ email: a.email });
              }
            });
            await updateCalendarEventAttendees(userId, updated.googleCalendarEventId!, calAttendees, mentorProfile?.googleCalendarId || undefined, true);
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
    const id = parseId(req.params.id);
    const existing = await storage.getMeeting(id);
    if (!existing) return res.status(404).json({ message: "Meeting not found" });
    if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

    await storage.deleteMeeting(id);
    res.status(204).send();
  });

  app.post('/api/meetings/:id/debrief', isAuthenticated, async (req, res) => {
    try {
      const meetingId = parseId(req.params.id);
      const userId = (req.user as any).claims.sub;
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) return res.status(404).json({ message: "Meeting not found" });
      let authorized = meeting.userId === userId;
      if (!authorized) {
        const profiles = await storage.getMentorProfiles(userId);
        const mentorUserIds = new Set<string>();
        for (const p of profiles) {
          if (p.mentorUserId) mentorUserIds.add(p.mentorUserId);
          mentorUserIds.add(`mentor-${p.id}`);
        }
        authorized = mentorUserIds.has(meeting.userId);
      }
      if (!authorized) return res.status(403).json({ message: "Forbidden" });

      const { transcript, summary, analysis, type } = req.body;
      if (!transcript && !summary) {
        return res.status(400).json({ message: "Transcript or summary required" });
      }

      let interaction;
      try {
        interaction = await storage.createInteraction({
          contactId: meeting.contactId,
          date: new Date(),
          type: type || "Mentoring Debrief",
          transcript: transcript || null,
          summary: summary || null,
          analysis: analysis || null,
          keywords: analysis?.keyInsights || [],
        } as any);
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

  app.post('/api/meetings/:id/send-notes', isAuthenticated, async (req, res) => {
    try {
      const meetingId = parseId(req.params.id);
      const userId = (req.user as any).claims.sub;
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) return res.status(404).json({ message: "Meeting not found" });

      let authorized = meeting.userId === userId;
      if (!authorized) {
        const profiles = await storage.getMentorProfiles(userId);
        const mentorUserIds = new Set<string>();
        for (const p of profiles) {
          if (p.mentorUserId) mentorUserIds.add(p.mentorUserId);
          mentorUserIds.add(`mentor-${p.id}`);
        }
        authorized = mentorUserIds.has(meeting.userId);
      }
      if (!authorized) return res.status(403).json({ message: "Forbidden" });

      const contact = await storage.getContact(meeting.contactId);
      if (!contact?.email) return res.status(400).json({ message: "Mentee has no email address" });

      const summary = meeting.notes;
      if (!summary) return res.status(400).json({ message: "No session notes to send" });

      const { sendSessionNotesEmail } = await import("./email");
      await sendSessionNotesEmail(contact.email, contact.name, new Date(meeting.startTime), summary, meeting.nextSteps);

      res.json({ message: "Session notes sent" });
    } catch (err: any) {
      console.error("Send session notes error:", err);
      res.status(500).json({ message: "Failed to send session notes" });
    }
  });

  function getOnboardingAnswer(answers: Record<string, string> | null | undefined, keywords: string[]): string | null {
    if (!answers || typeof answers !== 'object') return null;
    const lowerKeys = Object.keys(answers);
    for (const keyword of keywords) {
      const match = lowerKeys.find(k => k.toLowerCase().includes(keyword.toLowerCase()));
      if (match && answers[match]) return String(answers[match]);
    }
    return null;
  }

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
      for (const mid of Array.from(mentorUserIds)) {
        const m = await storage.getMeetings(mid);
        allMeetings.push(...m.filter(mt => mt.type === "mentoring" || !mt.type));
      }

      const allApplications = await storage.getMentoringApplications();

      const enriched = filtered.map(r => {
        const contact = userContacts.find(c => c.id === r.contactId);
        const sessions = allMeetings.filter(m => m.contactId === r.contactId);
        const completedSessions = sessions.filter(s => s.status === "completed");
        const upcomingSessions = sessions.filter(s => new Date(s.startTime) >= new Date() && s.status !== "cancelled");
        const lastSession = completedSessions.sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];

        const contactApps = allApplications
          .filter(a => a.contactId === r.contactId)
          .sort((a, b) => {
            if (a.status === "accepted" && b.status !== "accepted") return -1;
            if (b.status === "accepted" && a.status !== "accepted") return 1;
            return new Date(b.applicationDate || 0).getTime() - new Date(a.applicationDate || 0).getTime();
          });
        const application = contactApps[0] || null;

        return {
          ...r,
          contactName: contact?.name || "Unknown",
          contactEmail: contact?.email,
          stage: contact?.stage,
          ventureType: contact?.ventureType,
          whatTheyAreBuilding: contact?.whatTheyAreBuilding,
          supportType: contact?.supportType,
          completedSessionCount: completedSessions.length,
          upcomingSessionCount: upcomingSessions.length,
          totalSessionCount: sessions.filter(s => s.status !== "cancelled").length,
          lastSessionDate: lastSession ? lastSession.startTime : null,
          lastSessionFocus: lastSession ? lastSession.mentoringFocus : null,
          recentSessionIds: completedSessions.slice(0, 5).map((s: any) => s.id),
          ventureDescription: application?.ventureDescription || null,
          whatNeedHelpWith: application?.whatNeedHelpWith || null,
          whyMentoring: application?.whyMentoring || getOnboardingAnswer(application?.onboardingAnswers, ["why mentoring", "why are you"]),
          whatStuckOn: application?.whatStuckOn || getOnboardingAnswer(application?.onboardingAnswers, ["stuck on", "stuck", "blockers", "challenges"]),
          alreadyTried: application?.alreadyTried || getOnboardingAnswer(application?.onboardingAnswers, ["already tried", "tried so far", "attempted"]),
          timeCommitmentPerWeek: application?.timeCommitmentPerWeek || getOnboardingAnswer(application?.onboardingAnswers, ["hours", "time commitment", "commit"]),
          onboardingAnswers: application?.onboardingAnswers || null,
          applicationNotes: application?.reviewNotes || null,
          applicationId: application?.id || null,
          currentMetrics: contact?.metrics || null,
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
      const id = parseId(req.params.id);
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

      const allowedMetricKeys = ['mindset', 'skill', 'confidence', 'bizConfidence', 'systemsInPlace', 'fundingReadiness', 'networkStrength'];
      let reqBaseline: Record<string, number> | null = null;
      if (req.body.baselineMetrics && typeof req.body.baselineMetrics === 'object') {
        const sanitized: Record<string, number> = {};
        for (const key of allowedMetricKeys) {
          const val = Number(req.body.baselineMetrics[key]);
          if (!isNaN(val)) sanitized[key] = Math.min(10, Math.max(1, Math.round(val)));
        }
        if (Object.keys(sanitized).length > 0) reqBaseline = sanitized;
      }

      const relationship = await storage.createMentoringRelationship({
        contactId: application.contactId,
        status: "active",
        startDate: new Date(),
        focusAreas: reqFocusAreas || application.whatNeedHelpWith || application.ventureDescription || null,
        sessionFrequency: reqFrequency,
        baselineMetrics: reqBaseline,
      });

      const existingContact = await storage.getContact(application.contactId);
      const now = new Date();
      const contactUpdate: any = {
        isCommunityMember: true,
        isInnovator: true,
        stage: reqStage,
        relationshipStage: reqStage,
      };
      if (!existingContact?.movedToCommunityAt) contactUpdate.movedToCommunityAt = now;
      if (!existingContact?.movedToInnovatorsAt) contactUpdate.movedToInnovatorsAt = now;
      if (reqBaseline) {
        const existingMetrics = existingContact?.metrics as Record<string, any> | null;
        if (!existingMetrics || Object.keys(existingMetrics).length === 0) {
          contactUpdate.metrics = reqBaseline;
        }
      }
      try {
        await storage.updateContact(application.contactId, contactUpdate);
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
      const user = await storage.getUser(userId);
      const userName = user?.username || user?.email || 'Mentor';
      const userEmail = user?.email || '';
      await storage.createMentorProfile({ userId, mentorUserId: userId, name: userName, email: userEmail, isActive: true, googleCalendarId: null });
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
    const id = parseId(req.params.id);
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
    const id = parseId(req.params.id);
    const userId = (req.user as any).claims.sub;
    const existing = await storage.getMentorProfile(id);
    if (!existing) return res.status(404).json({ message: "Mentor not found" });
    if (existing.userId !== userId) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteMentorProfile(id);
    res.status(204).send();
  });

  app.get('/api/mentor-availability', isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const forMentor = parseStr(req.query.mentorUserId) || undefined;
    const category = parseStr(req.query.category) || undefined;
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
    const id = parseId(req.params.id);
    const userId = (req.user as any).claims.sub;
    const existing = await storage.getMentorAvailabilityById(id);
    if (!existing) return res.status(404).json({ message: "Availability slot not found" });
    const allowed = await isMentorOwner(userId, existing.userId);
    if (!allowed) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.updateMentorAvailability(id, req.body);
    res.json(updated);
  });

  app.delete('/api/mentor-availability/:id', isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
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
      const category = parseStr(req.query.category) || undefined;
      let types = await storage.getMeetingTypes(userId);
      const allDefaults = [
        { userId, name: 'Quick Chat', description: 'A brief check-in or introduction', duration: 15, focus: 'General Catch-up', color: '#22c55e', isActive: true, sortOrder: 0, category: 'mentoring' },
        { userId, name: 'Standard Session', description: 'A regular mentoring session', duration: 30, focus: 'Goal Setting', color: '#3b82f6', isActive: true, sortOrder: 1, category: 'mentoring' },
        { userId, name: 'Deep Dive', description: 'An in-depth working session', duration: 60, focus: 'Venture Planning', color: '#8b5cf6', isActive: true, sortOrder: 2, category: 'mentoring' },
        { userId, name: 'Catchup', description: 'Informal catch-up meeting', duration: 30, focus: null, color: '#f59e0b', isActive: true, sortOrder: 3, category: 'business' },
        { userId, name: 'Funder Meeting', description: 'Meeting with funder or reporting contact', duration: 60, focus: null, color: '#ef4444', isActive: true, sortOrder: 4, category: 'business' },
        { userId, name: 'Partnership', description: 'Partnership or collaboration discussion', duration: 45, focus: null, color: '#06b6d4', isActive: true, sortOrder: 5, category: 'business' },
        { userId, name: 'Coffee Chat', description: 'Quick informal coffee meeting', duration: 15, focus: null, color: '#a855f7', isActive: true, sortOrder: 6, category: 'business' },
      ];
      const existingNames = new Set(types.map(t => t.name));
      const missing = allDefaults.filter(d => !existingNames.has(d.name));
      if (missing.length > 0) {
        for (const d of missing) {
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
      const id = parseId(req.params.id);
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
      const id = parseId(req.params.id);
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

  app.get('/api/public/mentoring/:userId/mentors', async (req, res) => {
    try {
      const { userId } = req.params;
      const resolved = await resolveMentorUserId(userId);
      const ownerUserId = resolved.ownerUserId || resolved.availabilityUserId;
      const profiles = await storage.getMentorProfiles(ownerUserId);
      const activeMentors = profiles.filter(p => p.isActive);
      res.json(activeMentors.map(p => ({
        id: p.id,
        name: p.name,
        mentorBookingId: p.mentorUserId ? p.mentorUserId : `mentor-${p.id}`,
      })));
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch mentors" });
    }
  });

  app.get('/api/public/mentoring/:userId/meeting-types', async (req, res) => {
    try {
      const { userId } = req.params;
      const category = parseStr(req.query.category) || undefined;
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
      const category = parseStr(req.query.category) || undefined;
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

  function toNzDate(dateStr: string, timeStr: string = '00:00:00'): Date {
    return fromZonedTime(`${dateStr}T${timeStr}`, 'Pacific/Auckland');
  }

  app.get('/api/public/mentoring/:userId/slots', async (req, res) => {
    try {
      const { userId } = req.params;
      const { date, category, duration } = req.query;
      if (!date || typeof date !== 'string') {
        return res.status(400).json({ message: "date query parameter required (YYYY-MM-DD)" });
      }
      const requestedDuration = duration && typeof duration === 'string' ? parseInt(duration, 10) : null;

      const resolved = await resolveMentorUserId(userId);
      const availabilitySlots = await storage.getMentorAvailability(resolved.availabilityUserId);
      let activeSlots = availabilitySlots.filter(s => s.isActive);
      if (category && typeof category === 'string') {
        activeSlots = activeSlots.filter(s => s.category === category);
      }

      const targetDate = toNzDate(date, '00:00:00');
      const jsDay = targetDate.getUTCDay();
      const nzDayOfWeek = new Date(targetDate.getTime()).toLocaleDateString('en-US', { timeZone: 'Pacific/Auckland', weekday: 'short' });
      const dayMap: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
      const dayOfWeek = dayMap[nzDayOfWeek] ?? (jsDay === 0 ? 6 : jsDay - 1);

      const daySlots = activeSlots.filter(s => s.dayOfWeek === dayOfWeek);
      if (daySlots.length === 0) {
        return res.json({ date, slots: [] });
      }

      const existingMeetings = await storage.getMeetings(resolved.availabilityUserId);
      const dayStart = toNzDate(date, '00:00:00');
      const dayEnd = toNzDate(date, '23:59:59');
      const dayMeetings = existingMeetings.filter(m => {
        const mStart = new Date(m.startTime);
        return mStart >= dayStart && mStart <= dayEnd && m.status !== 'cancelled';
      });

      const freeSlots: { time: string; endTime: string }[] = [];

      for (const avail of daySlots) {
        const slotDur = avail.slotDuration || 30;
        const meetingDur = requestedDuration && requestedDuration > 0 ? requestedDuration : slotDur;
        const buffer = avail.bufferMinutes || 15;
        const [startH, startM] = avail.startTime.split(':').map(Number);
        const [endH, endM] = avail.endTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        for (let t = startMinutes; t + meetingDur <= endMinutes; t += slotDur + buffer) {
          const slotStart = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
          const slotEndMin = t + meetingDur;
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
        const slotDate = toNzDate(date, s.time + ':00');
        return slotDate > now;
      });

      try {
        const { getUncachableGoogleCalendarClient } = await import("./replit_integrations/google-calendar/client");
        const calendar = await getUncachableGoogleCalendarClient(userId);

        const queryStart = toNzDate(date, '00:00:00');
        const queryEnd = toNzDate(date, '23:59:59');

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
            const slotStartUTC = toNzDate(date, s.time + ':00');
            const slotEndUTC = toNzDate(date, s.endTime + ':00');
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
      let firstName = '';
      let lastName = '';

      const resolved = await resolveMentorUserId(userId);
      const resolvedOwnerUserId = resolved.ownerUserId || resolved.availabilityUserId;

      if (userId.startsWith('mentor-')) {
        const mentorId = parseInt(userId.replace('mentor-', ''));
        const profile = await storage.getMentorProfile(mentorId);
        if (!profile) return res.status(404).json({ message: "Not found" });
        const nameParts = profile.name.split(' ');
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(' ') || '';
      } else {
        const { users } = await import("@shared/schema");
        const result = await db.select().from(users).where(eq(users.id, userId));
        if (result.length === 0) return res.status(404).json({ message: "Not found" });
        firstName = result[0].firstName || '';
        lastName = result[0].lastName || '';
      }

      let location: string | null = null;
      let locationInstructions: Record<string, any> | null = null;
      try {
        const orgProfile = await storage.getOrganisationProfile(resolvedOwnerUserId);
        if (orgProfile) {
          location = orgProfile.location || null;
          locationInstructions = orgProfile.locationInstructions || null;
        }
      } catch (e) {}

      res.json({ firstName, lastName, orgName: 'ReserveTMK Digital', location, locationInstructions });
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
      const { name, email, phone, date, time, duration, notes, meetingTypeId, pathway, onboardingAnswers, discoveryGoals, extras, relationship_stage, ethnicity, consentGiven } = req.body;

      if (!name || !date || !time) {
        return res.status(400).json({ message: "name, date, and time are required" });
      }

      const slotDuration = duration || 30;
      const startTime = toNzDate(date, time + ':00');
      const endTime = new Date(startTime.getTime() + slotDuration * 60 * 1000);

      // Conflict check — prevent double-booking the same mentor slot
      const existingMeetings = await storage.getMeetings(meetingUserId);
      const hasConflict = existingMeetings.some((m: any) => {
        if (m.status === 'cancelled') return false;
        const mStart = new Date(m.startTime);
        const mEnd = new Date(m.endTime);
        return startTime < mEnd && endTime > mStart;
      });
      if (hasConflict) {
        return res.status(409).json({
          message: "This time slot is no longer available. Please choose another time.",
          code: "SLOT_CONFLICT",
        });
      }

      let contact;
      let isNewContact = false;
      if (email) {
        const allContacts = await storage.getContacts(contactOwnerUserId);
        contact = allContacts.find((c: any) => c.email && c.email.toLowerCase() === email.toLowerCase());
      }
      if (!contact) {
        isNewContact = true;
        const newContactData: any = {
          userId: contactOwnerUserId,
          name,
          email: email || null,
          phone: phone || null,
          role: 'Entrepreneur',
          active: true,
        };
        // Set relationship_stage from onboarding flow (kakano/tipu/ora) — never shown to user
        if (relationship_stage && ['kakano', 'tipu', 'ora'].includes(relationship_stage)) {
          newContactData.relationshipStage = relationship_stage;
        }
        if (ethnicity && Array.isArray(ethnicity) && ethnicity.length > 0) {
          newContactData.ethnicity = ethnicity;
        }
        contact = await storage.createContact(newContactData);
      } else if (relationship_stage && ['kakano', 'tipu', 'ora'].includes(relationship_stage)) {
        // Update existing contact's relationship stage if provided
        try {
          await storage.updateContact(contact.id, { relationshipStage: relationship_stage });
        } catch (e) {
          console.warn('Failed to update relationship_stage on existing contact:', e);
        }
      }

      const meetingType = (pathway === 'meeting') ? 'catchup' : 'mentoring';
      const meetingTitle = (pathway === 'meeting') ? `Meeting: ${name}` : `Mentoring: ${name}`;

      const meeting = await storage.createMeeting({
        userId: meetingUserId,
        contactId: contact.id,
        title: meetingTitle,
        description: null,
        startTime,
        endTime,
        status: 'scheduled',
        location: null,
        type: meetingType,
        duration: slotDuration,
        bookingSource: 'public_link',
        notes: notes || null,
        meetingTypeId: meetingTypeId ? parseInt(meetingTypeId) : undefined,
      });

      // Re-activation: reactivate an existing graduated/ended relationship
      if (pathway === 'mentoring' && req.body.reactivationRelationshipId) {
        try {
          const relId = parseInt(req.body.reactivationRelationshipId);
          const existingRel = await storage.getMentoringRelationship(relId);
          if (existingRel && (existingRel.status === 'graduated' || existingRel.status === 'ended')) {
            const updateData: any = {
              status: 'active',
              endDate: null,
              startDate: new Date(),
            };
            if (req.body.updatedFocusAreas) updateData.focusAreas = req.body.updatedFocusAreas;
            await storage.updateMentoringRelationship(relId, updateData);
            // Re-activate the contact
            await storage.updateContact(existingRel.contactId, {
              stage: 'kakano',
              isCommunityMember: true,
            });
          }
        } catch (reactivateErr) {
          console.warn("Failed to reactivate relationship:", reactivateErr);
        }
      } else if (pathway === 'mentoring' && isNewContact) {
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
          // Store relationship_stage from new onboarding flow
          if (relationship_stage && ['kakano', 'tipu', 'ora'].includes(relationship_stage)) {
            appData.currentStage = appData.currentStage || relationship_stage;
          }
          await storage.createMentoringApplication(appData);
        } catch (appErr) {
          console.warn("Failed to create mentoring application:", appErr);
        }
      }

      (async () => {
        try {
          let orgLocation: string | null = null;
          let orgLocationInstructions: Record<string, { howToFindUs?: string; parking?: string; generalInfo?: string }> | null = null;
          try {
            const orgProfile = await storage.getOrganisationProfile(contactOwnerUserId);
            if (orgProfile) {
              orgLocation = orgProfile.location || null;
              orgLocationInstructions = orgProfile.locationInstructions || null;
            }
          } catch (e) {}

          const directionsText = orgLocationInstructions ? Object.entries(orgLocationInstructions)
            .filter(([_, v]) => v && (v.howToFindUs || v.parking || v.generalInfo))
            .map(([k, v]) => {
              const parts = [];
              if (v.howToFindUs) parts.push(v.howToFindUs);
              if (v.parking) parts.push(`Parking: ${v.parking}`);
              if (v.generalInfo) parts.push(v.generalInfo);
              return `${k}: ${parts.join('. ')}`;
            })
            .join('\n') : '';

          const descriptionParts = [
            notes ? `Notes: ${notes}` : null,
            orgLocation ? `Location: ${orgLocation}` : null,
            directionsText ? `\nHow to find us:\n${directionsText}` : null,
          ].filter(Boolean).join('\n');

          const meetingWithLocation = {
            ...meeting,
            location: orgLocation || meeting.location,
            description: descriptionParts || meeting.description,
          };

          const mentorEmail = resolved.ownerUserId ? 
            (await storage.getMentorProfiles(resolved.ownerUserId))
              .find(p => p.mentorUserId === meetingUserId || `mentor-${p.id}` === meetingUserId)?.email : undefined;
          const additionalAttendees = Array.isArray(extras) ? extras.filter((e: string) => e && e.includes('@')) : [];
          await createCalendarEventForMeeting(contactOwnerUserId, meetingWithLocation, {
            mentorEmail: mentorEmail || undefined,
            menteeEmail: email || undefined,
            calendarId: resolved.googleCalendarId || undefined,
            sendInvites: true,
            additionalAttendees: additionalAttendees.length > 0 ? additionalAttendees : undefined,
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
      const email = parseStr(req.query.email);
      const name = parseStr(req.query.name);
      const resolved = await resolveMentorUserId(userId);
      const ownerUserId = resolved.ownerUserId || resolved.availabilityUserId;
      const allContacts = await storage.getContacts(ownerUserId);

      if (email) {
        const contact = allContacts.find((c: any) => c.email && c.email.toLowerCase() === email.toLowerCase());
        if (!contact) return res.json({ isReturning: false });
        const relationships = await storage.getMentoringRelationshipsByContact(contact.id);
        const hasActive = relationships.some((r: any) => r.status === 'active' || r.status === 'on_hold');
        if (hasActive) {
          return res.json({ isReturning: true, contactName: contact.name, matchedByEmail: true });
        }
        // Check for graduated/ended — re-activation path
        const previousRel = relationships.find((r: any) => r.status === 'graduated' || r.status === 'ended');
        if (previousRel) {
          return res.json({
            isReturning: false,
            isReactivation: true,
            contactName: contact.name,
            matchedByEmail: true,
            previousRelationshipId: previousRel.id,
            previousFocusAreas: previousRel.focusAreas || null,
          });
        }
        return res.json({ isReturning: false, contactName: contact.name, matchedByEmail: true });
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
          // Check for graduated/ended — re-activation path
          const previousRel = relationships.find((r: any) => r.status === 'graduated' || r.status === 'ended');
          if (previousRel) {
            return res.json({
              isReturning: false,
              isReactivation: true,
              contactName: contact.name,
              nameFound: true,
              previousRelationshipId: previousRel.id,
              previousFocusAreas: previousRel.focusAreas || null,
            });
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

  // === Public Programme Registration API ===

  app.get('/api/public/programme/:slug', async (req, res) => {
    try {
      const programme = await storage.getProgrammeBySlug(req.params.slug);
      if (!programme || !programme.publicRegistrations) {
        return res.status(404).json({ message: "Programme not found" });
      }
      const registrationCount = await storage.getProgrammeRegistrationCount(programme.id);
      const spotsRemaining = programme.capacity ? programme.capacity - registrationCount : null;
      res.json({
        id: programme.id,
        name: programme.name,
        description: programme.description,
        classification: programme.classification,
        startDate: programme.startDate,
        endDate: programme.endDate,
        startTime: programme.startTime,
        endTime: programme.endTime,
        location: programme.location,
        capacity: programme.capacity,
        registrationCount,
        spotsRemaining,
        isFull: programme.capacity ? registrationCount >= programme.capacity : false,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch programme" });
    }
  });

  app.post('/api/public/programme/:slug/register', async (req, res) => {
    try {
      const programme = await storage.getProgrammeBySlug(req.params.slug);
      if (!programme || !programme.publicRegistrations) {
        return res.status(404).json({ message: "Programme not found" });
      }

      const { firstName, lastName, email, phone, organization, dietaryRequirements, accessibilityNeeds, referralSource } = req.body;
      if (!firstName || !lastName || !email) {
        return res.status(400).json({ message: "First name, last name, and email are required" });
      }

      const registrationCount = await storage.getProgrammeRegistrationCount(programme.id);
      if (programme.capacity && registrationCount >= programme.capacity) {
        return res.status(400).json({ message: "This programme is at full capacity", code: "FULL" });
      }

      const existingRegs = await storage.getProgrammeRegistrations(programme.id);
      const alreadyRegistered = existingRegs.find(
        r => r.email.toLowerCase() === email.toLowerCase() && r.status === "registered"
      );
      if (alreadyRegistered) {
        return res.status(400).json({ message: "You are already registered for this programme", code: "DUPLICATE" });
      }

      let contactId: number | null = null;
      const ownerContacts = await storage.getContacts(programme.userId);
      const existingContact = ownerContacts.find(
        c => c.email && c.email.toLowerCase() === email.toLowerCase()
      );

      if (existingContact) {
        contactId = existingContact.id;
        await storage.updateContact(existingContact.id, { updatedAt: new Date() } as any);
        await autoPromoteToInnovator(existingContact.id);
      } else {
        const now = new Date();
        const newContact = await storage.createContact({
          userId: programme.userId,
          name: `${firstName} ${lastName}`,
          email,
          phone: phone || null,
          role: null,
          stage: "kakano",
          active: true,
          source: "programme_registration",
          isCommunityMember: true,
          isInnovator: true,
          movedToCommunityAt: now,
          movedToInnovatorsAt: now,
        } as any);
        contactId = newContact.id;
      }

      const registration = await storage.createProgrammeRegistration({
        programmeId: programme.id,
        contactId,
        userId: programme.userId,
        firstName,
        lastName,
        email,
        phone: phone || null,
        organization: organization || null,
        dietaryRequirements: dietaryRequirements || null,
        accessibilityNeeds: accessibilityNeeds || null,
        referralSource: referralSource || null,
        status: "registered",
        attended: false,
      });

      res.json({ success: true, registration });
    } catch (err) {
      console.error("Registration error:", err);
      res.status(500).json({ message: "Failed to register" });
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
        if (e.requiresDebrief === false) return false;
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
      const id = parseId(req.params.id);
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
    const id = parseId(req.params.id);
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
    const id = parseId(req.params.id);
    await storage.deleteKeyword(id);
    res.status(204).send();
  });

  // === Action Items API ===

  app.get(api.actionItems.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const contactId = req.query.contactId ? parseId(req.query.contactId) : undefined;
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
      const id = parseId(req.params.id);
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
    const id = parseId(req.params.id);
    await storage.deleteActionItem(id);
    res.status(204).send();
  });

  // === Consent API ===

  app.get(api.consent.list.path, isAuthenticated, async (req, res) => {
    const contactId = parseId(req.params.id);
    const contact = await storage.getContact(contactId);
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    if (contact.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    const records = await storage.getConsentRecords(contactId);
    res.json(records);
  });

  app.post(api.consent.create.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const contactId = parseId(req.params.id);
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
      const { transcript, title, existingLogId, skipAnalysis } = req.body;
      if (!transcript) return res.status(400).json({ message: "Transcript text required" });

      if (skipAnalysis) {
        const impactLog = await storage.createImpactLog({
          userId,
          title: title || "Untitled Debrief",
          transcript,
          summary: "",
          status: "draft",
        });
        return res.status(201).json({ id: impactLog.id, impactLog });
      }

      const taxonomy = await storage.getTaxonomy(userId);
      const keywords = await storage.getKeywords(userId);
      const contacts = await storage.getContacts(userId);
      const groups = await storage.getGroups(userId);

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

      const groupsContext = groups.map(g =>
        `- ${g.name}${g.type ? ` (${g.type})` : ''} [ID: ${g.id}]`
      ).join('\n');

      const prompt = `You are an impact analysis system for ReserveTMK Digital, a Māori and Pasifika entrepreneurship hub in Aotearoa New Zealand. Analyze the following debrief transcript and extract structured data for both community impact tracking and operational management.

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
- Handle te reo Māori: whānau (family), rangatahi (youth), mahi (work), kaupapa (purpose), kōrero (talk/discussion), hui (meeting), wānanga (workshop/learning), aroha (care/compassion), manaaki (hospitality/support), tautoko (support), tangata whenua (people of the land), mana whenua (territorial authority), hapū (sub-tribe), iwi (tribe), marae (meeting ground), tikanga (customs), pōwhiri (welcome ceremony), mihi (greeting), koha (gift/donation), taonga (treasure), pūtea (money/funds), matua (parent/elder), tuakana (elder sibling/mentor), teina (younger sibling/mentee), kaiako (teacher), kaimahi (worker), kaitiaki (guardian), whakawhanaungatanga (relationship building), kotahitanga (unity), rangatiratanga (self-determination), oranga (wellbeing), tamariki (children), pēpi (baby), mokopuna (grandchild)
- NZ slang: sorted (arranged), keen as (very interested), sweet (confirmed), stoked (very happy), hard out (enthusiastically), all good (fine/ok), buzzing (excited), choice (great)
- TRANSCRIPTION CORRECTION: Audio transcription often misspells te reo Māori words and NZ place names. Common errors to watch for:
  * Macrons dropped: "whanau" should be "whānau", "Tamaki" may mean "Tāmaki", "Maori" should be "Māori"
  * Phonetic misspellings: "Whanganui" vs "Wanganui", "tino rangatiratanga" may appear as "teeno ranga tira tanga"
  * Place names: Ōtāhuhu, Māngere, Manukau, Ōtara, Papatoetoe, Glen Innes/Glendowie, Panmure, Tāmaki Makaurau (Auckland)
  * Organisation names may be phonetically transcribed incorrectly — cross-reference with KNOWN GROUPS below
  * Personal names with macrons: match against KNOWN COMMUNITY MEMBERS list even if transcription drops macrons or splits names oddly

KNOWN COMMUNITY MEMBERS:
${peopleContext || 'No members in system yet.'}

KNOWN GROUPS/ORGANISATIONS:
${groupsContext || 'No groups in system yet.'}

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
  "placesIdentified": [
    {
      "name": "place/location/venue name as mentioned in transcript",
      "type": "suburb" | "city" | "venue" | "region" | "other"
    }
  ],
  "organisationsIdentified": [
    {
      "name": "organisation/group/company name as mentioned in transcript",
      "matchedGroupId": null or number (ID from KNOWN GROUPS/ORGANISATIONS if matched),
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
  "keyQuotes": ["Reframe notable moments as concise impact statements suitable for funder reports. Write from the POV of the primary person or organisation being discussed — use their name if identified. Since the speaker is retelling events, do NOT use their exact words. Paraphrase into outcome-focused statements centred on the subject. Examples: 'Aroha demonstrated increased confidence by presenting to potential investors for the first time', 'Te Oro hosted 45 rangatahi for a digital skills wānanga, their largest event to date', 'Wiremu secured his first paying customer after 3 months of mentoring support', 'Māngere Arts Collective launched their community gallery with 12 local artists'. If no specific person or org is the clear subject, write in general third-person."],
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

      const autoApplyTags = async (logId: number, extractedTags: any[]) => {
        const existingTags = await storage.getImpactTags(logId);
        for (const existingTag of existingTags) {
          await storage.removeImpactTag(existingTag.id);
        }
        if (!extractedTags || extractedTags.length === 0) return;
        for (const tag of extractedTags) {
          const matchedTax = taxonomy.find(t => t.active && t.name.toLowerCase() === (tag.category || "").toLowerCase());
          const taxonomyId = matchedTax?.id;
          if (taxonomyId) {
            tag.taxonomyId = taxonomyId;
            await storage.addImpactTag({
              impactLogId: logId,
              taxonomyId,
              confidence: tag.confidence || 50,
              notes: tag.evidence || null,
              evidence: tag.evidence || null,
            });
          } else {
            console.warn(`[autoApplyTags] No matching taxonomy category for extracted tag "${tag.category}" on log ${logId}. Available categories: ${taxonomy.filter(t => t.active).map(t => t.name).join(', ')}`);
          }
        }
        extraction.impactTags = extractedTags;
      };

      if (existingLogId) {
        const existing = await storage.getImpactLog(existingLogId);
        if (!existing || existing.userId !== userId) {
          return res.status(404).json({ message: "Impact log not found" });
        }
        await autoApplyTags(existingLogId, extraction.impactTags);
        const preserveStatus = existing.status === "confirmed" ? "confirmed" : "pending_review";
        const updated = await storage.updateImpactLog(existingLogId, {
          transcript,
          summary: extraction.summary || "",
          rawExtraction: extraction,
          status: preserveStatus,
          sentiment: extraction.sentiment || "neutral",
          milestones: extraction.milestones || [],
          keyQuotes: extraction.keyQuotes || [],
        });
        res.status(200).json({ id: updated.id, impactLog: updated, extraction });
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
        await autoApplyTags(impactLog.id, extraction.impactTags);
        await storage.updateImpactLog(impactLog.id, { rawExtraction: extraction });
        res.status(201).json({ id: impactLog.id, impactLog, extraction });
      }
    } catch (error: any) {
      if (error instanceof AIKeyMissingError) return res.status(503).json({ message: error.message });
      console.error("Impact extraction error:", error);
      res.status(500).json({ message: "Failed to extract impact data" });
    }
  });

  app.post("/api/impact-logs/:id/reanalyse-tags", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const logId = parseId(req.params.id);
      if (isNaN(logId)) return res.status(400).json({ message: "Invalid log ID" });

      const log = await storage.getImpactLog(logId);
      if (!log || log.userId !== userId) return res.status(404).json({ message: "Not found" });
      if (!log.transcript) return res.status(400).json({ message: "No transcript available for re-analysis" });

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

      const tagPrompt = `You are an impact analysis system for ReserveTMK Digital, a Māori and Pasifika entrepreneurship hub in Aotearoa New Zealand. Analyze the following debrief transcript and extract impact tags ONLY.

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
4. Priority ordering: Return categories ranked by relevance strength in source text

LANGUAGE NOTES:
- Handle te reo Māori: whānau (family), rangatahi (youth), mahi (work), kaupapa (purpose), kōrero (talk/discussion), hui (meeting), wānanga (workshop/learning), aroha (care/compassion), manaaki (hospitality/support), tautoko (support)
- NZ slang: sorted (arranged), keen as (very interested), sweet (confirmed), stoked (very happy), hard out (enthusiastically), all good (fine/ok), buzzing (excited), choice (great)

TRANSCRIPT:
"""
${log.transcript}
"""

Return a JSON object with EXACTLY this structure:
{
  "impactTags": [
    {
      "category": "taxonomy category name",
      "confidence": 0-100,
      "evidence": "brief quote or paraphrase from transcript supporting this tag"
    }
  ]
}

Be precise. Only tag impact categories where there is clear evidence in the transcript. Set confidence scores honestly — lower if the evidence is ambiguous.`;

      const extraction = await claudeJSON({
        model: "claude-sonnet-4-6",
        prompt: tagPrompt,
        temperature: 0.3,
      });

      const existingTags = await storage.getImpactTags(logId);
      for (const existingTag of existingTags) {
        await storage.removeImpactTag(existingTag.id);
      }
      const extractedTags = extraction.impactTags || [];
      for (const tag of extractedTags) {
        const matchedTax = taxonomy.find(t => t.active && t.name.toLowerCase() === (tag.category || "").toLowerCase());
        if (matchedTax) {
          tag.taxonomyId = matchedTax.id;
          await storage.addImpactTag({
            impactLogId: logId,
            taxonomyId: matchedTax.id,
            confidence: tag.confidence || 50,
            notes: tag.evidence || null,
            evidence: tag.evidence || null,
          });
        }
      }

      const existingExtraction = (log.rawExtraction as any) || {};
      existingExtraction.impactTags = extractedTags;
      await storage.updateImpactLog(logId, { rawExtraction: existingExtraction });

      const updatedTags = await storage.getImpactTags(logId);
      res.json({ tags: updatedTags, impactTags: extractedTags });
    } catch (error: any) {
      if (error instanceof AIKeyMissingError) return res.status(503).json({ message: error.message });
      console.error("Impact tag re-analysis error:", error);
      res.status(500).json({ message: "Failed to re-analyse impact tags" });
    }
  });


  const MAX_AUDIO_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

  app.post("/api/impact-transcribe", isAuthenticated, async (req, res) => {
    try {
      const { isOpenAIKeyConfigured } = await import("./replit_integrations/audio/client");
      if (!isOpenAIKeyConfigured()) {
        return res.status(503).json({ message: "Audio transcription is unavailable: OpenAI API key is not configured" });
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;
      let aborted = false;

      req.on("data", (chunk: Buffer) => {
        if (aborted) return;
        totalBytes += chunk.length;
        if (totalBytes > MAX_AUDIO_UPLOAD_BYTES) {
          aborted = true;
          res.status(413).json({ message: `Audio file too large. Maximum upload size is ${MAX_AUDIO_UPLOAD_BYTES / (1024 * 1024)}MB` });
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", async () => {
        if (aborted) return;
        try {
          const audioBuffer = Buffer.concat(chunks);
          if (audioBuffer.length === 0) {
            return res.status(400).json({ message: "No audio data received" });
          }

          const { ensureCompatibleFormat, speechToText } = await import("./replit_integrations/audio/client");
          const { buffer, format } = await ensureCompatibleFormat(audioBuffer);
          console.log(`[transcribe] format=${format} size=${buffer.length}`);
          const transcript = await speechToText(buffer, format);

          res.json({ transcript });
        } catch (err: any) {
          console.error("Transcription error:", err?.message, err?.status, err?.error);
          if (err.message?.includes("ffmpeg")) {
            return res.status(503).json({ message: "Audio conversion is temporarily unavailable. Please try recording again using Chrome or Firefox, which use natively supported audio formats." });
          }
          if (err.message?.includes("API key")) {
            return res.status(503).json({ message: "Transcription service is not configured. Please contact support." });
          }
          res.status(500).json({ message: `Transcription failed: ${err?.message || "unknown error"}` });
        }
      });
    } catch (error) {
      console.error("Transcription route error:", error);
      res.status(500).json({ message: "Failed to process audio" });
    }
  });

  app.post("/api/impact-logs/:id/audio", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const logId = parseId(req.params.id);
      const log = await storage.getImpactLog(logId);
      if (!log) return res.status(404).json({ message: "Impact log not found" });
      if (log.userId !== userId) return res.status(403).json({ message: "Not authorized" });

      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", async () => {
        try {
          const audioBuffer = Buffer.concat(chunks);
          if (audioBuffer.length === 0) {
            return res.status(400).json({ message: "No audio data received" });
          }

          const { ObjectStorageService, objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
          const objStorage = new ObjectStorageService();
          const privateDir = objStorage.getPrivateObjectDir();
          const fileName = `debrief-audio/${logId}-${Date.now()}.webm`;
          const fullPath = `${privateDir}/${fileName}`;

          const pathParts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
          const bucketName = pathParts[0];
          const objectName = pathParts.slice(1).join("/");

          const bucket = objectStorageClient.bucket(bucketName);
          const file = bucket.file(objectName);
          await file.save(audioBuffer, { contentType: "audio/webm" });

          const audioUrl = `/objects/${fileName}`;
          await storage.updateImpactLog(logId, { audioUrl });

          res.json({ audioUrl });
        } catch (err) {
          console.error("Audio save error:", err);
          res.status(500).json({ message: "Failed to save audio" });
        }
      });
    } catch (error) {
      console.error("Audio save route error:", error);
      res.status(500).json({ message: "Failed to process audio" });
    }
  });

  // === Audit Logs API ===

  app.get("/api/impact-logs/:id/metric-trends", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const logId = parseId(req.params.id);
      const log = await storage.getImpactLog(logId);
      if (!log) return res.status(404).json({ message: "Impact log not found" });
      if (log.userId !== userId) return res.status(403).json({ message: "Not authorized" });

      const linkedContacts = await storage.getImpactLogContacts(logId);
      let primaryContactIds = linkedContacts
        .filter((lc: any) => lc.role === "primary")
        .map((lc: any) => lc.contactId);

      if (primaryContactIds.length === 0) {
        const reviewed = (log.reviewedData || log.rawExtraction) as any;
        const draftPeople = reviewed?.people || [];
        primaryContactIds = draftPeople
          .filter((p: any) => p.contactId && (p.section === "primary" || (!p.section && ["primary", "mentor", "mentee"].includes(p.role))))
          .map((p: any) => p.contactId);
      }

      if (primaryContactIds.length === 0) {
        return res.json({ trends: {} });
      }

      const allLogs = await storage.getImpactLogs(userId);
      const confirmedLogs = allLogs
        .filter((l: any) => l.id !== logId && l.status === "confirmed" && l.reviewedData)
        .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      const trends: Record<string, number[]> = {};
      const metricKeys = ["mindset", "skill", "confidence", "businessConfidence", "systems", "fundingReadiness", "network"];

      for (const confirmedLog of confirmedLogs.slice(0, 10)) {
        const logContacts = await storage.getImpactLogContacts(confirmedLog.id);
        const hasOverlap = logContacts.some((lc: any) => primaryContactIds.includes(lc.contactId));
        if (!hasOverlap) continue;

        const reviewed = confirmedLog.reviewedData as any;
        const m = reviewed?.metrics || (confirmedLog.rawExtraction as any)?.metrics;
        if (!m) continue;

        for (const key of metricKeys) {
          if (m[key] !== undefined && m[key] !== null) {
            if (!trends[key]) trends[key] = [];
            if (trends[key].length < 3) {
              trends[key].push(m[key]);
            }
          }
        }
      }

      res.json({ trends });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch metric trends" });
    }
  });

  app.get(api.auditLogs.list.path, isAuthenticated, async (req, res) => {
    const entityType = parseStr(req.query.entityType);
    const entityId = parseId(req.query.entityId);
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

      allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      res.json(allEvents);
    } catch (err: any) {
      console.error("Google Calendar fetch error:", err.message);
      res.status(500).json({ message: "Failed to fetch Google Calendar events: " + err.message });
    }
  });

  app.get("/api/google-calendar/status", isAuthenticated, async (req, res) => {
    try {
      const { isCalendarConnected } = await import("./replit_integrations/google-calendar/client");
      const userId = (req as any).user?.claims?.sub;
      res.json({ connected: await isCalendarConnected(userId) });
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
      const userId = (req as any).user?.claims?.sub;
      const { getUncachableGoogleCalendarClient } = await import("./replit_integrations/google-calendar/client");
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

  // === Programmes API ===

  app.get(api.programmes.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const programmesList = await storage.getProgrammes(userId);
    res.json(programmesList);
  });

  app.get(api.programmes.get.path, isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
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
      const id = parseId(req.params.id);
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

      // Classify through funder taxonomy lenses when programme becomes active/completed
      if (input.status && (input.status === "active" || input.status === "completed")) {
        classifyForAllFunders("programme", id, existing.userId).catch((err) =>
          console.error(`Taxonomy classification failed for programme ${id}:`, err),
        );
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
    const id = parseId(req.params.id);
    const existing = await storage.getProgramme(id);
    if (!existing) return res.status(404).json({ message: "Programme not found" });
    if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteProgramme(id);
    res.status(204).send();
  });

  app.get(api.programmes.events.list.path, isAuthenticated, async (req, res) => {
    const programmeId = parseId(req.params.id);
    const programme = await storage.getProgramme(programmeId);
    if (!programme) return res.status(404).json({ message: "Programme not found" });
    if (programme.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    const eventsList = await storage.getProgrammeEvents(programmeId);
    res.json(eventsList);
  });

  app.post(api.programmes.events.add.path, isAuthenticated, async (req, res) => {
    try {
      const programmeId = parseId(req.params.id);
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
    const id = parseId(req.params.id);
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

  // === Programme Registrations API (Authenticated) ===

  app.get('/api/programmes/:id/registrations', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const programmeId = parseId(req.params.id);
      const programme = await storage.getProgramme(programmeId);
      if (!programme || programme.userId !== userId) {
        return res.status(404).json({ message: "Programme not found" });
      }
      const registrations = await storage.getProgrammeRegistrations(programmeId);
      const count = await storage.getProgrammeRegistrationCount(programmeId);
      res.json({ registrations, count, capacity: programme.capacity });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch registrations" });
    }
  });

  app.patch('/api/programmes/:id/registrations/:regId', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const programmeId = parseId(req.params.id);
      const regId = parseId(req.params.regId);
      const programme = await storage.getProgramme(programmeId);
      if (!programme || programme.userId !== userId) {
        return res.status(404).json({ message: "Programme not found" });
      }
      const reg = await storage.getProgrammeRegistration(regId);
      if (!reg || reg.programmeId !== programmeId) {
        return res.status(404).json({ message: "Registration not found" });
      }
      const { attended, status } = req.body;
      const allowedUpdates: Record<string, any> = {};
      if (typeof attended === 'boolean') allowedUpdates.attended = attended;
      if (status && ['registered', 'cancelled', 'waitlisted'].includes(status)) allowedUpdates.status = status;
      if (status === 'cancelled') allowedUpdates.cancelledAt = new Date();
      const updated = await storage.updateProgrammeRegistration(regId, allowedUpdates);

      // Sync attended flag → programmes.attendees array
      if (typeof attended === 'boolean' && reg.contactId) {
        try {
          const currentAttendees: number[] = Array.isArray(programme.attendees) ? (programme.attendees as number[]) : [];
          let newAttendees: number[];
          if (attended) {
            newAttendees = currentAttendees.includes(reg.contactId)
              ? currentAttendees
              : [...currentAttendees, reg.contactId];
          } else {
            newAttendees = currentAttendees.filter(id => id !== reg.contactId);
          }
          await storage.updateProgramme(programmeId, { attendees: newAttendees } as any);
        } catch (syncErr) {
          console.warn("[programmes] Failed to sync attendees array:", syncErr);
        }
      }

      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update registration" });
    }
  });

  app.post('/api/programmes/:id/registrations/bulk-attendance', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const programmeId = parseId(req.params.id);
      const programme = await storage.getProgramme(programmeId);
      if (!programme || programme.userId !== userId) {
        return res.status(404).json({ message: "Programme not found" });
      }
      const { updates } = req.body;
      if (!Array.isArray(updates)) {
        return res.status(400).json({ message: "Updates array required" });
      }
      const results = [];
      for (const { regId, attended } of updates) {
        if (typeof attended !== 'boolean') continue;
        const reg = await storage.getProgrammeRegistration(regId);
        if (!reg || reg.programmeId !== programmeId) continue;
        const updated = await storage.updateProgrammeRegistration(regId, { attended });
        results.push({ updated, reg });
      }

      // Sync all attended contacts → programmes.attendees array
      try {
        const allRegs = await storage.getProgrammeRegistrations(programmeId);
        const attendedContactIds = allRegs
          .filter(r => r.attended && r.contactId)
          .map(r => r.contactId as number);
        await storage.updateProgramme(programmeId, { attendees: attendedContactIds } as any);
      } catch (syncErr) {
        console.warn("[programmes] Failed to sync attendees array on bulk update:", syncErr);
      }

      res.json({ updated: results.length });
    } catch (err) {
      res.status(500).json({ message: "Failed to update attendance" });
    }
  });

  app.delete('/api/programmes/:id/registrations/:regId', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const programmeId = parseId(req.params.id);
      const regId = parseId(req.params.regId);
      const programme = await storage.getProgramme(programmeId);
      if (!programme || programme.userId !== userId) {
        return res.status(404).json({ message: "Programme not found" });
      }
      const reg = await storage.getProgrammeRegistration(regId);
      if (!reg || reg.programmeId !== programmeId) {
        return res.status(404).json({ message: "Registration not found" });
      }
      await storage.deleteProgrammeRegistration(regId);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete registration" });
    }
  });

  app.get('/api/programmes/:id/registrations/export', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const programmeId = parseId(req.params.id);
      const programme = await storage.getProgramme(programmeId);
      if (!programme || programme.userId !== userId) {
        return res.status(404).json({ message: "Programme not found" });
      }
      const registrations = await storage.getProgrammeRegistrations(programmeId);
      const headers = ["First Name", "Last Name", "Email", "Phone", "Organization", "Dietary Requirements", "Accessibility Needs", "Referral Source", "Status", "Attended", "Registered At"];
      const rows = registrations.map(r => [
        r.firstName, r.lastName, r.email, r.phone || "", r.organization || "",
        r.dietaryRequirements || "", r.accessibilityNeeds || "", r.referralSource || "",
        r.status, r.attended ? "Yes" : "No",
        r.registeredAt ? new Date(r.registeredAt).toLocaleDateString("en-NZ") : "",
      ]);
      const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${(v || "").replace(/"/g, '""')}"`).join(","))].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${programme.name.replace(/[^a-zA-Z0-9]/g, '_')}_registrations.csv"`);
      res.send(csv);
    } catch (err) {
      res.status(500).json({ message: "Failed to export registrations" });
    }
  });

  app.get('/api/contacts/:id/programme-registrations', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const contactId = parseId(req.params.id);
      const contact = await storage.getContact(contactId);
      if (!contact || contact.userId !== userId) {
        return res.status(404).json({ message: "Contact not found" });
      }
      const registrations = await storage.getProgrammeRegistrationsByContact(contactId);
      const enriched = await Promise.all(registrations.map(async r => {
        const programme = await storage.getProgramme(r.programmeId);
        return { ...r, programmeName: programme?.name || "Unknown" };
      }));
      res.json(enriched);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch registrations" });
    }
  });

  // === Programme Send Reminder ===
  app.post('/api/programmes/:id/send-reminder', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const programmeId = parseId(req.params.id);
      const programme = await storage.getProgramme(programmeId);
      if (!programme || programme.userId !== userId) {
        return res.status(404).json({ message: "Programme not found" });
      }
      const registrations = await storage.getProgrammeRegistrations(programmeId);
      const activeRegs = registrations.filter(r => r.status === "registered" && r.email);
      if (activeRegs.length === 0) {
        return res.status(400).json({ message: "No registered attendees with email addresses" });
      }

      let directions: string | null = null;
      if (programme.locationType === "Other") {
        directions = programme.customDirections || null;
      } else if (programme.locationType) {
        const orgProfile = await storage.getOrganisationProfile(userId);
        const locInstructions = orgProfile?.locationInstructions as Record<string, { howToFindUs?: string; parking?: string; generalInfo?: string }> | null;
        if (locInstructions && locInstructions[programme.locationType]) {
          const info = locInstructions[programme.locationType];
          const parts = [];
          if (info.howToFindUs) parts.push(info.howToFindUs);
          if (info.parking) parts.push(`Parking: ${info.parking}`);
          if (info.generalInfo) parts.push(info.generalInfo);
          directions = parts.join('\n') || null;
        }
      }

      const { sendProgrammeReminderEmail } = await import("./email");
      let sent = 0;
      for (const reg of activeRegs) {
        try {
          await sendProgrammeReminderEmail(
            reg.email,
            reg.firstName || reg.email,
            {
              name: programme.name,
              startDate: programme.startDate,
              startTime: programme.startTime,
              endTime: programme.endTime,
              location: programme.location,
            },
            directions
          );
          sent++;
        } catch (emailErr: any) {
          console.error(`Failed to send reminder to ${reg.email}:`, emailErr.message);
        }
      }
      res.json({ success: true, sent, total: activeRegs.length });
    } catch (err) {
      console.error("Send reminder error:", err);
      res.status(500).json({ message: "Failed to send reminders" });
    }
  });

  // === Programme Send Survey ===
  app.post('/api/programmes/:id/send-survey', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const programmeId = parseId(req.params.id);
      const programme = await storage.getProgramme(programmeId);
      if (!programme || programme.userId !== userId) {
        return res.status(404).json({ message: "Programme not found" });
      }
      const registrations = await storage.getProgrammeRegistrations(programmeId);
      const activeRegs = registrations.filter(r => r.status === "registered" && r.email);
      if (activeRegs.length === 0) {
        return res.status(400).json({ message: "No registered attendees with email addresses" });
      }

      const questions = [
        { id: 1, type: "rating", question: "How would you rate this event overall?", scale: 5, required: true, key: "overall_rating" },
        { id: 2, type: "text", question: "What did you enjoy most?", required: false, key: "enjoyed_most", placeholder: "Tell us what you liked..." },
        { id: 3, type: "text", question: "What could be improved?", required: false, key: "could_improve", placeholder: "Any suggestions for next time..." },
        { id: 4, type: "yes_no", question: "Would you attend again?", required: true, key: "would_attend_again" },
        { id: 5, type: "consent", question: "I'd like to hear about upcoming workshops and events", required: false, key: "newsletter_optin", consent: true },
      ];

      const { sendProgrammeSurveyEmail } = await import("./email");
      const crypto = await import("crypto");
      let sent = 0;
      for (const reg of activeRegs) {
        try {
          const surveyToken = crypto.randomUUID();
          await storage.createSurvey({
            userId,
            surveyType: "programme",
            relatedId: programmeId,
            contactId: reg.contactId,
            questions,
            status: "pending",
            surveyToken,
          });
          await sendProgrammeSurveyEmail(
            reg.email,
            reg.firstName || reg.email,
            programme.name,
            surveyToken
          );
          sent++;
        } catch (emailErr: any) {
          console.error(`Failed to send survey to ${reg.email}:`, emailErr.message);
        }
      }
      res.json({ success: true, sent, total: activeRegs.length });
    } catch (err) {
      console.error("Send survey error:", err);
      res.status(500).json({ message: "Failed to send surveys" });
    }
  });

  // === Programme Registration Counts (bulk) ===
  app.get('/api/programmes/registration-counts', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const programmesList = await storage.getProgrammes(userId);
      const counts: Record<number, number> = {};
      for (const p of programmesList) {
        counts[p.id] = await storage.getProgrammeRegistrationCount(p.id);
      }
      res.json(counts);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch registration counts" });
    }
  });

  // === Memberships API ===

  app.get(api.memberships.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const list = await storage.getMemberships(userId);
    res.json(list);
  });

  app.get(api.memberships.get.path, isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
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
      if (input.contactId) await autoPromoteToInnovator(input.contactId);
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
      const id = parseId(req.params.id);
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
    const id = parseId(req.params.id);
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
    const id = parseId(req.params.id);
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
      if (input.contactId) await autoPromoteToInnovator(input.contactId);
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
      const id = parseId(req.params.id);
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
    const id = parseId(req.params.id);
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
    const id = parseId(req.params.id);
    const venue = await storage.getVenue(id);
    if (!venue) return res.status(404).json({ message: "Venue not found" });
    if (venue.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    res.json(venue);
  });

  app.post(api.venues.create.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const body = { ...req.body, userId };
      if (!body.availabilitySchedule) {
        body.availabilitySchedule = DEFAULT_VENUE_AVAILABILITY_SCHEDULE;
      }
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
      const id = parseId(req.params.id);
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
    const id = parseId(req.params.id);
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
    const id = parseId(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    res.json(booking);
  });

  app.get("/api/bookings/:id/allowance", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
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
      const { venueId, venueIds: venueIdsParam, startDate, endDate, startTime, endTime, excludeBookingId } = req.query;
      if ((!venueId && !venueIdsParam) || !startDate) return res.json({ conflicts: [] });

      let targetVenueIds: number[] = [];
      if (venueIdsParam) {
        targetVenueIds = (venueIdsParam as string).split(",").map(Number).filter(n => !isNaN(n));
      } else if (venueId) {
        const parsed = parseInt(venueId as string);
        if (!isNaN(parsed)) targetVenueIds = [parsed];
      }
      if (targetVenueIds.length === 0) return res.status(400).json({ message: "Invalid venueId(s)" });

      const bookingVenuesOverlap = (b: any) => {
        const bIds = b.venueIds || (b.venueId ? [b.venueId] : []);
        return bIds.some((id: number) => targetVenueIds.includes(id));
      };

      const allBookings = await storage.getBookings(userId);
      const programmes = await storage.getProgrammes(userId);
      const allMeetings = await storage.getMeetings(userId);
      const conflicts: { type: string; id: number; title: string; date: string; time: string }[] = [];

      for (const b of allBookings) {
        if (excludeBookingId && b.id === parseInt(excludeBookingId as string)) continue;
        if (b.status === "cancelled") continue;
        if (!bookingVenuesOverlap(b)) continue;
        if (!datesOverlap(startDate as string, (endDate || startDate) as string, b.startDate, b.endDate || b.startDate)) continue;
        if (!timesOverlap(startTime as string, endTime as string, b.startTime, b.endTime)) continue;
        conflicts.push({
          type: "booking",
          id: b.id,
          title: b.title || "",
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

      for (const m of allMeetings) {
        if (m.status === "cancelled") continue;
        if (!m.venueId || !targetVenueIds.includes(m.venueId)) continue;
        const mStartDate = m.startTime ? new Date(m.startTime).toISOString().slice(0, 10) : null;
        const mEndDate = m.endTime ? new Date(m.endTime).toISOString().slice(0, 10) : mStartDate;
        const mStartTimeStr = m.startTime ? new Date(m.startTime).toTimeString().slice(0, 5) : null;
        const mEndTimeStr = m.endTime ? new Date(m.endTime).toTimeString().slice(0, 5) : null;
        if (!mStartDate) continue;
        if (!datesOverlap(startDate as string, (endDate || startDate) as string, mStartDate, mEndDate)) continue;
        if (!timesOverlap(startTime as string, endTime as string, mStartTimeStr, mEndTimeStr)) continue;
        conflicts.push({
          type: "meeting",
          id: m.id,
          title: m.title,
          date: mStartDate,
          time: mStartTimeStr && mEndTimeStr ? `${mStartTimeStr} - ${mEndTimeStr}` : "All day",
        });
      }

      const occupiedIntervals: { start: number; end: number }[] = [];
      for (const b of allBookings) {
        if (excludeBookingId && b.id === parseInt(excludeBookingId as string)) continue;
        if (b.status === "cancelled") continue;
        if (!bookingVenuesOverlap(b)) continue;
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
      for (const m of allMeetings) {
        if (m.status === "cancelled") continue;
        if (!m.venueId || !targetVenueIds.includes(m.venueId)) continue;
        const mStartDate = m.startTime ? new Date(m.startTime).toISOString().slice(0, 10) : null;
        if (!mStartDate) continue;
        if (!datesOverlap(startDate as string, startDate as string, mStartDate, mStartDate)) continue;
        const mStartTimeStr = m.startTime ? new Date(m.startTime).toTimeString().slice(0, 5) : null;
        const mEndTimeStr = m.endTime ? new Date(m.endTime).toTimeString().slice(0, 5) : null;
        if (mStartTimeStr && mEndTimeStr) {
          occupiedIntervals.push({ start: parseTimeToMinutes(mStartTimeStr), end: parseTimeToMinutes(mEndTimeStr) });
        }
      }

      occupiedIntervals.sort((a, b) => a.start - b.start);

      const requestDate = new Date(startDate as string + "T12:00:00");
      const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const dayName = dayNames[requestDate.getDay()];

      let dayStart = parseTimeToMinutes("08:00");
      let dayEnd = parseTimeToMinutes("17:00");
      let anyVenueClosed = false;
      for (const vid of targetVenueIds) {
        const v = await storage.getVenue(vid);
        if (v && v.userId !== userId) return res.status(403).json({ message: "Forbidden" });
        const sched = (v?.availabilitySchedule as AvailabilitySchedule) || DEFAULT_VENUE_AVAILABILITY_SCHEDULE;
        const ds = sched[dayName];
        if (ds && !ds.open) { anyVenueClosed = true; break; }
        if (ds) {
          dayStart = Math.max(dayStart, parseTimeToMinutes(ds.startTime));
          dayEnd = Math.min(dayEnd, parseTimeToMinutes(ds.endTime));
        }
      }

      if (anyVenueClosed || dayStart >= dayEnd) {
        return res.json({ conflicts, availableSlots: [] });
      }
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

      const inputVenueIds = input.venueIds || (input.venueId ? [input.venueId] : []);
      if (inputVenueIds.length === 0) {
        return res.status(400).json({ message: "At least one venue must be selected" });
      }
      
      for (const vid of inputVenueIds) {
        const venue = await storage.getVenue(vid);
        if (venue && venue.capacity && input.attendeeCount && input.attendeeCount > venue.capacity) {
          return res.status(400).json({
            message: `Attendee count (${input.attendeeCount}) exceeds ${venue.name} capacity (${venue.capacity})`,
          });
        }
      }

      if (input.startDate && inputVenueIds.length > 0 && !conflictOverride) {
        const allBookings = await storage.getBookings(userId);
        const programmes = await storage.getProgrammes(userId);
        const allMeetings = await storage.getMeetings(userId);
        const inputVenueOverlap = (b: any) => {
          const bIds = b.venueIds || (b.venueId ? [b.venueId] : []);
          return bIds.some((id: number) => inputVenueIds.includes(id));
        };
        for (const b of allBookings) {
          if (b.status === "cancelled") continue;
          if (!inputVenueOverlap(b)) continue;
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
        for (const m of allMeetings) {
          if (m.status === "cancelled") continue;
          if (!m.venueId || !inputVenueIds.includes(m.venueId)) continue;
          const mStartDate = m.startTime ? new Date(m.startTime).toISOString().slice(0, 10) : null;
          const mEndDate = m.endTime ? new Date(m.endTime).toISOString().slice(0, 10) : mStartDate;
          const mStartTimeStr = m.startTime ? new Date(m.startTime).toTimeString().slice(0, 5) : null;
          const mEndTimeStr = m.endTime ? new Date(m.endTime).toTimeString().slice(0, 5) : null;
          if (!mStartDate) continue;
          if (!datesOverlap(input.startDate, input.endDate || input.startDate, mStartDate, mEndDate)) continue;
          if (!timesOverlap(input.startTime, input.endTime, mStartTimeStr, mEndTimeStr)) continue;
          return res.status(409).json({
            message: `Conflict: Meeting "${m.title}" is scheduled for ${mStartTimeStr || "all day"} on ${mStartDate}`,
          });
        }
      }

      let allowanceWarning: string | null = null;
      let agreementAllowance = 0;
      let agreementPeriod = "quarterly";
      let agreementAllowedLocations: string[] | null = null;
      if (input.membershipId) {
        const membership = await storage.getMembership(input.membershipId);
        if (membership) {
          agreementAllowance = membership.bookingAllowance || 0;
          agreementPeriod = membership.allowancePeriod || "quarterly";
          agreementAllowedLocations = membership.allowedLocations && membership.allowedLocations.length > 0 ? membership.allowedLocations : null;
        }
      } else if (input.mouId) {
        const mou = await storage.getMou(input.mouId);
        if (mou) {
          agreementAllowance = mou.bookingAllowance || 0;
          agreementPeriod = mou.allowancePeriod || "quarterly";
          agreementAllowedLocations = mou.allowedLocations && mou.allowedLocations.length > 0 ? mou.allowedLocations : null;
        }
      }

      if (agreementAllowedLocations) {
        for (const vid of inputVenueIds) {
          const venue = await storage.getVenue(vid);
          if (venue) {
            const venueLoc = venue.spaceName || "Other";
            if (!agreementAllowedLocations.includes(venueLoc)) {
              return res.status(400).json({
                message: `Venue "${venue.name}" is in location "${venueLoc}" which is not allowed by the linked agreement (allowed: ${agreementAllowedLocations.join(", ")})`,
              });
            }
          }
        }
      }

      if (agreementAllowance > 0) {
        const linkedId = (input.membershipId || input.mouId)!;
        const linkedType = input.membershipId ? "membership" : "mou";
        const allBookings = await storage.getBookings(userId);
        const now = new Date();
        let periodStart: Date;
        let periodEnd: Date;
        if (agreementPeriod === "monthly") {
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        } else {
          const q = Math.floor(now.getMonth() / 3) * 3;
          periodStart = new Date(now.getFullYear(), q, 1);
          periodEnd = new Date(now.getFullYear(), q + 3, 1);
        }
        const usedCount = allBookings.filter(b => {
          const matchesAgreement = linkedType === "membership"
            ? b.membershipId === linkedId
            : b.mouId === linkedId;
          if (!matchesAgreement) return false;
          if (b.status === "cancelled") return false;
          const bDate = b.startDate ? new Date(b.startDate) : b.createdAt ? new Date(b.createdAt) : null;
          return bDate && bDate >= periodStart && bDate < periodEnd;
        }).length;
        if (usedCount >= agreementAllowance) {
          const periodLabel = agreementPeriod === "monthly" ? "month" : "quarter";
          allowanceWarning = `This booking exceeds the ${periodLabel}ly allowance (${usedCount}/${agreementAllowance} used this ${periodLabel})`;
        }
      }

      const booking = await storage.createBooking(input);
      res.status(201).json({ ...booking, allowanceWarning });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.patch(api.bookings.update.path, isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const existing = await storage.getBooking(id);
      if (!existing) return res.status(404).json({ message: "Booking not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const input = api.bookings.update.input.parse(coerceDateFields(req.body));

      const merged = { ...existing, ...input };

      const mergedVenueIds = merged.venueIds || (merged.venueId ? [merged.venueId] : []);
      
      for (const vid of mergedVenueIds) {
        const venue = await storage.getVenue(vid);
        if (venue && venue.capacity && merged.attendeeCount && merged.attendeeCount > venue.capacity) {
          return res.status(400).json({
            message: `Attendee count (${merged.attendeeCount}) exceeds ${venue.name} capacity (${venue.capacity})`,
          });
        }
      }

      if (merged.startDate && mergedVenueIds.length > 0) {
        const userId = (req.user as any).claims.sub;
        const allBookings = await storage.getBookings(userId);
        const programmes = await storage.getProgrammes(userId);
        const allMeetings = await storage.getMeetings(userId);
        const mergedVenueOverlap = (b: any) => {
          const bIds = b.venueIds || (b.venueId ? [b.venueId] : []);
          return bIds.some((id: number) => mergedVenueIds.includes(id));
        };
        for (const b of allBookings) {
          if (b.id === id) continue;
          if (b.status === "cancelled") continue;
          if (!mergedVenueOverlap(b)) continue;
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
        for (const m of allMeetings) {
          if (m.status === "cancelled") continue;
          if (!m.venueId || !mergedVenueIds.includes(m.venueId)) continue;
          const mStartDate = m.startTime ? new Date(m.startTime).toISOString().slice(0, 10) : null;
          const mEndDate = m.endTime ? new Date(m.endTime).toISOString().slice(0, 10) : mStartDate;
          const mStartTimeStr = m.startTime ? new Date(m.startTime).toTimeString().slice(0, 5) : null;
          const mEndTimeStr = m.endTime ? new Date(m.endTime).toTimeString().slice(0, 5) : null;
          if (!mStartDate) continue;
          if (!datesOverlap(merged.startDate, merged.endDate || merged.startDate, mStartDate, mEndDate)) continue;
          if (!timesOverlap(merged.startTime, merged.endTime, mStartTimeStr, mEndTimeStr)) continue;
          return res.status(409).json({
            message: `Conflict: Meeting "${m.title}" is scheduled for ${mStartTimeStr || "all day"} on that date`,
          });
        }
      }

      const updated = await storage.updateBooking(id, input);

      // Classify through funder taxonomy lenses when booking is confirmed/completed
      if (input.status && (input.status === "confirmed" || input.status === "completed")) {
        const userId = (req.user as any).claims.sub;
        classifyForAllFunders("booking", id, userId).catch((err) =>
          console.error(`Taxonomy classification failed for booking ${id}:`, err),
        );
      }

      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.bookings.delete.path, isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
    const existing = await storage.getBooking(id);
    if (!existing) return res.status(404).json({ message: "Booking not found" });
    if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteBooking(id);
    res.status(204).send();
  });

  // Payment status update endpoint
  app.patch("/api/bookings/:id/payment-status", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = (req.user as any).claims.sub;
      const { paymentStatus } = req.body;
      const validStatuses = ["unpaid", "invoiced", "paid", "not_required"];
      if (!validStatuses.includes(paymentStatus)) {
        return res.status(400).json({ message: "Invalid payment status" });
      }
      const booking = await storage.getBooking(id);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      await db.update(bookings).set({ paymentStatus } as any).where(eq(bookings.id, id));
      res.json({ success: true, paymentStatus });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update payment status" });
    }
  });

  app.get("/api/booking-pricing-defaults", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const defaults = await storage.getBookingPricingDefaults(userId);
    res.json(defaults || { fullDayRate: "0", halfDayRate: "0", maxAdvanceMonths: 3 });
  });

  app.put("/api/booking-pricing-defaults", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const { fullDayRate, halfDayRate, maxAdvanceMonths: rawMaxMonths } = req.body;
    const maxAdvanceMonths = rawMaxMonths != null ? Math.max(1, Math.min(12, parseInt(rawMaxMonths) || 3)) : undefined;
    const result = await storage.upsertBookingPricingDefaults(userId, { fullDayRate, halfDayRate, maxAdvanceMonths });
    res.json(result);
  });

  // === Venue Instructions API ===
  app.get("/api/venue-instructions", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const { venueId, spaceName } = req.query;
    if (spaceName !== undefined) {
      const instructions = await storage.getVenueInstructionsBySpaceName(userId, spaceName as string);
      return res.json(instructions);
    }
    const instructions = await storage.getVenueInstructions(userId);
    if (venueId !== undefined) {
      if (venueId === "null") {
        return res.json(instructions.filter(i => i.venueId === null));
      }
      const vid = parseInt(venueId as string);
      if (isNaN(vid)) return res.status(400).json({ message: "Invalid venueId" });
      return res.json(instructions.filter(i => i.venueId === vid));
    }
    res.json(instructions);
  });

  app.post("/api/venue-instructions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const body = { ...req.body, userId };
      if (body.venueId != null) {
        const venue = await storage.getVenue(body.venueId);
        if (!venue || venue.userId !== userId) return res.status(403).json({ message: "Forbidden: venue does not belong to you" });
      }
      const data = insertVenueInstructionSchema.parse(body);
      const instruction = await storage.createVenueInstruction(data);
      res.json(instruction);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/venue-instructions/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
      const existing = await storage.getVenueInstructions(userId);
      if (!existing.find(i => i.id === id)) return res.status(403).json({ message: "Forbidden" });
      const { userId: _discardUserId, ...safeUpdates } = req.body;
      if (safeUpdates.venueId != null) {
        const venue = await storage.getVenue(safeUpdates.venueId);
        if (!venue || venue.userId !== userId) return res.status(403).json({ message: "Forbidden: venue does not belong to you" });
      }
      const instruction = await storage.updateVenueInstruction(id, safeUpdates);
      res.json(instruction);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/venue-instructions/:id", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const id = parseId(req.params.id);
    const existing = await storage.getVenueInstructions(userId);
    if (!existing.find(i => i.id === id)) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteVenueInstruction(id);
    res.json({ success: true });
  });

  // === Regular Bookers API ===
  app.get("/api/regular-bookers/suggestions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const existingBookers = await storage.getRegularBookers(userId);
      const existingContactIds = new Set(existingBookers.filter(b => b.contactId).map(b => b.contactId));
      const existingGroupIds = new Set(existingBookers.filter(b => b.groupId).map(b => b.groupId));

      const allContacts = await storage.getContacts(userId);
      const venueContacts = allContacts.filter(c => {
        if (existingContactIds.has(c.id)) return false;
        const st = (c as any).supportType;
        if (Array.isArray(st) && (st.includes("venue_hire") || st.includes("hot_desking"))) return true;
        return false;
      });

      const allMemberships = await db.select().from(memberships).where(eq(memberships.userId, userId));
      const allMous = await db.select().from(mous).where(eq(mous.userId, userId));

      const agreementContacts = allContacts.filter(c => {
        if (existingContactIds.has(c.id)) return false;
        if (venueContacts.some(vc => vc.id === c.id)) return false;
        const hasMembership = allMemberships.some(m => m.contactId === c.id && m.status === "active");
        const hasMou = allMous.some(m => m.contactId === c.id && m.status === "active");
        return hasMembership || hasMou;
      });

      const allGroups = await storage.getGroups(userId);
      const agreementGroups = allGroups.filter(g => {
        if (existingGroupIds.has(g.id)) return false;
        const hasMembership = allMemberships.some(m => m.groupId === g.id && m.status === "active");
        const hasMou = allMous.some(m => m.groupId === g.id && m.status === "active");
        return hasMembership || hasMou;
      });

      res.json({
        venueContacts: venueContacts.map(c => ({ id: c.id, name: c.name, email: c.email, supportType: (c as any).supportType })),
        agreementContacts: agreementContacts.map(c => ({ id: c.id, name: c.name, email: c.email })),
        agreementGroups: agreementGroups.map(g => ({ id: g.id, name: g.name, type: g.type })),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/regular-bookers/enriched", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const bookers = await storage.getRegularBookers(userId);

      const enriched = await Promise.all(bookers.map(async (booker) => {
        const links = await storage.getBookerLinks(booker.id);
        const baseUrl = getBaseUrl();

        let contact = null;
        if (booker.contactId) {
          contact = await storage.getContact(booker.contactId);
        }
        let group = null;
        if (booker.groupId) {
          group = await storage.getGroup(booker.groupId);
        }
        let membership = null;
        if (booker.membershipId) {
          membership = await storage.getMembership(booker.membershipId);
        }
        let mou = null;
        if (booker.mouId) {
          mou = await storage.getMou(booker.mouId);
        }

        return {
          ...booker,
          contact: contact ? { id: contact.id, name: contact.name, email: contact.email } : null,
          group: group ? { id: group.id, name: group.name, type: group.type } : null,
          membership: membership ? { id: membership.id, name: membership.name, status: membership.status, bookingAllowance: membership.bookingAllowance, allowancePeriod: membership.allowancePeriod } : null,
          mou: mou ? { id: mou.id, title: mou.title, status: mou.status, bookingAllowance: mou.bookingAllowance, allowancePeriod: mou.allowancePeriod } : null,
          links: links.map(l => ({
            id: l.id,
            token: l.token,
            enabled: l.enabled,
            label: l.label,
            createdAt: l.createdAt,
            lastAccessedAt: l.lastAccessedAt,
            portalUrl: `${baseUrl}/booker/portal/${l.token}`,
          })),
        };
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/regular-bookers", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const bookers = await storage.getRegularBookers(userId);
    res.json(bookers);
  });

  app.get("/api/regular-bookers/:id", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const booker = await storage.getRegularBooker(parseId(req.params.id));
    if (!booker || booker.userId !== userId) return res.status(404).json({ message: "Regular booker not found" });
    res.json(booker);
  });

  app.get("/api/regular-bookers/by-contact/:contactId", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const booker = await storage.getRegularBookerByContactId(parseId(req.params.contactId));
    if (booker && booker.userId !== userId) return res.status(404).json({ message: "Not found" });
    res.json(booker || null);
  });

  app.post("/api/regular-bookers", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const data = insertRegularBookerSchema.parse({ ...req.body, userId });
      const booker = await storage.createRegularBooker(data);

      const token = crypto.randomUUID();
      await storage.createBookerLink({
        regularBookerId: booker.id,
        token,
        enabled: true,
        label: "Portal link",
      });

      const baseUrl = getBaseUrl();
      const portalUrl = `${baseUrl}/booker/portal/${token}`;

      res.json({ ...booker, portalUrl });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/regular-bookers/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
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
    const id = parseId(req.params.id);
    const existing = await storage.getRegularBooker(id);
    if (!existing || existing.userId !== userId) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteRegularBooker(id);
    res.json({ success: true });
  });

  // Agreement summary endpoint for Spaces/Bookers tab
  app.get("/api/regular-bookers/:id/agreement-summary", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
      const booker = await storage.getRegularBooker(id);
      if (!booker || booker.userId !== userId) return res.status(404).json({ message: "Regular booker not found" });

      let mou = null;
      if (booker.mouId) mou = await storage.getMou(booker.mouId);

      // Determine agreement type
      let type: "trial" | "community" | "paid" | "none" = "none";
      if (mou) {
        if (mou.notes && mou.notes.toUpperCase().includes("TRIAL")) {
          type = "trial";
        } else if (booker.pricingTier === "free_koha") {
          type = "community";
        } else if (booker.pricingTier === "full_price" || booker.pricingTier === "discounted") {
          type = "paid";
        } else {
          type = "community";
        }
      } else if (booker.membershipId) {
        if (booker.pricingTier === "free_koha") type = "community";
        else if (booker.pricingTier === "full_price" || booker.pricingTier === "discounted") type = "paid";
        else type = "community";
      }

      const allowance = mou?.bookingAllowance ?? 0;
      const allowancePeriod = mou?.allowancePeriod ?? "quarterly";

      // Count confirmed/completed bookings for this booker in the current period
      let usedThisPeriod = 0;
      if (booker.mouId || booker.membershipId) {
        const now = new Date();
        let periodStart: Date;
        if (allowancePeriod === "monthly") {
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        } else {
          // quarterly
          const q = Math.floor(now.getMonth() / 3);
          periodStart = new Date(now.getFullYear(), q * 3, 1);
        }
        const agreementFilter = booker.mouId
          ? eq(bookings.mouId, booker.mouId)
          : eq(bookings.membershipId, booker.membershipId!);
        const allBookings = await db.select().from(bookings).where(
          and(
            eq(bookings.userId, userId),
            agreementFilter,
            gte(bookings.createdAt, periodStart),
          )
        );
        usedThisPeriod = allBookings.filter(b => b.status === "confirmed" || b.status === "completed").length;
      }

      // Resolve allowed venues
      const allVenues = await storage.getVenues(userId);
      let allowedVenueIds: number[] = [];
      let allowedVenueNames: string[] = [];

      if (mou) {
        const mouAny = mou as any;
        if (mouAny.allowedVenueIds && Array.isArray(mouAny.allowedVenueIds) && mouAny.allowedVenueIds.length > 0) {
          allowedVenueIds = mouAny.allowedVenueIds as number[];
          allowedVenueNames = allVenues.filter(v => allowedVenueIds.includes(v.id)).map(v => v.name);
        } else if (mou.allowedLocations && mou.allowedLocations.length > 0) {
          const matched = allVenues.filter(v => mou.allowedLocations!.includes(v.spaceName || "Other"));
          allowedVenueIds = matched.map(v => v.id);
          allowedVenueNames = matched.map(v => v.name);
        }
      }

      res.json({
        type,
        allowance,
        allowancePeriod,
        usedThisPeriod,
        allowedVenueIds,
        allowedVenueNames,
        notes: mou?.notes ?? null,
        mouId: booker.mouId ?? null,
        membershipId: booker.membershipId ?? null,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/all-booker-links", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const links = await storage.getAllBookerLinks(userId);
      const baseUrl = getBaseUrl();
      const linksWithUrls = links.map(l => ({ ...l, portalUrl: `${baseUrl}/booker/portal/${l.token}` }));
      res.json(linksWithUrls);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/regular-bookers/:id/links", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
      const booker = await storage.getRegularBooker(id);
      if (!booker || booker.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const links = await storage.getBookerLinks(id);
      const baseUrl = getBaseUrl();
      const linksWithUrls = links.map(l => ({ ...l, portalUrl: `${baseUrl}/booker/portal/${l.token}` }));
      res.json(linksWithUrls);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/regular-bookers/:id/links", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
      const booker = await storage.getRegularBooker(id);
      if (!booker || booker.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const baseUrl = getBaseUrl();

      const existingLinks = await storage.getBookerLinks(id);
      const now = new Date();
      const activeLink = existingLinks.find(l => l.enabled !== false && (!l.tokenExpiry || new Date(l.tokenExpiry) > now));
      if (activeLink) {
        const portalUrl = `${baseUrl}/booker/portal/${activeLink.token}`;
        return res.json({ ...activeLink, portalUrl });
      }

      const token = crypto.randomUUID();
      const label = req.body.label || "Portal link";
      const isGroupLink = req.body.isGroupLink === true;
      const link = await storage.createBookerLink({
        regularBookerId: id,
        token,
        enabled: true,
        label,
        isGroupLink,
      });

      const portalUrl = `${baseUrl}/booker/portal/${token}`;
      res.json({ ...link, portalUrl });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/regular-bookers/:id/resend-link", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
      const booker = await storage.getRegularBooker(id);
      if (!booker || booker.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const notificationsEmail = (booker as any).notificationsEmail;
      if (!notificationsEmail) {
        return res.status(400).json({ message: "No notification email set" });
      }

      const existingLinks = await storage.getBookerLinks(id);
      const now = new Date();
      const activeLink = existingLinks.find(l => l.enabled !== false && (!l.tokenExpiry || new Date(l.tokenExpiry) > now));
      if (!activeLink) {
        return res.status(400).json({ message: "No active portal link" });
      }

      const baseUrl = getBaseUrl();
      const portalUrl = `${baseUrl}/booker/portal/${activeLink.token}`;

      const { sendPortalLinkResendEmail } = await import("./email");
      await sendPortalLinkResendEmail(notificationsEmail, portalUrl);

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/booker-links/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
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
      const bookingId = parseId(req.params.id);
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

      let calendarEventCreated = false;
      try {
        const { getUncachableGoogleCalendarClient } = await import("./replit_integrations/google-calendar/client");
        const calendar = await getUncachableGoogleCalendarClient(userId);

        const venueNames: string[] = [];
        const vIds = booking.venueIds || (booking.venueId ? [booking.venueId] : []);
        for (const vid of vIds) {
          const v = await storage.getVenue(vid);
          if (v) venueNames.push(v.name);
        }
        const venueSummary = venueNames.join(" + ");

        const bookerName = booking.bookerName || "";
        const bookingDate = booking.startDate ? new Date(booking.startDate) : new Date();
        const dateStr = bookingDate.toISOString().slice(0, 10);

        const startDateTime = new Date(`${dateStr}T${booking.startTime || "09:00"}:00`);
        const endDateTime = new Date(`${dateStr}T${booking.endTime || "17:00"}:00`);

        const descParts = [
          booking.classification ? `Type: ${booking.classification}` : null,
          bookerName ? `Booker: ${bookerName}` : null,
          booking.bookingSummary ? `Details: ${booking.bookingSummary}` : null,
          booking.attendeeCount ? `Attendees: ${booking.attendeeCount}` : null,
        ].filter(Boolean).join("\n");

        const bookerContact = booking.bookerId ? await storage.getContact(booking.bookerId) : null;
        const attendees: { email: string }[] = [];
        if (bookerContact?.email) {
          const primaryEmail = bookerContact.email.split(/[,;]\s*/)[0].trim();
          if (primaryEmail) attendees.push({ email: primaryEmail });
        }

        const orgProfile = await storage.getOrganisationProfile(userId);
        const locationStr = orgProfile?.location || undefined;

        const event = await calendar.events.insert({
          calendarId: "primary",
          sendUpdates: attendees.length > 0 ? "all" : "none",
          requestBody: {
            summary: `Venue Hire: ${venueSummary}${bookerName ? ` — ${bookerName}` : ""}`,
            description: descParts || undefined,
            start: { dateTime: startDateTime.toISOString(), timeZone: "Pacific/Auckland" },
            end: { dateTime: endDateTime.toISOString(), timeZone: "Pacific/Auckland" },
            location: locationStr,
            attendees: attendees.length > 0 ? attendees : undefined,
          },
        });

        if (event.data.id) {
          await storage.updateBooking(bookingId, { googleCalendarEventId: event.data.id } as any);
          calendarEventCreated = true;
        }
      } catch (calErr: any) {
        console.error("Google Calendar event creation failed for booking:", bookingId, calErr.message, calErr.response?.data || "");
      }

      res.json({ success: true, booking: updated, emailSent, isAfterHours: afterHoursFlag, calendarEventCreated });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/bookings/:id/decline", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const bookingId = parseId(req.params.id);
      const { reason } = req.body;
      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const updated = await storage.updateBooking(bookingId, {
        status: "cancelled",
        paymentStatus: "not_required",
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
      const bookingId = parseId(req.params.id);
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
          const surveyConfig = await storage.getSurveySettings(userId);
          const questions = (surveyConfig?.questions && surveyConfig.questions.length > 0) ? surveyConfig.questions : DEFAULT_SURVEY_QUESTIONS;
          const surveyToken = crypto.randomUUID();
          const survey = await storage.createSurvey({
            userId,
            surveyType: "post_booking",
            relatedId: bookingId,
            contactId: booking.bookerId,
            questions,
            status: "pending",
            manuallyTriggered: false,
            surveyToken,
          });

          try {
            const { sendSurveyEmail } = await import("./email");
            await sendSurveyEmail(contact.email, contact.name || contact.email, booking.startDate, surveyToken, {
              subject: surveyConfig?.emailSubject || undefined,
              intro: surveyConfig?.emailIntro || undefined,
              signoff: surveyConfig?.emailSignoff || undefined,
            });
            await storage.updateSurvey(survey.id, { status: "sent", sentAt: new Date() } as any);
            await storage.updateBooking(bookingId, { postSurveySent: true, isFirstBooking } as any);
            surveyCreated = true;
          } catch (emailErr: any) {
            console.error("Failed to send survey email:", emailErr.message);
            surveyCreated = true;
          }
        }
      }

      const needsInvoice = !booking.xeroInvoiceId && parseFloat(booking.amount || "0") > 0;
      const updatedBooking = await storage.getBooking(bookingId);

      res.json({
        success: true,
        surveyDecision: shouldSendSurvey
          ? surveyCreated ? "Survey sent" : "Survey created but email failed"
          : "Survey skipped (regular booker, not first booking)",
        isOneOff,
        isFirstBooking,
        needsAction: true,
        needsInvoice,
        booking: updatedBooking,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/bookings/:id/mark-served", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const bookingId = parseId(req.params.id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      await storage.updateBooking(bookingId, { servedAt: new Date() } as any);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/bookings/:id/attendance", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const bookingId = parseId(req.params.id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const updates: any = {};
      if (req.body.attendeeCount !== undefined) updates.attendeeCount = req.body.attendeeCount;
      if (req.body.rangatahiCount !== undefined) updates.rangatahiCount = req.body.rangatahiCount;
      if (req.body.attendees !== undefined) updates.attendees = req.body.attendees;
      if (req.body.isRangatahi !== undefined) updates.isRangatahi = req.body.isRangatahi;

      const updated = await storage.updateBooking(bookingId, updates);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/bookings/:id/resend-confirmation", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const bookingId = parseId(req.params.id);
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

  // === Survey Settings API ===
  app.get("/api/survey-settings", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const settings = await storage.getSurveySettings(userId);
    res.json(settings || { questions: null, googleReviewUrl: null, emailSubject: null, emailIntro: null, emailSignoff: null });
  });

  app.put("/api/survey-settings", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const { questions, googleReviewUrl, emailSubject, emailIntro, emailSignoff } = req.body;

    if (googleReviewUrl && typeof googleReviewUrl === "string") {
      const trimmed = googleReviewUrl.trim();
      if (trimmed && !trimmed.startsWith("https://")) {
        return res.status(400).json({ message: "Google Review URL must start with https://" });
      }
    }

    if (questions != null) {
      if (!Array.isArray(questions)) {
        return res.status(400).json({ message: "Questions must be an array" });
      }
      for (const q of questions) {
        if (typeof q.id !== "number" || typeof q.question !== "string" || typeof q.type !== "string") {
          return res.status(400).json({ message: "Each question must have id (number), question (string), and type (string)" });
        }
        const validTypes = ["rating", "yes_no", "text", "testimonial"];
        if (!validTypes.includes(q.type)) {
          return res.status(400).json({ message: `Invalid question type: ${q.type}` });
        }
      }
    }

    const settings = await storage.upsertSurveySettings(userId, {
      questions: questions || null,
      googleReviewUrl: (typeof googleReviewUrl === "string" && googleReviewUrl.trim()) ? googleReviewUrl.trim() : null,
      emailSubject: (typeof emailSubject === "string" && emailSubject.trim()) ? emailSubject.trim() : null,
      emailIntro: (typeof emailIntro === "string" && emailIntro.trim()) ? emailIntro.trim() : null,
      emailSignoff: (typeof emailSignoff === "string" && emailSignoff.trim()) ? emailSignoff.trim() : null,
    });
    res.json(settings);
  });

  // === Surveys API ===
  app.get("/api/surveys", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const surveyList = await storage.getSurveys(userId);
    res.json(surveyList);
  });

  app.get("/api/bookings/:id/survey", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const booking = await storage.getBooking(parseId(req.params.id));
    if (!booking || booking.userId !== userId) return res.status(404).json({ message: "Not found" });
    const survey = await storage.getSurveyByBookingId(booking.id);
    res.json(survey || null);
  });

  app.post("/api/bookings/:id/send-survey", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const bookingId = parseId(req.params.id);
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

      const surveyConfig = await storage.getSurveySettings(userId);
      const questions = (surveyConfig?.questions && surveyConfig.questions.length > 0) ? surveyConfig.questions : DEFAULT_SURVEY_QUESTIONS;
      const surveyToken = crypto.randomUUID();
      const survey = await storage.createSurvey({
        userId,
        surveyType: "post_booking",
        relatedId: bookingId,
        contactId: booking.bookerId,
        questions,
        status: "pending",
        manuallyTriggered: true,
        triggeredBy: booking.bookerId,
        surveyToken,
      });

      try {
        const { sendSurveyEmail } = await import("./email");
        await sendSurveyEmail(contact.email, contact.name || contact.email, booking.startDate, surveyToken, {
          subject: surveyConfig?.emailSubject || undefined,
          intro: surveyConfig?.emailIntro || undefined,
          signoff: surveyConfig?.emailSignoff || undefined,
        });
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

  // === Growth Surveys API ===
  app.get("/api/growth-surveys", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const allSurveys = await storage.getSurveys(userId);
      const growthSurveys = allSurveys.filter(s => s.surveyType === "growth");
      res.json(growthSurveys);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/growth-surveys/send", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { relationshipId } = req.body;
      if (!relationshipId) return res.status(400).json({ message: "relationshipId is required" });

      const rel = await storage.getMentoringRelationship(relationshipId);
      if (!rel) return res.status(404).json({ message: "Relationship not found" });
      if (!await verifyContactOwnership(rel.contactId, userId)) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const contact = await storage.getContact(rel.contactId);
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      if (!contact.email) return res.status(400).json({ message: "Mentee has no email address" });

      const allSurveys = await storage.getSurveys(userId);
      const recentPending = allSurveys.find(s =>
        s.surveyType === "growth" &&
        s.relatedId === relationshipId &&
        (s.status === "pending" || s.status === "sent") &&
        s.createdAt && (Date.now() - new Date(s.createdAt).getTime()) < 7 * 24 * 60 * 60 * 1000
      );
      if (recentPending) {
        return res.status(400).json({ message: "A growth survey was already sent to this mentee in the last 7 days and hasn't been completed yet" });
      }

      const { GROWTH_METRICS, GROWTH_SURVEY_WRITTEN_QUESTIONS } = await import("@shared/schema");

      const metrics = GROWTH_METRICS;
      const writtenQs = GROWTH_SURVEY_WRITTEN_QUESTIONS;

      const questions = [
        ...metrics.map((m: any, i: number) => ({
          id: i + 1,
          type: "slider",
          question: m.label,
          subtext: m.description,
          key: m.key,
          scale: 10,
          required: true,
        })),
        ...writtenQs.map((q: any, i: number) => ({
          id: metrics.length + i + 1,
          type: "text",
          question: q.label,
          key: q.key,
          required: false,
          placeholder: q.placeholder,
        })),
      ];

      const surveyToken = (await import("crypto")).randomUUID();
      const survey = await storage.createSurvey({
        userId,
        surveyType: "growth",
        relatedId: rel.id,
        contactId: rel.contactId,
        questions,
        status: "pending",
        surveyToken,
      });

      try {
        const user = await storage.getUser(userId);
        const { sendGrowthSurveyEmail } = await import("./email");
        await sendGrowthSurveyEmail(contact.email, contact.name || contact.email, surveyToken, user?.username || undefined);
        await storage.updateSurvey(survey.id, { status: "sent", sentAt: new Date() } as any);
      } catch (emailErr: any) {
        console.error("Failed to send growth survey email:", emailErr.message);
      }

      res.json({ success: true, survey });
    } catch (error: any) {
      console.error("Growth survey send error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // === Public Survey Routes (no auth) ===
  app.get("/api/public/survey/:token", async (req, res) => {
    try {
      const survey = await storage.getSurveyByToken(req.params.token);
      if (!survey) return res.status(404).json({ message: "Survey not found" });
      const surveyConfig = await storage.getSurveySettings(survey.userId);
      const googleReviewUrl = surveyConfig?.googleReviewUrl || null;
      if (survey.status === "completed") return res.json({ ...survey, alreadyCompleted: true, googleReviewUrl });
      if (survey.status === "expired") return res.status(410).json({ message: "Survey has expired" });
      res.json({ ...survey, googleReviewUrl });
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

      if (survey.surveyType === "growth" && survey.contactId) {
        try {
          const questions = (survey.questions as any[]) || [];
          const metricsUpdate: Record<string, number> = {};
          for (const resp of responses) {
            const q = questions.find((q: any) => q.id === resp.questionId);
            if (q && q.type === "slider" && q.key && typeof resp.answer === "number") {
              metricsUpdate[q.key] = Math.min(10, Math.max(1, Math.round(resp.answer)));
            }
          }
          if (Object.keys(metricsUpdate).length > 0) {
            const existingContact = await storage.getContact(survey.contactId);
            const existingMetrics = (existingContact?.metrics as Record<string, any>) || {};
            if (Object.keys(existingMetrics).length > 0) {
              try {
                await storage.createMetricSnapshot({
                  contactId: survey.contactId,
                  userId: survey.userId,
                  metrics: existingMetrics as any,
                  source: "survey",
                });
              } catch (snapErr) {
                console.error("Failed to create metric snapshot from survey:", snapErr);
              }
            }
            const mergedMetrics = { ...existingMetrics, ...metricsUpdate };
            await storage.updateContact(survey.contactId, { metrics: mergedMetrics } as any);
          }
        } catch (metricsErr) {
          console.error("Failed to update contact metrics from growth survey:", metricsErr);
        }
      }

      res.json({ success: true, message: "Thank you for your feedback!" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // === Public Casual Hire Routes (no auth) ===
  app.get("/api/public/casual-hire/venues", async (_req, res) => {
    try {
      const result = await db.execute(sql`SELECT id, name, space_name as "spaceName", capacity, description, user_id as "userId" FROM venues WHERE active = true ORDER BY name`);
      const rows = (result as any).rows || result;
      res.json(rows);
    } catch (err: any) {
      console.error("Casual hire venues error:", err);
      res.status(500).json({ message: "Failed to fetch venues" });
    }
  });

  app.get("/api/public/casual-hire/org-info", async (_req, res) => {
    try {
      const result = await db.execute(sql`SELECT name, location FROM organisation_profile LIMIT 1`);
      const profile = (result as any).rows?.[0] || (result as any)[0];
      res.json({
        name: profile?.name || "ReserveTMK Digital",
        location: profile?.location || null,
      });
    } catch (err: any) {
      res.json({ name: "ReserveTMK Digital", location: null });
    }
  });

  app.get("/api/public/casual-hire/availability", async (req, res) => {
    try {
      const venueId = parseId(req.query.venueId);
      const month = parseStr(req.query.month);
      if (!venueId || !month) {
        return res.status(400).json({ message: "venueId and month required" });
      }

      const [yearStr, monthStr] = month.split("-");
      const year = parseInt(yearStr);
      const mon = parseInt(monthStr) - 1;
      const monthStart = new Date(year, mon, 1);
      const monthEnd = new Date(year, mon + 1, 0, 23, 59, 59);

      const allBookingsRows = await db.select().from(bookings);
      const venueBookings = allBookingsRows.filter(b => {
        const bIds = b.venueIds || (b.venueId ? [b.venueId] : []);
        if (!bIds.includes(venueId)) return false;
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
        dates[dateStr].bookings.push({
          startTime: booking.startTime,
          endTime: booking.endTime,
          title: "Booked",
          isYours: false,
        });
      }

      for (const [dateStr, info] of Object.entries(dates)) {
        if (info.bookings.length === 0) {
          info.status = "available";
        } else {
          const totalMinutesCovered = info.bookings.reduce((acc, b) => {
            const start = b.startTime ? parseTimeToMinutes(b.startTime) : 480;
            const end = b.endTime ? parseTimeToMinutes(b.endTime) : 1020;
            return acc + (end - start);
          }, 0);
          const businessDayMinutes = 540;
          if (totalMinutesCovered >= businessDayMinutes) {
            info.status = "booked";
          } else {
            info.status = "partial";
          }
        }
      }

      res.json({ dates });
    } catch (err: any) {
      console.error("Casual hire availability error:", err);
      res.status(500).json({ message: "Failed to fetch availability" });
    }
  });

  app.post("/api/public/casual-hire/book", async (req, res) => {
    try {
      const { name, email, phone, organisation, venueId, venueIds: rawVenueIds, startDate, startTime, endTime, classification, bookingSummary, attendeeCount, invoiceEmail, notes, isFirstBooking } = req.body;
      if (!name || !email || !phone || !venueId || !startDate || !startTime || !endTime || !classification) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      if (!bookingSummary || !String(bookingSummary).trim()) {
        return res.status(400).json({ message: "Booking summary is required" });
      }

      const startMin = parseTimeToMinutes(startTime);
      const endMin = parseTimeToMinutes(endTime);
      if (endMin <= startMin) {
        return res.status(400).json({ message: "End time must be after start time" });
      }

      const resolvedVenueIds: number[] = Array.isArray(rawVenueIds) && rawVenueIds.length > 0
        ? rawVenueIds.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id))
        : [venueId];

      const venue = await storage.getVenue(venueId);
      if (!venue) {
        return res.status(400).json({ message: "Invalid venue" });
      }
      if (venue.capacity && attendeeCount && attendeeCount > venue.capacity) {
        return res.status(400).json({
          message: `Attendee count (${attendeeCount}) exceeds venue capacity (${venue.capacity})`,
        });
      }

      const ownerUserId = venue.userId;

      for (const vid of resolvedVenueIds) {
        const v = await storage.getVenue(vid);
        if (!v || v.userId !== ownerUserId) {
          return res.status(400).json({ message: "Invalid venue selection" });
        }
      }

      const allBookingsRows = await storage.getBookings(ownerUserId);
      const conflicting = allBookingsRows.filter(b => {
        const bIds = b.venueIds || (b.venueId ? [b.venueId] : []);
        const hasOverlappingVenue = resolvedVenueIds.some(vid => bIds.includes(vid));
        if (!hasOverlappingVenue || b.status === "cancelled") return false;
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
          message: "That time slot is already booked. Please choose a different time.",
          conflicts: conflicting.map(c => ({
            startTime: c.startTime,
            endTime: c.endTime,
          })),
        });
      }

      const allContacts = await storage.getContacts(ownerUserId);
      let contactId: number | null = null;
      let bookerGroupId: number | null = null;
      const normalizedEmail = email.trim().toLowerCase();
      const existingContact = allContacts.find((c: any) => {
        if (!c.email) return false;
        const emails = c.email.split(/[,;]\s*/).map((e: string) => e.trim().toLowerCase());
        return emails.includes(normalizedEmail);
      });

      if (existingContact) {
        contactId = existingContact.id;
        if (phone && !existingContact.phone) {
          await storage.updateContact(existingContact.id, { phone: phone.trim() } as any);
        }
        const contactGroups = await storage.getContactGroups(existingContact.id);
        if (contactGroups.length > 0) {
          bookerGroupId = contactGroups[0].groupId;
        }
      } else {
        const newContact = await storage.createContact({
          userId: ownerUserId,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          organization: organisation?.trim() || null,
          role: "Booker",
          isCommunityMember: false,
          isInnovator: false,
          communityTier: "all_contacts",
        } as any);
        contactId = newContact.id;
      }

      const startMinutes = parseTimeToMinutes(startTime);
      const endMinutes = parseTimeToMinutes(endTime);
      const durationHours = (endMinutes - startMinutes) / 60;
      let durationType = "hourly";
      if (durationHours >= 8) durationType = "full_day";
      else if (durationHours >= 4) durationType = "half_day";

      const booking = await storage.createBooking({
        userId: ownerUserId,
        venueId: resolvedVenueIds[0],
        venueIds: resolvedVenueIds,
        title: `${classification} - Casual Enquiry`,
        classification,
        status: "enquiry",
        startDate: new Date(startDate),
        startTime,
        endTime,
        durationType,
        pricingTier: "full_price",
        amount: "0",
        bookerId: contactId,
        bookerGroupId,
        bookingSummary: String(bookingSummary).trim(),
        bookerName: name.trim(),
        bookingSource: "casual",
        attendeeCount: attendeeCount || null,
        invoiceEmail: invoiceEmail ? String(invoiceEmail).trim() : null,
        notes: notes || null,
        isFirstBooking: isFirstBooking || false,
      } as any);

      try {
        const { sendVenueEnquiryAlert } = await import("./email");
        await sendVenueEnquiryAlert({
          userId: ownerUserId,
          bookerName: name.trim(),
          bookerEmail: email,
          bookerPhone: phone || null,
          title: `${classification} - Casual Enquiry`,
          classification,
          startDate,
          startTime,
          endTime,
          notes: String(bookingSummary).trim() || null,
          venueId: resolvedVenueIds[0],
          venueIds: resolvedVenueIds,
          source: "casual_hire",
        });
      } catch (emailErr) {
        console.error("[Email] Venue enquiry alert failed (casual hire):", emailErr);
      }

      res.json({ success: true, bookingId: booking.id });
    } catch (err: any) {
      console.error("Casual hire booking error:", err);
      res.status(500).json({ message: err.message || "Failed to submit enquiry" });
    }
  });

  // === Studio Booker History Check ===
  app.get("/api/public/spaces/check-studio-booker", async (req, res) => {
    try {
      const email = parseStr(req.query.email);
      const userIdRaw = parseStr(req.query.userId);
      if (!email || !userIdRaw) {
        return res.status(400).json({ message: "email and userId are required" });
      }

      const resolved = await resolveMentorUserId(userIdRaw);
      const ownerUserId = resolved.ownerUserId || resolved.availabilityUserId;

      const allContacts = await storage.getContacts(ownerUserId);
      const normalizedEmail = email.trim().toLowerCase();
      const contact = allContacts.find((c: any) => {
        if (!c.email) return false;
        const emails = (c.email as string).split(/[,;]\s*/).map((e: string) => e.trim().toLowerCase());
        return emails.includes(normalizedEmail);
      });

      if (!contact) {
        return res.json({ isReturning: false, bookingCount: 0 });
      }

      const allVenues = await storage.getVenues(ownerUserId);
      const studioVenueIds = new Set(allVenues.filter((v: any) => v.spaceName === "Podcast Studio").map((v: any) => v.id));

      const allBookings = await storage.getBookings(ownerUserId);
      const studioBookings = allBookings.filter((b: any) => {
        if (!["confirmed", "completed"].includes(b.status || "")) return false;
        if (b.bookerId !== contact.id) return false;
        const bVenueIds: number[] = b.venueIds || (b.venueId ? [b.venueId] : []);
        return bVenueIds.some((vid: number) => studioVenueIds.has(vid));
      });

      return res.json({ isReturning: studioBookings.length > 0, bookingCount: studioBookings.length });
    } catch (err: any) {
      console.error("Studio booker check error:", err);
      res.status(500).json({ message: "Failed to check studio booking history" });
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

      const normalize = (s: string | null | undefined): string => {
        return (s || "").toLowerCase().trim().replace(/\s+/g, " ");
      };
      const similarity = (a: string, b: string): number => {
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
    const id = parseId(req.params.id);
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
      const id = parseId(req.params.id);
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
    const id = parseId(req.params.id);
    const existing = await storage.getGroup(id);
    if (!existing) return res.status(404).json({ message: "Group not found" });
    if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteGroup(id);
    res.status(204).send();
  });

  // Group Members
  app.get(api.groups.members.list.path, isAuthenticated, async (req, res) => {
    const groupId = parseId(req.params.id);
    const members = await storage.getGroupMembers(groupId);
    res.json(members);
  });

  app.post(api.groups.members.add.path, isAuthenticated, async (req, res) => {
    try {
      const groupId = parseId(req.params.id);
      const body = { ...req.body, groupId };
      const input = api.groups.members.add.input.parse(body);
      const member = await storage.addGroupMember(input);
      res.status(201).json(member);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete(api.groups.members.remove.path, isAuthenticated, async (req, res) => {
    const memberId = parseId(req.params.memberId);
    await storage.removeGroupMember(memberId);
    res.status(204).send();
  });

  app.get("/api/groups/all-associations", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userGroups = await db.select({ id: groups.id }).from(groups).where(eq(groups.userId, userId));
      const userGroupIds = userGroups.map(g => g.id);
      if (userGroupIds.length === 0) return res.json([]);
      const allAssocs = await db.select().from(groupAssociations).where(
        or(
          inArray(groupAssociations.groupId, userGroupIds),
          inArray(groupAssociations.associatedGroupId, userGroupIds)
        )
      );
      res.json(allAssocs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/groups/:id/associations", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const groupId = parseId(req.params.id);
      const group = await storage.getGroup(groupId);
      if (!group || group.userId !== userId) return res.status(404).json({ message: "Group not found" });
      const associations = await db.select().from(groupAssociations).where(
        or(eq(groupAssociations.groupId, groupId), eq(groupAssociations.associatedGroupId, groupId))
      );
      res.json(associations);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/groups/:id/associations", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const groupId = parseId(req.params.id);
      const { associatedGroupId, relationshipType = "peer" } = req.body;
      if (!associatedGroupId || groupId === associatedGroupId) {
        return res.status(400).json({ message: "Invalid association" });
      }
      if (!["parent", "child", "peer"].includes(relationshipType)) {
        return res.status(400).json({ message: "Invalid relationship type" });
      }
      const group = await storage.getGroup(groupId);
      if (!group || group.userId !== userId) return res.status(404).json({ message: "Group not found" });
      const assocGroup = await storage.getGroup(associatedGroupId);
      if (!assocGroup || assocGroup.userId !== userId) return res.status(404).json({ message: "Associated group not found" });
      const existing = await db.select().from(groupAssociations).where(
        or(
          and(eq(groupAssociations.groupId, groupId), eq(groupAssociations.associatedGroupId, associatedGroupId)),
          and(eq(groupAssociations.groupId, associatedGroupId), eq(groupAssociations.associatedGroupId, groupId))
        )
      );
      if (existing.length > 0) {
        return res.status(409).json({ message: "Association already exists" });
      }
      if (relationshipType === "parent") {
        const [association] = await db.insert(groupAssociations).values({
          groupId: associatedGroupId,
          associatedGroupId: groupId,
          relationshipType: "parent",
        }).returning();
        res.status(201).json(association);
      } else if (relationshipType === "child") {
        const [association] = await db.insert(groupAssociations).values({
          groupId,
          associatedGroupId,
          relationshipType: "parent",
        }).returning();
        res.status(201).json(association);
      } else {
        const [association] = await db.insert(groupAssociations).values({
          groupId,
          associatedGroupId,
          relationshipType: "peer",
        }).returning();
        res.status(201).json(association);
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/groups/:id/associations/:associationId", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const groupId = parseId(req.params.id);
      const group = await storage.getGroup(groupId);
      if (!group || group.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const associationId = parseId(req.params.associationId);
      const [assoc] = await db.select().from(groupAssociations).where(eq(groupAssociations.id, associationId));
      if (!assoc || (assoc.groupId !== groupId && assoc.associatedGroupId !== groupId)) {
        return res.status(404).json({ message: "Association not found" });
      }
      const { relationshipType } = req.body;
      if (!relationshipType || !["parent", "child", "peer"].includes(relationshipType)) {
        return res.status(400).json({ message: "Invalid relationship type" });
      }
      const otherId = assoc.groupId === groupId ? assoc.associatedGroupId : assoc.groupId;
      if (relationshipType === "parent") {
        const [updated] = await db.update(groupAssociations)
          .set({ groupId: otherId, associatedGroupId: groupId, relationshipType: "parent" })
          .where(eq(groupAssociations.id, associationId))
          .returning();
        res.json(updated);
      } else if (relationshipType === "child") {
        const [updated] = await db.update(groupAssociations)
          .set({ groupId, associatedGroupId: otherId, relationshipType: "parent" })
          .where(eq(groupAssociations.id, associationId))
          .returning();
        res.json(updated);
      } else {
        const [updated] = await db.update(groupAssociations)
          .set({ relationshipType: "peer" })
          .where(eq(groupAssociations.id, associationId))
          .returning();
        res.json(updated);
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/groups/:id/associations/:associationId", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const groupId = parseId(req.params.id);
      const group = await storage.getGroup(groupId);
      if (!group || group.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const associationId = parseId(req.params.associationId);
      const [assoc] = await db.select().from(groupAssociations).where(eq(groupAssociations.id, associationId));
      if (!assoc || (assoc.groupId !== groupId && assoc.associatedGroupId !== groupId)) {
        return res.status(404).json({ message: "Association not found" });
      }
      await db.delete(groupAssociations).where(eq(groupAssociations.id, associationId));
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/group-memberships/all", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const rows = await db.select({
        id: groupMembers.id,
        groupId: groupMembers.groupId,
        contactId: groupMembers.contactId,
        name: groups.name,
        type: groups.type,
      })
        .from(groupMembers)
        .innerJoin(groups, eq(groupMembers.groupId, groups.id))
        .where(eq(groups.userId, userId));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Contact's group memberships
  app.get("/api/contacts/:id/groups", isAuthenticated, async (req, res) => {
    const contactId = parseId(req.params.id);
    const memberships = await storage.getContactGroups(contactId);
    res.json(memberships);
  });

  // === Group Taxonomy Links ===
  app.get("/api/groups/:id/taxonomy-links", isAuthenticated, async (req, res) => {
    try {
      const group = await storage.getGroup(parseId(req.params.id));
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
      const groupId = parseId(req.params.id);
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
      const id = parseId(req.params.id);
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
      if (err instanceof AIKeyMissingError) return res.status(503).json({ message: err.message });
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

  // HTML monthly report — standalone branded page, open in browser, print to PDF
  const handleMonthlyReport = async (req: any, res: any) => {
    try {
      const userId = (req.user as any).claims.sub;
      const month = parseStr(req.query.month); // YYYY-MM
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ message: "month parameter required (YYYY-MM)" });
      }

      const [yearStr, monthStr] = month.split("-");
      const year = parseInt(yearStr, 10);
      const monthNum = parseInt(monthStr, 10);
      const startDate = `${month}-01`;
      const endDate = monthNum === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(monthNum + 1).padStart(2, "0")}-01`;

      const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const monthName = MONTH_NAMES[monthNum - 1];

      // Determine FY (Jul-Jun)
      const fyStart = monthNum >= 7 ? year : year - 1;
      const fyEnd = fyStart + 1;
      const fyLabel = `FY${String(fyEnd).slice(2)}`;
      const fyStartDate = `${fyStart}-07-01`;

      const funderName = parseStr(req.query.funder) || undefined;
      const filters: ReportFilters = { userId, startDate, endDate };
      const ytdFilters: ReportFilters = { userId, startDate: fyStartDate, endDate };

      // Pull all data in parallel
      const [delivery, ytdDelivery, ftRows, ytdFtRows, communityRows, spaceUseRows, debriefRows] = await Promise.all([
        getDeliveryMetrics(filters),
        getDeliveryMetrics(ytdFilters),
        db.execute(sql`
          SELECT SUM(count) as total
          FROM daily_foot_traffic
          WHERE user_id = ${userId}
          AND date >= ${new Date(startDate)} AND date < ${new Date(endDate)}
        `),
        db.execute(sql`
          SELECT SUM(count) as total
          FROM daily_foot_traffic
          WHERE user_id = ${userId}
          AND date >= ${new Date(fyStartDate)} AND date < ${new Date(endDate)}
        `),
        db.execute(sql`
          SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN relationship_stage = 'kakano' OR (relationship_stage IS NULL AND stage IS NULL) THEN 1 END) as kakano,
            COUNT(CASE WHEN relationship_stage = 'tipu' THEN 1 END) as tipu,
            COUNT(CASE WHEN relationship_stage = 'ora' THEN 1 END) as ora,
            COUNT(CASE WHEN ethnicity @> ARRAY['Māori']::text[] THEN 1 END) as maori,
            COUNT(CASE WHEN ethnicity && ARRAY[${sql.join(PASIFIKA_ETHNICITIES.map(e => sql`${e}`), sql`, `)}]::text[] THEN 1 END) as pasifika,
            COUNT(CASE WHEN is_rangatahi = true THEN 1 END) as rangatahi
          FROM contacts
          WHERE user_id = ${userId}
          AND active = true AND is_archived = false
          AND (is_innovator = true OR is_community_member = true)
        `),
        db.execute(sql`
          SELECT
            COALESCE(g.name, b.booker_name) as organisation,
            b.classification as type,
            COUNT(*) as bookings,
            BOOL_OR(g.is_maori) as is_maori,
            BOOL_OR(g.is_pasifika) as is_pasifika
          FROM bookings b
          LEFT JOIN groups g ON g.id = b.booker_group_id
          WHERE b.user_id = ${userId}
            AND b.start_date >= ${new Date(startDate)}
            AND b.start_date < ${new Date(endDate)}
            AND b.status IN ('confirmed', 'completed')
            AND b.classification NOT IN ('Meeting', 'Internal')
          GROUP BY COALESCE(g.name, b.booker_name), b.classification
          ORDER BY organisation
        `),
        db.execute(sql`
          SELECT il.title, il.notes
          FROM impact_logs il
          WHERE il.user_id = ${userId}
          AND il.status = 'confirmed'
          AND il.confirmed_at >= ${new Date(startDate)}
          AND il.confirmed_at < ${new Date(endDate)}
          AND LENGTH(COALESCE(il.notes, '')) > 50
          ORDER BY il.confirmed_at
        `),
      ]);

      // Delivery numbers
      const footTraffic = Number((ftRows as any).rows?.[0]?.total || 0);
      const capabilityBuilding = (delivery.mentoringSessions || 0) + (delivery.programmes?.total || 0);
      const ytdFootTraffic = Number((ytdFtRows as any).rows?.[0]?.total || 0);
      const ytdCapability = (ytdDelivery.mentoringSessions || 0) + (ytdDelivery.programmes?.total || 0);

      // Community snapshot
      const comm = (communityRows as any).rows?.[0] || {};
      const kakano = Number(comm.kakano || 0);
      const tipu = Number(comm.tipu || 0);
      const ora = Number(comm.ora || 0);

      // Space use
      const spaceUse = ((spaceUseRows as any).rows || []).map((r: any) => ({
        organisation: r.organisation || "Unknown",
        type: r.type || "",
        bookings: Number(r.bookings || 0),
        maori: r.is_maori === true,
        pasifika: r.is_pasifika === true,
      }));

      // Updates from debriefs
      const updateItems = ((debriefRows as any).rows || []).map((r: any) => {
        const title = r.title || "Update";
        const notes = (r.notes || "").slice(0, 200);
        return `${title} — ${notes}`;
      });

      // Taxonomy breakdown for report
      const rawTaxBreakdown = await getTaxonomyBreakdown({ userId, startDate, endDate });
      const taxMap = new Map<string, { funderName: string; entityCounts: Record<string, number>; total: number }>();
      for (const row of rawTaxBreakdown) {
        if (!taxMap.has(row.categoryName)) {
          taxMap.set(row.categoryName, { funderName: row.funderName, entityCounts: {}, total: 0 });
        }
        const entry = taxMap.get(row.categoryName)!;
        entry.entityCounts[row.entityType] = (entry.entityCounts[row.entityType] || 0) + row.count;
        entry.total += row.count;
      }
      const taxonomyBreakdown = Array.from(taxMap.entries()).map(([categoryName, data]) => ({
        categoryName,
        ...data,
      }));

      const reportData: MonthlyReportData = {
        period: { month: month, year, label: `${monthName} ${year}`, fyLabel },
        funderName,
        deliveryNumbers: {
          activations: delivery.totalActivations || 0,
          capabilityBuilding,
          footTraffic,
          ytdActivations: ytdDelivery.totalActivations || 0,
          ytdCapability,
          ytdFootTraffic,
        },
        communitySnapshot: {
          maori: Number(comm.maori || 0),
          pasifika: Number(comm.pasifika || 0),
          rangatahi: Number(comm.rangatahi || 0),
          total: Number(comm.total || 0),
          kakano,
          tipu,
          ora,
          innovatorTotal: kakano + tipu + ora,
        },
        spaceUse,
        updates: { "Updates": updateItems },
        quotes: Array.isArray(req.body?.quotes) ? req.body.quotes : [],
        plannedNextMonth: Array.isArray(req.body?.plannedNext) ? req.body.plannedNext : [],
        taxonomyBreakdown: taxonomyBreakdown.length > 0 ? taxonomyBreakdown : undefined,
      };

      const html = renderMonthlyReport(reportData);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (err: any) {
      console.error("Monthly HTML report error:", err.message);
      res.status(500).json({ message: "Failed to generate monthly report" });
    }
  };
  app.get("/api/reports/html/monthly", isAuthenticated, handleMonthlyReport);
  app.post("/api/reports/html/monthly", isAuthenticated, handleMonthlyReport);

  // ── Quarterly branded HTML report ──────────────────────────────────────

  const handleQuarterlyReport = async (req: any, res: any) => {
    try {
      const userId = (req.user as any).claims.sub;
      const startDate = parseStr(req.query.startDate);
      const endDate = parseStr(req.query.endDate);
      const quarter = parseStr(req.query.quarter); // e.g. "2026-Q1"

      if (!startDate || !endDate || !quarter) {
        return res.status(400).json({ message: "startDate, endDate, and quarter params required" });
      }

      const funderName = parseStr(req.query.funder) || undefined;
      const [yearStr, qStr] = quarter.split("-Q");
      const year = parseInt(yearStr, 10);
      const qNum = parseInt(qStr, 10);
      const quarterLabel = `Q${qNum} ${year}`;

      // Determine the 3 months in the quarter
      const qStartMonth = (qNum - 1) * 3; // 0-indexed (Q1=0, Q2=3, etc.)
      const months: string[] = [];
      for (let i = 0; i < 3; i++) {
        const m = qStartMonth + i;
        const mYear = year;
        months.push(`${mYear}-${String(m + 1).padStart(2, "0")}`);
      }

      // Determine FY (Jul-Jun)
      const fyStartMonth = months[0].split("-").map(Number);
      const fyStart = fyStartMonth[1] >= 7 ? fyStartMonth[0] : fyStartMonth[0] - 1;
      const fyEnd = fyStart + 1;
      const fyLabel = `FY${String(fyEnd).slice(2)}`;
      const fyStartDate = `${fyStart}-07-01`;

      // Pull delivery metrics per month + full quarter
      const monthDeliveries = await Promise.all(
        months.map(m => {
          const mStart = `${m}-01`;
          const [y, mo] = m.split("-").map(Number);
          const mEnd = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, "0")}-01`;
          return getDeliveryMetrics({ userId, startDate: mStart, endDate: mEnd });
        })
      );

      // YTD delivery
      const ytdDelivery = await getDeliveryMetrics({ userId, startDate: fyStartDate, endDate });

      // Foot traffic per month + total
      const ftByMonth: Record<string, number> = {};
      let ftTotal = 0;
      for (const m of months) {
        const mStart = `${m}-01`;
        const [y, mo] = m.split("-").map(Number);
        const mEnd = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, "0")}-01`;
        const ftRow = await db.execute(sql`
          SELECT COALESCE(SUM(count), 0) as total FROM daily_foot_traffic
          WHERE user_id = ${userId} AND date >= ${new Date(mStart)} AND date < ${new Date(mEnd)}
        `);
        const val = Number((ftRow as any).rows?.[0]?.total || 0);
        ftByMonth[m] = val;
        ftTotal += val;
      }

      // YTD foot traffic
      const ytdFtRow = await db.execute(sql`
        SELECT COALESCE(SUM(count), 0) as total FROM daily_foot_traffic
        WHERE user_id = ${userId} AND date >= ${new Date(fyStartDate)} AND date < ${new Date(endDate)}
      `);
      const ytdFootTraffic = Number((ytdFtRow as any).rows?.[0]?.total || 0);

      // Community snapshot
      const communityRows = await db.execute(sql`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN relationship_stage = 'kakano' OR (relationship_stage IS NULL AND stage IS NULL) THEN 1 END) as kakano,
          COUNT(CASE WHEN relationship_stage = 'tipu' THEN 1 END) as tipu,
          COUNT(CASE WHEN relationship_stage = 'ora' THEN 1 END) as ora,
          COUNT(CASE WHEN ethnicity @> ARRAY['Māori']::text[] THEN 1 END) as maori,
          COUNT(CASE WHEN ethnicity && ARRAY[${sql.join(PASIFIKA_ETHNICITIES.map(e => sql`${e}`), sql`, `)}]::text[] THEN 1 END) as pasifika,
          COUNT(CASE WHEN is_rangatahi = true THEN 1 END) as rangatahi
        FROM contacts
        WHERE user_id = ${userId}
        AND active = true AND is_archived = false
        AND (is_innovator = true OR is_community_member = true)
      `);
      const comm = (communityRows as any).rows?.[0] || {};
      const kakano = Number(comm.kakano || 0);
      const tipu = Number(comm.tipu || 0);
      const ora = Number(comm.ora || 0);

      // Space use for the quarter
      const spaceUseRows = await db.execute(sql`
        SELECT
          COALESCE(g.name, b.booker_name) as organisation,
          b.classification as type,
          COUNT(*) as bookings,
          BOOL_OR(g.is_maori) as is_maori,
          BOOL_OR(g.is_pasifika) as is_pasifika
        FROM bookings b
        LEFT JOIN groups g ON g.id = b.booker_group_id
        WHERE b.user_id = ${userId}
          AND b.start_date >= ${new Date(startDate)}
          AND b.start_date < ${new Date(endDate)}
          AND b.status IN ('confirmed', 'completed')
          AND b.classification NOT IN ('Meeting', 'Internal')
        GROUP BY COALESCE(g.name, b.booker_name), b.classification
        ORDER BY organisation
      `);
      const spaceUse = ((spaceUseRows as any).rows || []).map((r: any) => ({
        organisation: r.organisation || "Unknown",
        type: r.type || "",
        bookings: Number(r.bookings || 0),
        maori: r.is_maori === true,
        pasifika: r.is_pasifika === true,
      }));

      // Debrief updates
      const debriefRows = await db.execute(sql`
        SELECT il.title, il.notes
        FROM impact_logs il
        WHERE il.user_id = ${userId}
        AND il.status = 'confirmed'
        AND il.confirmed_at >= ${new Date(startDate)}
        AND il.confirmed_at < ${new Date(endDate)}
        AND LENGTH(COALESCE(il.notes, '')) > 50
        ORDER BY il.confirmed_at
      `);
      const updateItems = ((debriefRows as any).rows || []).map((r: any) => {
        const title = r.title || "Update";
        const notes = (r.notes || "").slice(0, 200);
        return `${title} — ${notes}`;
      });

      // Build delivery numbers array (per-month breakdown)
      const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const deliveryNumbers: QuarterlyReportData["deliveryNumbers"] = [
        {
          metric: "Activations*",
          values: Object.fromEntries(months.map((m, i) => [m, monthDeliveries[i].totalActivations])),
          quarterTotal: monthDeliveries.reduce((s, d) => s + d.totalActivations, 0),
          ytd: ytdDelivery.totalActivations,
        },
        {
          metric: "Capability Building†",
          values: Object.fromEntries(months.map((m, i) => [m, monthDeliveries[i].mentoringSessions + monthDeliveries[i].programmes.total])),
          quarterTotal: monthDeliveries.reduce((s, d) => s + d.mentoringSessions + d.programmes.total, 0),
          ytd: ytdDelivery.mentoringSessions + ytdDelivery.programmes.total,
        },
        {
          metric: "Foot Traffic",
          values: Object.fromEntries(months.map(m => [m, ftByMonth[m] || 0])),
          quarterTotal: ftTotal,
          ytd: ytdFootTraffic,
        },
      ];

      // ── Māori & Pasifika Pipeline ────────────────────────────────────────
      const [maoriInnovRows, pasifikaInnovRows, maoriMentoringRows, maoriProgRows, maoriProgressionRows] = await Promise.all([
        db.execute(sql`
          SELECT
            COALESCE(relationship_stage, 'kakano') as stage, COUNT(*) as count
          FROM contacts
          WHERE user_id = ${userId} AND active = true AND is_archived = false AND is_innovator = true
            AND ethnicity @> ARRAY['Māori']::text[]
          GROUP BY relationship_stage
        `),
        db.execute(sql`
          SELECT
            COALESCE(relationship_stage, 'kakano') as stage, COUNT(*) as count
          FROM contacts
          WHERE user_id = ${userId} AND active = true AND is_archived = false AND is_innovator = true
            AND ethnicity && ARRAY[${sql.join(PASIFIKA_ETHNICITIES.map(e => sql`${e}`), sql`, `)}]::text[]
            AND NOT (ethnicity @> ARRAY['Māori']::text[])
          GROUP BY relationship_stage
        `),
        db.execute(sql`
          SELECT COUNT(DISTINCT mr.contact_id) as count
          FROM mentoring_relationships mr
          JOIN contacts c ON c.id = mr.contact_id
          WHERE mr.status = 'active' AND c.user_id = ${userId}
            AND c.ethnicity @> ARRAY['Māori']::text[]
        `),
        db.execute(sql`
          SELECT COUNT(DISTINCT c.id) as count
          FROM programmes p, unnest(p.attendees) att_id
          JOIN contacts c ON c.id = att_id
          WHERE p.user_id = ${userId} AND p.status != 'cancelled'
            AND p.start_date >= ${new Date(startDate)} AND p.start_date < ${new Date(endDate)}
            AND c.ethnicity @> ARRAY['Māori']::text[]
        `),
        db.execute(sql`
          SELECT COUNT(*) as count
          FROM relationship_stage_history rsh
          JOIN contacts c ON c.id = rsh.entity_id
          WHERE rsh.entity_type = 'contact'
            AND rsh.changed_at >= ${new Date(startDate)} AND rsh.changed_at < ${new Date(endDate)}
            AND c.ethnicity @> ARRAY['Māori']::text[]
            AND c.user_id = ${userId}
        `),
      ]);

      const maoriStages: Record<string, number> = {};
      for (const r of (maoriInnovRows as any).rows || []) maoriStages[r.stage] = Number(r.count);
      const pasifikaStages: Record<string, number> = {};
      for (const r of (pasifikaInnovRows as any).rows || []) pasifikaStages[r.stage] = Number(r.count);

      const maoriTotal = Object.values(maoriStages).reduce((s, v) => s + v, 0);
      const pasifikaTotal = Object.values(pasifikaStages).reduce((s, v) => s + v, 0);

      // Previous quarter metrics for comparison
      let previousQuarter: MaoriPipelineData["previousQuarter"] = undefined;
      try {
        const prevQStart = new Date(startDate);
        prevQStart.setMonth(prevQStart.getMonth() - 3);
        const prevStartStr = prevQStart.toISOString().split("T")[0];
        const prevDelivery = await getDeliveryMetrics({ userId, startDate: prevStartStr, endDate: startDate });
        const prevFt = await db.execute(sql`
          SELECT COALESCE(SUM(count), 0) as total FROM daily_foot_traffic
          WHERE user_id = ${userId} AND date >= ${prevQStart} AND date < ${new Date(startDate)}
        `);
        const prevMaoriCount = await db.execute(sql`
          SELECT COUNT(*) as count FROM contacts
          WHERE user_id = ${userId} AND active = true AND is_archived = false AND is_innovator = true
            AND ethnicity @> ARRAY['Māori']::text[]
        `);
        previousQuarter = {
          innovatorTotal: Number((prevMaoriCount as any).rows?.[0]?.count || 0),
          activations: prevDelivery.totalActivations,
          footTraffic: Number((prevFt as any).rows?.[0]?.total || 0),
          capabilityBuilding: prevDelivery.mentoringSessions + prevDelivery.programmes.total,
        };
      } catch {}

      // Māori orgs using space (groups with Māori-identified contacts as bookers)
      // Note: groups table lacks maori flag, so we use booker contact ethnicity as proxy
      const maoriOrgRows = await db.execute(sql`
        SELECT COALESCE(g.name, b.booker_name) as name, COUNT(*) as bookings
        FROM bookings b
        LEFT JOIN groups g ON g.id = b.booker_group_id
        LEFT JOIN contacts c ON c.id = b.booker_id
        WHERE b.user_id = ${userId}
          AND b.start_date >= ${new Date(startDate)} AND b.start_date < ${new Date(endDate)}
          AND b.status IN ('confirmed', 'completed')
          AND c.ethnicity @> ARRAY['Māori']::text[]
        GROUP BY COALESCE(g.name, b.booker_name)
        ORDER BY bookings DESC
      `);

      const maoriPipeline: MaoriPipelineData = {
        innovators: { total: maoriTotal, kakano: maoriStages["kakano"] || 0, tipu: maoriStages["tipu"] || 0, ora: maoriStages["ora"] || 0 },
        inMentoring: Number((maoriMentoringRows as any).rows?.[0]?.count || 0),
        inProgrammes: Number((maoriProgRows as any).rows?.[0]?.count || 0),
        stageProgressions: Number((maoriProgressionRows as any).rows?.[0]?.count || 0),
        pasifikaInnovators: { total: pasifikaTotal, kakano: pasifikaStages["kakano"] || 0, tipu: pasifikaStages["tipu"] || 0, ora: pasifikaStages["ora"] || 0 },
        maoriOrgs: ((maoriOrgRows as any).rows || []).map((r: any) => ({ name: r.name || "Unknown", bookings: Number(r.bookings) })),
        previousQuarter,
      };

      // Taxonomy breakdown for quarterly report
      const rawQTaxBreakdown = await getTaxonomyBreakdown({ userId, startDate, endDate });
      const qTaxMap = new Map<string, { funderName: string; entityCounts: Record<string, number>; total: number }>();
      for (const row of rawQTaxBreakdown) {
        if (!qTaxMap.has(row.categoryName)) {
          qTaxMap.set(row.categoryName, { funderName: row.funderName, entityCounts: {}, total: 0 });
        }
        const entry = qTaxMap.get(row.categoryName)!;
        entry.entityCounts[row.entityType] = (entry.entityCounts[row.entityType] || 0) + row.count;
        entry.total += row.count;
      }
      const qTaxonomyBreakdown = Array.from(qTaxMap.entries()).map(([categoryName, data]) => ({
        categoryName,
        ...data,
      }));

      const reportData: QuarterlyReportData = {
        period: {
          quarter: quarterLabel,
          year,
          label: `${quarterLabel} (${MONTH_NAMES[qStartMonth]}–${MONTH_NAMES[qStartMonth + 2]} ${year})`,
          fyLabel,
          months,
        },
        funderName,
        deliveryNumbers,
        communitySnapshot: {
          maori: Number(comm.maori || 0),
          pasifika: Number(comm.pasifika || 0),
          rangatahi: Number(comm.rangatahi || 0),
          total: Number(comm.total || 0),
          kakano,
          tipu,
          ora,
          innovatorTotal: kakano + tipu + ora,
        },
        spaceUse,
        updates: { "Updates": updateItems },
        quotes: Array.isArray(req.body?.quotes) ? req.body.quotes : [],
        plannedNextQuarter: Array.isArray(req.body?.plannedNext) ? req.body.plannedNext : [],
        footTraffic: { total: ftTotal, byMonth: ftByMonth },
        maoriPipeline,
        taxonomyBreakdown: qTaxonomyBreakdown.length > 0 ? qTaxonomyBreakdown : undefined,
      };

      const html = renderQuarterlyReport(reportData);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (err: any) {
      console.error("Quarterly HTML report error:", err.message);
      res.status(500).json({ message: "Failed to generate quarterly report" });
    }
  };
  app.get("/api/reports/html/quarterly", isAuthenticated, handleQuarterlyReport);
  app.post("/api/reports/html/quarterly", isAuthenticated, handleQuarterlyReport);

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
      const { startDate, endDate, programmeIds, taxonomyIds, demographicSegments, funder, reportType: reqReportType } = req.body;
      const reportType: "monthly" | "quarterly" = reqReportType === "quarterly" ? "quarterly" : "monthly";

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }

      let orgProfileCtx: OrgProfileContext | undefined;
      let funderProfileCtx: any = null;

      try {
        const orgProfile = await storage.getOrganisationProfile(userId);
        if (orgProfile) {
          orgProfileCtx = {
            name: "Organisation",
            mission: orgProfile.mission,
            description: orgProfile.description,
            targetCommunity: orgProfile.targetCommunity,
            focusAreas: orgProfile.focusAreas,
          };
        }
      } catch {}

      if (funder) {
        try {
          const funderProfile = await storage.getFunderByTag(userId, funder);
          if (funderProfile) {
            funderProfileCtx = funderProfile;
          }
        } catch {}
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

      const cacheKey = getReportCacheKey("generate", { userId, startDate, endDate, programmeIds, taxonomyIds, demographicSegments, funder });

      const result = await deduplicatedReportCall(cacheKey + `:${reportType}`, async () => {
        const report = await getFullMonthlyReport(filters);

        interface EnhancedReportData {
          standoutMoments: Awaited<ReturnType<typeof getStandoutMoments>>;
          operatorInsights: Awaited<ReturnType<typeof getOperatorInsights>> | null;
          peopleTiers: Awaited<ReturnType<typeof getPeopleTierBreakdown>> | null;
          transformationStories: Awaited<ReturnType<typeof getParticipantTransformationStories>>;
          impactHeatmap: Awaited<ReturnType<typeof getImpactTagHeatmap>>;
          theoryOfChange: Awaited<ReturnType<typeof getTheoryOfChangeAlignment>> | null;
          growthStory: Awaited<ReturnType<typeof getGrowthStory>> | null;
          outcomeChain: Awaited<ReturnType<typeof getOutcomeChain>> | null;
          quarterlyMilestones: Awaited<ReturnType<typeof getQuarterlyMilestones>> | null;
        }

        const enhancedData: EnhancedReportData = {
          standoutMoments: [],
          operatorInsights: null,
          peopleTiers: null,
          transformationStories: [],
          impactHeatmap: [],
          theoryOfChange: null,
          growthStory: null,
          outcomeChain: null,
          quarterlyMilestones: null,
        };

        try {
          if (reportType === "quarterly") {
            const funderCtxForFns = funderProfileCtx ? {
              name: funderProfileCtx.name,
              outcomesFramework: funderProfileCtx.outcomesFramework,
              outcomeFocus: funderProfileCtx.outcomeFocus,
              reportingGuidance: funderProfileCtx.reportingGuidance,
              partnershipStrategy: funderProfileCtx.partnershipStrategy,
            } : null;
            const results = await Promise.allSettled([
              getStandoutMoments(filters, 5),
              getOperatorInsights(filters),
              getParticipantTransformationStories(filters, 3),
              getPeopleTierBreakdown(filters),
              getImpactTagHeatmap(filters),
              getTheoryOfChangeAlignment(filters, orgProfileCtx, funderCtxForFns),
              getGrowthStory(filters),
              getOutcomeChain(filters, funderCtxForFns),
              getQuarterlyMilestones(filters),
            ]);
            enhancedData.standoutMoments = results[0].status === "fulfilled" ? results[0].value : [];
            enhancedData.operatorInsights = results[1].status === "fulfilled" ? results[1].value : null;
            enhancedData.transformationStories = results[2].status === "fulfilled" ? results[2].value : [];
            enhancedData.peopleTiers = results[3].status === "fulfilled" ? results[3].value : null;
            enhancedData.impactHeatmap = results[4].status === "fulfilled" ? results[4].value : [];
            enhancedData.theoryOfChange = results[5].status === "fulfilled" ? results[5].value : null;
            enhancedData.growthStory = results[6].status === "fulfilled" ? results[6].value : null;
            enhancedData.outcomeChain = results[7].status === "fulfilled" ? results[7].value : null;
            enhancedData.quarterlyMilestones = results[8].status === "fulfilled" ? results[8].value : null;
          } else {
            const results = await Promise.allSettled([
              getStandoutMoments(filters, 3),
              getOperatorInsights(filters),
              getPeopleTierBreakdown(filters),
            ]);
            enhancedData.standoutMoments = results[0].status === "fulfilled" ? results[0].value : [];
            enhancedData.operatorInsights = results[1].status === "fulfilled" ? results[1].value : null;
            enhancedData.peopleTiers = results[2].status === "fulfilled" ? results[2].value : null;
          }
        } catch (enhanceErr) {
          console.error("Enhanced data error (non-fatal):", enhanceErr);
        }

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

        const orgProfileData = orgProfileCtx ? {
          name: orgProfileCtx.name,
          mission: orgProfileCtx.mission,
          description: orgProfileCtx.description,
          targetCommunity: orgProfileCtx.targetCommunity,
          focusAreas: orgProfileCtx.focusAreas,
        } : null;

        const funderProfileData = funderProfileCtx ? {
          name: funderProfileCtx.name,
          outcomesFramework: funderProfileCtx.outcomesFramework,
          outcomeFocus: funderProfileCtx.outcomeFocus,
          reportingGuidance: funderProfileCtx.reportingGuidance,
        } : null;

        const templateMeta = reportType === "quarterly" ? {
          templateName: "Quarterly Flagship Report",
          templatePurpose: "Comprehensive impact proof with growth story, transformation vignettes, outcome alignment, and trend analysis",
          sections: ["growthStory", "peopleTiers", "standoutMoments", "transformationStories", "outcomeChain", "operatorInsights", "impactHeatmap", "quarterlyMilestones", "theoryOfChange", "reach", "delivery", "impact"],
        } : {
          templateName: "Monthly Pulse Report",
          templatePurpose: "Concise activity summary and standout moments — a quick read for funders",
          sections: ["peopleTiers", "standoutMoments", "operatorInsights", "reach", "delivery", "impact"],
        };

        return {
          ...report,
          reportType,
          templateMeta,
          isBlended,
          boundaryDate: boundaryDateStr,
          legacyReportCount,
          legacyPeriods,
          legacyMetrics,
          legacyHighlights: legacyHighlights.slice(0, 20),
          orgProfile: orgProfileData,
          funderProfile: funderProfileData,
          ...enhancedData,
        };
      });

      res.json(result);
    } catch (err: any) {
      console.error("Report generation error:", err);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  app.post("/api/reports/trends", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { endDate, granularity, periods, programmeIds, taxonomyIds, funder } = req.body;

      if (!endDate) {
        return res.status(400).json({ message: "endDate is required" });
      }

      const gran = granularity === "quarterly" ? "quarterly" : "monthly";
      const numPeriods = Math.min(Math.max(parseInt(periods) || (gran === "monthly" ? 12 : 8), 2), 24);

      const filters: ReportFilters = {
        userId,
        startDate: endDate,
        endDate,
        programmeIds,
        taxonomyIds,
        funder,
      };

      const trendData = await getTrendMetrics(filters, gran, numPeriods);
      res.json(trendData);
    } catch (err: any) {
      console.error("Trend metrics error:", err);
      res.status(500).json({ message: "Failed to generate trend data" });
    }
  });

  app.post("/api/reports/narrative", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { startDate, endDate, programmeIds, taxonomyIds, demographicSegments, funder, narrativeStyle, reportType: reqNarrReportType } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }

      const style: "compliance" | "story" = narrativeStyle === "story" ? "story" : "compliance";
      const narrativeReportType: "monthly" | "quarterly" = reqNarrReportType === "quarterly" ? "quarterly" : "monthly";

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

      let orgProfileCtx: OrgProfileContext | null = null;
      let funderCtx: FunderContext | null = null;

      try {
        const orgProfile = await storage.getOrganisationProfile(userId);
        if (orgProfile) {
          orgProfileCtx = {
            name: "Organisation",
            mission: orgProfile.mission,
            description: orgProfile.description,
            targetCommunity: orgProfile.targetCommunity,
            focusAreas: orgProfile.focusAreas,
          };
        }
      } catch {}

      if (funder) {
        try {
          const funderProfile = await storage.getFunderByTag(userId, funder);
          if (funderProfile) {
            funderCtx = {
              name: funderProfile.name,
              outcomesFramework: funderProfile.outcomesFramework,
              outcomeFocus: funderProfile.outcomeFocus,
              reportingGuidance: funderProfile.reportingGuidance,
              narrativeStyle: funderProfile.narrativeStyle,
              partnershipStrategy: funderProfile.partnershipStrategy,
            };
          }
        } catch {}
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

      const result = await generateNarrative(filters, legacyContext, style, orgProfileCtx, funderCtx, narrativeReportType);
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
      const report = await storage.getReport(parseId(req.params.id));
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
      const id = parseId(req.params.id);
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
      const id = parseId(req.params.id);
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
      const id = parseId(req.params.id);
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
          await (parser as any).load();
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
          } catch (e) {
            if (e instanceof AIKeyMissingError) throw e;
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
          if (extractErr instanceof AIKeyMissingError) return res.status(503).json({ message: extractErr.message });
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
      const id = parseId(req.params.id);
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
                  type: org.type === "community_group" ? "Community Organisation" :
                        org.type === "community_collective" ? "Community Organisation" :
                        org.type === "business" ? "Business" :
                        org.type === "partner" ? "Uncategorised" :
                        org.type === "government" ? "Government / Council" :
                        org.type === "ngo" ? "NGO" :
                        org.type === "education" ? "Education / Training" :
                        org.type === "funder" ? "Funder" :
                        org.type === "resident_company" ? "Resident Company" :
                        org.type === "iwi" ? "Iwi / Hapū" : "Business",
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
                type: org.type === "community_group" ? "Community Organisation" :
                      org.type === "community_collective" ? "Community Organisation" :
                      org.type === "business" ? "Business" :
                      org.type === "partner" ? "Uncategorised" :
                      org.type === "government" ? "Government / Council" :
                      org.type === "ngo" ? "NGO" :
                      org.type === "education" ? "Education / Training" :
                      org.type === "funder" ? "Funder" :
                      org.type === "resident_company" ? "Resident Company" :
                      org.type === "iwi" ? "Iwi / Hapū" : "Business",
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
      const reportId = parseId(req.params.id);
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
          await (parser as any).load();
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
      } catch (e) {
        if (e instanceof AIKeyMissingError) throw e;
        result = { suggestions: [] };
      }
      res.json(result.suggestions || []);
    } catch (err: any) {
      if (err instanceof AIKeyMissingError) return res.status(503).json({ message: err.message });
      console.error("Taxonomy suggestions GET error:", err);
      res.status(500).json({ message: "Failed to generate taxonomy suggestions" });
    }
  });

  app.delete("/api/legacy-reports/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
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
          const d = new Date(b.startDate as any);
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

      const computeMetricBenchmarks = (values: number[], labels: string[]) => {
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
      };

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
    const milestoneList = await storage.getMilestones((req.user as any).claims.sub);
    res.json(milestoneList);
  });

  app.get("/api/milestones/:id", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const milestone = await storage.getMilestone(parseId(req.params.id));
    if (!milestone || milestone.userId !== userId) return res.status(404).json({ message: "Milestone not found" });
    res.json(milestone);
  });

  app.post("/api/milestones", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const milestone = await storage.createMilestone({ ...req.body, userId, createdBy: userId });
      res.status(201).json(milestone);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/milestones/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const milestone = await storage.getMilestone(parseId(req.params.id));
      if (!milestone || milestone.userId !== userId) return res.status(404).json({ message: "Not found" });
      const updated = await storage.updateMilestone(parseId(req.params.id), req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/milestones/:id", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const milestone = await storage.getMilestone(parseId(req.params.id));
    if (!milestone || milestone.userId !== userId) return res.status(404).json({ message: "Not found" });
    await storage.deleteMilestone(parseId(req.params.id));
    res.json({ success: true });
  });

  // ── Relationship Stage Updates ──
  app.patch("/api/contacts/:id/relationship-stage", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
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
          changedBy: (req.user as any).claims.sub,
        });
      }
      const updated = await storage.updateContact(id, { relationshipStage: stage, stage });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/groups/:id/community-status", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
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
      const id = parseId(req.params.id);
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
      const id = parseId(req.params.id);
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
          changedBy: (req.user as any).claims.sub,
        });
      }
      const updated = await storage.updateGroup(id, { relationshipStage: stage });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/relationship-stage-history/:entityType/:entityId", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const entityType = parseStr(req.params.entityType);
    const entityId = parseId(req.params.entityId);
    if (entityType === 'contact') {
      const contact = await storage.getContact(entityId);
      if (!contact || contact.userId !== userId) return res.status(404).json({ message: "Not found" });
    } else if (entityType === 'group') {
      const group = await storage.getGroup(entityId);
      if (!group || group.userId !== userId) return res.status(404).json({ message: "Not found" });
    }
    const history = await storage.getRelationshipStageHistory(entityType, entityId);
    res.json(history);
  });

  // ── Programme Effectiveness ──
  app.get("/api/programme-effectiveness", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
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

  // ── Cohort Analysis ──
  app.get("/api/cohort-analysis", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }
      if (isNaN(Date.parse(startDate)) || isNaN(Date.parse(endDate))) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      if (new Date(startDate) > new Date(endDate)) {
        return res.status(400).json({ message: "startDate must be before endDate" });
      }

      const programmeId = req.query.programmeId ? parseInt(req.query.programmeId as string) : undefined;
      if (req.query.programmeId && (programmeId === undefined || isNaN(programmeId))) {
        return res.status(400).json({ message: "Invalid programmeId" });
      }

      const contactIdsParam = req.query.contactIds as string | undefined;
      const contactIds = contactIdsParam ? contactIdsParam.split(",").map(Number).filter(n => !isNaN(n)) : undefined;

      const def: CohortDefinition = { userId, programmeId, startDate, endDate, contactIds };
      const metrics = await getCohortMetrics(def);
      res.json(metrics);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/cohort-comparison", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;

      const cohortAStart = req.query.cohortAStartDate as string;
      const cohortAEnd = req.query.cohortAEndDate as string;
      const cohortBStart = req.query.cohortBStartDate as string;
      const cohortBEnd = req.query.cohortBEndDate as string;

      if (!cohortAStart || !cohortAEnd || !cohortBStart || !cohortBEnd) {
        return res.status(400).json({ message: "Start and end dates required for both cohorts" });
      }
      for (const d of [cohortAStart, cohortAEnd, cohortBStart, cohortBEnd]) {
        if (isNaN(Date.parse(d))) return res.status(400).json({ message: "Invalid date format" });
      }
      if (new Date(cohortAStart) > new Date(cohortAEnd) || new Date(cohortBStart) > new Date(cohortBEnd)) {
        return res.status(400).json({ message: "Start date must be before end date for each cohort" });
      }

      const cohortAProgId = req.query.cohortAProgrammeId ? parseInt(req.query.cohortAProgrammeId as string) : undefined;
      const cohortBProgId = req.query.cohortBProgrammeId ? parseInt(req.query.cohortBProgrammeId as string) : undefined;

      const [cohortA, cohortB] = await Promise.all([
        getCohortMetrics({ userId, programmeId: cohortAProgId, startDate: cohortAStart, endDate: cohortAEnd }),
        getCohortMetrics({ userId, programmeId: cohortBProgId, startDate: cohortBStart, endDate: cohortBEnd }),
      ]);

      res.json({ cohortA, cohortB });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/programme-attributed-outcomes", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const programmeId = req.query.programmeId ? parseInt(req.query.programmeId as string) : undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const results = await getProgrammeAttributedOutcomes(userId, programmeId, startDate, endDate);
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Funder Tags List (distinct values across all entities) ──
  app.get("/api/funder-tags", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
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
      res.json(Array.from(tagSet).sort());
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Legacy Report PDF Extraction ──
  app.post("/api/legacy-reports/:id/extract-metrics", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
      const report = await storage.getLegacyReport(id);
      if (!report || report.userId !== userId) return res.status(404).json({ message: "Not found" });
      if (!report.pdfData) return res.status(400).json({ message: "No PDF data attached to this report" });

      const { PDFParse: PdfParser2 } = await import("pdf-parse");
      const pdfBuffer = Buffer.from(report.pdfData, "base64");
      const parser = new PdfParser2({ data: pdfBuffer });
      await (parser as any).load();
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
      } catch (e) {
        if (e instanceof AIKeyMissingError) throw e;
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
      if (err instanceof AIKeyMissingError) return res.status(503).json({ message: err.message });
      console.error("PDF extraction error:", err);
      res.status(500).json({ message: "Failed to extract metrics from PDF" });
    }
  });

  app.get("/api/legacy-report-extractions/:reportId", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const reportId = parseId(req.params.reportId);
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
      const reportId = parseId(req.params.reportId);
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
      const userId = (req.user as any).claims.sub;
      const debrief = await storage.getWeeklyHubDebrief(parseId(req.params.id));
      if (!debrief || debrief.userId !== userId) return res.status(404).json({ message: "Not found" });
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
      const allEvents = await storage.getEvents(userId);
      const eventsById = new Map(allEvents.map(e => [e.id, e]));

      const getDebriefWeekDate = (d: any): Date => {
        if (d.eventId) {
          const event = eventsById.get(d.eventId);
          if (event?.startTime) return new Date(event.startTime);
        }
        if (d.confirmedAt) return new Date(d.confirmedAt);
        return new Date(d.createdAt);
      };

      const confirmedDebriefs = (allDebriefs as any[]).filter((d: any) => {
        if (d.status !== "confirmed") return false;
        const weekDate = getDebriefWeekDate(d);
        return weekDate >= weekStart && weekDate <= weekEnd;
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
      for (const d of confirmedDebriefs) {
        const tags = await storage.getImpactTags(d.id);
        for (const tag of tags) {
          const tax = allTaxonomy.find((t: any) => t.id === tag.taxonomyId);
          if (tax) {
            taxonomyCounts[tax.name] = (taxonomyCounts[tax.name] || 0) + 1;
          }
        }
      }
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
        if (d.status !== "pending_review" && d.status !== "draft") return false;
        const weekDate = getDebriefWeekDate(d);
        return weekDate >= weekStart && weekDate <= weekEnd;
      }).length;
      const backlogDebriefs = (allDebriefs as any[]).filter((d: any) => d.status === "pending_review" || d.status === "draft").length;

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

      const metricKeys = ["mindset", "skill", "confidence", "businessConfidence", "systems", "fundingReadiness", "network"];
      const metricSums: Record<string, number> = {};
      const metricCounts: Record<string, number> = {};
      const allKeyQuotes: string[] = [];

      for (const d of confirmedDebriefs) {
        const reviewed = (d as any).reviewedData || (d as any).rawExtraction;
        const m = reviewed?.metrics;
        if (m) {
          for (const key of metricKeys) {
            if (m[key] !== undefined && m[key] !== null && typeof m[key] === "number") {
              metricSums[key] = (metricSums[key] || 0) + m[key];
              metricCounts[key] = (metricCounts[key] || 0) + 1;
            }
          }
        }
        if (d.keyQuotes && Array.isArray(d.keyQuotes)) {
          allKeyQuotes.push(...d.keyQuotes);
        }
      }

      const averagedDevelopmentMetrics: Record<string, number> = {};
      for (const key of metricKeys) {
        if (metricCounts[key] > 0) {
          averagedDevelopmentMetrics[key] = Math.round((metricSums[key] / metricCounts[key]) * 10) / 10;
        }
      }

      const keyQuotes = allKeyQuotes.slice(0, 5);

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
        averagedDevelopmentMetrics: Object.keys(averagedDevelopmentMetrics).length > 0 ? averagedDevelopmentMetrics : null,
        keyQuotes: keyQuotes.length > 0 ? keyQuotes : null,
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
      const id = parseId(req.params.id);
      const existing = await storage.getWeeklyHubDebrief(id);
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.status !== "draft") return res.status(400).json({ message: "Only draft debriefs can be refreshed" });

      const userId = (req.user as any).claims.sub;
      const weekStart = new Date(existing.weekStartDate);
      const weekEnd = new Date(existing.weekEndDate);

      const allDebriefs = await storage.getImpactLogs(userId);
      const allEvents = await storage.getEvents(userId);
      const eventsById = new Map(allEvents.map(e => [e.id, e]));

      const getDebriefWeekDate = (d: any): Date => {
        if (d.eventId) {
          const event = eventsById.get(d.eventId);
          if (event?.startTime) return new Date(event.startTime);
        }
        if (d.confirmedAt) return new Date(d.confirmedAt);
        return new Date(d.createdAt);
      };

      const confirmedDebriefs = (allDebriefs as any[]).filter((d: any) => {
        if (d.status !== "confirmed") return false;
        const weekDate = getDebriefWeekDate(d);
        return weekDate >= weekStart && weekDate <= weekEnd;
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
      for (const d of confirmedDebriefs) {
        const tags = await storage.getImpactTags(d.id);
        for (const tag of tags) {
          const tax = allTaxonomy.find((t: any) => t.id === tag.taxonomyId);
          if (tax) {
            taxonomyCounts[tax.name] = (taxonomyCounts[tax.name] || 0) + 1;
          }
        }
      }
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
        if (d.status !== "pending_review" && d.status !== "draft") return false;
        const weekDate = getDebriefWeekDate(d);
        return weekDate >= weekStart && weekDate <= weekEnd;
      }).length;
      const backlogDebriefs = (allDebriefs as any[]).filter((d: any) => d.status === "pending_review" || d.status === "draft").length;

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

      const metricKeys = ["mindset", "skill", "confidence", "businessConfidence", "systems", "fundingReadiness", "network"];
      const metricSums: Record<string, number> = {};
      const metricCounts: Record<string, number> = {};
      const allKeyQuotes: string[] = [];

      for (const d of confirmedDebriefs) {
        const reviewed = (d as any).reviewedData || (d as any).rawExtraction;
        const m = reviewed?.metrics;
        if (m) {
          for (const key of metricKeys) {
            if (m[key] !== undefined && m[key] !== null && typeof m[key] === "number") {
              metricSums[key] = (metricSums[key] || 0) + m[key];
              metricCounts[key] = (metricCounts[key] || 0) + 1;
            }
          }
        }
        if (d.keyQuotes && Array.isArray(d.keyQuotes)) {
          allKeyQuotes.push(...d.keyQuotes);
        }
      }

      const averagedDevelopmentMetrics: Record<string, number> = {};
      for (const key of metricKeys) {
        if (metricCounts[key] > 0) {
          averagedDevelopmentMetrics[key] = Math.round((metricSums[key] / metricCounts[key]) * 10) / 10;
        }
      }

      const keyQuotes = allKeyQuotes.slice(0, 5);

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
        averagedDevelopmentMetrics: Object.keys(averagedDevelopmentMetrics).length > 0 ? averagedDevelopmentMetrics : null,
        keyQuotes: keyQuotes.length > 0 ? keyQuotes : null,
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
      const id = parseId(req.params.id);
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
      await storage.deleteWeeklyHubDebrief(parseId(req.params.id));
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
          if ((interaction as any).notes || interaction.transcript) {
            const text = ((interaction as any).notes || interaction.transcript || "").slice(0, 200);
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
      } catch (e) {
        if (e instanceof AIKeyMissingError) throw e;
        result = { categorySuggestions: [], keywordSuggestions: [] };
      }
      res.json({
        categorySuggestions: result.categorySuggestions || [],
        keywordSuggestions: result.keywordSuggestions || [],
        scannedReports: confirmedReports.length,
        scannedInteractions: interactionSummaries.length,
      });
    } catch (err: any) {
      if (err instanceof AIKeyMissingError) return res.status(503).json({ message: err.message });
      console.error("Taxonomy scan error:", err);
      res.status(500).json({ message: "Failed to scan for taxonomy suggestions" });
    }
  });

  // === FUNDER TAXONOMY — per-funder lens routes ===

  // List funder's taxonomy categories
  app.get("/api/funders/:funderId/taxonomy", isAuthenticated, async (req, res) => {
    try {
      const funderId = parseId(req.params.funderId);
      const categories = await db
        .select()
        .from(funderTaxonomyCategories)
        .where(eq(funderTaxonomyCategories.funderId, funderId));
      res.json(categories);
    } catch (err) {
      console.error("Error fetching funder taxonomy:", err);
      res.status(500).json({ message: "Failed to fetch taxonomy categories" });
    }
  });

  // Create funder taxonomy category
  app.post("/api/funders/:funderId/taxonomy", isAuthenticated, async (req, res) => {
    try {
      const funderId = parseId(req.params.funderId);
      const { name, description, color, keywords, rules, sortOrder } = req.body;
      const [created] = await db
        .insert(funderTaxonomyCategories)
        .values({ funderId, name, description, color, keywords, rules: rules || {}, sortOrder: sortOrder || 0 })
        .returning();
      res.status(201).json(created);
    } catch (err) {
      console.error("Error creating funder taxonomy category:", err);
      res.status(500).json({ message: "Failed to create taxonomy category" });
    }
  });

  // Update funder taxonomy category
  app.patch("/api/funders/:funderId/taxonomy/:id", isAuthenticated, async (req, res) => {
    try {
      const categoryId = parseId(req.params.id);
      const updates: Record<string, any> = {};
      for (const key of ["name", "description", "color", "keywords", "rules", "sortOrder", "active"]) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }
      const [updated] = await db
        .update(funderTaxonomyCategories)
        .set(updates)
        .where(eq(funderTaxonomyCategories.id, categoryId))
        .returning();
      if (!updated) return res.status(404).json({ message: "Category not found" });
      res.json(updated);
    } catch (err) {
      console.error("Error updating funder taxonomy category:", err);
      res.status(500).json({ message: "Failed to update taxonomy category" });
    }
  });

  // Delete funder taxonomy category
  app.delete("/api/funders/:funderId/taxonomy/:id", isAuthenticated, async (req, res) => {
    try {
      const categoryId = parseId(req.params.id);
      // Also delete related classifications and mappings
      await db.delete(funderTaxonomyClassifications).where(eq(funderTaxonomyClassifications.funderCategoryId, categoryId));
      await db.delete(funderTaxonomyMappings).where(eq(funderTaxonomyMappings.funderCategoryId, categoryId));
      await db.delete(funderTaxonomyCategories).where(eq(funderTaxonomyCategories.id, categoryId));
      res.status(204).send();
    } catch (err) {
      console.error("Error deleting funder taxonomy category:", err);
      res.status(500).json({ message: "Failed to delete taxonomy category" });
    }
  });

  // List funder taxonomy mappings (generic → funder)
  app.get("/api/funders/:funderId/taxonomy-mappings", isAuthenticated, async (req, res) => {
    try {
      const funderId = parseId(req.params.funderId);
      const categories = await db
        .select({ id: funderTaxonomyCategories.id })
        .from(funderTaxonomyCategories)
        .where(eq(funderTaxonomyCategories.funderId, funderId));
      const categoryIds = categories.map((c) => c.id);
      if (categoryIds.length === 0) return res.json([]);
      const mappings = await db
        .select()
        .from(funderTaxonomyMappings)
        .where(inArray(funderTaxonomyMappings.funderCategoryId, categoryIds));
      res.json(mappings);
    } catch (err) {
      console.error("Error fetching taxonomy mappings:", err);
      res.status(500).json({ message: "Failed to fetch taxonomy mappings" });
    }
  });

  // Create taxonomy mapping
  app.post("/api/funders/:funderId/taxonomy-mappings", isAuthenticated, async (req, res) => {
    try {
      const { funderCategoryId, genericTaxonomyId, confidenceModifier } = req.body;
      const [created] = await db
        .insert(funderTaxonomyMappings)
        .values({ funderCategoryId, genericTaxonomyId, confidenceModifier: confidenceModifier || 0 })
        .returning();
      res.status(201).json(created);
    } catch (err) {
      console.error("Error creating taxonomy mapping:", err);
      res.status(500).json({ message: "Failed to create taxonomy mapping" });
    }
  });

  // Delete taxonomy mapping
  app.delete("/api/funders/:funderId/taxonomy-mappings/:id", isAuthenticated, async (req, res) => {
    try {
      const mappingId = parseId(req.params.id);
      await db.delete(funderTaxonomyMappings).where(eq(funderTaxonomyMappings.id, mappingId));
      res.status(204).send();
    } catch (err) {
      console.error("Error deleting taxonomy mapping:", err);
      res.status(500).json({ message: "Failed to delete taxonomy mapping" });
    }
  });

  // Get classifications for a funder (with optional date range + entity type filter)
  app.get("/api/funders/:funderId/classifications", isAuthenticated, async (req, res) => {
    try {
      const funderId = parseId(req.params.funderId);
      const conds: any[] = [eq(funderTaxonomyClassifications.funderId, funderId)];
      if (req.query.entityType) {
        conds.push(eq(funderTaxonomyClassifications.entityType, parseStr(req.query.entityType)));
      }
      if (req.query.startDate) {
        conds.push(gte(funderTaxonomyClassifications.entityDate, new Date(parseStr(req.query.startDate))));
      }
      if (req.query.endDate) {
        conds.push(lte(funderTaxonomyClassifications.entityDate, new Date(parseStr(req.query.endDate))));
      }
      if (req.query.minConfidence) {
        conds.push(gte(funderTaxonomyClassifications.confidence, parseInt(parseStr(req.query.minConfidence))));
      }
      const classifications = await db
        .select({
          id: funderTaxonomyClassifications.id,
          funderId: funderTaxonomyClassifications.funderId,
          funderCategoryId: funderTaxonomyClassifications.funderCategoryId,
          entityType: funderTaxonomyClassifications.entityType,
          entityId: funderTaxonomyClassifications.entityId,
          entityDate: funderTaxonomyClassifications.entityDate,
          confidence: funderTaxonomyClassifications.confidence,
          source: funderTaxonomyClassifications.source,
          evidence: funderTaxonomyClassifications.evidence,
          categoryName: funderTaxonomyCategories.name,
          categoryColor: funderTaxonomyCategories.color,
        })
        .from(funderTaxonomyClassifications)
        .innerJoin(funderTaxonomyCategories, eq(funderTaxonomyClassifications.funderCategoryId, funderTaxonomyCategories.id))
        .where(and(...conds));

      // Batch-lookup entity titles
      const byType = new Map<string, number[]>();
      for (const c of classifications) {
        if (!byType.has(c.entityType)) byType.set(c.entityType, []);
        byType.get(c.entityType)!.push(c.entityId);
      }
      const titleMap = new Map<string, string>();
      for (const [type, ids] of byType) {
        const uniqueIds = [...new Set(ids)];
        if (uniqueIds.length === 0) continue;
        let rows: Array<{ id: number; title: string }> = [];
        if (type === "debrief") {
          rows = (await db.execute<{ id: number; title: string }>(
            `SELECT id, COALESCE(title, 'Untitled debrief') as title FROM impact_logs WHERE id = ANY(ARRAY[${uniqueIds.join(",")}])`
          )).rows;
        } else if (type === "booking") {
          rows = (await db.execute<{ id: number; title: string }>(
            `SELECT id, COALESCE(title, booker_name, 'Untitled booking') as title FROM bookings WHERE id = ANY(ARRAY[${uniqueIds.join(",")}])`
          )).rows;
        } else if (type === "programme") {
          rows = (await db.execute<{ id: number; title: string }>(
            `SELECT id, COALESCE(name, 'Untitled programme') as title FROM programmes WHERE id = ANY(ARRAY[${uniqueIds.join(",")}])`
          )).rows;
        } else if (type === "event") {
          rows = (await db.execute<{ id: number; title: string }>(
            `SELECT id, COALESCE(name, 'Untitled event') as title FROM events WHERE id = ANY(ARRAY[${uniqueIds.join(",")}])`
          )).rows;
        }
        for (const r of rows) {
          titleMap.set(`${type}-${r.id}`, r.title);
        }
      }

      const enriched = classifications.map((c) => ({
        ...c,
        entityTitle: titleMap.get(`${c.entityType}-${c.entityId}`) || "Unknown",
      }));
      res.json(enriched);
    } catch (err) {
      console.error("Error fetching classifications:", err);
      res.status(500).json({ message: "Failed to fetch classifications" });
    }
  });

  // Get all funder classifications for a specific entity
  app.get("/api/classifications/:entityType/:entityId", isAuthenticated, async (req, res) => {
    try {
      const entityType = parseStr(req.params.entityType);
      const entityId = parseId(req.params.entityId);
      const classifications = await db
        .select()
        .from(funderTaxonomyClassifications)
        .where(
          and(
            eq(funderTaxonomyClassifications.entityType, entityType),
            eq(funderTaxonomyClassifications.entityId, entityId),
          ),
        );
      res.json(classifications);
    } catch (err) {
      console.error("Error fetching entity classifications:", err);
      res.status(500).json({ message: "Failed to fetch entity classifications" });
    }
  });

  // Reclassify all entities for a funder
  app.post("/api/funders/:funderId/reclassify", isAuthenticated, async (req, res) => {
    try {
      const funderId = parseId(req.params.funderId);
      const userId = (req.user as any).claims.sub;
      const startDate = req.body.startDate ? new Date(req.body.startDate) : undefined;
      const endDate = req.body.endDate ? new Date(req.body.endDate) : undefined;
      const result = await reclassifyAllForFunder(funderId, userId, startDate, endDate);
      res.json(result);
    } catch (err) {
      console.error("Error reclassifying:", err);
      res.status(500).json({ message: "Failed to reclassify" });
    }
  });

  // Seed funder taxonomy for known funders
  app.post("/api/funders/seed-taxonomy", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const genericTaxonomy = await storage.getTaxonomy(userId);
      const allFunders = await db.select().from(funders).where(eq(funders.userId, userId));
      let seeded = 0;

      const FUNDER_SEEDS: Record<string, Array<{
        name: string; description: string; color: string;
        keywords: string[]; rules: Record<string, any>;
        inheritsFrom: string[];
      }>> = {
        "edo-auckland-council": [
          {
            name: "Inclusive Economic Growth",
            description: "Enterprise development, revenue generation, job creation in Tāmaki",
            color: "green",
            keywords: ["enterprise", "revenue", "business growth", "first sale", "hired", "income", "startup", "market"],
            rules: {},
            inheritsFrom: ["Venture Progress"],
          },
          {
            name: "Social & Sector Innovation",
            description: "Activations, workshops, events driving sector and social innovation",
            color: "blue",
            keywords: ["wananga", "activation", "innovation", "workshop", "sector", "coworking"],
            rules: { includeEventTypes: ["External Event", "Programme Session"] },
            inheritsFrom: ["Hub Engagement", "Network & Ecosystem Connection"],
          },
          {
            name: "Ecosystem Building",
            description: "Partnerships, referrals, co-investment, collaboration across the ecosystem",
            color: "orange",
            keywords: ["partnership", "referral", "co-investment", "collaboration", "GridAKL", "network"],
            rules: {},
            inheritsFrom: ["Network & Ecosystem Connection"],
          },
          {
            name: "Tāmaki Rohe Contribution",
            description: "Local enterprise retention, Glen Innes-specific outcomes",
            color: "teal",
            keywords: ["local enterprise", "Glen Innes", "Tāmaki", "retained", "community hub", "local"],
            rules: {},
            inheritsFrom: ["Hub Engagement", "Venture Progress"],
          },
        ],
        "nga-matarae": [
          {
            name: "Māori Enterprise Development",
            description: "Māori-led business growth, whanau enterprise, kaupapa Māori economic outcomes",
            color: "green",
            keywords: ["Māori business", "whanau enterprise", "kaupapa", "Māori-led", "iwi", "hapū"],
            rules: { communityLens: "maori" },
            inheritsFrom: ["Venture Progress", "Skills & Capability Growth"],
          },
          {
            name: "Rangatahi Māori Outcomes",
            description: "Youth Māori development, taiohi enterprise, rangatahi pathways",
            color: "pink",
            keywords: ["rangatahi Māori", "taiohi", "youth Māori", "young Māori", "school leaver"],
            rules: { communityLens: "maori", requireContactFlags: { isRangatahi: true } },
            inheritsFrom: ["Rangatahi Development"],
          },
          {
            name: "Whānau Capability",
            description: "Confidence, capability, mana building for whānau Māori",
            color: "purple",
            keywords: ["whānau", "confidence", "capability", "mana", "growth", "upskill"],
            rules: { communityLens: "maori" },
            inheritsFrom: ["Skills & Capability Growth"],
          },
          {
            name: "Cultural Connection",
            description: "Tikanga, te reo, whakapapa, wānanga — cultural grounding through the hub",
            color: "amber",
            keywords: ["tikanga", "te reo", "whakapapa", "wānanga", "karakia", "mihi", "kōrero"],
            rules: {},
            inheritsFrom: ["Hub Engagement"],
          },
        ],
        "foundation-north": [
          {
            name: "Increased Equity",
            description: "Māori and Pasifika-led outcomes, self-determination, community solutions",
            color: "green",
            keywords: ["equity", "Māori-led", "community solution", "self-determination", "Pasifika-led"],
            rules: { communityLens: "maori" },
            inheritsFrom: ["Venture Progress", "Skills & Capability Growth"],
          },
          {
            name: "Community Resilience",
            description: "Community events, hui, belonging, placemaking",
            color: "blue",
            keywords: ["community event", "hui", "belonging", "resilient", "placemaking", "whānau"],
            rules: {},
            inheritsFrom: ["Hub Engagement", "Network & Ecosystem Connection"],
          },
          {
            name: "Te Tiriti Outcomes",
            description: "Te reo, tikanga, kaupapa Māori governance, mana whenua connections",
            color: "purple",
            keywords: ["te reo", "tikanga", "kaupapa Māori", "Māori governance", "mana whenua", "Ngāti Pāoa"],
            rules: {},
            inheritsFrom: [],
          },
        ],
      };

      for (const funder of allFunders) {
        const tag = funder.funderTag;
        if (!tag || !FUNDER_SEEDS[tag]) continue;

        // Check if already seeded
        const existing = await db
          .select({ id: funderTaxonomyCategories.id })
          .from(funderTaxonomyCategories)
          .where(eq(funderTaxonomyCategories.funderId, funder.id));
        if (existing.length > 0) continue;

        const seeds = FUNDER_SEEDS[tag];
        for (let i = 0; i < seeds.length; i++) {
          const seed = seeds[i];
          const [cat] = await db
            .insert(funderTaxonomyCategories)
            .values({
              funderId: funder.id,
              name: seed.name,
              description: seed.description,
              color: seed.color,
              keywords: seed.keywords,
              rules: seed.rules,
              sortOrder: i,
            })
            .returning();

          // Create mappings to generic taxonomy
          for (const genericName of seed.inheritsFrom) {
            const generic = genericTaxonomy.find((t) => t.name === genericName);
            if (generic) {
              await db.insert(funderTaxonomyMappings).values({
                funderCategoryId: cat.id,
                genericTaxonomyId: generic.id,
                confidenceModifier: 0,
              });
            }
          }
        }
        seeded++;
      }

      res.json({ seeded, message: `Seeded taxonomy for ${seeded} funder(s)` });
    } catch (err) {
      console.error("Error seeding funder taxonomy:", err);
      res.status(500).json({ message: "Failed to seed taxonomy" });
    }
  });

  // === Dashboard Pulse — operator snapshot in one call ===
  app.get("/api/dashboard/pulse", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const now = new Date();
      const monthParam = req.query.month as string | undefined;
      const anchor = monthParam ? new Date(monthParam + "-01") : now;
      const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
      const monthStartStr = monthStart.toISOString().split("T")[0];
      const monthEndStr = monthEnd.toISOString().split("T")[0];

      const [
        delivery,
        enquiryRows,
        draftRows,
        needsDebriefRows,
        menteeRows,
        innovatorRows,
        ftRows,
      ] = await Promise.all([
        getDeliveryMetrics({ userId, startDate: monthStartStr, endDate: monthEndStr }),
        db.execute(sql`
          SELECT COUNT(*) as count FROM bookings
          WHERE user_id = ${userId} AND status = 'enquiry'
        `),
        db.execute(sql`
          SELECT COUNT(*) as count FROM impact_logs
          WHERE user_id = ${userId} AND status = 'draft'
        `),
        db.execute(sql`
          SELECT COUNT(*) as count FROM events e
          WHERE e.user_id = ${userId}
            AND e.requires_debrief = true
            AND e.event_status = 'active'
            AND e.end_time < ${now}
            AND NOT EXISTS (
              SELECT 1 FROM impact_logs il WHERE il.event_id = e.id
            )
        `),
        db.execute(sql`
          SELECT COUNT(*) as count FROM mentoring_relationships mr
          JOIN contacts c ON c.id = mr.contact_id
          WHERE c.user_id = ${userId} AND mr.status = 'active'
        `),
        db.execute(sql`
          SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN relationship_stage = 'kakano' THEN 1 END) as kakano,
            COUNT(CASE WHEN relationship_stage = 'tipu' THEN 1 END) as tipu,
            COUNT(CASE WHEN relationship_stage = 'ora' THEN 1 END) as ora
          FROM contacts
          WHERE user_id = ${userId} AND is_innovator = true AND active = true AND is_archived = false
        `),
        db.execute(sql`
          SELECT COALESCE(SUM(count), 0) as total FROM daily_foot_traffic
          WHERE user_id = ${userId}
            AND date >= ${monthStart} AND date < ${monthEnd}
        `),
      ]);

      const enquiries = Number((enquiryRows as any).rows?.[0]?.count || 0);
      const draftDebriefs = Number((draftRows as any).rows?.[0]?.count || 0);
      const needsDebrief = Number((needsDebriefRows as any).rows?.[0]?.count || 0);
      const activeMentees = Number((menteeRows as any).rows?.[0]?.count || 0);
      const inv = (innovatorRows as any).rows?.[0] || {};
      const footTraffic = Number((ftRows as any).rows?.[0]?.total || 0);

      res.json({
        needsAttention: {
          enquiries,
          draftDebriefs,
          needsDebrief,
          total: enquiries + draftDebriefs + needsDebrief,
        },
        thisMonth: {
          activations: delivery.totalActivations || 0,
          mentoringSessions: delivery.mentoringSessions || 0,
          programmes: delivery.programmes?.total || 0,
          venueHires: delivery.bookings?.total || 0,
          footTraffic,
        },
        community: {
          innovators: Number(inv.total || 0),
          kakano: Number(inv.kakano || 0),
          tipu: Number(inv.tipu || 0),
          ora: Number(inv.ora || 0),
          activeMentees,
        },
      });
    } catch (err: any) {
      console.error("Dashboard pulse error:", err);
      res.status(500).json({ message: "Failed to fetch dashboard pulse" });
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
      const id = parseId(req.params.id);
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
      const id = parseId(req.params.id);
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
      await storage.deleteMonthlySnapshot(parseId(req.params.id));
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
      const snapshot = await storage.getMonthlySnapshot(parseId(req.params.id));
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
      const snapshotId = parseId(req.params.id);
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
      const snapshot = await storage.getMonthlySnapshot(parseId(req.params.id));
      if (!snapshot || snapshot.userId !== userId) {
        return res.status(404).json({ message: "Snapshot not found" });
      }
      await storage.deleteFootTrafficTouchpoint(parseId(req.params.touchpointId));
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete touchpoint error:", err);
      res.status(500).json({ message: "Failed to delete touchpoint" });
    }
  });

  // === DAILY FOOT TRAFFIC ===

  app.get("/api/daily-foot-traffic", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const month = parseStr(req.query.month);
      if (!month) return res.status(400).json({ message: "month query param required" });
      const monthDate = new Date(month);
      const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);
      const rows = await db.select().from(dailyFootTraffic)
        .where(and(
          eq(dailyFootTraffic.userId, userId),
          gte(dailyFootTraffic.date, start),
          lte(dailyFootTraffic.date, end),
        ));
      res.json(rows);
    } catch (err: any) {
      console.error("Get daily foot traffic error:", err);
      res.status(500).json({ message: "Failed to fetch daily foot traffic" });
    }
  });

  app.post("/api/daily-foot-traffic", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { date, count, notes } = req.body;
      if (!date || count === undefined) return res.status(400).json({ message: "date and count required" });
      const dateObj = new Date(date);
      const dayStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
      const existing = await db.select().from(dailyFootTraffic)
        .where(and(
          eq(dailyFootTraffic.userId, userId),
          eq(dailyFootTraffic.date, dayStart),
        ));
      let result;
      if (existing.length > 0) {
        const updates: any = { count: parseInt(count) };
        if (notes !== undefined) updates.notes = notes;
        [result] = await db.update(dailyFootTraffic)
          .set(updates)
          .where(eq(dailyFootTraffic.id, existing[0].id))
          .returning();
      } else {
        [result] = await db.insert(dailyFootTraffic).values({
          userId,
          date: dayStart,
          count: parseInt(count),
          notes: notes || null,
        }).returning();
      }
      res.json(result);
    } catch (err: any) {
      console.error("Save daily foot traffic error:", err);
      res.status(500).json({ message: "Failed to save daily foot traffic" });
    }
  });

  // === RECURRING BOOKING TEMPLATES ===

  app.get("/api/recurring-booking-templates", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const rows = await db.execute(
        sql`SELECT * FROM recurring_booking_templates WHERE user_id = ${userId} ORDER BY created_at DESC`
      );
      res.json(rows.rows);
    } catch (err: any) {
      console.error("Get recurring booking templates error:", err);
      res.status(500).json({ message: "Failed to fetch recurring booking templates" });
    }
  });

  app.post("/api/recurring-booking-templates", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { name, venue_id, classification, day_of_week, start_time, end_time, start_date, end_date, booker_name, notes } = req.body;
      if (!name || day_of_week === undefined || day_of_week === null) {
        return res.status(400).json({ message: "name and day_of_week are required" });
      }
      const result = await db.execute(
        sql`INSERT INTO recurring_booking_templates 
          (user_id, name, venue_id, classification, day_of_week, start_time, end_time, start_date, end_date, booker_name, notes, active)
          VALUES (${userId}, ${name}, ${venue_id || null}, ${classification || null}, ${day_of_week}, ${start_time || null}, ${end_time || null}, ${start_date || null}, ${end_date || null}, ${booker_name || null}, ${notes || null}, true)
          RETURNING *`
      );
      res.status(201).json(result.rows[0]);
    } catch (err: any) {
      console.error("Create recurring booking template error:", err);
      res.status(500).json({ message: "Failed to create recurring booking template" });
    }
  });

  app.patch("/api/recurring-booking-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
      const { name, venue_id, classification, day_of_week, start_time, end_time, start_date, end_date, booker_name, notes, active } = req.body;
      const result = await db.execute(
        sql`UPDATE recurring_booking_templates SET
          name = COALESCE(${name ?? null}, name),
          venue_id = COALESCE(${venue_id !== undefined ? venue_id : null}::integer, venue_id),
          classification = COALESCE(${classification ?? null}, classification),
          day_of_week = COALESCE(${day_of_week !== undefined ? day_of_week : null}::integer, day_of_week),
          start_time = COALESCE(${start_time ?? null}, start_time),
          end_time = COALESCE(${end_time ?? null}, end_time),
          start_date = COALESCE(${start_date ?? null}::date, start_date),
          end_date = COALESCE(${end_date ?? null}::date, end_date),
          booker_name = COALESCE(${booker_name ?? null}, booker_name),
          notes = COALESCE(${notes ?? null}, notes),
          active = COALESCE(${active !== undefined ? active : null}::boolean, active)
          WHERE id = ${id} AND user_id = ${userId}
          RETURNING *`
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "Template not found" });
      res.json(result.rows[0]);
    } catch (err: any) {
      console.error("Update recurring booking template error:", err);
      res.status(500).json({ message: "Failed to update recurring booking template" });
    }
  });

  app.delete("/api/recurring-booking-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
      await db.execute(
        sql`DELETE FROM recurring_booking_templates WHERE id = ${id} AND user_id = ${userId}`
      );
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete recurring booking template error:", err);
      res.status(500).json({ message: "Failed to delete recurring booking template" });
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

  app.get("/api/catch-up-list/last-caught-up", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const dates = await storage.getLastCaughtUpDates(userId);
      res.json(dates);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch last caught-up dates" });
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
      const id = parseId(req.params.id);
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
      const id = parseId(req.params.id);
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

  // === Catch-up suggestions — contacts with no recent interaction ===
  app.get("/api/contacts/catch-up-suggestions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const result = await db.execute(sql`
        SELECT c.id, c.name, c.role, c.relationship_stage as stage,
          c.is_community_member, c.is_innovator,
          (SELECT MAX(i.created_at) FROM interactions i WHERE i.contact_id = c.id) as last_interaction
        FROM contacts c
        WHERE c.user_id = ${userId} AND c.active = true AND c.is_archived = false
          AND (c.is_community_member = true OR c.is_innovator = true)
          AND c.id NOT IN (SELECT contact_id FROM catch_up_list WHERE user_id = ${userId} AND dismissed_at IS NULL)
        ORDER BY last_interaction ASC NULLS FIRST
      `);

      const now = Date.now();
      const suggestions = (result.rows || []).map((r: any) => {
        const lastDate = r.last_interaction ? new Date(r.last_interaction).getTime() : null;
        const daysSince = lastDate ? Math.floor((now - lastDate) / (1000 * 60 * 60 * 24)) : null;
        const urgency = daysSince === null ? "overdue" : daysSince > 90 ? "overdue" : daysSince > 60 ? "soon" : daysSince > 30 ? "upcoming" : null;
        if (!urgency) return null;
        return {
          id: r.id,
          name: r.name,
          role: r.role,
          stage: r.stage,
          daysSinceLastInteraction: daysSince,
          urgency,
        };
      }).filter(Boolean);

      res.json(suggestions);
    } catch (err: any) {
      console.error("Catch-up suggestions error:", err);
      res.status(500).json({ message: "Failed to get suggestions" });
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
      await storage.deleteReportHighlight(parseId(req.params.id));
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
        accountIds: z.array(z.number()).optional(),
        accountId: z.number().optional(),
      });
      const parsed = scanSchema.parse(req.body);
      const ids = parsed.accountIds || (parsed.accountId ? [parsed.accountId] : undefined);
      const result = await scanGmailEmails(userId, parsed.scanType, parsed.daysBack, ids);
      res.json(result);
    } catch (err: any) {
      console.error("Gmail scan error:", err);
      if (err.name === 'ZodError') return res.status(400).json({ message: "Invalid parameters" });
      res.status(500).json({ message: err.message || "Failed to start scan" });
    }
  });

  app.post("/api/gmail/import/confirm", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const confirmSchema = z.object({
        historyId: z.number(),
        selectedEmails: z.array(z.string()),
        selectedDomains: z.array(z.string()),
        duplicateActions: z.record(z.enum(['skip', 'create', 'merge'])).optional(),
        linkExistingContacts: z.boolean().optional(),
      });
      const parsed = confirmSchema.parse(req.body);
      const result = await confirmImport(
        parsed.historyId,
        userId,
        parsed.selectedEmails,
        parsed.selectedDomains,
        parsed.duplicateActions || {},
        parsed.linkExistingContacts ?? true
      );
      res.json(result);
    } catch (err: any) {
      console.error("Gmail confirm import error:", err);
      if (err.name === 'ZodError') return res.status(400).json({ message: "Invalid parameters" });
      res.status(500).json({ message: err.message || "Failed to confirm import" });
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
      const item = await storage.getGmailImportHistoryItem(parseId(req.params.id));
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
      const exclusion = exclusions.find(e => e.id === parseId(req.params.id));
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
          await storage.archiveContact(id);
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
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/documents',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/calendar',
      ],
      state,
    });

    console.log('[Gmail OAuth] Generated auth URL redirect_uri:', (oauth2Client as any)._redirectUri || 'unknown');
    res.json({ url });
  });

  app.get("/api/gmail/oauth/callback", async (req, res) => {
    const { code, state, error: oauthError } = req.query;
    console.log('[Gmail OAuth Callback] code:', !!code, 'state:', !!state, 'error:', oauthError || 'none', 'full query:', JSON.stringify(req.query));
    if (!code || !state) {
      return res.redirect(`/gmail-import?error=${oauthError || 'missing_params'}`);
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
      const account = await storage.getGmailConnectedAccount(parseId(req.params.id));
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
          SELECT g.id as group_id, g.engagement_level,
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
          COUNT(CASE WHEN engagement_level = 'Active' AND (last_date < NOW() - INTERVAL '90 days' OR last_date IS NULL) THEN 1 END) as at_risk
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

  // === Engagement Decay — preview and apply dormancy ===
  app.post("/api/groups/check-engagement-decay", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const apply = req.body?.apply === true;

      const result = await db.execute(sql`
        WITH last_engagement AS (
          SELECT g.id as group_id, g.name, g.engagement_level,
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
          WHERE g.user_id = ${userId} AND g.engagement_level != 'Dormant'
        )
        SELECT group_id, name, engagement_level, last_date
        FROM last_engagement
        WHERE last_date < NOW() - INTERVAL '180 days' OR last_date IS NULL
      `);

      const candidates = (result.rows || []).map((r: any) => ({
        id: Number(r.group_id),
        name: r.name,
        currentLevel: r.engagement_level,
        lastActivity: r.last_date,
      }));

      if (apply && candidates.length > 0) {
        const ids = candidates.map((c: any) => c.id);
        await db.execute(sql`
          UPDATE groups SET engagement_level = 'Dormant', updated_at = NOW()
          WHERE id = ANY(${ids}) AND user_id = ${userId}
        `);
      }

      res.json({ candidates, applied: apply, count: candidates.length });
    } catch (err: any) {
      console.error("Engagement decay error:", err);
      res.status(500).json({ message: "Failed to check engagement decay" });
    }
  });

  app.get("/api/ecosystem/vip", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const allContacts = await storage.getContacts(userId);
      const allGroups = await storage.getGroups(userId);

      const vipContacts = allContacts
        .filter((c: any) => c.isVip)
        .map((c: any) => ({
          id: c.id,
          type: "contact" as const,
          name: c.name,
          email: c.email,
          businessName: c.businessName,
          linkedGroupName: c.linkedGroupName,
          vipReason: c.vipReason,
          movedToVipAt: c.movedToVipAt,
          stage: c.stage,
          supportType: c.supportType,
          role: c.role,
        }));

      const vipGroups = allGroups
        .filter((g: any) => g.isVip)
        .map((g: any) => ({
          id: g.id,
          type: "group" as const,
          name: g.name,
          groupType: g.type,
          vipReason: g.vipReason,
          movedToVipAt: g.movedToVipAt,
          engagementLevel: g.engagementLevel || "Active",
          memberCount: 0,
        }));

      const densityResult = await db.execute(sql`
        SELECT group_id, COUNT(*) as total_members,
          COUNT(CASE WHEN contact_id IN (
            SELECT id FROM contacts WHERE user_id = ${userId} AND is_community_member = true
          ) THEN 1 END) as community_count
        FROM group_members
        WHERE group_id IN (SELECT id FROM groups WHERE user_id = ${userId} AND is_vip = true)
        GROUP BY group_id
      `);

      const densityMap: Record<number, number> = {};
      for (const row of densityResult.rows) {
        densityMap[Number(row.group_id)] = Number(row.total_members) || 0;
      }
      for (const g of vipGroups) {
        g.memberCount = densityMap[g.id] || 0;
      }

      const combined = [...vipContacts, ...vipGroups].sort((a, b) => {
        const aDate = a.movedToVipAt ? new Date(a.movedToVipAt).getTime() : 0;
        const bDate = b.movedToVipAt ? new Date(b.movedToVipAt).getTime() : 0;
        return bDate - aDate;
      });

      res.json(combined);
    } catch (err: any) {
      console.error("VIP endpoint error:", err);
      res.status(500).json({ message: "Failed to get VIP list" });
    }
  });

  app.post("/api/groups/:id/promote-vip", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const groupId = parseId(req.params.id);
      const group = await storage.getGroup(groupId);
      if (!group || group.userId !== userId) {
        return res.status(404).json({ message: "Group not found" });
      }
      if (group.isVip) {
        return res.json({ group, message: "Already VIP" });
      }
      const updates: Record<string, any> = {
        isVip: true,
        movedToVipAt: new Date(),
      };
      if (!group.isInnovator) updates.isInnovator = true;
      if (!group.isCommunity) updates.isCommunity = true;
      if (req.body.vipReason) updates.vipReason = req.body.vipReason;
      const updated = await storage.updateGroup(groupId, updates);
      res.json({ group: updated });
    } catch (err: any) {
      console.error("Group VIP promote error:", err);
      res.status(500).json({ message: "Failed to promote group to VIP" });
    }
  });

  app.post("/api/groups/:id/demote-vip", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const groupId = parseId(req.params.id);
      const group = await storage.getGroup(groupId);
      if (!group || group.userId !== userId) {
        return res.status(404).json({ message: "Group not found" });
      }
      const updated = await storage.updateGroup(groupId, {
        isVip: false,
        movedToVipAt: null,
        vipReason: null,
      });
      res.json({ group: updated });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to demote group from VIP" });
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
          await storage.archiveContact(id);
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
      for (const groupId of Array.from(affectedGroupIds)) {
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

      const combinedEmail = Array.from(allEmailsSet).join(", ");
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
            for (const [gName, gId] of Array.from(groupNameLower)) {
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
      const contactId = parseId(req.params.id);
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
      const alreadyLinked = existing.some((m: any) => m.groupId === groupId);
      if (!alreadyLinked) {
        await storage.addGroupMember({ groupId, contactId, role: 'member' });
      }

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
      const contactId = parseId(req.params.id);
      const groupId = parseId(req.params.groupId);

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
      const { groupIds, type } = req.body;
      if (!Array.isArray(groupIds) || groupIds.length === 0) {
        return res.status(400).json({ message: "No group IDs provided" });
      }
      if (!type) {
        return res.status(400).json({ message: "Type is required" });
      }
      const { GROUP_TYPES: validGroupTypes } = await import("@shared/schema");
      if (!(validGroupTypes as readonly string[]).includes(type)) {
        return res.status(400).json({ message: `Invalid group type: ${type}` });
      }
      let updated = 0;
      for (const id of groupIds) {
        const group = await storage.getGroup(id);
        if (group && group.userId === userId) {
          await storage.updateGroup(id, { type });
          updated++;
        }
      }
      res.json({ updated });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update group types" });
    }
  });

  app.post("/api/groups/ai-recategorise/preview", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { groupIds, autoTarget } = req.body;

      const allGroups = await storage.getGroups(userId);
      let targetGroups: typeof allGroups;

      if (autoTarget) {
        targetGroups = allGroups.filter(g => g.type === "Business" || g.type === "Uncategorised");
        if (targetGroups.length === 0) {
          return res.json({ suggestions: [], message: "No Business or Uncategorised groups found to recategorise." });
        }
      } else {
        if (!Array.isArray(groupIds) || groupIds.length === 0) {
          return res.status(400).json({ message: "No group IDs provided" });
        }
        if (groupIds.length > 50) {
          return res.status(400).json({ message: "Maximum 50 groups at a time" });
        }
        targetGroups = allGroups.filter(g => groupIds.includes(g.id));
      }

      if (targetGroups.length === 0) {
        return res.status(404).json({ message: "No matching groups found" });
      }

      const memberEmailMap: Record<number, string[]> = {};
      for (const g of targetGroups) {
        const members = await storage.getGroupMembers(g.id);
        if (members.length > 0) {
          const contactIds = members.map(m => m.contactId);
          const contacts = await Promise.all(contactIds.map(cid => storage.getContact(cid)));
          const emails = contacts
            .filter(c => c && c.email)
            .map(c => c!.email!)
            .slice(0, 5);
          if (emails.length > 0) memberEmailMap[g.id] = emails;
        }
      }

      const { GROUP_TYPES } = await import("@shared/schema");
      const validTypes = GROUP_TYPES.filter((t: string) => t !== "Uncategorised");

      const suggestions: Array<{ id: number; name: string; currentType: string; suggestedType: string; currentEngagement: string; suggestedEngagement: string }> = [];

      const batchSize = 40;
      for (let batchStart = 0; batchStart < targetGroups.length; batchStart += batchSize) {
        const batch = targetGroups.slice(batchStart, batchStart + batchSize);

        const groupList = batch.map(g => {
          const emails = memberEmailMap[g.id];
          const emailStr = emails ? ` | MemberEmails: "${emails.join(", ")}"` : "";
          const domain = g.website ? g.website.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : "";
          return `ID: ${g.id} | Name: "${g.name}" | Current: "${g.type}" | Email: "${g.contactEmail || ""}" | Domain: "${domain}" | Description: "${g.description || ""}" | Notes: "${(g.notes || "").slice(0, 200)}"${emailStr}`;
        }).join("\n");

        const prompt = `You are categorising organisations for a community hub in Tāmaki (East Auckland), Aotearoa New Zealand called The Reserve. Based on each organisation's name and available information, assign the most appropriate category.

Available categories:
${validTypes.map((t: string) => `- "${t}"`).join("\n")}

Guidelines:
- "Business" = commercial businesses, startups, sole traders
- "Social Enterprise" = businesses with a social mission
- "Creative / Arts" = artists, musicians, creatives, cultural practitioners, galleries
- "Community Organisation" = community groups, collectives, neighbourhood orgs
- "Iwi / Hapū" = Māori tribal organisations, hapū, marae committees
- "Government / Council" = government agencies, councils, MSD, WINZ, police
- "Education / Training" = schools, universities, training providers, PTEs
- "Health / Social Services" = health providers, counselling, social workers, mental health
- "Funder" = philanthropic foundations, grant-makers, funding bodies
- "Corporate / Sponsor" = large corporates, sponsors, corporate partners
- "Resident Company" = organisations that are resident/based at The Reserve
- "NGO" = non-governmental organisations, charities, not-for-profits

Also assign an engagement level:
- "Active" = regular interaction in the past 6 months
- "Occasional" = some interaction but infrequent
- "Dormant" = no recent interaction, imported but inactive

If you cannot determine the type, keep the current type. Default engagement to "Active" unless the description/notes suggest otherwise.

Organisations to categorise:
${groupList}

Return a JSON array:
[{ "id": <number>, "type": "<category>", "engagementLevel": "<Active|Occasional|Dormant>" }]`;

        const raw = await claudeJSON({
          model: "claude-haiku-4-5",
          prompt,
          temperature: 0.2,
        });

        const parsed = Array.isArray(raw) ? raw : (raw.results || raw.groups || []);
        
        for (const item of parsed) {
          if (!item.id || !item.type) continue;
          const group = batch.find(g => g.id === item.id);
          if (!group) continue;

          const typeValid = (GROUP_TYPES as readonly string[]).includes(item.type);
          const engValid = ["Active", "Occasional", "Dormant"].includes(item.engagementLevel);

          suggestions.push({
            id: group.id,
            name: group.name,
            currentType: group.type,
            suggestedType: typeValid ? item.type : group.type,
            currentEngagement: group.engagementLevel || "Active",
            suggestedEngagement: engValid ? item.engagementLevel : (group.engagementLevel || "Active"),
          });
        }
      }

      res.json({ suggestions });
    } catch (err: any) {
      if (err instanceof AIKeyMissingError) return res.status(503).json({ message: err.message });
      console.error("AI recategorise preview error:", err);
      res.status(500).json({ message: "Failed to generate recategorisation suggestions" });
    }
  });

  app.post("/api/groups/ai-recategorise/apply", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { updates } = req.body;
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ message: "No updates provided" });
      }

      const { GROUP_TYPES } = await import("@shared/schema");
      let updated = 0;
      for (const item of updates) {
        if (!item.id) continue;
        const group = await storage.getGroup(item.id);
        if (!group || group.userId !== userId) continue;

        const changes: Record<string, any> = {};
        if (item.type && (GROUP_TYPES as readonly string[]).includes(item.type)) {
          changes.type = item.type;
        }
        if (item.engagementLevel && ["Active", "Occasional", "Dormant"].includes(item.engagementLevel)) {
          changes.engagementLevel = item.engagementLevel;
        }
        if (Object.keys(changes).length > 0) {
          await storage.updateGroup(group.id, changes);
          updated++;
        }
      }
      res.json({ updated });
    } catch (err: any) {
      console.error("AI recategorise apply error:", err);
      res.status(500).json({ message: "Failed to apply recategorisation" });
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
        if ((log as any).linkedContactId) trackDate((log as any).linkedContactId, log.createdAt ? new Date(log.createdAt) : null, true);
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
      const contactId = parseId(req.params.id);
      const contact = await storage.getContact(contactId);
      if (!contact || contact.userId !== userId) {
        return res.status(404).json({ message: "Contact not found" });
      }
      const allowedFields = ["isInnovator", "name", "email", "phone", "role", "roleOther", "businessName", "nickname", "ventureType", "age", "ethnicity", "location", "suburb", "area", "localBoard", "tags", "revenueBand", "notes", "active", "stage", "whatTheyAreBuilding", "supportType", "connectionStrength"];
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

      if (Array.isArray(updates.supportType) && updates.supportType.includes("mentoring") && updated.isInnovator) {
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

  app.get("/api/contacts/:id/metric-snapshots", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const contactId = parseId(req.params.id);
      const contact = await storage.getContact(contactId);
      if (!contact || contact.userId !== userId) {
        return res.status(404).json({ message: "Contact not found" });
      }
      const snapshots = await storage.getMetricSnapshots(contactId);
      res.json(snapshots);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch metric snapshots" });
    }
  });

  app.patch("/api/contacts/:id/community-status", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const contactId = parseId(req.params.id);
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
      const contactId = parseId(req.params.id);
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
        return res.json({ contact, newTier: "innovator", groupsUpdated: 0, message: "Already at highest tier" });
      }

      const updated = await storage.updateContact(contactId, updates);

      // Record tier promotion in history
      const previousTier = contact.isInnovator ? "our_innovators" : contact.isCommunityMember ? "our_community" : "all_contacts";
      await storage.createRelationshipStageHistory({
        entityType: "contact",
        entityId: contactId,
        changeType: "tier",
        previousStage: previousTier,
        newStage: newTier,
        changedBy: userId,
      });

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

      if ((updated as any).linkedGroupId && !updatedGroupIds.has((updated as any).linkedGroupId)) {
        const linkedGroup = await storage.getGroup((updated as any).linkedGroupId);
        if (linkedGroup && linkedGroup.userId === userId) {
          if (newTier === "our_community" && !linkedGroup.isCommunity) {
            await storage.updateGroup((updated as any).linkedGroupId, { isCommunity: true, movedToCommunityAt: new Date() });
            groupsUpdated++;
          } else if (newTier === "our_innovators" && !linkedGroup.isInnovator) {
            await storage.updateGroup((updated as any).linkedGroupId, { isInnovator: true, movedToInnovatorsAt: new Date() });
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
      const contactId = parseId(req.params.id);
      const contact = await storage.getContact(contactId);
      if (!contact || contact.userId !== userId) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const updates: any = {};
      let newTier = "";
      if (contact.isInnovator) {
        updates.isInnovator = false;
        // Keep movedToInnovatorsAt as historical record of first promotion
        newTier = "our_community";
      } else if (contact.isCommunityMember) {
        updates.isCommunityMember = false;
        updates.communityMemberOverride = true;
        // Keep movedToCommunityAt as historical record of first promotion
        newTier = "all_contacts";
      } else {
        return res.json({ contact, newTier: "all_contacts", groupsUpdated: 0, message: "Already at lowest tier" });
      }

      const updated = await storage.updateContact(contactId, updates);

      // Record tier demotion in history
      const previousTier = contact.isInnovator ? "our_innovators" : contact.isCommunityMember ? "our_community" : "all_contacts";
      await storage.createRelationshipStageHistory({
        entityType: "contact",
        entityId: contactId,
        changeType: "tier",
        previousStage: previousTier,
        newStage: newTier,
        changedBy: userId,
      });

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

      if ((updated as any).linkedGroupId && !updatedGroupIds.has((updated as any).linkedGroupId)) {
        const linkedGroup = await storage.getGroup((updated as any).linkedGroupId);
        if (linkedGroup && linkedGroup.userId === userId) {
          if (newTier === "our_community" && linkedGroup.isInnovator) {
            const members = await storage.getGroupMembers((updated as any).linkedGroupId);
            const otherContacts = await Promise.all(
              members.filter(mem => mem.contactId !== contactId).map(mem => storage.getContact(mem.contactId))
            );
            const hasOtherInnovators = otherContacts.some(c => c && c.isInnovator);
            if (!hasOtherInnovators) {
              await storage.updateGroup((updated as any).linkedGroupId, { isInnovator: false });
              groupsUpdated++;
            }
          } else if (newTier === "all_contacts" && linkedGroup.isCommunity) {
            const members = await storage.getGroupMembers((updated as any).linkedGroupId);
            const otherContacts = await Promise.all(
              members.filter(mem => mem.contactId !== contactId).map(mem => storage.getContact(mem.contactId))
            );
            const hasOtherCommunity = otherContacts.some(c => c && c.isCommunityMember);
            if (!hasOtherCommunity) {
              await storage.updateGroup((updated as any).linkedGroupId, { isCommunity: false });
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

  app.post("/api/contacts/:id/toggle-vip", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const contactId = parseId(req.params.id);
      const contact = await storage.getContact(contactId);
      if (!contact || contact.userId !== userId) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const nowVip = !contact.isVip;
      const updates: any = {
        isVip: nowVip,
        movedToVipAt: nowVip ? new Date() : null,
      };
      if (nowVip && req.body.vipReason) {
        updates.vipReason = req.body.vipReason;
      }
      if (!nowVip) {
        updates.vipReason = null;
      }

      const updated = await storage.updateContact(contactId, updates);

      if (nowVip) {
        try {
          await storage.addToCatchUpList({
            userId,
            contactId,
            priority: "urgent",
            note: "VIP -- flagged for catch up",
          });
        } catch (e: any) {}
      }

      res.json({ contact: updated, isVip: nowVip });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to toggle VIP status" });
    }
  });

  app.post("/api/contacts/:id/toggle-rangatahi", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const contactId = parseId(req.params.id);
      const contact = await storage.getContact(contactId);
      if (!contact || contact.userId !== userId) {
        return res.status(404).json({ message: "Contact not found" });
      }
      const nowRangatahi = !contact.isRangatahi;
      const updated = await storage.updateContact(contactId, { isRangatahi: nowRangatahi });
      res.json({ contact: updated, isRangatahi: nowRangatahi });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to toggle rangatahi status" });
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

  // === Organisation Profile API ===

  app.get("/api/organisation-profile", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      let profile = await storage.getOrganisationProfile(userId);
      if (!profile) {
        const defaults = {
          mission: "ReserveTMK Digital is a Māori-centred innovation and coworking hub in Glen Innes, serving the people of the Tāmaki rohe. We exist as infrastructure for Māori and Pacific economic and community self-determination — not a programme delivered to people, but a place people use to build their own futures.",
          description: "We are part of the GridAKL innovation network — the eastern anchor serving Māori and Pacific peoples' led startups and enterprises in East Auckland. We hold recognised investment from the Auckland Council Māori Outcomes Fund and operate as named infrastructure within Auckland's economic development ecosystem. We serve Māori entrepreneurs, community enterprises, rangatahi and emerging founders, Pacific peoples' led startups, and mana whenua and mātaawaka with whakapapa and community ties to this rohe.",
          focusAreas: ["Māori entrepreneurs", "community enterprises", "rangatahi and emerging founders", "Pacific peoples' led startups", "mana whenua and mātaawaka", "coworking", "innovation"],
          values: "Tino Rangatiratanga — Māori self-determination is at the centre of everything we do. Whanaungatanga — Connection is the core product. Manaakitanga — How people are welcomed matters as much as what they do here. Kaitiakitanga — We hold this space in trust for the community. Ōhanga Māori — Māori economic participation built from the inside out through local enterprise, local networks and local infrastructure. Kotahitanga — We are stronger as a network, acting with one shared purpose across GridAKL, MOF hubs, local boards and partner organisations.",
          location: "Glen Innes, Tāmaki Makaurau",
          targetCommunity: "Māori and Pacific peoples in the Tāmaki rohe — entrepreneurs, community enterprises, rangatahi, mana whenua and mātaawaka",
        };
        profile = await storage.upsertOrganisationProfile(userId, defaults);
      }
      res.json(profile);
    } catch (err: any) {
      console.error("Error fetching organisation profile:", err);
      res.status(500).json({ message: "Failed to fetch organisation profile" });
    }
  });

  app.put("/api/organisation-profile", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const allowed = insertOrganisationProfileSchema.partial().omit({ userId: true }).parse(req.body);
      const profile = await storage.upsertOrganisationProfile(userId, allowed);
      res.json(profile);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Error saving organisation profile:", err);
      res.status(500).json({ message: "Failed to save organisation profile" });
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
            name: "EDO / Auckland Council — Economic Development Office",
            organisation: "Auckland Council Economic Development Office",
            status: "active_funder" as const,
            communityLens: "all" as const,
            outcomesFramework: "Inclusive & Sustainable Economic Growth",
            outcomeFocus: `Inclusive Economic Growth: Māori and Pacific communities positioned as economic drivers and innovators. Indicators: enterprises started/formalised/grown through hub support, Māori and Pacific entrepreneurs engaged, repeat usage rate, revenue generated from hub-facilitated activity, jobs created or sustained.

Social & Sector Innovation: Ecosystem activations that connect communities, sectors and opportunities. Indicators: activations/events/wānanga hosted, GridAKL and innovation network connections formed, rangatahi engaged in enterprise or innovation programmes, partnerships brokered across sectors.

Ecosystem Building: A connected and collaborative enterprise support ecosystem across Tāmaki Makaurau. Indicators: organisations partnered with, cross-hub referrals, co-investment attracted from other funders, hub utilisation and venue hire metrics.

Tāmaki Rohe Economic Contribution: Local enterprises retained and grown, contributing to Auckland's inclusive economy. Indicators: local enterprises retained through hub support, new enterprises established, geographic spread of users, co-investment leverage ratio.`,
            reportingGuidance: `Reporting Rhythm:
• Monthly: Usage numbers, activations, events, venue hire → Internal / Tātaki Auckland Unlimited
• Quarterly: Inclusive growth indicators, ecosystem connections, co-investment tracking, partnership updates → EDO quarterly reporting
• Annually: Full impact report — economic indicators, qualitative stories, co-investment leverage summary, forward plan → Auckland Council / EDO annual cycle

Co-investment Partners: Ngā Mātārae MOF, Tātaki Auckland Unlimited, Local Board, Foundation North, MBIE.

What they want to see: Evidence of inclusive economic impact, geographic purpose (Tāmaki Makaurau reach), co-investment leverage from other funders, Māori and Pacific participation data, enterprise growth metrics, innovation ecosystem development.

Framing: The hub as economic infrastructure for inclusive growth — enabling Māori and Pacific enterprise, connecting innovation ecosystems, and contributing measurably to Auckland's economic development goals.`,
            reportingCadence: "quarterly" as const,
            narrativeStyle: "compliance" as const,
            prioritySections: ["engagement", "delivery", "value"],
            funderTag: "edo-auckland-council",
            contractStart: new Date("2025-07-01T00:00:00.000Z"),
            isDefault: true,
          },
          {
            userId,
            name: "Foundation North — Pūtea Hāpai Oranga",
            organisation: "Foundation North",
            status: "active_funder" as const,
            communityLens: "maori" as const,
            outcomesFramework: "Increased Equity / Community Support",
            outcomeFocus: `Increased Equity (Hāpai te ōritetanga): Improved equity and wellbeing outcomes for Māori — communities leading their own solutions, not having solutions delivered to them. Indicators: Māori entrepreneurs/enterprises supported, whānau reporting improved confidence or capability, community-led initiatives launched, equitable access to enterprise support, cultural safety ratings.

Community Support (Hāpori awhina): Connected, resilient communities with access to spaces, networks, and opportunities. Indicators: community events/hui hosted, total attendees (proportion Māori), community connections and networks formed, organisations partnered with, user satisfaction and sense of belonging, pride and resilience indicators.

Te Tiriti o Waitangi (cross-cutting): Te reo Māori visible and normalised, kaupapa Māori embedded in operations, Māori-led decision making. Indicators: te reo visible in signage/communications/programmes, kaupapa Māori programming delivered, Māori governance and advisory involvement, tikanga integration in operations, Māori staff and facilitator representation.`,
            reportingGuidance: `Grant Types:
• Quick Response Grant: Up to $25,000, approximately 2-month decision turnaround
• Community Grant: Over $25,000, approximately 5-month decision turnaround

Reporting: 12-month impact report required at end of funding period.

Application Strategy:
• Lead with community voice — stories of whānau and communities leading change
• Show tangata whenua priority alignment — how the mahi centres Māori needs and aspirations
• Demonstrate community-led solutions, not service delivery
• Evidence of Te Tiriti commitment in governance and operations
• Include both quantitative indicators and qualitative impact stories

What to show: Community ownership and self-determination, grassroots impact stories, te reo and tikanga integration, equitable access, partnership and collaboration evidence.

What to avoid: Deficit framing, top-down service delivery language, purely statistical reporting without community voice, treating Māori as beneficiaries rather than leaders.`,
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
      const id = parseId(req.params.id);
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
      if (body.outcomeFocus && Array.isArray(body.outcomeFocus)) {
        const validOptions = ["economic", "wellbeing", "cultural", "community"];
        body.outcomeFocus = body.outcomeFocus.filter((v: string) => validOptions.includes(v));
      }
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
      const id = parseId(req.params.id);
      const existing = await storage.getFunder(id);
      if (!existing) return res.status(404).json({ message: "Funder not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      const body = coerceDateFields(req.body);
      if (body.outcomeFocus && Array.isArray(body.outcomeFocus)) {
        const validOptions = ["economic", "wellbeing", "cultural", "community"];
        body.outcomeFocus = body.outcomeFocus.filter((v: string) => validOptions.includes(v));
      }
      const updated = await storage.updateFunder(id, body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update funder" });
    }
  });

  app.delete("/api/funders/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const existing = await storage.getFunder(id);
      if (!existing) return res.status(404).json({ message: "Funder not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      await storage.deleteFunder(id);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete funder" });
    }
  });

  app.post("/api/funders/:id/ai-generate", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const userId = (req.user as any).claims.sub;
      const funder = await storage.getFunder(id);
      if (!funder) return res.status(404).json({ message: "Funder not found" });
      if (funder.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const orgProfile = await storage.getOrganisationProfile(userId);
      const docs = await storage.getFunderDocuments(id);

      const documentContents: { name: string; type: string; content: string }[] = [];
      for (const doc of docs) {
        if (doc.fileData) {
          let extractedText = "";
          const buffer = Buffer.from(doc.fileData, "base64");
          const isPdf = doc.fileName.toLowerCase().endsWith(".pdf") || buffer.subarray(0, 5).toString() === "%PDF-";
          if (isPdf) {
            try {
              const pdfParse = (await import("pdf-parse")).default;
              const parsed = await pdfParse(buffer);
              extractedText = parsed.text || "";
            } catch (e) {
              extractedText = buffer.toString("utf-8");
            }
          } else {
            extractedText = buffer.toString("utf-8");
          }
          const cleanText = extractedText.replace(/[^\x20-\x7E\n\r\t\u00C0-\u024F\u0100-\u017F\u0300-\u036F\u2000-\u206F\u2018-\u201F\u2026\u2013\u2014\u00A0\u0101\u014D\u016B\u0113\u012B\u0100\u014C\u016A\u0112\u012A]/g, " ").replace(/\s{3,}/g, " ").trim();
          if (cleanText.length > 100) {
            documentContents.push({
              name: doc.fileName,
              type: doc.documentType,
              content: cleanText.substring(0, 15000),
            });
          }
        }
      }

      const orgContext = orgProfile ? `
Organisation: ${orgProfile.name || ""}
Mission: ${orgProfile.mission || ""}
Description: ${orgProfile.description || ""}
Focus Areas: ${Array.isArray(orgProfile.focusAreas) ? orgProfile.focusAreas.join(", ") : orgProfile.focusAreas || ""}
Target Community: ${orgProfile.targetCommunity || ""}
Location: ${orgProfile.location || ""}` : "";

      const existingInfo = `
Funder Name: ${funder.name}
Organisation: ${funder.organisation || ""}
Status: ${funder.status}
Outcomes Framework: ${funder.outcomesFramework || ""}
Outcome Focus: ${funder.outcomeFocus || ""}
Reporting Guidance: ${funder.reportingGuidance || ""}
Reporting Cadence: ${funder.reportingCadence || ""}
Narrative Style: ${funder.narrativeStyle || ""}
Contract Start: ${funder.contractStart || ""}
Contract End: ${funder.contractEnd || ""}
Notes: ${funder.notes || ""}`;

      const docsContext = documentContents.length > 0
        ? "\n\nUPLOADED DOCUMENTS:\n" + documentContents.map(d => `--- ${d.name} (${d.type}) ---\n${d.content}`).join("\n\n")
        : "";

      const systemPrompt = `You are an expert in Aotearoa New Zealand community development, Māori and Pasifika outcomes frameworks, and funder relationship management. You help organisations like ReserveTMK Digital build rich funder profiles.

Given the organisation context, existing funder information, and any uploaded documents, generate a comprehensive funder profile. Use te reo Māori terms where appropriate and be specific to the funder's actual framework and focus areas.

${orgContext}

Respond with a JSON object containing these fields:
{
  "outcomesFramework": "Name and description of the funder's outcomes framework",
  "outcomeFocus": "Detailed outcome focus areas with indicators. Use the funder's actual pou/pillars if known. Each area should have a name, description, and specific measurable indicators.",
  "reportingGuidance": "Structured reporting rhythm and guidance including: what they want to see, how often, what format, and any specific metrics or stories they value.",
  "narrativeStyle": "One of: compliance, story, partnership",
  "prioritySections": ["Array of priority sections from: engagement, delivery, impact, outcomes, milestones, reach, value, tamaki_ora, cohort"],
  "partnershipStrategy": "A strategy section describing how the organisation delivers on this funder's outcomes. Include: how the partnership works, what activities/programmes align with their goals, how impact is demonstrated, key touchpoints and relationship management approach, and how reporting feeds into the relationship."
}

Be specific, practical, and grounded in the actual documents and context provided. Don't be generic — reference the specific funder, their framework, and their priorities. The partnership strategy should read like an internal playbook for how to deliver and report to this funder.`;

      const result = await claudeJSON({
        model: "claude-sonnet-4-6",
        system: systemPrompt,
        prompt: `Generate a comprehensive funder profile for this funder:\n\n${existingInfo}${docsContext}`,
        temperature: 0.4,
        maxTokens: 4096,
      });

      const validStyles = ["compliance", "story", "partnership"];
      const validSections = ["engagement", "delivery", "impact", "outcomes", "milestones", "reach", "value", "tamaki_ora", "cohort"];
      const sanitized = {
        outcomesFramework: typeof result.outcomesFramework === "string" ? result.outcomesFramework.substring(0, 5000) : null,
        outcomeFocus: typeof result.outcomeFocus === "string" ? result.outcomeFocus.substring(0, 5000) : null,
        reportingGuidance: typeof result.reportingGuidance === "string" ? result.reportingGuidance.substring(0, 5000) : null,
        narrativeStyle: validStyles.includes(result.narrativeStyle) ? result.narrativeStyle : "compliance",
        prioritySections: Array.isArray(result.prioritySections) ? result.prioritySections.filter((s: string) => validSections.includes(s)) : [],
        partnershipStrategy: typeof result.partnershipStrategy === "string" ? result.partnershipStrategy.substring(0, 5000) : null,
      };
      res.json(sanitized);
    } catch (err: any) {
      if (err instanceof AIKeyMissingError) return res.status(503).json({ message: err.message });
      console.error("AI generate funder profile error:", err);
      res.status(500).json({ message: "Failed to generate profile" });
    }
  });

  app.get("/api/funders/:id/documents", isAuthenticated, async (req, res) => {
    try {
      const funderId = parseId(req.params.id);
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
      const funderId = parseId(req.params.id);
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
      const docId = parseId(req.params.docId);
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
      const docId = parseId(req.params.docId);
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

  // === FUNDER DELIVERABLES ===

  app.get("/api/funders/:id/deliverables", isAuthenticated, async (req, res) => {
    try {
      const funderId = parseId(req.params.id);
      const funder = await storage.getFunder(funderId);
      if (!funder || funder.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const deliverables = await storage.getFunderDeliverables(funderId);
      res.json(deliverables);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch deliverables" });
    }
  });

  app.post("/api/funders/:id/deliverables", isAuthenticated, async (req, res) => {
    try {
      const funderId = parseId(req.params.id);
      const funder = await storage.getFunder(funderId);
      if (!funder || funder.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const deliverable = await storage.createFunderDeliverable({ ...req.body, funderId });
      res.status(201).json(deliverable);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create deliverable" });
    }
  });

  app.patch("/api/funder-deliverables/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const existing = await storage.getFunderDeliverable(id);
      if (!existing) return res.status(404).json({ message: "Deliverable not found" });
      const funder = await storage.getFunder(existing.funderId);
      if (!funder || funder.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const updated = await storage.updateFunderDeliverable(id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update deliverable" });
    }
  });

  app.delete("/api/funder-deliverables/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const existing = await storage.getFunderDeliverable(id);
      if (!existing) return res.status(404).json({ message: "Deliverable not found" });
      const funder = await storage.getFunder(existing.funderId);
      if (!funder || funder.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteFunderDeliverable(id);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete deliverable" });
    }
  });

  app.get("/api/funders/:id/pulse", isAuthenticated, async (req, res) => {
    try {
      const funderId = parseId(req.params.id);
      const userId = (req.user as any).claims.sub;
      const funder = await storage.getFunder(funderId);
      if (!funder || funder.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const startDate = (req.query.start as string) || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
      const endDate = (req.query.end as string) || new Date().toISOString().slice(0, 10);

      const deliverables = await storage.getFunderDeliverables(funderId);
      const activeDeliverables = deliverables.filter(d => d.isActive);

      const results = await evaluateDeliverables(
        activeDeliverables,
        userId,
        startDate,
        endDate,
        funder.contractStart,
        funder.contractEnd,
      );

      const atRisk = results.filter(r => r.status === "at_risk").length;
      const needsAttention = results.filter(r => r.status === "needs_attention").length;
      const overall = atRisk > 0 ? "at_risk" : needsAttention > 0 ? "needs_attention" : "on_track";

      res.json({
        funder: { id: funder.id, name: funder.name, organisation: funder.organisation },
        period: { start: startDate, end: endDate },
        contract: { start: funder.contractStart, end: funder.contractEnd },
        deliverables: results,
        summary: { total: results.length, atRisk, needsAttention, overall },
      });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to generate pulse" });
    }
  });

  app.post("/api/funders/seed-deliverables", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;

      const SEED_MAP: Record<string, Array<{ name: string; description: string; metricType: string; filter: Record<string, any>; targetAnnual?: number }>> = {
        "edo-auckland-council": [
          { name: "Activations", description: "Total activations (events + bookings + programmes)", metricType: "activations", filter: {} },
          { name: "Programmes delivered", description: "Innovation and entrepreneurial programmes", metricType: "programmes", filter: {} },
          { name: "Events delivered", description: "Community events, workshops, wananga", metricType: "events", filter: { excludeTypes: ["Meeting", "Catch Up", "Planning", "Mentoring Session"] } },
          { name: "Mentoring sessions", description: "1:1 capability building sessions", metricType: "mentoring", filter: { sessionStatus: "completed" } },
          { name: "Maori businesses registered", description: "Maori-led businesses and enterprises in the ecosystem", metricType: "groups", filter: { groupType: ["Business", "Social Enterprise"], isMaori: true } },
          { name: "Rangatahi participating", description: "Rangatahi engaged in programmes and mentoring", metricType: "contacts", filter: { isRangatahi: true } },
          { name: "Venue hire bookings", description: "External venue hire bookings", metricType: "bookings", filter: { classifications: ["venue_hire"] } },
          { name: "Foot traffic", description: "Total people through the space", metricType: "foot_traffic", filter: {}, targetAnnual: 5000 },
        ],
        "nga-matarae": [
          { name: "Maori innovators engaged", description: "Maori innovators and entrepreneurs in the ecosystem", metricType: "contacts", filter: { ethnicity: ["Māori"], isInnovator: true } },
          { name: "Rangatahi participating", description: "Maori and Pasifika rangatahi in programmes", metricType: "contacts", filter: { isRangatahi: true } },
          { name: "Programmes/services delivered", description: "Capability building programmes", metricType: "programmes", filter: {} },
          { name: "Events delivered", description: "Community activations and wananga", metricType: "events", filter: { excludeTypes: ["Meeting", "Catch Up", "Planning", "Mentoring Session"] } },
          { name: "Mentoring sessions", description: "1:1 capability sessions delivered", metricType: "mentoring", filter: { sessionStatus: "completed" } },
          { name: "Maori businesses in ecosystem", description: "Maori-led businesses registered", metricType: "groups", filter: { groupType: ["Business", "Social Enterprise"], isMaori: true } },
        ],
        "trc-clc": [
          { name: "Storytelling campaigns", description: "Digital storytelling campaigns delivered", metricType: "events", filter: { eventTypes: ["Content"] }, targetAnnual: 3 },
        ],
      };

      const results: Record<string, any[]> = {};
      for (const [tag, deliverables] of Object.entries(SEED_MAP)) {
        const funder = await storage.getFunderByTag(userId, tag);
        if (!funder) continue;
        const existing = await storage.getFunderDeliverables(funder.id);
        if (existing.length > 0) {
          results[tag] = { skipped: true, existing: existing.length } as any;
          continue;
        }
        const created = [];
        for (let i = 0; i < deliverables.length; i++) {
          const d = deliverables[i];
          const item = await storage.createFunderDeliverable({
            funderId: funder.id,
            name: d.name,
            description: d.description,
            metricType: d.metricType,
            filter: d.filter,
            targetAnnual: d.targetAnnual || null,
            targetTotal: null,
            unit: "count",
            sortOrder: i,
            isActive: true,
          });
          created.push(item);
        }
        results[tag] = created;
      }

      res.status(201).json(results);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to seed deliverables" });
    }
  });

  app.post("/api/funders/seed-radar", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const radarEntries = [
        {
          name: "Foundation North",
          organisation: "Foundation North",
          status: "radar" as const,
          estimatedValue: 50000,
          fitTags: ["maori", "community", "youth", "pasifika"],
          notes: "Quick Response <$25k (2 months). Community >$25k multi-year (5 months). Warm intro: Rochelle (advisor) via Jacqui.",
          nextAction: "Contact Rochelle via Jacqui",
        },
        {
          name: "Te Puni Kokiri — Maori Development Fund",
          organisation: "Te Puni Kokiri",
          status: "radar" as const,
          estimatedValue: 50000,
          fitTags: ["maori", "enterprise", "innovation"],
          notes: "$40.21M/year fund. Streams: Putea Kimihia (investigate), Putea Tipuranga (growth), Maori Business Growth Support.",
          nextAction: "Call Auckland regional TPK office",
        },
        {
          name: "Maungakiekie-Tamaki Local Board — Quick Response",
          organisation: "Auckland Council",
          status: "radar" as const,
          estimatedValue: 5000,
          applicationDeadline: new Date("2026-04-06"),
          fitTags: ["youth", "maori", "pasifika", "placemaking"],
          notes: "$2k-$10k grants. Priorities: youth, Maori/Pacific, placemaking.",
          nextAction: "Prepare application this week",
        },
        {
          name: "Creative NZ — Arts Orgs Fund Tiers 1-2",
          organisation: "Creative New Zealand",
          status: "radar" as const,
          estimatedValue: 75000,
          applicationDeadline: new Date("2026-05-31"),
          fitTags: ["arts", "youth", "community"],
          notes: "Tier 1: up to $50k/yr. Tier 2: $50-125k/yr. Multi-year options. Fit: podcast studio, Creators Club, content creation.",
          nextAction: "Assess creative programmes as arts delivery",
        },
        {
          name: "Social Investment Fund — Pathway Four",
          organisation: "Ministry of Social Development",
          status: "radar" as const,
          estimatedValue: 100000,
          fitTags: ["community", "youth"],
          notes: "$190M over 4 years. Pathway Four (co-investment with philanthropy) anticipated early 2026. RTMKD data capability is differentiator.",
          nextAction: "Explore paired with Foundation North",
        },
        {
          name: "Tindall Foundation",
          organisation: "Auckland Foundation",
          status: "radar" as const,
          estimatedValue: 20000,
          applicationDeadline: new Date("2026-07-20"),
          fitTags: ["community", "maori", "pasifika"],
          notes: "Grassroots Giving for whanau experiencing multiple disadvantage. Applications open 20 July 2026, close 9 August.",
        },
        {
          name: "Ministry of Youth Development",
          organisation: "Ministry of Youth Development",
          status: "radar" as const,
          estimatedValue: 30000,
          fitTags: ["youth", "enterprise"],
          notes: "~$12M/year. Ages 12-24. Current round locked to June 2027. Next opening likely mid-2026.",
        },
      ];

      const created = [];
      for (const entry of radarEntries) {
        const existing = await storage.getFunderByTag(userId, entry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
        if (existing) continue;
        const funder = await storage.createFunder({
          userId,
          ...entry,
          communityLens: "all",
          funderTag: entry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        });
        created.push(funder);
      }
      res.status(201).json({ created: created.length, entries: created });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to seed radar entries" });
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
      await autoPromoteToInnovator(input.contactId);
      res.status(201).json(relationship);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Failed to create mentoring relationship" });
    }
  });

  app.get("/api/mentoring-relationships/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
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
      const id = parseId(req.params.id);
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

      if (body.status === "ended" || body.status === "graduated") {
        try {
          const otherRels = await storage.getMentoringRelationshipsByContact(existing.contactId);
          const hasOtherActive = otherRels.some(r => r.id !== id && (r.status === "active" || r.status === "on_hold"));
          if (!hasOtherActive) {
            const contactUpdate: Record<string, string | boolean> = {
              stage: "inactive",
              relationshipStage: "inactive",
              isCommunityMember: false,
            };
            await storage.updateContact(existing.contactId, contactUpdate);
          }
        } catch (contactErr) {
          console.warn("Failed to update contact on relationship end/graduate:", contactErr);
        }
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update mentoring relationship" });
    }
  });

  app.delete("/api/mentoring-relationships/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
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
      const contactId = parseId(req.params.contactId);
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
      const id = parseId(req.params.id);
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
      const id = parseId(req.params.id);
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
      const id = parseId(req.params.id);
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
      const id = parseId(req.params.id);
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

  app.get("/api/projects/all-tasks", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const tasks = await storage.getAllProjectTasks(userId);
      res.json(tasks);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to get all tasks" });
    }
  });

  app.get("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
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
      const id = parseId(req.params.id);
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
      const id = parseId(req.params.id);
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
      const projectId = parseId(req.params.id);
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
      const projectId = parseId(req.params.id);
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

  app.get("/api/projects/:id/tasks", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
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
      const projectId = parseId(req.params.id);
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
      const taskId = parseId(req.params.taskId);
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
      const taskId = parseId(req.params.taskId);
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
        system: `You are a project management assistant for ReserveTMK Digital, a Māori and Pasifika community development organisation in Tāmaki Makaurau (Auckland), Aotearoa New Zealand. You extract actionable tasks from voice debriefs, meeting notes, and freeform text, and organise them into logical groups.

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
      if (err instanceof AIKeyMissingError) return res.status(503).json({ message: err.message });
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

        const baseUrl = getBaseUrl();
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

      await storage.updateBookerLinkAccess(link.id);

      const activeToken = link.token;

      const isGroupLink = link.isGroupLink === true;
      const contact = booker.contactId ? await storage.getContact(booker.contactId) : null;

      // Auto-fill notificationsEmail if not set
      if (!booker.notificationsEmail) {
        const autoEmail = booker.loginEmail || contact?.email;
        if (autoEmail) {
          try {
            await storage.updateRegularBooker(booker.id, { notificationsEmail: autoEmail });
            booker.notificationsEmail = autoEmail;
          } catch {}
        }
      }
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
        booker: { ...booker, loginToken: activeToken },
        contact,
        linkedGroupId,
        linkedGroupName,
        membership,
        mou,
        userId: booker.userId,
        token: activeToken,
        isGroupLink,
      });
    } catch (err: any) {
      console.error("Booker auth error:", err);
      res.status(500).json({ message: "Authentication failed" });
    }
  });

  app.get("/api/booker/pricing/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const linkResult = await storage.getBookerByLinkToken(token);
      if (!linkResult || (linkResult.link.tokenExpiry && new Date(linkResult.link.tokenExpiry) < new Date()) || !linkResult.link.enabled) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      const booker = linkResult.booker;
      const defaults = await storage.getBookingPricingDefaults(booker.userId);
      const fullDayRate = parseFloat(defaults?.fullDayRate || "0");
      const halfDayRate = parseFloat(defaults?.halfDayRate || "0");
      const hourlyRate = fullDayRate / 8;

      let pricingTier = booker.pricingTier || "full_price";
      const discountPct = parseFloat(booker.discountPercentage || "0");
      const hasMembership = !!booker.membershipId;
      const hasMou = !!booker.mouId;
      const hasPackage = booker.hasBookingPackage && ((booker.packageTotalBookings || 0) - (booker.packageUsedBookings || 0)) > 0;

      const applyDiscount = (rate: number) => {
        if (hasMembership || hasMou) return 0;
        if (pricingTier === "free_koha") return 0;
        if (pricingTier === "discounted" && discountPct > 0) {
          return Math.round(rate * (1 - discountPct / 100) * 100) / 100;
        }
        return rate;
      };

      res.json({
        fullDayRate: applyDiscount(fullDayRate),
        halfDayRate: applyDiscount(halfDayRate),
        hourlyRate: applyDiscount(hourlyRate),
        baseFullDayRate: fullDayRate,
        baseHalfDayRate: halfDayRate,
        baseHourlyRate: hourlyRate,
        pricingTier,
        discountPercentage: discountPct,
        coveredByAgreement: hasMembership || hasMou,
        hasPackageCredits: hasPackage,
        packageRemaining: hasPackage ? (booker.packageTotalBookings || 0) - (booker.packageUsedBookings || 0) : 0,
        maxAdvanceMonths: defaults?.maxAdvanceMonths ?? 3,
      });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch pricing" });
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
      let activeVenues = allVenues.filter(v => v.active);

      let allowedLocations: string[] | null = null;
      if (booker.membershipId) {
        const membership = await storage.getMembership(booker.membershipId);
        if (membership && membership.allowedLocations && membership.allowedLocations.length > 0) {
          allowedLocations = membership.allowedLocations;
        }
      } else if (booker.mouId) {
        const mou = await storage.getMou(booker.mouId);
        if (mou && mou.allowedLocations && mou.allowedLocations.length > 0) {
          allowedLocations = mou.allowedLocations;
        }
      }
      if (allowedLocations) {
        activeVenues = activeVenues.filter(v => {
          const loc = v.spaceName || "Other";
          return allowedLocations!.includes(loc);
        });
      }

      // Also filter by allowed_venue_ids if set on MOU
      if (booker.mouId) {
        const mou = await storage.getMou(booker.mouId);
        const allowedIds = (mou as any)?.allowedVenueIds as number[] | null;
        if (allowedIds && allowedIds.length > 0) {
          activeVenues = activeVenues.filter(v => allowedIds.includes(v.id));
        }
      }

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

      const venueId = parseId(req.query.venueId);
      const month = parseStr(req.query.month);
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
        const bIds = b.venueIds || (b.venueId ? [b.venueId] : []);
        if (!bIds.includes(venueId)) return false;
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

        const isGroupLink = linkResult.link.isGroupLink === true;
        const isYours = isGroupLink
          ? (booker.groupId ? booking.bookerGroupId === booker.groupId : booking.bookerId === booker.contactId)
          : booking.bookerId === booker.contactId;
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

      const { venueId, venueIds: rawVenueIds, startDate, startTime, endTime, classification, bookingSummary, usePackageCredit, bookerName, notes, isFirstBooking, attendeeCount } = req.body;
      if (!venueId || !startDate || !startTime || !endTime || !classification) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      if (!bookingSummary || !String(bookingSummary).trim()) {
        return res.status(400).json({ message: "Booking summary is required" });
      }
      const resolvedVenueIds: number[] = Array.isArray(rawVenueIds) && rawVenueIds.length > 0
        ? rawVenueIds.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id))
        : [venueId];

      const defaults = await storage.getBookingPricingDefaults(booker.userId);
      const maxAdvanceMonths = defaults?.maxAdvanceMonths ?? 3;
      const maxDate = new Date();
      maxDate.setMonth(maxDate.getMonth() + maxAdvanceMonths);
      maxDate.setHours(23, 59, 59, 999);
      if (new Date(startDate) > maxDate) {
        return res.status(400).json({ message: `Bookings cannot be made more than ${maxAdvanceMonths} month${maxAdvanceMonths !== 1 ? "s" : ""} in advance` });
      }

      const isGroupLink = linkResult.link.isGroupLink === true;

      let portalAllowedLocations: string[] | null = null;
      if (booker.membershipId) {
        const membership = await storage.getMembership(booker.membershipId);
        if (membership && membership.allowedLocations && membership.allowedLocations.length > 0) {
          portalAllowedLocations = membership.allowedLocations;
        }
      } else if (booker.mouId) {
        const mouRecord = await storage.getMou(booker.mouId);
        if (mouRecord && mouRecord.allowedLocations && mouRecord.allowedLocations.length > 0) {
          portalAllowedLocations = mouRecord.allowedLocations;
        }
      }
      if (portalAllowedLocations) {
        for (const vid of resolvedVenueIds) {
          const v = await storage.getVenue(vid);
          if (v) {
            const vLoc = v.spaceName || "Other";
            if (!portalAllowedLocations.includes(vLoc)) {
              return res.status(400).json({
                message: `Venue "${v.name}" is not in an allowed location for your agreement`,
              });
            }
          }
        }
      }

      // Also enforce allowed_venue_ids from MOU if set
      if (booker.mouId) {
        const mouRecord2 = await storage.getMou(booker.mouId);
        const allowedIds = (mouRecord2 as any)?.allowedVenueIds as number[] | null;
        if (allowedIds && allowedIds.length > 0) {
          for (const vid of resolvedVenueIds) {
            if (!allowedIds.includes(vid)) {
              const v = await storage.getVenue(vid);
              return res.status(400).json({
                message: `Venue "${v?.name || vid}" is not available under your agreement`,
              });
            }
          }
        }
      }

      const venue = await storage.getVenue(venueId);
      if (venue && venue.capacity && req.body.attendeeCount && req.body.attendeeCount > venue.capacity) {
        return res.status(400).json({
          message: `Attendee count (${req.body.attendeeCount}) exceeds venue capacity (${venue.capacity})`,
        });
      }

      const allBookings = await storage.getBookings(booker.userId);
      const conflicting = allBookings.filter(b => {
        const bIds = b.venueIds || (b.venueId ? [b.venueId] : []);
        const hasOverlappingVenue = resolvedVenueIds.some(vid => bIds.includes(vid));
        if (!hasOverlappingVenue || b.status === "cancelled") return false;
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

      const allMeetings = await storage.getMeetings(booker.userId);
      for (const m of allMeetings) {
        if (m.status === "cancelled") continue;
        if (!m.venueId || !resolvedVenueIds.includes(m.venueId)) continue;
        const mStartDate = m.startTime ? new Date(m.startTime).toISOString().slice(0, 10) : null;
        const mStartTimeStr = m.startTime ? new Date(m.startTime).toTimeString().slice(0, 5) : null;
        const mEndTimeStr = m.endTime ? new Date(m.endTime).toTimeString().slice(0, 5) : null;
        if (!mStartDate) continue;
        const reqDate = new Date(startDate).toISOString().split("T")[0];
        if (mStartDate !== reqDate) continue;
        if (!timesOverlap(startTime, endTime, mStartTimeStr, mEndTimeStr)) continue;
        return res.status(409).json({
          message: `Time slot conflicts with meeting "${m.title}"`,
        });
      }

      let bookerGroupId: number | null = booker.groupId || null;
      if (!bookerGroupId && booker.contactId) {
        const contactGroups = await storage.getContactGroups(booker.contactId);
        if (contactGroups.length > 0) {
          bookerGroupId = contactGroups[0].groupId;
        }
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

      const titleSuffix = isGroupLink && bookerName ? ` (by ${bookerName})` : "";
      let allowanceWarning: string | null = null;
      let agreementAllowance = 0;
      let agreementPeriod = "quarterly";
      if (membershipId) {
        const membership = await storage.getMembership(membershipId);
        if (membership) {
          agreementAllowance = membership.bookingAllowance || 0;
          agreementPeriod = membership.allowancePeriod || "quarterly";
        }
      } else if (mouId) {
        const mouRecord = await storage.getMou(mouId);
        if (mouRecord) {
          agreementAllowance = mouRecord.bookingAllowance || 0;
          agreementPeriod = mouRecord.allowancePeriod || "quarterly";
        }
      }
      // Agreement booker allowance check — determines auto-confirm vs over-allowance flow
      let isWithinAllowance = false;
      let isOverAllowance = false;
      if (agreementAllowance > 0) {
        const linkedId = (membershipId || mouId)!;
        const linkedType = membershipId ? "membership" : "mou";
        const now = new Date();
        let periodStart: Date;
        let periodEnd: Date;
        if (agreementPeriod === "monthly") {
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        } else {
          const q = Math.floor(now.getMonth() / 3) * 3;
          periodStart = new Date(now.getFullYear(), q, 1);
          periodEnd = new Date(now.getFullYear(), q + 3, 1);
        }
        const confirmedCount = allBookings.filter(b => {
          const matchesAgreement = linkedType === "membership"
            ? b.membershipId === linkedId
            : b.mouId === linkedId;
          if (!matchesAgreement) return false;
          if (b.status === "cancelled") return false;
          if (b.status !== "confirmed" && b.status !== "completed") return false;
          const bDate = b.startDate ? new Date(b.startDate) : b.createdAt ? new Date(b.createdAt) : null;
          return bDate && bDate >= periodStart && bDate < periodEnd;
        }).length;
        if (confirmedCount < agreementAllowance) {
          isWithinAllowance = true;
        } else {
          isOverAllowance = true;
          const periodLabel = agreementPeriod === "monthly" ? "month" : "quarter";
          allowanceWarning = `This booking exceeds the ${periodLabel}ly allowance (${confirmedCount}/${agreementAllowance} used this ${periodLabel}) — community rate (20% discount) applied`;
        }
      } else if (membershipId || mouId) {
        // Has agreement but no allowance limit — treat as within allowance (free)
        isWithinAllowance = true;
      }

      // Determine booking status, pricing and payment_status based on allowance
      let bookingStatus = "enquiry";
      let bookingPaymentStatus = "unpaid";
      let autoConfirmedAt: Date | null = null;

      if (isWithinAllowance && (membershipId || mouId)) {
        // Auto-confirm: within allowance, free
        bookingStatus = "confirmed";
        bookingPaymentStatus = "not_required";
        autoConfirmedAt = new Date();
        pricingTier = "free_koha";
        amount = "0";
      } else if (isOverAllowance) {
        // Over allowance: auto-confirm but apply 20% community discount
        bookingStatus = "confirmed";
        bookingPaymentStatus = "unpaid";
        autoConfirmedAt = new Date();
        pricingTier = "discounted";
        discountPercentage = "20";
        // Recalculate amount at 20% discount
        const defaults = await storage.getBookingPricingDefaults(booker.userId);
        if (defaults) {
          let baseAmount: number;
          if (durationType === "full_day") {
            baseAmount = parseFloat(defaults.fullDayRate || "0");
          } else if (durationType === "half_day") {
            baseAmount = parseFloat(defaults.halfDayRate || "0");
          } else {
            const hourlyRate = parseFloat(defaults.fullDayRate || "0") / 8;
            baseAmount = hourlyRate * durationHours;
          }
          amount = String((baseAmount * 0.8).toFixed(2));
        }
      }

      const booking = await storage.createBooking({
        userId: booker.userId,
        venueId: resolvedVenueIds[0],
        venueIds: resolvedVenueIds,
        title: `${classification} - Portal Booking${titleSuffix}`,
        classification,
        status: bookingStatus,
        startDate: new Date(startDate),
        startTime,
        endTime,
        durationType,
        pricingTier,
        amount,
        bookerId: isGroupLink ? null : booker.contactId,
        bookerGroupId,
        membershipId,
        mouId,
        bookingSummary: String(bookingSummary).trim(),
        bookerName: bookerName || null,
        bookingSource: "regular_booker_portal",
        usePackageCredit: shouldUsePackageCredit,
        discountPercentage,
        confirmedAt: autoConfirmedAt,
        paymentStatus: bookingPaymentStatus,
        notes: notes || null,
        isFirstBooking: isFirstBooking || false,
        attendeeCount: attendeeCount ? parseInt(attendeeCount) : null,
      } as any);

      // Send appropriate email notifications
      if (bookingStatus === "confirmed" && autoConfirmedAt) {
        // Auto-confirmed: send confirmation email (not enquiry alert)
        try {
          const { sendBookingConfirmationEmail } = await import("./email");
          await sendBookingConfirmationEmail(booking, booker.userId, booker.notificationsEmail || undefined);
        } catch (emailErr) {
          console.error("[Email] Auto-confirm confirmation email failed (booker portal):", emailErr);
        }

        // Admin alert for auto-confirmed booking
        try {
          const { getGmailClientForSending } = await import("./gmail-send");
          const gmail = await getGmailClientForSending(booker.userId);
          const allVenues = await storage.getVenues(booker.userId);
          const venueNames = resolvedVenueIds.map(vid => allVenues.find(v => v.id === vid)?.name).filter(Boolean).join(", ") || "Unknown Venue";
          const bookingDateStr = startDate ? new Date(startDate + "T00:00").toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "TBC";
          const timeStr = [startTime, endTime].filter(Boolean).join(" – ");
          const orgName = booker.organizationName || bookerName || "Unknown";
          const subjectAdmin = `Booking confirmed: ${orgName} — ${bookingDateStr}`;
          const htmlAdmin = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;color:#1e293b;max-width:600px;margin:0 auto;padding:20px">
            <h2 style="color:#10b981;">✅ Booking Auto-Confirmed</h2>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;"><strong>Organisation:</strong></td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">${orgName}</td></tr>
              <tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;"><strong>Date:</strong></td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">${bookingDateStr}</td></tr>
              <tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;"><strong>Time:</strong></td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">${timeStr || "TBC"}</td></tr>
              <tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;"><strong>Venue:</strong></td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">${venueNames}</td></tr>
              <tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;"><strong>Classification:</strong></td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">${classification || "—"}</td></tr>
              ${bookingSummary ? `<tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;"><strong>Summary:</strong></td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">${String(bookingSummary).trim()}</td></tr>` : ""}
              ${isOverAllowance ? `<tr><td colspan="2" style="padding:6px 0;color:#f59e0b;font-size:13px;">⚠️ Over allowance — 20% community discount applied</td></tr>` : ""}
            </table>
            <p style="color:#64748b;font-size:12px;margin-top:16px;">This booking was auto-confirmed via the Booker Portal.</p>
          </body></html>`;
          const rawAdmin = [`To: kiaora@reservetmk.co.nz`, `Subject: ${subjectAdmin}`, `MIME-Version: 1.0`, `Content-Type: text/html; charset="UTF-8"`, ``, htmlAdmin].join("\r\n");
          const encodedAdmin = Buffer.from(rawAdmin).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
          await gmail.users.messages.send({ userId: "me", requestBody: { raw: encodedAdmin } });
        } catch (adminEmailErr: any) {
          console.error("[Email] Admin alert for auto-confirm failed:", adminEmailErr.message);
        }

        // Google Calendar invite for auto-confirmed booking
        try {
          const { getUncachableGoogleCalendarClient } = await import("./replit_integrations/google-calendar/client");
          const calendar = await getUncachableGoogleCalendarClient(booker.userId);

          const allVenuesForCal = await storage.getVenues(booker.userId);
          const venueNamesForCal = resolvedVenueIds.map(vid => allVenuesForCal.find(v => v.id === vid)?.name).filter(Boolean).join(" + ");

          const calBookingDate = startDate ? new Date(startDate + "T00:00") : new Date();
          const calDateStr = calBookingDate.toISOString().slice(0, 10);
          const startDateTime = new Date(`${calDateStr}T${startTime || "09:00"}:00`);
          const endDateTime = new Date(`${calDateStr}T${endTime || "17:00"}:00`);

          const calDescParts = [
            classification ? `Type: ${classification}` : null,
            bookerName ? `Booker: ${bookerName}` : null,
            booker.organizationName ? `Organisation: ${booker.organizationName}` : null,
            bookingSummary ? `Details: ${String(bookingSummary).trim()}` : null,
            isOverAllowance ? "⚠️ Over allowance — 20% community discount applied" : null,
          ].filter(Boolean).join("\n");

          const calAttendees: { email: string }[] = [];
          const bookerNotificationsEmail = (booker as any).notificationsEmail;
          if (bookerNotificationsEmail) {
            calAttendees.push({ email: bookerNotificationsEmail });
          } else if (booker.contactId) {
            const calContact = await storage.getContact(booker.contactId);
            if (calContact?.email) {
              const primaryEmail = calContact.email.split(/[,;]\s*/)[0].trim();
              if (primaryEmail) calAttendees.push({ email: primaryEmail });
            }
          }

          const orgProfile = await storage.getOrganisationProfile(booker.userId);
          const calLocationStr = orgProfile?.location || undefined;

          const calEvent = await calendar.events.insert({
            calendarId: "primary",
            sendUpdates: calAttendees.length > 0 ? "all" : "none",
            requestBody: {
              summary: `Venue Hire: ${venueNamesForCal}${bookerName ? ` — ${bookerName}` : ""}`,
              description: calDescParts || undefined,
              start: { dateTime: startDateTime.toISOString(), timeZone: "Pacific/Auckland" },
              end: { dateTime: endDateTime.toISOString(), timeZone: "Pacific/Auckland" },
              location: calLocationStr,
              attendees: calAttendees.length > 0 ? calAttendees : undefined,
            },
          });

          if (calEvent.data.id) {
            await storage.updateBooking(booking.id, { googleCalendarEventId: calEvent.data.id } as any);
          }
        } catch (calErr: any) {
          console.error("[Calendar] Auto-confirm calendar event creation failed:", booking.id, calErr.message, calErr.response?.data || "");
        }
      } else {
        // Enquiry: send venue enquiry alert to admin
        try {
          const { sendVenueEnquiryAlert } = await import("./email");
          let bookerContactEmail: string | null = null;
          let bookerContactPhone: string | null = null;
          if (booker.contactId) {
            const contact = await storage.getContact(booker.contactId);
            if (contact) {
              bookerContactEmail = contact.email || null;
              bookerContactPhone = contact.phone || null;
            }
          }
          await sendVenueEnquiryAlert({
            userId: booker.userId,
            bookerName: bookerName || booker.name || null,
            bookerEmail: bookerContactEmail,
            bookerPhone: bookerContactPhone,
            title: `${classification} - Portal Booking${titleSuffix}`,
            classification,
            startDate,
            startTime,
            endTime,
            notes: String(bookingSummary).trim() || null,
            venueId: resolvedVenueIds[0],
            venueIds: resolvedVenueIds,
            source: "booker_portal",
          });
        } catch (emailErr) {
          console.error("[Email] Venue enquiry alert failed (booker portal):", emailErr);
        }
      }

      res.json({ ...booking, allowanceWarning, autoConfirmed: bookingStatus === "confirmed" && !!autoConfirmedAt, isOverAllowance });
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

      const isGroupLink = linkResult.link.isGroupLink === true;
      const allBookings = await storage.getBookings(booker.userId);

      let myBookings;
      if (isGroupLink && booker.groupId) {
        myBookings = allBookings.filter(b => b.bookerGroupId === booker.groupId);
      } else if (booker.contactId) {
        // Only show bookings explicitly linked to this contact — no group fallback for individual bookers
        myBookings = allBookings.filter(b => b.bookerId === booker.contactId);
      } else {
        myBookings = [];
      }
      res.json(myBookings);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  app.get("/api/booker/categories/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const linkResult = await storage.getBookerByLinkToken(token);
      if (!linkResult || (linkResult.link.tokenExpiry && new Date(linkResult.link.tokenExpiry) < new Date()) || !linkResult.link.enabled) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      const booker = linkResult.booker;

      let categories: string[] = ["venue_hire"];

      let agreement: any = null;
      if (booker.membershipId) {
        agreement = await storage.getMembership(booker.membershipId);
      } else if (booker.mouId) {
        agreement = await storage.getMou(booker.mouId);
      }

      if (agreement) {
        const agreementCategories = agreement.bookingCategories || [];
        if (agreementCategories.length > 0) {
          categories = agreementCategories;
        }

        const now = new Date();
        const isActive = agreement.status === "active" &&
          (!agreement.startDate || new Date(agreement.startDate) <= now) &&
          (!agreement.endDate || new Date(agreement.endDate) >= now);

        if (!isActive) {
          categories = categories.filter((c: string) => c === "venue_hire");
        }
      }

      res.json({
        categories,
        agreement: agreement ? {
          type: booker.membershipId ? "membership" : "mou",
          status: agreement.status,
          startDate: agreement.startDate,
          endDate: agreement.endDate,
          bookingAllowance: agreement.bookingAllowance,
          allowancePeriod: agreement.allowancePeriod,
        } : null,
      });
    } catch (err: any) {
      console.error("Booker categories error:", err);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.get("/api/booker/desk-availability/:token/:date", async (req, res) => {
    try {
      const { token, date } = req.params;
      const linkResult = await storage.getBookerByLinkToken(token);
      if (!linkResult || (linkResult.link.tokenExpiry && new Date(linkResult.link.tokenExpiry) < new Date()) || !linkResult.link.enabled) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      const booker = linkResult.booker;

      const targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ message: "Invalid date" });
      }

      const resources = await storage.getBookableResourcesByCategory(booker.userId, "hot_desking");
      const activeResources = resources.filter(r => r.active);

      const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const dayName = dayNames[targetDate.getDay()];
      const dayHours = await getDeskHoursForDay(booker.userId, dayName);

      if (!dayHours) {
        const availability = activeResources.map(resource => ({
          resourceId: resource.id,
          resourceName: resource.name,
          description: resource.description,
          slots: [],
          isAvailable: false,
          closedToday: true,
          availableWindow: null,
        }));
        return res.json({ date, availability });
      }

      const dayStart = new Date(targetDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(targetDate);
      dayEnd.setHours(23, 59, 59, 999);
      const allDeskBookings = await storage.getDeskBookingsByDateRange(booker.userId, dayStart, dayEnd);

      const availability = activeResources.map(resource => {
        const resourceBookings = allDeskBookings.filter(b => b.resourceId === resource.id && b.status === "booked");
        return {
          resourceId: resource.id,
          resourceName: resource.name,
          description: resource.description,
          slots: resourceBookings.map(b => ({
            startTime: b.startTime,
            endTime: b.endTime,
            isYours: b.regularBookerId === booker.id,
          })),
          isAvailable: resourceBookings.length === 0,
          closedToday: false,
          availableWindow: { startTime: dayHours.startTime, endTime: dayHours.endTime },
        };
      });

      res.json({ date, availability });
    } catch (err: any) {
      console.error("Booker desk availability error:", err);
      res.status(500).json({ message: "Failed to fetch desk availability" });
    }
  });

  app.get("/api/booker/gear-availability/:token/:date", async (req, res) => {
    try {
      const { token, date } = req.params;
      const linkResult = await storage.getBookerByLinkToken(token);
      if (!linkResult || (linkResult.link.tokenExpiry && new Date(linkResult.link.tokenExpiry) < new Date()) || !linkResult.link.enabled) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      const booker = linkResult.booker;

      const targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ message: "Invalid date" });
      }

      const resources = await storage.getBookableResourcesByCategory(booker.userId, "gear");
      const activeResources = resources.filter(r => r.active && r.tier !== "not_for_loan" && r.tier !== "staff_only");

      const allGearBookings = await storage.getGearBookingsByDate(booker.userId, targetDate);

      const availability = activeResources.map(resource => {
        const resourceBookings = allGearBookings.filter(b => b.resourceId === resource.id && b.status === "booked");
        return {
          resourceId: resource.id,
          resourceName: resource.name,
          description: resource.description,
          requiresApproval: resource.requiresApproval,
          tier: resource.tier,
          isAvailable: resourceBookings.length === 0,
          isYours: resourceBookings.some(b => b.regularBookerId === booker.id),
        };
      });

      res.json({ date, availability });
    } catch (err: any) {
      console.error("Booker gear availability error:", err);
      res.status(500).json({ message: "Failed to fetch gear availability" });
    }
  });

  app.post("/api/booker/desk-bookings/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const linkResult = await storage.getBookerByLinkToken(token);
      if (!linkResult || (linkResult.link.tokenExpiry && new Date(linkResult.link.tokenExpiry) < new Date()) || !linkResult.link.enabled) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      const booker = linkResult.booker;

      let agreement: any = null;
      if (booker.membershipId) agreement = await storage.getMembership(booker.membershipId);
      else if (booker.mouId) agreement = await storage.getMou(booker.mouId);

      const categories = agreement?.bookingCategories || [];
      if (!categories.includes("hot_desking")) {
        return res.status(403).json({ message: "Hot desking access not enabled on your agreement" });
      }

      const now = new Date();
      if (agreement) {
        const isActive = agreement.status === "active" &&
          (!agreement.startDate || new Date(agreement.startDate) <= now) &&
          (!agreement.endDate || new Date(agreement.endDate) >= now);
        if (!isActive) {
          return res.status(403).json({ message: "Your agreement is not currently active" });
        }
      }

      const { resourceId, date, startTime, endTime } = req.body;
      if (!resourceId || !date || !startTime || !endTime) {
        return res.status(400).json({ message: "resourceId, date, startTime, and endTime are required" });
      }

      const resource = await storage.getBookableResource(resourceId);
      if (!resource || resource.category !== "hot_desking" || !resource.active) {
        return res.status(400).json({ message: "Invalid desk resource" });
      }

      const bookingDate = new Date(date);

      const deskWindowError = await validateDeskBookingWindow(booker.userId, bookingDate, startTime, endTime);
      if (deskWindowError) {
        return res.status(400).json({ message: deskWindowError });
      }

      const dayStart = new Date(bookingDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(bookingDate);
      dayEnd.setHours(23, 59, 59, 999);

      const existingBookings = await storage.getDeskBookingsByDateRange(booker.userId, dayStart, dayEnd);
      const conflicts = existingBookings.filter(b => {
        if (b.resourceId !== resourceId || b.status === "cancelled") return false;
        return timesOverlap(startTime, endTime, b.startTime, b.endTime);
      });

      if (conflicts.length > 0) {
        return res.status(409).json({ message: "Time slot conflicts with existing desk booking" });
      }

      const deskBooking = await storage.createDeskBookingWithConflictCheck({
        userId: booker.userId,
        resourceId,
        regularBookerId: booker.id,
        date: bookingDate,
        startTime,
        endTime,
        status: "booked",
      });

      if (booker.contactId) await autoPromoteToInnovator(booker.contactId);
      res.json(deskBooking);
    } catch (err: any) {
      if (err.message === "CONFLICT") {
        return res.status(409).json({ message: "Time slot conflicts with existing desk booking" });
      }
      console.error("Booker desk booking error:", err);
      res.status(500).json({ message: err.message || "Failed to create desk booking" });
    }
  });

  app.post("/api/booker/gear-bookings/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const linkResult = await storage.getBookerByLinkToken(token);
      if (!linkResult || (linkResult.link.tokenExpiry && new Date(linkResult.link.tokenExpiry) < new Date()) || !linkResult.link.enabled) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      const booker = linkResult.booker;

      let agreement: any = null;
      if (booker.membershipId) agreement = await storage.getMembership(booker.membershipId);
      else if (booker.mouId) agreement = await storage.getMou(booker.mouId);

      const categories = agreement?.bookingCategories || [];
      if (!categories.includes("gear")) {
        return res.status(403).json({ message: "Gear booking access not enabled on your agreement" });
      }

      const now = new Date();
      if (agreement) {
        const isActive = agreement.status === "active" &&
          (!agreement.startDate || new Date(agreement.startDate) <= now) &&
          (!agreement.endDate || new Date(agreement.endDate) >= now);
        if (!isActive) {
          return res.status(403).json({ message: "Your agreement is not currently active" });
        }
      }

      const { resourceId, date } = req.body;
      if (!resourceId || !date) {
        return res.status(400).json({ message: "resourceId and date are required" });
      }

      const resource = await storage.getBookableResource(resourceId);
      if (!resource || resource.category !== "gear" || !resource.active) {
        return res.status(400).json({ message: "Invalid gear resource" });
      }

      const bookingDate = new Date(date);
      const existingBookings = await storage.getGearBookingsByDate(booker.userId, bookingDate);
      const alreadyBooked = existingBookings.some(b => b.resourceId === resourceId && b.status === "booked");
      if (alreadyBooked) {
        return res.status(409).json({ message: "This gear item is already booked for this date" });
      }

      const gearBooking = await storage.createGearBookingWithConflictCheck({
        userId: booker.userId,
        resourceId,
        regularBookerId: booker.id,
        date: bookingDate,
        status: "booked",
        approved: !resource.requiresApproval,
      });

      if (booker.contactId) await autoPromoteToInnovator(booker.contactId);
      res.json({
        ...gearBooking,
        requiresApproval: resource.requiresApproval,
        approvalPending: resource.requiresApproval && !gearBooking.approved,
      });
    } catch (err: any) {
      if (err.message === "CONFLICT") {
        return res.status(409).json({ message: "This gear item is already booked for this date" });
      }
      console.error("Booker gear booking error:", err);
      res.status(500).json({ message: err.message || "Failed to create gear booking" });
    }
  });

  app.get("/api/booker/all-bookings/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const linkResult = await storage.getBookerByLinkToken(token);
      if (!linkResult || (linkResult.link.tokenExpiry && new Date(linkResult.link.tokenExpiry) < new Date()) || !linkResult.link.enabled) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      const booker = linkResult.booker;

      const isGroupLink = linkResult.link.isGroupLink === true;

      const allVenueBookings = await storage.getBookings(booker.userId);
      let venueBookings;
      if (isGroupLink && booker.groupId) {
        venueBookings = allVenueBookings.filter(b => b.bookerGroupId === booker.groupId);
      } else if (booker.contactId) {
        // Only show bookings explicitly linked to this contact — no group fallback
        venueBookings = allVenueBookings.filter(b => b.bookerId === booker.contactId);
      } else {
        venueBookings = [];
      }

      const deskBookingsList = await storage.getDeskBookingsByBooker(booker.id);
      const gearBookingsList = await storage.getGearBookingsByBooker(booker.id);

      const allResources = await storage.getBookableResources(booker.userId);
      const resourceMap = new Map(allResources.map(r => [r.id, r]));

      const allChangeRequests = await Promise.all(
        venueBookings.map(async (b) => {
          const requests = await storage.getBookingChangeRequestsByBooking(b.id);
          return { bookingId: b.id, requests };
        })
      );
      const changeRequestMap = new Map(allChangeRequests.map(cr => [cr.bookingId, cr.requests]));

      const allVenues = await storage.getVenues(booker.userId);
      const venueMap = new Map(allVenues.map(v => [v.id, v]));

      res.json({
        venue: venueBookings.map(b => ({
          ...b,
          bookingType: "venue_hire",
          changeRequests: changeRequestMap.get(b.id) || [],
          venueNames: (b.venueIds || (b.venueId ? [b.venueId] : [])).map((id: number) => venueMap.get(id)?.name).filter(Boolean),
        })),
        desk: deskBookingsList.map(b => ({
          ...b,
          bookingType: "hot_desking",
          resourceName: resourceMap.get(b.resourceId)?.name || "Unknown Desk",
        })),
        gear: gearBookingsList.map(b => ({
          ...b,
          bookingType: "gear",
          resourceName: resourceMap.get(b.resourceId)?.name || "Unknown Gear",
          requiresApproval: resourceMap.get(b.resourceId)?.requiresApproval || false,
        })),
      });
    } catch (err: any) {
      console.error("Booker all bookings error:", err);
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  app.delete("/api/booker/desk-bookings/:token/:id", async (req, res) => {
    try {
      const { token, id } = req.params;
      const linkResult = await storage.getBookerByLinkToken(token);
      if (!linkResult || (linkResult.link.tokenExpiry && new Date(linkResult.link.tokenExpiry) < new Date()) || !linkResult.link.enabled) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      const booker = linkResult.booker;

      const bookingId = parseInt(id);
      const booking = await storage.getDeskBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Desk booking not found" });
      }
      if (booking.regularBookerId !== booker.id) {
        return res.status(403).json({ message: "You can only cancel your own bookings" });
      }

      await storage.updateDeskBooking(bookingId, { status: "cancelled" });
      res.json({ success: true, message: "Desk booking cancelled" });
    } catch (err: any) {
      console.error("Booker desk cancel error:", err);
      res.status(500).json({ message: "Failed to cancel desk booking" });
    }
  });

  app.delete("/api/booker/gear-bookings/:token/:id", async (req, res) => {
    try {
      const { token, id } = req.params;
      const linkResult = await storage.getBookerByLinkToken(token);
      if (!linkResult || (linkResult.link.tokenExpiry && new Date(linkResult.link.tokenExpiry) < new Date()) || !linkResult.link.enabled) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      const booker = linkResult.booker;

      const bookingId = parseInt(id);
      const booking = await storage.getGearBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Gear booking not found" });
      }
      if (booking.regularBookerId !== booker.id) {
        return res.status(403).json({ message: "You can only cancel your own bookings" });
      }
      if (booking.status === "returned") {
        return res.status(400).json({ message: "Cannot cancel a returned gear booking" });
      }

      await storage.updateGearBooking(bookingId, { status: "cancelled" as any });
      res.json({ success: true, message: "Gear booking cancelled" });
    } catch (err: any) {
      console.error("Booker gear cancel error:", err);
      res.status(500).json({ message: "Failed to cancel gear booking" });
    }
  });

  app.delete("/api/booker/bookings/:token/:id", async (req, res) => {
    try {
      const { token, id } = req.params;
      const linkResult = await storage.getBookerByLinkToken(token);
      if (!linkResult || (linkResult.link.tokenExpiry && new Date(linkResult.link.tokenExpiry) < new Date()) || !linkResult.link.enabled) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      const booker = linkResult.booker;
      const isGroupLink = linkResult.link.isGroupLink === true;

      const bookingId = parseInt(id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const isOwner = isGroupLink
        ? (booker.groupId ? booking.bookerGroupId === booker.groupId : booking.bookerId === booker.contactId)
        : booking.bookerId === booker.contactId;
      if (!isOwner) {
        return res.status(403).json({ message: "You can only cancel your own bookings" });
      }

      if (booking.status === "cancelled" || booking.status === "completed") {
        return res.status(400).json({ message: `Cannot cancel a ${booking.status} booking` });
      }

      const now = new Date();
      if (booking.startDate && new Date(booking.startDate) < now) {
        return res.status(400).json({ message: "Cannot cancel a past booking" });
      }

      await storage.updateBooking(bookingId, { status: "cancelled", paymentStatus: "not_required" });
      res.json({ success: true, message: "Venue hire booking cancelled" });
    } catch (err: any) {
      console.error("Booker venue cancel error:", err);
      res.status(500).json({ message: "Failed to cancel booking" });
    }
  });

  app.get("/api/booker/check-change-availability/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const linkResult = await storage.getBookerByLinkToken(token);
      if (!linkResult || (linkResult.link.tokenExpiry && new Date(linkResult.link.tokenExpiry) < new Date()) || !linkResult.link.enabled) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      const booker = linkResult.booker;
      const { date, startTime, endTime, venueIds: venueIdsStr, excludeBookingId } = req.query;

      if (!date || !startTime || !endTime || !venueIdsStr) {
        return res.json({ available: true, conflicts: [] });
      }

      const venueIds = String(venueIdsStr).split(",").map(Number).filter(n => !isNaN(n));

      for (const vid of venueIds) {
        const v = await storage.getVenue(vid);
        if (!v || v.userId !== booker.userId) {
          return res.status(400).json({ message: "Invalid venue selection" });
        }
      }

      const excludeId = excludeBookingId ? parseInt(String(excludeBookingId)) : 0;
      const reqDate = new Date(String(date)).toISOString().split("T")[0];
      const conflicts: string[] = [];

      const allBookings = await storage.getBookings(booker.userId);
      for (const b of allBookings) {
        if (b.id === excludeId || b.status === "cancelled") continue;
        if (!b.startDate) continue;
        const bIds = b.venueIds || (b.venueId ? [b.venueId] : []);
        if (!venueIds.some(vid => bIds.includes(vid))) continue;
        const bDate = new Date(b.startDate).toISOString().split("T")[0];
        if (bDate !== reqDate) continue;
        if (timesOverlap(String(startTime), String(endTime), b.startTime, b.endTime)) {
          conflicts.push(`Existing booking (${b.startTime} - ${b.endTime})`);
        }
      }

      const allMeetings = await storage.getMeetings(booker.userId);
      for (const m of allMeetings) {
        if (m.status === "cancelled") continue;
        if (!m.venueId || !venueIds.includes(m.venueId)) continue;
        const mStartDate = m.startTime ? new Date(m.startTime).toISOString().slice(0, 10) : null;
        const mStartTimeStr = m.startTime ? new Date(m.startTime).toTimeString().slice(0, 5) : null;
        const mEndTimeStr = m.endTime ? new Date(m.endTime).toTimeString().slice(0, 5) : null;
        if (!mStartDate || mStartDate !== reqDate) continue;
        if (timesOverlap(String(startTime), String(endTime), mStartTimeStr, mEndTimeStr)) {
          conflicts.push(`Existing event (${mStartTimeStr} - ${mEndTimeStr})`);
        }
      }

      res.json({ available: conflicts.length === 0, conflicts });
    } catch (err: any) {
      console.error("Check change availability error:", err);
      res.status(500).json({ message: "Failed to check availability" });
    }
  });

  app.post("/api/booker/bookings/:token/:id/change-request", async (req, res) => {
    try {
      const { token, id } = req.params;
      const linkResult = await storage.getBookerByLinkToken(token);
      if (!linkResult || (linkResult.link.tokenExpiry && new Date(linkResult.link.tokenExpiry) < new Date()) || !linkResult.link.enabled) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      const booker = linkResult.booker;
      const isGroupLink = linkResult.link.isGroupLink === true;

      const bookingId = parseInt(id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const isOwner = isGroupLink
        ? (booker.groupId ? booking.bookerGroupId === booker.groupId : booking.bookerId === booker.contactId)
        : booking.bookerId === booker.contactId;
      if (!isOwner) {
        return res.status(403).json({ message: "You can only request changes for your own bookings" });
      }

      if (booking.status === "cancelled" || booking.status === "completed") {
        return res.status(400).json({ message: `Cannot request changes for a ${booking.status} booking` });
      }

      const now = new Date();
      if (booking.startDate && new Date(booking.startDate) < now) {
        return res.status(400).json({ message: "Cannot request changes for a past booking" });
      }

      const existingPending = await storage.getBookingChangeRequestsByBooking(bookingId);
      if (existingPending.some(r => r.status === "pending")) {
        return res.status(400).json({ message: "There is already a pending change request for this booking" });
      }

      const { requestedDate, requestedStartTime, requestedEndTime, requestedVenueIds, reason } = req.body;

      if (!requestedDate && !requestedStartTime && !requestedEndTime && (!requestedVenueIds || requestedVenueIds.length === 0)) {
        return res.status(400).json({ message: "Please specify at least a new date, time, or venue" });
      }

      const effectiveDate = requestedDate || (booking.startDate ? new Date(booking.startDate).toISOString().split("T")[0] : null);
      const effectiveStartTime = requestedStartTime || booking.startTime;
      const effectiveEndTime = requestedEndTime || booking.endTime;
      const effectiveVenueIds = (requestedVenueIds && requestedVenueIds.length > 0)
        ? requestedVenueIds
        : (booking.venueIds || (booking.venueId ? [booking.venueId] : []));

      if (effectiveVenueIds.length > 0) {
        for (const vid of effectiveVenueIds) {
          const v = await storage.getVenue(vid);
          if (!v || v.userId !== booker.userId) {
            return res.status(400).json({ message: "Invalid venue selection" });
          }
        }

        let portalAllowedLocations: string[] | null = null;
        if (booker.membershipId) {
          const membership = await storage.getMembership(booker.membershipId);
          if (membership && membership.allowedLocations && membership.allowedLocations.length > 0) {
            portalAllowedLocations = membership.allowedLocations;
          }
        } else if (booker.mouId) {
          const mouRecord = await storage.getMou(booker.mouId);
          if (mouRecord && mouRecord.allowedLocations && mouRecord.allowedLocations.length > 0) {
            portalAllowedLocations = mouRecord.allowedLocations;
          }
        }
        if (portalAllowedLocations) {
          for (const vid of effectiveVenueIds) {
            const v = await storage.getVenue(vid);
            if (v) {
              const vLoc = v.spaceName || "Other";
              if (!portalAllowedLocations.includes(vLoc)) {
                return res.status(400).json({
                  message: `Venue "${v.name}" is not in an allowed location for your agreement`,
                });
              }
            }
          }
        }
      }

      if (effectiveDate && effectiveStartTime && effectiveEndTime && effectiveVenueIds.length > 0) {
        const allBookings = await storage.getBookings(booker.userId);
        const reqDate = new Date(effectiveDate).toISOString().split("T")[0];
        const conflicting = allBookings.filter(b => {
          if (b.id === bookingId) return false;
          const bIds = b.venueIds || (b.venueId ? [b.venueId] : []);
          const hasOverlappingVenue = effectiveVenueIds.some((vid: number) => bIds.includes(vid));
          if (!hasOverlappingVenue || b.status === "cancelled") return false;
          if (!b.startDate) return false;
          const bDate = new Date(b.startDate).toISOString().split("T")[0];
          if (bDate !== reqDate) return false;
          return timesOverlap(effectiveStartTime, effectiveEndTime, b.startTime, b.endTime);
        });
        if (conflicting.length > 0) {
          return res.status(409).json({
            message: "Requested time slot conflicts with an existing booking",
          });
        }

        const allMeetings = await storage.getMeetings(booker.userId);
        for (const m of allMeetings) {
          if (m.status === "cancelled") continue;
          if (!m.venueId || !effectiveVenueIds.includes(m.venueId)) continue;
          const mStartDate = m.startTime ? new Date(m.startTime).toISOString().slice(0, 10) : null;
          const mStartTimeStr = m.startTime ? new Date(m.startTime).toTimeString().slice(0, 5) : null;
          const mEndTimeStr = m.endTime ? new Date(m.endTime).toTimeString().slice(0, 5) : null;
          if (!mStartDate || mStartDate !== reqDate) continue;
          if (timesOverlap(effectiveStartTime, effectiveEndTime, mStartTimeStr, mEndTimeStr)) {
            return res.status(409).json({
              message: `Requested time slot conflicts with meeting "${m.title}"`,
            });
          }
        }
      }

      const changeRequest = await storage.createBookingChangeRequest({
        bookingId,
        requestedBy: booker.id,
        requestedDate: requestedDate ? new Date(requestedDate) : undefined,
        requestedStartTime: requestedStartTime || undefined,
        requestedEndTime: requestedEndTime || undefined,
        requestedVenueIds: requestedVenueIds || undefined,
        reason: reason || undefined,
        status: "pending",
      });

      res.json({ success: true, changeRequest });
    } catch (err: any) {
      console.error("Booker change request error:", err);
      res.status(500).json({ message: "Failed to submit change request" });
    }
  });

  // PATCH /api/booker/:token/notifications-email — update regular_booker.notifications_email
  app.patch("/api/booker/:token/notifications-email", async (req, res) => {
    try {
      const { token } = req.params;
      const { notificationsEmail } = req.body;
      const linkResult = await storage.getBookerByLinkToken(token);
      if (!linkResult || (linkResult.link.tokenExpiry && new Date(linkResult.link.tokenExpiry) < new Date()) || !linkResult.link.enabled) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      const booker = linkResult.booker;
      const updated = await storage.updateRegularBooker(booker.id, { notificationsEmail: notificationsEmail || null } as any);
      res.json({ success: true, notificationsEmail: (updated as any).notificationsEmail });
    } catch (err: any) {
      console.error("Update notifications email error:", err);
      res.status(500).json({ message: "Failed to update notifications email" });
    }
  });

  // PATCH /api/booker/:token/invoice-email — update booker invoice_email preference
  app.patch("/api/booker/:token/invoice-email", async (req, res) => {
    try {
      const { token } = req.params;
      const { invoiceEmail } = req.body;
      const linkResult = await storage.getBookerByLinkToken(token);
      if (!linkResult || (linkResult.link.tokenExpiry && new Date(linkResult.link.tokenExpiry) < new Date()) || !linkResult.link.enabled) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      const booker = linkResult.booker;
      // Store on booker record as a preference (notificationsEmail field re-used for invoice preference here via a separate update)
      // We update any unpaid bookings for this booker with the new invoice email
      const allBookings = await storage.getBookings(booker.userId);
      const bookerBookings = allBookings.filter(b => b.bookerId === booker.contactId && b.status !== "cancelled");
      for (const b of bookerBookings) {
        await storage.updateBooking(b.id, { invoiceEmail: invoiceEmail || null } as any);
      }
      res.json({ success: true, invoiceEmail: invoiceEmail || null });
    } catch (err: any) {
      console.error("Update invoice email error:", err);
      res.status(500).json({ message: "Failed to update invoice email" });
    }
  });

  app.get("/api/booking-change-requests", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const requests = await storage.getBookingChangeRequests(userId);
      res.json(requests);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch change requests" });
    }
  });

  app.get("/api/bookings/:id/change-requests", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const bookingId = parseId(req.params.id);
      const booking = await storage.getBooking(bookingId);
      if (!booking || booking.userId !== userId) {
        return res.status(404).json({ message: "Booking not found" });
      }
      const requests = await storage.getBookingChangeRequestsByBooking(bookingId);
      res.json(requests);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch change requests" });
    }
  });

  app.post("/api/booking-change-requests/:id/approve", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const requestId = parseId(req.params.id);
      const request = await storage.getBookingChangeRequest(requestId);
      if (!request) return res.status(404).json({ message: "Change request not found" });

      const booking = await storage.getBooking(request.bookingId);
      if (!booking || booking.userId !== userId) {
        return res.status(404).json({ message: "Booking not found" });
      }
      if (request.status !== "pending") return res.status(400).json({ message: "Change request is not pending" });

      const updates: Record<string, any> = {};
      if (request.requestedDate) updates.startDate = request.requestedDate;
      if (request.requestedStartTime) updates.startTime = request.requestedStartTime;
      if (request.requestedEndTime) updates.endTime = request.requestedEndTime;
      if (request.requestedVenueIds && request.requestedVenueIds.length > 0) {
        updates.venueIds = request.requestedVenueIds;
        updates.venueId = request.requestedVenueIds[0];
      }

      if (Object.keys(updates).length > 0) {
        await storage.updateBooking(request.bookingId, updates);
      }

      const { adminNotes } = req.body;
      await storage.updateBookingChangeRequest(requestId, {
        status: "approved",
        adminNotes: adminNotes || undefined,
        resolvedAt: new Date(),
      });

      // Send email notification to booker
      try {
        const booker = await storage.getRegularBooker(request.requestedBy);
        if (booker?.email) {
          const venues = await storage.getVenues(userId);
          const venueId = booking.venueIds?.[0] || booking.venueId;
          const venueName = venues.find(v => v.id === venueId)?.name || "your venue";
          const { sendChangeRequestStatusEmail } = await import("./email");
          await sendChangeRequestStatusEmail(booker.email, booker.name || "there", "approved", booking.startDate?.toString() || "", venueName, adminNotes);
        }
      } catch (emailErr) {
        console.warn("Failed to send change request approval email:", emailErr);
      }

      res.json({ success: true, message: "Change request approved and booking updated" });
    } catch (err: any) {
      console.error("Approve change request error:", err);
      res.status(500).json({ message: "Failed to approve change request" });
    }
  });

  app.post("/api/booking-change-requests/:id/decline", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const requestId = parseId(req.params.id);
      const request = await storage.getBookingChangeRequest(requestId);
      if (!request) return res.status(404).json({ message: "Change request not found" });

      const booking = await storage.getBooking(request.bookingId);
      if (!booking || booking.userId !== userId) {
        return res.status(404).json({ message: "Booking not found" });
      }
      if (request.status !== "pending") return res.status(400).json({ message: "Change request is not pending" });

      const { adminNotes } = req.body;
      await storage.updateBookingChangeRequest(requestId, {
        status: "declined",
        adminNotes: adminNotes || undefined,
        resolvedAt: new Date(),
      });

      // Send email notification to booker
      try {
        const booker = await storage.getRegularBooker(request.requestedBy);
        if (booker?.email) {
          const venues = await storage.getVenues(userId);
          const venueId = booking.venueIds?.[0] || booking.venueId;
          const venueName = venues.find(v => v.id === venueId)?.name || "your venue";
          const { sendChangeRequestStatusEmail } = await import("./email");
          await sendChangeRequestStatusEmail(booker.email, booker.name || "there", "declined", booking.startDate?.toString() || "", venueName, adminNotes);
        }
      } catch (emailErr) {
        console.warn("Failed to send change request decline email:", emailErr);
      }

      res.json({ success: true, message: "Change request declined" });
    } catch (err: any) {
      console.error("Decline change request error:", err);
      res.status(500).json({ message: "Failed to decline change request" });
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
      const settings = await storage.getBookingReminderSettings(userId);
      res.json(settings ? { autoSendEnabled: settings.enabled, sendTimingHours: settings.sendTimingHours } : { autoSendEnabled: true, sendTimingHours: 4 });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch after-hours settings" });
    }
  });

  app.put("/api/after-hours-settings", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { autoSendEnabled, sendTimingHours } = req.body;
      const result = await storage.upsertBookingReminderSettings(userId, { enabled: autoSendEnabled, sendTimingHours });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update after-hours settings" });
    }
  });

  app.get("/api/booking-reminder-settings", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const settings = await storage.getBookingReminderSettings(userId);
      res.json(settings || { enabled: true, sendTimingHours: 4 });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch booking reminder settings" });
    }
  });

  app.put("/api/booking-reminder-settings", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { enabled, sendTimingHours } = req.body;
      const result = await storage.upsertBookingReminderSettings(userId, { enabled, sendTimingHours });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update booking reminder settings" });
    }
  });

  app.get("/api/bookings/:id/instructions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const bookingId = parseId(req.params.id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const locationAccess = booking.locationAccess as string[] | null;
      if (locationAccess && locationAccess.length > 0) {
        const allInstructions = [];
        for (const spaceName of locationAccess) {
          const spaceInstructions = await storage.getVenueInstructionsBySpaceName(userId, spaceName);
          allInstructions.push(...spaceInstructions);
        }
        return res.json(allInstructions);
      }

      const venues = await storage.getVenues(userId);
      const bookingVenueIds = booking.venueIds || (booking.venueId ? [booking.venueId] : []);
      const bookingVenues = venues.filter(v => bookingVenueIds.includes(v.id));
      const spaceNames = [...new Set(bookingVenues.map(v => v.spaceName).filter(Boolean))];
      if (spaceNames.length > 0) {
        const allInstructions = [];
        for (const spaceName of spaceNames) {
          const spaceInstructions = await storage.getVenueInstructionsBySpaceName(userId, spaceName as string);
          allInstructions.push(...spaceInstructions);
        }
        return res.json(allInstructions);
      }

      const instructions = await storage.getVenueInstructions(userId);
      res.json(instructions);
    } catch (err: any) {
      console.error("Failed to get booking instructions:", err);
      res.status(500).json({ message: err.message || "Failed to get booking instructions" });
    }
  });

  app.post("/api/bookings/:id/send-instructions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const bookingId = parseId(req.params.id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const { sendBookingReminderEmail } = await import("./email");
      await sendBookingReminderEmail(booking, userId);

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
      const { xeroClientId, xeroClientSecret, accountCode, taxType } = req.body;
      if (!xeroClientId || !xeroClientSecret) {
        return res.status(400).json({ message: "Client ID and Client Secret are required" });
      }
      const updateData: any = { xeroClientId, xeroClientSecret };
      if (accountCode !== undefined) {
        const trimmed = String(accountCode).trim();
        updateData.accountCode = trimmed || "200";
      }
      if (taxType !== undefined) {
        const trimmed = String(taxType).trim();
        updateData.taxType = trimmed || "OUTPUT2";
      }
      await storage.upsertXeroSettings(userId, updateData);
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
      res.redirect("/settings/xero?xero=connected");
    } catch (err: any) {
      console.error("Xero callback error:", err);
      res.redirect("/settings/xero?xero=error&message=" + encodeURIComponent(err.message));
    }
  });

  app.get("/api/xero/status", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const settings = await storage.getXeroSettings(userId);
      if (!settings) {
        return res.json({ connected: false, hasCredentials: false, accountCode: "200", taxType: "OUTPUT2" });
      }
      res.json({
        connected: settings.connected || false,
        hasCredentials: !!(settings.xeroClientId && settings.xeroClientSecret),
        organisationName: settings.organisationName || null,
        connectedAt: settings.connectedAt || null,
        tokenExpiresAt: settings.tokenExpiresAt || null,
        accountCode: settings.accountCode || "200",
        taxType: settings.taxType || "OUTPUT2",
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/xero/update-account-settings", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { accountCode, taxType } = req.body;
      const updateData: any = {};
      if (accountCode !== undefined) {
        const trimmed = String(accountCode).trim();
        updateData.accountCode = trimmed || "200";
      }
      if (taxType !== undefined) {
        const trimmed = String(taxType).trim();
        updateData.taxType = trimmed || "OUTPUT2";
      }
      await storage.upsertXeroSettings(userId, updateData);
      res.json({ success: true });
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
      const contactId = parseId(req.params.contactId);
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
      const bookingId = parseId(req.params.id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (booking.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const { generateXeroInvoice } = await import("./xero");
      const result = await generateXeroInvoice(userId, bookingId);
      await storage.updateBooking(bookingId, { invoiceRequested: true } as any);
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

  async function runBookingReminderAutoSend() {
    try {
      const allBookings = await db.select().from(bookings).where(
        and(
          eq(bookings.status, "confirmed"),
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

        const reminderSettings = await storage.getBookingReminderSettings(booking.userId);
        if (reminderSettings && !reminderSettings.enabled) continue;

        const sendHoursBefore = reminderSettings?.sendTimingHours || 4;
        const bookingStartTime = booking.startTime || "09:00";
        const [bh, bm] = bookingStartTime.split(":").map(Number);
        const bookingDateTime = new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate(), bh, bm);

        const sendAt = new Date(bookingDateTime.getTime() - sendHoursBefore * 60 * 60 * 1000);
        const eightAm = new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate(), 8, 0);
        const effectiveSendAt = sendAt > eightAm ? sendAt : eightAm;

        if (nzNow >= effectiveSendAt) {
          try {
            const { sendBookingReminderEmail } = await import("./email");
            await sendBookingReminderEmail(booking, booking.userId);
            await storage.updateBooking(booking.id, {
              autoInstructionsSent: true,
              autoInstructionsSentAt: new Date(),
            } as any);
            console.log(`Booking reminder sent for booking ${booking.id}`);
          } catch (emailErr) {
            console.error(`Failed to send booking reminder for booking ${booking.id}:`, emailErr);
          }
        }
      }
    } catch (err) {
      console.error("Booking reminder auto-send error:", err);
    }
  }

  setInterval(runBookingReminderAutoSend, 30 * 60 * 1000);
  // === Bookable Resources API ===

  app.get("/api/bookable-resources", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const category = parseStr(req.query.category) || undefined;
      if (category) {
        const resources = await storage.getBookableResourcesByCategory(userId, category);
        return res.json(resources);
      }
      const resources = await storage.getBookableResources(userId);
      res.json(resources);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/bookable-resources", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const data = insertBookableResourceSchema.parse({ ...req.body, userId });
      const resource = await storage.createBookableResource(data);
      res.status(201).json(resource);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/bookable-resources/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const existing = await storage.getBookableResource(id);
      if (!existing) return res.status(404).json({ message: "Resource not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const resource = await storage.updateBookableResource(id, req.body);

      let futureBookingsWarning: string | null = null;
      if (req.body.active === false && existing.active) {
        const now = new Date();
        if (existing.category === "hot_desking") {
          const deskBookingsList = await storage.getDeskBookingsByResource(id);
          const futureBookings = deskBookingsList.filter(b => b.status !== "cancelled" && new Date(b.date) >= now);
          if (futureBookings.length > 0) {
            futureBookingsWarning = `Warning: This resource has ${futureBookings.length} future desk booking(s) that may be affected.`;
          }
        } else if (existing.category === "gear") {
          const gearBookingsList = await storage.getGearBookingsByResource(id);
          const futureBookings = gearBookingsList.filter(b => b.status !== "cancelled" && b.status !== "returned" && new Date(b.date) >= now);
          if (futureBookings.length > 0) {
            futureBookingsWarning = `Warning: This resource has ${futureBookings.length} future gear booking(s) that may be affected.`;
          }
        }
      }

      res.json({ ...resource, futureBookingsWarning });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/bookable-resources/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const existing = await storage.getBookableResource(id);
      if (!existing) return res.status(404).json({ message: "Resource not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteBookableResource(id);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/bookable-resources/bulk-tier", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { ids, tier } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids required" });
      let updated = 0;
      for (const id of ids) {
        const existing = await storage.getBookableResource(id);
        if (!existing || existing.userId !== userId) continue;
        await storage.updateBookableResource(id, { tier: tier || null });
        updated++;
      }
      res.json({ updated });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === Desk Bookings API ===

  app.get("/api/desk-bookings", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { startDate, endDate, resourceId } = req.query;
      if (startDate && endDate) {
        const bookingsResult = await storage.getDeskBookingsByDateRange(userId, new Date(startDate as string), new Date(endDate as string));
        if (resourceId) {
          return res.json(bookingsResult.filter(b => b.resourceId === parseInt(resourceId as string)));
        }
        return res.json(bookingsResult);
      }
      if (resourceId) {
        const bookingsResult = await storage.getDeskBookingsByResource(parseInt(resourceId as string));
        return res.json(bookingsResult.filter(b => b.userId === userId));
      }
      const allBookings = await storage.getDeskBookings(userId);
      res.json(allBookings);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/desk-bookings", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const body = { ...req.body, userId };
      if (body.date && typeof body.date === "string") body.date = new Date(body.date);

      if (!body.date || !body.startTime || !body.endTime) {
        return res.status(400).json({ message: "date, startTime, and endTime are required" });
      }

      const deskWindowError = await validateDeskBookingWindow(
        userId,
        new Date(body.date),
        body.startTime,
        body.endTime
      );
      if (deskWindowError) {
        return res.status(400).json({ message: deskWindowError });
      }

      if (body.isRecurring && body.recurringPattern) {
        const pattern = body.recurringPattern as { dayOfWeek: number; frequency: string; endDate: string };
        const recurringGroupId = crypto.randomUUID();
        const createdBookings = [];
        const startDate = new Date(body.date);
        const endDate = new Date(pattern.endDate);
        const current = new Date(startDate);

        while (current <= endDate) {
          if (current.getDay() === pattern.dayOfWeek || !pattern.dayOfWeek) {
            const bookingData = insertDeskBookingSchema.parse({
              ...body,
              date: new Date(current),
              isRecurring: true,
              recurringPattern: pattern,
              recurringGroupId,
            });
            const created = await storage.createDeskBookingWithConflictCheck(bookingData);
            createdBookings.push(created);
          }
          const increment = pattern.frequency === "fortnightly" ? 14 : 7;
          current.setDate(current.getDate() + increment);
        }
        return res.status(201).json(createdBookings);
      }

      const data = insertDeskBookingSchema.parse(body);
      const booking = await storage.createDeskBookingWithConflictCheck(data);
      const deskBooker = await storage.getRegularBooker(data.regularBookerId);
      if (deskBooker?.contactId) await autoPromoteToInnovator(deskBooker.contactId);
      res.status(201).json(booking);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      if (err.message === "CONFLICT") {
        return res.status(409).json({ message: "Time slot conflicts with existing desk booking" });
      }
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/desk-bookings/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const existing = await storage.getDeskBooking(id);
      if (!existing) return res.status(404).json({ message: "Desk booking not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const updated = await storage.updateDeskBooking(id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/desk-bookings/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const existing = await storage.getDeskBooking(id);
      if (!existing) return res.status(404).json({ message: "Desk booking not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteDeskBooking(id);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === Gear Bookings API ===

  app.get("/api/gear-bookings", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { date, resourceId } = req.query;
      let bookings: any[];
      if (date) {
        bookings = await storage.getGearBookingsByDate(userId, new Date(date as string));
        if (resourceId) {
          bookings = bookings.filter(b => b.resourceId === parseInt(resourceId as string));
        }
      } else if (resourceId) {
        bookings = await storage.getGearBookingsByResource(parseInt(resourceId as string));
        bookings = bookings.filter(b => b.userId === userId);
      } else {
        bookings = await storage.getGearBookings(userId);
      }

      const allUserBookers = await storage.getRegularBookers(userId);
      const userBookerMap = new Map(allUserBookers.map(b => [b.id, b]));
      const bookerMap: Record<number, { name: string; organization: string | null }> = {};
      const bookerIds = [...new Set(bookings.map(b => b.regularBookerId).filter(Boolean))];
      for (const bid of bookerIds) {
        const booker = userBookerMap.get(bid);
        if (booker) {
          bookerMap[bid] = {
            name: booker.billingEmail,
            organization: booker.organizationName || null,
          };
        }
      }

      const enriched = bookings.map(b => ({
        ...b,
        bookerName: bookerMap[b.regularBookerId]?.name || null,
        bookerOrganization: bookerMap[b.regularBookerId]?.organization || null,
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/gear-bookings", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const body = { ...req.body, userId };
      if (body.date && typeof body.date === "string") body.date = new Date(body.date);

      if (body.selfCheckout) {
        delete body.selfCheckout;
        const userRecord = await storage.auth.getUser(userId);
        const email = userRecord?.email || `staff-${userId}@internal`;
        const allBookers = await storage.getRegularBookers(userId);
        let booker = allBookers.find(b => b.loginEmail === email || b.billingEmail === email);
        if (!booker) {
          booker = await storage.createRegularBooker({
            userId,
            billingEmail: email,
            organizationName: userRecord ? `${userRecord.firstName || ''} ${userRecord.lastName || ''}`.trim() || 'Staff' : 'Staff',
            pricingTier: 'full_price',
            accountStatus: 'active',
          });
        }
        body.regularBookerId = booker.id;
        body.approved = true;
      }

      if (!body.selfCheckout && body.regularBookerId) {
        const booker = await storage.getRegularBooker(body.regularBookerId);
        if (!booker || booker.userId !== userId) {
          return res.status(403).json({ message: "Invalid booker selection" });
        }
      }

      const resource = await storage.getBookableResource(body.resourceId);
      if (!resource) return res.status(404).json({ message: "Resource not found" });

      if (body.approved === undefined) {
        if (resource.requiresApproval) {
          body.approved = false;
        } else {
          body.approved = true;
        }
      }

      const data = insertGearBookingSchema.parse(body);
      const booking = await storage.createGearBookingWithConflictCheck(data);
      const gearBooker = await storage.getRegularBooker(data.regularBookerId);
      if (gearBooker?.contactId) await autoPromoteToInnovator(gearBooker.contactId);
      res.status(201).json(booking);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      if (err.message === "CONFLICT") {
        return res.status(409).json({ message: "This gear item is already booked for this date" });
      }
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/gear-bookings/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const existing = await storage.getGearBooking(id);
      if (!existing) return res.status(404).json({ message: "Gear booking not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      if (req.body.markReturned) {
        const updated = await storage.markGearReturned(id);
        return res.json(updated);
      }

      const updated = await storage.updateGearBooking(id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === Desk Availability API ===

  app.get("/api/desk-availability/:date", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const date = parseDate(req.params.date);

      const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const dayName = dayNames[date.getDay()];
      const dayHours = await getDeskHoursForDay(userId, dayName);

      const desks = await storage.getBookableResourcesByCategory(userId, "hot_desking");

      if (!dayHours) {
        const availability = desks.map(desk => ({
          resourceId: desk.id,
          resourceName: desk.name,
          active: desk.active,
          bookings: [],
          isAvailable: false,
          closedToday: true,
          availableWindow: null,
        }));
        return res.json(availability);
      }

      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const dayBookings = await storage.getDeskBookingsByDateRange(userId, dayStart, dayEnd);

      const availability = desks.map(desk => {
        const deskBookings = dayBookings.filter(b => b.resourceId === desk.id && b.status === "booked");
        return {
          resourceId: desk.id,
          resourceName: desk.name,
          active: desk.active,
          bookings: deskBookings.map(b => ({
            id: b.id,
            startTime: b.startTime,
            endTime: b.endTime,
            status: b.status,
          })),
          isAvailable: deskBookings.length === 0,
          closedToday: false,
          availableWindow: { startTime: dayHours.startTime, endTime: dayHours.endTime },
        };
      });

      res.json(availability);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === Gear Availability API ===

  app.get("/api/gear-availability/:date", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const date = parseDate(req.params.date);

      const gear = await storage.getBookableResourcesByCategory(userId, "gear");
      const dayBookings = await storage.getGearBookingsByDate(userId, date);

      const availability = gear.map(item => {
        const itemBookings = dayBookings.filter(b => b.resourceId === item.id && b.status !== "returned" && b.status !== "cancelled");
        return {
          resourceId: item.id,
          resourceName: item.name,
          requiresApproval: item.requiresApproval,
          active: item.active,
          bookings: itemBookings.map(b => ({
            id: b.id,
            status: b.status,
            approved: b.approved,
          })),
          isAvailable: itemBookings.length === 0,
        };
      });

      res.json(availability);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  setTimeout(runBookingReminderAutoSend, 10000);

  startAutoSync();
  startCalendarAutoSync();

  (async () => {
    try {
      const allBookers = await db.select().from(regularBookers);
      for (const booker of allBookers) {
        const existingLinks = await storage.getBookerLinks(booker.id);

        if (booker.loginToken) {
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

        const hasPortalLink = existingLinks.some(l =>
          l.label === "Portal link" || l.label === "Migrated portal link"
        );
        if (!hasPortalLink) {
          await storage.createBookerLink({
            regularBookerId: booker.id,
            token: crypto.randomUUID(),
            enabled: true,
            label: "Portal link",
          });
        }
      }
    } catch (err) {
      console.error("Booker link migration error:", err);
    }
  })();

  // === GOOGLE CALENDAR OAUTH ===

  app.get("/api/google-calendar/oauth/authorize", isAuthenticated, async (req, res) => {
    const { getGoogleCalendarOAuth2Client } = await import("./replit_integrations/google-calendar/client");
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

    const { getGoogleCalendarOAuth2Client, storeCalendarTokens } = await import("./replit_integrations/google-calendar/client");
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
    const { isCalendarConnected } = await import("./replit_integrations/google-calendar/client");
    const userId = (req.user as any).claims.sub;
    res.json({ connected: await isCalendarConnected(userId) });
  });

  app.get("/api/google-calendar/health", isAuthenticated, async (req, res) => {
    try {
      const { getCalendarHealth } = await import("./replit_integrations/google-calendar/client");
      const userId = (req.user as any).claims.sub;
      const health = await getCalendarHealth(userId);
      res.json(health);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === NARRATIVE REPORT GENERATOR ===

  app.post("/api/reports/generate-narrative", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { startDate, endDate, audience, periodLabel } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate required" });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      // ── Pull data via shared functions ────────────────────────────────────

      const narrativeFilters: ReportFilters = { userId, startDate: startDate, endDate: endDate };
      const delivery = await getDeliveryMetrics(narrativeFilters);

      const activations = delivery.totalActivations;
      const mentoringSessions = delivery.mentoringSessions;
      const ecosystemMeetings = delivery.partnerMeetings;
      const programmes = delivery.programmes.total;

      // Community reach (unique contacts at events)
      const allAttendance = await db.execute(sql`
        SELECT COUNT(DISTINCT ea.contact_id) as count
        FROM event_attendance ea
        JOIN events e ON ea.event_id = e.id
        WHERE e.user_id = ${userId}
          AND e.start_time >= ${start}
          AND e.start_time <= ${end}
          AND e.event_status != 'cancelled'
      `);
      const communityReached = Number((allAttendance as any).rows?.[0]?.count || 0);

      // Active mentees
      const mentoringRels = await db.execute(sql`
        SELECT COUNT(*) as count FROM mentoring_relationships mr
        JOIN contacts c ON c.id = mr.contact_id
        WHERE mr.status = 'active' AND c.user_id = ${userId}
      `);
      const activeMentees = Number((mentoringRels as any).rows?.[0]?.count || 0);

      // Māori & Pasifika breakdown
      const maoriCount = await db.execute(sql`
        SELECT COUNT(*) as count FROM contacts
        WHERE user_id = ${userId}
          AND active = true
          AND is_archived = false
          AND (is_innovator = true OR is_community_member = true)
          AND ethnicity @> ARRAY['Māori']::text[]
      `);
      const pasifikaCount = await db.execute(sql`
        SELECT COUNT(*) as count FROM contacts
        WHERE user_id = ${userId}
          AND active = true
          AND is_archived = false
          AND (is_innovator = true OR is_community_member = true)
          AND ethnicity && ARRAY[${sql.join(PASIFIKA_ETHNICITIES.map(e => sql`${e}`), sql`, `)}]::text[]
          AND NOT (ethnicity @> ARRAY['Māori']::text[])
      `);
      const totalMPCount = await db.execute(sql`
        SELECT COUNT(*) as count FROM contacts
        WHERE user_id = ${userId}
          AND active = true
          AND is_archived = false
          AND (is_innovator = true OR is_community_member = true)
          AND ethnicity IS NOT NULL
          AND array_length(ethnicity, 1) > 0
      `);

      const maori = Number((maoriCount as any).rows?.[0]?.count || 0);
      const pasifika = Number((pasifikaCount as any).rows?.[0]?.count || 0);
      const totalWithEthnicity = Number((totalMPCount as any).rows?.[0]?.count || 0);
      const maoriPasifikaPercent = totalWithEthnicity > 0
        ? Math.round(((maori + pasifika) / totalWithEthnicity) * 100)
        : 0;

      // ── Pull confirmed debriefs with summaries ─────────────────────────────

      const allLogs = await storage.getImpactLogs(userId);
      const periodLogs = allLogs.filter(l =>
        l.status === "confirmed" &&
        l.createdAt && new Date(l.createdAt) >= start &&
        new Date(l.createdAt) <= end &&
        l.summary
      );

      // Get linked contacts for all logs in a single query
      const topLogs = periodLogs.slice(0, 30);
      const logIds = topLogs.map(l => l.id);
      const allContacts = logIds.length > 0
        ? ((await db.execute(sql`
            SELECT ilc.impact_log_id, c.name, c.ethnicity FROM impact_log_contacts ilc
            JOIN contacts c ON c.id = ilc.contact_id
            WHERE ilc.impact_log_id = ANY(${logIds})
          `)) as any).rows || []
        : [];
      const contactsByLog = new Map<number, string[]>();
      for (const r of allContacts) {
        const names = contactsByLog.get(r.impact_log_id) || [];
        names.push(r.name);
        contactsByLog.set(r.impact_log_id, names);
      }
      const logsWithContacts = topLogs.map(log => ({
        title: log.title,
        summary: log.summary,
        contacts: (contactsByLog.get(log.id) || []).join(", "),
      }));

      // ── AI narrative generation ────────────────────────────────────────────

      const { claudeJSON } = await import("./replit_integrations/anthropic/client");

      const audienceGuidance: Record<string, string> = {
        auckland_council_maori: "Auckland Council Māori Outcomes team. All reporting is framed for this audience. Focus on Māori and Pasifika economic participation, rangatahi capability development, community leadership emerging from within, and place-based impact in Tāmaki. Avoid bureaucratic language. Show outcomes, not just activity.",
        tpk: "Te Puni Kōkiri. Emphasise Māori economic development, capability building, and cultural outcomes.",
        foundation_north: "Foundation North. Focus on community outcomes, sustainability, and measurable impact.",
        internal: "Internal team use. Be direct, honest, include learnings and challenges.",
        general: "Auckland Council Māori Outcomes team. Focus on Māori and Pasifika economic participation, rangatahi development, and community leadership. Show outcomes, not just activity.",
      };

      const audienceNote = audienceGuidance[audience] || audienceGuidance.general;

      const prompt = `You are writing a quarterly narrative report for Reserve Tāmaki — a community innovation hub in Tāmaki, Auckland, serving urban Māori and Pasifika entrepreneurs, creatives, and community leaders.

AUDIENCE: ${audienceNote}

PERIOD: ${periodLabel}

ACTIVITY DATA:
- Activations this quarter: ${activations}
- Programmes delivered: ${programmes}
- Mentoring sessions: ${mentoringSessions}
- Ecosystem/relationship meetings: ${ecosystemMeetings}
- Target community directly reached: ${communityReached}
- Active mentees currently: ${activeMentees}
- Māori community members: ${maori}
- Pasifika community members: ${pasifika}
- % Māori & Pasifika: ${maoriPasifikaPercent}%

DEBRIEF SUMMARIES (these are real activities — use the names and stories as written, do not invent):
${logsWithContacts.map(l => `Title: ${l.title}\nPeople: ${l.contacts || "not recorded"}\nSummary: ${l.summary}`).join("\n\n---\n\n")}

WRITING STYLE:
- Confident, direct, collective voice — "we" means Ra and Kim together, not one person
- "We supported X to do Y" framing — take credit without overclaiming
- Balance narrative with outcomes — 2-3 sentences per story max, sometimes just one strong sentence
- Positive but real — not corporate, not overly polished
- Short paragraphs
- Use people's real names (linked contact names, not transcription names)
- Do NOT use the word "activations" — describe what happened instead
- Do NOT use the tagline "Built in Tāmaki. Built for Tāmaki" — do not include it
- Only attribute Māori or Pasifika identity to people who are tagged as Community Member or Innovator with ethnicity recorded — do not guess or assume
- Frame everything through Auckland Council Māori Outcomes lens — economic participation, capability building, rangatahi development, community leadership, Māori and Pasifika thriving
- Section names stay exactly as written below — do not rename them
- "What's Next" should be 2-3 brief lines only, not a full list — just a light signal of what's coming

OUTPUT FORMAT (JSON):
{
  "lede": "One bold summary line of the period — numbers + headline outcomes (e.g. '17 activations. 20 active mentees. Rangatahi creating content, mentees hitting milestones.')",
  "sections": {
    "Overview": "2-3 sentences. What did the quarter deliver overall.",
    "Creative Economy": "Stories about creative work, content creators, studio, rangatahi — only if real debrief content exists",
    "Growing Our People": "Mentoring outcomes and individual stories — only real people from debriefs",
    "Ecosystem & Whanaungatanga": "Partnerships, referrals, connections — only real relationships from debriefs",
    "What's Next": "2-3 sentences only. Brief forward signal."
  }
}

Rules: Only include sections that have real content from the debrief data. Keep each section to 2-4 paragraphs. Be genuine — if something isn't there, don't fabricate it. Drop any section with no real content.`;

      const result = await claudeJSON(prompt, {
        lede: "",
        sections: {} as Record<string, string>,
      });

      res.json({
        numbers: {
          activations,
          programmes,
          mentoringSessions,
          communityReached,
          activeMentees,
          ecosystemMeetings,
          maori,
          pasifika,
          maoriPasifikaPercent,
        },
        lede: result.lede,
        sections: result.sections,
      });

    } catch (err: any) {
      console.error("[report-generator] Error:", err.message);
      res.status(500).json({ message: "Failed to generate report: " + err.message });
    }
  });

  // === COMMS MODULE ===

  // Stories
  app.get("/api/comms/stories", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const rows = await db.execute(
        sql`SELECT id, user_id, title, body, pull_quote, contact_id, impact_log_id, status, created_at, updated_at
            FROM comms_stories WHERE user_id = ${userId} ORDER BY created_at DESC`
      );
      const stories = (rows.rows || []).map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        title: r.title,
        body: r.body,
        pullQuote: r.pull_quote,
        contactId: r.contact_id,
        impactLogId: r.impact_log_id,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
      res.json(stories);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/comms/stories", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { title, body, pull_quote, contact_id, impact_log_id } = req.body;
      if (!title) return res.status(400).json({ message: "Title is required" });
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(
        sql`INSERT INTO comms_stories (user_id, title, body, pull_quote, contact_id, impact_log_id, status)
            VALUES (${userId}, ${title}, ${body || null}, ${pull_quote || null}, ${contact_id || null}, ${impact_log_id || null}, 'draft')
            RETURNING *`
      );
      const row = result.rows[0] as any;
      res.json({
        id: row.id, userId: row.user_id, title: row.title, body: row.body,
        pullQuote: row.pull_quote, contactId: row.contact_id, impactLogId: row.impact_log_id,
        status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/comms/stories/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseInt(req.params.id);
      const { title, body, pull_quote, status } = req.body;
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const updates: string[] = ["updated_at = now()"];
      if (title !== undefined) updates.push(`title = '${title.replace(/'/g, "''")}'`);
      if (body !== undefined) updates.push(`body = ${body ? `'${body.replace(/'/g, "''")}'` : "NULL"}`);
      if (pull_quote !== undefined) updates.push(`pull_quote = ${pull_quote ? `'${pull_quote.replace(/'/g, "''")}'` : "NULL"}`);
      if (status !== undefined) updates.push(`status = '${status}'`);
      const result = await db.execute(
        sql`UPDATE comms_stories SET updated_at = now(),
            title = COALESCE(${title !== undefined ? title : null}::text, title),
            body = CASE WHEN ${body !== undefined} THEN ${body || null} ELSE body END,
            pull_quote = CASE WHEN ${pull_quote !== undefined} THEN ${pull_quote || null} ELSE pull_quote END,
            status = COALESCE(${status || null}::text, status)
            WHERE id = ${id} AND user_id = ${userId}
            RETURNING *`
      );
      const row = result.rows[0] as any;
      if (!row) return res.status(404).json({ message: "Story not found" });
      res.json({
        id: row.id, title: row.title, body: row.body, pullQuote: row.pull_quote,
        status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Newsletters
  app.get("/api/comms/newsletters", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const rows = await db.execute(
        sql`SELECT id, user_id, subject, intro, body, footer, story_ids, status, sent_at, recipient_count, created_at
            FROM comms_newsletters WHERE user_id = ${userId} ORDER BY created_at DESC`
      );
      const items = (rows.rows || []).map((r: any) => ({
        id: r.id, subject: r.subject, intro: r.intro, body: r.body, footer: r.footer,
        storyIds: r.story_ids, status: r.status, sentAt: r.sent_at,
        recipientCount: r.recipient_count, createdAt: r.created_at,
      }));
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/comms/newsletters", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { subject, intro, body, footer, story_ids } = req.body;
      if (!subject) return res.status(400).json({ message: "Subject is required" });
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const storyIdsArr = story_ids && story_ids.length > 0 ? `ARRAY[${story_ids.join(",")}]::integer[]` : "NULL";
      const result = await db.execute(
        sql`INSERT INTO comms_newsletters (user_id, subject, intro, body, footer, story_ids, status)
            VALUES (${userId}, ${subject}, ${intro || null}, ${body || null}, ${footer || null}, ${story_ids && story_ids.length > 0 ? story_ids : null}::integer[], 'draft')
            RETURNING *`
      );
      const row = result.rows[0] as any;
      res.json({
        id: row.id, subject: row.subject, intro: row.intro, body: row.body,
        footer: row.footer, storyIds: row.story_ids, status: row.status,
        sentAt: row.sent_at, recipientCount: row.recipient_count, createdAt: row.created_at,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/comms/newsletters/:id/send", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseInt(req.params.id);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");

      // Get newsletter
      const nlResult = await db.execute(
        sql`SELECT * FROM comms_newsletters WHERE id = ${id} AND user_id = ${userId}`
      );
      const nl = nlResult.rows[0] as any;
      if (!nl) return res.status(404).json({ message: "Newsletter not found" });

      // Get contacts with email (newsletter optin or all)
      const contacts = await storage.getContacts(userId);
      const emailContacts = contacts.filter((c: any) => c.email && c.active !== false);

      // Get stories to embed
      let storiesHtml = "";
      if (nl.story_ids && nl.story_ids.length > 0) {
        const storyResult = await db.execute(
          sql`SELECT * FROM comms_stories WHERE id = ANY(${nl.story_ids}::integer[]) AND status = 'published'`
        );
        for (const story of storyResult.rows as any[]) {
          storiesHtml += `<hr style="margin: 24px 0; border-color: #e2e8f0;"/>
            <h3 style="margin-bottom: 8px;">${story.title}</h3>
            ${story.body ? `<p>${story.body}</p>` : ""}
            ${story.pull_quote ? `<blockquote style="border-left: 3px solid #8b5cf6; padding-left: 12px; margin: 12px 0; color: #6b7280; font-style: italic;">${story.pull_quote}</blockquote>` : ""}
          `;
        }
      }

      const htmlBody = `
        <div style="max-width: 600px; margin: 0 auto; font-family: sans-serif; color: #1e293b;">
          <h2 style="color: #0f172a;">${nl.subject}</h2>
          ${nl.intro ? `<p>${nl.intro}</p>` : ""}
          ${nl.body ? `<p>${nl.body}</p>` : ""}
          ${storiesHtml}
          ${nl.footer ? `<hr style="margin: 24px 0;"/><p style="color: #64748b; font-size: 12px;">${nl.footer}</p>` : ""}
          <p style="color: #94a3b8; font-size: 11px; margin-top: 24px;">Sent from Reserve Tāmaki · kiaora@reservetmk.co.nz</p>
        </div>
      `;

      const { getGmailClientForSending } = await import("./gmail-send");
      const gmail = await getGmailClientForSending(userId);

      let sent = 0;
      for (const contact of emailContacts.slice(0, 200)) {
        try {
          const rawMessage = [
            `To: ${contact.email}`,
            `Subject: ${nl.subject}`,
            `MIME-Version: 1.0`,
            `Content-Type: text/html; charset="UTF-8"`,
            ``,
            htmlBody,
          ].join("\r\n");
          const encoded = Buffer.from(rawMessage).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
          await gmail.users.messages.send({ userId: "me", requestBody: { raw: encoded } });
          sent++;
        } catch (emailErr: any) {
          console.error(`[comms] Failed to send newsletter to ${contact.email}:`, emailErr.message);
        }
      }

      await db.execute(
        sql`UPDATE comms_newsletters SET status = 'sent', sent_at = now(), recipient_count = ${sent} WHERE id = ${id}`
      );

      res.json({ success: true, sent });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Announcements
  app.get("/api/comms/announcements", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const rows = await db.execute(
        sql`SELECT id, user_id, subject, body, target_type, target_id, sent_at, recipient_count, created_at
            FROM comms_announcements WHERE user_id = ${userId} ORDER BY created_at DESC`
      );
      const items = (rows.rows || []).map((r: any) => ({
        id: r.id, subject: r.subject, body: r.body, targetType: r.target_type,
        targetId: r.target_id, sentAt: r.sent_at, recipientCount: r.recipient_count, createdAt: r.created_at,
      }));
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/comms/announcements", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { subject, body, target_type, target_id } = req.body;
      if (!subject || !body) return res.status(400).json({ message: "Subject and body are required" });
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(
        sql`INSERT INTO comms_announcements (user_id, subject, body, target_type, target_id)
            VALUES (${userId}, ${subject}, ${body}, ${target_type || "all"}, ${target_id || null})
            RETURNING *`
      );
      const row = result.rows[0] as any;
      res.json({
        id: row.id, subject: row.subject, body: row.body,
        targetType: row.target_type, targetId: row.target_id, createdAt: row.created_at,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/comms/announcements/:id/send", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseInt(req.params.id);
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");

      const annResult = await db.execute(
        sql`SELECT * FROM comms_announcements WHERE id = ${id} AND user_id = ${userId}`
      );
      const ann = annResult.rows[0] as any;
      if (!ann) return res.status(404).json({ message: "Announcement not found" });

      // Determine recipients
      let emailContacts: any[] = [];
      const allContacts = await storage.getContacts(userId);

      if (ann.target_type === "all") {
        emailContacts = allContacts.filter((c: any) => c.email && c.active !== false);
      } else if (ann.target_type === "group" && ann.target_id) {
        const group = await storage.getGroupMembers(ann.target_id);
        const groupContactIds = new Set(group.map((m: any) => m.contactId));
        emailContacts = allContacts.filter((c: any) => c.email && groupContactIds.has(c.id));
      } else if (ann.target_type === "cohort" && ann.target_id) {
        const registrations = await storage.getProgrammeRegistrations(ann.target_id);
        const regContactIds = new Set(registrations.map((r: any) => r.contactId));
        emailContacts = allContacts.filter((c: any) => c.email && regContactIds.has(c.id));
      }

      const htmlBody = `
        <div style="max-width: 600px; margin: 0 auto; font-family: sans-serif; color: #1e293b;">
          <h2 style="color: #0f172a;">${ann.subject}</h2>
          <p style="white-space: pre-wrap;">${ann.body}</p>
          <p style="color: #94a3b8; font-size: 11px; margin-top: 24px;">From Reserve Tāmaki · kiaora@reservetmk.co.nz</p>
        </div>
      `;

      const { getGmailClientForSending } = await import("./gmail-send");
      const gmail = await getGmailClientForSending(userId);

      let sent = 0;
      for (const contact of emailContacts.slice(0, 200)) {
        try {
          const rawMessage = [
            `To: ${contact.email}`,
            `Subject: ${ann.subject}`,
            `MIME-Version: 1.0`,
            `Content-Type: text/html; charset="UTF-8"`,
            ``,
            htmlBody,
          ].join("\r\n");
          const encoded = Buffer.from(rawMessage).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
          await gmail.users.messages.send({ userId: "me", requestBody: { raw: encoded } });
          sent++;
        } catch (emailErr: any) {
          console.error(`[comms] Failed to send announcement to ${contact.email}:`, emailErr.message);
        }
      }

      await db.execute(
        sql`UPDATE comms_announcements SET sent_at = now(), recipient_count = ${sent} WHERE id = ${id}`
      );

      res.json({ success: true, sent });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === GEAR APPROVAL — enhanced routes with email ===

  app.post("/api/gear-bookings/:id/approve", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseInt(req.params.id);
      const booking = await storage.getGearBooking(id);
      if (!booking) return res.status(404).json({ message: "Gear booking not found" });

      const updated = await storage.updateGearBooking(id, { approved: true });

      // Send confirmation email
      try {
        const booker = await storage.getRegularBooker(booking.regularBookerId);
        const resource = await storage.getBookableResource(booking.resourceId);
        if (booker?.billingEmail) {
          const { getGmailClientForSending } = await import("./gmail-send");
          const gmail = await getGmailClientForSending(userId);
          const dateStr = new Date(booking.date).toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Pacific/Auckland" });
          const htmlBody = `
            <div style="max-width: 600px; margin: 0 auto; font-family: sans-serif; color: #1e293b;">
              <h2 style="color: #0f172a;">Gear Booking Confirmed ✓</h2>
              <p>Your gear booking has been confirmed:</p>
              <ul>
                <li><strong>Item:</strong> ${resource?.name || "Gear item"}</li>
                <li><strong>Date:</strong> ${dateStr}</li>
              </ul>
              <p>See you soon at Reserve Tāmaki!</p>
              <p style="color: #94a3b8; font-size: 11px; margin-top: 24px;">kiaora@reservetmk.co.nz</p>
            </div>
          `;
          const rawMsg = [`To: ${booker.billingEmail}`, `Subject: Your gear booking has been confirmed — ${resource?.name || "item"}, ${dateStr}`, `MIME-Version: 1.0`, `Content-Type: text/html; charset="UTF-8"`, ``, htmlBody].join("\r\n");
          const encoded = Buffer.from(rawMsg).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
          await gmail.users.messages.send({ userId: "me", requestBody: { raw: encoded } });
        }
      } catch (emailErr: any) {
        console.error("[gear-approve] Email failed:", emailErr.message);
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/gear-bookings/:id/deny", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseInt(req.params.id);
      const { reason } = req.body;
      const booking = await storage.getGearBooking(id);
      if (!booking) return res.status(404).json({ message: "Gear booking not found" });

      const updated = await storage.updateGearBooking(id, { status: "cancelled", approved: false });

      // Send denial email
      try {
        const booker = await storage.getRegularBooker(booking.regularBookerId);
        const resource = await storage.getBookableResource(booking.resourceId);
        if (booker?.billingEmail) {
          const { getGmailClientForSending } = await import("./gmail-send");
          const gmail = await getGmailClientForSending(userId);
          const dateStr = new Date(booking.date).toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Pacific/Auckland" });
          const htmlBody = `
            <div style="max-width: 600px; margin: 0 auto; font-family: sans-serif; color: #1e293b;">
              <h2 style="color: #0f172a;">Gear Booking Update</h2>
              <p>Unfortunately, your gear booking request has not been approved:</p>
              <ul>
                <li><strong>Item:</strong> ${resource?.name || "Gear item"}</li>
                <li><strong>Date:</strong> ${dateStr}</li>
                ${reason ? `<li><strong>Reason:</strong> ${reason}</li>` : ""}
              </ul>
              <p>If you have questions, please get in touch with us at kiaora@reservetmk.co.nz</p>
              <p style="color: #94a3b8; font-size: 11px; margin-top: 24px;">Reserve Tāmaki · kiaora@reservetmk.co.nz</p>
            </div>
          `;
          const subject = `Your gear booking request — ${resource?.name || "item"}${reason ? ` — ${reason}` : ""}`;
          const rawMsg = [`To: ${booker.billingEmail}`, `Subject: ${subject}`, `MIME-Version: 1.0`, `Content-Type: text/html; charset="UTF-8"`, ``, htmlBody].join("\r\n");
          const encoded = Buffer.from(rawMsg).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
          await gmail.users.messages.send({ userId: "me", requestBody: { raw: encoded } });
        }
      } catch (emailErr: any) {
        console.error("[gear-deny] Email failed:", emailErr.message);
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Serve Q3 Report — auth required
  app.get("/q3-report", isAuthenticated, async (req, res) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const reportPath = path.join(process.cwd(), "Q3-Report.html");
      if (fs.existsSync(reportPath)) {
        res.setHeader("Content-Type", "text/html");
        res.sendFile(reportPath);
      } else {
        res.status(404).json({ message: "Report not found" });
      }
    } catch (err: any) {
      res.status(500).json({ message: "Failed to serve report" });
    }
  });

  // Serve DOM (Digital Operations Manual) — auth required
  app.get("/dom", isAuthenticated, async (req, res) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const domPath = path.join(process.cwd(), "DOM.html");
      if (fs.existsSync(domPath)) {
        res.setHeader("Content-Type", "text/html");
        res.sendFile(domPath);
      } else {
        res.status(404).json({ message: "DOM not found" });
      }
    } catch (err: any) {
      res.status(500).json({ message: "Failed to serve DOM" });
    }
  });

  return httpServer;
}
