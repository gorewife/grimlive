/**
 * Legacy API Handler (grimkeeper-compatible endpoints)
 * Refactored to use dependency injection and service layer
 * 
 * This handler maintains backward compatibility with grimkeeper
 * while using the new service architecture
 */

import { ResponseUtils, RequestUtils } from '../utils/HttpUtils.js';
import { ValidationUtils } from '../utils/ValidationUtils.js';
import { logger } from '../logger.js';

export class LegacyAPIHandler {
  constructor(container) {
    this.container = container;
    this.sessionService = container.get('session');
    this.gameService = container.get('game');
    this.timerService = container.get('timer');
    this.logger = logger;
  }

  /**
   * Verify request authentication
   */
  async verifyAuth(req) {
    const token = RequestUtils.extractBearerToken(req);
    if (!token) {
      return { authorized: false, response: ResponseUtils.unauthorized() };
    }

    const session = await this.sessionService.verifyToken(token);
    if (!session) {
      return { authorized: false, response: ResponseUtils.unauthorized() };
    }

    return { authorized: true, session };
  }

  /**
   * POST /api/session/create
   * Create a new web session
   */
  async createSession(req) {
    try {
      const body = await RequestUtils.parseBody(req);
      const { discord_user_id } = body;

      const result = await this.sessionService.createSession(discord_user_id);
      return ResponseUtils.success(result);
    } catch (error) {
      return ResponseUtils.error(error.message, 500);
    }
  }

  /**
   * POST /api/session/discord
   * Update session's Discord user
   */
  async updateSessionDiscordUser(req) {
    const auth = await this.verifyAuth(req);
    if (!auth.authorized) return auth.response;

    try {
      const body = await RequestUtils.parseBody(req);
      const { discord_user_id } = body;

      await this.sessionService.updateDiscordUser(auth.session.token, discord_user_id);
      return ResponseUtils.success();
    } catch (error) {
      return ResponseUtils.error(error.message, 400);
    }
  }

  /**
   * GET /api/sessions
   * Get user's grimkeeper sessions
   */
  async getUserSessions(req) {
    const auth = await this.verifyAuth(req);
    if (!auth.authorized) return auth.response;

    if (!auth.session.discord_user_id) {
      return ResponseUtils.error('Must link Discord account first', 400);
    }

    try {
      const sessions = await this.sessionService.getUserSessions(auth.session.discord_user_id);
      return ResponseUtils.json({ sessions });
    } catch (error) {
      return ResponseUtils.error(error.message, 500);
    }
  }

  /**
   * POST /api/game/start
   * Start a new game
   */
  async startGame(req) {
    const auth = await this.verifyAuth(req);
    if (!auth.authorized) return auth.response;

    if (!auth.session.discord_user_id) {
      return ResponseUtils.error('Must link Discord account before starting games', 400);
    }

    try {
      const body = await RequestUtils.parseBody(req);
      const { script, customName, players, sessionCode } = body;

      // Validate
      const validation = ValidationUtils.validateGameStart({ script, players, sessionCode });
      if (!validation.valid) {
        return ResponseUtils.validationError(validation.errors);
      }

      // Start game
      const result = await this.gameService.startGame({
        script,
        customName,
        players,
        storytellerId: auth.session.discord_user_id,
        sessionCode
      });

      // Return in the format expected by grimlive frontend
      return ResponseUtils.json({
        game_id: result.gameId,
        session_code: sessionCode || null,
        status: 'active'
      });
    } catch (error) {
      return ResponseUtils.error(error.message, 400);
    }
  }

