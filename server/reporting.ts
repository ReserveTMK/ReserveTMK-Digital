import { db } from "./db";
import { sql, eq, and, gte, lte, inArray, count, countDistinct, sum, avg } from "drizzle-orm";
import {
  impactLogs, impactLogContacts, impactLogGroups, impactTags, impactTaxonomy,
  contacts, groups, groupMembers, events, eventAttendance,
  programmes, programmeEvents, bookings, memberships, mous, venues,
  milestones, relationshipStageHistory,
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

export async function getEngagementMetrics(filters: ReportFilters) {
  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);
  const where = confirmedDebriefConditions(filters);
  const lensContactIds = await getCommunityLensContactIds(filters);

  let uniqueContactsResult = await db
    .selectDistinct({ contactId: impactLogContacts.contactId })
    .from(impactLogContacts)
    .innerJoin(impactLogs, eq(impactLogContacts.impactLogId, impactLogs.id))
    .where(where);

  if (lensContactIds) {
    uniqueContactsResult = uniqueContactsResult.filter(r => lensContactIds.has(r.contactId));
  }

  let totalInstancesCount: number;
  if (lensContactIds) {
    const allInstances = await db
      .select({ contactId: impactLogContacts.contactId })
      .from(impactLogContacts)
      .innerJoin(impactLogs, eq(impactLogContacts.impactLogId, impactLogs.id))
      .where(where);
    totalInstancesCount = allInstances.filter(r => lensContactIds.has(r.contactId)).length;
  } else {
    const totalInstancesResult = await db
      .select({ count: count() })
      .from(impactLogContacts)
      .innerJoin(impactLogs, eq(impactLogContacts.impactLogId, impactLogs.id))
      .where(where);
    totalInstancesCount = Number(totalInstancesResult[0]?.count || 0);
  }

  let newContactsCount: number;
  if (lensContactIds) {
    const newContactsList = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(
        eq(contacts.userId, filters.userId),
        gte(contacts.createdAt, start),
        lte(contacts.createdAt, end),
      ));
    newContactsCount = newContactsList.filter(r => lensContactIds.has(r.id)).length;
  } else {
    const newContactsResult = await db
      .select({ count: count() })
      .from(contacts)
      .where(and(
        eq(contacts.userId, filters.userId),
        gte(contacts.createdAt, start),
        lte(contacts.createdAt, end),
      ));
    newContactsCount = Number(newContactsResult[0]?.count || 0);
  }

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

  let repeatResult = await db
    .select({
      contactId: impactLogContacts.contactId,
      cnt: count(),
    })
    .from(impactLogContacts)
    .innerJoin(impactLogs, eq(impactLogContacts.impactLogId, impactLogs.id))
    .where(where)
    .groupBy(impactLogContacts.contactId);

  if (lensContactIds) {
    repeatResult = repeatResult.filter(r => lensContactIds.has(r.contactId));
  }

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
    totalEngagementInstances: totalInstancesCount,
    newContacts: newContactsCount,
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
    communityLensApplied: false,
  };
}

export async function getImpactByTaxonomy(filters: ReportFilters) {
  const where = confirmedDebriefConditions(filters);
  const lensContactIds = await getCommunityLensContactIds(filters);

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
    const cid = row.contactId;
    if (lensContactIds && !lensContactIds.has(cid)) continue;
    if (!contactsByLogMap.has(row.impactLogId)) contactsByLogMap.set(row.impactLogId, []);
    contactsByLogMap.get(row.impactLogId)!.push(cid);
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
  const lensContactIds = await getCommunityLensContactIds(filters);
  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);

  let contactIds = await db
    .selectDistinct({ contactId: impactLogContacts.contactId })
    .from(impactLogContacts)
    .innerJoin(impactLogs, eq(impactLogContacts.impactLogId, impactLogs.id))
    .where(where);

  if (lensContactIds) {
    contactIds = contactIds.filter(r => lensContactIds.has(r.contactId));
  }

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

  let milestonesFromTable = await db
    .select()
    .from(milestones)
    .where(and(
      eq(milestones.userId, filters.userId),
      gte(milestones.createdAt, start),
      lte(milestones.createdAt, end),
    ));

  if (lensContactIds) {
    milestonesFromTable = milestonesFromTable.filter(m =>
      m.linkedContactId && lensContactIds.has(m.linkedContactId)
    );
  }

  const totalMilestoneCount = milestoneCount + milestonesFromTable.length;

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
    milestoneCount: totalMilestoneCount,
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
    communityLensApplied: false,
  };
}

