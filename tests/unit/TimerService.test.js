import { describe, test, expect, beforeEach } from "bun:test";
import { TimerService } from '../../server/services/TimerService.js';
import { SessionService } from '../../server/services/SessionService.js';
import { createTestContainer } from '../helpers/test-container.js';

describe("TimerService", () => {
  let container;
  let timerService;
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
    timerService = new TimerService(mockDb, sessionService, logger);
  });

  describe("startTimer", () => {
    test("creates timer with valid data", async () => {
      const timerData = {
        sessionCode: 's1',
        duration: 300,
        startedBy: 'TestUser'
      };

      const result = await timerService.startTimer(timerData);

      expect(result).toBeDefined();
      expect(result).toBe('123456789');
      
      const timers = mockDb.getTable('timers');
      expect(timers.length).toBe(1);
      expect(timers[0].guild_id).toBe('123456789');
      expect(timers[0].end_time).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    test("rejects timer without sessionCode", async () => {
      const timerData = {
        duration: 300
      };

      await expect(timerService.startTimer(timerData)).rejects.toThrow();
    });

    test("rejects timer with invalid duration", async () => {
      const timerData = {
        sessionCode: 's1',
        duration: -100
      };

      await expect(timerService.startTimer(timerData)).rejects.toThrow();
    });

    test("rejects timer with past endTime", async () => {
      const timerData = {
        guildId: '123456789',
        categoryId: '111111111',
        duration: 300,
        endTime: Math.floor(Date.now() / 1000) - 100
      };

      await expect(timerService.startTimer(timerData)).rejects.toThrow();
    });
  });

  describe("pauseTimer", () => {
    test("throws error - not supported in production schema", async () => {
      const guildId = '123456789';
      
      await expect(timerService.pauseTimer(guildId)).rejects.toThrow('Pause timer not supported');
    });
  });

  describe("stopTimer", () => {
    test("stops active timer by guild_id", async () => {
      await timerService.startTimer({
        sessionCode: 's1',
        duration: 300,
        startedBy: 'TestUser'
      });

      await timerService.stopTimer('123456789');

      const timers = mockDb.getTable('timers');
      expect(timers.length).toBe(0);
    });

    test("throws error when timer not found", async () => {
      await expect(timerService.stopTimer('999')).rejects.toThrow('Timer not found');
    });
  });

  describe("getActiveTimer", () => {
    test("returns active timer for session", async () => {
      await timerService.startTimer({
        sessionCode: 's1',
        duration: 300,
        startedBy: 'TestUser'
      });

      const timer = await timerService.getActiveTimer('s1');

      expect(timer).not.toBeNull();
      expect(timer.guild_id).toBe('123456789');
      expect(timer.end_time).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    test("returns null when no active timer", async () => {
      const timer = await timerService.getActiveTimer('nonexistent');

      expect(timer).toBeNull();
    });
  });

  describe("cleanupExpiredTimers", () => {
    test("removes expired timers", async () => {
      const pastTime = Math.floor(Date.now() / 1000) - 100;
      
      // Add expired timer directly to mock
      mockDb.data.timers.push({
        guild_id: '999',
        end_time: pastTime,
        creator_id: null,
        category_id: null
      });

      const count = await timerService.cleanupExpiredTimers();

      expect(count).toBe(1);
      const timers = mockDb.getTable('timers');
      expect(timers.length).toBe(0);
    });

    test("keeps active timers", async () => {
      await timerService.startTimer({
        sessionCode: 's1',
        duration: 300
      });

      const count = await timerService.cleanupExpiredTimers();

      expect(count).toBe(0);
      const timers = mockDb.getTable('timers');
      expect(timers.length).toBe(1);
    });
  });
});
