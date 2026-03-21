import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import { authStorage } from "./storage";

// ── Session ────────────────────────────────────────────────────────────────────

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
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: sessionTtl,
    },
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getBaseUrl(req: any): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${req.hostname}`;
}

function getGoogleAuthUrl(callbackUrl: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchangeCodeForTokens(code: string, callbackUrl: string): Promise<any> {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: callbackUrl,
      grant_type: "authorization_code",
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  return resp.json();
}

async function getGoogleUserInfo(accessToken: string): Promise<any> {
  const resp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) throw new Error("Failed to fetch Google user info");
  return resp.json();
}

import crypto from "crypto";

// ── Auth Setup ─────────────────────────────────────────────────────────────────

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  await authStorage.ensureAdminSeeded();

  app.get("/api/login", (req, res) => {
    const callbackUrl = `${getBaseUrl(req)}/api/callback`;
    const state = crypto.randomBytes(16).toString("hex");
    (req.session as any).oauthState = state;
    const authUrl = getGoogleAuthUrl(callbackUrl, state);
    console.log(`[auth] Login: redirecting to Google, callbackUrl=${callbackUrl}`);
    res.redirect(authUrl);
  });

  app.get("/api/callback", async (req, res) => {
    try {
      const { code, state, error } = req.query as Record<string, string>;

      if (error) {
        console.error("[auth] Google OAuth error:", error);
        return res.redirect("/?access_denied=true");
      }

      const savedState = (req.session as any).oauthState;
      if (!state || state !== savedState) {
        console.error("[auth] State mismatch");
        return res.redirect("/api/login");
      }
      delete (req.session as any).oauthState;

      const callbackUrl = `${getBaseUrl(req)}/api/callback`;
      const tokens = await exchangeCodeForTokens(code, callbackUrl);
      const userInfo = await getGoogleUserInfo(tokens.access_token);

      const userId = `google_${userInfo.sub}`;
      const email = userInfo.email;

      // Check access
      const dbUser = await authStorage.getUser(userId);
      const isAdmin = dbUser?.isAdmin ?? false;

      if (!isAdmin) {
        const allowed = await authStorage.isEmailAllowed(email);
        if (!allowed) {
          console.log("[auth] Access denied for", email);
          return res.redirect("/?access_denied=true");
        }
        await authStorage.activateAllowedUser(email);
      }

      // Upsert user
      await authStorage.upsertUser({
        id: userId,
        email,
        firstName: userInfo.given_name,
        lastName: userInfo.family_name,
        profileImageUrl: userInfo.picture,
      });

      (req.session as any).userId = userId;
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => (err ? reject(err) : resolve()));
      });

      console.log(`[auth] Login successful for ${email} (${userId})`);
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

// ── Middleware ─────────────────────────────────────────────────────────────────

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
