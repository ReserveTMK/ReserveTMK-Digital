# Reserve Tāmaki Digital — Architecture

The operating system for a community hub. Manages who comes through the door (access), who you're developing (capability), and who funds it (relationships).

## Four Layers

**OPERATIONS** — run the hub day to day
- Access: spaces, gear, desks, bookers, agreements
- Capability: mentoring, programmes
- Tracking: calendar, debriefs, reconciliation

**INTELLIGENCE** — understand what happened
- Reporting: monthly/quarterly, funder-specific
- Dashboard: pulse metrics
- Taxonomy: classify activity through funder lenses
- Cohorts: programme effectiveness, cohort analysis

**RELATIONSHIPS** — manage who you work with
- CRM: contacts, groups, community tiers
- Funders: agreements, deliverables, pipeline, applications
- Comms: supporter updates (early stage)

**COMMS** — tell the story outward
- Brand guidelines, social content, newsletters (future)

## Backend — Route Modules

All endpoints live in `server/routes/`. The main `server/routes.ts` is a 72-line orchestrator that registers 17 domain modules.

| Module | File | What it does |
|--------|------|-------------|
| contacts | routes/contacts.ts | People CRUD, stages, consent, promotions |
| mentoring | routes/mentoring.ts | Relationships, meetings, scheduling, availability, public booking |
| interactions | routes/interactions.ts | Conversation records |
| programmes | routes/programmes.ts | Programme CRUD, registration, public registration, surveys |
| debriefs | routes/debriefs.ts | Impact logs, extraction, transcription, audio, weekly debriefs, taxonomy, keywords, actions |
| bookings | routes/bookings.ts | Venue bookings, regular bookers, workflow, surveys, casual hire |
| groups | routes/groups.ts | Organisation CRUD, taxonomy links, enrichment |
| projects | routes/projects.ts | Internal projects, tasks, updates |
| portal | routes/portal.ts | Booker portal (token auth), desk/gear bookings |
| resources | routes/resources.ts | Bookable resources (gear/desks), availability |
| comms | routes/comms.ts | Announcements, newsletters, story templates |
| tracking | routes/tracking.ts | Community spend, foot traffic, snapshots, catch-up list, highlights |
| gmail | routes/gmail.ts | Gmail import, OAuth, exclusions, cleanup |
| funders | routes/funders.ts | Funder CRUD, documents, deliverables, taxonomy lens, org profile |
| reports | routes/reports.ts | Report generation, rendering, legacy reports, benchmarks, trends, dashboard |
| calendar | routes/calendar.ts | Google Calendar sync, events, OAuth, dismissed events |
| settings | routes/settings.ts | Memberships, MOUs, venues, community management, engagement decay, Xero, operating hours |

Shared helpers: `routes/_helpers.ts` — parseId, coerceDateFields, ensureBookingEvent, autoPromoteToInnovator, etc.

## Frontend — Pages

Pages live in `client/src/pages/`. Components in `client/src/components/`. Hooks in `client/src/hooks/`.

Key pages by domain:
- **Access:** spaces.tsx, gear.tsx, booker-portal.tsx, regular-bookers.tsx, agreements.tsx, casual-hire.tsx
- **Capability:** mentoring.tsx, programmes.tsx, scheduling.tsx
- **Tracking:** calendar.tsx, debriefs.tsx (+ components/debriefs/*)
- **CRM:** contacts.tsx, contact-detail.tsx, groups.tsx
- **Reporting:** reports.tsx, tracking.tsx (dashboard)
- **Funders:** funders.tsx, funder-detail.tsx
- **Public:** public-booking.tsx, public-registration.tsx, public-survey.tsx

## Data Model — Key Tables

| Table | What it stores |
|-------|---------------|
| contacts | Every person in the system (the identity layer) |
| groups | Organisations, community groups |
| bookings | Venue hire records |
| regularBookers | Booker profiles with portal access + agreement links |
| memberships / mous | Agreements controlling booker access |
| meetings | Mentoring sessions, catch-ups |
| mentoringRelationships | Mentee-mentor pairings with stage |
| programmes | Structured group delivery |
| programmeRegistrations | Who registered + attendance |
| events | Calendar events (internal + GCal synced) |
| impactLogs | Debriefs (the intelligence layer) |
| funders | Funding relationships + profiles |
| funderDeliverables | What each funder expects |
| funderTaxonomyCategories | Per-funder impact classification lens |

## Stack

- Frontend: React + TypeScript + Vite
- Backend: Express + TypeScript
- Database: PostgreSQL via Neon
- Auth: Clerk
- Hosting: Railway (auto-deploys from GitHub main)
- AI: Claude (extraction, analysis) + AssemblyAI (transcription)
- Email: Google Workspace via Gmail API
- Calendar: Google Calendar API
- Invoicing: Xero API
