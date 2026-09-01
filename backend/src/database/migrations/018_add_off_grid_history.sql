-- Off-grid sets that have been shown, so Rewind survives closing the app.
--
-- Rewind was client state only: the previous four profiles lived in a React
-- component and were gone on reload. It is sold as a paid feature, so losing it
-- to a backgrounded app is a refundable-looking bug.
--
-- Rows are small (four ids) and swept to the newest few per user on write.
CREATE TABLE IF NOT EXISTS off_grid_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    candidate_ids JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_off_grid_history_user_created
  ON off_grid_history(user_id, created_at DESC);
