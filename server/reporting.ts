import { db } from "./db";
import { sql, eq, ne, and, gte, lte, inArray, count, countDistinct, sum, avg } from "drizzle-orm";
import {
  impactLogs, impactLogContacts, impactLogGroups, impactTags, impactTaxonomy,
  contacts, groups, groupMembers, events, eventAttendance,
  programmes, programmeEvents, bookings, memberships, mous, venues,
  milestones, relationshipStageHistory, communitySpend, meetings, interactions,
  meetingTypes, monthlySnapshots, footTrafficTouchpoints, dailyFootTraffic,
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

export async function getCommunityLensContactIds(filters: ReportFilters): Promise<Set<number> | null> {
  const lens = filters.communityLens;
  if (!lens || lens === "all") return null;

  let targetEthnicities: string[];
  if (lens === "maori") {
    targetEthnicities = MAORI_ETHNICITIES;
  } else if (lens === "pasifika") {
    targetEthnicities = PASIFIKA_ETHNICITIES;
  } else {
    targetEthnicities = [...MAORI_ETHNICITIES, ...PASIFIKA_ETHNICITIES];
  }

  const matchingContacts = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(
      eq(contacts.userId, filters.userId),
      sql`${contacts.ethnicity} && ${sql`ARRAY[${sql.join(targetEthnicities.map(e => sql`${e}`), sql`, `)}]::text[]`}`,
    ));

  return new Set(matchingContacts.map(c => c.id));
}

function parseDate(d: string) { return new Date(d); }

function confirmedDebriefConditions(filters: ReportFilters) {
  const conditions = [
    eq(impactLogs.userId, filters.userId),
    eq(impactLogs.status, "confirmed"),
    gte(impactLogs.createdAt, parseDate(filters.startDate)),
    lte(impactLogs.createdAt, parseDate(filters.endDate)),
  ];
  if (filters.programmeIds?.length) {
    conditions.push(inArray(impactLogs.programmeId, filters.programmeIds));
  }
  return and(...conditions)!;
}

