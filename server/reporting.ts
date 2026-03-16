import { db } from "./db";
import { sql, eq, ne, and, gte, lte, inArray, count, sum } from "drizzle-orm";
import {
  impactLogs, impactLogContacts, impactLogGroups, impactTags, impactTaxonomy,
  contacts, groups, groupMembers, events, eventAttendance,
  programmes, bookings, memberships, mous,
  milestones, relationshipStageHistory, communitySpend, meetings, interactions,
  meetingTypes, monthlySnapshots, footTrafficTouchpoints, dailyFootTraffic,
  metricSnapshots, programmeRegistrations,
  surveys,
} from "@shared/schema";

export interface ReportFilters {
  userId: string;
  startDate: string;
  endDate: string;
  programmeIds?: number[];
  taxonomyIds?: number[];
  demographicSegments?: string[];
  funder?: string;
  communityLens?: "all" | "maori" | "pasifika" | "maori_pasifika";
}

export const MAORI_ETHNICITIES = ["Māori"];

export const PASIFIKA_ETHNICITIES = [
  "Samoan", "Tongan", "Cook Islands Māori", "Niuean", "Tokelauan",
  "Fijian", "Hawaiian", "Tahitian", "Other Polynesian", "Micronesian", "Melanesian",
];

function parseDate(d: string) { return new Date(d); }

function safeNum(val: any): number { return Number(val) || 0; }

function funderTagCondition(column: any, funder: string | undefined) {
  if (!funder) return undefined;
  return sql`${column} @> ARRAY[${funder}]::text[]`;
}

function confirmedDebriefWhere(filters: ReportFilters) {
  const conds = [
    eq(impactLogs.userId, filters.userId),
    eq(impactLogs.status, "confirmed"),
    gte(impactLogs.createdAt, parseDate(filters.startDate)),
    lte(impactLogs.createdAt, parseDate(filters.endDate)),
  ];
  if (filters.programmeIds?.length) {
    conds.push(inArray(impactLogs.programmeId, filters.programmeIds));
  }
  const ft = funderTagCondition(impactLogs.funderTags, filters.funder);
  if (ft) conds.push(ft);
  return and(...conds)!;
}

export async function getCommunityLensContactIds(filters: ReportFilters): Promise<Set<number> | null> {
  const lens = filters.communityLens;
  if (!lens || lens === "all") return null;

  let targetEthnicities: string[];
  if (lens === "maori") targetEthnicities = MAORI_ETHNICITIES;
  else if (lens === "pasifika") targetEthnicities = PASIFIKA_ETHNICITIES;
  else targetEthnicities = [...MAORI_ETHNICITIES, ...PASIFIKA_ETHNICITIES];

  const rows = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(
      eq(contacts.userId, filters.userId),
      sql`${contacts.ethnicity} && ${sql`ARRAY[${sql.join(targetEthnicities.map(e => sql`${e}`), sql`, `)}]::text[]`}`,
    ));

  return new Set(rows.map(r => r.id));
}

async function getMentoringTypeNames(userId: string): Promise<string[]> {
  const rows = await db
    .select({ name: meetingTypes.name })
    .from(meetingTypes)
    .where(and(
      eq(meetingTypes.userId, userId),
      eq(meetingTypes.category, "mentoring"),
      eq(meetingTypes.isActive, true),
    ));
  return rows.length > 0
    ? rows.map(t => t.name.toLowerCase())
    : ["mentoring", "catchup", "follow-up"];
}

export async function getReachMetrics(filters: ReportFilters) {
  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);
  const lensIds = await getCommunityLensContactIds(filters);

  const touchpoints = new Map<number, number>();
  function addTouch(id: number | null | undefined) {
    if (id == null) return;
    if (lensIds && !lensIds.has(id)) return;
    touchpoints.set(id, (touchpoints.get(id) || 0) + 1);
  }

  const src = { debriefs: 0, meetings: 0, events: 0, externalEvents: 0, emails: 0, bookings: 0, programmes: 0, touchpoints: 0 };

  const debriefContacts = await db
    .select({ contactId: impactLogContacts.contactId })
    .from(impactLogContacts)
    .innerJoin(impactLogs, eq(impactLogContacts.impactLogId, impactLogs.id))
    .where(confirmedDebriefWhere(filters));
  for (const r of debriefContacts) { addTouch(r.contactId); src.debriefs++; }

  const mtgRows = await db
    .select({ contactId: meetings.contactId })
    .from(meetings)
    .where(and(
      eq(meetings.userId, filters.userId),
      inArray(meetings.status, ["completed", "confirmed"]),
      gte(meetings.startTime, start),
      lte(meetings.startTime, end),
    ));
  for (const r of mtgRows) { addTouch(r.contactId); src.meetings++; }

  const evtRows = await db
    .select({ id: events.id, type: events.type, attendeeCount: events.attendeeCount })
    .from(events)
    .where(and(
      eq(events.userId, filters.userId),
      eq(events.eventStatus, "active"),
      gte(events.startTime, start),
      lte(events.startTime, end),
    ));
  const evtIds = evtRows.map(e => e.id);
  if (evtIds.length > 0) {
    const attRows = await db
      .select({ eventId: eventAttendance.eventId, contactId: eventAttendance.contactId })
      .from(eventAttendance)
      .where(inArray(eventAttendance.eventId, evtIds));
    const typeMap = new Map(evtRows.map(e => [e.id, e.type]));
    for (const a of attRows) {
      addTouch(a.contactId);
      if (typeMap.get(a.eventId) === "External Event") src.externalEvents++;
      else src.events++;
    }
  }

  const emailRows = await db
    .select({ contactId: interactions.contactId })
    .from(interactions)
    .innerJoin(contacts, eq(interactions.contactId, contacts.id))
    .where(and(
      eq(contacts.userId, filters.userId),
      eq(interactions.type, "Email"),
      gte(interactions.date, start),
      lte(interactions.date, end),
    ));
  for (const r of emailRows) { addTouch(r.contactId); src.emails++; }

  const bkgConds = [
    eq(bookings.userId, filters.userId),
    inArray(bookings.status, ["confirmed", "completed"]),
    gte(bookings.startDate, start),
    lte(bookings.startDate, end),
  ];
  const bkgFt = funderTagCondition(bookings.funderTags, filters.funder);
  if (bkgFt) bkgConds.push(bkgFt);
  const bkgRows = await db
    .select({ bookerId: bookings.bookerId, attendees: bookings.attendees })
    .from(bookings)
    .where(and(...bkgConds));
  for (const b of bkgRows) {
    addTouch(b.bookerId);
    if (b.attendees) for (const aid of b.attendees) addTouch(aid);
    src.bookings++;
  }

  const progConds = [
    eq(programmes.userId, filters.userId),
    inArray(programmes.status, ["active", "completed"]),
    gte(programmes.startDate, start),
    lte(programmes.startDate, end),
  ];
  const progFt = funderTagCondition(programmes.funderTags, filters.funder);
  if (progFt) progConds.push(progFt);
  const progRows = await db
    .select({ attendees: programmes.attendees })
    .from(programmes)
    .where(and(...progConds));
  for (const p of progRows) {
    if (p.attendees) for (const aid of p.attendees) addTouch(aid);
    src.programmes++;
  }

  const snapRows = await db
    .select({ id: monthlySnapshots.id })
    .from(monthlySnapshots)
    .where(and(
      eq(monthlySnapshots.userId, filters.userId),
      gte(monthlySnapshots.month, start),
      lte(monthlySnapshots.month, end),
    ));
  const snapIds = snapRows.map(s => s.id);
  if (snapIds.length > 0) {
    const ftRows = await db
      .select({ contactId: footTrafficTouchpoints.contactId })
      .from(footTrafficTouchpoints)
      .where(inArray(footTrafficTouchpoints.snapshotId, snapIds));
    for (const t of ftRows) {
      if (t.contactId) { addTouch(t.contactId); src.touchpoints++; }
    }
  }

  const uniqueContacts = touchpoints.size;
  const totalEngagements = Array.from(touchpoints.values()).reduce((s, v) => s + v, 0);

  let footTraffic = 0;
  const dailyCheck = await db.select({ cnt: count() }).from(dailyFootTraffic)
    .where(and(eq(dailyFootTraffic.userId, filters.userId), gte(dailyFootTraffic.date, start), lte(dailyFootTraffic.date, end)));
  if (safeNum(dailyCheck[0]?.cnt) > 0) {
    const ftSum = await db.select({ total: sum(dailyFootTraffic.count) }).from(dailyFootTraffic)
      .where(and(eq(dailyFootTraffic.userId, filters.userId), gte(dailyFootTraffic.date, start), lte(dailyFootTraffic.date, end)));
    footTraffic = safeNum(ftSum[0]?.total);
  } else {
    const legSum = await db.select({ total: sum(monthlySnapshots.footTraffic) }).from(monthlySnapshots)
      .where(and(eq(monthlySnapshots.userId, filters.userId), gte(monthlySnapshots.month, start), lte(monthlySnapshots.month, end)));
    footTraffic = safeNum(legSum[0]?.total);
  }

  const repeatCount = Array.from(touchpoints.values()).filter(v => v >= 2).length;

  let newContactsCount = 0;
  let promotedToCommunity = 0;
  let promotedToInnovator = 0;
  const allCRows = await db.select({
    id: contacts.id,
    createdAt: contacts.createdAt,
    movedToCommunityAt: contacts.movedToCommunityAt,
    movedToInnovatorsAt: contacts.movedToInnovatorsAt,
  }).from(contacts).where(eq(contacts.userId, filters.userId));

  for (const c of allCRows) {
    if (lensIds && !lensIds.has(c.id)) continue;
    if (c.createdAt && c.createdAt >= start && c.createdAt <= end) newContactsCount++;
    if (c.movedToCommunityAt && c.movedToCommunityAt >= start && c.movedToCommunityAt <= end) promotedToCommunity++;
    if (c.movedToInnovatorsAt && c.movedToInnovatorsAt >= start && c.movedToInnovatorsAt <= end) promotedToInnovator++;
  }

  const newGrpResult = await db.select({ cnt: count() }).from(groups).where(and(
    eq(groups.userId, filters.userId),
    gte(groups.createdAt, start),
    lte(groups.createdAt, end),
  ));
  const newGroups = safeNum(newGrpResult[0]?.cnt);

  let demographicBreakdown: Record<string, any> = {};
  const contactIdsArr = Array.from(touchpoints.keys());
  if (contactIdsArr.length > 0) {
    const cDetails = await db.select({
      id: contacts.id,
      age: contacts.age,
      ethnicity: contacts.ethnicity,
      location: contacts.location,
      consentStatus: contacts.consentStatus,
      stage: contacts.stage,
    }).from(contacts).where(and(eq(contacts.userId, filters.userId), inArray(contacts.id, contactIdsArr)));

    const consented = cDetails.filter(c => c.consentStatus === "given");
    const ethMap: Record<string, number> = {};
    const locMap: Record<string, number> = {};
    const ageGroups: Record<string, number> = { under_18: 0, "18_24": 0, "25_34": 0, "35_44": 0, "45_54": 0, "55_plus": 0, unknown: 0 };
    const stgMap: Record<string, number> = {};

    for (const c of consented) {
      if (c.ethnicity) for (const eth of c.ethnicity) ethMap[eth] = (ethMap[eth] || 0) + 1;
      if (c.location) locMap[c.location] = (locMap[c.location] || 0) + 1;
      if (c.age != null) {
        if (c.age < 18) ageGroups.under_18++;
        else if (c.age <= 24) ageGroups["18_24"]++;
        else if (c.age <= 34) ageGroups["25_34"]++;
        else if (c.age <= 44) ageGroups["35_44"]++;
        else if (c.age <= 54) ageGroups["45_54"]++;
        else ageGroups["55_plus"]++;
      } else ageGroups.unknown++;
      if (c.stage) stgMap[c.stage] = (stgMap[c.stage] || 0) + 1;
    }
    demographicBreakdown = { totalConsented: consented.length, ethnicity: ethMap, location: locMap, ageGroups, relationshipStage: stgMap };
  }

  return {
    peopleReached: uniqueContacts + footTraffic,
    uniqueContacts,
    footTraffic,
    totalEngagements,
    sourceBreakdown: src,
    ecosystemGrowth: { newContacts: newContactsCount, promotedToCommunity, promotedToInnovator, newGroups },
    repeatEngagementRate: uniqueContacts > 0 ? Math.round((repeatCount / uniqueContacts) * 100) : 0,
    repeatEngagementCount: repeatCount,
    demographicBreakdown,
  };
}

export async function getEngagementMetrics(filters: ReportFilters) {
  return getReachMetrics(filters);
}

