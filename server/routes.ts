import type { Express } from "express";
import type { Server } from "http";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { registerAudioRoutes } from "./replit_integrations/audio/routes";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Core infrastructure
  await setupAuth(app);
  registerAuthRoutes(app);
  registerAudioRoutes(app);
  registerObjectStorageRoutes(app);

  // Domain route modules
  const { registerContactRoutes } = await import("./routes/contacts");
  registerContactRoutes(app);

  const { registerMentoringRoutes } = await import("./routes/mentoring");
  registerMentoringRoutes(app);

  const { registerInteractionRoutes } = await import("./routes/interactions");
  registerInteractionRoutes(app);

  const { registerProgrammeRoutes } = await import("./routes/programmes");
  registerProgrammeRoutes(app);

  const { registerDebriefRoutes } = await import("./routes/debriefs");
  registerDebriefRoutes(app);

  const { registerBookingRoutes } = await import("./routes/bookings");
  registerBookingRoutes(app);

  const { registerGroupRoutes } = await import("./routes/groups");
  registerGroupRoutes(app);

  const { registerProjectRoutes } = await import("./routes/projects");
  registerProjectRoutes(app);

  const { registerPortalRoutes } = await import("./routes/portal");
  registerPortalRoutes(app);

  const { registerResourceRoutes } = await import("./routes/resources");
  registerResourceRoutes(app);

  const { registerCommsRoutes } = await import("./routes/comms");
  registerCommsRoutes(app);

  const { registerTrackingRoutes } = await import("./routes/tracking");
  registerTrackingRoutes(app);

  const { registerGmailRoutes } = await import("./routes/gmail");
  registerGmailRoutes(app);

  const { registerFunderRoutes } = await import("./routes/funders");
  registerFunderRoutes(app);

  const { registerReportRoutes } = await import("./routes/reports");
  registerReportRoutes(app);

  const { registerCalendarRoutes } = await import("./routes/calendar");
  registerCalendarRoutes(app);

  const { registerSettingsRoutes } = await import("./routes/settings");
  registerSettingsRoutes(app);

  return httpServer;
}
