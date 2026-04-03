import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { api } from "@shared/routes";
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { contacts, dismissedDuplicates } from "@shared/schema";
import { parseId } from "./_helpers";

export function registerContactRoutes(app: Express) {
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
          (SELECT MAX(b.start_date) FROM bookings b WHERE b.booker_id = c.id AND b.status IN ('confirmed', 'completed'))
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

  app.get("/api/contacts/delivery-depth", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const cutoffDate = sixMonthsAgo.toISOString().split("T")[0]; // YYYY-MM-DD for date comparisons

      // Gather contact IDs with access activity (bookings, gear, desk)
      const accessRows = await db.execute(sql`
        SELECT x.contact_id, bool_or(x.recent) as recent FROM (
          SELECT b.booker_id as contact_id, (b.start_date >= ${cutoffDate}::date) as recent
          FROM bookings b WHERE b.booker_id IS NOT NULL AND b.status IN ('confirmed', 'completed')
          UNION ALL
          SELECT rb.contact_id, (gb.created_at >= ${cutoffDate}::date) as recent
          FROM gear_bookings gb JOIN regular_bookers rb ON rb.id = gb.regular_booker_id WHERE rb.contact_id IS NOT NULL
          UNION ALL
          SELECT rb.contact_id, (dk.date >= ${cutoffDate}::date) as recent
          FROM desk_bookings dk JOIN regular_bookers rb ON rb.id = dk.regular_booker_id WHERE rb.contact_id IS NOT NULL
        ) x GROUP BY x.contact_id
      `);

      // Gather contact IDs with capability activity (programmes, mentoring)
      const capRows = await db.execute(sql`
        SELECT x.contact_id, bool_or(x.recent) as recent FROM (
          SELECT pr.contact_id, (pr.registered_at >= ${cutoffDate}::date) as recent
          FROM programme_registrations pr WHERE pr.contact_id IS NOT NULL AND pr.status = 'registered'
          UNION ALL
          SELECT mr.contact_id, (mr.status IN ('active', 'application')) as recent
          FROM mentoring_relationships mr WHERE mr.contact_id IS NOT NULL
          UNION ALL
          SELECT m.contact_id, (m.start_time >= ${cutoffDate}::date) as recent
          FROM meetings m WHERE m.contact_id IS NOT NULL AND m.status IN ('completed', 'confirmed')
            AND m.type IN (SELECT mt.name FROM meeting_types mt WHERE mt.user_id = ${userId} AND mt.category = 'mentoring' AND mt.is_active = true)
        ) x GROUP BY x.contact_id
      `);

      // Get user's contact IDs for filtering
      const userContacts = await db.execute(sql`
        SELECT id FROM contacts WHERE user_id = ${userId} AND is_archived = false
      `);
      const userContactIds = new Set(((userContacts as any).rows || []).map((r: any) => r.id));

      // Build maps (bool_or returns boolean but Drizzle may return string)
      const toBool = (v: any) => v === true || v === "true" || v === "t";

      const accessMap = new Map<number, boolean>();
      for (const r of (accessRows as any).rows || []) {
        if (!userContactIds.has(r.contact_id)) continue;
        accessMap.set(r.contact_id, toBool(r.recent));
      }

      const capMap = new Map<number, boolean>();
      for (const r of (capRows as any).rows || []) {
        if (!userContactIds.has(r.contact_id)) continue;
        capMap.set(r.contact_id, toBool(r.recent));
      }

      // Compute delivery depth per contact
      const allIds = new Set([...accessMap.keys(), ...capMap.keys()]);
      const result: Record<number, { depth: string; active: boolean }> = {};

      for (const id of allIds) {
        const recentAccess = accessMap.get(id) || false;
        const recentCap = capMap.get(id) || false;
        const anyAccess = accessMap.has(id);
        const anyCap = capMap.has(id);

        let depth: string;
        if (recentAccess && recentCap) depth = "both";
        else if (recentAccess) depth = "access";
        else if (recentCap) depth = "capability";
        else if (anyAccess || anyCap) depth = "past";
        else depth = "none";

        result[id] = { depth, active: recentAccess || recentCap };
      }

      res.json(result);
    } catch (err: any) {
      console.error("Delivery depth error:", err);
      res.status(500).json({ message: "Failed to compute delivery depth" });
    }
  });

  app.get("/api/contacts/needs-attention", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const threshold = parseInt(req.query.days as string) || 60;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - threshold);
      const cutoffISO = cutoff.toISOString();

      const rows = await db.execute(sql`
        SELECT c.id, c.name, c.connection_strength, c.is_vip, c.email, c.linked_group_id,
          GREATEST(
            (SELECT MAX(m.start_time) FROM meetings m WHERE m.contact_id = c.id AND m.status IN ('completed', 'confirmed')),
            (SELECT MAX(e.start_time) FROM events e JOIN event_attendance ea ON ea.event_id = e.id WHERE ea.contact_id = c.id),
            (SELECT MAX(il.created_at) FROM impact_logs il JOIN impact_log_contacts ilc ON ilc.impact_log_id = il.id WHERE ilc.contact_id = c.id AND il.status = 'confirmed'),
            (SELECT MAX(b.start_date) FROM bookings b WHERE b.booker_id = c.id AND b.status IN ('confirmed', 'completed'))
          ) as last_touchpoint
        FROM contacts c
        WHERE c.user_id = ${userId}
          AND c.is_archived = false
          AND c.active = true
          AND c.connection_strength IN ('trusted', 'woven')
        HAVING GREATEST(
          (SELECT MAX(m.start_time) FROM meetings m WHERE m.contact_id = c.id AND m.status IN ('completed', 'confirmed')),
          (SELECT MAX(e.start_time) FROM events e JOIN event_attendance ea ON ea.event_id = e.id WHERE ea.contact_id = c.id),
          (SELECT MAX(il.created_at) FROM impact_logs il JOIN impact_log_contacts ilc ON ilc.impact_log_id = il.id WHERE ilc.contact_id = c.id AND il.status = 'confirmed'),
          (SELECT MAX(b.start_date) FROM bookings b WHERE b.booker_id = c.id AND b.status IN ('confirmed', 'completed'))
        ) < ${cutoffISO}::timestamp
        OR GREATEST(
          (SELECT MAX(m.start_time) FROM meetings m WHERE m.contact_id = c.id AND m.status IN ('completed', 'confirmed')),
          (SELECT MAX(e.start_time) FROM events e JOIN event_attendance ea ON ea.event_id = e.id WHERE ea.contact_id = c.id),
          (SELECT MAX(il.created_at) FROM impact_logs il JOIN impact_log_contacts ilc ON ilc.impact_log_id = il.id WHERE ilc.contact_id = c.id AND il.status = 'confirmed'),
          (SELECT MAX(b.start_date) FROM bookings b WHERE b.booker_id = c.id AND b.status IN ('confirmed', 'completed'))
        ) IS NULL
        ORDER BY last_touchpoint ASC NULLS FIRST
      `);

      const items = ((rows as any).rows || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        connectionStrength: r.connection_strength,
        isVip: r.is_vip,
        email: r.email,
        linkedGroupId: r.linked_group_id,
        lastTouchpoint: r.last_touchpoint ? new Date(r.last_touchpoint).toISOString() : null,
        daysSince: r.last_touchpoint ? Math.floor((Date.now() - new Date(r.last_touchpoint).getTime()) / (1000 * 60 * 60 * 24)) : null,
      }));
      res.json(items);
    } catch (err: any) {
      console.error("Needs attention error:", err);
      res.status(500).json({ message: "Failed to get needs-attention contacts" });
    }
  });

  app.get("/api/ecosystem/reach", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;

      // Note: groups don't have connection_strength yet (Phase 5 will add it)
      // For now, count Māori flags without connection depth filtering
      const groupStats = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE is_maori = true AND is_community = true) as maori_led_trusted,
          COUNT(*) FILTER (WHERE serves_maori = true AND is_community = true) as serves_maori_trusted,
          COUNT(*) FILTER (WHERE is_maori = true) as maori_led_total,
          COUNT(*) FILTER (WHERE serves_maori = true) as serves_maori_total,
          COUNT(*) FILTER (WHERE is_community = true OR is_innovator = true) as connected_total,
          COUNT(*) as total_orgs
        FROM groups
        WHERE user_id = ${userId} AND active = true
      `);

      const quarterStart = new Date();
      quarterStart.setMonth(Math.floor(quarterStart.getMonth() / 3) * 3, 1);
      quarterStart.setHours(0, 0, 0, 0);

      const movements = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE
            (CASE WHEN new_stage = 'woven' THEN 4 WHEN new_stage = 'trusted' THEN 3 WHEN new_stage = 'connected' THEN 2 WHEN new_stage = 'aware' THEN 1 ELSE 0 END)
            >
            (CASE WHEN previous_stage = 'woven' THEN 4 WHEN previous_stage = 'trusted' THEN 3 WHEN previous_stage = 'connected' THEN 2 WHEN previous_stage = 'aware' THEN 1 ELSE 0 END)
          ) as deepened,
          COUNT(*) FILTER (WHERE
            (CASE WHEN new_stage = 'woven' THEN 4 WHEN new_stage = 'trusted' THEN 3 WHEN new_stage = 'connected' THEN 2 WHEN new_stage = 'aware' THEN 1 ELSE 0 END)
            <
            (CASE WHEN previous_stage = 'woven' THEN 4 WHEN previous_stage = 'trusted' THEN 3 WHEN previous_stage = 'connected' THEN 2 WHEN previous_stage = 'aware' THEN 1 ELSE 0 END)
          ) as declined
        FROM relationship_stage_history
        WHERE change_type = 'connection'
          AND changed_at >= ${quarterStart.toISOString()}::timestamp
      `);

      const gs = (groupStats as any).rows?.[0] || {};
      const mv = (movements as any).rows?.[0] || {};

      res.json({
        maoriLedTrusted: Number(gs.maori_led_trusted || 0),
        servesMaoriTrusted: Number(gs.serves_maori_trusted || 0),
        maoriLedTotal: Number(gs.maori_led_total || 0),
        servesMaoriTotal: Number(gs.serves_maori_total || 0),
        connectedTotal: Number(gs.connected_total || 0),
        totalOrgs: Number(gs.total_orgs || 0),
        connectionMovements: {
          deepened: Number(mv.deepened || 0),
          declined: Number(mv.declined || 0),
        },
      });
    } catch (err: any) {
      console.error("Ecosystem reach error:", err);
      res.status(500).json({ message: "Failed to get ecosystem reach" });
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

}
