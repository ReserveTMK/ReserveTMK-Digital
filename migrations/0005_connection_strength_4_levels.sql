-- Migration: Reduce connection strength from 5 levels to 4
-- known → aware, connected stays, engaged → trusted, embedded+partnering → woven

-- Update contacts
UPDATE contacts SET connection_strength = 'aware' WHERE connection_strength = 'known';
UPDATE contacts SET connection_strength = 'trusted' WHERE connection_strength = 'engaged';
UPDATE contacts SET connection_strength = 'woven' WHERE connection_strength IN ('embedded', 'partnering');

-- Update relationship stage history
UPDATE relationship_stage_history
SET previous_stage = CASE
  WHEN previous_stage = 'known' THEN 'aware'
  WHEN previous_stage = 'engaged' THEN 'trusted'
  WHEN previous_stage IN ('embedded', 'partnering') THEN 'woven'
  ELSE previous_stage
END,
new_stage = CASE
  WHEN new_stage = 'known' THEN 'aware'
  WHEN new_stage = 'engaged' THEN 'trusted'
  WHEN new_stage IN ('embedded', 'partnering') THEN 'woven'
  ELSE new_stage
END
WHERE change_type = 'connection';
