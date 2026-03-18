import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { AIKeyMissingError } from "./replit_integrations/anthropic/client";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && res.statusCode >= 400) {
        const msg = capturedJsonResponse.message || '';
        if (msg) logLine += ` :: ${msg.substring(0, 100)}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  if (!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) {
    console.warn("WARNING: AI_INTEGRATIONS_ANTHROPIC_API_KEY is not set. AI features using Anthropic (interaction analysis, impact extraction) will be unavailable.");
  }
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    console.warn("WARNING: AI_INTEGRATIONS_OPENAI_API_KEY is not set. AI features using OpenAI (audio transcription, text-to-speech) will be unavailable.");
  }

  try {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS allowed_users (
        id serial PRIMARY KEY,
        email varchar NOT NULL UNIQUE,
        invited_by varchar NOT NULL,
        status varchar NOT NULL DEFAULT 'pending',
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);
    console.log("[migration] Invite-only access tables ensured");
  } catch (migrationErr: any) {
    console.warn("[migration] Invite-only access migration skipped:", migrationErr.message);
  }

  await registerRoutes(httpServer, app);

  try {
    const { LEGACY_STAGE_MAP } = await import("@shared/schema");
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    for (const [oldStage, newStage] of Object.entries(LEGACY_STAGE_MAP)) {
      await db.execute(sql`UPDATE contacts SET relationship_stage = ${newStage} WHERE relationship_stage = ${oldStage}`);
      await db.execute(sql`UPDATE contacts SET stage = ${newStage} WHERE stage = ${oldStage}`);
      await db.execute(sql`UPDATE groups SET relationship_stage = ${newStage} WHERE relationship_stage = ${oldStage}`);
      await db.execute(sql`UPDATE relationship_stage_history SET previous_stage = ${newStage} WHERE previous_stage = ${oldStage}`);
      await db.execute(sql`UPDATE relationship_stage_history SET new_stage = ${newStage} WHERE new_stage = ${oldStage}`);
    }
    console.log("[migration] Legacy stage values migrated to kakano/tipu/ora/inactive");
  } catch (migrationErr: any) {
    console.warn("[migration] Stage migration skipped:", migrationErr.message);
  }

  try {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    const newSchedule = JSON.stringify({
      monday: { open: true, startTime: "00:00", endTime: "23:59" },
      tuesday: { open: true, startTime: "00:00", endTime: "23:59" },
      wednesday: { open: true, startTime: "00:00", endTime: "23:59" },
      thursday: { open: true, startTime: "00:00", endTime: "23:59" },
      friday: { open: true, startTime: "00:00", endTime: "23:59" },
      saturday: { open: true, startTime: "00:00", endTime: "23:59" },
      sunday: { open: true, startTime: "00:00", endTime: "23:59" },
    });
    const result = await db.execute(
      sql`UPDATE venues SET availability_schedule = ${newSchedule}::jsonb
          WHERE availability_schedule IS NULL
          OR (
            (availability_schedule->'monday'->>'open') = 'true'
            AND (availability_schedule->'monday'->>'startTime') = '08:00'
            AND (availability_schedule->'monday'->>'endTime') = '17:00'
            AND (availability_schedule->'tuesday'->>'open') = 'true'
            AND (availability_schedule->'tuesday'->>'startTime') = '08:00'
            AND (availability_schedule->'tuesday'->>'endTime') = '17:00'
            AND (availability_schedule->'wednesday'->>'open') = 'true'
            AND (availability_schedule->'wednesday'->>'startTime') = '08:00'
            AND (availability_schedule->'wednesday'->>'endTime') = '17:00'
            AND (availability_schedule->'thursday'->>'open') = 'true'
            AND (availability_schedule->'thursday'->>'startTime') = '08:00'
            AND (availability_schedule->'thursday'->>'endTime') = '17:00'
            AND (availability_schedule->'friday'->>'open') = 'true'
            AND (availability_schedule->'friday'->>'startTime') = '08:00'
            AND (availability_schedule->'friday'->>'endTime') = '17:00'
            AND (availability_schedule->'saturday'->>'open') = 'false'
            AND (availability_schedule->'sunday'->>'open') = 'false'
          )`
    );
    console.log("[migration] Venue availability schedules migrated to 24/7 default");
  } catch (migrationErr: any) {
    console.warn("[migration] Venue availability migration skipped:", migrationErr.message);
  }

  try {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");

    await db.execute(sql`ALTER TABLE venue_instructions ADD COLUMN IF NOT EXISTS space_name text`);
    await db.execute(sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS location_access text[]`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS booking_reminder_settings (
        id serial PRIMARY KEY,
        user_id text NOT NULL,
        enabled boolean DEFAULT true,
        send_timing_hours integer DEFAULT 4,
        updated_at timestamp DEFAULT now()
      )
    `);

    const needsMigration = await db.execute(
      sql`SELECT COUNT(*) as cnt FROM venue_instructions WHERE venue_id IS NOT NULL AND space_name IS NULL`
    );
    const rows = Array.isArray(needsMigration) ? needsMigration : (needsMigration as { rows: { cnt: string | number }[] }).rows || [];
    const count = Number(rows[0]?.cnt ?? 0);
    if (count > 0) {
      await db.execute(sql`
        UPDATE venue_instructions vi
        SET space_name = v.space_name
        FROM venues v
        WHERE vi.venue_id = v.id
          AND vi.space_name IS NULL
          AND v.space_name IS NOT NULL
      `);
      await db.execute(sql`
        DELETE FROM venue_instructions a
        USING venue_instructions b
        WHERE a.id > b.id
          AND a.space_name IS NOT NULL
          AND a.space_name = b.space_name
          AND a.user_id = b.user_id
          AND a.instruction_type = b.instruction_type
          AND COALESCE(a.title, '') = COALESCE(b.title, '')
          AND COALESCE(a.content, '') = COALESCE(b.content, '')
      `);
      await db.execute(sql`
        UPDATE venue_instructions SET venue_id = NULL WHERE space_name IS NOT NULL
      `);
      console.log("[migration] Venue instructions migrated to location-level (spaceName)");
    }
  } catch (migrationErr: any) {
    console.warn("[migration] Venue instructions location migration skipped:", migrationErr.message);
  }

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }

    if (err instanceof AIKeyMissingError || err?.name === "AIKeyMissingError") {
      return res.status(503).json({ message: err.message });
    }

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
