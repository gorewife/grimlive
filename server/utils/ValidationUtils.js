/**
 * Validation Utilities
 * Centralized validation logic for API requests
 * Separates validation concerns from business logic
 */

export class ValidationUtils {
  /**
   * Validate game start data
   */
  static validateGameStart(data) {
    const errors = [];

    if (!data.script || typeof data.script !== 'string') {
      errors.push('Script name required');
    }

    if (!data.players || !Array.isArray(data.players) || data.players.length === 0) {
      errors.push('At least one player required');
    }

    if (data.sessionCode && typeof data.sessionCode !== 'string') {
      errors.push('Invalid session code format');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate game end data
   */
  static validateGameEnd(data) {
    const errors = [];
    const validWinners = ['good', 'evil', 'Good', 'Evil', 'Cancel'];

    if (!data.winner || !validWinners.includes(data.winner)) {
      errors.push(`Winner must be one of: ${validWinners.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate timer data
   */
  static validateTimer(data) {
    const errors = [];

    if (!data.sessionCode) {
      errors.push('Session code required');
    }

    if (!data.duration || typeof data.duration !== 'number' || data.duration <= 0) {
      errors.push('Valid duration (in seconds) required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate session token format
   */
  static validateToken(token) {
    if (!token) return false;
    if (typeof token !== 'string') return false;
    if (token.length < 16 || token.length > 256) return false;
    return true;
  }

  /**
   * Validate API key format
   */
  static validateApiKey(apiKey) {
    if (!apiKey) return false;
    if (typeof apiKey !== 'string') return false;
    if (apiKey.length < 32) return false;
    return true;
  }

  /**
   * Validate pagination parameters
   */
  static validatePagination(limit, offset) {
    const errors = [];

    if (limit !== undefined && (typeof limit !== 'number' || limit < 1 || limit > 100)) {
      errors.push('Limit must be between 1 and 100');
    }

    if (offset !== undefined && (typeof offset !== 'number' || offset < 0)) {
      errors.push('Offset must be >= 0');
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: {
        limit: Math.min(Math.max(1, limit || 50), 100),
        offset: Math.max(0, offset || 0)
      }
    };
  }

  /**
   * Sanitize and validate player data
   */
  static sanitizePlayer(player) {
    if (typeof player === 'string') {
      return {
        name: player,
        discord_id: null,
        role: null,
        alignment: null
      };
    }

    return {
      name: player.name || 'Unknown',
      discord_id: player.discord_id || null,
      role: player.role || null,
      alignment: player.alignment || null
    };
  }

  /**
    sanitize string input to prevent XSS/injection attacks
   */
  static sanitizeString(input, maxLength = 255) {
    if (typeof input !== 'string') {
      return '';
    }

    let sanitized = input
      .replace(/\0/g, '')
      .replace(/[\x00-\x1F\x7F]/g, '')
      .replace(/<[^>]*>/g, '')
      .trim();

    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
  }

  static sanitizeSessionCode(code) {
    if (typeof code !== 'string') {
      return null;
    }
    
    const sanitized = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return sanitized.length > 0 && sanitized.length <= 16 ? sanitized : null;
  }

  static sanitizeScriptName(name) {
    if (typeof name !== 'string') {
      return '';
    }

    return name
      .replace(/[^a-zA-Z0-9 '\-]/g, '')
      .trim()
      .substring(0, 100);
  }
}
