import type { Express } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import {
  api,
} from "@shared/routes";
import {
  insertOrganisationProfileSchema,
  interactions,
  meetings,
  actionItems,
  consentRecords,
  memberships,
  mous,
  milestones,
  communitySpend,
  eventAttendance,
  impactLogContacts,
  groupMembers,
  bookings,
  programmes,
  contacts,
  impactLogGroups,
  DEFAULT_VENUE_AVAILABILITY_SCHEDULE,
} from "@shared/schema";
import { parseId, coerceDateFields, autoPromoteToInnovator } from "./_helpers";
import { claudeJSON, AIKeyMissingError } from "../replit_integrations/anthropic/client";
import { getDeliveryMetrics, PASIFIKA_ETHNICITIES, type ReportFilters } from "../reporting";

export function registerSettingsRoutes(app: Express) {
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

      const membershipsList = await storage.getContactGroups(contactId);
      const membership = membershipsList.find((m: any) => m.groupId === groupId);
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
          const contactsList = await Promise.all(contactIds.map(cid => storage.getContact(cid)));
          const emails = contactsList
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

      const impactLogsList = await storage.getImpactLogs(userId);
      for (const log of impactLogsList) {
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
          const allContactsList = await Promise.all(members.map(mem => storage.getContact(mem.contactId)));
          const hasCommunityMembers = allContactsList.some(c => c && c.isCommunityMember);

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

  // === Operating Hours ===

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

  // === After-Hours Settings ===

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

  // === Booking Reminder Settings ===

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

  // === Xero Integration ===

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
      const { getXeroAuthUrl, createOAuthState } = await import("../xero");
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
      const { exchangeCodeForTokens, validateOAuthState } = await import("../xero");
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
      const { syncContactToXero } = await import("../xero");
      const xeroContactId = await syncContactToXero(userId, contactId);
      res.json({ success: true, xeroContactId });
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

      // Pull data via shared functions
      const narrativeFilters: ReportFilters = { userId, startDate: startDate, endDate: endDate };
      const delivery = await getDeliveryMetrics(narrativeFilters);

      const activations = delivery.totalActivations;
      const mentoringSessions = delivery.mentoringSessions;
      const ecosystemMeetings = delivery.partnerMeetings;
      const programmeCount = delivery.programmes.total;

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

      // Maori & Pasifika breakdown
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

      // Pull confirmed debriefs with summaries
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
      const allLogContacts = logIds.length > 0
        ? ((await db.execute(sql`
            SELECT ilc.impact_log_id, c.name, c.ethnicity FROM impact_log_contacts ilc
            JOIN contacts c ON c.id = ilc.contact_id
            WHERE ilc.impact_log_id = ANY(${logIds})
          `)) as any).rows || []
        : [];
      const contactsByLog = new Map<number, string[]>();
      for (const r of allLogContacts) {
        const names = contactsByLog.get(r.impact_log_id) || [];
        names.push(r.name);
        contactsByLog.set(r.impact_log_id, names);
      }
      const logsWithContacts = topLogs.map(log => ({
        title: log.title,
        summary: log.summary,
        contacts: (contactsByLog.get(log.id) || []).join(", "),
      }));

      // AI narrative generation
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
- Programmes delivered: ${programmeCount}
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
          programmes: programmeCount,
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
          const { getGmailClientForSending } = await import("../gmail-send");
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
          const { getGmailClientForSending } = await import("../gmail-send");
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
}
