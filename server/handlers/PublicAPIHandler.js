/**
 * Public API Handler (v1 read-only endpoints)
 * Handles authenticated public API access with rate limiting
 */

import crypto from 'crypto';
import { ResponseUtils } from '../utils/HttpUtils.js';

export class PublicAPIHandler {
  constructor(container) {
    this.container = container;
    this.gameService = container.get('game');
    this.database = container.get('database');
    this.logger = container.get('logger');
    
    // In-memory rate limiting
    this.rateLimitStore = new Map();
    
    // Clean up old entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.rateLimitStore.entries()) {
        if (now - data.resetTime > 300000) {
          this.rateLimitStore.delete(key);
        }
      }
    }, 300000);
  }

  /**
   * Cleanup on shutdown
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Verify API key and check rate limits
   */
  async verifyApiKey(req) {
    const apiKey = req.headers['x-api-key'] || req.headers['X-API-Key'];
    
    if (!apiKey) {
      return { valid: false, status: 401, error: 'Missing X-API-Key header' };
    }

    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    try {
      const result = await this.database.query(
        'SELECT id, rate_limit, is_active FROM api_keys WHERE key_hash = $1',
        [keyHash]
      );

      if (!result.rows.length) {
        return { valid: false, status: 401, error: 'Invalid API key' };
      }

      const { id, rate_limit, is_active } = result.rows[0];

      if (!is_active) {
        return { valid: false, status: 403, error: 'API key has been deactivated' };
      }

      // Check rate limit
      const now = Date.now();
      const windowStart = now - 60000;
      const rateLimitKey = `key_${id}`;
      
      let requestLog = this.rateLimitStore.get(rateLimitKey);
      if (!requestLog) {
        requestLog = { requests: [], resetTime: now };
        this.rateLimitStore.set(rateLimitKey, requestLog);
      }

      requestLog.requests = requestLog.requests.filter(t => t > windowStart);

      if (requestLog.requests.length >= rate_limit) {
        return { 
          valid: false,
          status: 429,
          error: 'Rate limit exceeded',
          rateLimit: rate_limit,
          remaining: 0
        };
      }

      requestLog.requests.push(now);
      requestLog.resetTime = now;

      // Update last_used_at
      this.database.query(
        'UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      ).catch(err => this.logger.error('Failed to update last_used_at:', err));

      return { 
        valid: true, 
        keyId: id, 
        rateLimit: rate_limit,
        remaining: rate_limit - requestLog.requests.length
      };
    } catch (error) {
      this.logger.error('API key verification error:', error);
      return { valid: false, status: 500, error: 'Internal server error' };
    }
  }

  /**
   * Log API usage for analytics
   */
  async logApiUsage(keyId, endpoint, method, status, ipAddress) {
    try {
      await this.database.query(
        'INSERT INTO api_key_usage (api_key_id, endpoint, method, response_status, ip_address) VALUES ($1, $2, $3, $4, $5)',
        [keyId, endpoint, method, status, ipAddress]
      );
    } catch (error) {
      this.logger.error('Failed to log API usage:', error);
    }
  }

  /**
   * GET /api/v1/games
   * List games with pagination and filters
   */
  async getGames(req) {
    const auth = await this.verifyApiKey(req);
    
    if (!auth.valid) {
      return ResponseUtils.json({ error: auth.error }, auth.status);
    }

    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const params = url.searchParams;
      
      const filters = {
        limit: Math.min(parseInt(params.get('limit')) || 50, 100),
        offset: parseInt(params.get('offset')) || 0,
        script: params.get('script'),
        winner: params.get('winner'),
        startDate: params.get('start_date'),
        endDate: params.get('end_date')
      };

      const games = await this.gameService.getGames(filters);

      // Log usage
      const ipAddress = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
      await this.logApiUsage(auth.keyId, '/api/v1/games', 'GET', 200, ipAddress);

      return ResponseUtils.json({
        games: games.data,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: games.total
        },
        meta: {
          rate_limit: auth.rateLimit,
          remaining: auth.remaining
        }
      });
    } catch (error) {
      this.logger.error('Failed to get games:', error);
      return ResponseUtils.error('Failed to fetch games', 500);
    }
  }

  /**
   * GET /api/v1/games/:gameId
   * Get specific game details
   */
  async getGame(req, gameId) {
    const auth = await this.verifyApiKey(req);
    
    if (!auth.valid) {
      return ResponseUtils.json({ error: auth.error }, auth.status);
    }

    try {
      const game = await this.gameService.getGameById(parseInt(gameId));
      
      if (!game) {
        return ResponseUtils.notFound('Game not found');
      }

      // Log usage
      const ipAddress = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
      await this.logApiUsage(auth.keyId, `/api/v1/games/${gameId}`, 'GET', 200, ipAddress);

      return ResponseUtils.json({
        game,
        meta: {
          rate_limit: auth.rateLimit,
          remaining: auth.remaining
        }
      });
    } catch (error) {
      this.logger.error('Failed to get game:', error);
      return ResponseUtils.error('Failed to fetch game', 500);
    }
  }

  /**
   * GET /api/v1/scripts
   * List available scripts with game counts
   */
  async getScripts(req) {
    const auth = await this.verifyApiKey(req);
    
    if (!auth.valid) {
      return ResponseUtils.json({ error: auth.error }, auth.status);
    }

    try {
      const result = await this.database.query(`
        SELECT 
          script,
          COUNT(*) as game_count,
          COUNT(*) FILTER (WHERE winner = 'good') as good_wins,
          COUNT(*) FILTER (WHERE winner = 'evil') as evil_wins
        FROM games
        WHERE script IS NOT NULL
        GROUP BY script
        ORDER BY game_count DESC
      `);

      const ipAddress = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
      await this.logApiUsage(auth.keyId, '/api/v1/scripts', 'GET', 200, ipAddress);

      return ResponseUtils.json({
        scripts: result.rows,
        meta: {
          rate_limit: auth.rateLimit,
          remaining: auth.remaining
        }
      });
    } catch (error) {
      this.logger.error('Failed to get scripts:', error);
      return ResponseUtils.error('Failed to fetch scripts', 500);
    }
  }

  /**
   * GET /api/v1/stats
   * Get overall statistics
   */
  async getStats(req) {
    const auth = await this.verifyApiKey(req);
    
    if (!auth.valid) {
      return ResponseUtils.json({ error: auth.error }, auth.status);
    }

    try {
      const result = await this.database.query(`
        SELECT 
          COUNT(*) as total_games,
          COUNT(DISTINCT guild_id) as total_guilds,
          COUNT(*) FILTER (WHERE is_active = true) as active_games,
          COUNT(*) FILTER (WHERE winner = 'good') as good_wins,
          COUNT(*) FILTER (WHERE winner = 'evil') as evil_wins,
          AVG(EXTRACT(EPOCH FROM (ended_at - started_at))) FILTER (WHERE ended_at IS NOT NULL) as avg_game_duration_seconds
        FROM games
      `);

      const ipAddress = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
      await this.logApiUsage(auth.keyId, '/api/v1/stats', 'GET', 200, ipAddress);

      return ResponseUtils.json({
        stats: result.rows[0],
        meta: {
          rate_limit: auth.rateLimit,
          remaining: auth.remaining
        }
      });
    } catch (error) {
      this.logger.error('Failed to get stats:', error);
      return ResponseUtils.error('Failed to fetch statistics', 500);
    }
  }
}
