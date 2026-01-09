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
  start() {
    const cleanupConfig = this.config.getCleanupConfig();
    
    this.logger.info(`Starting cleanup task (runs every ${cleanupConfig.interval / 60000} minutes)`);

    // Run immediately on startup
    this.cleanupStaleGames();

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
   * Uses actual production schema: started_at/ended_at (TIMESTAMP), is_active (BOOLEAN)
   */
  async cleanupStaleGames() {
    const cleanupConfig = this.config.getCleanupConfig();
    const thresholdTime = new Date(Date.now() - (cleanupConfig.staleGameThreshold * 1000));

    try {
      const result = await this.db.query(`
        UPDATE games 
        SET is_active = FALSE,
            ended_at = CURRENT_TIMESTAMP
        WHERE is_active = TRUE 
          AND started_at < $1
          AND ended_at IS NULL
        RETURNING game_id
      `, [thresholdTime]);

      if (result.rows.length > 0) {
        this.logger.info(`Marked ${result.rows.length} stale games as inactive`);

        // Clear active_game_id from sessions
        for (const game of result.rows) {
          await this.db.query(
            'UPDATE sessions SET active_game_id = NULL WHERE active_game_id = $1',
            [game.game_id]
          );
        }
      }
    } catch (error) {
      // Suppress error if games is a VIEW (known in some environments)
      if (error.code !== '0A000') { // 0A000 = cannot update view
        this.logger.error('Error cleaning up stale games:', error);
      }
    }
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
