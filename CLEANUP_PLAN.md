# Backend Migration Cleanup Plan

## Files to Remove

### 1. Node.js Backend (server/)
- **Entire directory**: `server/`
  - All 16 JavaScript files (~4000 lines)
  - node_modules (backend-specific)
  - package.json (backend-specific)

### 2. Backend Tests
- `tests/unit/GameService.test.js` - Tests Node.js GameService
- `tests/unit/SessionService.test.js` - Tests Node.js SessionService
- `tests/unit/TimerService.test.js` - Tests Node.js TimerService
- `tests/integration/handler-service.test.js` - Tests Node.js API handlers
- **Keep**: `tests/integration/role-distribution.test.js` - Frontend logic test (not backend)

### 3. E2E Tests (may be reusable)
- Review and potentially keep for Rust backend testing

### 4. GitHub Actions
- **Update**: `.github/workflows/ci.yml` - Remove backend unit tests
- **Update**: `.github/workflows/deploy-backend.yml` - Change to Rust deployment
- **Keep**: `.github/workflows/deploy.yml` - Frontend deployment
- **Keep**: `.github/workflows/linter.yml` - Linting
- **Keep**: `.github/workflows/changelog-check.yml` - Changelog

### 5. Scripts
- Review `scripts/deploy-integration.sh` - Update for Rust backend

### 6. Dependencies (package.json)
- Remove backend-only dependencies:
  - `pg` (PostgreSQL client - only needed in server/)
  - `prom-client` (Prometheus metrics - only in server/)

## Execution Order

1. ✅ Backup (git commit current state)
2. Remove backend test files
3. Remove server/ directory
4. Update package.json
5. Update GitHub Actions
6. Update deployment scripts
7. Test frontend still works
8. Commit changes

## Risk Assessment

**Low Risk:**
- Frontend is completely independent
- Database schema unchanged
- Rust backend is drop-in replacement

**Rollback Plan:**
- Git revert if issues
- Node.js code still in git history
