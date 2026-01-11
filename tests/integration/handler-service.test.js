/**
 * Handler → Service Integration Tests
 * Tests the full request flow through handlers to services with mocked database
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { LegacyAPIHandler } from '../../server/handlers/LegacyAPIHandler.js';
import { SessionService } from '../../server/services/SessionService.js';
import { GameService } from '../../server/services/GameService.js';
import { TimerService } from '../../server/services/TimerService.js';
import { createTestContainer } from '../helpers/test-container.js';
import { EventEmitter } from 'events';

// Helper to create mock HTTP request
function createMockRequest(body, headers = {}) {
  const req = new EventEmitter();
  req.headers = headers;
  
  // Simulate async body reading
  setTimeout(() => {
    const bodyStr = JSON.stringify(body);
    req.emit('data', Buffer.from(bodyStr));
    req.emit('end');
  }, 0);
  
  return req;
}

describe("LegacyAPIHandler Integration", () => {
  let container;
  let handler;
  let mockDb;
  let testToken;
  let testSessionId;

  beforeEach(async () => {
    container = await createTestContainer();
    mockDb = container.get('database');
    mockDb.reset();
    
    // Setup test session
    testSessionId = 'test-session-' + Date.now();
    testToken = 'test-token-' + Date.now();
    const expires = Math.floor(Date.now() / 1000) + 3600;
    
    mockDb.data.web_sessions.push({
      session_id: testSessionId,
      token: testToken,
      discord_user_id: '123456789',
      expires_at: expires
    });
    
    mockDb.data.sessions.push({
      guild_id: '111111111',
      category_id: '222222222',
      session_code: 's1',
      active_game_id: null
    });
    
    // Create services
    const logger = container.get('logger');
    const sessionService = new SessionService(mockDb, logger);
    const gameService = new GameService(mockDb, sessionService, logger);
    const timerService = new TimerService(mockDb, sessionService, logger);
    
    // Mock container.get for handler
    const mockContainer = {
      get: (name) => {
        const services = {
          'session': sessionService,
          'game': gameService,
          'timer': timerService,
          'config': { get: (key) => key === 'logger' ? logger : null },
          'logger': logger
        };
        return services[name];
      }
    };
    
    handler = new LegacyAPIHandler(mockContainer);
  });

  describe("Session Management", () => {
    test("createSession creates session and returns token", async () => {
      const body = { discord_user_id: '999888777' };
      const req = createMockRequest(body);

      const response = await handler.createSession(req);
      const data = JSON.parse(await response.text());

      expect(response.status).toBe(200);
      expect(data.token).toBeDefined();
      expect(data.sessionId).toBeDefined();
      expect(mockDb.data.web_sessions.length).toBe(2);
    });

    test("updateSessionDiscordUser requires authentication", async () => {
      const body = { discord_user_id: '999' };
      const req = createMockRequest(body);

      const response = await handler.updateSessionDiscordUser(req);

      expect(response.status).toBe(401);
    });

    test("updateSessionDiscordUser updates with valid token", async () => {
      const body = { discord_user_id: '999888777' };
      const req = createMockRequest(body, { 'authorization': `Bearer ${testToken}` });

      const response = await handler.updateSessionDiscordUser(req);

      expect(response.status).toBe(200);
      const session = mockDb.data.web_sessions.find(s => s.token === testToken);
      expect(session.discord_user_id).toBe('999888777');
    });
  });

  describe("Game Operations", () => {
    test("startGame creates game with valid data", async () => {
      const body = {
        sessionCode: 's1',
        script: 'Trouble Brewing',
        players: ['Alice', 'Bob', 'Charlie'],
        storytellerId: '123456789'
      };
      const req = createMockRequest(body, { 'authorization': `Bearer ${testToken}` });

      const response = await handler.startGame(req);
      const data = JSON.parse(await response.text());

      expect(response.status).toBe(200);
      expect(data.game_id).toBeDefined();
      expect(mockDb.data.games.length).toBe(1);
      expect(mockDb.data.games[0].script).toBe('Trouble Brewing');
    });

    test("startGame rejects without authentication", async () => {
      const body = {
        sessionCode: 's1',
        script: 'Trouble Brewing',
        players: ['Alice']
      };
      const req = createMockRequest(body);

      const response = await handler.startGame(req);

      expect(response.status).toBe(401);
    });

    test("startGame validates required fields", async () => {
      const body = {
        sessionCode: 's1',
        players: ['Alice']
        // Missing script
      };
      const req = createMockRequest(body, { 'authorization': `Bearer ${testToken}` });

      const response = await handler.startGame(req);

      expect(response.status).toBe(400);
    });

    test("endGame updates game status", async () => {
      // First create a game
      const startBody = {
        sessionCode: 's1',
        script: 'Trouble Brewing',
        players: ['Alice'],
        storytellerId: '123'
      };
      const startReq = createMockRequest(startBody, { 'authorization': `Bearer ${testToken}` });
      
      const startResponse = await handler.startGame(startReq);
      const startData = JSON.parse(await startResponse.text());
      
      // Now end it
      const endBody = {
        gameId: startData.game_id,
        winner: 'good'
      };
      const endReq = createMockRequest(endBody, { 'authorization': `Bearer ${testToken}` });

      const response = await handler.endGame(endReq);

      expect(response.status).toBe(200);
      expect(mockDb.data.games[0].is_active).toBe(false);
    });
  });

  describe("Timer Operations", () => {
    test("startTimer creates timer with valid data", async () => {
      const body = {
        sessionCode: 's1',
        duration: 300,
        startedBy: 'TestUser'
      };
      const req = createMockRequest(body, { 'authorization': `Bearer ${testToken}` });

      const response = await handler.startTimer(req);

      expect(response.status).toBe(200);
      expect(mockDb.data.timers.length).toBe(1);
    });

    test("pauseTimer returns error (not supported)", async () => {
      // Start timer first
      const startBody = {
        sessionCode: 's1',
        duration: 300,
        startedBy: 'TestUser'
      };
      const startReq = createMockRequest(startBody, { 'authorization': `Bearer ${testToken}` });
      
      const startResponse = await handler.startTimer(startReq);
      const startData = JSON.parse(await startResponse.text());
      
      // Attempt to pause (should fail)
      const pauseBody = { timerId: startData.timerId };
      const pauseReq = createMockRequest(pauseBody, { 'authorization': `Bearer ${testToken}` });

      const response = await handler.pauseTimer(pauseReq);

      expect(response.status).toBe(400);
      const data = JSON.parse(await response.text());
      expect(data.error).toContain('not supported');
    });

    test("stopTimer removes timer", async () => {
      // Start timer
      const startBody = {
        sessionCode: 's1',
        duration: 300,
        startedBy: 'TestUser'
      };
      const startReq = createMockRequest(startBody, { 'authorization': `Bearer ${testToken}` });
      
      const startResponse = await handler.startTimer(startReq);
      const startData = JSON.parse(await startResponse.text());
      
      // Stop it
      const stopBody = { timerId: startData.timerId };
      const stopReq = createMockRequest(stopBody, { 'authorization': `Bearer ${testToken}` });

      const response = await handler.stopTimer(stopReq);

      expect(response.status).toBe(200);
      expect(mockDb.data.timers.length).toBe(0);
    });
  });

  describe("Error Handling", () => {
    test("handles service errors gracefully", async () => {
      const body = {
        sessionCode: 'invalid-code',
        script: 'Trouble Brewing',
        players: ['Alice']
      };
      const req = createMockRequest(body, { 'authorization': `Bearer ${testToken}` });

      const response = await handler.startGame(req);

      expect(response.status).toBe(400);
      const data = JSON.parse(await response.text());
      expect(data.error).toBeDefined();
    });

    test("handles malformed request body", async () => {
      const req = {
        headers: { 'authorization': `Bearer ${testToken}` },
        text: async () => { throw new Error('Invalid JSON'); }
      };

      const response = await handler.startGame(req);

      expect(response.status).toBe(400);
    });

    test("validates token expiration", async () => {
      // Add expired token
      const expiredToken = 'expired-token';
      const pastExpiry = Math.floor(Date.now() / 1000) - 3600;
      
      mockDb.data.web_sessions.push({
        session_id: 'expired-session',
        token: expiredToken,
        discord_user_id: '111',
        expires_at: pastExpiry
      });

      const body = {
        sessionCode: 's1',
        script: 'Test',
        players: ['A']
      };
      const req = {
        headers: { 'authorization': `Bearer ${expiredToken}` },
        text: async () => JSON.stringify(body)
      };

      const response = await handler.startGame(req);

      expect(response.status).toBe(401);
    });
  });
});
