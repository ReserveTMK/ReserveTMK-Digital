# ReserveTMK

## Overview

ReserveTMK is a full-stack web application for tracking mentorship relationships and measuring mentee growth over time. Users can manage contacts (mentees, business owners, innovators), log interactions (calls, meetings, voice notes), and leverage AI to analyze conversation transcripts for mindset, skill, and confidence metrics. The app features voice recording with AI-powered analysis, metric trend visualization via charts, report generation (monthly/quarterly/ad hoc), Google Calendar integration for event reconciliation, and a polished UI with a purple/indigo design theme. The app is a Progressive Web App (PWA) with mobile-friendly bottom navigation.

## Recent Changes (Feb 2026)
- Added bulk CSV contact upload: dialog with drag-to-upload, RFC-compliant CSV parser (handles quotes, commas, escapes), preview table, per-row error reporting, POST /api/contacts/bulk
- Enhanced debrief contact linking: searchable Command/Popover picker (type-to-search), Add Person button, role assignment (mentioned/primary/participant/mentor/mentee), unlink functionality
- Made OIDC auth setup non-blocking: server starts even during Replit OIDC outages, auth retries lazily on first login
- Added Google Calendar integration via Replit connector with event reconciliation (import/link workflows)
- Calendar is now the primary event hub — Events tab removed from navigation; all event management happens inline on the Calendar page
- Calendar event cards expand to show editable type selector, community member tagging via searchable contact picker, and Log Debrief button
- GCal events auto-import as app events on first edit to persist user customizations (type, tagged members)
- Event type filter toggles on calendar grid (Meeting, Mentoring Session, External Event, Personal Development)
- Auto-classification of GCal events by keyword matching in title/description
- Converted to PWA: web manifest, service worker, Apple mobile web app meta tags
- Added mobile bottom navigation bar with 4 key items + "More" for full nav access
- Added proper mobile padding (top for hamburger button, bottom for nav bar) to all 9 pages
- Responsive font sizing for contact detail page titles
- Multi-calendar sync: browsable list of all available Google calendars (personal, shared, team) with toggle switches to enable/disable sync; primary calendar always on; events deduplicated across calendars
- Calendar settings panel fetches available calendars via `calendarList.list()` API and shows color-coded list with toggle switches
- Idempotency guard on dismissed calendar events to prevent duplicate rows
- Log Debrief button gated to past events only (future events can still be classified and tagged)
- Added Programmes section: manage internal events/activations with classification types (Community Workshop, Creative Workshop, Youth Workshop, Talks, Networking), budget tracking (facilitator/talent, catering, promo costs), status tracking (planned/active/completed/cancelled), and calendar integration as "Programme" event type with indigo color and keyword auto-classification
- Added Bookings/Venue Hire section: manage venue spaces with capacity tracking, bookings with classification (Workshop, Community Event, Private Hire, Rehearsal, Meeting, Pop-up, Other), status tracking (enquiry/confirmed/completed/cancelled), pricing tiers (full price/discounted/free-koha), TBC scheduling support, booker and attendee contact linking, revenue/in-kind value summary stats, community hours calculation
- Added Agreements page (Memberships & MOUs): Memberships track annual fees, venue hire hour allocations, member contacts, payment status (paid/unpaid/partial/refunded), and usage against bookings; MOUs track partner trade agreements (providing/receiving), in-kind value, linked bookings; Bookings can be linked to a membership or MOU; summary stats break down bookings by payment source (direct/membership/MOU)
- Backend double-booking prevention: date+time overlap validation across bookings and programmes, 409 conflict response, /api/venue-conflicts endpoint
- Booking allowance on memberships/MOUs: bookingAllowance (number) and allowancePeriod (monthly/quarterly) fields, /api/bookings/:id/allowance usage tracking endpoint
- Calendar page: unified view with Schedule and Space toggle buttons to show/hide personal events and venue occupancy; all items (meetings, events, programmes, bookings) rendered on a single calendar grid with color-coded dots and conflict detection
- Space items (bookings in orange, programmes in indigo) show alongside schedule events with red ring + alert icon for time conflicts on same venue
- Dashboard calendar now shows programmes (indigo) and bookings (orange) alongside meetings (blue) and events (violet) with color legend

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Overall Structure
The project follows a monorepo pattern with three top-level code directories:
- `client/` — React frontend (SPA)
- `server/` — Express.js backend
- `shared/` — Shared types, schemas, and API contracts used by both client and server

### Frontend Architecture
- **Framework**: React with TypeScript, bundled by Vite
- **Routing**: Wouter (lightweight client-side router)
- **State/Data Fetching**: TanStack React Query v5 for server state management
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives with Tailwind CSS
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support), custom fonts (DM Sans, Outfit)
- **Forms**: React Hook Form with Zod validation via `@hookform/resolvers`
- **Charts**: Recharts for metric trend visualization (mindset, skill, confidence over time)
- **Icons**: Lucide React
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend Architecture
- **Framework**: Express.js running on Node.js with TypeScript (compiled via tsx in dev, esbuild for production)
- **API Pattern**: RESTful JSON API under `/api/` prefix. API contracts are defined in `shared/routes.ts` using Zod schemas, shared between client and server for type safety
- **Authentication**: Replit Auth via OpenID Connect (passport.js strategy). Sessions stored in PostgreSQL via `connect-pg-simple`. The auth system lives in `server/replit_integrations/auth/`
- **AI Integrations**: OpenAI API (via Replit AI Integrations proxy) for:
  - Speech-to-text transcription (Whisper via gpt-4o-mini-transcribe)
  - Text-to-speech
  - Voice chat with streaming SSE responses
  - Image generation (gpt-image-1)
  - Interaction analysis (extracting mindset/skill/confidence scores)
  - Impact debrief extraction (GPT-4o: taxonomy-aware structured extraction with confidence scoring)
