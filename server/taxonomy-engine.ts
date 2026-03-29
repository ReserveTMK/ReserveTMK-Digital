/**
 * Funder Taxonomy Classification Engine
 *
 * Processes tracked data (debriefs, bookings, programmes, events) through
 * each funder's taxonomy lens automatically. No manual tagging required.
 *
 * Four-pass pipeline (cheap → expensive):
 * 1. Generic inheritance — map existing impact_tags through funder taxonomy mappings
 * 2. Rule-based — evaluate structural rules (communityLens, contact flags, group flags)
 * 3. Keyword matching — scan entity text against funder category keywords
 * 4. AI classification — gated, debriefs only, when passes 1-3 are ambiguous
 */

import { db } from "./db";
import { storage } from "./storage";
import { eq, and, inArray } from "drizzle-orm";
import {
  funderTaxonomyCategories,
  funderTaxonomyClassifications,
  funderTaxonomyMappings,
  impactTags,
  funders,
  contacts,
  groups,
  type FunderTaxonomyCategory,
  type FunderTaxonomyClassification,
} from "@shared/schema";

interface ClassificationResult {
  funderCategoryId: number;
  confidence: number;
  source: "rule" | "keyword" | "ai" | "generic_inherit";
  evidence: string;
}

interface EntityContext {
  type: "debrief" | "booking" | "programme" | "event";
  id: number;
  entityDate: Date;
  text: string; // concatenated searchable text
  contactIds: number[];
  groupIds: number[];
  classification?: string; // booking/programme classification
  eventType?: string; // event type
}

/**
 * Classify a single entity through all active funders' taxonomy lenses.
 * Called when a debrief is confirmed, booking completed, etc.
 */
export async function classifyForAllFunders(
  entityType: "debrief" | "booking" | "programme" | "event",
  entityId: number,
  userId: string,
): Promise<void> {
  const activeFunders = await db
    .select({ id: funders.id })
    .from(funders)
    .where(and(eq(funders.userId, userId), eq(funders.status, "active_funder")));

  if (activeFunders.length === 0) return;

  const context = await buildEntityContext(entityType, entityId);
  if (!context) return;

  for (const funder of activeFunders) {
    await classifyForFunder(funder.id, context, userId);
  }
}

/**
 * Classify a single entity through one funder's taxonomy lens.
 */
export async function classifyForFunder(
  funderId: number,
  context: EntityContext,
  userId: string,
): Promise<ClassificationResult[]> {
  const categories = await db
    .select()
    .from(funderTaxonomyCategories)
    .where(
      and(
        eq(funderTaxonomyCategories.funderId, funderId),
        eq(funderTaxonomyCategories.active, true),
      ),
    );

  if (categories.length === 0) return [];

  // Run all passes, collect results per category
  const resultMap = new Map<number, ClassificationResult>();

  // Pass 1: Generic taxonomy inheritance (debriefs only)
  if (context.type === "debrief") {
    const inherited = await passGenericInheritance(context.id, categories);
    for (const r of inherited) {
      updateBest(resultMap, r);
    }
  }

  // Pass 2: Rule-based matching
  const ruleResults = await passRuleBased(context, categories, userId);
  for (const r of ruleResults) {
    updateBest(resultMap, r);
  }

  // Pass 3: Keyword matching
  const keywordResults = passKeywordMatching(context, categories);
  for (const r of keywordResults) {
    updateBest(resultMap, r);
  }

  // Pass 4: AI classification (debriefs only, gated)
  // Only if max confidence from passes 1-3 is below 60
  if (context.type === "debrief" && context.text.length > 100) {
    const maxConf = Math.max(0, ...Array.from(resultMap.values()).map((r) => r.confidence));
    if (maxConf < 60) {
      const aiResults = await passAIClassification(context, categories);
      for (const r of aiResults) {
        updateBest(resultMap, r);
      }
    }
  }

  const results = Array.from(resultMap.values());

  // Upsert classifications (delete existing, insert new)
  await db
    .delete(funderTaxonomyClassifications)
    .where(
      and(
        eq(funderTaxonomyClassifications.funderId, funderId),
        eq(funderTaxonomyClassifications.entityType, context.type),
        eq(funderTaxonomyClassifications.entityId, context.id),
      ),
    );

  if (results.length > 0) {
    await db.insert(funderTaxonomyClassifications).values(
      results.map((r) => ({
        funderId,
        funderCategoryId: r.funderCategoryId,
        entityType: context.type,
        entityId: context.id,
        entityDate: context.entityDate,
        confidence: r.confidence,
        source: r.source,
        evidence: r.evidence,
      })),
    );
  }

  return results;
}

