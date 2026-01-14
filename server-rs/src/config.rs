use anyhow::{Context, Result};
use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub node_env: String,
    pub port: u16,
    pub ssl_enabled: bool,
    pub database_url: String,
    pub discord_client_id: String,
    pub discord_client_secret: String,
    pub discord_redirect_uri: String,
    pub session_secret: String,
    pub rate_limit_window_ms: u64,
    pub rate_limit_max_requests: u32,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            node_env: env::var("NODE_ENV").unwrap_or_else(|_| "production".to_string()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "8001".to_string())
                .parse()
                .context("Invalid PORT")?,
            ssl_enabled: env::var("SSL_ENABLED")
                .unwrap_or_else(|_| "false".to_string())
                .parse()
                .unwrap_or(false),
            database_url: env::var("DATABASE_URL")
                .context("DATABASE_URL must be set")?,
            discord_client_id: env::var("DISCORD_CLIENT_ID")
                .context("DISCORD_CLIENT_ID must be set")?,
            discord_client_secret: env::var("DISCORD_CLIENT_SECRET")
                .context("DISCORD_CLIENT_SECRET must be set")?,
            discord_redirect_uri: env::var("DISCORD_REDIRECT_URI")
                .context("DISCORD_REDIRECT_URI must be set")?,
            session_secret: env::var("SESSION_SECRET")
                .context("SESSION_SECRET must be set")?,
            rate_limit_window_ms: env::var("RATE_LIMIT_WINDOW_MS")
                .unwrap_or_else(|_| "60000".to_string())
                .parse()
                .unwrap_or(60000),
            rate_limit_max_requests: env::var("RATE_LIMIT_MAX_REQUESTS")
                .unwrap_or_else(|_| "100".to_string())
                .parse()
                .unwrap_or(100),
        })
    }
    
    pub fn is_development(&self) -> bool {
        self.node_env == "development"
    }
}
