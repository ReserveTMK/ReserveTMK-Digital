/Users/rabeazley/Downloads/CLAUDE.md CLAUDE.md — ReserveTMK Digital (RTMKD)
Read this at the start of every session. This is the source of truth.

WHO WE ARE
Reserve Tāmaki / ReserveTMK
133a Line Road, Glen Innes, East Auckland
Two person team — Ra (founder/director) and Kim
Participant journey stages: Kakano → Tipu → Ora

THE PLATFORM
RTMKD is a custom SaaS platform for running Reserve Tāmaki day to day.
It is not a generic tool — it is purpose built for this community hub.
Stack

Frontend: React, TypeScript
Backend: Express
Database: PostgreSQL via Neon
Auth: Clerk
Hosting: Railway (auto-deploys from GitHub)
Transcription: AssemblyAI (audio debriefs)
Email/Calendar/Drive: Google Workspace — ra@, kim@, kiaora@

Environments

Production: Railway (live)
Local: Mac mini at hub (Daddy Korg)
Repo: GitHub — every push auto-deploys to Railway


ARCHITECTURE — WHAT EXISTS
Mentoring
Routes: /mentoring · /scheduling · /debriefs

Self-serve: /scheduling (book session), /survey/:token (growth survey)
Admin: /mentoring (Kanban pipeline), /debriefs (AI debrief + confirm), /scheduling (availability mgmt)
Features: applications, profiles, relationships, growth surveys, AI-assisted debrief

Spaces (Venue Hire)
Routes: /spaces · /bookings · /agreements

Self-serve: /booker/login (magic link), /booker/portal/:token, /book/:userId, /casual-hire
Admin: /spaces (weekly calendar, desk view), /bookings (list, confirm, invoice), /agreements
Features: change requests, pricing tiers, packages, Xero invoicing, confirmation + reminder emails

Gear
Routes: /gear · /spaces (resources tab)

Self-serve: /booker/portal/:token → Gear view
Admin: /gear (inventory, bookings, availability)
Features: requiresApproval flag per item, date-based availability

Programmes
Routes: /programmes · /register/:slug

Self-serve: /register/:slug (public registration), QR code → registration form
Admin: /programmes (list, create, edit), registrations dialog, /programme-effectiveness, /cohort-analysis
Features: registration + attended toggle, growth surveys, CSV export, cohort + effectiveness reporting

Reporting

Report Generator, Dashboard, Cohorts, Taxonomy
Quarterly and monthly report formats

Nav Structure
COMMUNITY: People, Groups, Ecosystems
DELIVERY: Mentoring, Spaces, Gear, Programmes
TRACKING: Calendar, Debriefs, Catch Up, Community Spend
REPORTING: Report Generator, Dashboard, Cohorts, Taxonomy
OPS: Projects, Agreements, Funders
SETTINGS: Availability, About Us, Team

DATA INTEGRITY — CRITICAL RULES
⚠️ Drafts are invisible to reporting — only confirmed debriefs count
⚠️ Contact stage movements must happen in real time — cannot be backfilled
⚠️ attended flag must wire to programmes.attendees array or reporting is blind
Never break these rules. Flag before proceeding if a build touches this chain.

LAUNCH CRITICAL — MENTORING
These must work before community launch:

Admin-side booking on behalf of mentee
Re-activation flow — graduated/ended mentees can't self-rebook
Attendance → report wire-up (verify)
Kanban quick-add — currently must go through contact record
Debrief confirmed only counting toward reporting (verify chain)


LAUNCH CRITICAL — SPACES
These must work before community launch:

Payment instructions not clear in confirmation emails
Payment status not visible in booking view
Over-allowance behaviour — what happens? (verify)
Confirmation showing $0 / covered (verify)


BUILD LIST — PRIORITY ORDER
Fix first (data integrity)

Wire attended → programmes.attendees
Debrief ↔ programme linkage consistency

Mentoring

Re-activation flow (detect graduated/ended, show re-engagement path)
Admin-side booking on behalf of mentee
Kanban quick-add button

Spaces

Payment instructions in confirmation
Payment status visible in booking view
Quick-add unplanned activation
Recurring bookings (admin-managed)
Monthly reconciling UI

Gear

