import { db } from "./db";
import { sql, eq, and, gte, lte, inArray, count, countDistinct, sum, avg } from "drizzle-orm";
import {
  impactLogs, impactLogContacts, impactLogGroups, impactTags, impactTaxonomy,
  contacts, groups, groupMembers, events, eventAttendance,
  programmes, programmeEvents, bookings, memberships, mous, venues,
} from "@shared/schema";

export interface ReportFilters {
  userId: string;
  startDate: string;
  endDate: string;
  programmeIds?: number[];
  taxonomyIds?: number[];
  demographicSegments?: string[];
  funder?: string;
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

export async function getEngagementMetrics(filters: ReportFilters) {
  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);
  const where = confirmedDebriefConditions(filters);

  const uniqueContactsResult = await db
    .selectDistinct({ contactId: impactLogContacts.contactId })
    .from(impactLogContacts)
    .innerJoin(impactLogs, eq(impactLogContacts.impactLogId, impactLogs.id))
    .where(where);

  const totalInstancesResult = await db
    .select({ count: count() })
    .from(impactLogContacts)
    .innerJoin(impactLogs, eq(impactLogContacts.impactLogId, impactLogs.id))
    .where(where);

  const newContactsResult = await db
    .select({ count: count() })
    .from(contacts)
    .where(and(
      eq(contacts.userId, filters.userId),
      gte(contacts.createdAt, start),
      lte(contacts.createdAt, end),
    ));

  const activeGroupsResult = await db
    .selectDistinct({ groupId: impactLogGroups.groupId })
    .from(impactLogGroups)
    .innerJoin(impactLogs, eq(impactLogGroups.impactLogId, impactLogs.id))
    .where(where);

  const activeGroupsViaContacts = uniqueContactsResult.length > 0
    ? await db
        .selectDistinct({ groupId: groupMembers.groupId })
        .from(groupMembers)
        .innerJoin(groups, eq(groupMembers.groupId, groups.id))
        .where(and(
          eq(groups.userId, filters.userId),
          inArray(groupMembers.contactId, uniqueContactsResult.map(r => r.contactId)),
        ))
    : [];

  const allGroupIds = new Set([
    ...activeGroupsResult.map(r => r.groupId),
    ...activeGroupsViaContacts.map(r => r.groupId),
  ]);

  const repeatResult = await db
    .select({
      contactId: impactLogContacts.contactId,
      cnt: count(),
    })
    .from(impactLogContacts)
    .innerJoin(impactLogs, eq(impactLogContacts.impactLogId, impactLogs.id))
    .where(where)
    .groupBy(impactLogContacts.contactId);

  const repeatCount = repeatResult.filter(r => Number(r.cnt) >= 2).length;

  let demographicBreakdown: Record<string, any> = {};
  if (uniqueContactsResult.length > 0) {
    const contactIds = uniqueContactsResult.map(r => r.contactId);
    const contactDetails = await db
      .select({
        id: contacts.id,
        age: contacts.age,
        ethnicity: contacts.ethnicity,
        location: contacts.location,
        consentStatus: contacts.consentStatus,
        stage: contacts.stage,
      })
      .from(contacts)
      .where(and(eq(contacts.userId, filters.userId), inArray(contacts.id, contactIds)));

    const consentedContacts = contactDetails.filter(c => c.consentStatus === "given");

    const ethnicityMap: Record<string, number> = {};
    const locationMap: Record<string, number> = {};
    const ageGroups: Record<string, number> = { "under_18": 0, "18_24": 0, "25_34": 0, "35_44": 0, "45_54": 0, "55_plus": 0, "unknown": 0 };
    const stageMap: Record<string, number> = {};

    for (const c of consentedContacts) {
      if (c.ethnicity) {
        for (const eth of c.ethnicity) {
          ethnicityMap[eth] = (ethnicityMap[eth] || 0) + 1;
        }
      }
      if (c.location) {
        locationMap[c.location] = (locationMap[c.location] || 0) + 1;
      }
      if (c.age != null) {
        if (c.age < 18) ageGroups["under_18"]++;
        else if (c.age <= 24) ageGroups["18_24"]++;
        else if (c.age <= 34) ageGroups["25_34"]++;
        else if (c.age <= 44) ageGroups["35_44"]++;
        else if (c.age <= 54) ageGroups["45_54"]++;
        else ageGroups["55_plus"]++;
      } else {
        ageGroups["unknown"]++;
      }
      if (c.stage) {
        stageMap[c.stage] = (stageMap[c.stage] || 0) + 1;
      }
    }

    demographicBreakdown = {
      totalConsented: consentedContacts.length,
      ethnicity: ethnicityMap,
      location: locationMap,
      ageGroups,
      relationshipStage: stageMap,
    };
  }

