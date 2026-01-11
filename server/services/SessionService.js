/**
 * Session Service Implementation
 * Handles all session-related operations with dependency injection
 */

import crypto from 'crypto';

export class SessionService {
  constructor(database, logger) {
    this.db = database;
    this.logger = logger;
  }

  /**
   * Create a new web session
   */
  async createSession(discordUserId = null) {
    const token = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const expiresAt = Math.floor((Date.now() + (24 * 60 * 60 * 1000)) / 1000); // 24h

    try {
      await this.db.query(
        'INSERT INTO web_sessions (session_id, token, discord_user_id, expires_at) VALUES ($1, $2, $3, $4)',
        [sessionId, token, discordUserId, expiresAt]
      );

      this.logger.info(`Created session ${sessionId} for Discord user ${discordUserId || 'anonymous'}`);

      return {
        sessionId,
        token,
        expiresAt: new Date(expiresAt * 1000).toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to create session:', error);
      throw new Error('Failed to create session');
    }
  }

  /**
   * Verify session token
   */
  async verifyToken(token) {
    if (!token || token.length < 16 || token.length > 256) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    
    try {
      const result = await this.db.query(
        'SELECT * FROM web_sessions WHERE token = $1 AND expires_at > $2',
        [token, now]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      this.logger.error('Error verifying token:', error);
      return null;
    }
  }

  /**
   * Extract token from authorization header
   */
  extractTokenFromHeader(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.slice(7);
  }

  /**
   * Update session's Discord user
   */
  async updateDiscordUser(token, discordUserId) {
    if (!discordUserId) {
      throw new Error('discord_user_id required');
    }

    try {
      const result = await this.db.query(
        'UPDATE web_sessions SET discord_user_id = $1 WHERE token = $2 RETURNING session_id',
        [discordUserId, token]
      );

      if (result.rows.length === 0) {
        return false;
      }

      this.logger.info(`Updated session with Discord user ${discordUserId}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to update session:', error);
      throw new Error('Failed to update session');
    }
  }

  /**
   * Get Grimkeeper sessions for a user
   */
  async getUserSessions(discordUserId) {
    try {
      const result = await this.db.query(
        `SELECT session_code, guild_id, category_id, grimoire_link, active_game_id, last_active
         FROM sessions 
         WHERE storyteller_user_id = $1 
         ORDER BY last_active DESC`,
        [discordUserId]
      );

      return result.rows;
    } catch (error) {
      this.logger.error('Failed to fetch user sessions:', error);
      throw new Error('Failed to fetch user sessions');
    }
  }

  /**
   * Get session by code
   */
  async getSessionByCode(sessionCode) {
    try {
      const result = await this.db.query(
        'SELECT * FROM sessions WHERE session_code = $1',
        [sessionCode]
      );

      return result.rows[0] || null;
    } catch (error) {
      this.logger.error('Failed to fetch session by code:', error);
      throw new Error('Failed to fetch session');
    }
  }

  /**
   * Update session activity timestamp
   */
  async updateActivity(guildId, categoryId) {
    try {
      await this.db.query(
        'UPDATE sessions SET last_active = $1 WHERE guild_id = $2 AND category_id = $3',
        [Math.floor(Date.now() / 1000), guildId, categoryId]
      );
    } catch (error) {
      this.logger.error('Failed to update session activity:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Link grimoire to session
   */
  async linkGrimoireToSession(sessionCode, gameId) {
    try {
      const sessionData = await this.getSessionByCode(sessionCode);
      if (!sessionData) {
        throw new Error('Invalid session code');
      }

      const grimoireLink = `https://grim.hystericca.dev/#${sessionCode}`;

      await this.db.query(
        `UPDATE sessions 
         SET grimoire_link = $1, active_game_id = $2, last_active = $3
         WHERE session_code = $4`,
        [grimoireLink, gameId, Math.floor(Date.now() / 1000), sessionCode]
      );

      this.logger.info(`Linked grimoire to session ${sessionCode}, game ${gameId}`);
    } catch (error) {
      this.logger.error('Failed to link grimoire to session:', error);
      throw error;
    }
  }
}
