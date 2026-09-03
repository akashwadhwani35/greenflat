-- "Compliment" becomes "First Move", and it can carry the photo it was sent
-- from. messages.kind marks the two messages a First Move creates so the app
-- can render the photo small and label the text.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS kind VARCHAR(24);

-- AI Match briefing: one short paragraph per pair, generated once and kept.
CREATE TABLE IF NOT EXISTS pair_briefings (
    id SERIAL PRIMARY KEY,
    user_a INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    briefing TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_a, user_b),
    CHECK (user_a < user_b)
);
