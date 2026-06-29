-- Email preferences and unsubscribe token on users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_session_reminders  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS email_reengagement        BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS email_marketing           BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS unsubscribe_token         VARCHAR UNIQUE;

-- Back-fill unsubscribe tokens for existing users
UPDATE users SET unsubscribe_token = upper(encode(gen_random_bytes(16), 'hex'))
WHERE unsubscribe_token IS NULL;

-- Dedup log for re-engagement emails (prevents sending the same type twice per absence)
CREATE TABLE IF NOT EXISTS reengagement_log (
  id             SERIAL PRIMARY KEY,
  user_id        VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_type     VARCHAR NOT NULL,  -- '5d', '10d', '14d', 'streak', 'broadcast'
  reference_date DATE    NOT NULL,  -- normalized last-session date (or cron date for streak/broadcast)
  sent_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, email_type, reference_date)
);

CREATE INDEX IF NOT EXISTS idx_reengagement_log_user ON reengagement_log(user_id);

-- Admin-schedulable broadcast notifications
CREATE TABLE IF NOT EXISTS broadcast_notifications (
  id           SERIAL PRIMARY KEY,
  title        TEXT    NOT NULL,
  body         TEXT    NOT NULL,
  area_filter  TEXT,               -- e.g. 'SoCal', NULL means all areas
  scheduled_at TIMESTAMP NOT NULL,
  sent_at      TIMESTAMP,
  recipient_count INTEGER,
  created_by   VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMP DEFAULT NOW()
);
