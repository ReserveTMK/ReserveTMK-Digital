import type { Express } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { impactLogContacts, impactLogs } from "@shared/schema";
import {
  getFullMonthlyReport,
  generateNarrative,
  getCommunityComparison,
  getTamakiOraAlignment,
  getDeliveryMetrics,
  getTrendMetrics,
  getCohortMetrics,
  getProgrammeAttributedOutcomes,
  getStandoutMoments,
  getOperatorInsights,
  getParticipantTransformationStories,
  getPeopleTierBreakdown,
  getImpactTagHeatmap,
  getTheoryOfChangeAlignment,
  getGrowthStory,
  getOutcomeChain,
  getQuarterlyMilestones,
  getTaxonomyBreakdown,
  getDebriefQuotesForReport,
  getConcernArcs,
  PASIFIKA_ETHNICITIES,
  type ReportFilters,
  type CohortDefinition,
  type OrgProfileContext,
  type FunderContext,
} from "../reporting";
import {
  renderMonthlyReport,
  renderQuarterlyReport,
  type MonthlyReportData,
  type QuarterlyReportData,
  type MaoriPipelineData,
} from "../report-renderer";
import { getNZWeekStart, getNZWeekEnd } from "@shared/nz-week";
import { claudeJSON, AIKeyMissingError } from "../replit_integrations/anthropic/client";
import {
  parseId,
  parseStr,
  getReportCacheKey,
  deduplicatedReportCall,
  MONTH_NAMES,
  LEGACY_METRIC_KEYS,
  METRIC_KEY_TO_SNAPSHOT_FIELD,
  buildExtractionPrompt,
} from "./_helpers";