export async function getDeliveryMetrics(filters: ReportFilters) {
  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);

  const evtRows = await db.select({
    id: events.id,
    type: events.type,
    attendeeCount: events.attendeeCount,
  }).from(events).where(and(
    eq(events.userId, filters.userId),
    ne(events.eventStatus, "cancelled"),
    gte(events.startTime, start),
    lte(events.startTime, end),
  ));

  const eventsByType: Record<string, number> = {};
  let totalAttendees = 0;
  for (const e of evtRows) {
    const t = e.type || "Other";
    eventsByType[t] = (eventsByType[t] || 0) + 1;
    if (e.attendeeCount && e.attendeeCount > 0) totalAttendees += e.attendeeCount;
  }

  const delBkgConds: any[] = [
    eq(bookings.userId, filters.userId),
    inArray(bookings.status, ["confirmed", "completed"]),
    gte(bookings.startDate, start),
    lte(bookings.startDate, end),
  ];
  const delBkgFt = funderTagCondition(bookings.funderTags, filters.funder);
  if (delBkgFt) delBkgConds.push(delBkgFt);
  const bkgRows = await db.select({
    id: bookings.id,
    classification: bookings.classification,
    startTime: bookings.startTime,
    endTime: bookings.endTime,
    isMultiDay: bookings.isMultiDay,
    startDate: bookings.startDate,
    endDate: bookings.endDate,
  }).from(bookings).where(and(...delBkgConds));

  const bookingsByClass: Record<string, number> = {};
  let communityHours = 0;
  for (const b of bkgRows) {
    bookingsByClass[b.classification] = (bookingsByClass[b.classification] || 0) + 1;
    if (b.startTime && b.endTime) {
      const [sh, sm] = b.startTime.split(":").map(Number);
      const [eh, em] = b.endTime.split(":").map(Number);
      const dailyH = Math.max(0, (eh * 60 + (em || 0) - sh * 60 - (sm || 0)) / 60);
      if (b.isMultiDay && b.startDate && b.endDate) {
        const span = Math.max(1, Math.ceil((new Date(b.endDate).getTime() - new Date(b.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1);
        communityHours += dailyH * span;
      } else communityHours += dailyH;
    }
  }

  const MENTORING_TYPES = await getMentoringTypeNames(filters.userId);

  const allMtgRows = await db.select({
    id: meetings.id,
    type: meetings.type,
    status: meetings.status,
  }).from(meetings).where(and(
    eq(meetings.userId, filters.userId),
    inArray(meetings.status, ["completed", "confirmed"]),
    gte(meetings.startTime, start),
    lte(meetings.startTime, end),
  ));

  const mentoringMeetings = allMtgRows.filter(m => m.type && MENTORING_TYPES.includes(m.type.toLowerCase()));
  const partnerMeetings = allMtgRows.filter(m => m.type && !MENTORING_TYPES.includes(m.type.toLowerCase()));
  const workshopCount = evtRows.filter(e => e.type && e.type.toLowerCase().includes("workshop")).length;

  const delProgConds: any[] = [
    eq(programmes.userId, filters.userId),
    ne(programmes.status, "cancelled"),
    gte(programmes.startDate, start),
    lte(programmes.startDate, end),
  ];
  const delProgFt = funderTagCondition(programmes.funderTags, filters.funder);
  if (delProgFt) delProgConds.push(delProgFt);
  const progRows = await db.select({
    id: programmes.id,
    classification: programmes.classification,
    status: programmes.status,
    attendees: programmes.attendees,
  }).from(programmes).where(and(...delProgConds));

  const progByClass: Record<string, number> = {};
  let progCompleted = 0;
  let progAttendees = 0;
  for (const p of progRows) {
    progByClass[p.classification] = (progByClass[p.classification] || 0) + 1;
    if (p.status === "completed") progCompleted++;
    if (p.attendees) progAttendees += p.attendees.length;
  }

  const totalActivations = evtRows.length + bkgRows.length + mentoringMeetings.length + progRows.length + partnerMeetings.length;

  return {
    totalActivations,
    events: { total: evtRows.length, byType: eventsByType, totalAttendees },
    bookings: { total: bkgRows.length, byClassification: bookingsByClass, communityHours: Math.round(communityHours * 10) / 10 },
    mentoringSessions: mentoringMeetings.length,
    partnerMeetings: partnerMeetings.length,
    workshops: workshopCount,
    programmes: { total: progRows.length, byClassification: progByClass, completed: progCompleted },
    communityHours: Math.round(communityHours * 10) / 10,
    totalAttendees: totalAttendees + progAttendees,
    communityLensApplied: false,
  };
}

const ALL_METRIC_KEYS = ["mindset", "skill", "confidence", "bizConfidence", "systemsInPlace", "fundingReadiness", "networkStrength", "communityImpact", "digitalPresence"] as const;

export async function getImpactMetrics(filters: ReportFilters) {
  const where = confirmedDebriefWhere(filters);
  const lensIds = await getCommunityLensContactIds(filters);
  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);

  let communitySpendTotal = 0;
  try {
    const spendResult = await db
      .select({ total: sum(communitySpend.amount) })
      .from(communitySpend)
      .where(and(eq(communitySpend.userId, filters.userId), gte(communitySpend.date, start), lte(communitySpend.date, end)));
    communitySpendTotal = Math.round(safeNum(spendResult[0]?.total) * 100) / 100;
  } catch {}

  const logIdRows = await db.select({ id: impactLogs.id }).from(impactLogs).where(where);
  const logIds = logIdRows.map(r => r.id);

  let taxonomyBreakdown: any[] = [];
  if (logIds.length > 0) {
    const tagConds = filters.taxonomyIds?.length
      ? and(inArray(impactTags.impactLogId, logIds), inArray(impactTags.taxonomyId, filters.taxonomyIds))
      : inArray(impactTags.impactLogId, logIds);

    const allTags = await db.select({
      taxonomyId: impactTags.taxonomyId,
      taxonomyName: impactTaxonomy.name,
      taxonomyColor: impactTaxonomy.color,
      impactLogId: impactTags.impactLogId,
      confidence: impactTags.confidence,
      notes: impactTags.notes,
      evidence: impactTags.evidence,
    }).from(impactTags)
      .innerJoin(impactTaxonomy, eq(impactTags.taxonomyId, impactTaxonomy.id))
      .where(tagConds!);

    const contactsByLog = await db
      .select({ impactLogId: impactLogContacts.impactLogId, contactId: impactLogContacts.contactId })
      .from(impactLogContacts)
      .where(inArray(impactLogContacts.impactLogId, logIds));

    const contactsByLogMap = new Map<number, number[]>();
    for (const row of contactsByLog) {
      if (lensIds && !lensIds.has(row.contactId)) continue;
      if (!contactsByLogMap.has(row.impactLogId)) contactsByLogMap.set(row.impactLogId, []);
      contactsByLogMap.get(row.impactLogId)!.push(row.contactId);
    }

    const quoteRows = await db
      .select({ id: impactLogs.id, keyQuotes: impactLogs.keyQuotes })
      .from(impactLogs)
      .where(inArray(impactLogs.id, logIds));
    const quotesMap = new Map<number, string[]>();
    for (const r of quoteRows) { if (r.keyQuotes) quotesMap.set(r.id, r.keyQuotes); }

    const grouped = new Map<number, {
      taxonomyId: number; taxonomyName: string; taxonomyColor: string | null;
      debriefCount: number; weightedScore: number; contactIds: Set<number>;
      quotes: string[]; evidenceSnippets: string[]; logIds: Set<number>;
    }>();

    for (const tag of allTags) {
      if (!grouped.has(tag.taxonomyId)) {
        grouped.set(tag.taxonomyId, {
          taxonomyId: tag.taxonomyId, taxonomyName: tag.taxonomyName, taxonomyColor: tag.taxonomyColor,
          debriefCount: 0, weightedScore: 0, contactIds: new Set(), quotes: [], evidenceSnippets: [], logIds: new Set(),
        });
      }
      const g = grouped.get(tag.taxonomyId)!;
      if (!g.logIds.has(tag.impactLogId)) { g.debriefCount++; g.logIds.add(tag.impactLogId); }
      g.weightedScore += safeNum(tag.confidence);
      for (const cid of (contactsByLogMap.get(tag.impactLogId) || [])) g.contactIds.add(cid);
      if (tag.evidence) g.evidenceSnippets.push(tag.evidence);
      if (tag.notes) g.evidenceSnippets.push(tag.notes);
      if (safeNum(tag.confidence) >= 70) {
        for (const q of (quotesMap.get(tag.impactLogId) || [])) {
          if (!g.quotes.includes(q)) g.quotes.push(q);
        }
      }
    }

    taxonomyBreakdown = Array.from(grouped.values()).map(g => ({
      name: g.taxonomyName, color: g.taxonomyColor, debriefCount: g.debriefCount,
      peopleAffected: g.contactIds.size, impactScore: g.weightedScore,
      topQuotes: g.quotes.slice(0, 5), evidence: g.evidenceSnippets.slice(0, 5),
    })).sort((a, b) => b.impactScore - a.impactScore);
  }

  let engagedRows = await db
    .selectDistinct({ contactId: impactLogContacts.contactId })
    .from(impactLogContacts)
    .innerJoin(impactLogs, eq(impactLogContacts.impactLogId, impactLogs.id))
    .where(where);
  if (lensIds) engagedRows = engagedRows.filter(r => lensIds.has(r.contactId));
  const cIds = engagedRows.map(r => r.contactId);

  const metricArrays: Record<string, number[]> = {};
  for (const key of ALL_METRIC_KEYS) metricArrays[key] = [];
  let contactsWithMetrics = 0;

  if (cIds.length > 0) {
    const cMetrics = await db
      .select({ id: contacts.id, metrics: contacts.metrics })
      .from(contacts)
      .where(and(eq(contacts.userId, filters.userId), inArray(contacts.id, cIds)));
    for (const c of cMetrics) {
      const m = c.metrics as any;
      if (!m || typeof m !== "object" || Object.keys(m).length === 0) continue;
      contactsWithMetrics++;
      for (const key of ALL_METRIC_KEYS) {
        if (m[key] != null) metricArrays[key].push(m[key]);
      }
    }
  }

  const avgFn = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;
  const posPct = (arr: number[]) => arr.length ? Math.round((arr.filter(v => v > 0).length / arr.length) * 100) : 0;

  const beforeAfterMetrics: Record<string, { startAvg: number; endAvg: number; avgImprovement: number; improvedPercent: number }> = {};
  if (cIds.length > 0) {
    const allSnapshots = await db.select().from(metricSnapshots)
      .where(and(inArray(metricSnapshots.contactId, cIds), lte(metricSnapshots.createdAt, end)));

    const snapshotsByContact = new Map<number, Array<{ metrics: any; createdAt: Date | null }>>();
    for (const s of allSnapshots) {
      if (!snapshotsByContact.has(s.contactId)) snapshotsByContact.set(s.contactId, []);
      snapshotsByContact.get(s.contactId)!.push({ metrics: s.metrics, createdAt: s.createdAt });
    }

    const currentMetricsByContact = new Map<number, any>();
    const cMetricsForBA = await db.select({ id: contacts.id, metrics: contacts.metrics })
      .from(contacts).where(inArray(contacts.id, cIds));
    for (const c of cMetricsForBA) {
      if (c.metrics && typeof c.metrics === "object") currentMetricsByContact.set(c.id, c.metrics);
    }

    for (const key of ALL_METRIC_KEYS) {
      const startScores: number[] = [];
      const endScores: number[] = [];
      let improved = 0;
      let total = 0;

      for (const cid of cIds) {
        const snaps = (snapshotsByContact.get(cid) || [])
          .filter(s => s.metrics?.[key] != null)
          .sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));

        const beforeStart = snaps.filter(s => (s.createdAt?.getTime() || 0) <= start.getTime());
        const startVal = beforeStart.length > 0 ? beforeStart[beforeStart.length - 1].metrics[key] : null;

        const beforeEnd = snaps.filter(s => (s.createdAt?.getTime() || 0) <= end.getTime());
        let endVal: number | null = null;
        if (beforeEnd.length > 0) {
          endVal = beforeEnd[beforeEnd.length - 1].metrics[key];
        }
        const currentM = currentMetricsByContact.get(cid);
        if (endVal == null && currentM?.[key] != null) {
          endVal = currentM[key];
        }

        if (startVal == null || endVal == null) continue;

        startScores.push(startVal);
        endScores.push(endVal);
        total++;
        if (endVal > startVal) improved++;
      }

      beforeAfterMetrics[key] = {
        startAvg: avgFn(startScores),
        endAvg: avgFn(endScores),
        avgImprovement: startScores.length > 0 ? Math.round((avgFn(endScores) - avgFn(startScores)) * 10) / 10 : 0,
        improvedPercent: total > 0 ? Math.round((improved / total) * 100) : 0,
      };
    }
  } else {
    for (const key of ALL_METRIC_KEYS) {
      beforeAfterMetrics[key] = { startAvg: 0, endAvg: 0, avgImprovement: 0, improvedPercent: 0 };
    }
  }

  const confirmedLogs = await db
    .select({ id: impactLogs.id, milestones: impactLogs.milestones })
    .from(impactLogs)
    .where(where);

  let milestonesFromTable = await db
    .select({
      id: milestones.id,
      linkedContactId: milestones.linkedContactId,
      title: milestones.title,
      milestoneType: milestones.milestoneType,
      valueAmount: milestones.valueAmount,
      impactLogId: milestones.linkedImpactLogId,
    })
    .from(milestones)
    .where(and(eq(milestones.userId, filters.userId), gte(milestones.createdAt, start), lte(milestones.createdAt, end)));

  if (lensIds) {
    milestonesFromTable = milestonesFromTable.filter(m => m.linkedContactId && lensIds.has(m.linkedContactId));
  }

  let inlineMilestoneCount = 0;
  const tableMilestoneLogIds = new Set(milestonesFromTable.map(m => m.impactLogId).filter(Boolean));
  for (const log of confirmedLogs) {
    if (log.milestones && log.milestones.length > 0 && !tableMilestoneLogIds.has(log.id)) {
      inlineMilestoneCount += log.milestones.length;
    }
  }

  const economicRollup: Record<string, { count: number; totalValue: number }> = {};
  for (const m of milestonesFromTable) {
    const mType = m.milestoneType || "other";
    if (!economicRollup[mType]) economicRollup[mType] = { count: 0, totalValue: 0 };
    economicRollup[mType].count++;
    economicRollup[mType].totalValue += safeNum(m.valueAmount);
  }
  const totalEconomicValue = Object.values(economicRollup).reduce((s, r) => s + r.totalValue, 0);
  const fundingSecured = (economicRollup["funding_secured"]?.totalValue || 0) + (economicRollup["grant_received"]?.totalValue || 0) + (economicRollup["sponsorship_secured"]?.totalValue || 0);
  const businessesLaunched = (economicRollup["business_launched"]?.count || 0) + (economicRollup["brand_launched"]?.count || 0);
  const jobsCreated = economicRollup["job_created"]?.count || 0;
  const revenueMilestones = economicRollup["revenue_milestone"]?.totalValue || 0;

  const CONNECTION_ORDER = ["known", "connected", "engaged", "embedded", "partnering"];
  const stageHist = await db.select({
    entityId: relationshipStageHistory.entityId,
    previousStage: relationshipStageHistory.previousStage,
    newStage: relationshipStageHistory.newStage,
  }).from(relationshipStageHistory).where(and(
    eq(relationshipStageHistory.entityType, "contact"),
    gte(relationshipStageHistory.changedAt, start),
    lte(relationshipStageHistory.changedAt, end),
  ));

  const deepened = new Set<number>();
  for (const sh of stageHist) {
    if (lensIds && !lensIds.has(sh.entityId)) continue;
    const prevIdx = sh.previousStage ? CONNECTION_ORDER.indexOf(sh.previousStage) : -1;
    const newIdx = CONNECTION_ORDER.indexOf(sh.newStage);
    if (newIdx > prevIdx && newIdx >= 0) deepened.add(sh.entityId);
  }

  return {
    communitySpend: communitySpendTotal,
    milestoneCount: milestonesFromTable.length + inlineMilestoneCount,
    growthMetrics: Object.fromEntries(
      ALL_METRIC_KEYS.map(key => [key, { averageScore: avgFn(metricArrays[key]), positiveMovementPercent: posPct(metricArrays[key]) }])
    ) as Record<string, { averageScore: number; positiveMovementPercent: number }>,
    beforeAfterMetrics,
    contactsWithMetrics,
    connectionMovement: deepened.size,
    taxonomyBreakdown,
    economicRollup: {
      totalEconomicValue: Math.round(totalEconomicValue * 100) / 100,
      fundingSecured: Math.round(fundingSecured * 100) / 100,
      businessesLaunched,
      jobsCreated,
      revenueMilestones: Math.round(revenueMilestones * 100) / 100,
      byType: economicRollup,
    },
  };
}

