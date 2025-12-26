import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost/grimlive_dev';
const pool = new Pool({ connectionString: DATABASE_URL });

console.log(`Using PostgreSQL: ${DATABASE_URL.replace(/:[^:]*@/, ':****@')}`);

function jsonResponse(data, status = 200) {
  return {
    status,
    text: async () => JSON.stringify(data)
  };
}

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

async function verifyToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    console.log('No auth header or invalid format');
    return null;
  }
  const token = auth.slice(7);
  const currentTime = Math.floor(Date.now() / 1000);
  
  const result = await pool.query(
    'SELECT * FROM web_sessions WHERE token = $1 AND expires_at > $2',
    [token, currentTime]
  );
  const session = result.rows[0] || null;
  
  if (!session) {
    console.log('Token invalid or expired');
  }
  
  return session;
}

export const api = {
  // create web auth session (24hr token)
  createSession: async (req) => {
    const body = await parseBody(req);
    const { discord_user_id } = body;
    
    const token = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours
    const sessionId = crypto.randomUUID();
    
    await pool.query(
      'INSERT INTO web_sessions (session_id, token, discord_user_id, expires_at) VALUES ($1, $2, $3, $4)',
      [sessionId, token, discord_user_id || null, expiresAt]
    );
    
    return jsonResponse({ 
      sessionId, 
      token,
      expiresAt: new Date(expiresAt * 1000).toISOString()
    });
  },

  updateSessionDiscordUser: async (req) => {
    const session = await verifyToken(req);
    if (!session) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await parseBody(req);
    const { discord_user_id } = body;

    if (!discord_user_id) {
      return jsonResponse({ error: 'discord_user_id required' }, 400);
    }

    try {
      await pool.query(
        'UPDATE web_sessions SET discord_user_id = $1 WHERE token = $2',
        [discord_user_id, session.token]
      );
      
      console.log(`Updated session ${session.session_id} with Discord user ${discord_user_id}`);
      return jsonResponse({ success: true });
    } catch (error) {
      console.error('Failed to update session:', error);
      return jsonResponse({ error: 'Failed to update session' }, 500);
    }
  },

  startGame: async (req) => {
    const session = await verifyToken(req);
    if (!session) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await parseBody(req);
    const { script, customName, players, storytellerId, sessionCode } = body;

    if (!session.discord_user_id) {
      return jsonResponse({ 
        error: 'Must link Discord account before starting games' 
      }, 400);
    }

    if (!script) {
      return jsonResponse({ error: 'Script required' }, 400);
    }

    if (!players || !Array.isArray(players) || players.length < 2) {
      return jsonResponse({ error: 'At least 2 players required' }, 400);
    }

    let guildId = null;
    let categoryId = null;
    
    // validate session code if provided
    if (sessionCode) {
      const sessionData = await pool.query(
        'SELECT guild_id, category_id FROM sessions WHERE session_code = $1',
        [sessionCode]
      );
      if (!sessionData.rows.length) {
        return jsonResponse({ error: 'Invalid session code' }, 400);
      }
      guildId = sessionData.rows[0].guild_id;
      categoryId = sessionData.rows[0].category_id;
    }

    const startTime = Date.now() / 1000;
    const playersJson = JSON.stringify(players || []);
    const playerCount = players?.length || 0;

    const result = await pool.query(`
      INSERT INTO games (
        guild_id, category_id, script, custom_name, start_time, 
        players, player_count, storyteller_id, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) 
      RETURNING game_id
    `, [guildId, categoryId, script, customName, startTime, playersJson, playerCount, session.discord_user_id]);
    
    const gameId = result.rows[0].game_id;
    
    // Update session grimoire link if session code was provided
    if (guildId && categoryId && sessionCode) {
      // Generate grimoire link with session ID format
      const grimoireLink = `https://grim.hystericca.dev/#${sessionCode}`;
      
      await pool.query(`
        UPDATE sessions 
        SET grimoire_link = $1, active_game_id = $2, last_active = $3
        WHERE guild_id = $4 AND category_id = $5
      `, [grimoireLink, gameId, Math.floor(Date.now() / 1000), guildId, categoryId]);
      
      console.log(`Updated grimoire link for session ${sessionCode}: ${grimoireLink}`);
    }
    
    if (guildId && categoryId) {
      await pool.query(`
        INSERT INTO announcements (
          guild_id, category_id, announcement_type, game_id, created_at
        ) VALUES ($1, $2, 'game_start', $3, $4)
      `, [
        guildId,
        categoryId,
        gameId,
        Math.floor(Date.now() / 1000)
      ]);
    }
    
    return jsonResponse({ gameId });
  },

  endGame: async (req) => {
    const session = await verifyToken(req);
    if (!session) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await parseBody(req);
    const { gameId, winningTeam } = body;
    const endTime = Date.now() / 1000;
    const completedAt = new Date(); // PostgreSQL timestamp format
    
    const gameData = await pool.query(
      'SELECT guild_id, category_id, script, custom_name, start_time, player_count FROM games WHERE game_id = $1',
      [gameId]
    );
    
    await pool.query(`
      UPDATE games 
      SET end_time = $1, winner = $2, is_active = false, completed_at = $3
      WHERE game_id = $4
    `, [endTime, winningTeam, completedAt, gameId]);

    await pool.query(`
      UPDATE game_players 
      SET winning_team = (final_team = $1)
      WHERE game_id = $2
    `, [winningTeam, gameId]);
    
    if (gameData.rows.length && gameData.rows[0].guild_id) {
      const game = gameData.rows[0];
      await pool.query(`
        INSERT INTO announcements (
          guild_id, category_id, announcement_type, game_id, created_at
        ) VALUES ($1, $2, 'game_end', $3, $4)
      `, [
        game.guild_id,
        game.category_id,
        gameId,
        Math.floor(Date.now() / 1000)
      ]);
    }
    
    return jsonResponse({ success: true });
  },

  addPlayer: async (req) => {
    const session = await verifyToken(req);
    if (!session) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await parseBody(req);
    const { gameId, playerName, seatNumber, roleId, roleName, team, isFinal, discordId } = body;

    if (!gameId || !playerName || seatNumber === undefined) {
      return jsonResponse({ error: 'gameId, playerName, and seatNumber required' }, 400);
    }

    try {
      // Check if player already exists
      const existing = await pool.query(
        'SELECT id, starting_role_id FROM game_players WHERE game_id = $1 AND seat_number = $2',
        [gameId, seatNumber]
      );

      if (existing.rows.length > 0) {
        // Update existing player
        if (isFinal) {
          // Update final role at game end
          await pool.query(`
            UPDATE game_players 
            SET final_role_id = $1, final_role_name = $2, final_team = $3
            WHERE game_id = $4 AND seat_number = $5
          `, [roleId, roleName, team, gameId, seatNumber]);
        } else {
          // Update starting role (shouldn't normally happen, but handle it)
          await pool.query(`
            UPDATE game_players 
            SET starting_role_id = $1, starting_role_name = $2, starting_team = $3
            WHERE game_id = $4 AND seat_number = $5
          `, [roleId, roleName, team, gameId, seatNumber]);
        }
        return jsonResponse({ playerId: existing.rows[0].id });
      } else {
        // Insert new player with starting role
        const result = await pool.query(`
          INSERT INTO game_players (
            game_id, player_name, seat_number, 
            starting_role_id, starting_role_name, starting_team,
            discord_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [gameId, playerName, seatNumber, roleId, roleName, team, discordId]);
        
        return jsonResponse({ playerId: result.rows[0].id });
      }
    } catch (error) {
      console.error('Failed to add player:', error);
      return jsonResponse({ error: 'Failed to add player' }, 500);
    }
  },

  discordOAuth: async (req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const redirectUri = url.searchParams.get('redirect_uri');
    
    if (!redirectUri) {
      return jsonResponse({ error: 'Missing redirect_uri' }, 400);
    }

    const clientId = process.env.DISCORD_CLIENT_ID;
    if (!clientId) {
      console.error('DISCORD_CLIENT_ID not set');
      return jsonResponse({ error: 'Discord OAuth not configured' }, 500);
    }

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
    const redirectUri = url.searchParams.get('redirect_uri');
    
    if (!code) {
      return jsonResponse({ error: 'Missing authorization code' }, 400);
    }

    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return jsonResponse({ error: 'Discord OAuth not configured' }, 500);
    }

    try {
      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
        console.error('Failed to get access token:', tokenData);
        return jsonResponse({ error: 'Failed to get access token' }, 500);
      }

      const userResponse = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
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
