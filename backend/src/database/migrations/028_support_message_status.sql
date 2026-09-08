-- Support messages are answered from the admin dashboard, not only by email.
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'open';
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS admin_notes TEXT;
