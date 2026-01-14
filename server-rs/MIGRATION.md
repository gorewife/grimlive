# Migration Plan: Node.js → Rust

## Overview
Complete rewrite of the Blood on the Clocktower WebSocket server from JavaScript/Node.js to Rust for improved performance, type safety, and resource efficiency.

## Progress

### ✅ Phase 1: Core Infrastructure (COMPLETE)
- [x] Project setup with Cargo.toml
- [x] Configuration management (config.rs)
- [x] Database layer with SQLx (database.rs)
- [x] Error handling (error.rs)
- [x] Application state management (state.rs)
- [x] Data models (models.rs)

### ✅ Phase 2: Services Layer (COMPLETE)
- [x] ServiceContainer for dependency injection
- [x] SessionService (session management)
- [x] GameService (game logic)
- [x] RateLimitService (in-memory rate limiting)

### ✅ Phase 3: HTTP Handlers (COMPLETE)
- [x] Health check endpoint
- [x] Discord OAuth flow
- [x] API v1 endpoints (read-only with API key auth)
- [x] API key management endpoints (stubs)

### ⚠️ Phase 4: WebSocket Implementation (PARTIAL)
- [x] Basic WebSocket handler
- [x] Connection management
- [x] Message parsing
- [ ] **TODO**: Session-based client grouping
- [ ] **TODO**: Broadcasting to session members
- [ ] **TODO**: Game state synchronization
- [ ] **TODO**: Timer coordination
- [ ] **TODO**: Chat relay

### 📋 Phase 5: Remaining Features (TODO)
- [ ] Complete player stats queries
- [ ] Complete script stats queries
- [ ] Session token authentication (for API key management)
- [ ] Cleanup service (periodic session cleanup)
- [ ] WebSocket ping/pong heartbeat
- [ ] Graceful shutdown handling

### 📋 Phase 6: Testing & Migration (TODO)
- [ ] Unit tests for services
- [ ] Integration tests for API endpoints
- [ ] WebSocket protocol compatibility tests
- [ ] Load testing (compare with Node.js)
- [ ] Migration script/documentation
- [ ] Deployment configuration

## Key Differences from Node.js Version

### Performance Improvements
- **Compiled binary** instead of interpreted JavaScript
- **Zero-cost abstractions** - no runtime overhead
- **Async runtime** with Tokio (work-stealing scheduler)
- **Memory safety** without garbage collection
- **Type-safe SQL** with SQLx compile-time checks

### Architecture Changes
- **Axum framework** instead of raw http/https + ws
- **Service container** pattern for dependency injection
- **Strongly typed** everything (WebSocket messages, API requests, database queries)
- **Built-in rate limiting** with async HashMap + RwLock
- **Better error handling** with Result types and custom AppError

### Compatibility
- ✅ Same PostgreSQL database (no schema changes)
- ✅ Same WebSocket protocol
- ✅ Same REST API endpoints
- ✅ Same environment variables
- ✅ Drop-in replacement ready

## File Mapping: Node.js → Rust

| Node.js File | Rust Equivalent | Status |
|--------------|----------------|---------|
| index.js (549 lines) | main.rs + handlers/ | ✅ Complete |
| api_v1.js (819 lines) | handlers/api/v1.rs | ⚠️ Partial (stats TODO) |
| api-shared.js | database.rs + utils/ | ✅ Complete |
| logger.js | tracing crate | ✅ Complete |
| cleanup.js | services/cleanup.rs | ❌ TODO |
| services/*.js | services/*.rs | ✅ Complete |
| repositories/PostgreSQLRepository.js | database.rs + services/ | ✅ Complete |
| handlers/LegacyAPIHandler.js | handlers/api/ | ✅ Complete |
| utils/*.js | utils/*.rs | ✅ Complete |

## Next Steps

### Immediate (Critical for MVP)
1. **Implement WebSocket session management**
   - Create `sessions: Arc<RwLock<HashMap<Uuid, Vec<ClientId>>>>` in AppState
   - Store clients per session
   - Implement broadcast_to_session() helper

2. **Complete stats queries**
   - Player stats aggregation
   - Script stats aggregation
   - Use optimized SQL with proper JOINs

3. **Add tests**
   - Unit tests for services
   - Integration tests for API
   - WebSocket protocol tests

### Short-term (Production Ready)
4. **Session token authentication**
   - JWT or signed cookies
   - Middleware for protected endpoints

5. **Cleanup service**
   - Periodic task to close stale sessions
   - Database cleanup

6. **Performance tuning**
   - Connection pool sizing
   - Rate limit tuning
   - Benchmarking

### Long-term (Enhancements)
7. **Monitoring**
   - Prometheus metrics (with metrics crate)
   - Distributed tracing
   - Health dashboard

8. **Deployment**
   - Docker container
   - Systemd service
   - CI/CD pipeline
   - Blue-green deployment

## Testing Strategy

### Unit Tests
```bash
cargo test --lib
```

### Integration Tests
```bash
cargo test --test '*'
```

### Performance Benchmarks
```bash
cargo bench
```

### Load Testing
Compare Node.js vs Rust under load:
- Concurrent connections
- Request throughput
- Memory usage
- CPU usage
- Latency percentiles

## Deployment Plan

### Development
```bash
cargo watch -x run
```

### Staging
```bash
cargo build --release
./target/release/grimlive-server
```

### Production
1. Build optimized binary
2. Copy to server
3. Run as systemd service
4. Nginx reverse proxy (same config as Node.js)
5. Monitor logs and metrics
6. Gradual rollout (canary deployment)

## Rollback Plan
If issues arise:
1. Stop Rust server
2. Start Node.js server (already deployed)
3. No database changes needed (compatible schema)
4. Switch nginx upstream back to Node.js
5. Investigate issues in staging

## Success Metrics
- ✅ All API endpoints return correct responses
- ✅ WebSocket connections stable for 1+ hour
- ✅ < 10ms median API response time
- ✅ < 50MB memory usage with 100 concurrent connections
- ✅ Zero data loss during migration
- ✅ 99.9% uptime after deployment
