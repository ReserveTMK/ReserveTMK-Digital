-- Migration: MOU relationship framework redesign
-- Date: 2026-04-06
-- Adds structured relationship, access, gain, and growth columns to mous table

ALTER TABLE mous ADD COLUMN IF NOT EXISTS relationship_role TEXT;
ALTER TABLE mous ADD COLUMN IF NOT EXISTS access_provided TEXT[] DEFAULT '{}';
ALTER TABLE mous ADD COLUMN IF NOT EXISTS what_we_gain TEXT[] DEFAULT '{}';
ALTER TABLE mous ADD COLUMN IF NOT EXISTS growth_potential TEXT[] DEFAULT '{}';
ALTER TABLE mous ADD COLUMN IF NOT EXISTS growth_notes TEXT;
