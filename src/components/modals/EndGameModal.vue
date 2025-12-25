<template>
  <Modal v-if="modals.endGame" @close="toggleModal('endGame')">
    <h3>End Game</h3>
    <p>Select the winning team:</p>
    <div class="winner-buttons">
      <button class="good-button" @click="selectWinner('Good')">
        <span class="team-icon good">👼</span>
        <span>Good Wins</span>
      </button>
      <button class="evil-button" @click="selectWinner('Evil')">
        <span class="team-icon evil">😈</span>
        <span>Evil Wins</span>
      </button>
    </div>
  </Modal>
</template>

<script>
import Modal from "./Modal";
import { mapMutations, mapState } from "vuex";

export default {
  components: { Modal },
  computed: {
    ...mapState(["modals"]),
  },
  methods: {
    async selectWinner(team) {
      this.$emit('winner-selected', team);
      this.toggleModal('endGame');
    },
    ...mapMutations(["toggleModal"]),
  },
};
</script>

<style scoped lang="scss">
h3 {
  margin: 0 0 1em;
  text-align: center;
  font-size: 1.5em;
}

p {
  text-align: center;
  margin-bottom: 2em;
  font-size: 1.1em;
}

.winner-buttons {
  display: flex;
  gap: 2em;
  justify-content: center;
  padding: 1em 0;
}

button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1em;
  padding: 2em 3em;
  font-size: 1.2em;
  border: 3px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: bold;
  
  &:hover {
    transform: scale(1.1);
  }
  
  &:active {
    transform: scale(0.95);
  }
}

.good-button {
  background: linear-gradient(135deg, #4a90e2 0%, #67b5ff 100%);
  color: white;
  
  &:hover {
    border-color: #2e6fb8;
    box-shadow: 0 0 20px rgba(74, 144, 226, 0.5);
  }
}

.evil-button {
  background: linear-gradient(135deg, #e24a4a 0%, #ff6767 100%);
  color: white;
  
  &:hover {
    border-color: #b82e2e;
    box-shadow: 0 0 20px rgba(226, 74, 74, 0.5);
  }
}

.team-icon {
  font-size: 3em;
  line-height: 1;
}
</style>
