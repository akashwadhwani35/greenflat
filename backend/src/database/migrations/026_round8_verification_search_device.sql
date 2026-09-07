-- Round-8 feedback (2026-09-07).
--
-- 1. The green flag next to a name meant "email verified" because users.is_verified
--    was set by the OTP step. The board wants it to mean face-verified only.
--    Backfill so existing accounts follow the new rule.
-- 2. AI search charging becomes idempotent: a retry of the same query within a
--    few minutes is free, and a failure after the charge refunds. The ledger
--    needs to know which searches were paid for.
-- 3. Basic spam-account protection: remember the device an account was created
--    or verified on, and a fingerprint of the verified selfie.
UPDATE users u
SET is_verified = EXISTS (
  SELECT 1 FROM verification_status vs WHERE vs.user_id = u.id AND vs.face_status = 'verified'
);

ALTER TABLE search_history ADD COLUMN IF NOT EXISTS charged BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_search_history_user_created ON search_history(user_id, created_at DESC);

ALTER TABLE users ADD COLUMN IF NOT EXISTS device_id VARCHAR(128);
CREATE INDEX IF NOT EXISTS idx_users_device_id ON users(device_id) WHERE device_id IS NOT NULL;

ALTER TABLE verification_status ADD COLUMN IF NOT EXISTS selfie_hash VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_verification_selfie_hash ON verification_status(selfie_hash) WHERE selfie_hash IS NOT NULL;
