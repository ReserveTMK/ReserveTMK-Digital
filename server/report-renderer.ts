/**
 * Report Renderer — generates standalone branded HTML reports
 * Reuses CSS/structure from Q3-Report.html
 * Two modes: monthly (Auckland Council) and quarterly (Māori Outcomes)
 */

// ── Types ──────────────────────────────────────────────────────

export interface MonthlyReportData {
  period: { month: string; year: number; label: string; fyLabel: string };
  activations: { count: number; attendees: number; byType: Record<string, number> };
  monthlyTracking: Array<{ month: string; activations: number; attendees: number; newResidents: number }>;
  quarterlyTotals: Record<string, { activations: number; attendees: number }>;
  ytd: { activations: number; attendees: number; newResidents: number };
  residentCompanies: Array<{
    membershipType: string; type: string; company: string;
    desks: number; individuals: number; maori: boolean; pasifika: boolean;
  }>;
  hirers: Array<{
    organisation: string; lead: string; typeOfUsage: string;
    maori: boolean; pasifika: boolean;
  }>;
  mentoring: {
    sessions: number; relationships: number;
    perMentee: Array<{ name: string; sessions: Array<{ date: string; notes: string; type: string }> }>;
  };
  debriefs: Array<{ title: string; notes: string; eventName: string; type: string; attendeeCount: number }>;
  events: Array<{ name: string; type: string; spaceUseType: string; attendeeCount: number; date: string }>;
  footTraffic: { total: number; daysRecorded: number; dailyAvg: number; peakDay: number; missingDays: string[] };
  community: { total: number; kakano: number; tipu: number; ora: number; maori: number; pasifika: number };
  dataQuality: { eventsWithoutAttendees: number; missingFootTrafficDays: number; draftDebriefs: number; groupsWithoutDemographics: string[] };
}

