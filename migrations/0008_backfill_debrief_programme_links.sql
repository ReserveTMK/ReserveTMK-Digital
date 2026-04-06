-- Backfill: copy linkedProgrammeId from events to impact_logs where missing
-- Run once via Neon MCP to fix existing debriefs created before the auto-populate fix.
--
-- Safe to re-run: only updates rows where programme_id IS NULL.

UPDATE impact_logs il
SET programme_id = e.linked_programme_id
FROM events e
WHERE il.event_id = e.id
  AND il.programme_id IS NULL
  AND e.linked_programme_id IS NOT NULL;
