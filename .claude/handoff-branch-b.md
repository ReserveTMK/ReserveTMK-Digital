---
session_date: 2026-04-06
branch: branch-b
status: in-progress
---

# Handoff

## Main Line: AI Update with TY workshop (14 Apr) — end-to-end
1. [x] Programme exists in system
2. [x] Registration link works — `/register/ai-update-with-ty`
3. [x] Registration form + confirmation email
4. [x] Auto-reminder fires before event (built `runProgrammeReminderAutoSend`)
5. [ ] Workshop description on registration page — needs Ra's input on content
6. [ ] Ship to production — commit + push auto-reminder code

## Tangents (parked)
- Wix event page linking to registration
- Social media post / outreach email to Māori orgs
- Date confirmed: 14 Apr (DB stores as 13 Apr UTC = 14 Apr NZST)

## Decisions
- Programme auto-reminders fire 24hrs before start, 8am floor, 30min check interval
- Same pattern as booking reminders (`autoReminderSent` flag on programmes table)
- Pricing tier is derived from agreement status, not independent

## Schema changes (not yet shipped)
- `auto_reminder_sent` boolean + `auto_reminder_sent_at` timestamp added to programmes table
- DB migration already applied to Neon

## Needs testing
- Registration flow: `/register/ai-update-with-ty` end-to-end
- Auto-reminder timing logic
