/**
 * Game Service Implementation
 * Handles all game-related operations with dependency injection
 */

export class GameService {
  constructor(database, sessionService, logger) {
    this.db = database;
    this.sessionService = sessionService;
    this.logger = logger;
  }

  /**
   * Start a new game
   */
  async startGame(gameData) {
    const {
      script,
      customName,
      players,
      storytellerId,
      sessionCode
    } = gameData;

    // Validate input
    this._validateGameStart(script, players, sessionCode);

    let guildId = null;
    let categoryId = null;

    // Handle session code
    if (sessionCode) {
      const sessionData = await this.sessionService.getSessionByCode(sessionCode);
      if (!sessionData) {
        throw new Error('Invalid session code');
      }

      // Check if session has an active game reference
      if (sessionData.active_game_id) {
        // Verify the game actually exists and is active
        const existingGame = await this.db.query(
          'SELECT game_id, is_active FROM games WHERE game_id = $1',
          [sessionData.active_game_id]
        );

        if (existingGame.rows.length > 0 && existingGame.rows[0].is_active) {
          throw new Error('Session already has an active game');
        }

        // Game doesn't exist or is not active - clear the stale reference
        await this.db.query(
          'UPDATE sessions SET active_game_id = NULL WHERE guild_id = $1 AND category_id = $2',
          [sessionData.guild_id, sessionData.category_id]
        );
        this.logger.info(`Cleared stale active_game_id ${sessionData.active_game_id} from session ${sessionCode}`);
      }

      guildId = sessionData.guild_id;
      categoryId = sessionData.category_id;
    }

    const startTime = Math.floor(Date.now() / 1000);
    const playersJson = JSON.stringify(players || []);
    const playerCount = players?.length || 0;

    try {
      // Use transaction for atomicity
      const result = await this.db.transaction(async (client) => {
        // Insert game
        const gameResult = await client.query(`
          INSERT INTO games (
            guild_id, category_id, script, custom_name, start_time,
            players, player_count, storyteller_id, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
          RETURNING game_id
        `, [guildId, categoryId, script, customName, startTime, playersJson, playerCount, storytellerId]);

        const gameId = gameResult.rows[0].game_id;

        // Insert players
        if (players && players.length > 0) {
          await this._insertPlayers(client, gameId, players);
        }

        return gameId;
      });

      // Link grimoire to session if applicable
      if (sessionCode) {
        await this.sessionService.linkGrimoireToSession(sessionCode, result);
      }

      // Create announcement for grimkeeper if we have guild and category
      if (guildId && categoryId) {
        try {
          await this.db.query(
            `INSERT INTO announcements (
              guild_id, category_id, announcement_type, game_id, data, created_at
            ) VALUES ($1, $2, 'game_start', $3, $4, $5)`,
            [
              guildId,
              categoryId,
              result,
              JSON.stringify({
                script,
                custom_name: customName,
                player_count: playerCount,
                storyteller_id: storytellerId
              }),
              Math.floor(Date.now() / 1000)
            ]
          );
        } catch (announcementError) {
          this.logger.error('Failed to create game start announcement:', announcementError);
          // Don't fail the whole request if announcement fails
        }
      }

      this.logger.info(`Game ${result} started successfully`);
      return { gameId: result };

    } catch (error) {
      this.logger.error('Failed to start game:', error);
      throw new Error('Failed to start game');
    }
  }

