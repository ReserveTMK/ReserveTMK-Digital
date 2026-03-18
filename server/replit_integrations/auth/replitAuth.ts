import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import crypto from "crypto";
import { authStorage } from "./storage";

function getOidcClientId(): string {
  return process.env.OIDC_CLIENT_ID || process.env.REPL_ID!;
}

function getReplitDomain(): string | undefined {
  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(",");
    const replitDomain = domains.find(d => d.trim().endsWith(".replit.app"));
    if (replitDomain) return replitDomain.trim();
  }
  return undefined;
}

function getCustomDomain(): string | undefined {
  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(",");
    const custom = domains.find(d => {
      const trimmed = d.trim();
      return trimmed && !trimmed.endsWith(".replit.app") && !trimmed.endsWith(".replit.dev");
    });
    if (custom) return custom.trim();
  }
  return undefined;
}

const authTokens = new Map<string, { user: any; expiresAt: number }>();

function generateAuthToken(user: any): string {
  const token = crypto.randomUUID();
  authTokens.set(token, { user, expiresAt: Date.now() + 30_000 });
  return token;
}

function consumeAuthToken(token: string): any | null {
  const entry = authTokens.get(token);
  if (!entry) return null;
  authTokens.delete(token);
  if (Date.now() > entry.expiresAt) return null;
  return entry.user;
}

setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of authTokens) {
    if (now > entry.expiresAt) authTokens.delete(token);
  }
}, 60_000);

async function discoverWithRetry(maxRetries = 5, delayMs = 3000): Promise<client.Configuration> {
  const oidcClientId = getOidcClientId();
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await client.discovery(
        new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
        oidcClientId
      );
    } catch (err: any) {
      const is503 = err?.cause?.status === 503 || err?.message?.includes("503") || err?.code === "OAUTH_RESPONSE_IS_NOT_CONFORM";
      if (attempt < maxRetries && is503) {
        console.log(`OIDC discovery attempt ${attempt}/${maxRetries} failed, retrying in ${delayMs}ms...`);
        await new Promise(r => setTimeout(r, delayMs));
      } else {
        throw err;
      }
    }
  }
  throw new Error("OIDC discovery failed after retries");
}

const getOidcConfig = memoize(
  async () => {
    return await discoverWithRetry();
  },
  { maxAge: 3600 * 1000 }
);

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

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

const ADMIN_USER_ID = "54568936";

