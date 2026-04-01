import type { Express } from "express";
import { z } from "zod";
import crypto from "crypto";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { insertBookableResourceSchema, insertDeskBookingSchema, insertGearBookingSchema } from "@shared/schema";
import { parseId, parseStr, parseDate, autoPromoteToInnovator, getDeskHoursForDay, validateDeskBookingWindow } from "./_helpers";

export function registerResourceRoutes(app: Express) {
  // === Bookable Resources ===

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
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
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
          if (futureBookings.length > 0) futureBookingsWarning = `Warning: This resource has ${futureBookings.length} future desk booking(s) that may be affected.`;
        } else if (existing.category === "gear") {
          const gearBookingsList = await storage.getGearBookingsByResource(id);
          const futureBookings = gearBookingsList.filter(b => b.status !== "cancelled" && b.status !== "returned" && new Date(b.date) >= now);
          if (futureBookings.length > 0) futureBookingsWarning = `Warning: This resource has ${futureBookings.length} future gear booking(s) that may be affected.`;
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
      const parsedIds = ids.map((v: any) => typeof v === "number" ? v : parseInt(v, 10)).filter((v: number) => !isNaN(v));
      if (parsedIds.length === 0) return res.status(400).json({ message: "no valid ids" });
      let updated = 0;
      for (const id of parsedIds) {
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

  // === Desk Bookings ===

  app.get("/api/desk-bookings", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { startDate, endDate, resourceId } = req.query;
      if (startDate && endDate) {
        const bookingsResult = await storage.getDeskBookingsByDateRange(userId, new Date(startDate as string), new Date(endDate as string));
        if (resourceId) return res.json(bookingsResult.filter(b => b.resourceId === parseInt(resourceId as string)));
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
      if (!body.date || !body.startTime || !body.endTime) return res.status(400).json({ message: "date, startTime, and endTime are required" });
      const deskWindowError = await validateDeskBookingWindow(userId, new Date(body.date), body.startTime, body.endTime);
      if (deskWindowError) return res.status(400).json({ message: deskWindowError });
      if (body.isRecurring && body.recurringPattern) {
        const pattern = body.recurringPattern as { dayOfWeek: number; frequency: string; endDate: string };
        const recurringGroupId = crypto.randomUUID();
        const createdBookings = [];
        const startDate = new Date(body.date);
        const endDate = new Date(pattern.endDate);
        const current = new Date(startDate);
        while (current <= endDate) {
          if (current.getDay() === pattern.dayOfWeek || !pattern.dayOfWeek) {
            const bookingData = insertDeskBookingSchema.parse({ ...body, date: new Date(current), isRecurring: true, recurringPattern: pattern, recurringGroupId });
            const created = await storage.createDeskBookingWithConflictCheck(bookingData);
            createdBookings.push(created);
          }
          current.setDate(current.getDate() + (pattern.frequency === "fortnightly" ? 14 : 7));
        }
        return res.status(201).json(createdBookings);
      }
      const data = insertDeskBookingSchema.parse(body);
      const booking = await storage.createDeskBookingWithConflictCheck(data);
      const deskBooker = await storage.getRegularBooker(data.regularBookerId);
      if (deskBooker?.contactId) await autoPromoteToInnovator(deskBooker.contactId);
      res.status(201).json(booking);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      if (err.message === "CONFLICT") return res.status(409).json({ message: "Time slot conflicts with existing desk booking" });
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

  // === Gear Bookings ===

  app.get("/api/gear-bookings", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { date, resourceId } = req.query;
      let bookings: any[];
      if (date) {
        bookings = await storage.getGearBookingsByDate(userId, new Date(date as string));
        if (resourceId) bookings = bookings.filter(b => b.resourceId === parseInt(resourceId as string));
      } else if (resourceId) {
        bookings = await storage.getGearBookingsByResource(parseInt(resourceId as string));
        bookings = bookings.filter(b => b.userId === userId);
      } else {
        bookings = await storage.getGearBookings(userId);
      }
      const allUserBookers = await storage.getRegularBookers(userId);
      const userBookerMap = new Map(allUserBookers.map(b => [b.id, b]));
      const bookerMap: Record<number, { name: string; organization: string | null }> = {};
      const bookerIds = Array.from(new Set(bookings.map(b => b.regularBookerId).filter(Boolean)));
      for (const bid of bookerIds) {
        const booker = userBookerMap.get(bid);
        if (booker) bookerMap[bid] = { name: booker.billingEmail, organization: booker.organizationName || null };
      }
      res.json(bookings.map(b => ({ ...b, bookerName: bookerMap[b.regularBookerId]?.name || null, bookerOrganization: bookerMap[b.regularBookerId]?.organization || null })));
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
          let staffContactId: number | undefined;
          const staffName = userRecord ? `${userRecord.firstName || ''} ${userRecord.lastName || ''}`.trim() || 'Staff' : 'Staff';
          if (email && !email.endsWith('@internal')) {
            const allContacts = await storage.getContacts(userId);
            const existing = allContacts.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());
            if (existing) { staffContactId = existing.id; }
            else { const newContact = await storage.createContact({ userId, name: staffName, email, role: 'Staff', active: true } as any); staffContactId = newContact.id; }
          }
          booker = await storage.createRegularBooker({ userId, billingEmail: email, organizationName: staffName, contactId: staffContactId, pricingTier: 'full_price', accountStatus: 'active', paymentTerms: 'immediate' } as any);
        } else if (!booker.contactId && email && !email.endsWith('@internal')) {
          const allContacts = await storage.getContacts(userId);
          const existing = allContacts.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());
          if (existing) await storage.updateRegularBooker(booker.id, { contactId: existing.id });
        }
        body.regularBookerId = booker.id;
        body.approved = true;
      }
      if (!body.selfCheckout && body.regularBookerId) {
        const booker = await storage.getRegularBooker(body.regularBookerId);
        if (!booker || booker.userId !== userId) return res.status(403).json({ message: "Invalid booker selection" });
      }
      const resource = await storage.getBookableResource(body.resourceId);
      if (!resource) return res.status(404).json({ message: "Resource not found" });
      if (body.approved === undefined) body.approved = !resource.requiresApproval;
      const data = insertGearBookingSchema.parse(body);
      const booking = await storage.createGearBookingWithConflictCheck(data);
      const gearBooker = await storage.getRegularBooker(data.regularBookerId);
      if (gearBooker?.contactId) await autoPromoteToInnovator(gearBooker.contactId);
      res.status(201).json(booking);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      if (err.message === "CONFLICT") return res.status(409).json({ message: "This gear item is already booked for this date" });
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/gear-bookings/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const existing = await storage.getGearBooking(id);
      if (!existing) return res.status(404).json({ message: "Gear booking not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      if (req.body.markReturned) { const updated = await storage.markGearReturned(id); return res.json(updated); }
      const updated = await storage.updateGearBooking(id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === Availability ===

  app.get("/api/desk-availability/:date", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const date = parseDate(req.params.date);
      const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const dayName = dayNames[date.getDay()];
      const dayHours = await getDeskHoursForDay(userId, dayName);
      const desks = await storage.getBookableResourcesByCategory(userId, "hot_desking");
      if (!dayHours) {
        return res.json(desks.map(desk => ({ resourceId: desk.id, resourceName: desk.name, active: desk.active, bookings: [], isAvailable: false, closedToday: true, availableWindow: null })));
      }
      const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
      const dayBookings = await storage.getDeskBookingsByDateRange(userId, dayStart, dayEnd);
      res.json(desks.map(desk => {
        const deskBookings = dayBookings.filter(b => b.resourceId === desk.id && b.status === "booked");
        return { resourceId: desk.id, resourceName: desk.name, active: desk.active, bookings: deskBookings.map(b => ({ id: b.id, startTime: b.startTime, endTime: b.endTime, status: b.status })), isAvailable: deskBookings.length === 0, closedToday: false, availableWindow: { startTime: dayHours.startTime, endTime: dayHours.endTime } };
      }));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/gear-availability/:date", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const date = parseDate(req.params.date);
      const gear = await storage.getBookableResourcesByCategory(userId, "gear");
      const dayBookings = await storage.getGearBookingsByDate(userId, date);
      res.json(gear.map(item => {
        const itemBookings = dayBookings.filter(b => b.resourceId === item.id && b.status !== "returned" && b.status !== "cancelled");
        return { resourceId: item.id, resourceName: item.name, requiresApproval: item.requiresApproval, active: item.active, bookings: itemBookings.map(b => ({ id: b.id, status: b.status, approved: b.approved })), isAvailable: itemBookings.length === 0 };
      }));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === Gear Approval ===

  app.post("/api/gear-bookings/:id/approve", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
      const booking = await storage.getGearBooking(id);
      if (!booking) return res.status(404).json({ message: "Gear booking not found" });
      if (booking.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const updated = await storage.updateGearBooking(id, { approved: true, status: "booked" });
      // Send approval email if booker has email
      try {
        const booker = await storage.getRegularBooker(booking.regularBookerId);
        const email = booker?.notificationsEmail || booker?.billingEmail;
        if (email) {
          const resource = await storage.getBookableResource(booking.resourceId);
          const { getGmailClientForSending } = await import("../gmail-send");
          const gmail = await getGmailClientForSending(userId);
          const rawMessage = [
            `To: ${email}`, `Subject: Gear Booking Approved — ${resource?.name || 'Item'}`,
            `MIME-Version: 1.0`, `Content-Type: text/html; charset="UTF-8"`, ``,
            `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;"><h2>Your gear booking has been approved</h2><p><strong>${resource?.name || 'Item'}</strong> for ${new Date(booking.date).toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><p>Please collect from Reserve Tāmaki, 133a Line Road, Glen Innes.</p></div>`
          ].join("\r\n");
          const encoded = Buffer.from(rawMessage).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
          await gmail.users.messages.send({ userId: "me", requestBody: { raw: encoded } });
        }
      } catch (emailErr) { console.warn("Failed to send gear approval email:", emailErr); }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/gear-bookings/:id/deny", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
      const booking = await storage.getGearBooking(id);
      if (!booking) return res.status(404).json({ message: "Gear booking not found" });
      if (booking.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const updated = await storage.updateGearBooking(id, { approved: false, status: "cancelled" });
      try {
        const booker = await storage.getRegularBooker(booking.regularBookerId);
        const email = booker?.notificationsEmail || booker?.billingEmail;
        if (email) {
          const resource = await storage.getBookableResource(booking.resourceId);
          const reason = req.body.reason || "No reason provided";
          const { getGmailClientForSending } = await import("../gmail-send");
          const gmail = await getGmailClientForSending(userId);
          const rawMessage = [
            `To: ${email}`, `Subject: Gear Booking Declined — ${resource?.name || 'Item'}`,
            `MIME-Version: 1.0`, `Content-Type: text/html; charset="UTF-8"`, ``,
            `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;"><h2>Your gear booking was not approved</h2><p><strong>${resource?.name || 'Item'}</strong> for ${new Date(booking.date).toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><p><strong>Reason:</strong> ${reason}</p><p>Please contact us if you have questions — kiaora@reservetmk.co.nz</p></div>`
          ].join("\r\n");
          const encoded = Buffer.from(rawMessage).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
          await gmail.users.messages.send({ userId: "me", requestBody: { raw: encoded } });
        }
      } catch (emailErr) { console.warn("Failed to send gear denial email:", emailErr); }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
