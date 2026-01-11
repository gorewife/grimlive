/**
 * Cleanup Service
 * Handles periodic cleanup tasks with dependency injection
 */

export class CleanupService {
  constructor(database, config, logger) {
    this.db = database;
    this.config = config;
    this.logger = logger;
    this.intervalId = null;
  }

  /**
   * Start the cleanup task
   */
  async start() {
    const cleanupConfig = this.config.getCleanupConfig();
    
    this.logger.info(`Starting cleanup task (runs every ${cleanupConfig.interval / 60000} minutes)`);

    // Run immediately on startup
    await this.cleanupStaleGames();

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.cleanupStaleGames();
    }, cleanupConfig.interval);
  }

  /**
   * Stop the cleanup task
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info('Cleanup task stopped');
    }
  }

  /**
   * Clean up stale games (older than threshold)
   * Note: Skipped when games is a view (grimkeeper uses views)
   */
  async cleanupStaleGames() {
    // Skip cleanup - grimkeeper uses views which cannot be updated
    return;
  }

  /**
   * Clean up expired web sessions
   */
  async cleanupExpiredSessions() {
    const now = Math.floor(Date.now() / 1000);

    try {
      const result = await this.db.query(
        'DELETE FROM web_sessions WHERE expires_at < $1 RETURNING session_id',
        [now]
      );

      if (result.rows.length > 0) {
        this.logger.info(`Cleaned up ${result.rows.length} expired sessions`);
      }

      return result.rows.length;
    } catch (error) {
      this.logger.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }
}