  /**
   * End a game
   */
  async endGame(gameId, winner) {
    // Normalize winner to match database CHECK constraint: 'Good', 'Evil', or 'Cancel'
    let normalizedWinner = winner;
    if (winner) {
      const lower = winner.toLowerCase();
      if (lower === 'good') normalizedWinner = 'Good';
      else if (lower === 'evil') normalizedWinner = 'Evil';
      else if (lower === 'cancel') normalizedWinner = 'Cancel';
    }

    if (!['Good', 'Evil', 'Cancel'].includes(normalizedWinner)) {
      throw new Error('Invalid winner value');
    }

    const endTime = Math.floor(Date.now() / 1000);

    try {
      let gameData;
      await this.db.transaction(async (client) => {
        // Update game
        await client.query(
          'UPDATE games SET end_time = $1, winner = $2, is_active = FALSE WHERE game_id = $3',
          [endTime, normalizedWinner, gameId]
        );

        // Clear active_game_id from sessions
        await client.query(
          'UPDATE sessions SET active_game_id = NULL WHERE active_game_id = $1',
          [gameId]
        );

        // Get game data for announcement
        const gameResult = await client.query(
          'SELECT guild_id, category_id, script, custom_name, player_count, storyteller_id FROM games WHERE game_id = $1',
          [gameId]
        );
        gameData = gameResult.rows[0];
      });

      // Create announcement for grimkeeper if we have guild and category
      if (gameData && gameData.guild_id && gameData.category_id) {
        try {
          // Determine announcement type based on winner
          const announcementType = normalizedWinner === 'Cancel' ? 'game_cancel' : 'game_end';
          
          await this.db.query(
            `INSERT INTO announcements (
              guild_id, category_id, announcement_type, game_id, data, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              gameData.guild_id,
              gameData.category_id,
              announcementType,
              gameId,
              JSON.stringify({
                script: gameData.script,
                custom_name: gameData.custom_name,
                player_count: gameData.player_count,
                storyteller_id: gameData.storyteller_id,
                winner: normalizedWinner
              }),
              Math.floor(Date.now() / 1000)
            ]
          );
          this.logger.info(`Created ${announcementType} announcement for game ${gameId}`);
        } catch (announcementError) {
          this.logger.error('Failed to create game end announcement:', announcementError);
          // Don't fail the whole request if announcement fails
        }
      }

      this.logger.info(`Game ${gameId} ended, winner: ${normalizedWinner}`);
    } catch (error) {
      this.logger.error('Failed to end game:', error);
      throw new Error('Failed to end game');
    }
  }

  /**
   * Get game by ID with players
   */
  async getGameById(gameId) {
    try {
      const gameResult = await this.db.query(
        'SELECT * FROM games WHERE game_id = $1',
        [gameId]
      );

      if (gameResult.rows.length === 0) {
        return null;
      }

      const game = gameResult.rows[0];

      // Get players
      const playersResult = await this.db.query(
        `SELECT * FROM game_players 
         WHERE game_id = $1 
         ORDER BY seat_number`,
        [gameId]
      );

      return {
        ...game,
        game_players: playersResult.rows
      };
    } catch (error) {
      this.logger.error('Failed to fetch game:', error);
      throw new Error('Failed to fetch game');
    }
  }

  /**
   * Get games with filters and pagination
   */
  async getGames(filters = {}) {
    const {
      limit = 50,
      offset = 0,
      script,
      winner,
      startDate,
      endDate
    } = filters;

    try {
      let query = 'SELECT g.*, COUNT(*) OVER() AS total_count FROM games g WHERE 1=1';
      const queryParams = [];
      let paramIndex = 1;

      if (script) {
        query += ` AND g.script = $${paramIndex++}`;
        queryParams.push(script);
      }

      if (winner) {
        query += ` AND g.winner = $${paramIndex++}`;
        queryParams.push(winner);
      }

      if (startDate) {
        query += ` AND g.start_time >= $${paramIndex++}`;
        queryParams.push(startDate);
      }

      if (endDate) {
        query += ` AND g.start_time <= $${paramIndex++}`;
        queryParams.push(endDate);
      }

      query += ` ORDER BY g.start_time DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      queryParams.push(Math.min(limit, 100), offset);

      const result = await this.db.query(query, queryParams);

      const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
      const games = result.rows.map(row => {
        const { total_count, ...game } = row;
        return game;
      });

      return { games, totalCount };
    } catch (error) {
      this.logger.error('Failed to fetch games:', error);
      throw new Error('Failed to fetch games');
    }
  }

  /**
   * Check if session has active game
   */
  async sessionHasActiveGame(sessionCode) {
    const sessionData = await this.sessionService.getSessionByCode(sessionCode);
    return sessionData && sessionData.active_game_id !== null;
  }

  /**
   * Private: Validate game start data
   */
  _validateGameStart(script, players, sessionCode) {
    if (!script) {
      throw new Error('Script name required');
    }

    if (!players || !Array.isArray(players) || players.length === 0) {
      throw new Error('At least one player required');
    }

    if (sessionCode && typeof sessionCode !== 'string') {
      throw new Error('Invalid session code format');
    }
  }

  /**
   * Private: Insert players into game_players table
   */
  async _insertPlayers(client, gameId, players) {
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const playerName = typeof player === 'string' ? player : player.name;
      const discordId = typeof player === 'object' ? (player.discord_id || null) : null;
      const roleName = typeof player === 'object' ? player.role : null;
      const alignment = typeof player === 'object' ? player.alignment : null;
      
      // Determine team from alignment and role
      const team = this._determineTeam(alignment, roleName);

      await client.query(`
        INSERT INTO game_players (
          game_id, discord_id, player_name, seat_number,
          starting_role_name, starting_team, starting_role_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        gameId,
        discordId,
        playerName,
        i + 1,
        roleName,
        team,
        roleName ? roleName.toLowerCase().replace(/\s+/g, '') : null  // starting_role_id
      ]);
    }
  }

  /**
   * Private: Determine team from alignment and role
   */
  _determineTeam(alignment, roleName) {
    if (!alignment) return null;
    
    if (alignment === 'good') {
      return 'townsfolk'; // Default for good alignment
    } else {
      // Evil alignment - check if demon or minion
      if (roleName === 'imp' || roleName?.includes('demon')) {
        return 'demon';
      }
      return 'minion';
    }
  }
}