export interface QuarterlyReportData {
  period: { quarter: string; year: number; label: string; fyLabel: string; months: string[] };
  deliveryNumbers: Array<{ metric: string; values: Record<string, number>; quarterTotal: number; ytd: number }>;
  communitySnapshot: { maori: number; pasifika: number; rangatahi: number; total: number; kakano: number; tipu: number; ora: number; innovatorTotal: number };
  spaceUse: Array<{ organisation: string; type: string; bookings: number; maori: boolean; pasifika: boolean }>;
  updates: Record<string, string[]>;
  quotes: Array<{ text: string; attribution: string }>;
  plannedNextQuarter: Array<{ title: string; description: string }>;
  footTraffic: { total: number; byMonth: Record<string, number> };
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

function monthLabel(monthStr: string): string {
  const [, m] = monthStr.split("-");
  return MONTH_NAMES[parseInt(m, 10) - 1] || monthStr;
}

// ── Monthly Report Renderer ─────────────────────────────────────

export function renderMonthlyReport(data: MonthlyReportData): string {
  const { period, activations, residentCompanies, hirers, mentoring, debriefs, events, footTraffic, community, dataQuality } = data;

  // Number of users table
  const trackingMonths = data.monthlyTracking;
  const monthHeaders = trackingMonths.map(m => `<th style="text-align:right">${monthLabel(m.month)}</th>`).join("");

  const activationRow = trackingMonths.map(m => `<td class="num">${m.activations}</td>`).join("");
  const attendeeRow = trackingMonths.map(m => `<td class="num">${m.attendees}</td>`).join("");
  const residentRow = trackingMonths.map(m => `<td class="num">${m.newResidents}</td>`).join("");

  // Resident companies table
  const residentRows = residentCompanies.map(r => `
    <tr>
      <td>${esc(r.membershipType)}</td>
      <td>${esc(r.type)}</td>
      <td>${esc(r.company)}</td>
      <td style="text-align:center">${r.desks}</td>
      <td style="text-align:center">${r.individuals}</td>
      <td style="text-align:center">${checkMark(r.maori)}</td>
      <td style="text-align:center">${checkMark(r.pasifika)}</td>
    </tr>
  `).join("");

  const totalDesks = residentCompanies.reduce((s, r) => s + r.desks, 0);
  const totalIndividuals = residentCompanies.reduce((s, r) => s + r.individuals, 0);

  // Hirers table
  const hirerRows = hirers.map(h => `
    <tr>
      <td>${esc(h.organisation)}</td>
      <td>${esc(h.lead)}</td>
      <td>${esc(h.typeOfUsage)}</td>
      <td style="text-align:center">${checkMark(h.maori)}</td>
      <td style="text-align:center">${checkMark(h.pasifika)}</td>
    </tr>
  `).join("");

  // Business Support per mentee
  const menteeNarratives = mentoring.perMentee.map(m => {
    const sessionBullets = m.sessions.map(s =>
      `<li>${esc(s.notes || `${s.type} session on ${s.date}`)}</li>`
    ).join("");
    return `
      <h3>${esc(m.name)}</h3>
      <ul class="bullets">${sessionBullets}</ul>
    `;
  }).join("");

  // Events lists
  const internalEvents = events.filter(e => !["Venue Hire", "Community Hire", "External Event"].includes(e.type));
  const externalEvents = events.filter(e => ["Venue Hire", "Community Hire", "External Event"].includes(e.type));
  const studioEvents = events.filter(e => e.spaceUseType?.toLowerCase().includes("studio") || e.type?.toLowerCase().includes("podcast"));

  const eventBullets = (evts: typeof events) => evts.map(e =>
    `<li><strong>${esc(e.name)}</strong> — ${esc(e.type)}${e.attendeeCount ? ` (${e.attendeeCount} attendees)` : ""} · ${esc(e.date)}</li>`
  ).join("");

  // Data quality warnings
  const warnings: string[] = [];
  if (dataQuality.eventsWithoutAttendees > 0) warnings.push(`${dataQuality.eventsWithoutAttendees} events missing attendee count`);
  if (dataQuality.missingFootTrafficDays > 0) warnings.push(`Foot traffic missing for ${dataQuality.missingFootTrafficDays} business days: ${footTraffic.missingDays.join(", ")}`);
  if (dataQuality.draftDebriefs > 0) warnings.push(`${dataQuality.draftDebriefs} debriefs still in draft (not counted in reporting)`);
  if (dataQuality.groupsWithoutDemographics.length > 0) warnings.push(`Demographics not set for: ${dataQuality.groupsWithoutDemographics.join(", ")}`);

  const warningHtml = warnings.length > 0
    ? `<div class="warning"><strong>⚠ Data Quality Notes</strong><ul style="margin-top:6px;padding-left:16px;">${warnings.map(w => `<li>${esc(w)}</li>`).join("")}</ul></div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Reserve Tāmaki — ${esc(period.label)} Report</title>
<style>${REPORT_CSS}</style>
</head>
<body>

<div class="header">
  <div class="header-tag">Monthly Report · ${esc(period.fyLabel)}</div>
  <h1>ReserveTMK Reporting</h1>
  <div class="subtitle">${esc(period.label)}</div>
</div>

<!-- NUMBER OF USERS -->
<div class="section">
  <h2>Number of Users</h2>
  <table>
    <thead>
      <tr>
        <th>Metric</th>
        ${monthHeaders}
        <th style="text-align:right">YTD ${esc(period.fyLabel)}</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Events / activations</strong></td>
        ${activationRow}
        <td class="num">${data.ytd.activations}</td>
      </tr>
      <tr>
        <td><strong>Attendees (est)</strong></td>
        ${attendeeRow}
        <td class="num">${data.ytd.attendees}</td>
      </tr>
      <tr>
        <td><strong>New resident companies</strong></td>
        ${residentRow}
        <td class="num">${data.ytd.newResidents}</td>
      </tr>
    </tbody>
  </table>
</div>

<!-- RESIDENT COMPANIES -->
<div class="section">
  <h2>Resident Companies</h2>
  <table>
    <thead>
      <tr>
        <th>Membership</th>
        <th>Type</th>
        <th>Company</th>
        <th style="text-align:center">Desks</th>
        <th style="text-align:center">Individuals</th>
        <th style="text-align:center">Māori</th>
        <th style="text-align:center">Pasifika</th>
      </tr>
    </thead>
    <tbody>
      ${residentRows}
      <tr class="total-row">
        <td colspan="3"><strong>Total</strong></td>
        <td style="text-align:center"><strong>${totalDesks}</strong></td>
        <td style="text-align:center"><strong>${totalIndividuals}</strong></td>
        <td></td><td></td>
      </tr>
    </tbody>
  </table>
</div>

<!-- HIRERS -->
<div class="section">
  <h2>Hirers</h2>
  <table>
    <thead>
      <tr>
        <th>Organisation</th>
        <th>Lead</th>
        <th>Type of Usage</th>
        <th style="text-align:center">Māori</th>
        <th style="text-align:center">Pasifika</th>
      </tr>
    </thead>
    <tbody>
      ${hirerRows}
    </tbody>
  </table>
</div>

<!-- COMMUNITY SNAPSHOT -->
<div class="section">
  <h2>Community Snapshot</h2>
  <div class="snapshot-grid">
    <div class="snapshot-card">
      <div class="snapshot-label">Supported</div>
      <div class="snapshot-row"><span class="snapshot-key">Māori</span><span class="snapshot-val">${community.maori}</span></div>
      <div class="snapshot-row"><span class="snapshot-key">Pasifika</span><span class="snapshot-val">${community.pasifika}</span></div>
      <div class="snapshot-row" style="border-top:2px solid #e0e0e0;margin-top:4px;padding-top:8px;">
        <span class="snapshot-key"><strong>Total Community</strong></span>
        <span class="snapshot-val" style="font-size:20px;"><strong>${community.total}</strong></span>
      </div>
    </div>
    <div class="snapshot-card dark">
      <div class="snapshot-label">Journey Stages</div>
      <div class="snapshot-row"><span class="snapshot-key">Kakano — Starting</span><span class="snapshot-val">${community.kakano}</span></div>
      <div class="snapshot-row"><span class="snapshot-key">Tipu — Refining</span><span class="snapshot-val">${community.tipu}</span></div>
      <div class="snapshot-row"><span class="snapshot-key">Ora — Thriving</span><span class="snapshot-val">${community.ora}</span></div>
    </div>
  </div>
</div>

<!-- FOOT TRAFFIC -->
<div class="section">
  <h2>Foot Traffic</h2>
  <div class="snapshot-grid">
    <div class="snapshot-card">
      <div class="snapshot-row"><span class="snapshot-key">Total</span><span class="snapshot-val">${footTraffic.total}</span></div>
      <div class="snapshot-row"><span class="snapshot-key">Days recorded</span><span class="snapshot-val">${footTraffic.daysRecorded}</span></div>
    </div>
    <div class="snapshot-card">
      <div class="snapshot-row"><span class="snapshot-key">Daily average</span><span class="snapshot-val">${footTraffic.dailyAvg}</span></div>
      <div class="snapshot-row"><span class="snapshot-key">Peak day</span><span class="snapshot-val">${footTraffic.peakDay}</span></div>
    </div>
  </div>
</div>

<!-- BUSINESS SUPPORT & DEVELOPMENT -->
${mentoring.perMentee.length > 0 ? `
<div class="section">
  <h2>Business Support &amp; Development</h2>
  ${menteeNarratives}
</div>
` : ""}

<!-- EVENTS & COMMUNITY ENGAGEMENT -->
${internalEvents.length > 0 ? `
<div class="section">
  <h2>Events &amp; Community Engagement</h2>
  <ul class="bullets">${eventBullets(internalEvents)}</ul>
</div>
` : ""}

<!-- EXTERNAL EVENTS & HIRES -->
${externalEvents.length > 0 ? `
<div class="section">
  <h2>External Events &amp; Hires</h2>
  <ul class="bullets">${eventBullets(externalEvents)}</ul>
</div>
` : ""}

<!-- CONTENT & MEDIA -->
${studioEvents.length > 0 ? `
<div class="section">
  <h2>Content &amp; Media Use of Space</h2>
  <ul class="bullets">${eventBullets(studioEvents)}</ul>
</div>
` : ""}

${warningHtml}

<div class="footer">
  <span class="footer-org">Reserve Tāmaki</span>
  <span class="footer-date">${esc(period.label)} · Generated ${new Date().toISOString().split("T")[0]}</span>
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
      <td style="text-align:center">${checkMark(s.maori)}</td>
      <td style="text-align:center">${checkMark(s.pasifika)}</td>
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Reserve Tāmaki — ${esc(period.label)} Report</title>
<style>${REPORT_CSS}</style>
</head>
<body>

<div class="header">
  <div class="header-tag">Quarterly Report · ${esc(period.fyLabel)}</div>
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

<div class="section">
  <h2>4. Updates</h2>
  ${updateSections}
</div>

${quotes.length > 0 ? `
<div class="section">
  <h2>5. In Their Words</h2>
  <div class="quotes">${quoteBlocks}</div>
</div>
` : ""}

${plannedNextQuarter.length > 0 ? `
<div class="section">
  <h2>6. Planned Next Quarter</h2>
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