/**
 * Reclassify all entities for a funder within a date range.
 * Used when funder taxonomy is updated.
 */
export async function reclassifyAllForFunder(
  funderId: number,
  userId: string,
  startDate?: Date,
  endDate?: Date,
): Promise<{ processed: number; classified: number }> {
  const start = startDate || new Date("2024-01-01");
  const end = endDate || new Date();
  let processed = 0;
  let classified = 0;

  // Reclassify confirmed debriefs
  const debriefs = await db.execute<{ id: number }>(
    `SELECT id FROM impact_logs WHERE user_id = '${userId}' AND status = 'confirmed' AND created_at >= '${start.toISOString()}' AND created_at <= '${end.toISOString()}'`,
  );
  for (const row of debriefs.rows) {
    const ctx = await buildEntityContext("debrief", row.id);
    if (ctx) {
      const results = await classifyForFunder(funderId, ctx, userId);
      processed++;
      if (results.length > 0) classified++;
    }
  }

  // Reclassify confirmed/completed bookings
  const bookingRows = await db.execute<{ id: number }>(
    `SELECT id FROM bookings WHERE user_id = '${userId}' AND status IN ('confirmed', 'completed') AND start_date >= '${start.toISOString()}' AND start_date <= '${end.toISOString()}'`,
  );
  for (const row of bookingRows.rows) {
    const ctx = await buildEntityContext("booking", row.id);
    if (ctx) {
      const results = await classifyForFunder(funderId, ctx, userId);
      processed++;
      if (results.length > 0) classified++;
    }
  }

  // Reclassify active/completed programmes
  const programmeRows = await db.execute<{ id: number }>(
    `SELECT id FROM programmes WHERE user_id = '${userId}' AND status IN ('active', 'completed') AND start_date >= '${start.toISOString()}' AND start_date <= '${end.toISOString()}'`,
  );
  for (const row of programmeRows.rows) {
    const ctx = await buildEntityContext("programme", row.id);
    if (ctx) {
      const results = await classifyForFunder(funderId, ctx, userId);
      processed++;
      if (results.length > 0) classified++;
    }
  }

  // Reclassify active events
  const eventRows = await db.execute<{ id: number }>(
    `SELECT id FROM events WHERE user_id = '${userId}' AND event_status = 'active' AND start_time >= '${start.toISOString()}' AND start_time <= '${end.toISOString()}'`,
  );
  for (const row of eventRows.rows) {
    const ctx = await buildEntityContext("event", row.id);
    if (ctx) {
      const results = await classifyForFunder(funderId, ctx, userId);
      processed++;
      if (results.length > 0) classified++;
    }
  }

  return { processed, classified };
}

// ============================================================
// Entity context builder
// ============================================================

async function buildEntityContext(
  entityType: "debrief" | "booking" | "programme" | "event",
  entityId: number,
): Promise<EntityContext | null> {
  switch (entityType) {
    case "debrief": {
      const log = await storage.getImpactLog(entityId);
      if (!log) return null;
      const logContacts = await storage.getImpactLogContacts(entityId);
      const logGroups = await db
        .execute<{ group_id: number }>(
          `SELECT group_id FROM impact_log_groups WHERE impact_log_id = ${entityId}`,
        )
        .then((r) => r.rows.map((row) => row.group_id));

      const reviewed = (log.reviewedData || {}) as Record<string, unknown>;
      const textParts = [
        log.title || "",
        log.summary || "",
        log.transcript || "",
        String(reviewed.summary || ""),
        String(reviewed.keyOutcomes || ""),
        ...(Array.isArray(reviewed.themes) ? reviewed.themes.map(String) : []),
        ...(log.milestones || []),
        ...(log.keyQuotes || []),
      ];

      return {
        type: "debrief",
        id: entityId,
        entityDate: log.confirmedAt || log.createdAt || new Date(),
        text: textParts.join(" "),
        contactIds: logContacts.map((c) => c.contactId),
        groupIds: logGroups,
      };
    }

    case "booking": {
      const booking = await storage.getBooking(entityId);
      if (!booking) return null;
      const groupIds = booking.bookerGroupId ? [booking.bookerGroupId] : [];
      const textParts = [
        booking.title || "",
        booking.description || "",
        booking.notes || "",
        booking.bookerName || "",
        booking.bookingSummary || "",
      ];
      return {
        type: "booking",
        id: entityId,
        entityDate: booking.startDate || booking.createdAt || new Date(),
        text: textParts.join(" "),
        contactIds: booking.attendees || [],
        groupIds,
        classification: booking.classification || undefined,
      };
    }

    case "programme": {
      const programme = await storage.getProgramme(entityId);
      if (!programme) return null;
      const textParts = [
        programme.name || "",
        programme.description || "",
        programme.notes || "",
        programme.classification || "",
      ];
      return {
        type: "programme",
        id: entityId,
        entityDate: programme.startDate || programme.createdAt || new Date(),
        text: textParts.join(" "),
        contactIds: programme.attendees || [],
        groupIds: [],
        classification: programme.classification || undefined,
      };
    }

    case "event": {
      const event = await storage.getEvent(entityId);
      if (!event) return null;
      const attendance = await storage.getEventAttendance(entityId);
      const textParts = [
        event.name || "",
        event.description || "",
        event.type || "",
      ];
      return {
        type: "event",
        id: entityId,
        entityDate: event.startTime || event.createdAt || new Date(),
        text: textParts.join(" "),
        contactIds: attendance.map((a) => a.contactId),
        groupIds: [],
        eventType: event.type || undefined,
      };
    }
  }
}

