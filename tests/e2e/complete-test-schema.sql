CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- GRIMKEEPER BASE SCHEMA (from migration 012)
-- ============================================================================

-- Guilds table (production schema)
CREATE TABLE IF NOT EXISTS guilds (
    guild_id BIGINT PRIMARY KEY,
    botc_category_id BIGINT,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    storyteller_role_id BIGINT
);

-- Sessions table (production schema)
CREATE TABLE IF NOT EXISTS sessions (
    guild_id BIGINT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
    category_id BIGINT NOT NULL,
    destination_channel_id BIGINT,
    grimoire_link TEXT,
    exception_channel_id BIGINT,
    announce_channel_id BIGINT,
    active_game_id INTEGER,
    created_at DOUBLE PRECISION NOT NULL,
    last_active DOUBLE PRECISION NOT NULL,
    storyteller_user_id BIGINT,
    vc_caps JSONB DEFAULT '{}'::jsonb,
    session_code VARCHAR(8),
    PRIMARY KEY (guild_id, category_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_code ON sessions(session_code);
CREATE INDEX IF NOT EXISTS idx_sessions_guild ON sessions(guild_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions(last_active);
CREATE INDEX IF NOT EXISTS idx_sessions_session_code ON sessions(session_code);

-- Games table (production schema)
CREATE TABLE IF NOT EXISTS games (
    game_id SERIAL PRIMARY KEY,
    guild_id BIGINT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
    script TEXT NOT NULL,
    custom_name TEXT,
    start_time DOUBLE PRECISION NOT NULL,
    end_time DOUBLE PRECISION,
    winner TEXT CHECK (winner IN ('Good', 'Evil', 'Cancel')),
    player_count INTEGER,
    players JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now(),
    completed_at TIMESTAMP,
    storyteller_id BIGINT,
    category_id BIGINT,
    storyteller_user_id BIGINT
);

CREATE INDEX IF NOT EXISTS idx_games_guild_id ON games(guild_id);
CREATE INDEX IF NOT EXISTS idx_games_storyteller_id ON games(storyteller_id);
CREATE INDEX IF NOT EXISTS idx_games_storyteller_user_id ON games(storyteller_user_id);
CREATE INDEX IF NOT EXISTS idx_games_is_active ON games(is_active);
CREATE INDEX IF NOT EXISTS idx_games_category_id ON games(category_id);
CREATE INDEX IF NOT EXISTS idx_games_guild_active ON games(guild_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_games_guild_completed ON games(guild_id, completed_at DESC) WHERE is_active = false;

-- Add FK for sessions.active_game_id after games table exists
ALTER TABLE sessions ADD CONSTRAINT sessions_active_game_id_fkey 
    FOREIGN KEY (active_game_id) REFERENCES games(game_id) ON DELETE SET NULL;

-- Timers (production schema - simplified)
CREATE TABLE IF NOT EXISTS timers (
    guild_id BIGINT PRIMARY KEY REFERENCES guilds(guild_id) ON DELETE CASCADE,
    end_time DOUBLE PRECISION NOT NULL,
    creator_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    category_id BIGINT
);

CREATE INDEX IF NOT EXISTS idx_timers_category ON timers(category_id) WHERE category_id IS NOT NULL;

-- ============================================================================
-- GRIMLIVE TABLES (from migrations 001-002)
-- ============================================================================

-- Web sessions
CREATE TABLE IF NOT EXISTS web_sessions (
    session_id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    discord_user_id BIGINT,
    created_at BIGINT DEFAULT EXTRACT(epoch FROM now()),
    expires_at BIGINT NOT NULL,
    stat_tracking_enabled BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_web_sessions_token ON web_sessions(token);
CREATE INDEX IF NOT EXISTS idx_web_sessions_discord_user_id ON web_sessions(discord_user_id);

-- Game players (with starting/final role tracking from 002)
CREATE TABLE IF NOT EXISTS game_players (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
    discord_id BIGINT,
    discord_user_id BIGINT,  -- Duplicate for compatibility
    player_name TEXT NOT NULL,
    seat_number INTEGER NOT NULL,
    
    -- Starting roles (from migration 002)
    starting_role_id TEXT,
    starting_role_name TEXT,
    starting_team TEXT CHECK (starting_team IN ('townsfolk', 'outsider', 'minion', 'demon', 'traveller', 'fabled')),
    character_name TEXT,  -- Duplicate of starting_role_name for compatibility
    alignment TEXT,  -- Duplicate of starting_team for compatibility
    
    -- Final roles (from migration 002)
    final_role_id TEXT,
    final_role_name TEXT,
    final_team TEXT CHECK (final_team IN ('townsfolk', 'outsider', 'minion', 'demon', 'traveller', 'fabled')),
    
    survived BOOLEAN DEFAULT FALSE,
    winning_team BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id, seat_number)
);

CREATE INDEX IF NOT EXISTS idx_game_players_game_id ON game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_game_players_discord_id ON game_players(discord_id);

-- API keys (from migration 003)
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    key_hash VARCHAR(128) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    discord_user_id VARCHAR(32),
    rate_limit INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_discord_user_id ON api_keys(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);

-- API usage tracking (from migration 003)
CREATE TABLE IF NOT EXISTS api_key_usage (
    id SERIAL PRIMARY KEY,
    api_key_id INTEGER REFERENCES api_keys(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    response_status INTEGER,
    ip_address VARCHAR(45)
);

CREATE INDEX IF NOT EXISTS idx_api_key_usage_key_timestamp ON api_key_usage(api_key_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_timestamp ON api_key_usage(timestamp);

-- Announcements (from grimkeeper 017)
CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    guild_id BIGINT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
    category_id BIGINT NOT NULL,
    announcement_type TEXT NOT NULL,
    game_id INTEGER REFERENCES games(game_id) ON DELETE CASCADE,
    data JSONB,
    created_at INTEGER NOT NULL,
    processed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_announcements_guild_category ON announcements(guild_id, category_id);
CREATE INDEX IF NOT EXISTS idx_announcements_processed ON announcements(processed_at);
CREATE INDEX IF NOT EXISTS idx_announcements_game_id ON announcements(game_id);

-- ============================================================================
-- AUTO-SYNCING TRIGGERS
-- ============================================================================

-- Sync timestamps and winner fields in games table
CREATE OR REPLACE FUNCTION sync_game_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    -- Sync start times
    IF NEW.start_time IS NOT NULL AND NEW.started_at IS NULL THEN
        NEW.started_at := to_timestamp(NEW.start_time);
    END IF;
    IF NEW.started_at IS NOT NULL AND NEW.start_time IS NULL THEN
        NEW.start_time := EXTRACT(EPOCH FROM NEW.started_at)::INTEGER;
    END IF;

    -- Sync end times
    IF NEW.end_time IS NOT NULL AND NEW.ended_at IS NULL THEN
        NEW.ended_at := to_timestamp(NEW.end_time);
    END IF;
    IF NEW.ended_at IS NOT NULL AND NEW.end_time IS NULL THEN
        NEW.end_time := EXTRACT(EPOCH FROM NEW.ended_at)::INTEGER;
    END IF;

    -- Sync winner fields
    IF NEW.winner IS NOT NULL AND NEW.winning_team IS NULL THEN
        NEW.winning_team := NEW.winner;
    END IF;
    IF NEW.winning_team IS NOT NULL AND NEW.winner IS NULL THEN
        NEW.winner := NEW.winning_team;
    END IF;

    -- Sync storyteller fields
    IF NEW.storyteller_id IS NOT NULL AND NEW.storyteller_user_id IS NULL THEN
        NEW.storyteller_user_id := NEW.storyteller_id;
    END IF;
    IF NEW.storyteller_user_id IS NOT NULL AND NEW.storyteller_id IS NULL THEN
        NEW.storyteller_id := NEW.storyteller_user_id;
    END IF;

    -- Sync player count fields
    IF NEW.player_count IS NOT NULL AND NEW.num_players IS NULL THEN
        NEW.num_players := NEW.player_count;
    END IF;
    IF NEW.num_players IS NOT NULL AND NEW.player_count IS NULL THEN
        NEW.player_count := NEW.num_players;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_game_timestamps_trigger
    BEFORE INSERT OR UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION sync_game_timestamps();

-- Sync player fields
CREATE OR REPLACE FUNCTION sync_player_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Sync discord ID fields
    IF NEW.discord_user_id IS NOT NULL AND NEW.discord_id IS NULL THEN
        NEW.discord_id := NEW.discord_user_id;
    END IF;
    IF NEW.discord_id IS NOT NULL AND NEW.discord_user_id IS NULL THEN
        NEW.discord_user_id := NEW.discord_id;
    END IF;

    -- Sync character_name to starting_role_name
    IF NEW.character_name IS NOT NULL AND NEW.starting_role_name IS NULL THEN
        NEW.starting_role_name := NEW.character_name;
    END IF;
    IF NEW.starting_role_name IS NOT NULL AND NEW.character_name IS NULL THEN
        NEW.character_name := NEW.starting_role_name;
    END IF;

    -- Sync alignment to starting_team
    IF NEW.alignment IS NOT NULL AND NEW.starting_team IS NULL THEN
        NEW.starting_team := NEW.alignment;
    END IF;
    IF NEW.starting_team IS NOT NULL AND NEW.alignment IS NULL THEN
        NEW.alignment := NEW.starting_team;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_player_fields_trigger
    BEFORE INSERT OR UPDATE ON game_players
    FOR EACH ROW
    EXECUTE FUNCTION sync_player_fields();
