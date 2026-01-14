use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Redirect},
    Json,
};
use serde::{Deserialize, Serialize};
use crate::{error::AppResult, state::AppState};

#[derive(Deserialize)]
pub struct DiscordCallbackQuery {
    code: Option<String>,
    error: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct DiscordTokenResponse {
    access_token: String,
    token_type: String,
    expires_in: i64,
    refresh_token: String,
    scope: String,
}

pub async fn discord_oauth(State(state): State<AppState>) -> impl IntoResponse {
    let redirect_url = format!(
        "https://discord.com/api/oauth2/authorize?client_id={}&redirect_uri={}&response_type=code&scope=identify",
        state.config.discord_client_id,
        urlencoding::encode(&state.config.discord_redirect_uri)
    );

    Redirect::temporary(&redirect_url)
}

pub async fn discord_callback(
    State(state): State<AppState>,
    Query(query): Query<DiscordCallbackQuery>,
) -> AppResult<impl IntoResponse> {
    if let Some(error) = query.error {
        return Ok((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": error }))
        ));
    }

    let code = query.code.ok_or_else(|| {
        crate::error::AppError::BadRequest("Missing authorization code".to_string())
    })?;

    // Exchange code for token
    let client = reqwest::Client::new();
    let token_response = client
        .post("https://discord.com/api/oauth2/token")
        .form(&[
            ("client_id", state.config.discord_client_id.as_str()),
            ("client_secret", state.config.discord_client_secret.as_str()),
            ("grant_type", "authorization_code"),
            ("code", &code),
            ("redirect_uri", &state.config.discord_redirect_uri),
        ])
        .send()
        .await
        .map_err(|e| crate::error::AppError::Internal(format!("Discord API error: {}", e)))?;

    if !token_response.status().is_success() {
        return Err(crate::error::AppError::Internal("Discord token exchange failed".to_string()));
    }

    let token_data: DiscordTokenResponse = token_response
        .json()
        .await
        .map_err(|e| crate::error::AppError::Internal(format!("Failed to parse Discord response: {}", e)))?;

    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "access_token": token_data.access_token,
            "token_type": token_data.token_type,
        }))
    ))
}
