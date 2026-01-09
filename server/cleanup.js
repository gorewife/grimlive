/**
 * Cleanup task bootstrap - delegates to CleanupService from ServiceContainer
 * Refactored to use dependency injection pattern
 */

import { logger } from './logger.js';

/**
 * Start cleanup tasks using CleanupService from container
 * @param {ServiceContainer} container - DI container with initialized services
 */
export async function startCleanupTask(container) {
  if (!container) {
    logger.warn('No service container provided to cleanup task - skipping');
    return;
  }

  try {
    const cleanupService = container.get('cleanup');
    await cleanupService.start();
    logger.info('Cleanup service started via container');
  } catch (error) {
    logger.error('Failed to start cleanup service:', error);
  }
}