export async function getReachMetrics(filters: ReportFilters) {
  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);
  const lensContactIds = await getCommunityLensContactIds(filters);

  const contactTouchpoints = new Map<number, number>();
  function addTouchpoint(contactId: number | null | undefined) {
    if (contactId == null) return;
    if (lensContactIds && !lensContactIds.has(contactId)) return;
    contactTouchpoints.set(contactId, (contactTouchpoints.get(contactId) || 0) + 1);
  }

  const sourceBreakdown = { debriefs: 0, meetings: 0, events: 0, externalEvents: 0, emails: 0, bookings: 0, programmes: 0, touchpoints: 0 };

  const debriefWhere = confirmedDebriefConditions(filters);
  const debriefContacts = await db
    .select({ contactId: impactLogContacts.contactId })
    .from(impactLogContacts)
    .innerJoin(impactLogs, eq(impactLogContacts.impactLogId, impactLogs.id))
    .where(debriefWhere);
  for (const r of debriefContacts) { addTouchpoint(r.contactId); sourceBreakdown.debriefs++; }

  const meetingsInRange = await db.select().from(meetings).where(and(
    eq(meetings.userId, filters.userId),
    inArray(meetings.status, ["completed", "confirmed"]),
    gte(meetings.startTime, start), lte(meetings.startTime, end),
  ));
  for (const m of meetingsInRange) { addTouchpoint(m.contactId); sourceBreakdown.meetings++; }

  const eventsInRange = await db.select().from(events).where(and(
    eq(events.userId, filters.userId), eq(events.eventStatus, "active"),
    gte(events.startTime, start), lte(events.startTime, end),
  ));
  const eventIds = eventsInRange.map(e => e.id);
  let attendanceRows: { eventId: number; contactId: number }[] = [];
  if (eventIds.length > 0) {
    attendanceRows = await db.select({ eventId: eventAttendance.eventId, contactId: eventAttendance.contactId })
      .from(eventAttendance).where(inArray(eventAttendance.eventId, eventIds));
  }
  const eventTypeMap = new Map(eventsInRange.map(e => [e.id, e.type]));
  for (const a of attendanceRows) {
    addTouchpoint(a.contactId);
    const etype = eventTypeMap.get(a.eventId);
    if (etype === "External Event") { sourceBreakdown.externalEvents++; } else { sourceBreakdown.events++; }
  }

  const emailInteractions = await db.select({ contactId: interactions.contactId }).from(interactions)
    .innerJoin(contacts, eq(interactions.contactId, contacts.id))
    .where(and(
      eq(contacts.userId, filters.userId),
      eq(interactions.type, "Email"),
      gte(interactions.date, start), lte(interactions.date, end),
    ));
  for (const e of emailInteractions) { addTouchpoint(e.contactId); sourceBreakdown.emails++; }

  const bookingsInRange = await db.select().from(bookings).where(and(
    eq(bookings.userId, filters.userId),
    inArray(bookings.status, ["confirmed", "completed"]),
    gte(bookings.startDate, start), lte(bookings.startDate, end),
  ));
  for (const b of bookingsInRange) {
    addTouchpoint(b.bookerId);
    if (b.attendees) { for (const aid of b.attendees) addTouchpoint(aid); }
    sourceBreakdown.bookings++;
  }

  const programmesInRange = await db.select().from(programmes).where(and(
    eq(programmes.userId, filters.userId),
    inArray(programmes.status, ["active", "completed"]),
    gte(programmes.startDate, start), lte(programmes.startDate, end),
  ));
  for (const p of programmesInRange) {
    if (p.attendees) { for (const aid of p.attendees) addTouchpoint(aid); }
    sourceBreakdown.programmes++;
  }

  const snapshotsInRange = await db.select({ id: monthlySnapshots.id }).from(monthlySnapshots).where(and(
    eq(monthlySnapshots.userId, filters.userId),
    gte(monthlySnapshots.month, start), lte(monthlySnapshots.month, end),
  ));
  const snapshotIds = snapshotsInRange.map(s => s.id);
  if (snapshotIds.length > 0) {
    const touchpointRows = await db.select({ contactId: footTrafficTouchpoints.contactId })
      .from(footTrafficTouchpoints).where(inArray(footTrafficTouchpoints.snapshotId, snapshotIds));
    for (const t of touchpointRows) {
      if (t.contactId) { addTouchpoint(t.contactId); sourceBreakdown.touchpoints++; }
    }
  }

  const uniqueContacts = contactTouchpoints.size;
  const totalEngagements = Array.from(contactTouchpoints.values()).reduce((s, v) => s + v, 0);

  const dailyFTRows = await db.select({ count: count() }).from(dailyFootTraffic)
    .where(and(
      eq(dailyFootTraffic.userId, filters.userId),
      gte(dailyFootTraffic.date, start), lte(dailyFootTraffic.date, end),
    ));
  const hasDailyRows = Number(dailyFTRows[0]?.count || 0) > 0;
  let footTraffic = 0;
  if (hasDailyRows) {
    const dailyFTResult = await db
      .select({ total: sum(dailyFootTraffic.count) })
      .from(dailyFootTraffic)
      .where(and(
        eq(dailyFootTraffic.userId, filters.userId),
        gte(dailyFootTraffic.date, start), lte(dailyFootTraffic.date, end),
      ));
    footTraffic = Number(dailyFTResult[0]?.total || 0);
  } else {
    const legacyResult = await db
      .select({ total: sum(monthlySnapshots.footTraffic) })
      .from(monthlySnapshots)
      .where(and(
        eq(monthlySnapshots.userId, filters.userId),
        gte(monthlySnapshots.month, start), lte(monthlySnapshots.month, end),
      ));
    footTraffic = Number(legacyResult[0]?.total || 0);
  }

  const repeatCount = Array.from(contactTouchpoints.values()).filter(v => v >= 2).length;

  let newContactsCount = 0;
  let promotedToCommunity = 0;
  let promotedToInnovator = 0;
  const allContactsList = await db.select({
    id: contacts.id, createdAt: contacts.createdAt,
    movedToCommunityAt: contacts.movedToCommunityAt,
    movedToInnovatorsAt: contacts.movedToInnovatorsAt,
  }).from(contacts).where(eq(contacts.userId, filters.userId));

  for (const c of allContactsList) {
    const matchesLens = !lensContactIds || lensContactIds.has(c.id);
    if (!matchesLens) continue;
    if (c.createdAt && c.createdAt >= start && c.createdAt <= end) newContactsCount++;
    if (c.movedToCommunityAt && c.movedToCommunityAt >= start && c.movedToCommunityAt <= end) promotedToCommunity++;
    if (c.movedToInnovatorsAt && c.movedToInnovatorsAt >= start && c.movedToInnovatorsAt <= end) promotedToInnovator++;
  }

  const newGroupsResult = await db.select({ count: count() }).from(groups).where(and(
    eq(groups.userId, filters.userId),
    gte(groups.createdAt, start), lte(groups.createdAt, end),
  ));
  const newGroups = Number(newGroupsResult[0]?.count || 0);

  let demographicBreakdown: Record<string, any> = {};
  const contactIdsArr = Array.from(contactTouchpoints.keys());
  if (contactIdsArr.length > 0) {
    const contactDetails = await db.select({
      id: contacts.id, age: contacts.age, ethnicity: contacts.ethnicity,
      location: contacts.location, consentStatus: contacts.consentStatus, stage: contacts.stage,
    }).from(contacts).where(and(eq(contacts.userId, filters.userId), inArray(contacts.id, contactIdsArr)));

    const consentedContacts = contactDetails.filter(c => c.consentStatus === "given");
    const ethnicityMap: Record<string, number> = {};
    const locationMap: Record<string, number> = {};
    const ageGroups: Record<string, number> = { "under_18": 0, "18_24": 0, "25_34": 0, "35_44": 0, "45_54": 0, "55_plus": 0, "unknown": 0 };
    const stageMap: Record<string, number> = {};

    for (const c of consentedContacts) {
      if (c.ethnicity) { for (const eth of c.ethnicity) ethnicityMap[eth] = (ethnicityMap[eth] || 0) + 1; }
      if (c.location) locationMap[c.location] = (locationMap[c.location] || 0) + 1;
      if (c.age != null) {
        if (c.age < 18) ageGroups["under_18"]++;
        else if (c.age <= 24) ageGroups["18_24"]++;
        else if (c.age <= 34) ageGroups["25_34"]++;
        else if (c.age <= 44) ageGroups["35_44"]++;
        else if (c.age <= 54) ageGroups["45_54"]++;
        else ageGroups["55_plus"]++;
      } else { ageGroups["unknown"]++; }
      if (c.stage) stageMap[c.stage] = (stageMap[c.stage] || 0) + 1;
    }
    demographicBreakdown = { totalConsented: consentedContacts.length, ethnicity: ethnicityMap, location: locationMap, ageGroups, relationshipStage: stageMap };
  }

  return {
    peopleReached: uniqueContacts + footTraffic,
    uniqueContacts,
    footTraffic,
    totalEngagements,
    sourceBreakdown,
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

  const eventsInRange = await db.select().from(events).where(and(
    eq(events.userId, filters.userId), ne(events.eventStatus, "cancelled"),
    gte(events.startTime, start), lte(events.startTime, end),
  ));

  const eventsByType: Record<string, number> = {};
  let totalAttendees = 0;
  for (const e of eventsInRange) {
    eventsByType[e.type] = (eventsByType[e.type] || 0) + 1;
    if (e.attendeeCount && e.attendeeCount > 0) totalAttendees += e.attendeeCount;
  }

  const bookingsInRange = await db.select().from(bookings).where(and(
    eq(bookings.userId, filters.userId), inArray(bookings.status, ["confirmed", "completed"]),
    gte(bookings.startDate, start), lte(bookings.startDate, end),
  ));

  const bookingsByClassification: Record<string, number> = {};
  let communityHours = 0;
  for (const b of bookingsInRange) {
    bookingsByClassification[b.classification] = (bookingsByClassification[b.classification] || 0) + 1;
    if (b.startTime && b.endTime) {
      const [sh, sm] = b.startTime.split(":").map(Number);
      const [eh, em] = b.endTime.split(":").map(Number);
      const dailyHours = Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
      if (b.isMultiDay && b.startDate && b.endDate) {
        const daySpan = Math.max(1, Math.ceil((new Date(b.endDate).getTime() - new Date(b.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1);
        communityHours += dailyHours * daySpan;
      } else { communityHours += dailyHours; }
    }
  }

  const userMentoringTypes = await db.select({ name: meetingTypes.name }).from(meetingTypes).where(and(
    eq(meetingTypes.userId, filters.userId), eq(meetingTypes.category, "mentoring"), eq(meetingTypes.isActive, true),
  ));
  const MENTORING_TYPES = userMentoringTypes.length > 0
    ? userMentoringTypes.map(t => t.name.toLowerCase())
    : ["mentoring", "catchup", "follow-up"];

  const allMeetingsInRange = await db.select().from(meetings).where(and(
    eq(meetings.userId, filters.userId),
    inArray(meetings.status, ["completed", "confirmed"]),
    gte(meetings.startTime, start), lte(meetings.startTime, end),
  ));
  const mentoringMeetings = allMeetingsInRange.filter(m => m.type && MENTORING_TYPES.includes(m.type.toLowerCase()));
  const partnerMeetings = allMeetingsInRange.filter(m => m.type && !MENTORING_TYPES.includes(m.type.toLowerCase()));

  const workshopCount = eventsInRange.filter(e =>
    e.type && e.type.toLowerCase().includes("workshop")
  ).length;

  const programmesInRange = await db.select().from(programmes).where(and(
    eq(programmes.userId, filters.userId), ne(programmes.status, "cancelled"),
    gte(programmes.startDate, start), lte(programmes.startDate, end),
  ));
  const programmesByClassification: Record<string, number> = {};
  let programmesCompleted = 0;
  let programmeAttendees = 0;
  for (const p of programmesInRange) {
    programmesByClassification[p.classification] = (programmesByClassification[p.classification] || 0) + 1;
    if (p.status === "completed") programmesCompleted++;
    if (p.attendees) programmeAttendees += p.attendees.length;
  }

  const totalActivations = eventsInRange.length + bookingsInRange.length + mentoringMeetings.length + programmesInRange.length + partnerMeetings.length;

  return {
    totalActivations,
    events: { total: eventsInRange.length, byType: eventsByType, totalAttendees },
    bookings: {
      total: bookingsInRange.length, byClassification: bookingsByClassification,
      communityHours: Math.round(communityHours * 10) / 10,
    },
    mentoringSessions: mentoringMeetings.length,
    partnerMeetings: partnerMeetings.length,
    workshops: workshopCount,
    programmes: {
      total: programmesInRange.length, byClassification: programmesByClassification,
      completed: programmesCompleted,
    },
    communityHours: Math.round(communityHours * 10) / 10,
    totalAttendees: totalAttendees + programmeAttendees,
    communityLensApplied: false,
  };
}

export async function getImpactMetrics(filters: ReportFilters) {
  const where = confirmedDebriefConditions(filters);
  const lensContactIds = await getCommunityLensContactIds(filters);
  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);

  let communitySpendTotal = 0;
  try {
    const spendResult = await db.select({ total: sum(communitySpend.amount) }).from(communitySpend)
      .where(and(eq(communitySpend.userId, filters.userId), gte(communitySpend.date, start), lte(communitySpend.date, end)));
    communitySpendTotal = Math.round(Number(spendResult[0]?.total || 0) * 100) / 100;
  } catch (err) { console.error("[reporting] Community spend query failed:", err); }

  const confirmedLogIds = await db.select({ id: impactLogs.id }).from(impactLogs).where(where);
  const logIds = confirmedLogIds.map(r => r.id);

  let taxonomyBreakdown: any[] = [];
  if (logIds.length > 0) {
    const tagConditions = filters.taxonomyIds?.length
      ? and(inArray(impactTags.impactLogId, logIds), inArray(impactTags.taxonomyId, filters.taxonomyIds))
      : inArray(impactTags.impactLogId, logIds);

    const allTags = await db.select({
      taxonomyId: impactTags.taxonomyId, taxonomyName: impactTaxonomy.name, taxonomyColor: impactTaxonomy.color,
      impactLogId: impactTags.impactLogId, confidence: impactTags.confidence, notes: impactTags.notes, evidence: impactTags.evidence,
    }).from(impactTags).innerJoin(impactTaxonomy, eq(impactTags.taxonomyId, impactTaxonomy.id)).where(tagConditions!);

    const contactsByLog = await db.select({ impactLogId: impactLogContacts.impactLogId, contactId: impactLogContacts.contactId })
      .from(impactLogContacts).where(inArray(impactLogContacts.impactLogId, logIds));
    const contactsByLogMap = new Map<number, number[]>();
    for (const row of contactsByLog) {
      if (lensContactIds && !lensContactIds.has(row.contactId)) continue;
      if (!contactsByLogMap.has(row.impactLogId)) contactsByLogMap.set(row.impactLogId, []);
      contactsByLogMap.get(row.impactLogId)!.push(row.contactId);
    }

    const quotesByLog = await db.select({ id: impactLogs.id, keyQuotes: impactLogs.keyQuotes })
      .from(impactLogs).where(inArray(impactLogs.id, logIds));
    const quotesMap = new Map<number, string[]>();
    for (const row of quotesByLog) { if (row.keyQuotes) quotesMap.set(row.id, row.keyQuotes); }

    const grouped = new Map<number, { taxonomyId: number; taxonomyName: string; taxonomyColor: string | null; debriefCount: number; weightedScore: number; contactIds: Set<number>; quotes: string[]; evidenceSnippets: string[]; logIds: Set<number> }>();
    for (const tag of allTags) {
      if (!grouped.has(tag.taxonomyId)) {
        grouped.set(tag.taxonomyId, { taxonomyId: tag.taxonomyId, taxonomyName: tag.taxonomyName, taxonomyColor: tag.taxonomyColor, debriefCount: 0, weightedScore: 0, contactIds: new Set(), quotes: [], evidenceSnippets: [], logIds: new Set() });
      }
      const g = grouped.get(tag.taxonomyId)!;
      if (!g.logIds.has(tag.impactLogId)) { g.debriefCount++; g.logIds.add(tag.impactLogId); }
      g.weightedScore += tag.confidence || 0;
      const logContacts = contactsByLogMap.get(tag.impactLogId) || [];
      for (const cid of logContacts) g.contactIds.add(cid);
      if (tag.evidence) g.evidenceSnippets.push(tag.evidence);
      if (tag.notes) g.evidenceSnippets.push(tag.notes);
      if ((tag.confidence || 0) >= 70) {
        const logQuotes = quotesMap.get(tag.impactLogId) || [];
        for (const q of logQuotes) { if (!g.quotes.includes(q)) g.quotes.push(q); }
      }
    }
    taxonomyBreakdown = Array.from(grouped.values()).map(g => ({
      name: g.taxonomyName, color: g.taxonomyColor, debriefCount: g.debriefCount,
      peopleAffected: g.contactIds.size, impactScore: g.weightedScore,
      topQuotes: g.quotes.slice(0, 5), evidence: g.evidenceSnippets.slice(0, 5),
    })).sort((a, b) => b.impactScore - a.impactScore);
  }

  let engagedContactIds = await db.selectDistinct({ contactId: impactLogContacts.contactId })
    .from(impactLogContacts).innerJoin(impactLogs, eq(impactLogContacts.impactLogId, impactLogs.id)).where(where);
  if (lensContactIds) engagedContactIds = engagedContactIds.filter(r => lensContactIds.has(r.contactId));
  const cIds = engagedContactIds.map(r => r.contactId);

  const ALL_METRIC_KEYS = ["mindset", "skill", "confidence", "bizConfidence", "systemsInPlace", "fundingReadiness", "networkStrength", "communityImpact", "digitalPresence"] as const;
  const metricArrays: Record<string, number[]> = {};
  for (const key of ALL_METRIC_KEYS) metricArrays[key] = [];
  let contactsWithMetrics = 0;
  if (cIds.length > 0) {
    const contactMetrics = await db.select({ id: contacts.id, metrics: contacts.metrics })
      .from(contacts).where(and(eq(contacts.userId, filters.userId), inArray(contacts.id, cIds)));
    for (const c of contactMetrics) {
      const m = c.metrics as any;
      if (!m || Object.keys(m).length === 0) continue;
      contactsWithMetrics++;
      for (const key of ALL_METRIC_KEYS) {
        if (m[key] != null) metricArrays[key].push(m[key]);
      }
    }
  }

  const avgFn = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;
  const positivePercent = (arr: number[]) => arr.length ? Math.round((arr.filter(v => v > 0).length / arr.length) * 100) : 0;

  const confirmedLogs = await db.select({ id: impactLogs.id, milestones: impactLogs.milestones }).from(impactLogs).where(where);
  let milestonesFromTable = await db.select().from(milestones).where(and(
    eq(milestones.userId, filters.userId), gte(milestones.createdAt, start), lte(milestones.createdAt, end),
  ));
  if (lensContactIds) {
    milestonesFromTable = milestonesFromTable.filter(m => m.linkedContactId && lensContactIds.has(m.linkedContactId));
  }
  let inlineMilestoneCount = 0;
  const tableMilestoneLogIds = new Set(milestonesFromTable.map(m => m.impactLogId).filter(Boolean));
  for (const log of confirmedLogs) {
    if (log.milestones && log.milestones.length > 0 && !tableMilestoneLogIds.has(log.id)) {
      inlineMilestoneCount += log.milestones.length;
    }
  }

  let connectionMovement = 0;
  const CONNECTION_ORDER = ["known", "connected", "engaged", "embedded", "partnering"];
  const stageHistory = await db.select().from(relationshipStageHistory).where(and(
    eq(relationshipStageHistory.entityType, "contact"),
    gte(relationshipStageHistory.changedAt, start), lte(relationshipStageHistory.changedAt, end),
  ));
  const deepenedContacts = new Set<number>();
  for (const sh of stageHistory) {
    if (lensContactIds && !lensContactIds.has(sh.entityId)) continue;
    const prevIdx = sh.previousStage ? CONNECTION_ORDER.indexOf(sh.previousStage) : -1;
    const newIdx = CONNECTION_ORDER.indexOf(sh.newStage);
    if (newIdx > prevIdx && newIdx >= 0) deepenedContacts.add(sh.entityId);
  }
  connectionMovement = deepenedContacts.size;

  return {
    communitySpend: communitySpendTotal,
    milestoneCount: milestonesFromTable.length + inlineMilestoneCount,
    growthMetrics: Object.fromEntries(
      ALL_METRIC_KEYS.map(key => [key, { averageScore: avgFn(metricArrays[key]), positiveMovementPercent: positivePercent(metricArrays[key]) }])
    ) as Record<string, { averageScore: number; positiveMovementPercent: number }>,
    contactsWithMetrics,
    connectionMovement,
    taxonomyBreakdown,
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

  const bookingsInRange = await db
    .select()
    .from(bookings)
    .where(and(
      eq(bookings.userId, filters.userId),
      gte(bookings.startDate, start),
      lte(bookings.startDate, end),
    ));

  let totalRevenue = 0;
  let bookingsByTier: Record<string, { count: number; revenue: number }> = {};

  for (const b of bookingsInRange) {
    const amt = Number(b.amount) || 0;
    totalRevenue += amt;
    if (!bookingsByTier[b.pricingTier]) bookingsByTier[b.pricingTier] = { count: 0, revenue: 0 };
    bookingsByTier[b.pricingTier].count++;
    bookingsByTier[b.pricingTier].revenue += amt;
  }

  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const activeMemberships = await db
    .select()
    .from(memberships)
    .where(and(
      eq(memberships.userId, filters.userId),
      eq(memberships.status, "active"),
      gte(memberships.membershipYear, startYear),
      lte(memberships.membershipYear, endYear),
    ));

  let membershipRevenue = 0;
  let totalStandardValue = 0;
  const membershipDetails = [];

  for (const m of activeMemberships) {
    membershipRevenue += Number(m.annualFee) || 0;
    totalStandardValue += Number(m.standardValue) || 0;

    const usedBookings = bookingsInRange.filter(b => b.membershipId === m.id);

    membershipDetails.push({
      id: m.id,
      name: m.name,
      membershipYear: m.membershipYear,
      standardValue: Number(m.standardValue) || 0,
      annualFee: Number(m.annualFee) || 0,
      bookingAllowance: m.bookingAllowance || 0,
      bookingsUsed: usedBookings.length,
    });
  }

  const activeMous = await db
    .select()
    .from(mous)
    .where(and(
      eq(mous.userId, filters.userId),
      eq(mous.status, "active"),
      lte(mous.startDate, end),
      gte(mous.endDate, start),
    ));

  let totalInKindValue = 0;
  let totalMouActualValue = 0;
  const mouSummary = [];

  for (const m of activeMous) {
    const ikv = Number(m.inKindValue) || 0;
    const av = Number(m.actualValue) || 0;
    totalInKindValue += ikv;
    totalMouActualValue += av;
    mouSummary.push({
      id: m.id,
      title: m.title,
      partnerName: m.partnerName,
      providing: m.providing,
      receiving: m.receiving,
      actualValue: av,
      inKindValue: ikv,
    });
  }

  const programmesInRange = await db
    .select()
    .from(programmes)
    .where(and(
      eq(programmes.userId, filters.userId),
      gte(programmes.startDate, start),
      lte(programmes.startDate, end),
    ));

  const programmeCosts = programmesInRange.map(p => ({
    id: p.id,
    name: p.name,
    classification: p.classification,
    facilitatorCost: Number(p.facilitatorCost) || 0,
    cateringCost: Number(p.cateringCost) || 0,
    promoCost: Number(p.promoCost) || 0,
    totalCost: (Number(p.facilitatorCost) || 0) + (Number(p.cateringCost) || 0) + (Number(p.promoCost) || 0),
  }));

  return {
    revenue: {
      total: Math.round(totalRevenue * 100) / 100,
      byPricingTier: bookingsByTier,
    },
    inKindValue: Math.round(totalInKindValue * 100) / 100,
    memberships: {
      active: activeMemberships.length,
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
  const [reach, delivery, impact, value, mentoring] = await Promise.all([
    getReachMetrics(filters),
    getDeliveryMetrics(filters),
    getImpactMetrics(filters),
    getValueContribution(filters),
    getMentoringMetrics(filters),
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
      if (impact.communitySpend > 0) impText += `$${impact.communitySpend.toLocaleString()} was invested directly into community. `;
      if (impact.milestoneCount > 0) impText += `${impact.milestoneCount} milestones were achieved. `;
      if (impact.contactsWithMetrics > 0 && impact.growthMetrics) {
        const gm = impact.growthMetrics;
        impText += `${impact.contactsWithMetrics} people have tracked growth - mindset shifted positively for ${gm.mindset?.positiveMovementPercent ?? 0}%, skill for ${gm.skill?.positiveMovementPercent ?? 0}%, and confidence for ${gm.confidence?.positiveMovementPercent ?? 0}%.`;
      }
      if (impact.connectionMovement > 0) impText += ` ${impact.connectionMovement} people deepened their connection strength.`;
      if (topCategories.length > 0) {
        impText += `\n\nKey impact areas:\n`;
        impText += topCategories.map(c => {
          let line = `- **${c.name}**: ${c.peopleAffected} people across ${c.debriefCount} sessions`;
          if (c.topQuotes.length > 0) line += `\n  > "${c.topQuotes[0]}"`;
          return line;
        }).join("\n");
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
    if (impact.communitySpend > 0) impText += `Community investment: $${impact.communitySpend.toLocaleString()}. `;
    impText += `${impact.milestoneCount} milestones achieved. ${impact.contactsWithMetrics} people with tracked growth.`;
    if (impact.contactsWithMetrics > 0 && impact.growthMetrics) {
      const gm = impact.growthMetrics;
      impText += ` Average scores - mindset: ${gm.mindset?.averageScore ?? 0}, skill: ${gm.skill?.averageScore ?? 0}, confidence: ${gm.confidence?.averageScore ?? 0}.`;
      impText += ` Positive movement - mindset: ${gm.mindset?.positiveMovementPercent ?? 0}%, skill: ${gm.skill?.positiveMovementPercent ?? 0}%, confidence: ${gm.confidence?.positiveMovementPercent ?? 0}%.`;
    }
    if (impact.connectionMovement > 0) impText += ` ${impact.connectionMovement} connections deepened.`;
    if (topCategories.length > 0) {
      const catLines = topCategories.map(c => {
        let line = `- **${c.name}**: ${c.debriefCount} debriefs, ${c.peopleAffected} affected (score: ${c.impactScore})`;
        if (c.topQuotes.length > 0) line += `\n  > "${c.topQuotes[0]}"`;
        return line;
      }).join("\n");
      impText += `\n\nTop impact areas:\n${catLines}`;
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
    sections: {
      reach,
      delivery,
      impact,
      value,
    },
  };
}

export async function getCommunityComparison(filters: ReportFilters) {
  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);
  const where = confirmedDebriefConditions(filters);

  const maoriIds = await getCommunityLensContactIds({ ...filters, communityLens: "maori" });
  const pasifikaIds = await getCommunityLensContactIds({ ...filters, communityLens: "pasifika" });

  const allEngagedContacts = await db
    .selectDistinct({ contactId: impactLogContacts.contactId })
    .from(impactLogContacts)
    .innerJoin(impactLogs, eq(impactLogContacts.impactLogId, impactLogs.id))
    .where(where);

  const allEngagedIds = new Set(allEngagedContacts.map(r => r.contactId));

  const allContactDetails = allEngagedIds.size > 0
    ? await db
        .select({ id: contacts.id, age: contacts.age, metrics: contacts.metrics })
        .from(contacts)
        .where(and(eq(contacts.userId, filters.userId), inArray(contacts.id, Array.from(allEngagedIds))))
    : [];

  const newContactsInPeriod = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(
      eq(contacts.userId, filters.userId),
      gte(contacts.createdAt, start),
      lte(contacts.createdAt, end),
    ));
  const newContactIds = new Set(newContactsInPeriod.map(c => c.id));

  const businessProgrammes = await db
    .select({ id: programmes.id, attendees: programmes.attendees })
    .from(programmes)
    .where(and(
      eq(programmes.userId, filters.userId),
      gte(programmes.startDate, start),
      lte(programmes.startDate, end),
    ));

  const contactsInBusinessProgrammes = new Set<number>();
  for (const p of businessProgrammes) {
    if (p.attendees) {
      for (const a of p.attendees) contactsInBusinessProgrammes.add(a);
    }
  }

  const allMilestones = await db
    .select()
    .from(milestones)
    .where(and(
      eq(milestones.userId, filters.userId),
      gte(milestones.createdAt, start),
      lte(milestones.createdAt, end),
    ));

  function computeMetrics(lensIds: Set<number> | null) {
    if (!lensIds) return { uniqueParticipants: 0, rangatahiUnder25: 0, activeInBusinessProgrammes: 0, confidenceGrowthPercent: 0, milestonesAchieved: 0, newContactsThisPeriod: 0 };

    const engaged = Array.from(allEngagedIds).filter(id => lensIds.has(id));
    const uniqueParticipants = engaged.length;

    const contactMap = new Map(allContactDetails.map(c => [c.id, c]));
    let rangatahiUnder25 = 0;
    let confidencePositive = 0;
    let confidenceTotal = 0;
    let activeInBiz = 0;

    for (const id of engaged) {
      const c = contactMap.get(id);
      if (c) {
        if (c.age != null && c.age < 25) rangatahiUnder25++;
        const m = c.metrics as any;
        if (m?.confidence != null) {
          confidenceTotal++;
          if (m.confidence > 0) confidencePositive++;
        }
      }
      if (contactsInBusinessProgrammes.has(id)) activeInBiz++;
    }

    const milestonesAchieved = allMilestones.filter(m =>
      m.linkedContactId && lensIds.has(m.linkedContactId)
    ).length;

    const newContacts = Array.from(newContactIds).filter(id => lensIds.has(id)).length;

    return {
      uniqueParticipants,
      rangatahiUnder25,
      activeInBusinessProgrammes: activeInBiz,
      confidenceGrowthPercent: confidenceTotal > 0 ? Math.round((confidencePositive / confidenceTotal) * 100) : 0,
      milestonesAchieved,
      newContactsThisPeriod: newContacts,
    };
  }

  const maoriMetrics = computeMetrics(maoriIds);
  const pasifikaMetrics = computeMetrics(pasifikaIds);

  const totalParticipants = maoriMetrics.uniqueParticipants + pasifikaMetrics.uniqueParticipants;
  const maoriPercent = totalParticipants > 0 ? Math.round((maoriMetrics.uniqueParticipants / totalParticipants) * 100) : 0;
  const pasifikaPercent = totalParticipants > 0 ? 100 - maoriPercent : 0;

  return {
    maori: maoriMetrics,
    pasifika: pasifikaMetrics,
    communitySplit: {
      maoriPercent,
      pasifikaPercent,
      totalParticipants,
    },
  };
}

export async function getTamakiOraAlignment(filters: ReportFilters) {
  const maoriFilters = { ...filters, communityLens: "maori" as const };
  const maoriIds = await getCommunityLensContactIds(maoriFilters);
  if (!maoriIds || maoriIds.size === 0) {
    return {
      whaiRawaOra: { contactsInBusinessProgrammes: 0, fundingMilestones: 0, stageProgressions: 0 },
      teHaporiOra: { contactsInCommunityEvents: 0, rangatahiCount: 0, repeatEngagementRate: 0, activeGroupsWithMaori: 0 },
      huatauOra: { rangatahiInInnovation: 0, newVentureMilestones: 0, averageMindsetShift: 0 },
    };
  }

  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);
  const where = confirmedDebriefConditions(filters);

  const allProgrammes = await db
    .select({ id: programmes.id, classification: programmes.classification, attendees: programmes.attendees })
    .from(programmes)
    .where(and(
      eq(programmes.userId, filters.userId),
      gte(programmes.startDate, start),
      lte(programmes.startDate, end),
    ));

  const businessClassifications = ["business", "entrepreneurship", "enterprise", "startup"];
  const innovationClassifications = ["innovation", "youth", "rangatahi", "digital", "technology"];

  let contactsInBusinessProgrammes = 0;
  let rangatahiInInnovation = 0;
  const maoriInBizSet = new Set<number>();

  const maoriContactDetails = await db
    .select({ id: contacts.id, age: contacts.age, metrics: contacts.metrics, relationshipStage: contacts.relationshipStage })
    .from(contacts)
    .where(and(
      eq(contacts.userId, filters.userId),
      inArray(contacts.id, Array.from(maoriIds)),
    ));
  const maoriContactMap = new Map(maoriContactDetails.map(c => [c.id, c]));

  for (const p of allProgrammes) {
    if (!p.attendees) continue;
    const isBiz = businessClassifications.some(bc => p.classification.toLowerCase().includes(bc));
    const isInnovation = innovationClassifications.some(ic => p.classification.toLowerCase().includes(ic));

    for (const attendeeId of p.attendees) {
      if (!maoriIds.has(attendeeId)) continue;
      if (isBiz && !maoriInBizSet.has(attendeeId)) {
        maoriInBizSet.add(attendeeId);
        contactsInBusinessProgrammes++;
      }
      if (isInnovation) {
        const c = maoriContactMap.get(attendeeId);
        if (c && c.age != null && c.age < 25) {
          rangatahiInInnovation++;
        }
      }
    }
  }

  const allMilestones = await db
    .select()
    .from(milestones)
    .where(and(
      eq(milestones.userId, filters.userId),
      gte(milestones.createdAt, start),
      lte(milestones.createdAt, end),
    ));

  const fundingTypes = ["funding_secured", "revenue_milestone"];
  const ventureTypes = ["business_launched", "prototype_completed"];

  let fundingMilestones = 0;
  let newVentureMilestones = 0;
  for (const m of allMilestones) {
    if (!m.linkedContactId || !maoriIds.has(m.linkedContactId)) continue;
    if (fundingTypes.includes(m.milestoneType)) fundingMilestones++;
    if (ventureTypes.includes(m.milestoneType)) newVentureMilestones++;
  }

  const stageHistory = await db
    .select()
    .from(relationshipStageHistory)
    .where(and(
      eq(relationshipStageHistory.entityType, "contact"),
      gte(relationshipStageHistory.changedAt, start),
      lte(relationshipStageHistory.changedAt, end),
    ));

  let stageProgressions = 0;
  const stageOrder = ["new", "engaged", "active", "deepening", "partner", "alumni"];
  for (const sh of stageHistory) {
    if (!maoriIds.has(sh.entityId)) continue;
    const prevIdx = sh.previousStage ? stageOrder.indexOf(sh.previousStage) : -1;
    const newIdx = stageOrder.indexOf(sh.newStage);
    if (newIdx > prevIdx) stageProgressions++;
  }

  const eventsInRange = await db
    .select({ id: events.id })
    .from(events)
    .where(and(
      eq(events.userId, filters.userId),
      gte(events.startTime, start),
      lte(events.startTime, end),
    ));

  const eventIds = eventsInRange.map(e => e.id);
  let contactsInCommunityEvents = 0;
  if (eventIds.length > 0) {
    const attendance = await db
      .select({ contactId: eventAttendance.contactId })
      .from(eventAttendance)
      .where(inArray(eventAttendance.eventId, eventIds));

    const maoriAttendees = new Set<number>();
    for (const a of attendance) {
      if (maoriIds.has(a.contactId)) maoriAttendees.add(a.contactId);
    }
    contactsInCommunityEvents = maoriAttendees.size;
  }

  let rangatahiCount = 0;
  for (const c of maoriContactDetails) {
    if (c.age != null && c.age < 25) rangatahiCount++;
  }

  const engagedContacts = await db
    .select({ contactId: impactLogContacts.contactId, cnt: count() })
    .from(impactLogContacts)
    .innerJoin(impactLogs, eq(impactLogContacts.impactLogId, impactLogs.id))
    .where(where)
    .groupBy(impactLogContacts.contactId);

  const maoriEngaged = engagedContacts.filter(r => maoriIds.has(r.contactId));
  const maoriRepeat = maoriEngaged.filter(r => Number(r.cnt) >= 2).length;
  const repeatEngagementRate = maoriEngaged.length > 0 ? Math.round((maoriRepeat / maoriEngaged.length) * 100) : 0;

  const maoriIdArray = Array.from(maoriIds);
  let activeGroupsWithMaori = 0;
  if (maoriIdArray.length > 0) {
    const groupsWithMaori = await db
      .selectDistinct({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(and(
        eq(groups.userId, filters.userId),
        eq(groups.active, true),
        inArray(groupMembers.contactId, maoriIdArray),
      ));
    activeGroupsWithMaori = groupsWithMaori.length;
  }

  let mindsetValues: number[] = [];
  for (const c of maoriContactDetails) {
    const m = c.metrics as any;
    if (m?.mindset != null) mindsetValues.push(m.mindset);
  }
  const averageMindsetShift = mindsetValues.length > 0
    ? Math.round((mindsetValues.reduce((a, b) => a + b, 0) / mindsetValues.length) * 10) / 10
    : 0;

  return {
    whaiRawaOra: {
      contactsInBusinessProgrammes,
      fundingMilestones,
      stageProgressions,
    },
    teHaporiOra: {
      contactsInCommunityEvents,
      rangatahiCount,
      repeatEngagementRate,
      activeGroupsWithMaori,
    },
    huatauOra: {
      rangatahiInInnovation,
      newVentureMilestones,
      averageMindsetShift,
    },
  };
}

export async function getMentoringMetrics(filters: ReportFilters) {
  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);
  const lensContactIds = await getCommunityLensContactIds(filters);

  const userMentoringTypes = await db
    .select({ name: meetingTypes.name })
    .from(meetingTypes)
    .where(and(
      eq(meetingTypes.userId, filters.userId),
      eq(meetingTypes.category, "mentoring"),
      eq(meetingTypes.isActive, true),
    ));
  const MENTORING_TYPES = userMentoringTypes.length > 0
    ? userMentoringTypes.map(t => t.name.toLowerCase())
    : ["mentoring", "catchup", "follow-up"];

  const allMentoringMeetings = await db
    .select()
    .from(meetings)
    .where(and(
      eq(meetings.userId, filters.userId),
      inArray(meetings.type, MENTORING_TYPES),
      gte(meetings.startTime, start),
      lte(meetings.startTime, end),
    ));

  const mentoringMeetings = lensContactIds
    ? allMentoringMeetings.filter(m => m.contactId && lensContactIds.has(m.contactId))
    : allMentoringMeetings;

  const deliveredSessions = mentoringMeetings.filter(m => m.status === "completed");
  const totalSessions = mentoringMeetings.length;
  const completedSessions = deliveredSessions.length;
  const totalHours = Math.round(
    deliveredSessions.reduce((sum, m) => sum + (m.duration || 30), 0) / 60 * 10
  ) / 10;

  const uniqueMenteeIds = new Set(mentoringMeetings.map(m => m.contactId));
  const uniqueMentees = uniqueMenteeIds.size;

  const avgSessionsPerMentee = uniqueMentees > 0
    ? Math.round((totalSessions / uniqueMentees) * 10) / 10
    : 0;

  const contactIds = Array.from(uniqueMenteeIds);
  let newMentees = 0;
  if (contactIds.length > 0) {
    const allMentoringForContacts = await db
      .select({
        contactId: meetings.contactId,
        firstSession: sql<Date>`MIN(${meetings.startTime})`.as("first_session"),
      })
      .from(meetings)
      .where(and(
        eq(meetings.userId, filters.userId),
        inArray(meetings.type, MENTORING_TYPES),
        inArray(meetings.contactId, contactIds),
      ))
      .groupBy(meetings.contactId);

    for (const row of allMentoringForContacts) {
      const firstDate = new Date(row.firstSession);
      if (firstDate >= start && firstDate <= end) {
        newMentees++;
      }
    }
  }

  const bySource: Record<string, number> = {};
  for (const m of mentoringMeetings) {
    const source = m.bookingSource || "internal";
    bySource[source] = (bySource[source] || 0) + 1;
  }

  const FOCUS_LABELS: Record<string, string> = {
    general: "General", strategy: "Strategy", wellbeing: "Wellbeing",
    skills: "Skills Development", "skills development": "Skills Development",
    "skills_development": "Skills Development",
    business: "Business", career: "Career",
    leadership: "Leadership", innovation: "Innovation", community: "Community",
    creative: "Creative", financial: "Financial", digital: "Digital",
    unspecified: "Unspecified",
  };
  const byFocus: Record<string, number> = {};
  for (const m of mentoringMeetings) {
    const rawFocus = (m.mentoringFocus || "unspecified").trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
    const label = FOCUS_LABELS[rawFocus] || rawFocus.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    byFocus[label] = (byFocus[label] || 0) + 1;
  }

  const completedCount = mentoringMeetings.filter(m => m.status === "completed").length;
  const cancelledCount = mentoringMeetings.filter(m => m.status === "cancelled").length;
  const noShowCount = mentoringMeetings.filter(m => m.status === "no-show").length;
  const resolvedCount = completedCount + cancelledCount + noShowCount;
  const completionRate = resolvedCount > 0
    ? Math.round((completedCount / resolvedCount) * 100)
    : 0;

  const withInteraction = mentoringMeetings.filter(m => m.status === "completed" && m.interactionId != null).length;
  const debriefRate = completedCount > 0
    ? Math.round((withInteraction / completedCount) * 100)
    : 0;

  return {
    totalSessions,
    completedSessions,
    totalHours,
    uniqueMentees,
    avgSessionsPerMentee,
    newMentees,
    bySource,
    byFocus,
    completionRate,
    debriefRate,
  };
}

export async function getOrganisationsEngaged(filters: ReportFilters) {
  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);

  const debriefWhere = confirmedDebriefConditions(filters);
  const debriefContactIds = await db
    .selectDistinct({ contactId: impactLogContacts.contactId })
    .from(impactLogContacts)
    .innerJoin(impactLogs, eq(impactLogContacts.impactLogId, impactLogs.id))
    .where(debriefWhere);

  const meetingsInRange = await db.select({ contactId: meetings.contactId }).from(meetings).where(and(
    eq(meetings.userId, filters.userId),
    inArray(meetings.status, ["completed", "confirmed"]),
    gte(meetings.startTime, start), lte(meetings.startTime, end),
  ));

  const eventIds = (await db.select({ id: events.id }).from(events).where(and(
    eq(events.userId, filters.userId), eq(events.eventStatus, "active"),
    gte(events.startTime, start), lte(events.startTime, end),
  ))).map(e => e.id);
  let eventContactIds: { contactId: number }[] = [];
  if (eventIds.length > 0) {
    eventContactIds = await db.selectDistinct({ contactId: eventAttendance.contactId })
      .from(eventAttendance).where(inArray(eventAttendance.eventId, eventIds));
  }

  const bookingsInRange = await db.select({ bookerId: bookings.bookerId, attendees: bookings.attendees }).from(bookings).where(and(
    eq(bookings.userId, filters.userId),
    inArray(bookings.status, ["confirmed", "completed"]),
    gte(bookings.startDate, start), lte(bookings.startDate, end),
  ));

  const programmesInRange = await db.select({ attendees: programmes.attendees }).from(programmes).where(and(
    eq(programmes.userId, filters.userId),
    inArray(programmes.status, ["active", "completed"]),
    gte(programmes.startDate, start), lte(programmes.startDate, end),
  ));

  const engagedContactIds = new Set<number>();
  for (const r of debriefContactIds) if (r.contactId) engagedContactIds.add(r.contactId);
  for (const r of meetingsInRange) if (r.contactId) engagedContactIds.add(r.contactId);
  for (const r of eventContactIds) if (r.contactId) engagedContactIds.add(r.contactId);
  for (const b of bookingsInRange) {
    if (b.bookerId) engagedContactIds.add(b.bookerId);
    if (b.attendees) for (const a of b.attendees) engagedContactIds.add(a);
  }
  for (const p of programmesInRange) {
    if (p.attendees) for (const a of p.attendees) engagedContactIds.add(a);
  }

  const snapshotsInRange = await db.select({ id: monthlySnapshots.id }).from(monthlySnapshots).where(and(
    eq(monthlySnapshots.userId, filters.userId),
    gte(monthlySnapshots.month, start), lte(monthlySnapshots.month, end),
  ));
  const snapshotIds = snapshotsInRange.map(s => s.id);
  const touchpointGroupIds = new Set<number>();
  if (snapshotIds.length > 0) {
    const touchpointRows = await db.select({ contactId: footTrafficTouchpoints.contactId, groupId: footTrafficTouchpoints.groupId })
      .from(footTrafficTouchpoints).where(inArray(footTrafficTouchpoints.snapshotId, snapshotIds));
    for (const t of touchpointRows) {
      if (t.contactId) engagedContactIds.add(t.contactId);
      if (t.groupId) touchpointGroupIds.add(t.groupId);
    }
  }

  if (engagedContactIds.size === 0 && touchpointGroupIds.size === 0) return [];

  const engagedArr = Array.from(engagedContactIds);
  const memberRows = engagedArr.length > 0 ? await db.select({
    groupId: groupMembers.groupId,
    contactId: groupMembers.contactId,
  }).from(groupMembers).where(inArray(groupMembers.contactId, engagedArr)) : [];

  const groupIds = new Set(memberRows.map(r => r.groupId));
  for (const gid of touchpointGroupIds) groupIds.add(gid);
  const newGroups = await db.select({ id: groups.id }).from(groups).where(and(
    eq(groups.userId, filters.userId),
    gte(groups.createdAt, start), lte(groups.createdAt, end),
  ));
  for (const g of newGroups) groupIds.add(g.id);

  if (groupIds.size === 0) return [];

  const groupDetails = await db.select({
    id: groups.id,
    name: groups.name,
    organizationType: groups.organizationType,
    isCommunity: groups.isCommunity,
    isInnovator: groups.isInnovator,
    createdAt: groups.createdAt,
  }).from(groups).where(inArray(groups.id, Array.from(groupIds)));

  const allMemberRows = await db.select({
    groupId: groupMembers.groupId,
    contactId: groupMembers.contactId,
  }).from(groupMembers).where(inArray(groupMembers.groupId, Array.from(groupIds)));

  const membersPerGroup = new Map<number, number>();
  const engagedMembersPerGroup = new Map<number, number>();
  for (const r of allMemberRows) {
    membersPerGroup.set(r.groupId, (membersPerGroup.get(r.groupId) || 0) + 1);
    if (engagedContactIds.has(r.contactId)) {
      engagedMembersPerGroup.set(r.groupId, (engagedMembersPerGroup.get(r.groupId) || 0) + 1);
    }
  }

  return groupDetails.map(g => {
    const isNew = g.createdAt && g.createdAt >= start && g.createdAt <= end;
    const context = isNew ? "New this period" :
      g.isInnovator ? "Innovator" :
      g.isCommunity ? "Community member" : "Contact";
    return {
      id: g.id,
      name: g.name,
      type: g.organizationType || "Other",
      context,
      engagedMembers: engagedMembersPerGroup.get(g.id) || 0,
      totalMembers: membersPerGroup.get(g.id) || 0,
    };
  }).sort((a, b) => b.engagedMembers - a.engagedMembers);
}

export async function getPeopleFeatured(filters: ReportFilters) {
  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);
  const lensContactIds = await getCommunityLensContactIds(filters);

  const debriefWhere = confirmedDebriefConditions(filters);
  const debriefContactRows = await db
    .select({ contactId: impactLogContacts.contactId, impactLogId: impactLogContacts.impactLogId })
    .from(impactLogContacts)
    .innerJoin(impactLogs, eq(impactLogContacts.impactLogId, impactLogs.id))
    .where(debriefWhere);

  const contactDebriefCount = new Map<number, number>();
  for (const r of debriefContactRows) {
    if (lensContactIds && !lensContactIds.has(r.contactId)) continue;
    contactDebriefCount.set(r.contactId, (contactDebriefCount.get(r.contactId) || 0) + 1);
  }

  let milestonesInRange = await db.select().from(milestones).where(and(
    eq(milestones.userId, filters.userId),
    gte(milestones.createdAt, start), lte(milestones.createdAt, end),
  ));
  if (lensContactIds) {
    milestonesInRange = milestonesInRange.filter(m => m.linkedContactId && lensContactIds.has(m.linkedContactId));
  }
  const contactMilestones = new Map<number, string[]>();
  for (const m of milestonesInRange) {
    if (!m.linkedContactId) continue;
    if (!contactMilestones.has(m.linkedContactId)) contactMilestones.set(m.linkedContactId, []);
    contactMilestones.get(m.linkedContactId)!.push(m.title);
  }

  const userContactIds = (await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.userId, filters.userId))).map(c => c.id);
  const stageHistory = userContactIds.length > 0 ? await db.select().from(relationshipStageHistory).where(and(
    eq(relationshipStageHistory.entityType, "contact"),
    inArray(relationshipStageHistory.entityId, userContactIds),
    gte(relationshipStageHistory.changedAt, start), lte(relationshipStageHistory.changedAt, end),
  )) : [];
  const JOURNEY_ORDER = ["kakano", "tipu", "ora"];
  const contactJourneyProgress = new Map<number, { from: string; to: string }>();
  for (const sh of stageHistory) {
    if (lensContactIds && !lensContactIds.has(sh.entityId)) continue;
    const prevIdx = sh.previousStage ? JOURNEY_ORDER.indexOf(sh.previousStage) : -1;
    const newIdx = JOURNEY_ORDER.indexOf(sh.newStage);
    if (newIdx > prevIdx && newIdx >= 0) {
      contactJourneyProgress.set(sh.entityId, { from: sh.previousStage || "new", to: sh.newStage });
    }
  }

  const allContactsList = await db.select({
    id: contacts.id,
    movedToInnovatorsAt: contacts.movedToInnovatorsAt,
  }).from(contacts).where(eq(contacts.userId, filters.userId));
  const newInnovatorIds = new Set<number>();
  for (const c of allContactsList) {
    if (c.movedToInnovatorsAt && c.movedToInnovatorsAt >= start && c.movedToInnovatorsAt <= end) {
      if (!lensContactIds || lensContactIds.has(c.id)) {
        newInnovatorIds.add(c.id);
      }
    }
  }

  const snapshotsInRange = await db.select({ id: monthlySnapshots.id }).from(monthlySnapshots).where(and(
    eq(monthlySnapshots.userId, filters.userId),
    gte(monthlySnapshots.month, start), lte(monthlySnapshots.month, end),
  ));
  const snapshotIds = snapshotsInRange.map(s => s.id);
  const contactTouchpointReasons = new Map<number, string[]>();
  if (snapshotIds.length > 0) {
    const touchpointRows = await db.select({ contactId: footTrafficTouchpoints.contactId, description: footTrafficTouchpoints.description })
      .from(footTrafficTouchpoints).where(inArray(footTrafficTouchpoints.snapshotId, snapshotIds));
    for (const t of touchpointRows) {
      if (!t.contactId) continue;
      if (lensContactIds && !lensContactIds.has(t.contactId)) continue;
      if (!contactTouchpointReasons.has(t.contactId)) contactTouchpointReasons.set(t.contactId, []);
      contactTouchpointReasons.get(t.contactId)!.push(`Foot traffic note: ${t.description}`);
    }
  }

  const featuredIds = new Set<number>();
  for (const id of contactDebriefCount.keys()) featuredIds.add(id);
  for (const id of contactMilestones.keys()) featuredIds.add(id);
  for (const id of contactJourneyProgress.keys()) featuredIds.add(id);
  for (const id of newInnovatorIds) featuredIds.add(id);
  for (const id of contactTouchpointReasons.keys()) featuredIds.add(id);

  if (featuredIds.size === 0) return [];

  const contactDetails = await db.select({
    id: contacts.id,
    firstName: contacts.firstName,
    lastName: contacts.lastName,
    role: contacts.role,
    stage: contacts.stage,
    metrics: contacts.metrics,
    isInnovator: contacts.isInnovator,
    isCommunityMember: contacts.isCommunityMember,
  }).from(contacts).where(and(
    eq(contacts.userId, filters.userId),
    inArray(contacts.id, Array.from(featuredIds)),
  ));

  return contactDetails.map(c => {
    const reasons: string[] = [];
    const debriefs = contactDebriefCount.get(c.id);
    if (debriefs) reasons.push(`${debriefs} debrief${debriefs > 1 ? "s" : ""}`);
    const mils = contactMilestones.get(c.id);
    if (mils) reasons.push(`Milestone${mils.length > 1 ? "s" : ""}: ${mils.slice(0, 2).join(", ")}`);
    const journey = contactJourneyProgress.get(c.id);
    if (journey) reasons.push(`Stage: ${journey.from} \u2192 ${journey.to}`);
    if (newInnovatorIds.has(c.id)) reasons.push("New innovator");
    const touchpointNotes = contactTouchpointReasons.get(c.id);
    if (touchpointNotes) reasons.push(...touchpointNotes.slice(0, 3));

    const m = c.metrics as any;
    const growthScores = m ? {
      mindset: m.mindset ?? null,
      skill: m.skill ?? null,
      confidence: m.confidence ?? null,
    } : null;

    return {
      id: c.id,
      name: `${c.firstName || ""} ${c.lastName || ""}`.trim(),
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
  const lensContactIds = await getCommunityLensContactIds(filters);

  const JOURNEY_STAGE_ORDER = ["kakano", "tipu", "ora"];

  const allContacts = await db.select({
    id: contacts.id,
    stage: contacts.stage,
    stageProgression: contacts.stageProgression,
  }).from(contacts).where(eq(contacts.userId, filters.userId));

  const filteredContacts = lensContactIds
    ? allContacts.filter(c => lensContactIds.has(c.id))
    : allContacts;

  const transitions: { from: string; to: string; count: number }[] = [];
  const transitionMap = new Map<string, number>();
  let totalProgressions = 0;

  for (const c of filteredContacts) {
    const prog = c.stageProgression as Array<{ stage: string; date: string; notes?: string }> | null;
    if (!prog || !Array.isArray(prog)) continue;

    const sorted = [...prog].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    for (let i = 1; i < sorted.length; i++) {
      const entryDate = new Date(sorted[i].date);
      if (entryDate >= start && entryDate <= end) {
        const fromStage = sorted[i - 1].stage;
        const toStage = sorted[i].stage;
        const fromIdx = JOURNEY_STAGE_ORDER.indexOf(fromStage);
        const toIdx = JOURNEY_STAGE_ORDER.indexOf(toStage);
        if (toIdx > fromIdx) {
          const key = `${fromStage}→${toStage}`;
          transitionMap.set(key, (transitionMap.get(key) || 0) + 1);
          totalProgressions++;
        }
      }
    }
  }

  for (const [key, count] of transitionMap.entries()) {
    const [from, to] = key.split("→");
    transitions.push({ from, to, count });
  }

  const currentDistribution: Record<string, number> = { kakano: 0, tipu: 0, ora: 0 };
  for (const c of filteredContacts) {
    const stage = c.stage || "kakano";
    if (stage in currentDistribution) currentDistribution[stage]++;
  }

  return { transitions, totalProgressions, currentDistribution };
}

export async function getCommunityDiscounts(filters: ReportFilters) {
  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);

  const bookingsInRange = await db.select({
    amount: bookings.amount,
    discountPercentage: bookings.discountPercentage,
    discountAmount: bookings.discountAmount,
  }).from(bookings).where(and(
    eq(bookings.userId, filters.userId),
    inArray(bookings.status, ["confirmed", "completed"]),
    gte(bookings.startDate, start),
    lte(bookings.startDate, end),
  ));

  let totalDiscountValue = 0;
  let discountedBookingsCount = 0;
  let totalDiscountPercent = 0;

  for (const b of bookingsInRange) {
    const pct = Number(b.discountPercentage) || 0;
    const amt = Number(b.discountAmount) || 0;
    const bookingAmt = Number(b.amount) || 0;

    if (pct > 0 || amt > 0) {
      discountedBookingsCount++;
      totalDiscountPercent += pct;
      if (amt > 0) {
        totalDiscountValue += amt;
      } else if (pct > 0 && bookingAmt > 0) {
        totalDiscountValue += Math.round(bookingAmt * pct) / 100;
      }
    }
  }

  return {
    totalDiscountValue: Math.round(totalDiscountValue * 100) / 100,
    discountedBookingsCount,
    averageDiscountPercent: discountedBookingsCount > 0
      ? Math.round(totalDiscountPercent / discountedBookingsCount)
      : 0,
  };
}

export async function getConnectionStrengthDistribution(filters: ReportFilters) {
  const lensContactIds = await getCommunityLensContactIds(filters);
  const CONNECTION_LEVELS = ["known", "connected", "engaged", "embedded", "partnering"];

  const allContacts = await db.select({
    id: contacts.id,
    connectionStrength: contacts.connectionStrength,
  }).from(contacts).where(eq(contacts.userId, filters.userId));

  const filteredContacts = lensContactIds
    ? allContacts.filter(c => lensContactIds.has(c.id))
    : allContacts;

  const distMap = new Map<string, number>();
  for (const level of CONNECTION_LEVELS) distMap.set(level, 0);

  for (const c of filteredContacts) {
    const strength = c.connectionStrength || "known";
    distMap.set(strength, (distMap.get(strength) || 0) + 1);
  }

  const distribution = CONNECTION_LEVELS.map(strength => ({
    strength,
    count: distMap.get(strength) || 0,
  }));

  return {
    distribution,
    total: filteredContacts.length,
  };
}

export async function getFullMonthlyReport(filters: ReportFilters) {
  const [reach, delivery, impact, value, mentoring, organisationsEngaged, peopleFeatured, journeyProgression, communityDiscounts, connectionStrength] = await Promise.all([
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
  ]);

  const averageChange: Record<string, number> = {};
  const positiveMovement: Record<string, number> = {};
  for (const [key, val] of Object.entries(impact.growthMetrics || {})) {
    averageChange[key] = val.averageScore;
    positiveMovement[key] = val.positiveMovementPercent;
  }

  return {
    period: { startDate: filters.startDate, endDate: filters.endDate },
    filters: {
      programmeIds: filters.programmeIds, taxonomyIds: filters.taxonomyIds,
      demographicSegments: filters.demographicSegments, communityLens: filters.communityLens,
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
    engagement: reach,
    outcomes: {
      totalContacts: impact.contactsWithMetrics,
      contactsWithMetrics: impact.contactsWithMetrics,
      averageChange,
      positiveMovementPercent: positiveMovement,
      milestoneCount: impact.milestoneCount,
    },
  };
}