- **Audio Processing**: Server-side audio format detection and ffmpeg conversion. Client-side uses MediaRecorder API and AudioWorklet for recording and playback
- **Batch Processing**: Utility module (`server/replit_integrations/batch/`) for rate-limited, retryable batch API calls using p-limit and p-retry

### Database
- **Database**: PostgreSQL (required, connected via `DATABASE_URL` environment variable)
- **ORM**: Drizzle ORM with `drizzle-zod` for schema-to-validation integration
- **Schema location**: `shared/schema.ts` and `shared/models/` directory
- **Key tables**:
  - `users` — Replit Auth user records (mandatory, do not drop)
  - `sessions` — Express session storage (mandatory, do not drop)
  - `contacts` — Mentee/contact records with metrics (mindset, skill, confidence as JSONB), demographics (age, ethnicity array, location), consent fields (consentStatus, consentDate)
  - `interactions` — Logged interactions with AI analysis results (JSONB), transcripts, keywords
  - `meetings` — Scheduled meetings between mentor and mentee (title, description, startTime, endTime, status, location)
  - `events` — External networking events, workshops, activations (name, type, startTime, endTime, location, attendeeCount, description, tags)
  - `event_attendance` — Junction table linking contacts to events with role (attendee/speaker/organizer/volunteer)
  - `impact_logs` — Core impact debrief records with transcript, summary, rawExtraction (JSONB), reviewedData (JSONB), status (draft/pending_review/confirmed), sentiment, milestones, keyQuotes
  - `impact_log_contacts` — Junction table linking impact logs to contacts with role and confidence score
  - `impact_taxonomy` — User-editable impact categories (name, description, color, parentId, active flag)
  - `impact_tags` — Tags on impact logs with taxonomy category, confidence score (0-100), and evidence text
  - `keyword_dictionary` — Maps natural language phrases to taxonomy categories for AI classification context
  - `action_items` — Trackable action items with title, description, status, priority, due date, linked contact and impact log
  - `consent_records` — Dated consent records per contact with status (given/withdrawn/pending) and notes
  - `audit_log` — Tracks changes to entities with userId, action, entityType, entityId, changes JSONB
  - `programmes` — Internal events/activations with classification (Community Workshop, Creative Workshop, Youth Workshop, Talks, Networking), budget fields (facilitatorCost, cateringCost, promoCost as numeric), status tracking (planned/active/completed/cancelled)
  - `programme_events` — Junction table linking programmes to calendar events
  - `conversations` / `messages` — Chat conversation storage for AI voice/text chat
- **Migrations**: Use `npm run db:push` (drizzle-kit push) to sync schema to database

### Build System
- **Development**: `npm run dev` — runs Express server with Vite middleware for HMR
- **Production build**: `npm run build` — Vite builds frontend to `dist/public/`, esbuild bundles server to `dist/index.cjs`
- **Production start**: `npm start` — runs the bundled server which serves static files

### Key Design Decisions
1. **Shared API contracts** (`shared/routes.ts`): Zod schemas define request/response shapes used by both client hooks and server routes, ensuring type safety across the stack
2. **Replit Auth over custom auth**: Uses Replit's OIDC flow rather than building custom authentication, reducing complexity
3. **JSONB for flexible metrics**: Contact metrics and interaction analysis are stored as JSONB columns, allowing the schema to evolve without migrations
4. **SSE for voice streaming**: Voice responses stream back via Server-Sent Events for real-time audio playback with sequence buffering for out-of-order chunks
5. **AudioWorklet for playback**: Uses Web Audio API's AudioWorklet processor with a ring buffer for smooth, low-latency streaming audio playback

## External Dependencies

### Required Services
- **PostgreSQL Database**: Connected via `DATABASE_URL` environment variable. Used for all data storage including sessions
- **OpenAI API** (via Replit AI Integrations): Connected via `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` environment variables. Powers speech-to-text, text-to-speech, voice chat, image generation, and interaction analysis
- **Replit Auth (OIDC)**: Connected via `ISSUER_URL` (defaults to `https://replit.com/oidc`) and `REPL_ID` environment variables

### Required Environment Variables
- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — Secret for Express session encryption
- `AI_INTEGRATIONS_OPENAI_API_KEY` — OpenAI API key
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — OpenAI API base URL
- `REPL_ID` — Replit environment identifier (auto-set on Replit)
- `ISSUER_URL` — OIDC issuer URL (optional, defaults to Replit's)

### System Dependencies
- **ffmpeg** — Required on the server for audio format conversion (WebM/MP4/OGG to WAV)