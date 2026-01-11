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

    // INSERT INTO sessions
    if (sqlLower.includes('insert into sessions')) {
      const session = {
        guild_id: params[0],
        category_id: params[1],
        session_code: params[2]
      };
      this.data.sessions.push(session);
      return { rows: [session] };
    }

    // SELECT FROM sessions
    if (sqlLower.includes('select') && sqlLower.includes('sessions') && !sqlLower.includes('web_sessions')) {
      if (sqlLower.includes('where session_code')) {
        const sessionCode = params[0];
        const rows = this.data.sessions.filter(s => s.session_code === sessionCode);
        return { rows };
      }
      return { rows: this.data.sessions };
    }

    // INSERT INTO games
    if (sqlLower.includes('insert into games')) {
      const game = {
        game_id: this.nextId.game_id++,
        guild_id: params[0],
        category_id: params[1],
        script: params[2],
        custom_name: params[3],
        start_time: params[4],
        players: params[5],
        player_count: params[6],
        storyteller_id: params[7],
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
        starting_role_id: params[4],
        starting_role_name: params[5],
        starting_team: params[6]
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
        guild_id: params[0],
        category_id: params[1],
        end_time: params[2],
        creator_id: params[3] || null
      };
      // Remove existing timer for this guild (guild_id is PK)
      this.data.timers = this.data.timers.filter(t => t.guild_id !== timer.guild_id);
      this.data.timers.push(timer);
      return { rows: [timer] };
    }

    // SELECT FROM timers
    if (sqlLower.includes('select') && sqlLower.includes('timers')) {
      if (sqlLower.includes('where guild_id')) {
        const guildId = params[0];
        const rows = this.data.timers.filter(t => t.guild_id === guildId);
        return { rows };
      }
      return { rows: this.data.timers };
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

    if (sqlLower.includes('update games')) {
      if (sqlLower.includes('where game_id')) {
        const gameId = params[params.length - 1];
        const game = this.data.games.find(g => g.game_id === gameId);
        if (game) {
          game.is_active = false;
          game.end_time = Math.floor(Date.now() / 1000);
          if (sqlLower.includes('winner')) {
            game.winner = params[0];
          }
          return { rows: [game], rowCount: 1 };
        }
      }
      return { rows: [], rowCount: 0 };
    }

    if (sqlLower.includes('update sessions')) {
      if (sqlLower.includes('where session_code')) {
        const sessionCode = params[params.length - 1];
        const session = this.data.sessions.find(s => s.session_code === sessionCode);
        if (session) {
          if (sqlLower.includes('grimoire_link')) {
            session.grimoire_link = params[0];
            session.active_game_id = params[1];
            session.last_active = params[2];
          } else if (sqlLower.includes('active_game_id = null')) {
            session.active_game_id = null;
          }
          return { rows: [session], rowCount: 1 };
        }
      }
      if (sqlLower.includes('where active_game_id')) {
        const gameId = params[0];
        const sessions = this.data.sessions.filter(s => s.active_game_id === gameId);
        sessions.forEach(s => s.active_game_id = null);
        return { rows: sessions, rowCount: sessions.length };
      }
      return { rows: [], rowCount: 0 };
    }

    if (sqlLower.includes('delete from timers')) {
      if (sqlLower.includes('where guild_id')) {
        const guildId = params[0];
        const timerIndex = this.data.timers.findIndex(t => t.guild_id === guildId);
        if (timerIndex !== -1) {
          const removed = this.data.timers.splice(timerIndex, 1);
          return { rows: removed, rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      // Cleanup expired timers
      if (sqlLower.includes('where end_time')) {
        const now = params[0];
        const beforeCount = this.data.timers.length;
        const expired = this.data.timers.filter(t => t.end_time < now);
        this.data.timers = this.data.timers.filter(t => t.end_time >= now);
        return { rows: expired, rowCount: beforeCount - this.data.timers.length };
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
    // Execute callback with this database as the "client"
    return await callback(this);
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
