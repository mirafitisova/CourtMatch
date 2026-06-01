-- Add session detail fields to hit_requests
ALTER TABLE hit_requests
  ADD COLUMN IF NOT EXISTS court_id INTEGER REFERENCES courts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS practice_type VARCHAR,
  ADD COLUMN IF NOT EXISTS cost_split VARCHAR,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS reminder24h_sent_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS reminder1h_sent_at TIMESTAMP;

-- Per-session logistics messages
CREATE TABLE IF NOT EXISTS session_messages (
  id SERIAL PRIMARY KEY,
  hit_request_id INTEGER NOT NULL REFERENCES hit_requests(id) ON DELETE CASCADE,
  sender_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_messages_hit_request_id ON session_messages(hit_request_id);
