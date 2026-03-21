import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import { clerkMiddleware, getAuth, createClerkClient } from "@clerk/express";
import { authStorage } from "./storage";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      maxAge: sessionTtl,
    },
  });
}

function getClerkSignInUrl(): string {
  return process.env.CLERK_SIGN_IN_URL || "https://accounts.clerk.dev/sign-in";
}

function getAppBaseUrl(req: any): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  return `${proto}://${req.hostname}`;
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(clerkMiddleware());

  console.log("[auth] Clerk auth setup: CLERK_PUBLISHABLE_KEY present =", !!process.env.CLERK_PUBLISHABLE_KEY);

  await authStorage.ensureAdminSeeded();

  app.get("/api/login", (req, res) => {
    const callbackUrl = `${getAppBaseUrl(req)}/api/callback`;
    const signInUrl = `${getClerkSignInUrl()}?redirect_url=${encodeURIComponent(callbackUrl)}`;
    console.log(`[auth] Login: redirecting to Clerk sign-in, callbackUrl=${callbackUrl}`);
    res.redirect(signInUrl);
  });

  app.get("/api/callback", async (req, res) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) {
        console.error("[auth] Callback: no Clerk userId in request");
        return res.redirect("/api/login");
      }

      const clerkUser = await clerkClient.users.getUser(userId);
      const email =
        clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
          ?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

      await authStorage.upsertUser({
        id: userId,
        email,
        firstName: clerkUser.firstName ?? undefined,
        lastName: clerkUser.lastName ?? undefined,
        profileImageUrl: clerkUser.imageUrl ?? undefined,
      });

      const dbUser = await authStorage.getUser(userId);
      if (!dbUser?.isAdmin) {
        if (!email || !(await authStorage.isEmailAllowed(email))) {
          console.log("[auth] Callback: access denied for", email);
          return res.redirect("/?access_denied=true");
        }
        await authStorage.activateAllowedUser(email);
      }

      (req.session as any).userId = userId;
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => (err ? reject(err) : resolve()));
      });

      console.log(`[auth] Callback: login successful for userId=${userId}`);
      res.redirect("/");
    } catch (err) {
      console.error("[auth] Callback error:", err);
      res.redirect("/api/login");
    }
  });

  app.get("/api/logout", (req, res) => {
    req.session.destroy(() => {
      res.redirect("/");
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const userId = (req.session as any).userId as string | undefined;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const dbUser = await authStorage.getUser(userId);
  if (!dbUser) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!dbUser.isAdmin && dbUser.email) {
    const allowed = await authStorage.isEmailAllowed(dbUser.email);
    if (!allowed) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Access revoked" });
    }
  }

  // Preserve the shape the rest of the app expects
  (req as any).user = { claims: { sub: userId } };
  next();
};

export const isAdmin: RequestHandler = async (req, res, next) => {
  const userId = (req.session as any).userId as string | undefined;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const dbUser = await authStorage.getUser(userId);
  if (!dbUser?.isAdmin) {
    return res.status(403).json({ message: "Forbidden" });
  }

  next();
};
