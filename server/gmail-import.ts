import { storage } from './storage';
import { claudeJSON } from './replit_integrations/anthropic/client';
import { google } from 'googleapis';
import { getBaseUrl } from './url';
import type { GmailConnectedAccount } from '@shared/schema';

const PUBLIC_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'google.com',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'yahoo.com', 'yahoo.co.nz', 'yahoo.co.uk', 'yahoo.com.au',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'protonmail.com', 'proton.me',
  'zoho.com', 'yandex.com', 'mail.com',
  'fastmail.com', 'tutanota.com',
  'xtra.co.nz', 'orcon.net.nz', 'slingshot.co.nz', 'vodafone.co.nz',
  'spark.co.nz', 'clear.net.nz',
  'bigpond.com', 'optusnet.com.au',
]);

const NOREPLY_PATTERNS = [
  /^no[-_.]?reply/i,
  /^do[-_.]?not[-_.]?reply/i,
  /^noreply/i,
  /^mailer[-_.]?daemon/i,
  /^postmaster/i,
  /^bounce/i,
  /^notifications?@/i,
  /^alerts?@/i,
  /^news(letter)?@/i,
  /^info@.*\.(com|org|net|io|co\.\w+)$/i,
  /^support@/i,
  /^admin@/i,
  /^system@/i,
  /^automated/i,
  /^billing@/i,
  /^invoice/i,
  /^receipt/i,
  /^orders?@/i,
  /^feedback@/i,
  /^help@/i,
  /^hello@.*\.(com|org|net|io|co\.\w+)$/i,
  /^contact@/i,
  /^enquir/i,
  /^sales@/i,
  /^marketing@/i,
  /^team@/i,
  /^accounts?@/i,
  /^subscribe/i,
  /^unsubscribe/i,
  /^updates?@/i,
  /^digest@/i,
  /^daemon@/i,
  /^root@/i,
  /^webmaster@/i,
  /^cron@/i,
  /^nobody@/i,
  /^mail@/i,
  /^service@/i,
  /^payments?@/i,
  /^confirmation/i,
  /^verify/i,
  /^security@/i,
  /^privacy@/i,
  /^compliance@/i,
  /^calendar-notification/i,
  /^drive-shares-/i,
];

interface ExtractedPerson {
  name: string;
  email: string;
  domain: string;
  frequency: number;
}

interface ExtractedOrg {
  domain: string;
  suggestedName: string;
  frequency: number;
  memberEmails: string[];
}

function parseEmailHeader(header: string): Array<{ name: string; email: string }> {
  const results: Array<{ name: string; email: string }> = [];
  const parts = header.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const angleMatch = trimmed.match(/^"?([^"<]*)"?\s*<([^>]+)>/);
    if (angleMatch) {
      const name = angleMatch[1].trim().replace(/^["']|["']$/g, '');
      const email = angleMatch[2].trim().toLowerCase();
      if (email && email.includes('@')) {
        results.push({ name: name || email.split('@')[0], email });
      }
    } else if (trimmed.includes('@')) {
      const email = trimmed.replace(/[<>]/g, '').trim().toLowerCase();
      if (email.includes('@')) {
        results.push({ name: email.split('@')[0], email });
      }
    }
  }

  return results;
}

export function isNoreplyEmail(email: string): boolean {
  return NOREPLY_PATTERNS.some(p => p.test(email));
}

function getDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() || '';
}

function cleanName(name: string): string {
  return name
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function domainToOrgName(domain: string): string {
  const parts = domain.split('.');
  const mainPart = parts[0];
  return mainPart
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function determineTier(frequency: number): string {
  if (frequency >= 10) return 'collaborate';
  if (frequency >= 3) return 'support';
  return 'mentioned';
}

export function getGmailOAuth2Client() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const baseUrl = getBaseUrl();

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    `${baseUrl}/api/gmail/oauth/callback`
  );
}

