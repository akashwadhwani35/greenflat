-- Add superlike support to likes table
ALTER TABLE likes ADD COLUMN IF NOT EXISTS is_superlike BOOLEAN DEFAULT FALSE;
