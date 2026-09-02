-- Compliments become chat requests.
--
-- A compliment now opens a conversation in a pending state: the receiver sees
-- the greeting and the compliment in Messages and chooses Accept or Not my
-- type. Accepting makes it an ordinary match; declining removes it. Ordinary
-- mutual likes still create active matches as before.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'active';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);

-- Unread badge on the Likes tab: a like counts until the inbox has been opened.
ALTER TABLE likes ADD COLUMN IF NOT EXISTS seen_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_likes_unseen ON likes(liked_id) WHERE seen_at IS NULL;
