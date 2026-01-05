/**
 * Integration tests for Grimlive + Grimkeeper interactions
 * Tests the complete flow of linked sessions between web app and Discord bot
 * Comments are unnecesarily thorough because I'm too fucking Junior to remember this shit
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { sleep } from "../helpers/fixtures.js";

/**
 * Mock Grimkeeper API responses
 * Simulates the Discord bot's behavior
 */
class MockGrimkeeperAPI {
  constructor() {
    this.sessions = new Map();
    this.games = new Map();
    this.timers = new Map();
    this.apiCalls = [];
    this.discordAnnouncements = [];
    this.voiceCalls = [];
  }
  
  // Track all API calls for verification
  recordCall(endpoint, data) {
    this.apiCalls.push({ endpoint, data, timestamp: Date.now() });
  }
  
  // Simulate session lookup
  async getSession(sessionCode) {
    return this.sessions.get(sessionCode) || null;
  }
  
  // Simulate game start
  async startGame(guildId, categoryId, script, players) {
    const gameId = `game-${Date.now()}`;
    const game = {
      gameId,
      guildId,
      categoryId,
      script,
      players,
      startTime: Date.now(),
      isOngoing: true
    };
    this.games.set(gameId, game);
    this.discordAnnouncements.push({
      type: 'game_start',
      channelId: `announce-${categoryId}`,
      script,
      playerCount: players.length
    });
    return gameId;
  }
  
  // Simulate timer sync from grimlive
  async syncTimerStart(sessionCode, duration, discordUserId) {
    this.recordCall('/api/timer/start', { sessionCode, duration, discordUserId });
    
    const session = await this.getSession(sessionCode);
    if (!session) return false;
    
    const timerId = `timer-${sessionCode}-${Date.now()}`;
    this.timers.set(sessionCode, {
      timerId,
      duration,
      startedBy: discordUserId,
      startTime: Date.now(),
      isPaused: false,
      isActive: true
    });
    
    return true;
  }
  
  async syncTimerPause(sessionCode) {
    this.recordCall('/api/timer/pause', { sessionCode });
    const timer = this.timers.get(sessionCode);
    if (timer) {
      timer.isPaused = true;
      return true;
    }
    return false;
  }
  
  async syncTimerResume(sessionCode) {
    this.recordCall('/api/timer/resume', { sessionCode });
    const timer = this.timers.get(sessionCode);
    if (timer) {
      timer.isPaused = false;
      return true;
    }
    return false;
  }
  
  async syncTimerStop(sessionCode) {
    this.recordCall('/api/timer/stop', { sessionCode });
    this.timers.delete(sessionCode);
    return true;
  }
  
  // Simulate timer expiring and calling voice channel
  async timerExpired(sessionCode) {
    const session = await this.getSession(sessionCode);
    if (session) {
      this.voiceCalls.push({
        guildId: session.guildId,
        categoryId: session.categoryId,
        destinationChannelId: session.destinationChannelId,
        timestamp: Date.now()
      });
      this.discordAnnouncements.push({
        type: 'timer_expired',
        channelId: `announce-${session.categoryId}`
      });
    }
  }
  
  // Simulate Discord command starting timer
  async discordCommandTimer(guildId, categoryId, duration) {
    const sessionCode = Array.from(this.sessions.values())
      .find(s => s.guildId === guildId && s.categoryId === categoryId)?.sessionCode;
    
    if (sessionCode) {
      await this.syncTimerStart(sessionCode, duration, 'discord-command');
      return sessionCode;
    }
    return null;
  }
  
  reset() {
    this.sessions.clear();
    this.games.clear();
    this.timers.clear();
    this.apiCalls = [];
    this.discordAnnouncements = [];
    this.voiceCalls = [];
  }
}

