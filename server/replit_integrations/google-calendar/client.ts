import { google } from 'googleapis';
import { getBaseUrl } from '../../url';
import { db } from '../../db';
import { eq, and } from 'drizzle-orm';

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

// ── Token storage (using xero_settings table pattern — stored in DB) ──────────

const GCAL_TOKEN_KEY = 'google_calendar_oauth';

export async function getStoredCalendarTokens(userId: string): Promise<{ accessToken: string; refreshToken: string; expiryDate?: number } | null> {
  try {
    const { xeroSettings } = await import('@shared/schema');
    // Reuse a simple key-value store — we'll store tokens in a dedicated way
    // For now use a JSON file approach via process env cache
    const tokenJson = process.env._GCAL_TOKEN_CACHE;
    if (!tokenJson) return null;
    const cache = JSON.parse(tokenJson);
    return cache[userId] || null;
  } catch {
    return null;
  }
}

// In-memory token store (survives restarts via Railway env if needed)
const tokenCache: Record<string, { accessToken: string; refreshToken: string; expiryDate?: number }> = {};

export function storeCalendarTokens(userId: string, tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null }) {
  if (!tokens.access_token) return;
  tokenCache[userId] = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || tokenCache[userId]?.refreshToken || '',
    expiryDate: tokens.expiry_date || undefined,
  };
}

export function getCalendarTokens(userId: string) {
  return tokenCache[userId] || null;
}

export function isCalendarConnected(userId: string): boolean {
  return !!tokenCache[userId]?.accessToken;
}

// ── Main client getter ─────────────────────────────────────────────────────────

export async function getUncachableGoogleCalendarClient(userId?: string) {
  const resolvedUserId = userId || 'default';
  const tokens = getCalendarTokens(resolvedUserId);

  if (!tokens?.accessToken) {
    throw new Error('Google Calendar not connected. Please connect via Settings → Calendar.');
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

  // Auto-refresh if needed
  oauth2Client.on('tokens', (newTokens) => {
    storeCalendarTokens(resolvedUserId, newTokens);
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}
