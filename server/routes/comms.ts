import type { Express } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { db } from "../db";
import { sql } from "drizzle-orm";

export function registerCommsRoutes(app: Express) {
  // === Stories ===

  app.get("/api/comms/stories", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const rows = await db.execute(
        sql`SELECT id, user_id, title, body, pull_quote, contact_id, impact_log_id, status, created_at, updated_at
            FROM comms_stories WHERE user_id = ${userId} ORDER BY created_at DESC`
      );
      const stories = (rows.rows || []).map((r: any) => ({
        id: r.id, userId: r.user_id, title: r.title, body: r.body,
        pullQuote: r.pull_quote, contactId: r.contact_id, impactLogId: r.impact_log_id,
        status: r.status, createdAt: r.created_at, updatedAt: r.updated_at,
      }));
      res.json(stories);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/comms/stories", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { title, body, pull_quote, contact_id, impact_log_id } = req.body;
      if (!title) return res.status(400).json({ message: "Title is required" });
      const result = await db.execute(
        sql`INSERT INTO comms_stories (user_id, title, body, pull_quote, contact_id, impact_log_id, status)
            VALUES (${userId}, ${title}, ${body || null}, ${pull_quote || null}, ${contact_id || null}, ${impact_log_id || null}, 'draft')
            RETURNING *`
      );
      const row = result.rows[0] as any;
      res.json({
        id: row.id, userId: row.user_id, title: row.title, body: row.body,
        pullQuote: row.pull_quote, contactId: row.contact_id, impactLogId: row.impact_log_id,
        status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/comms/stories/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseInt(String(req.params.id));
      const { title, body, pull_quote, status } = req.body;
      const result = await db.execute(
        sql`UPDATE comms_stories SET updated_at = now(),
            title = COALESCE(${title !== undefined ? title : null}::text, title),
            body = CASE WHEN ${body !== undefined} THEN ${body || null} ELSE body END,
            pull_quote = CASE WHEN ${pull_quote !== undefined} THEN ${pull_quote || null} ELSE pull_quote END,
            status = COALESCE(${status || null}::text, status)
            WHERE id = ${id} AND user_id = ${userId}
            RETURNING *`
      );
      const row = result.rows[0] as any;
      if (!row) return res.status(404).json({ message: "Story not found" });
      res.json({
        id: row.id, title: row.title, body: row.body, pullQuote: row.pull_quote,
        status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === Newsletters ===

  app.get("/api/comms/newsletters", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const rows = await db.execute(
        sql`SELECT id, user_id, subject, intro, body, footer, story_ids, status, sent_at, recipient_count, created_at
            FROM comms_newsletters WHERE user_id = ${userId} ORDER BY created_at DESC`
      );
      const items = (rows.rows || []).map((r: any) => ({
        id: r.id, subject: r.subject, intro: r.intro, body: r.body, footer: r.footer,
        storyIds: r.story_ids, status: r.status, sentAt: r.sent_at,
        recipientCount: r.recipient_count, createdAt: r.created_at,
      }));
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/comms/newsletters", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { subject, intro, body, footer, story_ids } = req.body;
      if (!subject) return res.status(400).json({ message: "Subject is required" });
      const result = await db.execute(
        sql`INSERT INTO comms_newsletters (user_id, subject, intro, body, footer, story_ids, status)
            VALUES (${userId}, ${subject}, ${intro || null}, ${body || null}, ${footer || null}, ${story_ids && story_ids.length > 0 ? story_ids : null}::integer[], 'draft')
            RETURNING *`
      );
      const row = result.rows[0] as any;
      res.json({
        id: row.id, subject: row.subject, intro: row.intro, body: row.body,
        footer: row.footer, storyIds: row.story_ids, status: row.status,
        sentAt: row.sent_at, recipientCount: row.recipient_count, createdAt: row.created_at,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/comms/newsletters/:id/send", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseInt(String(req.params.id));

      const nlResult = await db.execute(
        sql`SELECT * FROM comms_newsletters WHERE id = ${id} AND user_id = ${userId}`
      );
      const nl = nlResult.rows[0] as any;
      if (!nl) return res.status(404).json({ message: "Newsletter not found" });

      const contacts = await storage.getContacts(userId);
      const emailContacts = contacts.filter((c: any) => c.email && c.active !== false);

      let storiesHtml = "";
      if (nl.story_ids && nl.story_ids.length > 0) {
        const storyResult = await db.execute(
          sql`SELECT * FROM comms_stories WHERE id = ANY(${nl.story_ids}::integer[]) AND status = 'published'`
        );
        for (const story of storyResult.rows as any[]) {
          storiesHtml += `<hr style="margin: 24px 0; border-color: #e2e8f0;"/>
            <h3 style="margin-bottom: 8px;">${story.title}</h3>
            ${story.body ? `<p>${story.body}</p>` : ""}
            ${story.pull_quote ? `<blockquote style="border-left: 3px solid #8b5cf6; padding-left: 12px; margin: 12px 0; color: #6b7280; font-style: italic;">${story.pull_quote}</blockquote>` : ""}
          `;
        }
      }

      const htmlBody = `
        <div style="max-width: 600px; margin: 0 auto; font-family: sans-serif; color: #1e293b;">
          <h2 style="color: #0f172a;">${nl.subject}</h2>
          ${nl.intro ? `<p>${nl.intro}</p>` : ""}
          ${nl.body ? `<p>${nl.body}</p>` : ""}
          ${storiesHtml}
          ${nl.footer ? `<hr style="margin: 24px 0;"/><p style="color: #64748b; font-size: 12px;">${nl.footer}</p>` : ""}
          <p style="color: #94a3b8; font-size: 11px; margin-top: 24px;">Sent from Reserve Tāmaki · kiaora@reservetmk.co.nz</p>
        </div>
      `;

      const { getGmailClientForSending } = await import("../gmail-send");
      const gmail = await getGmailClientForSending(userId);

      let sent = 0;
      for (const contact of emailContacts.slice(0, 200)) {
        try {
          const rawMessage = [
            `To: ${contact.email}`,
            `Subject: ${nl.subject}`,
            `MIME-Version: 1.0`,
            `Content-Type: text/html; charset="UTF-8"`,
            ``,
            htmlBody,
          ].join("\r\n");
          const encoded = Buffer.from(rawMessage).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
          await gmail.users.messages.send({ userId: "me", requestBody: { raw: encoded } });
          sent++;
        } catch (emailErr: any) {
          console.error(`[comms] Failed to send newsletter to ${contact.email}:`, emailErr.message);
        }
      }

      await db.execute(
        sql`UPDATE comms_newsletters SET status = 'sent', sent_at = now(), recipient_count = ${sent} WHERE id = ${id}`
      );

      res.json({ success: true, sent });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === Announcements ===

  app.get("/api/comms/announcements", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const rows = await db.execute(
        sql`SELECT id, user_id, subject, body, target_type, target_id, sent_at, recipient_count, created_at
            FROM comms_announcements WHERE user_id = ${userId} ORDER BY created_at DESC`
      );
      const items = (rows.rows || []).map((r: any) => ({
        id: r.id, subject: r.subject, body: r.body, targetType: r.target_type,
        targetId: r.target_id, sentAt: r.sent_at, recipientCount: r.recipient_count, createdAt: r.created_at,
      }));
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/comms/announcements", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { subject, body, target_type, target_id } = req.body;
      if (!subject || !body) return res.status(400).json({ message: "Subject and body are required" });
      const result = await db.execute(
        sql`INSERT INTO comms_announcements (user_id, subject, body, target_type, target_id)
            VALUES (${userId}, ${subject}, ${body}, ${target_type || "all"}, ${target_id || null})
            RETURNING *`
      );
      const row = result.rows[0] as any;
      res.json({
        id: row.id, subject: row.subject, body: row.body,
        targetType: row.target_type, targetId: row.target_id, createdAt: row.created_at,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/comms/announcements/:id/send", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseInt(String(req.params.id));

      const annResult = await db.execute(
        sql`SELECT * FROM comms_announcements WHERE id = ${id} AND user_id = ${userId}`
      );
      const ann = annResult.rows[0] as any;
      if (!ann) return res.status(404).json({ message: "Announcement not found" });

      let emailContacts: any[] = [];
      const allContacts = await storage.getContacts(userId);

      if (ann.target_type === "all") {
        emailContacts = allContacts.filter((c: any) => c.email && c.active !== false);
      } else if (ann.target_type === "group" && ann.target_id) {
        const group = await storage.getGroupMembers(ann.target_id);
        const groupContactIds = new Set(group.map((m: any) => m.contactId));
        emailContacts = allContacts.filter((c: any) => c.email && groupContactIds.has(c.id));
      } else if (ann.target_type === "cohort" && ann.target_id) {
        const registrations = await storage.getProgrammeRegistrations(ann.target_id);
        const regContactIds = new Set(registrations.map((r: any) => r.contactId));
        emailContacts = allContacts.filter((c: any) => c.email && regContactIds.has(c.id));
      }

      const htmlBody = `
        <div style="max-width: 600px; margin: 0 auto; font-family: sans-serif; color: #1e293b;">
          <h2 style="color: #0f172a;">${ann.subject}</h2>
          <p style="white-space: pre-wrap;">${ann.body}</p>
          <p style="color: #94a3b8; font-size: 11px; margin-top: 24px;">From Reserve Tāmaki · kiaora@reservetmk.co.nz</p>
        </div>
      `;

      const { getGmailClientForSending } = await import("../gmail-send");
      const gmail = await getGmailClientForSending(userId);

      let sent = 0;
      for (const contact of emailContacts.slice(0, 200)) {
        try {
          const rawMessage = [
            `To: ${contact.email}`,
            `Subject: ${ann.subject}`,
            `MIME-Version: 1.0`,
            `Content-Type: text/html; charset="UTF-8"`,
            ``,
            htmlBody,
          ].join("\r\n");
          const encoded = Buffer.from(rawMessage).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
          await gmail.users.messages.send({ userId: "me", requestBody: { raw: encoded } });
          sent++;
        } catch (emailErr: any) {
          console.error(`[comms] Failed to send announcement to ${contact.email}:`, emailErr.message);
        }
      }

      await db.execute(
        sql`UPDATE comms_announcements SET sent_at = now(), recipient_count = ${sent} WHERE id = ${id}`
      );

      res.json({ success: true, sent });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}