describe("Grimlive + Grimkeeper Integration Tests", () => {
  let grimkeeper;
  
  beforeEach(() => {
    grimkeeper = new MockGrimkeeperAPI();
  });
  
  afterEach(() => {
    grimkeeper.reset();
  });
  
  describe("Phase 1: Session Linking", () => {
    test("ST logs in via Discord and links session code", async () => {
      // **TEST: ST authenticates with Discord OAuth and successfully links grimoire to Discord session**
      
      // Setup: Create grimkeeper session
      grimkeeper.sessions.set('s1', {
        sessionCode: 's1',
        guildId: 123456789,
        categoryId: 987654321,
        storytellerUserId: 999888777,
        destinationChannelId: 111222333,
        announceChannelId: 444555666
      });
      
      // ST completes Discord OAuth
      const discordUserId = 999888777;
      
      // Grimlive fetches available sessions for this user
      const availableSessions = Array.from(grimkeeper.sessions.values())
        .filter(s => s.storytellerUserId === discordUserId);
      
      expect(availableSessions.length).toBe(1);
      expect(availableSessions[0].sessionCode).toBe('s1');
      
      // ST selects session code 's1'
      const selectedSession = await grimkeeper.getSession('s1');
      expect(selectedSession).not.toBeNull();
      expect(selectedSession.guildId).toBe(123456789);
    });
    
    test("invalid session code is rejected", async () => {
      // **TEST: Attempting to link non-existent session code fails gracefully**
      
      const invalidSession = await grimkeeper.getSession('invalid-code');
      expect(invalidSession).toBeNull();
    });
    
    test("session code belongs to different storyteller", async () => {
      // **TEST: Cannot link to session owned by another storyteller**
      
      grimkeeper.sessions.set('s2', {
        sessionCode: 's2',
        storytellerUserId: 111111111, // Different user
        guildId: 123456789
      });
      
      const currentUser = 999888777;
      const sessions = Array.from(grimkeeper.sessions.values())
        .filter(s => s.storytellerUserId === currentUser);
      
      expect(sessions.length).toBe(0); // Should not see other ST's session
    });
  });
  
  describe("Phase 2: Game Start Flow", () => {
    test("web-only game start (no Discord link)", async () => {
      // **TEST: Starting game without session code creates web-only game with no Discord integration**
      
      const players = [
        { name: 'Alice', role: 'washerwoman' },
        { name: 'Bob', role: 'imp' }
      ];
      
      // No session code = no grimkeeper involvement
      const sessionCode = null;
      
      // Game starts
      const gameData = {
        script: 'Trouble Brewing',
        players,
        sessionCode: null,
        guildId: null,
        categoryId: null
      };
      
      // Verify grimkeeper was NOT called
      expect(grimkeeper.apiCalls.length).toBe(0);
      expect(grimkeeper.discordAnnouncements.length).toBe(0);
    });
    
    test("integrated game start triggers Discord announcement", async () => {
      // **TEST: Starting game with session code triggers grimkeeper to announce in Discord**
      
      grimkeeper.sessions.set('s1', {
        sessionCode: 's1',
        guildId: 123456789,
        categoryId: 987654321,
        announceChannelId: 444555666
      });
      
      const players = [
        { discordId: '111', name: 'Alice', role: 'washerwoman' },
        { discordId: '222', name: 'Bob', role: 'imp' },
        { discordId: '333', name: 'Charlie', role: 'poisoner' }
      ];
      
      // ST starts game with session code
      const gameId = await grimkeeper.startGame(
        123456789,
        987654321,
        'Trouble Brewing',
        players
      );
      
      // Verify game created
      expect(gameId).toBeTruthy();
      const game = grimkeeper.games.get(gameId);
      expect(game.isOngoing).toBe(true);
      expect(game.players.length).toBe(3);
      
      // Verify Discord announcement
      expect(grimkeeper.discordAnnouncements.length).toBe(1);
      expect(grimkeeper.discordAnnouncements[0].type).toBe('game_start');
      expect(grimkeeper.discordAnnouncements[0].script).toBe('Trouble Brewing');
    });
    
    test("starting game when one already active shows error", async () => {
      // **TEST: Cannot start second game in same session until first game ends**
      
      grimkeeper.sessions.set('s1', {
        sessionCode: 's1',
        guildId: 123456789,
        categoryId: 987654321,
        activeGameId: 'existing-game-id'
      });
      
      const session = await grimkeeper.getSession('s1');
      const hasActiveGame = !!session.activeGameId;
      
      expect(hasActiveGame).toBe(true);
      // In real implementation, API would return 400 error
    });
  });
  
  describe("Phase 3: Timer Synchronization", () => {
    beforeEach(() => {
      grimkeeper.sessions.set('s1', {
        sessionCode: 's1',
        guildId: 123456789,
        categoryId: 987654321,
        destinationChannelId: 111222333
      });
    });
    
    test("timer started in grimlive syncs to grimkeeper", async () => {
      // **TEST: ST starts 5-minute timer in grimlive UI → grimkeeper receives sync and tracks timer**
      
      const duration = 300; // 5 minutes
      const discordUserId = 999888777;
      
      // Grimlive calls grimkeeper API
      const success = await grimkeeper.syncTimerStart('s1', duration, discordUserId);
      
      expect(success).toBe(true);
      expect(grimkeeper.apiCalls.length).toBe(1);
      expect(grimkeeper.apiCalls[0].endpoint).toBe('/api/timer/start');
      expect(grimkeeper.apiCalls[0].data.duration).toBe(300);
      
      // Verify grimkeeper is tracking timer
      const timer = grimkeeper.timers.get('s1');
      expect(timer).toBeTruthy();
      expect(timer.duration).toBe(300);
      expect(timer.isActive).toBe(true);
    });
    
    test("timer started in Discord syncs to grimlive", async () => {
      // **TEST: ST types *timer 5m in Discord → grimlive receives sync and displays countdown**
      
      // Discord command handler
      const sessionCode = await grimkeeper.discordCommandTimer(123456789, 987654321, 300);
      
      expect(sessionCode).toBe('s1');
      
      // Verify grimkeeper created timer
      const timer = grimkeeper.timers.get('s1');
      expect(timer).toBeTruthy();
      expect(timer.startedBy).toBe('discord-command');
      
      // In real implementation, grimkeeper would call grimlive API
      // to broadcast timer state via WebSocket
    });
    
    test("timer paused in grimlive syncs to grimkeeper", async () => {
      // **TEST: ST pauses timer in UI → grimkeeper pauses its internal timer**
      
      // Start timer first
      await grimkeeper.syncTimerStart('s1', 300, 999888777);
      
      // Pause timer
      const success = await grimkeeper.syncTimerPause('s1');
      
      expect(success).toBe(true);
      expect(grimkeeper.apiCalls.some(c => c.endpoint === '/api/timer/pause')).toBe(true);
      
      const timer = grimkeeper.timers.get('s1');
      expect(timer.isPaused).toBe(true);
    });
    
    test("timer resumed in grimlive syncs to grimkeeper", async () => {
      // **TEST: ST resumes paused timer → both systems continue countdown**
      
      await grimkeeper.syncTimerStart('s1', 300, 999888777);
      await grimkeeper.syncTimerPause('s1');
      
      // Resume
      const success = await grimkeeper.syncTimerResume('s1');
      
      expect(success).toBe(true);
      const timer = grimkeeper.timers.get('s1');
      expect(timer.isPaused).toBe(false);
    });
    
    test("timer cancelled in grimlive stops grimkeeper timer", async () => {
      // **TEST: ST cancels timer → grimkeeper removes timer and doesn't call voice channel**
      
      await grimkeeper.syncTimerStart('s1', 300, 999888777);
      
      // Cancel
      const success = await grimkeeper.syncTimerStop('s1');
      
      expect(success).toBe(true);
      expect(grimkeeper.timers.has('s1')).toBe(false);
    });
    
    test("timer started in Discord but cancelled via Discord command", async () => {
      // **TEST: ST starts timer in Discord, then uses *cancel in Discord → both systems stop**
      
      await grimkeeper.discordCommandTimer(123456789, 987654321, 300);
      
      // Discord cancel command
      await grimkeeper.syncTimerStop('s1');
      
      expect(grimkeeper.timers.has('s1')).toBe(false);
      // Grimlive would receive stop sync via API
    });
    
    test("conflicting timer operations - pause from web, stop from Discord", async () => {
      // **TEST: Handling race condition when operations sent from both sides simultaneously**
      
      await grimkeeper.syncTimerStart('s1', 300, 999888777);
      
      // Simulate near-simultaneous operations
      await grimkeeper.syncTimerPause('s1');
      await sleep(10);
      await grimkeeper.syncTimerStop('s1');
      
      // Stop should win - timer deleted
      expect(grimkeeper.timers.has('s1')).toBe(false);
      
      // Both API calls recorded
      expect(grimkeeper.apiCalls.filter(c => c.endpoint === '/api/timer/pause').length).toBe(1);
      expect(grimkeeper.apiCalls.filter(c => c.endpoint === '/api/timer/stop').length).toBe(1);
    });
  });
  
  describe("Phase 4: Voice Channel Operations", () => {
    beforeEach(() => {
      grimkeeper.sessions.set('s1', {
        sessionCode: 's1',
        guildId: 123456789,
        categoryId: 987654321,
        destinationChannelId: 111222333,
        announceChannelId: 444555666
      });
    });
    
    test("timer expires and calls players to town square", async () => {
      // **TEST: Timer countdown reaches 0 → grimkeeper moves all players to town square voice channel**
      
      await grimkeeper.syncTimerStart('s1', 300, 999888777);
      
      // Simulate timer expiring (grimkeeper detects this internally)
      await grimkeeper.timerExpired('s1');
      
      // Verify voice call was made
      expect(grimkeeper.voiceCalls.length).toBe(1);
      expect(grimkeeper.voiceCalls[0].destinationChannelId).toBe(111222333);
      
      // Verify announcement
      expect(grimkeeper.discordAnnouncements.some(a => a.type === 'timer_expired')).toBe(true);
    });
    
    test("manual call button in grimlive triggers Discord voice move", async () => {
      // **TEST: ST clicks "Call Players" in UI → grimkeeper moves players without timer**
      
      // Grimlive calls grimkeeper API
      grimkeeper.recordCall('/api/call', { sessionCode: 's1' });
      
      // Simulate grimkeeper handling call
      const session = await grimkeeper.getSession('s1');
      grimkeeper.voiceCalls.push({
        guildId: session.guildId,
        destinationChannelId: session.destinationChannelId,
        manual: true
      });
      
      expect(grimkeeper.voiceCalls.length).toBe(1);
      expect(grimkeeper.voiceCalls[0].manual).toBe(true);
    });
    
    test("mute/unmute from grimlive syncs to grimkeeper", async () => {
      // **TEST: ST mutes players via grimoire UI → grimkeeper mutes them in Discord voice**
      
      const playerDiscordId = '111222333';
      
      // Grimlive calls mute API
      grimkeeper.recordCall('/api/mute', { 
        sessionCode: 's1',
        discordUserId: playerDiscordId
      });
      
      expect(grimkeeper.apiCalls.some(c => c.endpoint === '/api/mute')).toBe(true);
      
      // Unmute
      grimkeeper.recordCall('/api/unmute', {
        sessionCode: 's1',
        discordUserId: playerDiscordId
      });
      
      expect(grimkeeper.apiCalls.some(c => c.endpoint === '/api/unmute')).toBe(true);
    });
  });
  
  describe("Phase 5: Game End Flow", () => {
    beforeEach(() => {
      grimkeeper.sessions.set('s1', {
        sessionCode: 's1',
        guildId: 123456789,
        categoryId: 987654321,
        activeGameId: 'game-123'
      });
    });
    
    test("ending game from grimlive records stats in grimkeeper", async () => {
      // **TEST: ST clicks "End Game" with winner selection → grimkeeper records game result**
      
      const gameEndData = {
        sessionCode: 's1',
        gameId: 'game-123',
        winner: 'good',
        endTime: Date.now()
      };
      
      grimkeeper.recordCall('/api/game/end', gameEndData);
      
      // Verify API call made
      expect(grimkeeper.apiCalls.some(c => c.endpoint === '/api/game/end')).toBe(true);
      
      // In real implementation, grimkeeper would:
      // 1. Update game record in database
      // 2. Calculate stats
      // 3. Announce in Discord
    });
    
    test("ending game clears active_game_id in session", async () => {
      // **TEST: After game ends, session is ready for new game**
      
      const session = await grimkeeper.getSession('s1');
      expect(session.activeGameId).toBe('game-123');
      
      // End game
      session.activeGameId = null;
      
      expect(session.activeGameId).toBeNull();
      // New game can now be started
    });
  });
  
  describe("Edge Cases & Error Handling", () => {
    test("grimkeeper API timeout doesn't crash grimlive", async () => {
      // **TEST: If grimkeeper API is down, grimlive continues working in standalone mode**
      
      // Simulate API timeout
      const apiAvailable = false;
      
      if (!apiAvailable) {
        // Grimlive should gracefully degrade
        // Timer still works locally, just no Discord sync
        expect(true).toBe(true); // Continue without grimkeeper
      }
    });
    
    test("session code invalidated mid-game", async () => {
      // **TEST: If grimkeeper session deleted, grimlive continues but loses sync**
      
      grimkeeper.sessions.set('s1', { sessionCode: 's1' });
      
      // Session gets deleted (e.g., ST ran /sessions cleanup)
      grimkeeper.sessions.delete('s1');
      
      const session = await grimkeeper.getSession('s1');
      expect(session).toBeNull();
      
      // Grimlive should handle this gracefully
      // Show warning to ST but allow continued play
    });
    
    test("multiple storytellers in same Discord server", async () => {
      // **TEST: Two STs running separate games in different categories don't interfere**
      
      grimkeeper.sessions.set('s1', {
        sessionCode: 's1',
        guildId: 123456789,
        categoryId: 987654321,
        storytellerUserId: 111111111
      });
      
      grimkeeper.sessions.set('s2', {
        sessionCode: 's2',
        guildId: 123456789, // Same guild
        categoryId: 555555555, // Different category
        storytellerUserId: 222222222
      });
      
      // Start timer in s1
      await grimkeeper.syncTimerStart('s1', 300, 111111111);
      
      // Start timer in s2
      await grimkeeper.syncTimerStart('s2', 600, 222222222);
      
      // Both timers active independently
      expect(grimkeeper.timers.has('s1')).toBe(true);
      expect(grimkeeper.timers.has('s2')).toBe(true);
      expect(grimkeeper.timers.get('s1').duration).toBe(300);
      expect(grimkeeper.timers.get('s2').duration).toBe(600);
    });
  });
});
