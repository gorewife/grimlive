// REST API for stat tracking - runs alongside WebSocket server
import { Database } from 'bun:sqlite';
import crypto from 'crypto';

const db = new Database('grimlive.db', { create: true });

// Helper to create JSON response
function jsonResponse(data, status = 200) {
  return {
    status,
    text: async () => JSON.stringify(data)
  };
}

// Helper to parse request body
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// Initialize SQLite schema (for local dev - production uses grimkeeper's PostgreSQL)
// These tables extend grimkeeper's existing schema
db.exec(`
  CREATE TABLE IF NOT EXISTS web_sessions (
    session_id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    discord_user_id INTEGER,  -- Links to Discord account
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER NOT NULL,
    stat_tracking_enabled INTEGER DEFAULT 1
  );

  -- Mimics grimkeeper's games table structure for local dev
  -- In production, uses existing grimkeeper games table
  CREATE TABLE IF NOT EXISTS games (
    game_id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id INTEGER,  -- NULL for web-only games
    category_id INTEGER,  -- NULL for web-only games
    script TEXT,
    custom_name TEXT,
    start_time REAL,  -- Unix timestamp (FLOAT in PostgreSQL)
    end_time REAL,
    players TEXT,  -- JSON array of player user IDs
    player_count INTEGER,
    storyteller_id INTEGER,  -- Discord user ID of host
    winner TEXT,  -- 'Good', 'Evil', or NULL
    is_active INTEGER DEFAULT 1,
    completed_at INTEGER
  );

  -- Player tracking extension (new - not in grimkeeper yet)
  CREATE TABLE IF NOT EXISTS game_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER REFERENCES games(game_id),
    discord_id INTEGER,  -- NULL if not linked
    player_name TEXT NOT NULL,
    seat_number INTEGER NOT NULL,
    role_id TEXT,
    role_name TEXT,
    team TEXT,
    survived INTEGER DEFAULT 0,
    winning_team INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS player_deaths (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_player_id INTEGER REFERENCES game_players(id),
    death_type TEXT,  -- 'execution', 'night_kill', 'other'
    day_number INTEGER,
    killer_player_id INTEGER,
    died_at INTEGER DEFAULT (strftime('%s', 'now'))
  );
`);

// Generate session token
function generateToken() {
  return crypto.randomUUID();
}

// Middleware to verify session token
function verifyToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return null;
  }
  const token = auth.slice(7);
  const session = db.query('SELECT * FROM web_sessions WHERE token = ? AND expires_at > ?')
    .get(token, Date.now() / 1000);
  return session;
}

export const api = {
  // POST /api/session/create - Create new tracking session
  createSession: (req) => {
    const token = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours
    
    const sessionId = crypto.randomUUID();
    db.query('INSERT INTO web_sessions (session_id, token, expires_at) VALUES (?, ?, ?)')
      .run(sessionId, token, expiresAt);
    
    return jsonResponse({ 
      sessionId, 
      token,
      expiresAt: new Date(expiresAt * 1000).toISOString()
    });
  },

  // POST /api/game/start - Start new game (grimkeeper-compatible format)
  startGame: async (req) => {
    const session = verifyToken(req);
    if (!session) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await parseBody(req);
    const { script, customName, players, storytellerId } = body;

    // Use grimkeeper's games table structure
    const result = db.query(`
      INSERT INTO games (
        guild_id, category_id, script, custom_name, start_time, 
        players, player_count, storyteller_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1) 
      RETURNING game_id
    `).get(
      null,  // guild_id NULL for web games
      null,  // category_id NULL for web games
      script || null,
      customName || null,
      Date.now() / 1000,  // Unix timestamp
      JSON.stringify(players || []),
      players?.length || 0,
      session.discord_user_id || storytellerId || null
    );
    
    return jsonResponse({ gameId: result.game_id });
  },

  // POST /api/game/end - End game and record winner
  endGame: async (req) => {
    const session = verifyToken(req);
    if (!session) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await parseBody(req);
    const { gameId, winningTeam } = body;

    // Update using grimkeeper's schema
    db.query(`
      UPDATE games 
      SET end_time = ?, winner = ?, is_active = 0, completed_at = ?
      WHERE game_id = ?
    `).run(
      Date.now() / 1000,
      winningTeam,  // 'Good' or 'Evil'
      Date.now() / 1000,
      gameId
    );

    // Update winning team flag for all players
    db.query(`
      UPDATE game_players 
      SET winning_team = (team = ?)
      WHERE game_id = ?
    `).run(winningTeam, gameId);
    
    return jsonResponse({ success: true });
  },

  // POST /api/player/add - Add player to game
  addPlayer: async (req) => {
    const session = verifyToken(req);
    if (!session) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await parseBody(req);
    const { gameId, playerName, seatNumber, roleId, roleName, team } = body;

    const result = db.query(`
      INSERT INTO game_players (game_id, player_name, seat_number, role_id, role_name, team)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING id
    `).get(gameId, playerName, seatNumber, roleId || null, roleName || null, team || null);
    
    return jsonResponse({ playerId: result.id });
  },

  // POST /api/player/death - Record player death
  addDeath: async (req) => {
    const session = verifyToken(req);
    if (!session) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await parseBody(req);
    const { gamePlayerId, deathType, dayNumber, killerPlayerId } = body;

    db.query(`
      INSERT INTO player_deaths (game_player_id, death_type, day_number, killer_player_id)
      VALUES (?, ?, ?, ?)
    `).run(gamePlayerId, deathType, dayNumber || null, killerPlayerId || null);

    // Update survival status
    db.query('UPDATE game_players SET survived = 0 WHERE id = ?').run(gamePlayerId);
    
    return jsonResponse({ success: true });
  },

  // GET /api/stats/game/:gameId - Get game statistics
  getGameStats: (req, gameId) => {
    const players = db.query(`
      SELECT 
        gp.*,
        pd.death_type,
        pd.day_number
      FROM game_players gp
      LEFT JOIN player_deaths pd ON pd.game_player_id = gp.id
      WHERE gp.game_id = ?
      ORDER BY gp.seat_number
    `).all(gameId);
    
    return jsonResponse({ players });
  }
};
