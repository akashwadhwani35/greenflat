ALTER TABLE users
ADD COLUMN IF NOT EXISTS credit_balance INTEGER NOT NULL DEFAULT 50;

CREATE TABLE IF NOT EXISTS credit_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('debit', 'credit')),
  reason VARCHAR(100) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);

ALTER TABLE likes
ADD COLUMN IF NOT EXISTS is_compliment BOOLEAN DEFAULT FALSE;

ALTER TABLE likes
ADD COLUMN IF NOT EXISTS compliment_message TEXT;
