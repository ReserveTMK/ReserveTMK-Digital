// Shared helpers used across route modules
import { storage } from "../storage";
import { db } from "../db";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { events } from "@shared/schema";
import crypto from "crypto";

export function parseId(val: unknown): number {
  if (Array.isArray(val)) return parseInt(String(val[0]), 10);
  return parseInt(String(val ?? ""), 10);
}

export function parseStr(val: unknown): string {
  if (Array.isArray(val)) return String(val[0]);
  return String(val ?? "");
}

export function parseDate(val: unknown): Date {
  if (Array.isArray(val)) return new Date(String(val[0]));
  return new Date(String(val));
}

// Report cache
const reportCache = new Map<string, { data: any; expiresAt: number }>();
const inflightReports = new Map<string, Promise<any>>();
const REPORT_CACHE_TTL_MS = 60_000;

export function getReportCacheKey(prefix: string, filters: Record<string, any>): string {
  const stable = JSON.stringify(filters, Object.keys(filters).sort());
  return `${prefix}:${crypto.createHash("sha256").update(stable).digest("hex")}`;
}

export function getCachedReport(key: string): any | null {
  const entry = reportCache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.data;
  if (entry) reportCache.delete(key);
  return null;
}

export function setCachedReport(key: string, data: any): void {
  reportCache.set(key, { data, expiresAt: Date.now() + REPORT_CACHE_TTL_MS });
}

export async function deduplicatedReportCall<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const cached = getCachedReport(key);
  if (cached) return cached as T;
  const inflight = inflightReports.get(key);
  if (inflight) return inflight as Promise<T>;
  const promise = fn()
    .then((result) => { setCachedReport(key, result); inflightReports.delete(key); return result; })
    .catch((err) => { inflightReports.delete(key); throw err; });
  inflightReports.set(key, promise);
  return promise;
}

// Time helpers
export function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(":");
  return parseInt(parts[0]) * 60 + parseInt(parts[1] || "0");
}

export function timesOverlap(
  startA: string | null | undefined, endA: string | null | undefined,
  startB: string | null | undefined, endB: string | null | undefined
): boolean {
  if (!startA || !endA || !startB || !endB) return true;
  const a0 = parseTimeToMinutes(startA); const a1 = parseTimeToMinutes(endA);
  const b0 = parseTimeToMinutes(startB); const b1 = parseTimeToMinutes(endB);
  return a0 < b1 && b0 < a1;
}

export function datesOverlap(
  startA: Date | string | null | undefined, endA: Date | string | null | undefined,
  startB: Date | string | null | undefined, endB: Date | string | null | undefined
): boolean {
  if (!startA || !startB) return false;
  const a0 = new Date(startA); const a1 = endA ? new Date(endA) : a0;
  const b0 = new Date(startB); const b1 = endB ? new Date(endB) : b0;
  return a0.toISOString().slice(0, 10) <= b1.toISOString().slice(0, 10) && b0.toISOString().slice(0, 10) <= a1.toISOString().slice(0, 10);
}

export function coerceDateFields(body: Record<string, any>): Record<string, any> {
  const result = { ...body };
  for (const [key, value] of Object.entries(result)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && (key.endsWith('Date') || key.endsWith('At') || key === 'startTime' || key === 'endTime' || key === 'date')) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) result[key] = parsed;
    }
  }
  return result;
}

// Public holiday check
export async function isPublicHoliday(userId: string, date: Date): Promise<boolean> {
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
  const [row] = await db.select({ count: sql<number>`count(*)` })
    .from(events)
    .where(and(eq(events.userId, userId), eq(events.isPublicHoliday, true), lte(events.startTime, dayEnd), gte(events.endTime, dayStart)));
  return (row?.count || 0) > 0;
}

// Auto-promote contact to innovator
export async function autoPromoteToInnovator(contactId: number) {
  try {
    const contact = await storage.getContact(contactId);
    if (contact && (!contact.isCommunityMember || !contact.isInnovator)) {
      const now = new Date();
      const updates: any = { isCommunityMember: true, isInnovator: true };
      if (!contact.isCommunityMember && !contact.movedToCommunityAt) updates.movedToCommunityAt = now;
      if (!contact.isInnovator && !contact.movedToInnovatorsAt) updates.movedToInnovatorsAt = now;
      await storage.updateContact(contactId, updates);
    }
  } catch (err) {
    console.warn(`Failed to auto-promote contact ${contactId} to innovator:`, err);
  }
}

