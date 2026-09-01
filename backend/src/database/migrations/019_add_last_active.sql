-- When each user was last seen.
--
-- The admin dashboard has queried users.last_active since it was written, but
-- the column was never created. Five of its queries reference it, each wrapped
-- in a try/catch that logs a warning and moves on, so DAU and MAU have silently
-- reported zero the whole time rather than failing loudly.
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ;

-- Existing accounts get a sensible starting point rather than reading as
-- permanently dormant.
UPDATE users SET last_active = COALESCE(updated_at, created_at) WHERE last_active IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active DESC);
