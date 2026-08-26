-- Backfills the schema the admin dashboard (commit d59c462) was written against
-- but which never shipped a migration: subscriptions, token_purchases, and the
-- shadow-ban flag.

CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan VARCHAR(20) NOT NULL CHECK (plan IN ('pro', 'premium')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    starts_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    -- Admin who granted it, when granted manually. NULL for self-serve purchases.
    granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    -- Store receipt identifiers so a subscription can be traced to a real payment.
    provider VARCHAR(20),
    provider_transaction_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Money is stored in integer cents. Never floats.
CREATE TABLE IF NOT EXISTS token_purchases (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pack_id VARCHAR(20) NOT NULL,
    tokens INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    provider VARCHAR(20),
    provider_transaction_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_token_purchases_user_id ON token_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_token_purchases_created_at ON token_purchases(created_at DESC);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_shadow_banned BOOLEAN DEFAULT FALSE;