export async function getGmailClientForAccount(account: GmailConnectedAccount) {
  const oauth2Client = getGmailOAuth2Client();
  if (!oauth2Client) throw new Error('Google OAuth not configured');

  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.tokenExpiry ? new Date(account.tokenExpiry).getTime() : undefined,
  });

  if (account.tokenExpiry && new Date(account.tokenExpiry).getTime() < Date.now()) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      await storage.updateGmailConnectedAccount(account.id, {
        accessToken: credentials.access_token!,
        refreshToken: credentials.refresh_token || account.refreshToken,
        tokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
      });
      oauth2Client.setCredentials(credentials);
    } catch (err) {
      console.error(`Failed to refresh token for ${account.email}:`, err);
      throw new Error(`Token expired for ${account.email}. Please reconnect.`);
    }
  }

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export async function scanGmailEmails(
  userId: string,
  scanType: 'initial' | 'sync' | 'manual',
  daysBack: number = 365,
  accountId?: number
): Promise<{ historyId: number }> {
  const now = new Date();
  const fromDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

  const historyRecord = await storage.createGmailImportHistory({
    userId,
    scanType,
    status: 'running',
    scanFromDate: fromDate,
    scanToDate: now,
    emailsScanned: 0,
    contactsCreated: 0,
    groupsCreated: 0,
    contactsSkipped: 0,
    groupsSkipped: 0,
  });

  (async () => {
    try {
      const gmailClients: Array<{ gmail: any; label: string }> = [];

      if (accountId) {
        const account = await storage.getGmailConnectedAccount(accountId);
        if (!account || account.userId !== userId) throw new Error('Account not found');
        const gmail = await getGmailClientForAccount(account);
        gmailClients.push({ gmail, label: account.email });
      } else {
        const additionalAccounts = await storage.getGmailConnectedAccounts(userId);
        for (const account of additionalAccounts) {
          try {
            const gmail = await getGmailClientForAccount(account);
            gmailClients.push({ gmail, label: account.email });
          } catch (err) {
            console.error(`Skipping account ${account.email}:`, err);
          }
        }
      }

      if (gmailClients.length === 0) {
        throw new Error('No Gmail accounts available to scan');
      }

      await processMultiAccountImport(gmailClients, userId, historyRecord.id, fromDate, now);
    } catch (err: any) {
      console.error('Gmail import error:', err);
      await storage.updateGmailImportHistory(historyRecord.id, {
        status: 'error',
        errorMessage: err.message || 'Unknown error',
        completedAt: new Date(),
      });
    }
  })();

  return { historyId: historyRecord.id };
}

async function processMultiAccountImport(
  gmailClients: Array<{ gmail: any; label: string }>,
  userId: string,
  historyId: number,
  fromDate: Date,
  toDate: Date
) {
  const exclusions = await storage.getGmailExclusions(userId);
  const excludedDomains = new Set(
    exclusions.filter((e: any) => e.type === 'domain').map((e: any) => e.value.toLowerCase())
  );
  const excludedEmails = new Set(
    exclusions.filter((e: any) => e.type === 'email').map((e: any) => e.value.toLowerCase())
  );

  const peopleMap = new Map<string, ExtractedPerson>();
  let totalEmails = 0;

  const failedAccounts: string[] = [];
  for (const { gmail, label } of gmailClients) {
    try {
      console.log(`Scanning emails from: ${label}`);
      const { emails, people } = await scanSingleAccount(gmail, fromDate, toDate, excludedDomains, excludedEmails);
      totalEmails += emails;

      for (const [email, person] of Array.from(people.entries())) {
        if (peopleMap.has(email)) {
          const existing = peopleMap.get(email)!;
          existing.frequency += person.frequency;
          if (person.name && person.name !== email.split('@')[0] && (!existing.name || existing.name === email.split('@')[0])) {
            existing.name = person.name;
          }
        } else {
          peopleMap.set(email, { ...person });
        }
      }

      await storage.updateGmailImportHistory(historyId, { emailsScanned: totalEmails });
    } catch (err: any) {
      console.error(`Error scanning account ${label}:`, err.message);
      failedAccounts.push(label);
    }
  }

  if (failedAccounts.length > 0 && failedAccounts.length === gmailClients.length) {
    throw new Error(`All accounts failed to scan: ${failedAccounts.join(', ')}`);
  }

  await finalizeImport(peopleMap, userId, historyId, totalEmails, excludedDomains);
}