export function registerReportRoutes(app: Express) {
  // === REPORTING ROUTES ===

  // HTML monthly report — standalone branded page, open in browser, print to PDF
  const handleMonthlyReport = async (req: any, res: any) => {
    try {
      const userId = (req.user as any).claims.sub;
      const month = parseStr(req.query.month); // YYYY-MM
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ message: "month parameter required (YYYY-MM)" });
      }

      const [yearStr, monthStr] = month.split("-");
      const year = parseInt(yearStr, 10);
      const monthNum = parseInt(monthStr, 10);
      const startDate = `${month}-01`;
      const endDate = monthNum === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(monthNum + 1).padStart(2, "0")}-01`;

      const LOCAL_MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const monthName = LOCAL_MONTH_NAMES[monthNum - 1];

      // Determine FY (Jul-Jun)
      const fyStart = monthNum >= 7 ? year : year - 1;
      const fyEnd = fyStart + 1;
      const fyLabel = `FY${String(fyEnd).slice(2)}`;
      const fyStartDate = `${fyStart}-07-01`;

      const funderName = parseStr(req.query.funder) || undefined;

      // Look up funder profile for community lens filtering
      let communityLens: "maori" | "pasifika" | "all" | undefined;
      if (funderName) {
        const allFunders = await storage.getFunders(userId);
        const funderRecord = allFunders.find(f => f.name === funderName);
        if (funderRecord?.communityLens && funderRecord.communityLens !== "all") {
          communityLens = funderRecord.communityLens as "maori" | "pasifika";
        }
      }

      const filters: ReportFilters = { userId, startDate, endDate, communityLens };
      const ytdFilters: ReportFilters = { userId, startDate: fyStartDate, endDate };

      // Pull all data in parallel
      const [delivery, ytdDelivery, ftRows, ytdFtRows, communityRows, spaceUseRows, debriefRows] = await Promise.all([
        getDeliveryMetrics(filters),
        getDeliveryMetrics(ytdFilters),
        db.execute(sql`
          SELECT SUM(count) as total
          FROM daily_foot_traffic
          WHERE user_id = ${userId}
          AND date >= ${new Date(startDate)} AND date < ${new Date(endDate)}
        `),
        db.execute(sql`
          SELECT SUM(count) as total
          FROM daily_foot_traffic
          WHERE user_id = ${userId}
          AND date >= ${new Date(fyStartDate)} AND date < ${new Date(endDate)}
        `),
        db.execute(sql`
          SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN relationship_stage = 'kakano' OR (relationship_stage IS NULL AND stage IS NULL) THEN 1 END) as kakano,
            COUNT(CASE WHEN relationship_stage = 'tipu' THEN 1 END) as tipu,
            COUNT(CASE WHEN relationship_stage = 'ora' THEN 1 END) as ora,
            COUNT(CASE WHEN ethnicity @> ARRAY['Māori']::text[] THEN 1 END) as maori,
            COUNT(CASE WHEN ethnicity && ARRAY[${sql.join(PASIFIKA_ETHNICITIES.map(e => sql`${e}`), sql`, `)}]::text[] THEN 1 END) as pasifika,
            COUNT(CASE WHEN is_rangatahi = true THEN 1 END) as rangatahi
          FROM contacts
          WHERE user_id = ${userId}
          AND active = true AND is_archived = false
          AND (is_innovator = true OR is_community_member = true)
        `),
        db.execute(sql`
          SELECT
            COALESCE(g.name, b.booker_name) as organisation,
            b.classification as type,
            COUNT(*) as bookings,
            BOOL_OR(g.is_maori) as is_maori,
            BOOL_OR(g.is_pasifika) as is_pasifika,
            BOOL_OR(g.serves_maori) as serves_maori,
            BOOL_OR(g.serves_pasifika) as serves_pasifika
          FROM bookings b
          LEFT JOIN groups g ON g.id = b.booker_group_id
          WHERE b.user_id = ${userId}
            AND b.start_date >= ${new Date(startDate)}
            AND b.start_date < ${new Date(endDate)}
            AND b.status IN ('confirmed', 'completed')
            AND b.classification NOT IN ('Meeting', 'Internal')
          GROUP BY COALESCE(g.name, b.booker_name), b.classification
          ORDER BY organisation
        `),
        db.execute(sql`
          SELECT il.title, il.summary as notes
          FROM impact_logs il
          WHERE il.user_id = ${userId}
          AND il.status = 'confirmed'
          AND il.confirmed_at >= ${new Date(startDate)}
          AND il.confirmed_at < ${new Date(endDate)}
          AND LENGTH(COALESCE(il.summary, '')) > 50
          ORDER BY il.confirmed_at
        `),
      ]);

      // Delivery numbers
      const footTraffic = Number((ftRows as any).rows?.[0]?.total || 0);
      const capabilityBuilding = (delivery.mentoringSessions || 0) + (delivery.programmes?.total || 0);
      const ytdFootTraffic = Number((ytdFtRows as any).rows?.[0]?.total || 0);
      const ytdCapability = (ytdDelivery.mentoringSessions || 0) + (ytdDelivery.programmes?.total || 0);

      // Community snapshot
      const comm = (communityRows as any).rows?.[0] || {};
      const kakano = Number(comm.kakano || 0);
      const tipu = Number(comm.tipu || 0);
      const ora = Number(comm.ora || 0);

      // Space use
      const spaceUse = ((spaceUseRows as any).rows || []).map((r: any) => ({
        organisation: r.organisation || "Unknown",
        type: r.type || "",
        bookings: Number(r.bookings || 0),
        maori: r.is_maori === true,
        pasifika: r.is_pasifika === true,
        servesMaori: r.serves_maori === true,
        servesPasifika: r.serves_pasifika === true,
      }));

      // Updates from debriefs
      const updateItems = ((debriefRows as any).rows || []).map((r: any) => {
        const title = r.title || "Update";
        const notes = (r.notes || "").slice(0, 200);
        return `${title} — ${notes}`;
      });

      // Taxonomy breakdown for report (non-fatal)
      let taxonomyBreakdown: Array<{ categoryName: string; funderName: string; entityCounts: Record<string, number>; total: number }> = [];
      try {
        const rawTaxBreakdown = await getTaxonomyBreakdown({ userId, startDate, endDate });
        const taxMap = new Map<string, { funderName: string; entityCounts: Record<string, number>; total: number }>();
        for (const row of rawTaxBreakdown) {
          if (!taxMap.has(row.categoryName)) {
            taxMap.set(row.categoryName, { funderName: row.funderName, entityCounts: {}, total: 0 });
          }
          const entry = taxMap.get(row.categoryName)!;
          entry.entityCounts[row.entityType] = (entry.entityCounts[row.entityType] || 0) + row.count;
          entry.total += row.count;
        }
        taxonomyBreakdown = Array.from(taxMap.entries()).map(([categoryName, data]) => ({
          categoryName,
          ...data,
        }));
      } catch (err: any) {
        console.error("Taxonomy breakdown failed (non-fatal):", err.message);
      }

      // Operator insights from confirmed debriefs
      let operatorInsights;
      try {
        operatorInsights = await getOperatorInsights(filters);
      } catch (err: any) {
        console.error("Operator insights failed (non-fatal):", err.message);
      }

      const reportData: MonthlyReportData = {
        period: { month: month, year, label: `${monthName} ${year}`, fyLabel },
        funderName,
        deliveryNumbers: {
          activations: delivery.totalActivations || 0,
          capabilityBuilding,
          footTraffic,
          ytdActivations: ytdDelivery.totalActivations || 0,
          ytdCapability,
          ytdFootTraffic,
        },
        communitySnapshot: {
          maori: Number(comm.maori || 0),
          pasifika: Number(comm.pasifika || 0),
          rangatahi: Number(comm.rangatahi || 0),
          total: Number(comm.total || 0),
          kakano,
          tipu,
          ora,
          innovatorTotal: kakano + tipu + ora,
        },
        spaceUse,
        updates: { "Updates": updateItems },
        quotes: Array.isArray(req.body?.quotes) ? req.body.quotes : [],
        plannedNextMonth: Array.isArray(req.body?.plannedNext) ? req.body.plannedNext : [],
        taxonomyBreakdown: taxonomyBreakdown.length > 0 ? taxonomyBreakdown : undefined,
        operatorInsights: operatorInsights || undefined,
      };

      const html = renderMonthlyReport(reportData);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (err: any) {
      console.error("Monthly HTML report error:", err);
      res.status(500).json({ message: "Failed to generate monthly report", error: err.message });
    }
  };
  app.get("/api/reports/html/monthly", isAuthenticated, handleMonthlyReport);
  app.post("/api/reports/html/monthly", isAuthenticated, handleMonthlyReport);

  // ── Quarterly branded HTML report ──────────────────────────────────────

  const handleQuarterlyReport = async (req: any, res: any) => {
    try {
      const userId = (req.user as any).claims.sub;
      const startDate = parseStr(req.query.startDate);
      const endDate = parseStr(req.query.endDate);
      const quarter = parseStr(req.query.quarter); // e.g. "2026-Q1"

      if (!startDate || !endDate || !quarter) {
        return res.status(400).json({ message: "startDate, endDate, and quarter params required" });
      }

      const funderName = parseStr(req.query.funder) || undefined;

      // Look up funder profile for community lens filtering
      let qCommunityLens: "maori" | "pasifika" | "all" | undefined;
      if (funderName) {
        const allFunders = await storage.getFunders(userId);
        const funderRecord = allFunders.find(f => f.name === funderName);
        if (funderRecord?.communityLens && funderRecord.communityLens !== "all") {
          qCommunityLens = funderRecord.communityLens as "maori" | "pasifika";
        }
      }

      const [yearStr, qStr] = quarter.split("-Q");
      const year = parseInt(yearStr, 10);
      const qNum = parseInt(qStr, 10);
      const quarterLabel = `Q${qNum} ${year}`;

      // Determine the 3 months in the quarter
      const qStartMonth = (qNum - 1) * 3; // 0-indexed (Q1=0, Q2=3, etc.)
      const months: string[] = [];
      for (let i = 0; i < 3; i++) {
        const m = qStartMonth + i;
        const mYear = year;
        months.push(`${mYear}-${String(m + 1).padStart(2, "0")}`);
      }

      // Determine FY (Jul-Jun)
      const fyStartMonth = months[0].split("-").map(Number);
      const fyStart = fyStartMonth[1] >= 7 ? fyStartMonth[0] : fyStartMonth[0] - 1;
      const fyEnd = fyStart + 1;
      const fyLabel = `FY${String(fyEnd).slice(2)}`;
      const fyStartDate = `${fyStart}-07-01`;

      // Pull delivery metrics per month + full quarter
      const monthDeliveries = await Promise.all(
        months.map(m => {
          const mStart = `${m}-01`;
          const [y, mo] = m.split("-").map(Number);
          const mEnd = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, "0")}-01`;
          return getDeliveryMetrics({ userId, startDate: mStart, endDate: mEnd });
        })
      );

      // YTD delivery
      const ytdDelivery = await getDeliveryMetrics({ userId, startDate: fyStartDate, endDate });

      // Foot traffic per month + total
      const ftByMonth: Record<string, number> = {};
      let ftTotal = 0;
      for (const m of months) {
        const mStart = `${m}-01`;
        const [y, mo] = m.split("-").map(Number);
        const mEnd = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, "0")}-01`;
        const ftRow = await db.execute(sql`
          SELECT COALESCE(SUM(count), 0) as total FROM daily_foot_traffic
          WHERE user_id = ${userId} AND date >= ${new Date(mStart)} AND date < ${new Date(mEnd)}
        `);
        const val = Number((ftRow as any).rows?.[0]?.total || 0);
        ftByMonth[m] = val;
        ftTotal += val;
      }

      // YTD foot traffic
      const ytdFtRow = await db.execute(sql`
        SELECT COALESCE(SUM(count), 0) as total FROM daily_foot_traffic
        WHERE user_id = ${userId} AND date >= ${new Date(fyStartDate)} AND date < ${new Date(endDate)}
      `);
      const ytdFootTraffic = Number((ytdFtRow as any).rows?.[0]?.total || 0);

      // Community snapshot
      const communityRows = await db.execute(sql`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN relationship_stage = 'kakano' OR (relationship_stage IS NULL AND stage IS NULL) THEN 1 END) as kakano,
          COUNT(CASE WHEN relationship_stage = 'tipu' THEN 1 END) as tipu,
          COUNT(CASE WHEN relationship_stage = 'ora' THEN 1 END) as ora,
          COUNT(CASE WHEN ethnicity @> ARRAY['Māori']::text[] THEN 1 END) as maori,
          COUNT(CASE WHEN ethnicity && ARRAY[${sql.join(PASIFIKA_ETHNICITIES.map(e => sql`${e}`), sql`, `)}]::text[] THEN 1 END) as pasifika,
          COUNT(CASE WHEN is_rangatahi = true THEN 1 END) as rangatahi
        FROM contacts
        WHERE user_id = ${userId}
        AND active = true AND is_archived = false
        AND (is_innovator = true OR is_community_member = true)
      `);
      const comm = (communityRows as any).rows?.[0] || {};
      const kakano = Number(comm.kakano || 0);
      const tipu = Number(comm.tipu || 0);
      const ora = Number(comm.ora || 0);

      // Space use for the quarter
      const spaceUseRows = await db.execute(sql`
        SELECT
          COALESCE(g.name, b.booker_name) as organisation,
          b.classification as type,
          COUNT(*) as bookings,
          BOOL_OR(g.is_maori) as is_maori,
          BOOL_OR(g.is_pasifika) as is_pasifika,
          BOOL_OR(g.serves_maori) as serves_maori,
          BOOL_OR(g.serves_pasifika) as serves_pasifika
        FROM bookings b
        LEFT JOIN groups g ON g.id = b.booker_group_id
        WHERE b.user_id = ${userId}
          AND b.start_date >= ${new Date(startDate)}
          AND b.start_date < ${new Date(endDate)}
          AND b.status IN ('confirmed', 'completed')
          AND b.classification NOT IN ('Meeting', 'Internal')
        GROUP BY COALESCE(g.name, b.booker_name), b.classification
        ORDER BY organisation
      `);
      const spaceUse = ((spaceUseRows as any).rows || []).map((r: any) => ({
        organisation: r.organisation || "Unknown",
        type: r.type || "",
        bookings: Number(r.bookings || 0),
        maori: r.is_maori === true,
        pasifika: r.is_pasifika === true,
        servesMaori: r.serves_maori === true,
        servesPasifika: r.serves_pasifika === true,
      }));

      // Debrief updates
      const debriefRows = await db.execute(sql`
        SELECT il.title, il.notes
        FROM impact_logs il
        WHERE il.user_id = ${userId}
        AND il.status = 'confirmed'
        AND il.confirmed_at >= ${new Date(startDate)}
        AND il.confirmed_at < ${new Date(endDate)}
        AND LENGTH(COALESCE(il.notes, '')) > 50
        ORDER BY il.confirmed_at
      `);
      const updateItems = ((debriefRows as any).rows || []).map((r: any) => {
        const title = r.title || "Update";
        const notes = (r.notes || "").slice(0, 200);
        return `${title} — ${notes}`;
      });

      // Build delivery numbers array (per-month breakdown)
      const SHORT_MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const deliveryNumbers: QuarterlyReportData["deliveryNumbers"] = [
        {
          metric: "Activations*",
          values: Object.fromEntries(months.map((m, i) => [m, monthDeliveries[i].totalActivations])),
          quarterTotal: monthDeliveries.reduce((s, d) => s + d.totalActivations, 0),
          ytd: ytdDelivery.totalActivations,
        },
        {
          metric: "Capability Building†",
          values: Object.fromEntries(months.map((m, i) => [m, monthDeliveries[i].mentoringSessions + monthDeliveries[i].programmes.total])),
          quarterTotal: monthDeliveries.reduce((s, d) => s + d.mentoringSessions + d.programmes.total, 0),
          ytd: ytdDelivery.mentoringSessions + ytdDelivery.programmes.total,
        },
        {
          metric: "Foot Traffic",
          values: Object.fromEntries(months.map(m => [m, ftByMonth[m] || 0])),
          quarterTotal: ftTotal,
          ytd: ytdFootTraffic,
        },
      ];

      // ── Māori & Pasifika Pipeline ────────────────────────────────────────
      const [maoriInnovRows, pasifikaInnovRows, maoriMentoringRows, maoriProgRows, maoriProgressionRows] = await Promise.all([
        db.execute(sql`
          SELECT
            COALESCE(relationship_stage, 'kakano') as stage, COUNT(*) as count
          FROM contacts
          WHERE user_id = ${userId} AND active = true AND is_archived = false AND is_innovator = true
            AND ethnicity @> ARRAY['Māori']::text[]
          GROUP BY relationship_stage
        `),
        db.execute(sql`
          SELECT
            COALESCE(relationship_stage, 'kakano') as stage, COUNT(*) as count
          FROM contacts
          WHERE user_id = ${userId} AND active = true AND is_archived = false AND is_innovator = true
            AND ethnicity && ARRAY[${sql.join(PASIFIKA_ETHNICITIES.map(e => sql`${e}`), sql`, `)}]::text[]
            AND NOT (ethnicity @> ARRAY['Māori']::text[])
          GROUP BY relationship_stage
        `),
        db.execute(sql`
          SELECT COUNT(DISTINCT mr.contact_id) as count
          FROM mentoring_relationships mr
          JOIN contacts c ON c.id = mr.contact_id
          WHERE mr.status = 'active' AND c.user_id = ${userId}
            AND c.ethnicity @> ARRAY['Māori']::text[]
        `),
        db.execute(sql`
          SELECT COUNT(DISTINCT c.id) as count
          FROM programmes p, unnest(p.attendees) att_id
          JOIN contacts c ON c.id = att_id
          WHERE p.user_id = ${userId} AND p.status != 'cancelled'
            AND p.start_date >= ${new Date(startDate)} AND p.start_date < ${new Date(endDate)}
            AND c.ethnicity @> ARRAY['Māori']::text[]
        `),
        db.execute(sql`
          SELECT COUNT(*) as count
          FROM relationship_stage_history rsh
          JOIN contacts c ON c.id = rsh.entity_id
          WHERE rsh.entity_type = 'contact'
            AND rsh.changed_at >= ${new Date(startDate)} AND rsh.changed_at < ${new Date(endDate)}
            AND c.ethnicity @> ARRAY['Māori']::text[]
            AND c.user_id = ${userId}
        `),
      ]);

      const maoriStages: Record<string, number> = {};
      for (const r of (maoriInnovRows as any).rows || []) maoriStages[r.stage] = Number(r.count);
      const pasifikaStages: Record<string, number> = {};
      for (const r of (pasifikaInnovRows as any).rows || []) pasifikaStages[r.stage] = Number(r.count);

      const maoriTotal = Object.values(maoriStages).reduce((s, v) => s + v, 0);
      const pasifikaTotal = Object.values(pasifikaStages).reduce((s, v) => s + v, 0);

      // Previous quarter metrics for comparison
      let previousQuarter: MaoriPipelineData["previousQuarter"] = undefined;
      try {
        const prevQStart = new Date(startDate);
        prevQStart.setMonth(prevQStart.getMonth() - 3);
        const prevStartStr = prevQStart.toISOString().split("T")[0];
        const prevDelivery = await getDeliveryMetrics({ userId, startDate: prevStartStr, endDate: startDate });
        const prevFt = await db.execute(sql`
          SELECT COALESCE(SUM(count), 0) as total FROM daily_foot_traffic
          WHERE user_id = ${userId} AND date >= ${prevQStart} AND date < ${new Date(startDate)}
        `);
        const prevMaoriCount = await db.execute(sql`
          SELECT COUNT(*) as count FROM contacts
          WHERE user_id = ${userId} AND active = true AND is_archived = false AND is_innovator = true
            AND ethnicity @> ARRAY['Māori']::text[]
        `);
        previousQuarter = {
          innovatorTotal: Number((prevMaoriCount as any).rows?.[0]?.count || 0),
          activations: prevDelivery.totalActivations,
          footTraffic: Number((prevFt as any).rows?.[0]?.total || 0),
          capabilityBuilding: prevDelivery.mentoringSessions + prevDelivery.programmes.total,
        };
      } catch {}

      // Māori orgs using space (groups with Māori-identified contacts as bookers)
      const maoriOrgRows = await db.execute(sql`
        SELECT COALESCE(g.name, b.booker_name) as name, COUNT(*) as bookings
        FROM bookings b
        LEFT JOIN groups g ON g.id = b.booker_group_id
        LEFT JOIN contacts c ON c.id = b.booker_id
        WHERE b.user_id = ${userId}
          AND b.start_date >= ${new Date(startDate)} AND b.start_date < ${new Date(endDate)}
          AND b.status IN ('confirmed', 'completed')
          AND c.ethnicity @> ARRAY['Māori']::text[]
        GROUP BY COALESCE(g.name, b.booker_name)
        ORDER BY bookings DESC
      `);

      const maoriPipeline: MaoriPipelineData = {
        innovators: { total: maoriTotal, kakano: maoriStages["kakano"] || 0, tipu: maoriStages["tipu"] || 0, ora: maoriStages["ora"] || 0 },
        inMentoring: Number((maoriMentoringRows as any).rows?.[0]?.count || 0),
        inProgrammes: Number((maoriProgRows as any).rows?.[0]?.count || 0),
        stageProgressions: Number((maoriProgressionRows as any).rows?.[0]?.count || 0),
        pasifikaInnovators: { total: pasifikaTotal, kakano: pasifikaStages["kakano"] || 0, tipu: pasifikaStages["tipu"] || 0, ora: pasifikaStages["ora"] || 0 },
        maoriOrgs: ((maoriOrgRows as any).rows || []).map((r: any) => ({ name: r.name || "Unknown", bookings: Number(r.bookings) })),
        previousQuarter,
      };

      // Taxonomy breakdown for quarterly report (non-fatal)
      let qTaxonomyBreakdown: Array<{ categoryName: string; funderName: string; entityCounts: Record<string, number>; total: number }> = [];
      try {
        const rawQTaxBreakdown = await getTaxonomyBreakdown({ userId, startDate, endDate });
        const qTaxMap = new Map<string, { funderName: string; entityCounts: Record<string, number>; total: number }>();
        for (const row of rawQTaxBreakdown) {
          if (!qTaxMap.has(row.categoryName)) {
            qTaxMap.set(row.categoryName, { funderName: row.funderName, entityCounts: {}, total: 0 });
          }
          const entry = qTaxMap.get(row.categoryName)!;
          entry.entityCounts[row.entityType] = (entry.entityCounts[row.entityType] || 0) + row.count;
          entry.total += row.count;
        }
        qTaxonomyBreakdown = Array.from(qTaxMap.entries()).map(([categoryName, data]) => ({
          categoryName,
          ...data,
        }));
      } catch (err: any) {
        console.error("Quarterly taxonomy breakdown failed (non-fatal):", err.message);
      }

      // Operator insights from confirmed debriefs
      let qOperatorInsights;
      let qConcernArcs;
      try {
        const qInsightFilters: ReportFilters = { userId, startDate, endDate, communityLens: qCommunityLens };
        const [insights, arcs] = await Promise.all([
          getOperatorInsights(qInsightFilters),
          getConcernArcs(qInsightFilters),
        ]);
        qOperatorInsights = insights;
        qConcernArcs = arcs;
      } catch (err: any) {
        console.error("Quarterly operator insights/concern arcs failed (non-fatal):", err.message);
      }

      const reportData: QuarterlyReportData = {
        period: {
          quarter: quarterLabel,
          year,
          label: `${quarterLabel} (${SHORT_MONTH_NAMES[qStartMonth]}–${SHORT_MONTH_NAMES[qStartMonth + 2]} ${year})`,
          fyLabel,
          months,
        },
        funderName,
        deliveryNumbers,
        communitySnapshot: {
          maori: Number(comm.maori || 0),
          pasifika: Number(comm.pasifika || 0),
          rangatahi: Number(comm.rangatahi || 0),
          total: Number(comm.total || 0),
          kakano,
          tipu,
          ora,
          innovatorTotal: kakano + tipu + ora,
        },
        spaceUse,
        updates: { "Updates": updateItems },
        quotes: Array.isArray(req.body?.quotes) ? req.body.quotes : [],
        plannedNextQuarter: Array.isArray(req.body?.plannedNext) ? req.body.plannedNext : [],
        footTraffic: { total: ftTotal, byMonth: ftByMonth },
        maoriPipeline,
        taxonomyBreakdown: qTaxonomyBreakdown.length > 0 ? qTaxonomyBreakdown : undefined,
        operatorInsights: qOperatorInsights || undefined,
        concernArcs: qConcernArcs && qConcernArcs.arcs.length > 0 ? qConcernArcs : undefined,
      };

      const html = renderQuarterlyReport(reportData);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (err: any) {
      console.error("Quarterly HTML report error:", err);
      res.status(500).json({ message: "Failed to generate quarterly report", error: err.message });
    }
  };
  app.get("/api/reports/html/quarterly", isAuthenticated, handleQuarterlyReport);
  app.post("/api/reports/html/quarterly", isAuthenticated, handleQuarterlyReport);

  // ── Contact journey summary from linked debriefs ─────────────────────
  app.get("/api/contacts/:id/journey", isAuthenticated, async (req, res) => {
    try {
      const contactId = parseId(req.params.id);
      const contact = await storage.getContact(contactId);
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      if (contact.userId !== (req.user as any).claims.sub) return res.status(403).json({ message: "Forbidden" });

      const links = await storage.getContactImpactLogs(contactId);
      if (links.length === 0) return res.json({ debriefCount: 0, milestones: [], quotes: [], sentimentArc: [], summary: null });

      const milestones: Array<{ text: string; date: string; debriefTitle: string }> = [];
      const quotes: Array<{ text: string; debriefTitle: string }> = [];
      const sentimentArc: Array<{ date: string; sentiment: string; title: string }> = [];

      for (const link of links) {
        const log = await storage.getImpactLog(link.impactLogId);
        if (!log || log.status !== "confirmed") continue;

        const date = (log.confirmedAt || log.createdAt)?.toISOString().slice(0, 10) || "";
        const title = log.title || "Debrief";

        if (log.sentiment) {
          sentimentArc.push({ date, sentiment: log.sentiment, title });
        }

        if (log.milestones) {
          for (const m of log.milestones) {
            milestones.push({ text: m, date, debriefTitle: title });
          }
        }

        if (log.keyQuotes) {
          for (const q of log.keyQuotes) {
            quotes.push({ text: q, debriefTitle: title });
          }
        }
      }

      // Sort milestones chronologically
      milestones.sort((a, b) => a.date.localeCompare(b.date));
      sentimentArc.sort((a, b) => a.date.localeCompare(b.date));

      res.json({
        debriefCount: links.length,
        milestones,
        quotes: quotes.slice(0, 10),
        sentimentArc,
      });
    } catch (err: any) {
      console.error("Contact journey error:", err);
      res.status(500).json({ message: "Failed to generate journey", error: err.message });
    }
  });

  // ── Debrief quote suggestions for report builder ─────────────────────
  app.get("/api/reports/quote-suggestions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { startDate, endDate, funder } = req.query as { startDate?: string; endDate?: string; funder?: string };
      if (!startDate || !endDate) return res.status(400).json({ message: "startDate and endDate required" });

      // Look up funder community lens
      let quoteLens: "maori" | "pasifika" | "all" | undefined;
      if (funder) {
        const allFunders = await storage.getFunders(userId);
        const funderRecord = allFunders.find(f => f.name === funder);
        if (funderRecord?.communityLens && funderRecord.communityLens !== "all") {
          quoteLens = funderRecord.communityLens as "maori" | "pasifika";
        }
      }

      const filters: ReportFilters = { userId, startDate, endDate, funder: funder || undefined, communityLens: quoteLens };
      const suggestions = await getDebriefQuotesForReport(filters);
      res.json(suggestions);
    } catch (err: any) {
      console.error("Quote suggestions error:", err);
      res.status(500).json({ message: "Failed to get quote suggestions", error: err.message });
    }
  });

  // ── Concern arcs for governance/risk reporting ───────────────────────
  app.get("/api/reports/concern-arcs", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
      if (!startDate || !endDate) return res.status(400).json({ message: "startDate and endDate required" });
      const filters: ReportFilters = { userId, startDate, endDate };
      const arcs = await getConcernArcs(filters);
      res.json(arcs);
    } catch (err: any) {
      console.error("Concern arcs error:", err);
      res.status(500).json({ message: "Failed to get concern arcs", error: err.message });
    }
  });

  app.get("/api/reports/date-range", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const legacyReports = await storage.getLegacyReports(userId);
      const confirmed = legacyReports.filter(r => r.status === "confirmed");
      const liveEvents = await storage.getEvents(userId);
      const liveLogs = await storage.getImpactLogs(userId);

      const dates: Date[] = [];
      for (const r of confirmed) {
        dates.push(new Date(r.periodStart));
      }
      for (const e of liveEvents) {
        if (e.startTime) dates.push(new Date(e.startTime));
      }
      for (const l of liveLogs) {
        if (l.createdAt) dates.push(new Date(l.createdAt));
      }

      if (dates.length === 0) {
        return res.json({ earliestDate: null, latestDate: null });
      }

      dates.sort((a, b) => a.getTime() - b.getTime());
      res.json({
        earliestDate: dates[0].toISOString(),
        latestDate: dates[dates.length - 1].toISOString(),
      });
    } catch (err: any) {
      console.error("Date range error:", err);
      res.status(500).json({ message: "Failed to fetch date range" });
    }
  });

  app.post("/api/reports/generate", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { startDate, endDate, programmeIds, taxonomyIds, demographicSegments, funder, reportType: reqReportType } = req.body;
      const reportType: "monthly" | "quarterly" = reqReportType === "quarterly" ? "quarterly" : "monthly";

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }

      let orgProfileCtx: OrgProfileContext | undefined;
      let funderProfileCtx: any = null;

      try {
        const orgProfile = await storage.getOrganisationProfile(userId);
        if (orgProfile) {
          orgProfileCtx = {
            name: "Organisation",
            mission: orgProfile.mission,
            description: orgProfile.description,
            targetCommunity: orgProfile.targetCommunity,
            focusAreas: orgProfile.focusAreas,
          };
        }
      } catch {}

      if (funder) {
        try {
          const funderProfile = await storage.getFunderByTag(userId, funder);
          if (funderProfile) {
            funderProfileCtx = funderProfile;
          }
        } catch {}
      }

      const filters: ReportFilters = {
        userId,
        startDate,
        endDate,
        programmeIds,
        taxonomyIds,
        demographicSegments,
        funder,
      };

      const cacheKey = getReportCacheKey("generate", { userId, startDate, endDate, programmeIds, taxonomyIds, demographicSegments, funder });

      const result = await deduplicatedReportCall(cacheKey + `:${reportType}`, async () => {
        const report = await getFullMonthlyReport(filters);

        interface EnhancedReportData {
          standoutMoments: Awaited<ReturnType<typeof getStandoutMoments>>;
          operatorInsights: Awaited<ReturnType<typeof getOperatorInsights>> | null;
          peopleTiers: Awaited<ReturnType<typeof getPeopleTierBreakdown>> | null;
          transformationStories: Awaited<ReturnType<typeof getParticipantTransformationStories>>;
          impactHeatmap: Awaited<ReturnType<typeof getImpactTagHeatmap>>;
          theoryOfChange: Awaited<ReturnType<typeof getTheoryOfChangeAlignment>> | null;
          growthStory: Awaited<ReturnType<typeof getGrowthStory>> | null;
          outcomeChain: Awaited<ReturnType<typeof getOutcomeChain>> | null;
          quarterlyMilestones: Awaited<ReturnType<typeof getQuarterlyMilestones>> | null;
        }

        const enhancedData: EnhancedReportData = {
          standoutMoments: [],
          operatorInsights: null,
          peopleTiers: null,
          transformationStories: [],
          impactHeatmap: [],
          theoryOfChange: null,
          growthStory: null,
          outcomeChain: null,
          quarterlyMilestones: null,
        };

        try {
          if (reportType === "quarterly") {
            const funderCtxForFns = funderProfileCtx ? {
              name: funderProfileCtx.name,
              outcomesFramework: funderProfileCtx.outcomesFramework,
              outcomeFocus: funderProfileCtx.outcomeFocus,
              reportingGuidance: funderProfileCtx.reportingGuidance,
              partnershipStrategy: funderProfileCtx.partnershipStrategy,
            } : null;
            const results = await Promise.allSettled([
              getStandoutMoments(filters, 5),
              getOperatorInsights(filters),
              getParticipantTransformationStories(filters, 3),
              getPeopleTierBreakdown(filters),
              getImpactTagHeatmap(filters),
              getTheoryOfChangeAlignment(filters, orgProfileCtx, funderCtxForFns),
              getGrowthStory(filters),
              getOutcomeChain(filters, funderCtxForFns),
              getQuarterlyMilestones(filters),
            ]);
            enhancedData.standoutMoments = results[0].status === "fulfilled" ? results[0].value : [];
            enhancedData.operatorInsights = results[1].status === "fulfilled" ? results[1].value : null;
            enhancedData.transformationStories = results[2].status === "fulfilled" ? results[2].value : [];
            enhancedData.peopleTiers = results[3].status === "fulfilled" ? results[3].value : null;
            enhancedData.impactHeatmap = results[4].status === "fulfilled" ? results[4].value : [];
            enhancedData.theoryOfChange = results[5].status === "fulfilled" ? results[5].value : null;
            enhancedData.growthStory = results[6].status === "fulfilled" ? results[6].value : null;
            enhancedData.outcomeChain = results[7].status === "fulfilled" ? results[7].value : null;
            enhancedData.quarterlyMilestones = results[8].status === "fulfilled" ? results[8].value : null;
          } else {
            const results = await Promise.allSettled([
              getStandoutMoments(filters, 3),
              getOperatorInsights(filters),
              getPeopleTierBreakdown(filters),
            ]);
            enhancedData.standoutMoments = results[0].status === "fulfilled" ? results[0].value : [];
            enhancedData.operatorInsights = results[1].status === "fulfilled" ? results[1].value : null;
            enhancedData.peopleTiers = results[2].status === "fulfilled" ? results[2].value : null;
          }
        } catch (enhanceErr) {
          console.error("Enhanced data error (non-fatal):", enhanceErr);
        }

        let legacyMetrics = null;
        let isBlended = false;
        let boundaryDateStr: string | null = null;
        let legacyReportCount = 0;
        let legacyPeriods: string[] = [];
        let legacyHighlights: string[] = [];

        try {
          const settings = await storage.getReportingSettings(userId);
          const boundaryDate = settings?.boundaryDate;
          const reportStart = new Date(startDate);

          const allLegacy = await storage.getLegacyReports(userId);
          const confirmed = allLegacy.filter(r => r.status === "confirmed");
          const reqStart = new Date(startDate);
          const reqEnd = new Date(endDate);

          const overlapping = confirmed.filter(r => {
            const ps = new Date(r.periodStart);
            const pe = new Date(r.periodEnd);
            if (boundaryDate) {
              return ps <= reqEnd && pe >= reqStart && pe <= boundaryDate;
            }
            return ps <= reqEnd && pe >= reqStart;
          });

          if (overlapping.length > 0) {
            const totals = {
              activationsTotal: 0,
              activationsWorkshops: 0,
              activationsMentoring: 0,
              activationsEvents: 0,
              activationsPartnerMeetings: 0,
              foottrafficUnique: 0,
              bookingsTotal: 0,
            };

            for (const lr of overlapping) {
              const snapshot = await storage.getLegacyReportSnapshot(lr.id);
              if (snapshot) {
                totals.activationsTotal += snapshot.activationsTotal || 0;
                totals.activationsWorkshops += snapshot.activationsWorkshops || 0;
                totals.activationsMentoring += snapshot.activationsMentoring || 0;
                totals.activationsEvents += snapshot.activationsEvents || 0;
                totals.activationsPartnerMeetings += snapshot.activationsPartnerMeetings || 0;
                totals.foottrafficUnique += snapshot.foottrafficUnique || 0;
                totals.bookingsTotal += snapshot.bookingsTotal || 0;
              }
              legacyPeriods.push(lr.quarterLabel);

              try {
                const extraction = await storage.getLegacyReportExtraction(lr.id);
                if (extraction?.extractedHighlights) {
                  const highlights = extraction.extractedHighlights as any[];
                  for (const h of highlights) {
                    if (typeof h === "string" && h.trim()) legacyHighlights.push(h);
                    else if (h?.text) legacyHighlights.push(h.text);
                  }
                }
              } catch {}
            }

            legacyMetrics = totals;
            isBlended = true;
            boundaryDateStr = boundaryDate?.toISOString() || null;
            legacyReportCount = overlapping.length;
          }
        } catch (blendErr) {
          console.error("Legacy blend error (non-fatal):", blendErr);
        }

        const orgProfileData = orgProfileCtx ? {
          name: orgProfileCtx.name,
          mission: orgProfileCtx.mission,
          description: orgProfileCtx.description,
          targetCommunity: orgProfileCtx.targetCommunity,
          focusAreas: orgProfileCtx.focusAreas,
        } : null;

        const funderProfileData = funderProfileCtx ? {
          name: funderProfileCtx.name,
          outcomesFramework: funderProfileCtx.outcomesFramework,
          outcomeFocus: funderProfileCtx.outcomeFocus,
          reportingGuidance: funderProfileCtx.reportingGuidance,
        } : null;

        const templateMeta = reportType === "quarterly" ? {
          templateName: "Quarterly Flagship Report",
          templatePurpose: "Comprehensive impact proof with growth story, transformation vignettes, outcome alignment, and trend analysis",
          sections: ["growthStory", "peopleTiers", "standoutMoments", "transformationStories", "outcomeChain", "operatorInsights", "impactHeatmap", "quarterlyMilestones", "theoryOfChange", "reach", "delivery", "impact"],
        } : {
          templateName: "Monthly Pulse Report",
          templatePurpose: "Concise activity summary and standout moments — a quick read for funders",
          sections: ["peopleTiers", "standoutMoments", "operatorInsights", "reach", "delivery", "impact"],
        };

        return {
          ...report,
          reportType,
          templateMeta,
          isBlended,
          boundaryDate: boundaryDateStr,
          legacyReportCount,
          legacyPeriods,
          legacyMetrics,
          legacyHighlights: legacyHighlights.slice(0, 20),
          orgProfile: orgProfileData,
          funderProfile: funderProfileData,
          ...enhancedData,
        };
      });

      res.json(result);
    } catch (err: any) {
      console.error("Report generation error:", err);
      res.status(500).json({ message: "Failed to generate report", error: err.message, stack: err.stack?.split("\n").slice(0, 5).join("\n") });
    }
  });

  app.post("/api/reports/trends", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { endDate, granularity, periods, programmeIds, taxonomyIds, funder } = req.body;

      if (!endDate) {
        return res.status(400).json({ message: "endDate is required" });
      }

      const gran = granularity === "quarterly" ? "quarterly" : "monthly";
      const numPeriods = Math.min(Math.max(parseInt(periods) || (gran === "monthly" ? 12 : 8), 2), 24);

      const filters: ReportFilters = {
        userId,
        startDate: endDate,
        endDate,
        programmeIds,
        taxonomyIds,
        funder,
      };

      const trendData = await getTrendMetrics(filters, gran, numPeriods);
      res.json(trendData);
    } catch (err: any) {
      console.error("Trend metrics error:", err);
      res.status(500).json({ message: "Failed to generate trend data" });
    }
  });

  app.post("/api/reports/narrative", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { startDate, endDate, programmeIds, taxonomyIds, demographicSegments, funder, narrativeStyle, reportType: reqNarrReportType } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }

      const style: "compliance" | "story" = narrativeStyle === "story" ? "story" : "compliance";
      const narrativeReportType: "monthly" | "quarterly" = reqNarrReportType === "quarterly" ? "quarterly" : "monthly";

      let legacyContext: { metrics: any; highlights: string[]; reportCount: number } | null = null;
      try {
        const settings = await storage.getReportingSettings(userId);
        const boundaryDate = settings?.boundaryDate;
        const allLegacy = await storage.getLegacyReports(userId);
        const confirmed = allLegacy.filter(r => r.status === "confirmed");
        const reqStart = new Date(startDate);
        const reqEnd = new Date(endDate);

        const overlapping = confirmed.filter(r => {
          const ps = new Date(r.periodStart);
          const pe = new Date(r.periodEnd);
          if (boundaryDate) return ps <= reqEnd && pe >= reqStart && pe <= boundaryDate;
          return ps <= reqEnd && pe >= reqStart;
        });

        if (overlapping.length > 0) {
          const totals = {
            activationsTotal: 0, activationsWorkshops: 0, activationsMentoring: 0,
            activationsEvents: 0, activationsPartnerMeetings: 0,
            foottrafficUnique: 0, bookingsTotal: 0,
          };
          const highlights: string[] = [];

          for (const lr of overlapping) {
            const snapshot = await storage.getLegacyReportSnapshot(lr.id);
            if (snapshot) {
              totals.activationsTotal += snapshot.activationsTotal || 0;
              totals.activationsWorkshops += snapshot.activationsWorkshops || 0;
              totals.activationsMentoring += snapshot.activationsMentoring || 0;
              totals.activationsEvents += snapshot.activationsEvents || 0;
              totals.activationsPartnerMeetings += snapshot.activationsPartnerMeetings || 0;
              totals.foottrafficUnique += snapshot.foottrafficUnique || 0;
              totals.bookingsTotal += snapshot.bookingsTotal || 0;
            }
            try {
              const extraction = await storage.getLegacyReportExtraction(lr.id);
              if (extraction?.extractedHighlights) {
                const hl = extraction.extractedHighlights as any[];
                for (const h of hl) {
                  if (typeof h === "string" && h.trim()) highlights.push(h);
                  else if (h?.text) highlights.push(h.text);
                }
              }
            } catch {}
          }

          legacyContext = { metrics: totals, highlights: highlights.slice(0, 10), reportCount: overlapping.length };
        }
      } catch {}

      let orgProfileCtx: OrgProfileContext | null = null;
      let funderCtx: FunderContext | null = null;

      try {
        const orgProfile = await storage.getOrganisationProfile(userId);
        if (orgProfile) {
          orgProfileCtx = {
            name: "Organisation",
            mission: orgProfile.mission,
            description: orgProfile.description,
            targetCommunity: orgProfile.targetCommunity,
            focusAreas: orgProfile.focusAreas,
          };
        }
      } catch {}

      if (funder) {
        try {
          const funderProfile = await storage.getFunderByTag(userId, funder);
          if (funderProfile) {
            funderCtx = {
              name: funderProfile.name,
              outcomesFramework: funderProfile.outcomesFramework,
              outcomeFocus: funderProfile.outcomeFocus,
              reportingGuidance: funderProfile.reportingGuidance,
              narrativeStyle: funderProfile.narrativeStyle,
              partnershipStrategy: funderProfile.partnershipStrategy,
            };
          }
        } catch {}
      }

      const filters: ReportFilters = {
        userId,
        startDate,
        endDate,
        programmeIds,
        taxonomyIds,
        demographicSegments,
        funder,
      };

      const result = await generateNarrative(filters, legacyContext, style, orgProfileCtx, funderCtx, narrativeReportType);
      res.json(result);
    } catch (err: any) {
      console.error("Narrative generation error:", err);
      res.status(500).json({ message: "Failed to generate narrative" });
    }
  });

  app.post("/api/reports/community-comparison", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { startDate, endDate, programmeIds, taxonomyIds, demographicSegments, funder } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }

      const filters: ReportFilters = {
        userId,
        startDate,
        endDate,
        programmeIds,
        taxonomyIds,
        demographicSegments,
        funder,
      };

      const cacheKey = getReportCacheKey("comparison", { userId, startDate, endDate, programmeIds, taxonomyIds, demographicSegments, funder });
      const comparison = await deduplicatedReportCall(cacheKey, () => getCommunityComparison(filters));
      res.json(comparison);
    } catch (err: any) {
      console.error("Community comparison error:", err);
      res.status(500).json({ message: "Failed to generate community comparison" });
    }
  });

  app.post("/api/reports/tamaki-ora", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { startDate, endDate, programmeIds, taxonomyIds, demographicSegments, funder } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }

      const filters: ReportFilters = {
        userId,
        startDate,
        endDate,
        programmeIds,
        taxonomyIds,
        demographicSegments,
        funder,
      };

      const cacheKey = getReportCacheKey("tamaki-ora", { userId, startDate, endDate, programmeIds, taxonomyIds, demographicSegments, funder });
      const alignment = await deduplicatedReportCall(cacheKey, () => getTamakiOraAlignment(filters));
      res.json(alignment);
    } catch (err: any) {
      console.error("Tamaki Ora alignment error:", err);
      res.status(500).json({ message: "Failed to generate Tāmaki Ora alignment" });
    }
  });

  app.get("/api/reports", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const savedReports = await storage.getReports(userId);
      res.json(savedReports);
    } catch (err: any) {
      console.error("Get reports error:", err);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  app.get("/api/reports/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const report = await storage.getReport(parseId(req.params.id));
      if (!report || report.userId !== userId) return res.status(404).json({ message: "Report not found" });
      res.json(report);
    } catch (err: any) {
      console.error("Get report error:", err);
      res.status(500).json({ message: "Failed to fetch report" });
    }
  });

  app.post("/api/reports/save", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { title, type, startDate, endDate, filters, snapshotData, narrative } = req.body;

      if (!title || !startDate || !endDate) {
        return res.status(400).json({ message: "title, startDate, and endDate are required" });
      }

      const report = await storage.createReport({
        userId,
        title,
        type: type || "monthly",
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        filters: filters || {},
        snapshotData,
        narrative,
        status: "draft",
      });
      res.status(201).json(report);
    } catch (err: any) {
      console.error("Save report error:", err);
      res.status(500).json({ message: "Failed to save report" });
    }
  });

  app.patch("/api/reports/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
      const report = await storage.getReport(id);
      if (!report || report.userId !== userId) return res.status(404).json({ message: "Report not found" });

      const updated = await storage.updateReport(id, req.body);
      res.json(updated);
    } catch (err: any) {
      console.error("Update report error:", err);
      res.status(500).json({ message: "Failed to update report" });
    }
  });

  app.delete("/api/reports/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
      const report = await storage.getReport(id);
      if (!report || report.userId !== userId) return res.status(404).json({ message: "Report not found" });
      await storage.deleteReport(id);
      res.status(204).end();
    } catch (err: any) {
      console.error("Delete report error:", err);
      res.status(500).json({ message: "Failed to delete report" });
    }
  });

  // === Legacy Reports API ===

  app.get("/api/legacy-reports", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const reports = await storage.getLegacyReports(userId);
      const allGroups = await storage.getGroups(userId);
      const allContacts = await storage.getContacts(userId);
      const groupNameSet = new Set(allGroups.map(g => g.name.toLowerCase().trim()));
      const contactNameSet = new Set(allContacts.map(c => c.name.toLowerCase().trim()));
      const reportsWithSnapshots = await Promise.all(
        reports.map(async (r) => {
          const snapshot = await storage.getLegacyReportSnapshot(r.id);
          const extraction = await storage.getLegacyReportExtraction(r.id);
          const hasExtraction = !!extraction;
          const extractedOrgs = (extraction?.extractedOrganisations as any[]) || [];
          const extractedPeople = (extraction?.extractedPeople as any[]) || [];
          const extractedOrgCount = extractedOrgs.length;
          const extractedPeopleCount = extractedPeople.length;
          const groupsImported = extractedOrgs.filter(o => o.name && groupNameSet.has(o.name.toLowerCase().trim())).length;
          const contactsImported = extractedPeople.filter(p => p.name && contactNameSet.has(p.name.toLowerCase().trim())).length;
          const highlights = (extraction?.extractedHighlights as any[]) || [];
          return { ...r, snapshot, highlights, processingStatus: { hasExtraction, extractedOrgCount, extractedPeopleCount, groupsImported, contactsImported } };
        })
      );
      res.json(reportsWithSnapshots);
    } catch (err: any) {
      console.error("Legacy reports error:", err);
      res.status(500).json({ message: "Failed to fetch legacy reports" });
    }
  });

  app.get("/api/legacy-reports/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
      const report = await storage.getLegacyReport(id);
      if (!report || report.userId !== userId) return res.status(404).json({ message: "Not found" });
      const snapshot = await storage.getLegacyReportSnapshot(id);
      res.json({ ...report, snapshot });
    } catch (err: any) {
      console.error("Legacy report error:", err);
      res.status(500).json({ message: "Failed to fetch legacy report" });
    }
  });

  app.post("/api/legacy-reports", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { year, month, pdfFileName, pdfData, notes, snapshot } = req.body;

      if (!year || !month) {
        return res.status(400).json({ message: "Year and month are required" });
      }

      const now = new Date();
      const currentYear = now.getFullYear();
      if (year < 2023 || year > currentYear + 1) {
        return res.status(400).json({ message: "Year must be between 2023 and current year" });
      }
      if (month < 1 || month > 12) {
        return res.status(400).json({ message: "Month must be between 1 and 12" });
      }

      const monthEndDate = new Date(year, month, 0);
      if (monthEndDate > now) {
        return res.status(400).json({ message: "Cannot create reports for future months" });
      }

      if (year === 2023 && month < 11) {
        return res.status(400).json({ message: "Reports start from November 2023" });
      }

      const existing = await storage.getLegacyReports(userId);
      const duplicate = existing.find(r => r.year === year && r.month === month);
      if (duplicate) {
        return res.status(409).json({ message: `A report for ${MONTH_NAMES[month - 1]} ${year} already exists` });
      }

      const periodStart = new Date(year, month - 1, 1);
      const periodEnd = monthEndDate;
      const quarter = Math.floor((month - 1) / 3) + 1;
      const quarterLabel = `${MONTH_NAMES[month - 1]} ${year}`;

      const report = await storage.createLegacyReport({
        userId,
        year,
        quarter,
        month,
        quarterLabel,
        periodStart,
        periodEnd,
        pdfFileName: pdfFileName || null,
        pdfData: pdfData || null,
        notes: notes || null,
        status: "draft",
      });

      let snapshotRecord = null;
      if (snapshot) {
        snapshotRecord = await storage.createLegacyReportSnapshot({
          legacyReportId: report.id,
          activationsTotal: snapshot.activationsTotal ?? null,
          activationsWorkshops: snapshot.activationsWorkshops ?? null,
          activationsMentoring: snapshot.activationsMentoring ?? null,
          activationsEvents: snapshot.activationsEvents ?? null,
          activationsPartnerMeetings: snapshot.activationsPartnerMeetings ?? null,
          foottrafficUnique: snapshot.foottrafficUnique ?? null,
          bookingsTotal: snapshot.bookingsTotal ?? null,
        });
      }

      if (pdfData) {
        try {
          const { PDFParse } = await import("pdf-parse");
          const pdfBuffer = Buffer.from(pdfData, "base64");
          const parser = new PDFParse({ data: pdfBuffer });
          await (parser as any).load();
          const pdfResult = await parser.getText();
          const pdfText = pdfResult.text || "";

          const prompt = buildExtractionPrompt(pdfText);
          let parsed: any;
          try {
            parsed = await claudeJSON({
              model: "claude-haiku-4-5",
              prompt,
              temperature: 0.2,
            });
          } catch (e) {
            if (e instanceof AIKeyMissingError) throw e;
            parsed = { metrics: [] };
          }

          const suggestedMetrics = (parsed.metrics || []).map((m: any) => ({
            metricKey: m.metricKey,
            metricValue: m.metricValue,
            metricUnit: m.metricUnit || null,
            confidence: m.confidence || 0,
            evidenceSnippet: m.evidenceSnippet || null,
          }));

          const extractedOrganisations = (parsed.organisations || []).map((o: any) => ({
            name: o.name || "",
            type: o.type || "other",
            description: o.description || null,
            relationship: o.relationship || null,
          })).filter((o: any) => o.name);

          const extractedHighlights = (parsed.highlights || []).map((h: any) => ({
            theme: h.theme || "",
            summary: h.summary || "",
            activityType: h.activityType || null,
          })).filter((h: any) => h.theme && h.summary);

          const extractedPeople = (parsed.people || []).map((p: any) => ({
            name: p.name || "",
            role: p.role || null,
            context: p.context || null,
          })).filter((p: any) => p.name);

          await storage.createLegacyReportExtraction({
            legacyReportId: report.id,
            suggestedMetrics,
            extractedOrganisations,
            extractedHighlights,
            extractedPeople,
            rawText: pdfText.substring(0, 20000),
          });

          const detectedMonth = parsed.detectedMonth ? parseInt(parsed.detectedMonth) : null;
          const detectedYear = parsed.detectedYear ? parseInt(parsed.detectedYear) : null;

          let updatedReport = report;
          if (detectedMonth && detectedYear && detectedMonth >= 1 && detectedMonth <= 12 && detectedYear >= 2023) {
            const isValidDate = !(detectedYear === 2023 && detectedMonth < 11);
            const detectedEnd = new Date(detectedYear, detectedMonth, 0);
            const notFuture = detectedEnd <= new Date();
            const isDifferent = detectedMonth !== report.month || detectedYear !== report.year;

            if (isValidDate && notFuture && isDifferent) {
              const existingReports = await storage.getLegacyReports(userId);
              const wouldDuplicate = existingReports.find(r => r.id !== report.id && r.year === detectedYear && r.month === detectedMonth);

              if (!wouldDuplicate) {
                const periodStart = new Date(detectedYear, detectedMonth - 1, 1);
                const periodEnd = detectedEnd;
                const quarter = Math.floor((detectedMonth - 1) / 3) + 1;
                const quarterLabel = `${MONTH_NAMES[detectedMonth - 1]} ${detectedYear}`;

                updatedReport = await storage.updateLegacyReport(report.id, {
                  year: detectedYear,
                  month: detectedMonth,
                  quarter,
                  quarterLabel,
                  periodStart,
                  periodEnd,
                });
              }
            }
          }

          const snapshotData: Record<string, any> = { legacyReportId: report.id };
          let autoAppliedCount = 0;
          let reviewNeededCount = 0;

          for (const m of suggestedMetrics) {
            if (m.confidence >= 70 && m.metricValue !== null && m.metricValue !== undefined) {
              const field = METRIC_KEY_TO_SNAPSHOT_FIELD[m.metricKey];
              if (field) {
                snapshotData[field] = typeof m.metricValue === "string" ? parseFloat(m.metricValue) : m.metricValue;
                autoAppliedCount++;
              }
            } else if (m.confidence > 0 && m.confidence < 70) {
              reviewNeededCount++;
            }
          }

          if (autoAppliedCount > 0) {
            if (snapshotRecord) {
              snapshotRecord = await storage.updateLegacyReportSnapshot(snapshotRecord.id, snapshotData);
            } else {
              snapshotRecord = await storage.createLegacyReportSnapshot(snapshotData as any);
            }
          }

          return res.status(201).json({
            ...updatedReport,
            snapshot: snapshotRecord,
            autoExtracted: true,
            extraction: { suggestedMetrics, autoAppliedCount, reviewNeededCount, extractedOrganisations, extractedHighlights, extractedPeople, detectedMonth, detectedYear },
          });
        } catch (extractErr: any) {
          if (extractErr instanceof AIKeyMissingError) return res.status(503).json({ message: extractErr.message });
          console.error("Auto-extraction error (non-fatal):", extractErr);
          return res.status(201).json({
            ...report,
            snapshot: snapshotRecord,
            autoExtracted: false,
            extractionError: "Metric extraction failed — you can retry manually using the Extract button.",
          });
        }
      }

      res.status(201).json({ ...report, snapshot: snapshotRecord });
    } catch (err: any) {
      console.error("Create legacy report error:", err);
      res.status(500).json({ message: "Failed to create legacy report" });
    }
  });

  app.patch("/api/legacy-reports/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
      const existing = await storage.getLegacyReport(id);
      if (!existing || String(existing.userId) !== String(userId)) return res.status(404).json({ message: "Not found" });

      const { notes, snapshot, status, year, month } = req.body;

      const updateData: any = {};
      if (notes !== undefined) updateData.notes = notes;

      if (year !== undefined && month !== undefined && existing.status === "draft") {
        if (month < 1 || month > 12) {
          return res.status(400).json({ message: "Month must be between 1 and 12" });
        }
        if (year < 2023) {
          return res.status(400).json({ message: "Year must be 2023 or later" });
        }
        if (year === 2023 && month < 11) {
          return res.status(400).json({ message: "Reports start from November 2023" });
        }
        const monthEndDate = new Date(year, month, 0);
        const now = new Date();
        if (monthEndDate > now) {
          return res.status(400).json({ message: "Cannot set date to a future month" });
        }
        const allReports = await storage.getLegacyReports(userId);
        const duplicate = allReports.find(r => r.id !== id && r.year === year && r.month === month);
        if (duplicate) {
          return res.status(409).json({ message: `A report for ${MONTH_NAMES[month - 1]} ${year} already exists` });
        }
        const periodStart = new Date(year, month - 1, 1);
        const periodEnd = monthEndDate;
        const quarter = Math.floor((month - 1) / 3) + 1;
        updateData.year = year;
        updateData.month = month;
        updateData.quarter = quarter;
        updateData.quarterLabel = `${MONTH_NAMES[month - 1]} ${year}`;
        updateData.periodStart = periodStart;
        updateData.periodEnd = periodEnd;
      }

      if (status === "confirmed" && existing.status !== "confirmed") {
        updateData.status = "confirmed";
        updateData.confirmedAt = new Date();
        updateData.confirmedBy = userId;
      } else if (status === "draft") {
        updateData.status = "draft";
        updateData.confirmedAt = null;
        updateData.confirmedBy = null;
      }

      const updated = await storage.updateLegacyReport(id, updateData);

      let snapshotRecord = null;
      if (snapshot) {
        const { id: _sid, legacyReportId: _lrid, createdAt: _ca, ...cleanSnapshot } = snapshot;
        const existingSnapshot = await storage.getLegacyReportSnapshot(id);
        if (existingSnapshot) {
          snapshotRecord = await storage.updateLegacyReportSnapshot(existingSnapshot.id, cleanSnapshot);
        } else {
          snapshotRecord = await storage.createLegacyReportSnapshot({
            legacyReportId: id,
            ...cleanSnapshot,
          });
        }
      }

      const finalSnapshot = snapshotRecord || (await storage.getLegacyReportSnapshot(id));
      const taxonomySuggestionsAvailable = status === "confirmed" && existing.status !== "confirmed";

      let createdGroups: string[] = [];
      if (status === "confirmed" && existing.status !== "confirmed") {
        try {
          const extraction = await storage.getLegacyReportExtraction(id);
          if (extraction?.extractedOrganisations && Array.isArray(extraction.extractedOrganisations)) {
            const existingGroups = await storage.getGroups(userId);
            const existingNames = new Set(existingGroups.map(g => g.name.toLowerCase().trim()));

            for (const org of extraction.extractedOrganisations as any[]) {
              if (!org.name || existingNames.has(org.name.toLowerCase().trim())) continue;
              try {
                await storage.createGroup({
                  userId,
                  name: org.name,
                  type: org.type === "community_group" ? "Community Organisation" :
                        org.type === "community_collective" ? "Community Organisation" :
                        org.type === "business" ? "Business" :
                        org.type === "partner" ? "Uncategorised" :
                        org.type === "government" ? "Government / Council" :
                        org.type === "ngo" ? "NGO" :
                        org.type === "education" ? "Education / Training" :
                        org.type === "funder" ? "Funder" :
                        org.type === "resident_company" ? "Resident Company" :
                        org.type === "iwi" ? "Iwi / Hapū" : "Business",
                  description: org.description || null,
                  notes: org.relationship ? `Relationship: ${org.relationship}. Imported from legacy report ${existing.quarterLabel}.` : `Imported from legacy report ${existing.quarterLabel}.`,
                  importSource: `Imported from legacy report ${existing.quarterLabel}`,
                  relationshipTier: org.relationship === "mentored" || org.relationship === "supported" ? "support" :
                                    org.relationship === "partnered" || org.relationship === "engaged" ? "collaborate" : "mentioned",
                  active: true,
                });
                existingNames.add(org.name.toLowerCase().trim());
                createdGroups.push(org.name);
              } catch (groupErr) {
                console.error(`Failed to create group "${org.name}":`, groupErr);
              }
            }
          }
        } catch (extractErr) {
          console.error("Failed to auto-create groups from extraction:", extractErr);
        }
      }

      let createdContacts: string[] = [];
      if (status === "confirmed" && existing.status !== "confirmed") {
        try {
          const extraction = await storage.getLegacyReportExtraction(id);
          if (extraction?.extractedPeople && Array.isArray(extraction.extractedPeople)) {
            const existingContacts = await storage.getContacts(userId);
            const existingContactNames = new Set(existingContacts.map(c => c.name.toLowerCase().trim()));

            for (const person of extraction.extractedPeople as any[]) {
              if (!person.name || existingContactNames.has(person.name.toLowerCase().trim())) continue;
              try {
                await storage.createContact({
                  userId,
                  name: person.name,
                  role: person.role || "Supporter",
                  notes: person.context ? `${person.context}. Imported from legacy report ${existing.quarterLabel}.` : `Imported from legacy report ${existing.quarterLabel}.`,
                });
                existingContactNames.add(person.name.toLowerCase().trim());
                createdContacts.push(person.name);
              } catch (contactErr) {
                console.error(`Failed to create contact "${person.name}":`, contactErr);
              }
            }
          }
        } catch (extractErr) {
          console.error("Failed to auto-create contacts from extraction:", extractErr);
        }
      }

      res.json({ ...updated, snapshot: finalSnapshot, taxonomySuggestionsAvailable, createdGroups, createdContacts });
    } catch (err: any) {
      console.error("Update legacy report error:", err);
      res.status(500).json({ message: "Failed to update legacy report" });
    }
  });

  app.post("/api/legacy-reports/sync-imports", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const reports = await storage.getLegacyReports(userId);
      const confirmedReports = reports.filter(r => r.status === "confirmed");

      const existingGroups = await storage.getGroups(userId);
      const existingGroupNames = new Set(existingGroups.map(g => g.name.toLowerCase().trim()));

      const existingContacts = await storage.getContacts(userId);
      const existingContactNames = new Set(existingContacts.map(c => c.name.toLowerCase().trim()));

      let totalGroupsCreated = 0;
      let totalContactsCreated = 0;
      let reportsProcessed = 0;

      for (const report of confirmedReports) {
        const extraction = await storage.getLegacyReportExtraction(report.id);
        if (!extraction) continue;

        let reportHadWork = false;

        if (extraction.extractedOrganisations && Array.isArray(extraction.extractedOrganisations)) {
          for (const org of extraction.extractedOrganisations as any[]) {
            if (!org.name || existingGroupNames.has(org.name.toLowerCase().trim())) continue;
            try {
              await storage.createGroup({
                userId,
                name: org.name,
                type: org.type === "community_group" ? "Community Organisation" :
                      org.type === "community_collective" ? "Community Organisation" :
                      org.type === "business" ? "Business" :
                      org.type === "partner" ? "Uncategorised" :
                      org.type === "government" ? "Government / Council" :
                      org.type === "ngo" ? "NGO" :
                      org.type === "education" ? "Education / Training" :
                      org.type === "funder" ? "Funder" :
                      org.type === "resident_company" ? "Resident Company" :
                      org.type === "iwi" ? "Iwi / Hapū" : "Business",
                description: org.description || null,
                notes: org.relationship ? `Relationship: ${org.relationship}. Imported from legacy report ${report.quarterLabel}.` : `Imported from legacy report ${report.quarterLabel}.`,
                importSource: `Imported from legacy report ${report.quarterLabel}`,
                relationshipTier: org.relationship === "mentored" || org.relationship === "supported" ? "support" :
                                  org.relationship === "partnered" || org.relationship === "engaged" ? "collaborate" : "mentioned",
                active: true,
              });
              existingGroupNames.add(org.name.toLowerCase().trim());
              totalGroupsCreated++;
              reportHadWork = true;
            } catch (groupErr) {
              console.error(`Sync: Failed to create group "${org.name}":`, groupErr);
            }
          }
        }

        if (extraction.extractedPeople && Array.isArray(extraction.extractedPeople)) {
          for (const person of extraction.extractedPeople as any[]) {
            if (!person.name || existingContactNames.has(person.name.toLowerCase().trim())) continue;
            try {
              await storage.createContact({
                userId,
                name: person.name,
                role: person.role || "Supporter",
                notes: person.context ? `${person.context}. Imported from legacy report ${report.quarterLabel}.` : `Imported from legacy report ${report.quarterLabel}.`,
              });
              existingContactNames.add(person.name.toLowerCase().trim());
              totalContactsCreated++;
              reportHadWork = true;
            } catch (contactErr) {
              console.error(`Sync: Failed to create contact "${person.name}":`, contactErr);
            }
          }
        }

        if (reportHadWork) reportsProcessed++;
      }

      res.json({
        groupsCreated: totalGroupsCreated,
        contactsCreated: totalContactsCreated,
        reportsProcessed,
        totalReportsChecked: confirmedReports.length,
      });
    } catch (err: any) {
      console.error("Sync imports error:", err);
      res.status(500).json({ message: "Failed to sync imports" });
    }
  });

  app.get("/api/legacy-reports/:id/taxonomy-suggestions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const reportId = parseId(req.params.id);
      const report = await storage.getLegacyReport(reportId);
      if (!report) return res.status(404).json({ message: "Legacy report not found" });
      if (report.userId !== userId) return res.status(403).json({ message: "Forbidden" });

      const taxonomy = await storage.getTaxonomy(userId);
      const snapshot = await storage.getLegacyReportSnapshot(reportId);

      let pdfText = "";
      if (report.pdfData) {
        try {
          const { PDFParse: PdfParser } = await import("pdf-parse");
          const buffer = Buffer.from(report.pdfData, "base64");
          const parser = new PdfParser({ data: buffer });
          await (parser as any).load();
          const pdfResult = await parser.getText();
          pdfText = pdfResult.text || "";
        } catch (e) {
          pdfText = "";
        }
      }

      const existingCategories = taxonomy.map(t => ({
        id: t.id,
        category: t.name,
        description: t.description,
      }));

      const snapshotInfo = snapshot ? {
        activationsTotal: snapshot.activationsTotal,
        foottrafficUnique: snapshot.foottrafficUnique,
        bookingsTotal: snapshot.bookingsTotal,
      } : {};

      const prompt = `You are analyzing a legacy report to suggest taxonomy categories for impact classification.

