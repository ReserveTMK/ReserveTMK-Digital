import { google } from 'googleapis';
import { getBaseUrl } from '../../url';
import { db } from '../../db';
import { sql } from 'drizzle-orm';

// ── OAuth2 Client ──────────────────────────────────────────────────────────────

export function getGoogleCalendarOAuth2Client() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const baseUrl = getBaseUrl();
  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    `${baseUrl}/api/google-calendar/oauth/callback`
  );
}

// ── Token storage (persisted to DB) ───────────────────────────────────────────

export async function storeCalendarTokens(userId: string, tokens: {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
}) {
  if (!tokens.access_token) return;
  await db.execute(sql`
    INSERT INTO google_calendar_tokens (user_id, access_token, refresh_token, expiry_date, updated_at)
    VALUES (${userId}, ${tokens.access_token}, ${tokens.refresh_token || null}, ${tokens.expiry_date || null}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = COALESCE(EXCLUDED.refresh_token, google_calendar_tokens.refresh_token),
      expiry_date = EXCLUDED.expiry_date,
      updated_at = now()
  `);
}

export async function getCalendarTokens(userId: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiryDate: number | null;
} | null> {
  const rows = await db.execute(sql`
    SELECT access_token, refresh_token, expiry_date FROM google_calendar_tokens WHERE user_id = ${userId}
  `);
  const row = (rows as any).rows?.[0] || rows[0];
  if (!row?.access_token) return null;
  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token || null,
    expiryDate: row.expiry_date ? Number(row.expiry_date) : null,
  };
}

export async function isCalendarConnected(userId: string): Promise<boolean> {
  const tokens = await getCalendarTokens(userId);
  return !!tokens?.accessToken;
}

// ── Main client getter ─────────────────────────────────────────────────────────

export async function getUncachableGoogleCalendarClient(userId?: string) {
  const resolvedUserId = userId || 'default';
  const tokens = await getCalendarTokens(resolvedUserId);

  if (!tokens?.accessToken) {
    throw new Error('Google Calendar not connected. Please connect via Calendar → Settings.');
  }

  const oauth2Client = getGoogleCalendarOAuth2Client();
  if (!oauth2Client) {
    throw new Error('Google OAuth not configured');
  }

  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.expiryDate,
  });

  // Persist refreshed tokens automatically
  oauth2Client.on('tokens', async (newTokens) => {
    await storeCalendarTokens(resolvedUserId, newTokens);
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}
