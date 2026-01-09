import { describe, test, expect, beforeEach } from "bun:test";
import { GameService } from '../../server/services/GameService.js';
import { SessionService } from '../../server/services/SessionService.js';
import { createTestContainer } from '../helpers/test-container.js';

describe("GameService", () => {
  let container;
  let gameService;
  let sessionService;
  let mockDb;

  beforeEach(async () => {
    container = await createTestContainer();
    mockDb = container.get('database');
    mockDb.reset();
    
    // Create test session
    mockDb.data.sessions.push({
      guild_id: '123456789',
      category_id: '987654321',
      session_code: 's1',
      active_game_id: null
    });
    
    const logger = container.get('logger');
    sessionService = new SessionService(mockDb, logger);
    gameService = new GameService(mockDb, sessionService, logger);
  });

  describe("startGame", () => {
    test("creates game with valid data", async () => {
      const gameData = {
        script: 'Trouble Brewing',
        players: ['Alice', 'Bob', 'Charlie'],
        storytellerId: '123456789',
        sessionCode: 's1'
      };

      const result = await gameService.startGame(gameData);

      expect(result).toBeDefined();
      
      const games = mockDb.getTable('games');
      expect(games.length).toBe(1);
      expect(games[0].script).toBe('Trouble Brewing');
      expect(games[0].is_active).toBe(true);
    });

    test("inserts players with seat numbers", async () => {
      const gameData = {
        script: 'Trouble Brewing',
        players: [
          { name: 'Alice', role: 'washerwoman' },
          { name: 'Bob', role: 'imp' }
        ],
        storytellerId: '123456789',
        sessionCode: 's1'
      };

      await gameService.startGame(gameData);
      
      const players = mockDb.getTable('game_players');
      expect(players.length).toBe(2);
      expect(players[0].seat_number).toBe(1);
      expect(players[1].seat_number).toBe(2);
      expect(players[0].player_name).toBe('Alice');
      expect(players[1].player_name).toBe('Bob');
    });

    test("handles string player names", async () => {
      const gameData = {
        script: 'Bad Moon Rising',
        players: ['Player 1', 'Player 2', 'Player 3'],
        storytellerId: '999',
        sessionCode: 's1'
      };

      const result = await gameService.startGame(gameData);

      expect(result.gameId).toBeTruthy();
      
      const players = mockDb.getTable('game_players');
      expect(players.length).toBe(3);
      expect(players[0].player_name).toBe('Player 1');
      expect(players[1].player_name).toBe('Player 2');
    });

    test("rejects game without script", async () => {
      const gameData = {
        players: ['Alice', 'Bob'],
        storytellerId: '123'
      };

      await expect(gameService.startGame(gameData)).rejects.toThrow();
    });

    test("rejects game without players", async () => {
      const gameData = {
        script: 'Trouble Brewing',
        players: [],
        storytellerId: '123'
      };

      await expect(gameService.startGame(gameData)).rejects.toThrow();
    });
  });

  describe("endGame", () => {
    test("marks game as ended with winner", async () => {
      const result = await gameService.startGame({
        script: 'Trouble Brewing',
        players: ['Alice', 'Bob'],
        storytellerId: '123',
        sessionCode: 's1'
      });

      await gameService.endGame(result.gameId, 'good');

      const games = mockDb.getTable('games');
      expect(games[0].is_active).toBe(false);
    });

    test("rejects invalid winner value", async () => {
      await gameService.startGame({
        script: 'Trouble Brewing',
        players: ['Alice'],
        storytellerId: '123',
        sessionCode: 's1'
      });

      await expect(gameService.endGame(1, {
        winner: 'invalid',
        duration: 100
      })).rejects.toThrow();
    });
  });

  describe("getGameById", () => {
    test("returns game data", async () => {
      await gameService.startGame({
        script: 'Sects & Violets',
        players: ['Test Player'],
        storytellerId: '999',
        sessionCode: 's1'
      });

      const game = await gameService.getGameById(1);

      expect(game).toBeTruthy();
      expect(game.game_id).toBe(1);
      expect(game.script).toBe('Sects & Violets');
    });

    test("returns null for non-existent game", async () => {
      const game = await gameService.getGameById(999);

      expect(game).toBeNull();
    });
  });

  describe("sessionHasActiveGame", () => {
    test("returns true when session has active game", async () => {
      await gameService.startGame({
        script: 'Trouble Brewing',
        players: ['Alice'],
        storytellerId: '123',
        sessionCode: 's1'
      });

      const hasActive = await gameService.sessionHasActiveGame('s1');

      expect(hasActive).toBe(true);
    });

    test("returns false when no active game", async () => {
      const hasActive = await gameService.sessionHasActiveGame('nonexistent');

      expect(hasActive).toBeFalsy();  // null or false both ok
    });
  });
});
