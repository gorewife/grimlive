<template>
  <div id="controls">
    <span
      class="nomlog-summary"
      v-show="session.voteHistory.length && session.sessionId"
      @click="toggleModal('voteHistory')"
      :title="`${session.voteHistory.length} recent ${
        session.voteHistory.length == 1 ? 'nomination' : 'nominations'
      }`"
    >
      <font-awesome-icon icon="book-dead" />
      {{ session.voteHistory.length }}
    </span>
    <span
      class="session"
      :class="{
        spectator: session.isSpectator,
        reconnecting: session.isReconnecting,
      }"
      v-if="session.sessionId"
      @click="leaveSession"
      :title="`${session.playerCount} other players in this session${
        session.ping ? ' (' + session.ping + 'ms latency)' : ''
      }`"
    >
      <font-awesome-icon icon="broadcast-tower" />
      {{ session.playerCount }}
    </span>
    <div class="menu" :class="{ open: grimoire.isMenuOpen }">
      <font-awesome-icon icon="cog" @click="handleMenuToggle" />
      <ul>
        <li class="tabs" :class="tab">
          <font-awesome-icon icon="book-open" @click="tab = 'grimoire'" />
          <font-awesome-icon icon="broadcast-tower" @click="tab = 'session'" />
          <font-awesome-icon
            icon="users"
            v-if="!session.isSpectator"
            @click="tab = 'players'"
          />
          <font-awesome-icon icon="theater-masks" @click="tab = 'characters'" />
          <font-awesome-icon icon="question" @click="tab = 'help'" />
        </li>

        <template v-if="tab === 'grimoire'">
          <!-- Grimoire -->
          <li class="headline">Grimoire</li>
          <li @click="toggleModal('journal')">
            Journal
            <em>[W]</em>
          </li>
          <li @click="toggleGrimoire" v-if="players.length">
            <template v-if="!grimoire.isPublic">Hide</template>
            <template v-if="grimoire.isPublic">Show</template>
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
          <li v-if="!isDiscordLinked" @click="loginWithDiscord" style="background: #5865F2;">
            <small style="color: white;">Log in with Discord</small>
            <em><font-awesome-icon :icon="['fab', 'discord']" style="color: white;" /></em>
          </li>
          <li v-else style="color: #57F287;">
            <small>✓ Discord: {{ discordUsername }}</small>
            <em @click="logoutDiscord" style="cursor: pointer;" title="Logout"><font-awesome-icon icon="sign-out-alt" /></em>
          </li>

          <li v-if="isDiscordLinked && !session.isSpectator && isStatTrackingEnabled">
            <small style="width: 100%; display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 0.75em; color: rgba(255,255,255,0.6); margin-bottom: 2px;">
                session code (press Enter to save)
              </label>
              <div style="display: flex; gap: 4px; align-items: center;">
                <input 
                  v-model="tempSessionCode"
                  @keyup.enter="confirmSessionCode"
                  :style="{ borderColor: sessionCodeConfirmed ? '#57F287' : '' }"
                  placeholder="e.g., s1, s2"
                  title="Type session code from *game in Discord, then press Enter"
                  style="flex: 1; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 4px; border-radius: 3px;"
                />
                <button 
                  @click="confirmSessionCode" 
                  :disabled="!tempSessionCode.trim()"
                  style="background: #5865F2; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 0.9em;"
                  :style="{ opacity: tempSessionCode.trim() ? 1 : 0.5 }"
                >
                  ✓
                </button>
              </div>
            </small>
          </li>
          <li v-if="sessionCode && !session.isSpectator" style="color: #57F287; font-size: 0.85em;">
            <small>🔗 Session: {{ sessionCode }}</small>
            <em @click="clearSessionCode" style="cursor: pointer;" title="Clear">✕</em>
          </li>

          <template v-if="!session.sessionId">
            <li @click="hostSession">Host (Storyteller)<em>[H]</em></li>
            <li @click="joinSession">Join (Player)<em>[J]</em></li>
          </template>
          <template v-else>
            <li v-if="!session.isSpectator && isDiscordLinked && isStatTrackingEnabled && !currentGameId" @click="startGame" :class="{ disabled: isStartingGame }">
              <small>{{ isStartingGame ? 'Starting...' : 'Start Game' }}</small>
              <em><font-awesome-icon :icon="isStartingGame ? 'spinner' : 'play'" :spin="isStartingGame" /></em>
            </li>
            <li v-if="!session.isSpectator && isDiscordLinked && isStatTrackingEnabled && currentGameId" @click="endGame" :class="{ disabled: isEndingGame }">
              <small>{{ isEndingGame ? 'Ending...' : 'End Game' }}</small>
              <em><font-awesome-icon :icon="isEndingGame ? 'spinner' : 'stop'" :spin="isEndingGame" /></em>
            </li>
            <li v-if="!session.isSpectator && isDiscordLinked && sessionCodeConfirmed && currentGameId" @click="muteAll" :class="{ disabled: isMuting }">
              <small>{{ isMuting ? 'Muting...' : 'Mute All' }}</small>
              <em><font-awesome-icon :icon="isMuting ? 'spinner' : 'microphone-slash'" :spin="isMuting" /></em>
            </li>
            <li v-if="!session.isSpectator && isDiscordLinked && sessionCodeConfirmed && currentGameId" @click="unmuteAll" :class="{ disabled: isUnmuting }">
              <small>{{ isUnmuting ? 'Unmuting...' : 'Unmute All' }}</small>
              <em><font-awesome-icon :icon="isUnmuting ? 'spinner' : 'microphone'" :spin="isUnmuting" /></em>
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
            <li v-if="!session.isSpectator && isDiscordLinked" @click="toggleStatTracking">
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
            <a
              href="https://github.com/gorewife/grimlive"
              target="_blank"
            >
              Source Code
            </a>
            <em>
              <a
                href="https://github.com/gorewife/grimlive"
                target="_blank"
              >
                <font-awesome-icon :icon="['fab', 'github']" />
              </a>
            </em>
          </li>
        </template>
      </ul>
    </div>
  </div>
</template>

<script>
import { mapMutations, mapState, mapGetters } from "vuex";

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
      isStatTrackingEnabled: state => state.trackingEnabled,
      discordUsername: state => state.discordUsername || 'Unknown',
      currentGameId: state => state.currentGameId,
      sessionCode: state => state.sessionCode || '',
    }),
    ...mapGetters("stats", ['isDiscordLinked']),
    ...mapState(["grimoire", "session", "edition"]),
    ...mapState("players", ["players", "npcs"]),
  },
  data() {
    return {
      tab: "grimoire",
      tempSessionCode: '', // Temporary input value before confirmation
      sessionCodeConfirmed: false,
      isStartingGame: false,
      isEndingGame: false,
      isMuting: false,
      isUnmuting: false,
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
  },
  watch: {
  },
  methods: {
    setBackground() {
      const background = prompt("Enter custom background URL");
      if (background || background === "") {
        this.$store.commit("setBackground", background);
      }
    },
    hostSession() {
      if (this.session.sessionId) return;
      const sessionId = prompt(
        "Enter a channel number / name for your session",
        Math.round(Math.random() * 10000),
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
    distributeRoles() {
      if (this.session.isSpectator) return;
      const popup =
        "Do you want to distribute assigned characters to all SEATED players?";
      if (confirm(popup)) {
        this.$store.commit("session/distributeRoles", true);
        setTimeout(
          (() => {
            this.$store.commit("session/distributeRoles", false);
          }).bind(this),
          2000,
        );
      }
    },
    imageOptIn() {
      const popup =
        "Are you sure you want to allow custom images? A malicious script file author might track your IP address this way.";
      if (this.grimoire.isImageOptIn || confirm(popup)) {
        this.toggleImageOptIn();
      }
    },
    joinSession() {
      if (this.session.sessionId) return this.leaveSession();
      let sessionId = prompt(
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
    leaveSession() {
      if (confirm("Are you sure you want to leave the active live game?")) {
        this.$store.commit("session/setSpectator", false);
        this.$store.commit("session/setSessionId", "");
      }
    },
    addPlayer() {
      if (this.session.isSpectator) return;
      if (this.players.length >= 20) return;
      const name = prompt("Player name", "Player " + (this.players.length + 1));
      if (name) {
        this.$store.commit("players/add", name);
      }
    },
    randomizeSeatings() {
      if (this.session.isSpectator) return;
      if (confirm("Are you sure you want to randomize seatings?")) {
        this.$store.dispatch("players/randomize");
      }
    },
    clearPlayers() {
      if (this.session.isSpectator) return;
      if (confirm("Are you sure you want to remove all players?")) {
        // abort vote if in progress
        if (this.session.nomination) {
          this.$store.commit("session/nomination");
        }
        this.$store.commit("players/clear");
      }
    },
    clearRoles() {
      if (confirm("Are you sure you want to remove all player roles?")) {
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
        alert('Please log in with Discord first to enable stat tracking.');
        return;
      }
      
      if (this.isStatTrackingEnabled) {
        await this.$store.dispatch('stats/disableTracking');
      } else {
        await this.$store.dispatch('stats/enableTracking');
      }
    },
    async loginWithDiscord() {
      const baseUrl = import.meta.env.PROD
        ? 'https://api.hystericca.dev'
        : 'http://localhost:8001';
      const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
      window.location.href = `${baseUrl}/auth/discord?redirect_uri=${redirectUri}`;
    },
    logoutDiscord() {
      if (confirm('Log out of Discord? This will disable stat tracking.')) {
        this.$store.dispatch('stats/logout');
        window.location.reload();
      }
    },
    confirmSessionCode() {
      const code = this.tempSessionCode.trim();
      if (!code) return;
      
      if (!this.sessionCodeConfirmed) {
        const confirmed = confirm(`Save session code "${code}"?\n\nThis links your game to the Discord bot.`);
        if (!confirmed) return;
      }
      
      this.sessionCodeConfirmed = true;
      this.$store.commit('stats/setSessionCode', code);
    },
    clearSessionCode() {
      this.tempSessionCode = '';
      this.sessionCodeConfirmed = false;
      this.$store.commit('stats/setSessionCode', null);
    },
    async startGame() {
      // Prevent double-clicks and check if game already started
      if (this.isStartingGame || this.currentGameId) return;
      if (this.session.isSpectator || !this.isStatTrackingEnabled || !this.isDiscordLinked) return;
      
      const sessionCode = this.sessionCode;
      if (!sessionCode) {
        alert('Enter session code from Discord (*game command) to link stats');
        return;
      }

      if (!this.sessionCodeConfirmed) {
        const confirmed = confirm(`Start game with session code "${sessionCode}"?`);
        if (!confirmed) return;
        this.sessionCodeConfirmed = true;
      }
      
      this.isStartingGame = true;
      
      try {
        let script = 'Custom Script';
        let customName = '';
        
        if (this.edition.isOfficial) {
          script = this.edition.name || this.edition.id;
        } else {
          customName = this.edition.name || this.edition.id || 'Unnamed Script';
        }
        
        const playerNames = this.players
          .filter(p => p.name && p.name.trim())
          .map(p => p.name);
        
        if (playerNames.length < 2) {
          alert('At least 2 players with names are required to start a game.');
          return;
        }
        
        const gameId = await this.$store.dispatch('stats/startGame', {
          script,
          customName,
          playerNames,
          sessionCode
        });
        
        if (gameId) {
          const playerPromises = this.players
            .map((player, i) => {
              if (player.role && player.role.id) {
                return this.$store.dispatch('stats/updatePlayerRole', {
                  playerName: player.name,
                  playerNumber: i + 1,
                  roleId: player.role.id,
                  roleName: player.role.name,
                  roleTeam: player.role.team,
                  isFinal: false,
                  discordId: player.discord_id
                });
              }
              return null;
            })
            .filter(p => p !== null);
          
          await Promise.all(playerPromises);
          alert(`✓ Game started! ID: ${gameId}`);
        } else {
          alert('Failed to start game. Check session code and try again.');
        }
      } catch (error) {
        console.error('Start game error:', error);
        alert(`Error starting game: ${error.message || 'Unknown error'}`);
      } finally {
        this.isStartingGame = false;
      }
    },
    async endGame() {
      if (this.session.isSpectator || !this.isStatTrackingEnabled || !this.currentGameId) return;
      
      this.$store.commit("toggleModal", "endGame");
    },
    async confirmEndGame(winningTeam) {
      // Prevent double-clicks
      if (this.isEndingGame) return;
      if (this.session.isSpectator || !this.isStatTrackingEnabled || !this.currentGameId) return;
      
      this.isEndingGame = true;
      
      try {
        const playerPromises = this.players
          .map((player, i) => {
            if (player.role && player.role.id) {
              return this.$store.dispatch('stats/updatePlayerRole', {
                playerName: player.name,
                playerNumber: i + 1,
                roleId: player.role.id,
                roleName: player.role.name,
                roleTeam: player.role.team,
                isFinal: true,
                discordId: player.discord_id
              });
            }
            return null;
          })
          .filter(p => p !== null);
        
        await Promise.all(playerPromises);
        await this.$store.dispatch('stats/endGame', winningTeam);
        alert(`✓ Game ended! ${winningTeam} wins.`);
      } catch (error) {
        console.error('End game error:', error);
        alert(`Error ending game: ${error.message || 'Unknown error'}`);
      } finally {
        this.isEndingGame = false;
      }
    },
    async muteAll() {
      if (this.isMuting) return;
      if (this.session.isSpectator || !stats.isDiscordLinked() || !this.sessionCodeConfirmed) return;
      
      const sessionCode = stats.getSelectedSessionCode();
      if (!sessionCode) {
        alert('Session code required');
        return;
      }
      
      this.isMuting = true;
      
      try {
        const baseUrl = import.meta.env.PROD
          ? 'https://api.hystericca.dev'
          : 'http://localhost:8001';
        
        const response = await fetch(`${baseUrl}/api/mute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionCode })
        });
        
        if (response.ok) {
          console.log('Mute command sent successfully');
        } else {
          const data = await response.json();
          console.error('Failed to mute:', data.error);
          alert(`Failed to mute: ${data.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Mute error:', error);
        alert(`Error sending mute command: ${error.message || 'Unknown error'}`);
      } finally {
        this.isMuting = false;
      }
    },
    async unmuteAll() {
      if (this.isUnmuting) return;
      if (this.session.isSpectator || !stats.isDiscordLinked() || !this.sessionCodeConfirmed) return;
      
      const sessionCode = stats.getSelectedSessionCode();
      if (!sessionCode) {
        alert('Session code required');
        return;
      }
      
      this.isUnmuting = true;
      
      try {
        const baseUrl = import.meta.env.PROD
          ? 'https://api.hystericca.dev'
          : 'http://localhost:8001';
        
        const response = await fetch(`${baseUrl}/api/unmute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionCode })
        });
        
        if (response.ok) {
          console.log('Unmute command sent successfully');
        } else {
          const data = await response.json();
          console.error('Failed to unmute:', data.error);
          alert(`Failed to unmute: ${data.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Unmute error:', error);
        alert(`Error sending unmute command: ${error.message || 'Unknown error'}`);
      } finally {
        this.isUnmuting = false;
      }
    },
    handleMenuToggle() {
      console.log('Menu toggle clicked, current state:', this.grimoire.isMenuOpen);
      this.toggleMenu();
      console.log('After toggle:', this.grimoire.isMenuOpen);
    },
    ...mapMutations([
      "toggleGrimoire",
      "toggleMenu",
      "toggleImageOptIn",
      "toggleMuted",
      "toggleNightOrder",
      "toggleStatic",
      "toggleMockAssignments",
      "setZoom",
      "toggleModal",
    ]),
  },
};
</script>

<style scoped lang="scss">
@import "../vars.scss";

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

  > span {
    display: inline-block;
    cursor: pointer;
    z-index: 5;
    margin-top: 7px;
    margin-left: 10px;
  }

  span.nomlog-summary {
    color: $townsfolk;
  }

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

  > svg {
    cursor: pointer;
    background: linear-gradient(135deg, rgba(42, 26, 61, 0.95) 0%, rgba(26, 15, 40, 0.98) 100%);
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
    margin-top: 58px;
    flex-direction: column;
    overflow: hidden;
    background: 
      linear-gradient(135deg, rgba(42, 26, 61, 0.95) 0%, rgba(26, 15, 40, 0.98) 100%),
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
      content: '';
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
      background: rgba(26, 15, 40, 0.5);
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
        svg {
          flex-grow: 1;
          flex-shrink: 0;
          height: 35px;
          border-bottom: 2px solid rgba(212, 175, 55, 0.3);
          border-right: 2px solid rgba(212, 175, 55, 0.3);
          padding: 5px 0;
          cursor: pointer;
          transition: all 250ms ease;
          font-size: 1.2em;
          &:hover {
            color: rgba(212, 175, 55, 1);
            text-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
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
        background: rgba(42, 26, 61, 0.7);
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
      font-family: "Playfair Display", "Cinzel", serif;
      font-weight: 700;
      letter-spacing: 1.5px;
      padding: 5px 10px;
      font-style: italic;
      text-align: center;
      justify-content: center;
      font-size: 1.05em;
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
