-- Rules from the second half of the "Greenflag edits" board.

-- Grouped trait labels for the paid filters (personality, communication,
-- relationship needs, conflict style, lifestyle). The flat personality_traits
-- array stays for the profile snapshot and matching.
ALTER TABLE personality_responses ADD COLUMN IF NOT EXISTS trait_profile JSONB;

-- New accounts start with 19 tokens (was 50), then 5 a week.
ALTER TABLE users ALTER COLUMN credit_balance SET DEFAULT 19;

-- Every privacy toggle is off by default. show_online_status was the odd one out.
ALTER TABLE users ALTER COLUMN show_online_status SET DEFAULT FALSE;
ALTER TABLE user_privacy_settings ALTER COLUMN show_online_status SET DEFAULT FALSE;

-- Unblocking becomes a soft delete. A profile that was ever blocked must not be
-- resurfaced by AI Match after the block is lifted; it can still be found by
-- searching, which is the user's own choice. Deleting the row lost that history.
ALTER TABLE blocks ADD COLUMN IF NOT EXISTS unblocked_at TIMESTAMPTZ;

-- Replying to a specific message.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL;
