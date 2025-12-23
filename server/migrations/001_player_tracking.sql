-- Player tracking tables for grimlive website integration
-- Extends grimkeeper database with per-player game statistics

-- Game players table - tracks who participated in each game
CREATE TABLE IF NOT EXISTS game_players (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
    discord_id BIGINT,  -- NULL if player not linked to Discord
    player_name TEXT NOT NULL,
    seat_number INTEGER NOT NULL,
    survived BOOLEAN DEFAULT FALSE,
    winning_team BOOLEAN DEFAULT FALSE,  -- TRUE if on winning team
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id, seat_number)
);

CREATE INDEX idx_game_players_game_id ON game_players(game_id);
CREATE INDEX idx_game_players_discord_id ON game_players(discord_id);

-- Player role assignments table - what role each player had
CREATE TABLE IF NOT EXISTS player_roles (
    id SERIAL PRIMARY KEY,
    game_player_id INTEGER NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL,  -- e.g. 'washerwoman', 'imp'
    role_name TEXT NOT NULL,
    team TEXT NOT NULL CHECK (team IN ('townsfolk', 'outsider', 'minion', 'demon', 'traveller', 'fabled')),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_player_roles_game_player_id ON player_roles(game_player_id);
CREATE INDEX idx_player_roles_role_id ON player_roles(role_id);

-- Player death events - tracks when and how players died
CREATE TABLE IF NOT EXISTS player_deaths (
    id SERIAL PRIMARY KEY,
    game_player_id INTEGER NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
    death_type TEXT NOT NULL CHECK (death_type IN ('execution', 'night_kill', 'other')),
    day_number INTEGER,
    killer_player_id INTEGER REFERENCES game_players(id) ON DELETE SET NULL,
    died_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_player_deaths_game_player_id ON player_deaths(game_player_id);
CREATE INDEX idx_player_deaths_killer_player_id ON player_deaths(killer_player_id);

-- Player aggregate statistics
CREATE TABLE IF NOT EXISTS player_stats (
    discord_id BIGINT PRIMARY KEY,
    guild_id BIGINT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    times_executed INTEGER DEFAULT 0,
    times_night_killed INTEGER DEFAULT 0,
    times_survived INTEGER DEFAULT 0,
    favorite_role TEXT,
    last_played_at TIMESTAMP,
    UNIQUE(guild_id, discord_id)
);

CREATE INDEX idx_player_stats_guild_id ON player_stats(guild_id);
CREATE INDEX idx_player_stats_discord_id ON player_stats(discord_id);

-- Role frequency table - how often each role is played
CREATE TABLE IF NOT EXISTS role_frequency (
    guild_id BIGINT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
    role_id TEXT NOT NULL,
    times_played INTEGER DEFAULT 0,
    times_won INTEGER DEFAULT 0,
    times_executed INTEGER DEFAULT 0,
    times_night_killed INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, role_id)
);

CREATE INDEX idx_role_frequency_guild_id ON role_frequency(guild_id);

-- Web sessions table - tracks sessions initiated from grimlive website
CREATE TABLE IF NOT EXISTS web_sessions (
    web_session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id INTEGER REFERENCES games(game_id) ON DELETE SET NULL,
    session_token TEXT UNIQUE NOT NULL,  -- for API authentication
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    stat_tracking_enabled BOOLEAN DEFAULT TRUE,
    discord_guild_id BIGINT  -- optional link to Discord guild
);

CREATE INDEX idx_web_sessions_session_token ON web_sessions(session_token);
CREATE INDEX idx_web_sessions_game_id ON web_sessions(game_id);