  /**
   * POST /api/game/end
   * End a game
   */
  async endGame(req) {
    const auth = await this.verifyAuth(req);
    if (!auth.authorized) return auth.response;

    try {
      const body = await RequestUtils.parseBody(req);
      const { gameId, winner } = body;

      if (!gameId) {
        return ResponseUtils.error('Game ID required', 400);
      }

      // Validate winner
      const validation = ValidationUtils.validateGameEnd({ winner });
      if (!validation.valid) {
        return ResponseUtils.validationError(validation.errors);
      }

      await this.gameService.endGame(gameId, winner);
      return ResponseUtils.success({ 
        message: 'Game ended successfully',
        game_id: gameId,
        winner: winner,
        status: 'completed'
      });
    } catch (error) {
      return ResponseUtils.error(error.message, 400);
    }
  }

  /**
   * GET /api/game/:gameId
   * Get game details
   */
  async getGame(req, gameId) {
    const auth = await this.verifyAuth(req);
    if (!auth.authorized) return auth.response;

    try {
      const game = await this.gameService.getGameById(parseInt(gameId));
      
      if (!game) {
        return ResponseUtils.notFound('Game not found');
      }

      return ResponseUtils.json({ game });
    } catch (error) {
      return ResponseUtils.error(error.message, 500);
    }
  }

  /**
   * POST /api/timer/start
   * Start a timer
   */
  async startTimer(req) {
    const auth = await this.verifyAuth(req);
    if (!auth.authorized) return auth.response;

    try {
      const body = await RequestUtils.parseBody(req);
      const { sessionCode, duration } = body;

      // Validate
      const validation = ValidationUtils.validateTimer({ sessionCode, duration });
      if (!validation.valid) {
        return ResponseUtils.validationError(validation.errors);
      }

      const timerId = await this.timerService.startTimer({
        sessionCode,
        duration,
        startedBy: auth.session.discord_user_id
      });

      return ResponseUtils.success({ timerId, message: 'Timer started' });
    } catch (error) {
      return ResponseUtils.error(error.message, 400);
    }
  }

  /**
   * POST /api/timer/pause
   * Pause a timer
   */
  async pauseTimer(req) {
    const auth = await this.verifyAuth(req);
    if (!auth.authorized) return auth.response;

    try {
      const body = await RequestUtils.parseBody(req);
      const { timerId } = body;

      if (!timerId) {
        return ResponseUtils.error('Timer ID required', 400);
      }

      await this.timerService.pauseTimer(timerId);
      return ResponseUtils.success({ message: 'Timer paused' });
    } catch (error) {
      return ResponseUtils.error(error.message, 400);
    }
  }

  /**
   * POST /api/timer/stop
   * Stop a timer
   */
  async stopTimer(req) {
    const auth = await this.verifyAuth(req);
    if (!auth.authorized) return auth.response;

    try {
      const body = await RequestUtils.parseBody(req);
      const { timerId, sessionCode } = body;

      if (!timerId) {
        return ResponseUtils.error('Timer ID required', 400);
      }

      await this.timerService.stopTimer(timerId);

      // Create timer_cancel announcement for grimkeeper if we have session info
      if (sessionCode) {
        try {
          const sessionData = await this.sessionService.getSessionByCode(sessionCode);
          if (sessionData && sessionData.guild_id && sessionData.category_id) {
            await this.db.query(
              `INSERT INTO announcements (
                guild_id, category_id, announcement_type, created_at
              ) VALUES ($1, $2, 'timer_cancel', $3)`,
              [
                sessionData.guild_id,
                sessionData.category_id,
                Math.floor(Date.now() / 1000)
              ]
            );
            this.logger.info(`Created timer_cancel announcement for session ${sessionCode}`);
          }
        } catch (announcementError) {
          this.logger.error('Failed to create timer cancel announcement:', announcementError);
          // Don't fail the whole request if announcement fails
        }
      }

      return ResponseUtils.success({ message: 'Timer stopped' });
    } catch (error) {
      return ResponseUtils.error(error.message, 400);
    }
  }

