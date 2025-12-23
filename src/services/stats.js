// Stats tracking API client
class StatsService {
  constructor() {
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://clocktower.live:8001/api'
      : 'http://localhost:8001/api';
    this.token = localStorage.getItem('statsToken');
    this.sessionId = localStorage.getItem('statsSessionId');
    this.discordUserId = localStorage.getItem('discordUserId');
    this.currentGameId = null;
    this.enabled = localStorage.getItem('statTrackingEnabled') === 'true';
  }

  isEnabled() {
    return this.enabled;
  }

  isDiscordLinked() {
    return !!this.discordUserId;
  }

  setDiscordUserId(userId) {
    this.discordUserId = userId;
    localStorage.setItem('discordUserId', userId);
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
        headers: { 'Content-Type': 'application/json' }
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

  async startGame(script, customName, players, categoryId) {
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
          categoryId  // Pass category_id to look up guild_id
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
