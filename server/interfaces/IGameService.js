/**
 * Game Service Interface
 * Defines contract for game management operations
 */

export class IGameService {
  /**
   * Start a new game
   * @param {Object} gameData - Game configuration
   * @returns {Promise<Object>} Created game data
   */
  async startGame(gameData) {
    throw new Error('Method not implemented');
  }

  /**
   * End a game
   * @param {number} gameId - Game ID
   * @param {string} winner - Winner ('good' or 'evil')
   * @returns {Promise<void>}
   */
  async endGame(gameId, winner) {
    throw new Error('Method not implemented');
  }

  /**
   * Get game by ID
   * @param {number} gameId - Game ID
   * @returns {Promise<Object|null>} Game data with players
   */
  async getGameById(gameId) {
    throw new Error('Method not implemented');
  }

  /**
   * Get games with filters and pagination
   * @param {Object} filters - Query filters
   * @returns {Promise<Object>} { games, totalCount }
   */
  async getGames(filters) {
    throw new Error('Method not implemented');
  }

  /**
   * Check if session has active game
   * @param {string} sessionCode - Session code
   * @returns {Promise<boolean>}
   */
  async sessionHasActiveGame(sessionCode) {
    throw new Error('Method not implemented');
  }

  /**
   * Update game players
   * @param {number} gameId - Game ID
   * @param {Array} players - Player data
   * @returns {Promise<void>}
   */
  async updatePlayers(gameId, players) {
    throw new Error('Method not implemented');
  }
}
