import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { api } from "@shared/routes";
import { claudeJSON, AIKeyMissingError } from "../replit_integrations/anthropic/client";
import { parseId } from "./_helpers";

export function registerInteractionRoutes(app: Express) {
  app.get(api.interactions.list.path, isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const contactId = req.query.contactId ? parseId(req.query.contactId) : undefined;
    if (contactId) {
      const contact = await storage.getContact(contactId);
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      if (contact.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const interactionsList = await storage.getInteractions(contactId);
      return res.json(interactionsList);
    }
    const userContacts = await storage.getContacts(userId);
    const allInteractions = await Promise.all(userContacts.map((c) => storage.getInteractions(c.id)));
    res.json(allInteractions.flat().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  });

  app.post(api.interactions.create.path, isAuthenticated, async (req, res) => {
    try {
      const contact = await storage.getContact(req.body.contactId);
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      if (contact.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });
      const input = api.interactions.create.input.parse(req.body);
      const interaction = await storage.createInteraction(input);
      res.status(201).json(interaction);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      throw err;
    }
  });

  app.post(api.interactions.analyze.path, isAuthenticated, async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ message: "Text required" });
      const prompt = `
        Analyze the following mentorship interaction text and extract key metrics and insights.
        Return a JSON object with:
        - summary: A concise summary of the interaction (max 2 sentences).
        - keywords: Array of 3-5 important tags/keywords.
        - metrics: Object with these scores from 1-10 based on the text:
          - mindset: Growth mindset and mental resilience
          - skill: Capability level (technical, creative, or business skills)
          - confidence: Personal self-confidence demonstrated
          - bizConfidence: Business confidence
          - systemsInPlace: How well their venture systems are established
          - fundingReadiness: Sustainability readiness
          - networkStrength: Connection strength
          - communityImpact: Evidence of positive community impact
          - digitalPresence: Online presence strength
        Text: "${text}"
      `;
      const result = await claudeJSON({ model: "claude-sonnet-4-6", prompt });
      res.json({
        summary: result.summary || "No summary generated.",
        keywords: result.keywords || [],
        metrics: {
          mindset: result.metrics?.mindset || 5, skill: result.metrics?.skill || 5,
          confidence: result.metrics?.confidence || 5, bizConfidence: result.metrics?.bizConfidence || 5,
          systemsInPlace: result.metrics?.systemsInPlace || 5, fundingReadiness: result.metrics?.fundingReadiness || 5,
          networkStrength: result.metrics?.networkStrength || 5, communityImpact: result.metrics?.communityImpact || 5,
          digitalPresence: result.metrics?.digitalPresence || 5,
        },
      });
    } catch (error: any) {
      if (error instanceof AIKeyMissingError) return res.status(503).json({ message: error.message });
      console.error("Analysis error:", error);
      res.status(500).json({ message: "Failed to analyze text" });
    }
  });
}
