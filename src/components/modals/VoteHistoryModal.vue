<template>
  <Modal
    class="vote-history"
    v-if="modals.voteHistory && (session.voteHistory || !session.isSpectator)"
    @close="toggleModal('voteHistory')"
  >
    <font-awesome-icon
      @click="clearVoteHistory"
      icon="trash-alt"
      class="clear"
      title="Clear vote history"
      v-if="session.isSpectator"
    />

    <h3>Vote history</h3>

    <template v-if="!session.isSpectator">
      <div class="options">
        <div class="option" @click="setRecordVoteHistory">
          <font-awesome-icon
            :icon="[
              'fas',
              session.isVoteHistoryAllowed ? 'check-square' : 'square',
            ]"
          />
          Accessible to players
        </div>
        <div class="option" @click="clearVoteHistory">
          <font-awesome-icon icon="trash-alt" />
          Clear for everyone
        </div>
      </div>
    </template>
    <table>
      <thead>
        <tr>
          <td>Time</td>
          <td>Nominator</td>
          <td>Nominee</td>
          <td>Type</td>
          <td>Votes</td>
          <td>Majority</td>
          <td>
            <font-awesome-icon icon="user-friends" />
            Voters
          </td>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(vote, index) in session.voteHistory" :key="index">
          <td>
            {{ vote.timestamp.getHours().toString().padStart(2, "0") }}:{{
              vote.timestamp.getMinutes().toString().padStart(2, "0")
            }}
          </td>
          <td>{{ vote.nominator }}</td>
          <td>{{ vote.nominee }}</td>
          <td>{{ vote.type }}</td>
          <td>
            {{ vote.votes.length }}
            <font-awesome-icon icon="hand-paper" />
          </td>
          <td>
            {{ vote.majority }}
            <font-awesome-icon
              :icon="[
                'fas',
                vote.votes.length >= vote.majority ? 'check-square' : 'square',
              ]"
            />
          </td>
          <td>
            {{ vote.votes.join(", ") }}
          </td>
        </tr>
      </tbody>
    </table>
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
    ...mapState(["session", "modals"]),
  },
  methods: {
    clearVoteHistory() {
      this.$store.commit("session/clearVoteHistory");
    },
    setRecordVoteHistory() {
      this.$store.commit(
        "session/setVoteHistoryAllowed",
        !this.session.isVoteHistoryAllowed,
      );

      if (this.session.isVoteHistoryAllowed) {
        // Enable vote watching if vote history is re-enabled.
        this.$store.commit("session/setVoteWatchingAllowed", true);
      }
    },
    ...mapMutations(["toggleModal"]),
  },
};
</script>

<style lang="scss" scoped>
.clear {
  position: absolute;
  left: 20px;
  top: 15px;
  cursor: pointer;
  color: rgba(212, 175, 55, 0.7);
  filter: drop-shadow(0 0 5px rgba(212, 175, 55, 0.3));
  transition: all 250ms ease;
  &:hover {
    color: rgba(212, 175, 55, 1);
    filter: drop-shadow(0 0 10px rgba(212, 175, 55, 0.5));
    transform: scale(1.1);
  }
}

.options {
  display: flex;
  justify-content: center;
  align-items: center;
  justify-content: center;
  align-content: center;
}

.option {
  color: #f5e6d3;
  text-decoration: none;
  margin: 0 15px;
  transition: all 250ms ease;
  &:hover {
    color: rgba(212, 175, 55, 1);
    text-shadow: 0 0 8px rgba(212, 175, 55, 0.4);
    cursor: pointer;
  }
}

h3 {
  margin: 0 40px 0 10px;
  svg {
    vertical-align: middle;
  }
}

table {
  border-spacing: 10px 0;
  margin-left: auto;
  margin-right: auto;
}

thead td {
  font-weight: bold;
  border-bottom: 1px solid white;
  text-align: center;
  padding: 0 3px;
}

tbody {
  td:nth-child(2) {
    color: $townsfolk;
  }
  td:nth-child(3) {
    color: $demon;
  }
  td:nth-child(5) {
    text-align: center;
  }
  td:nth-child(6) {
    text-align: center;
  }
}
</style>
