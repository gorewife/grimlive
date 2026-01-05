CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- GRIMKEEPER BASE SCHEMA (from migration 012)
-- ============================================================================

-- Guilds table
CREATE TABLE IF NOT EXISTS guilds (
    guild_id BIGINT PRIMARY KEY,
    grimoire_link TEXT,
    active_session_id UUID,
    language VARCHAR(5) DEFAULT 'en' NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_guilds_language ON guilds(language);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id BIGINT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
    category_id BIGINT NOT NULL,
    town_square_channel_id BIGINT,
    grimoire_link TEXT,
    destination_channel_id BIGINT,
    announce_channel_id BIGINT,
    exception_channel_id BIGINT,
    active_game_id INTEGER,
    storyteller_user_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active INTEGER,  -- Unix timestamp
    vc_caps JSONB DEFAULT '{}'::jsonb,
    session_code TEXT UNIQUE,
    UNIQUE(guild_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_guild_id ON sessions(guild_id);
CREATE INDEX IF NOT EXISTS idx_sessions_category_id ON sessions(category_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active_game_id ON sessions(active_game_id);
CREATE INDEX IF NOT EXISTS idx_sessions_session_code ON sessions(session_code);

-- Games table (unified for both services)
CREATE TABLE IF NOT EXISTS games (
    game_id SERIAL PRIMARY KEY,
    guild_id BIGINT REFERENCES guilds(guild_id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(session_id) ON DELETE SET NULL,
    category_id BIGINT,
    
    -- Grimkeeper fields
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    script TEXT,
    num_players INTEGER,
    storyteller_id BIGINT,
    winning_team TEXT CHECK (winning_team IN ('good', 'evil')),
    duration_minutes INTEGER,
    
    -- Grimlive fields
    custom_name TEXT,
    start_time INTEGER,  -- Unix timestamp (auto-synced with started_at)
    end_time INTEGER,    -- Unix timestamp (auto-synced with ended_at)
    players JSONB,
    player_count INTEGER,
    storyteller_user_id BIGINT,  -- Auto-synced with storyteller_id
    is_active BOOLEAN DEFAULT false,
    winner TEXT CHECK (winner IN ('good', 'evil')),  -- Auto-synced with winning_team
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_games_guild_id ON games(guild_id);
CREATE INDEX IF NOT EXISTS idx_games_storyteller_id ON games(storyteller_id);
CREATE INDEX IF NOT EXISTS idx_games_storyteller_user_id ON games(storyteller_user_id);
CREATE INDEX IF NOT EXISTS idx_games_started_at ON games(started_at);
CREATE INDEX IF NOT EXISTS idx_games_session_id ON games(session_id);
CREATE INDEX IF NOT EXISTS idx_games_category_id ON games(category_id);
CREATE INDEX IF NOT EXISTS idx_games_is_active ON games(is_active);

-- Add FK for sessions.active_game_id after games table exists
ALTER TABLE sessions ADD CONSTRAINT sessions_active_game_id_fkey 
    FOREIGN KEY (active_game_id) REFERENCES games(game_id) ON DELETE SET NULL;

-- Storyteller stats
CREATE TABLE IF NOT EXISTS storyteller_stats (
    guild_id BIGINT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
    storyteller_id BIGINT NOT NULL,
    games_run INTEGER DEFAULT 0,
    total_minutes INTEGER DEFAULT 0,
    good_wins INTEGER DEFAULT 0,
    evil_wins INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, storyteller_id)
);

-- Timers
CREATE TABLE IF NOT EXISTS timers (
    timer_id SERIAL PRIMARY KEY,
    guild_id BIGINT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
    category_id BIGINT,
    channel_id BIGINT NOT NULL,
    message_id BIGINT NOT NULL UNIQUE,
    phase TEXT NOT NULL CHECK (phase IN ('nomination', 'discussion', 'private', 'unknown')),
    duration_seconds INTEGER NOT NULL,
    end_time TIMESTAMP NOT NULL,
    is_paused BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_timers_guild_id ON timers(guild_id);
CREATE INDEX IF NOT EXISTS idx_timers_category_id ON timers(category_id);

-- ============================================================================
-- GRIMLIVE TABLES (from migrations 001-002)
-- ============================================================================

-- Web sessions
CREATE TABLE IF NOT EXISTS web_sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token TEXT UNIQUE NOT NULL,
    discord_user_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
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
