import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { api } from "@shared/routes";
import { db } from "../db";
import { eq, and, or, inArray } from "drizzle-orm";
import { groups, groupMembers, groupAssociations, dismissedDuplicates } from "@shared/schema";
import { claudeJSON, AIKeyMissingError } from "../replit_integrations/anthropic/client";
import { parseId } from "./_helpers";
import { classifyForAllFunders, reclassifyAllForFunder } from "../taxonomy-engine";

export function registerGroupRoutes(app: Express) {
  app.get(api.groups.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const groupsList = await storage.getGroups(userId);
    res.json(groupsList);
  });

  app.get("/api/groups/community-density", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const allGroups = await storage.getGroups(userId);
      const allContacts = await storage.getContacts(userId);

      const communityContactIds = new Set(
        allContacts.filter((c: any) => c.isCommunityMember).map((c: any) => c.id)
      );

      const densityMap: Record<number, { communityCount: number; totalMembers: number }> = {};

      for (const group of allGroups) {
        const members = await storage.getGroupMembers(group.id);
        const communityCount = members.filter(m => communityContactIds.has(m.contactId)).length;
        densityMap[group.id] = { communityCount, totalMembers: members.length };
      }

      res.json(densityMap);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to get community density" });
    }
  });

  app.get("/api/groups/suggested-duplicates", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const allGroups = await storage.getGroups(userId);
      const dismissed = await db.select().from(dismissedDuplicates).where(and(eq(dismissedDuplicates.userId, userId), eq(dismissedDuplicates.entityType, "group")));
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

      const clusters: { reason: string; groups: any[] }[] = [];
      const seen = new Set<string>();

      for (let i = 0; i < allGroups.length; i++) {
        for (let j = i + 1; j < allGroups.length; j++) {
          const a = allGroups[i];
          const b = allGroups[j];
          const pairKey = `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`;
          if (dismissedSet.has(pairKey) || seen.has(pairKey)) continue;

          let reason = "";
          const na = normalize(a.name);
          const nb = normalize(b.name);
          if (na && nb && na === nb) {
            reason = "Same name";
          } else if (na && nb && similarity(na, nb) >= 0.8) {
            reason = "Similar names";
          } else if (a.contactEmail && b.contactEmail && normalize(a.contactEmail) === normalize(b.contactEmail)) {
            reason = "Same email";
          }

          if (reason) {
            seen.add(pairKey);
            clusters.push({ reason, groups: [a, b] });
          }
        }
      }

      res.json(clusters);
    } catch (err: any) {
      console.error("Group duplicates error:", err);
      res.status(500).json({ message: "Failed to find group duplicates" });
    }
  });

  app.post("/api/groups/dismiss-duplicate", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { id1, id2 } = req.body;
      if (!id1 || !id2) return res.status(400).json({ message: "id1 and id2 required" });
      await db.insert(dismissedDuplicates).values({
        userId,
        entityType: "group",
        entityId1: Math.min(id1, id2),
        entityId2: Math.max(id1, id2),
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to dismiss duplicate" });
    }
  });

  app.get(api.groups.get.path, isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid group ID" });
    const group = await storage.getGroup(id);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (group.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    res.json(group);
  });

  app.post(api.groups.create.path, isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      if (!user || !user.claims || !user.claims.sub) {
        return res.status(401).json({ message: "Unauthorized: Missing user claims" });
      }
      const userId = user.claims.sub;
      const body = { ...req.body, userId };
      const input = api.groups.create.input.parse(body);
      const group = await storage.createGroup(input);
      res.status(201).json(group);
    } catch (err: any) {
      console.error("Group creation error:", err);
      res.status(400).json({ message: err.message });
    }
  });

  app.patch(api.groups.update.path, isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const existing = await storage.getGroup(id);
      if (!existing) return res.status(404).json({ message: "Group not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const updates = api.groups.update.input.parse(req.body);
      const group = await storage.updateGroup(id, updates);
      res.json(group);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete(api.groups.delete.path, isAuthenticated, async (req, res) => {
    const id = parseId(req.params.id);
    const existing = await storage.getGroup(id);
    if (!existing) return res.status(404).json({ message: "Group not found" });
    if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteGroup(id);
    res.status(204).send();
  });

  // Group Members
  app.get(api.groups.members.list.path, isAuthenticated, async (req, res) => {
    const groupId = parseId(req.params.id);
    const members = await storage.getGroupMembers(groupId);
    res.json(members);
  });

  app.post(api.groups.members.add.path, isAuthenticated, async (req, res) => {
    try {
      const groupId = parseId(req.params.id);
      const body = { ...req.body, groupId };
      const input = api.groups.members.add.input.parse(body);
      const member = await storage.addGroupMember(input);
      res.status(201).json(member);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete(api.groups.members.remove.path, isAuthenticated, async (req, res) => {
    const memberId = parseId(req.params.memberId);
    await storage.removeGroupMember(memberId);
    res.status(204).send();
  });

  app.get("/api/groups/all-associations", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userGroups = await db.select({ id: groups.id }).from(groups).where(eq(groups.userId, userId));
      const userGroupIds = userGroups.map(g => g.id);
      if (userGroupIds.length === 0) return res.json([]);
      const allAssocs = await db.select().from(groupAssociations).where(
        or(
          inArray(groupAssociations.groupId, userGroupIds),
          inArray(groupAssociations.associatedGroupId, userGroupIds)
        )
      );
      res.json(allAssocs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/groups/:id/associations", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const groupId = parseId(req.params.id);
      const group = await storage.getGroup(groupId);
      if (!group || group.userId !== userId) return res.status(404).json({ message: "Group not found" });
      const associations = await db.select().from(groupAssociations).where(
        or(eq(groupAssociations.groupId, groupId), eq(groupAssociations.associatedGroupId, groupId))
      );
      res.json(associations);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/groups/:id/associations", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const groupId = parseId(req.params.id);
      const { associatedGroupId, relationshipType = "peer" } = req.body;
      if (!associatedGroupId || groupId === associatedGroupId) {
        return res.status(400).json({ message: "Invalid association" });
      }
      if (!["parent", "child", "peer"].includes(relationshipType)) {
        return res.status(400).json({ message: "Invalid relationship type" });
      }
      const group = await storage.getGroup(groupId);
      if (!group || group.userId !== userId) return res.status(404).json({ message: "Group not found" });
      const assocGroup = await storage.getGroup(associatedGroupId);
      if (!assocGroup || assocGroup.userId !== userId) return res.status(404).json({ message: "Associated group not found" });
      const existing = await db.select().from(groupAssociations).where(
        or(
          and(eq(groupAssociations.groupId, groupId), eq(groupAssociations.associatedGroupId, associatedGroupId)),
          and(eq(groupAssociations.groupId, associatedGroupId), eq(groupAssociations.associatedGroupId, groupId))
        )
      );
      if (existing.length > 0) {
        return res.status(409).json({ message: "Association already exists" });
      }
      if (relationshipType === "parent") {
        const [association] = await db.insert(groupAssociations).values({
          groupId: associatedGroupId,
          associatedGroupId: groupId,
          relationshipType: "parent",
        }).returning();
        res.status(201).json(association);
      } else if (relationshipType === "child") {
        const [association] = await db.insert(groupAssociations).values({
          groupId,
          associatedGroupId,
          relationshipType: "parent",
        }).returning();
        res.status(201).json(association);
      } else {
        const [association] = await db.insert(groupAssociations).values({
          groupId,
          associatedGroupId,
          relationshipType: "peer",
        }).returning();
        res.status(201).json(association);
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/groups/:id/associations/:associationId", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const groupId = parseId(req.params.id);
      const group = await storage.getGroup(groupId);
      if (!group || group.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const associationId = parseId(req.params.associationId);
      const [assoc] = await db.select().from(groupAssociations).where(eq(groupAssociations.id, associationId));
      if (!assoc || (assoc.groupId !== groupId && assoc.associatedGroupId !== groupId)) {
        return res.status(404).json({ message: "Association not found" });
      }
      const { relationshipType } = req.body;
      if (!relationshipType || !["parent", "child", "peer"].includes(relationshipType)) {
        return res.status(400).json({ message: "Invalid relationship type" });
      }
      const otherId = assoc.groupId === groupId ? assoc.associatedGroupId : assoc.groupId;
      if (relationshipType === "parent") {
        const [updated] = await db.update(groupAssociations)
          .set({ groupId: otherId, associatedGroupId: groupId, relationshipType: "parent" })
          .where(eq(groupAssociations.id, associationId))
          .returning();
        res.json(updated);
      } else if (relationshipType === "child") {
        const [updated] = await db.update(groupAssociations)
          .set({ groupId, associatedGroupId: otherId, relationshipType: "parent" })
          .where(eq(groupAssociations.id, associationId))
          .returning();
        res.json(updated);
      } else {
        const [updated] = await db.update(groupAssociations)
          .set({ relationshipType: "peer" })
          .where(eq(groupAssociations.id, associationId))
          .returning();
        res.json(updated);
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/groups/:id/associations/:associationId", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const groupId = parseId(req.params.id);
      const group = await storage.getGroup(groupId);
      if (!group || group.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const associationId = parseId(req.params.associationId);
      const [assoc] = await db.select().from(groupAssociations).where(eq(groupAssociations.id, associationId));
      if (!assoc || (assoc.groupId !== groupId && assoc.associatedGroupId !== groupId)) {
        return res.status(404).json({ message: "Association not found" });
      }
      await db.delete(groupAssociations).where(eq(groupAssociations.id, associationId));
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/group-memberships/all", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const rows = await db.select({
        id: groupMembers.id,
        groupId: groupMembers.groupId,
        contactId: groupMembers.contactId,
        name: groups.name,
        type: groups.type,
      })
        .from(groupMembers)
        .innerJoin(groups, eq(groupMembers.groupId, groups.id))
        .where(eq(groups.userId, userId));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Contact's group memberships
  app.get("/api/contacts/:id/groups", isAuthenticated, async (req, res) => {
    const contactId = parseId(req.params.id);
    const memberships = await storage.getContactGroups(contactId);
    res.json(memberships);
  });

  // === Group Taxonomy Links ===
  app.get("/api/groups/:id/taxonomy-links", isAuthenticated, async (req, res) => {
    try {
      const group = await storage.getGroup(parseId(req.params.id));
      if (!group) return res.status(404).json({ message: "Group not found" });
      if (group.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const links = await storage.getGroupTaxonomyLinks(group.id);
      res.json(links);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/groups/:id/taxonomy-links", isAuthenticated, async (req, res) => {
    try {
      const groupId = parseId(req.params.id);
      const group = await storage.getGroup(groupId);
      if (!group) return res.status(404).json({ message: "Group not found" });
      const userId = (req.user as any).claims.sub;
      if (group.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const userTaxonomy = await storage.getTaxonomy(userId);
      const validTaxIds = new Set(userTaxonomy.map((t: any) => t.id));

      const links = (req.body.links || [])
        .filter((l: any) => typeof l.taxonomyId === "number" && validTaxIds.has(l.taxonomyId))
        .map((l: any) => ({
          groupId,
          taxonomyId: l.taxonomyId,
          confidence: typeof l.confidence === "number" ? Math.min(100, Math.max(0, l.confidence)) : null,
          reasoning: typeof l.reasoning === "string" ? l.reasoning.trim() : null,
        }));
      const saved = await storage.setGroupTaxonomyLinks(groupId, links);
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === Group Data Enrichment ===
  app.post("/api/groups/:id/enrich", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const group = await storage.getGroup(id);
      if (!group) return res.status(404).json({ message: "Group not found" });
      if (group.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      const userId = (req.user as any).claims.sub;
      const taxonomyCategories = await storage.getTaxonomy(userId);
      const activeCategories = taxonomyCategories.filter((c: any) => c.active);

      const taxonomyList = activeCategories.map((c: any) => `- ${c.name}: ${c.description || "No description"}`).join("\n");

      const prompt = `You are a research assistant for a community development organisation in Aotearoa New Zealand called The Reserve. Given the following organisation/group name and type, look up what you know about them and return structured information.

Organisation Name: "${group.name}"
Type: "${group.type}"
${group.address ? `Known Address: "${group.address}"` : ""}
${group.description ? `Existing Description: "${group.description}"` : ""}

PART 1 - Organisation Info:
Return basic information about this organisation. Use null for any field you cannot confidently determine.

PART 2 - Kaupapa Matching:
The Reserve tracks impact across these taxonomy categories:
${taxonomyList}

Analyse what this organisation does and match it to the relevant impact categories above. For each match, provide:
- The exact category name
- A confidence score (0-100) reflecting how strongly their work aligns
- A brief reasoning explaining the connection (1-2 sentences)

If the organisation has no clear social outcome or community impact, match them to "Venture Progress" as we are simply supporting their economic development/growth.

An organisation can match multiple categories. Only include categories with genuine relevance (confidence >= 40).

Return a JSON object with this structure:
{
  "description": "A concise 2-3 sentence description of what this organisation does, their mission, and key activities",
  "contactEmail": "their publicly listed email address or null",
  "contactPhone": "their publicly listed phone number or null",
  "address": "their physical address or null",
  "website": "their website URL or null",
  "notes": "Any additional useful context: founding year, key people, partnerships, sector focus, community they serve. Keep to 2-3 bullet points.",
  "kaupapa": [
    {
      "category": "exact category name from the list above",
      "confidence": 85,
      "reasoning": "Why this organisation's work aligns with this impact area"
    }
  ]
}

Important:
- Only include information you are reasonably confident about
- For NZ organisations, consider checking known databases like Charities Register, Companies Register, community directories
- If you are unsure about the organisation, still provide what you can and note uncertainty in the notes field
- Format phone numbers in NZ format (+64...)
- Keep the description factual and professional
- Every organisation should have at least one kaupapa match — if nothing else fits, use "Venture Progress"`;

      const raw = await claudeJSON({
        model: "claude-haiku-4-5",
        prompt,
        temperature: 0.3,
      });
      const ALLOWED_FIELDS = ["description", "contactEmail", "contactPhone", "address", "website", "notes"];
      const enrichment: Record<string, any> = {};
      for (const field of ALLOWED_FIELDS) {
        enrichment[field] = typeof raw[field] === "string" && raw[field].trim() ? raw[field].trim() : null;
      }

      const categoryMap = new Map(activeCategories.map((c: any) => [c.name.toLowerCase(), c]));
      const kaupapa: any[] = [];
      if (Array.isArray(raw.kaupapa)) {
        for (const match of raw.kaupapa) {
          if (!match.category) continue;
          const cat = categoryMap.get(match.category.toLowerCase());
          if (!cat) continue;
          const confidence = typeof match.confidence === "number" ? Math.min(100, Math.max(0, match.confidence)) : 50;
          if (confidence < 40) continue;
          kaupapa.push({
            taxonomyId: cat.id,
            category: cat.name,
            color: cat.color,
            confidence,
            reasoning: typeof match.reasoning === "string" ? match.reasoning.trim() : null,
          });
        }
      }
      if (kaupapa.length === 0) {
        const fallback = activeCategories.find((c: any) => c.name === "Venture Progress" || c.name === "Business Progress");
        if (fallback) {
          kaupapa.push({
            taxonomyId: fallback.id,
            category: fallback.name,
            color: fallback.color,
            confidence: 60,
            reasoning: "Supporting economic development and business growth",
          });
        }
      }
      enrichment.kaupapa = kaupapa;

      res.json(enrichment);
    } catch (err: any) {
      if (err instanceof AIKeyMissingError) return res.status(503).json({ message: err.message });
      console.error("Group enrichment error:", err);
      res.status(500).json({ message: "Failed to enrich group data" });
    }
  });
}
