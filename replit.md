# ReserveTMK

## Overview
ReserveTMK is a full-stack web application designed to track and manage mentorship relationships, focusing on measuring mentee growth. It provides tools for contact management, logging interactions, and using AI to analyze conversation transcripts for insights into mindset, skill, and confidence. Key features include voice recording, AI analysis, trend visualization, comprehensive reporting, Google Calendar integration, and a mobile-friendly PWA. The project aims to deliver detailed insights into engagement, delivery, and impact for mentorship organizations and individuals, with a robust reporting engine covering various metrics and alignment with conditional Tāmaki Ora principles.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Overall Structure
The project utilizes a monorepo approach, separating concerns into `client/` (React frontend), `server/` (Express.js backend), and `shared/` (shared types, schemas, and API contracts).

### Frontend Architecture
The frontend is built with React and TypeScript using Vite, Wouter for routing, TanStack React Query for state management, shadcn/ui for UI components, and Tailwind CSS for styling. Recharts handles data visualizations, and the application functions as a mobile-first PWA.

### Backend Architecture
The backend is an Express.js application with Node.js and TypeScript, exposing a RESTful JSON API. Authentication is managed via Replit Auth (OpenID Connect). Text-based AI functionalities are powered by Anthropic Claude through Replit AI Integrations. Audio features (speech-to-text, text-to-speech, voice chat) and image generation are handled by OpenAI. Server-side audio processing relies on ffmpeg.

### Database
PostgreSQL is used as the database, integrated with Drizzle ORM. The schema includes tables for users, contacts, interactions, meetings, events, impact logs, taxonomy, programmes, bookings, bookable_resources, desk_bookings, gear_bookings, groups, funders, projects, and reporting data. JSONB columns are used for flexible metric storage.

### Key Design Decisions
1.  **Shared API Contracts**: Zod schemas ensure type safety and consistency.
2.  **Replit Auth Integration**: Streamlines user authentication.
3.  **JSONB for Flexible Metrics**: Allows for schema evolution.
4.  **SSE for Voice Streaming**: Enables real-time audio playback.
5.  **AudioWorklet for Playback**: Provides smooth, low-latency streaming audio.
6.  **Community Lens Filtering**: Implements ethnicity-based audience filtering for reporting.

