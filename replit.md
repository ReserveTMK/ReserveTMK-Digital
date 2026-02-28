# ReserveTMK

## Overview
ReserveTMK is a full-stack web application for tracking and managing mentorship relationships, with a focus on measuring mentee growth. It enables users to manage contacts, log interactions (calls, meetings, voice notes), and utilize AI for analyzing conversation transcripts to assess mindset, skill, and confidence. Key features include voice recording, AI-powered analysis, trend visualization, comprehensive reporting, Google Calendar integration, and a mobile-friendly PWA interface.

The project aims to provide detailed insights into engagement, delivery, and impact for mentorship organizations and individuals. Its reporting engine offers nine sections covering engagement metrics, delivery statistics, impact by taxonomy, outcome movement, value & contribution, narrative generator, community comparison, and conditional Tāmaki Ora alignment.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Overall Structure
The project uses a monorepo structure with `client/` (React frontend), `server/` (Express.js backend), and `shared/` (shared types, schemas, and API contracts).

### Frontend Architecture
Built with React and TypeScript using Vite, the frontend employs Wouter for routing, TanStack React Query for state management, and shadcn/ui for UI components. Styling uses Tailwind CSS. Recharts is used for data visualization. It functions as a PWA with mobile bottom navigation.

### Backend Architecture
The backend is an Express.js application with Node.js and TypeScript, providing a RESTful JSON API. Authentication uses Replit Auth (OpenID Connect). Text-based AI features (analysis, extraction, chat, enrichment) use Anthropic Claude via Replit AI Integrations. Audio features (speech-to-text, text-to-speech, voice chat) and image generation remain on OpenAI. Server-side audio processing uses ffmpeg.

### Database
PostgreSQL with Drizzle ORM is used. Key tables manage users, contacts, interactions, meetings, events, impact logs, taxonomy, programmes, bookings, groups, funders, funder documents, and reporting data. JSONB columns are used for flexible metrics.

### Key Design Decisions
1.  **Shared API contracts**: Zod schemas ensure type safety across client and server.
2.  **Replit Auth**: Simplifies authentication leveraging Replit's OIDC.
3.  **JSONB for flexible metrics**: Allows schema evolution without extensive migrations.
4.  **SSE for voice streaming**: Enables real-time audio playback.
5.  **AudioWorklet for playback**: Provides smooth, low-latency streaming audio.
6.  **Community Lens filtering**: Ethnicity-based audience filtering at the reporting level using contact ethnicity arrays.

### Features
-   **Reporting Engine**: Comprehensive reporting with 9 sections, unified toolbar (community lens + funder profiles in one row), and export options. Legacy data is blended inline into Engagement and Delivery sections (not a separate section). Includes two narrative styles (compliance/story), benchmark insights, community comparison, Tāmaki Ora alignment, and community spend tracking in Delivery.
-   **Funders Section** (Settings): Manages funding relationships with contact details, key dates, document storage (Base64 in Postgres), outcomes frameworks, and reporting profiles. Drives report generation via funder quick-select.
-   **Community Lens**: Filters report metrics by ethnicity — Māori, Pasifika, or Māori + Pasifika. Applied to engagement, impact, and outcome sections. Delivery and financial sections remain unfiltered (org-level).
-   **Funder Profiles**: Quick-select cards on Reports page that pre-set community lens, narrative style, and priority sections. Managed via Funders page under Settings.
-   **Community Comparison Panel**: Side-by-side Māori vs Pasifika metrics (visible only when "All Communities" lens is active).
-   **Tāmaki Ora Alignment Panel**: Maps metrics to the 3 pou (Whai Rawa Ora, Te Hapori Ora, Huatau Ora) — visible when Ngā Mātārae funder profile is active.
-   **Structured Narratives**: Two styles — Compliance (stats-first, for Auckland Council) and Story (narrative-first, for Foundation North). Manual participant story and what's-next fields.
-   **Google Calendar Integration**: Reconciles external events, allows event classification, community member tagging, and debrief logging.
-   **Programmes Section**: Manages internal events with classification, budget tracking, and Kanban board view with drag-and-drop.
-   **Bookings/Venue Hire Section**: Manages venue spaces and bookings with Kanban view, double-booking prevention, and quick-add for contacts/groups.
-   **Agreements (Memberships & MOUs)**: Tracks year-based annual memberships with standard value vs annual fee (savings tracking), booking allowance, and partner MOUs with actual value vs in-kind value (subsidy tracking). Undo-on-delete with 5s delayed deletion. Default status: active.
-   **Unified Calendar View**: Displays personal events, programmes, and bookings with color-coding and conflict detection.
-   **Two-layer CRM (Groups)**: Manages organizations, collectives, and community groups with member management, relationship tiers, and import source tracking.
-   **Ecosystem View**: Strategic network intelligence with health summaries, relationship tiers, strategic importance, and role tagging.
-   **Gmail Contact Import**: Scans Gmail headers to auto-create contacts and groups, supporting multi-account sync and AI-powered mapping.
-   **Legacy Reporting Layer**: Imports historical PDF reports with AI-powered metric extraction, draft/confirmed workflow, and qualitative data extraction.
-   **Weekly Hub Debriefs**: Aggregates weekly operational summaries, milestones, themes, and sentiment. AI extraction includes community actions (people follow-ups), operational actions (internal hub tasks), and operator reflections (wins/concerns/learnings).
-   **Community Spend Tracking**: Tracks money spent in the community, linking to contacts, groups, programmes, and bookings.
-   **Community Member Management**: Automated classification of community members based on engagement signals, with AI relationship scoring and last active date tracking. Table view shows Community column with inline Add/Yes toggle badges. Groups detail dialog has "Push All to Community" button and per-member community indicators.
-   **NZ Timezone Standardization**: All date calculations use Pacific/Auckland timezone with Monday-start weeks.

