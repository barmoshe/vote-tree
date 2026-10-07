-- People in the tree. Only a display name; never a phone, an email or a vote choice.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,           -- the personal invite link: /j/<code>
  parent_id TEXT REFERENCES users(id), -- who invited them
  key_hash TEXT NOT NULL,              -- sha-256 of the session key; '' after leaving
  created_at INTEGER NOT NULL,
  voted_at INTEGER                     -- when they marked "I voted"; null until then
);
CREATE INDEX users_parent ON users(parent_id);

-- Closure table: one row per (ancestor, descendant) pair, so a whole tree is one indexed query.
CREATE TABLE ancestry (
  ancestor_id TEXT NOT NULL,
  descendant_id TEXT NOT NULL,
  dist INTEGER NOT NULL,
  PRIMARY KEY (ancestor_id, descendant_id)
);
CREATE INDEX ancestry_desc ON ancestry(descendant_id);

-- Fixed-window rate limits (joins per IP hash).
CREATE TABLE rate (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
