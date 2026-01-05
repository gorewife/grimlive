/**
 * Stats Service - Thin wrapper around Vuex stats module
 * Maintains backward compatibility while delegating state management to Vuex
 *
 * DEPRECATED: Direct usage of this service is discouraged.
 * New code should use Vuex store directly: this.$store.state.stats or useStore()
 */

import store from "../store";
import { logger } from "../utils/logger";
import { fetchWithTimeout } from "../utils/fetch";

class StatsService {
  constructor() {
    this.store = store;
  }

  get baseUrl() {
    return this.store.state.stats.baseUrl;
  }

  get token() {
    return this.store.state.stats.statsToken;
  }

  get sessionId() {
    return this.store.state.stats.statsSessionId;
  }

  get discordUserId() {
    return this.store.state.stats.discordUserId;
  }

  get discordUsername() {
    return this.store.state.stats.discordUsername;
  }

  get selectedSessionCode() {
    return this.store.state.stats.sessionCode;
  }

  get currentGameId() {
    return this.store.state.stats.currentGameId;
  }

  get enabled() {
    return this.store.state.stats.trackingEnabled;
  }

  isEnabled() {
    return this.store.getters["stats/isTrackingEnabled"];
  }

  isDiscordLinked() {
    return this.store.getters["stats/isDiscordLinked"];
  }

  getDiscordUsername() {
    return this.store.state.stats.discordUsername;
  }

  async setDiscordUser(userId, username) {
    await this.store.dispatch("stats/setDiscordUser", { userId, username });
  }

  setDiscordUserId(userId) {
    this.store.commit("stats/setDiscordUserId", userId);
  }

  logout() {
    this.store.dispatch("stats/logout");
  }

  getSelectedSessionCode() {
    return this.store.state.stats.sessionCode;
  }

  setSelectedSessionCode(code) {
    this.store.commit("stats/setSessionCode", code);
  }

  async enable() {
    await this.store.dispatch("stats/enableTracking");
  }

  disable() {
    this.store.dispatch("stats/disableTracking");
  }

  async createSession() {
    return await this.store.dispatch("stats/createStatsSession");
  }

  async startGame(script, customName, players, sessionCode) {
    try {
      const result = await this.store.dispatch("stats/startGame", {
        script,
        customName,
        players,
        sessionCode,
      });
      return result.game_id;
    } catch (error) {
      logger.error("Failed to start game:", error);
      alert(error.message || "Failed to start game tracking");
      return null;
    }
  }

  async endGame(winningTeam) {
    try {
      await this.store.dispatch("stats/endGame", { winner: winningTeam });
    } catch (error) {
      logger.error("Failed to end game:", error);
      throw error;
    }
  }

  async addPlayer(
    playerName,
    seatNumber,
    roleId,
    roleName,
    team,
    isFinal = false,
    discordId = null,
  ) {
    if (!this.isEnabled() || !this.token || !this.currentGameId) return;

    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/player/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          gameId: this.currentGameId,
          playerName,
          seatNumber,
          roleId,
          roleName,
          team,
          isFinal,
          discordId,
        }),
      });

      const data = await response.json();
      logger.debug(
        "Player added:",
        playerName,
        roleId,
        isFinal ? "(final)" : "(starting)",
      );
      return data.playerId;
    } catch (error) {
      logger.error("Failed to add player:", error);
    }
  }

  async updatePlayerRole(playerName, role, finalRole) {
    await this.store.dispatch("stats/updatePlayerRole", {
      playerName,
      role,
      finalRole,
    });
  }

  async getGameStats(gameId) {
    if (!this.isEnabled()) return;

    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/stats/game/${gameId || this.currentGameId}`,
      );
      const data = await response.json();
      return data;
    } catch (error) {
      logger.error("Failed to get game stats:", error);
    }
  }
}

export default new StatsService();
