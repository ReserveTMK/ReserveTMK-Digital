---
name: Check side effects before changing
description: Before making a change, trace what else depends on the thing being changed — don't break other features
type: feedback
---

Before changing anything, check what else depends on it. Trace the impact before editing.

**Why:** Platform features are interconnected — moving a component, renaming a route, changing a data shape, or altering a query can silently break another page, hook, or reporting pipeline. Ra got burned by changes that looked isolated but had downstream effects.

**How to apply:** Before making a change, grep for all consumers of the thing being changed (component imports, API endpoint callers, query key references, shared state). If the change touches a route, check nav items, redirects, and any hardcoded links. If it touches a DB column or API response shape, check every frontend consumer. Flag any side effects to Ra before proceeding.
