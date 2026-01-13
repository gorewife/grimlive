/**
 * PostgreSQL Database Repository Implementation
 * PostgreSQL connection pool with query logging and health checks
 */

import pg from 'pg';
import { logger } from '../logger.js';

const { Pool } = pg;

export class PostgreSQLRepository {
  constructor(config, loggerInstance = logger) {
    this.config = config;
    this.logger = loggerInstance;
    this.pool = new Pool(config);
    
    this.pool.on('error', (err) => {
      this.logger.error('Unexpected database error:', err);
    });

    this.poolMetricsInterval = setInterval(() => {
      const poolStats = {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount
      };
      this.logger.debug('Pool metrics:', poolStats);
    }, 60000); // Log every minute

    this.logger.info('PostgreSQL connection pool initialized');
  }

  /**
   * Execute a query
   */
  async query(queryText, params = []) {
    const start = Date.now();
    try {
      const result = await this.pool.query(queryText, params);
      const duration = Date.now() - start;
      
      if (duration > 1000) {
        this.logger.warn(`Slow query (${duration}ms):`, queryText.substring(0, 100));
      }
      
      return result;
    } catch (error) {
      this.logger.error('Query error:', error.message);
      // Mask parameters to avoid logging sensitive data
      const maskedParams = params.map(p => 
        typeof p === 'string' && p.length > 3 ? p[0] + '***' : '***'
      );
      this.logger.debug('Failed query:', queryText.substring(0, 100), 'params:', maskedParams);
      throw error;
    }
  }

  /**
   * Execute a transaction
   */
  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Transaction error:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close the connection pool
   */
  async close() {
    if (this.poolMetricsInterval) {
      clearInterval(this.poolMetricsInterval);
    }
    await this.pool.end();
    this.logger.info('Database connection pool closed');
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error('Database health check failed:', error.message);
      return false;
    }
  }

  getPoolMetrics() {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount
    };
  }

  /**
   * Get a client from the pool (for advanced use cases)
   */
  async getClient() {
    return await this.pool.connect();
  }
}
