CREATE TABLE team_matches (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 opponent TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('official','scrim','friendly','campus')),
 played_on TEXT NOT NULL,
 published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),
 created_by INTEGER NOT NULL REFERENCES account_users(id),
 created INTEGER NOT NULL,
 updated INTEGER NOT NULL
);
CREATE TABLE match_rounds (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 match_id TEXT NOT NULL REFERENCES team_matches(id) ON DELETE CASCADE,
 round_number INTEGER NOT NULL,
 side TEXT NOT NULL CHECK(side IN ('survivor','hunter')),
 map TEXT NOT NULL,
 team_score INTEGER NOT NULL CHECK(team_score BETWEEN 0 AND 5),
 opponent_score INTEGER NOT NULL CHECK(opponent_score BETWEEN 0 AND 5),
 UNIQUE(match_id,round_number,side)
);
CREATE TABLE match_picks (
 round_id INTEGER NOT NULL REFERENCES match_rounds(id) ON DELETE CASCADE,
 position INTEGER NOT NULL,
 player_id TEXT NOT NULL,
 character TEXT NOT NULL,
 PRIMARY KEY(round_id,position)
);
CREATE TABLE match_bans (
 round_id INTEGER NOT NULL REFERENCES match_rounds(id) ON DELETE CASCADE,
 position INTEGER NOT NULL,
 character TEXT NOT NULL,
 PRIMARY KEY(round_id,position)
);
CREATE INDEX matches_date ON team_matches(played_on);
CREATE INDEX rounds_match ON match_rounds(match_id);
