# MentorshipAI

## Overview

MentorshipAI is a full-stack web application for tracking mentorship relationships and measuring mentee growth over time. Users can manage contacts (mentees, business owners, innovators), log interactions (calls, meetings, voice notes), and leverage AI to analyze conversation transcripts for mindset, skill, and confidence metrics. The app features voice recording with AI-powered analysis, metric trend visualization via charts, and a polished UI with a purple/indigo design theme.

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
  - Speech-to-text transcription
  - Text-to-speech
  - Voice chat with streaming SSE responses
  - Image generation (gpt-image-1)
  - Interaction analysis (extracting mindset/skill/confidence scores)
- **Audio Processing**: Server-side audio format detection and ffmpeg conversion. Client-side uses MediaRecorder API and AudioWorklet for recording and playback
- **Batch Processing**: Utility module (`server/replit_integrations/batch/`) for rate-limited, retryable batch API calls using p-limit and p-retry

### Database
- **Database**: PostgreSQL (required, connected via `DATABASE_URL` environment variable)
- **ORM**: Drizzle ORM with `drizzle-zod` for schema-to-validation integration
- **Schema location**: `shared/schema.ts` and `shared/models/` directory
- **Key tables**:
  - `users` — Replit Auth user records (mandatory, do not drop)
  - `sessions` — Express session storage (mandatory, do not drop)
  - `contacts` — Mentee/contact records with metrics (mindset, skill, confidence as JSONB), demographics (age, ethnicity array, location)
  - `interactions` — Logged interactions with AI analysis results (JSONB), transcripts, keywords
  - `meetings` — Scheduled meetings between mentor and mentee (title, description, startTime, endTime, status, location)
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