  return {
    uniqueContacts: uniqueContactsResult.length,
    totalEngagementInstances: Number(totalInstancesResult[0]?.count || 0),
    newContacts: Number(newContactsResult[0]?.count || 0),
    activeGroups: allGroupIds.size,
    repeatEngagementRate: uniqueContactsResult.length > 0
      ? Math.round((repeatCount / uniqueContactsResult.length) * 100) : 0,
    repeatEngagementCount: repeatCount,
    demographicBreakdown,
  };
}

export async function getDeliveryMetrics(filters: ReportFilters) {
  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);

  const eventsInRange = await db
    .select()
    .from(events)
    .where(and(
      eq(events.userId, filters.userId),
      gte(events.startTime, start),
      lte(events.startTime, end),
    ));

  const eventsByType: Record<string, number> = {};
  for (const e of eventsInRange) {
    eventsByType[e.type] = (eventsByType[e.type] || 0) + 1;
  }

  const bookingsInRange = await db
    .select()
    .from(bookings)
    .where(and(
      eq(bookings.userId, filters.userId),
      gte(bookings.startDate, start),
      lte(bookings.startDate, end),
    ));

  const bookingsByClassification: Record<string, number> = {};
  let communityHours = 0;
  for (const b of bookingsInRange) {
    bookingsByClassification[b.classification] = (bookingsByClassification[b.classification] || 0) + 1;
    if (b.startTime && b.endTime) {
      const [sh, sm] = b.startTime.split(":").map(Number);
      const [eh, em] = b.endTime.split(":").map(Number);
      communityHours += (eh * 60 + em - sh * 60 - sm) / 60;
    }
  }

  const programmesInRange = await db
    .select()
    .from(programmes)
    .where(and(
      eq(programmes.userId, filters.userId),
      gte(programmes.startDate, start),
      lte(programmes.startDate, end),
    ));

  const programmesByClassification: Record<string, number> = {};
  let programmesCompleted = 0;
  for (const p of programmesInRange) {
    programmesByClassification[p.classification] = (programmesByClassification[p.classification] || 0) + 1;
    if (p.status === "completed") programmesCompleted++;
  }

  return {
    events: {
      total: eventsInRange.length,
      byType: eventsByType,
    },
    bookings: {
      total: bookingsInRange.length,
      byClassification: bookingsByClassification,
      communityHours: Math.round(communityHours * 10) / 10,
    },
    programmes: {
      total: programmesInRange.length,
      byClassification: programmesByClassification,
      completed: programmesCompleted,
    },
  };
}

