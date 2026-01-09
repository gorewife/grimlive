/**
 * Timer Service Interface
 * Defines contract for timer management operations
 */

export class ITimerService {
  /**
   * Start a timer
   * @param {Object} timerData - Timer configuration
   * @returns {Promise<number>} Timer ID
   */
  async startTimer(timerData) {
    throw new Error('Method not implemented');
  }

  /**
   * Pause a timer
   * @param {number} timerId - Timer ID
   * @returns {Promise<void>}
   */
  async pauseTimer(timerId) {
    throw new Error('Method not implemented');
  }

  /**
   * Stop a timer
   * @param {number} timerId - Timer ID
   * @returns {Promise<void>}
   */
  async stopTimer(timerId) {
    throw new Error('Method not implemented');
  }

  /**
   * Get active timer for session
   * @param {string} sessionCode - Session code
   * @returns {Promise<Object|null>} Timer data
   */
  async getActiveTimer(sessionCode) {
    throw new Error('Method not implemented');
  }

  /**
   * Clean up expired timers
   * @returns {Promise<number>} Number of timers cleaned
   */
  async cleanupExpiredTimers() {
    throw new Error('Method not implemented');
  }
}
