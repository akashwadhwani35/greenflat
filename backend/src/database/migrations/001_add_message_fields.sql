-- Add missing fields to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Add last_message_at to matches table for sorting conversations
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP;

-- Create index for faster message queries
CREATE INDEX IF NOT EXISTS idx_messages_match_id ON messages(match_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_read ON messages(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_matches_last_message ON matches(last_message_at DESC);