export async function getImpactByTaxonomy(filters: ReportFilters) {
  const result = await getImpactMetrics(filters);
  return result.taxonomyBreakdown.map(t => ({
    taxonomyId: 0, taxonomyName: t.name, taxonomyColor: t.color,
    debriefCount: t.debriefCount, weightedImpactScore: t.impactScore,
    uniqueContactsAffected: t.peopleAffected,
    representativeQuotes: t.topQuotes, evidenceSnippets: t.evidence,
  }));
}

export async function getOutcomeMovement(filters: ReportFilters) {
  const result = await getImpactMetrics(filters);
  const averageChange: Record<string, number> = {};
  const positiveMovementPercent: Record<string, number> = {};
  for (const [key, val] of Object.entries(result.growthMetrics || {})) {
    averageChange[key] = val.averageScore;
    positiveMovementPercent[key] = val.positiveMovementPercent;
  }
  return {
    totalContacts: result.contactsWithMetrics,
    contactsWithMetrics: result.contactsWithMetrics,
    averageChange,
    positiveMovementPercent,
    milestoneCount: result.milestoneCount,
  };
}

export async function getValueContribution(filters: ReportFilters) {
  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);

  const bkgRows = await db.select({
    id: bookings.id,
    amount: bookings.amount,
    pricingTier: bookings.pricingTier,
    membershipId: bookings.membershipId,
  }).from(bookings).where(and(
    eq(bookings.userId, filters.userId),
    gte(bookings.startDate, start),
    lte(bookings.startDate, end),
  ));

  let totalRevenue = 0;
  const bookingsByTier: Record<string, { count: number; revenue: number }> = {};
  for (const b of bkgRows) {
    const amt = safeNum(b.amount);
    totalRevenue += amt;
    const tier = b.pricingTier || "full_price";
    if (!bookingsByTier[tier]) bookingsByTier[tier] = { count: 0, revenue: 0 };
    bookingsByTier[tier].count++;
    bookingsByTier[tier].revenue += amt;
  }

  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const activeMems = await db.select({
    id: memberships.id,
    name: memberships.name,
    membershipYear: memberships.membershipYear,
    annualFee: memberships.annualFee,
    standardValue: memberships.standardValue,
    bookingAllowance: memberships.bookingAllowance,
  }).from(memberships).where(and(
    eq(memberships.userId, filters.userId),
    eq(memberships.status, "active"),
    gte(memberships.membershipYear, startYear),
    lte(memberships.membershipYear, endYear),
  ));

  let membershipRevenue = 0;
  let totalStandardValue = 0;
  const membershipDetails = activeMems.map(m => {
    const fee = safeNum(m.annualFee);
    const sv = safeNum(m.standardValue);
    membershipRevenue += fee;
    totalStandardValue += sv;
    const usedBookings = bkgRows.filter(b => b.membershipId === m.id);
    return {
      id: m.id, name: m.name, membershipYear: m.membershipYear,
      standardValue: sv, annualFee: fee,
      bookingAllowance: m.bookingAllowance || 0, bookingsUsed: usedBookings.length,
    };
  });

  const activeMous = await db.select({
    id: mous.id,
    title: mous.title,
    partnerName: mous.partnerName,
    providing: mous.providing,
    receiving: mous.receiving,
    inKindValue: mous.inKindValue,
    actualValue: mous.actualValue,
  }).from(mous).where(and(
    eq(mous.userId, filters.userId),
    eq(mous.status, "active"),
    lte(mous.startDate, end),
    gte(mous.endDate, start),
  ));

  let totalInKindValue = 0;
  let totalMouActualValue = 0;
  const mouSummary = activeMous.map(m => {
    const ikv = safeNum(m.inKindValue);
    const av = safeNum(m.actualValue);
    totalInKindValue += ikv;
    totalMouActualValue += av;
    return { id: m.id, title: m.title, partnerName: m.partnerName, providing: m.providing, receiving: m.receiving, actualValue: av, inKindValue: ikv };
  });

  const progRows = await db.select({
    id: programmes.id,
    name: programmes.name,
    classification: programmes.classification,
    facilitatorCost: programmes.facilitatorCost,
    cateringCost: programmes.cateringCost,
    promoCost: programmes.promoCost,
  }).from(programmes).where(and(
    eq(programmes.userId, filters.userId),
    gte(programmes.startDate, start),
    lte(programmes.startDate, end),
  ));

  const programmeCosts = progRows.map(p => {
    const fc = safeNum(p.facilitatorCost);
    const cc = safeNum(p.cateringCost);
    const pc = safeNum(p.promoCost);
    return { id: p.id, name: p.name, classification: p.classification, facilitatorCost: fc, cateringCost: cc, promoCost: pc, totalCost: fc + cc + pc };
  });

  return {
    revenue: { total: Math.round(totalRevenue * 100) / 100, byPricingTier: bookingsByTier },
    inKindValue: Math.round(totalInKindValue * 100) / 100,
    memberships: {
      active: activeMems.length,
      totalRevenue: Math.round(membershipRevenue * 100) / 100,
      totalStandardValue: Math.round(totalStandardValue * 100) / 100,
      totalValueGiven: Math.round(Math.max(0, totalStandardValue - membershipRevenue) * 100) / 100,
      details: membershipDetails,
    },
    mouExchange: {
      active: activeMous.length,
      totalActualValue: Math.round(totalMouActualValue * 100) / 100,
      totalInKindValue: Math.round(totalInKindValue * 100) / 100,
      totalValueGiven: Math.round(Math.max(0, totalMouActualValue - totalInKindValue) * 100) / 100,
      details: mouSummary,
    },
    programmeCosts,
    communityLensApplied: false,
  };
}

