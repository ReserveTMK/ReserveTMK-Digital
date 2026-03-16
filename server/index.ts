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
