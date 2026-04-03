---
session_date: 2026-04-03
status: clean-stop
---

# Session Handoff

## What we were building
Massive session across multiple areas: debrief system overhaul, calendar unification, access tiers, nav restructure, taxonomy/metrics rework, ecosystem operator model, funder profile split.

## What's done (all shipped)

### Calendar Unification (5 phases)
- Phase 1: Dashboard reads events only — removed meetings/bookings/programmes hooks (-93 lines)
- Phase 2: Added venueId to events schema + updated ensure functions + backfilled
- Phase 3: Calendar reads events only — removed BookingCalendarCard, space items, multi-source merge (-682 lines)
- Phase 4: Spaces calendar reads events instead of bookings/meetings (-18 lines)
- Phase 5: Cleanup — removed ViewMeetingDialog, dead imports (-81 lines)
- Total: ~868 lines removed. Events table is single source of truth for all 4 calendar views.

### ensureMeetingEvent
- Meetings now auto-create calendar events like bookings/programmes
- Links via linkedMeetingId, GCal dedup, backfill endpoint
- Wired into monolith routes (module not registered yet)

### Debrief Extraction Overhaul
- Removed 5 dead fields from prompt (communityActions, operationalActions, actionItems, placesIdentified, economicActivity)
- Cleaned 65 existing debriefs + 27 orphaned action items from DB
- Removed Community Actions, Operational Actions, Funder Tags sections from review UI

### Taxonomy
- 65 duplicate categories → 8 with signal banks (Capability Growth, Venture Progress, Rangatahi Development, Ecosystem Connections, Space Activation, Content & Creative, Wellbeing & Resilience, Leadership & Advocacy)
- 298 tags remapped, zero data lost

### Metrics
- 9 fields → 6 (mindset, skill, confidence, businessReadiness, networkStrength, resilience)
- Scoring rubric 1-10 added to prompt
- Previous scores as context for relative scoring
- Metric snapshots now save on confirm (was 0 rows)

### Extraction Improvements
- primaryEntity field (person or group, auto-detected from title + transcript)
- Fuzzy contact matching (Coach Manuel → Manuel Walker)
- Max 4 impact tags per debrief

### Debrief UI
- Sentiment → title badge
- Impact Highlights primary view (transcript behind View Transcript button)
- Dead sections removed

### Report Wiring
- Key quotes auto-populate from debriefs (no more manual typing)
- Operator insights (wins/concerns/learnings) in branded monthly + quarterly reports

### Contact Profiles
- Wins from debrief reflections surface on contact journey page

### Learnings
- 179 operator learnings from 64 debriefs absorbed to memory

### Access Tiers
- tier + inductedAt on regular_bookers
- Public/Casual/Regular with smart defaults
- Portal enforcement (induction gate, approval rules)

### Nav Restructure
- Delivery → Access + Capability
- Reporting merged into Tracking
- Funders top-level
- Projects + DOM → Settings

### Funder Profiles
- Split general (shareable) from org-specific
- FN enriched with web research + insider knowledge (board process, priority stacking)

### Ecosystem Operator Model
- Model 3 (operate) scoped and saved to memory

## What's still open
- **Bulk re-extraction** — 64 debriefs need re-running through new prompt. Ra wants to finish refining first.
- **Risk register** — concerns from debriefs → visible register. Parked for separate branch.
- **Build errors from prior sessions** — duplicate groupId in funders schema, duplicate email in bookings.ts
- **Reports still unverified** — Tracking + Funder Reports may still 500
- **"Tentative:" prefix stripping** from GCal-imported debrief titles

## Worktrees
- main: clean (a8eb7ea)
- branch-a (delivery): behind main, has route splitting work
- branch-b (reporting): clean, up to date with main

## Decisions Ra made
- Events table is single source of truth for all calendars
- Taxonomy: 8 categories, max 4 tags per debrief
- Metrics: 6 fields, rubric, null for unevidenced
- Primary entity: person OR group, AI deduces
- Debrief view: highlights primary, transcript behind button
- Wins → contact profiles, concerns → risk register (future), learnings → Claude memory
- Access tiers: public needs induction, casual has limits, regular per agreement
- Ecosystem operator: Model 3, validate by doing one report for GI Eagles manually
- Funder profiles: general profiles shareable, FN board decides based on priority stacking

## Uncommitted work
None.

## Next session should
1. Verify calendar views work end-to-end after unification
2. Fix build errors (duplicate groupId, duplicate email)
3. Test new debrief extraction (create a test debrief)
4. Verify reports load
