-- Free daily token allowance.
--
-- Purchases are disabled until in-app billing exists, and there was no other way
-- to obtain tokens, so any active user eventually hit a permanent wall with a
-- dead "buy tokens" button as their only option. This tracks when a user last
-- received their allowance so it can be topped up once per period.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_token_refill_at TIMESTAMP;

-- Existing users become immediately eligible for their first top-up.
CREATE INDEX IF NOT EXISTS idx_users_last_token_refill_at ON users(last_token_refill_at);
