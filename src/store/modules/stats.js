/**
 * Stats module for managing Discord integration and game statistics.
 * Replaces the external stats service with proper Vuex reactivity.
 */

import { logger } from "../../utils/logger";
import { fetchWithTimeout } from "../../utils/fetch";

const state = () => ({
  // Discord OAuth state
  discordUserId: localStorage.getItem("discordUserId") || null,
  discordUsername: localStorage.getItem("discordUsername") || null,

  // Session management
  sessionCode: localStorage.getItem("selectedSessionCode") || null,
  statsToken: localStorage.getItem("statsToken") || null,
  statsSessionId: localStorage.getItem("statsSessionId") || null,

  // Game tracking
  currentGameId: localStorage.getItem("currentGameId") || null,
  trackingEnabled: localStorage.getItem("statTrackingEnabled") === "true",

  // API configuration
  baseUrl: import.meta.env.PROD
    ? "https://api.hystericca.dev/api"
    : "http://localhost:8001/api",
});

const getters = {
  isDiscordLinked: (state) => !!state.discordUserId,
  isTrackingEnabled: (state) => state.trackingEnabled,
  hasActiveGame: (state) => !!state.currentGameId,
  hasSessionCode: (state) => !!state.sessionCode,
  isFullyConfigured: (state) => {
    return !!(
      state.discordUserId &&
      state.trackingEnabled &&
      state.sessionCode
    );
  },
};

