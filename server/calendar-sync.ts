import { storage } from "./storage";
import { getUncachableGoogleCalendarClient } from "./replit_integrations/google-calendar/client";
import { db } from "./db";
import { calendarSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

let syncInterval: ReturnType<typeof setInterval> | null = null;

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function startCalendarAutoSync() {
  if (syncInterval) return;

  // Run once on startup after a short delay
  setTimeout(() => runCalendarSync(), 30_000);

  syncInterval = setInterval(runCalendarSync, SYNC_INTERVAL_MS);
  console.log("[Calendar Sync] Auto-sync started, interval: 15 minutes");
}

async function runCalendarSync() {
  try {
    const autoImportSettings = await storage.getAutoImportCalendarSettings();
    if (autoImportSettings.length === 0) return;

    // Group by userId so we only authenticate once per user
    const byUser = new Map<string, typeof autoImportSettings>();
    for (const setting of autoImportSettings) {
      const list = byUser.get(setting.userId) || [];
      list.push(setting);
      byUser.set(setting.userId, list);
    }

    for (const [userId, settings] of Array.from(byUser.entries())) {
      try {
        const calendar = await getUncachableGoogleCalendarClient(userId);
        const dismissedEvents = await storage.getDismissedCalendarEvents(userId);
        const dismissedIds = new Set(dismissedEvents.map(d => d.gcalEventId));

        for (const setting of settings) {
          try {
            await syncCalendar(calendar, userId, setting, dismissedIds);
            // Update lastSyncAt
            await db.update(calendarSettings)
              .set({ lastSyncAt: new Date() })
              .where(eq(calendarSettings.id, setting.id));
          } catch (calErr: any) {
            console.error(`[Calendar Sync] Failed to sync calendar "${setting.label || setting.calendarId}":`, calErr.message);
          }
        }
      } catch (authErr: any) {
        console.error(`[Calendar Sync] Auth failed for user ${userId}:`, authErr.message);
      }
    }
  } catch (err) {
    console.error("[Calendar Sync] Auto-sync error:", err);
  }
}

async function syncCalendar(
  calendar: any,
  userId: string,
  setting: { id: number; calendarId: string; label: string | null; lastSyncAt: Date | null },
  dismissedIds: Set<string>
) {
  // Look back 7 days or since last sync, whichever is more recent
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const timeMin = setting.lastSyncAt && setting.lastSyncAt > sevenDaysAgo
    ? setting.lastSyncAt
    : sevenDaysAgo;
  const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days ahead

  const response = await calendar.events.list({
    calendarId: setting.calendarId,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 100,
  });

  const events = response.data.items || [];
  let imported = 0;

  for (const gcalEvent of events) {
    if (!gcalEvent.id || !gcalEvent.summary) continue;
    if (gcalEvent.status === "cancelled") continue;

    // Skip if already imported, dismissed, or linked to a booking
    if (dismissedIds.has(gcalEvent.id)) continue;
    const existing = await storage.getEventByGoogleCalendarId(gcalEvent.id, userId);
    if (existing) {
      // Fix events with wrong dates (0-duration imports from initial sync)
      const existingStart = new Date(existing.startTime);
      const existingEnd = new Date(existing.endTime);
      if (existingStart.getTime() === existingEnd.getTime()) {
        const correctStart = gcalEvent.start?.dateTime || gcalEvent.start?.date;
        const correctEnd = gcalEvent.end?.dateTime || gcalEvent.end?.date;
        if (correctStart && correctEnd) {
          await storage.updateEvent(existing.id, {
            startTime: new Date(correctStart),
            endTime: new Date(correctEnd),
          });
        }
      }
      continue;
    }
    const existingBooking = await storage.getBookingByGoogleCalendarId(gcalEvent.id, userId);
    if (existingBooking) continue;

    // Auto-import as platform event
    const start = gcalEvent.start?.dateTime || gcalEvent.start?.date;
    const end = gcalEvent.end?.dateTime || gcalEvent.end?.date;
    if (!start || !end) continue;

    const attendees = (gcalEvent.attendees || []).map((a: any) => ({
      email: a.email,
      displayName: a.displayName || null,
      responseStatus: a.responseStatus || null,
      organizer: a.organizer || false,
    }));

    // Determine event type from calendar label + attendees
    const calLabel = (setting.label || "").toLowerCase();
    const isHolidayCalendar = setting.calendarId.includes("holiday@group.v.calendar.google.com");
    const summary = (gcalEvent.summary || "").toLowerCase();
    const hasExternalAttendees = attendees.some((a: any) => a.email && !a.email.endsWith("@reservetmk.co.nz"));
    let eventType = "Team Meeting";
    if (isHolidayCalendar) eventType = "Public Holiday";
    else if (summary.includes("mentor") || summary.includes("1:1") || calLabel.includes("mentoring")) eventType = "Mentoring Session";
    else if (calLabel.includes("workshop") || calLabel.includes("studio") || calLabel.includes("boardroom") || calLabel.includes("office")) eventType = "Venue Hire";
    else if (hasExternalAttendees) eventType = "External Meeting";

    await storage.createEvent({
      userId,
      name: gcalEvent.summary,
      type: eventType,
      startTime: new Date(start),
      endTime: new Date(end),
      location: gcalEvent.location || null,
      description: gcalEvent.description || null,
      googleCalendarEventId: gcalEvent.id,
      source: "google",
      calendarAttendees: attendees.length > 0 ? attendees : null,
      requiresDebrief: !isHolidayCalendar,
      isPublicHoliday: isHolidayCalendar,
      eventStatus: "active",
    } as any);

    imported++;
  }

  if (imported > 0) {
    console.log(`[Calendar Sync] Imported ${imported} events from "${setting.label || setting.calendarId}"`);
  }
}
