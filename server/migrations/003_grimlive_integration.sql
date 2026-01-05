-- Add grimlive fields to games table
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS custom_name TEXT,
ADD COLUMN IF NOT EXISTS start_time INTEGER,  -- Unix timestamp for grimlive
ADD COLUMN IF NOT EXISTS end_time INTEGER,    -- Unix timestamp for grimlive
ADD COLUMN IF NOT EXISTS players JSONB,       -- JSON array of player objects for grimlive
ADD COLUMN IF NOT EXISTS player_count INTEGER,
ADD COLUMN IF NOT EXISTS storyteller_user_id BIGINT,  -- Duplicate of storyteller_id for compatibility
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS winner TEXT CHECK (winner IN ('good', 'evil')),
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

-- Add grimlive fields to sessions table
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS session_code TEXT UNIQUE;

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_games_is_active ON games(is_active);
CREATE INDEX IF NOT EXISTS idx_games_storyteller_user_id ON games(storyteller_user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_session_code ON sessions(session_code);

-- ============================================================================
-- AUTO-SYNCING TRIGGERS (keep both services compatible)
-- ============================================================================

-- Trigger to sync timestamp formats between grimkeeper (PostgreSQL) and grimlive (Unix)
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

-- Attach trigger to games table
DROP TRIGGER IF EXISTS sync_game_timestamps_trigger ON games;
CREATE TRIGGER sync_game_timestamps_trigger
    BEFORE INSERT OR UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION sync_game_timestamps();

-- Trigger to sync game_players fields
CREATE OR REPLACE FUNCTION sync_player_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Sync discord ID fields (compatibility naming)
    IF NEW.discord_user_id IS NOT NULL AND NEW.discord_id IS NULL THEN
        NEW.discord_id := NEW.discord_user_id;
    END IF;
    IF NEW.discord_id IS NOT NULL AND NEW.discord_user_id IS NULL THEN
        NEW.discord_user_id := NEW.discord_id;
    END IF;

    -- Sync legacy character_name to starting_role_name
    IF NEW.character_name IS NOT NULL AND NEW.starting_role_name IS NULL THEN
        NEW.starting_role_name := NEW.character_name;
    END IF;
    IF NEW.starting_role_name IS NOT NULL AND NEW.character_name IS NULL THEN
        NEW.character_name := NEW.starting_role_name;
    END IF;

    -- Sync legacy alignment to starting_team
    IF NEW.alignment IS NOT NULL AND NEW.starting_team IS NULL THEN
        NEW.starting_team := NEW.alignment;
    END IF;
    IF NEW.starting_team IS NOT NULL AND NEW.alignment IS NULL THEN
        NEW.alignment := NEW.starting_team;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to game_players table
DROP TRIGGER IF EXISTS sync_player_fields_trigger ON game_players;
CREATE TRIGGER sync_player_fields_trigger
    BEFORE INSERT OR UPDATE ON game_players
    FOR EACH ROW
    EXECUTE FUNCTION sync_player_fields();

-- ============================================================================
-- API KEYS (for public read-only API)
-- ============================================================================

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

-- API usage tracking
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

-- ============================================================================
-- ANNOUNCEMENTS QUEUE (already exists in grimkeeper 017, but ensure it has what we need)
-- ============================================================================

-- Check if announcements table needs game_id column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'announcements' AND column_name = 'game_id'
    ) THEN
        ALTER TABLE announcements ADD COLUMN game_id INTEGER REFERENCES games(game_id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_announcements_game_id ON announcements(game_id);
    END IF;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN games.start_time IS 'Unix timestamp used by grimlive (auto-synced with started_at)';
COMMENT ON COLUMN games.started_at IS 'PostgreSQL timestamp used by grimkeeper (auto-synced with start_time)';
COMMENT ON COLUMN games.winner IS 'Winner field used by grimlive (auto-synced with winning_team)';
COMMENT ON COLUMN games.winning_team IS 'Winner field used by grimkeeper (auto-synced with winner)';
COMMENT ON COLUMN games.is_active IS 'Whether game is currently active (used by grimlive)';
COMMENT ON COLUMN games.players IS 'JSON array of player objects (used by grimlive)';
COMMENT ON TABLE api_keys IS 'API keys for third-party developer access to read-only endpoints';
COMMENT ON TABLE api_key_usage IS 'Tracks API usage for rate limiting and analytics';
