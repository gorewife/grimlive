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
-- AUTO-SYNCING TRIGGERS (removed - no longer needed with unified schema)
-- ============================================================================

