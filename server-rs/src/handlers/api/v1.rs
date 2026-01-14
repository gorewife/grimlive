use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use sha2::{Sha256, Digest};
use crate::{
    error::{AppError, AppResult},
    models::{ApiKey, ApiKeyCreate, ApiKeyResponse, Game, StatsSummary},
    state::AppState,
};

// ============================================================================
// Middleware: Verify API Key
// ============================================================================

async fn verify_api_key(headers: &HeaderMap, state: &AppState) -> AppResult<ApiKey> {
    let api_key = headers
        .get("x-api-key")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::Unauthorized("Missing X-API-Key header".to_string()))?;

    // Hash the key
    let mut hasher = Sha256::new();
    hasher.update(api_key.as_bytes());
    let key_hash = format!("{:x}", hasher.finalize());

    // Look up key in database
    let api_key_record = sqlx::query_as::<_, ApiKey>(
        "SELECT id, discord_id, key_hash, name, rate_limit, is_active, created_at, last_used_at 
         FROM api_keys WHERE key_hash = $1 AND is_active = true"
    )
    .bind(&key_hash)
    .fetch_optional(&state.database.pool)
    .await?
    .ok_or_else(|| AppError::Unauthorized("Invalid API key".to_string()))?;

    // Check rate limit
    let allowed = state
        .services
        .rate_limit
        .check_rate_limit(
            &api_key_record.id.to_string(),
            api_key_record.rate_limit as u32,
            state.config.rate_limit_window_ms,
        )
        .await;

    if !allowed {
        return Err(AppError::RateLimitExceeded);
    }

    // Update last_used_at
    sqlx::query("UPDATE api_keys SET last_used_at = NOW() WHERE id = $1")
        .bind(api_key_record.id)
        .execute(&state.database.pool)
        .await?;

    Ok(api_key_record)
}

// ============================================================================
// Public Read-Only Endpoints (require API key)
// ============================================================================

#[derive(Deserialize)]
pub struct PaginationQuery {
    #[serde(default = "default_limit")]
    limit: i64,
    #[serde(default)]
    offset: i64,
}

fn default_limit() -> i64 {
    50
}

pub async fn get_games(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(pagination): Query<PaginationQuery>,
) -> AppResult<Json<Vec<Game>>> {
    verify_api_key(&headers, &state).await?;

    let games = state.services.game.get_games(pagination.limit, pagination.offset).await?;
    Ok(Json(games))
}

pub async fn get_game_by_id(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(game_id): Path<i32>,
) -> AppResult<Json<Game>> {
    verify_api_key(&headers, &state).await?;

    let game = state.services.game.get_game(game_id).await?
        .ok_or_else(|| AppError::NotFound("Game not found".to_string()))?;
    
    Ok(Json(game))
}

pub async fn get_stats_summary(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> AppResult<Json<StatsSummary>> {
    verify_api_key(&headers, &state).await?;

    let total_games = state.services.game.count_total_games().await?;
    let active_sessions = state.services.session.count_active_sessions().await?;

    let stats = StatsSummary {
        total_games,
        total_players: 0, // TODO: Implement
        unique_players: 0, // TODO: Implement
        active_sessions,
    };

    Ok(Json(stats))
}

pub async fn get_player_stats(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(discord_id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    verify_api_key(&headers, &state).await?;
    
    // TODO: Implement player stats query
    Ok(Json(serde_json::json!({
        "discord_id": discord_id,
        "message": "Not yet implemented"
    })))
}

pub async fn get_script_stats(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(script_name): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    verify_api_key(&headers, &state).await?;
    
    // TODO: Implement script stats query
    Ok(Json(serde_json::json!({
        "script_name": script_name,
        "message": "Not yet implemented"
    })))
}

// ============================================================================
// API Key Management (require session token - TODO)
// ============================================================================

pub async fn list_api_keys(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> AppResult<Json<Vec<ApiKey>>> {
    // TODO: Verify session token instead of API key
    Ok(Json(vec![]))
}

pub async fn create_api_key(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<ApiKeyCreate>,
) -> AppResult<Json<ApiKeyResponse>> {
    // TODO: Verify session token and get discord_id
    // For now, return error
    Err(AppError::Internal("Not yet implemented".to_string()))
}

pub async fn update_api_key(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(key_id): Path<i32>,
) -> AppResult<StatusCode> {
    // TODO: Implement
    Err(AppError::Internal("Not yet implemented".to_string()))
}

pub async fn delete_api_key(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(key_id): Path<i32>,
) -> AppResult<StatusCode> {
    // TODO: Implement
    Err(AppError::Internal("Not yet implemented".to_string()))
}
