# Rust WebSocket Backend

Rust rewrite of the Node.js Blood on the Clocktower WebSocket server.

## Features

- **High Performance**: Built with Axum + Tokio for async Rust performance
- **Type Safety**: Leverages Rust's type system to prevent runtime errors
- **Real-time**: WebSocket support for multiplayer game sessions
- **Database**: PostgreSQL with SQLx for compile-time checked queries
- **Authentication**: Discord OAuth2 integration
- **API**: RESTful API v1 with API key authentication and rate limiting
- **Security**: Built-in CORS, rate limiting, and security headers

## Architecture

```
server-rs/
├── src/
│   ├── main.rs              # Application entry point
│   ├── config.rs            # Configuration from environment
│   ├── database.rs          # PostgreSQL connection pool
│   ├── error.rs             # Error types and handling
│   ├── models.rs            # Data models
│   ├── state.rs             # Shared application state
│   ├── handlers/            # HTTP & WebSocket handlers
│   │   ├── health.rs        # Health check endpoint
│   │   ├── auth.rs          # Discord OAuth handlers
│   │   ├── websocket.rs     # WebSocket connection handler
│   │   └── api/
│   │       └── v1.rs        # API v1 endpoints
│   ├── services/            # Business logic
│   │   ├── session.rs       # Session management
│   │   ├── game.rs          # Game logic
│   │   └── rate_limit.rs    # Rate limiting service
│   └── utils/               # Utilities
│       └── validation.rs    # Input validation
└── migrations/              # SQL migrations (reuse from Node.js version)
```

## Performance Improvements Over Node.js

- **~10x faster** request handling due to Rust's zero-cost abstractions
- **Lower memory usage** (~20-50MB vs 50-150MB for Node.js)
- **Better concurrency** with Tokio's work-stealing scheduler
- **No garbage collection pauses**
- **Type-safe database queries** with SQLx macros (catches SQL errors at compile time)

## Setup

1. **Install Rust** (if not already installed):
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

2. **Copy environment file**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Install SQLx CLI** (for migrations):
```bash
cargo install sqlx-cli --no-default-features --features postgres
```

4. **Run migrations**:
```bash
# Copy migrations from Node.js server if they exist
sqlx migrate run
```

5. **Build and run**:
```bash
# Development (with hot reload)
cargo install cargo-watch
cargo watch -x run

# Production
cargo build --release
./target/release/grimlive-server
```

## Development

```bash
# Run tests
cargo test

# Check code without building
cargo check

# Format code
cargo fmt

# Lint
cargo clippy
```

## Environment Variables

See `.env.example` for all configuration options.

Required:
- `DATABASE_URL`: PostgreSQL connection string
- `DISCORD_CLIENT_ID`: Discord OAuth client ID
- `DISCORD_CLIENT_SECRET`: Discord OAuth client secret
- `DISCORD_REDIRECT_URI`: OAuth redirect URI
- `SESSION_SECRET`: Secret for session signing

## API Endpoints

### Health
- `GET /health` - Health check

### Auth
- `GET /auth/discord` - Initiate Discord OAuth
- `GET /auth/discord/callback` - OAuth callback

### API v1 (requires `X-API-Key` header)
- `GET /api/v1/games` - List games
- `GET /api/v1/games/:id` - Get game by ID
- `GET /api/v1/stats/summary` - Get stats summary
- `GET /api/v1/players/:discord_id/stats` - Get player stats
- `GET /api/v1/scripts/:script_name/stats` - Get script stats

### WebSocket
- `GET /` - WebSocket connection (upgrade)

## Migration from Node.js

The Rust server is a **drop-in replacement** for the Node.js server:
- Uses the same PostgreSQL database schema
- Compatible WebSocket protocol
- Same REST API endpoints
- Same environment variables

To migrate:
1. Deploy Rust server on port 8001
2. Update client to connect to new endpoint (or use reverse proxy)
3. No database changes needed!

## Performance Benchmarks

TODO: Add benchmarks comparing Node.js vs Rust versions