async function upsertUser(claims: any) {
  await authStorage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

async function checkUserAllowed(claims: any): Promise<boolean> {
  const userId = claims["sub"];
  const email = claims["email"];

  if (userId === ADMIN_USER_ID) return true;

  if (!email) return false;

  const allowed = await authStorage.isEmailAllowed(email);
  if (allowed) {
    await authStorage.activateAllowedUser(email);
  }
  return allowed;
}

let oidcConfigPromise: Promise<client.Configuration> | null = null;

function getOrInitOidcConfig(): Promise<client.Configuration> {
  if (!oidcConfigPromise) {
    oidcConfigPromise = getOidcConfig().catch(err => {
      oidcConfigPromise = null;
      throw err;
    });
  }
  return oidcConfigPromise;
}

function getCallbackUrl(req: any): string {
  const isDeployment = !!process.env.REPLIT_DEPLOYMENT;
  if (isDeployment) {
    const replitDomain = getReplitDomain();
    if (replitDomain) return `https://${replitDomain}/api/callback`;
  }
  const domain = process.env.REPLIT_DEV_DOMAIN || req.hostname;
  return `https://${domain}/api/callback`;
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  console.log(`[auth] Setup: REPL_ID=${process.env.REPL_ID}, OIDC_CLIENT_ID=${getOidcClientId()}, REPLIT_DEPLOYMENT=${process.env.REPLIT_DEPLOYMENT}, REPLIT_DEV_DOMAIN=${process.env.REPLIT_DEV_DOMAIN}, REPLIT_DOMAINS=${process.env.REPLIT_DOMAINS}`);

  await authStorage.ensureAdminSeeded();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const claims = tokens.claims();
    const allowed = await checkUserAllowed(claims);
    if (!allowed) {
      verified(null, false, { message: "access_denied" });
      return;
    }
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(claims);
    verified(null, user);
  };

  let strategyRegistered = false;
  let currentCallbackURL = "";

  const ensureStrategy = async (callbackURL: string) => {
    if (!strategyRegistered || currentCallbackURL !== callbackURL) {
      const config = await getOrInitOidcConfig();
      const strategy = new Strategy(
        {
          name: "replitauth",
          config,
          scope: "openid email profile offline_access",
          callbackURL,
        },
        verify
      );
      passport.use(strategy);
      strategyRegistered = true;
      currentCallbackURL = callbackURL;
      console.log(`[auth] Strategy registered with callbackURL=${callbackURL}`);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", async (req, res, next) => {
    try {
      const customDomain = getCustomDomain();
      const replitDomain = getReplitDomain();
      const isDeployment = !!process.env.REPLIT_DEPLOYMENT;

      if (isDeployment && customDomain && replitDomain && req.hostname === customDomain) {
        res.redirect(`https://${replitDomain}/api/login?returnTo=${encodeURIComponent(customDomain)}`);
        return;
      }

      const returnTo = req.query.returnTo as string | undefined;
      if (returnTo) {
        const allowedDomains = (process.env.REPLIT_DOMAINS || "").split(",").map(d => d.trim());
        if (allowedDomains.includes(returnTo)) {
          (req.session as any).loginReturnTo = returnTo;
          await new Promise<void>((resolve, reject) => {
            req.session.save((err) => err ? reject(err) : resolve());
          });
        }
      }

      const callbackURL = getCallbackUrl(req);
      console.log(`[auth] Login: hostname=${req.hostname}, callbackURL=${callbackURL}, returnTo=${returnTo || 'none'}`);
      await ensureStrategy(callbackURL);
      passport.authenticate("replitauth", {
        prompt: "login",
        scope: ["openid", "email", "profile", "offline_access"],
      })(req, res, next);
    } catch (err) {
      console.error("[auth] Login error:", err);
      res.status(503).json({ message: "Authentication service temporarily unavailable" });
    }
  });

  app.get("/api/callback", async (req, res, next) => {
    try {
      const callbackURL = getCallbackUrl(req);
      console.log(`[auth] Callback: hostname=${req.hostname}, callbackURL=${callbackURL}, hasSession=${!!req.session}`);
      await ensureStrategy(callbackURL);
      passport.authenticate("replitauth", (err: any, user: any, info: any) => {
        if (err) {
          console.error("[auth] Callback passport error:", err);
          return res.redirect("/api/login");
        }
        if (!user) {
          if (info?.message === "access_denied") {
            console.log("[auth] Access denied - user not in allowed list");
            return res.redirect("/?access_denied=true");
          }
          console.error("[auth] Callback no user, info:", info);
          return res.redirect("/api/login");
        }
        const returnTo = (req.session as any).loginReturnTo;
        console.log(`[auth] Pre-logIn returnTo=${returnTo || 'none'}`);
        req.logIn(user, (loginErr) => {
          if (loginErr) {
            console.error("[auth] Callback logIn error:", loginErr);
            return res.redirect("/api/login");
          }
          console.log(`[auth] Login successful, user=${user.claims?.sub}, returnTo=${returnTo || 'none'}, hostname=${req.hostname}`);
          if (returnTo && returnTo !== req.hostname) {
            const token = generateAuthToken(user);
            console.log(`[auth] Redirecting to ${returnTo} with exchange token`);
            res.redirect(`https://${returnTo}/api/auth/exchange?token=${token}`);
          } else {
            res.redirect("/");
          }
        });
      })(req, res, next);
    } catch (err) {
      console.error("[auth] Callback exception:", err);
      res.redirect("/");
    }
  });

  app.get("/api/auth/exchange", async (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) {
        console.error("[auth] Exchange: no token provided");
        return res.redirect("/api/login");
      }
      const user = consumeAuthToken(token);
      if (!user) {
        console.error("[auth] Exchange: invalid or expired token");
        return res.redirect("/api/login");
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error("[auth] Exchange logIn error:", loginErr);
          return res.redirect("/api/login");
        }
        console.log(`[auth] Exchange successful, user=${user.claims?.sub}, domain=${req.hostname}`);
        res.redirect("/");
      });
    } catch (err) {
      console.error("[auth] Exchange exception:", err);
      res.redirect("/api/login");
    }
  });

  app.get("/api/logout", async (req, res) => {
    try {
      const config = await getOrInitOidcConfig();
      const replitDomain = getReplitDomain();
      const devDomain = process.env.REPLIT_DEV_DOMAIN;
      const domain = replitDomain || devDomain || req.hostname;
      req.logout(() => {
        res.redirect(
          client.buildEndSessionUrl(config, {
            client_id: getOidcClientId(),
            post_logout_redirect_uri: `https://${domain}`,
          }).href
        );
      });
    } catch {
      req.logout(() => res.redirect("/"));
    }
  });

  getOrInitOidcConfig().catch(err => {
    console.warn("OIDC discovery deferred:", err.message);
  });
}

export const isAdmin: RequestHandler = async (req, res, next) => {
  const user = req.user as any;
  if (!req.isAuthenticated() || !user?.claims?.sub) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const dbUser = await authStorage.getUser(user.claims.sub);
  if (!dbUser?.isAdmin) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userId = user.claims?.sub;
  if (userId && userId !== ADMIN_USER_ID) {
    const dbUser = await authStorage.getUser(userId);
    if (dbUser?.email) {
      const allowed = await authStorage.isEmailAllowed(dbUser.email);
      if (!allowed) {
        req.logout(() => {});
        return res.status(401).json({ message: "Access revoked" });
      }
    }
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    if (user.claims?.sub) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    if (user.claims?.sub) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
