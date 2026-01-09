import crypto from 'crypto';
import { logger } from './logger.js';
import { ValidationUtils } from './utils/ValidationUtils.js';
import {
  pool,
  parseBody,
  jsonResponse,
  normalizeGameData,
  normalizePlayerData,
  getGameWithPlayers,
  logApiCall
} from './api-shared.js';

logger.info('API v1 initialized (read-only public endpoints)');

// ============================================================================
// AUTHENTICATION & RATE LIMITING
// ============================================================================

// In-memory rate limiting
const rateLimitStore = new Map();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.resetTime > 300000) { // 5 minutes
      rateLimitStore.delete(key);
    }
  }
}, 300000);

/**
 * Verify API key and check rate limits
 * @param {Request} req - HTTP request
 * @returns {Object} { valid: boolean, keyId: number, rateLimit: number, error?: string }
 */
async function verifyApiKey(req) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return { valid: false, error: 'Missing X-API-Key header' };
  }

  // Hash the provided key
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  try {
    // Check if key exists and is active
    const result = await pool.query(
      'SELECT id, rate_limit, is_active FROM api_keys WHERE key_hash = $1',
      [keyHash]
    );

    if (!result.rows.length) {
      return { valid: false, error: 'Invalid API key' };
    }

    const { id, rate_limit, is_active } = result.rows[0];

    if (!is_active) {
      return { valid: false, error: 'API key has been deactivated' };
    }

    // Check rate limit
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window
    const rateLimitKey = `key_${id}`;
    
    let requestLog = rateLimitStore.get(rateLimitKey);
    if (!requestLog) {
      requestLog = { requests: [], resetTime: now };
      rateLimitStore.set(rateLimitKey, requestLog);
    }

    // Remove old requests outside the window
    requestLog.requests = requestLog.requests.filter(t => t > windowStart);

    if (requestLog.requests.length >= rate_limit) {
      return { 
        valid: false, 
        error: 'Rate limit exceeded',
        rateLimit: rate_limit,
        remaining: 0
      };
    }

    // Add current request
    requestLog.requests.push(now);
    requestLog.resetTime = now;

    // Update last_used_at in database (don't await to avoid blocking)
    pool.query(
      'UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    ).catch(err => logger.error('Failed to update last_used_at:', err));

    return { 
      valid: true, 
      keyId: id, 
      rateLimit: rate_limit,
      remaining: rate_limit - requestLog.requests.length
    };
  } catch (error) {
    logger.error('API key verification error:', error);
    return { valid: false, error: 'Internal server error' };
  }
}

/**
 * Log API usage for analytics
 */
async function logApiUsage(keyId, endpoint, method, status, ipAddress) {
  try {
    await pool.query(
      'INSERT INTO api_key_usage (api_key_id, endpoint, method, response_status, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [keyId, endpoint, method, status, ipAddress]
    );
  } catch (error) {
    logger.error('Failed to log API usage:', error);
  }
}

// ============================================================================
// READ-ONLY ENDPOINTS (v1)
// ============================================================================

