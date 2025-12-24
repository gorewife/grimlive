// Stats tracking API client
class StatsService {
  constructor() {
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://clocktower.live:8001/api'
      : 'http://localhost:8001/api';
    this.token = localStorage.getItem('statsToken');
    this.sessionId = localStorage.getItem('statsSessionId');
    this.discordUserId = localStorage.getItem('discordUserId');
    this.discordUsername = localStorage.getItem('discordUsername');
    this.selectedSessionCode = localStorage.getItem('selectedSessionCode');
    this.currentGameId = null;
    this.enabled = localStorage.getItem('statTrackingEnabled') === 'true';
    this.availableSessions = [];
  }

  isEnabled() {
    return this.enabled;
  }

  isDiscordLinked() {
    return !!this.discordUserId;
  }

  getDiscordUsername() {
    return this.discordUsername;
  }

  async setDiscordUser(userId, username) {
    this.discordUserId = userId;
    this.discordUsername = username;
    localStorage.setItem('discordUserId', userId);
    localStorage.setItem('discordUsername', username);
    
    // Update existing session with Discord user ID if we have one
    if (this.token && this.sessionId) {
      await this.updateSessionDiscordUser(userId);
    }
  }

  async updateSessionDiscordUser(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/session/update-discord`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ discord_user_id: userId })
      });
      
      if (response.ok) {
        console.log('Updated session with Discord user ID');
      }
    } catch (error) {
      console.error('Failed to update session with Discord ID:', error);
    }
  }

  setDiscordUserId(userId) {
    this.discordUserId = userId;
    localStorage.setItem('discordUserId', userId);
  }

  logout() {
    this.discordUserId = null;
    this.discordUsername = null;
    this.enabled = false;
    this.token = null;
    this.sessionId = null;
    this.selectedSessionCode = null;
    this.currentGameId = null;
    this.availableSessions = [];
    localStorage.removeItem('discordUserId');
    localStorage.removeItem('discordUsername');
    localStorage.removeItem('statTrackingEnabled');
    localStorage.removeItem('statsToken');
    localStorage.removeItem('statsSessionId');
    localStorage.removeItem('selectedSessionCode');
  }

  getSelectedSessionCode() {
    return this.selectedSessionCode;
  }

  setSelectedSessionCode(code) {
    this.selectedSessionCode = code;
    localStorage.setItem('selectedSessionCode', code);
  }

  async fetchSessions() {
    console.log('stats.fetchSessions: token exists?', !!this.token);
    if (!this.token) {
      console.log('No token, creating session first...');
      await this.createSession();
    }

    try {
      const url = `${this.baseUrl}/sessions`;
      console.log('Fetching sessions from:', url);
      console.log('Using token:', this.token?.substring(0, 8) + '...');
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        }
      });

      console.log('Sessions response status:', response.status);
      const data = await response.json();
      console.log('Sessions response data:', data);
      
      if (data.sessions) {
        this.availableSessions = data.sessions;
        console.log('Stored', data.sessions.length, 'sessions');
        return data.sessions;
      }
      console.log('No sessions in response');
      return [];
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      return [];
    }
  }

  getAvailableSessions() {
    return this.availableSessions;
  }

  async enable() {
    this.enabled = true;
    localStorage.setItem('statTrackingEnabled', 'true');
    
    // Create session if we don't have one
    if (!this.token) {
      await this.createSession();
    }
  }

  disable() {
    this.enabled = false;
    localStorage.setItem('statTrackingEnabled', 'false');
  }

  async createSession() {
    try {
      const response = await fetch(`${this.baseUrl}/session/create`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          discord_user_id: this.discordUserId
        })
      });
      
      const data = await response.json();
      
      if (data.token) {
        this.token = data.token;
        this.sessionId = data.sessionId;
        localStorage.setItem('statsToken', this.token);
        localStorage.setItem('statsSessionId', this.sessionId);
        console.log('Stats session created:', this.sessionId);
        return data;
      }
    } catch (error) {
      console.error('Failed to create stats session:', error);
    }
  }

  async startGame(script, customName, players, sessionCode) {
    if (!this.enabled || !this.token) return;

    try {
      const response = await fetch(`${this.baseUrl}/game/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          script,
          customName,
          players: players.map(p => p.id || p.name),
          storytellerId: this.discordUserId,
          sessionCode: sessionCode || this.selectedSessionCode  // Use session code instead of categoryId
        })
      });

      const data = await response.json();
      
      if (data.error) {
        alert(data.error);
        return null;
      }
      
      if (data.gameId) {
        this.currentGameId = data.gameId;
        console.log('Game started:', this.currentGameId);
        return data.gameId;
      }
    } catch (error) {
      console.error('Failed to start game tracking:', error);
      alert('Failed to start game tracking');
    }
  }

  async endGame(winningTeam) {
    if (!this.enabled || !this.token || !this.currentGameId) return;

    try {
      const response = await fetch(`${this.baseUrl}/game/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          gameId: this.currentGameId,
          winningTeam // 'Good' or 'Evil'
        })
      });

      const data = await response.json();
      console.log('Game ended:', this.currentGameId, winningTeam);
      this.currentGameId = null;
      return data;
    } catch (error) {
      console.error('Failed to end game tracking:', error);
    }
  }

  async addPlayer(playerName, seatNumber, roleId, roleName, team) {
    if (!this.enabled || !this.token || !this.currentGameId) return;

    try {
      const response = await fetch(`${this.baseUrl}/player/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          gameId: this.currentGameId,
          playerName,
          seatNumber,
          roleId,
          roleName,
          team
        })
      });

      const data = await response.json();
      console.log('Player added:', playerName, roleId);
      return data.playerId;
    } catch (error) {
      console.error('Failed to add player:', error);
    }
  }

  async getGameStats(gameId) {
    if (!this.enabled) return;

    try {
      const response = await fetch(`${this.baseUrl}/stats/game/${gameId || this.currentGameId}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to get game stats:', error);
    }
  }
}

// Export singleton instance
export default new StatsService();
