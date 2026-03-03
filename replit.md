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
The backend is an Express.js application with Node.js and TypeScript, exposing a RESTful JSON API. Authentication is managed via Replit Auth (OpenID Connect). Text-based AI functionalities (analysis, extraction, chat, enrichment) are powered by Anthropic Claude through Replit AI Integrations. Audio features (speech-to-text, text-to-speech, voice chat) and image generation are handled by OpenAI. Server-side audio processing relies on ffmpeg.

### Database
PostgreSQL is used as the database, integrated with Drizzle ORM. The schema includes tables for users, contacts, interactions, meetings, events, impact logs, taxonomy, programmes, bookings, groups, funders, projects, and reporting data. JSONB columns are used for flexible metric storage.

### Key Design Decisions
1.  **Shared API Contracts**: Zod schemas ensure type safety and consistency.
2.  **Replit Auth Integration**: Streamlines user authentication.
3.  **JSONB for Flexible Metrics**: Allows for schema evolution.
4.  **SSE for Voice Streaming**: Enables real-time audio playback.
5.  **AudioWorklet for Playback**: Provides smooth, low-latency streaming audio.
6.  **Community Lens Filtering**: Implements ethnicity-based audience filtering for reporting.

### Features
-   **Reporting Engine**: Provides comprehensive reports across 9 sections with filtering (community lens, funder profiles) and export options, blending legacy data, offering narrative styles, benchmark insights, community comparison, Tāmaki Ora alignment, and community spend tracking.
-   **Funders Section**: Manages funding relationships, including contact details, key dates, document storage, outcomes frameworks, and reporting profiles.
-   **Scheduling System**: Manages weekly availability for mentors/staff with category tabs (Mentoring / Meeting), integrated with Google Calendar sync.
-   **Public Booking Page**: Pathway-driven booking flow for mentoring or meetings, including dynamic onboarding for new mentees.
-   **Mentoring System**: Full mentoring management hub with three tabs (Sessions, Mentees, Mentors). Sessions tab shows enhanced stats (active mentees, sessions this month, avg sessions/mentee, overdue count) with journey stage distribution badges. Session cards display AI debrief insight scores (mindset/skill/confidence) inline. Mentees tab surfaces mentoring relationships with journey stage stepper (kakano → tipu → ora), overdue tracking, status management (active/on_hold/graduated/ended), and expandable detail panels. Includes pending application review (accept/decline) with auto-relationship creation. Mobile-optimised with dropdown menus for secondary actions. Endpoints: `/api/mentoring-relationships/enriched`, `/api/meetings/debrief-summaries`, `/api/mentoring-applications/:id/accept`.
-   **Journey Framework**: Tracks culturally-grounded Maori stage progression (kakano → tipu → ora) with visual stepper component and venture types. Journey stages visible on both contact detail and mentoring pages.
-   **NZ Timezone Standardization**: All date and time calculations are standardized to Pacific/Auckland timezone.
-   **Community Member Management**: Automates classification of community members based on engagement signals, with AI relationship scoring.
-   **Projects**: Tracks internal initiatives with AI-powered task extraction (using Claude Sonnet) from voice debriefs or text input. Supports two project types: Operational and Delivery.
-   **Venue Hire System**: Manages venue bookings with automated workflows, enhanced confirmation emails, inline conflict checking, smart post-booking surveys, and management of regular bookers with pricing tiers and agreement linking.
-   **Regular Booker Portal**: Self-service portal for regular bookers with magic link authentication, showing package status, upcoming bookings, and a booking flow with calendar view.
-   **After-Hours Auto-Send**: Detects bookings outside staffed operating hours and automatically sends venue instruction reminder emails with configurable settings.
-   **Xero Integration**: OAuth2 connection to Xero accounting for automated invoice generation upon booking acceptance, including contact sync and invoice status tracking.
-   **UI Terminology**: Uses "People" for contacts, 12-hour time format (AM/PM), and removes consent features from contact details.

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

### System Dependencies
-   **ffmpeg**: Essential for server-side audio format conversion.