---
session_date: 2026-04-06
branch: branch-a
status: clean-stop
---

# Handoff

## Decisions
- Personal vs business memory split — personal at `~/.claude/personal/memory/`, business in project memory, cross-ref pointers each way
- Memory principle: platform holds facts, memory holds meaning. If queryable from Neon, don't store in memory.
- Self-challenge behaviour adopted — Claude flags assumptions/risks before presenting

## Parked
- `/social-post` skill — photo cull + caption drafting + export specs for Kim
- Fix Gmail MCP auth — 4 accounts configured but OAuth never completed
- Beazleys family trust — save to personal memory when Ra gives details
- Lightroom preset workflow for socials
- Skills merge (9 skills to absorb into others) — list ready, not executed
- Time-based trigger skills — Ra doesn't use them, discuss which to cut
- Funder reports round 2-4 (due soon alerts, financial tracking, application workspace, relationship timeline)
- `is_rangatahi` flag false on all contacts — rangatahi deliverables show 0
- Contacts deliverable query: "created in period" vs "total to date" — undecided

## Needs testing
- Funder reports consolidation: "Generate Report" from funder card → funder profile Reports tab

## Context code won't tell you
- Memory restructured this session: 8 pruned, 15 consolidated into 5, index 144→120 lines
- Secret scanning added as check #1 in `/pre-push` (14 checks total now)
- Reddit scan completed (10 posts) — two items actioned, rest validated existing approach
- Standalone /reports route removed but reports.tsx kept — funder-detail.tsx imports from it
- DB updated directly (10 deliverable filter records) — not in migration
