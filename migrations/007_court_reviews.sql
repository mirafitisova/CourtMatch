-- Court review system: one review per user per session
CREATE TABLE IF NOT EXISTS court_reviews (
  id               SERIAL PRIMARY KEY,
  court_id         INTEGER NOT NULL REFERENCES courts(id)       ON DELETE CASCADE,
  user_id          VARCHAR NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
  hit_request_id   INTEGER          REFERENCES hit_requests(id) ON DELETE SET NULL,
  overall_rating   INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  nets_good        BOOLEAN NOT NULL DEFAULT FALSE,
  surface_clean    BOOLEAN NOT NULL DEFAULT FALSE,
  not_crowded      BOOLEAN NOT NULL DEFAULT FALSE,
  good_lighting    BOOLEAN NOT NULL DEFAULT FALSE,
  easy_parking     BOOLEAN NOT NULL DEFAULT FALSE,
  note             TEXT    CHECK (char_length(note) <= 140),
  first_time       BOOLEAN NOT NULL DEFAULT FALSE,
  played_at        TIMESTAMP,
  created_at       TIMESTAMP DEFAULT NOW(),
  -- prevent duplicate reviews for the same session
  UNIQUE (user_id, hit_request_id)
);

CREATE INDEX IF NOT EXISTS idx_court_reviews_court_id ON court_reviews(court_id);
CREATE INDEX IF NOT EXISTS idx_court_reviews_user_id  ON court_reviews(user_id);
