# ReserveTMK

## Overview
ReserveTMK is a full-stack web application for tracking and managing mentorship relationships, with a focus on measuring mentee growth. It enables users to manage contacts, log interactions (calls, meetings, voice notes), and utilize AI for analyzing conversation transcripts to assess mindset, skill, and confidence. Key features include voice recording, AI-powered analysis, trend visualization, comprehensive reporting, Google Calendar integration, and a mobile-friendly PWA interface.

The project aims to provide detailed insights into engagement, delivery, and impact for mentorship organizations and individuals. Its reporting engine offers six key sections covering engagement metrics, delivery statistics, impact by taxonomy, outcome movement, value & contribution, and a narrative generator.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Overall Structure
The project uses a monorepo structure with `client/` (React frontend), `server/` (Express.js backend), and `shared/` (shared types, schemas, and API contracts).

### Frontend Architecture
Built with React and TypeScript using Vite, the frontend employs Wouter for routing, TanStack React Query for state management, and shadcn/ui for UI components. Styling uses Tailwind CSS. Recharts is used for data visualization. It functions as a PWA with mobile bottom navigation.

### Backend Architecture
The backend is an Express.js application with Node.js and TypeScript, providing a RESTful JSON API. Authentication uses Replit Auth (OpenID Connect). AI integrations with OpenAI power speech-to-text, text-to-speech, voice chat, image generation, and interaction analysis. Server-side audio processing uses ffmpeg.

### Database
PostgreSQL with Drizzle ORM is used. Key tables manage users, contacts, interactions, meetings, events, impact logs, taxonomy, programmes, bookings, groups, and reporting data. JSONB columns are used for flexible metrics.

### Key Design Decisions
1.  **Shared API contracts**: Zod schemas ensure type safety across client and server.
2.  **Replit Auth**: Simplifies authentication leveraging Replit's OIDC.
3.  **JSONB for flexible metrics**: Allows schema evolution without extensive migrations.
4.  **SSE for voice streaming**: Enables real-time audio playback.
5.  **AudioWorklet for playback**: Provides smooth, low-latency streaming audio.

### Features
-   **Reporting Engine**: Comprehensive reporting with various sections, filters, and export options, blending live and legacy data. Includes a narrative generator and benchmark insights.
-   **Google Calendar Integration**: Reconciles external events, allows event classification, community member tagging, and debrief logging.
-   **Programmes Section**: Manages internal events with classification, budget tracking, and Kanban board view with drag-and-drop.
-   **Bookings/Venue Hire Section**: Manages venue spaces and bookings with Kanban view, double-booking prevention, and quick-add for contacts/groups.
-   **Agreements (Memberships & MOUs)**: Tracks annual memberships, venue hire allocations, and partner agreements.
-   **Unified Calendar View**: Displays personal events, programmes, and bookings with color-coding and conflict detection.
-   **Two-layer CRM (Groups)**: Manages organizations, collectives, and community groups with member management, relationship tiers, and import source tracking.
-   **Ecosystem View**: Strategic network intelligence with health summaries, relationship tiers, strategic importance, and role tagging.
-   **Gmail Contact Import**: Scans Gmail headers to auto-create contacts and groups, supporting multi-account sync and AI-powered mapping.
-   **Legacy Reporting Layer**: Imports historical PDF reports with AI-powered metric extraction, draft/confirmed workflow, and qualitative data extraction.
-   **Weekly Hub Debriefs**: Aggregates weekly operational summaries, milestones, themes, and sentiment.
-   **Community Spend Tracking**: Tracks money spent in the community, linking to contacts, groups, programmes, and bookings.
-   **Community Member Management**: Automated classification of community members based on engagement signals, with AI relationship scoring and last active date tracking.
-   **NZ Timezone Standardization**: All date calculations use Pacific/Auckland timezone with Monday-start weeks.

## External Dependencies

### Required Services
-   **PostgreSQL Database**: Data storage.
-   **OpenAI API** (via Replit AI Integrations): AI-powered features.
-   **Replit Auth (OIDC)**: User authentication.

### Required Environment Variables
-   `DATABASE_URL`
-   `SESSION_SECRET`
-   `AI_INTEGRATIONS_OPENAI_API_KEY`
-   `AI_INTEGRATIONS_OPENAI_BASE_URL`
-   `REPL_ID`
-   `GOOGLE_OAUTH_CLIENT_ID` (optional)
-   `GOOGLE_OAUTH_CLIENT_SECRET` (optional)

### System Dependencies
-   **ffmpeg**: Server-side audio format conversion.