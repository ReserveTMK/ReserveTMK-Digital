---
name: size-check
description: Estimate the size of a task before starting — tokens, files, risk, time
user_invocable: true
---

Before starting any non-trivial task, estimate the cost and communicate it to Ra.

## When to run
- Ra asks "how big is this?"
- Ra says `/size-check [task description]`
- Before any task that will touch 5+ files or require significant research

## How to estimate

1. **Scope the work** — what files need reading, what needs changing, what needs verifying
2. **Count the units:**
   - Files to read: ~1-2k tokens each (small), ~5-10k (large)
   - Files to write/edit: ~2-3k tokens each (including read + edit)
   - Research/grep/exploration: ~3-5k tokens per round
   - Agent calls: ~10-15k tokens each
   - Skill runs: ~5-10k tokens each
3. **Assess risk:**
   - Low: file moves, memory updates, new files, UI tweaks
   - Medium: route changes, schema additions, multi-file refactors
   - High: schema migrations, data changes, anything touching reporting chain

## Output format

```
SIZE CHECK: {task name}
========================
Tokens: ~{n}k ({percentage}% of session)
Files: {n} read, {n} changed
Risk: {Low/Medium/High} — {why}
Approach: {1-2 sentences}
```

Assume a session budget of ~250k usable tokens. Express percentage accordingly.

## Rules
- Be honest. Round up, not down.
- If a task is >50% of session, flag it: "This is a big one — want to commit a full session?"
- If a task is <5% of session, just say "Small — doing it now" and proceed.
- Don't over-think the estimate. 30 seconds, not 5 minutes.