  /**
   * GET /api/timer/:sessionCode
   * Get active timer for session
   */
  async getTimer(req, sessionCode) {
    const auth = await this.verifyAuth(req);
    if (!auth.authorized) return auth.response;

    try {
      const timer = await this.timerService.getActiveTimer(sessionCode);
      return ResponseUtils.json({ timer });
    } catch (error) {
      return ResponseUtils.error(error.message, 500);
    }
  }

  /**
   * POST /api/game/cancel
   * Cancel a game
   */
  async cancelGame(req) {
    const auth = await this.verifyAuth(req);
    if (!auth.authorized) return auth.response;

    try {
      const body = await RequestUtils.parseBody(req);
      const { game_id } = body;

      if (!game_id) {
        return ResponseUtils.error('game_id required', 400);
      }

      // Get game data for announcement
      const gameData = await this.db.query(
        'SELECT guild_id, category_id FROM games WHERE game_id = $1',
        [game_id]
      );

      // Mark game as canceled
      await this.db.query(
        'UPDATE games SET is_active = false, end_time = $1 WHERE game_id = $2',
        [Date.now() / 1000, game_id]
      );

      // Delete players
      await this.db.query('DELETE FROM game_players WHERE game_id = $1', [game_id]);

      // Create announcement
      if (gameData.rows.length && gameData.rows[0].guild_id) {
        const game = gameData.rows[0];
        await this.db.query(
          `INSERT INTO announcements (guild_id, category_id, announcement_type, game_id, created_at)
           VALUES ($1, $2, 'game_cancel', $3, $4)`,
          [game.guild_id, game.category_id, game_id, Math.floor(Date.now() / 1000)]
        );
      }

      return ResponseUtils.success();
    } catch (error) {
      return ResponseUtils.error(error.message, 500);
    }
  }