// Desk booking validation
export async function getDeskHoursForDay(userId: string, dayName: string) {
  let hours = await storage.getOperatingHours(userId);
  if (hours.length === 0) hours = await storage.seedDefaultOperatingHours(userId);
  const dayHours = hours.find(h => h.dayOfWeek === dayName);
  if (!dayHours || !dayHours.isStaffed) return null;
  return { open: true, startTime: dayHours.openTime || "09:00", endTime: dayHours.closeTime || "17:00" };
}

export async function validateDeskBookingWindow(userId: string, date: Date, startTime: string, endTime: string): Promise<string | null> {
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayName = dayNames[date.getDay()];
  const dayHours = await getDeskHoursForDay(userId, dayName);
  if (!dayHours) return `Desks are not available on ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}`;
  const startMins = parseTimeToMinutes(startTime);
  const endMins = parseTimeToMinutes(endTime);
  if (startMins < parseTimeToMinutes(dayHours.startTime) || endMins > parseTimeToMinutes(dayHours.endTime)) {
    return `Desks are only available ${dayHours.startTime} – ${dayHours.endTime}`;
  }
  return null;
}

// Ensure booking/programme events exist on calendar
export async function ensureBookingEvent(booking: any, userId: string): Promise<void> {
  try {
    if (!booking.id || !booking.startDate) return;
    const existingEvents = await storage.getEvents(userId);
    if (existingEvents.find(e => e.linkedBookingId === booking.id)) return;
    const venues = await storage.getVenues(userId);
    const bookingVenueIds = booking.venueIds || (booking.venueId ? [booking.venueId] : []);
    const venueNames = bookingVenueIds.map((vid: number) => venues.find(v => v.id === vid)?.name).filter(Boolean);
    const venueName = venueNames.join(", ") || "Venue";
    let title = booking.title;
    if (!title) {
      let orgName = "";
      if (booking.bookerGroupId) { const group = await storage.getGroup(booking.bookerGroupId); if (group) orgName = group.name; }
      title = orgName ? `${orgName} Booking` : `${booking.bookerName || booking.classification || "Venue Hire"} Booking`;
    }
    const baseDateMs = new Date(booking.startDate).getTime();
    let startTime: Date, endTime: Date;
    if (booking.startTime) { const [h, m] = booking.startTime.split(":").map(Number); startTime = new Date(baseDateMs + (h * 60 + m) * 60 * 1000); }
    else startTime = new Date(baseDateMs + 9 * 60 * 60 * 1000);
    if (booking.endTime) { const [h, m] = booking.endTime.split(":").map(Number); endTime = new Date(baseDateMs + (h * 60 + m) * 60 * 1000); }
    else endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
    const primaryVenueId = bookingVenueIds[0] || null;
    await storage.createEvent({ userId, name: title, type: "Venue Hire", startTime, endTime, location: venueName, venueId: primaryVenueId, source: "booking", linkedBookingId: booking.id, requiresDebrief: true, googleCalendarEventId: booking.googleCalendarEventId || null });
  } catch (e) { console.warn(`Failed to create event for booking ${booking.id}:`, e); }
}

export async function ensureProgrammeEvent(programme: any, userId: string): Promise<void> {
  try {
    if (!programme.id || !programme.startDate) return;
    if (programme.status === "cancelled" || programme.status === "planned") return;
    const existingEvents = await storage.getEvents(userId);
    if (existingEvents.find(e => e.linkedProgrammeId === programme.id)) return;
    const baseDateMs = new Date(programme.startDate).getTime();
    let startTime: Date, endTime: Date;
    if (programme.startTime) { const [h, m] = programme.startTime.split(":").map(Number); startTime = new Date(baseDateMs + (h * 60 + m) * 60 * 1000); }
    else startTime = new Date(baseDateMs + 10 * 60 * 60 * 1000);
    if (programme.endTime) { const [h, m] = programme.endTime.split(":").map(Number); endTime = new Date(baseDateMs + (h * 60 + m) * 60 * 1000); }
    else endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
    await storage.createEvent({ userId, name: programme.name, type: "Programme", startTime, endTime, location: programme.location || null, source: "programme", linkedProgrammeId: programme.id, requiresDebrief: true });
  } catch (e) { console.warn(`Failed to create event for programme ${programme.id}:`, e); }
}

