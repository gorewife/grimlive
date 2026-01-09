/**
 * Service Container
 * Central registry for dependency injection
 * Manages service lifecycle and dependencies
 */

import { logger } from '../logger.js';
import { ConfigService } from './ConfigService.js';
import { PostgreSQLRepository } from '../repositories/PostgreSQLRepository.js';
import { SessionService } from './SessionService.js';
import { GameService } from './GameService.js';
import { TimerService } from './TimerService.js';
import { CleanupService } from './CleanupService.js';

export class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.initialized = false;
  }

  /**
   * Initialize all services
   */
  async initialize() {
    if (this.initialized) {
      throw new Error('ServiceContainer already initialized');
    }

    // 1. Configuration (no dependencies)
    const config = new ConfigService();
    this.register('config', config);

    // 2. Database (depends on config)
    const dbConfig = config.getDatabaseConfig();
    const database = new PostgreSQLRepository(dbConfig, logger);
    this.register('database', database);

    // Test database connection
    const isHealthy = await database.healthCheck();
    if (!isHealthy) {
      throw new Error('Database connection failed');
    }

    // 3. Session Service (depends on database, logger)
    const sessionService = new SessionService(database, logger);
    this.register('session', sessionService);

    // 4. Game Service (depends on database, session, logger)
    const gameService = new GameService(database, sessionService, logger);
    this.register('game', gameService);

    // 5. Timer Service (depends on database, session, logger)
    const timerService = new TimerService(database, sessionService, logger);
    this.register('timer', timerService);

    // 6. Cleanup Service (depends on database, config, logger)
    const cleanupService = new CleanupService(database, config, logger);
    this.register('cleanup', cleanupService);

    this.initialized = true;
    logger.info('Service container initialized successfully');
  }

  /**
   * Register a service
   */
  register(name, service) {
    if (this.services.has(name)) {
      throw new Error(`Service '${name}' already registered`);
    }
    this.services.set(name, service);
  }

  /**
   * Get a service by name
   */
  get(name) {
    if (!this.initialized) {
      throw new Error('ServiceContainer not initialized. Call initialize() first.');
    }

    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' not found`);
    }
    return service;
  }

  /**
   * Check if service exists
   */
  has(name) {
    return this.services.has(name);
  }

  /**
   * Shutdown all services gracefully
   */
  async shutdown() {
    logger.info('Shutting down services...');

    // Stop cleanup service
    if (this.has('cleanup')) {
      this.get('cleanup').stop();
    }

    // Close database connection
    if (this.has('database')) {
      await this.get('database').close();
    }

    this.services.clear();
    this.initialized = false;
    logger.info('Services shut down successfully');
  }

  /**
   * Get all service names
   */
  getServiceNames() {
    return Array.from(this.services.keys());
  }
}

// Singleton instance
let containerInstance = null;

/**
 * Get or create the singleton service container
 */
export function getServiceContainer() {
  if (!containerInstance) {
    containerInstance = new ServiceContainer();
  }
  return containerInstance;
}