export async function generateNarrative(
  filters: ReportFilters,
  legacyContext?: { metrics: any; highlights: string[]; reportCount: number } | null,
  narrativeStyle: "compliance" | "story" = "compliance",
) {
  const [reach, delivery, impact, value, mentoring, connectionStrength, surveyData] = await Promise.all([
    getReachMetrics(filters),
    getDeliveryMetrics(filters),
    getImpactMetrics(filters),
    getValueContribution(filters),
    getMentoringMetrics(filters),
    getConnectionStrengthDistribution(filters),
    getSurveyAggregation(filters),
  ]);

  const topCategories = impact.taxonomyBreakdown.slice(0, 3);
  const startLabel = new Date(filters.startDate).toLocaleDateString("en-NZ", { month: "long", year: "numeric" });
  const endLabel = new Date(filters.endDate).toLocaleDateString("en-NZ", { month: "long", year: "numeric" });
  const periodLabel = startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
  const lm = legacyContext?.metrics;
  const hasLegacy = legacyContext && legacyContext.reportCount > 0 && lm;
  const lens = filters.communityLens;
  const lensLabel = lens === "maori" ? "Maori (matawaka)" : lens === "pasifika" ? "Pasifika" : lens === "maori_pasifika" ? "Maori and Pasifika" : null;

  const sections: string[] = [];

  if (narrativeStyle === "story") {
    let reachText = `## Our Reach\n\n`;
    if (lensLabel) reachText += `Focusing on our ${lensLabel} community, `;
    else reachText += `During ${periodLabel}, `;
    reachText += `we reached ${reach.peopleReached.toLocaleString()} people`;
    if (reach.footTraffic > 0) reachText += ` (including ${reach.footTraffic.toLocaleString()} through foot traffic)`;
    reachText += `.`;
    if (hasLegacy) reachText += ` This builds on ${legacyContext.reportCount} legacy report${legacyContext.reportCount > 1 ? "s" : ""}.`;
    reachText += ` ${reach.ecosystemGrowth.newContacts} new people joined our network. ${reach.repeatEngagementRate}% came back more than once, showing the depth of connection being built.`;
    if (reach.ecosystemGrowth.promotedToCommunity > 0) reachText += ` ${reach.ecosystemGrowth.promotedToCommunity} people deepened into our community.`;
    if (reach.ecosystemGrowth.promotedToInnovator > 0) reachText += ` ${reach.ecosystemGrowth.promotedToInnovator} became innovators.`;
    sections.push(reachText);

    let delText = `## What We Delivered\n\n`;
    delText += `Across the period, ${delivery.totalActivations} activations were delivered - ${delivery.events.total} events, ${delivery.bookings.total} bookings, ${delivery.mentoringSessions} mentoring sessions, and ${delivery.programmes.total} programmes.`;
    if (delivery.totalAttendees > 0) delText += ` ${delivery.totalAttendees} attendees participated across events and programmes.`;
    if (mentoring.totalHours > 0) delText += ` ${mentoring.totalHours} hours of mentoring support were provided to ${mentoring.uniqueMentees} mentee${mentoring.uniqueMentees !== 1 ? "s" : ""}.`;
    if (delivery.communityHours > 0) delText += ` ${delivery.communityHours} hours of community activity through venue bookings.`;
    sections.push(delText);

    if (topCategories.length > 0 || impact.milestoneCount > 0 || impact.contactsWithMetrics > 0) {
      let impText = `## What Changed\n\n`;
      const econ = impact.economicRollup;
      if (econ && (econ.totalEconomicValue > 0 || econ.businessesLaunched > 0 || econ.jobsCreated > 0)) {
        let econParts: string[] = [];
        if (econ.fundingSecured > 0) econParts.push(`$${econ.fundingSecured.toLocaleString()} in funding secured`);
        if (econ.revenueMilestones > 0) econParts.push(`$${econ.revenueMilestones.toLocaleString()} in revenue milestones`);
        if (econ.businessesLaunched > 0) econParts.push(`${econ.businessesLaunched} business${econ.businessesLaunched !== 1 ? "es" : ""} launched`);
        if (econ.jobsCreated > 0) econParts.push(`${econ.jobsCreated} job${econ.jobsCreated !== 1 ? "s" : ""} created`);
        if (econ.totalEconomicValue > 0) {
          impText += `Our community generated $${econ.totalEconomicValue.toLocaleString()} in total economic value`;
          if (econParts.length > 0) impText += ` — including ${econParts.join(", ")}`;
          impText += `. `;
        } else if (econParts.length > 0) {
          impText += `Key economic outcomes: ${econParts.join(", ")}. `;
        }
      }
      if (impact.communitySpend > 0) impText += `$${impact.communitySpend.toLocaleString()} was invested directly into community. `;
      if (impact.milestoneCount > 0) impText += `${impact.milestoneCount} milestones were achieved. `;
      if (impact.contactsWithMetrics > 0 && impact.growthMetrics) {
        const gm = impact.growthMetrics;
        impText += `${impact.contactsWithMetrics} people have tracked growth - mindset shifted positively for ${gm.mindset?.positiveMovementPercent ?? 0}%, skill for ${gm.skill?.positiveMovementPercent ?? 0}%, and confidence for ${gm.confidence?.positiveMovementPercent ?? 0}%.`;
      }
      if (connectionStrength.movements.totalDeepened > 0) {
        impText += ` ${connectionStrength.movements.summary}`;
      }
      if (topCategories.length > 0) {
        impText += `\n\nKey impact areas:\n`;
        impText += topCategories.map(c => {
          let line = `- **${c.name}**: ${c.peopleAffected} people across ${c.debriefCount} sessions`;
          if (c.topQuotes.length > 0) line += `\n  > "${c.topQuotes[0]}"`;
          return line;
        }).join("\n");
      }
      if (surveyData.totalCompletedSurveys > 0) {
        impText += `\n\n### Community Voice\n\n`;
        impText += `${surveyData.totalCompletedSurveys} completed surveys were collected (${surveyData.totalSent} sent, ${surveyData.totalSent > 0 ? Math.round((surveyData.totalCompletedSurveys / surveyData.totalSent) * 100) : 0}% completion rate).`;
        if (surveyData.growth.totalCompleted > 0) {
          const ratedGrowthQs = surveyData.growth.aggregatedQuestions.filter(q => q.averageRating !== null);
          if (ratedGrowthQs.length > 0) {
            impText += ` Self-reported growth ratings: `;
            impText += ratedGrowthQs.slice(0, 3).map(q => `${q.question}: ${q.averageRating}/10`).join(", ");
            impText += `.`;
          }
        }
        if (surveyData.postBooking.overallSatisfaction !== null) {
          impText += ` Post-booking satisfaction averaged ${surveyData.postBooking.overallSatisfaction}/10.`;
        }
      }
      sections.push(impText);
    }

    sections.push(`## [Participant Story]\n\n*[Insert a participant story here - a real example of change, growth, or connection that brings the data to life.]*`);
    sections.push(`## [What's Next]\n\n*[Share what's coming up - upcoming programmes, community goals, or areas of focus for the next period.]*`);
  } else {
    let reachText = `## Reach\n\nDuring ${periodLabel}`;
    if (lensLabel) reachText += ` (${lensLabel} community)`;
    if (hasLegacy) reachText += ` (combining ${legacyContext.reportCount} legacy report${legacyContext.reportCount > 1 ? "s" : ""})`;
    reachText += `, ${reach.peopleReached.toLocaleString()} people were reached (${reach.uniqueContacts} tracked contacts`;
    if (reach.footTraffic > 0) reachText += ` + ${reach.footTraffic.toLocaleString()} foot traffic`;
    reachText += `) across ${reach.totalEngagements} engagements.`;
    if (hasLegacy && lm.foottrafficUnique > 0) reachText += ` Legacy foot traffic: ${lm.foottrafficUnique.toLocaleString()}.`;
    reachText += ` ${reach.ecosystemGrowth.newContacts} new contacts added. Repeat engagement rate: ${reach.repeatEngagementRate}%.`;
    if (reach.ecosystemGrowth.promotedToCommunity > 0) reachText += ` ${reach.ecosystemGrowth.promotedToCommunity} promoted to community.`;
    if (reach.ecosystemGrowth.promotedToInnovator > 0) reachText += ` ${reach.ecosystemGrowth.promotedToInnovator} promoted to innovators.`;
    if (reach.ecosystemGrowth.newGroups > 0) reachText += ` ${reach.ecosystemGrowth.newGroups} new groups formed.`;
    sections.push(reachText);

    let delText = `## Delivery\n\n${delivery.totalActivations} total activations: ${delivery.events.total} events, ${delivery.bookings.total} bookings, ${delivery.mentoringSessions} mentoring sessions, ${delivery.programmes.total} programmes.`;
    if (delivery.totalAttendees > 0) delText += ` ${delivery.totalAttendees} total attendees.`;
    if (delivery.communityHours > 0) delText += ` ${delivery.communityHours} community hours.`;
    if (hasLegacy && lm.activationsTotal > 0) delText += ` Legacy: ${lm.activationsTotal} activations.`;
    if (mentoring.totalHours > 0) delText += ` Mentoring: ${mentoring.totalHours} hours to ${mentoring.uniqueMentees} mentees.`;
    if (mentoring.newMentees > 0) delText += ` ${mentoring.newMentees} new mentees started.`;
    sections.push(delText);

    let impText = `## Impact\n\n`;
    const econC = impact.economicRollup;
    if (econC && (econC.totalEconomicValue > 0 || econC.businessesLaunched > 0 || econC.jobsCreated > 0)) {
      let econParts: string[] = [];
      if (econC.fundingSecured > 0) econParts.push(`funding secured: $${econC.fundingSecured.toLocaleString()}`);
      if (econC.revenueMilestones > 0) econParts.push(`revenue milestones: $${econC.revenueMilestones.toLocaleString()}`);
      if (econC.businessesLaunched > 0) econParts.push(`businesses launched: ${econC.businessesLaunched}`);
      if (econC.jobsCreated > 0) econParts.push(`jobs created: ${econC.jobsCreated}`);
      if (econC.totalEconomicValue > 0) {
        impText += `Total economic value generated: $${econC.totalEconomicValue.toLocaleString()}`;
        if (econParts.length > 0) impText += ` (${econParts.join(", ")})`;
        impText += `. `;
      } else if (econParts.length > 0) {
        impText += `Economic outcomes: ${econParts.join(", ")}. `;
      }
    }
    if (impact.communitySpend > 0) impText += `Community investment: $${impact.communitySpend.toLocaleString()}. `;
    impText += `${impact.milestoneCount} milestones achieved. ${impact.contactsWithMetrics} people with tracked growth.`;
    if (impact.contactsWithMetrics > 0 && impact.growthMetrics) {
      const gm = impact.growthMetrics;
      impText += ` Average scores - mindset: ${gm.mindset?.averageScore ?? 0}, skill: ${gm.skill?.averageScore ?? 0}, confidence: ${gm.confidence?.averageScore ?? 0}.`;
      impText += ` Positive movement - mindset: ${gm.mindset?.positiveMovementPercent ?? 0}%, skill: ${gm.skill?.positiveMovementPercent ?? 0}%, confidence: ${gm.confidence?.positiveMovementPercent ?? 0}%.`;
    }
    if (connectionStrength.movements.totalDeepened > 0) {
      const upMoves = connectionStrength.movements.transitions.filter((t: any) => t.direction === "up");
      impText += ` Connection movement: ${connectionStrength.movements.totalDeepened} people deepened.`;
      if (upMoves.length > 0) {
        impText += ` Transitions: ${upMoves.map((t: any) => `${t.count} ${t.from}→${t.to}`).join(", ")}.`;
      }
    }
    if (connectionStrength.movements.totalDeclined > 0) {
      impText += ` ${connectionStrength.movements.totalDeclined} connections declined.`;
    }
    if (topCategories.length > 0) {
      const catLines = topCategories.map(c => {
        let line = `- **${c.name}**: ${c.debriefCount} debriefs, ${c.peopleAffected} affected (score: ${c.impactScore})`;
        if (c.topQuotes.length > 0) line += `\n  > "${c.topQuotes[0]}"`;
        return line;
      }).join("\n");
      impText += `\n\nTop impact areas:\n${catLines}`;
    }
    if (surveyData.totalCompletedSurveys > 0) {
      impText += `\n\nSelf-reported survey data: ${surveyData.totalCompletedSurveys} completed surveys (${surveyData.totalSent} sent, ${surveyData.totalSent > 0 ? Math.round((surveyData.totalCompletedSurveys / surveyData.totalSent) * 100) : 0}% completion).`;
      if (surveyData.growth.totalCompleted > 0) {
        const ratedGrowthQs = surveyData.growth.aggregatedQuestions.filter(q => q.averageRating !== null);
        if (ratedGrowthQs.length > 0) {
          impText += ` Growth survey averages: `;
          impText += ratedGrowthQs.slice(0, 3).map(q => `${q.question}: ${q.averageRating}`).join(", ");
          impText += `.`;
        }
      }
      if (surveyData.postBooking.overallSatisfaction !== null) {
        impText += ` Post-booking satisfaction: ${surveyData.postBooking.overallSatisfaction}/10.`;
      }
    }
    sections.push(impText);

    sections.push(`## Value & Contribution\n\nBooking revenue: $${value.revenue.total.toLocaleString()}. ${value.memberships.active} memberships ($${value.memberships.totalRevenue.toLocaleString()}). ${value.mouExchange.active} MOUs ($${value.mouExchange.totalInKindValue.toLocaleString()} in-kind). Programme costs: $${value.programmeCosts.reduce((s, p) => s + p.totalCost, 0).toLocaleString()}.`);

    sections.push(`## [Participant Story]\n\n*[Insert a participant story here - a real example that illustrates the impact described above.]*`);
    sections.push(`## [What's Next]\n\n*[Outline upcoming priorities, planned activities, or strategic focus for the next reporting period.]*`);
  }

  if (hasLegacy && legacyContext.highlights.length > 0) {
    const hlLines = legacyContext.highlights.slice(0, 5).map(h => `- ${h}`).join("\n");
    sections.push(`## Legacy Highlights\n\nKey highlights from legacy reports:\n${hlLines}`);
  }

  return {
    narrative: sections.join("\n\n"),
    narrativeStyle,
    sections: { reach, delivery, impact, value },
  };
}

export async function getCommunityComparison(filters: ReportFilters) {
  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);
  const where = confirmedDebriefWhere(filters);

  const maoriIds = await getCommunityLensContactIds({ ...filters, communityLens: "maori" });
  const pasifikaIds = await getCommunityLensContactIds({ ...filters, communityLens: "pasifika" });

  const allEngaged = await db
    .selectDistinct({ contactId: impactLogContacts.contactId })
    .from(impactLogContacts)
    .innerJoin(impactLogs, eq(impactLogContacts.impactLogId, impactLogs.id))
    .where(where);
  const allEngagedIds = new Set(allEngaged.map(r => r.contactId));

  const allContactDetails = allEngagedIds.size > 0
    ? await db.select({ id: contacts.id, age: contacts.age, metrics: contacts.metrics })
        .from(contacts)
        .where(and(eq(contacts.userId, filters.userId), inArray(contacts.id, Array.from(allEngagedIds))))
    : [];

  const newInPeriod = await db.select({ id: contacts.id }).from(contacts)
    .where(and(eq(contacts.userId, filters.userId), gte(contacts.createdAt, start), lte(contacts.createdAt, end)));
  const newIds = new Set(newInPeriod.map(c => c.id));

  const bizProgs = await db.select({ id: programmes.id, attendees: programmes.attendees }).from(programmes)
    .where(and(eq(programmes.userId, filters.userId), gte(programmes.startDate, start), lte(programmes.startDate, end)));
  const bizProgContacts = new Set<number>();
  for (const p of bizProgs) { if (p.attendees) for (const a of p.attendees) bizProgContacts.add(a); }

  const allMiles = await db.select({
    id: milestones.id,
    linkedContactId: milestones.linkedContactId,
  }).from(milestones).where(and(
    eq(milestones.userId, filters.userId), gte(milestones.createdAt, start), lte(milestones.createdAt, end),
  ));

  function computeMetrics(lensIds: Set<number> | null) {
    if (!lensIds) return { uniqueParticipants: 0, rangatahiUnder25: 0, activeInBusinessProgrammes: 0, confidenceGrowthPercent: 0, milestonesAchieved: 0, newContactsThisPeriod: 0 };
    const engaged = Array.from(allEngagedIds).filter(id => lensIds.has(id));
    const contactMap = new Map(allContactDetails.map(c => [c.id, c]));
    let rangatahi = 0, confPos = 0, confTotal = 0, activeBiz = 0;
    for (const id of engaged) {
      const c = contactMap.get(id);
      if (c) {
        if (c.age != null && c.age < 25) rangatahi++;
        const m = c.metrics as any;
        if (m?.confidence != null) { confTotal++; if (m.confidence > 0) confPos++; }
      }
      if (bizProgContacts.has(id)) activeBiz++;
    }
    return {
      uniqueParticipants: engaged.length,
      rangatahiUnder25: rangatahi,
      activeInBusinessProgrammes: activeBiz,
      confidenceGrowthPercent: confTotal > 0 ? Math.round((confPos / confTotal) * 100) : 0,
      milestonesAchieved: allMiles.filter(m => m.linkedContactId && lensIds.has(m.linkedContactId)).length,
      newContactsThisPeriod: Array.from(newIds).filter(id => lensIds.has(id)).length,
    };
  }

  const maoriMetrics = computeMetrics(maoriIds);
  const pasifikaMetrics = computeMetrics(pasifikaIds);
  const total = maoriMetrics.uniqueParticipants + pasifikaMetrics.uniqueParticipants;
  const maoriPct = total > 0 ? Math.round((maoriMetrics.uniqueParticipants / total) * 100) : 0;

  return {
    maori: maoriMetrics,
    pasifika: pasifikaMetrics,
    communitySplit: { maoriPercent: maoriPct, pasifikaPercent: total > 0 ? 100 - maoriPct : 0, totalParticipants: total },
  };
}

