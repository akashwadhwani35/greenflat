ALTER TABLE users
ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_boost_expires_at ON users(boost_expires_at);
