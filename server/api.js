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

// Initialize SQLite schema (for local dev - production uses PostgreSQL)
db.exec(`
  CREATE TABLE IF NOT EXISTS web_sessions (
    session_id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER NOT NULL,
    stat_tracking_enabled INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS games (
    game_id INTEGER PRIMARY KEY AUTOINCREMENT,
    web_session_id TEXT REFERENCES web_sessions(session_id),
    started_at INTEGER DEFAULT (strftime('%s', 'now')),
    ended_at INTEGER,
    script TEXT,
    num_players INTEGER,
    winning_team TEXT
  );

  CREATE TABLE IF NOT EXISTS game_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER REFERENCES games(game_id),
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
    death_type TEXT,
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

  // POST /api/game/start - Start new game
  startGame: async (req) => {
    const session = verifyToken(req);
    if (!session) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await parseBody(req);
    const { script, numPlayers } = body;

    const result = db.query('INSERT INTO games (web_session_id, script, num_players) VALUES (?, ?, ?) RETURNING game_id')
      .get(session.session_id, script || null, numPlayers || 0);
    
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

    db.query('UPDATE games SET ended_at = ?, winning_team = ? WHERE game_id = ?')
      .run(Math.floor(Date.now() / 1000), winningTeam, gameId);

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