export async function getTamakiOraAlignment(filters: ReportFilters) {
  const maoriFilters = { ...filters, communityLens: "maori" as const };
  const maoriIds = await getCommunityLensContactIds(maoriFilters);
  const empty = {
    whaiRawaOra: { contactsInBusinessProgrammes: 0, fundingMilestones: 0, stageProgressions: 0 },
    teHaporiOra: { contactsInCommunityEvents: 0, rangatahiCount: 0, repeatEngagementRate: 0, activeGroupsWithMaori: 0 },
    huatauOra: { rangatahiInInnovation: 0, newVentureMilestones: 0, averageMindsetShift: 0 },
  };
  if (!maoriIds || maoriIds.size === 0) return empty;

  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);
  const where = confirmedDebriefWhere(filters);

  const allProgs = await db.select({
    id: programmes.id,
    classification: programmes.classification,
    attendees: programmes.attendees,
  }).from(programmes).where(and(
    eq(programmes.userId, filters.userId), gte(programmes.startDate, start), lte(programmes.startDate, end),
  ));

  const bizClass = ["business", "entrepreneurship", "enterprise", "startup"];
  const innovClass = ["innovation", "youth", "rangatahi", "digital", "technology"];

  const maoriContactDetails = await db.select({
    id: contacts.id, age: contacts.age, metrics: contacts.metrics,
  }).from(contacts).where(and(
    eq(contacts.userId, filters.userId), inArray(contacts.id, Array.from(maoriIds)),
  ));
  const maoriMap = new Map(maoriContactDetails.map(c => [c.id, c]));

  let contactsInBiz = 0, rangatahiInInnovation = 0;
  const bizSet = new Set<number>();
  for (const p of allProgs) {
    if (!p.attendees) continue;
    const isBiz = bizClass.some(bc => p.classification.toLowerCase().includes(bc));
    const isInnov = innovClass.some(ic => p.classification.toLowerCase().includes(ic));
    for (const aid of p.attendees) {
      if (!maoriIds.has(aid)) continue;
      if (isBiz && !bizSet.has(aid)) { bizSet.add(aid); contactsInBiz++; }
      if (isInnov) { const c = maoriMap.get(aid); if (c && c.age != null && c.age < 25) rangatahiInInnovation++; }
    }
  }

  const allMiles = await db.select({
    id: milestones.id,
    linkedContactId: milestones.linkedContactId,
    milestoneType: milestones.milestoneType,
  }).from(milestones).where(and(
    eq(milestones.userId, filters.userId), gte(milestones.createdAt, start), lte(milestones.createdAt, end),
  ));

  let fundingMilestones = 0, newVentureMilestones = 0;
  for (const m of allMiles) {
    if (!m.linkedContactId || !maoriIds.has(m.linkedContactId)) continue;
    if (["funding_secured", "revenue_milestone"].includes(m.milestoneType || "")) fundingMilestones++;
    if (["business_launched", "prototype_completed"].includes(m.milestoneType || "")) newVentureMilestones++;
  }

  const stageHist = await db.select({
    entityId: relationshipStageHistory.entityId,
    previousStage: relationshipStageHistory.previousStage,
    newStage: relationshipStageHistory.newStage,
  }).from(relationshipStageHistory).where(and(
    eq(relationshipStageHistory.entityType, "contact"),
    gte(relationshipStageHistory.changedAt, start), lte(relationshipStageHistory.changedAt, end),
  ));

  let stageProgressions = 0;
  const stageOrder = ["new", "engaged", "active", "deepening", "partner", "alumni"];
  for (const sh of stageHist) {
    if (!maoriIds.has(sh.entityId)) continue;
    const prevIdx = sh.previousStage ? stageOrder.indexOf(sh.previousStage) : -1;
    if (stageOrder.indexOf(sh.newStage) > prevIdx) stageProgressions++;
  }

  const evtIds = (await db.select({ id: events.id }).from(events).where(and(
    eq(events.userId, filters.userId), gte(events.startTime, start), lte(events.startTime, end),
  ))).map(e => e.id);

  let contactsInEvents = 0;
  if (evtIds.length > 0) {
    const att = await db.select({ contactId: eventAttendance.contactId }).from(eventAttendance)
      .where(inArray(eventAttendance.eventId, evtIds));
    const maoriAtt = new Set<number>();
    for (const a of att) { if (maoriIds.has(a.contactId)) maoriAtt.add(a.contactId); }
    contactsInEvents = maoriAtt.size;
  }

  let rangatahiCount = 0;
  for (const c of maoriContactDetails) { if (c.age != null && c.age < 25) rangatahiCount++; }

  const engagedContacts = await db
    .select({ contactId: impactLogContacts.contactId, cnt: count() })
    .from(impactLogContacts)
    .innerJoin(impactLogs, eq(impactLogContacts.impactLogId, impactLogs.id))
    .where(where)
    .groupBy(impactLogContacts.contactId);
  const maoriEngaged = engagedContacts.filter(r => maoriIds.has(r.contactId));
  const maoriRepeat = maoriEngaged.filter(r => safeNum(r.cnt) >= 2).length;
  const repeatRate = maoriEngaged.length > 0 ? Math.round((maoriRepeat / maoriEngaged.length) * 100) : 0;

  let activeGroupsWithMaori = 0;
  const maoriArr = Array.from(maoriIds);
  if (maoriArr.length > 0) {
    const grpRows = await db.selectDistinct({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(and(eq(groups.userId, filters.userId), eq(groups.active, true), inArray(groupMembers.contactId, maoriArr)));
    activeGroupsWithMaori = grpRows.length;
  }

  const mindsetVals: number[] = [];
  for (const c of maoriContactDetails) {
    const m = c.metrics as any;
    if (m?.mindset != null) mindsetVals.push(m.mindset);
  }
  const avgMindset = mindsetVals.length > 0
    ? Math.round((mindsetVals.reduce((a, b) => a + b, 0) / mindsetVals.length) * 10) / 10
    : 0;

  return {
    whaiRawaOra: { contactsInBusinessProgrammes: contactsInBiz, fundingMilestones, stageProgressions },
    teHaporiOra: { contactsInCommunityEvents: contactsInEvents, rangatahiCount, repeatEngagementRate: repeatRate, activeGroupsWithMaori },
    huatauOra: { rangatahiInInnovation, newVentureMilestones, averageMindsetShift: avgMindset },
  };
}

export async function getMentoringMetrics(filters: ReportFilters) {
  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);
  const lensIds = await getCommunityLensContactIds(filters);
  const MENTORING_TYPES = await getMentoringTypeNames(filters.userId);

  const allRows = await db.select({
    id: meetings.id,
    contactId: meetings.contactId,
    type: meetings.type,
    status: meetings.status,
    duration: meetings.duration,
    bookingSource: meetings.bookingSource,
    mentoringFocus: meetings.mentoringFocus,
    interactionId: meetings.interactionId,
    startTime: meetings.startTime,
  }).from(meetings).where(and(
    eq(meetings.userId, filters.userId),
    inArray(meetings.type, MENTORING_TYPES),
    gte(meetings.startTime, start),
    lte(meetings.startTime, end),
  ));

  const mentoringMeetings = lensIds
    ? allRows.filter(m => m.contactId && lensIds.has(m.contactId))
    : allRows;

  const delivered = mentoringMeetings.filter(m => m.status === "completed");
  const totalSessions = mentoringMeetings.length;
  const completedSessions = delivered.length;
  const totalHours = Math.round(delivered.reduce((s, m) => s + (m.duration || 30), 0) / 60 * 10) / 10;

  const menteeIds = new Set(mentoringMeetings.map(m => m.contactId).filter(Boolean) as number[]);
  const uniqueMentees = menteeIds.size;
  const avgSessionsPerMentee = uniqueMentees > 0 ? Math.round((totalSessions / uniqueMentees) * 10) / 10 : 0;

  let newMentees = 0;
  const contactIds = Array.from(menteeIds);
  if (contactIds.length > 0) {
    const firstSessions = await db.select({
      contactId: meetings.contactId,
      firstSession: sql<Date>`MIN(${meetings.startTime})`.as("first_session"),
    }).from(meetings).where(and(
      eq(meetings.userId, filters.userId),
      inArray(meetings.type, MENTORING_TYPES),
      inArray(meetings.contactId, contactIds),
    )).groupBy(meetings.contactId);

    for (const row of firstSessions) {
      const d = new Date(row.firstSession);
      if (d >= start && d <= end) newMentees++;
    }
  }

  const bySource: Record<string, number> = {};
  for (const m of mentoringMeetings) {
    const s = m.bookingSource || "internal";
    bySource[s] = (bySource[s] || 0) + 1;
  }

  const FOCUS_LABELS: Record<string, string> = {
    general: "General", strategy: "Strategy", wellbeing: "Wellbeing",
    skills: "Skills Development", "skills development": "Skills Development", skills_development: "Skills Development",
    business: "Business", career: "Career", leadership: "Leadership",
    innovation: "Innovation", community: "Community", creative: "Creative",
    financial: "Financial", digital: "Digital", unspecified: "Unspecified",
  };
  const byFocus: Record<string, number> = {};
  for (const m of mentoringMeetings) {
    const raw = (m.mentoringFocus || "unspecified").trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
    const label = FOCUS_LABELS[raw] || raw.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    byFocus[label] = (byFocus[label] || 0) + 1;
  }

  const completedCount = mentoringMeetings.filter(m => m.status === "completed").length;
  const cancelledCount = mentoringMeetings.filter(m => m.status === "cancelled").length;
  const noShowCount = mentoringMeetings.filter(m => m.status === "no-show").length;
  const resolved = completedCount + cancelledCount + noShowCount;
  const completionRate = resolved > 0 ? Math.round((completedCount / resolved) * 100) : 0;
  const withInteraction = mentoringMeetings.filter(m => m.status === "completed" && m.interactionId != null).length;
  const debriefRate = completedCount > 0 ? Math.round((withInteraction / completedCount) * 100) : 0;

  return { totalSessions, completedSessions, totalHours, uniqueMentees, avgSessionsPerMentee, newMentees, bySource, byFocus, completionRate, debriefRate };
}

export async function getOrganisationsEngaged(filters: ReportFilters) {
  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);

  const debriefContactIds = await db
    .selectDistinct({ contactId: impactLogContacts.contactId })
    .from(impactLogContacts)
    .innerJoin(impactLogs, eq(impactLogContacts.impactLogId, impactLogs.id))
    .where(confirmedDebriefWhere(filters));

  const mtgRows = await db.select({ contactId: meetings.contactId }).from(meetings).where(and(
    eq(meetings.userId, filters.userId),
    inArray(meetings.status, ["completed", "confirmed"]),
    gte(meetings.startTime, start), lte(meetings.startTime, end),
  ));

  const evtIds = (await db.select({ id: events.id }).from(events).where(and(
    eq(events.userId, filters.userId), eq(events.eventStatus, "active"),
    gte(events.startTime, start), lte(events.startTime, end),
  ))).map(e => e.id);

  let evtContactIds: { contactId: number }[] = [];
  if (evtIds.length > 0) {
    evtContactIds = await db.selectDistinct({ contactId: eventAttendance.contactId })
      .from(eventAttendance).where(inArray(eventAttendance.eventId, evtIds));
  }

  const bkgRows = await db.select({ bookerId: bookings.bookerId, attendees: bookings.attendees }).from(bookings).where(and(
    eq(bookings.userId, filters.userId),
    inArray(bookings.status, ["confirmed", "completed"]),
    gte(bookings.startDate, start), lte(bookings.startDate, end),
  ));

  const progRows = await db.select({ attendees: programmes.attendees }).from(programmes).where(and(
    eq(programmes.userId, filters.userId),
    inArray(programmes.status, ["active", "completed"]),
    gte(programmes.startDate, start), lte(programmes.startDate, end),
  ));

  const engagedCIds = new Set<number>();
  for (const r of debriefContactIds) if (r.contactId) engagedCIds.add(r.contactId);
  for (const r of mtgRows) if (r.contactId) engagedCIds.add(r.contactId);
  for (const r of evtContactIds) if (r.contactId) engagedCIds.add(r.contactId);
  for (const b of bkgRows) {
    if (b.bookerId) engagedCIds.add(b.bookerId);
    if (b.attendees) for (const a of b.attendees) engagedCIds.add(a);
  }
  for (const p of progRows) { if (p.attendees) for (const a of p.attendees) engagedCIds.add(a); }

  const snapRows = await db.select({ id: monthlySnapshots.id }).from(monthlySnapshots).where(and(
    eq(monthlySnapshots.userId, filters.userId), gte(monthlySnapshots.month, start), lte(monthlySnapshots.month, end),
  ));
  const snapIds = snapRows.map(s => s.id);
  const touchpointGroupIds = new Set<number>();
  if (snapIds.length > 0) {
    const ftRows = await db.select({ contactId: footTrafficTouchpoints.contactId, groupId: footTrafficTouchpoints.groupId })
      .from(footTrafficTouchpoints).where(inArray(footTrafficTouchpoints.snapshotId, snapIds));
    for (const t of ftRows) {
      if (t.contactId) engagedCIds.add(t.contactId);
      if (t.groupId) touchpointGroupIds.add(t.groupId);
    }
  }

  if (engagedCIds.size === 0 && touchpointGroupIds.size === 0) return [];

  const engagedArr = Array.from(engagedCIds);
  const memberRows = engagedArr.length > 0
    ? await db.select({ groupId: groupMembers.groupId, contactId: groupMembers.contactId })
        .from(groupMembers).where(inArray(groupMembers.contactId, engagedArr))
    : [];

  const groupIds = new Set(memberRows.map(r => r.groupId));
  Array.from(touchpointGroupIds).forEach(gid => groupIds.add(gid));

  const newGrps = await db.select({ id: groups.id }).from(groups).where(and(
    eq(groups.userId, filters.userId), gte(groups.createdAt, start), lte(groups.createdAt, end),
  ));
  for (const g of newGrps) groupIds.add(g.id);

  if (groupIds.size === 0) return [];

  const groupDetails = await db.select({
    id: groups.id,
    name: groups.name,
    type: groups.type,
    isCommunity: groups.isCommunity,
    isInnovator: groups.isInnovator,
    createdAt: groups.createdAt,
  }).from(groups).where(inArray(groups.id, Array.from(groupIds)));

  const allMembers = await db.select({ groupId: groupMembers.groupId, contactId: groupMembers.contactId })
    .from(groupMembers).where(inArray(groupMembers.groupId, Array.from(groupIds)));

  const membersPerGroup = new Map<number, number>();
  const engagedPerGroup = new Map<number, number>();
  for (const r of allMembers) {
    membersPerGroup.set(r.groupId, (membersPerGroup.get(r.groupId) || 0) + 1);
    if (engagedCIds.has(r.contactId)) {
      engagedPerGroup.set(r.groupId, (engagedPerGroup.get(r.groupId) || 0) + 1);
    }
  }

  return groupDetails.map(g => {
    const isNew = g.createdAt && g.createdAt >= start && g.createdAt <= end;
    const context = isNew ? "New this period" : g.isInnovator ? "Innovator" : g.isCommunity ? "Community member" : "Contact";
    return {
      id: g.id,
      name: g.name,
      type: g.type || "Other",
      context,
      engagedMembers: engagedPerGroup.get(g.id) || 0,
      totalMembers: membersPerGroup.get(g.id) || 0,
    };
  }).sort((a, b) => b.engagedMembers - a.engagedMembers);
}

