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

// Drop and recreate game tables to ensure schema matches (keep sessions to avoid logout)
db.exec(`
  DROP TABLE IF EXISTS game_players;
  DROP TABLE IF EXISTS games;
`);

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
  CREATE TABLE games (
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
  -- Stores FINAL roles at game end only
  CREATE TABLE game_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER REFERENCES games(game_id),
    discord_id INTEGER,  -- NULL if not linked
    player_name TEXT NOT NULL,
    seat_number INTEGER NOT NULL,
    role_id TEXT,  -- Final role at game end
    role_name TEXT,
    team TEXT,
    survived INTEGER DEFAULT 1,  -- 1 = survived, 0 = died
    winning_team INTEGER DEFAULT 0
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
    console.log('No auth header or invalid format');
    return null;
  }
  const token = auth.slice(7);
  const currentTime = Math.floor(Date.now() / 1000);
  const session = db.query('SELECT * FROM web_sessions WHERE token = ? AND expires_at > ?')
    .get(token, currentTime);
  
  if (!session) {
    console.log(`Token verification failed: token=${token}, current_time=${currentTime}`);
    // Check if token exists at all
    const tokenExists = db.query('SELECT * FROM web_sessions WHERE token = ?').get(token);
    if (tokenExists) {
      console.log(`Token exists but expired: expires_at=${tokenExists.expires_at}, current=${currentTime}`);
    } else {
      console.log('Token does not exist in database');
    }
  }
  
  return session;
}