### Features
-   **Reporting Engine**: Funder-focused reporting across 9 sections, including Reach, Delivery, Impact, and alignment with Tamaki Ora. Supports various touchpoints, highlights, and all 9 growth metrics (mindset, skill, confidence, bizConfidence, systemsInPlace, fundingReadiness, networkStrength, communityImpact, digitalPresence) grouped by Personal/Venture/Community. Includes journey stage progression tracking (kakano/tipu/ora transitions), connection strength distribution visualization, community discount aggregation, and mentoring focus theme summaries with human-readable labels.
-   **Catch Up List**: Manages contact follow-ups with priority, notes, and dismissal features.
-   **Funders Section**: Manages funding relationships, key dates, document storage, and reporting profiles.
-   **Scheduling System**: Manages mentor/staff availability with Google Calendar sync.
-   **Public Booking Page**: Pathway-driven booking flow for mentoring or meetings, including new and returning mentee handling.
-   **Mentoring System**: Comprehensive mentoring management hub with sessions, mentees, and mentors tabs. Includes AI debrief insights, journey stage tracking, and application review. Manual session creation syncs with configured meeting types from Settings, includes Discovery Session option (auto-creates mentoring application), multi-attendee invite system with Google Calendar sync, streamlined complete-to-debrief flow, session prep context on upcoming cards, and "Schedule First Session" prompt after accepting applications. Meetings table has `attendees` jsonb column for multi-invite support.
-   **Journey Framework**: Tracks culturally-grounded Maori stage progression (kakano → tipu → ora) with visual components.
-   **NZ Timezone Standardization**: All date and time calculations are standardized to Pacific/Auckland.
-   **Calendar as Tracking Hub**: Integrates Google Calendar sync, manual activity logging, and monthly summaries. Daily foot traffic input per day in the day view panel; monthly summary shows aggregated totals from `dailyFootTraffic` table. Confirmed/completed bookings appear in Schedule View with expandable inline attendance tracking (head count, rangatahi count, rangatahi event toggle, contact tagging). Log Activity types: Hub Activity, Drop-in, Meeting, Community Event, Venue Hire, Other.
-   **Community Structure**: A 4-tier system (All Contacts / Our Community / Our Innovators / VIP) with dynamic filtering, contact roles, group types, and promote/demote functionality. VIP applies to both contacts and groups with a `vipReason` field capturing why they're priority. People and Groups list cards are compact (name + group/type only) with tier-specific extras. Groups support bidirectional associations via `groupAssociations` table. People table view includes an inline Group column with search, link/unlink, and quick-create functionality.
-   **Our Innovators**: A curated subset of contacts with specific support types and connection strengths. Cards show journey stage badge and support type ticks. Table view includes inline Area column with NZ area code picker (09, 07, 06, 04, 03).
-   **Ecosystem View**: Role-based lane layout (Funders, Delivery Partners, Connectors, etc.) with a "Priority Conversations" VIP section showing combined VIP contacts and groups. Groups can appear in multiple role lanes via `ecosystemRoles` array.
-   **Debriefs/Impact Tracking**: Queue/Archive tab structure. Queue shows events needing debriefs with dismiss/un-dismiss. Streamlined reconcile workflow: record audio → create debrief → auto-navigate to core view → AI auto-analyzes → user reviews → complete/save → auto-navigate back to Queue. Impact tags auto-selected based on AI extraction with checkboxes for opt-out. Linked community members split into Primary/Secondary sections with Quick Add (creates contact in Our Community tier, kakano stage). Action items shown as AI suggestions with opt-in (click to accept). Weekly summaries and 8-metric contact sync.
-   **Projects**: Tracks internal initiatives with AI-powered task extraction.
-   **Spaces Hub**: Unified hub at `/spaces` with tabs: Calendar (venue + desk availability grid with day/week views, shows venue hires in amber and internal meetings in blue), Venue Hire (full booking management with metrics, kanban/list views, create/edit), Hot Desking (desk availability cards with upcoming bookings). Settings accessible via gear icon in Venue Hire tab. Meetings table has `venueId` column for room assignment — mentoring sessions can be assigned to specific venues via room selector in ScheduleSessionDialog.
-   **Venue Hire System**: Manages venue hires with automated workflows, conflict checking, and post-hire surveys. Post-completion dialog triggers next-step actions (invoice + mark served) with `servedAt` and `invoiceRequested` tracking. UI labels say "Venue Hire" throughout. Now embedded within Spaces hub. Routes: `/bookings` redirects to `/spaces?tab=venue-hire`; API `/api/bookings` and DB `bookings` table unchanged.
-   **Gear Page**: Standalone page at `/gear` for equipment management. Shows gear inventory with availability status (available/checked out/late), active checkouts with mark-returned action, and collapsible settings panel for gear CRUD (add/edit/delete items, requiresApproval flag).
-   **Booking Categories**: Three booking categories under a unified Regular Booker framework: Venue Hire, Hot Desking, and Gear Booking. Each category has dedicated resources managed in Venue Hire Settings > Resources tab. Access controlled by linked agreements (Memberships/MOUs) via `bookingCategories` array. Venue Hire uses allowance/period model; Hot Desking and Gear provide unlimited access within agreement date range.
-   **Bookable Resources**: `bookable_resources` table stores all resources across categories. Venues (Workshop Space, Boardroom, Studio), Desks (Plug n Play 1-3, Drop-in 1-2), Gear (Camera Gear, Heat Press, 3D Printer). Gear items support `requiresApproval` flag for items needing training.
-   **Hot Desking**: Desk bookings via `desk_bookings` table. Supports recurring bookings (day, frequency, end date via `recurringPattern` jsonb). First-come-first-served (any available desk). Availability shows status only (no booker names for privacy). Now within Spaces hub Hot Desking tab.
-   **Gear Booking**: Equipment bookings via `gear_bookings` table. Same-day return required. Items with `requiresApproval` flag need admin approval. Tracks late returns. Admin can mark returned from Gear page.
-   **Resource Calendar**: Legacy page at `/resource-calendar` now redirects to `/spaces`. Functionality absorbed into Spaces Calendar tab (venues + desks) and Gear page.
-   **Regular Booker Portal**: Self-service portal for regular bookers with magic link authentication, multi-category support. Shows only agreement-enabled categories. Per-category status: venue allowance usage, hot desking/gear subscription status with expiry. Category-specific booking flows for venue, desk (with recurring), and gear (with approval warnings). Unified "My Bookings" across all categories. Supports group-level portal links (`isGroupLink` on bookerLinks).
-   **Regular Bookers Page**: Dedicated page at `/regular-bookers` (under Delivery nav) with table view showing booker name, category badges ([Venue]/[Desk]/[Gear] from agreement), agreement, per-category package status, pricing tier, portal link status, and account status. Category filter dropdown. Billing fields hidden when agreement is linked. Each row has inline Copy Link, Edit, and Delete actions. Portal link auto-generated on creation.
-   **After-Hours Auto-Send**: Automatically sends venue instruction reminders for bookings outside staffed operating hours.
-   **Xero Integration**: OAuth2 connection for automated invoice generation and contact/invoice syncing.
-   **Gmail Sync**: Multi-account Gmail import with smart filtering, mailing list detection, and user-managed exclusion lists. Includes a cleanup tool for marketing contacts.
-   **Mobile Swipe Navigation**: Contact detail page supports horizontal swipe to navigate between contacts on mobile, with subtle edge chevron indicators.
-   **Public Programme Registration**: Programmes can enable public registration with auto-generated slugs, shareable links, and QR codes. Public page at `/register/:slug` collects registrations (name, email, phone, dietary, accessibility, referral). Registrations auto-match or create contacts. Registration management dialog with attendance tracking, CSV export. Registrations appear in contact detail timeline. Schema: `programme_registrations` table + `publicRegistrations`/`slug`/`capacity` on `programmes`.
-   **UI Terminology**: Uses "People" for contacts, 12-hour time format, and "Venue Hire" instead of "Bookings" in all UI labels (routes/API/DB unchanged).

