/**
 * gmail-send.ts
 * Provides a Gmail client for sending emails using the first available
 * connected Gmail account (stored in gmail_connected_accounts table).
 * Uses the kiaora@ account by default, falls back to any connected account.
 */
import { google } from 'googleapis';
import { storage } from './storage';
import { getGmailOAuth2Client } from './gmail-import';

const PREFERRED_SENDER = process.env.GMAIL_SENDER_EMAIL || 'kiaora@reservetmk.co.nz';

export async function getGmailClientForSending(userId?: string) {
  // Use admin user ID if not specified
  const adminUserId = userId || await getAdminUserId();

  if (!adminUserId) {
    throw new Error('No admin user found for sending email');
  }

  const accounts = await storage.getGmailConnectedAccounts(adminUserId);

  if (!accounts || accounts.length === 0) {
    throw new Error('No Gmail accounts connected. Please connect Gmail in Settings → Gmail Import.');
  }

  // Prefer the designated sender account
  const preferred = accounts.find(a => a.email?.toLowerCase() === PREFERRED_SENDER.toLowerCase());
  const account = preferred || accounts[0];

  const oauth2Client = getGmailOAuth2Client();
  if (!oauth2Client) {
    throw new Error('Google OAuth not configured');
  }

  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.tokenExpiry ? new Date(account.tokenExpiry).getTime() : undefined,
  });

  // Auto-update token if refreshed
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      try {
        await storage.updateGmailConnectedAccount(account.id, {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || account.refreshToken,
          tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        });
      } catch (e) {
        console.error('[gmail-send] Failed to update token:', e);
      }
    }
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

async function getAdminUserId(): Promise<string | null> {
  try {
    const { db } = await import('./db');
    const { users } = await import('@shared/models/auth');
    const { eq } = await import('drizzle-orm');
    const admins = await db.select().from(users).where(eq(users.isAdmin, true));
    return admins[0]?.id || null;
  } catch {
    return null;
  }
}
