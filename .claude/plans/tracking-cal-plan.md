# Tracking Calendar — Unified Delivery Flow

## Current State

The tracking calendar should show everything that happens at Reserve Tāmaki. Currently it's fragmented — some delivery channels create events, some don't, and the ones that do use different card components.

### Data audit (April 2026):

| Source | Records | On calendar? | Linked to events? | Card type |
|--------|---------|-------------|-------------------|-----------|
| **Venue hire bookings** | 6 confirmed/completed | Yes | 6/6 linked ✓ | BookingCalendarCard |
| **Programmes** | 8 total | Partial | 1/8 linked (backfill not run) | EventCard |
| **Mentoring sessions** | 4 total | Partial | 2/4 have GCal ID (no event link) | EventCard (via GCal sync) |
| **Gear bookings** | 0 | No — no event creation | N/A | N/A |
| **Desk bookings** | 0 | No — no event creation | N/A | N/A |
| **GCal sync** | 25 events | Yes | N/A (source=google) | EventCard |
| **Manual logs** | 64 events | Yes | N/A (source=internal) | EventCard |

### Problems:
1. **7 programmes have no calendar events** — backfill not run
2. **Mentoring sessions have no `linkedMeetingId`** on events table — can't trace back
3. **Gear and desk bookings don't create events** — invisible on calendar
4. **Two card components** — BookingCalendarCard vs EventCard look different
5. **No universal "View source" button** — can't navigate from calendar card to source record

---

## Build Plan — Phased

### Phase 1: Fix what exists (small, do first)

**1a. Run programme backfill**
- Call POST /api/programmes/backfill-events
- Creates events for 7 programmes missing them
- Already built, just needs running

**1b. Add `linkedMeetingId` to events table**
- Schema: add `linkedMeetingId: integer("linked_meeting_id")` to events table
- DB: `ALTER TABLE events ADD COLUMN linked_meeting_id INTEGER`
- Wire: when a mentoring meeting creates a GCal event, also create/link a platform event with `linkedMeetingId`
- Backfill: for the 2 meetings that have `googleCalendarEventId`, find the matching event and set `linkedMeetingId`

**1c. Uniform card component**
- One card component for ALL events regardless of source
- Reads source from which linked ID is populated:
  - `linkedBookingId` → source = booking
  - `linkedProgrammeId` → source = programme
  - `linkedMeetingId` → source = mentoring
  - `source = 'google'` + no links → source = gcal
  - `source = 'internal'` + no links → source = manual
- Same layout for all:
  - **Collapsed:** Title + Type badge + Time + Debrief status (spinner for in-progress)
  - **Expanded:** Event Type dropdown, Space Use dropdown, Community Members, Save/Archive
  - **Source button:** "View Booking" / "View Programme" / "View Session" — only shows when source link exists
- Kill BookingCalendarCard — everything goes through one component

**Files:**
- `shared/schema.ts` — add linkedMeetingId
- `server/routes.ts` — wire meeting creation to create linked event
- `client/src/pages/calendar.tsx` — replace BookingCalendarCard, unify EventCard

---

### Phase 2: Add missing channels (medium, after Phase 1)

**2a. Gear bookings → calendar events**
- When a gear booking is created, create a linked event: `ensureGearBookingEvent()`
- Add `linkedGearBookingId: integer("linked_gear_booking_id")` to events table
- Card shows "View Gear Booking" button
- Currently 0 gear bookings exist so this is future-proofing

**2b. Desk bookings → calendar events**
- Same pattern: `ensureDeskBookingEvent()`
- Add `linkedDeskBookingId: integer("linked_desk_booking_id")` to events table
- Currently 0 desk bookings exist — also future-proofing

**2c. Mentoring backfill**
- For existing 4 meetings, create events where missing and link them
- Wire `POST /api/meetings` to always create a linked event (not just GCal)

---

### Phase 3: Calendar as the single source of truth (longer term)

Once all delivery channels create events:
- Calendar shows everything — no gaps
- Every card traces back to its source
- Reporting can use events table as the unified activity log
- Debrief flow works uniformly — every event is debriefable
- Monthly reconciliation = scan the calendar, everything accounted for

---

## Build Order

| Order | What | Effort | Dependency |
|-------|------|--------|------------|
| 1 | Run programme backfill | 1 min | None |
| 2 | Uniform card component | 2-3 hrs | None |
| 3 | Add linkedMeetingId + wire mentoring | 1 hr | None |
| 4 | Backfill mentoring events | 30 min | #3 |
| 5 | Gear booking → events | 1 hr | #2 |
| 6 | Desk booking → events | 1 hr | #2 |

**Phase 1 (#1-4) is the priority.** Phase 2 (#5-6) can wait until gear/desk bookings are actually being used.

---

## Key Decisions Needed

1. **Gear on calendar — yes or no?** Currently 0 gear bookings. Build the link now or wait until gear is actively used?
2. **Desk on calendar — yes or no?** Same — 0 desk bookings.
3. **Debrief status on cards — spinner or text?** Ra wants a loading spinner instead of "In progress" text.
4. **Do we keep the separate BookingCalendarCard or kill it entirely?** Recommendation: kill it, one component.
