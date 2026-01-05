/**
 * Cleanup task to mark stale games as inactive
 * Runs periodically to prevent orphaned active games
 */

import { pool } from './api-shared.js';

/**
 * Mark games older than 24 hours as inactive
 */
async function cleanupStaleGames() {
  try {
    const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
    
    const result = await pool.query(`
      UPDATE games 
      SET is_active = FALSE 
      WHERE is_active = TRUE 
        AND start_time < $1
        AND end_time IS NULL
      RETURNING game_id, guild_id, category_id
    `, [twentyFourHoursAgo]);
    
    if (result.rows.length > 0) {
      logger.info(`Marked ${result.rows.length} stale games as inactive`);
      
      // Clear active_game_id from sessions for cleaned up games
      for (const game of result.rows) {
        await pool.query(`
          UPDATE sessions 
          SET active_game_id = NULL 
          WHERE active_game_id = $1
        `, [game.game_id]);
      }
    }
  } catch (error) {
    console.error('[Cleanup] Error cleaning up stale games:', error);
  }
}

// Run cleanup every hour
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

export function startCleanupTask() {
  logger.info('Starting cleanup task (runs every hour)');
  
  // Run immediately on startup
  cleanupStaleGames();
  
  // Then run every hour
  setInterval(cleanupStaleGames, CLEANUP_INTERVAL);
}