export async function getImpactByTaxonomy(filters: ReportFilters) {
  const where = confirmedDebriefConditions(filters);

  const confirmedLogIds = await db
    .select({ id: impactLogs.id })
    .from(impactLogs)
    .where(where);

  if (confirmedLogIds.length === 0) {
    return [];
  }

  const logIds = confirmedLogIds.map(r => r.id);

  const tagConditions = filters.taxonomyIds?.length
    ? and(inArray(impactTags.impactLogId, logIds), inArray(impactTags.taxonomyId, filters.taxonomyIds))
    : inArray(impactTags.impactLogId, logIds);

  const allTags = await db
    .select({
      taxonomyId: impactTags.taxonomyId,
      taxonomyName: impactTaxonomy.name,
      taxonomyColor: impactTaxonomy.color,
      impactLogId: impactTags.impactLogId,
      confidence: impactTags.confidence,
      notes: impactTags.notes,
      evidence: impactTags.evidence,
    })
    .from(impactTags)
    .innerJoin(impactTaxonomy, eq(impactTags.taxonomyId, impactTaxonomy.id))
    .where(tagConditions!);

  const contactsByLog = await db
    .select({
      impactLogId: impactLogContacts.impactLogId,
      contactId: impactLogContacts.contactId,
    })
    .from(impactLogContacts)
    .where(inArray(impactLogContacts.impactLogId, logIds));

  const contactsByLogMap = new Map<number, number[]>();
  for (const row of contactsByLog) {
    if (!contactsByLogMap.has(row.impactLogId)) contactsByLogMap.set(row.impactLogId, []);
    contactsByLogMap.get(row.impactLogId)!.push(row.contactId);
  }

  const quotesByLog = await db
    .select({
      id: impactLogs.id,
      keyQuotes: impactLogs.keyQuotes,
    })
    .from(impactLogs)
    .where(inArray(impactLogs.id, logIds));

  const quotesMap = new Map<number, string[]>();
  for (const row of quotesByLog) {
    if (row.keyQuotes) quotesMap.set(row.id, row.keyQuotes);
  }

  const grouped = new Map<number, {
    taxonomyId: number;
    taxonomyName: string;
    taxonomyColor: string | null;
    debriefCount: number;
    weightedScore: number;
    contactIds: Set<number>;
    quotes: string[];
    evidenceSnippets: string[];
    logIds: Set<number>;
  }>();

  for (const tag of allTags) {
    if (!grouped.has(tag.taxonomyId)) {
      grouped.set(tag.taxonomyId, {
        taxonomyId: tag.taxonomyId,
        taxonomyName: tag.taxonomyName,
        taxonomyColor: tag.taxonomyColor,
        debriefCount: 0,
        weightedScore: 0,
        contactIds: new Set(),
        quotes: [],
        evidenceSnippets: [],
        logIds: new Set(),
      });
    }
    const g = grouped.get(tag.taxonomyId)!;
    if (!g.logIds.has(tag.impactLogId)) {
      g.debriefCount++;
      g.logIds.add(tag.impactLogId);
    }
    g.weightedScore += tag.confidence || 0;

    const logContacts = contactsByLogMap.get(tag.impactLogId) || [];
    for (const cid of logContacts) g.contactIds.add(cid);

    if (tag.evidence) g.evidenceSnippets.push(tag.evidence);
    if (tag.notes) g.evidenceSnippets.push(tag.notes);

    if ((tag.confidence || 0) >= 70) {
      const logQuotes = quotesMap.get(tag.impactLogId) || [];
      for (const q of logQuotes) {
        if (!g.quotes.includes(q)) g.quotes.push(q);
      }
    }
  }

  return Array.from(grouped.values())
    .map(g => ({
      taxonomyId: g.taxonomyId,
      taxonomyName: g.taxonomyName,
      taxonomyColor: g.taxonomyColor,
      debriefCount: g.debriefCount,
      weightedImpactScore: g.weightedScore,
      uniqueContactsAffected: g.contactIds.size,
      representativeQuotes: g.quotes.slice(0, 5),
      evidenceSnippets: g.evidenceSnippets.slice(0, 5),
    }))
    .sort((a, b) => b.weightedImpactScore - a.weightedImpactScore);
}

