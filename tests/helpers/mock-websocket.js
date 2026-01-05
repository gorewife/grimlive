/**
 * Mock WebSocket implementation for testing
 * Simulates WebSocket connections without actual network calls
 */

export class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.messageQueue = [];
    this.sentMessages = [];
    this.receivedMessages = [];
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) this.onopen({ type: 'open' });
    }, 10);
  }
  
  send(data) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    this.sentMessages.push(message);
    
    if (this.onsend) {
      this.onsend({ data: message });
    }
  }
  
  close(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) {
        this.onclose({ code, reason, type: 'close' });
      }
    }, 10);
  }
  
  // Simulate receiving a message from server
  simulateMessage(data) {
    if (this.readyState === MockWebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      this.receivedMessages.push(message);
      
      if (this.onmessage) {
        this.onmessage({ data: message, type: 'message' });
      }
    }
  }
  
  // Get all sent messages
  getSentMessages() {
    return this.sentMessages.map(msg => {
      try {
        return JSON.parse(msg);
      } catch {
        return msg;
      }
    });
  }
  
  // Get all received messages
  getReceivedMessages() {
    return this.receivedMessages.map(msg => {
      try {
        return JSON.parse(msg);
      } catch {
        return msg;
      }
    });
  }
  
  // Clear sent messages history
  clearSentMessages() {
    this.sentMessages = [];
  }
}

// WebSocket constants
MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSING = 2;
MockWebSocket.CLOSED = 3;

/**
 * Mock WebSocket Server for integration tests
 * Manages multiple client connections
 */
export class MockWebSocketServer {
  constructor() {
    this.clients = new Map();
    this.channels = {};
    this.messageHandlers = [];
  }
  
  // Simulate a client connecting
  addClient(clientId, sessionId) {
    const client = new MockWebSocket(`ws://localhost:8001?session=${sessionId}`);
    client.channel = sessionId;
    client.playerId = clientId;
    client.isHost = clientId === 'host';
    
    this.clients.set(clientId, client);
    
    if (!this.channels[sessionId]) {
      this.channels[sessionId] = [];
    }
    this.channels[sessionId].push(client);
    
    return client;
  }
  
  // Simulate server broadcasting to channel
  broadcast(sessionId, message) {
    const clients = this.channels[sessionId] || [];
    clients.forEach(client => {
      client.simulateMessage(message);
    });
  }
  
  // Simulate server sending direct message to specific player
  sendDirect(sessionId, playerId, message) {
    const client = this.clients.get(playerId);
    if (client && client.channel === sessionId) {
      client.simulateMessage(message);
    }
  }
  
  // Get all messages received by a client
  getClientMessages(clientId) {
    const client = this.clients.get(clientId);
    return client ? client.getReceivedMessages() : [];
  }
  
  onMessage(handler) {
    this.messageHandlers.push(handler);
  }
  
  async processClientMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    for (const handler of this.messageHandlers) {
      await handler(client, message);
    }
  }
  
  closeAll() {
    this.clients.forEach(client => client.close());
    this.clients.clear();
    this.channels = {};
  }
}

// create mock player connections
export function createMockPlayers(count, sessionId) {
  const players = [];
  for (let i = 0; i < count; i++) {
    players.push({
      id: `player-${String(i + 1).padStart(3, '0')}`,
      name: `Player ${i + 1}`,
      pronouns: ['she/her', 'he/him', 'they/them'][i % 3],
      sessionId,
      ws: null
    });
  }
  return players;
}
