# ReserveTMK

## Overview
ReserveTMK is a full-stack web application designed to track and manage mentorship relationships, focusing on measuring mentee growth. It provides tools for contact management, logging interactions, and using AI to analyze conversation transcripts for insights into mindset, skill, and confidence. Key capabilities include voice recording, AI analysis, trend visualization, comprehensive reporting aligned with conditional Tāmaki Ora principles, Google Calendar integration, and a mobile-friendly PWA. The project aims to deliver detailed insights into engagement, delivery, and impact for mentorship organizations and individuals.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Overall Structure
The project utilizes a monorepo approach with `client/` (React frontend), `server/` (Express.js backend), and `shared/` (shared types, schemas, and API contracts).

### Frontend Architecture
The frontend is built with React and TypeScript using Vite, Wouter for routing, TanStack React Query for state management, shadcn/ui for UI components, and Tailwind CSS for styling. Recharts handles data visualizations, and the application functions as a mobile-first PWA.

### Backend Architecture
The backend is an Express.js application with Node.js and TypeScript, exposing a RESTful JSON API. Authentication is managed via Replit Auth (OpenID Connect). Text-based AI functionalities are powered by Anthropic Claude through Replit AI Integrations. Audio features (speech-to-text, text-to-speech, voice chat) and image generation are handled by OpenAI. Server-side audio processing relies on ffmpeg.

### Database
PostgreSQL is used as the database, integrated with Drizzle ORM. The schema includes tables for users, contacts, interactions, meetings, events, impact logs, taxonomy, programmes, bookings, bookable_resources, desk_bookings, gear_bookings, groups, funders (with outcomeFocus and reportingGuidance fields), organisation_profile, projects, and reporting data, utilizing JSONB columns for flexible metric storage.

### Key Design Decisions
1.  **Shared API Contracts**: Zod schemas ensure type safety and consistency.
2.  **Replit Auth Integration**: Streamlines user authentication.
3.  **JSONB for Flexible Metrics**: Allows for schema evolution.
4.  **SSE for Voice Streaming**: Enables real-time audio playback.
5.  **AudioWorklet for Playback**: Provides smooth, low-latency streaming audio.
6.  **Community Lens Filtering**: Implements ethnicity-based audience filtering for reporting.
7.  **NZ Timezone Standardization**: All date and time calculations are standardized to Pacific/Auckland.
8.  **UI Terminology**: Uses "People" for contacts, 12-hour time format, and "Venue Hire" in UI labels.
9.  **Nav Structure**: Top nav groups: Dashboard, Community, Delivery, Tracking, Reporting, Ops, Settings. "Ops" contains Projects, Agreements, Funders. "Settings" contains Availability and About Us. Gmail Import accessed from People page header (not in nav).

### Core Features
-   **Reporting Engine**: Funder-focused reporting across 9 sections, including Reach, Delivery, Impact, and alignment with Tamaki Ora. Supports 9 growth metrics grouped by Personal/Venture/Community, journey stage progression tracking (kakano/tipu/ora), and mentoring focus theme summaries. Includes Cohort Analysis (`/cohort-analysis`) for tracking programme cohorts over time — retention, milestones, stage progressions, growth score changes — with single-cohort and side-by-side comparison views.
-   **Mentoring System**: Comprehensive management with AI debrief insights, journey stage tracking, one-click onboarding from application cards, multi-attendee session creation with Google Calendar sync, inline mentor availability calendar in the Schedule Session dialog, inline session notes (summary + next steps) with "Send to Mentee" email, and mentee cards as full onboarding hubs (editable venture/help-with, why mentoring, stuck on, already tried, focus area picker, frequency dropdown, baseline metrics sliders). Session settings contains only Session Types (onboarding setup removed). Pipeline Kanban view with drag-and-drop status transitions (Discovery/Active/On Hold/Graduated).
-   **Growth Surveys**: Self-assessment surveys sent to mentees via email link. Surveys include 1-10 sliders for 7 growth metrics (Mindset, Skill, Confidence, Business Confidence, Systems, Funding Readiness, Network) plus 3 written reflection questions. Managed from "Growth Surveys" tab in mentoring page and via "Send Growth Survey" button on mentee cards. Public survey page renders slider UI for growth surveys. Completed survey responses automatically update the mentee's contact metrics. Schema reuses `surveys` table with `surveyType: "growth"` and `relatedId` storing the mentoring relationship ID. Key files: `growth-surveys-tab.tsx`, `public-survey.tsx` (SliderInput component), `server/routes.ts` (growth survey routes), `server/email.ts` (sendGrowthSurveyEmail).
-   **Scheduling System**: Manages mentor/staff availability with Google Calendar sync and a public booking page for pathway-driven mentee scheduling.
-   **Calendar as Tracking Hub**: Integrates Google Calendar sync, manual activity logging, and daily/monthly foot traffic input.
-   **Community Structure**: A 4-tier system (All Contacts / Our Community / Our Innovators / VIP) with dynamic filtering, contact roles, and group management.
-   **Debriefs/Impact Tracking**: Queue for events needing debriefs, automated AI analysis of interactions, user review, and action item suggestions.
-   **Spaces Hub**: Unified hub at `/spaces` with 5 tabs: Calendar (venue + desk availability grid), Venue Hire (booking management with kanban/list views), Hot Desking (desk availability cards), Resources (manage venues and desks with sub-tabs, includes default pricing), Bookers (regular bookers filtered to venue hire + hot desking categories). Venue Hire Settings (gear icon) contains: Venue Instructions, After Hours, Survey, Xero. Resource management components extracted to `client/src/components/spaces/resources-tab.tsx`.
-   **Gear Management**: Standalone page with 3 tabs: Availability (equipment status cards + active checkouts + mark-returned flow), Inventory (add/edit/delete gear items), Bookers (regular bookers filtered to gear category). Gear inventory management removed from Spaces Resources tab.
-   **Booking Categories**: Unified framework for Venue Hire, Hot Desking, and Gear Booking, managed via bookable resources and linked agreements. Agreements (Memberships/MOUs) have category checkboxes for Venue Hire, Hot Desking, and Gear.
-   **Regular Booker Portal**: Self-service portal with magic link authentication, showing category-specific usage, subscription status, and booking flows. Regular Bookers page (`regular-bookers.tsx`) supports `embedded` and `categoryScope` props for embedding in Spaces and Gear hubs. Standalone `/regular-bookers` route redirects to `/spaces?tab=bookers`. Sidebar link removed.
-   **Public Programme Registration**: Allows public registration for programmes with auto-generated links and QR codes, with integrated registration management and attendance tracking.
-   **Funder Profile AI Generation**: AI Generate button on funder edit form uses Anthropic Claude to build out the full profile from existing info + uploaded documents. Generates outcome focus areas with indicators, reporting guidance with rhythms, narrative style, priority sections, and a partnership strategy section describing how to deliver and report to the funder. Schema field: `partnershipStrategy` on funders table.

## External Dependencies

### Required Services
-   **PostgreSQL Database**: Primary data persistence.
-   **Anthropic Claude API** (via Replit AI Integrations): Utilized for text-based AI features like interaction analysis and task extraction.
-   **OpenAI API** (via Replit AI Integrations): Used for audio functionalities (speech-to-text, text-to-speech, voice chat) and image generation.
-   **Replit Auth (OIDC)**: Handles user authentication and authorization.
-   **Xero Integration**: OAuth2 connection for automated invoice generation and contact/invoice syncing.
-   **Gmail Sync**: Multi-account Gmail import with filtering and mailing list detection.

### System Dependencies
-   **ffmpeg**: Essential for server-side audio format conversion.