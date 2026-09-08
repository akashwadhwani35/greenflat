-- Weekly free tokens expire after a week (Adhiraj, 2026-09-08); bought tokens
-- never do. The weekly grant is tracked separately so spending takes the
-- expiring tokens first and only the unspent remainder lapses.
ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_tokens_balance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_tokens_expire_at TIMESTAMP;
