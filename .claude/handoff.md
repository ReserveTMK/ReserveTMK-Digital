---
session_date: 2026-04-02
status: clean-stop
---

# Session Handoff

## What we were building
- Debrief system overhaul — extraction prompt, taxonomy, metrics, UI, downstream wiring
- Access tiers for bookers (public/casual/regular)
- Nav restructure (Access + Capability + merged Tracking/Reporting)
- Ecosystem operator model exploration (commercialising the platform)
- Funder profile split (general vs org-specific)

## What's done (all shipped)
- **Nav restructure:** Delivery → Access + Capability. Reporting merged into Tracking. Funders top-level. Projects + DOM → Settings.
- **Access tiers:** tier + inductedAt on regular_bookers. Form UI with smart defaults. Portal enforcement (public needs induction, bookings need approval).
- **Debrief extraction cleanup:** Removed 5 dead fields (communityActions, operationalActions, actionItems, placesIdentified, economicActivity). Cleaned 65 existing debriefs + 27 orphaned action items.
- **Taxonomy overhaul:** 65 duplicate categories → 8 clean ones with signal banks (Capability Growth, Venture Progress, Rangatahi Development, Ecosystem Connections, Space Activation, Content & Creative, Wellbeing & Resilience, Leadership & Advocacy). 298 tags remapped.
- **Metrics overhaul:** 9 fields → 6 (mindset, skill, confidence, businessReadiness, networkStrength, resilience). Rubric 1-10 added to prompt. Previous scores as context. Metric snapshots now save on confirm (was 0 rows).
- **Extraction improvements:** primaryEntity field (person or group). Fuzzy contact matching. Max 4 impact tags.
- **Debrief UI:** Sentiment → title badge. Impact Highlights primary view (transcript behind View Transcript button). Dead sections removed.
- **Report wiring:** Key quotes auto-populate from debriefs. Operator insights (wins/concerns/learnings) in branded reports.
- **Contact profiles:** Wins from debrief reflections now surface on contact journey page.
- **Learnings absorbed:** 179 operator learnings from 64 debriefs → memory file.
- **Funder profiles split:** General profiles (shareable) created for EDO, Māori Outcomes, FN, TRC, TPK, Creative NZ. FN enriched with web research + insider knowledge.
- **Ecosystem operator model:** Scoped as Model 3 (operate). Saved to memory.

## What's still open
- **Bulk re-extraction:** 64 confirmed debriefs need re-running through new prompt (cleaner taxonomy, better metrics, primaryEntity). Ra wants to finish refining first. Decision needed: keep confirmed status or force re-review?
- **Risk register:** Concerns from debriefs → visible risk register. Parked for separate branch.
- **"Tentative:" prefix stripping** from debrief titles imported from GCal. Not built.
- **Reports still 500-ing** — carried from prior sessions. change_type and il.notes fixes shipped but not verified.
- **Programme backfill:** POST /api/programmes/backfill-events still needs to be called.
- **Calendar uniform cards:** Shipped but not verified live.
- **Duplicate groupId in funders schema** — build error from prior session, needs fixing.
- **Duplicate email variable** in server/routes/bookings.ts:1897-1898 — build error.

## Worktrees
- main: clean, up to date (66bf64c)
- branch-a (delivery): parked, behind main
- branch-b (reporting): clean, up to date with main

## Decisions Ra made
- **Taxonomy:** 8 categories with signal banks. Max 4 tags per debrief.
- **Metrics:** 6 fields with rubric. AI scores only evidenced metrics (null for rest). Previous scores as baseline.
- **Primary entity:** Can be person OR group. AI deduces from title + transcript.
- **Debrief view:** Impact Highlights primary, transcript behind View. Sentiment as badge. Dead sections fully removed not hidden.
- **Wins path:** → contact journey profiles + reports. No action items (Ra never goes back to them).
- **Concerns path:** → risk register (future). Shows partnership capacity to funders.
- **Learnings path:** → Claude Code memory. No UI needed.
- **Access tiers:** Public (vetted, inducted, approval needed), Casual (limits, free/koha), Regular (agreement-based).
- **Ecosystem operator:** Model 3 — Ra operates the measurement layer, not software sales.
- **Funder profiles:** Split general (shareable) from org-specific. FN board decides, stack priorities.

## Uncommitted work
None.

## Next session should
1. **Fix build errors** — duplicate groupId in funders schema, duplicate email in bookings.ts
2. **Verify reports work** — Tracking page + Funder Reports
3. **Run programme backfill** — POST /api/programmes/backfill-events
4. **Test new debrief extraction** — create a test debrief to verify new taxonomy, metrics, primaryEntity
5. **Bulk re-extract** when ready — decide on confirmed status handling first