export async function getPeopleFeatured(filters: ReportFilters) {
  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);
  const lensIds = await getCommunityLensContactIds(filters);

  const debriefContactRows = await db
    .select({ contactId: impactLogContacts.contactId, impactLogId: impactLogContacts.impactLogId })
    .from(impactLogContacts)
    .innerJoin(impactLogs, eq(impactLogContacts.impactLogId, impactLogs.id))
    .where(confirmedDebriefWhere(filters));

  const contactDebriefCount = new Map<number, number>();
  for (const r of debriefContactRows) {
    if (lensIds && !lensIds.has(r.contactId)) continue;
    contactDebriefCount.set(r.contactId, (contactDebriefCount.get(r.contactId) || 0) + 1);
  }

  let milestonesInRange = await db.select({
    id: milestones.id,
    linkedContactId: milestones.linkedContactId,
    title: milestones.title,
  }).from(milestones).where(and(
    eq(milestones.userId, filters.userId), gte(milestones.createdAt, start), lte(milestones.createdAt, end),
  ));
  if (lensIds) milestonesInRange = milestonesInRange.filter(m => m.linkedContactId && lensIds.has(m.linkedContactId));

  const contactMilestones = new Map<number, string[]>();
  for (const m of milestonesInRange) {
    if (!m.linkedContactId) continue;
    if (!contactMilestones.has(m.linkedContactId)) contactMilestones.set(m.linkedContactId, []);
    contactMilestones.get(m.linkedContactId)!.push(m.title);
  }

  const userCIds = (await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.userId, filters.userId))).map(c => c.id);
  const stageHist = userCIds.length > 0
    ? await db.select({
        entityId: relationshipStageHistory.entityId,
        previousStage: relationshipStageHistory.previousStage,
        newStage: relationshipStageHistory.newStage,
      }).from(relationshipStageHistory).where(and(
        eq(relationshipStageHistory.entityType, "contact"),
        inArray(relationshipStageHistory.entityId, userCIds),
        gte(relationshipStageHistory.changedAt, start), lte(relationshipStageHistory.changedAt, end),
      ))
    : [];

  const JOURNEY_ORDER = ["kakano", "tipu", "ora"];
  const contactJourney = new Map<number, { from: string; to: string }>();
  for (const sh of stageHist) {
    if (lensIds && !lensIds.has(sh.entityId)) continue;
    const prevIdx = sh.previousStage ? JOURNEY_ORDER.indexOf(sh.previousStage) : -1;
    const newIdx = JOURNEY_ORDER.indexOf(sh.newStage);
    if (newIdx > prevIdx && newIdx >= 0) {
      contactJourney.set(sh.entityId, { from: sh.previousStage || "new", to: sh.newStage });
    }
  }

  const allCList = await db.select({ id: contacts.id, movedToInnovatorsAt: contacts.movedToInnovatorsAt })
    .from(contacts).where(eq(contacts.userId, filters.userId));
  const newInnovatorIds = new Set<number>();
  for (const c of allCList) {
    if (c.movedToInnovatorsAt && c.movedToInnovatorsAt >= start && c.movedToInnovatorsAt <= end) {
      if (!lensIds || lensIds.has(c.id)) newInnovatorIds.add(c.id);
    }
  }

  const snapRows = await db.select({ id: monthlySnapshots.id }).from(monthlySnapshots).where(and(
    eq(monthlySnapshots.userId, filters.userId), gte(monthlySnapshots.month, start), lte(monthlySnapshots.month, end),
  ));
  const snapIds = snapRows.map(s => s.id);
  const contactTouchpointReasons = new Map<number, string[]>();
  if (snapIds.length > 0) {
    const ftRows = await db.select({ contactId: footTrafficTouchpoints.contactId, description: footTrafficTouchpoints.description })
      .from(footTrafficTouchpoints).where(inArray(footTrafficTouchpoints.snapshotId, snapIds));
    for (const t of ftRows) {
      if (!t.contactId) continue;
      if (lensIds && !lensIds.has(t.contactId)) continue;
      if (!contactTouchpointReasons.has(t.contactId)) contactTouchpointReasons.set(t.contactId, []);
      contactTouchpointReasons.get(t.contactId)!.push(`Foot traffic note: ${t.description}`);
    }
  }

  const featuredIds = new Set<number>();
  Array.from(contactDebriefCount.keys()).forEach(id => featuredIds.add(id));
  Array.from(contactMilestones.keys()).forEach(id => featuredIds.add(id));
  Array.from(contactJourney.keys()).forEach(id => featuredIds.add(id));
  Array.from(newInnovatorIds).forEach(id => featuredIds.add(id));
  Array.from(contactTouchpointReasons.keys()).forEach(id => featuredIds.add(id));

  if (featuredIds.size === 0) return [];

  const cDetails = await db.select({
    id: contacts.id,
    name: contacts.name,
    role: contacts.role,
    stage: contacts.stage,
    metrics: contacts.metrics,
    isInnovator: contacts.isInnovator,
    isCommunityMember: contacts.isCommunityMember,
  }).from(contacts).where(and(
    eq(contacts.userId, filters.userId),
    inArray(contacts.id, Array.from(featuredIds)),
  ));

  return cDetails.map(c => {
    const reasons: string[] = [];
    const debriefs = contactDebriefCount.get(c.id);
    if (debriefs) reasons.push(`${debriefs} debrief${debriefs > 1 ? "s" : ""}`);
    const mils = contactMilestones.get(c.id);
    if (mils) reasons.push(`Milestone${mils.length > 1 ? "s" : ""}: ${mils.slice(0, 2).join(", ")}`);
    const journey = contactJourney.get(c.id);
    if (journey) reasons.push(`Stage: ${journey.from} \u2192 ${journey.to}`);
    if (newInnovatorIds.has(c.id)) reasons.push("New innovator");
    const tpNotes = contactTouchpointReasons.get(c.id);
    if (tpNotes) reasons.push(...tpNotes.slice(0, 3));

    const m = c.metrics as any;
    const growthScores = m ? { mindset: m.mindset ?? null, skill: m.skill ?? null, confidence: m.confidence ?? null } : null;

    return {
      id: c.id,
      name: c.name || "",
      role: c.role || null,
      stage: c.stage || null,
      isInnovator: c.isInnovator || false,
      reasons,
      growthScores,
    };
  }).sort((a, b) => b.reasons.length - a.reasons.length);
}

export async function getJourneyStageProgression(filters: ReportFilters) {
  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);
  const lensIds = await getCommunityLensContactIds(filters);
  const STAGE_ORDER = ["kakano", "tipu", "ora"];

  const allContacts = await db.select({
    id: contacts.id,
    stage: contacts.stage,
    stageProgression: contacts.stageProgression,
  }).from(contacts).where(eq(contacts.userId, filters.userId));

  const filtered = lensIds ? allContacts.filter(c => lensIds.has(c.id)) : allContacts;

  const transitionMap = new Map<string, number>();
  let totalProgressions = 0;

  for (const c of filtered) {
    const prog = c.stageProgression as Array<{ stage: string; date: string; notes?: string }> | null;
    if (!prog || !Array.isArray(prog)) continue;
    const sorted = [...prog].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    for (let i = 1; i < sorted.length; i++) {
      const d = new Date(sorted[i].date);
      if (d >= start && d <= end) {
        const fromIdx = STAGE_ORDER.indexOf(sorted[i - 1].stage);
        const toIdx = STAGE_ORDER.indexOf(sorted[i].stage);
        if (toIdx > fromIdx) {
          const key = `${sorted[i - 1].stage}\u2192${sorted[i].stage}`;
          transitionMap.set(key, (transitionMap.get(key) || 0) + 1);
          totalProgressions++;
        }
      }
    }
  }

  const transitions = Array.from(transitionMap.entries()).map(([key, cnt]) => {
    const [from, to] = key.split("\u2192");
    return { from, to, count: cnt };
  });

  const currentDistribution: Record<string, number> = { kakano: 0, tipu: 0, ora: 0 };
  for (const c of filtered) {
    const stage = c.stage || "kakano";
    if (stage in currentDistribution) currentDistribution[stage]++;
  }

  return { transitions, totalProgressions, currentDistribution };
}

export async function getCommunityDiscounts(filters: ReportFilters) {
  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);

  const rows = await db.select({
    amount: bookings.amount,
    discountPercentage: bookings.discountPercentage,
    discountAmount: bookings.discountAmount,
  }).from(bookings).where(and(
    eq(bookings.userId, filters.userId),
    inArray(bookings.status, ["confirmed", "completed"]),
    gte(bookings.startDate, start),
    lte(bookings.startDate, end),
  ));

  let totalDiscountValue = 0, discountedCount = 0, totalPct = 0;
  for (const b of rows) {
    const pct = safeNum(b.discountPercentage);
    const amt = safeNum(b.discountAmount);
    const bAmt = safeNum(b.amount);
    if (pct > 0 || amt > 0) {
      discountedCount++;
      totalPct += pct;
      totalDiscountValue += amt > 0 ? amt : (pct > 0 && bAmt > 0 ? Math.round(bAmt * pct) / 100 : 0);
    }
  }

  return {
    totalDiscountValue: Math.round(totalDiscountValue * 100) / 100,
    discountedBookingsCount: discountedCount,
    averageDiscountPercent: discountedCount > 0 ? Math.round(totalPct / discountedCount) : 0,
  };
}

export async function getConnectionStrengthDistribution(filters: ReportFilters) {
  const lensIds = await getCommunityLensContactIds(filters);
  const LEVELS = ["known", "connected", "engaged", "embedded", "partnering"];
  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);

  const allContacts = await db.select({
    id: contacts.id,
    connectionStrength: contacts.connectionStrength,
  }).from(contacts).where(eq(contacts.userId, filters.userId));

  const filtered = lensIds ? allContacts.filter(c => lensIds.has(c.id)) : allContacts;

  const distMap = new Map<string, number>();
  for (const l of LEVELS) distMap.set(l, 0);
  for (const c of filtered) {
    const s = c.connectionStrength || "known";
    distMap.set(s, (distMap.get(s) || 0) + 1);
  }

  const userContactIds = new Set(allContacts.map(c => c.id));

  const stageHistory = await db.select({
    entityId: relationshipStageHistory.entityId,
    previousStage: relationshipStageHistory.previousStage,
    newStage: relationshipStageHistory.newStage,
  }).from(relationshipStageHistory).where(and(
    eq(relationshipStageHistory.entityType, "contact"),
    gte(relationshipStageHistory.changedAt, start),
    lte(relationshipStageHistory.changedAt, end),
  ));

  const transitionPeopleMap = new Map<string, Set<number>>();
  const deepenedIds = new Set<number>();
  const declinedIds = new Set<number>();

  for (const sh of stageHistory) {
    if (!userContactIds.has(sh.entityId)) continue;
    if (lensIds && !lensIds.has(sh.entityId)) continue;
    const from = sh.previousStage;
    const to = sh.newStage;
    if (!from || !LEVELS.includes(from) || !LEVELS.includes(to)) continue;
    if (from === to) continue;
    const fromIdx = LEVELS.indexOf(from);
    const toIdx = LEVELS.indexOf(to);
    const key = `${from}→${to}`;
    if (!transitionPeopleMap.has(key)) transitionPeopleMap.set(key, new Set());
    transitionPeopleMap.get(key)!.add(sh.entityId);
    if (toIdx > fromIdx) deepenedIds.add(sh.entityId);
    if (toIdx < fromIdx) declinedIds.add(sh.entityId);
  }

  const transitions: { from: string; to: string; count: number; direction: "up" | "down" }[] = [];
  for (const [key, peopleSet] of transitionPeopleMap.entries()) {
    const [from, to] = key.split("→");
    const fromIdx = LEVELS.indexOf(from);
    const toIdx = LEVELS.indexOf(to);
    const direction = toIdx > fromIdx ? "up" as const : "down" as const;
    transitions.push({ from, to, count: peopleSet.size, direction });
  }

  transitions.sort((a, b) => b.count - a.count);

  return {
    distribution: LEVELS.map(s => ({ strength: s, count: distMap.get(s) || 0 })),
    total: filtered.length,
    movements: {
      transitions,
      totalDeepened: deepenedIds.size,
      totalDeclined: declinedIds.size,
      summary: buildMovementSummary(deepenedIds.size, transitions),
    },
  };
}

function buildMovementSummary(totalDeepened: number, transitions: { from: string; to: string; count: number; direction: "up" | "down" }[]): string {
  const upMoves = transitions.filter(t => t.direction === "up");
  if (upMoves.length === 0 || totalDeepened === 0) return "";
  const details = upMoves
    .sort((a, b) => b.count - a.count)
    .map(t => `${t.count} moved from ${t.from} to ${t.to}`)
    .join(", ");
  return `${totalDeepened} people deepened their connection — ${details}`;
}