  /**
   * POST /api/player/add
   * Add or update player in game
   */
  async addPlayer(req) {
    const auth = await this.verifyAuth(req);
    if (!auth.authorized) return auth.response;

    try {
      const body = await RequestUtils.parseBody(req);
      const { gameId, playerName, seatNumber, roleId, roleName, team, isFinal, discordId } = body;

      if (!gameId || !playerName || seatNumber === undefined) {
        return ResponseUtils.error('gameId, playerName, and seatNumber required', 400);
      }

      const existing = await this.db.query(
        'SELECT id FROM game_players WHERE game_id = $1 AND seat_number = $2',
        [gameId, seatNumber]
      );

      if (existing.rows.length > 0) {
        if (isFinal) {
          await this.db.query(
            `UPDATE game_players SET final_role_id = $1, final_role_name = $2, final_team = $3
             WHERE game_id = $4 AND seat_number = $5`,
            [roleId, roleName, team, gameId, seatNumber]
          );
        } else {
          await this.db.query(
            `UPDATE game_players SET starting_role_id = $1, starting_role_name = $2, starting_team = $3
             WHERE game_id = $4 AND seat_number = $5`,
            [roleId, roleName, team, gameId, seatNumber]
          );
        }
        return ResponseUtils.json({ playerId: existing.rows[0].id });
      } else {
        const result = await this.db.query(
          `INSERT INTO game_players (game_id, player_name, seat_number, starting_role_id, starting_role_name, starting_team, discord_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [gameId, playerName, seatNumber, roleId, roleName, team, discordId]
        );
        return ResponseUtils.json({ playerId: result.rows[0].id });
      }
    } catch (error) {
      return ResponseUtils.error(error.message, 500);
    }
  }

  /**
   * POST /api/game/update-role
   * Update player role
   */
  async updateRole(req) {
    const auth = await this.verifyAuth(req);
    if (!auth.authorized) return auth.response;

    try {
      const body = await RequestUtils.parseBody(req);
      const { game_id, player_name, role, final_role } = body;

      if (!game_id || !player_name) {
        return ResponseUtils.error('game_id and player_name required', 400);
      }

      const playerCheck = await this.db.query(
        'SELECT id FROM game_players WHERE game_id = $1 AND player_name = $2',
        [game_id, player_name]
      );

      if (playerCheck.rows.length === 0) {
        await this.db.query(
          `INSERT INTO game_players (game_id, player_name, starting_role_name, final_role_name)
           VALUES ($1, $2, $3, $4)`,
          [game_id, player_name, role, final_role || role]
        );
      } else {
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
          await this.db.query(
            `UPDATE game_players SET ${updates.join(', ')} WHERE game_id = $${paramIndex++} AND player_name = $${paramIndex++}`,
            values
          );
        }
      }

      return ResponseUtils.success();
    } catch (error) {
      return ResponseUtils.error(error.message, 500);
    }
  }

  /**
   * POST /api/mute
   * Queue mute announcement for Discord
   */
  async mute(req) {
    try {
      const body = await RequestUtils.parseBody(req);
      const { sessionCode } = body;

      if (!sessionCode) {
        return ResponseUtils.error('sessionCode required', 400);
      }

      const sessionResult = await this.db.query(
        'SELECT guild_id, category_id FROM sessions WHERE session_code = $1',
        [sessionCode]
      );

      if (!sessionResult.rows.length) {
        return ResponseUtils.notFound('Invalid session code');
      }

      const { guild_id, category_id } = sessionResult.rows[0];
      await this.db.query(
        `INSERT INTO announcements (guild_id, category_id, announcement_type, created_at)
         VALUES ($1, $2, 'mute', $3)`,
        [guild_id, category_id, Math.floor(Date.now() / 1000)]
      );

      return ResponseUtils.success({ message: 'Mute announcement queued' });
    } catch (error) {
      return ResponseUtils.error(error.message, 500);
    }
  }

  /**
   * POST /api/unmute
   * Queue unmute announcement for Discord
   */
  async unmute(req) {
    try {
      const body = await RequestUtils.parseBody(req);
      const { sessionCode } = body;

      if (!sessionCode) {
        return ResponseUtils.error('sessionCode required', 400);
      }

      const sessionResult = await this.db.query(
        'SELECT guild_id, category_id FROM sessions WHERE session_code = $1',
        [sessionCode]
      );

      if (!sessionResult.rows.length) {
        return ResponseUtils.notFound('Invalid session code');
      }

      const { guild_id, category_id } = sessionResult.rows[0];
      await this.db.query(
        `INSERT INTO announcements (guild_id, category_id, announcement_type, created_at)
         VALUES ($1, $2, 'unmute', $3)`,
        [guild_id, category_id, Math.floor(Date.now() / 1000)]
      );

      return ResponseUtils.success({ message: 'Unmute announcement queued' });
    } catch (error) {
      return ResponseUtils.error(error.message, 500);
    }
  }

  /**
   * POST /api/call
   * Queue call announcement for Discord
   */
  async call(req) {
    try {
      const body = await RequestUtils.parseBody(req);
      const { sessionCode } = body;

      if (!sessionCode) {
        return ResponseUtils.error('sessionCode required', 400);
      }

      const sessionResult = await this.db.query(
        'SELECT guild_id, category_id FROM sessions WHERE session_code = $1',
        [sessionCode]
      );

      if (!sessionResult.rows.length) {
        return ResponseUtils.notFound('Invalid session code');
      }

      const { guild_id, category_id } = sessionResult.rows[0];
      await this.db.query(
        `INSERT INTO announcements (guild_id, category_id, announcement_type, created_at)
         VALUES ($1, $2, 'call', $3)`,
        [guild_id, category_id, Math.floor(Date.now() / 1000)]
      );

      return ResponseUtils.success({ message: 'Call announcement queued' });
    } catch (error) {
      return ResponseUtils.error(error.message, 500);
    }
  }

  /**
   * POST /api/timerAnnounce
   * Queue timer announcement for Discord
   */
  async timerAnnounce(req) {
    try {
      const body = await RequestUtils.parseBody(req);
      const { sessionCode, duration } = body;

      if (!sessionCode) {
        return ResponseUtils.error('sessionCode required', 400);
      }

      if (!duration || duration < 1 || duration > 10800) {
        return ResponseUtils.error('duration must be between 1 and 10800 seconds', 400);
      }

      const sessionResult = await this.db.query(
        'SELECT guild_id, category_id FROM sessions WHERE session_code = $1',
        [sessionCode]
      );

      if (!sessionResult.rows.length) {
        return ResponseUtils.notFound('Invalid session code');
      }

      const { guild_id, category_id } = sessionResult.rows[0];
      await this.db.query(
        `INSERT INTO announcements (guild_id, category_id, announcement_type, data, created_at)
         VALUES ($1, $2, 'timer_start', $3, $4)`,
        [guild_id, category_id, JSON.stringify({ duration }), Math.floor(Date.now() / 1000)]
      );

      return ResponseUtils.success({ message: 'Timer announcement queued' });
    } catch (error) {
      return ResponseUtils.error(error.message, 500);
    }
  }

  /**
   * POST /api/timerCancel
   * Queue timer cancel announcement for Discord
   */
  async timerCancel(req) {
    try {
      const body = await RequestUtils.parseBody(req);
      const { sessionCode } = body;

      if (!sessionCode) {
        return ResponseUtils.error('sessionCode required', 400);
      }

      const sessionResult = await this.db.query(
        'SELECT guild_id, category_id FROM sessions WHERE session_code = $1',
        [sessionCode]
      );

      if (!sessionResult.rows.length) {
        return ResponseUtils.notFound('Invalid session code');
      }

      const { guild_id, category_id } = sessionResult.rows[0];
      await this.db.query(
        `INSERT INTO announcements (guild_id, category_id, announcement_type, created_at)
         VALUES ($1, $2, 'timer_cancel', $3)`,
        [guild_id, category_id, Math.floor(Date.now() / 1000)]
      );

      return ResponseUtils.success({ message: 'Timer cancel queued' });
    } catch (error) {
      return ResponseUtils.error(error.message, 500);
    }
  }

  /**
   * GET /auth/discord/oauth
   * Redirect to Discord OAuth
   */
  async discordOAuth(req) {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const redirectUri = url.searchParams.get('redirect_uri');

      if (!redirectUri) {
        return ResponseUtils.error('Missing redirect_uri', 400);
      }

      const clientId = process.env.DISCORD_CLIENT_ID;
      if (!clientId) {
        this.logger.error('DISCORD_CLIENT_ID not set');
        return ResponseUtils.error('Discord OAuth not configured', 500);
      }

      const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify`;

      return {
        status: 302,
        headers: { Location: discordAuthUrl },
        text: async () => ''
      };
    } catch (error) {
      return ResponseUtils.error(error.message, 500);
    }
  }

  /**
   * GET /auth/discord/callback
   * Handle Discord OAuth callback
   */
  async discordCallback(req) {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const code = url.searchParams.get('code');
      const redirectUri = url.searchParams.get('redirect_uri');

      if (!code) {
        return ResponseUtils.error('Missing authorization code', 400);
      }

      const clientId = process.env.DISCORD_CLIENT_ID;
      const clientSecret = process.env.DISCORD_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return ResponseUtils.error('Discord OAuth not configured', 500);
      }

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
        this.logger.error('Failed to get access token:', tokenData);
        return ResponseUtils.error('Failed to get access token', 500);
      }

      const userResponse = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });

      const userData = await userResponse.json();

      return ResponseUtils.json({
        userId: userData.id,
        username: userData.username,
        discriminator: userData.discriminator,
        avatar: userData.avatar
      });
    } catch (error) {
      this.logger.error('Discord OAuth error:', error);
      return ResponseUtils.error('OAuth failed', 500);
    }
  }
}
