-- Check-in fields on hit_requests
ALTER TABLE hit_requests
  ADD COLUMN IF NOT EXISTS checkin_requester_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS checkin_receiver_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS checkin_requester_location_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS checkin_receiver_location_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS no_show_user_id VARCHAR;

-- No-show accountability counter on player profiles
ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS no_show_count INTEGER NOT NULL DEFAULT 0;