Approval workflow UI (flag exists, UI doesn't)
Maintenance / condition tracking
Usage history per item

New modules (post launch)

Comms / Community Comms Centre (Stories, Newsletters, Announcements)
Waitlist workflow
Consent audit view
Lifecycle comms automation
Creator Journey (podcast studio as development pathway)


REPORTING DEFINITIONS
Use these consistently across all reports.
Activations — everything that happened in the space. Headline number.
Includes: Hub Activities, Programmes, Drop-ins, External Events, Venue Hires, Space Use
Excludes: Meetings, Catch-ups, Planning, Mentoring (tracked separately)
Space Use (External) — subset of Activations. External orgs and individuals using the space.
Internal Delivery — subset of Activations. Programmes and workshops delivered by Reserve Tāmaki staff.
Mentoring and Programmes — tracked separately from Activations. Structured capability delivery — 1:1 mentoring + 1:Few group programmes. Report together as Capability Delivered with breakdown by format.
Foot Traffic — total people through the space. Tracked by Kim via cameras. Source of truth = daily_foot_traffic table.
Quarter note ⚠️ — Reserve Tāmaki uses calendar year quarters (Q1 = Jan–Mar). Auckland Council uses financial year (our Q1 = their Q3 FY25/26). Always clarify per audience.

CAPABILITY BUILDING FRAMEWORK
Everything Reserve Tāmaki delivers is capability building at different scales:
1:1 Mentoring — deep, sustained, personalised support
1:Few Programmes — structured, cohort-based, group workshops
1:Many Broadcast — newsletters, YouTube series (future)
Placemaking vs Capability:

Space Use = placemaking (enabling others)
Mentoring + Programmes = direct capability delivery
Both matter. Both tell different stories.


FUNDERS AND REPORTING
Auckland Council EDO

Agreement: $75,000 + GST, FY26
Period: 1 July 2025 to 30 June 2026
Contact: Catriona Stewart — catriona.stewart@aucklandcouncil.govt.nz
Reporting: monthly, due 2 days before month end
Format: structured data table + narrative, PDF output

Ngā Mātārae (Māori Outcomes Fund)

Agreement: 3 year, 2024–2027
Contacts: Daniel Haines (Māori Outcomes Lead), Marina Matthews

Foundation North

Status: in progress
Advisor: Rochelle, warm intro via Jacqui

Reporting cadence

Monthly: narrative, photo-led, less formal — for GridAKL and light-touch funders
Quarterly: structured data + narrative — primary audience Auckland Council Māori Outcomes


COMMUNITY TIERS
All Contacts — everyone in the system
Our Community — active participants
Our Innovators — entrepreneurs and programme participants
VIP — key relationship contacts (tagged)

HOW RA WORKS

Direct, sometimes stream of consciousness
Plain NZ English — no AI-sounding phrases, no heavy formatting
No hyphens used as em dashes or filler
Honest assessment over polished language
Concrete options in short scannable formats
Teaches as he goes — when Ra explains something and says to note it, save it to this file or MEMORY.md
Pushes back when something doesn't match operational reality
Terminal for deep work sessions
Phone for quick tasks on the go


HOW CLAUDE SHOULD WORK WITH RA

When Ra's ask is clear — just do it. No preamble, no options list, no "shall I?"
When Ra's ask is vague — draw out what's needed with ONE question, not three:
  "Is this for a funder or internal?" or "What's it doing wrong?" or "Which area?"
When Ra gives a symptom — trace the cause. Don't ask him to diagnose.
When Ra gives intent — decide the approach. Don't list options unless they're genuinely different.
When Ra says "handle it" — chain the skills end-to-end. Deliver the output, not a plan to deliver it.
When building — ask "who is this for and what should they be able to do?" if Ra hasn't said.
When Ra is stuck — suggest the next move: "Run /funder-pulse" or "Tell me what's broken and I'll trace it."
Cheat sheet lives at .claude/cheatsheet.md — reference it if Ra seems unsure.
/help-me exists for when Ra doesn't know what to ask.


RED LINES

Never break the reporting chain — confirmed debriefs only, real-time stage moves
Never make data changes that can't be reversed without warning Ra first
Never send emails from kiaora@ without explicit instruction
Never assume a build is complete without Ra testing the flow
If something touches Neon DB directly — confirm before executing
If unsure — ask, don't guess and build


SESSION PROTOCOL
Handoff file: .claude/handoff.md (project-relative, always read this first)

Start of every session:

Read this file
Read .claude/handoff.md if it exists — this is the relay baton from the last session
Run /session-start (checks staleness, uncommitted work, recent activity)
Confirm with Ra what we're working on today

End of every session:

Run /handoff to save session state to .claude/handoff.md
Run /session-summary for Ra
Note any new decisions or patterns Ra wants remembered
Flag anything unresolved before closing

