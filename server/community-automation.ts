/**
 * Community Connection Strength Automation
 *
 * Auto-computes connection strength for contacts and groups based on
 * real activity data. Contacts earn their level through touchpoints;
 * groups derive theirs from member strengths.
 *
 * Strength levels (aware → connected → trusted → woven) map to:
 *   aware     = exists, no recent activity
 *   connected = 1+ touchpoint in last 6 months
 *   trusted   = 3+ touchpoints across 2+ types, or active mentoring
 *   woven     = 6+ touchpoints across 3+ types, or 4+ sustained months
 */

import { db } from "./db";
import { storage } from "./storage";
import { sql } from "drizzle-orm";

// --- Thresholds (tune these if distribution looks off) ---
const CONNECTED_MIN_TOUCHPOINTS = 1;
const TRUSTED_MIN_TOUCHPOINTS = 3;
const TRUSTED_MIN_TYPES = 2;
const WOVEN_MIN_TOUCHPOINTS = 6;
const WOVEN_MIN_TYPES = 3;
const WOVEN_SUSTAINED_MONTHS = 4;
const GROUP_TRUSTED_CONSENSUS = 3; // members at trusted+ for group to be trusted
const LOOKBACK_MONTHS = 12;
const CONNECTED_LOOKBACK_MONTHS = 6;
const ACTIVE_DAYS = 90;
const OCCASIONAL_DAYS = 180;

const STRENGTH_RANK: Record<string, number> = {
  aware: 1,
  connected: 2,
  trusted: 3,
  woven: 4,
};

function strengthFromRank(rank: number): string {
  return Object.entries(STRENGTH_RANK).find(([, r]) => r === rank)?.[0] || "aware";
}

// --- Single contact computation ---

type ContactStrengthResult = {
  computed: string;
  touchpointCount: number;
  touchpointTypes: number;
  sustainedMonths: number;
  hasActiveMentoring: boolean;
};

