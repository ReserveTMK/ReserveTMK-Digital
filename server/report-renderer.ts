/**
 * Report Renderer — generates standalone branded HTML reports
 * Reuses CSS/structure from Q3-Report.html
 * Two modes: monthly (Auckland Council) and quarterly (Māori Outcomes)
 */

// ── Types ──────────────────────────────────────────────────────

export interface OperatorInsightsData {
  totalDebriefs: number;
  sentimentBreakdown: Record<string, number>;
  wins: string[];
  concerns: string[];
  learnings: string[];
  standoutQuotes: string[];
}

export interface MonthlyReportData {
  period: { month: string; year: number; label: string; fyLabel: string };
  funderName?: string;
  deliveryNumbers: { activations: number; capabilityBuilding: number; footTraffic: number; ytdActivations: number; ytdCapability: number; ytdFootTraffic: number };
  communitySnapshot: { maori: number; pasifika: number; rangatahi: number; total: number; kakano: number; tipu: number; ora: number; innovatorTotal: number };
  spaceUse: Array<{ organisation: string; type: string; bookings: number; maori: boolean; pasifika: boolean; servesMaori: boolean; servesPasifika: boolean }>;
  updates: Record<string, string[]>;
  quotes: Array<{ text: string; attribution: string }>;
  plannedNextMonth: Array<{ title: string; description: string }>;
  taxonomyBreakdown?: Array<{ categoryName: string; funderName: string; entityCounts: Record<string, number>; total: number }>;
  operatorInsights?: OperatorInsightsData;
}

export interface MaoriPipelineData {
  innovators: { total: number; kakano: number; tipu: number; ora: number };
  inMentoring: number;
  inProgrammes: number;
  stageProgressions: number;
  pasifikaInnovators: { total: number; kakano: number; tipu: number; ora: number };
  maoriOrgs: Array<{ name: string; bookings: number }>;
  previousQuarter?: { innovatorTotal: number; activations: number; footTraffic: number; capabilityBuilding: number };
}

export interface QuarterlyReportData {
  period: { quarter: string; year: number; label: string; fyLabel: string; months: string[] };
  funderName?: string;
  deliveryNumbers: Array<{ metric: string; values: Record<string, number>; quarterTotal: number; ytd: number }>;
  communitySnapshot: { maori: number; pasifika: number; rangatahi: number; total: number; kakano: number; tipu: number; ora: number; innovatorTotal: number };
  spaceUse: Array<{ organisation: string; type: string; bookings: number; maori: boolean; pasifika: boolean; servesMaori: boolean; servesPasifika: boolean }>;
  updates: Record<string, string[]>;
  quotes: Array<{ text: string; attribution: string }>;
  plannedNextQuarter: Array<{ title: string; description: string }>;
  footTraffic: { total: number; byMonth: Record<string, number> };
  maoriPipeline?: MaoriPipelineData;
  taxonomyBreakdown?: Array<{ categoryName: string; funderName: string; entityCounts: Record<string, number>; total: number }>;
  operatorInsights?: OperatorInsightsData;
  concernArcs?: {
    arcs: Array<{
      concern: string;
      raisedIn: string;
      raisedDate: string;
      contactNames: string[];
      resolution: string | null;
      resolvedIn: string | null;
      resolvedDate: string | null;
      status: "resolved" | "unresolved";
    }>;
    resolvedCount: number;
    unresolvedCount: number;
  };
}

// ── Shared CSS ─────────────────────────────────────────────────

