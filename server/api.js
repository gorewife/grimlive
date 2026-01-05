import crypto from 'crypto';
import {
  pool,
  jsonResponse,
  parseBody,
  normalizeGameData,
  validateGameStart,
  validateGameEnd,
  validateTimerData,
  getSessionByCode,
  getGameWithPlayers,
  updateSessionActivity,
  logApiCall,
  TEAMS
} from './api-shared.js';

logger.info('Legacy API initialized (grimkeeper-compatible endpoints)');

async function verifyToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return null;
  }
  const token = auth.slice(7);
  
  if (token.length < 16 || token.length > 256) {
    return null;
  }
  
  try {
    const result = await pool.query(
      'SELECT * FROM web_sessions WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

export const api = {
  createSession: async (req) => {
    try {
      const body = await parseBody(req);
      const { discord_user_id } = body;
      
      const token = crypto.randomUUID();
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours from now
      
      await pool.query(
        'INSERT INTO web_sessions (session_id, token, discord_user_id, expires_at) VALUES ($1, $2, $3, $4)',
        [sessionId, token, discord_user_id || null, expiresAt]
      );
      
      console.log(`Created session ${sessionId} for Discord user ${discord_user_id || 'anonymous'}`);
      
      return jsonResponse({ 
        sessionId, 
        token,
        expiresAt: expiresAt.toISOString()
      });
    } catch (error) {
      console.error('Failed to create session:', error);
      return jsonResponse({ error: 'Failed to create session' }, 500);
    }
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

    // Validate input using shared validation
    const validation = validateGameStart({ script, players, sessionCode });
    if (!validation.valid) {
      return jsonResponse({ error: validation.errors[0] }, 400);
    }

    let guildId = null;
    let categoryId = null;
    
    // Validate session code if provided (using shared utility)
    if (sessionCode) {
      const sessionData = await getSessionByCode(sessionCode);
      if (!sessionData) {
        return jsonResponse({ error: 'Invalid session code' }, 400);
      }
      
      // Check if session already has an active game
      if (sessionData.active_game_id) {
        return jsonResponse({ error: 'Session already has an active game' }, 400);
      }
      
      guildId = sessionData.guild_id;
      categoryId = sessionData.category_id;
    }

    const startTime = Math.floor(Date.now() / 1000);
    const playersJson = JSON.stringify(players || []);
    const playerCount = players?.length || 0;

    try {
      const result = await pool.query(`
        INSERT INTO games (
          guild_id, category_id, script, custom_name, start_time, 
          players, player_count, storyteller_id, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) 
        RETURNING game_id
      `, [guildId, categoryId, script, customName, startTime, playersJson, playerCount, session.discord_user_id]);
      
      const gameId = result.rows[0].game_id;
      
      // Insert players into game_players table
      if (players && players.length > 0) {
        for (let i = 0; i < players.length; i++) {
          const player = players[i];
          await pool.query(`
            INSERT INTO game_players (
              game_id, discord_id, discord_user_id, player_name, seat_number,
              character_name, alignment, starting_role_name, starting_team
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            gameId, 
            player.discord_id || null, 
            player.discord_id || null,
            player.name, 
            i + 1,
            player.role,
            player.alignment,
            player.role,
            player.alignment === 'good' ? 'townsfolk' : (player.role === 'imp' || player.role === 'demon' ? 'demon' : 'minion')
          ]);
        }
      }
      
      // Update session grimoire link if session code was provided
      if (guildId && categoryId && sessionCode) {
        const grimoireLink = `https://grim.hystericca.dev/#${sessionCode}`;
        
        await pool.query(`
          UPDATE sessions 
          SET grimoire_link = $1, active_game_id = $2, last_active = $3
          WHERE guild_id = $4 AND category_id = $5
        `, [grimoireLink, gameId, Math.floor(Date.now() / 1000), guildId, categoryId]);
        
        logApiCall('LEGACY', '/api/game/start', 'POST', 200, `Game ${gameId} linked to session ${sessionCode}`);
      }
      
      // Create announcement for grimkeeper to pick up
      if (guildId && categoryId) {
        await pool.query(`
          INSERT INTO announcements (
            guild_id, category_id, announcement_type, game_id, created_at
          ) VALUES ($1, $2, 'game_start', $3, $4)
        `, [guildId, categoryId, gameId, Math.floor(Date.now() / 1000)]);
      }
      
      // Return normalized response (compatible with both grimkeeper and v1)
      return jsonResponse({ 
        game_id: gameId,
        session_code: sessionCode || null,
        status: 'active'
      });
    } catch (error) {
      logApiCall('LEGACY', '/api/game/start', 'POST', 500, error.message);
      return jsonResponse({ error: 'Failed to start game' }, 500);
    }
  },

  endGame: async (req) => {
    const session = await verifyToken(req);
    if (!session) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await parseBody(req);
    const { game_id: gameId, winner, winning_team: winningTeam } = body;
    
    // Support both 'winner' and 'winningTeam' for compatibility
    const finalWinner = winner || winningTeam;
    
    // Validate input using shared validation
    const validation = validateGameEnd({ gameId, winner: finalWinner });
    if (!validation.valid) {
      return jsonResponse({ error: validation.errors[0] }, 400);
    }

    const endTime = Math.floor(Date.now() / 1000);
    const completedAt = new Date();
    
    try {
      const gameData = await pool.query(
        'SELECT guild_id, category_id, script, custom_name, start_time, player_count FROM games WHERE game_id = $1',
        [gameId]
      );
      
      if (!gameData.rows.length) {
        return jsonResponse({ error: 'Game not found' }, 404);
      }
      
      await pool.query(`
        UPDATE games 
        SET end_time = $1, winner = $2, is_active = false, completed_at = $3
        WHERE game_id = $4
      `, [endTime, finalWinner, completedAt, gameId]);

      await pool.query(`
        UPDATE game_players 
        SET winning_team = (final_team = $1)
        WHERE game_id = $2
      `, [finalWinner, gameId]);
      
      const game = gameData.rows[0];
      
      // Clear active_game_id from session
      if (game.guild_id && game.category_id) {
        await pool.query(`
          UPDATE sessions 
          SET active_game_id = NULL
          WHERE guild_id = $1 AND category_id = $2 AND active_game_id = $3
        `, [game.guild_id, game.category_id, gameId]);
        
        // Create announcement for grimkeeper
        await pool.query(`
          INSERT INTO announcements (
            guild_id, category_id, announcement_type, game_id, data, created_at
          ) VALUES ($1, $2, 'game_end', $3, $4, $5)
        `, [
          game.guild_id,
          game.category_id,
          gameId,
          JSON.stringify({ winner: finalWinner }),
          Math.floor(Date.now() / 1000)
        ]);
      }
      
      logApiCall('LEGACY', '/api/game/end', 'POST', 200, `Game ${gameId} ended, winner: ${finalWinner}`);
      
      return jsonResponse({ 
        success: true,
        game_id: gameId,
        winner: finalWinner,
        status: 'completed'
      });
    } catch (error) {
      logApiCall('LEGACY', '/api/game/end', 'POST', 500, error.message);
      return jsonResponse({ error: 'Failed to end game' }, 500);
    }
  },

  cancelGame: async (req) => {
    const session = await verifyToken(req);
    if (!session) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await parseBody(req);
    const { game_id } = body;
    
    try {
      // Get game data before canceling for announcement
      const gameData = await pool.query(
        'SELECT guild_id, category_id FROM games WHERE game_id = $1',
        [game_id]
      );
      
      // Mark game as canceled (not completed, no winner)
      await pool.query(`
        UPDATE games 
        SET is_active = false, end_time = $1
        WHERE game_id = $2
      `, [Date.now() / 1000, game_id]);
      
      // Optionally delete game players to clean up
      await pool.query('DELETE FROM game_players WHERE game_id = $1', [game_id]);
      
      // Create announcement for game cancellation
      if (gameData.rows.length && gameData.rows[0].guild_id) {
        const game = gameData.rows[0];
        await pool.query(`
          INSERT INTO announcements (
            guild_id, category_id, announcement_type, game_id, created_at
          ) VALUES ($1, $2, 'game_cancel', $3, $4)
        `, [
          game.guild_id,
          game.category_id,
          game_id,
          Math.floor(Date.now() / 1000)
        ]);
      }
      
      return jsonResponse({ success: true });
    } catch (error) {
      console.error('Cancel game error:', error);
      return jsonResponse({ error: 'Failed to cancel game' }, 500);
    }
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
  },

  updateRole: async (req) => {
    const session = await verifyToken(req);
    if (!session) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await parseBody(req);
    const { game_id, player_name, role, final_role } = body;

    if (!game_id || !player_name) {
      return jsonResponse({ error: 'game_id and player_name required' }, 400);
    }

    try {
      // Check if player exists in game_players
      const playerCheck = await pool.query(
        'SELECT id FROM game_players WHERE game_id = $1 AND player_name = $2',
        [game_id, player_name]
      );

      if (playerCheck.rows.length === 0) {
        // Insert new player if doesn't exist - use starting_role fields
        await pool.query(
          `INSERT INTO game_players (game_id, player_name, starting_role_name, final_role_name) 
           VALUES ($1, $2, $3, $4)`,
          [game_id, player_name, role, final_role || role]
        );
      } else {
        // Update existing player
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (role) {
          updates.push(`starting_role_name = $${paramIndex++}`);
          values.push(role);
        }

        if (final_role !== undefined) {
          updates.push(`final_role_name = $${paramIndex++}`);
          values.push(final_role);
        }

        if (updates.length > 0) {
          values.push(game_id, player_name);
          await pool.query(
            `UPDATE game_players SET ${updates.join(', ')} 
             WHERE game_id = $${paramIndex++} AND player_name = $${paramIndex++}`,
            values
          );
        }
      }

      return jsonResponse({ success: true });
    } catch (error) {
      console.error('Failed to update player role:', error);
      return jsonResponse({ error: 'Failed to update player role' }, 500);
    }
  },

  timerStart: async (req) => {
    const body = await parseBody(req);
    const { sessionCode, duration, discordUserId } = body;

    if (!sessionCode) {
      return jsonResponse({ error: 'sessionCode required' }, 400);
    }

    if (!duration || duration < 1 || duration > 10800) {
      return jsonResponse({ error: 'duration must be between 1 and 10800 seconds' }, 400);
    }

    try {
      const sessionResult = await pool.query(
        'SELECT guild_id, category_id FROM sessions WHERE session_code = $1',
        [sessionCode]
      );

      if (!sessionResult.rows.length) {
        return jsonResponse({ error: 'Invalid session code' }, 404);
      }

      const { guild_id, category_id } = sessionResult.rows[0];
      const endTime = new Date(Date.now() + duration * 1000);

      await pool.query(
        'DELETE FROM timers WHERE guild_id = $1 AND category_id = $2',
        [guild_id, category_id]
      );

      await pool.query(`
        INSERT INTO timers (guild_id, category_id, channel_id, message_id, phase, duration_seconds, end_time, is_paused, is_active)
        VALUES ($1, $2, $3, $4, 'discussion', $5, $6, false, true)
      `, [guild_id, category_id, 0, 0, duration, endTime]);

      return jsonResponse({
        success: true,
        duration: duration,
        endTime: endTime.toISOString()
      });
    } catch (error) {
      console.error('Timer start error:', error);
      return jsonResponse({ error: 'Failed to start timer' }, 500);
    }
  },

  timerStop: async (req) => {
    const body = await parseBody(req);
    const { sessionCode } = body;

    if (!sessionCode) {
      return jsonResponse({ error: 'sessionCode required' }, 400);
    }

    try {
      const sessionResult = await pool.query(
        'SELECT guild_id, category_id FROM sessions WHERE session_code = $1',
        [sessionCode]
      );

      if (!sessionResult.rows.length) {
        return jsonResponse({ error: 'Invalid session code' }, 404);
      }

      const { guild_id, category_id } = sessionResult.rows[0];

      await pool.query(
        'DELETE FROM timers WHERE guild_id = $1 AND category_id = $2',
        [guild_id, category_id]
      );

      return jsonResponse({ success: true });
    } catch (error) {
      console.error('Timer stop error:', error);
      return jsonResponse({ error: 'Failed to stop timer' }, 500);
    }
  },

  timerPause: async (req) => {
    const body = await parseBody(req);
    const { sessionCode } = body;

    if (!sessionCode) {
      return jsonResponse({ error: 'sessionCode required' }, 400);
    }

    try {
      const sessionResult = await pool.query(
        'SELECT guild_id, category_id FROM sessions WHERE session_code = $1',
        [sessionCode]
      );

      if (!sessionResult.rows.length) {
        return jsonResponse({ error: 'Invalid session code' }, 404);
      }

      const { guild_id, category_id } = sessionResult.rows[0];

      await pool.query(
        'UPDATE timers SET is_paused = true WHERE guild_id = $1 AND category_id = $2',
        [guild_id, category_id]
      );

      return jsonResponse({ success: true });
    } catch (error) {
      console.error('Timer pause error:', error);
      return jsonResponse({ error: 'Failed to pause timer' }, 500);
    }
  },

  timerResume: async (req) => {
    const body = await parseBody(req);
    const { sessionCode } = body;

    if (!sessionCode) {
      return jsonResponse({ error: 'sessionCode required' }, 400);
    }

    try {
      const sessionResult = await pool.query(
        'SELECT guild_id, category_id FROM sessions WHERE session_code = $1',
        [sessionCode]
      );

      if (!sessionResult.rows.length) {
        return jsonResponse({ error: 'Invalid session code' }, 404);
      }

      const { guild_id, category_id } = sessionResult.rows[0];

      await pool.query(
        'UPDATE timers SET is_paused = false WHERE guild_id = $1 AND category_id = $2',
        [guild_id, category_id]
      );

      return jsonResponse({ success: true });
    } catch (error) {
      console.error('Timer resume error:', error);
      return jsonResponse({ error: 'Failed to resume timer' }, 500);
    }
  },

  mute: async (req) => {
    const body = await parseBody(req);
    const { sessionCode } = body;

    if (!sessionCode) {
      return jsonResponse({ error: 'sessionCode required' }, 400);
    }

    // Verify session exists and get guild/category info
    const sessionResult = await pool.query(
      'SELECT guild_id, category_id FROM sessions WHERE session_code = $1',
      [sessionCode]
    );

    if (!sessionResult.rows.length) {
      return jsonResponse({ error: 'Invalid session code' }, 404);
    }

    const { guild_id, category_id } = sessionResult.rows[0];

    // Queue announcement for Discord bot to process
    try {
      await pool.query(`
        INSERT INTO announcements (guild_id, category_id, announcement_type, created_at)
        VALUES ($1, $2, 'mute', $3)
      `, [guild_id, category_id, Math.floor(Date.now() / 1000)]);

      return jsonResponse({
        success: true,
        message: 'Mute announcement queued'
      });
    } catch (error) {
      console.error('Failed to queue mute announcement:', error);
      return jsonResponse({ error: 'Failed to queue mute announcement' }, 500);
    }
  },

  unmute: async (req) => {
    const body = await parseBody(req);
    const { sessionCode } = body;

    if (!sessionCode) {
      return jsonResponse({ error: 'sessionCode required' }, 400);
    }

    // Verify session exists and get guild/category info
    const sessionResult = await pool.query(
      'SELECT guild_id, category_id FROM sessions WHERE session_code = $1',
      [sessionCode]
    );

    if (!sessionResult.rows.length) {
      return jsonResponse({ error: 'Invalid session code' }, 404);
    }

    const { guild_id, category_id } = sessionResult.rows[0];

    // Queue announcement for Discord bot to process
    try {
      await pool.query(`
        INSERT INTO announcements (guild_id, category_id, announcement_type, created_at)
        VALUES ($1, $2, 'unmute', $3)
      `, [guild_id, category_id, Math.floor(Date.now() / 1000)]);

      return jsonResponse({
        success: true,
        message: 'Unmute announcement queued'
      });
    } catch (error) {
      console.error('Failed to queue unmute announcement:', error);
      return jsonResponse({ error: 'Failed to queue unmute announcement' }, 500);
    }
  },

  call: async (req) => {
    const body = await parseBody(req);
    const { sessionCode } = body;

    if (!sessionCode) {
      return jsonResponse({ error: 'sessionCode required' }, 400);
    }

    // Verify session exists and get guild/category info
    const sessionResult = await pool.query(
      'SELECT guild_id, category_id FROM sessions WHERE session_code = $1',
      [sessionCode]
    );

    if (!sessionResult.rows.length) {
      return jsonResponse({ error: 'Invalid session code' }, 404);
    }

    const { guild_id, category_id } = sessionResult.rows[0];

    // Queue announcement for Discord bot to process
    try {
      await pool.query(`
        INSERT INTO announcements (guild_id, category_id, announcement_type, created_at)
        VALUES ($1, $2, 'call', $3)
      `, [guild_id, category_id, Math.floor(Date.now() / 1000)]);

      return jsonResponse({
        success: true,
        message: 'Call announcement queued'
      });
    } catch (error) {
      console.error('Failed to queue call announcement:', error);
      return jsonResponse({ error: 'Failed to queue call announcement' }, 500);
    }
  },

  timerAnnounce: async (req) => {
    const body = await parseBody(req);
    const { sessionCode, duration } = body;

    if (!sessionCode) {
      return jsonResponse({ error: 'sessionCode required' }, 400);
    }

    if (!duration || duration < 1 || duration > 10800) {
      return jsonResponse({ error: 'duration must be between 1 and 10800 seconds' }, 400);
    }

    // Verify session exists and get guild/category info
    const sessionResult = await pool.query(
      'SELECT guild_id, category_id FROM sessions WHERE session_code = $1',
      [sessionCode]
    );

    if (!sessionResult.rows.length) {
      return jsonResponse({ error: 'Invalid session code' }, 404);
    }

    const { guild_id, category_id } = sessionResult.rows[0];

    // Queue announcement for Discord bot to process
    try {
      await pool.query(`
        INSERT INTO announcements (guild_id, category_id, announcement_type, data, created_at)
        VALUES ($1, $2, 'timer_start', $3, $4)
      `, [guild_id, category_id, JSON.stringify({ duration }), Math.floor(Date.now() / 1000)]);

      return jsonResponse({
        success: true,
        message: 'Timer announcement queued'
      });
    } catch (error) {
      console.error('Failed to queue timer announcement:', error);
      return jsonResponse({ error: 'Failed to queue timer announcement' }, 500);
    }
  },

  timerCancel: async (req) => {
    const body = await parseBody(req);
    const { sessionCode } = body;

    if (!sessionCode) {
      return jsonResponse({ error: 'sessionCode required' }, 400);
    }

    // Verify session exists and get guild/category info
    const sessionResult = await pool.query(
      'SELECT guild_id, category_id FROM sessions WHERE session_code = $1',
      [sessionCode]
    );

    if (!sessionResult.rows.length) {
      return jsonResponse({ error: 'Invalid session code' }, 404);
    }

    const { guild_id, category_id } = sessionResult.rows[0];

    // Queue timer cancel announcement
    try {
      await pool.query(`
        INSERT INTO announcements (guild_id, category_id, announcement_type, created_at)
        VALUES ($1, $2, 'timer_cancel', $3)
      `, [guild_id, category_id, Math.floor(Date.now() / 1000)]);

      return jsonResponse({
        success: true,
        message: 'Timer cancel queued'
      });
    } catch (error) {
      console.error('Failed to queue timer cancel:', error);
      return jsonResponse({ error: 'Failed to queue timer cancel' }, 500);
    }
  }
};