export async function getSurveyAggregation(filters: ReportFilters) {
  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);

  const sentSurveys = await db.select().from(surveys).where(
    and(
      eq(surveys.userId, filters.userId),
      gte(surveys.createdAt, start),
      lte(surveys.createdAt, end),
    )
  );

  const completedInPeriod = await db.select().from(surveys).where(
    and(
      eq(surveys.userId, filters.userId),
      eq(surveys.status, "completed"),
      gte(surveys.completedAt, start),
      lte(surveys.completedAt, end),
    )
  );

  const allSurveyIds = new Set([...sentSurveys.map(s => s.id), ...completedInPeriod.map(s => s.id)]);
  const allSurveys = [...sentSurveys];
  for (const s of completedInPeriod) {
    if (!allSurveyIds.has(s.id) || !sentSurveys.some(ss => ss.id === s.id)) {
      allSurveys.push(s);
    }
  }

  const growthSurveys = allSurveys.filter(s => s.surveyType === "growth");
  const postBookingSurveys = allSurveys.filter(s => s.surveyType === "post_booking");

  const completedGrowth = allSurveys.filter(s => s.surveyType === "growth" && s.status === "completed" && s.responses && s.responses.length > 0 && s.completedAt && s.completedAt >= start && s.completedAt <= end);
  const completedPostBooking = allSurveys.filter(s => s.surveyType === "post_booking" && s.status === "completed" && s.responses && s.responses.length > 0 && s.completedAt && s.completedAt >= start && s.completedAt <= end);

  const aggregateResponses = (completed: typeof allSurveys) => {
    const questionMap = new Map<string, { questionId: number; question: string; type: string; values: number[]; textAnswers: string[] }>();

    for (const survey of completed) {
      const questions = survey.questions || [];
      const responses = survey.responses || [];

      for (const resp of responses) {
        const qDef = questions.find(q => q.id === resp.questionId);
        if (!qDef) continue;

        const compositeKey = `${qDef.question.trim().toLowerCase()}::${qDef.type}`;

        if (!questionMap.has(compositeKey)) {
          questionMap.set(compositeKey, {
            questionId: resp.questionId,
            question: qDef.question,
            type: qDef.type,
            values: [],
            textAnswers: [],
          });
        }

        const entry = questionMap.get(compositeKey)!;
        if (typeof resp.answer === "number") {
          entry.values.push(resp.answer);
        } else if (typeof resp.answer === "string") {
          const numVal = Number(resp.answer);
          if (!isNaN(numVal) && (qDef.type === "rating" || qDef.type === "scale" || qDef.type === "number")) {
            entry.values.push(numVal);
          } else if (resp.answer.trim()) {
            entry.textAnswers.push(resp.answer.trim());
          }
        }
      }
    }

    return Array.from(questionMap.values()).map(data => ({
      questionId: data.questionId,
      question: data.question,
      type: data.type,
      averageRating: data.values.length > 0 ? Math.round((data.values.reduce((a, b) => a + b, 0) / data.values.length) * 10) / 10 : null,
      responseCount: data.values.length + data.textAnswers.length,
      sampleTextAnswers: data.textAnswers.slice(0, 5),
    }));
  };

  const growthAggregated = aggregateResponses(completedGrowth);
  const postBookingAggregated = aggregateResponses(completedPostBooking);

  const postBookingRatings = postBookingAggregated.filter(q => q.averageRating !== null);
  const overallSatisfaction = postBookingRatings.length > 0
    ? Math.round((postBookingRatings.reduce((s, q) => s + (q.averageRating || 0), 0) / postBookingRatings.length) * 10) / 10
    : null;

  return {
    growth: {
      totalSent: growthSurveys.length,
      totalCompleted: completedGrowth.length,
      completionRate: growthSurveys.length > 0 ? Math.round((completedGrowth.length / growthSurveys.length) * 100) : 0,
      aggregatedQuestions: growthAggregated,
    },
    postBooking: {
      totalSent: postBookingSurveys.length,
      totalCompleted: completedPostBooking.length,
      completionRate: postBookingSurveys.length > 0 ? Math.round((completedPostBooking.length / postBookingSurveys.length) * 100) : 0,
      overallSatisfaction,
      aggregatedQuestions: postBookingAggregated,
    },
    totalCompletedSurveys: completedGrowth.length + completedPostBooking.length,
    totalSent: allSurveys.length,
  };
}

