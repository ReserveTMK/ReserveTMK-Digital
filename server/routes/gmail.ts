// Gmail import routes — scan, import, exclusions, OAuth, cleanup
import type { Express } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { scanGmailEmails, confirmImport, getGmailOAuth2Client, isNoreplyEmail } from "../gmail-import";
import { parseId } from "./_helpers";
import { isAuthenticated } from "../replit_integrations/auth";

export function registerGmailRoutes(app: Express) {

  app.get("/api/gmail/status", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const syncSettings = await storage.getGmailSyncSettings(userId);
      const history = await storage.getGmailImportHistory(userId);
      const latestImport = history[0] || null;
      const additionalAccounts = await storage.getGmailConnectedAccounts(userId);
      const connected = additionalAccounts.length > 0;
      res.json({ connected, syncSettings: syncSettings || null, latestImport, totalImports: history.length, additionalAccountsCount: additionalAccounts.length });
    } catch (err: any) {
      console.error("Gmail status error:", err);
      res.status(500).json({ message: "Failed to check Gmail status" });
    }
  });

  app.post("/api/gmail/scan", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const scanSchema = z.object({ daysBack: z.number().min(1).max(730).default(365), scanType: z.enum(['initial', 'manual', 'sync']).default('manual'), accountIds: z.array(z.number()).optional(), accountId: z.number().optional() });
      const parsed = scanSchema.parse(req.body);
      const ids = parsed.accountIds || (parsed.accountId ? [parsed.accountId] : undefined);
      const result = await scanGmailEmails(userId, parsed.scanType, parsed.daysBack, ids);
      res.json(result);
    } catch (err: any) {
      console.error("Gmail scan error:", err);
      if (err.name === 'ZodError') return res.status(400).json({ message: "Invalid parameters" });
      res.status(500).json({ message: err.message || "Failed to start scan" });
    }
  });

  app.post("/api/gmail/import/confirm", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const confirmSchema = z.object({ historyId: z.number(), selectedEmails: z.array(z.string()), selectedDomains: z.array(z.string()), duplicateActions: z.record(z.enum(['skip', 'create', 'merge'])).optional(), linkExistingContacts: z.boolean().optional() });
      const parsed = confirmSchema.parse(req.body);
      const result = await confirmImport(parsed.historyId, userId, parsed.selectedEmails, parsed.selectedDomains, parsed.duplicateActions || {}, parsed.linkExistingContacts ?? true);
      res.json(result);
    } catch (err: any) {
      console.error("Gmail confirm import error:", err);
      if (err.name === 'ZodError') return res.status(400).json({ message: "Invalid parameters" });
      res.status(500).json({ message: err.message || "Failed to confirm import" });
    }
  });

  app.get("/api/gmail/history", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const history = await storage.getGmailImportHistory(userId);
      res.json(history);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch history" });
    }
  });

  app.get("/api/gmail/history/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const item = await storage.getGmailImportHistoryItem(parseId(req.params.id));
      if (!item || item.userId !== userId) return res.status(404).json({ message: "Not found" });
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch import details" });
    }
  });

  app.get("/api/gmail/exclusions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const exclusions = await storage.getGmailExclusions(userId);
      res.json(exclusions);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch exclusions" });
    }
  });

  app.post("/api/gmail/exclusions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { type, value } = req.body;
      if (!type || !value) return res.status(400).json({ message: "Type and value required" });
      if (!['domain', 'email'].includes(type)) return res.status(400).json({ message: "Type must be 'domain' or 'email'" });
      const exclusion = await storage.createGmailExclusion({ userId, type, value: value.toLowerCase().trim() });
      res.json(exclusion);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create exclusion" });
    }
  });

  app.delete("/api/gmail/exclusions/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const exclusions = await storage.getGmailExclusions(userId);
      const exclusion = exclusions.find(e => e.id === parseId(req.params.id));
      if (!exclusion) return res.status(404).json({ message: "Not found" });
      await storage.deleteGmailExclusion(exclusion.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete exclusion" });
    }
  });

  app.get("/api/gmail/cleanup-suggestions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const allContacts = await storage.getContacts(userId);
      const suspects = allContacts.filter(c => {
        if (!c.notes || !c.notes.includes('Imported from Gmail (1 email')) return false;
        if (!c.email) return false;
        if (isNoreplyEmail(c.email)) return true;
        const localPart = c.email.split('@')[0]?.toLowerCase() || '';
        const marketingPrefixes = ['promo', 'deals', 'offers', 'campaign', 'announce', 'weekly', 'daily', 'store', 'shop', 'rewards', 'membership', 'deliver', 'shipment', 'tracking'];
        if (marketingPrefixes.some(p => localPart.startsWith(p))) return true;
        return false;
      });
      res.json(suspects.map(c => ({ id: c.id, name: c.name, email: c.email, notes: c.notes })));
    } catch (err: any) {
      res.status(500).json({ message: "Failed to get cleanup suggestions" });
    }
  });

  app.post("/api/gmail/cleanup", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { contactIds } = req.body;
      if (!Array.isArray(contactIds) || contactIds.length === 0) return res.status(400).json({ message: "contactIds array required" });
      const allContacts = await storage.getContacts(userId);
      const ownedIds = new Set(allContacts.map(c => c.id));
      let deleted = 0;
      const failed: number[] = [];
      for (const id of contactIds) {
        if (!ownedIds.has(id)) continue;
        try { await storage.archiveContact(id); deleted++; } catch (err) { failed.push(id); }
      }
      res.json({ deleted, failed: failed.length });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to cleanup contacts" });
    }
  });

  app.get("/api/gmail/sync-settings", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const settings = await storage.getGmailSyncSettings(userId);
      res.json(settings || { autoSyncEnabled: false, syncIntervalHours: 24, minEmailFrequency: 2, lastSyncAt: null });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch sync settings" });
    }
  });

  app.put("/api/gmail/sync-settings", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const settingsSchema = z.object({ autoSyncEnabled: z.boolean().optional(), minEmailFrequency: z.number().int().min(1).max(10).optional() });
      const parsed = settingsSchema.parse(req.body);
      const updates: any = {};
      if (parsed.autoSyncEnabled !== undefined) updates.autoSyncEnabled = parsed.autoSyncEnabled;
      if (parsed.minEmailFrequency !== undefined) updates.minEmailFrequency = parsed.minEmailFrequency;
      const existing = await storage.getGmailSyncSettings(userId);
      if (existing) {
        res.json(await storage.updateGmailSyncSettings(userId, updates));
      } else {
        res.json(await storage.createGmailSyncSettings({ userId, autoSyncEnabled: updates.autoSyncEnabled ?? true, syncIntervalHours: 24, minEmailFrequency: updates.minEmailFrequency ?? 2 }));
      }
    } catch (err: any) {
      if (err.name === 'ZodError') return res.status(400).json({ message: "Invalid settings values" });
      res.status(500).json({ message: "Failed to update sync settings" });
    }
  });

  // === GMAIL MULTI-ACCOUNT OAUTH ===

  app.get("/api/gmail/oauth/config", isAuthenticated, async (req, res) => {
    const client = getGmailOAuth2Client();
    res.json({ configured: !!client });
  });

  app.get("/api/gmail/oauth/authorize", isAuthenticated, async (req, res) => {
    const oauth2Client = getGmailOAuth2Client();
    if (!oauth2Client) return res.status(400).json({ message: "Google OAuth not configured." });
    const crypto = await import('crypto');
    const userId = (req.user as any).claims.sub;
    const nonce = crypto.randomBytes(16).toString('hex');
    const secret = process.env.SESSION_SECRET || 'gmail-oauth-state';
    const payload = JSON.stringify({ userId, nonce, ts: Date.now() });
    const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const state = Buffer.from(JSON.stringify({ payload, hmac })).toString('base64');
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline', prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/calendar'],
      state,
    });
    res.json({ url });
  });

  app.get("/api/gmail/oauth/callback", async (req, res) => {
    const { code, state, error: oauthError } = req.query;
    if (!code || !state) return res.redirect(`/gmail-import?error=${oauthError || 'missing_params'}`);
    let userId: string;
    try {
      const crypto = await import('crypto');
      const decoded = JSON.parse(Buffer.from(state as string, 'base64').toString());
      const { payload, hmac } = decoded;
      const secret = process.env.SESSION_SECRET || 'gmail-oauth-state';
      const expectedHmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      if (hmac !== expectedHmac) return res.redirect('/gmail-import?error=invalid_state');
      const parsed = JSON.parse(payload);
      if (Date.now() - parsed.ts > 10 * 60 * 1000) return res.redirect('/gmail-import?error=state_expired');
      userId = parsed.userId;
    } catch { return res.redirect('/gmail-import?error=invalid_state'); }

    const oauth2Client = getGmailOAuth2Client();
    if (!oauth2Client) return res.redirect('/gmail-import?error=not_configured');
    try {
      const { tokens } = await oauth2Client.getToken(code as string);
      oauth2Client.setCredentials(tokens);
      const oauth2 = (await import('googleapis')).google.oauth2({ version: 'v2', auth: oauth2Client });
      const { data: userInfo } = await oauth2.userinfo.get();
      const email = userInfo.email || 'unknown';
      const existing = await storage.getGmailConnectedAccountByEmail(userId, email);
      if (existing) {
        await storage.updateGmailConnectedAccount(existing.id, { accessToken: tokens.access_token!, refreshToken: tokens.refresh_token || existing.refreshToken, tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined });
      } else {
        await storage.createGmailConnectedAccount({ userId, email, label: email, accessToken: tokens.access_token!, refreshToken: tokens.refresh_token!, tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined });
      }
      res.redirect('/gmail-import?success=account_added');
    } catch (err: any) {
      console.error('Gmail OAuth callback error:', err);
      res.redirect('/gmail-import?error=auth_failed');
    }
  });

  app.get("/api/gmail/accounts", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const accounts = await storage.getGmailConnectedAccounts(userId);
      res.json(accounts.map(a => ({ id: a.id, email: a.email, label: a.label, createdAt: a.createdAt, tokenExpiry: a.tokenExpiry, hasValidToken: !a.tokenExpiry || new Date(a.tokenExpiry).getTime() > Date.now() })));
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch accounts" });
    }
  });

  app.delete("/api/gmail/accounts/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const account = await storage.getGmailConnectedAccount(parseId(req.params.id));
      if (!account || account.userId !== userId) return res.status(404).json({ message: "Account not found" });
      await storage.deleteGmailConnectedAccount(account.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to remove account" });
    }
  });

} // end registerGmailRoutes
