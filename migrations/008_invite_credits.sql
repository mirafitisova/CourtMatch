-- Invite codes and practice credits on the users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS invite_code    VARCHAR UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by    VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS practice_credits INTEGER NOT NULL DEFAULT 0;

-- Back-fill invite codes for existing users (8-char hex)
UPDATE users SET invite_code = upper(encode(gen_random_bytes(4), 'hex'))
WHERE invite_code IS NULL;

-- Credit transaction log (prevents double-crediting, audit trail)
CREATE TABLE IF NOT EXISTS credit_transactions (
  id               SERIAL PRIMARY KEY,
  user_id          VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount           INTEGER NOT NULL,
  reason           VARCHAR NOT NULL,          -- e.g. 'referral_first_session'
  referred_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  notified_at      TIMESTAMP,                 -- null = toast not yet shown
  created_at       TIMESTAMP DEFAULT NOW(),
  -- one credit event per referred-user per reason
  UNIQUE (reason, referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON credit_transactions(user_id);