Report Period: ${report.quarterLabel} (${report.periodStart} to ${report.periodEnd})
Report Metrics: ${JSON.stringify(snapshotInfo)}
${pdfText ? `Report Text Content:\n${pdfText.slice(0, 3000)}` : "No PDF text available."}

Existing taxonomy categories:
${JSON.stringify(existingCategories, null, 2)}

Analyze the report data and suggest taxonomy categories. For each suggestion:
- If it matches an existing category, reference it
- If it's a new category, explain why it should be added
- Include a confidence score (0-100)

Return a JSON object with this exact structure:
{
  "suggestions": [
    { "category": "category name", "description": "why this category fits the report data", "matchesExisting": "existing category name or null", "confidence": 85 }
  ]
}`;

      let result: any;
      try {
        result = await claudeJSON({
          model: "claude-haiku-4-5",
          prompt,
          temperature: 0.3,
        });
      } catch (e) {
        if (e instanceof AIKeyMissingError) throw e;
        result = { suggestions: [] };
      }
      res.json(result.suggestions || []);
    } catch (err: any) {
      if (err instanceof AIKeyMissingError) return res.status(503).json({ message: err.message });
      console.error("Taxonomy suggestions GET error:", err);
      res.status(500).json({ message: "Failed to generate taxonomy suggestions" });
    }
  });

  app.delete("/api/legacy-reports/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
      const existing = await storage.getLegacyReport(id);
      if (!existing || String(existing.userId) !== String(userId)) return res.status(404).json({ message: "Not found" });
      await storage.deleteLegacyReport(id);
      res.status(204).end();
    } catch (err: any) {
      console.error("Delete legacy report error:", err);
      res.status(500).json({ message: "Failed to delete legacy report" });
    }
  });

  // === Reporting Settings API ===

  app.get("/api/reporting-settings", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const settings = await storage.getReportingSettings(userId);
      res.json(settings || { boundaryDate: null });
    } catch (err: any) {
      console.error("Reporting settings error:", err);
      res.status(500).json({ message: "Failed to fetch reporting settings" });
    }
  });

  app.put("/api/reporting-settings", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { boundaryDate } = req.body;
      const settings = await storage.upsertReportingSettings(userId, {
        boundaryDate: boundaryDate ? new Date(boundaryDate) : null,
      });
      res.json(settings);
    } catch (err: any) {
      console.error("Update reporting settings error:", err);
      res.status(500).json({ message: "Failed to update reporting settings" });
    }
  });

  // === Benchmark Insights API ===

  app.get("/api/benchmark-insights", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { startDate, endDate } = req.query as { startDate: string; endDate: string };
      if (!startDate || !endDate) return res.status(400).json({ message: "startDate and endDate required" });

      const legacyReportsData = await storage.getLegacyReports(userId);
      const confirmedReports = legacyReportsData.filter(r => r.status === "confirmed");
      const snapshots = await Promise.all(
        confirmedReports.map(async (r) => {
          const snapshot = await storage.getLegacyReportSnapshot(r.id);
          return { report: r, snapshot };
        })
      );

      const settings = await storage.getReportingSettings(userId);
      const boundaryDate = settings?.boundaryDate;

      const quarterlyData: Array<{
        label: string;
        periodStart: Date;
        periodEnd: Date;
        activationsTotal: number;
        foottrafficUnique: number;
        bookingsTotal: number;
        source: "legacy" | "live";
      }> = [];

      for (const { report, snapshot } of snapshots) {
        if (snapshot) {
          quarterlyData.push({
            label: report.quarterLabel,
            periodStart: report.periodStart,
            periodEnd: report.periodEnd,
            activationsTotal: snapshot.activationsTotal || 0,
            foottrafficUnique: snapshot.foottrafficUnique || 0,
            bookingsTotal: snapshot.bookingsTotal || 0,
            source: "legacy",
          });
        }
      }

      if (boundaryDate) {
        const liveEvents = await storage.getEvents(userId);
        const postBoundary = liveEvents.filter(e =>
          new Date(e.startTime) >= boundaryDate && e.type !== "Personal"
        );
        const currentStart = new Date(startDate);
        const currentEnd = new Date(endDate);
        const liveInRange = postBoundary.filter(e => {
          const d = new Date(e.startTime);
          return d >= currentStart && d <= currentEnd;
        });

        const liveBookings = await storage.getBookings(userId);
        const liveBookingsInRange = liveBookings.filter(b => {
          const d = new Date(b.startDate as any);
          return d >= currentStart && d <= currentEnd;
        });

        const liveContacts = await db
          .selectDistinct({ contactId: impactLogContacts.contactId })
          .from(impactLogContacts)
          .innerJoin(impactLogs, eq(impactLogContacts.impactLogId, impactLogs.id))
          .where(and(
            eq(impactLogs.userId, userId),
            eq(impactLogs.status, "confirmed"),
            gte(impactLogs.createdAt, currentStart),
            lte(impactLogs.createdAt, currentEnd),
          ));

        quarterlyData.push({
          label: "Current Period",
          periodStart: currentStart,
          periodEnd: currentEnd,
          activationsTotal: liveInRange.length,
          foottrafficUnique: liveContacts.length,
          bookingsTotal: liveBookingsInRange.length,
          source: "live",
        });
      }

      quarterlyData.sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime());

      const computeMetricBenchmarks = (values: number[], labels: string[]) => {
        const nonZero = values.filter(v => v > 0);
        const avg = nonZero.length > 0 ? Math.round(nonZero.reduce((s, v) => s + v, 0) / nonZero.length) : 0;
        const max = Math.max(...values, 0);
        const maxIdx = values.indexOf(max);
        const currentVal = values[values.length - 1] || 0;
        const prevVal = values.length > 1 ? values[values.length - 2] : null;
        const pop = prevVal && prevVal > 0 ? Math.round(((currentVal - prevVal) / prevVal) * 100) : null;
        const rank = nonZero.length > 0 ? [...nonZero].sort((a, b) => b - a).indexOf(currentVal) + 1 : null;
        const pctVsAvg = avg > 0 ? Math.round(((currentVal - avg) / avg) * 100) : null;
        return {
          historicAverage: avg,
          highestPeriod: maxIdx >= 0 ? labels[maxIdx] : null,
          highestValue: max,
          currentRank: rank,
          totalPeriods: values.length,
          popChange: pop,
          pctVsAverage: pctVsAvg,
        };
      };

      const labels = quarterlyData.map(q => q.label);
      const activationsBenchmarks = computeMetricBenchmarks(quarterlyData.map(q => q.activationsTotal), labels);
      const foottrafficBenchmarks = computeMetricBenchmarks(quarterlyData.map(q => q.foottrafficUnique), labels);
      const bookingsBenchmarks = computeMetricBenchmarks(quarterlyData.map(q => q.bookingsTotal), labels);

      const insights: string[] = [];
      if (activationsBenchmarks.historicAverage > 0) {
        insights.push(`Historic average activations per period: ${activationsBenchmarks.historicAverage}`);
      }
      if (activationsBenchmarks.highestPeriod) {
        insights.push(`Highest activations: ${activationsBenchmarks.highestPeriod} with ${activationsBenchmarks.highestValue}`);
      }
      if (activationsBenchmarks.currentRank && quarterlyData.length > 1) {
        insights.push(`Current period ranks #${activationsBenchmarks.currentRank} out of ${quarterlyData.length} periods`);
      }
      if (activationsBenchmarks.popChange !== null) {
        const dir = activationsBenchmarks.popChange >= 0 ? "up" : "down";
        insights.push(`Activations period-over-period: ${dir} ${Math.abs(activationsBenchmarks.popChange)}%`);
      }
      if (foottrafficBenchmarks.historicAverage > 0) {
        insights.push(`Historic average foot traffic: ${foottrafficBenchmarks.historicAverage} unique people per period`);
      }
      if (foottrafficBenchmarks.highestPeriod) {
        insights.push(`Highest foot traffic: ${foottrafficBenchmarks.highestPeriod} with ${foottrafficBenchmarks.highestValue}`);
      }
      if (bookingsBenchmarks.historicAverage > 0) {
        insights.push(`Historic average bookings: ${bookingsBenchmarks.historicAverage} per period`);
      }

      res.json({
        quarterlyData,
        benchmarks: {
          activations: activationsBenchmarks,
          foottraffic: foottrafficBenchmarks,
          bookings: bookingsBenchmarks,
          historicAverage: activationsBenchmarks.historicAverage,
          highestQuarter: activationsBenchmarks.highestPeriod,
          highestValue: activationsBenchmarks.highestValue,
          currentRank: activationsBenchmarks.currentRank,
          totalQuarters: quarterlyData.length,
          qoqChange: activationsBenchmarks.popChange,
          pctVsAverage: activationsBenchmarks.pctVsAverage,
        },
        insights,
        boundaryDate: boundaryDate?.toISOString() || null,
      });
    } catch (err: any) {
      console.error("Benchmark insights error:", err);
      res.status(500).json({ message: "Failed to compute benchmark insights" });
    }
  });

  // === Legacy Trend Data API (for dashboard blending) ===

  app.get("/api/legacy-trend-data", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const legacyReportsData = await storage.getLegacyReports(userId);
      const confirmedReports = legacyReportsData.filter(r => r.status === "confirmed");
      const settings = await storage.getReportingSettings(userId);

      const trendData = await Promise.all(
        confirmedReports.map(async (r) => {
          const snapshot = await storage.getLegacyReportSnapshot(r.id);
          return {
            quarterLabel: r.quarterLabel,
            periodStart: r.periodStart,
            periodEnd: r.periodEnd,
            activationsTotal: snapshot?.activationsTotal || 0,
            activationsWorkshops: snapshot?.activationsWorkshops || 0,
            activationsMentoring: snapshot?.activationsMentoring || 0,
            activationsEvents: snapshot?.activationsEvents || 0,
            activationsPartnerMeetings: snapshot?.activationsPartnerMeetings || 0,
            foottrafficUnique: snapshot?.foottrafficUnique || null,
            bookingsTotal: snapshot?.bookingsTotal || null,
          };
        })
      );

      trendData.sort((a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime());

      res.json({
        trendData,
        boundaryDate: settings?.boundaryDate?.toISOString() || null,
      });
    } catch (err: any) {
      console.error("Legacy trend error:", err);
      res.status(500).json({ message: "Failed to fetch legacy trend data" });
    }
  });

  // ── Milestones ──
  app.get("/api/milestones", isAuthenticated, async (req, res) => {
    const milestoneList = await storage.getMilestones((req.user as any).claims.sub);
    res.json(milestoneList);
  });

  app.get("/api/milestones/:id", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const milestone = await storage.getMilestone(parseId(req.params.id));
    if (!milestone || milestone.userId !== userId) return res.status(404).json({ message: "Milestone not found" });
    res.json(milestone);
  });

  app.post("/api/milestones", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const milestone = await storage.createMilestone({ ...req.body, userId, createdBy: userId });
      res.status(201).json(milestone);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/milestones/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const milestone = await storage.getMilestone(parseId(req.params.id));
      if (!milestone || milestone.userId !== userId) return res.status(404).json({ message: "Not found" });
      const updated = await storage.updateMilestone(parseId(req.params.id), req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/milestones/:id", isAuthenticated, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const milestone = await storage.getMilestone(parseId(req.params.id));
    if (!milestone || milestone.userId !== userId) return res.status(404).json({ message: "Not found" });
    await storage.deleteMilestone(parseId(req.params.id));
    res.json({ success: true });
  });

  // ── Programme Effectiveness ──
  app.get("/api/programme-effectiveness", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const programmeList = await storage.getProgrammes(userId);
      const allMilestones = await storage.getMilestones(userId);
      const allImpactLogs = await storage.getImpactLogs(userId);
      const allEvents = await storage.getEvents(userId);

      const effectiveness = await Promise.all(programmeList.map(async (prog) => {
        const progEvents = await storage.getProgrammeEvents(prog.id);
        const eventIds = progEvents.map(pe => pe.eventId);

        let totalAttendance = 0;
        const attendeeSet = new Set<number>();
        for (const eid of eventIds) {
          const att = await storage.getEventAttendance(eid);
          totalAttendance += att.length;
          att.forEach(a => attendeeSet.add(a.contactId));
        }

        const linkedDebriefs = allImpactLogs.filter(il => il.programmeId === prog.id && il.status === "confirmed");
        const sentiments = linkedDebriefs
          .map(d => d.sentiment)
          .filter(Boolean);
        const sentimentMap: Record<string, number> = { positive: 3, neutral: 2, negative: 1 };
        const sentimentAvg = sentiments.length > 0
          ? sentiments.reduce((sum, s) => sum + (sentimentMap[s!] || 2), 0) / sentiments.length
          : null;

        const linkedMilestones = allMilestones.filter(m => m.linkedProgrammeId === prog.id);

        const totalBudget = parseFloat(String(prog.facilitatorCost || 0))
          + parseFloat(String(prog.cateringCost || 0))
          + parseFloat(String(prog.promoCost || 0));
        const uniqueCount = attendeeSet.size;
        const costPerParticipant = uniqueCount > 0 && totalBudget > 0
          ? totalBudget / uniqueCount
          : null;

        const repeatRate = eventIds.length > 1 && uniqueCount > 0
          ? Math.round(((totalAttendance - uniqueCount) / totalAttendance) * 100)
          : null;

        return {
          id: prog.id,
          name: prog.name,
          classification: prog.classification,
          status: prog.status,
          eventCount: eventIds.length,
          totalAttendance,
          uniqueAttendees: uniqueCount,
          repeatParticipationRate: repeatRate,
          confirmedDebriefs: linkedDebriefs.length,
          sentimentAverage: sentimentAvg,
          milestoneCount: linkedMilestones.length,
          totalBudget: totalBudget > 0 ? totalBudget : null,
          costPerParticipant,
        };
      }));

      res.json(effectiveness);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Cohort Analysis ──
  app.get("/api/cohort-analysis", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }
      if (isNaN(Date.parse(startDate)) || isNaN(Date.parse(endDate))) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      if (new Date(startDate) > new Date(endDate)) {
        return res.status(400).json({ message: "startDate must be before endDate" });
      }

      const programmeId = req.query.programmeId ? parseInt(req.query.programmeId as string) : undefined;
      if (req.query.programmeId && (programmeId === undefined || isNaN(programmeId))) {
        return res.status(400).json({ message: "Invalid programmeId" });
      }

      const contactIdsParam = req.query.contactIds as string | undefined;
      const contactIds = contactIdsParam ? contactIdsParam.split(",").map(Number).filter(n => !isNaN(n)) : undefined;

      const def: CohortDefinition = { userId, programmeId, startDate, endDate, contactIds };
      const metrics = await getCohortMetrics(def);
      res.json(metrics);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/cohort-comparison", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;

      const cohortAStart = req.query.cohortAStartDate as string;
      const cohortAEnd = req.query.cohortAEndDate as string;
      const cohortBStart = req.query.cohortBStartDate as string;
      const cohortBEnd = req.query.cohortBEndDate as string;

      if (!cohortAStart || !cohortAEnd || !cohortBStart || !cohortBEnd) {
        return res.status(400).json({ message: "Start and end dates required for both cohorts" });
      }
      for (const d of [cohortAStart, cohortAEnd, cohortBStart, cohortBEnd]) {
        if (isNaN(Date.parse(d))) return res.status(400).json({ message: "Invalid date format" });
      }
      if (new Date(cohortAStart) > new Date(cohortAEnd) || new Date(cohortBStart) > new Date(cohortBEnd)) {
        return res.status(400).json({ message: "Start date must be before end date for each cohort" });
      }

      const cohortAProgId = req.query.cohortAProgrammeId ? parseInt(req.query.cohortAProgrammeId as string) : undefined;
      const cohortBProgId = req.query.cohortBProgrammeId ? parseInt(req.query.cohortBProgrammeId as string) : undefined;

      const [cohortA, cohortB] = await Promise.all([
        getCohortMetrics({ userId, programmeId: cohortAProgId, startDate: cohortAStart, endDate: cohortAEnd }),
        getCohortMetrics({ userId, programmeId: cohortBProgId, startDate: cohortBStart, endDate: cohortBEnd }),
      ]);

      res.json({ cohortA, cohortB });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/programme-attributed-outcomes", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const programmeId = req.query.programmeId ? parseInt(req.query.programmeId as string) : undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const results = await getProgrammeAttributedOutcomes(userId, programmeId, startDate, endDate);
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Funder Tags List (distinct values across all entities) ──
  app.get("/api/funder-tags", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const progs = await storage.getProgrammes(userId);
      const debriefs = await storage.getImpactLogs(userId);
      const bookingList = await storage.getBookings(userId);
      const milestoneList = await storage.getMilestones(userId);
      const tagSet = new Set<string>();
      [...progs, ...debriefs, ...bookingList, ...milestoneList].forEach((item: any) => {
        if (item.funderTags && Array.isArray(item.funderTags)) {
          item.funderTags.forEach((t: string) => tagSet.add(t));
        }
      });
      res.json(Array.from(tagSet).sort());
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Legacy Report PDF Extraction ──
  app.post("/api/legacy-reports/:id/extract-metrics", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseId(req.params.id);
      const report = await storage.getLegacyReport(id);
      if (!report || report.userId !== userId) return res.status(404).json({ message: "Not found" });
      if (!report.pdfData) return res.status(400).json({ message: "No PDF data attached to this report" });

      const { PDFParse: PdfParser2 } = await import("pdf-parse");
      const pdfBuffer = Buffer.from(report.pdfData, "base64");
      const parser = new PdfParser2({ data: pdfBuffer });
      await (parser as any).load();
      const pdfResult = await parser.getText();
      const pdfText = pdfResult.text || "";

      const prompt = buildExtractionPrompt(pdfText);

      let parsed: any;
      try {
        parsed = await claudeJSON({
          model: "claude-haiku-4-5",
          prompt,
          temperature: 0.2,
        });
      } catch (e) {
        if (e instanceof AIKeyMissingError) throw e;
        parsed = { metrics: [] };
      }

      const suggestedMetrics = (parsed.metrics || []).map((m: any) => ({
        metricKey: m.metricKey,
        metricValue: m.metricValue,
        metricUnit: m.metricUnit || null,
        confidence: m.confidence || 0,
        evidenceSnippet: m.evidenceSnippet || null,
      }));

      const extractedOrganisations = (parsed.organisations || []).map((o: any) => ({
        name: o.name || "",
        type: o.type || "other",
        description: o.description || null,
        relationship: o.relationship || null,
      })).filter((o: any) => o.name);

      const extractedHighlights = (parsed.highlights || []).map((h: any) => ({
        theme: h.theme || "",
        summary: h.summary || "",
        activityType: h.activityType || null,
      })).filter((h: any) => h.theme && h.summary);

      const extractedPeople = (parsed.people || []).map((p: any) => ({
        name: p.name || "",
        role: p.role || null,
        context: p.context || null,
      })).filter((p: any) => p.name);

      const extraction = await storage.createLegacyReportExtraction({
        legacyReportId: id,
        suggestedMetrics,
        extractedOrganisations,
        extractedHighlights,
        extractedPeople,
        rawText: pdfText.substring(0, 20000),
      });

      res.json(extraction);
    } catch (err: any) {
      if (err instanceof AIKeyMissingError) return res.status(503).json({ message: err.message });
      console.error("PDF extraction error:", err);
      res.status(500).json({ message: "Failed to extract metrics from PDF" });
    }
  });

  app.get("/api/legacy-report-extractions/:reportId", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const reportId = parseId(req.params.reportId);
      const report = await storage.getLegacyReport(reportId);
      if (!report || report.userId !== userId) return res.status(404).json({ message: "Not found" });

      const extraction = await storage.getLegacyReportExtraction(reportId);
      if (!extraction) return res.status(404).json({ message: "No extraction found" });

      res.json(extraction);
    } catch (err: any) {
      console.error("Get extraction error:", err);
      res.status(500).json({ message: "Failed to get extraction" });
    }
  });

  app.post("/api/legacy-report-extractions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { legacyReportId, rawText, suggestedMetrics, extractedOrganisations, extractedHighlights, extractedPeople } = req.body;

      const report = await storage.getLegacyReport(legacyReportId);
      if (!report || report.userId !== userId) return res.status(404).json({ message: "Report not found" });

      const existing = await storage.getLegacyReportExtraction(legacyReportId);
      if (existing) return res.status(409).json({ message: "Extraction already exists for this report" });

      const extraction = await storage.createLegacyReportExtraction({
        legacyReportId,
        rawText: rawText || null,
        suggestedMetrics: suggestedMetrics || [],
        extractedOrganisations: extractedOrganisations || null,
        extractedHighlights: extractedHighlights || null,
        extractedPeople: extractedPeople || null,
      });

      res.status(201).json(extraction);
    } catch (err: any) {
      console.error("Create extraction error:", err);
      res.status(500).json({ message: "Failed to create extraction" });
    }
  });

  app.patch("/api/legacy-report-extractions/:reportId", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const reportId = parseId(req.params.reportId);
      const report = await storage.getLegacyReport(reportId);
      if (!report || report.userId !== userId) return res.status(404).json({ message: "Not found" });

      const extraction = await storage.getLegacyReportExtraction(reportId);
      if (!extraction) return res.status(404).json({ message: "No extraction found" });

      const { extractedHighlights, extractedPeople, extractedOrganisations } = req.body;
      const updates: any = {};
      if (extractedHighlights) updates.extractedHighlights = extractedHighlights;
      if (extractedPeople) updates.extractedPeople = extractedPeople;
      if (extractedOrganisations) updates.extractedOrganisations = extractedOrganisations;

      const updated = await storage.updateLegacyReportExtraction(extraction.id, updates);
      res.json(updated);
    } catch (err: any) {
      console.error("Update extraction error:", err);
      res.status(500).json({ message: "Failed to update extraction" });
    }
  });

  // ── Weekly Hub Debriefs ──
  app.get("/api/weekly-hub-debriefs", isAuthenticated, async (req, res) => {
    try {
      const debriefs = await storage.getWeeklyHubDebriefs((req.user as any).claims.sub);
      res.json(debriefs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/weekly-hub-debriefs/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const debrief = await storage.getWeeklyHubDebrief(parseId(req.params.id));
      if (!debrief || debrief.userId !== userId) return res.status(404).json({ message: "Not found" });
      res.json(debrief);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/weekly-hub-debriefs/generate", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { weekStartDate } = req.body;
      if (!weekStartDate) return res.status(400).json({ message: "weekStartDate required" });

      const weekStart = getNZWeekStart(new Date(weekStartDate));
      const weekEnd = getNZWeekEnd(new Date(weekStartDate));

      const existing = await storage.getWeeklyHubDebriefByWeek(userId, weekStart);
      if (existing) return res.status(409).json({ message: "A debrief for this week already exists", existing });

      const allDebriefs = await storage.getImpactLogs(userId);
      const allEvents = await storage.getEvents(userId);
      const eventsById = new Map(allEvents.map(e => [e.id, e]));

      const getDebriefWeekDate = (d: any): Date => {
        if (d.eventId) {
          const event = eventsById.get(d.eventId);
          if (event?.startTime) return new Date(event.startTime);
        }
        if (d.confirmedAt) return new Date(d.confirmedAt);
        return new Date(d.createdAt);
      };

      const confirmedDebriefs = (allDebriefs as any[]).filter((d: any) => {
        if (d.status !== "confirmed") return false;
        const weekDate = getDebriefWeekDate(d);
        return weekDate >= weekStart && weekDate <= weekEnd;
      });

      const allProgrammes = await storage.getProgrammes(userId);
      const completedProgrammes = allProgrammes.filter((p: any) => {
        if (p.status !== "completed") return false;
        const end = p.endDate ? new Date(p.endDate) : null;
        return end && end >= weekStart && end <= weekEnd;
      });

      const allBookings = await storage.getBookings(userId);
      const completedBookings = allBookings.filter((b: any) => {
        if (b.status !== "completed") return false;
        const d = b.bookingDate ? new Date(b.bookingDate) : null;
        return d && d >= weekStart && d <= weekEnd;
      });

      const allMilestones = await storage.getMilestones(userId);
      const weekMilestones = allMilestones.filter(m => {
        const created = m.createdAt ? new Date(m.createdAt) : null;
        return created && created >= weekStart && created <= weekEnd;
      });

      const allTaxonomy = await storage.getTaxonomy(userId);
      const taxonomyCounts: Record<string, number> = {};
      for (const d of confirmedDebriefs) {
        const tags = await storage.getImpactTags(d.id);
        for (const tag of tags) {
          const tax = allTaxonomy.find((t: any) => t.id === tag.taxonomyId);
          if (tax) {
            taxonomyCounts[tax.name] = (taxonomyCounts[tax.name] || 0) + 1;
          }
        }
      }
      const topThemes = Object.entries(taxonomyCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([theme]) => theme);

      const sentimentMap: Record<string, number> = { positive: 3, neutral: 2, negative: 1 };
      const sentiments = confirmedDebriefs.map((d: any) => d.sentiment).filter(Boolean);
      const sentimentBreakdown: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
      sentiments.forEach((s: string) => { sentimentBreakdown[s] = (sentimentBreakdown[s] || 0) + 1; });
      const sentimentAvg = sentiments.length > 0
        ? sentiments.reduce((sum: number, s: string) => sum + (sentimentMap[s] || 2), 0) / sentiments.length
        : null;

      const outstandingDebriefs = (allDebriefs as any[]).filter((d: any) => {
        if (d.status !== "pending_review" && d.status !== "draft") return false;
        const weekDate = getDebriefWeekDate(d);
        return weekDate >= weekStart && weekDate <= weekEnd;
      }).length;
      const backlogDebriefs = (allDebriefs as any[]).filter((d: any) => d.status === "pending_review" || d.status === "draft").length;

      const nextWeekDate = new Date(weekEnd);
      nextWeekDate.setDate(nextWeekDate.getDate() + 1);
      const nextWeekStart = getNZWeekStart(nextWeekDate);
      const nextWeekEnd = getNZWeekEnd(nextWeekDate);
      const upcomingEvents = allEvents.filter(e => {
        const d = new Date(e.startTime);
        return d >= nextWeekStart && d <= nextWeekEnd;
      });

      const allActionItems = await storage.getActionItems(userId);
      const weekActions = allActionItems.filter(a => {
        const created = a.createdAt ? new Date(a.createdAt) : null;
        return created && created >= weekStart && created <= weekEnd;
      });
      const actionsCreated = weekActions.length;
      const actionsCompleted = weekActions.filter(a => a.status === "completed").length;

      const metricKeys = ["mindset", "skill", "confidence", "businessConfidence", "systems", "fundingReadiness", "network"];
      const metricSums: Record<string, number> = {};
      const metricCounts: Record<string, number> = {};
      const allKeyQuotes: string[] = [];

      for (const d of confirmedDebriefs) {
        const reviewed = (d as any).reviewedData || (d as any).rawExtraction;
        const m = reviewed?.metrics;
        if (m) {
          for (const key of metricKeys) {
            if (m[key] !== undefined && m[key] !== null && typeof m[key] === "number") {
              metricSums[key] = (metricSums[key] || 0) + m[key];
              metricCounts[key] = (metricCounts[key] || 0) + 1;
            }
          }
        }
        if (d.keyQuotes && Array.isArray(d.keyQuotes)) {
          allKeyQuotes.push(...d.keyQuotes);
        }
      }

      const averagedDevelopmentMetrics: Record<string, number> = {};
      for (const key of metricKeys) {
        if (metricCounts[key] > 0) {
          averagedDevelopmentMetrics[key] = Math.round((metricSums[key] / metricCounts[key]) * 10) / 10;
        }
      }

      const keyQuotes = allKeyQuotes.slice(0, 5);

      const metrics: Record<string, any> = {
        confirmedDebriefs: confirmedDebriefs.length,
        completedProgrammes: completedProgrammes.length,
        completedBookings: completedBookings.length,
        milestonesCreated: weekMilestones.length,
        outstandingDebriefs,
        backlogDebriefs,
        upcomingEventsNextWeek: upcomingEvents.length,
        actionsCreated,
        actionsCompleted,
        averagedDevelopmentMetrics: Object.keys(averagedDevelopmentMetrics).length > 0 ? averagedDevelopmentMetrics : null,
        keyQuotes: keyQuotes.length > 0 ? keyQuotes : null,
        sourceDebriefIds: confirmedDebriefs.map((d: any) => d.id),
      };

      const summaryParts: string[] = [];
      if (confirmedDebriefs.length > 0) summaryParts.push(`${confirmedDebriefs.length} debrief${confirmedDebriefs.length > 1 ? "s" : ""} confirmed`);
      else summaryParts.push("No debriefs confirmed this week");
      if (completedProgrammes.length > 0) summaryParts.push(`${completedProgrammes.length} programme${completedProgrammes.length > 1 ? "s" : ""} completed`);
      if (completedBookings.length > 0) summaryParts.push(`${completedBookings.length} booking${completedBookings.length > 1 ? "s" : ""} completed`);
      if (weekMilestones.length > 0) summaryParts.push(`${weekMilestones.length} milestone${weekMilestones.length > 1 ? "s" : ""} created`);
      if (actionsCreated > 0) summaryParts.push(`${actionsCreated} action${actionsCreated > 1 ? "s" : ""} created, ${actionsCompleted} completed`);
      if (topThemes.length > 0) summaryParts.push(`Top themes: ${topThemes.join(", ")}`);
      if (sentimentAvg !== null) {
        const label = sentimentAvg >= 2.5 ? "positive" : sentimentAvg >= 1.5 ? "neutral" : "negative";
        summaryParts.push(`Overall sentiment: ${label} (n=${sentiments.length})`);
      }
      if (outstandingDebriefs > 0) summaryParts.push(`${outstandingDebriefs} event${outstandingDebriefs > 1 ? "s" : ""} still to be debriefed this week`);
      if (backlogDebriefs > outstandingDebriefs) summaryParts.push(`${backlogDebriefs} total outstanding across all time`);
      if (upcomingEvents.length > 0) summaryParts.push(`${upcomingEvents.length} event${upcomingEvents.length > 1 ? "s" : ""} upcoming next week`);

      const generatedSummary = summaryParts.join(". ") + ".";

      const debrief = await storage.createWeeklyHubDebrief({
        userId,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        status: "draft",
        generatedSummaryText: generatedSummary,
        finalSummaryText: null,
        metricsJson: metrics,
        themesJson: topThemes,
        sentimentJson: {
          average: sentimentAvg,
          sampleSize: sentiments.length,
          breakdown: sentimentBreakdown,
        },
      });

      res.status(201).json(debrief);
    } catch (err: any) {
      console.error("Generate weekly debrief error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/weekly-hub-debriefs/:id/refresh", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const existing = await storage.getWeeklyHubDebrief(id);
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.status !== "draft") return res.status(400).json({ message: "Only draft debriefs can be refreshed" });

      const userId = (req.user as any).claims.sub;
      const weekStart = new Date(existing.weekStartDate);
      const weekEnd = new Date(existing.weekEndDate);

      const allDebriefs = await storage.getImpactLogs(userId);
      const allEvents = await storage.getEvents(userId);
      const eventsById = new Map(allEvents.map(e => [e.id, e]));

      const getDebriefWeekDate = (d: any): Date => {
        if (d.eventId) {
          const event = eventsById.get(d.eventId);
          if (event?.startTime) return new Date(event.startTime);
        }
        if (d.confirmedAt) return new Date(d.confirmedAt);
        return new Date(d.createdAt);
      };

      const confirmedDebriefs = (allDebriefs as any[]).filter((d: any) => {
        if (d.status !== "confirmed") return false;
        const weekDate = getDebriefWeekDate(d);
        return weekDate >= weekStart && weekDate <= weekEnd;
      });

      const allProgrammes = await storage.getProgrammes(userId);
      const completedProgrammes = allProgrammes.filter((p: any) => {
        if (p.status !== "completed") return false;
        const end = p.endDate ? new Date(p.endDate) : null;
        return end && end >= weekStart && end <= weekEnd;
      });

      const allBookings = await storage.getBookings(userId);
      const completedBookings = allBookings.filter((b: any) => {
        if (b.status !== "completed") return false;
        const d = b.bookingDate ? new Date(b.bookingDate) : null;
        return d && d >= weekStart && d <= weekEnd;
      });

      const allMilestones = await storage.getMilestones(userId);
      const weekMilestones = allMilestones.filter(m => {
        const created = m.createdAt ? new Date(m.createdAt) : null;
        return created && created >= weekStart && created <= weekEnd;
      });

      const allTaxonomy = await storage.getTaxonomy(userId);
      const taxonomyCounts: Record<string, number> = {};
      for (const d of confirmedDebriefs) {
        const tags = await storage.getImpactTags(d.id);
        for (const tag of tags) {
          const tax = allTaxonomy.find((t: any) => t.id === tag.taxonomyId);
          if (tax) {
            taxonomyCounts[tax.name] = (taxonomyCounts[tax.name] || 0) + 1;
          }
        }
      }
      const topThemes = Object.entries(taxonomyCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([theme]) => theme);

      const sentimentMap: Record<string, number> = { positive: 3, neutral: 2, negative: 1 };
      const sentiments = confirmedDebriefs.map((d: any) => d.sentiment).filter(Boolean);
      const sentimentBreakdown: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
      sentiments.forEach((s: string) => { sentimentBreakdown[s] = (sentimentBreakdown[s] || 0) + 1; });
      const sentimentAvg = sentiments.length > 0
        ? sentiments.reduce((sum: number, s: string) => sum + (sentimentMap[s] || 2), 0) / sentiments.length
        : null;

      const outstandingDebriefs = (allDebriefs as any[]).filter((d: any) => {
        if (d.status !== "pending_review" && d.status !== "draft") return false;
        const weekDate = getDebriefWeekDate(d);
        return weekDate >= weekStart && weekDate <= weekEnd;
      }).length;
      const backlogDebriefs = (allDebriefs as any[]).filter((d: any) => d.status === "pending_review" || d.status === "draft").length;

      const nextWeekDate = new Date(weekEnd);
      nextWeekDate.setDate(nextWeekDate.getDate() + 1);
      const nextWeekStart = getNZWeekStart(nextWeekDate);
      const nextWeekEnd = getNZWeekEnd(nextWeekDate);
      const upcomingEvents = allEvents.filter(e => {
        const d = new Date(e.startTime);
        return d >= nextWeekStart && d <= nextWeekEnd;
      });

      const allActionItems = await storage.getActionItems(userId);
      const weekActions = allActionItems.filter(a => {
        const created = a.createdAt ? new Date(a.createdAt) : null;
        return created && created >= weekStart && created <= weekEnd;
      });
      const actionsCreated = weekActions.length;
      const actionsCompleted = weekActions.filter(a => a.status === "completed").length;

      const metricKeys = ["mindset", "skill", "confidence", "businessConfidence", "systems", "fundingReadiness", "network"];
      const metricSums: Record<string, number> = {};
      const metricCounts: Record<string, number> = {};
      const allKeyQuotes: string[] = [];

      for (const d of confirmedDebriefs) {
        const reviewed = (d as any).reviewedData || (d as any).rawExtraction;
        const m = reviewed?.metrics;
        if (m) {
          for (const key of metricKeys) {
            if (m[key] !== undefined && m[key] !== null && typeof m[key] === "number") {
              metricSums[key] = (metricSums[key] || 0) + m[key];
              metricCounts[key] = (metricCounts[key] || 0) + 1;
            }
          }
        }
        if (d.keyQuotes && Array.isArray(d.keyQuotes)) {
          allKeyQuotes.push(...d.keyQuotes);
        }
      }

      const averagedDevelopmentMetrics: Record<string, number> = {};
      for (const key of metricKeys) {
        if (metricCounts[key] > 0) {
          averagedDevelopmentMetrics[key] = Math.round((metricSums[key] / metricCounts[key]) * 10) / 10;
        }
      }

      const keyQuotes = allKeyQuotes.slice(0, 5);

      const metrics: Record<string, any> = {
        confirmedDebriefs: confirmedDebriefs.length,
        completedProgrammes: completedProgrammes.length,
        completedBookings: completedBookings.length,
        milestonesCreated: weekMilestones.length,
        outstandingDebriefs,
        backlogDebriefs,
        upcomingEventsNextWeek: upcomingEvents.length,
        actionsCreated,
        actionsCompleted,
        averagedDevelopmentMetrics: Object.keys(averagedDevelopmentMetrics).length > 0 ? averagedDevelopmentMetrics : null,
        keyQuotes: keyQuotes.length > 0 ? keyQuotes : null,
        sourceDebriefIds: confirmedDebriefs.map((d: any) => d.id),
      };

      const summaryParts: string[] = [];
      if (confirmedDebriefs.length > 0) summaryParts.push(`${confirmedDebriefs.length} debrief${confirmedDebriefs.length > 1 ? "s" : ""} confirmed`);
      else summaryParts.push("No debriefs confirmed this week");
      if (completedProgrammes.length > 0) summaryParts.push(`${completedProgrammes.length} programme${completedProgrammes.length > 1 ? "s" : ""} completed`);
      if (completedBookings.length > 0) summaryParts.push(`${completedBookings.length} booking${completedBookings.length > 1 ? "s" : ""} completed`);
      if (weekMilestones.length > 0) summaryParts.push(`${weekMilestones.length} milestone${weekMilestones.length > 1 ? "s" : ""} created`);
      if (actionsCreated > 0) summaryParts.push(`${actionsCreated} action${actionsCreated > 1 ? "s" : ""} created, ${actionsCompleted} completed`);
      if (topThemes.length > 0) summaryParts.push(`Top themes: ${topThemes.join(", ")}`);
      if (sentimentAvg !== null) {
        const label = sentimentAvg >= 2.5 ? "positive" : sentimentAvg >= 1.5 ? "neutral" : "negative";
        summaryParts.push(`Overall sentiment: ${label} (n=${sentiments.length})`);
      }
      if (outstandingDebriefs > 0) summaryParts.push(`${outstandingDebriefs} event${outstandingDebriefs > 1 ? "s" : ""} still to be debriefed this week`);
      if (backlogDebriefs > outstandingDebriefs) summaryParts.push(`${backlogDebriefs} total outstanding across all time`);
      if (upcomingEvents.length > 0) summaryParts.push(`${upcomingEvents.length} event${upcomingEvents.length > 1 ? "s" : ""} upcoming next week`);

      const generatedSummary = summaryParts.join(". ") + ".";

      const updated = await storage.updateWeeklyHubDebrief(id, {
        generatedSummaryText: generatedSummary,
        metricsJson: metrics,
        themesJson: topThemes,
        sentimentJson: {
          average: sentimentAvg,
          sampleSize: sentiments.length,
          breakdown: sentimentBreakdown,
        },
      });

      res.json(updated);
    } catch (err: any) {
      console.error("Refresh weekly debrief error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/weekly-hub-debriefs/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const existing = await storage.getWeeklyHubDebrief(id);
      if (!existing) return res.status(404).json({ message: "Not found" });

      const { finalSummaryText, status } = req.body;
      const updates: any = {};
      if (finalSummaryText !== undefined) updates.finalSummaryText = finalSummaryText;
      if (status === "confirmed" && existing.status !== "confirmed") {
        updates.status = "confirmed";
        updates.confirmedAt = new Date();
      } else if (status === "draft") {
        updates.status = "draft";
        updates.confirmedAt = null;
      }

      const updated = await storage.updateWeeklyHubDebrief(id, updates);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/weekly-hub-debriefs/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteWeeklyHubDebrief(parseId(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === Taxonomy Scan - AI-powered suggestion engine ===
  app.post("/api/taxonomy/scan-suggestions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;

      const taxonomy = await storage.getTaxonomy(userId);
      const keywords = await storage.getKeywords(userId);
      const existingCategories = taxonomy.map(t => ({
        name: t.name,
        description: t.description,
        active: t.active,
      }));
      const existingKeywords = keywords.map(k => {
        const cat = taxonomy.find(t => t.id === k.taxonomyId);
        return { phrase: k.phrase, category: cat?.name || "Unknown" };
      });

      const legacyReports = await storage.getLegacyReports(userId);
      const confirmedReports = legacyReports.filter(r => r.status === "confirmed");

      const reportSummaries: string[] = [];
      for (const report of confirmedReports.slice(0, 24)) {
        const extraction = await storage.getLegacyReportExtraction(report.id);
        const parts: string[] = [`Period: ${report.quarterLabel}`];
        if (extraction?.extractedOrganisations) {
          const orgs = extraction.extractedOrganisations as any[];
          parts.push(`Organisations: ${orgs.map((o: any) => `${o.name} (${o.relationshipTier || "unknown"})`).join(", ")}`);
        }
        if (extraction?.extractedHighlights) {
          const highlights = extraction.extractedHighlights as any[];
          parts.push(`Highlights: ${highlights.map((h: any) => `${h.theme}: ${h.summary}`).join("; ")}`);
        }
        if (extraction?.extractedPeople) {
          const people = extraction.extractedPeople as any[];
          if (people.length > 0) {
            parts.push(`People mentioned: ${people.map((p: any) => `${p.name} (${p.role || "unknown"})`).join(", ")}`);
          }
        }
        reportSummaries.push(parts.join("\n"));
      }

      const contacts = await storage.getContacts(userId);
      const interactionSummaries: string[] = [];
      for (const contact of contacts.slice(0, 20)) {
        const interactions = await storage.getInteractions(contact.id);
        const recentInteractions = interactions.slice(0, 5);
        for (const interaction of recentInteractions) {
          if ((interaction as any).notes || interaction.transcript) {
            const text = ((interaction as any).notes || interaction.transcript || "").slice(0, 200);
            interactionSummaries.push(`${contact.name} - ${interaction.type}: ${text}`);
          }
        }
      }

      const prompt = `You are analyzing data from a community hub/mentorship platform to suggest NEW impact taxonomy categories and keywords.

EXISTING CATEGORIES:
${JSON.stringify(existingCategories, null, 2)}

EXISTING KEYWORDS:
${JSON.stringify(existingKeywords, null, 2)}

DATA FROM LEGACY REPORTS (${confirmedReports.length} confirmed reports):
${reportSummaries.join("\n---\n")}

DATA FROM INTERACTIONS (sample):
${interactionSummaries.slice(0, 30).join("\n")}

Your task:
1. Analyze all the data above for recurring themes, activities, and impact areas
2. Suggest NEW categories that are NOT already covered by existing ones
3. Suggest NEW keywords that could map to existing OR new categories
4. Focus on categories relevant to community impact, mentorship, youth development, events, partnerships, and social outcomes
5. Do NOT suggest categories that duplicate existing ones (even with different wording)

Return a JSON object with this exact structure:
{
  "categorySuggestions": [
    { "name": "Category Name", "description": "Why this category should be added", "color": "suggested color (purple/blue/green/amber/red/pink/teal/orange/cyan/indigo)", "confidence": 85, "evidence": "Brief quote or reference from the data" }
  ],
  "keywordSuggestions": [
    { "phrase": "keyword phrase", "suggestedCategory": "category name (existing or new)", "confidence": 80, "evidence": "Where this phrase appears in the data" }
  ]
}

Only suggest items with confidence >= 60. Limit to 10 categories and 15 keywords max.`;

      let result: any;
      try {
        result = await claudeJSON({
          model: "claude-haiku-4-5",
          prompt,
          temperature: 0.3,
        });
      } catch (e) {
        if (e instanceof AIKeyMissingError) throw e;
        result = { categorySuggestions: [], keywordSuggestions: [] };
      }
      res.json({
        categorySuggestions: result.categorySuggestions || [],
        keywordSuggestions: result.keywordSuggestions || [],
        scannedReports: confirmedReports.length,
        scannedInteractions: interactionSummaries.length,
      });
    } catch (err: any) {
      if (err instanceof AIKeyMissingError) return res.status(503).json({ message: err.message });
      console.error("Taxonomy scan error:", err);
      res.status(500).json({ message: "Failed to scan for taxonomy suggestions" });
    }
  });

  // === Dashboard Pulse — operator snapshot in one call ===
  app.get("/api/dashboard/pulse", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const now = new Date();
      const monthParam = req.query.month as string | undefined;
      const anchor = monthParam ? new Date(monthParam + "-01") : now;
      const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
      const monthStartStr = monthStart.toISOString().split("T")[0];
      const monthEndStr = monthEnd.toISOString().split("T")[0];

      const [
        delivery,
        enquiryRows,
        draftRows,
        needsDebriefRows,
        menteeRows,
        innovatorRows,
        ftRows,
      ] = await Promise.all([
        getDeliveryMetrics({ userId, startDate: monthStartStr, endDate: monthEndStr }),
        db.execute(sql`
          SELECT COUNT(*) as count FROM bookings
          WHERE user_id = ${userId} AND status = 'enquiry'
        `),
        db.execute(sql`
          SELECT COUNT(*) as count FROM impact_logs
          WHERE user_id = ${userId} AND status = 'draft'
        `),
        db.execute(sql`
          SELECT COUNT(*) as count FROM events e
          WHERE e.user_id = ${userId}
            AND e.requires_debrief = true
            AND e.event_status = 'active'
            AND e.end_time < ${now}
            AND NOT EXISTS (
              SELECT 1 FROM impact_logs il WHERE il.event_id = e.id
            )
        `),
        db.execute(sql`
          SELECT COUNT(*) as count FROM mentoring_relationships mr
          JOIN contacts c ON c.id = mr.contact_id
          WHERE c.user_id = ${userId} AND mr.status = 'active'
        `),
        db.execute(sql`
          SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN relationship_stage = 'kakano' THEN 1 END) as kakano,
            COUNT(CASE WHEN relationship_stage = 'tipu' THEN 1 END) as tipu,
            COUNT(CASE WHEN relationship_stage = 'ora' THEN 1 END) as ora
          FROM contacts
          WHERE user_id = ${userId} AND is_innovator = true AND active = true AND is_archived = false
        `),
        db.execute(sql`
          SELECT COALESCE(SUM(count), 0) as total FROM daily_foot_traffic
          WHERE user_id = ${userId}
            AND date >= ${monthStart} AND date < ${monthEnd}
        `),
      ]);

      const enquiries = Number((enquiryRows as any).rows?.[0]?.count || 0);
      const draftDebriefs = Number((draftRows as any).rows?.[0]?.count || 0);
      const needsDebrief = Number((needsDebriefRows as any).rows?.[0]?.count || 0);
      const activeMentees = Number((menteeRows as any).rows?.[0]?.count || 0);
      const inv = (innovatorRows as any).rows?.[0] || {};
      const footTraffic = Number((ftRows as any).rows?.[0]?.total || 0);

      res.json({
        needsAttention: {
          enquiries,
          draftDebriefs,
          needsDebrief,
          total: enquiries + draftDebriefs + needsDebrief,
        },
        thisMonth: {
          activations: delivery.totalActivations || 0,
          mentoringSessions: delivery.mentoringSessions || 0,
          programmes: delivery.programmes?.total || 0,
          venueHires: delivery.bookings?.total || 0,
          footTraffic,
        },
        community: {
          innovators: Number(inv.total || 0),
          kakano: Number(inv.kakano || 0),
          tipu: Number(inv.tipu || 0),
          ora: Number(inv.ora || 0),
          activeMentees,
        },
      });
    } catch (err: any) {
      console.error("Dashboard pulse error:", err);
      res.status(500).json({ message: "Failed to fetch dashboard pulse" });
    }
  });

  // === Dashboard Outstanding Actions ===
  app.get("/api/dashboard/outstanding-actions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const allActions = await storage.getActionItems(userId);
      const outstanding = allActions
        .filter(a => a.status !== "completed")
        .sort((a, b) => {
          const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          if (aDue !== bDue) return aDue - bDue;
          const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bCreated - aCreated;
        })
        .slice(0, 10);

      res.json(outstanding);
    } catch (err: any) {
      console.error("Outstanding actions error:", err);
      res.status(500).json({ message: "Failed to fetch outstanding actions" });
    }
  });
}
