<template>
  <div id="controls" role="toolbar" aria-label="Game controls">
    <button
      class="nomlog-summary"
      v-show="session.voteHistory.length && session.sessionId"
      @click="toggleModal('voteHistory')"
      :aria-label="`View ${session.voteHistory.length} recent ${
        session.voteHistory.length == 1 ? 'nomination' : 'nominations'
      }`"
      :title="`${session.voteHistory.length} recent ${
        session.voteHistory.length == 1 ? 'nomination' : 'nominations'
      }`"
    >
      <font-awesome-icon icon="book-dead" aria-hidden="true" />
      <span aria-live="polite">{{ session.voteHistory.length }}</span>
    </button>
    <button
      class="session"
      :class="{
        spectator: session.isSpectator,
        reconnecting: session.isReconnecting,
      }"
      v-if="session.sessionId"
      @click="leaveSession"
      :aria-label="`${session.playerCount} players in session. Click to leave.${
        session.ping ? ' ' + session.ping + ' milliseconds latency' : ''
      }`"
      :title="`${session.playerCount} other players in this session${
        session.ping ? ' (' + session.ping + 'ms latency)' : ''
      }`"
    >
      <font-awesome-icon icon="broadcast-tower" aria-hidden="true" />
      <span aria-live="polite">{{ session.playerCount }}</span>
    </button>
    <nav
      class="menu"
      :class="{ open: grimoire.isMenuOpen }"
      role="navigation"
      aria-label="Main menu"
    >
      <button
        @click="handleMenuToggle"
        aria-label="Toggle menu"
        :aria-expanded="grimoire.isMenuOpen"
        class="menu-toggle"
      >
        <font-awesome-icon icon="cog" aria-hidden="true" />
      </button>
      <ul role="tablist">
        <li class="tabs" :class="tab">
          <button
            role="tab"
            :aria-selected="tab === 'grimoire'"
            @click="tab = 'grimoire'"
            @keydown.enter="tab = 'grimoire'"
            @keydown.space.prevent="tab = 'grimoire'"
            aria-label="Grimoire tab"
          >
            <font-awesome-icon icon="book-open" aria-hidden="true" />
          </button>
          <button
            role="tab"
            :aria-selected="tab === 'session'"
            @click="tab = 'session'"
            @keydown.enter="tab = 'session'"
            @keydown.space.prevent="tab = 'session'"
            aria-label="Session tab"
          >
            <font-awesome-icon icon="broadcast-tower" aria-hidden="true" />
          </button>
          <button
            role="tab"
            v-if="!session.isSpectator"
            :aria-selected="tab === 'players'"
            @click="tab = 'players'"
            @keydown.enter="tab = 'players'"
            @keydown.space.prevent="tab = 'players'"
            aria-label="Players tab"
          >
            <font-awesome-icon icon="users" aria-hidden="true" />
          </button>
          <button
            role="tab"
            :aria-selected="tab === 'characters'"
            @click="tab = 'characters'"
            @keydown.enter="tab = 'characters'"
            @keydown.space.prevent="tab = 'characters'"
            aria-label="Characters tab"
          >
            <font-awesome-icon icon="theater-masks" aria-hidden="true" />
          </button>
          <button
            role="tab"
            :aria-selected="tab === 'help'"
            @click="tab = 'help'"
            @keydown.enter="tab = 'help'"
            @keydown.space.prevent="tab = 'help'"
            aria-label="Help tab"
          >
            <font-awesome-icon icon="question" aria-hidden="true" />
          </button>
        </li>

        <template v-if="tab === 'grimoire'">
          <!-- Grimoire -->
          <li class="headline">Grimoire</li>
          <li @click="toggleModal('journal')">
            Journal
            <em>[W]</em>
          </li>
          <li
            @click="toggleRevealMode"
            v-if="players.length && !session.isSpectator"
          >
            <template v-if="!grimoire.isRevealMode">Grim Reveal</template>
            <template v-if="grimoire.isRevealMode">End Reveal</template>
            <em>[G]</em>
          </li>
          <li @click="toggleNight" v-if="!session.isSpectator">
            <template v-if="!grimoire.isNight">Switch to Night</template>
            <template v-if="grimoire.isNight">Switch to Day</template>
            <em>[S]</em>
          </li>
          <li
            @click="toggleNightOrder"
            v-if="players.length && !session.isSpectator"
          >
            Night Order
            <em>
              <font-awesome-icon
                :icon="[
                  'fas',
                  grimoire.isNightOrder ? 'check-square' : 'square',
                ]"
              />
            </em>
          </li>
          <li @click="toggleModal('timer')" v-if="!session.isSpectator">
            Timer
            <em>[T]</em>
          </li>
          <li v-if="players.length">
            Zoom
            <em>
              <font-awesome-icon
                @click="setZoom(grimoire.zoom - 1)"
                icon="search-minus"
              />
              {{ Math.round(100 + grimoire.zoom * 10) }}%
              <font-awesome-icon
                @click="setZoom(grimoire.zoom + 1)"
                icon="search-plus"
              />
            </em>
          </li>
          <li @click="setBackground">
            Background Image
            <em><font-awesome-icon icon="image" /></em>
          </li>
          <li v-if="!edition.isOfficial" @click="imageOptIn">
            <small>Show Custom Images</small>
            <em
              ><font-awesome-icon
                :icon="[
                  'fas',
                  grimoire.isImageOptIn ? 'check-square' : 'square',
                ]"
            /></em>
          </li>
          <li @click="toggleStatic">
            Disable Animations
            <em
              ><font-awesome-icon
                :icon="['fas', grimoire.isStatic ? 'check-square' : 'square']"
            /></em>
          </li>
          <li @click="toggleMuted">
            Mute Sounds
            <em
              ><font-awesome-icon
                :icon="['fas', grimoire.isMuted ? 'volume-mute' : 'volume-up']"
            /></em>
          </li>
        </template>

        <template v-if="tab === 'session'">
          <!-- Session -->
          <li class="headline" v-if="session.sessionId">
            {{ session.isSpectator ? "Playing" : "Hosting" }}
          </li>
          <li class="headline" v-else>Live Session</li>

          <!-- Discord Login (always visible) -->
          <li
            v-if="!isDiscordLinked"
            @click="loginWithDiscord"
            style="background: #5865f2"
          >
            <small style="color: white">Log in with Discord</small>
            <em
              ><font-awesome-icon
                :icon="['fab', 'discord']"
                style="color: white"
            /></em>
          </li>
          <li v-else style="color: #57f287">
            <small>✓ Discord: {{ discordUsername }}</small>
            <em @click="logoutDiscord" style="cursor: pointer" title="Logout"
              ><font-awesome-icon icon="sign-out-alt"
            /></em>
          </li>

          <li
            v-if="
              isDiscordLinked && !session.isSpectator && isStatTrackingEnabled
            "
          >
            <small
              style="
                width: 100%;
                display: flex;
                flex-direction: column;
                gap: 4px;
              "
            >
              <label
                style="
                  font-size: 0.75em;
                  color: rgba(255, 255, 255, 0.6);
                  margin-bottom: 2px;
                "
              >
                session code (press Enter to save)
              </label>
              <div style="display: flex; gap: 4px; align-items: center">
                <input
                  v-model="tempSessionCode"
                  @keyup.enter="confirmSessionCode"
                  :style="{
                    borderColor: sessionCodeConfirmed ? '#57F287' : '',
                  }"
                  placeholder="e.g., s1, s2"
                  title="Type session code from *game in Discord, then press Enter"
                  style="
                    flex: 1;
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    padding: 4px;
                    border-radius: 3px;
                  "
                />
                <button
                  @click="confirmSessionCode"
                  :disabled="!tempSessionCode.trim()"
                  style="
                    background: #5865f2;
                    color: white;
                    border: none;
                    padding: 4px 8px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 0.9em;
                  "
                  :style="{ opacity: tempSessionCode.trim() ? 1 : 0.5 }"
                >
                  ✓
                </button>
              </div>
            </small>
          </li>
          <li
            v-if="sessionCode && !session.isSpectator"
            style="color: #57f287; font-size: 0.85em"
          >
            <small>🔗 Session: {{ sessionCode }}</small>
            <em @click="clearSessionCode" style="cursor: pointer" title="Clear"
              >✕</em
            >
          </li>

          <template v-if="!session.sessionId">
            <li @click="hostSession">Host (Storyteller)<em>[H]</em></li>
            <li @click="joinSession">Join (Player)<em>[J]</em></li>
          </template>
          <template v-else>
            <li
              v-if="
                !session.isSpectator &&
                isDiscordLinked &&
                isStatTrackingEnabled &&
                !currentGameId
              "
              @click="startGame"
              :class="{ disabled: isStartingGame }"
            >
              <small>{{ isStartingGame ? "Starting..." : "Start Game" }}</small>
              <em
                ><font-awesome-icon
                  :icon="isStartingGame ? 'spinner' : 'play'"
                  :spin="isStartingGame"
              /></em>
            </li>
            <li
              v-if="
                !session.isSpectator &&
                isDiscordLinked &&
                isStatTrackingEnabled &&
                currentGameId
              "
              @click="endGame"
              :class="{ disabled: isEndingGame }"
            >
              <small>{{ isEndingGame ? "Ending..." : "End Game" }}</small>
              <em
                ><font-awesome-icon
                  :icon="isEndingGame ? 'spinner' : 'stop'"
                  :spin="isEndingGame"
              /></em>
            </li>
            <li
              v-if="
                !session.isSpectator &&
                isDiscordLinked &&
                isStatTrackingEnabled &&
                currentGameId
              "
              @click="cancelGame"
              :class="{ disabled: isCancelingGame }"
            >
              <small>{{
                isCancelingGame ? "Canceling..." : "Cancel Game"
              }}</small>
              <em
                ><font-awesome-icon
                  :icon="isCancelingGame ? 'spinner' : 'times-circle'"
                  :spin="isCancelingGame"
              /></em>
            </li>
            <li
              v-if="
                !session.isSpectator && sessionCodeConfirmed && currentGameId
              "
              @click="muteAll"
              :class="{ disabled: isMuting }"
            >
              <small>{{ isMuting ? "Muting..." : "Mute All" }}</small>
              <em
                ><font-awesome-icon
                  :icon="isMuting ? 'spinner' : 'microphone-slash'"
                  :spin="isMuting"
              /></em>
            </li>
            <li
              v-if="
                !session.isSpectator && sessionCodeConfirmed && currentGameId
              "
              @click="unmuteAll"
              :class="{ disabled: isUnmuting }"
            >
              <small>{{ isUnmuting ? "Unmuting..." : "Unmute All" }}</small>
              <em
                ><font-awesome-icon
                  :icon="isUnmuting ? 'spinner' : 'microphone'"
                  :spin="isUnmuting"
              /></em>
            </li>
            <li
              v-if="
                !session.isSpectator && sessionCodeConfirmed && currentGameId
              "
              @click="callTownspeople"
              :class="{ disabled: isCalling }"
            >
              <small>{{ isCalling ? "Calling..." : "Call Townspeople" }}</small>
              <em
                ><font-awesome-icon
                  :icon="isCalling ? 'spinner' : 'users'"
                  :spin="isCalling"
              /></em>
            </li>
            <li v-if="session.ping">
              <small>
                Delay to {{ session.isSpectator ? "Host" : "Players" }}
              </small>
              <em>{{ session.ping }}ms</em>
            </li>
            <li @click="copySessionUrl">
              Copy Player Link
              <em><font-awesome-icon icon="copy" /></em>
            </li>
            <li
              v-if="!session.isSpectator && showSendCharacters"
              @click="distributeRoles"
            >
              Send Characters
              <em><font-awesome-icon icon="seedling" /></em>
            </li>
            <li
              v-if="session.voteHistory.length || !session.isSpectator"
              @click="toggleModal('voteHistory')"
            >
              Vote History<em>[V]</em>
            </li>
            <li v-if="!session.isSpectator" @click="toggleSelfNaming">
              Allow Self-Naming
              <em
                ><font-awesome-icon
                  :icon="[
                    'fas',
                    session.allowSelfNaming ? 'check-square' : 'square',
                  ]"
              /></em>
            </li>
            <li v-if="!session.isSpectator" @click="setVoteWatching">
              Secret Vote
              <em
                ><font-awesome-icon
                  :icon="[
                    'fas',
                    !session.isVoteWatchingAllowed ? 'check-square' : 'square',
                  ]"
              /></em>
            </li>
            <li v-if="!session.isSpectator" @click="setTwoVotes">
              Voting Twice
              <em
                ><font-awesome-icon
                  :icon="[
                    'fas',
                    session.isTwoVotesEnabled ? 'check-square' : 'square',
                  ]"
              /></em>
            </li>
            <li
              v-if="!session.isSpectator && isDiscordLinked"
              @click="toggleStatTracking"
            >
              <small>Track Game Stats</small>
              <em
                ><font-awesome-icon
                  :icon="[
                    'fas',
                    isStatTrackingEnabled ? 'check-square' : 'square',
                  ]"
              /></em>
            </li>
            <li @click="leaveSession">
              Leave Session
              <em>{{ session.sessionId }}</em>
            </li>
          </template>
        </template>

        <template v-if="tab === 'players' && !session.isSpectator">
          <!-- Users -->
          <li class="headline">Players</li>
          <li @click="addPlayer" v-if="players.length < 20">Add<em>[A]</em></li>
          <li @click="randomizeSeatings" v-if="players.length > 2">
            Randomize
            <em><font-awesome-icon icon="dice" /></em>
          </li>
          <li @click="clearPlayers" v-if="players.length">
            Remove All
            <em><font-awesome-icon icon="trash-alt" /></em>
          </li>
        </template>

        <template v-if="tab === 'characters'">
          <!-- Characters -->
          <li class="headline">Characters</li>
          <li v-if="!session.isSpectator" @click="toggleModal('edition')">
            Select Edition
            <em>[E]</em>
          </li>
          <li
            @click="toggleModal('roles')"
            v-if="!session.isSpectator && players.length > 4"
          >
            Choose & Assign
            <em>[C]</em>
          </li>
          <li v-if="!session.isSpectator" @click="toggleModal('npc')">
            Add NPCs
            <em><font-awesome-icon icon="dragon" /></em>
          </li>
          <li @click="clearRoles" v-if="players.length">
            Clear All
            <em><font-awesome-icon icon="trash-alt" /></em>
          </li>
        </template>

        <template v-if="tab === 'help'">
          <!-- Help -->
          <li class="headline">Help</li>
          <li @click="toggleModal('reference')">
            Reference Sheet
            <em>[R]</em>
          </li>
          <li @click="toggleModal('nightOrder')">
            Night Order Sheet
            <em>[N]</em>
          </li>
          <li @click="toggleModal('gameState')">
            Game State JSON
            <em><font-awesome-icon icon="file-code" /></em>
          </li>
          <li @click="toggleMockAssignments">
            Mock Assignments
            <em
              ><font-awesome-icon
                :icon="[
                  'fas',
                  grimoire.isMockAssignmentsAllowed ? 'check-square' : 'square',
                ]"
            /></em>
          </li>
          <li>
            <small>
              <a href="https://discord.gg/botc" target="_blank">
                Join Unofficial Discord
              </a>
            </small>
            <em>
              <a href="https://discord.gg/botc" target="_blank">
                <font-awesome-icon :icon="['fab', 'discord']" />
              </a>
            </em>
          </li>
          <li>
            <a href="https://github.com/gorewife/grimlive" target="_blank">
              Source Code
            </a>
            <em>
              <a href="https://github.com/gorewife/grimlive" target="_blank">
                <font-awesome-icon :icon="['fab', 'github']" />
              </a>
            </em>
          </li>
        </template>
      </ul>
    </nav>
  </div>
</template>

<script>
import { mapMutations, mapState, mapGetters } from "vuex";
import { logger } from "../utils/logger";

export default {
  computed: {
    showSendCharacters: function () {
      return (
        this.npcs.some((npc) => npc.id === "gardener") &&
        !this.npcs.some((npc) => npc.id === "tor")
      );
    },
    // Now properly reactive from Vuex - no updateKey needed!
    ...mapState("stats", {
      isStatTrackingEnabled: (state) => state.trackingEnabled,
      discordUsername: (state) => state.discordUsername || "Unknown",
      currentGameId: (state) => state.currentGameId,
      sessionCode: (state) => state.sessionCode || "",
    }),
    ...mapGetters("stats", ["isDiscordLinked"]),
    ...mapState(["grimoire", "session", "edition"]),
    ...mapState("players", ["players", "npcs"]),
  },
  data() {
    return {
      tab: "grimoire",
      tempSessionCode: "", // Temporary input value before confirmation
      sessionCodeConfirmed: false,
      isStartingGame: false,
      isEndingGame: false,
      isCancelingGame: false,
      isMuting: false,
      isUnmuting: false,
      isCalling: false,
      grimoireStateBeforeReveal: true,
    };
  },
  async mounted() {
    // Load selected session from Vuex store
    if (this.isDiscordLinked) {
      const savedCode = this.sessionCode;
      if (savedCode) {
        this.tempSessionCode = savedCode;
        this.sessionCodeConfirmed = true;
      }
    }

    // Listen for Discord login success from popup
    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data.type === "discord-login-success") {
        // Discord login successful, reloading
        window.location.reload();
      }
    });
  },
  watch: {},
  methods: {
    async setBackground() {
      const background = await window.$dialog.prompt("Enter custom background URL");
      if (background || background === "") {
        this.$store.commit("setBackground", background);
      }
    },
    async hostSession() {
      if (this.session.sessionId) return;
      const sessionId = await window.$dialog.prompt(
        "Enter a channel number / name for your session",
        Math.round(Math.random() * 10000).toString(),
      );
      if (sessionId) {
        this.$store.commit("session/clearVoteHistory");
        this.$store.commit("session/setSpectator", false);
        this.$store.commit("session/setSessionId", sessionId);
        this.copySessionUrl();
      }
    },
    copySessionUrl() {
      const url = window.location.href.split("#")[0];
      const link = url + "#" + this.session.sessionId;
      navigator.clipboard.writeText(link);
    },
    async distributeRoles() {
      if (this.session.isSpectator) return;
      const popup =
        "Do you want to distribute assigned characters to all SEATED players?";
      if (await window.$dialog.confirm(popup)) {
        this.$store.commit("session/distributeRoles", true);
        setTimeout(
          (() => {
            this.$store.commit("session/distributeRoles", false);
          }).bind(this),
          2000,
        );
      }
    },
    async imageOptIn() {
      const popup =
        "Are you sure you want to allow custom images? A malicious script file author might track your IP address this way.";
      if (this.grimoire.isImageOptIn || await window.$dialog.confirm(popup)) {
        this.toggleImageOptIn();
      }
    },
    async joinSession() {
      if (this.session.sessionId) return this.leaveSession();
      let sessionId = await window.$dialog.prompt(
        "Enter the channel number / name of the session you want to join",
      );
      if (sessionId.match(/^https?:\/\//i)) {
        sessionId = sessionId.split("#").pop();
      }
      if (sessionId) {
        this.$store.commit("session/clearVoteHistory");
        this.$store.commit("session/setSpectator", true);
        this.$store.commit("toggleGrimoire", false);
        this.$store.commit("session/setSessionId", sessionId);
      }
    },
    async leaveSession() {
      if (await window.$dialog.confirm("Are you sure you want to leave the active live game?")) {
        this.$store.commit("session/setSpectator", false);
        this.$store.commit("session/setSessionId", "");
      }
    },
    async addPlayer() {
      if (this.session.isSpectator) return;
      if (this.players.length >= 20) return;
      const name = await window.$dialog.prompt("Player name", "Player " + (this.players.length + 1));
      if (name) {
        this.$store.commit("players/add", name);
      }
      // Refocus the window after dialog closes
      window.focus();
      document.body.focus();
    },
    async randomizeSeatings() {
      if (this.session.isSpectator) return;
      if (await window.$dialog.confirm("Are you sure you want to randomize seatings?")) {
        this.$store.dispatch("players/randomize");
      }
    },
    async clearPlayers() {
      if (this.session.isSpectator) return;
      if (await window.$dialog.confirm("Are you sure you want to remove all players?")) {
        // abort vote if in progress
        if (this.session.nomination) {
          this.$store.commit("session/nomination");
        }
        this.$store.commit("players/clear");
      }
    },
    async clearRoles() {
      if (await window.$dialog.confirm("Are you sure you want to remove all player roles?")) {
        this.$store.dispatch("players/clearRoles");
      }
    },
    toggleNight() {
      this.$store.commit("toggleNight");
      if (this.grimoire.isNight) {
        this.$store.commit("session/setMarkedPlayer", -1);
      }
    },
    toggleSelfNaming() {
      if (this.session.isSpectator) return;
      this.$store.commit(
        "session/setAllowSelfNaming",
        !this.session.allowSelfNaming,
      );
    },
    setTwoVotes() {
      if (this.session.isSpectator) return;
      this.$store.commit(
        "session/setTwoVotesEnabled",
        !this.session.isTwoVotesEnabled,
      );

      if (!this.session.isTwoVotesEnabled) {
        // Disable two votes for all players
        this.players.forEach((player) => {
          if (player.hasTwoVotes) {
            this.$store.commit("players/update", {
              player: player,
              property: "hasTwoVotes",
              value: false,
            });
          }
        });
      }
    },
    setVoteWatching() {
      if (this.session.isSpectator) return;
      this.$store.commit(
        "session/setVoteWatchingAllowed",
        !this.session.isVoteWatchingAllowed,
      );

      if (!this.session.isVoteWatchingAllowed) {
        // Disable vote history if votes are hidden
        this.$store.commit("session/setVoteHistoryAllowed", false);
      }
    },
    async toggleStatTracking() {
      if (this.session.isSpectator) return;

      // Can only enable if Discord is linked
      if (!this.isStatTrackingEnabled && !this.isDiscordLinked) {
        await window.$dialog.alert("Please log in with Discord first to enable stat tracking.");
        return;
      }

      if (this.isStatTrackingEnabled) {
        await this.$store.dispatch("stats/disableTracking");
      } else {
        await this.$store.dispatch("stats/enableTracking");
      }
    },
    async loginWithDiscord() {
      // loginWithDiscord clicked
      const baseUrl = import.meta.env.PROD
        ? "https://api.hystericca.dev"
        : "http://localhost:8001";
      const redirectUri = encodeURIComponent(
        window.location.origin + "/auth/callback.html",
      );
      const authUrl = `${baseUrl}/auth/discord?redirect_uri=${redirectUri}`;

      // Redirecting to OAuth
      window.location.href = authUrl;
    },
    async logoutDiscord() {
      if (await window.$dialog.confirm("Log out of Discord? This will disable stat tracking.")) {
        this.$store.dispatch("stats/logout");
        window.location.reload();
      }
    },
    async confirmSessionCode() {
      const code = this.tempSessionCode.trim();
      if (!code) return;

      if (!this.sessionCodeConfirmed) {
        const confirmed = await window.$dialog.confirm(
          `Save session code "${code}"?\n\nThis links your game to the Discord bot.`,
        );
        if (!confirmed) return;
      }

      this.sessionCodeConfirmed = true;
      this.$store.commit("stats/setSessionCode", code);
    },
    clearSessionCode() {
      this.tempSessionCode = "";
      this.sessionCodeConfirmed = false;
      this.$store.commit("stats/setSessionCode", null);
    },
    async startGame() {
      // Prevent double-clicks and check if game already started
      if (this.isStartingGame || this.currentGameId) return;
      if (
        this.session.isSpectator ||
        !this.isStatTrackingEnabled ||
        !this.isDiscordLinked
      )
        return;

      const sessionCode = this.sessionCode;
      if (!sessionCode) {
        await window.$dialog.alert("Enter session code from Discord (*game command) to link stats");
        return;
      }

      if (!this.sessionCodeConfirmed) {
        const confirmed = await window.$dialog.confirm(
          `Start game with session code "${sessionCode}"?`,
        );
        if (!confirmed) return;
        this.sessionCodeConfirmed = true;
      }

      this.isStartingGame = true;
      let gameStarted = false;

      try {
        let script = "Custom Script";
        let customName = "";

        if (this.edition.isOfficial) {
          script = this.edition.name || this.edition.id;
        } else {
          customName = this.edition.name || this.edition.id || "Unnamed Script";
        }

        const playerNames = this.players
          .filter((p) => p.name && p.name.trim())
          .map((p) => p.name);

        // Temporarily disabled for testing
        // if (playerNames.length < 2) {
        //   alert('At least 2 players with names are required to start a game.');
        //   this.isStartingGame = false;
        //   return;
        // }

        const data = await this.$store.dispatch("stats/startGame", {
          script,
          customName,
          players: playerNames,
          sessionCode,
        });

        if (data && data.game_id) {
          gameStarted = true;
          const playerPromises = this.players
            .map((player, i) => {
              if (player.role && player.role.id) {
                return this.$store.dispatch("stats/updatePlayerRole", {
                  playerName: player.name,
                  playerNumber: i + 1,
                  roleId: player.role.id,
                  roleName: player.role.name,
                  roleTeam: player.role.team,
                  isFinal: false,
                  discordId: player.discord_id,
                });
              }
              return null;
            })
            .filter((p) => p !== null);

          await Promise.all(playerPromises);
          await window.$dialog.alert(`✓ Game started! ID: ${data.game_id}`);
        } else {
          await window.$dialog.alert("Failed to start game. Check session code and try again.");
          this.$store.commit("stats/setCurrentGameId", null);
        }
      } catch (error) {
        logger.error("Start game error:", error);
        await window.$dialog.alert(`Error starting game: ${error.message || "Unknown error"}`);
        // Rollback game ID if game was started but player updates failed
        if (gameStarted) {
          try {
            await this.$store.dispatch("stats/cancelGame");
          } catch (rollbackError) {
            logger.error("Failed to rollback game:", rollbackError);
          }
        }
        this.$store.commit("stats/setCurrentGameId", null);
        // Keep menu open on error so user can try again
      } finally {
        this.isStartingGame = false;
      }
    },
    async endGame() {
      if (
        this.session.isSpectator ||
        !this.isStatTrackingEnabled ||
        !this.currentGameId
      )
        return;

      this.$store.commit("toggleModal", "endGame");
    },
    async confirmEndGame(winningTeam) {
      // Prevent double-clicks
      if (this.isEndingGame) return;
      if (
        this.session.isSpectator ||
        !this.isStatTrackingEnabled ||
        !this.currentGameId
      )
        return;

      this.isEndingGame = true;

      try {
        const playerPromises = this.players
          .map((player, i) => {
            if (player.role && player.role.id) {
              return this.$store.dispatch("stats/updatePlayerRole", {
                playerName: player.name,
                playerNumber: i + 1,
                roleId: player.role.id,
                roleName: player.role.name,
                roleTeam: player.role.team,
                isFinal: true,
                discordId: player.discord_id,
              });
            }
            return null;
          })
          .filter((p) => p !== null);

        await Promise.all(playerPromises);
        await this.$store.dispatch("stats/endGame", { winner: winningTeam });
        await window.$dialog.alert(`✓ Game ended! ${winningTeam} wins.`);
      } catch (error) {
        console.error("End game error:", error);
        await window.$dialog.alert(`Error ending game: ${error.message || "Unknown error"}`);
      } finally {
        this.isEndingGame = false;
      }
    },
    async cancelGame() {
      if (this.isCancelingGame) return;
      if (
        this.session.isSpectator ||
        !this.isStatTrackingEnabled ||
        !this.currentGameId
      )
        return;

      if (!confirm("Cancel this game? Stats will not be recorded.")) return;

      this.isCancelingGame = true;

      try {
        await this.$store.dispatch("stats/cancelGame");
        alert("✓ Game canceled.");
      } catch (error) {
        console.error("Cancel game error:", error);
        alert(`Error canceling game: ${error.message || "Unknown error"}`);
      } finally {
        this.isCancelingGame = false;
      }
    },
    async muteAll() {
      if (this.isMuting) return;
      if (this.session.isSpectator || !this.sessionCodeConfirmed) return;

      if (!this.sessionCode) {
        alert("Session code required");
        return;
      }

      this.isMuting = true;

      try {
        const baseUrl = import.meta.env.PROD
          ? "https://api.hystericca.dev"
          : "http://localhost:8001";

        const response = await fetch(`${baseUrl}/api/mute`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionCode: this.sessionCode }),
        });

        if (response.ok) {
          // Mute command sent successfully
        } else {
          const data = await response.json();
          console.error("Failed to mute:", data.error);
          alert(`Failed to mute: ${data.error || "Unknown error"}`);
        }
      } catch (error) {
        console.error("Mute error:", error);
        alert(
          `Error sending mute command: ${error.message || "Unknown error"}`,
        );
      } finally {
        this.isMuting = false;
      }
    },
    async unmuteAll() {
      if (this.isUnmuting) return;
      if (this.session.isSpectator || !this.sessionCodeConfirmed) return;

      if (!this.sessionCode) {
        alert("Session code required");
        return;
      }

      this.isUnmuting = true;

      try {
        const baseUrl = import.meta.env.PROD
          ? "https://api.hystericca.dev"
          : "http://localhost:8001";

        const response = await fetch(`${baseUrl}/api/unmute`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionCode: this.sessionCode }),
        });

        if (response.ok) {
          // Unmute command sent successfully
        } else {
          const data = await response.json();
          console.error("Failed to unmute:", data.error);
          alert(`Failed to unmute: ${data.error || "Unknown error"}`);
        }
      } catch (error) {
        console.error("Unmute error:", error);
        alert(
          `Error sending unmute command: ${error.message || "Unknown error"}`,
        );
      } finally {
        this.isUnmuting = false;
      }
    },
    async callTownspeople() {
      if (this.isCalling) return;
      if (this.session.isSpectator || !this.sessionCodeConfirmed) return;

      if (!this.sessionCode) {
        alert("Session code required");
        return;
      }

      this.isCalling = true;

      try {
        const baseUrl = import.meta.env.PROD
          ? "https://api.hystericca.dev"
          : "http://localhost:8001";

        const response = await fetch(`${baseUrl}/api/call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionCode: this.sessionCode }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to call townspeople");
        }

        // Call townspeople successful
      } catch (error) {
        console.error("Call failed:", error);
        alert(`Failed to call townspeople: ${error.message}`);
      } finally {
        this.isCalling = false;
      }
    },
    handleMenuToggle() {
      console.log(
        "Menu toggle clicked, current state:",
        this.grimoire.isMenuOpen,
      );
      this.toggleMenu();
      console.log("After toggle:", this.grimoire.isMenuOpen);
    },
    ...mapMutations([
      "toggleGrimoire",
      "toggleMenu",
      "toggleImageOptIn",
      "toggleMuted",
      "toggleNightOrder",
      "toggleStatic",
      "toggleMockAssignments",
      "toggleRevealMode",
      "setZoom",
      "toggleModal",
    ]),
    toggleRevealMode() {
      const isCurrentlyRevealing = this.$store.state.grimoire.isRevealMode;

      if (!isCurrentlyRevealing) {
        // Entering reveal mode - set grimoire to private (disable old hide mode), reset reveals, toggle mode
        this.$store.commit("toggleGrimoire", false); // Make grimoire private (no CSS flip)
        this.$store.commit("players/resetReveals");
        this.$store.commit("toggleRevealMode"); // Set isRevealMode = true
      } else {
        // Exiting reveal mode - just toggle mode off, DON'T reset reveals so they stay visible
        this.$store.commit("toggleRevealMode"); // Set isRevealMode = false
        // Don't call resetReveals here - revealed tokens should stay revealed!
      }
    },
  },
};
</script>

