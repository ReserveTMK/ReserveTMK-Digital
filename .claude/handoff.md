---
session_date: 2026-03-31
status: clean-stop
---

# Session Handoff

## What we were building
- Calendar audit → dedup fixes → card visual states → bookers nav → displayName on bookings
- Funder profile population → deliverables + taxonomy for all 4 funders
- Scoped funder page redesign (not built yet)

## What's done (code — shipped)
- **Calendar dedup + card states + archive rename**: `3e55baa`
- **Bookers standalone nav item under Delivery**: `7e6cfa5`
- **Server-side displayName on bookings API**: `2889b4a` — group name → org name → booker name → classification
- **Delivery branch merged**: `c15cb27`

## What's done (DB — no code changes)
- **4 booking GCal backfills**: bookings 12, 13, 15, 16 linked to their GCal event IDs
- **Funder profiles filled**: Ngā Mātārae (ID 4), EDO (ID 5), Foundation North (ID 6) — contacts, dates, outcome focus, reporting guidance, partnership strategy
- **TRC CLC created**: ID 10, status=completed, fit_tags=['one-off','project-fund']
- **6 duplicate funders deleted**: IDs 1-3, 7-9 (wrong user_id)
- **Ngā Mātārae value fixed**: $200k/yr (was $600k — that's total contract)
- **22 deliverables populated**: NM=7, EDO=9, FN=3, TRC=3
- **17 taxonomy categories populated**: NM=5, EDO=6, FN=3, TRC=3

## What's still open

### Funder page redesign (Phase 1) — READY TO BUILD on main
- **Tabs**: Core | Projects | Completed (grouped by status within each)
- **Card: contract progress**: "Month 9 of 12" or "Year 2 of 3" with progress bar
- **Card: financials**: Total value / annual value / quarterly value
- **Schema: `total_contract_value`**: New field — agreement total. `estimated_value` = annual. Calculated fields: contract length, year X of Y
- **Reporting deadlines**: Remove from funder cards, move to reporting section
- **`funder_type` or fit_tags**: Distinguish core vs project funders for tab filtering
- Touches: schema.ts, funders.tsx (heavy), routes.ts (migration), possibly reporting page

### Fund writing module (Phase 2) — SCOPED NOT BUILT
- Application workspace for pipeline funders
- Template, draft editor, budget builder, attachments, status tracking
- Lives in Pipeline tab within funders
- Separate session

### Public holidays feature — SCOPED NOT BUILT
- `is_public_holiday` boolean on events table
- Calendar sync auto-flag, calendar visuals (rose tint), booking/mentoring blocking
- Both worktree slots still taken

## Worktrees
- delivery: `77e775e` — merged to main at c15cb27, can be cleaned up
- tracking: `2bcdfe9` — previously merged, can be cleaned up

## Decisions Ra made
- Funder tabs: Core | Projects | Completed (not 5 tabs)
- No hard KPI targets — show growth and impact, trend not targets
- Exception: Catriona needs historical numbers trending up — period-over-period comparison is the evidence base
- Contract length, total value, annual value are important — must show on funder cards
- Tautai is NOT a funder (RTM was contracted by them). TRC CLC is a one-off project fund, not ongoing.
- Fund writing module belongs in pipeline — Phase 2
- Build funder redesign on main
- displayName should always use org name for venue hire, everywhere

## Uncommitted work
None — clean.

## Next session should
1. Build funder page redesign (Phase 1): tabs + contract progress + financials + schema change
2. Clean up worktrees (both mergeable)
3. Update /funder-pulse skill to use trend arrows not RAG targets
