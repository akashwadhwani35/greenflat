CREATE TABLE IF NOT EXISTS support_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  user_name VARCHAR(100),
  message TEXT NOT NULL,
  email_delivery_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (email_delivery_status IN ('pending', 'sent', 'failed')),
  email_delivery_error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON support_messages(created_at DESC);