<style scoped lang="scss">
// success animation
@keyframes greenToWhite {
  from {
    color: green;
  }
  to {
    color: white;
  }
}

// Controls
#controls {
  position: absolute;
  right: 3px;
  top: 3px;
  text-align: right;
  padding-right: 50px;
  z-index: 75;

  svg {
    filter: drop-shadow(0 0 5px rgba(0, 0, 0, 1));
    font-size: 1.4em;
    &.success {
      animation: greenToWhite 1s normal forwards;
      animation-iteration-count: 1;
    }
  }

  > button,
  > span {
    display: inline-block;
    cursor: pointer;
    z-index: 5;
    margin-top: 7px;
    margin-left: 10px;
    background: none;
    border: none;
    color: inherit;
    font-size: inherit;
    font-family: inherit;
    padding: 0;

    &:hover {
      filter: brightness(1.2);
    }
  }

  button.nomlog-summary,
  span.nomlog-summary {
    color: $townsfolk;
  }

  button.session,
  span.session {
    color: $demon;
    &.spectator {
      color: $townsfolk;
    }
    &.reconnecting {
      animation: blink 1s infinite;
    }
  }
}

@keyframes blink {
  50% {
    opacity: 0.5;
    color: gray;
  }
}

.menu {
  width: 280px;
  position: fixed;
  right: 10px;
  top: 10px;
  z-index: 80;
  pointer-events: none;

  > svg,
  > .menu-toggle {
    cursor: pointer;
    background: linear-gradient(
      135deg,
      rgba(42, 26, 61, 0.95) 0%,
      rgba(26, 15, 40, 0.98) 100%
    );
    border: 2px solid rgba(212, 175, 55, 0.4);
    box-shadow:
      0 0 25px rgba(123, 44, 191, 0.4),
      0 4px 15px rgba(0, 0, 0, 0.6);
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: $gold;
    padding: 0;
    font-size: 1.4em;
    color: rgba(212, 175, 55, 0.8);
    transition: all 300ms ease;
    position: absolute;
    right: 0;
    top: 0;
    z-index: 10;
    pointer-events: all;

    &:hover {
      color: rgba(212, 175, 55, 1);
      box-shadow:
        0 0 35px rgba(123, 44, 191, 0.6),
        0 6px 20px rgba(0, 0, 0, 0.7);
      transform: rotate(90deg) scale(1.05);
    }
  }

  a {
    color: #f5e6d3;
    text-decoration: none;
    transition: all 250ms ease;
    &:hover {
      color: rgba(212, 175, 55, 1);
      text-shadow: 0 0 8px rgba(212, 175, 55, 0.4);
    }
  }

  ul {
    display: flex;
    list-style-type: none;
    padding: 0;
    margin: 0;
    margin-top: 70px;
    flex-direction: column;
    max-height: calc(100vh - 100px);
    overflow-y: auto;
    overflow-x: hidden;
    
    /* Hide scrollbar */
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
    &::-webkit-scrollbar {
      display: none; /* Chrome, Safari, Opera */
    }
    
    background:
      linear-gradient(
        135deg,
        rgba(42, 26, 61, 0.95) 0%,
        rgba(26, 15, 40, 0.98) 100%
      ),
      repeating-linear-gradient(
        90deg,
        transparent,
        transparent 2px,
        rgba(212, 175, 55, 0.03) 2px,
        rgba(212, 175, 55, 0.03) 4px
      );
    backdrop-filter: blur(8px);
    box-shadow:
      0 0 40px rgba(123, 44, 191, 0.5),
      0 10px 30px rgba(0, 0, 0, 0.8),
      inset 0 0 60px rgba(139, 0, 0, 0.15),
      inset 0 1px 0 rgba(212, 175, 55, 0.2);
    border: 2px solid rgba(212, 175, 55, 0.4);
    border-radius: 12px;
    position: relative;
    transform: translateX(calc(100% + 20px));
    opacity: 0;
    transition: all 400ms cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;

    &::before,
    &::after {
      content: "";
      position: absolute;
      width: 20px;
      height: 20px;
      border: 2px solid rgba(212, 175, 55, 0.3);
    }

    &::before {
      top: -2px;
      left: -2px;
      border-right: none;
      border-bottom: none;
      border-radius: 12px 0 0 0;
    }

    &::after {
      bottom: -2px;
      right: -2px;
      border-left: none;
      border-top: none;
      border-radius: 0 0 12px 0;
    }

    li {
      padding: 2px 5px;
      color: #f5e6d3;
      text-align: left;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 30px;
      font-size: 0.95em;
      font-weight: 300;
      transition: all 250ms ease;
      pointer-events: all;

      &:first-child {
        margin-top: 8px;
      }

      &:last-child {
        margin-bottom: 8px;
      }

      @media (orientation: portrait) {
        font-size: 15px;
      }

      &.tabs {
        display: flex;
        padding: 0;
        padding-bottom: 20px;
        background: rgba(0, 0, 0, 0.5);
        margin-top: 0 !important;
        margin-bottom: 0;
        min-height: auto;
        svg,
        button {
          flex-grow: 1;
          flex-shrink: 0;
          height: 35px;
          border-bottom: 2px solid rgba(212, 175, 55, 0.3);
          border-right: 2px solid rgba(212, 175, 55, 0.3);
          padding: 5px 0;
          cursor: pointer;
          transition: all 250ms ease;
          font-size: 1.2em;
          background: rgba(0, 0, 0, 0.5);
          border-top: none;
          border-left: none;
          color: inherit;

          &:hover {
            color: rgba(212, 175, 55, 1);
            text-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
          }
          &:focus,
          &:active,
          &:focus-visible {
            outline: none !important;
            background: rgba(0, 0, 0, 0.5) !important;
            box-shadow: none !important;
          }
          &:last-child {
            border-right: 0;
          }
        }
        &.grimoire .fa-book-open,
        &.players .fa-users,
        &.settings .fa-tools,
        &.characters .fa-theater-masks,
        &.session .fa-broadcast-tower,
        &.help .fa-question {
          background: linear-gradient(
            to bottom,
            $townsfolk 0%,
            rgba(0, 0, 0, 0.5) 100%
          );
        }
      }

      &:not(.headline):not(.tabs):hover {
        cursor: pointer;
        color: rgba(212, 175, 55, 1);
        background: rgba(0, 0, 0, 0.7);
        text-shadow: 0 0 8px rgba(212, 175, 55, 0.4);
      }

      &.disabled {
        opacity: 0.5;
        cursor: not-allowed !important;
        pointer-events: none;
      }

      em {
        flex-grow: 0;
        font-style: normal;
        margin-left: 10px;
        font-size: 80%;
      }
    }

    .headline {
      font-weight: 600;
      letter-spacing: 1px;
      padding: 5px 10px;
      text-align: center;
      justify-content: center;
      font-size: 0.9em;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
      background: linear-gradient(
        to right,
        $townsfolk 0%,
        rgba(0, 0, 0, 0.5) 20%,
        rgba(0, 0, 0, 0.5) 80%,
        $demon 100%
      );

      @media (orientation: portrait) {
        font-size: 15px;
      }
    }
  }

  &.open ul {
    transform: translateX(0);
    opacity: 1;
    pointer-events: all;
  }
}
</style>