export async function ensureMeetingEvent(meeting: any, userId: string): Promise<void> {
  try {
    if (!meeting.id || !meeting.startTime) return;
    if (meeting.status === "cancelled") return;
    const existingEvents = await storage.getEvents(userId);
    if (existingEvents.find(e => e.linkedMeetingId === meeting.id)) return;
    // If meeting has a GCal ID and an event already imported from GCal, link them
    if (meeting.googleCalendarEventId) {
      const gcalMatch = existingEvents.find(e => e.googleCalendarEventId === meeting.googleCalendarEventId);
      if (gcalMatch) {
        await storage.updateEvent(gcalMatch.id, { linkedMeetingId: meeting.id });
        return;
      }
    }
    const venue = meeting.venueId ? await storage.getVenue(meeting.venueId) : null;
    await storage.createEvent({
      userId,
      name: meeting.title || "Mentoring Session",
      type: "Mentoring Session",
      startTime: new Date(meeting.startTime),
      endTime: meeting.endTime ? new Date(meeting.endTime) : new Date(new Date(meeting.startTime).getTime() + 60 * 60 * 1000),
      location: venue?.name || null,
      venueId: meeting.venueId || null,
      source: "meeting",
      linkedMeetingId: meeting.id,
      googleCalendarEventId: meeting.googleCalendarEventId || null,
      requiresDebrief: true,
    });
  } catch (e) { console.warn(`Failed to create event for meeting ${meeting.id}:`, e); }
}

// Calendar venue mapping
export async function getCalendarIdForVenue(venueIds: number[], userId: string): Promise<string> {
  if (!venueIds.length) return "primary";
  const venues = await storage.getVenues(userId);
  const settings = await storage.getCalendarSettings(userId);
  const calEntries: { label: string; calId: string }[] = [];
  for (const s of settings) { if (!s.active || !s.label) continue; calEntries.push({ label: s.label.toLowerCase(), calId: s.calendarId }); }
  for (const vid of venueIds) {
    const venue = venues.find(v => v.id === vid);
    if (!venue) continue;
    const name = venue.name.toLowerCase();
    for (const { label, calId } of calEntries) {
      const cleanLabel = label.replace("office - ", "").replace("studio - ", "");
      if (cleanLabel.includes(name) || name.includes(cleanLabel)) return calId;
    }
    const findCal = (...names: string[]) => calEntries.find(e => names.includes(e.label))?.calId;
    if (name.includes("workshop")) { const ws = findCal("workshop space", "workshop"); if (ws) return ws; }
    if (name.includes("boardroom")) { const br = findCal("office - boardroom", "boardroom space"); if (br) return br; }
    if (name.includes("lounge")) { const ls = findCal("studio - lounge set", "lounge set"); if (ls) return ls; }
    if (name.includes("black")) { const bs = findCal("studio - black set", "black set"); if (bs) return bs; }
    if (name.includes("hot desk") || name.includes("office")) { const hd = findCal("office - hot desk", "hot desk"); if (hd) return hd; }
  }
  return "primary";
}

export function classifyEventFromCalendar(calendarId: string, calendarSettings: { calendarId: string; label: string }[], title?: string): string | null {
  const setting = calendarSettings.find(s => s.calendarId === calendarId);
  if (!setting) return null;
  const label = setting.label.toLowerCase();
  if (label.includes("workshop") || label.includes("boardroom") || label.includes("studio") || label.includes("hot desk") || label.includes("office")) return "Venue Hire";
  if (label.includes("mentoring")) return "Mentoring Session";
  if (title) {
    const t = title.toLowerCase();
    if (t.includes("catch up") || t.includes("catchup") || t.includes("catch-up")) return "Catch Up";
    if (t.includes("mentoring") || t.startsWith("mentoring:")) return "Mentoring Session";
    if (t.includes("workshop") || t.includes("programme")) return "Programme Session";
    if (t.includes("podcast") || t.includes("recording")) return "Hub Activity";
  }
  return null;
}

// Report extraction prompt builder
export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const LEGACY_METRIC_KEYS = [
  { key: "activations_total", label: "Total Activations", unit: "count" },
  { key: "activations_workshops", label: "Workshops", unit: "count" },
  { key: "activations_mentoring", label: "Mentoring Sessions", unit: "count" },
  { key: "activations_events", label: "Events", unit: "count" },
  { key: "activations_partner_meetings", label: "Partner Meetings", unit: "count" },
  { key: "hub_foottraffic", label: "Hub Foot Traffic", unit: "count" },
  { key: "bookings_total", label: "Total Bookings", unit: "count" },
];

export const METRIC_KEY_TO_SNAPSHOT_FIELD: Record<string, string> = {
  activations_total: "activationsTotal",
  activations_workshops: "activationsWorkshops",
  activations_mentoring: "activationsMentoring",
  activations_events: "activationsEvents",
  activations_partner_meetings: "activationsPartnerMeetings",
  hub_foottraffic: "foottrafficUnique",
  bookings_total: "bookingsTotal",
};

export function buildExtractionPrompt(pdfText: string): string {
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