export const api = {
  // POST /api/session/create - Create new tracking session
  createSession: async (req) => {
    const body = await parseBody(req);
    const { discord_user_id } = body;
    
    const token = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours
    
    const sessionId = crypto.randomUUID();
    db.query('INSERT INTO web_sessions (session_id, token, discord_user_id, expires_at) VALUES (?, ?, ?, ?)')
      .run(sessionId, token, discord_user_id || null, expiresAt);
    
    return jsonResponse({ 
      sessionId, 
      token,
      expiresAt: new Date(expiresAt * 1000).toISOString()
    });
  },

  // POST /api/session/update-discord - Update session with Discord user ID
  updateSessionDiscordUser: async (req) => {
    const session = verifyToken(req);
    if (!session) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await parseBody(req);
    const { discord_user_id } = body;

    if (!discord_user_id) {
      return jsonResponse({ error: 'discord_user_id required' }, 400);
    }

    try {
      db.query('UPDATE web_sessions SET discord_user_id = ? WHERE token = ?')
        .run(discord_user_id, session.token);
      
      console.log(`Updated session ${session.session_id} with Discord user ID ${discord_user_id}`);
      return jsonResponse({ success: true });
    } catch (error) {
      console.error('Failed to update session:', error);
      return jsonResponse({ error: 'Failed to update session' }, 500);
    }
  },

  // POST /api/game/start - Start new game (grimkeeper-compatible format)
  startGame: async (req) => {
    const session = verifyToken(req);
    if (!session) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await parseBody(req);
    const { script, customName, players, storytellerId, sessionCode } = body;

    // Validate storyteller has linked Discord
    if (!session.discord_user_id) {
      return jsonResponse({ 
        error: 'Storyteller must link Discord account before starting games' 
      }, 400);
    }

    // Validate required fields
    if (!script || !customName) {
      return jsonResponse({ error: 'Script and custom name are required' }, 400);
    }

    if (!players || !Array.isArray(players) || players.length === 0) {
      return jsonResponse({ error: 'At least one player is required' }, 400);
    }

    // Minimum 3 total (1 ST + 2 players) for testing
    if (players.length < 2) {
      return jsonResponse({ error: 'At least 2 players required (excluding storyteller)' }, 400);
    }

    let guildId = null;
    let categoryId = null;
    
    // If sessionCode provided, look up guild_id and category_id from sessions table
    if (sessionCode) {
      // Note: This requires PostgreSQL connection in production
      // For local SQLite, we'll allow null guild_id for testing
      try {
        // TODO: Query sessions table when PostgreSQL is connected
        // SELECT guild_id, category_id FROM sessions WHERE session_code = ? AND storyteller_user_id = ?
        // For now in SQLite dev mode, allow web-only games
        console.log('Session code provided:', sessionCode);
        
        // In production PostgreSQL, validate session ownership:
        // const sessionData = await pgPool.query(
        //   'SELECT guild_id, category_id FROM sessions WHERE session_code = $1 AND storyteller_user_id = $2',
        //   [sessionCode, session.discord_user_id]
        // );
        // if (!sessionData.rows.length) {
        //   return jsonResponse({ error: 'Invalid session code or not authorized' }, 403);
        // }
        // guildId = sessionData.rows[0].guild_id;
        // categoryId = sessionData.rows[0].category_id;
      } catch (error) {
        console.error('Failed to lookup session:', error);
        return jsonResponse({ error: 'Failed to validate session code' }, 500);
      }
    }

    // Use grimkeeper's games table structure
    const result = db.query(`
      INSERT INTO games (
        guild_id, category_id, script, custom_name, start_time, 
        players, player_count, storyteller_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1) 
      RETURNING game_id
    `).get(
      guildId,  // guild_id from sessions lookup
      categoryId || null,  // category_id from user input
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

  // GET /api/stats/game/:gameId - Get game statistics
  getGameStats: (req, gameId) => {
    const players = db.query(`
      SELECT * FROM game_players
      WHERE game_id = ?
      ORDER BY seat_number
    `).all(gameId);
    
    return jsonResponse({ players });
  },

  // GET /api/sessions - Get available Discord sessions for storyteller
  getSessions: async (req) => {
    console.log('GET /api/sessions called');
    const session = verifyToken(req);
    if (!session) {
      console.log('Session verification failed for /api/sessions');
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    console.log('Session verified, discord_user_id:', session.discord_user_id);
    if (!session.discord_user_id) {
      console.log('No discord_user_id, returning empty sessions');
      return jsonResponse({ sessions: [] });
    }

    try {
      // For now, always use mock data during development
      // TODO: When ready for production, implement PostgreSQL query:
      // SELECT s.session_code, c.name as category_name, g.name as guild_name 
      // FROM sessions s 
      // JOIN guilds g ON s.guild_id = g.guild_id
      // WHERE s.storyteller_user_id = $1
      
      // Mock data for development
      console.log('Returning mock sessions for development');
      const mockSessions = [
        { session_code: 's1', category_name: 'Blood on the Clocktower', guild_name: 'Test Server' },
        { session_code: 's2', category_name: 'BotC Games', guild_name: 'Test Server' },
        { session_code: 's3', category_name: 'Practice Games', guild_name: 'Another Server' }
      ];
      console.log('Mock sessions:', mockSessions);
      return jsonResponse({ sessions: mockSessions });
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      return jsonResponse({ error: 'Failed to fetch sessions' }, 500);
    }
  },

  // OAuth endpoints
  discordOAuth: async (req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const redirectUri = url.searchParams.get('redirect_uri');
    
    if (!redirectUri) {
      return jsonResponse({ error: 'Missing redirect_uri' }, 400);
    }

    const clientId = process.env.DISCORD_CLIENT_ID;
    if (!clientId) {
      return jsonResponse({ error: 'Discord OAuth not configured' }, 500);
    }

    // Redirect to Discord OAuth
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify`;
    
    return {
      status: 302,
      headers: { Location: discordAuthUrl },
      text: async () => ''
    };
  },

  discordCallback: async (req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const code = url.searchParams.get('code');
    
    if (!code) {
      return jsonResponse({ error: 'Missing authorization code' }, 400);
    }

    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const redirectUri = url.searchParams.get('redirect_uri') || 'http://localhost:8080/auth/callback';

    try {
      // Exchange code for access token
      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri
        })
      });

      const tokenData = await tokenResponse.json();
      
      if (!tokenData.access_token) {
        return jsonResponse({ error: 'Failed to get access token' }, 500);
      }

      // Get user info
      const userResponse = await fetch('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`
        }
      });

      const userData = await userResponse.json();
      
      return jsonResponse({
        userId: userData.id,
        username: userData.username,
        discriminator: userData.discriminator,
        avatar: userData.avatar
      });
    } catch (error) {
      console.error('Discord OAuth error:', error);
      return jsonResponse({ error: 'OAuth failed' }, 500);
    }
  }
};
