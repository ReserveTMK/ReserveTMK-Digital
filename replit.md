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
-   **Programmes Section**: Manages internal events/activations with classification, budget tracking, status, and calendar integration.
-   **Bookings/Venue Hire Section**: Manages venue spaces and bookings with classification, status, pricing tiers, contact linking, and revenue/value summaries. Includes double-booking prevention.
-   **Agreements (Memberships & MOUs)**: Tracks annual memberships, venue hire allocations, partner trade agreements, and their link to bookings.
-   **Unified Calendar View**: Displays personal events, programmes, and bookings on a single calendar grid with color-coding and conflict detection.
-   **Two-layer CRM (Groups)**: Manages organizations, collectives, and community groups, with searchable member management and roles. Groups have a `relationshipTier` field (support/collaborate/mentioned) and optional `importSource` tracking.
-   **Ecosystem View**: Big-picture organization network management at `/ecosystem`. Displays groups in three relationship tiers (Support, Collaborate, Mentioned) with search/filter, edit mode for merge/delete operations, tier change with confirmations, and import source badges. Group merge transfers members and taxonomy links to primary group.
-   **Kaupapa Matching**: AI-powered enrichment for matching organizations to impact taxonomy categories.
-   **Legacy Reporting Layer**: Upload historical monthly PDF reports (from Nov 2023 onwards) using Year/Month selectors with AI-powered auto-detection from PDF document titles, duplicate prevention, and future month blocking. Includes PDF upload with AI-powered metric extraction (confidence scores, evidence snippets), draft/confirmed status workflow, and snapshot metrics (activations, workshops, mentoring, events, partner meetings, hub foot traffic, bookings). Hub Foot Traffic consolidates unique people and total engagements into a single metric. Unused columns removed: people_unique, engagements_total, groups_unique, hours_total, revenue_total, in_kind_total, extra_metrics. Supports boundary date to blend legacy data with live system data. Dashboard queries filter to confirmed reports only. Features auto-extraction on PDF upload (metrics extracted and high-confidence values >=70% auto-applied to snapshots), taxonomy suggestion prompts on report confirmation, and legacy data blending in the reporting engine for pre-boundary periods. Also extracts qualitative data: organisations (auto-created as Groups on confirmation with dedup and relationship tier mapping), narrative highlights, and people mentioned (auto-created as Contacts on confirmation with dedup). Report cards displayed in vertical timeline layout (newest first) with status dots, processing status badges (groups imported, people imported, or extraction-pending warnings), and bullet-pointed narrative highlights. View PDF button opens in-page PDF viewer dialog. Sync Groups & People button at top processes all confirmed reports with case-insensitive dedup, only active when unimported data exists. Confirmed reports show only View PDF, Taxonomy, Edit, Delete buttons (Re-extract and Unconfirm removed). Schema includes both `quarter` (backward compat) and `month` (1-12, primary going forward) fields.
-   **Benchmark Insights Engine**: Computes historical averages, highest period, period-over-period change, and current rank from combined legacy + live data. Displayed as a collapsible panel in reports.
-   **Legacy Metrics Review Tool**: AI-powered analysis of legacy report snapshots suggesting taxonomy improvements, missing metrics, and dashboard enhancements.
-   **Weekly Hub Debriefs**: Weekly operational summaries aggregating confirmed debriefs, completed programmes/bookings, milestones, themes, and sentiment for Monday-Sunday weeks. Supports draft/confirmed workflow with editable final summaries.
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

### System Dependencies
-   **ffmpeg**: For server-side audio format conversion.