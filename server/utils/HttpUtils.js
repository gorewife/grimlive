/**
 * HTTP Response Utilities
 * Standardized response formatting
 */

export class ResponseUtils {
  /**
   * Create a JSON response
   */
  static json(data, status = 200, additionalHeaders = {}) {
    return {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...additionalHeaders
      },
      text: async () => JSON.stringify(data)
    };
  }

  /**
   * Create an error response
   */
  static error(message, status = 400, details = null) {
    const body = { error: message };
    if (details) {
      body.details = details;
    }
    return this.json(body, status);
  }

  /**
   * Create a success response
   */
  static success(data = {}, message = null) {
    const body = { success: true, ...data };
    if (message) {
      body.message = message;
    }
    return this.json(body, 200);
  }

  /**
   * Create an unauthorized response
   */
  static unauthorized(message = 'Unauthorized') {
    return this.error(message, 401);
  }

  /**
   * Create a forbidden response
   */
  static forbidden(message = 'Forbidden') {
    return this.error(message, 403);
  }

  /**
   * Create a not found response
   */
  static notFound(message = 'Not found') {
    return this.error(message, 404);
  }

  /**
   * Create a rate limit response
   */
  static rateLimit(limit, remaining = 0) {
    return {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'Retry-After': '60'
      },
      text: async () => JSON.stringify({
        error: 'Rate limit exceeded',
        rateLimit: { limit, remaining }
      })
    };
  }

  /**
   * Create a validation error response
   */
  static validationError(errors) {
    return this.error('Validation failed', 400, { errors });
  }
}

/**
 * Request Parsing Utilities
 */
export class RequestUtils {
  /**
   * Parse JSON body from request
   */
  static async parseBody(req, maxSize = 1024 * 100) {
    return new Promise((resolve, reject) => {
      // Check if the stream has already ended
      if (req.readableEnded) {
        console.log('[parseBody] Stream already ended, cannot read body');
        resolve({});
        return;
      }

      let body = '';
      let size = 0;
      let dataEvents = 0;

      console.log('[parseBody] Starting, readable:', req.readable, 'readableEnded:', req.readableEnded);

      req.resume(); // Ensure request stream is flowing

      req.on('data', chunk => {
        dataEvents++;
        console.log('[parseBody] Data event', dataEvents, 'chunk size:', chunk.length);
        size += chunk.length;
        if (size > maxSize) {
          req.destroy();
          reject(new Error('Request body too large'));
          return;
        }
        body += chunk.toString();
      });

      req.on('end', () => {
        console.log('[parseBody] End event, dataEvents:', dataEvents, 'body length:', body.length);
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (error) {
          reject(new Error('Invalid JSON'));
        }
      });

      req.on('error', error => {
        console.log('[parseBody] Error event:', error);
        reject(error);
      });
    });
  }

  /**
   * Extract bearer token from authorization header
   */
  static extractBearerToken(req) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return null;
    }
    return auth.slice(7);
  }

  /**
   * Extract API key from header
   */
  static extractApiKey(req) {
    return req.headers['x-api-key'] || null;
  }

  /**
   * Get client IP address
   */
  static getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] || 
           req.headers['x-real-ip'] || 
           req.socket.remoteAddress;
  }
}
