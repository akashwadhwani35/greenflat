ALTER TABLE otp_codes
  ADD COLUMN IF NOT EXISTS verify_attempts INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS otp_request_audit (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otp_request_audit_phone_created_at
  ON otp_request_audit(phone, created_at DESC);
