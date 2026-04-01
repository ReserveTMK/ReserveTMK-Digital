import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { api } from "@shared/routes";
import { db } from "../db";
import { eq, and, or, sql, gte, lte, inArray } from "drizzle-orm";
import { bookings, regularBookers, surveys, bookerLinks, insertRegularBookerSchema, insertVenueInstructionSchema, insertSurveySchema, bookingChangeRequests, meetings, programmeRegistrations, memberships, mous, gearBookings, deskBookings, DEFAULT_VENUE_AVAILABILITY_SCHEDULE, type AvailabilitySchedule } from "@shared/schema";
import { parseId, parseStr, parseDate, parseTimeToMinutes, coerceDateFields, timesOverlap, datesOverlap, isPublicHoliday, autoPromoteToInnovator, ensureBookingEvent, getCalendarIdForVenue } from "./_helpers";
import { classifyForAllFunders } from "../taxonomy-engine";
import { getBaseUrl } from "../url";
import crypto from "crypto";

export function registerBookingRoutes(app: Express) {
  app.get(api.bookings.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const bookingsList = await storage.getBookings(userId);

    // Resolve display names: group name > booker org name > booker name > classification
    try {
      const groupIds = Array.from(new Set(bookingsList.filter(b => b.bookerGroupId).map(b => b.bookerGroupId!)));
      const bookerIds = Array.from(new Set(bookingsList.filter(b => b.bookerId).map(b => b.bookerId!)));

      const groupMap = new Map<number, string>();
      const bookerOrgMap = new Map<number, string>();

      if (groupIds.length > 0) {
        const groupRows = await db.execute(sql`SELECT id, name FROM groups WHERE id IN (${sql.join(groupIds.map(id => sql`${id}`), sql`, `)})`);
        for (const row of (groupRows as any).rows || []) {
          groupMap.set(row.id, row.name);
        }
      }
      if (bookerIds.length > 0) {
        const bookerRows = await db.execute(sql`
          SELECT rb.id, rb.organization_name, g.name as group_name
          FROM regular_bookers rb
          LEFT JOIN groups g ON g.id = rb.group_id
          WHERE rb.id IN (${sql.join(bookerIds.map(id => sql`${id}`), sql`, `)})
        `);
        for (const row of (bookerRows as any).rows || []) {
          const orgName = row.organization_name || row.group_name;
          if (orgName) bookerOrgMap.set(row.id, orgName);
        }
      }

      const enriched = bookingsList.map(b => ({
        ...b,
        displayName: (b.bookerGroupId ? groupMap.get(b.bookerGroupId) : null)
          || (b.bookerId ? bookerOrgMap.get(b.bookerId) : null)
          || b.bookerName
          || b.classification
          || "Venue Hire",
      }));

      res.json(enriched);
    } catch (err: any) {
      console.error("Bookings displayName enrichment failed, returning raw:", err.message);
      res.json(bookingsList);
    }
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

      // Block bookings on public holidays
      if (input.startDate) {
        const bookingDate = new Date(input.startDate);
        if (await isPublicHoliday(userId, bookingDate)) {
          return res.status(400).json({ message: "Cannot create a booking on a public holiday. Reserve Tāmaki is closed." });
        }
      }

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
      if (booking.status === "confirmed" || booking.status === "completed") {
        const userId = (req.user as any).claims.sub;
        ensureBookingEvent(booking, userId);
      }
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

      // When booking confirmed/completed: classify + create linked event for debrief
      if (input.status && (input.status === "confirmed" || input.status === "completed")) {
        const userId = (req.user as any).claims.sub;
        classifyForAllFunders("booking", id, userId).catch((err) =>
          console.error(`Taxonomy classification failed for booking ${id}:`, err),
        );
        ensureBookingEvent(updated, userId);
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

  // Booking activity directory — all contacts with any booking activity across channels
  app.get("/api/booking-directory", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;

      const venueBookerIds = await db.selectDistinct({ id: bookings.bookerId }).from(bookings)
        .where(and(eq(bookings.userId, userId), sql`${bookings.bookerId} IS NOT NULL`));

      const mentoringContactIds = await db.select({ id: meetings.contactId }).from(meetings)
        .where(and(eq(meetings.userId, userId), inArray(meetings.type, ["mentoring"])))
        .groupBy(meetings.contactId);

      const programmeContactIds = await db.selectDistinct({ id: programmeRegistrations.contactId }).from(programmeRegistrations)
        .where(and(eq(programmeRegistrations.userId, userId), sql`${programmeRegistrations.contactId} IS NOT NULL`));

      const allContactIds = new Set<number>();
      const channels: Record<number, string[]> = {};
      const addChannel = (id: number, ch: string) => {
        allContactIds.add(id);
        if (!channels[id]) channels[id] = [];
        if (!channels[id].includes(ch)) channels[id].push(ch);
      };

      venueBookerIds.forEach(r => { if (r.id) addChannel(r.id, "venue"); });
      mentoringContactIds.forEach(r => { if (r.id) addChannel(r.id, "mentoring"); });
      programmeContactIds.forEach(r => { if (r.id) addChannel(r.id, "programme"); });

      // Also add gear/desk via regularBookers
      const bookerList = await storage.getRegularBookers(userId);
      for (const b of bookerList) {
        if (b.contactId) {
          const gearCount = await db.select({ c: sql<number>`count(*)` }).from(gearBookings)
            .where(eq(gearBookings.regularBookerId, b.id));
          const deskCount = await db.select({ c: sql<number>`count(*)` }).from(deskBookings)
            .where(eq(deskBookings.regularBookerId, b.id));
          if (Number(gearCount[0]?.c) > 0) addChannel(b.contactId, "gear");
          if (Number(deskCount[0]?.c) > 0) addChannel(b.contactId, "desk");
        }
      }

      if (allContactIds.size === 0) return res.json([]);

      const contactsList = await storage.getContacts(userId);
      const result = Array.from(allContactIds).map(id => {
        const contact = contactsList.find(c => c.id === id);
        if (!contact) return null;
        return {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          channels: channels[id] || [],
        };
      }).filter(Boolean).sort((a: any, b: any) => b.channels.length - a.channels.length);

      res.json(result);
    } catch (err: any) {
      console.error("Booking directory error:", err);
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

      // Duplicate detection
      const existing = await storage.getRegularBookers(userId);
      const emailMatch = existing.find(b =>
        (data.billingEmail && b.billingEmail?.toLowerCase() === data.billingEmail.toLowerCase()) ||
        (data.loginEmail && b.loginEmail && b.loginEmail.toLowerCase() === data.loginEmail.toLowerCase())
      );
      if (emailMatch) {
        return res.status(409).json({ message: "A booker with this email already exists", existingId: emailMatch.id });
      }
      if (data.contactId) {
        const contactMatch = existing.find(b => b.contactId === data.contactId);
        if (contactMatch) {
          return res.status(409).json({ message: "This contact already has a booker profile", existingId: contactMatch.id });
        }
      }

      // Enforce contactId for individual bookers
      if (!data.groupId && !data.contactId) {
        return res.status(400).json({ message: "Individual bookers must be linked to a contact" });
      }

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

      const { sendPortalLinkResendEmail } = await import("../email");
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

      // Block accepting bookings on public holidays
      if (booking.startDate) {
        const bookingDate = new Date(booking.startDate);
        if (await isPublicHoliday(userId, bookingDate)) {
          return res.status(400).json({ message: "Cannot confirm a booking on a public holiday. Reserve Tāmaki is closed." });
        }
      }

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
        const { sendBookingConfirmationEmail } = await import("../email");
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
        const { getUncachableGoogleCalendarClient } = await import("../replit_integrations/google-calendar/client");
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
        const targetCalendarId = await getCalendarIdForVenue(vIds, userId);

        const event = await calendar.events.insert({
          calendarId: targetCalendarId,
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
            const { sendSurveyEmail } = await import("../email");
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

      const { sendBookingConfirmationEmail } = await import("../email");
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
        const { sendSurveyEmail } = await import("../email");
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
        const { sendGrowthSurveyEmail } = await import("../email");
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
        const { sendVenueEnquiryAlert, sendCasualHireConfirmation } = await import("../email");
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
        // Confirmation to the enquirer
        await sendCasualHireConfirmation(email, {
          contactName: name.trim(),
          venueName: venue.name || "Reserve Tāmaki Space",
          date: startDate,
          startTime,
          endTime,
        });
      } catch (emailErr) {
        console.error("[Email] Casual hire email failed:", emailErr);
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
}
