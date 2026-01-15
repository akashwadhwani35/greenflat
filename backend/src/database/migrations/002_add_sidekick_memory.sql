-- Persisted AI sidekick memory (preferences + style).
CREATE TABLE IF NOT EXISTS user_sidekick_memory (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    memory JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
