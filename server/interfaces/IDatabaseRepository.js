/**
 * Database Repository Interface
 * Defines contract for all database operations
 * Allows for easier testing and potential database swapping
 */

export class IDatabaseRepository {
  /**
   * Execute a raw query
   * @param {string} query - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Query result with rows
   */
  async query(query, params = []) {
    throw new Error('Method not implemented');
  }

  /**
   * Execute a transaction
   * @param {Function} callback - Async function receiving client
   * @returns {Promise<any>} Transaction result
   */
  async transaction(callback) {
    throw new Error('Method not implemented');
  }

  /**
   * Close database connection
   */
  async close() {
    throw new Error('Method not implemented');
  }

  /**
   * Check if database is healthy
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    throw new Error('Method not implemented');
  }
}
