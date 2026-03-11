import { storage } from "./storage";
import type { Booking, XeroSettings } from "@shared/schema";
import crypto from "crypto";
import { getBaseUrl } from "./url";

const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_API_BASE = "https://api.xero.com/api.xro/2.0";
const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";
const XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize";
const XERO_SCOPES = "openid profile email accounting.contacts accounting.transactions offline_access";

const pendingOAuthStates = new Map<string, { userId: string; expiresAt: number }>();

export function createOAuthState(userId: string): string {
  const state = crypto.randomBytes(32).toString("hex");
  pendingOAuthStates.set(state, { userId, expiresAt: Date.now() + 10 * 60 * 1000 });
  return state;
}

export function validateOAuthState(state: string): string | null {
  const entry = pendingOAuthStates.get(state);
  if (!entry) return null;
  pendingOAuthStates.delete(state);
  if (Date.now() > entry.expiresAt) return null;
  return entry.userId;
}

function getRedirectUri(): string {
  return `${getBaseUrl()}/api/xero/callback`;
}

export function getXeroAuthUrl(settings: XeroSettings, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: settings.xeroClientId || "",
    redirect_uri: getRedirectUri(),
    scope: XERO_SCOPES,
    state,
  });
  return `${XERO_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  userId: string,
  code: string
): Promise<XeroSettings> {
  const settings = await storage.getXeroSettings(userId);
  if (!settings?.xeroClientId || !settings?.xeroClientSecret) {
    throw new Error("Xero credentials not configured");
  }

  const basicAuth = Buffer.from(`${settings.xeroClientId}:${settings.xeroClientSecret}`).toString("base64");

  const response = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to exchange code: ${response.status} ${text}`);
  }

  const tokens = await response.json();

  const connectionsRes = await fetch(XERO_CONNECTIONS_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  let tenantId = "";
  let orgName = "";
  if (connectionsRes.ok) {
    const connections = await connectionsRes.json();
    if (connections.length > 0) {
      tenantId = connections[0].tenantId;
      orgName = connections[0].tenantName || "";
    }
  }

  return await storage.upsertXeroSettings(userId, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    xeroTenantId: tenantId,
    organisationName: orgName,
    connected: true,
    connectedAt: new Date(),
  });
}

async function refreshTokens(userId: string): Promise<XeroSettings> {
  const settings = await storage.getXeroSettings(userId);
  if (!settings?.refreshToken || !settings?.xeroClientId || !settings?.xeroClientSecret) {
    throw new Error("No refresh token available");
  }

  const basicAuth = Buffer.from(`${settings.xeroClientId}:${settings.xeroClientSecret}`).toString("base64");

  const response = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: settings.refreshToken,
    }),
  });

  if (!response.ok) {
    await storage.upsertXeroSettings(userId, {
      connected: false,
      accessToken: null,
      refreshToken: null,
    } as any);
    throw new Error("Token refresh failed - Xero disconnected");
  }

  const tokens = await response.json();

  return await storage.upsertXeroSettings(userId, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
  });
}

async function xeroApiCall(
  userId: string,
  method: string,
  path: string,
  body?: any,
  retry = true
): Promise<any> {
  let settings = await storage.getXeroSettings(userId);
  if (!settings?.connected || !settings?.accessToken) {
    throw new Error("Xero not connected");
  }

  if (!settings.xeroTenantId) {
    throw new Error("Xero tenant ID missing - please reconnect to Xero");
  }

  if (settings.tokenExpiresAt && new Date(settings.tokenExpiresAt) < new Date()) {
    settings = await refreshTokens(userId);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${settings.accessToken}`,
    "xero-tenant-id": settings.xeroTenantId || "",
    Accept: "application/json",
  };
  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${XERO_API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && retry) {
    try {
      await refreshTokens(userId);
      return xeroApiCall(userId, method, path, body, false);
    } catch {
      throw new Error("Xero authentication failed");
    }
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Xero API error ${response.status}: ${text}`);
  }

  return response.json();
}

