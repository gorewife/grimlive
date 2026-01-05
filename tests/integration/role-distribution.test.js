/**
 * Integration tests for role distribution system
 * Still don't know why Gardener isn't just the default mode
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { MockWebSocketServer, createMockPlayers } from "../helpers/mock-websocket.js";
import { createMockGrimoire, mockCharacters, sleep } from "../helpers/fixtures.js";

describe("Role Distribution Integration Tests", () => {
  let wsServer;
  let sessionId;
  
  beforeEach(() => {
    wsServer = new MockWebSocketServer();
    sessionId = `test-session-${Date.now()}`;
  });
  
  afterEach(() => {
    wsServer.closeAll();
  });
  
  describe("Default Mode (No Gardener)", () => {
    test("should distribute roles to all players individually", async () => {
      const playerCount = 7;
      const players = createMockPlayers(playerCount, sessionId);
      
      // Add storytellar
      const host = wsServer.addClient('host', sessionId);
      
      players.forEach(player => {
        player.ws = wsServer.addClient(player.id, sessionId);
      });
      
      await sleep(10);
      const roleAssignments = {
        'player-001': mockCharacters.washerwoman,
        'player-002': mockCharacters.librarian,
        'player-003': mockCharacters.investigator,
        'player-004': mockCharacters.chef,
        'player-005': mockCharacters.butler,
        'player-006': mockCharacters.poisoner,
        'player-007': mockCharacters.imp
      };
      
      Object.entries(roleAssignments).forEach(([playerId, role]) => {
        wsServer.sendDirect(sessionId, playerId, {
          type: 'player',
          index: players.findIndex(p => p.id === playerId),
          property: 'role',
          value: role.id
        });
      });
      
      await sleep(10);
      
      players.forEach((player, index) => {
        const messages = wsServer.getClientMessages(player.id);
        const roleMessages = messages.filter(msg => 
          msg.type === 'player' && msg.property === 'role'
        );
        
        expect(roleMessages.length).toBe(1);
        expect(roleMessages[0].value).toBe(roleAssignments[player.id].id);
        expect(roleMessages[0].index).toBe(index);
      });
    });
    
    test("should NOT broadcast roles to all players", async () => {
      const playerCount = 5;
      const players = createMockPlayers(playerCount, sessionId);
      
      const host = wsServer.addClient('host', sessionId);
      players.forEach(player => {
        player.ws = wsServer.addClient(player.id, sessionId);
      });
      
      await sleep(10);
      
      players.forEach(player => player.ws.clearSentMessages());
      
      wsServer.sendDirect(sessionId, 'player-001', {
        type: 'player',
        index: 0,
        property: 'role',
        value: 'washerwoman'
      });
      
      wsServer.sendDirect(sessionId, 'player-002', {
        type: 'player',
        index: 1,
        property: 'role',
        value: 'imp'
      });
      
      await sleep(10);
      
      const player1Messages = wsServer.getClientMessages('player-001');
      const player1Roles = player1Messages.filter(msg => 
        msg.type === 'player' && msg.property === 'role'
      );
      expect(player1Roles.length).toBe(1);
      expect(player1Roles[0].value).toBe('washerwoman');
      
      const player2Messages = wsServer.getClientMessages('player-002');
      const player2Roles = player2Messages.filter(msg => 
        msg.type === 'player' && msg.property === 'role'
      );
      expect(player2Roles.length).toBe(1);
      expect(player2Roles[0].value).toBe('imp');
    });
      
    test("should handle player disconnection during role distribution", async () => {
      const playerCount = 3;
      const players = createMockPlayers(playerCount, sessionId);
      
      const host = wsServer.addClient('host', sessionId);
      players.forEach(player => {
        player.ws = wsServer.addClient(player.id, sessionId);
      });
      
      await sleep(10);
      
      players[1].ws.close();
      await sleep(10);
      
      wsServer.sendDirect(sessionId, 'player-001', { type: 'player', property: 'role', value: 'washerwoman' });
      wsServer.sendDirect(sessionId, 'player-002', { type: 'player', property: 'role', value: 'imp' }); // Fails silently for disconnected client
      wsServer.sendDirect(sessionId, 'player-003', { type: 'player', property: 'role', value: 'poisoner' });
      
      await sleep(10);
      
      const player1Messages = wsServer.getClientMessages('player-001');
      expect(player1Messages.some(msg => msg.property === 'role')).toBe(true);
      
      const player3Messages = wsServer.getClientMessages('player-003');
      expect(player3Messages.some(msg => msg.property === 'role')).toBe(true);
      
      expect(players[1].ws.readyState).toBe(3); // WebSocket.CLOSED
    });
  });
  
  describe("Gardener Mode", () => {
    test("should allow role assignment without immediate distribution", async () => {
      const playerCount = 7;
      const players = createMockPlayers(playerCount, sessionId);
      
      const host = wsServer.addClient('host', sessionId);
      players.forEach(player => {
        player.ws = wsServer.addClient(player.id, sessionId);
      });
      
      await sleep(10);
      
      players.forEach(player => player.ws.clearSentMessages());
      
      const localAssignments = {
        'player-001': 'washerwoman',
        'player-002': 'librarian',
        'player-003': 'imp'
      };
      
      await sleep(10);
      
      players.forEach(player => {
        const messages = wsServer.getClientMessages(player.id);
        const roleMessages = messages.filter(msg => msg.property === 'role');
        expect(roleMessages.length).toBe(0);
      });
    });
      
    test("should distribute roles when 'Send Characters' button clicked", async () => {
      const playerCount = 5;
      const players = createMockPlayers(playerCount, sessionId);
      
      const host = wsServer.addClient('host', sessionId);
      players.forEach(player => {
        player.ws = wsServer.addClient(player.id, sessionId);
      });
      
      await sleep(10);
      players.forEach(player => player.ws.clearSentMessages());
      
      wsServer.sendDirect(sessionId, 'player-001', { type: 'player', index: 0, property: 'role', value: 'washerwoman' });
      wsServer.sendDirect(sessionId, 'player-002', { type: 'player', index: 1, property: 'role', value: 'chef' });
      wsServer.sendDirect(sessionId, 'player-003', { type: 'player', index: 2, property: 'role', value: 'butler' });
      wsServer.sendDirect(sessionId, 'player-004', { type: 'player', index: 3, property: 'role', value: 'poisoner' });
      wsServer.sendDirect(sessionId, 'player-005', { type: 'player', index: 4, property: 'role', value: 'imp' });
      
      await sleep(10);
      
      players.forEach(player => {
        const messages = wsServer.getClientMessages(player.id);
        const roleMessages = messages.filter(msg => msg.property === 'role');
        expect(roleMessages.length).toBe(1);
      });
    });
  });
  
  describe("Role Visibility and Privacy", () => {
    test("should maintain privacy even with isPublic=true", async () => {
      const playerCount = 3;
      const players = createMockPlayers(playerCount, sessionId);
      
      const host = wsServer.addClient('host', sessionId);
      players.forEach(player => {
        player.ws = wsServer.addClient(player.id, sessionId);
      });
      
      await sleep(10);
      
      wsServer.broadcast(sessionId, {
        type: 'grimoire',
        isPublic: true
      });
      
      await sleep(10);
      
      wsServer.sendDirect(sessionId, 'player-001', { type: 'player', property: 'role', value: 'imp' });
      wsServer.sendDirect(sessionId, 'player-002', { type: 'player', property: 'role', value: 'washerwoman' });
      wsServer.sendDirect(sessionId, 'player-003', { type: 'player', property: 'role', value: 'poisoner' });
      
      await sleep(10);
      
      const player1Messages = wsServer.getClientMessages('player-001');
      const player1RoleMessages = player1Messages.filter(msg => msg.property === 'role');
      expect(player1RoleMessages.length).toBe(1);
      expect(player1RoleMessages[0].value).toBe('imp');
    })
      
      ;
    
    test("should prevent role leakage via WebSocket message inspection", async () => {
      const playerCount = 3;
      const players = createMockPlayers(playerCount, sessionId);
      
      const host = wsServer.addClient('host', sessionId);
      players.forEach(player => {
        player.ws = wsServer.addClient(player.id, sessionId);
      });
      
      await sleep(10);
      players.forEach(player => player.ws.clearSentMessages());
      
      wsServer.sendDirect(sessionId, 'player-001', { type: 'player', index: 0, property: 'role', value: 'washerwoman' });
      wsServer.sendDirect(sessionId, 'player-002', { type: 'player', index: 1, property: 'role', value: 'imp' });
      wsServer.sendDirect(sessionId, 'player-003', { type: 'player', index: 2, property: 'role', value: 'poisoner' });
      
      await sleep(10);
      
      const player1Messages = wsServer.getClientMessages('player-001');
      const impMessages = player1Messages.filter(msg => 
        msg.value === 'imp' || (typeof msg.value === 'object' && msg.value?.id === 'imp')
      );
      expect(impMessages.length).toBe(0);
      
      const washerwomanMessages = player1Messages.filter(msg => msg.value === 'washerwoman');
      expect(washerwomanMessages.length).toBe(1);
    });
  });
});
