// Tracking routes — community spend, monthly snapshots, foot traffic, catch-up list, report highlights, recurring templates
import type { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { dailyFootTraffic, insertCommunitySpendSchema } from "@shared/schema";
import { ObjectStorageService } from "../replit_integrations/object_storage";
import { parseId, parseStr, coerceDateFields } from "./_helpers";
import { setupAuth, isAuthenticated } from "../replit_integrations/auth";

export function registerTrackingRoutes(app: Express) {

  // === Community Spend API ===

  app.get("/api/community-spend", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const items = await storage.getCommunitySpend(userId);
      const allContacts = await storage.getContacts(userId);
      const allGroups = await storage.getGroups(userId);
      const allProgrammes = await storage.getProgrammes(userId);
      const enriched = items.map(item => ({
        ...item,
        contactName: item.contactId ? allContacts.find(c => c.id === item.contactId)?.name : null,
        groupName: item.groupId ? allGroups.find(g => g.id === item.groupId)?.name : null,
        programmeName: item.programmeId ? allProgrammes.find(p => p.id === item.programmeId)?.name : null,
      }));
      res.json(enriched);
    } catch (err: any) {
      console.error("Community spend error:", err);
      res.status(500).json({ message: "Failed to fetch community spend" });
    }
  });

  app.post("/api/community-spend", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const body = coerceDateFields({ ...req.body, userId });
      if (body.amount !== undefined && typeof body.amount === 'number') body.amount = String(body.amount);
      const input = insertCommunitySpendSchema.parse(body);
      const item = await storage.createCommunitySpend(input);
      res.status(201).json(item);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      console.error("Create community spend error:", err);
      res.status(500).json({ message: "Failed to create community spend" });
    }
  });

  app.put("/api/community-spend/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
      const existing = await storage.getCommunitySpendItem(id);
      if (!existing || String(existing.userId) !== String(userId)) return res.status(404).json({ message: "Not found" });
      const body = coerceDateFields(req.body);
      if (body.amount !== undefined && typeof body.amount === 'number') body.amount = String(body.amount);
      const updated = await storage.updateCommunitySpend(id, body);
      res.json(updated);
    } catch (err: any) {
      console.error("Update community spend error:", err);
      res.status(500).json({ message: "Failed to update community spend" });
    }
  });

  app.delete("/api/community-spend/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
      const existing = await storage.getCommunitySpendItem(id);
      if (!existing || String(existing.userId) !== String(userId)) return res.status(404).json({ message: "Not found" });
      await storage.deleteCommunitySpend(id);
      res.status(204).end();
    } catch (err: any) {
      console.error("Delete community spend error:", err);
      res.status(500).json({ message: "Failed to delete community spend" });
    }
  });

  app.get("/api/community-spend/summary", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const items = await storage.getCommunitySpend(userId);
      const totalSpend = items.reduce((sum, i) => sum + parseFloat(String(i.amount)), 0);
      const byCategory: Record<string, number> = {};
      const byGroup: Record<string, number> = {};
      const byMonth: Record<string, number> = {};

      for (const item of items) {
        byCategory[item.category] = (byCategory[item.category] || 0) + parseFloat(String(item.amount));
        if (item.groupId) {
          const groups = await storage.getGroups(userId);
          const group = groups.find(g => g.id === item.groupId);
          if (group) {
            byGroup[group.name] = (byGroup[group.name] || 0) + parseFloat(String(item.amount));
          }
        }
        if (item.date) {
          const monthKey = new Date(item.date).toISOString().slice(0, 7);
          byMonth[monthKey] = (byMonth[monthKey] || 0) + parseFloat(String(item.amount));
        }
      }

      res.json({ totalSpend, byCategory, byGroup, byMonth, totalEntries: items.length });
    } catch (err: any) {
      console.error("Community spend summary error:", err);
      res.status(500).json({ message: "Failed to fetch summary" });
    }
  });

  // === MONTHLY SNAPSHOTS ===

  app.get("/api/monthly-snapshots", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const snapshots = await storage.getMonthlySnapshots(userId);
      res.json(snapshots);
    } catch (err: any) {
      console.error("Get monthly snapshots error:", err);
      res.status(500).json({ message: "Failed to fetch monthly snapshots" });
    }
  });

  app.post("/api/monthly-snapshots", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { month, footTraffic, notes } = req.body;
      if (!month) {
        return res.status(400).json({ message: "Month is required" });
      }
      const monthDate = new Date(month);
      monthDate.setDate(1);
      monthDate.setHours(0, 0, 0, 0);
      const snapshot = await storage.upsertMonthlySnapshot(userId, monthDate, { footTraffic, notes });
      res.json(snapshot);
    } catch (err: any) {
      console.error("Upsert monthly snapshot error:", err);
      res.status(500).json({ message: "Failed to save monthly snapshot" });
    }
  });

  app.delete("/api/monthly-snapshots/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteMonthlySnapshot(parseId(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete monthly snapshot error:", err);
      res.status(500).json({ message: "Failed to delete monthly snapshot" });
    }
  });

  // === FOOT TRAFFIC TOUCHPOINTS ===

  app.get("/api/monthly-snapshots/:id/touchpoints", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const snapshot = await storage.getMonthlySnapshot(parseId(req.params.id));
      if (!snapshot || snapshot.userId !== userId) {
        return res.status(404).json({ message: "Snapshot not found" });
      }
      const touchpoints = await storage.getFootTrafficTouchpoints(snapshot.id);
      res.json(touchpoints);
    } catch (err: any) {
      console.error("Get touchpoints error:", err);
      res.status(500).json({ message: "Failed to fetch touchpoints" });
    }
  });

  app.post("/api/monthly-snapshots/:id/touchpoints", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const snapshotId = parseId(req.params.id);
      const snapshot = await storage.getMonthlySnapshot(snapshotId);
      if (!snapshot || snapshot.userId !== userId) {
        return res.status(404).json({ message: "Snapshot not found" });
      }
      const { contactId, groupId, description } = req.body;
      if (!description) {
        return res.status(400).json({ message: "Description is required" });
      }
      const touchpoint = await storage.createFootTrafficTouchpoint({
        userId,
        snapshotId,
        contactId: contactId || null,
        groupId: groupId || null,
        description,
      });
      res.json(touchpoint);
    } catch (err: any) {
      console.error("Create touchpoint error:", err);
      res.status(500).json({ message: "Failed to create touchpoint" });
    }
  });

  app.delete("/api/monthly-snapshots/:id/touchpoints/:touchpointId", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const snapshot = await storage.getMonthlySnapshot(parseId(req.params.id));
      if (!snapshot || snapshot.userId !== userId) {
        return res.status(404).json({ message: "Snapshot not found" });
      }
      await storage.deleteFootTrafficTouchpoint(parseId(req.params.touchpointId));
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete touchpoint error:", err);
      res.status(500).json({ message: "Failed to delete touchpoint" });
    }
  });

  // === DAILY FOOT TRAFFIC ===

  app.get("/api/daily-foot-traffic", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const month = parseStr(req.query.month);
      if (!month) return res.status(400).json({ message: "month query param required" });
      const monthDate = new Date(month);
      const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);
      const rows = await db.select().from(dailyFootTraffic)
        .where(and(
          eq(dailyFootTraffic.userId, userId),
          gte(dailyFootTraffic.date, start),
          lte(dailyFootTraffic.date, end),
        ));
      res.json(rows);
    } catch (err: any) {
      console.error("Get daily foot traffic error:", err);
      res.status(500).json({ message: "Failed to fetch daily foot traffic" });
    }
  });

  app.post("/api/daily-foot-traffic", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { date, count, notes } = req.body;
      if (!date || count === undefined) return res.status(400).json({ message: "date and count required" });
      const dateObj = new Date(date);
      const dayStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
      const existing = await db.select().from(dailyFootTraffic)
        .where(and(
          eq(dailyFootTraffic.userId, userId),
          eq(dailyFootTraffic.date, dayStart),
        ));
      let result;
      if (existing.length > 0) {
        const updates: any = { count: parseInt(count) };
        if (notes !== undefined) updates.notes = notes;
        [result] = await db.update(dailyFootTraffic)
          .set(updates)
          .where(eq(dailyFootTraffic.id, existing[0].id))
          .returning();
      } else {
        [result] = await db.insert(dailyFootTraffic).values({
          userId,
          date: dayStart,
          count: parseInt(count),
          notes: notes || null,
        }).returning();
      }
      res.json(result);
    } catch (err: any) {
      console.error("Save daily foot traffic error:", err);
      res.status(500).json({ message: "Failed to save daily foot traffic" });
    }
  });

  // === RECURRING BOOKING TEMPLATES ===

  app.get("/api/recurring-booking-templates", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const rows = await db.execute(
        sql`SELECT * FROM recurring_booking_templates WHERE user_id = ${userId} ORDER BY created_at DESC`
      );
      res.json(rows.rows);
    } catch (err: any) {
      console.error("Get recurring booking templates error:", err);
      res.status(500).json({ message: "Failed to fetch recurring booking templates" });
    }
  });

  app.post("/api/recurring-booking-templates", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { name, venue_id, classification, day_of_week, start_time, end_time, start_date, end_date, booker_name, notes } = req.body;
      if (!name || day_of_week === undefined || day_of_week === null) {
        return res.status(400).json({ message: "name and day_of_week are required" });
      }
      const result = await db.execute(
        sql`INSERT INTO recurring_booking_templates
          (user_id, name, venue_id, classification, day_of_week, start_time, end_time, start_date, end_date, booker_name, notes, active)
          VALUES (${userId}, ${name}, ${venue_id || null}, ${classification || null}, ${day_of_week}, ${start_time || null}, ${end_time || null}, ${start_date || null}, ${end_date || null}, ${booker_name || null}, ${notes || null}, true)
          RETURNING *`
      );
      res.status(201).json(result.rows[0]);
    } catch (err: any) {
      console.error("Create recurring booking template error:", err);
      res.status(500).json({ message: "Failed to create recurring booking template" });
    }
  });

  app.patch("/api/recurring-booking-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
      const { name, venue_id, classification, day_of_week, start_time, end_time, start_date, end_date, booker_name, notes, active } = req.body;
      const result = await db.execute(
        sql`UPDATE recurring_booking_templates SET
          name = COALESCE(${name ?? null}, name),
          venue_id = COALESCE(${venue_id !== undefined ? venue_id : null}::integer, venue_id),
          classification = COALESCE(${classification ?? null}, classification),
          day_of_week = COALESCE(${day_of_week !== undefined ? day_of_week : null}::integer, day_of_week),
          start_time = COALESCE(${start_time ?? null}, start_time),
          end_time = COALESCE(${end_time ?? null}, end_time),
          start_date = COALESCE(${start_date ?? null}::date, start_date),
          end_date = COALESCE(${end_date ?? null}::date, end_date),
          booker_name = COALESCE(${booker_name ?? null}, booker_name),
          notes = COALESCE(${notes ?? null}, notes),
          active = COALESCE(${active !== undefined ? active : null}::boolean, active)
          WHERE id = ${id} AND user_id = ${userId}
          RETURNING *`
      );
      if (result.rows.length === 0) return res.status(404).json({ message: "Template not found" });
      res.json(result.rows[0]);
    } catch (err: any) {
      console.error("Update recurring booking template error:", err);
      res.status(500).json({ message: "Failed to update recurring booking template" });
    }
  });

  app.delete("/api/recurring-booking-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
      await db.execute(
        sql`DELETE FROM recurring_booking_templates WHERE id = ${id} AND user_id = ${userId}`
      );
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete recurring booking template error:", err);
      res.status(500).json({ message: "Failed to delete recurring booking template" });
    }
  });

  // === CATCH UP LIST ===

  app.get("/api/catch-up-list/history", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const history = await storage.getCatchUpListHistory(userId);
      res.json(history);
    } catch (err: any) {
      console.error("Get catch-up history error:", err);
      res.status(500).json({ message: "Failed to fetch catch-up history" });
    }
  });

  app.get("/api/catch-up-list/last-caught-up", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const dates = await storage.getLastCaughtUpDates(userId);
      res.json(dates);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch last caught-up dates" });
    }
  });

  app.get("/api/catch-up-list", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const items = await storage.getCatchUpList(userId);
      res.json(items);
    } catch (err: any) {
      console.error("Get catch-up list error:", err);
      res.status(500).json({ message: "Failed to fetch catch-up list" });
    }
  });

  app.post("/api/catch-up-list", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { contactId, note, priority } = req.body;
      if (!contactId) {
        return res.status(400).json({ message: "Contact ID is required" });
      }
      const item = await storage.addToCatchUpList({
        userId,
        contactId,
        note: note || null,
        priority: priority || "soon",
      });
      res.json(item);
    } catch (err: any) {
      console.error("Add to catch-up list error:", err);
      res.status(500).json({ message: "Failed to add to catch-up list" });
    }
  });

  app.patch("/api/catch-up-list/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
      const existing = await storage.getCatchUpList(userId);
      const history = await storage.getCatchUpListHistory(userId);
      const allItems = [...existing, ...history];
      if (!allItems.find((item: any) => item.id === id)) {
        return res.status(404).json({ message: "Catch-up item not found" });
      }
      const { note, priority, dismiss } = req.body;
      if (dismiss) {
        const item = await storage.dismissCatchUpItem(id);
        return res.json(item);
      }
      const updates: any = {};
      if (note !== undefined) updates.note = note;
      if (priority !== undefined) updates.priority = priority;
      const item = await storage.updateCatchUpItem(id, updates);
      res.json(item);
    } catch (err: any) {
      console.error("Update catch-up item error:", err);
      res.status(500).json({ message: "Failed to update catch-up item" });
    }
  });

  app.delete("/api/catch-up-list/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const existing = await storage.getCatchUpList(userId);
      const history = await storage.getCatchUpListHistory(userId);
      const allItems = [...existing, ...history];
      const id = parseId(req.params.id);
      if (!allItems.find((item: any) => item.id === id)) {
        return res.status(404).json({ message: "Catch-up item not found" });
      }
      await storage.removeCatchUpItem(id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete catch-up item error:", err);
      res.status(500).json({ message: "Failed to delete catch-up item" });
    }
  });

  // === Catch-up suggestions ===
  app.get("/api/contacts/catch-up-suggestions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const result = await db.execute(sql`
        SELECT c.id, c.name, c.role, c.relationship_stage as stage,
          c.is_community_member, c.is_innovator,
          (SELECT MAX(i.created_at) FROM interactions i WHERE i.contact_id = c.id) as last_interaction
        FROM contacts c
        WHERE c.user_id = ${userId} AND c.active = true AND c.is_archived = false
          AND (c.is_community_member = true OR c.is_innovator = true)
          AND c.id NOT IN (SELECT contact_id FROM catch_up_list WHERE user_id = ${userId} AND dismissed_at IS NULL)
        ORDER BY last_interaction ASC NULLS FIRST
      `);

      const now = Date.now();
      const suggestions = (result.rows || []).map((r: any) => {
        const lastDate = r.last_interaction ? new Date(r.last_interaction).getTime() : null;
        const daysSince = lastDate ? Math.floor((now - lastDate) / (1000 * 60 * 60 * 24)) : null;
        const urgency = daysSince === null ? "overdue" : daysSince > 90 ? "overdue" : daysSince > 60 ? "soon" : daysSince > 30 ? "upcoming" : null;
        if (!urgency) return null;
        return {
          id: r.id,
          name: r.name,
          role: r.role,
          stage: r.stage,
          daysSinceLastInteraction: daysSince,
          urgency,
        };
      }).filter(Boolean);

      res.json(suggestions);
    } catch (err: any) {
      console.error("Catch-up suggestions error:", err);
      res.status(500).json({ message: "Failed to get suggestions" });
    }
  });

  // === REPORT HIGHLIGHTS ===

  app.get("/api/report-highlights", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const highlights = await storage.getReportHighlights(userId);
      res.json(highlights);
    } catch (err: any) {
      console.error("Get report highlights error:", err);
      res.status(500).json({ message: "Failed to fetch report highlights" });
    }
  });

  app.post("/api/report-highlights", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { title, description, category, month, photoUrl } = req.body;
      if (!title || !description || !category || !month) {
        return res.status(400).json({ message: "Title, description, category, and month are required" });
      }
      const monthDate = new Date(month);
      let finalPhotoUrl = photoUrl || null;
      if (finalPhotoUrl) {
        try {
          const objService = new ObjectStorageService();
          finalPhotoUrl = await objService.trySetObjectEntityAclPolicy(finalPhotoUrl, {
            owner: userId,
            visibility: "public",
          });
        } catch (e) {
          console.error("Failed to set ACL on photo:", e);
        }
      }
      const highlight = await storage.createReportHighlight({
        userId,
        title,
        description,
        category,
        month: monthDate,
        photoUrl: finalPhotoUrl,
      });
      res.json(highlight);
    } catch (err: any) {
      console.error("Create report highlight error:", err);
      res.status(500).json({ message: "Failed to create report highlight" });
    }
  });

  app.delete("/api/report-highlights/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteReportHighlight(parseId(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete report highlight error:", err);
      res.status(500).json({ message: "Failed to delete report highlight" });
    }
  });

} // end registerTrackingRoutes
