-- Email verification as an alternative to SMS.
--
-- SMS OTP to Indian numbers requires TRAI DLT registration (entity, sender ID and
-- templates registered with the telecom operators), which needs business
-- documents and takes days. Email has no such gate and is free at our volume, and
-- the onboarding screen already offers Email as a choice.

ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE otp_codes ALTER COLUMN phone DROP NOT NULL;

-- One live code per destination. A plain unique index, not a partial one: ON
-- CONFLICT (email) can only infer a full index, and NULLs never collide anyway.
CREATE UNIQUE INDEX IF NOT EXISTS idx_otp_codes_email ON otp_codes(email);

ALTER TABLE otp_request_audit ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE otp_request_audit ALTER COLUMN phone DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_otp_request_audit_email_created_at
  ON otp_request_audit(email, created_at DESC);

ALTER TABLE verification_status ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE verification_status ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