export async function computeContactStrength(
  contactId: number,
  userId: string
): Promise<ContactStrengthResult> {
  const lookback = new Date();
  lookback.setMonth(lookback.getMonth() - LOOKBACK_MONTHS);
  const sixMonths = new Date();
  sixMonths.setMonth(sixMonths.getMonth() - CONNECTED_LOOKBACK_MONTHS);

  const result = await db.execute(sql`
    WITH meeting_tp AS (
      SELECT COUNT(*) as cnt,
        COUNT(*) FILTER (WHERE start_time >= ${sixMonths.toISOString()}::timestamp) as recent
      FROM meetings
      WHERE contact_id = ${contactId} AND status IN ('completed', 'confirmed')
        AND start_time >= ${lookback.toISOString()}::timestamp
    ),
    event_tp AS (
      SELECT COUNT(*) as cnt,
        COUNT(*) FILTER (WHERE e.start_time >= ${sixMonths.toISOString()}::timestamp) as recent
      FROM event_attendance ea
      JOIN events e ON e.id = ea.event_id
      WHERE ea.contact_id = ${contactId}
        AND e.start_time >= ${lookback.toISOString()}::timestamp
    ),
    debrief_tp AS (
      SELECT COUNT(*) as cnt,
        COUNT(*) FILTER (WHERE il.confirmed_at >= ${sixMonths.toISOString()}::timestamp OR il.created_at >= ${sixMonths.toISOString()}::timestamp) as recent
      FROM impact_log_contacts ilc
      JOIN impact_logs il ON il.id = ilc.impact_log_id
      WHERE ilc.contact_id = ${contactId} AND il.status = 'confirmed'
        AND COALESCE(il.confirmed_at, il.created_at) >= ${lookback.toISOString()}::timestamp
    ),
    booking_tp AS (
      SELECT COUNT(*) as cnt,
        COUNT(*) FILTER (WHERE start_date >= ${sixMonths.toISOString()}::timestamp) as recent
      FROM bookings
      WHERE booker_id = ${contactId} AND status IN ('confirmed', 'completed')
        AND start_date >= ${lookback.toISOString()}::timestamp
    ),
    spend_tp AS (
      SELECT COUNT(*) as cnt,
        COUNT(*) FILTER (WHERE date >= ${sixMonths.toISOString()}::timestamp) as recent
      FROM community_spend
      WHERE contact_id = ${contactId}
        AND date >= ${lookback.toISOString()}::timestamp
    ),
    interaction_tp AS (
      SELECT COUNT(*) as cnt,
        COUNT(*) FILTER (WHERE date >= ${sixMonths.toISOString()}::timestamp) as recent
      FROM interactions
      WHERE contact_id = ${contactId}
        AND date >= ${lookback.toISOString()}::timestamp
    ),
    programme_tp AS (
      SELECT COUNT(*) as cnt,
        COUNT(*) FILTER (WHERE registered_at >= ${sixMonths.toISOString()}::timestamp) as recent
      FROM programme_registrations
      WHERE contact_id = ${contactId} AND attended = true
        AND registered_at >= ${lookback.toISOString()}::timestamp
    ),
    mentoring_check AS (
      SELECT EXISTS(
        SELECT 1 FROM mentoring_relationships
        WHERE contact_id = ${contactId} AND status = 'active'
      ) as active
    ),
    sustained AS (
      SELECT COUNT(DISTINCT DATE_TRUNC('month', dt)) as months FROM (
        SELECT start_time as dt FROM meetings WHERE contact_id = ${contactId} AND status IN ('completed','confirmed') AND start_time >= ${lookback.toISOString()}::timestamp
        UNION ALL
        SELECT e.start_time FROM event_attendance ea JOIN events e ON e.id = ea.event_id WHERE ea.contact_id = ${contactId} AND e.start_time >= ${lookback.toISOString()}::timestamp
        UNION ALL
        SELECT COALESCE(il.confirmed_at, il.created_at) FROM impact_log_contacts ilc JOIN impact_logs il ON il.id = ilc.impact_log_id WHERE ilc.contact_id = ${contactId} AND il.status = 'confirmed' AND COALESCE(il.confirmed_at, il.created_at) >= ${lookback.toISOString()}::timestamp
        UNION ALL
        SELECT start_date FROM bookings WHERE booker_id = ${contactId} AND status IN ('confirmed','completed') AND start_date >= ${lookback.toISOString()}::timestamp
        UNION ALL
        SELECT date FROM community_spend WHERE contact_id = ${contactId} AND date >= ${lookback.toISOString()}::timestamp
        UNION ALL
        SELECT date FROM interactions WHERE contact_id = ${contactId} AND date >= ${lookback.toISOString()}::timestamp
        UNION ALL
        SELECT registered_at FROM programme_registrations WHERE contact_id = ${contactId} AND attended = true AND registered_at >= ${lookback.toISOString()}::timestamp
      ) all_dates
    )
    SELECT
      (SELECT cnt FROM meeting_tp) as meeting_cnt,
      (SELECT cnt FROM event_tp) as event_cnt,
      (SELECT cnt FROM debrief_tp) as debrief_cnt,
      (SELECT cnt FROM booking_tp) as booking_cnt,
      (SELECT cnt FROM spend_tp) as spend_cnt,
      (SELECT cnt FROM interaction_tp) as interaction_cnt,
      (SELECT cnt FROM programme_tp) as programme_cnt,
      (SELECT recent FROM meeting_tp) as meeting_recent,
      (SELECT recent FROM event_tp) as event_recent,
      (SELECT recent FROM debrief_tp) as debrief_recent,
      (SELECT recent FROM booking_tp) as booking_recent,
      (SELECT recent FROM spend_tp) as spend_recent,
      (SELECT recent FROM interaction_tp) as interaction_recent,
      (SELECT recent FROM programme_tp) as programme_recent,
      (SELECT active FROM mentoring_check) as has_mentoring,
      (SELECT months FROM sustained) as sustained_months
  `);

  const row = (result as any).rows?.[0] || {};
  const counts = {
    meetings: Number(row.meeting_cnt || 0),
    events: Number(row.event_cnt || 0),
    debriefs: Number(row.debrief_cnt || 0),
    bookings: Number(row.booking_cnt || 0),
    spend: Number(row.spend_cnt || 0),
    interactions: Number(row.interaction_cnt || 0),
    programmes: Number(row.programme_cnt || 0),
  };
  const recentCounts = {
    meetings: Number(row.meeting_recent || 0),
    events: Number(row.event_recent || 0),
    debriefs: Number(row.debrief_recent || 0),
    bookings: Number(row.booking_recent || 0),
    spend: Number(row.spend_recent || 0),
    interactions: Number(row.interaction_recent || 0),
    programmes: Number(row.programme_recent || 0),
  };

  const touchpointCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const touchpointTypes = Object.values(counts).filter(c => c > 0).length;
  const recentTotal = Object.values(recentCounts).reduce((a, b) => a + b, 0);
  const sustainedMonths = Number(row.sustained_months || 0);
  const hasActiveMentoring = row.has_mentoring === true;

  let computed: string;
  if (
    (touchpointCount >= WOVEN_MIN_TOUCHPOINTS && touchpointTypes >= WOVEN_MIN_TYPES) ||
    sustainedMonths >= WOVEN_SUSTAINED_MONTHS
  ) {
    computed = "woven";
  } else if (
    (touchpointCount >= TRUSTED_MIN_TOUCHPOINTS && touchpointTypes >= TRUSTED_MIN_TYPES) ||
    hasActiveMentoring
  ) {
    computed = "trusted";
  } else if (recentTotal >= CONNECTED_MIN_TOUCHPOINTS) {
    computed = "connected";
  } else {
    computed = "aware";
  }

  return { computed, touchpointCount, touchpointTypes, sustainedMonths, hasActiveMentoring };
}

