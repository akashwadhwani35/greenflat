-- Sign in with Apple.
--
-- Apple's `sub` is stable per user per developer team, and is the only durable
-- identifier we get: the email can be a private relay address, and Apple sends
-- the name exactly once, on the very first authorisation.
ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_sub VARCHAR(255);

-- Partial unique index rather than a UNIQUE column: most rows are NULL here and
-- Postgres would otherwise be fine, but this also documents the intent.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple_sub ON users(apple_sub) WHERE apple_sub IS NOT NULL;

-- auth_provider's CHECK only allowed 'password' and 'google', so an Apple
-- signup would fail the insert.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_auth_provider_check;
ALTER TABLE users ADD CONSTRAINT users_auth_provider_check
  CHECK (auth_provider IN ('password', 'google', 'apple'));