export async function generateNarrative(
  filters: ReportFilters,
  legacyContext?: { metrics: any; highlights: string[]; reportCount: number } | null,
  narrativeStyle: "compliance" | "story" = "compliance",
) {
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
  const lm = legacyContext?.metrics;
  const hasLegacy = legacyContext && legacyContext.reportCount > 0 && lm;

  const lens = filters.communityLens;
  const lensLabel = lens === "maori" ? "Maori (matawaka)" : lens === "pasifika" ? "Pasifika" : lens === "maori_pasifika" ? "Maori and Pasifika" : null;

  const sections: string[] = [];

  if (narrativeStyle === "story") {
    let whoText = `## Who Our Community Is\n\n`;
    if (lensLabel) {
      whoText += `Focusing on our ${lensLabel} community, `;
    } else {
      whoText += `Across our community, `;
    }
    whoText += `${engagement.uniqueContacts} people walked through our doors and engaged with us during ${periodLabel}.`;
    if (hasLegacy) {
      whoText += ` This builds on a history captured in ${legacyContext.reportCount} legacy report${legacyContext.reportCount > 1 ? "s" : ""}.`;
    }
    whoText += ` Among them, ${engagement.newContacts} were new faces joining our network for the first time.`;
    whoText += ` ${engagement.activeGroups} groups and organisations were part of the journey, and ${engagement.repeatEngagementRate}% of our people came back more than once — showing the depth of connection being built.`;
    sections.push(whoText);

    let happeningText = `## What's Happening\n\n`;
    const eventTypes = Object.entries(delivery.events.byType).map(([t, c]) => `${c} ${t.toLowerCase()}${c > 1 ? "s" : ""}`).join(", ");
    happeningText += `We hosted ${delivery.events.total} events (${eventTypes || "none recorded"})`;
    if (hasLegacy && lm.activationsTotal > 0) {
      happeningText += `, alongside ${lm.activationsTotal} activations from our legacy period`;
    }
    happeningText += `. ${delivery.bookings.total} venue bookings contributed ${delivery.bookings.communityHours} hours of community activity.`;
    happeningText += ` ${delivery.programmes.total} programmes were running, with ${delivery.programmes.completed} reaching completion — each one a story of growth and possibility.`;
    sections.push(happeningText);

    if (topCategories.length > 0) {
      let changeText = `## What We're Seeing Change\n\n`;
      if (lensLabel) {
        changeText += `Within our ${lensLabel} community, the `;
      } else {
        changeText += `The `;
      }
      changeText += `most significant shifts are happening in:\n`;
      changeText += topCategories.map(c => {
        let line = `- **${c.taxonomyName}**: touching ${c.uniqueContactsAffected} lives across ${c.debriefCount} sessions`;
        if (c.representativeQuotes.length > 0) {
          line += `\n  > "${c.representativeQuotes[0]}"`;
        }
        return line;
      }).join("\n");
      changeText += `\n\n${outcomes.contactsWithMetrics} people have measurable growth tracked — with confidence shifting positively for ${outcomes.positiveMovementPercent.confidence}% of them. ${outcomes.milestoneCount} milestones mark the tangible progress our community is making.`;
      sections.push(changeText);
    }

    sections.push(`## [Participant Story]\n\n*[Insert a participant story here — a real example of change, growth, or connection that brings the data to life.]*`);

    sections.push(`## [What's Next]\n\n*[Share what's coming up — upcoming programmes, community goals, or areas of focus for the next period.]*`);
  } else {
    let engText = `## Who We Reached\n\nDuring ${periodLabel}`;
    if (lensLabel) {
      engText += ` (filtered to ${lensLabel} community)`;
    }
    if (hasLegacy) {
      engText += ` (combining data from ${legacyContext.reportCount} legacy report${legacyContext.reportCount > 1 ? "s" : ""} with live tracking)`;
    }
    engText += `, ${engagement.uniqueContacts} unique individuals were engaged across ${engagement.totalEngagementInstances} interactions.`;
    if (hasLegacy && lm.foottrafficUnique > 0) {
      engText += ` Legacy reports recorded ${lm.foottrafficUnique.toLocaleString()} hub foot traffic (unique visitors).`;
    }
    engText += ` ${engagement.newContacts} new contacts were added to the network. ${engagement.activeGroups} groups/organisations were actively involved. The repeat engagement rate was ${engagement.repeatEngagementRate}%, with ${engagement.repeatEngagementCount} individuals engaged more than once.`;
    sections.push(engText);

    const eventTypes = Object.entries(delivery.events.byType).map(([t, c]) => `${c} ${t.toLowerCase()}${c > 1 ? "s" : ""}`).join(", ");
    let delText = `## What We Delivered\n\n${delivery.events.total} events were held (${eventTypes || "none recorded"}).`;
    if (hasLegacy && lm.activationsTotal > 0) {
      const parts: string[] = [];
      parts.push(`${lm.activationsTotal} total activations`);
      if (lm.activationsWorkshops > 0) parts.push(`${lm.activationsWorkshops} workshops`);
      if (lm.activationsMentoring > 0) parts.push(`${lm.activationsMentoring} mentoring sessions`);
      if (lm.activationsEvents > 0) parts.push(`${lm.activationsEvents} events`);
      if (lm.activationsPartnerMeetings > 0) parts.push(`${lm.activationsPartnerMeetings} partner meetings`);
      delText += ` Legacy reports contributed ${parts.join(", ")}.`;
    }
    const combinedBookings = delivery.bookings.total + (hasLegacy ? lm.bookingsTotal || 0 : 0);
    delText += ` ${combinedBookings} venue bookings were recorded across the period`;
    if (hasLegacy && lm.bookingsTotal > 0) {
      delText += ` (${delivery.bookings.total} live, ${lm.bookingsTotal} legacy)`;
    }
    delText += ` totalling ${delivery.bookings.communityHours} tracked community hours. ${delivery.programmes.total} programmes ran during this period, with ${delivery.programmes.completed} completing.`;
    sections.push(delText);

    if (topCategories.length > 0) {
      const catLines = topCategories.map(c => {
        let line = `- **${c.taxonomyName}**: ${c.debriefCount} debriefs, ${c.uniqueContactsAffected} people affected (impact score: ${c.weightedImpactScore})`;
        if (c.representativeQuotes.length > 0) {
          line += `\n  > "${c.representativeQuotes[0]}"`;
        }
        return line;
      }).join("\n");
      let impactHeader = `## What Shifted`;
      if (lensLabel) impactHeader += ` (${lensLabel})`;
      sections.push(`${impactHeader}\n\nThe top impact areas during this period were:\n${catLines}`);
    }

    sections.push(`## Outcome Movement\n\n${outcomes.contactsWithMetrics} of ${outcomes.totalContacts} engaged contacts had tracked metrics. Average scores: mindset ${outcomes.averageChange.mindset}, skill ${outcomes.averageChange.skill}, confidence ${outcomes.averageChange.confidence}. ${outcomes.milestoneCount} milestones were recorded across confirmed debriefs.`);

    sections.push(`## Value & Contribution\n\nTotal revenue from bookings: $${value.revenue.total.toLocaleString()}. ${value.memberships.active} active memberships contributed $${value.memberships.totalRevenue.toLocaleString()}. ${value.mouExchange.active} MOUs delivered $${value.mouExchange.totalInKindValue.toLocaleString()} in in-kind value. Programme costs totalled $${value.programmeCosts.reduce((s, p) => s + p.totalCost, 0).toLocaleString()}.`);

    sections.push(`## [Participant Story]\n\n*[Insert a participant story here — a real example that illustrates the impact described above.]*`);

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
      engagement,
      delivery,
      impact,
      outcomes,
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
      communityLens: filters.communityLens,
    },
    engagement,
    delivery,
    impact,
    outcomes,
    value,
  };
}