// --- Group computation ---

export async function computeGroupStrength(
  groupId: number,
  userId: string
): Promise<{ computed: string; memberStrengths: Record<string, number> }> {
  const result = await db.execute(sql`
    SELECT c.connection_strength
    FROM group_members gm
    JOIN contacts c ON c.id = gm.contact_id
    WHERE gm.group_id = ${groupId} AND c.is_archived = false AND c.active = true
  `);

  const memberStrengths: Record<string, number> = { aware: 0, connected: 0, trusted: 0, woven: 0 };
  let maxRank = 0;

  for (const row of (result as any).rows || []) {
    const strength = row.connection_strength || "aware";
    memberStrengths[strength] = (memberStrengths[strength] || 0) + 1;
    const rank = STRENGTH_RANK[strength] || 0;
    if (rank > maxRank) maxRank = rank;
  }

  // Consensus: if 3+ members are trusted or higher, group is at least trusted
  const trustedPlus = (memberStrengths.trusted || 0) + (memberStrengths.woven || 0);
  if (trustedPlus >= GROUP_TRUSTED_CONSENSUS && maxRank < STRENGTH_RANK.trusted) {
    maxRank = STRENGTH_RANK.trusted;
  }

  return { computed: strengthFromRank(maxRank || 1), memberStrengths };
}

export async function computeGroupEngagement(
  groupId: number,
  userId: string
): Promise<string> {
  const result = await db.execute(sql`
    SELECT GREATEST(
      (SELECT MAX(e.start_time) FROM events e
       JOIN event_attendance ea ON ea.event_id = e.id
       JOIN group_members gm ON gm.contact_id = ea.contact_id AND gm.group_id = ${groupId}
       WHERE e.user_id = ${userId}),
      (SELECT MAX(COALESCE(b.start_date, b.created_at)) FROM bookings b
       WHERE b.booker_group_id = ${groupId} AND b.user_id = ${userId}),
      (SELECT MAX(cs.date) FROM community_spend cs
       WHERE cs.group_id = ${groupId} AND cs.user_id = ${userId}),
      (SELECT MAX(ilg.created_at) FROM impact_log_groups ilg
       WHERE ilg.group_id = ${groupId})
    ) as last_date
  `);

  const lastDate = (result as any).rows?.[0]?.last_date;
  if (!lastDate) return "Dormant";

  const daysSince = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
  if (daysSince <= ACTIVE_DAYS) return "Active";
  if (daysSince <= OCCASIONAL_DAYS) return "Occasional";
  return "Dormant";
}

// --- Recalc functions ---

type RecalcChange = {
  entityType: "contact" | "group";
  entityId: number;
  name: string;
  from: string | null;
  to: string;
  field: "connectionStrength" | "engagementLevel";
};

export async function recalcContact(
  contactId: number,
  userId: string
): Promise<RecalcChange[]> {
  const changes: RecalcChange[] = [];

  try {
    const contact = await storage.getContact(contactId);
    if (!contact || contact.isArchived) return changes;

    const { computed } = await computeContactStrength(contactId, userId);
    const current = contact.connectionStrength || "aware";
    const currentRank = STRENGTH_RANK[current] || 1;
    const computedRank = STRENGTH_RANK[computed] || 1;

    // Respect manual override: only skip if override=true AND current is higher
    const hasOverride = (contact as any).connectionStrengthOverride === true;
    if (hasOverride && currentRank > computedRank) {
      // Manual override is higher — keep it
    } else if (computed !== current) {
      await storage.updateContact(contactId, { connectionStrength: computed });
      await storage.createRelationshipStageHistory({
        entityType: "contact",
        entityId: contactId,
        changeType: "connection",
        previousStage: current,
        newStage: computed,
        changedBy: "system",
      });
      changes.push({
        entityType: "contact",
        entityId: contactId,
        name: contact.name,
        from: current,
        to: computed,
        field: "connectionStrength",
      });
    }

    // Recalc all linked groups
    const contactGroups = await storage.getContactGroups(contactId);
    const groupIds: number[] = contactGroups.map((g: any) => g.groupId as number);
    const linkedGroupId = (contact as any).linkedGroupId;
    if (linkedGroupId && !groupIds.includes(linkedGroupId)) groupIds.push(linkedGroupId);

    for (const gid of groupIds) {
      const groupChanges = await recalcGroup(gid, userId);
      changes.push(...groupChanges);
    }
  } catch (err) {
    console.warn(`recalcContact(${contactId}) failed:`, err);
  }

  return changes;
}

