mod config;
mod database;
mod error;
mod handlers;
mod models;
mod services;
mod state;
mod utils;

use axum::{
    extract::Request,
    http::{header, Method},
    middleware,
    response::Response,
    routing::{get, post},
    Router,
};
use std::time::Duration;
use tower::ServiceBuilder;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

use crate::{
    config::Config,
    database::Database,
    handlers::{api, auth, health, websocket as ws_handler},
    state::AppState,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber)?;

    // Load configuration
    dotenvy::dotenv().ok();
    let config = Config::from_env()?;
    info!("Configuration loaded");

    // Initialize database
    let database = Database::new(&config.database_url).await?;
    database.run_migrations().await?;
    info!("Database connected and migrations applied");

    // Initialize services
    let services = services::ServiceContainer::new(database.clone());
    info!("Services initialized");

    // Create shared application state
    let state = AppState::new(config.clone(), database, services);

    // Build router
    let app = Router::new()
        // Health check
        .route("/health", get(health::health_check))
        
        // WebSocket endpoint
        .route("/", get(ws_handler::websocket_handler))
        
        // Auth endpoints
        .route("/auth/discord", get(auth::discord_oauth))
        .route("/auth/discord/callback", get(auth::discord_callback))
        
        // API v1 endpoints
        .route("/api/v1/games", get(api::v1::get_games))
        .route("/api/v1/games/:id", get(api::v1::get_game_by_id))
        .route("/api/v1/stats/summary", get(api::v1::get_stats_summary))
        .route("/api/v1/players/:discord_id/stats", get(api::v1::get_player_stats))
        .route("/api/v1/scripts/:script_name/stats", get(api::v1::get_script_stats))
        
        // API key management
        .route("/api/v1/keys", get(api::v1::list_api_keys))
        .route("/api/v1/keys/create", post(api::v1::create_api_key))
        .route("/api/v1/keys/:key_id", post(api::v1::update_api_key))
        .route("/api/v1/keys/:key_id", axum::routing::delete(api::v1::delete_api_key))
        
        // Middleware
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(
                    CorsLayer::new()
                        .allow_origin(Any)
                        .allow_methods([Method::GET, Method::POST, Method::OPTIONS, Method::DELETE, Method::PATCH])
                        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION, header::HeaderName::from_static("x-api-key")])
                        .max_age(Duration::from_secs(86400)),
                )
                .layer(middleware::from_fn(security_headers)),
        )
        .with_state(state);

    // Start server
    let addr = format!("0.0.0.0:{}", config.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    
    info!("🚀 Server running on http://{}", addr);
    info!("Environment: {}", config.node_env);
    
    axum::serve(listener, app)
        .await?;

    Ok(())
}

/// Security headers middleware
async fn security_headers(request: Request, next: middleware::Next) -> Response {
    let mut response = next.run(request).await;
    let headers = response.headers_mut();
    
    headers.insert("X-Content-Type-Options", "nosniff".parse().unwrap());
    headers.insert("X-Frame-Options", "DENY".parse().unwrap());
    headers.insert("X-XSS-Protection", "1; mode=block".parse().unwrap());
    
    response
}
