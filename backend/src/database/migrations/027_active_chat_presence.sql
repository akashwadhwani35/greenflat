-- Board 40: which chat a person has open, so a message they are looking at does
-- not also ring as a push. Kept in the database because Cloud Run runs several
-- instances and an in-memory socket map on one of them is invisible to the
-- instance handling the send. The app refreshes it every 45 seconds while the
-- chat is open and clears it on leave; anything older than two minutes is stale.
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_chat_match_id INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_chat_at TIMESTAMPTZ;
