CREATE TABLE account_users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 salt TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('owner','admin','player')),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 player_id TEXT NOT NULL UNIQUE,
 created INTEGER NOT NULL
);
CREATE UNIQUE INDEX account_single_owner ON account_users(role) WHERE role='owner';
CREATE TABLE account_profiles (
 user_id INTEGER PRIMARY KEY REFERENCES account_users(id),
 public_json TEXT NOT NULL,
 private_json TEXT NOT NULL DEFAULT '{}',
 published INTEGER NOT NULL DEFAULT 1,
 consent INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE account_sessions (
 token_hash TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES account_users(id),
 expires INTEGER NOT NULL
);
CREATE INDEX account_sessions_user ON account_sessions(user_id);
CREATE TABLE account_invites (
 hash TEXT PRIMARY KEY,
 label TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','player')),
 player_id TEXT,
 expires INTEGER NOT NULL,
 used_by TEXT,
 revoked INTEGER NOT NULL DEFAULT 0,
 created INTEGER NOT NULL
);
CREATE TABLE account_attempts (
 key TEXT PRIMARY KEY,
 window INTEGER NOT NULL,
 count INTEGER NOT NULL
);
CREATE TABLE account_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 actor INTEGER NOT NULL,
 action TEXT NOT NULL,
 target TEXT NOT NULL,
 created INTEGER NOT NULL
);
