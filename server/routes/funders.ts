import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import {
  funders,
  funderTaxonomyCategories,
  funderTaxonomyMappings,
  funderTaxonomyClassifications,
  insertFunderSchema,
  insertFunderDocumentSchema,
  insertOrganisationProfileSchema,
  meetings,
  programmeRegistrations,
  relationshipStageHistory,
} from "@shared/schema";
import { parseId, parseStr, coerceDateFields } from "./_helpers";
import { evaluateDeliverables } from "../reporting";
import { reclassifyAllForFunder } from "../taxonomy-engine";
import { claudeJSON, AIKeyMissingError } from "../replit_integrations/anthropic/client";

export function registerFunderRoutes(app: Express) {
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

  // === Funders API ===

  app.get("/api/funders", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      let fundersList = await storage.getFunders(userId);

      if (fundersList.length === 0) {
        const defaults = [
          {
            userId,
            name: "Ngā Mātārae",
            organisation: "Ngā Mātārae",
            status: "active_funder" as const,
            communityLens: "maori" as const,
            outcomesFramework: "Tāmaki Ora",
            reportingCadence: "quarterly" as const,
            narrativeStyle: "compliance" as const,
            prioritySections: ["engagement", "outcomes", "milestones"],
            funderTag: "nga-matarae",
            isDefault: true,
          },
          {
            userId,
            name: "EDO / Auckland Council — Economic Development Office",
            organisation: "Auckland Council Economic Development Office",
            status: "active_funder" as const,
            communityLens: "all" as const,
            outcomesFramework: "Inclusive & Sustainable Economic Growth",
            outcomeFocus: `Inclusive Economic Growth: Māori and Pacific communities positioned as economic drivers and innovators. Indicators: enterprises started/formalised/grown through hub support, Māori and Pacific entrepreneurs engaged, repeat usage rate, revenue generated from hub-facilitated activity, jobs created or sustained.

Social & Sector Innovation: Ecosystem activations that connect communities, sectors and opportunities. Indicators: activations/events/wānanga hosted, GridAKL and innovation network connections formed, rangatahi engaged in enterprise or innovation programmes, partnerships brokered across sectors.

Ecosystem Building: A connected and collaborative enterprise support ecosystem across Tāmaki Makaurau. Indicators: organisations partnered with, cross-hub referrals, co-investment attracted from other funders, hub utilisation and venue hire metrics.

Tāmaki Rohe Economic Contribution: Local enterprises retained and grown, contributing to Auckland's inclusive economy. Indicators: local enterprises retained through hub support, new enterprises established, geographic spread of users, co-investment leverage ratio.`,
            reportingGuidance: `Reporting Rhythm:
• Monthly: Usage numbers, activations, events, venue hire → Internal / Tātaki Auckland Unlimited
• Quarterly: Inclusive growth indicators, ecosystem connections, co-investment tracking, partnership updates → EDO quarterly reporting
• Annually: Full impact report — economic indicators, qualitative stories, co-investment leverage summary, forward plan → Auckland Council / EDO annual cycle

Co-investment Partners: Ngā Mātārae MOF, Tātaki Auckland Unlimited, Local Board, Foundation North, MBIE.

What they want to see: Evidence of inclusive economic impact, geographic purpose (Tāmaki Makaurau reach), co-investment leverage from other funders, Māori and Pacific participation data, enterprise growth metrics, innovation ecosystem development.

Framing: The hub as economic infrastructure for inclusive growth — enabling Māori and Pacific enterprise, connecting innovation ecosystems, and contributing measurably to Auckland's economic development goals.`,
            reportingCadence: "quarterly" as const,
            narrativeStyle: "compliance" as const,
            prioritySections: ["engagement", "delivery", "value"],
            funderTag: "edo-auckland-council",
            contractStart: new Date("2025-07-01T00:00:00.000Z"),
            isDefault: true,
          },
          {
            userId,
            name: "Foundation North — Pūtea Hāpai Oranga",
            organisation: "Foundation North",
            status: "active_funder" as const,
            communityLens: "maori" as const,
            outcomesFramework: "Increased Equity / Community Support",
            outcomeFocus: `Increased Equity (Hāpai te ōritetanga): Improved equity and wellbeing outcomes for Māori — communities leading their own solutions, not having solutions delivered to them. Indicators: Māori entrepreneurs/enterprises supported, whānau reporting improved confidence or capability, community-led initiatives launched, equitable access to enterprise support, cultural safety ratings.

Community Support (Hāpori awhina): Connected, resilient communities with access to spaces, networks, and opportunities. Indicators: community events/hui hosted, total attendees (proportion Māori), community connections and networks formed, organisations partnered with, user satisfaction and sense of belonging, pride and resilience indicators.

Te Tiriti o Waitangi (cross-cutting): Te reo Māori visible and normalised, kaupapa Māori embedded in operations, Māori-led decision making. Indicators: te reo visible in signage/communications/programmes, kaupapa Māori programming delivered, Māori governance and advisory involvement, tikanga integration in operations, Māori staff and facilitator representation.`,
            reportingGuidance: `Grant Types:
• Quick Response Grant: Up to $25,000, approximately 2-month decision turnaround
• Community Grant: Over $25,000, approximately 5-month decision turnaround

Reporting: 12-month impact report required at end of funding period.

Application Strategy:
• Lead with community voice — stories of whānau and communities leading change
• Show tangata whenua priority alignment — how the mahi centres Māori needs and aspirations
• Demonstrate community-led solutions, not service delivery
• Evidence of Te Tiriti commitment in governance and operations
• Include both quantitative indicators and qualitative impact stories

What to show: Community ownership and self-determination, grassroots impact stories, te reo and tikanga integration, equitable access, partnership and collaboration evidence.

What to avoid: Deficit framing, top-down service delivery language, purely statistical reporting without community voice, treating Māori as beneficiaries rather than leaders.`,
            reportingCadence: "annual" as const,
            narrativeStyle: "story" as const,
            prioritySections: ["engagement", "outcomes", "impact"],
            funderTag: "foundation-north",
            isDefault: true,
          },
        ];

        for (const def of defaults) {
          await storage.createFunder(def);
        }
        fundersList = await storage.getFunders(userId);
      }

      res.json(fundersList);
    } catch (err: any) {
      console.error("Error fetching funders:", err);
      res.status(500).json({ message: "Failed to fetch funders" });
    }
  });

  app.get("/api/funders/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const funder = await storage.getFunder(id);
      if (!funder) return res.status(404).json({ message: "Funder not found" });
      if (funder.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      const docs = await storage.getFunderDocuments(id);
      res.json({ ...funder, documentCount: docs.length });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch funder" });
    }
  });

  app.post("/api/funders", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const body = coerceDateFields(req.body);
      if (body.outcomeFocus && Array.isArray(body.outcomeFocus)) {
        const validOptions = ["economic", "wellbeing", "cultural", "community"];
        body.outcomeFocus = body.outcomeFocus.filter((v: string) => validOptions.includes(v));
      }
      const input = insertFunderSchema.parse({ ...body, userId });
      const funder = await storage.createFunder(input);
      res.status(201).json(funder);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Failed to create funder" });
    }
  });

  app.patch("/api/funders/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const existing = await storage.getFunder(id);
      if (!existing) return res.status(404).json({ message: "Funder not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      const body = coerceDateFields(req.body);
      if (body.outcomeFocus && Array.isArray(body.outcomeFocus)) {
        const validOptions = ["economic", "wellbeing", "cultural", "community"];
        body.outcomeFocus = body.outcomeFocus.filter((v: string) => validOptions.includes(v));
      }
      const updated = await storage.updateFunder(id, body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update funder" });
    }
  });

  app.delete("/api/funders/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const existing = await storage.getFunder(id);
      if (!existing) return res.status(404).json({ message: "Funder not found" });
      if (existing.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      await storage.deleteFunder(id);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete funder" });
    }
  });

  app.post("/api/funders/:id/ai-generate", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const userId = (req.user as any).claims.sub;
      const funder = await storage.getFunder(id);
      if (!funder) return res.status(404).json({ message: "Funder not found" });
      if (funder.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const orgProfile = await storage.getOrganisationProfile(userId);
      const docs = await storage.getFunderDocuments(id);

      const documentContents: { name: string; type: string; content: string }[] = [];
      for (const doc of docs) {
        if (doc.fileData) {
          let extractedText = "";
          const buffer = Buffer.from(doc.fileData, "base64");
          const isPdf = doc.fileName.toLowerCase().endsWith(".pdf") || buffer.subarray(0, 5).toString() === "%PDF-";
          if (isPdf) {
            try {
              const pdfParse = (await import("pdf-parse")).default;
              const parsed = await pdfParse(buffer);
              extractedText = parsed.text || "";
            } catch (e) {
              extractedText = buffer.toString("utf-8");
            }
          } else {
            extractedText = buffer.toString("utf-8");
          }
          const cleanText = extractedText.replace(/[^\x20-\x7E\n\r\t\u00C0-\u024F\u0100-\u017F\u0300-\u036F\u2000-\u206F\u2018-\u201F\u2026\u2013\u2014\u00A0\u0101\u014D\u016B\u0113\u012B\u0100\u014C\u016A\u0112\u012A]/g, " ").replace(/\s{3,}/g, " ").trim();
          if (cleanText.length > 100) {
            documentContents.push({
              name: doc.fileName,
              type: doc.documentType,
              content: cleanText.substring(0, 15000),
            });
          }
        }
      }

      const orgContext = orgProfile ? `
Organisation: ${orgProfile.name || ""}
Mission: ${orgProfile.mission || ""}
Description: ${orgProfile.description || ""}
Focus Areas: ${Array.isArray(orgProfile.focusAreas) ? orgProfile.focusAreas.join(", ") : orgProfile.focusAreas || ""}
Target Community: ${orgProfile.targetCommunity || ""}
Location: ${orgProfile.location || ""}` : "";

      const existingInfo = `
Funder Name: ${funder.name}
Organisation: ${funder.organisation || ""}
Status: ${funder.status}
Outcomes Framework: ${funder.outcomesFramework || ""}
Outcome Focus: ${funder.outcomeFocus || ""}
Reporting Guidance: ${funder.reportingGuidance || ""}
Reporting Cadence: ${funder.reportingCadence || ""}
Narrative Style: ${funder.narrativeStyle || ""}
Contract Start: ${funder.contractStart || ""}
Contract End: ${funder.contractEnd || ""}
Notes: ${funder.notes || ""}`;

      const docsContext = documentContents.length > 0
        ? "\n\nUPLOADED DOCUMENTS:\n" + documentContents.map(d => `--- ${d.name} (${d.type}) ---\n${d.content}`).join("\n\n")
        : "";

      // Read funder context file maintained by Claude Code
      let funderDeepContext = "";
      try {
        const fs = await import("fs");
        const path = await import("path");
        const contextPath = path.join(process.cwd(), ".claude", "funder-context.md");
        if (fs.existsSync(contextPath)) {
          const fullContext = fs.readFileSync(contextPath, "utf-8");
          // Extract the section for this funder by name matching
          const funderName = funder.name.toLowerCase();
          const sections = fullContext.split(/\n---\n/);
          for (const section of sections) {
            const headerMatch = section.match(/^## (.+)/m);
            if (headerMatch && (
              funderName.includes(headerMatch[1].toLowerCase().split("(")[0].trim()) ||
              headerMatch[1].toLowerCase().includes(funderName.split("(")[0].trim()) ||
              section.toLowerCase().includes(`**full name:** ${funderName}`) ||
              section.toLowerCase().includes(funderName)
            )) {
              funderDeepContext = `\n\nCLAUDE CODE CONTEXT (maintained by AI assistant with deep knowledge of this funder):\n${section.trim()}`;
              break;
            }
          }
          if (!funderDeepContext) {
            // No specific match — include the whole file for general context
            funderDeepContext = `\n\nCLAUDE CODE CONTEXT (maintained by AI assistant):\n${fullContext.substring(0, 8000)}`;
          }
        }
      } catch {
        // Context file not available — continue without it
      }

      const systemPrompt = `You are an expert in Aotearoa New Zealand community development, Māori and Pasifika outcomes frameworks, and funder relationship management. You help organisations like ReserveTMK Digital build rich funder profiles.

Given the organisation context, existing funder information, Claude Code's deep knowledge, and any uploaded documents, generate a comprehensive funder profile. The Claude Code context is authoritative — it reflects the operator's real relationship with this funder, including politics, preferences, and strategy. Prioritise it over generic assumptions.

${orgContext}

Respond with a JSON object containing these fields:
{
  "outcomesFramework": "Name and description of the funder's outcomes framework",
  "outcomeFocus": "Detailed outcome focus areas with indicators. Use the funder's actual pou/pillars if known. Each area should have a name, description, and specific measurable indicators.",
  "reportingGuidance": "Structured reporting rhythm and guidance including: what they want to see, how often, what format, and any specific metrics or stories they value.",
  "narrativeStyle": "One of: compliance, story, partnership",
  "prioritySections": ["Array of priority sections from: engagement, delivery, impact, outcomes, milestones, reach, value, tamaki_ora, cohort"],
  "partnershipStrategy": "A strategy section describing how the organisation delivers on this funder's outcomes. Include: how the partnership works, what activities/programmes align with their goals, how impact is demonstrated, key touchpoints and relationship management approach, and how reporting feeds into the relationship."
}

Be specific, practical, and grounded in the actual documents and context provided. Don't be generic — reference the specific funder, their framework, and their priorities. The partnership strategy should read like an internal playbook for how to deliver and report to this funder.`;

      const result = await claudeJSON({
        model: "claude-sonnet-4-6",
        system: systemPrompt,
        prompt: `Generate a comprehensive funder profile for this funder:\n\n${existingInfo}${funderDeepContext}${docsContext}`,
        temperature: 0.4,
        maxTokens: 4096,
      });

      const validStyles = ["compliance", "story", "partnership"];
      const validSections = ["engagement", "delivery", "impact", "outcomes", "milestones", "reach", "value", "tamaki_ora", "cohort"];
      const sanitized = {
        outcomesFramework: typeof result.outcomesFramework === "string" ? result.outcomesFramework.substring(0, 5000) : null,
        outcomeFocus: typeof result.outcomeFocus === "string" ? result.outcomeFocus.substring(0, 5000) : null,
        reportingGuidance: typeof result.reportingGuidance === "string" ? result.reportingGuidance.substring(0, 5000) : null,
        narrativeStyle: validStyles.includes(result.narrativeStyle) ? result.narrativeStyle : "compliance",
        prioritySections: Array.isArray(result.prioritySections) ? result.prioritySections.filter((s: string) => validSections.includes(s)) : [],
        partnershipStrategy: typeof result.partnershipStrategy === "string" ? result.partnershipStrategy.substring(0, 5000) : null,
      };
      res.json(sanitized);
    } catch (err: any) {
      if (err instanceof AIKeyMissingError) return res.status(503).json({ message: err.message });
      console.error("AI generate funder profile error:", err);
      res.status(500).json({ message: "Failed to generate profile" });
    }
  });

  app.get("/api/funders/:id/documents", isAuthenticated, async (req, res) => {
    try {
      const funderId = parseId(req.params.id);
      const funder = await storage.getFunder(funderId);
      if (!funder) return res.status(404).json({ message: "Funder not found" });
      if (funder.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      const docs = await storage.getFunderDocuments(funderId);
      res.json(docs.map(d => ({ ...d, fileData: undefined })));
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.post("/api/funders/:id/documents", isAuthenticated, async (req, res) => {
    try {
      const funderId = parseId(req.params.id);
      const userId = (req.user as any).claims.sub;
      const funder = await storage.getFunder(funderId);
      if (!funder) return res.status(404).json({ message: "Funder not found" });
      if (funder.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const input = insertFunderDocumentSchema.parse({
        ...req.body,
        funderId,
        userId,
      });
      const doc = await storage.createFunderDocument(input);
      res.status(201).json({ ...doc, fileData: undefined });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  app.get("/api/funder-documents/:docId/download", isAuthenticated, async (req, res) => {
    try {
      const docId = parseId(req.params.docId);
      const doc = await storage.getFunderDocument(docId);
      if (!doc) return res.status(404).json({ message: "Document not found" });

      const funder = await storage.getFunder(doc.funderId);
      if (!funder || funder.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      res.json({ id: doc.id, fileName: doc.fileName, documentType: doc.documentType, fileData: doc.fileData, fileSize: doc.fileSize });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  app.delete("/api/funder-documents/:docId", isAuthenticated, async (req, res) => {
    try {
      const docId = parseId(req.params.docId);
      const doc = await storage.getFunderDocument(docId);
      if (!doc) return res.status(404).json({ message: "Document not found" });

      const funder = await storage.getFunder(doc.funderId);
      if (!funder || funder.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      await storage.deleteFunderDocument(docId);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // === FUNDER DELIVERABLES ===

  app.get("/api/funders/:id/deliverables", isAuthenticated, async (req, res) => {
    try {
      const funderId = parseId(req.params.id);
      const funder = await storage.getFunder(funderId);
      if (!funder || funder.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const deliverables = await storage.getFunderDeliverables(funderId);
      res.json(deliverables);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch deliverables" });
    }
  });

  app.post("/api/funders/:id/deliverables", isAuthenticated, async (req, res) => {
    try {
      const funderId = parseId(req.params.id);
      const funder = await storage.getFunder(funderId);
      if (!funder || funder.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const deliverable = await storage.createFunderDeliverable({ ...req.body, funderId });
      res.status(201).json(deliverable);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create deliverable" });
    }
  });

  app.patch("/api/funder-deliverables/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const existing = await storage.getFunderDeliverable(id);
      if (!existing) return res.status(404).json({ message: "Deliverable not found" });
      const funder = await storage.getFunder(existing.funderId);
      if (!funder || funder.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const updated = await storage.updateFunderDeliverable(id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update deliverable" });
    }
  });

  app.delete("/api/funder-deliverables/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const existing = await storage.getFunderDeliverable(id);
      if (!existing) return res.status(404).json({ message: "Deliverable not found" });
      const funder = await storage.getFunder(existing.funderId);
      if (!funder || funder.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteFunderDeliverable(id);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete deliverable" });
    }
  });

  // Funder innovator stats — filtered by communityLens
  app.get("/api/funders/:id/innovator-stats", isAuthenticated, async (req, res) => {
    try {
      const funderId = parseId(req.params.id);
      const userId = (req.user as any).claims.sub;
      const funder = await storage.getFunder(funderId);
      if (!funder || funder.userId !== userId) return res.status(404).json({ message: "Funder not found" });

      const allContacts = await storage.getContacts(userId);
      const innovators = allContacts.filter((c: any) => c.isInnovator);

      // Filter by community lens
      const lens = funder.communityLens || "all";
      const MAORI_ETHNICITIES = ["Māori", "Maori"];
      const PASIFIKA_ETHNICITIES = ["Samoan", "Tongan", "Cook Islands Māori", "Cook Island", "Niuean", "Fijian", "Tokelauan", "Tuvaluan"];

      const isMaori = (c: any) => {
        if (!c.ethnicity || !Array.isArray(c.ethnicity)) return false;
        return c.ethnicity.some((e: string) => MAORI_ETHNICITIES.some(m => e.includes(m)));
      };
      const isPasifika = (c: any) => {
        if (!c.ethnicity || !Array.isArray(c.ethnicity)) return false;
        return c.ethnicity.some((e: string) => PASIFIKA_ETHNICITIES.some(p => e.includes(p)));
      };

      let filtered = innovators;
      if (lens === "maori") filtered = innovators.filter(isMaori);
      else if (lens === "pasifika") filtered = innovators.filter(isPasifika);

      // Stage breakdown
      const stages = { kakano: 0, tipu: 0, ora: 0, other: 0 };
      for (const c of filtered) {
        const stage = c.stage || "kakano";
        if (stages.hasOwnProperty(stage)) stages[stage as keyof typeof stages]++;
        else stages.other++;
      }

      // Stage progressions this quarter
      const now = new Date();
      const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      const filteredIds = new Set(filtered.map((c: any) => c.id));
      const stageHistory = await db.select().from(relationshipStageHistory).where(
        and(gte(relationshipStageHistory.changedAt, qStart))
      );
      const progressions = stageHistory.filter((h: any) =>
        h.entityType === "contact" && filteredIds.has(h.entityId) &&
        h.previousStage && h.newStage && h.previousStage !== h.newStage
      ).length;

      // Mentoring sessions this quarter
      const mentoringSessions = await db.select({ id: meetings.id }).from(meetings).where(and(
        eq(meetings.userId, userId),
        inArray(meetings.type, ["mentoring"]),
        inArray(meetings.status, ["completed", "confirmed"]),
        gte(meetings.startTime, qStart),
      ));
      // Filter to sessions with contacts in our lens
      let sessionCount = mentoringSessions.length;
      if (lens !== "all") {
        const sessionDetails = await Promise.all(mentoringSessions.map(async (m: any) => {
          const full = await storage.getMeeting(m.id);
          return full?.contactId && filteredIds.has(full.contactId) ? 1 : 0;
        }));
        sessionCount = sessionDetails.reduce((a, b) => a + b, 0);
      }

      // Programme completions this quarter
      const progRegs = await db.select().from(programmeRegistrations).where(
        and(eq(programmeRegistrations.userId, userId), eq(programmeRegistrations.attended, true))
      );
      let programmeCount = progRegs.length;
      if (lens !== "all") {
        programmeCount = progRegs.filter((r: any) => r.contactId && filteredIds.has(r.contactId)).length;
      }

      res.json({
        lens,
        total: filtered.length,
        allInnovators: innovators.length,
        stages,
        progressionsThisQuarter: progressions,
        mentoringSessionsThisQuarter: sessionCount,
        programmeCompletionsThisQuarter: programmeCount,
        ethnicityBreakdown: lens === "all" ? {
          maori: innovators.filter(isMaori).length,
          pasifika: innovators.filter(isPasifika).length,
        } : undefined,
      });
    } catch (err: any) {
      console.error("Funder innovator stats error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/funders/:id/pulse", isAuthenticated, async (req, res) => {
    try {
      const funderId = parseId(req.params.id);
      const userId = (req.user as any).claims.sub;
      const funder = await storage.getFunder(funderId);
      if (!funder || funder.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const startDate = (req.query.start as string) || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
      const endDate = (req.query.end as string) || new Date().toISOString().slice(0, 10);

      const deliverables = await storage.getFunderDeliverables(funderId);
      const activeDeliverables = deliverables.filter(d => d.isActive);

      const results = await evaluateDeliverables(
        activeDeliverables,
        userId,
        startDate,
        endDate,
        funder.contractStart,
        funder.contractEnd,
      );

      const atRisk = results.filter(r => r.status === "at_risk").length;
      const needsAttention = results.filter(r => r.status === "needs_attention").length;
      const overall = atRisk > 0 ? "at_risk" : needsAttention > 0 ? "needs_attention" : "on_track";

      res.json({
        funder: { id: funder.id, name: funder.name, organisation: funder.organisation },
        period: { start: startDate, end: endDate },
        contract: { start: funder.contractStart, end: funder.contractEnd },
        deliverables: results,
        summary: { total: results.length, atRisk, needsAttention, overall },
      });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to generate pulse" });
    }
  });

  app.post("/api/funders/seed-deliverables", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;

      const SEED_MAP: Record<string, Array<{ name: string; description: string; metricType: string; filter: Record<string, any>; targetAnnual?: number }>> = {
        "edo-auckland-council": [
          { name: "Activations", description: "Total activations (events + bookings + programmes)", metricType: "activations", filter: {} },
          { name: "Programmes delivered", description: "Innovation and entrepreneurial programmes", metricType: "programmes", filter: {} },
          { name: "Events delivered", description: "Community events, workshops, wananga", metricType: "events", filter: { excludeTypes: ["Meeting", "Catch Up", "Planning", "Mentoring Session"] } },
          { name: "Mentoring sessions", description: "1:1 capability building sessions", metricType: "mentoring", filter: { sessionStatus: "completed" } },
          { name: "Maori businesses registered", description: "Maori-led businesses and enterprises in the ecosystem", metricType: "groups", filter: { groupType: ["Business", "Social Enterprise"], isMaori: true } },
          { name: "Rangatahi participating", description: "Rangatahi engaged in programmes and mentoring", metricType: "contacts", filter: { isRangatahi: true } },
          { name: "Venue hire bookings", description: "External venue hire bookings", metricType: "bookings", filter: { classifications: ["venue_hire"] } },
          { name: "Foot traffic", description: "Total people through the space", metricType: "foot_traffic", filter: {}, targetAnnual: 5000 },
        ],
        "nga-matarae": [
          { name: "Maori innovators engaged", description: "Maori innovators and entrepreneurs in the ecosystem", metricType: "contacts", filter: { ethnicity: ["Māori"], isInnovator: true } },
          { name: "Rangatahi participating", description: "Maori and Pasifika rangatahi in programmes", metricType: "contacts", filter: { isRangatahi: true } },
          { name: "Programmes/services delivered", description: "Capability building programmes", metricType: "programmes", filter: {} },
          { name: "Events delivered", description: "Community activations and wananga", metricType: "events", filter: { excludeTypes: ["Meeting", "Catch Up", "Planning", "Mentoring Session"] } },
          { name: "Mentoring sessions", description: "1:1 capability sessions delivered", metricType: "mentoring", filter: { sessionStatus: "completed" } },
          { name: "Maori businesses in ecosystem", description: "Maori-led businesses registered", metricType: "groups", filter: { groupType: ["Business", "Social Enterprise"], isMaori: true } },
        ],
        "trc-clc": [
          { name: "Storytelling campaigns", description: "Digital storytelling campaigns delivered", metricType: "events", filter: { eventTypes: ["Content"] }, targetAnnual: 3 },
        ],
      };

      const results: Record<string, any[]> = {};
      for (const [tag, deliverables] of Object.entries(SEED_MAP)) {
        const funder = await storage.getFunderByTag(userId, tag);
        if (!funder) continue;
        const existing = await storage.getFunderDeliverables(funder.id);
        if (existing.length > 0) {
          results[tag] = { skipped: true, existing: existing.length } as any;
          continue;
        }
        const created = [];
        for (let i = 0; i < deliverables.length; i++) {
          const d = deliverables[i];
          const item = await storage.createFunderDeliverable({
            funderId: funder.id,
            name: d.name,
            description: d.description,
            metricType: d.metricType,
            filter: d.filter,
            targetAnnual: d.targetAnnual || null,
            targetTotal: null,
            unit: "count",
            sortOrder: i,
            isActive: true,
          });
          created.push(item);
        }
        results[tag] = created;
      }

      res.status(201).json(results);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to seed deliverables" });
    }
  });

  app.post("/api/funders/seed-radar", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const radarEntries = [
        {
          name: "Foundation North",
          organisation: "Foundation North",
          status: "radar" as const,
          estimatedValue: 50000,
          fitTags: ["maori", "community", "youth", "pasifika"],
          notes: "Quick Response <$25k (2 months). Community >$25k multi-year (5 months). Warm intro: Rochelle (advisor) via Jacqui.",
          nextAction: "Contact Rochelle via Jacqui",
        },
        {
          name: "Te Puni Kokiri — Maori Development Fund",
          organisation: "Te Puni Kokiri",
          status: "radar" as const,
          estimatedValue: 50000,
          fitTags: ["maori", "enterprise", "innovation"],
          notes: "$40.21M/year fund. Streams: Putea Kimihia (investigate), Putea Tipuranga (growth), Maori Business Growth Support.",
          nextAction: "Call Auckland regional TPK office",
        },
        {
          name: "Maungakiekie-Tamaki Local Board — Quick Response",
          organisation: "Auckland Council",
          status: "radar" as const,
          estimatedValue: 5000,
          applicationDeadline: new Date("2026-04-06"),
          fitTags: ["youth", "maori", "pasifika", "placemaking"],
          notes: "$2k-$10k grants. Priorities: youth, Maori/Pacific, placemaking.",
          nextAction: "Prepare application this week",
        },
        {
          name: "Creative NZ — Arts Orgs Fund Tiers 1-2",
          organisation: "Creative New Zealand",
          status: "radar" as const,
          estimatedValue: 75000,
          applicationDeadline: new Date("2026-05-31"),
          fitTags: ["arts", "youth", "community"],
          notes: "Tier 1: up to $50k/yr. Tier 2: $50-125k/yr. Multi-year options. Fit: podcast studio, Creators Club, content creation.",
          nextAction: "Assess creative programmes as arts delivery",
        },
        {
          name: "Social Investment Fund — Pathway Four",
          organisation: "Ministry of Social Development",
          status: "radar" as const,
          estimatedValue: 100000,
          fitTags: ["community", "youth"],
          notes: "$190M over 4 years. Pathway Four (co-investment with philanthropy) anticipated early 2026. RTMKD data capability is differentiator.",
          nextAction: "Explore paired with Foundation North",
        },
        {
          name: "Tindall Foundation",
          organisation: "Auckland Foundation",
          status: "radar" as const,
          estimatedValue: 20000,
          applicationDeadline: new Date("2026-07-20"),
          fitTags: ["community", "maori", "pasifika"],
          notes: "Grassroots Giving for whanau experiencing multiple disadvantage. Applications open 20 July 2026, close 9 August.",
        },
        {
          name: "Ministry of Youth Development",
          organisation: "Ministry of Youth Development",
          status: "radar" as const,
          estimatedValue: 30000,
          fitTags: ["youth", "enterprise"],
          notes: "~$12M/year. Ages 12-24. Current round locked to June 2027. Next opening likely mid-2026.",
        },
      ];

      const created = [];
      for (const entry of radarEntries) {
        const existing = await storage.getFunderByTag(userId, entry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
        if (existing) continue;
        const funder = await storage.createFunder({
          userId,
          ...entry,
          communityLens: "all",
          funderTag: entry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        });
        created.push(funder);
      }
      res.status(201).json({ created: created.length, entries: created });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to seed radar entries" });
    }
  });

  // === FUNDER TAXONOMY — per-funder lens routes ===

  // List funder's taxonomy categories
  app.get("/api/funders/:funderId/taxonomy", isAuthenticated, async (req, res) => {
    try {
      const funderId = parseId(req.params.funderId);
      const categories = await db
        .select()
        .from(funderTaxonomyCategories)
        .where(eq(funderTaxonomyCategories.funderId, funderId));
      res.json(categories);
    } catch (err) {
      console.error("Error fetching funder taxonomy:", err);
      res.status(500).json({ message: "Failed to fetch taxonomy categories" });
    }
  });

  // Create funder taxonomy category
  app.post("/api/funders/:funderId/taxonomy", isAuthenticated, async (req, res) => {
    try {
      const funderId = parseId(req.params.funderId);
      const { name, description, color, keywords, rules, sortOrder } = req.body;
      const [created] = await db
        .insert(funderTaxonomyCategories)
        .values({ funderId, name, description, color, keywords, rules: rules || {}, sortOrder: sortOrder || 0 })
        .returning();
      res.status(201).json(created);
    } catch (err) {
      console.error("Error creating funder taxonomy category:", err);
      res.status(500).json({ message: "Failed to create taxonomy category" });
    }
  });

  // Update funder taxonomy category
  app.patch("/api/funders/:funderId/taxonomy/:id", isAuthenticated, async (req, res) => {
    try {
      const categoryId = parseId(req.params.id);
      const updates: Record<string, any> = {};
      for (const key of ["name", "description", "color", "keywords", "rules", "sortOrder", "active"]) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }
      const [updated] = await db
        .update(funderTaxonomyCategories)
        .set(updates)
        .where(eq(funderTaxonomyCategories.id, categoryId))
        .returning();
      if (!updated) return res.status(404).json({ message: "Category not found" });
      res.json(updated);
    } catch (err) {
      console.error("Error updating funder taxonomy category:", err);
      res.status(500).json({ message: "Failed to update taxonomy category" });
    }
  });

  // Delete funder taxonomy category
  app.delete("/api/funders/:funderId/taxonomy/:id", isAuthenticated, async (req, res) => {
    try {
      const categoryId = parseId(req.params.id);
      // Also delete related classifications and mappings
      await db.delete(funderTaxonomyClassifications).where(eq(funderTaxonomyClassifications.funderCategoryId, categoryId));
      await db.delete(funderTaxonomyMappings).where(eq(funderTaxonomyMappings.funderCategoryId, categoryId));
      await db.delete(funderTaxonomyCategories).where(eq(funderTaxonomyCategories.id, categoryId));
      res.status(204).send();
    } catch (err) {
      console.error("Error deleting funder taxonomy category:", err);
      res.status(500).json({ message: "Failed to delete taxonomy category" });
    }
  });

  // List funder taxonomy mappings (generic → funder)
  app.get("/api/funders/:funderId/taxonomy-mappings", isAuthenticated, async (req, res) => {
    try {
      const funderId = parseId(req.params.funderId);
      const categories = await db
        .select({ id: funderTaxonomyCategories.id })
        .from(funderTaxonomyCategories)
        .where(eq(funderTaxonomyCategories.funderId, funderId));
      const categoryIds = categories.map((c) => c.id);
      if (categoryIds.length === 0) return res.json([]);
      const mappings = await db
        .select()
        .from(funderTaxonomyMappings)
        .where(inArray(funderTaxonomyMappings.funderCategoryId, categoryIds));
      res.json(mappings);
    } catch (err) {
      console.error("Error fetching taxonomy mappings:", err);
      res.status(500).json({ message: "Failed to fetch taxonomy mappings" });
    }
  });

  // Create taxonomy mapping
  app.post("/api/funders/:funderId/taxonomy-mappings", isAuthenticated, async (req, res) => {
    try {
      const { funderCategoryId, genericTaxonomyId, confidenceModifier } = req.body;
      const [created] = await db
        .insert(funderTaxonomyMappings)
        .values({ funderCategoryId, genericTaxonomyId, confidenceModifier: confidenceModifier || 0 })
        .returning();
      res.status(201).json(created);
    } catch (err) {
      console.error("Error creating taxonomy mapping:", err);
      res.status(500).json({ message: "Failed to create taxonomy mapping" });
    }
  });

  // Delete taxonomy mapping
  app.delete("/api/funders/:funderId/taxonomy-mappings/:id", isAuthenticated, async (req, res) => {
    try {
      const mappingId = parseId(req.params.id);
      await db.delete(funderTaxonomyMappings).where(eq(funderTaxonomyMappings.id, mappingId));
      res.status(204).send();
    } catch (err) {
      console.error("Error deleting taxonomy mapping:", err);
      res.status(500).json({ message: "Failed to delete taxonomy mapping" });
    }
  });

  // Get classifications for a funder (with optional date range + entity type filter)
  app.get("/api/funders/:funderId/classifications", isAuthenticated, async (req, res) => {
    try {
      const funderId = parseId(req.params.funderId);
      const conds: any[] = [eq(funderTaxonomyClassifications.funderId, funderId)];
      if (req.query.entityType) {
        conds.push(eq(funderTaxonomyClassifications.entityType, parseStr(req.query.entityType)));
      }
      if (req.query.startDate) {
        conds.push(gte(funderTaxonomyClassifications.entityDate, new Date(parseStr(req.query.startDate))));
      }
      if (req.query.endDate) {
        conds.push(lte(funderTaxonomyClassifications.entityDate, new Date(parseStr(req.query.endDate))));
      }
      if (req.query.minConfidence) {
        conds.push(gte(funderTaxonomyClassifications.confidence, parseInt(parseStr(req.query.minConfidence))));
      }
      const classifications = await db
        .select({
          id: funderTaxonomyClassifications.id,
          funderId: funderTaxonomyClassifications.funderId,
          funderCategoryId: funderTaxonomyClassifications.funderCategoryId,
          entityType: funderTaxonomyClassifications.entityType,
          entityId: funderTaxonomyClassifications.entityId,
          entityDate: funderTaxonomyClassifications.entityDate,
          confidence: funderTaxonomyClassifications.confidence,
          source: funderTaxonomyClassifications.source,
          evidence: funderTaxonomyClassifications.evidence,
          categoryName: funderTaxonomyCategories.name,
          categoryColor: funderTaxonomyCategories.color,
        })
        .from(funderTaxonomyClassifications)
        .innerJoin(funderTaxonomyCategories, eq(funderTaxonomyClassifications.funderCategoryId, funderTaxonomyCategories.id))
        .where(and(...conds));

      // Batch-lookup entity titles
      const byType = new Map<string, number[]>();
      for (const c of classifications) {
        if (!byType.has(c.entityType)) byType.set(c.entityType, []);
        byType.get(c.entityType)!.push(c.entityId);
      }
      const titleMap = new Map<string, string>();
      for (const [type, ids] of byType) {
        const uniqueIds = [...new Set(ids)];
        if (uniqueIds.length === 0) continue;
        let rows: Array<{ id: number; title: string }> = [];
        if (type === "debrief") {
          rows = (await db.execute<{ id: number; title: string }>(
            `SELECT id, COALESCE(title, 'Untitled debrief') as title FROM impact_logs WHERE id = ANY(ARRAY[${uniqueIds.join(",")}])`
          )).rows;
        } else if (type === "booking") {
          rows = (await db.execute<{ id: number; title: string }>(
            `SELECT id, COALESCE(title, booker_name, 'Untitled booking') as title FROM bookings WHERE id = ANY(ARRAY[${uniqueIds.join(",")}])`
          )).rows;
        } else if (type === "programme") {
          rows = (await db.execute<{ id: number; title: string }>(
            `SELECT id, COALESCE(name, 'Untitled programme') as title FROM programmes WHERE id = ANY(ARRAY[${uniqueIds.join(",")}])`
          )).rows;
        } else if (type === "event") {
          rows = (await db.execute<{ id: number; title: string }>(
            `SELECT id, COALESCE(name, 'Untitled event') as title FROM events WHERE id = ANY(ARRAY[${uniqueIds.join(",")}])`
          )).rows;
        }
        for (const r of rows) {
          titleMap.set(`${type}-${r.id}`, r.title);
        }
      }

      const enriched = classifications.map((c) => ({
        ...c,
        entityTitle: titleMap.get(`${c.entityType}-${c.entityId}`) || "Unknown",
      }));
      res.json(enriched);
    } catch (err) {
      console.error("Error fetching classifications:", err);
      res.status(500).json({ message: "Failed to fetch classifications" });
    }
  });

  // Get all funder classifications for a specific entity
  app.get("/api/classifications/:entityType/:entityId", isAuthenticated, async (req, res) => {
    try {
      const entityType = parseStr(req.params.entityType);
      const entityId = parseId(req.params.entityId);
      const classifications = await db
        .select()
        .from(funderTaxonomyClassifications)
        .where(
          and(
            eq(funderTaxonomyClassifications.entityType, entityType),
            eq(funderTaxonomyClassifications.entityId, entityId),
          ),
        );
      res.json(classifications);
    } catch (err) {
      console.error("Error fetching entity classifications:", err);
      res.status(500).json({ message: "Failed to fetch entity classifications" });
    }
  });

  // Reclassify all entities for a funder
  app.post("/api/funders/:funderId/reclassify", isAuthenticated, async (req, res) => {
    try {
      const funderId = parseId(req.params.funderId);
      const userId = (req.user as any).claims.sub;
      const startDate = req.body.startDate ? new Date(req.body.startDate) : undefined;
      const endDate = req.body.endDate ? new Date(req.body.endDate) : undefined;
      const result = await reclassifyAllForFunder(funderId, userId, startDate, endDate);
      res.json(result);
    } catch (err) {
      console.error("Error reclassifying:", err);
      res.status(500).json({ message: "Failed to reclassify" });
    }
  });

  // Seed funder taxonomy for known funders
  app.post("/api/funders/seed-taxonomy", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const genericTaxonomy = await storage.getTaxonomy(userId);
      const allFunders = await db.select().from(funders).where(eq(funders.userId, userId));
      let seeded = 0;

      const FUNDER_SEEDS: Record<string, Array<{
        name: string; description: string; color: string;
        keywords: string[]; rules: Record<string, any>;
        inheritsFrom: string[];
      }>> = {
        "edo-auckland-council": [
          {
            name: "Inclusive Economic Growth",
            description: "Enterprise development, revenue generation, job creation in Tāmaki",
            color: "green",
            keywords: ["enterprise", "revenue", "business growth", "first sale", "hired", "income", "startup", "market"],
            rules: {},
            inheritsFrom: ["Venture Progress"],
          },
          {
            name: "Social & Sector Innovation",
            description: "Activations, workshops, events driving sector and social innovation",
            color: "blue",
            keywords: ["wananga", "activation", "innovation", "workshop", "sector", "coworking"],
            rules: { includeEventTypes: ["External Event", "Programme Session"] },
            inheritsFrom: ["Hub Engagement", "Network & Ecosystem Connection"],
          },
          {
            name: "Ecosystem Building",
            description: "Partnerships, referrals, co-investment, collaboration across the ecosystem",
            color: "orange",
            keywords: ["partnership", "referral", "co-investment", "collaboration", "GridAKL", "network"],
            rules: {},
            inheritsFrom: ["Network & Ecosystem Connection"],
          },
          {
            name: "Tāmaki Rohe Contribution",
            description: "Local enterprise retention, Glen Innes-specific outcomes",
            color: "teal",
            keywords: ["local enterprise", "Glen Innes", "Tāmaki", "retained", "community hub", "local"],
            rules: {},
            inheritsFrom: ["Hub Engagement", "Venture Progress"],
          },
        ],
        "nga-matarae": [
          {
            name: "Māori Enterprise Development",
            description: "Māori-led business growth, whanau enterprise, kaupapa Māori economic outcomes",
            color: "green",
            keywords: ["Māori business", "whanau enterprise", "kaupapa", "Māori-led", "iwi", "hapū"],
            rules: { communityLens: "maori" },
            inheritsFrom: ["Venture Progress", "Skills & Capability Growth"],
          },
          {
            name: "Rangatahi Māori Outcomes",
            description: "Youth Māori development, taiohi enterprise, rangatahi pathways",
            color: "pink",
            keywords: ["rangatahi Māori", "taiohi", "youth Māori", "young Māori", "school leaver"],
            rules: { communityLens: "maori", requireContactFlags: { isRangatahi: true } },
            inheritsFrom: ["Rangatahi Development"],
          },
          {
            name: "Whānau Capability",
            description: "Confidence, capability, mana building for whānau Māori",
            color: "purple",
            keywords: ["whānau", "confidence", "capability", "mana", "growth", "upskill"],
            rules: { communityLens: "maori" },
            inheritsFrom: ["Skills & Capability Growth"],
          },
          {
            name: "Cultural Connection",
            description: "Tikanga, te reo, whakapapa, wānanga — cultural grounding through the hub",
            color: "amber",
            keywords: ["tikanga", "te reo", "whakapapa", "wānanga", "karakia", "mihi", "kōrero"],
            rules: {},
            inheritsFrom: ["Hub Engagement"],
          },
        ],
        "foundation-north": [
          {
            name: "Increased Equity",
            description: "Māori and Pasifika-led outcomes, self-determination, community solutions",
            color: "green",
            keywords: ["equity", "Māori-led", "community solution", "self-determination", "Pasifika-led"],
            rules: { communityLens: "maori" },
            inheritsFrom: ["Venture Progress", "Skills & Capability Growth"],
          },
          {
            name: "Community Resilience",
            description: "Community events, hui, belonging, placemaking",
            color: "blue",
            keywords: ["community event", "hui", "belonging", "resilient", "placemaking", "whānau"],
            rules: {},
            inheritsFrom: ["Hub Engagement", "Network & Ecosystem Connection"],
          },
          {
            name: "Te Tiriti Outcomes",
            description: "Te reo, tikanga, kaupapa Māori governance, mana whenua connections",
            color: "purple",
            keywords: ["te reo", "tikanga", "kaupapa Māori", "Māori governance", "mana whenua", "Ngāti Pāoa"],
            rules: {},
            inheritsFrom: [],
          },
        ],
      };

      for (const funder of allFunders) {
        const tag = funder.funderTag;
        if (!tag || !FUNDER_SEEDS[tag]) continue;

        // Check if already seeded
        const existing = await db
          .select({ id: funderTaxonomyCategories.id })
          .from(funderTaxonomyCategories)
          .where(eq(funderTaxonomyCategories.funderId, funder.id));
        if (existing.length > 0) continue;

        const seeds = FUNDER_SEEDS[tag];
        for (let i = 0; i < seeds.length; i++) {
          const seed = seeds[i];
          const [cat] = await db
            .insert(funderTaxonomyCategories)
            .values({
              funderId: funder.id,
              name: seed.name,
              description: seed.description,
              color: seed.color,
              keywords: seed.keywords,
              rules: seed.rules,
              sortOrder: i,
            })
            .returning();

          // Create mappings to generic taxonomy
          for (const genericName of seed.inheritsFrom) {
            const generic = genericTaxonomy.find((t) => t.name === genericName);
            if (generic) {
              await db.insert(funderTaxonomyMappings).values({
                funderCategoryId: cat.id,
                genericTaxonomyId: generic.id,
                confidenceModifier: 0,
              });
            }
          }
        }
        seeded++;
      }

      res.json({ seeded, message: `Seeded taxonomy for ${seeded} funder(s)` });
    } catch (err) {
      console.error("Error seeding funder taxonomy:", err);
      res.status(500).json({ message: "Failed to seed taxonomy" });
    }
  });
}
