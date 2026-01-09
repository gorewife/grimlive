/**
 * Configuration Service
 * Single source of truth for all application configuration
 * Separates configuration from implementation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class ConfigService {
  constructor(envPath = null) {
    this.config = {};
    this.loadEnvironment(envPath);
  }

  /**
   * Load environment variables from .env file
   */
  loadEnvironment(customPath = null) {
    const envPath = customPath || path.join(__dirname, '../.env');
    
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...values] = trimmed.split('=');
          if (key && values.length) {
            const value = values.join('=').trim();
            // Don't overwrite existing env vars
            if (!process.env[key.trim()]) {
              process.env[key.trim()] = value;
            }
          }
        }
      });
    }
  }

  /**
   * Get database configuration
   */
  getDatabaseConfig() {
    if (process.env.DB_HOST) {
      return {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: String(process.env.DB_PASSWORD),
      };
    }
    
    return {
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost/grimlive_dev'
    };
  }

  /**
   * Get server configuration
   */
  getServerConfig() {
    const port = parseInt(process.env.PORT, 10);
    const pingInterval = parseInt(process.env.PING_INTERVAL, 10);
    const maxBodySize = parseInt(process.env.MAX_BODY_SIZE, 10);

    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid PORT: ${process.env.PORT}. Must be a number between 1-65535`);
    }

    if (process.env.PING_INTERVAL && (isNaN(pingInterval) || pingInterval < 1000)) {
      throw new Error(`Invalid PING_INTERVAL: ${process.env.PING_INTERVAL}. Must be >= 1000ms`);
    }

    if (process.env.MAX_BODY_SIZE && (isNaN(maxBodySize) || maxBodySize < 1024)) {
      throw new Error(`Invalid MAX_BODY_SIZE: ${process.env.MAX_BODY_SIZE}. Must be >= 1024 bytes`);
    }

    return {
      port,
      nodeEnv: process.env.NODE_ENV || 'development',
      isProduction: process.env.NODE_ENV === 'production',
      isTest: process.env.NODE_ENV === 'test',
      sslEnabled: process.env.SSL_ENABLED === 'true',
      pingInterval: pingInterval || 30000,
      maxBodySize: maxBodySize || 1024 * 100,
    };
  }

  /**
   * Get Discord OAuth configuration
   */
  getDiscordConfig() {
    return {
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      redirectUri: process.env.DISCORD_REDIRECT_URI || 'http://localhost:8001/auth/discord/callback',
      scope: 'identify guilds',
    };
  }

  /**
   * Get SSL certificate paths
   */
  getSSLConfig() {
    return {
      certPath: '/etc/letsencrypt/live/clocktower.live/fullchain.pem',
      keyPath: '/etc/letsencrypt/live/clocktower.live/privkey.pem',
    };
  }

  /**
   * Get cleanup task configuration
   */
  getCleanupConfig() {
    return {
      interval: parseInt(process.env.CLEANUP_INTERVAL) || (60 * 60 * 1000), // 1 hour
      staleGameThreshold: parseInt(process.env.STALE_GAME_THRESHOLD) || (24 * 60 * 60), // 24 hours
    };
  }

  /**
   * Get generic config value
   */
  get(key, defaultValue = null) {
    return process.env[key] || defaultValue;
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(feature) {
    return process.env[`FEATURE_${feature.toUpperCase()}`] === 'true';
  }
}