const actions = {
  /**
   * Set Discord user info after OAuth login
   */
  setDiscordUser({ commit, dispatch, state }, { userId, username }) {
    commit("setDiscordUserId", userId);
    commit("setDiscordUsername", username);

    // Update existing session if we have one
    if (state.statsToken && state.statsSessionId) {
      dispatch("updateSessionDiscordUser", userId);
    }
  },

  /**
   * Update the session with Discord user ID
   */
  async updateSessionDiscordUser({ state }, userId) {
    try {
      const response = await fetch(`${state.baseUrl}/session/update-discord`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.statsToken}`,
        },
        body: JSON.stringify({ discord_user_id: userId }),
      });

      if (response.ok) {
        logger.info("Updated session with Discord user ID");
      }
    } catch (error) {
      logger.error("Failed to update session with Discord ID:", error);
    }
  },

  /**
   * Logout and clear all Discord/stats state
   */
  logout({ commit }) {
    commit("setDiscordUserId", null);
    commit("setDiscordUsername", null);
    commit("setTrackingEnabled", false);
    commit("setStatsToken", null);
    commit("setStatsSessionId", null);
    commit("setSessionCode", null);
    commit("setCurrentGameId", null);

    // Clear localStorage
    localStorage.removeItem("discordUserId");
    localStorage.removeItem("discordUsername");
    localStorage.removeItem("statTrackingEnabled");
    localStorage.removeItem("statsToken");
    localStorage.removeItem("statsSessionId");
    localStorage.removeItem("selectedSessionCode");
  },

  /**
   * Enable stat tracking
   */
  async enableTracking({ commit, dispatch, state }) {
    commit("setTrackingEnabled", true);

    // Create session if we don't have one
    if (!state.statsToken) {
      await dispatch("createStatsSession");
    }
  },

  /**
   * Disable stat tracking
   */
  disableTracking({ commit }) {
    commit("setTrackingEnabled", false);
  },

  /**
   * Create a new stats session
   */
  async createStatsSession({ commit, state }) {
    try {
      const response = await fetchWithTimeout(
        `${state.baseUrl}/session/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            discord_user_id: state.discordUserId,
          }),
        },
      );

      const data = await response.json();

      if (data.token) {
        commit("setStatsToken", data.token);
        commit("setStatsSessionId", data.sessionId);
        logger.info("Stats session created:", data.sessionId);
        return data;
      }
    } catch (error) {
      logger.error("Failed to create stats session:", error);
      throw error;
    }
  },

  /**
   * Start a new game
   */
  async startGame(
    { commit, state },
    { script, customName, players, sessionCode },
  ) {
    if (!state.trackingEnabled || !state.statsToken) {
      throw new Error("Stats tracking not enabled or no token");
    }

    try {
      const response = await fetchWithTimeout(`${state.baseUrl}/game/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.statsToken}`,
        },
        body: JSON.stringify({
          script,
          customName,
          players,
          storytellerId: state.discordUserId,
          sessionCode: sessionCode || state.sessionCode,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.game_id) {
        commit("setCurrentGameId", data.game_id);
        logger.info("Game started:", data.game_id);
        return data;
      }
    } catch (error) {
      logger.error("Failed to start game:", error);
      throw error;
    }
  },

  /**
   * End the current game
   */
  async endGame({ commit, state }, { winner }) {
    if (!state.currentGameId || !state.statsToken) {
      throw new Error("No active game or no token");
    }

    try {
      const response = await fetchWithTimeout(`${state.baseUrl}/game/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.statsToken}`,
        },
        body: JSON.stringify({
          gameId: state.currentGameId,
          winner: winner,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      logger.info("Game ended");
      commit("setCurrentGameId", null);
      return data;
    } catch (error) {
      logger.error("Failed to end game:", error);
      throw error;
    }
  },

  async cancelGame({ commit, state }) {
    if (!state.currentGameId || !state.statsToken) {
      throw new Error("No active game or no token");
    }

    try {
      const response = await fetchWithTimeout(`${state.baseUrl}/game/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.statsToken}`,
        },
        body: JSON.stringify({
          game_id: state.currentGameId,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      logger.info("Game canceled");
      commit("setCurrentGameId", null);
      return data;
    } catch (error) {
      logger.error("Failed to cancel game:", error);
      throw error;
    }
  },

  /**
   * Update a player's role in the current game
   */
  async updatePlayerRole({ state }, { playerName, role, finalRole }) {
    if (!state.currentGameId || !state.statsToken) {
      return;
    }

    try {
      await fetchWithTimeout(`${state.baseUrl}/game/update-role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.statsToken}`,
        },
        body: JSON.stringify({
          game_id: state.currentGameId,
          player_name: playerName,
          role,
          final_role: finalRole,
        }),
      });
    } catch (error) {
      logger.error("Failed to update player role:", error);
    }
  },
};

const mutations = {
  setDiscordUserId(state, userId) {
    state.discordUserId = userId;
    if (userId) {
      localStorage.setItem("discordUserId", userId);
    } else {
      localStorage.removeItem("discordUserId");
    }
  },

  setDiscordUsername(state, username) {
    state.discordUsername = username;
    if (username) {
      localStorage.setItem("discordUsername", username);
    } else {
      localStorage.removeItem("discordUsername");
    }
  },

  setSessionCode(state, code) {
    state.sessionCode = code;
    if (code) {
      localStorage.setItem("selectedSessionCode", code);
    } else {
      localStorage.removeItem("selectedSessionCode");
    }
  },

  setStatsToken(state, token) {
    state.statsToken = token;
    if (token) {
      localStorage.setItem("statsToken", token);
    } else {
      localStorage.removeItem("statsToken");
    }
  },

  setStatsSessionId(state, sessionId) {
    state.statsSessionId = sessionId;
    if (sessionId) {
      localStorage.setItem("statsSessionId", sessionId);
    } else {
      localStorage.removeItem("statsSessionId");
    }
  },

  setCurrentGameId(state, gameId) {
    state.currentGameId = gameId;
    if (gameId) {
      localStorage.setItem("currentGameId", gameId);
    } else {
      localStorage.removeItem("currentGameId");
    }
  },

  setTrackingEnabled(state, enabled) {
    state.trackingEnabled = enabled;
    localStorage.setItem("statTrackingEnabled", enabled ? "true" : "false");
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
