-- Rating table (one per player per session)
CREATE TABLE IF NOT EXISTS hit_request_ratings (
  id SERIAL PRIMARY KEY,
  hit_request_id INTEGER NOT NULL REFERENCES hit_requests(id) ON DELETE CASCADE,
  rater_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rated_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reliability INTEGER NOT NULL CHECK (reliability BETWEEN 1 AND 5),
  skill_accuracy INTEGER NOT NULL CHECK (skill_accuracy BETWEEN 1 AND 5),
  partner_quality INTEGER NOT NULL CHECK (partner_quality BETWEEN 1 AND 5),
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(hit_request_id, rater_id)
);

-- Aggregate stats on player_profiles
ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS session_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_rating REAL;

-- Track when rating prompt email was sent
ALTER TABLE hit_requests
  ADD COLUMN IF NOT EXISTS rating_notified_at TIMESTAMP;