export const apiV1 = {
  /**
   * GET /api/v1/games
   * List games with pagination and filters
   */
  getGames: async (req) => {
    const auth = await verifyApiKey(req);
    
    if (!auth.valid) {
      return jsonResponse({ error: auth.error }, 401);
    }

    // Parse query parameters
    const url = new URL(req.url, `http://${req.headers.host}`);
    const params = url.searchParams;
    
    // P1-18: Use ValidationUtils for pagination validation
    const limitParam = params.get('limit');
    const offsetParam = params.get('offset');
    const paginationValidation = ValidationUtils.validatePagination(
      limitParam ? parseInt(limitParam, 10) : null,
      offsetParam ? parseInt(offsetParam, 10) : null
    );
    
    if (!paginationValidation.valid) {
      return jsonResponse({ error: paginationValidation.errors[0] }, 400);
    }
    
    const { limit, offset } = paginationValidation.sanitized;
    const script = params.get('script'); // Filter by script
    const winner = params.get('winner'); // Filter by winner (good/evil)
    const startDate = params.get('start_date'); // ISO date
    const endDate = params.get('end_date'); // ISO date

    try {
      // Build query
      let query = 'SELECT g.*, COUNT(*) OVER() AS total_count FROM games g WHERE 1=1';
      const queryParams = [];
      let paramIndex = 1;

      if (script) {
        query += ` AND g.script = $${paramIndex++}`;
        queryParams.push(script);
      }

      if (winner) {
        query += ` AND g.winner = $${paramIndex++}`;
        queryParams.push(winner);
      }

      if (startDate) {
        query += ` AND g.start_time >= $${paramIndex++}`;
        queryParams.push(startDate);
      }

      if (endDate) {
        query += ` AND g.start_time <= $${paramIndex++}`;
        queryParams.push(endDate);
      }

      query += ` ORDER BY g.start_time DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      queryParams.push(limit, offset);

      const result = await pool.query(query, queryParams);
      
      const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
      const games = result.rows.map(row => {
        const { total_count, ...game } = row;
        return game;
      });

      // Log usage
      logApiUsage(auth.keyId, '/api/v1/games', 'GET', 200, req.socket.remoteAddress);

      return jsonResponse({
        data: games,
        pagination: {
          limit,
          offset,
          total: totalCount,
          hasMore: offset + limit < totalCount
        },
        meta: {
          rateLimit: {
            limit: auth.rateLimit,
            remaining: auth.remaining
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching games:', error);
      logApiUsage(auth.keyId, '/api/v1/games', 'GET', 500, req.socket.remoteAddress);
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  },

  /**
   * GET /api/v1/games/:id
   * Get detailed information about a specific game
   */
  getGameById: async (req, gameId) => {
    const auth = await verifyApiKey(req);
    
    if (!auth.valid) {
      return jsonResponse({ error: auth.error }, 401);
    }

    try {
      // Get game details
      const gameResult = await pool.query(
        'SELECT * FROM games WHERE game_id = $1',
        [gameId]
      );

      if (!gameResult.rows.length) {
        logApiUsage(auth.keyId, `/api/v1/games/${gameId}`, 'GET', 404, req.socket.remoteAddress);
        return jsonResponse({ error: 'Game not found' }, 404);
      }

      // Use shared normalization for consistency with legacy API
      const game = await getGameWithPlayers(gameId);

      logApiUsage(auth.keyId, `/api/v1/games/${gameId}`, 'GET', 200, req.socket.remoteAddress);

      return jsonResponse({
        data: game,
        meta: {
          rateLimit: {
            limit: auth.rateLimit,
            remaining: auth.remaining
          },
          api_version: '1.0',
          compatible_with: 'grimkeeper-legacy-api'
        }
      });
    } catch (error) {
      logger.error('Error fetching game:', error);
      logApiUsage(auth.keyId, `/api/v1/games/${gameId}`, 'GET', 500, req.socket.remoteAddress);
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  },

  /**
   * GET /api/v1/stats/summary
   * Get aggregate statistics across all games
   */
  getStatsSummary: async (req) => {
    const auth = await verifyApiKey(req);
    
    if (!auth.valid) {
      return jsonResponse({ error: auth.error }, 401);
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const params = url.searchParams;
    const script = params.get('script');

    try {
      let statsQuery = `
        SELECT 
          COUNT(*) as total_games,
          COUNT(CASE WHEN winner = 'good' THEN 1 END) as good_wins,
          COUNT(CASE WHEN winner = 'evil' THEN 1 END) as evil_wins,
          AVG(player_count) as avg_player_count,
          AVG(EXTRACT(EPOCH FROM (completed_at - start_time))) as avg_game_duration_seconds
        FROM games 
        WHERE completed_at IS NOT NULL
      `;
      const queryParams = [];
      
      if (script) {
        statsQuery += ' AND script = $1';
        queryParams.push(script);
      }

      const statsResult = await pool.query(statsQuery, queryParams);
      const stats = statsResult.rows[0];

      // Get most played scripts
      let scriptsQuery = `
        SELECT script, COUNT(*) as count
        FROM games
        WHERE completed_at IS NOT NULL
      `;
      if (script) {
        scriptsQuery += ' AND script = $1';
      }
      scriptsQuery += ' GROUP BY script ORDER BY count DESC LIMIT 10';
      
      const scriptsResult = await pool.query(scriptsQuery, queryParams);

      // Get role statistics
      let rolesQuery = `
        SELECT 
          starting_role as role,
          COUNT(*) as times_played,
          COUNT(CASE WHEN winning_team = starting_team THEN 1 END) as wins
        FROM game_players gp
        JOIN games g ON gp.game_id = g.game_id
        WHERE g.completed_at IS NOT NULL
      `;
      if (script) {
        rolesQuery += ' AND g.script = $1';
      }
      rolesQuery += ' GROUP BY starting_role ORDER BY times_played DESC LIMIT 20';
      
      const rolesResult = await pool.query(rolesQuery, queryParams);

      logApiUsage(auth.keyId, '/api/v1/stats/summary', 'GET', 200, req.socket.remoteAddress);

      return jsonResponse({
        data: {
          overall: {
            totalGames: parseInt(stats.total_games),
            goodWins: parseInt(stats.good_wins),
            evilWins: parseInt(stats.evil_wins),
            goodWinRate: stats.total_games > 0 ? 
              (parseInt(stats.good_wins) / parseInt(stats.total_games) * 100).toFixed(2) + '%' : '0%',
            avgPlayerCount: stats.avg_player_count ? parseFloat(stats.avg_player_count).toFixed(1) : 0,
            avgGameDuration: stats.avg_game_duration_seconds ? 
              Math.round(parseFloat(stats.avg_game_duration_seconds)) : 0
          },
          topScripts: scriptsResult.rows,
          topRoles: rolesResult.rows.map(row => ({
            role: row.role,
            timesPlayed: parseInt(row.times_played),
            wins: parseInt(row.wins),
            winRate: ((parseInt(row.wins) / parseInt(row.times_played)) * 100).toFixed(2) + '%'
          }))
        },
        meta: {
          rateLimit: {
            limit: auth.rateLimit,
            remaining: auth.remaining
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching stats:', error);
      logApiUsage(auth.keyId, '/api/v1/stats/summary', 'GET', 500, req.socket.remoteAddress);
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  },

  /**
   * GET /api/v1/players/:discordId/stats
   * Get statistics for a specific player
   */
  getPlayerStats: async (req, discordId) => {
    const auth = await verifyApiKey(req);
    
    if (!auth.valid) {
      return jsonResponse({ error: auth.error }, 401);
    }

    try {
      // Get player's game statistics
      const statsQuery = `
        SELECT 
          COUNT(*) as total_games,
          COUNT(CASE WHEN gp.winning_team = gp.starting_team THEN 1 END) as wins,
          COUNT(CASE WHEN gp.starting_team = 'good' THEN 1 END) as good_games,
          COUNT(CASE WHEN gp.starting_team = 'evil' THEN 1 END) as evil_games,
          COUNT(CASE WHEN gp.winning_team = gp.starting_team AND gp.starting_team = 'good' THEN 1 END) as good_wins,
          COUNT(CASE WHEN gp.winning_team = gp.starting_team AND gp.starting_team = 'evil' THEN 1 END) as evil_wins
        FROM game_players gp
        JOIN games g ON gp.game_id = g.game_id
        WHERE gp.discord_user_id = $1 AND g.completed_at IS NOT NULL
      `;
      
      const statsResult = await pool.query(statsQuery, [discordId]);
      const stats = statsResult.rows[0];

      if (parseInt(stats.total_games) === 0) {
        logApiUsage(auth.keyId, `/api/v1/players/${discordId}/stats`, 'GET', 404, req.socket.remoteAddress);
        return jsonResponse({ error: 'Player not found or has no completed games' }, 404);
      }

      // Get role breakdown
      const rolesQuery = `
        SELECT 
          starting_role as role,
          COUNT(*) as times_played,
          COUNT(CASE WHEN winning_team = starting_team THEN 1 END) as wins
        FROM game_players gp
        JOIN games g ON gp.game_id = g.game_id
        WHERE gp.discord_user_id = $1 AND g.completed_at IS NOT NULL
        GROUP BY starting_role
        ORDER BY times_played DESC
      `;
      
      const rolesResult = await pool.query(rolesQuery, [discordId]);

      // Get recent games
      const recentGamesQuery = `
        SELECT 
          g.game_id,
          g.script,
          g.winner,
          g.start_time,
          g.completed_at,
          gp.starting_role,
          gp.starting_team,
          gp.winning_team,
          CASE WHEN gp.winning_team = gp.starting_team THEN true ELSE false END as won
        FROM game_players gp
        JOIN games g ON gp.game_id = g.game_id
        WHERE gp.discord_user_id = $1 AND g.completed_at IS NOT NULL
        ORDER BY g.completed_at DESC
        LIMIT 10
      `;
      
      const recentGamesResult = await pool.query(recentGamesQuery, [discordId]);

      logApiUsage(auth.keyId, `/api/v1/players/${discordId}/stats`, 'GET', 200, req.socket.remoteAddress);

      return jsonResponse({
        data: {
          discordUserId: discordId,
          overall: {
            totalGames: parseInt(stats.total_games),
            wins: parseInt(stats.wins),
            winRate: ((parseInt(stats.wins) / parseInt(stats.total_games)) * 100).toFixed(2) + '%',
            goodGames: parseInt(stats.good_games),
            goodWins: parseInt(stats.good_wins),
            goodWinRate: stats.good_games > 0 ? 
              ((parseInt(stats.good_wins) / parseInt(stats.good_games)) * 100).toFixed(2) + '%' : '0%',
            evilGames: parseInt(stats.evil_games),
            evilWins: parseInt(stats.evil_wins),
            evilWinRate: stats.evil_games > 0 ?
              ((parseInt(stats.evil_wins) / parseInt(stats.evil_games)) * 100).toFixed(2) + '%' : '0%'
          },
          roles: rolesResult.rows.map(row => ({
            role: row.role,
            timesPlayed: parseInt(row.times_played),
            wins: parseInt(row.wins),
            winRate: ((parseInt(row.wins) / parseInt(row.times_played)) * 100).toFixed(2) + '%'
          })),
          recentGames: recentGamesResult.rows
        },
        meta: {
          rateLimit: {
            limit: auth.rateLimit,
            remaining: auth.remaining
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching player stats:', error);
      logApiUsage(auth.keyId, `/api/v1/players/${discordId}/stats`, 'GET', 500, req.socket.remoteAddress);
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  },

  /**
   * GET /api/v1/scripts/:name/stats
   * Get statistics for a specific script
   */
  getScriptStats: async (req, scriptName) => {
    const auth = await verifyApiKey(req);
    
    if (!auth.valid) {
      return jsonResponse({ error: auth.error }, 401);
    }

    try {
      // Get script statistics
      const statsQuery = `
        SELECT 
          COUNT(*) as total_games,
          COUNT(CASE WHEN winner = 'good' THEN 1 END) as good_wins,
          COUNT(CASE WHEN winner = 'evil' THEN 1 END) as evil_wins,
          AVG(player_count) as avg_player_count,
          AVG(EXTRACT(EPOCH FROM (completed_at - start_time))) as avg_game_duration_seconds
        FROM games 
        WHERE script = $1 AND completed_at IS NOT NULL
      `;
      
      const statsResult = await pool.query(statsQuery, [scriptName]);
      const stats = statsResult.rows[0];

      if (parseInt(stats.total_games) === 0) {
        logApiUsage(auth.keyId, `/api/v1/scripts/${scriptName}/stats`, 'GET', 404, req.socket.remoteAddress);
        return jsonResponse({ error: 'Script not found or has no completed games' }, 404);
      }

      // Get role statistics for this script
      const rolesQuery = `
        SELECT 
          starting_role as role,
          COUNT(*) as times_played,
          COUNT(CASE WHEN winning_team = starting_team THEN 1 END) as wins
        FROM game_players gp
        JOIN games g ON gp.game_id = g.game_id
        WHERE g.script = $1 AND g.completed_at IS NOT NULL
        GROUP BY starting_role
        ORDER BY times_played DESC
      `;
      
      const rolesResult = await pool.query(rolesQuery, [scriptName]);

      logApiUsage(auth.keyId, `/api/v1/scripts/${scriptName}/stats`, 'GET', 200, req.socket.remoteAddress);

      return jsonResponse({
        data: {
          script: scriptName,
          overall: {
            totalGames: parseInt(stats.total_games),
            goodWins: parseInt(stats.good_wins),
            evilWins: parseInt(stats.evil_wins),
            goodWinRate: ((parseInt(stats.good_wins) / parseInt(stats.total_games)) * 100).toFixed(2) + '%',
            avgPlayerCount: parseFloat(stats.avg_player_count).toFixed(1),
            avgGameDuration: Math.round(parseFloat(stats.avg_game_duration_seconds))
          },
          roles: rolesResult.rows.map(row => ({
            role: row.role,
            timesPlayed: parseInt(row.times_played),
            wins: parseInt(row.wins),
            winRate: ((parseInt(row.wins) / parseInt(row.times_played)) * 100).toFixed(2) + '%'
          }))
        },
        meta: {
          rateLimit: {
            limit: auth.rateLimit,
            remaining: auth.remaining
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching script stats:', error);
      logApiUsage(auth.keyId, `/api/v1/scripts/${scriptName}/stats`, 'GET', 500, req.socket.remoteAddress);
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  },

  /**
   * POST /api/v1/keys/create
   * Create a new API key (requires session authentication)
   */
  createApiKey: async (req) => {
    // Verify session token (reuse existing verifyToken from api.js)
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return jsonResponse({ error: 'Missing authorization token' }, 401);
    }

    try {
      // Verify session token
      const sessionResult = await pool.query(
        'SELECT discord_user_id FROM web_sessions WHERE token = $1 AND expires_at > $2',
        [token, Math.floor(Date.now() / 1000)]
      );

      if (!sessionResult.rows.length) {
        return jsonResponse({ error: 'Invalid or expired session' }, 401);
      }

      const { discord_user_id } = sessionResult.rows[0];

      // Parse request body
      const body = await parseBody(req);
      const { name, rate_limit } = body;

      if (!name || name.trim().length === 0) {
        return jsonResponse({ error: 'Key name is required' }, 400);
      }

      if (name.length > 255) {
        return jsonResponse({ error: 'Key name must be 255 characters or less' }, 400);
      }

      const keyRateLimit = rate_limit && rate_limit > 0 ? Math.min(rate_limit, 100) : 100;

      // Generate random API key (32 bytes = 64 hex chars)
      const apiKey = `grim_live_${crypto.randomBytes(32).toString('hex')}`;
      const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

      // Insert into database
      const result = await pool.query(
        `INSERT INTO api_keys (key_hash, name, discord_user_id, rate_limit, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING id, name, rate_limit, created_at`,
        [keyHash, name.trim(), discord_user_id, keyRateLimit]
      );

      const keyInfo = result.rows[0];

      return jsonResponse({
        success: true,
        message: 'API key created successfully',
        data: {
          id: keyInfo.id,
          key: apiKey, // Only shown once!
          name: keyInfo.name,
          rateLimit: keyInfo.rate_limit,
          createdAt: keyInfo.created_at,
          warning: 'Store this key securely. It will not be shown again.'
        }
      }, 201);
    } catch (error) {
      logger.error('Error creating API key:', error);
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  },

  /**
   * GET /api/v1/keys
   * List all API keys for the authenticated user
   */
  listApiKeys: async (req) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return jsonResponse({ error: 'Missing authorization token' }, 401);
    }

    try {
      // Verify session token
      const sessionResult = await pool.query(
        'SELECT discord_user_id FROM web_sessions WHERE token = $1 AND expires_at > $2',
        [token, Math.floor(Date.now() / 1000)]
      );

      if (!sessionResult.rows.length) {
        return jsonResponse({ error: 'Invalid or expired session' }, 401);
      }

      const { discord_user_id } = sessionResult.rows[0];

      // Get user's API keys (excluding the key_hash for security)
      const result = await pool.query(
        `SELECT id, name, rate_limit, created_at, last_used_at, is_active, notes
         FROM api_keys
         WHERE discord_user_id = $1
         ORDER BY created_at DESC`,
        [discord_user_id]
      );

      return jsonResponse({
        data: result.rows.map(row => ({
          id: row.id,
          name: row.name,
          rateLimit: row.rate_limit,
          createdAt: row.created_at,
          lastUsedAt: row.last_used_at,
          isActive: row.is_active,
          notes: row.notes
        }))
      });
    } catch (error) {
      logger.error('Error listing API keys:', error);
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  },

  /**
   * DELETE /api/v1/keys/:id
   * Delete (deactivate) an API key
   */
  deleteApiKey: async (req, keyId) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return jsonResponse({ error: 'Missing authorization token' }, 401);
    }

    try {
      // Verify session token
      const sessionResult = await pool.query(
        'SELECT discord_user_id FROM web_sessions WHERE token = $1 AND expires_at > $2',
        [token, Math.floor(Date.now() / 1000)]
      );

      if (!sessionResult.rows.length) {
        return jsonResponse({ error: 'Invalid or expired session' }, 401);
      }

      const { discord_user_id } = sessionResult.rows[0];

      // Verify ownership and deactivate key
      const result = await pool.query(
        `UPDATE api_keys 
         SET is_active = false
         WHERE id = $1 AND discord_user_id = $2
         RETURNING id, name`,
        [keyId, discord_user_id]
      );

      if (!result.rows.length) {
        return jsonResponse({ error: 'API key not found or access denied' }, 404);
      }

      return jsonResponse({
        success: true,
        message: 'API key deactivated successfully',
        data: {
          id: result.rows[0].id,
          name: result.rows[0].name
        }
      });
    } catch (error) {
      logger.error('Error deleting API key:', error);
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  },

  /**
   * PATCH /api/v1/keys/:id
   * Update an API key's name or notes
   */
  updateApiKey: async (req, keyId) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return jsonResponse({ error: 'Missing authorization token' }, 401);
    }

    try {
      // Verify session token
      const sessionResult = await pool.query(
        'SELECT discord_user_id FROM web_sessions WHERE token = $1 AND expires_at > $2',
        [token, Math.floor(Date.now() / 1000)]
      );

      if (!sessionResult.rows.length) {
        return jsonResponse({ error: 'Invalid or expired session' }, 401);
      }

      const { discord_user_id } = sessionResult.rows[0];

      // Parse request body
      const body = await parseBody(req);
      const { name, notes } = body;

      if (!name && notes === undefined) {
        return jsonResponse({ error: 'Provide name or notes to update' }, 400);
      }

      // Build update query
      const updates = [];
      const params = [];
      let paramIndex = 1;

      if (name) {
        updates.push(`name = $${paramIndex++}`);
        params.push(name.trim());
      }

      if (notes !== undefined) {
        updates.push(`notes = $${paramIndex++}`);
        params.push(notes);
      }

      params.push(keyId, discord_user_id);

      const result = await pool.query(
        `UPDATE api_keys 
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex} AND discord_user_id = $${paramIndex + 1}
         RETURNING id, name, notes, rate_limit, created_at, last_used_at, is_active`,
        params
      );

      if (!result.rows.length) {
        return jsonResponse({ error: 'API key not found or access denied' }, 404);
      }

      const keyInfo = result.rows[0];

      return jsonResponse({
        success: true,
        message: 'API key updated successfully',
        data: {
          id: keyInfo.id,
          name: keyInfo.name,
          notes: keyInfo.notes,
          rateLimit: keyInfo.rate_limit,
          createdAt: keyInfo.created_at,
          lastUsedAt: keyInfo.last_used_at,
          isActive: keyInfo.is_active
        }
      });
    } catch (error) {
      logger.error('Error updating API key:', error);
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  }
};

export { pool };
