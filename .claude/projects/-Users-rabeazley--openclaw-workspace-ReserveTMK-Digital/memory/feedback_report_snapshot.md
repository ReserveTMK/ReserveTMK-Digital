---
name: Report snapshot protocol
description: When reports are submitted early or late, numbers must be frozen from the generated version — not re-pulled from live data
type: feedback
---

When a funder report is generated early (before period end) or late (after), the submitted numbers must be treated as the snapshot. If the report needs to be referenced later, carry the numbers from the last generated version — don't regenerate from live data, which will have drifted.

**Why:** Catriona asked for Q3 Māori Outcomes early (before March 31 2026). If someone regenerates later, the numbers would change. The submitted version is the record of truth for that reporting period.

**How to apply:** Platform needs a "submitted" or "locked" state for reports. Until that's built, the protocol is: once a report is sent to a funder, that version's numbers are final for that period. Any future regeneration is a new draft, not a correction. Flag this in the report generation flow.