### Ethnicity Mapping (Community Lens)
-   **Māori lens**: contacts where ethnicity array contains `"Māori"`
-   **Pasifika lens**: contacts where ethnicity array contains any of: `["Samoan", "Tongan", "Cook Islands Māori", "Niuean", "Tokelauan", "Fijian", "Hawaiian", "Tahitian", "Other Polynesian", "Micronesian", "Melanesian"]`
-   **Māori + Pasifika**: union of both sets
-   Constants defined in `server/reporting.ts` as `MAORI_ETHNICITIES` and `PASIFIKA_ETHNICITIES`

### Funders Table Schema
-   `funders`: id, userId, name, organisation, contactPerson, contactEmail, contactPhone, status (active_funder/in_conversation/pending_eoi/completed), communityLens, outcomesFramework, reportingCadence, narrativeStyle, prioritySections (text array), funderTag, contractStart, contractEnd, nextDeadline, reviewDate, notes, isDefault, createdAt
-   `funder_documents`: id, funderId, userId, fileName, documentType (contract/eoi/framework/report/other), fileData (Base64), fileSize, notes, createdAt
-   Three default funders seeded on first access: Ngā Mātārae (māori lens, compliance), EDO/Auckland Council (all, compliance), Foundation North (pasifika, story)

## External Dependencies

### Required Services
-   **PostgreSQL Database**: Data storage.
-   **Anthropic Claude API** (via Replit AI Integrations): Text-based AI features (analysis, extraction, chat, enrichment, taxonomy).
-   **OpenAI API** (via Replit AI Integrations): Audio features (STT, TTS, voice chat) and image generation.
-   **Replit Auth (OIDC)**: User authentication.

### AI Model Mapping
-   **claude-sonnet-4-6**: Interaction analysis, impact extraction, AI chat
-   **claude-haiku-4-5**: Organisation enrichment, legacy report extraction, taxonomy scan, Gmail domain mapping
-   **OpenAI (gpt-4o-mini-transcribe)**: Speech-to-text transcription
-   **OpenAI (gpt-audio)**: Voice chat, text-to-speech
-   **OpenAI (gpt-image-1)**: Image generation
-   Anthropic client: `server/replit_integrations/anthropic/client.ts`
-   OpenAI client (audio only): `server/replit_integrations/audio/client.ts`

### Required Environment Variables
-   `DATABASE_URL`
-   `SESSION_SECRET`
-   `AI_INTEGRATIONS_ANTHROPIC_API_KEY`
-   `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`
-   `AI_INTEGRATIONS_OPENAI_API_KEY`
-   `AI_INTEGRATIONS_OPENAI_BASE_URL`
-   `REPL_ID`
-   `GOOGLE_OAUTH_CLIENT_ID` (optional)
-   `GOOGLE_OAUTH_CLIENT_SECRET` (optional)

### System Dependencies
-   **ffmpeg**: Server-side audio format conversion.