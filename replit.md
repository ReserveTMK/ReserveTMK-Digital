# ReserveTMK

## Overview
ReserveTMK is a full-stack web application designed to track and manage mentorship relationships, focusing on measuring mentee growth. It provides tools for contact management, logging interactions, and using AI to analyze conversation transcripts for insights into mindset, skill, and confidence. Key features include voice recording, AI analysis, trend visualization, comprehensive reporting, Google Calendar integration, and a mobile-friendly PWA. The project aims to deliver detailed insights into engagement, delivery, and impact for mentorship organizations and individuals, with a robust reporting engine covering various metrics and alignment with conditional Tāmaki Ora principles.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Overall Structure
The project utilizes a monorepo approach, separating concerns into `client/` (React frontend), `server/` (Express.js backend), and `shared/` (shared types, schemas, and API contracts).

### Frontend Architecture
The frontend is built with React and TypeScript using Vite. It employs Wouter for routing, TanStack React Query for state management, and shadcn/ui for UI components, styled with Tailwind CSS. Data visualizations are handled by Recharts, and the application functions as a PWA with mobile-first navigation.

### Backend Architecture
The backend is an Express.js application developed with Node.js and TypeScript, exposing a RESTful JSON API. Authentication is managed via Replit Auth (OpenID Connect). Text-based AI functionalities, such as analysis, extraction, chat, and enrichment, are powered by Anthropic Claude through Replit AI Integrations. Audio features (speech-to-text, text-to-speech, voice chat) and image generation are handled by OpenAI. Server-side audio processing relies on ffmpeg.

### Database
PostgreSQL is used as the database, integrated with Drizzle ORM. The schema includes tables for users, contacts, interactions, meetings, events, impact logs, taxonomy, programmes, bookings, groups, funders, funder documents, and reporting data. JSONB columns are leveraged for flexible metric storage.

### Key Design Decisions
1.  **Shared API Contracts**: Zod schemas ensure type safety and consistency across both frontend and backend.
2.  **Replit Auth Integration**: Streamlines user authentication using Replit's OIDC capabilities.
3.  **JSONB for Flexible Metrics**: Allows for schema evolution without extensive database migrations.
4.  **SSE for Voice Streaming**: Enables real-time audio playback.
5.  **AudioWorklet for Playback**: Provides smooth, low-latency streaming audio performance.
6.  **Community Lens Filtering**: Implements ethnicity-based audience filtering for reporting, based on contact ethnicity arrays.

### Features
-   **Reporting Engine**: Provides comprehensive reports across 9 sections with a unified toolbar for filtering (community lens, funder profiles) and export options. It blends legacy data, offers two narrative styles (compliance/story), benchmark insights, community comparison, Tāmaki Ora alignment, and community spend tracking.
-   **Funders Section**: Manages funding relationships, including contact details, key dates, document storage (Base64), outcomes frameworks, and reporting profiles to drive report generation.
-   **Community Lens**: Filters report metrics by specific ethnic groups: Māori, Pasifika, or a combination of both.
-   **Funder Profiles**: Pre-configures report settings (community lens, narrative style, priority sections) for quick access.
-   **Scheduling System**: A Calendly-like tool for managing availability, meeting types, and booking links for various meeting purposes, integrated with Google Calendar sync.
-   **Public Booking Page**: A public-facing interface allowing external users to book time, designed to be mobile-first and branded.
-   **Mentoring System**: Manages 1:1 mentoring sessions, leveraging the scheduling system for availability. It includes session lifecycle management, debrief logging with AI analysis, co-mentor support, and integration with Google Calendar.
-   **NZ Timezone Standardization**: All date and time calculations are standardized to Pacific/Auckland timezone with Monday-start weeks.
-   **Community Member Management**: Automates classification of community members based on engagement signals, with AI relationship scoring and last active date tracking.

## External Dependencies

### Required Services
-   **PostgreSQL Database**: Primary data persistence.
-   **Anthropic Claude API** (via Replit AI Integrations): Utilized for text-based AI features such as interaction analysis, impact extraction, and AI chat.
-   **OpenAI API** (via Replit AI Integrations): Used for audio functionalities (speech-to-text, text-to-speech, voice chat) and image generation.
-   **Replit Auth (OIDC)**: Handles user authentication and authorization.

### AI Model Mapping
-   **claude-sonnet-4-6**: For interaction analysis, impact extraction, and AI chat.
-   **claude-haiku-4-5**: For organisation enrichment, legacy report extraction, taxonomy scanning, and Gmail domain mapping.
-   **OpenAI (gpt-4o-mini-transcribe)**: For speech-to-text transcription.
-   **OpenAI (gpt-audio)**: For voice chat and text-to-speech.
-   **OpenAI (gpt-image-1)**: For image generation.

### System Dependencies
-   **ffmpeg**: Essential for server-side audio format conversion.