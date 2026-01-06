-- Player tracking tables for grimlive website integration
-- Extends grimkeeper's existing schema with per-player game statistics
-- These tables work alongside grimkeeper's existing games table

-- Web sessions table - tracks sessions initiated from grimlive website
-- Links to Discord accounts when user authenticates
CREATE TABLE IF NOT EXISTS web_sessions (
    session_id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,  -- Bearer token for API auth
    discord_user_id BIGINT,  -- Links to Discord user when authenticated
    created_at BIGINT DEFAULT EXTRACT(epoch FROM now()),
    expires_at BIGINT NOT NULL,
    stat_tracking_enabled BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_web_sessions_token ON web_sessions(token);
CREATE INDEX idx_web_sessions_discord_user_id ON web_sessions(discord_user_id);

-- Game players table - tracks individual participation in each game
-- REFERENCES grimkeeper's existing games(game_id) table
-- Stores FINAL roles at game end (not mid-game changes)
CREATE TABLE IF NOT EXISTS game_players (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
    discord_id BIGINT,  -- NULL if player hasn't linked Discord account
    player_name TEXT NOT NULL,
    seat_number INTEGER NOT NULL,
    role_id TEXT,  -- Final role at game end (e.g. 'washerwoman', 'imp')
    role_name TEXT,  -- Display name
    team TEXT CHECK (team IN ('townsfolk', 'outsider', 'minion', 'demon', 'traveller', 'fabled')),
    survived BOOLEAN DEFAULT FALSE,
    winning_team BOOLEAN DEFAULT FALSE,  -- TRUE if on winning team
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id, seat_number)
);

CREATE INDEX idx_game_players_game_id ON game_players(game_id);
CREATE INDEX idx_game_players_discord_id ON game_players(discord_id);

-- Note: Role tracking stores FINAL roles only (captured at game end)
-- Mid-game role changes (drunk sobering, etc.) are not tracked
-- Complex death tracking (who killed who, day-by-day) deferred to later phase
