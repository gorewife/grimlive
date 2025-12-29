<template>
  <Modal
    class="game-state"
    v-if="modals.gameState"
    @close="toggleModal('gameState')"
  >
    <h3>Current Game State</h3>
    <textarea
      :value="gamestate"
      @input.stop="input = $event.target.value"
      @click="$event.target.select()"
      @keyup.stop=""
    ></textarea>
    <div class="button-group">
      <div class="button townsfolk" @click="copy">
        <font-awesome-icon icon="copy" /> Copy JSON
      </div>
      <div class="button demon" @click="load" v-if="!session.isSpectator">
        <font-awesome-icon icon="cog" /> Load State
      </div>
    </div>
  </Modal>
</template>

<script>
import Modal from "./Modal";
import { mapMutations, mapState } from "vuex";

export default {
  components: {
    Modal,
  },
  computed: {
    gamestate: function () {
      return JSON.stringify({
        bluffs: this.players.bluffs.map(({ id }) => id),
        edition: this.edition.isOfficial
          ? { id: this.edition.id }
          : this.edition,
        roles: this.edition.isOfficial
          ? ""
          : this.$store.getters.customRolesStripped,
        npcs: this.players.npcs.map((npc) =>
          npc.isCustom ? npc : { id: npc.id },
        ),
        players: this.players.players.map((player) => ({
          ...player,
          role: player.role.id || {},
        })),
      });
    },
    ...mapState(["modals", "players", "edition", "roles", "session"]),
  },
  data() {
    return {
      input: "",
    };
  },
  methods: {
    copy: function () {
      navigator.clipboard.writeText(this.input || this.gamestate);
    },
    load: function () {
      if (this.session.isSpectator) return;
      try {
        const data = JSON.parse(this.input || this.gamestate);
        const { bluffs, edition, roles, npcs, players } = data;
        if (roles) {
          this.$store.commit("setCustomRoles", roles);
        }
        if (edition) {
          this.$store.commit("setEdition", edition);
        }
        if (bluffs.length) {
          bluffs.forEach((role, index) => {
            this.$store.commit("players/setBluff", {
              index,
              role: this.$store.state.roles.get(role) || {},
            });
          });
        }
        if (npcs) {
          this.$store.commit("players/setNpcs", {
            npcs: npcs.map(
              (f) =>
                this.$store.state.npcs.get(f) ||
                this.$store.state.npcs.get(f.id) ||
                f,
            ),
          });
        }
        if (players) {
          this.$store.commit(
            "players/set",
            players.map((player) => ({
              ...player,
              role:
                this.$store.state.roles.get(player.role) ||
                this.$store.getters.rolesJSONbyId.get(player.role) ||
                {},
            })),
          );
        }
        this.toggleModal("gameState");
      } catch (e) {
        alert("Unable to parse JSON: " + e);
      }
    },
    ...mapMutations(["toggleModal"]),
  },
};
</script>

<style lang="scss" scoped>

h3 {
  text-align: center;
  margin: 0 40px;
}

textarea {
  background: transparent;
  color: white;
  white-space: pre-wrap;
  word-break: break-all;
  border: 1px solid rgba(255, 255, 255, 0.5);
  width: 60vw;
  height: 30vh;
  max-width: 100%;
  margin: 5px 0;
}
</style>
