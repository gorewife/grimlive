/**
 * Unit tests for SessionService with dependency injection
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { SessionService } from "../../server/services/SessionService.js";
import { createTestContainer } from "../helpers/test-container.js";

describe("SessionService", () => {
  let container;
  let sessionService;
  let mockDb;

  beforeEach(async () => {
    container = await createTestContainer();
    mockDb = container.get('database');
    mockDb.reset();
    
    const logger = container.get('logger');
    sessionService = new SessionService(mockDb, logger);
  });

  describe("createSession", () => {
    test("creates session with valid discord user", async () => {
      const discordUserId = '123456789';
      
      const result = await sessionService.createSession(discordUserId);
      
      expect(result).toBeTruthy();
      expect(result.sessionId).toBeTruthy();
      expect(result.token).toBeTruthy();
      expect(typeof result.expiresAt).toBe('string');
      expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
      
      const sessions = mockDb.getTable('web_sessions');
      expect(sessions.length).toBe(1);
      expect(sessions[0].discord_user_id).toBe(discordUserId);
    });

    test("creates session without discord user", async () => {
      const result = await sessionService.createSession(null);
      
      expect(result).toBeTruthy();
      expect(result.sessionId).toBeTruthy();
      expect(result.token).toBeTruthy();
      
      const sessions = mockDb.getTable('web_sessions');
      expect(sessions.length).toBe(1);
      expect(sessions[0].discord_user_id).toBeNull();
    });
  });

  describe("verifyToken", () => {
    test("returns session for valid token", async () => {
      const { token } = await sessionService.createSession('999888777');
      
      const session = await sessionService.verifyToken(token);
      
      expect(session).toBeTruthy();
      expect(session.token).toBe(token);
      expect(session.discord_user_id).toBe('999888777');
    });

    test("returns null for invalid token", async () => {
      const session = await sessionService.verifyToken('invalid-token');
      
      expect(session).toBeNull();
    });

    test("returns null for expired token", async () => {
      const { token } = await sessionService.createSession('123');
      
      // Manually expire the session
      const sessions = mockDb.getTable('web_sessions');
      sessions[0].expires_at = Math.floor(Date.now() / 1000) - 1000;
      
      const session = await sessionService.verifyToken(token);
      
      expect(session).toBeNull();
    });
  });

  describe("updateDiscordUser", () => {
    test("updates discord user info for session", async () => {
      const { token } = await sessionService.createSession(null);
      
      const updated = await sessionService.updateDiscordUser(token, '111222333');
      
      expect(updated).toBe(true);
      
      const session = await sessionService.verifyToken(token);
      expect(session.discord_user_id).toBe('111222333');
    });
  });
});
