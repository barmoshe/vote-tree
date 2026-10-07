-- A photo from outside the polling station: one per person, seen only by their league-mates,
-- deleted when the polls close (a cron on election night, and a guard on every read after it).
CREATE TABLE photos (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,      -- what league tables link to; never the user id
  data BLOB NOT NULL,              -- a re-encoded JPEG, no EXIF, at most ~400 KB
  created_at INTEGER NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0 -- two flags from league-mates hide it and its points
);

CREATE TABLE photo_flags (
  user_id TEXT NOT NULL,           -- whose photo
  flagger_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, flagger_id)
);