export async function getOutcomeMovement(filters: ReportFilters) {
  const where = confirmedDebriefConditions(filters);

  const contactIds = await db
    .selectDistinct({ contactId: impactLogContacts.contactId })
    .from(impactLogContacts)
    .innerJoin(impactLogs, eq(impactLogContacts.impactLogId, impactLogs.id))
    .where(where);

  if (contactIds.length === 0) {
    return {
      totalContacts: 0,
      contactsWithMetrics: 0,
      averageChange: { mindset: 0, skill: 0, confidence: 0 },
      positiveMovementPercent: { mindset: 0, skill: 0, confidence: 0 },
      milestoneCount: 0,
    };
  }

  const cIds = contactIds.map(r => r.contactId);

  const contactMetrics = await db
    .select({
      id: contacts.id,
      metrics: contacts.metrics,
    })
    .from(contacts)
    .where(and(eq(contacts.userId, filters.userId), inArray(contacts.id, cIds)));

  let mindsetChanges: number[] = [];
  let skillChanges: number[] = [];
  let confidenceChanges: number[] = [];

  for (const c of contactMetrics) {
    const m = c.metrics as any;
    if (!m) continue;
    if (m.mindset != null) mindsetChanges.push(m.mindset);
    if (m.skill != null) skillChanges.push(m.skill);
    if (m.confidence != null) confidenceChanges.push(m.confidence);
  }

  const avgFn = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;
  const positivePercent = (arr: number[]) => arr.length ? Math.round((arr.filter(v => v > 0).length / arr.length) * 100) : 0;

  const confirmedLogs = await db
    .select({ milestones: impactLogs.milestones })
    .from(impactLogs)
    .where(where);

  let milestoneCount = 0;
  for (const log of confirmedLogs) {
    if (log.milestones) milestoneCount += log.milestones.length;
  }

  return {
    totalContacts: cIds.length,
    contactsWithMetrics: contactMetrics.filter(c => c.metrics && Object.keys(c.metrics as any).length > 0).length,
    averageChange: {
      mindset: avgFn(mindsetChanges),
      skill: avgFn(skillChanges),
      confidence: avgFn(confidenceChanges),
    },
    positiveMovementPercent: {
      mindset: positivePercent(mindsetChanges),
      skill: positivePercent(skillChanges),
      confidence: positivePercent(confidenceChanges),
    },
    milestoneCount,
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

  const activeMemberships = await db
    .select()
    .from(memberships)
    .where(and(
      eq(memberships.userId, filters.userId),
      eq(memberships.status, "active"),
      lte(memberships.startDate, end),
      gte(memberships.endDate, start),
    ));

  let membershipRevenue = 0;
  let totalAllocatedHours = 0;
  const membershipDetails = [];

  for (const m of activeMemberships) {
    membershipRevenue += Number(m.annualFee) || 0;
    totalAllocatedHours += m.venueHireHours || 0;

    const usedBookings = bookingsInRange.filter(b => b.membershipId === m.id);
    let usedHours = 0;
    for (const b of usedBookings) {
      if (b.startTime && b.endTime) {
        const [sh, sm] = b.startTime.split(":").map(Number);
        const [eh, em] = b.endTime.split(":").map(Number);
        usedHours += (eh * 60 + em - sh * 60 - sm) / 60;
      }
    }

    membershipDetails.push({
      id: m.id,
      name: m.name,
      allocatedHours: m.venueHireHours || 0,
      usedHours: Math.round(usedHours * 10) / 10,
      usagePercent: (m.venueHireHours || 0) > 0
        ? Math.round((usedHours / (m.venueHireHours || 1)) * 100) : 0,
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
  const mouSummary = [];

  for (const m of activeMous) {
    const ikv = Number(m.inKindValue) || 0;
    totalInKindValue += ikv;
    mouSummary.push({
      id: m.id,
      title: m.title,
      partnerName: m.partnerName,
      providing: m.providing,
      receiving: m.receiving,
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
      totalAllocatedHours,
      details: membershipDetails,
    },
    mouExchange: {
      active: activeMous.length,
      totalInKindValue: Math.round(totalInKindValue * 100) / 100,
      details: mouSummary,
    },
    programmeCosts,
  };
}

export async function generateNarrative(filters: ReportFilters) {
  const [engagement, delivery, impact, outcomes, value] = await Promise.all([
    getEngagementMetrics(filters),
    getDeliveryMetrics(filters),
    getImpactByTaxonomy(filters),
    getOutcomeMovement(filters),
    getValueContribution(filters),
  ]);

  const topCategories = impact.slice(0, 3);
  const startLabel = new Date(filters.startDate).toLocaleDateString("en-NZ", { month: "long", year: "numeric" });
  const endLabel = new Date(filters.endDate).toLocaleDateString("en-NZ", { month: "long", year: "numeric" });
  const periodLabel = startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;

  const sections: string[] = [];

  sections.push(`## Engagement Summary\n\nDuring ${periodLabel}, ${engagement.uniqueContacts} unique individuals were engaged across ${engagement.totalEngagementInstances} interactions. ${engagement.newContacts} new contacts were added to the network. ${engagement.activeGroups} groups/organisations were actively involved. The repeat engagement rate was ${engagement.repeatEngagementRate}%, with ${engagement.repeatEngagementCount} individuals engaged more than once.`);

  const eventTypes = Object.entries(delivery.events.byType).map(([t, c]) => `${c} ${t.toLowerCase()}${c > 1 ? "s" : ""}`).join(", ");
  sections.push(`## Delivery Overview\n\n${delivery.events.total} events were held (${eventTypes || "none recorded"}). ${delivery.bookings.total} venue bookings totalling ${delivery.bookings.communityHours} community hours were recorded. ${delivery.programmes.total} programmes ran during this period, with ${delivery.programmes.completed} completing.`);

  if (topCategories.length > 0) {
    const catLines = topCategories.map(c => {
      let line = `- **${c.taxonomyName}**: ${c.debriefCount} debriefs, ${c.uniqueContactsAffected} people affected (impact score: ${c.weightedImpactScore})`;
      if (c.representativeQuotes.length > 0) {
        line += `\n  > "${c.representativeQuotes[0]}"`;
      }
      return line;
    }).join("\n");
    sections.push(`## Impact Highlights\n\nThe top impact areas during this period were:\n${catLines}`);
  }

  sections.push(`## Outcome Movement\n\n${outcomes.contactsWithMetrics} of ${outcomes.totalContacts} engaged contacts had tracked metrics. Average scores: mindset ${outcomes.averageChange.mindset}, skill ${outcomes.averageChange.skill}, confidence ${outcomes.averageChange.confidence}. ${outcomes.milestoneCount} milestones were recorded across confirmed debriefs.`);

  sections.push(`## Value & Contribution\n\nTotal revenue from bookings: $${value.revenue.total.toLocaleString()}. ${value.memberships.active} active memberships contributed $${value.memberships.totalRevenue.toLocaleString()}. ${value.mouExchange.active} MOUs delivered $${value.mouExchange.totalInKindValue.toLocaleString()} in in-kind value. Programme costs totalled $${value.programmeCosts.reduce((s, p) => s + p.totalCost, 0).toLocaleString()}.`);

  return {
    narrative: sections.join("\n\n"),
    sections: {
      engagement,
      delivery,
      impact,
      outcomes,
      value,
    },
  };
}

export async function getFullMonthlyReport(filters: ReportFilters) {
  const [engagement, delivery, impact, outcomes, value] = await Promise.all([
    getEngagementMetrics(filters),
    getDeliveryMetrics(filters),
    getImpactByTaxonomy(filters),
    getOutcomeMovement(filters),
    getValueContribution(filters),
  ]);

  return {
    period: {
      startDate: filters.startDate,
      endDate: filters.endDate,
    },
    filters: {
      programmeIds: filters.programmeIds,
      taxonomyIds: filters.taxonomyIds,
      demographicSegments: filters.demographicSegments,
    },
    engagement,
    delivery,
    impact,
    outcomes,
    value,
  };
}
