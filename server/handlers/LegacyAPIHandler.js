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

      return ResponseUtils.json({
        gameId: result.gameId,
        message: 'Game started successfully'
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
      return ResponseUtils.success({ message: 'Game ended successfully' });
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
      const { timerId } = body;

      if (!timerId) {
        return ResponseUtils.error('Timer ID required', 400);
      }

      await this.timerService.stopTimer(timerId);
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
}
