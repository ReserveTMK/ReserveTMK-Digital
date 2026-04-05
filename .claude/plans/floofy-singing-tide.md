# Portal Booking Gaps — Rehekōrero "Unknown" Booking

## Context
Ra spotted an "Unknown" booking on the Spaces calendar for Tue 7 April. It's a Rehekōrero hui booked via the portal. The booking IS correctly linked to group 61 and MOU 3, and an admin email WAS sent to kiaora@. The display bug and a minor data gap are the only issues.

## Fixes

### Fix 1: Display fallback (already done, needs push)
Calendar components now use `displayName` from the API (which falls back: group name → org name → booker name → classification).

- `client/src/components/spaces/space-use-tab.tsx` — `getItemName()` uses `displayName`
- `client/src/components/calendar/BookingCalendarCard.tsx` — booker line uses full fallback chain

### Fix 2: Make "Your Name" required for group link bookings
Group links let multiple people from the same org book. Currently "Your Name" is optional — should be required so we always know who specifically booked.

- `client/src/pages/booker-portal.tsx` ~line 2868 — change label from "Your Name (optional)" to "Your Name"
- `client/src/pages/booker-portal.tsx` ~line 1926 — add validation: if `isGroupLink`, require `bookerName`

### Fix 3: Backfill Rehekōrero booker data (DB write — needs Ra's OK)
Regular booker id 4 (Rehekōrero) has `contact_id: null` and `login_email: null`. Need Ra to confirm who the contact person is, then update the record.

## Files to modify
- `client/src/components/spaces/space-use-tab.tsx` — already edited
- `client/src/components/calendar/BookingCalendarCard.tsx` — already edited  
- `client/src/pages/booker-portal.tsx` — make name required for group links

## Verification
- Spaces calendar shows "Rehekōrero" instead of "Unknown" for the Apr 7 booking
- Portal group link form requires name before submitting