export async function syncContactToXero(
  userId: string,
  contactId: number
): Promise<string> {
  const contact = await storage.getContact(contactId);
  if (!contact) throw new Error("Contact not found");

  const regularBooker = await storage.getRegularBookerByContactId(contactId);

  if (regularBooker?.xeroContactId) {
    try {
      await xeroApiCall(userId, "GET", `/Contacts/${regularBooker.xeroContactId}`);
      return regularBooker.xeroContactId;
    } catch {
      // contact not found in xero, will create new
    }
  }

  const email = regularBooker?.billingEmail || contact.email;
  const name = regularBooker?.organizationName || contact.name || contact.email || "Unknown";

  if (email) {
    try {
      const escapedEmail = email.replace(/"/g, '\\"');
      const searchResult = await xeroApiCall(userId, "GET", `/Contacts?where=EmailAddress=="${escapedEmail}"`);
      if (searchResult.Contacts?.length > 0) {
        const xeroContactId = searchResult.Contacts[0].ContactID;
        if (regularBooker) {
          await storage.updateRegularBooker(regularBooker.id, { xeroContactId } as any);
        }
        return xeroContactId;
      }
    } catch {
      // search failed, will create
    }
  }

  const xeroContact: any = {
    Name: name,
    EmailAddress: email || undefined,
    Phones: [],
  };

  const phone = regularBooker?.billingPhone || contact.phone;
  if (phone) {
    xeroContact.Phones.push({
      PhoneType: "DEFAULT",
      PhoneNumber: phone,
    });
  }

  if (regularBooker?.billingAddress) {
    xeroContact.Addresses = [{
      AddressType: "STREET",
      AddressLine1: regularBooker.billingAddress,
    }];
  }

  const result = await xeroApiCall(userId, "POST", "/Contacts", { Contacts: [xeroContact] });
  const xeroContactId = result.Contacts?.[0]?.ContactID;

  if (xeroContactId && regularBooker) {
    await storage.updateRegularBooker(regularBooker.id, { xeroContactId } as any);
  }

  return xeroContactId;
}

export async function generateXeroInvoice(
  userId: string,
  bookingId: number
): Promise<{ invoiceId: string; invoiceNumber: string } | null> {
  const booking = await storage.getBooking(bookingId);
  if (!booking) throw new Error("Booking not found");

  if (booking.xeroInvoiceId) {
    return { invoiceId: booking.xeroInvoiceId, invoiceNumber: booking.xeroInvoiceNumber || "" };
  }

  const amount = parseFloat(booking.amount || "0");
  if (booking.pricingTier === "free_koha" || booking.usePackageCredit || amount <= 0) {
    return null;
  }

  const settings = await storage.getXeroSettings(userId);
  if (!settings?.connected) throw new Error("Xero not connected");

  if (!booking.bookerId) throw new Error("Booking has no booker contact");
  const xeroContactId = await syncContactToXero(userId, booking.bookerId);

  const venues = await storage.getVenues(userId);
  const venue = venues.find(v => v.id === booking.venueId);
  const venueName = venue?.name || "Reserve Tamaki Space";

  const dateStr = booking.startDate
    ? new Date(booking.startDate).toLocaleDateString("en-NZ", { timeZone: "Pacific/Auckland" })
    : "TBC";

  const formatTime = (t: string | null) => {
    if (!t) return "";
    const [h, m] = t.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${h12}:${m} ${ampm}`;
  };

  const timeStr = booking.startTime && booking.endTime
    ? `${formatTime(booking.startTime)} - ${formatTime(booking.endTime)}`
    : "";

  const durationLabel = booking.durationType === "full_day" ? "Full Day"
    : booking.durationType === "half_day" ? "Half Day"
    : "";

  const description = `Venue Hire - ${venueName}\n${dateStr}${timeStr ? ` | ${timeStr}` : ""}${durationLabel ? ` (${durationLabel})` : ""}`;

  let paymentTermDays = 0;
  const regularBooker = booking.bookerId ? await storage.getRegularBookerByContactId(booking.bookerId) : null;
  if (regularBooker?.paymentTerms) {
    const termsMap: Record<string, number> = { immediate: 0, net_7: 7, net_14: 14, net_30: 30 };
    paymentTermDays = termsMap[regularBooker.paymentTerms] || 0;
  }

  const invoiceDate = new Date().toISOString().split("T")[0];
  const dueDate = new Date(Date.now() + paymentTermDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const discountPct = parseFloat(booking.discountPercentage || "0");
  const unitAmount = discountPct > 0 ? amount / (1 - discountPct / 100) : amount;

  const invoice: any = {
    Type: "ACCREC",
    Contact: { ContactID: xeroContactId },
    Date: invoiceDate,
    DueDate: dueDate,
    LineAmountTypes: "Exclusive",
    Reference: `Booking #${bookingId}`,
    Status: "SUBMITTED",
    LineItems: [
      {
        Description: description,
        Quantity: 1,
        UnitAmount: unitAmount.toFixed(2),
        AccountCode: "200",
        TaxType: "OUTPUT2",
        ...(discountPct > 0 ? { DiscountRate: discountPct.toFixed(2) } : {}),
      },
    ],
  };

  const result = await xeroApiCall(userId, "POST", "/Invoices", { Invoices: [invoice] });
  const createdInvoice = result.Invoices?.[0];

  if (createdInvoice) {
    const invoiceId = createdInvoice.InvoiceID;
    const invoiceNumber = createdInvoice.InvoiceNumber;

    await storage.updateBooking(bookingId, {
      xeroInvoiceId: invoiceId,
      xeroInvoiceNumber: invoiceNumber,
      xeroInvoiceStatus: "submitted",
    } as any);

    return { invoiceId, invoiceNumber };
  }

  throw new Error("Failed to create invoice in Xero");
}
