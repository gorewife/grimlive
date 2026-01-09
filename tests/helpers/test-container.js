/**
 * Test Service Container - Provides mock services for testing
 * Uses same DI pattern as production but with controllable mocks
 */

export class TestServiceContainer {
  constructor() {
    this.services = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      throw new Error('Container already initialized');
    }

    const mockLogger = {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {}
    };

    // Mock database with in-memory state
    const mockDb = new MockDatabase();
    
    // Mock config
    const mockConfig = {
      getDatabaseConfig: () => ({ host: 'test', port: 5432 }),
      getServerConfig: () => ({ port: 8001 }),
      getDiscordConfig: () => ({ clientId: 'test' }),
      getCleanupConfig: () => ({ 
        intervalMinutes: 60,
        staleGameThreshold: 86400 
      }),
      isFeatureEnabled: () => true
    };

    this.services.set('logger', mockLogger);
    this.services.set('config', mockConfig);
    this.services.set('database', mockDb);

    this.initialized = true;
  }

  get(serviceName) {
    if (!this.initialized) {
      throw new Error('Container not initialized - call initialize() first');
    }
    
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service '${serviceName}' not found`);
    }
    
    return service;
  }

  has(serviceName) {
    return this.services.has(serviceName);
  }

  async shutdown() {
    this.services.clear();
    this.initialized = false;
  }
}

/**
 * Mock Database - In-memory database for testing
 */
export class MockDatabase {
  constructor() {
    this.data = {
      web_sessions: [],
      sessions: [],
      games: [],
      game_players: [],
      timers: []
    };
    this.nextId = {
      game_id: 1,
      timer_id: 1
    };
  }

  async query(sql, params = []) {
    const sqlLower = sql.toLowerCase().trim();
    
    // INSERT INTO web_sessions
    if (sqlLower.includes('insert into web_sessions')) {
      const session = {
        session_id: params[0],
        token: params[1],
        discord_user_id: params[2],
        expires_at: params[3]
      };
      this.data.web_sessions.push(session);
      return { rows: [session] };
    }

    // SELECT FROM web_sessions
    if (sqlLower.includes('select') && sqlLower.includes('web_sessions')) {
      if (sqlLower.includes('where token')) {
        const token = params[0];
        const now = params[1] || Math.floor(Date.now() / 1000);
        const rows = this.data.web_sessions.filter(s => {
          if (s.token !== token) return false;
          return s.expires_at > now;
        });
        return { rows };
      }
      if (sqlLower.includes('where session_id')) {
        const sessionId = params[0];
        const rows = this.data.web_sessions.filter(s => s.session_id === sessionId);
        return { rows };
      }
      return { rows: this.data.web_sessions };
    }

    // INSERT INTO games
    if (sqlLower.includes('insert into games')) {
      const game = {
        game_id: this.nextId.game_id++,
        guild_id: params[0],
        script: params[1],
        num_players: params[2],
        storyteller_id: params[3],
        started_at: new Date(),
        is_active: true
      };
      this.data.games.push(game);
      return { rows: [game] };
    }

    // INSERT INTO game_players  
    if (sqlLower.includes('insert into game_players')) {
      const player = {
        game_id: params[0],
        discord_id: params[1],
        player_name: params[2],
        seat_number: params[3],
        starting_role_name: params[4],
        starting_team: params[5]
      };
      this.data.game_players.push(player);
      return { rows: [player] };
    }

    // SELECT FROM games
    if (sqlLower.includes('select') && sqlLower.includes('games')) {
      if (sqlLower.includes('where game_id')) {
        const gameId = params[0];
        const rows = this.data.games.filter(g => g.game_id === gameId);
        return { rows };
      }
      if (sqlLower.includes('where guild_id') && sqlLower.includes('is_active')) {
        const guildId = params[0];
        const rows = this.data.games.filter(g => g.guild_id === guildId && g.is_active);
        return { rows };
      }
      return { rows: this.data.games };
    }

    // INSERT INTO timers
    if (sqlLower.includes('insert into timers')) {
      const timer = {
        timer_id: this.nextId.timer_id++,
        guild_id: params[0],
        category_id: params[1],
        duration_seconds: params[2],
        end_time: params[3],
        is_active: true
      };
      this.data.timers.push(timer);
      return { rows: [timer] };
    }

    // UPDATE/DELETE operations
    if (sqlLower.includes('update web_sessions')) {
      if (sqlLower.includes('where token')) {
        const discordUserId = params[0];
        const token = params[1];
        const session = this.data.web_sessions.find(s => s.token === token);
        if (session) {
          session.discord_user_id = discordUserId;
          return { rows: [{ session_id: session.session_id }], rowCount: 1 };
        }
      }
      if (sqlLower.includes('where session_id')) {
        const sessionId = params[params.length - 1];
        const session = this.data.web_sessions.find(s => s.session_id === sessionId);
        if (session) {
          if (sqlLower.includes('discord_user_id')) {
            session.discord_user_id = params[0];
          }
          return { rows: [session], rowCount: 1 };
        }
      }
      return { rows: [], rowCount: 0 };
    }

    if (sqlLower.includes('update') || sqlLower.includes('delete')) {
      return { rows: [], rowCount: 0 };
    }

    // Default empty result
    return { rows: [] };
  }

  async transaction(callback) {
    return await callback();
  }

  async close() {}

  async healthCheck() {
    return { healthy: true, latency: 0 };
  }

  // Test helpers
  reset() {
    this.data = {
      web_sessions: [],
      sessions: [],
      games: [],
      game_players: [],
      timers: []
    };
    this.nextId = {
      game_id: 1,
      timer_id: 1
    };
  }

  getTable(tableName) {
    return this.data[tableName] || [];
  }
}

/**
 * Create test container with services initialized
 */
export async function createTestContainer() {
  const container = new TestServiceContainer();
  await container.initialize();
  return container;
}
