import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";

async function discoverWithRetry(maxRetries = 5, delayMs = 3000): Promise<client.Configuration> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await client.discovery(
        new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
        process.env.REPL_ID!
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

async function upsertUser(claims: any) {
  await authStorage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
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

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  const registeredStrategies = new Set<string>();

  function getAuthDomain(req: any): string {
    if (process.env.REPLIT_DEV_DOMAIN) {
      return process.env.REPLIT_DEV_DOMAIN;
    }
    if (process.env.REPLIT_DEPLOYMENT === "1" && process.env.REPLIT_DOMAINS) {
      const primaryDomain = process.env.REPLIT_DOMAINS.split(",")[0].trim();
      if (primaryDomain) return primaryDomain;
    }
    return req.hostname;
  }

  const ensureStrategy = async (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const config = await getOrInitOidcConfig();
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", async (req, res, next) => {
    try {
      const domain = getAuthDomain(req);
      await ensureStrategy(domain);
      passport.authenticate(`replitauth:${domain}`, {
        prompt: "login",
        scope: ["openid", "email", "profile", "offline_access"],
      })(req, res, next);
    } catch (err) {
      console.error("Auth setup failed:", err);
      res.status(503).json({ message: "Authentication service temporarily unavailable" });
    }
  });

  app.get("/api/callback", async (req, res, next) => {
    try {
      const domain = getAuthDomain(req);
      console.log(`[auth] Callback hit, domain=${domain}, hasSession=${!!req.session}, sessionID=${req.sessionID}`);
      await ensureStrategy(domain);
      passport.authenticate(`replitauth:${domain}`, (err: any, user: any, info: any) => {
        if (err) {
          console.error("[auth] Callback passport error:", err);
          return res.redirect("/api/login");
        }
        if (!user) {
          console.error("[auth] Callback no user, info:", info);
          return res.redirect("/api/login");
        }
        req.logIn(user, (loginErr) => {
          if (loginErr) {
            console.error("[auth] Callback login error:", loginErr);
            return res.redirect("/api/login");
          }
          console.log(`[auth] Login successful, user=${user.claims?.sub}`);
          res.redirect("/");
        });
      })(req, res, next);
    } catch (err) {
      console.error("[auth] Callback exception:", err);
      res.redirect("/");
    }
  });

  app.get("/api/logout", async (req, res) => {
    try {
      const config = await getOrInitOidcConfig();
      req.logout(() => {
        res.redirect(
          client.buildEndSessionUrl(config, {
            client_id: process.env.REPL_ID!,
            post_logout_redirect_uri: `https://${getAuthDomain(req)}`,
          }).href
        );
      });
    } catch {
      req.logout(() => res.redirect("/"));
    }
  });

  getOrInitOidcConfig().catch(err => {
    console.warn("OIDC discovery deferred - auth will initialize on first login request:", err.message);
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
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
