# ReserveTMK

## Overview
ReserveTMK is a full-stack web application designed to track and manage mentorship relationships, focusing on measuring mentee growth. It enables users to manage contacts, log interactions (calls, meetings, voice notes), and leverage AI for analyzing conversation transcripts to assess mindset, skill, and confidence metrics. The application includes voice recording, AI-powered analysis, trend visualization through charts, comprehensive reporting (monthly, quarterly, ad-hoc), Google Calendar integration for event reconciliation, and a mobile-friendly Progressive Web App (PWA) interface with a purple/indigo theme.

The project aims to provide a robust platform for organizations and individuals involved in mentorship, offering detailed insights into engagement, delivery, and impact. Its reporting engine provides six key sections covering engagement metrics, delivery statistics, impact by taxonomy, outcome movement, value & contribution, and a narrative generator for structured summaries.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Overall Structure
The project uses a monorepo structure with `client/` (React frontend), `server/` (Express.js backend), and `shared/` (shared types, schemas, and API contracts).

### Frontend Architecture
The frontend is built with React and TypeScript using Vite. It employs Wouter for routing, TanStack React Query for state management, and shadcn/ui (Radix UI + Tailwind CSS) for UI components. Styling is handled by Tailwind CSS with custom fonts. Forms use React Hook Form with Zod validation. Recharts is used for data visualization, and Lucide React for icons. The application is a PWA with mobile bottom navigation.

### Navigation Structure
The app uses a top navigation bar (desktop) and sidebar/bottom nav (mobile) with the following sections:
- **Dashboard** (standalone, `/`)
- **Calendar** (standalone, `/calendar`)
- **Community**: People (`/contacts`), Groups (`/groups`), Ecosystem (`/ecosystem`)
- **Delivery**: Programmes (`/programmes`), Bookings (`/bookings`), Agreements (`/agreements`)
- **Tracking**: Interactions (`/debriefs`), Impact Logs (`/debrief-queue`), Debriefs (`/weekly-debriefs`), Community Spend (`/community-spend`)
- **Reporting**: Reports (`/reports`), Legacy Reports (`/legacy-reports`), Taxonomy (`/taxonomy`)
- **Settings**: Gmail Import (`/gmail-import`)

### Backend Architecture
The backend is an Express.js application running on Node.js with TypeScript, providing a RESTful JSON API. Authentication is managed via Replit Auth using OpenID Connect. AI integrations with OpenAI (via Replit AI Integrations proxy) power speech-to-text, text-to-speech, voice chat, image generation, interaction analysis, and impact debrief extraction. Server-side audio processing uses ffmpeg for format conversion. Batch processing is handled by a utility module for rate-limited, retryable API calls.

### Database
The application uses PostgreSQL with Drizzle ORM. Key tables include `users`, `sessions`, `contacts`, `interactions`, `meetings`, `events`, `impact_logs`, `impact_taxonomy`, `impact_tags`, `programmes`, `bookings`, `memberships`, `mo_us`, `groups`, `legacy_reports`, `legacy_report_snapshots`, `legacy_report_extractions`, `reporting_settings`, `weekly_hub_debriefs`, and related junction tables to support the comprehensive tracking and reporting features. JSONB columns are used for flexible metrics.

### Key Design Decisions
1.  **Shared API contracts**: Zod schemas define API request/response shapes for type safety across client and server.
2.  **Replit Auth**: Leverages Replit's OIDC for authentication to simplify development.
3.  **JSONB for flexible metrics**: Allows schema evolution without extensive migrations.
4.  **SSE for voice streaming**: Enables real-time audio playback with Server-Sent Events.
5.  **AudioWorklet for playback**: Provides smooth, low-latency streaming audio playback using the Web Audio API.

