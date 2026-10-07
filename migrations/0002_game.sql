-- The game layer: voting plans, tree species, the witness stamp, daily watering and private leagues.

-- A voting plan is kept on the person's own device; the server only knows that one was made.
ALTER TABLE users ADD COLUMN plan_at INTEGER;
-- The tree species the person picked (a cosmetic unlocked by level).
ALTER TABLE users ADD COLUMN species TEXT NOT NULL DEFAULT 'olive';

-- The witness stamp: after voting, a person gets a link a friend opens to confirm it.
ALTER TABLE users ADD COLUMN confirm_code TEXT;
ALTER TABLE users ADD COLUMN confirmed_by TEXT;
ALTER TABLE users ADD COLUMN confirmed_at INTEGER;
CREATE UNIQUE INDEX users_confirm_code ON users(confirm_code);
CREATE INDEX users_confirmed_by ON users(confirmed_by);

-- Daily watering before election day: the last Israel date watered, the run, and the total.
ALTER TABLE users ADD COLUMN water_day TEXT;
ALTER TABLE users ADD COLUMN water_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN water_total INTEGER NOT NULL DEFAULT 0;

-- Private leagues: a name, an invite code, and the people in it.
CREATE TABLE leagues (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);
CREATE INDEX leagues_owner ON leagues(owner_id);

CREATE TABLE league_members (
  league_id TEXT NOT NULL REFERENCES leagues(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (league_id, user_id)
);
CREATE INDEX league_members_user ON league_members(user_id);
