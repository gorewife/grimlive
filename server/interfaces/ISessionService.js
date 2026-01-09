/**
 * Session Service Interface
 * Defines contract for session management operations
 */

export class ISessionService {
  /**
   * Create a new web session
   * @param {string} discordUserId - Discord user ID (optional)
   * @returns {Promise<Object>} { sessionId, token, expiresAt }
   */
  async createSession(discordUserId = null) {
    throw new Error('Method not implemented');
  }

  /**
   * Verify session token
   * @param {string} token - Session token
   * @returns {Promise<Object|null>} Session data or null
   */
  async verifyToken(token) {
    throw new Error('Method not implemented');
  }

  /**
   * Update session's Discord user
   * @param {string} token - Session token
   * @param {string} discordUserId - Discord user ID
   * @returns {Promise<boolean>} Success status
   */
  async updateDiscordUser(token, discordUserId) {
    throw new Error('Method not implemented');
  }

  /**
   * Get Grimkeeper sessions for a user
   * @param {string} discordUserId - Discord user ID
   * @returns {Promise<Array>} Array of session data
   */
  async getUserSessions(discordUserId) {
    throw new Error('Method not implemented');
  }

  /**
   * Get session by code
   * @param {string} sessionCode - Session code
   * @returns {Promise<Object|null>} Session data or null
   */
  async getSessionByCode(sessionCode) {
    throw new Error('Method not implemented');
  }

  /**
   * Update session activity timestamp
   * @param {string} guildId - Guild ID
   * @param {string} categoryId - Category ID
   * @returns {Promise<void>}
   */
  async updateActivity(guildId, categoryId) {
    throw new Error('Method not implemented');
  }

  /**
   * Link grimoire to session
   * @param {string} sessionCode - Session code
   * @param {number} gameId - Game ID
   * @returns {Promise<void>}
   */
  async linkGrimoireToSession(sessionCode, gameId) {
    throw new Error('Method not implemented');
  }
}
