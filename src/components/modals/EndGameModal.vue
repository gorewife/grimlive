<template>
  <Modal v-if="modals.endGame" @close="toggleModal('endGame')">
    <h3>📕 The Grimoire Closes</h3>
    <p>Which team emerged victorious?</p>
    <div class="winner-buttons">
      <button class="good-button" @click="selectWinner('Good')">
        <span
          class="team-icon"
          :style="{ backgroundImage: `url(${mayorIcon})` }"
        ></span>
        <span>⚖️ Good Wins</span>
      </button>
      <button class="evil-button" @click="selectWinner('Evil')">
        <span
          class="team-icon"
          :style="{ backgroundImage: `url(${impIcon})` }"
        ></span>
        <span>🩸 Evil Wins</span>
      </button>
    </div>
  </Modal>
</template>

<script>
import Modal from "./Modal";
import { iconImages } from "@/utils/images";
import { mapMutations, mapState } from "vuex";

export default {
  components: { Modal },
  computed: {
    ...mapState(["modals"]),
    mayorIcon() {
      return iconImages["../assets/icons/mayor.webp"];
    },
    impIcon() {
      return iconImages["../assets/icons/imp.webp"];
    },
  },
  methods: {
    async selectWinner(team) {
      this.$emit("winner-selected", team);
      this.toggleModal("endGame");
    },
    ...mapMutations(["toggleModal"]),
  },
};
</script>

<style scoped lang="scss">
@use "../../vars.scss" as *;

h3 {
  margin: 0 0 1em;
  text-align: center;
  font-size: 1.5em;
  color: $gold;
}

p {
  text-align: center;
  margin-bottom: 2em;
  font-size: 1.1em;
  color: rgba(255, 255, 255, 0.9);
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
  border: 2px solid rgba(0, 0, 0, 0.5);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: bold;
  background: rgba(0, 0, 0, 0.3);
  color: white;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.6);
  }

  &:active {
    transform: translateY(-2px);
  }
}

.good-button {
  border-color: rgba(103, 181, 255, 0.6);

  &:hover {
    background: rgba(74, 144, 226, 0.3);
    border-color: #67b5ff;
    box-shadow: 0 8px 20px rgba(74, 144, 226, 0.4);
  }
}

.evil-button {
  border-color: rgba(255, 103, 103, 0.6);

  &:hover {
    background: rgba(226, 74, 74, 0.3);
    border-color: #ff6767;
    box-shadow: 0 8px 20px rgba(226, 74, 74, 0.4);
  }
}

.team-icon {
  width: 5em;
  height: 5em;
  background-size: cover;
  background-position: center;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
}
</style>
