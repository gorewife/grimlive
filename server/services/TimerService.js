/**
 * Timer Service Implementation
 * Handles all timer-related operations with dependency injection
 */

import { ITimerService } from '../interfaces/ITimerService.js';

export class TimerService extends ITimerService {
  constructor(database, sessionService, logger) {
    super();
    this.db = database;
    this.sessionService = sessionService;
    this.logger = logger;
  }

  /**
   * Start a timer
   */
  async startTimer(timerData) {
    const {
      sessionCode,
      duration,
      startedBy
    } = timerData;

    // Validate
    if (!sessionCode) {
      throw new Error('Session code required');
    }

    if (!duration || duration <= 0) {
      throw new Error('Valid duration required');
    }

    // Get session data
    const sessionData = await this.sessionService.getSessionByCode(sessionCode);
    if (!sessionData) {
      throw new Error('Invalid session code');
    }

    const now = Math.floor(Date.now() / 1000);
    const endTime = now + duration;

    try {
      // Check if timer already exists for this session
      const existing = await this.db.query(
        'SELECT timer_id FROM timers WHERE guild_id = $1 AND category_id = $2 AND is_active = true',
        [sessionData.guild_id, sessionData.category_id]
      );

      if (existing.rows.length > 0) {
        throw new Error('Timer already active for this session');
      }

      // Insert timer
      const result = await this.db.query(`
        INSERT INTO timers (
          guild_id, category_id, duration_seconds, start_time, end_time,
          started_by, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING timer_id
      `, [
        sessionData.guild_id,
        sessionData.category_id,
        duration,
        now,
        endTime,
        startedBy
      ]);

      const timerId = result.rows[0].timer_id;
      this.logger.info(`Timer ${timerId} started for session ${sessionCode}`);
      return timerId;

    } catch (error) {
      this.logger.error('Failed to start timer:', error);
      throw error;
    }
  }

  /**
   * Pause a timer
   */
  async pauseTimer(timerId) {
    try {
      const result = await this.db.query(
        'UPDATE timers SET is_active = false WHERE timer_id = $1 AND is_active = true RETURNING timer_id',
        [timerId]
      );

      if (result.rows.length === 0) {
        throw new Error('Timer not found or already paused');
      }

      this.logger.info(`Timer ${timerId} paused`);
    } catch (error) {
      this.logger.error('Failed to pause timer:', error);
      throw error;
    }
  }

  /**
   * Stop a timer
   */
  async stopTimer(timerId) {
    try {
      const result = await this.db.query(
        'DELETE FROM timers WHERE timer_id = $1 RETURNING timer_id',
        [timerId]
      );

      if (result.rows.length === 0) {
        throw new Error('Timer not found');
      }

      this.logger.info(`Timer ${timerId} stopped`);
    } catch (error) {
      this.logger.error('Failed to stop timer:', error);
      throw error;
    }
  }

  /**
   * Get active timer for session
   */
  async getActiveTimer(sessionCode) {
    try {
      const sessionData = await this.sessionService.getSessionByCode(sessionCode);
      if (!sessionData) {
        return null;
      }

      const result = await this.db.query(
        `SELECT * FROM timers 
         WHERE guild_id = $1 AND category_id = $2 AND is_active = true
         ORDER BY start_time DESC
         LIMIT 1`,
        [sessionData.guild_id, sessionData.category_id]
      );

      return result.rows[0] || null;
    } catch (error) {
      this.logger.error('Failed to fetch timer:', error);
      throw error;
    }
  }

  /**
   * Clean up expired timers
   */
  async cleanupExpiredTimers() {
    const now = Math.floor(Date.now() / 1000);

    try {
      const result = await this.db.query(
        'DELETE FROM timers WHERE end_time < $1 RETURNING timer_id',
        [now]
      );

      if (result.rows.length > 0) {
        this.logger.info(`Cleaned up ${result.rows.length} expired timers`);
      }

      return result.rows.length;
    } catch (error) {
      this.logger.error('Failed to cleanup timers:', error);
      return 0;
    }
  }
}
