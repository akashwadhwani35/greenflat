-- Profile prompts (Adhiraj, 2026-09-08): up to three picked from a fixed list,
-- each with an answer, shown between the profile sections. Stored as
-- [{"question": "...", "answer": "..."}]. The old free-text prompt1..3 stay
-- for older rows but are no longer written by the app.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS prompts JSONB NOT NULL DEFAULT '[]'::jsonb;
