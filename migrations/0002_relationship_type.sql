-- Migration: Add relationship type to group associations
-- Date: 2026-03-17
-- Description: Adds relationshipType column to group_associations for parent/child/peer connections

ALTER TABLE group_associations ADD COLUMN IF NOT EXISTS relationship_type TEXT NOT NULL DEFAULT 'peer';
