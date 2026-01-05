-- This runs automatically when postgres container starts

-- Create grimkeeper tables
CREATE TABLE IF NOT EXISTS guilds (
    guild_id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    guild_id BIGINT NOT NULL,
    category_id BIGINT NOT NULL,
    destination_channel_id BIGINT,
    grimoire_link TEXT,
    exception_channel_id BIGINT,
    announce_channel_id BIGINT,
    active_game_id INTEGER,
    storyteller_user_id BIGINT,
    created_at TIMESTAMP DEFAULT NOW(),
    last_active INTEGER,
    session_code TEXT UNIQUE,
    PRIMARY KEY (guild_id, category_id)
);

CREATE TABLE IF NOT EXISTS games (
    game_id SERIAL PRIMARY KEY,
    guild_id BIGINT,
    category_id BIGINT,
    script TEXT NOT NULL,
    custom_name TEXT,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    winner TEXT,
    is_active BOOLEAN DEFAULT true,
    storyteller_id BIGINT,
    player_count INTEGER,
    players JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_players (
    game_id INTEGER REFERENCES games(game_id) ON DELETE CASCADE,
    discord_user_id BIGINT NOT NULL,
    character_name TEXT NOT NULL,
    alignment TEXT NOT NULL,
    PRIMARY KEY (game_id, discord_user_id)
);

CREATE TABLE IF NOT EXISTS timers (
    guild_id BIGINT NOT NULL,
    category_id BIGINT,
    duration INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    creator_user_id BIGINT NOT NULL,
    is_paused BOOLEAN DEFAULT false,
    pause_time INTEGER,
    PRIMARY KEY (guild_id, category_id)
);

-- Create web_sessions table for grimlive
CREATE TABLE IF NOT EXISTS web_sessions (
    session_id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    discord_user_id BIGINT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

-- Insert test data
INSERT INTO guilds (guild_id, name) VALUES 
    (123456789, 'Test Server 1'),
    (987654321, 'Test Server 2');

INSERT INTO sessions (guild_id, category_id, destination_channel_id, announce_channel_id, storyteller_user_id, session_code) VALUES
    (123456789, 111111111, 222222222, 333333333, 999888777, 's1'),
    (987654321, 444444444, 555555555, 666666666, 888777666, 's2');

COMMIT;
