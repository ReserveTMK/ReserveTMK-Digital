# Delivery Features — Architecture & Gap Analysis
_Last updated: 2026-03-23_

## The Four Delivery Features
Mentoring | Spaces (Venue Hire) | Gear | Programmes

Each has:
- Self-serve path (booker/participant-facing)
- Admin path (Ra/Kim-facing)
- Management UI

---

## Data → Reporting Chain

```
Day-to-day
├── Bookings (portal or admin)        → space use, community hours
├── Meetings logged                   → mentoring sessions, partner meetings
├── Events + attendance               → event counts, attendees
├── Interactions (emails/calls)       → touchpoints, people reached
├── Programmes + registrations        → programme delivery, attendees
└── Contact stage movements           → journey progression

During/after activities
├── Debriefs created + CONFIRMED      → impact, taxonomy tags, quotes
├── Contact journey updates           → promoted to Community/Innovator
└── Community spend logged            → $ flowing through community

Monthly (Reconciling)
├── Daily foot traffic entered        → Kim's camera review
├── Unplanned activations added       → admin backfill
└── Month confirmed complete

Quarterly
└── Report generator pulls everything
    across the 3-month date range
```

---

## Confirmed Gaps to Build

### Spaces
- [ ] **Quick-add unplanned activation** — fast admin shortcut, anytime (not wizard-gated). Fields: date, space, classification, headcount, duration. Creates booking with `booking_source = "admin_catch_up"`
- [ ] **Recurring bookings** — admin-managed, no booker involvement. Set once, auto-generates on schedule
- [ ] **Monthly Reconciling UI** — structured monthly health check: foot traffic grid + backfill unplanned use + check unconfirmed debriefs + confirm month complete

### Gear
- [ ] **Approval workflow UI** — `requiresApproval` flag exists but no approve/deny admin screen
- [ ] **Maintenance / condition tracking** — gear condition log, service history
- [ ] **Usage history per item** — for reporting and asset management

### Programmes
- [ ] **Wire `attended` → `programmes.attendees`** — `programme_registrations.attended` boolean not synced to the array the report actually reads. Backend fix: when attended=true, add contactId to `programmes.attendees`
- [ ] **Walk-in attendance** — currently must be pre-registered to appear on roll. Need ability to add unregistered attendees on the day
- [ ] **Session-by-session attendance** — multi-session programmes have one overall `attended` flag. Need per-session roll call
- [ ] **Debrief linkage** — ensure programme debriefs are consistently linked back to the programme record

### Mentoring
- [ ] **Group mentoring / cohort support** — currently 1:1 only, no group session model
- [ ] **Attendance → report wire-up** — same pattern as programmes, verify sessions feed report correctly

---

## Platform-Level Gaps to Build

### Comms / Notifications ❌
No outbound comms centre. Currently handled outside the platform (Gmail etc).
- Message a cohort, programme group, or all active bookers from within RTMD
- Triggered comms (post-session, post-booking, post-registration)
- Notification preferences per contact

### Waitlist ❌
`waitlisted` status exists on registrations but no workflow:
- No auto-promote when someone cancels
- No notify-when-spot-opens
- No waitlist management UI

### Consent Management ❌
Consent records exist but no audit view:
- Who's consented / pending / withdrawn across whole community
- Consent audit trail for funder reporting
- Bulk consent status view

### Booking / Programme Lifecycle Comms ❌
Confirmation + reminder emails exist but:
- No post-session follow-up automation
- No post-booking check-in
- Nothing prompts next step unless manually triggered

---

## Other Identified Gaps (lower priority)

- **Unified activity feed** — no single "everything this week" view across all four features
- **Recurring programmes / cohorts** — programmes are one-off, no auto-generating series
- **Xero scope** — invoicing exists for venue hire, unclear if it covers gear hire or programme fees
- **Milestones disconnected** — `/milestones` exists but not surfaced in Delivery or Tracking nav
- **Contact engagement timeline** — no single view of a contact's full journey across all four features (programmes attended, mentoring sessions, space hires, gear borrowed). Critical for demonstrating depth of engagement in reports.

---

## Comms & Storytelling — New Module (/comms)

**Decision: Build internal** (not Mailchimp)
- Storytelling pulls directly from debriefs, quotes, milestones — no external tool can do this
- Audience segments drawn from live RTMD data — no export/import lag
- Consent stays in one place, unsubscribes update contact record immediately
- Resend infrastructure already exists — cost negligible at current scale
- Mailchimp available as CSV escape valve for large campaigns if ever needed
- Scale check: revisit deliverability setup if list exceeds ~2,000 contacts

### Three tabs
- **Stories** — community spotlights, pull from debriefs/milestones/quotes, draft/published, link to contact
- **Newsletters** — rich text compose, embed stories, audience segment picker, schedule/send, history, 2-3 branded templates
- **Announcements** — fast one-off sends, target by group/programme/all, preview, history

### Audience layer
- `newsletter_optin` consent flag already exists on contacts
- Consent captured at public registration (exists)
- Segments by: stage, group, programme, opt-in status
- Saved segments for reuse
- Unsubscribe auto-updates contact record
- Bounce handling flags contact

### NOT building
Drag-and-drop builder · A/B testing · click heatmaps · advanced analytics

## Notes
- Report only counts debriefs with `status = "confirmed"` — drafts invisible to reporting
- `booking_source` values: internal, public_link, calendar_import, manual, regular_booker_portal, casual, admin_catch_up (proposed)
- Foot traffic: prefers `daily_foot_traffic` table, falls back to legacy `monthly_snapshots.foot_traffic`
- Contact stage movements (`movedToCommunityAt`, `movedToInnovatorsAt`) must happen in real-time — can't be backfilled accurately
