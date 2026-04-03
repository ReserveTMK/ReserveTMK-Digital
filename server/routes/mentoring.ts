import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { api } from "@shared/routes";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { meetings, mentorProfiles, meetingTypes, contacts, insertMeetingTypeSchema, insertMentoringRelationshipSchema, insertMentoringApplicationSchema, SESSION_FREQUENCIES, JOURNEY_STAGES } from "@shared/schema";
import { fromZonedTime } from "date-fns-tz";
import { parseId, parseStr, isPublicHoliday, autoPromoteToInnovator, ensureMeetingEvent } from "./_helpers";

// Google Calendar helper — creates event for a meeting
async function createCalendarEventForMeeting(calUserId: string, meeting: any, options?: { mentorEmail?: string; coMentorEmail?: string; menteeEmail?: string; calendarId?: string; sendInvites?: boolean; additionalAttendees?: string[] }) {
  try {
    const { getUncachableGoogleCalendarClient } = await import("../replit_integrations/google-calendar/client");
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
    if (event.data.id) await storage.updateMeeting(meeting.id, { googleCalendarEventId: event.data.id });
    return event.data.id;
  } catch (err: any) {
    console.error("Google Calendar event creation failed:", err.message, err.response?.data || "");
    return null;
  }
}

async function updateCalendarEventAttendees(calUserId: string, googleCalendarEventId: string, attendees: { email: string }[], calendarId?: string, sendInvites?: boolean) {
  try {
    const { getUncachableGoogleCalendarClient } = await import("../replit_integrations/google-calendar/client");
    const calendar = await getUncachableGoogleCalendarClient(calUserId);
    const calId = calendarId || "primary";
    await calendar.events.get({ calendarId: calId, eventId: googleCalendarEventId });
    await calendar.events.patch({ calendarId: calId, eventId: googleCalendarEventId, sendUpdates: sendInvites ? "all" : "none", requestBody: { attendees } });
  } catch (err: any) {
    console.warn("Google Calendar event update skipped:", err.message);
  }
}

export function registerMentoringRoutes(app: Express) {

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

      // Block meetings on public holidays
      if (await isPublicHoliday(userId, input.startTime)) {
        return res.status(400).json({ message: "Cannot schedule a meeting on a public holiday. Reserve Tāmaki is closed." });
      }

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

      // Create calendar event when meeting becomes completed/confirmed
      if (input.status && (input.status === "completed" || input.status === "confirmed")) {
        ensureMeetingEvent(updated, existing.userId);
      }

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

      // Create calendar event for completed meeting
      ensureMeetingEvent({ ...meeting, status: "completed" }, meeting.userId || userId);

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

      const { sendSessionNotesEmail } = await import("../email");
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
        const { getUncachableGoogleCalendarClient } = await import("../replit_integrations/google-calendar/client");
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

      // Send confirmation email
      if (email) {
        (async () => {
          try {
            const profiles = await storage.getMentorProfiles(contactOwnerUserId);
            const mentorProfile = profiles.find(p => p.mentorUserId === meetingUserId || `mentor-${p.id}` === meetingUserId);
            const mentorName = mentorProfile?.name || "your mentor";
            const timeStr = `${time} (${slotDuration} min)`;
            const { sendMentoringBookingConfirmation } = await import("../email");
            await sendMentoringBookingConfirmation(email, {
              contactName: name,
              mentorName,
              date,
              time: timeStr,
            });
          } catch (e) {
            console.warn("Mentoring booking confirmation email failed:", e);
          }
        })();
      }

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

  // Backfill events for existing completed/confirmed meetings
  app.post("/api/meetings/backfill-events", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const allMeetings = await storage.getMeetings(userId);
      let created = 0;
      for (const m of allMeetings) {
        if (m.status === "cancelled") continue;
        if (!m.startTime) continue;
        if (m.status === "completed" || m.status === "confirmed") {
          await ensureMeetingEvent(m, userId);
          created++;
        }
      }
      res.json({ message: "Backfill complete", checked: allMeetings.length, processed: created });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

}
