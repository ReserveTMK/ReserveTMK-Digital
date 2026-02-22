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
The application uses PostgreSQL with Drizzle ORM. Key tables include `users`, `sessions`, `contacts`, `interactions`, `meetings`, `events`, `impact_logs`, `impact_taxonomy`, `impact_tags`, `programmes`, `bookings`, `memberships`, `mo_us`, `groups`, and related junction tables to support the comprehensive tracking and reporting features. JSONB columns are used for flexible metrics.

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
-   **Two-layer CRM (Groups)**: Manages organizations, collectives, and community groups, with searchable member management and roles.
-   **Kaupapa Matching**: AI-powered enrichment for matching organizations to impact taxonomy categories.

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