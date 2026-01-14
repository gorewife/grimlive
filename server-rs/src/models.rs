use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ============================================================================
// Session Models
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Session {
    pub id: Uuid,
    pub host_discord_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub script_name: Option<String>,
}

// ============================================================================
// Game Models
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Game {
    pub id: i32,
    pub session_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub player_count: i32,
    pub script: Option<String>,
    pub winning_team: Option<String>,
    pub ended_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Player {
    pub id: i32,
    pub game_id: i32,
    pub discord_id: String,
    pub discord_username: String,
    pub character: String,
    pub team: String,
    pub died_at_night: Option<i32>,
    pub died_at_execution: Option<i32>,
    pub survived: bool,
}

// ============================================================================
// API Key Models
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ApiKey {
    pub id: i32,
    pub discord_id: String,
    pub key_hash: String,
    pub name: String,
    pub rate_limit: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiKeyCreate {
    pub name: String,
    pub rate_limit: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiKeyResponse {
    pub id: i32,
    pub name: String,
    pub key: String, // Only returned on creation
    pub rate_limit: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

// ============================================================================
// Stats Models
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct StatsSummary {
    pub total_games: i64,
    pub total_players: i64,
    pub unique_players: i64,
    pub active_sessions: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlayerStats {
    pub discord_id: String,
    pub discord_username: String,
    pub games_played: i64,
    pub wins: i64,
    pub losses: i64,
    pub survival_rate: f64,
    pub favorite_character: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScriptStats {
    pub script_name: String,
    pub games_played: i64,
    pub townsfolk_wins: i64,
    pub evil_wins: i64,
    pub average_player_count: f64,
}

// ============================================================================
// WebSocket Messages
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum WsMessage {
    Connect {
        session_id: String,
        discord_id: Option<String>,
        username: Option<String>,
    },
    GameState {
        players: Vec<WsPlayer>,
        night: i32,
        phase: String,
    },
    PlayerUpdate {
        player: WsPlayer,
    },
    Timer {
        duration: i32,
        remaining: i32,
    },
    Chat {
        from: String,
        message: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsPlayer {
    pub id: String,
    pub name: String,
    pub character: Option<String>,
    pub is_dead: bool,
    pub is_storyteller: bool,
}
