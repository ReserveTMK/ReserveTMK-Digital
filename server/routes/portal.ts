import type { Express } from "express";
import { getBaseUrl } from "../url";
import { z } from "zod";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { regularBookers, bookerLinks, meetings, programmeRegistrations } from "@shared/schema";
import { parseId, parseStr, parseTimeToMinutes, autoPromoteToInnovator, ensureBookingEvent, getCalendarIdForVenue, isPublicHoliday, timesOverlap, datesOverlap, coerceDateFields, validateDeskBookingWindow, getDeskHoursForDay } from "./_helpers";
import crypto from "crypto";

export function registerPortalRoutes(app: Express) {
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
          const { sendBookerLoginEmail } = await import("../email");
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

      // Tier enforcement
      const bookerTier = (booker as any).tier || "regular";
      if (bookerTier === "public" && !(booker as any).inductedAt) {
        return res.status(403).json({ message: "Induction required before booking. Please contact Reserve Tāmaki to arrange your induction." });
      }

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

      // Determine booking status, pricing and payment_status based on tier + allowance
      let bookingStatus = "enquiry";
      let bookingPaymentStatus = "unpaid";
      let autoConfirmedAt: Date | null = null;

      // Public tier: always needs approval regardless of allowance
      if (bookerTier === "public") {
        bookingStatus = "enquiry";
        bookingPaymentStatus = "unpaid";
      } else if (isWithinAllowance && (membershipId || mouId)) {
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

      // Create linked event for confirmed bookings (debriefable)
      if (bookingStatus === "confirmed") {
        ensureBookingEvent(booking, booker.userId);
      }

      // Send appropriate email notifications
      if (bookingStatus === "confirmed" && autoConfirmedAt) {
        // Auto-confirmed: send confirmation email (not enquiry alert)
        try {
          const { sendBookingConfirmationEmail } = await import("../email");
          await sendBookingConfirmationEmail(booking, booker.userId, booker.notificationsEmail || undefined);
        } catch (emailErr) {
          console.error("[Email] Auto-confirm confirmation email failed (booker portal):", emailErr);
        }

        // Admin alert for auto-confirmed booking
        try {
          const { getGmailClientForSending } = await import("../gmail-send");
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
          const { getUncachableGoogleCalendarClient } = await import("../replit_integrations/google-calendar/client");
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
          const portalTargetCalId = await getCalendarIdForVenue(resolvedVenueIds, booker.userId);

          const calEvent = await calendar.events.insert({
            calendarId: portalTargetCalId,
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
          const { sendVenueEnquiryAlert } = await import("../email");
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
            bookerName: bookerName || (booker as any).name || null,
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

      let myBookings: any[];
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

      // Check for mentoring/programme data (individual bookers only)
      const isGroupLink = linkResult.link.isGroupLink === true;
      let hasMentoring = false;
      let hasProgrammes = false;
      if (!isGroupLink && booker.contactId) {
        const mentoringSessions = await db.select({ id: meetings.id }).from(meetings)
          .where(and(eq(meetings.contactId, booker.contactId), inArray(meetings.type, ["mentoring"])))
          .limit(1);
        hasMentoring = mentoringSessions.length > 0;

        const progRegs = await db.select({ id: programmeRegistrations.id }).from(programmeRegistrations)
          .where(eq(programmeRegistrations.contactId, booker.contactId))
          .limit(1);
        hasProgrammes = progRegs.length > 0;
      }

      if (hasMentoring) categories.push("mentoring");
      if (hasProgrammes) categories.push("programmes");

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

  // ── Booker Portal: Mentoring Sessions ──
  app.get("/api/booker/mentoring-sessions/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const linkResult = await storage.getBookerByLinkToken(token);
      if (!linkResult || (linkResult.link.tokenExpiry && new Date(linkResult.link.tokenExpiry) < new Date()) || !linkResult.link.enabled) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      const booker = linkResult.booker;
      if (!booker.contactId || linkResult.link.isGroupLink) {
        return res.json([]);
      }

      const rows = await db.select({
        id: meetings.id,
        title: meetings.title,
        startTime: meetings.startTime,
        endTime: meetings.endTime,
        status: meetings.status,
        type: meetings.type,
        mentoringFocus: meetings.mentoringFocus,
        duration: meetings.duration,
        location: meetings.location,
      }).from(meetings).where(and(
        eq(meetings.contactId, booker.contactId),
        inArray(meetings.type, ["mentoring"]),
      )).orderBy(sql`${meetings.startTime} DESC`).limit(20);

      // Enrich with mentor name
      const profiles = await storage.getMentorProfiles(booker.userId);
      const enriched = rows.map(m => {
        const mentor = profiles.find(p => p.mentorUserId === (m as any).userId || `mentor-${p.id}` === (m as any).userId);
        return { ...m, mentorName: mentor?.name || null };
      });

      res.json(enriched);
    } catch (err: any) {
      console.error("Booker mentoring sessions error:", err);
      res.status(500).json({ message: "Failed to fetch mentoring sessions" });
    }
  });

  // ── Booker Portal: Programme Registrations ──
  app.get("/api/booker/programme-registrations/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const linkResult = await storage.getBookerByLinkToken(token);
      if (!linkResult || (linkResult.link.tokenExpiry && new Date(linkResult.link.tokenExpiry) < new Date()) || !linkResult.link.enabled) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      const booker = linkResult.booker;
      if (!booker.contactId || linkResult.link.isGroupLink) {
        return res.json([]);
      }

      const regs = await db.select({
        id: programmeRegistrations.id,
        programmeId: programmeRegistrations.programmeId,
        status: programmeRegistrations.status,
        attended: programmeRegistrations.attended,
        createdAt: (programmeRegistrations as any).createdAt,
      }).from(programmeRegistrations).where(
        eq(programmeRegistrations.contactId, booker.contactId),
      );

      // Enrich with programme details
      const progIds = Array.from(new Set(regs.map(r => r.programmeId)));
      const progs: Record<number, any> = {};
      for (const pid of progIds) {
        const p = await storage.getProgramme(pid);
        if (p) progs[pid] = p;
      }

      const enriched = regs.map(r => ({
        ...r,
        programmeName: progs[r.programmeId]?.name || "Unknown Programme",
        programmeDate: progs[r.programmeId]?.startDate || null,
        programmeTime: progs[r.programmeId]?.startTime || null,
        programmeLocation: progs[r.programmeId]?.location || null,
      }));

      res.json(enriched);
    } catch (err: any) {
      console.error("Booker programme registrations error:", err);
      res.status(500).json({ message: "Failed to fetch programme registrations" });
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

      // Send confirmation email
      const deskResource = await storage.getBookableResource(resourceId);
      const deskEmail = booker.notificationsEmail || (booker.contactId ? (await storage.getContact(booker.contactId))?.email : null);
      if (deskEmail) {
        (async () => {
          try {
            const { sendDeskBookingConfirmation } = await import("../email");
            await sendDeskBookingConfirmation(deskEmail, {
              contactName: (booker as any).name || "there",
              deskName: deskResource?.name || "Hot Desk",
              date,
            });
          } catch (e) { console.warn("Desk booking confirmation email failed:", e); }
        })();
      }

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

      // Send confirmation email
      const gearEmail = booker.notificationsEmail || (booker.contactId ? (await storage.getContact(booker.contactId))?.email : null);
      if (gearEmail) {
        (async () => {
          try {
            const { sendGearBookingConfirmation } = await import("../email");
            await sendGearBookingConfirmation(gearEmail, {
              contactName: (booker as any).name || "there",
              itemName: resource.name,
              date,
            });
          } catch (e) { console.warn("Gear booking confirmation email failed:", e); }
        })();
      }

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
      let venueBookings: any[];
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
}