## External Dependencies

### Required Services
-   **PostgreSQL Database**: Primary data persistence.
-   **Anthropic Claude API** (via Replit AI Integrations): Utilized for text-based AI features.
-   **OpenAI API** (via Replit AI Integrations): Used for audio functionalities and image generation.
-   **Replit Auth (OIDC)**: Handles user authentication and authorization.

### AI Model Mapping
-   **claude-sonnet-4-6**: For interaction analysis, impact extraction, AI chat, and project task extraction.
-   **claude-haiku-4-5**: For organisation enrichment, legacy report extraction, taxonomy scanning, and Gmail domain mapping.
-   **OpenAI (gpt-4o-mini-transcribe)**: For speech-to-text transcription.
-   **OpenAI (gpt-audio)**: For voice chat and text-to-speech.
-   **OpenAI (gpt-image-1)**: For image generation.

### Security & Code Quality
-   **Auth Cookies**: Cookie settings in `server/replit_integrations/auth/replitAuth.ts` — `secure: true` / `sameSite: "none"` for both dev and production (Replit dev preview also serves over HTTPS). Domain resolution uses `REPLIT_DEV_DOMAIN` env var when available, falling back to `req.hostname`.
-   **IDOR Protection**: Ownership checks (`resource.userId === userId`) on milestones, relationship-stage-history, weekly-hub-debriefs, regular-bookers, and booking survey endpoints.
-   **Type-Safe Params**: `parseId()`, `parseStr()`, `parseDate()` helpers at top of `server/routes.ts` for Express `req.params`/`req.query`.
-   **Response Logging**: API logger in `server/index.ts` only logs method, path, status, duration — truncated error message for 4xx/5xx only.
-   **Dialog Accessibility**: All `DialogContent` components have matching `DialogDescription` (sr-only where no visible description needed).
-   **TypeScript**: Zero compilation errors across entire codebase.

### System Dependencies
-   **ffmpeg**: Essential for server-side audio format conversion.