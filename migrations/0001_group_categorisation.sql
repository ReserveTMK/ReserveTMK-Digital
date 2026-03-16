-- Migration: Group Categorisation Overhaul
-- Date: 2026-03-16
-- Description: Migrates group types from 7 legacy categories to 13 NZ-context categories,
--   adds engagement_level field, and removes legacy ecosystem_roles/strategic_importance columns.

-- Step 1: Add engagement_level column with default
ALTER TABLE groups ADD COLUMN IF NOT EXISTS engagement_level TEXT DEFAULT 'Active';

-- Step 2: Remap legacy type values to new categories
UPDATE groups SET type = 'Government / Council' WHERE type = 'Government';
UPDATE groups SET type = 'Government / Council' WHERE type = 'government';
UPDATE groups SET type = 'Education / Training' WHERE type = 'Education';
UPDATE groups SET type = 'Education / Training' WHERE type = 'education';
UPDATE groups SET type = 'Community Organisation' WHERE type = 'community_group';
UPDATE groups SET type = 'Community Organisation' WHERE type = 'community_collective';
UPDATE groups SET type = 'Community Organisation' WHERE type = 'Community';
UPDATE groups SET type = 'Uncategorised' WHERE type = 'partner';
UPDATE groups SET type = 'Uncategorised' WHERE type = 'other';
UPDATE groups SET type = 'Resident Company' WHERE type = 'resident_company';
UPDATE groups SET type = 'Iwi / Hapū' WHERE type = 'iwi';
UPDATE groups SET type = 'Business' WHERE type = 'business';
UPDATE groups SET type = 'Funder' WHERE type = 'funder';
UPDATE groups SET type = 'NGO' WHERE type = 'ngo';

-- Step 2b: Remap Education records stored via organizationTypeOther
UPDATE groups SET type = 'Education / Training'
  WHERE type IN ('Other', 'other', 'Uncategorised')
  AND organization_type_other IS NOT NULL
  AND LOWER(organization_type_other) LIKE '%education%';

UPDATE groups SET type = 'Health / Social Services'
  WHERE type IN ('Other', 'other', 'Uncategorised')
  AND organization_type_other IS NOT NULL
  AND LOWER(organization_type_other) LIKE '%health%';

-- Step 3: Catch any remaining non-standard types and set to Uncategorised
UPDATE groups SET type = 'Uncategorised'
  WHERE type NOT IN (
    'Business', 'Social Enterprise', 'Creative / Arts', 'Community Organisation',
    'Iwi / Hapū', 'Government / Council', 'Education / Training',
    'Health / Social Services', 'Funder', 'Corporate / Sponsor',
    'Resident Company', 'NGO', 'Uncategorised'
  );

-- Step 4: Backfill engagement_level for any NULL values
UPDATE groups SET engagement_level = 'Active' WHERE engagement_level IS NULL;

-- Step 5: Drop legacy columns
ALTER TABLE groups DROP COLUMN IF EXISTS strategic_importance;
ALTER TABLE groups DROP COLUMN IF EXISTS ecosystem_roles;