export interface TrendPeriodMetrics {
  periodLabel: string;
  startDate: string;
  endDate: string;
  peopleReached: number;
  uniqueContacts: number;
  totalActivations: number;
  milestonesAchieved: number;
  communitySpend: number;
  repeatEngagementRate: number;
  communityHours: number;
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function generatePeriods(startDate: string, endDate: string, granularity: "monthly" | "quarterly"): { label: string; start: string; end: string }[] {
  const periods: { label: string; start: string; end: string }[] = [];
  const endDt = new Date(endDate);
  let cursor = new Date(startDate);

  if (granularity === "monthly") {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    while (cursor <= endDt) {
      const periodEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const label = `${SHORT_MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
      periods.push({
        label,
        start: formatLocalDate(cursor),
        end: formatLocalDate(periodEnd > endDt ? endDt : periodEnd),
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  } else {
    const getQuarterStart = (d: Date) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
    cursor = getQuarterStart(cursor);
    while (cursor <= endDt) {
      const q = Math.floor(cursor.getMonth() / 3) + 1;
      const periodEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 3, 0);
      const label = `Q${q} ${cursor.getFullYear()}`;
      periods.push({
        label,
        start: formatLocalDate(cursor),
        end: formatLocalDate(periodEnd > endDt ? endDt : periodEnd),
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 3, 1);
    }
  }

  return periods;
}

export async function getTrendMetrics(
  baseFilters: ReportFilters,
  granularity: "monthly" | "quarterly" = "monthly",
  periods?: number,
): Promise<TrendPeriodMetrics[]> {
  const maxPeriods = periods || (granularity === "monthly" ? 12 : 8);
  const endDt = new Date(baseFilters.endDate);
  let startDt: Date;

  if (granularity === "monthly") {
    startDt = new Date(endDt.getFullYear(), endDt.getMonth() - maxPeriods + 1, 1);
  } else {
    const qStart = new Date(endDt.getFullYear(), Math.floor(endDt.getMonth() / 3) * 3, 1);
    startDt = new Date(qStart.getFullYear(), qStart.getMonth() - (maxPeriods - 1) * 3, 1);
  }

  const allPeriods = generatePeriods(formatLocalDate(startDt), formatLocalDate(endDt), granularity);

  const results: TrendPeriodMetrics[] = [];

  for (const period of allPeriods) {
    const periodFilters: ReportFilters = {
      ...baseFilters,
      startDate: period.start,
      endDate: period.end,
    };

    const [reach, delivery, impact] = await Promise.all([
      getReachMetrics(periodFilters),
      getDeliveryMetrics(periodFilters),
      getImpactMetrics(periodFilters),
    ]);

    results.push({
      periodLabel: period.label,
      startDate: period.start,
      endDate: period.end,
      peopleReached: reach.peopleReached,
      uniqueContacts: reach.uniqueContacts,
      totalActivations: delivery.totalActivations,
      milestonesAchieved: impact.milestoneCount,
      communitySpend: impact.communitySpend,
      repeatEngagementRate: reach.repeatEngagementRate,
      communityHours: delivery.communityHours,
    });
  }

  return results;
}

export async function getProgrammeAttributedOutcomes(userId: string, programmeId?: number, startDate?: string, endDate?: string) {
  const progWhere = programmeId
    ? and(eq(programmes.userId, userId), eq(programmes.id, programmeId))
    : eq(programmes.userId, userId);

  let progRows = await db.select().from(programmes).where(progWhere);
  progRows = progRows.filter(p => p.status !== "cancelled");

  const start = startDate ? parseDate(startDate) : null;
  const end = endDate ? parseDate(endDate) : null;

  const CONNECTION_ORDER = ["known", "connected", "engaged", "embedded", "partnering"];
  const results = [];

  for (const prog of progRows) {
    const attendeeIds: number[] = prog.attendees && prog.attendees.length > 0 ? prog.attendees : [];

    let progMilestones: { id: number; title: string; milestoneType: string; valueAmount: string | null; linkedContactId: number | null }[] = [];
    if (attendeeIds.length > 0) {
      let milestoneConditions = and(
        eq(milestones.userId, userId),
        inArray(milestones.linkedContactId, attendeeIds),
      );
      if (start) milestoneConditions = and(milestoneConditions, gte(milestones.createdAt, start));
      if (end) milestoneConditions = and(milestoneConditions, lte(milestones.createdAt, end));

      progMilestones = await db.select({
        id: milestones.id,
        title: milestones.title,
        milestoneType: milestones.milestoneType,
        valueAmount: milestones.valueAmount,
        linkedContactId: milestones.linkedContactId,
      }).from(milestones).where(milestoneConditions!);
    }

    const directLinkedMilestones = await db.select({
      id: milestones.id,
      title: milestones.title,
      milestoneType: milestones.milestoneType,
      valueAmount: milestones.valueAmount,
      linkedContactId: milestones.linkedContactId,
    }).from(milestones).where(
      and(
        eq(milestones.userId, userId),
        eq(milestones.linkedProgrammeId, prog.id),
        start ? gte(milestones.createdAt, start) : undefined,
        end ? lte(milestones.createdAt, end) : undefined,
      )!
    );

    const allMilestoneIds = new Set<number>();
    const combinedMilestones = [];
    for (const m of [...progMilestones, ...directLinkedMilestones]) {
      if (!allMilestoneIds.has(m.id)) {
        allMilestoneIds.add(m.id);
        combinedMilestones.push(m);
      }
    }

    const totalMilestoneValue = combinedMilestones.reduce((s, m) => s + safeNum(m.valueAmount), 0);

    const growthScoreChanges: Record<string, { average: number; count: number }> = {};
    let averageGrowthImprovement = 0;
    const progressions = new Set<number>();
    const progressionDetails: { contactId: number; from: string; to: string }[] = [];

    if (attendeeIds.length > 0) {
      const contactMetrics = await db.select({
        id: contacts.id,
        metrics: contacts.metrics,
      }).from(contacts).where(
        and(eq(contacts.userId, userId), inArray(contacts.id, attendeeIds))
      );

      const metricArrays: Record<string, number[]> = {};
      for (const key of ALL_METRIC_KEYS) metricArrays[key] = [];
      for (const c of contactMetrics) {
        const m = c.metrics as any;
        if (!m || typeof m !== "object") continue;
        for (const key of ALL_METRIC_KEYS) {
          if (m[key] != null) metricArrays[key].push(m[key]);
        }
      }

      let totalGrowthSum = 0;
      let totalGrowthCount = 0;
      for (const key of ALL_METRIC_KEYS) {
        if (metricArrays[key].length > 0) {
          const avg = Math.round((metricArrays[key].reduce((a, b) => a + b, 0) / metricArrays[key].length) * 10) / 10;
          growthScoreChanges[key] = { average: avg, count: metricArrays[key].length };
          totalGrowthSum += avg;
          totalGrowthCount++;
        }
      }
      averageGrowthImprovement = totalGrowthCount > 0
        ? Math.round((totalGrowthSum / totalGrowthCount) * 10) / 10
        : 0;

      let stageHistConditions = and(
        eq(relationshipStageHistory.entityType, "contact"),
        inArray(relationshipStageHistory.entityId, attendeeIds),
      );
      if (start) stageHistConditions = and(stageHistConditions, gte(relationshipStageHistory.changedAt, start));
      if (end) stageHistConditions = and(stageHistConditions, lte(relationshipStageHistory.changedAt, end));

      const stageHist = await db.select({
        entityId: relationshipStageHistory.entityId,
        previousStage: relationshipStageHistory.previousStage,
        newStage: relationshipStageHistory.newStage,
      }).from(relationshipStageHistory).where(stageHistConditions!);

      for (const sh of stageHist) {
        const prevIdx = sh.previousStage ? CONNECTION_ORDER.indexOf(sh.previousStage) : -1;
        const newIdx = CONNECTION_ORDER.indexOf(sh.newStage);
        if (newIdx > prevIdx && newIdx >= 0) {
          progressions.add(sh.entityId);
          progressionDetails.push({
            contactId: sh.entityId,
            from: sh.previousStage || "none",
            to: sh.newStage,
          });
        }
      }
    }

    const milestoneValueStr = totalMilestoneValue > 0
      ? `$${Math.round(totalMilestoneValue).toLocaleString()}`
      : "$0";

    results.push({
      programmeId: prog.id,
      programmeName: prog.name,
      classification: prog.classification,
      status: prog.status,
      participantCount: attendeeIds.length,
      milestones: combinedMilestones,
      milestoneCount: combinedMilestones.length,
      totalMilestoneValue: Math.round(totalMilestoneValue * 100) / 100,
      growthScoreChanges,
      averageGrowthImprovement,
      stageProgressions: progressions.size,
      stageProgressionDetails: progressionDetails,
      summaryLine: `${prog.name}: ${attendeeIds.length} participants, ${combinedMilestones.length} milestones (${milestoneValueStr} value), avg growth +${averageGrowthImprovement} points`,
    });
  }

  return results;
}

export async function getFullMonthlyReport(filters: ReportFilters) {
  const [reach, delivery, impact, value, mentoring, organisationsEngaged, peopleFeatured, journeyProgression, communityDiscounts, connectionStrength, surveyData, programmeOutcomes] = await Promise.all([
    getReachMetrics(filters),
    getDeliveryMetrics(filters),
    getImpactMetrics(filters),
    getValueContribution(filters),
    getMentoringMetrics(filters),
    getOrganisationsEngaged(filters),
    getPeopleFeatured(filters),
    getJourneyStageProgression(filters),
    getCommunityDiscounts(filters),
    getConnectionStrengthDistribution(filters),
    getSurveyAggregation(filters),
    getProgrammeAttributedOutcomes(
      filters.userId,
      filters.programmeIds?.length === 1 ? filters.programmeIds[0] : undefined,
      filters.startDate,
      filters.endDate,
    ),
  ]);

  let relevantOutcomes = programmeOutcomes;
  if (filters.programmeIds && filters.programmeIds.length > 1) {
    const idSet = new Set(filters.programmeIds);
    relevantOutcomes = programmeOutcomes.filter((o: any) => idSet.has(o.programmeId));
  }

  const filteredOutcomes = relevantOutcomes.filter(
    (o: any) => o.milestoneCount > 0 || o.stageProgressions > 0 || o.averageGrowthImprovement > 0
  );

  const averageChange: Record<string, number> = {};
  const positiveMovement: Record<string, number> = {};
  for (const [key, val] of Object.entries(impact.growthMetrics || {})) {
    averageChange[key] = val.averageScore;
    positiveMovement[key] = val.positiveMovementPercent;
  }

  return {
    period: { startDate: filters.startDate, endDate: filters.endDate },
    filters: {
      programmeIds: filters.programmeIds,
      taxonomyIds: filters.taxonomyIds,
      demographicSegments: filters.demographicSegments,
      communityLens: filters.communityLens,
    },
    reach,
    delivery,
    impact,
    value,
    mentoring,
    organisationsEngaged,
    peopleFeatured,
    journeyProgression,
    communityDiscounts,
    connectionStrength,
    surveyData,
    programmeOutcomes: filteredOutcomes,
    engagement: reach,
    outcomes: {
      totalContacts: impact.contactsWithMetrics,
      contactsWithMetrics: impact.contactsWithMetrics,
      averageChange,
      positiveMovementPercent: positiveMovement,
      milestoneCount: impact.milestoneCount,
    },
    economicRollup: impact.economicRollup,
  };
}

export interface CohortDefinition {
  userId: string;
  programmeId?: number;
  startDate: string;
  endDate: string;
  contactIds?: number[];
}

export interface CohortMonthData {
  month: string;
  activeCount: number;
  retentionRate: number;
  cumulativeMilestones: number;
  stageBreakdown: Record<string, number>;
}

export interface CohortMetrics {
  label: string;
  cohortSize: number;
  contactIds: number[];
  retentionRate: number;
  milestoneAchievementRate: number;
  avgTimeToFirstMilestone: number | null;
  avgGrowthScoreImprovement: number;
  timeline: CohortMonthData[];
  keyStats: {
    totalMilestones: number;
    stageProgressions: number;
    avgBaselineGrowthScore: number;
    avgCurrentGrowthScore: number;
  };
}

function computeGrowthScore(metrics: any): number | null {
  if (!metrics || typeof metrics !== "object") return null;
  const keys = ["mindset", "skill", "confidence", "bizConfidence", "systemsInPlace", "fundingReadiness", "networkStrength", "communityImpact", "digitalPresence"];
  const vals = keys.map(k => metrics[k]).filter(v => v != null && typeof v === "number") as number[];
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export async function getCohortMetrics(def: CohortDefinition): Promise<CohortMetrics> {
  const startDate = parseDate(def.startDate);
  const endDate = parseDate(def.endDate);

  let cohortContactIds: number[] = [];
  let label = "Custom Cohort";

  if (def.contactIds && def.contactIds.length > 0) {
    const verified = await db.select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.userId, def.userId), inArray(contacts.id, def.contactIds)));
    cohortContactIds = verified.map(r => r.id);
    label = `Custom cohort (${cohortContactIds.length} people)`;
  } else if (def.programmeId) {
    const prog = await db.select({ id: programmes.id, name: programmes.name, attendees: programmes.attendees })
      .from(programmes)
      .where(and(eq(programmes.id, def.programmeId), eq(programmes.userId, def.userId)));
    if (prog.length > 0) {
      label = prog[0].name;
      const progAttendees = prog[0].attendees || [];

      const regs = await db.select({ contactId: programmeRegistrations.contactId })
        .from(programmeRegistrations)
        .where(and(
          eq(programmeRegistrations.programmeId, def.programmeId),
          eq(programmeRegistrations.userId, def.userId),
          gte(programmeRegistrations.registeredAt, startDate),
          lte(programmeRegistrations.registeredAt, endDate),
        ));
      const regContactIds = regs.map(r => r.contactId).filter(Boolean) as number[];
      const regSet = new Set(regContactIds);

      if (regSet.size > 0) {
        cohortContactIds = Array.from(regSet);
      } else {
        const attendeesInRange = await db.select({ id: contacts.id })
          .from(contacts)
          .where(and(
            eq(contacts.userId, def.userId),
            inArray(contacts.id, progAttendees.length > 0 ? progAttendees : [-1]),
            gte(contacts.createdAt, startDate),
            lte(contacts.createdAt, endDate),
          ));

        if (attendeesInRange.length > 0) {
          cohortContactIds = attendeesInRange.map(r => r.id);
        } else {
          cohortContactIds = progAttendees;
          label = `${prog[0].name} (all attendees)`;
        }
      }
    }
  } else {
    const cRows = await db.select({ id: contacts.id })
      .from(contacts)
      .where(and(
        eq(contacts.userId, def.userId),
        gte(contacts.createdAt, startDate),
        lte(contacts.createdAt, endDate),
      ));
    cohortContactIds = cRows.map(r => r.id);
    label = `Entered ${def.startDate} to ${def.endDate}`;
  }

  if (cohortContactIds.length === 0) {
    return {
      label,
      cohortSize: 0,
      contactIds: [],
      retentionRate: 0,
      milestoneAchievementRate: 0,
      avgTimeToFirstMilestone: null,
      avgGrowthScoreImprovement: 0,
      timeline: [],
      keyStats: { totalMilestones: 0, stageProgressions: 0, avgBaselineGrowthScore: 0, avgCurrentGrowthScore: 0 },
    };
  }

  const contactDetails = await db.select({
    id: contacts.id,
    metrics: contacts.metrics,
    stage: contacts.stage,
    stageProgression: contacts.stageProgression,
    lastActiveDate: contacts.lastActiveDate,
    createdAt: contacts.createdAt,
    active: contacts.active,
  }).from(contacts).where(and(eq(contacts.userId, def.userId), inArray(contacts.id, cohortContactIds)));

  cohortContactIds = contactDetails.map(c => c.id);
  const contactMap = new Map(contactDetails.map(c => [c.id, c]));

  const cohortMilestones = await db.select({
    id: milestones.id,
    linkedContactId: milestones.linkedContactId,
    createdAt: milestones.createdAt,
  }).from(milestones).where(and(
    eq(milestones.userId, def.userId),
    inArray(milestones.linkedContactId, cohortContactIds),
  ));

  const contactsWithMilestones = new Set(cohortMilestones.map(m => m.linkedContactId).filter(Boolean));
  const milestoneAchievementRate = cohortContactIds.length > 0
    ? Math.round((contactsWithMilestones.size / cohortContactIds.length) * 100)
    : 0;

  const firstMilestoneTimes: number[] = [];
  const milestonesByContact = new Map<number, Date[]>();
  for (const m of cohortMilestones) {
    if (!m.linkedContactId || !m.createdAt) continue;
    if (!milestonesByContact.has(m.linkedContactId)) milestonesByContact.set(m.linkedContactId, []);
    milestonesByContact.get(m.linkedContactId)!.push(m.createdAt);
  }
  for (const [cid, dates] of milestonesByContact) {
    const contact = contactMap.get(cid);
    if (!contact?.createdAt) continue;
    const sorted = dates.sort((a, b) => a.getTime() - b.getTime());
    const daysToFirst = Math.round((sorted[0].getTime() - contact.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    firstMilestoneTimes.push(Math.max(0, daysToFirst));
  }
  const avgTimeToFirstMilestone = firstMilestoneTimes.length > 0
    ? Math.round(firstMilestoneTimes.reduce((a, b) => a + b, 0) / firstMilestoneTimes.length)
    : null;

  const stageHistRows = await db.select({
    entityId: relationshipStageHistory.entityId,
    newStage: relationshipStageHistory.newStage,
    changedAt: relationshipStageHistory.changedAt,
  }).from(relationshipStageHistory).where(and(
    eq(relationshipStageHistory.entityType, "contact"),
    inArray(relationshipStageHistory.entityId, cohortContactIds),
    gte(relationshipStageHistory.changedAt, startDate),
    lte(relationshipStageHistory.changedAt, endDate),
  ));
  const stageProgressions = stageHistRows.length;

  const baselineSnapshots = await db.select({
    contactId: metricSnapshots.contactId,
    metrics: metricSnapshots.metrics,
    createdAt: metricSnapshots.createdAt,
  }).from(metricSnapshots).where(and(
    eq(metricSnapshots.userId, def.userId),
    inArray(metricSnapshots.contactId, cohortContactIds),
    lte(metricSnapshots.createdAt, endDate),
  ));

  const earliestSnapshotByContact = new Map<number, any>();
  const latestSnapshotByContact = new Map<number, any>();
  for (const snap of baselineSnapshots) {
    const existing = earliestSnapshotByContact.get(snap.contactId);
    if (!existing || (snap.createdAt && existing.createdAt && snap.createdAt < existing.createdAt)) {
      earliestSnapshotByContact.set(snap.contactId, snap);
    }
    const existingLatest = latestSnapshotByContact.get(snap.contactId);
    if (!existingLatest || (snap.createdAt && existingLatest.createdAt && snap.createdAt > existingLatest.createdAt)) {
      latestSnapshotByContact.set(snap.contactId, snap);
    }
  }

  const baselineScores: number[] = [];
  const currentScores: number[] = [];
  for (const c of contactDetails) {
    const baselineSnap = earliestSnapshotByContact.get(c.id);
    const latestSnap = latestSnapshotByContact.get(c.id);

    const baselineScore = baselineSnap ? computeGrowthScore(baselineSnap.metrics) : computeGrowthScore(c.metrics);
    const currentScore = latestSnap ? computeGrowthScore(latestSnap.metrics) : computeGrowthScore(c.metrics);

    if (baselineScore !== null) baselineScores.push(baselineScore);
    if (currentScore !== null) currentScores.push(currentScore);
  }

  const avgBaselineGrowthScore = baselineScores.length > 0
    ? Math.round((baselineScores.reduce((a, b) => a + b, 0) / baselineScores.length) * 10) / 10
    : 0;
  const avgCurrentGrowthScore = currentScores.length > 0
    ? Math.round((currentScores.reduce((a, b) => a + b, 0) / currentScores.length) * 10) / 10
    : 0;
  const avgGrowthScoreImprovement = Math.round((avgCurrentGrowthScore - avgBaselineGrowthScore) * 10) / 10;

  const stageHistByContactMonth = new Map<string, string>();
  for (const sh of stageHistRows) {
    if (!sh.changedAt) continue;
    const key = `${sh.entityId}-${sh.changedAt.getFullYear()}-${sh.changedAt.getMonth() + 1}`;
    const existing = stageHistByContactMonth.get(key);
    if (!existing) stageHistByContactMonth.set(key, sh.newStage);
  }

  const timelineCap = new Date(Math.min(new Date().getTime(), endDate.getTime()));
  const monthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const timeline: CohortMonthData[] = [];
  let currentMonth = new Date(monthStart);
  let cumulativeMilestones = 0;

  const contactStageAtMonth = new Map<number, string>();
  for (const c of contactDetails) {
    contactStageAtMonth.set(c.id, c.stageProgression && c.stageProgression.length > 0
      ? c.stageProgression[0].stage
      : (c.stage || "unknown"));
  }

  while (currentMonth <= timelineCap) {
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);
    const monthLabel = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;
    const monthNum = currentMonth.getMonth() + 1;
    const yearNum = currentMonth.getFullYear();

    for (const sh of stageHistRows) {
      if (!sh.changedAt) continue;
      if (sh.changedAt.getFullYear() === yearNum && sh.changedAt.getMonth() + 1 === monthNum) {
        contactStageAtMonth.set(sh.entityId, sh.newStage);
      }
    }

    let activeInMonth = 0;
    const stageBreakdown: Record<string, number> = {};

    for (const c of contactDetails) {
      if (c.createdAt && c.createdAt <= monthEnd) {
        const isActive = c.active !== false && (!c.lastActiveDate || c.lastActiveDate >= currentMonth || c.lastActiveDate >= new Date(yearNum, monthNum - 4, 1));
        if (isActive || !c.lastActiveDate) {
          activeInMonth++;
          const stage = contactStageAtMonth.get(c.id) || "unknown";
          stageBreakdown[stage] = (stageBreakdown[stage] || 0) + 1;
        }
      }
    }

    const milestonesInMonth = cohortMilestones.filter(m =>
      m.createdAt && m.createdAt >= currentMonth && m.createdAt <= monthEnd
    ).length;
    cumulativeMilestones += milestonesInMonth;

    timeline.push({
      month: monthLabel,
      activeCount: activeInMonth,
      retentionRate: cohortContactIds.length > 0 ? Math.round((activeInMonth / cohortContactIds.length) * 100) : 0,
      cumulativeMilestones,
      stageBreakdown,
    });

    currentMonth = new Date(yearNum, monthNum, 1);
  }

  const latestRetention = timeline.length > 0 ? timeline[timeline.length - 1].retentionRate : 0;

  return {
    label,
    cohortSize: cohortContactIds.length,
    contactIds: cohortContactIds,
    retentionRate: latestRetention,
    milestoneAchievementRate,
    avgTimeToFirstMilestone,
    avgGrowthScoreImprovement,
    timeline,
    keyStats: {
      totalMilestones: cohortMilestones.length,
      stageProgressions,
      avgBaselineGrowthScore,
      avgCurrentGrowthScore,
    },
  };
}
