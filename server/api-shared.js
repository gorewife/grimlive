/**
 * Shared utilities and data structures for API endpoints
 * Ensures compatibility between legacy API (grimkeeper) and API v1 (public)
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DB_HOST && !process.env.DATABASE_URL) {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...values] = trimmed.split('=');
        if (key && values.length && !process.env[key.trim()]) { // Don't overwrite existing
          process.env[key.trim()] = values.join('=').trim();
        }
      }
    });
    console.log('[api-shared] Loaded .env file');
  }
}

// Use individual connection params to avoid password parsing issues with special chars
const poolConfig = process.env.DB_HOST ? {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: String(process.env.DB_PASSWORD), // Explicit string conversion
} : {
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/grimlive_dev'
};

if (process.env.DB_HOST) {
  logger.info('[api-shared] Using individual connection parameters');
  logger.debug('[api-shared] DB_HOST:', process.env.DB_HOST);
} else {
  logger.info('[api-shared] Using DATABASE_URL connection string');
}

logger.debug('[api-shared] Pool config:', { 
  connectionString: poolConfig.connectionString ? poolConfig.connectionString.replace(/(postgresql:\/\/[^:]+:)[^@]+(@.+)/, '$1***$2') : undefined,
  host: poolConfig.host,
  database: poolConfig.database,
  password: poolConfig.password ? '***' : undefined 
});

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  logger.error('Unexpected database error:', err);
});

// ============================================================================
// SHARED CONSTANTS
// ============================================================================

export const MAX_BODY_SIZE = 1024 * 100;

export const GAME_STATUSES = {
  ACTIVE: true,
  ENDED: false
};

export const TEAMS = {
  GOOD: 'good',
  EVIL: 'evil'
};

export const TIMER_PHASES = {
  NOMINATION: 'nomination',
  DISCUSSION: 'discussion',
  PRIVATE: 'private',
  UNKNOWN: 'unknown'
};

// ============================================================================
// SHARED RESPONSE FORMATTERS
// ============================================================================

/**
 * Create standardized JSON response
 * @param {Object} data - Response data
 * @param {number} status - HTTP status code
 * @param {Object} headers - Additional headers
 * @returns {Object} Response object compatible with both Node http and fetch
 */
export function jsonResponse(data, status = 200, headers = {}) {
  return {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    text: async () => JSON.stringify(data)
  };
}

/**
 * Parse request body (works with both http.IncomingMessage and Request)
 */
export async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        req.connection.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      body += chunk;
    });
    
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        logger.error('JSON parse error:', e.message);
        resolve({});
      }
    });
    
    req.on('error', reject);
  });
}

// ============================================================================
// SHARED DATA NORMALIZATION
// ============================================================================

/**
 * Normalize game data to consistent format for both APIs
 * Ensures grimkeeper and API v1 return same structure
 */
export function normalizeGameData(game, players = []) {
  return {
    game_id: game.game_id,
    guild_id: game.guild_id ? String(game.guild_id) : null,
    category_id: game.category_id ? String(game.category_id) : null,
    session_id: game.session_id || null,
    script: game.script,
    custom_name: game.custom_name || null,
    start_time: game.start_time,
    end_time: game.end_time || null,
    started_at: game.started_at || (game.start_time ? new Date(game.start_time * 1000).toISOString() : null),
    ended_at: game.ended_at || (game.end_time ? new Date(game.end_time * 1000).toISOString() : null),
    storyteller_id: game.storyteller_id ? String(game.storyteller_id) : null,
    player_count: game.player_count || game.num_players || 0,
    winner: game.winner || game.winning_team || null,
    is_active: game.is_active !== undefined ? game.is_active : !game.ended_at,
    duration_minutes: game.duration_minutes || null,
    players: players.map(p => normalizePlayerData(p))
  };
}

/**
 * Normalize player data to consistent format
 */
export function normalizePlayerData(player) {
  return {
    discord_user_id: player.discord_user_id ? String(player.discord_user_id) : player.discord_id ? String(player.discord_id) : null,
    seat_number: player.seat_number,
    player_name: player.player_name || null,
    starting_role: player.starting_role || player.starting_role_name || player.character_name || null,
    final_role: player.final_role || player.final_role_name || null,
    starting_team: player.starting_team || player.alignment || null,
    final_team: player.final_team || null,
    winning_team: player.winning_team || false,
    survived: player.survived !== undefined ? player.survived : true
  };
}

/**
 * Normalize session data
 */
export function normalizeSessionData(session) {
  return {
    session_id: session.session_id,
    guild_id: session.guild_id ? String(session.guild_id) : null,
    category_id: session.category_id ? String(session.category_id) : null,
    session_code: session.session_code || null,
    grimoire_link: session.grimoire_link || null,
    active_game_id: session.active_game_id || null,
    storyteller_user_id: session.storyteller_user_id ? String(session.storyteller_user_id) : null,
    created_at: session.created_at,
    last_active: session.last_active
  };
}

// ============================================================================
// ============================================================================
// SHARED DATABASE QUERIES
// ============================================================================

/**
 * Get session by session code (used by both APIs)
 */
export async function getSessionByCode(sessionCode) {
  const result = await pool.query(
    'SELECT * FROM sessions WHERE session_code = $1',
    [sessionCode]
  );
  return result.rows.length > 0 ? normalizeSessionData(result.rows[0]) : null;
}

/**
 * Get game with players (used by both APIs)
 */
export async function getGameWithPlayers(gameId) {
  const gameResult = await pool.query(
    'SELECT * FROM games WHERE game_id = $1',
    [gameId]
  );
  
  if (!gameResult.rows.length) {
    return null;
  }
  
  const playersResult = await pool.query(
    'SELECT * FROM game_players WHERE game_id = $1 ORDER BY seat_number',
    [gameId]
  );
  
  return normalizeGameData(gameResult.rows[0], playersResult.rows);
}

/**
 * Update game activity timestamp
 */
export async function updateSessionActivity(guildId, categoryId) {
  if (!guildId || !categoryId) return;
  
  await pool.query(
    'UPDATE sessions SET last_active = $1 WHERE guild_id = $2 AND category_id = $3',
    [Math.floor(Date.now() / 1000), guildId, categoryId]
  );
}

// ============================================================================
// LOGGING
// ============================================================================

export function logApiCall(source, endpoint, method, status, details = '') {
  logger.info(`${source} ${method} ${endpoint} - ${status}${details ? ' ' + details : ''}`);
}