### Features
-   **Reporting Engine**: Comprehensive reporting system with 6 sections covering Engagement, Delivery, Impact by Taxonomy, Outcome Movement, Value & Contribution, and a Narrative Generator. Supports saving, loading, and CSV export of reports with various filter controls.
-   **Bulk CSV Contact Upload**: Facilitates mass import of contacts with error reporting.
-   **Debrief Contact Linking**: Enhanced linking of contacts to debriefs with search and role assignment.
-   **Google Calendar Integration**: Reconciles external events with application events, enabling event type classification, community member tagging, and debrief logging. Supports multi-calendar sync and auto-classification.
-   **Programmes Section**: Manages internal events/activations with classification, budget tracking, status, and calendar integration. Features a Kanban board view (Board/List toggle) with drag-and-drop status updates using @hello-pangea/dnd. Includes a yearly budget tracker showing current calendar year's total spend, monthly programme count vs target of 2, and yearly count vs target of 24 with progress bars.
-   **Bookings/Venue Hire Section**: Manages venue spaces and bookings. Organisation (Booking Group) is the primary identifier shown on cards; venue shown as secondary info. Features Kanban board view (Board/List toggle) with drag-and-drop status updates. Booking form has: Booker (contact) and Booking Group (organisation) at top with quick-add capability for creating new contacts/groups inline. Single-day default with multi-day toggle. Visual time picker with AM/PM formatted time slots. Pricing structure: Duration Type (hourly/half_day/full_day), Rate Type (standard/community with 20% off), Pricing Tier, all GST exclusive. Default pricing settings (full-day and half-day rates) configurable in Manage Venues dialog; auto-fills amount when duration/rate type selected. Agreement linking (Membership/MOU). Notes. No attendees section. Includes double-booking prevention. Quick-add for contacts/groups available across all forms system-wide (Bookings, Community Spend, Agreements, Programmes, Debriefs, Calendar).
-   **Agreements (Memberships & MOUs)**: Tracks annual memberships, venue hire allocations, partner trade agreements, and their link to bookings.
-   **Unified Calendar View**: Displays personal events, programmes, and bookings on a single calendar grid with color-coding and conflict detection.
-   **Two-layer CRM (Groups)**: Manages organizations, collectives, and community groups, with searchable member management and roles. Groups have a `relationshipTier` field (support/collaborate/mentioned) and optional `importSource` tracking.
-   **Ecosystem View**: Strategic network intelligence layer at `/ecosystem`. Features: Health summary dashboard (total orgs, active in 90d, dormant 6mo+, at-risk high-importance dormant). Groups displayed in three relationship tiers (Support, Collaborate, Noted). Each org card shows: engagement status dot (green/amber/gray), strategic importance badge, ecosystem role badges, community/total member counts, total activity count, last engagement date, relationship strength dots (1-5, clickable). Inline editing via popovers for strategic importance (high/medium/low) and ecosystem roles (multi-select: funder, delivery_partner, referral_partner, corporate, government, supplier, creative, alumni_business, connector). Advanced filter panel for ecosystem role, strategic importance, relationship strength, and engagement status. Engagement metrics auto-calculated from events, programmes, bookings, community spend, impact logs, and agreements. Edit mode supports merge, bulk tier change, and bulk delete. Schema fields: `relationshipStrength` (int 1-5), `strategicImportance` (low/medium/high), `ecosystemRoles` (text array).
-   **Gmail Contact Import**: Scans Gmail email headers (From/To/CC) to auto-create contacts and groups. Features: initial 12-month import, daily auto-sync, AI-powered domain-to-organisation name mapping, frequency-based relationship tier assignment (Collaborate/Support/Mentioned), case-insensitive deduplication, public domain filtering (gmail, outlook, yahoo, etc.), noreply address filtering, and configurable exclusion lists (domains + emails). Located under Settings at `/gmail-import`. Uses Replit Gmail connector for OAuth. Import history tracking with scan type, counts, and status. Groups auto-linked to contacts by domain. Schema: `gmail_import_history`, `gmail_exclusions`, `gmail_sync_settings` tables. **Multi-account support**: Additional Gmail accounts can be connected via Google OAuth2 flow (requires GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET). Scans merge results across all connected accounts with dedup. Token refresh handled automatically. Schema: `gmail_connected_accounts` table.
-   **Kaupapa Matching**: AI-powered enrichment for matching organizations to impact taxonomy categories.
-   **Legacy Reporting Layer**: Upload historical monthly PDF reports (from Nov 2023 onwards) using Year/Month selectors with AI-powered auto-detection from PDF document titles, duplicate prevention, and future month blocking. Includes PDF upload with AI-powered metric extraction (confidence scores, evidence snippets), draft/confirmed status workflow, and snapshot metrics (activations, workshops, mentoring, events, partner meetings, hub foot traffic, bookings). Hub Foot Traffic consolidates unique people and total engagements into a single metric. Unused columns removed: people_unique, engagements_total, groups_unique, hours_total, revenue_total, in_kind_total, extra_metrics. Supports boundary date to blend legacy data with live system data. Dashboard queries filter to confirmed reports only. Features auto-extraction on PDF upload (metrics extracted and high-confidence values >=70% auto-applied to snapshots), taxonomy suggestion prompts on report confirmation, and legacy data blending in the reporting engine for pre-boundary periods. Also extracts qualitative data: organisations (auto-created as Groups on confirmation with dedup and relationship tier mapping), narrative highlights, and people mentioned (auto-created as Contacts on confirmation with dedup). Report cards displayed in vertical timeline layout (newest first) with status dots, processing status badges (groups imported, people imported, or extraction-pending warnings), and bullet-pointed narrative highlights. View PDF button opens in-page PDF viewer dialog. Sync Groups & People button at top processes all confirmed reports with case-insensitive dedup, only active when unimported data exists. Confirmed reports show only View PDF, Edit, Delete buttons (Re-extract, Unconfirm, and per-report Taxonomy removed). Taxonomy scanning moved to dedicated Taxonomy Management page with AI-powered scanner. Schema includes both `quarter` (backward compat) and `month` (1-12, primary going forward) fields.
-   **Benchmark Insights Engine**: Computes historical averages, highest period, period-over-period change, and current rank from combined legacy + live data. Displayed as a collapsible panel in reports.
-   **Legacy Metrics Review Tool**: AI-powered analysis of legacy report snapshots suggesting taxonomy improvements, missing metrics, and dashboard enhancements.
-   **Weekly Hub Debriefs**: Weekly operational summaries aggregating confirmed debriefs, completed programmes/bookings, milestones, themes, and sentiment for Monday-Sunday weeks. Supports draft/confirmed workflow with editable final summaries.
-   **Community Spend Tracking**: Tracks money spent in the community (contracting, goods, services, sponsorship, donations). Located under Community section at `/community-spend`. Supports linking spend entries to contacts, groups, programmes, and bookings. Auto-creates spend entries when programmes have facilitators with costs. Summary dashboard with total spend, category breakdown, and payment status tracking (paid/pending/invoiced).
-   **Community Member Management**: Automated system to differentiate real community members from general business contacts. Contacts are auto-classified based on engagement signals: interactions, bookings, programmes, memberships, MOUs, community spend, impact logs, event attendance, and legacy report mentions. Email-only contacts stay as business contacts; those with attendance/engagement become community members. Features: Community/All Contacts toggle on People page, bulk junk cleanup tool (40+ noreply/automated email patterns), AI relationship scoring (Inner Circle/Active Network/Wider Community) with recency weighting, manual override flags, lastActiveDate tracking from most recent engagement. Ecosystem/Groups view sorts organisations by community member density (groups with more community members appear first). Schema fields: `isCommunityMember`, `communityMemberOverride`, `relationshipCircle`, `relationshipCircleOverride`, `importSource`, `lastActiveDate`.
-   **NZ Timezone Standardization**: All date calculations use Pacific/Auckland timezone with Monday-start weeks via shared `nz-week.ts` utility.

## External Dependencies

### Required Services
-   **PostgreSQL Database**: For all data storage.
-   **OpenAI API** (via Replit AI Integrations): For AI-powered features (speech-to-text, text-to-speech, voice chat, image generation, interaction analysis, impact debrief extraction).
-   **Replit Auth (OIDC)**: For user authentication.

### Required Environment Variables
-   `DATABASE_URL`
-   `SESSION_SECRET`
-   `AI_INTEGRATIONS_OPENAI_API_KEY`
-   `AI_INTEGRATIONS_OPENAI_BASE_URL`
-   `REPL_ID`
-   `ISSUER_URL` (optional)
-   `GOOGLE_OAUTH_CLIENT_ID` (optional, for multi-account Gmail)
-   `GOOGLE_OAUTH_CLIENT_SECRET` (optional, for multi-account Gmail)

### System Dependencies
-   **ffmpeg**: For server-side audio format conversion.