const REPORT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #1a1a1a; background: #fff; font-size: 14px; line-height: 1.6;
    max-width: 820px; margin: 0 auto; padding: 60px 48px;
  }

  .header { border-bottom: 3px solid #003F2B; padding-bottom: 28px; margin-bottom: 40px; }
  .header-tag { font-size: 10px; font-weight: 600; letter-spacing: 2.5px; text-transform: uppercase; color: #888; margin-bottom: 10px; }
  h1 { font-size: 34px; font-weight: 700; line-height: 1.15; margin-bottom: 4px; }
  .subtitle { font-size: 13px; color: #888; margin-bottom: 18px; }
  .lede { font-size: 13px; font-weight: 500; border-left: 3px solid #1a1a1a; padding-left: 14px; color: #444; line-height: 1.5; }

  .section { margin-bottom: 44px; }
  h2 { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #F58968; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #fde8e0; }
  h3 { font-size: 13px; font-weight: 600; margin: 20px 0 8px; color: #003F2B; }

  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; }
  th { text-align: left; padding: 8px 10px; font-size: 10px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: #888; border-bottom: 2px solid #e8e8e8; background: #fafafa; }
  td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .num { font-size: 16px; font-weight: 700; text-align: right; }
  .total-row td { font-weight: 600; background: #f7f7f7; }

  .snapshot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 4px; }
  .snapshot-card { background: #f7f7f7; border-radius: 8px; padding: 18px 20px; }
  .snapshot-card.dark { background: #003F2B; color: #fff; }
  .snapshot-label { font-size: 10px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: #888; margin-bottom: 12px; }
  .snapshot-card.dark .snapshot-label { color: #6aaa8a; }
  .snapshot-row { display: flex; justify-content: space-between; align-items: baseline; padding: 6px 0; border-bottom: 1px solid #ececec; }
  .snapshot-card.dark .snapshot-row { border-bottom-color: #1a5c3a; }
  .snapshot-row:last-child { border-bottom: none; }
  .snapshot-key { font-size: 12px; color: #555; }
  .snapshot-card.dark .snapshot-key { color: #a8d4bc; }
  .snapshot-val { font-size: 18px; font-weight: 700; }

  .bullets { list-style: none; padding: 0; }
  .bullets li { padding: 5px 0 5px 16px; position: relative; font-size: 13px; color: #333; border-bottom: 1px solid #f5f5f5; line-height: 1.55; }
  .bullets li:last-child { border-bottom: none; }
  .bullets li::before { content: "•"; position: absolute; left: 0; color: #aaa; }

  .quotes { display: flex; flex-direction: column; gap: 20px; }
  .quote { border-left: 3px solid #1a1a1a; padding: 12px 18px; background: #f9f9f9; border-radius: 0 6px 6px 0; }
  .quote p { font-size: 14px; font-style: italic; color: #222; margin-bottom: 6px; line-height: 1.5; }
  .quote cite { font-size: 11px; font-weight: 600; color: #888; font-style: normal; letter-spacing: 0.3px; }

  .next-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .next-item { background: #f7f7f7; border-radius: 6px; padding: 12px 14px; font-size: 12px; color: #444; line-height: 1.4; }
  .next-item strong { display: block; font-size: 11px; font-weight: 600; color: #1a1a1a; margin-bottom: 3px; }

  .check { color: #003F2B; font-weight: 700; font-size: 15px; }
  .warning { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; padding: 10px 14px; font-size: 12px; color: #92400e; margin-top: 12px; }
  .warning strong { color: #78350f; }

  .footer { margin-top: 52px; padding-top: 20px; border-top: 2px solid #003F2B; display: flex; justify-content: space-between; align-items: center; }
  .footer-org { font-size: 12px; font-weight: 600; }
  .footer-date { font-size: 11px; color: #999; }

  @media print {
    body { padding: 32px 40px; }
    h2 { page-break-after: avoid; }
    .section { page-break-inside: avoid; }
    .warning { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
`;

// ── Helpers ─────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function checkMark(val: boolean): string {
  return val ? '<span class="check">✓</span>' : "";
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function communityLabel(led: boolean, serves: boolean): string {
  if (led && serves) return "Led + Serves";
  if (led) return "Led";
  if (serves) return "Serves";
  return "—";
}

function monthLabel(monthStr: string): string {
  const [, m] = monthStr.split("-");
  return MONTH_NAMES[parseInt(m, 10) - 1] || monthStr;
}

// ── Monthly Report Renderer ─────────────────────────────────────

export function renderMonthlyReport(data: MonthlyReportData): string {
  const { period, deliveryNumbers, communitySnapshot, spaceUse, updates, quotes, plannedNextMonth } = data;

  const mLabel = monthLabel(period.month);
  const monthTotal = deliveryNumbers.activations + deliveryNumbers.capabilityBuilding + deliveryNumbers.footTraffic;

  // Space Use rows
  const spaceRows = spaceUse.map(s => `
    <tr>
      <td>${esc(s.organisation)}</td>
      <td>${esc(s.type)}</td>
      <td style="text-align:center">${s.bookings}</td>
      <td style="text-align:center">${communityLabel(s.maori, s.servesMaori)}</td>
      <td style="text-align:center">${communityLabel(s.pasifika, s.servesPasifika)}</td>
    </tr>
  `).join("");

  // Updates sections
  const updateSections = Object.entries(updates).map(([heading, items]) => `
    <h3>${esc(heading)}</h3>
    <ul class="bullets">${items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>
  `).join("");

  // Taxonomy breakdown rows
  const hasTaxonomy = data.taxonomyBreakdown && data.taxonomyBreakdown.length > 0;
  const taxonomyRows = (data.taxonomyBreakdown || []).map(t => `
    <tr>
      <td>${esc(t.categoryName)}</td>
      <td style="text-align:center">${t.entityCounts["debrief"] || 0}</td>
      <td style="text-align:center">${t.entityCounts["booking"] || 0}</td>
      <td style="text-align:center">${t.entityCounts["programme"] || 0}</td>
      <td style="text-align:center"><strong>${t.total}</strong></td>
    </tr>
  `).join("");

  // Section numbering — shift if taxonomy section present
  const sn = (base: number) => hasTaxonomy ? base + 1 : base;

  // Quote blocks
  const quoteBlocks = quotes.map(q => `
    <div class="quote">
      <p>"${esc(q.text)}"</p>
      <cite>${esc(q.attribution)}</cite>
    </div>
  `).join("");

  // Planned next month items
  const nextItems = plannedNextMonth.map(n =>
    `<div class="next-item"><strong>${esc(n.title)}</strong>${esc(n.description)}</div>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Reserve Tāmaki — ${esc(period.label)} Report</title>
<style>${REPORT_CSS}</style>
</head>
<body>

<div class="header">
  <div class="header-tag">Monthly Report · ${esc(period.fyLabel)}${data.funderName ? ` · ${esc(data.funderName)}` : ""}</div>
  <h1>Reserve Tāmaki</h1>
  <div class="subtitle">${esc(period.label)}</div>
</div>

<div class="section">
  <h2>1. Delivery Numbers</h2>
  <table>
    <thead><tr><th>Metric</th><th style="text-align:right">${esc(mLabel)}</th><th style="text-align:right">YTD ${esc(period.fyLabel)}</th></tr></thead>
    <tbody>
      <tr><td><strong>Activations*</strong></td><td class="num">${deliveryNumbers.activations}</td><td class="num">${deliveryNumbers.ytdActivations}</td></tr>
      <tr><td><strong>Capability Building†</strong></td><td class="num">${deliveryNumbers.capabilityBuilding}</td><td class="num">${deliveryNumbers.ytdCapability}</td></tr>
      <tr><td><strong>Foot Traffic</strong></td><td class="num">${deliveryNumbers.footTraffic}</td><td class="num">${deliveryNumbers.ytdFootTraffic}</td></tr>
      <tr class="total-row"><td><strong>Total</strong></td><td class="num">${monthTotal}</td><td class="num">&mdash;</td></tr>
    </tbody>
  </table>
  <p style="font-size:11px;color:#888;margin-top:6px;">*Activations = all activity in the space. †Capability Building = Mentoring (1:1) and Programmes (1:Few).</p>
</div>

<div class="section">
  <h2>2. Community Snapshot</h2>
  <p style="font-size:12px;color:#888;margin-bottom:10px;">As at ${esc(mLabel)} ${period.year}</p>
  <div class="snapshot-grid">
    <div class="snapshot-card">
      <div class="snapshot-label">Supported</div>
      <div class="snapshot-row"><span class="snapshot-key">Māori</span><span class="snapshot-val">${communitySnapshot.maori}</span></div>
      <div class="snapshot-row"><span class="snapshot-key">Pasifika</span><span class="snapshot-val">${communitySnapshot.pasifika}</span></div>
      <div class="snapshot-row"><span class="snapshot-key">Rangatahi</span><span class="snapshot-val">${communitySnapshot.rangatahi}</span></div>
      <div class="snapshot-row" style="border-top:2px solid #e0e0e0;margin-top:4px;padding-top:8px;">
        <span class="snapshot-key"><strong>Total</strong></span>
        <span class="snapshot-val" style="font-size:20px;"><strong>${communitySnapshot.total}</strong></span>
      </div>
      <p style="font-size:11px;color:#888;margin-top:8px;">Whānau we directly support</p>
    </div>
    <div class="snapshot-card dark">
      <div class="snapshot-label">Our Innovators</div>
      <div class="snapshot-row"><span class="snapshot-key">Kakano — Starting</span><span class="snapshot-val">${communitySnapshot.kakano}</span></div>
      <div class="snapshot-row"><span class="snapshot-key">Tipu — Refining</span><span class="snapshot-val">${communitySnapshot.tipu}</span></div>
      <div class="snapshot-row"><span class="snapshot-key">Ora — Thriving</span><span class="snapshot-val">${communitySnapshot.ora}</span></div>
      <div class="snapshot-row" style="border-top:2px solid #1a5c3a;margin-top:4px;padding-top:8px;">
        <span class="snapshot-key" style="color:#a8d4bc;"><strong>Total</strong></span>
        <span class="snapshot-val"><strong>${communitySnapshot.innovatorTotal}</strong></span>
      </div>
      <p style="font-size:11px;color:#6aaa8a;margin-top:8px;">People building ventures and creative projects</p>
    </div>
  </div>
</div>

<div class="section">
  <h2>3. Space Use</h2>
  <table>
    <thead><tr><th>Organisation</th><th>Type</th><th style="text-align:center">Bookings</th><th style="text-align:center">Māori</th><th style="text-align:center">Pasifika</th></tr></thead>
    <tbody>
      ${spaceRows}
      <tr class="total-row"><td><strong>Total</strong></td><td></td><td style="text-align:center"><strong>${spaceUse.reduce((s, r) => s + r.bookings, 0)}</strong></td><td></td><td></td></tr>
    </tbody>
  </table>
</div>

${hasTaxonomy ? `
<div class="section">
  <h2>4. Impact Classification</h2>
  <table>
    <thead><tr><th>Category</th><th style="text-align:center">Debriefs</th><th style="text-align:center">Bookings</th><th style="text-align:center">Programmes</th><th style="text-align:center">Total</th></tr></thead>
    <tbody>
      ${taxonomyRows}
    </tbody>
  </table>
</div>
` : ""}

<div class="section">
  <h2>${sn(4)}. Updates</h2>
  ${updateSections}
</div>

${data.operatorInsights && (data.operatorInsights.wins.length > 0 || data.operatorInsights.concerns.length > 0 || data.operatorInsights.learnings.length > 0) ? `
<div class="section">
  <h2>${sn(5)}. Operator Reflections</h2>
  <p style="font-size:11px;color:#888;margin-bottom:12px;">From ${data.operatorInsights.totalDebriefs} confirmed debriefs this period</p>
  ${data.operatorInsights.wins.length > 0 ? `
  <h3 style="color:#003F2B;margin-bottom:6px;">Highlights</h3>
  <ul class="bullets">${data.operatorInsights.wins.map(w => `<li>${esc(w)}</li>`).join("")}</ul>
  ` : ""}
  ${data.operatorInsights.concerns.length > 0 ? `
  <h3 style="color:#b45309;margin-bottom:6px;margin-top:12px;">Challenges &amp; Risks</h3>
  <ul class="bullets">${data.operatorInsights.concerns.map(c => `<li>${esc(c)}</li>`).join("")}</ul>
  ` : ""}
  ${data.operatorInsights.learnings.length > 0 ? `
  <h3 style="color:#1e40af;margin-bottom:6px;margin-top:12px;">Learnings</h3>
  <ul class="bullets">${data.operatorInsights.learnings.map(l => `<li>${esc(l)}</li>`).join("")}</ul>
  ` : ""}
</div>
` : ""}

${quotes.length > 0 ? `
<div class="section">
  <h2>${sn(data.operatorInsights && (data.operatorInsights.wins.length > 0 || data.operatorInsights.concerns.length > 0 || data.operatorInsights.learnings.length > 0) ? 6 : 5)}. In Their Words</h2>
  <div class="quotes">${quoteBlocks}</div>
</div>
` : ""}

${plannedNextMonth.length > 0 ? `
<div class="section">
  <h2>${sn(data.operatorInsights && (data.operatorInsights.wins.length > 0 || data.operatorInsights.concerns.length > 0 || data.operatorInsights.learnings.length > 0) ? 7 : 6)}. Planned Next Month</h2>
  <div class="next-grid">${nextItems}</div>
</div>
` : ""}

<div class="footer">
  <span class="footer-org">Reserve Tāmaki</span>
  <span class="footer-date">${esc(period.label)}</span>
</div>

</body>
</html>`;
}

// ── Quarterly Report Renderer ───────────────────────────────────

export function renderQuarterlyReport(data: QuarterlyReportData): string {
  const { period, deliveryNumbers, communitySnapshot, spaceUse, updates, quotes, plannedNextQuarter } = data;

  const monthCols = period.months.map(m => `<th style="text-align:right">${monthLabel(m)}</th>`).join("");

  const deliveryRows = deliveryNumbers.map(row => {
    const monthCells = period.months.map(m => `<td class="num">${row.values[m] ?? "—"}</td>`).join("");
    return `<tr><td><strong>${esc(row.metric)}</strong></td>${monthCells}<td class="num">${row.quarterTotal}</td><td class="num">${row.ytd}</td></tr>`;
  }).join("");

  const spaceRows = spaceUse.map(s => `
    <tr>
      <td>${esc(s.organisation)}</td>
      <td>${esc(s.type)}</td>
      <td style="text-align:center">${s.bookings}</td>
      <td style="text-align:center">${communityLabel(s.maori, s.servesMaori)}</td>
      <td style="text-align:center">${communityLabel(s.pasifika, s.servesPasifika)}</td>
    </tr>
  `).join("");

  const updateSections = Object.entries(updates).map(([heading, items]) => `
    <h3>${esc(heading)}</h3>
    <ul class="bullets">${items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>
  `).join("");

  const quoteBlocks = quotes.map(q => `
    <div class="quote">
      <p>"${esc(q.text)}"</p>
      <cite>${esc(q.attribution)}</cite>
    </div>
  `).join("");

  const nextItems = plannedNextQuarter.map(n =>
    `<div class="next-item"><strong>${esc(n.title)}</strong>${esc(n.description)}</div>`
  ).join("");

  const qHasTaxonomy = data.taxonomyBreakdown && data.taxonomyBreakdown.length > 0;
  const qTaxonomyRows = (data.taxonomyBreakdown || []).map(t => `
    <tr>
      <td>${esc(t.categoryName)}</td>
      <td style="text-align:center">${t.entityCounts["debrief"] || 0}</td>
      <td style="text-align:center">${t.entityCounts["booking"] || 0}</td>
      <td style="text-align:center">${t.entityCounts["programme"] || 0}</td>
      <td style="text-align:center"><strong>${t.total}</strong></td>
    </tr>
  `).join("");

  // Dynamic section numbering for quarterly: 1=Delivery, 2=Community, 3=Space Use, then optional taxonomy, optional maori pipeline, updates, etc.
  let qSec = 4;
  const qTaxSec = qHasTaxonomy ? qSec++ : 0;
  const qMaoriSec = data.maoriPipeline ? qSec++ : 0;
  const qUpdateSec = qSec++;
  const hasInsights = data.operatorInsights && (data.operatorInsights.wins.length > 0 || data.operatorInsights.concerns.length > 0 || data.operatorInsights.learnings.length > 0);
  const qInsightsSec = hasInsights ? qSec++ : 0;
  const hasConcernArcs = data.concernArcs && data.concernArcs.arcs.length > 0;
  const qConcernSec = hasConcernArcs ? qSec++ : 0;
  const qQuoteSec = qSec++;
  const qPlannedSec = qSec++;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Reserve Tāmaki — ${esc(period.label)} Report</title>
<style>${REPORT_CSS}</style>
</head>
<body>

<div class="header">
  <div class="header-tag">Quarterly Report · ${esc(period.fyLabel)}${data.funderName ? ` · ${esc(data.funderName)}` : ""}</div>
  <h1>Reserve Tāmaki</h1>
  <div class="subtitle">${esc(period.label)}</div>
</div>

<div class="section">
  <h2>1. Delivery Numbers</h2>
  <table>
    <thead><tr><th>Metric</th>${monthCols}<th style="text-align:right">${esc(period.quarter)} Total</th><th style="text-align:right">YTD ${esc(period.fyLabel)}</th></tr></thead>
    <tbody>${deliveryRows}</tbody>
  </table>
</div>

<div class="section">
  <h2>2. Community Snapshot</h2>
  <div class="snapshot-grid">
    <div class="snapshot-card">
      <div class="snapshot-label">Supported</div>
      <div class="snapshot-row"><span class="snapshot-key">Māori</span><span class="snapshot-val">${communitySnapshot.maori}</span></div>
      <div class="snapshot-row"><span class="snapshot-key">Pasifika</span><span class="snapshot-val">${communitySnapshot.pasifika}</span></div>
      <div class="snapshot-row"><span class="snapshot-key">Rangatahi</span><span class="snapshot-val">${communitySnapshot.rangatahi}</span></div>
      <div class="snapshot-row" style="border-top:2px solid #e0e0e0;margin-top:4px;padding-top:8px;">
        <span class="snapshot-key"><strong>Total</strong></span>
        <span class="snapshot-val" style="font-size:20px;"><strong>${communitySnapshot.total}</strong></span>
      </div>
    </div>
    <div class="snapshot-card dark">
      <div class="snapshot-label">Our Innovators</div>
      <div class="snapshot-row"><span class="snapshot-key">Kakano — Starting</span><span class="snapshot-val">${communitySnapshot.kakano}</span></div>
      <div class="snapshot-row"><span class="snapshot-key">Tipu — Refining</span><span class="snapshot-val">${communitySnapshot.tipu}</span></div>
      <div class="snapshot-row"><span class="snapshot-key">Ora — Thriving</span><span class="snapshot-val">${communitySnapshot.ora}</span></div>
      <div class="snapshot-row" style="border-top:2px solid #1a5c3a;margin-top:4px;padding-top:8px;">
        <span class="snapshot-key" style="color:#a8d4bc;"><strong>Total</strong></span>
        <span class="snapshot-val"><strong>${communitySnapshot.innovatorTotal}</strong></span>
      </div>
    </div>
  </div>
</div>

<div class="section">
  <h2>3. Space Use</h2>
  <table>
    <thead><tr><th>Organisation</th><th>Type</th><th style="text-align:center">Bookings</th><th style="text-align:center">Māori</th><th style="text-align:center">Pasifika</th></tr></thead>
    <tbody>
      ${spaceRows}
      <tr class="total-row"><td><strong>Total</strong></td><td></td><td style="text-align:center"><strong>${spaceUse.reduce((s, r) => s + r.bookings, 0)}</strong></td><td></td><td></td></tr>
    </tbody>
  </table>
</div>

${qHasTaxonomy ? `
<div class="section">
  <h2>${qTaxSec}. Impact Classification</h2>
  <table>
    <thead><tr><th>Category</th><th style="text-align:center">Debriefs</th><th style="text-align:center">Bookings</th><th style="text-align:center">Programmes</th><th style="text-align:center">Total</th></tr></thead>
    <tbody>
      ${qTaxonomyRows}
    </tbody>
  </table>
</div>
` : ""}

${data.maoriPipeline ? `
<div class="section">
  <h2>${qMaoriSec}. Māori & Pasifika Pipeline</h2>
  <div class="snapshot-grid">
    <div class="snapshot-card dark">
      <div class="snapshot-label">Māori Innovators</div>
      <div class="snapshot-row"><span class="snapshot-key">Kakano — Starting</span><span class="snapshot-val">${data.maoriPipeline.innovators.kakano}</span></div>
      <div class="snapshot-row"><span class="snapshot-key">Tipu — Refining</span><span class="snapshot-val">${data.maoriPipeline.innovators.tipu}</span></div>
      <div class="snapshot-row"><span class="snapshot-key">Ora — Thriving</span><span class="snapshot-val">${data.maoriPipeline.innovators.ora}</span></div>
      <div class="snapshot-row" style="border-top:2px solid #1a5c3a;margin-top:4px;padding-top:8px;">
        <span class="snapshot-key" style="color:#a8d4bc;"><strong>Total</strong></span>
        <span class="snapshot-val"><strong>${data.maoriPipeline.innovators.total}</strong></span>
      </div>
      ${data.maoriPipeline.inMentoring > 0 ? `<div class="snapshot-row" style="margin-top:8px;"><span class="snapshot-key" style="color:#a8d4bc;">In Active Mentoring</span><span class="snapshot-val">${data.maoriPipeline.inMentoring}</span></div>` : ""}
      ${data.maoriPipeline.inProgrammes > 0 ? `<div class="snapshot-row"><span class="snapshot-key" style="color:#a8d4bc;">In Programmes</span><span class="snapshot-val">${data.maoriPipeline.inProgrammes}</span></div>` : ""}
      ${data.maoriPipeline.stageProgressions > 0 ? `<div class="snapshot-row"><span class="snapshot-key" style="color:#a8d4bc;">Stage Progressions This Quarter</span><span class="snapshot-val">${data.maoriPipeline.stageProgressions}</span></div>` : ""}
    </div>
    <div class="snapshot-card">
      <div class="snapshot-label">Pasifika Innovators</div>
      <div class="snapshot-row"><span class="snapshot-key">Kakano — Starting</span><span class="snapshot-val">${data.maoriPipeline.pasifikaInnovators.kakano}</span></div>
      <div class="snapshot-row"><span class="snapshot-key">Tipu — Refining</span><span class="snapshot-val">${data.maoriPipeline.pasifikaInnovators.tipu}</span></div>
      <div class="snapshot-row"><span class="snapshot-key">Ora — Thriving</span><span class="snapshot-val">${data.maoriPipeline.pasifikaInnovators.ora}</span></div>
      <div class="snapshot-row" style="border-top:2px solid #e0e0e0;margin-top:4px;padding-top:8px;">
        <span class="snapshot-key"><strong>Total</strong></span>
        <span class="snapshot-val" style="font-size:20px;"><strong>${data.maoriPipeline.pasifikaInnovators.total}</strong></span>
      </div>
    </div>
  </div>
  ${data.maoriPipeline.maoriOrgs.length > 0 ? `
  <h3>Māori Organisations Using the Space</h3>
  <table>
    <thead><tr><th>Organisation</th><th style="text-align:center">Bookings</th></tr></thead>
    <tbody>
      ${data.maoriPipeline.maoriOrgs.map(o => `<tr><td>${esc(o.name)}</td><td style="text-align:center">${o.bookings}</td></tr>`).join("")}
    </tbody>
  </table>` : ""}
  ${data.maoriPipeline.previousQuarter ? `
  <h3>Quarter-on-Quarter Change</h3>
  <table>
    <thead><tr><th>Metric</th><th style="text-align:right">Previous Qtr</th><th style="text-align:right">This Qtr</th><th style="text-align:right">Change</th></tr></thead>
    <tbody>
      <tr><td>Māori Innovators</td><td class="num">${data.maoriPipeline.previousQuarter.innovatorTotal}</td><td class="num">${data.maoriPipeline.innovators.total}</td><td class="num">${data.maoriPipeline.innovators.total - data.maoriPipeline.previousQuarter.innovatorTotal >= 0 ? "+" : ""}${data.maoriPipeline.innovators.total - data.maoriPipeline.previousQuarter.innovatorTotal}</td></tr>
      <tr><td>Activations</td><td class="num">${data.maoriPipeline.previousQuarter.activations}</td><td class="num">${data.deliveryNumbers.find(d => d.metric.startsWith("Activation"))?.quarterTotal || 0}</td><td class="num">${((data.deliveryNumbers.find(d => d.metric.startsWith("Activation"))?.quarterTotal || 0) - data.maoriPipeline.previousQuarter.activations) >= 0 ? "+" : ""}${(data.deliveryNumbers.find(d => d.metric.startsWith("Activation"))?.quarterTotal || 0) - data.maoriPipeline.previousQuarter.activations}</td></tr>
      <tr><td>Foot Traffic</td><td class="num">${data.maoriPipeline.previousQuarter.footTraffic}</td><td class="num">${data.footTraffic.total}</td><td class="num">${(data.footTraffic.total - data.maoriPipeline.previousQuarter.footTraffic) >= 0 ? "+" : ""}${data.footTraffic.total - data.maoriPipeline.previousQuarter.footTraffic}</td></tr>
      <tr><td>Capability Building</td><td class="num">${data.maoriPipeline.previousQuarter.capabilityBuilding}</td><td class="num">${data.deliveryNumbers.find(d => d.metric.startsWith("Capability"))?.quarterTotal || 0}</td><td class="num">${((data.deliveryNumbers.find(d => d.metric.startsWith("Capability"))?.quarterTotal || 0) - data.maoriPipeline.previousQuarter.capabilityBuilding) >= 0 ? "+" : ""}${(data.deliveryNumbers.find(d => d.metric.startsWith("Capability"))?.quarterTotal || 0) - data.maoriPipeline.previousQuarter.capabilityBuilding}</td></tr>
    </tbody>
  </table>` : ""}
</div>
` : ""}

<div class="section">
  <h2>${qUpdateSec}. Updates</h2>
  ${updateSections}
</div>

${hasInsights ? `
<div class="section">
  <h2>${qInsightsSec}. Operator Reflections</h2>
  <p style="font-size:11px;color:#888;margin-bottom:12px;">From ${data.operatorInsights!.totalDebriefs} confirmed debriefs this quarter</p>
  ${data.operatorInsights!.wins.length > 0 ? `
  <h3 style="color:#003F2B;margin-bottom:6px;">Highlights</h3>
  <ul class="bullets">${data.operatorInsights!.wins.map(w => `<li>${esc(w)}</li>`).join("")}</ul>
  ` : ""}
  ${data.operatorInsights!.concerns.length > 0 ? `
  <h3 style="color:#b45309;margin-bottom:6px;margin-top:12px;">Challenges &amp; Risks</h3>
  <ul class="bullets">${data.operatorInsights!.concerns.map(c => `<li>${esc(c)}</li>`).join("")}</ul>
  ` : ""}
  ${data.operatorInsights!.learnings.length > 0 ? `
  <h3 style="color:#1e40af;margin-bottom:6px;margin-top:12px;">Learnings</h3>
  <ul class="bullets">${data.operatorInsights!.learnings.map(l => `<li>${esc(l)}</li>`).join("")}</ul>
  ` : ""}
</div>
` : ""}

${hasConcernArcs ? `
<div class="section">
  <h2>${qConcernSec}. Challenges &amp; Responses</h2>
  <p style="font-size:11px;color:#888;margin-bottom:12px;">${data.concernArcs!.resolvedCount} of ${data.concernArcs!.arcs.length} challenges addressed through subsequent engagement</p>
  <table>
    <thead><tr><th>Challenge Identified</th><th>People</th><th>Response</th><th style="text-align:center">Status</th></tr></thead>
    <tbody>
      ${data.concernArcs!.arcs.map(a => `
        <tr>
          <td style="font-size:11px;">${esc(a.concern.length > 120 ? a.concern.slice(0, 120) + "..." : a.concern)}<br><span style="color:#888;font-size:10px;">${esc(a.raisedIn)} · ${esc(a.raisedDate)}</span></td>
          <td style="font-size:11px;">${a.contactNames.length > 0 ? esc(a.contactNames.join(", ")) : "<span style='color:#888;'>General</span>"}</td>
          <td style="font-size:11px;">${a.resolution ? `${esc(a.resolution.length > 120 ? a.resolution.slice(0, 120) + "..." : a.resolution)}<br><span style="color:#888;font-size:10px;">${esc(a.resolvedIn || "")} · ${esc(a.resolvedDate || "")}</span>` : "<span style='color:#888;'>Monitoring</span>"}</td>
          <td style="text-align:center;"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;background:${a.status === "resolved" ? "#dcfce7;color:#166534" : "#fef3c7;color:#92400e"}">${a.status === "resolved" ? "Addressed" : "Monitoring"}</span></td>
        </tr>
      `).join("")}
    </tbody>
  </table>
</div>
` : ""}

${quotes.length > 0 ? `
<div class="section">
  <h2>${qQuoteSec}. In Their Words</h2>
  <div class="quotes">${quoteBlocks}</div>
</div>
` : ""}

${plannedNextQuarter.length > 0 ? `
<div class="section">
  <h2>${qPlannedSec}. Planned Next Quarter</h2>
  <div class="next-grid">${nextItems}</div>
</div>
` : ""}

<div class="footer">
  <span class="footer-org">Reserve Tāmaki</span>
  <span class="footer-date">${esc(period.label)} · Generated ${new Date().toISOString().split("T")[0]}</span>
</div>

</body>
</html>`;
}