// ============================================================
// Pass 1: Generic taxonomy inheritance
// ============================================================

async function passGenericInheritance(
  debriefId: number,
  categories: FunderTaxonomyCategory[],
): Promise<ClassificationResult[]> {
  const results: ClassificationResult[] = [];

  // Get existing generic impact tags for this debrief
  const tags = await storage.getImpactTags(debriefId);
  if (tags.length === 0) return results;

  const categoryIds = categories.map((c) => c.id);

  // Get all mappings for these funder categories
  const mappings = await db
    .select()
    .from(funderTaxonomyMappings)
    .where(inArray(funderTaxonomyMappings.funderCategoryId, categoryIds));

  if (mappings.length === 0) return results;

  for (const tag of tags) {
    for (const mapping of mappings) {
      if (mapping.genericTaxonomyId === tag.taxonomyId) {
        const baseConfidence = tag.confidence || 70;
        const modifier = mapping.confidenceModifier || 0;
        results.push({
          funderCategoryId: mapping.funderCategoryId,
          confidence: Math.min(100, Math.max(0, baseConfidence + modifier)),
          source: "generic_inherit",
          evidence: `Inherited from generic tag (taxonomyId=${tag.taxonomyId}, confidence=${baseConfidence})`,
        });
      }
    }
  }

  return results;
}

// ============================================================
// Pass 2: Rule-based matching
// ============================================================

async function passRuleBased(
  context: EntityContext,
  categories: FunderTaxonomyCategory[],
  userId: string,
): Promise<ClassificationResult[]> {
  const results: ClassificationResult[] = [];

  // Pre-fetch contact and group data if needed
  let contactData: Array<{ id: number; ethnicity: string[] | null; isRangatahi: boolean | null; isMaori?: boolean }> = [];
  let groupData: Array<{ id: number; isMaori: boolean | null; isPasifika: boolean | null; type: string | null }> = [];

  if (context.contactIds.length > 0) {
    const contactRows = await db
      .select({
        id: contacts.id,
        ethnicity: contacts.ethnicity,
        isRangatahi: contacts.isRangatahi,
      })
      .from(contacts)
      .where(inArray(contacts.id, context.contactIds));
    contactData = contactRows;
  }

  if (context.groupIds.length > 0) {
    const groupRows = await db
      .select({
        id: groups.id,
        isMaori: groups.isMaori,
        isPasifika: groups.isPasifika,
        type: groups.type,
      })
      .from(groups)
      .where(inArray(groups.id, context.groupIds));
    groupData = groupRows;
  }

  for (const category of categories) {
    const rules = (category.rules || {}) as Record<string, any>;
    if (Object.keys(rules).length === 0) continue;

    const matches: string[] = [];

    // communityLens rule
    if (rules.communityLens) {
      const lens = rules.communityLens;
      if (lens === "maori") {
        const hasMaoriContact = contactData.some(
          (c) => c.ethnicity && c.ethnicity.some((e) => /m[aā]ori/i.test(e)),
        );
        const hasMaoriGroup = groupData.some((g) => g.isMaori);
        if (hasMaoriContact || hasMaoriGroup) {
          matches.push(`Māori community lens: ${hasMaoriContact ? "contact" : "group"} match`);
        }
      }
      if (lens === "youth" || lens === "rangatahi") {
        const hasYouth = contactData.some((c) => c.isRangatahi);
        if (hasYouth) {
          matches.push("Youth/rangatahi community lens: contact match");
        }
      }
      if (lens === "pasifika") {
        const hasPasifika = groupData.some((g) => g.isPasifika);
        const hasPasifikaContact = contactData.some(
          (c) => c.ethnicity && c.ethnicity.some((e) => /pacific|pasifika|samoan|tongan|cook island|niuean|fijian/i.test(e)),
        );
        if (hasPasifika || hasPasifikaContact) {
          matches.push("Pasifika community lens match");
        }
      }
    }

    // requireContactFlags
    if (rules.requireContactFlags) {
      const flags = rules.requireContactFlags;
      if (flags.isRangatahi && contactData.some((c) => c.isRangatahi)) {
        matches.push("Contact is rangatahi");
      }
    }

    // requireGroupFlags
    if (rules.requireGroupFlags) {
      const flags = rules.requireGroupFlags;
      if (flags.isMaori && groupData.some((g) => g.isMaori)) {
        matches.push("Group is Māori-led");
      }
      if (flags.isPasifika && groupData.some((g) => g.isPasifika)) {
        matches.push("Group is Pasifika-led");
      }
    }

    // includeEventTypes
    if (rules.includeEventTypes && context.eventType) {
      if ((rules.includeEventTypes as string[]).includes(context.eventType)) {
        matches.push(`Event type "${context.eventType}" matches`);
      }
    }

    // includeBookingClassifications
    if (rules.includeBookingClassifications && context.classification) {
      if ((rules.includeBookingClassifications as string[]).includes(context.classification)) {
        matches.push(`Booking classification "${context.classification}" matches`);
      }
    }

    // includeProgrammeClassifications
    if (rules.includeProgrammeClassifications && context.classification && context.type === "programme") {
      if ((rules.includeProgrammeClassifications as string[]).includes(context.classification)) {
        matches.push(`Programme classification "${context.classification}" matches`);
      }
    }

    if (matches.length > 0) {
      results.push({
        funderCategoryId: category.id,
        confidence: Math.min(95, 60 + matches.length * 10),
        source: "rule",
        evidence: matches.join("; "),
      });
    }
  }

  return results;
}