async function scanSingleAccount(
  gmail: any,
  fromDate: Date,
  toDate: Date,
  excludedDomains: Set<string>,
  excludedEmails: Set<string>
): Promise<{ emails: number; people: Map<string, ExtractedPerson> }> {
  const afterEpoch = Math.floor(fromDate.getTime() / 1000);
  const beforeEpoch = Math.floor(toDate.getTime() / 1000);
  const query = `after:${afterEpoch} before:${beforeEpoch} -category:promotions -category:social -category:updates`;

  const peopleMap = new Map<string, ExtractedPerson>();
  let totalEmails = 0;
  let pageToken: string | undefined;

  do {
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 100,
      pageToken,
    });

    const messages = listRes.data.messages || [];

    const batchSize = 20;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);

      const details = await Promise.all(
        batch.map((msg: any) =>
          gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Cc', 'List-Unsubscribe', 'Precedence'],
          }).catch(() => null)
        )
      );

      for (const detail of details) {
        if (!detail?.data?.payload?.headers) continue;
        totalEmails++;

        const headers = detail.data.payload.headers;

        const listUnsubscribe = headers.find((h: any) => h.name.toLowerCase() === 'list-unsubscribe')?.value;
        if (listUnsubscribe) continue;

        const precedence = headers.find((h: any) => h.name.toLowerCase() === 'precedence')?.value?.toLowerCase();
        if (precedence === 'bulk' || precedence === 'list') continue;

        const fromHeader = headers.find((h: any) => h.name === 'From')?.value || '';
        const toHeader = headers.find((h: any) => h.name === 'To')?.value || '';
        const ccHeader = headers.find((h: any) => h.name === 'Cc')?.value || '';

        const allParsed = [
          ...parseEmailHeader(fromHeader),
          ...parseEmailHeader(toHeader),
          ...parseEmailHeader(ccHeader),
        ];

        for (const { name, email } of allParsed) {
          const domain = getDomain(email);
          if (!domain) continue;
          if (PUBLIC_DOMAINS.has(domain) && isNoreplyEmail(email)) continue;
          if (isNoreplyEmail(email)) continue;
          if (excludedDomains.has(domain)) continue;
          if (excludedEmails.has(email)) continue;

          if (peopleMap.has(email)) {
            const existing = peopleMap.get(email)!;
            existing.frequency++;
            if (name && name !== email.split('@')[0] && (!existing.name || existing.name === email.split('@')[0])) {
              existing.name = name;
            }
          } else {
            peopleMap.set(email, { name, email, domain, frequency: 1 });
          }
        }
      }
    }

    pageToken = listRes.data.nextPageToken;
  } while (pageToken);

  return { emails: totalEmails, people: peopleMap };
}

async function finalizeImport(
  peopleMap: Map<string, ExtractedPerson>,
  userId: string,
  historyId: number,
  totalEmails: number,
  excludedDomains: Set<string>
) {
  const syncSettings = await storage.getGmailSyncSettings(userId);
  const minFrequency = syncSettings?.minEmailFrequency ?? 2;

  const orgMap = new Map<string, ExtractedOrg>();
  for (const person of Array.from(peopleMap.values())) {
    if (PUBLIC_DOMAINS.has(person.domain)) continue;
    if (excludedDomains.has(person.domain)) continue;
    if (person.frequency < minFrequency) continue;

    if (orgMap.has(person.domain)) {
      const org = orgMap.get(person.domain)!;
      org.frequency += person.frequency;
      org.memberEmails.push(person.email);
    } else {
      orgMap.set(person.domain, {
        domain: person.domain,
        suggestedName: domainToOrgName(person.domain),
        frequency: person.frequency,
        memberEmails: [person.email],
      });
    }
  }

  const orgEntries = Array.from(orgMap.values());
  let orgNames: Record<string, string> = {};
  if (orgEntries.length > 0) {
    try {
      orgNames = await getAIOrgNames(orgEntries.map(o => o.domain));
    } catch (err) {
      console.error('AI org name mapping failed, using fallback:', err);
    }
  }

  const existingContacts = await storage.getContacts(userId);
  const existingGroups = await storage.getGroups(userId);

  const existingEmailSet = new Set(
    existingContacts
      .filter(c => c.email)
      .map(c => c.email!.toLowerCase())
  );
  const existingGroupNameSet = new Map(
    existingGroups.map(g => [g.name.toLowerCase(), g])
  );

  let contactsCreated = 0;
  let contactsSkipped = 0;
  let groupsCreated = 0;
  let groupsSkipped = 0;

  const createdGroupIds = new Map<string, number>();

  for (const org of orgEntries) {
    const aiName = orgNames[org.domain];
    const orgName = aiName || org.suggestedName;
    const tier = determineTier(org.frequency);

    if (existingGroupNameSet.has(orgName.toLowerCase())) {
      groupsSkipped++;
      const existingGroup = existingGroupNameSet.get(orgName.toLowerCase())!;
      createdGroupIds.set(org.domain, existingGroup.id);
      continue;
    }

    try {
      const newGroup = await storage.createGroup({
        userId,
        name: orgName,
        type: 'Uncategorised',
        engagementLevel: 'Active',
        contactEmail: org.memberEmails[0],
        website: org.domain,
        relationshipTier: tier,
        importSource: 'gmail',
      });
      createdGroupIds.set(org.domain, newGroup.id);
      existingGroupNameSet.set(orgName.toLowerCase(), newGroup);
      groupsCreated++;
    } catch (err) {
      console.error(`Failed to create group ${orgName}:`, err);
      groupsSkipped++;
    }
  }

  for (const person of Array.from(peopleMap.values())) {
    if (existingEmailSet.has(person.email)) {
      contactsSkipped++;
      continue;
    }

    if (person.frequency < minFrequency) {
      contactsSkipped++;
      continue;
    }

    try {
      const cleanedName = cleanName(person.name);
      const newContact = await storage.createContact({
        userId,
        name: cleanedName,
        email: person.email,
        role: 'Professional',
        notes: `Imported from Gmail (${person.frequency} email${person.frequency > 1 ? 's' : ''})`,
        active: true,
      });

      existingEmailSet.add(person.email);

      const groupId = createdGroupIds.get(person.domain);
      if (groupId && !PUBLIC_DOMAINS.has(person.domain)) {
        try {
          await storage.addGroupMember({
            groupId,
            contactId: newContact.id,
            role: 'member',
          });
        } catch {}
      }

      contactsCreated++;
    } catch (err) {
      console.error(`Failed to create contact ${person.email}:`, err);
      contactsSkipped++;
    }
  }

  await storage.updateGmailImportHistory(historyId, {
    emailsScanned: totalEmails,
    contactsCreated,
    groupsCreated,
    contactsSkipped,
    groupsSkipped,
    status: 'completed',
    completedAt: new Date(),
  });

  const existingSyncSettings = await storage.getGmailSyncSettings(userId);
  if (!existingSyncSettings) {
    await storage.createGmailSyncSettings({
      userId,
      autoSyncEnabled: true,
      syncIntervalHours: 24,
    });
  }
  await storage.updateGmailSyncLastSync(userId, new Date());
}

