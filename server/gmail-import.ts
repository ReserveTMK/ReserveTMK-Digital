import { getUncachableGmailClient, isGmailConnected } from './replit_integrations/gmail/client';
import { storage } from './storage';
import OpenAI from 'openai';

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
  /^info@.*\.(com|org|net|io)$/i,
  /^support@/i,
  /^admin@/i,
  /^system@/i,
  /^automated/i,
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

function isNoreplyEmail(email: string): boolean {
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

export async function checkGmailConnection(): Promise<boolean> {
  return isGmailConnected();
}

export async function scanGmailEmails(
  userId: string,
  scanType: 'initial' | 'sync' | 'manual',
  daysBack: number = 365
): Promise<{ historyId: number }> {
  const gmail = await getUncachableGmailClient();
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

  processGmailImport(gmail, userId, historyRecord.id, fromDate, now).catch(async (err) => {
    console.error('Gmail import error:', err);
    await storage.updateGmailImportHistory(historyRecord.id, {
      status: 'error',
      errorMessage: err.message || 'Unknown error',
      completedAt: new Date(),
    });
  });

  return { historyId: historyRecord.id };
}

async function processGmailImport(
  gmail: any,
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

  const afterEpoch = Math.floor(fromDate.getTime() / 1000);
  const beforeEpoch = Math.floor(toDate.getTime() / 1000);
  const query = `after:${afterEpoch} before:${beforeEpoch}`;

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
            metadataHeaders: ['From', 'To', 'Cc'],
          }).catch(() => null)
        )
      );

      for (const detail of details) {
        if (!detail?.data?.payload?.headers) continue;
        totalEmails++;

        const headers = detail.data.payload.headers;
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

    if (totalEmails % 500 === 0) {
      await storage.updateGmailImportHistory(historyId, {
        emailsScanned: totalEmails,
      });
    }
  } while (pageToken);

  const orgMap = new Map<string, ExtractedOrg>();
  for (const person of Array.from(peopleMap.values())) {
    if (PUBLIC_DOMAINS.has(person.domain)) continue;
    if (excludedDomains.has(person.domain)) continue;

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
        type: 'Organisation',
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

  const syncSettings = await storage.getGmailSyncSettings(userId);
  if (!syncSettings) {
    await storage.createGmailSyncSettings({
      userId,
      autoSyncEnabled: true,
      syncIntervalHours: 24,
    });
  }
  await storage.updateGmailSyncLastSync(userId, new Date());
}

async function getAIOrgNames(domains: string[]): Promise<Record<string, string>> {
  const openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });

  const batchSize = 50;
  const results: Record<string, string> = {};

  for (let i = 0; i < domains.length; i += batchSize) {
    const batch = domains.slice(i, i + batchSize);
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a New Zealand business domain expert. Given email domains, return the proper organisation name. 
Focus on NZ organisations (.co.nz, .govt.nz, .ac.nz, .org.nz).
Examples: "auckland.ac.nz" → "University of Auckland", "mbie.govt.nz" → "MBIE", "waikato.ac.nz" → "University of Waikato".
For international or unfamiliar domains, create a clean title-case name from the domain.
Return a JSON object mapping domain → organisation name.`,
          },
          {
            role: 'user',
            content: `Map these domains to organisation names:\n${batch.join('\n')}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        Object.assign(results, parsed);
      }
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
          const connected = await isGmailConnected();
          if (!connected) continue;

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
