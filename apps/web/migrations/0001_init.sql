-- DressPTL initial schema.
--
-- Deliberately absent: any column for ethnicity, race, nationality, age, or
-- gender. `skin_undertone` stores only a colour-temperature word
-- (warm/cool/neutral) used for palette matching.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT,
  height_cm     INTEGER,
  consent_at    TEXT,
  created_at    TEXT NOT NULL
);

-- `id` holds a SHA-256 of the session token, never the token itself, so a
-- database leak does not hand over live sessions.
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS photos (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  r2_key     TEXT NOT NULL,
  mime_type  TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending',
  error      TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_photos_user ON photos(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS photo_analyses (
  id              TEXT PRIMARY KEY,
  photo_id        TEXT NOT NULL UNIQUE REFERENCES photos(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  colors_json     TEXT NOT NULL,
  garments_json   TEXT NOT NULL,
  style_tags_json TEXT NOT NULL,
  skin_undertone  TEXT,
  body_silhouette TEXT,
  color_harmony   TEXT,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analyses_user ON photo_analyses(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS style_profiles (
  user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  profile_json TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recommendations (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_json TEXT NOT NULL,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recs_user ON recommendations(user_id, created_at DESC);
