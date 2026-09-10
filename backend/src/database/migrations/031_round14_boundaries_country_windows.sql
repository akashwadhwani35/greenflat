-- Round 14.
--
-- 1. Country on the user, so a new account can be shown its whole country
--    rather than a 50 km circle it never chose (distance moved to filters).
-- 2. My Boundaries: per-user caps on how many incoming actions land each day.
-- 3. The six-hour Explore window that keeps "unlimited likes" from meaning
--    literally unlimited.

-- 1 ---------------------------------------------------------------------------
-- ISO 3166-1 alpha-2, filled in by geocoding. NULL means unknown, which is
-- treated as "do not restrict" so existing accounts are unaffected.
ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(2);
CREATE INDEX IF NOT EXISTS idx_users_country ON users(country) WHERE country IS NOT NULL;

-- 2 ---------------------------------------------------------------------------
-- Counts live beside the limits and reset on a rolling 24 hours, the same shape
-- as user_activity_limits.
CREATE TABLE IF NOT EXISTS user_incoming_limits (
  user_id             INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- The master toggle. Default is on for women and off for everyone else.
  enabled             BOOLEAN NOT NULL DEFAULT FALSE,
  limit_likes         INTEGER NOT NULL DEFAULT 10,
  limit_greenflags    INTEGER NOT NULL DEFAULT 10,
  limit_compliments   INTEGER NOT NULL DEFAULT 10,
  likes_count         INTEGER NOT NULL DEFAULT 0,
  greenflags_count    INTEGER NOT NULL DEFAULT 0,
  compliments_count   INTEGER NOT NULL DEFAULT 0,
  last_reset_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_incoming_limits_ranges CHECK (
    limit_likes       BETWEEN 0 AND 100 AND
    limit_greenflags  BETWEEN 0 AND 100 AND
    limit_compliments BETWEEN 0 AND 100
  )
);

-- Seed a row per existing account so the read path never has to branch on NULL.
INSERT INTO user_incoming_limits (user_id, enabled)
SELECT id, (gender = 'female') FROM users
ON CONFLICT (user_id) DO NOTHING;

-- 3 ---------------------------------------------------------------------------
-- Unlimited plans still get a ceiling per six-hour window. The cap is drawn per
-- window between 35 and 42 so the number is not a round, guessable constant.
ALTER TABLE user_activity_limits
  ADD COLUMN IF NOT EXISTS explore_window_started_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS explore_window_likes      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS explore_window_cap        INTEGER;

-- Notified once per window when it reopens, so the push does not repeat.
ALTER TABLE user_activity_limits
  ADD COLUMN IF NOT EXISTS explore_window_notified_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS likes_reset_notified_at    TIMESTAMP;
