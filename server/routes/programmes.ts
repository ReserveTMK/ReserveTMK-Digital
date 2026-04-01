import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { api } from "@shared/routes";
import { parseId, coerceDateFields, autoPromoteToInnovator, ensureProgrammeEvent } from "./_helpers";
import { classifyForAllFunders } from "../taxonomy-engine";

export function registerProgrammeRoutes(app: Express) {
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

      // Send confirmation email
      (async () => {
        try {
          const { sendRegistrationConfirmation } = await import("../email");
          await sendRegistrationConfirmation(email, {
            contactName: `${firstName} ${lastName}`,
            programmeName: programme.name,
            date: programme.startDate as any,
            time: programme.startTime ? `${programme.startTime}${programme.endTime ? ` – ${programme.endTime}` : ""}` : null,
            location: programme.location,
          });
        } catch (e) {
          console.warn("Registration confirmation email failed:", e);
        }
      })();

      res.json({ success: true, registration });
    } catch (err) {
      console.error("Registration error:", err);
      res.status(500).json({ message: "Failed to register" });
    }
  });
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

      // Create calendar event for active programmes
      ensureProgrammeEvent(programme, userId);

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

      // Create calendar event when programme becomes active/completed
      if (input.status && (input.status === "active" || input.status === "completed")) {
        ensureProgrammeEvent(updated, existing.userId);
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

  // Backfill events for existing programmes that don't have one
  app.post("/api/programmes/backfill-events", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const allProgrammes = await storage.getProgrammes(userId);
      let created = 0;
      for (const prog of allProgrammes) {
        if (prog.status === "cancelled" || prog.status === "planned") continue;
        if (!prog.startDate) continue;
        await ensureProgrammeEvent(prog, userId);
        created++;
      }
      res.json({ message: `Backfill complete`, checked: allProgrammes.length, created });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
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

  app.post('/api/programmes/:id/admin-register', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const programmeId = parseId(req.params.id);
      const programme = await storage.getProgramme(programmeId);
      if (!programme || programme.userId !== userId) {
        return res.status(404).json({ message: "Programme not found" });
      }

      const { contactId, firstName, lastName, email, phone, organization, dietaryRequirements, accessibilityNeeds } = req.body;
      if (!firstName || !lastName || !email) {
        return res.status(400).json({ message: "First name, last name, and email are required" });
      }

      // Check duplicate
      const existingRegs = await storage.getProgrammeRegistrations(programmeId);
      const alreadyRegistered = existingRegs.find(
        r => r.email.toLowerCase() === email.toLowerCase() && r.status === "registered"
      );
      if (alreadyRegistered) {
        return res.status(400).json({ message: "Already registered", code: "DUPLICATE" });
      }

      // Link or create contact
      let resolvedContactId = contactId || null;
      if (!resolvedContactId) {
        const allContacts = await storage.getContacts(userId);
        const existing = allContacts.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());
        if (existing) {
          resolvedContactId = existing.id;
          await autoPromoteToInnovator(existing.id);
        } else {
          const now = new Date();
          const newContact = await storage.createContact({
            userId,
            name: `${firstName} ${lastName}`,
            email,
            phone: phone || null,
            role: null,
            stage: "kakano",
            active: true,
            source: "admin_registration",
            isCommunityMember: true,
            isInnovator: true,
            movedToCommunityAt: now,
            movedToInnovatorsAt: now,
          } as any);
          resolvedContactId = newContact.id;
        }
      }

      const registration = await storage.createProgrammeRegistration({
        programmeId,
        contactId: resolvedContactId,
        userId,
        firstName,
        lastName,
        email,
        phone: phone || null,
        organization: organization || null,
        dietaryRequirements: dietaryRequirements || null,
        accessibilityNeeds: accessibilityNeeds || null,
        status: "registered",
        attended: false,
      });

      // Send confirmation
      (async () => {
        try {
          const { sendRegistrationConfirmation } = await import("../email");
          await sendRegistrationConfirmation(email, {
            contactName: `${firstName} ${lastName}`,
            programmeName: programme.name,
            date: programme.startDate as any,
            time: programme.startTime ? `${programme.startTime}${programme.endTime ? ` – ${programme.endTime}` : ""}` : null,
            location: programme.location,
          });
        } catch (e) { console.warn("Admin registration confirmation email failed:", e); }
      })();

      res.json({ success: true, registration });
    } catch (err: any) {
      console.error("Admin registration error:", err);
      res.status(500).json({ message: err.message || "Failed to register" });
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

      const { sendProgrammeReminderEmail } = await import("../email");
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

      const { sendProgrammeSurveyEmail } = await import("../email");
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
}
