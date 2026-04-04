-- Migration: Add connection_strength to groups
-- Same 4 levels as contacts: aware, connected, trusted, woven

ALTER TABLE groups ADD COLUMN IF NOT EXISTS connection_strength TEXT;

-- Backfill: orgs we actively work with or know → connected, rest → aware
UPDATE groups SET connection_strength = 'connected' WHERE is_community = true OR is_innovator = true;
UPDATE groups SET connection_strength = 'aware' WHERE connection_strength IS NULL;