// ============================================================
// Pass 3: Keyword matching
// ============================================================

function passKeywordMatching(
  context: EntityContext,
  categories: FunderTaxonomyCategory[],
): ClassificationResult[] {
  const results: ClassificationResult[] = [];
  const lowerText = context.text.toLowerCase();

  for (const category of categories) {
    const keywords = category.keywords || [];
    if (keywords.length === 0) continue;

    const matched = keywords.filter((kw) => lowerText.includes(kw.toLowerCase()));

    if (matched.length > 0) {
      results.push({
        funderCategoryId: category.id,
        confidence: Math.min(90, 40 + matched.length * 15),
        source: "keyword",
        evidence: `Keyword matches: ${matched.join(", ")}`,
      });
    }
  }

  return results;
}

// ============================================================
// Pass 4: AI classification (debriefs only, gated)
// ============================================================

async function passAIClassification(
  context: EntityContext,
  categories: FunderTaxonomyCategory[],
): Promise<ClassificationResult[]> {
  try {
    const { claudeJSON, isAnthropicKeyConfigured } = await import("./replit_integrations/anthropic/client");
    if (!isAnthropicKeyConfigured()) return [];

    const categoryDescriptions = categories
      .map((c) => `- ${c.name}: ${c.description || "No description"}`)
      .join("\n");

    // Truncate text to avoid token limits
    const truncatedText = context.text.slice(0, 3000);

    const prompt = `You are classifying a community hub debrief for funder reporting.

The funder has these impact categories:
${categoryDescriptions}

Here is the debrief content:
${truncatedText}

Which categories does this debrief relate to? For each match, provide a confidence score (0-100) and brief evidence.

Respond as JSON array: [{ "categoryName": "...", "confidence": 60-100, "evidence": "..." }]
Only include categories with confidence >= 60.`;

    const result = await claudeJSON({ prompt, model: "claude-haiku" });
    const matches = Array.isArray(result) ? result : [];
    const results: ClassificationResult[] = [];

    for (const match of matches) {
      const category = categories.find(
        (c) => c.name.toLowerCase() === String(match.categoryName || "").toLowerCase(),
      );
      if (category && typeof match.confidence === "number" && match.confidence >= 60) {
        results.push({
          funderCategoryId: category.id,
          confidence: Math.min(100, match.confidence),
          source: "ai",
          evidence: String(match.evidence || "AI classification"),
        });
      }
    }

    return results;
  } catch (err) {
    console.error("AI classification pass failed (non-fatal):", err);
    return [];
  }
}

// ============================================================
// Helpers
// ============================================================

function updateBest(
  map: Map<number, ClassificationResult>,
  result: ClassificationResult,
): void {
  const existing = map.get(result.funderCategoryId);
  if (!existing || result.confidence > existing.confidence) {
    map.set(result.funderCategoryId, result);
  }
}