export async function recalcGroup(
  groupId: number,
  userId: string
): Promise<RecalcChange[]> {
  const changes: RecalcChange[] = [];

  try {
    const group = await storage.getGroup(groupId);
    if (!group || !group.active) return changes;

    // Connection strength from members
    const { computed } = await computeGroupStrength(groupId, userId);
    const currentStrength = group.connectionStrength || "aware";
    if (computed !== currentStrength) {
      await storage.updateGroup(groupId, { connectionStrength: computed });
      await storage.createRelationshipStageHistory({
        entityType: "group",
        entityId: groupId,
        changeType: "connection",
        previousStage: currentStrength,
        newStage: computed,
        changedBy: "system",
      });
      changes.push({
        entityType: "group",
        entityId: groupId,
        name: group.name,
        from: currentStrength,
        to: computed,
        field: "connectionStrength",
      });
    }

    // Engagement level from activity
    const engagement = await computeGroupEngagement(groupId, userId);
    if (engagement !== group.engagementLevel) {
      await storage.updateGroup(groupId, { engagementLevel: engagement as any });
      changes.push({
        entityType: "group",
        entityId: groupId,
        name: group.name,
        from: group.engagementLevel || null,
        to: engagement,
        field: "engagementLevel",
      });
    }
  } catch (err) {
    console.warn(`recalcGroup(${groupId}) failed:`, err);
  }

  return changes;
}

// --- Batch recalc ---

type RecalcSummary = {
  contactsProcessed: number;
  groupsProcessed: number;
  contactsUpdated: number;
  groupsUpdated: number;
  changes: RecalcChange[];
};

export async function recalcAll(
  userId: string,
  dryRun = false
): Promise<RecalcSummary> {
  const allContacts = await storage.getContacts(userId);
  const activeContacts = allContacts.filter(c => !c.isArchived && c.active !== false);

  const changes: RecalcChange[] = [];

  // Phase 1: Compute all contact strengths
  for (const contact of activeContacts) {
    try {
      const { computed } = await computeContactStrength(contact.id, userId);
      const current = contact.connectionStrength || "aware";
      const currentRank = STRENGTH_RANK[current] || 1;
      const computedRank = STRENGTH_RANK[computed] || 1;

      const hasOverride = (contact as any).connectionStrengthOverride === true;
      if (hasOverride && currentRank > computedRank) continue;
      if (computed === current) continue;

      if (!dryRun) {
        await storage.updateContact(contact.id, { connectionStrength: computed });
        await storage.createRelationshipStageHistory({
          entityType: "contact",
          entityId: contact.id,
          changeType: "connection",
          previousStage: current,
          newStage: computed,
          changedBy: "system",
        });
      }
      changes.push({
        entityType: "contact",
        entityId: contact.id,
        name: contact.name,
        from: current,
        to: computed,
        field: "connectionStrength",
      });
    } catch (err) {
      console.warn(`recalcAll contact ${contact.id} failed:`, err);
    }
  }

  // Phase 2: Compute all group strengths + engagement (after contacts are updated)
  const allGroups = await storage.getGroups(userId);
  const activeGroups = allGroups.filter((g: any) => g.active !== false);

  for (const group of activeGroups) {
    try {
      const { computed } = await computeGroupStrength(group.id, userId);
      const currentStrength = group.connectionStrength || "aware";
      if (computed !== currentStrength) {
        if (!dryRun) {
          await storage.updateGroup(group.id, { connectionStrength: computed });
          await storage.createRelationshipStageHistory({
            entityType: "group",
            entityId: group.id,
            changeType: "connection",
            previousStage: currentStrength,
            newStage: computed,
            changedBy: "system",
          });
        }
        changes.push({
          entityType: "group",
          entityId: group.id,
          name: group.name,
          from: currentStrength,
          to: computed,
          field: "connectionStrength",
        });
      }

      const engagement = await computeGroupEngagement(group.id, userId);
      if (engagement !== group.engagementLevel) {
        if (!dryRun) {
          await storage.updateGroup(group.id, { engagementLevel: engagement as any });
        }
        changes.push({
          entityType: "group",
          entityId: group.id,
          name: group.name,
          from: group.engagementLevel || null,
          to: engagement,
          field: "engagementLevel",
        });
      }
    } catch (err) {
      console.warn(`recalcAll group ${group.id} failed:`, err);
    }
  }

  const contactChanges = changes.filter(c => c.entityType === "contact");
  const groupChanges = changes.filter(c => c.entityType === "group");

  return {
    contactsProcessed: activeContacts.length,
    groupsProcessed: activeGroups.length,
    contactsUpdated: new Set(contactChanges.map(c => c.entityId)).size,
    groupsUpdated: new Set(groupChanges.map(c => c.entityId)).size,
    changes,
  };
}
