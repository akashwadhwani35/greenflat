-- Keeps the verification selfie so moderation can actually look at it.
--
-- Until now only a SHA-256 of the selfie was stored, which is enough to stop
-- the same file verifying two accounts but shows a moderator nothing. The
-- dashboard needs the picture to judge a disputed verification or a report.
ALTER TABLE verification_status ADD COLUMN IF NOT EXISTS selfie_url TEXT;