async function getAIOrgNames(domains: string[]): Promise<Record<string, string>> {
  const batchSize = 50;
  const results: Record<string, string> = {};

  for (let i = 0; i < domains.length; i += batchSize) {
    const batch = domains.slice(i, i + batchSize);
    try {
      const parsed = await claudeJSON({
        model: 'claude-haiku-4-5',
        system: `You are a New Zealand business domain expert. Given email domains, return the proper organisation name. 
Focus on NZ organisations (.co.nz, .govt.nz, .ac.nz, .org.nz).
Examples: "auckland.ac.nz" → "University of Auckland", "mbie.govt.nz" → "MBIE", "waikato.ac.nz" → "University of Waikato".
For international or unfamiliar domains, create a clean title-case name from the domain.
Return a JSON object mapping domain → organisation name.`,
        prompt: `Map these domains to organisation names:\n${batch.join('\n')}`,
        temperature: 0.3,
      });
      Object.assign(results, parsed);
    } catch (err) {
      console.error('AI org name batch failed:', err);
    }
  }

  return results;
}

let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoSync() {
  if (syncInterval) return;
  
  syncInterval = setInterval(async () => {
    try {
      const allSettings = await storage.getAllGmailSyncSettings();
      
      for (const settings of allSettings) {
        if (!settings.autoSyncEnabled) continue;
        
        const intervalMs = (settings.syncIntervalHours || 24) * 60 * 60 * 1000;
        const lastSync = settings.lastSyncAt ? new Date(settings.lastSyncAt).getTime() : 0;
        const now = Date.now();
        
        if (now - lastSync >= intervalMs) {
          const additionalAccounts = await storage.getGmailConnectedAccounts(settings.userId);
          if (additionalAccounts.length === 0) continue;

          const daysSinceLastSync = settings.lastSyncAt
            ? Math.ceil((now - lastSync) / (24 * 60 * 60 * 1000)) + 1
            : 365;

          console.log(`Auto-syncing Gmail for user ${settings.userId}, scanning ${daysSinceLastSync} days back`);
          await scanGmailEmails(settings.userId, 'sync', daysSinceLastSync);
        }
      }
    } catch (err) {
      console.error('Auto-sync check error:', err);
    }
  }, 60 * 60 * 1000);
}

export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
