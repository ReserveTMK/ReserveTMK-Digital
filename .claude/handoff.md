---
session_date: 2026-04-05
branch: main
status: clean-stop
---

# Handoff

## Needs testing
- Hit Recalculate on Community → Ecosystem page — first run will compute connection strengths for all 809 contacts and 323 groups
- Check the distribution makes sense — thresholds are tunable constants in server/community-automation.ts if too many land at woven or too few move past aware
- Verify Org Health cards (Total/Active/Dormant/At-Risk) show sensible numbers
- Check that groups now appear in Needs Attention and Woven sections alongside contacts

## Parked
- Connection strength preview endpoint exists (GET /api/community/connection-strength/preview) but no UI — dry-run available via API if Ra wants to check before applying
- Pre-push hook flags all pre-existing TS errors in routes.ts whenever routes.ts is in the diff — needs the hook updated to only match new errors

## Context code won't tell you
- Ra audited the full People → Groups → Ecosystem flow and agreed on the automation model: activity data flows upward automatically, strategic judgments (VIP, relationship stage, group associations) stay manual
- The thresholds (6+ touchpoints/3+ types for woven, 3+/2+ for trusted, etc.) are first pass — may need tuning after seeing real distribution
- Migration 0007 (connection_strength_override) already applied to Neon
