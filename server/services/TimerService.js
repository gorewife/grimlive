/**
 * Timer Service Implementation
 * Handles all timer-related operations with dependency injection
 */

export class TimerService {
  constructor(database, sessionService, logger) {
    this.db = database;
    this.sessionService = sessionService;
    this.logger = logger;
  }

  /**
   * Start a timer
   * Production schema: guild_id (PK), end_time (double precision), creator_id, created_at, category_id
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
      // Check if timer already exists for this guild (guild_id is PK)
      const existing = await this.db.query(
        'SELECT guild_id FROM timers WHERE guild_id = $1',
        [sessionData.guild_id]
      );

      if (existing.rows.length > 0) {
        throw new Error('Timer already active for this session');
      }

      // Insert timer (guild_id is PK, no timer_id)
      await this.db.query(`
        INSERT INTO timers (
          guild_id, category_id, end_time, creator_id, created_at
        ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      `, [
        sessionData.guild_id,
        sessionData.category_id,
        endTime,
        startedBy
      ]);

      this.logger.info(`Timer started for guild ${sessionData.guild_id}, session ${sessionCode}`);
      return sessionData.guild_id; // Return guild_id as identifier

    } catch (error) {
      this.logger.error('Failed to start timer:', error);
      throw error;
    }
  }

  /**
   * Pause a timer - NOT SUPPORTED in production schema
   * Production schema doesn't have is_active field
   */
  async pauseTimer(guildId) {
    throw new Error('Pause timer not supported in current schema - delete timer instead');
  }

  /**
   * Stop a timer
   * Production schema uses guild_id as PK
   */
  async stopTimer(guildId) {
    try {
      const result = await this.db.query(
        'DELETE FROM timers WHERE guild_id = $1 RETURNING guild_id',
        [guildId]
      );

      if (result.rows.length === 0) {
        throw new Error('Timer not found');
      }

      this.logger.info(`Timer stopped for guild ${guildId}`);
    } catch (error) {
      this.logger.error('Failed to stop timer:', error);
      throw error;
    }
  }

  /**
   * Get active timer for session
   * Production schema: guild_id is PK, no is_active field
   */
  async getActiveTimer(sessionCode) {
    try {
      const sessionData = await this.sessionService.getSessionByCode(sessionCode);
      if (!sessionData) {
        return null;
      }

      const result = await this.db.query(
        `SELECT * FROM timers 
         WHERE guild_id = $1
         LIMIT 1`,
        [sessionData.guild_id]
      );

      return result.rows[0] || null;
    } catch (error) {
      this.logger.error('Failed to fetch timer:', error);
      throw error;
    }
  }

  /**
   * Clean up expired timers
   * Production schema: end_time (double precision UNIX timestamp)
   */
  async cleanupExpiredTimers() {
    const now = Math.floor(Date.now() / 1000);

    try {
      const result = await this.db.query(
        'DELETE FROM timers WHERE end_time < $1 RETURNING guild_id',
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
