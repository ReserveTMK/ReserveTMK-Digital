---
name: progress
description: Check progress of the current task, phase, or job. Shows what's done, what's next, and how much session is used.
user_invocable: true
---

Show Ra where we're at on the current work.

## When to run
- Ra says `/progress`
- Mid-build when Ra wants a checkpoint
- After returning from a break or context switch

## How to check

1. **Read the task list** — use TaskList to get all tasks
2. **Read the handoff** for this branch (main → `.claude/handoff.md`, branch-a → `.claude/handoff-branch-a.md`)
3. **Count what's done vs what's left**

## Output format

```
PROGRESS: {task/phase name}
========================
✅ {completed item}
✅ {completed item}
🔨 {in progress item} ← you are here
⬜ {pending item}
⬜ {pending item}
========================
{n}/{total} done
```

If there are no tasks tracked, say so:

```
PROGRESS: No active task list
========================
Nothing tracked yet this session.
Want me to break the current work into steps?
```

## Rules
- Keep it short. This is a glance, not a report.
- If tasks exist, use them. If not, reconstruct from conversation context.
- Show the current step clearly with ← you are here.
- Don't add commentary unless something is blocked or off-track.
- If a task is blocked, say what's blocking it.
