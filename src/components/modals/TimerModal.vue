<template>
  <Modal
    v-if="modals.timer && !session.isSpectator"
    @close="toggleModal('timer')"
  >
    <h3>Set Timer</h3>
    <div class="timer-presets">
      <button
        v-for="preset in presets"
        :key="preset.value"
        @click="selectPreset(preset.value)"
        :class="{ active: duration === preset.value }"
        class="preset-button"
      >
        {{ preset.label }}
      </button>
    </div>

    <div class="custom-duration">
      <span class="custom-label">Custom Duration:</span>
      <div class="time-inputs">
        <label>
          <span>Minutes</span>
          <input
            type="number"
            v-model.number="customMinutes"
            min="0"
            max="180"
            @input="selectCustom"
            placeholder="0"
          />
        </label>
        <label>
          <span>Seconds</span>
          <input
            type="number"
            v-model.number="customSeconds"
            min="0"
            max="59"
            @input="selectCustom"
            placeholder="0"
          />
        </label>
      </div>
    </div>

    <div class="timer-display" v-if="duration > 0">
      <em>Timer will run for {{ formatDuration(duration) }}</em>
    </div>

    <div class="button-group">
      <button @click="startTimer" :disabled="duration === 0" class="start-button">
        <font-awesome-icon icon="play" />
        Start Timer
      </button>
      <button @click="toggleModal('timer')" class="cancel-button">
        Cancel
      </button>
    </div>

    <div class="timer-info">
      <p>
        <font-awesome-icon icon="bell" />
        When the timer ends, a bell will sound and all players will be called to the town square.
      </p>
    </div>
  </Modal>
</template>

<script>
import Modal from "./Modal.vue";
import { mapMutations, mapState } from "vuex";

export default {
  components: {
    Modal,
  },
  data() {
    return {
      duration: 0, // duration in seconds
      customMinutes: 0,
      customSeconds: 0,
      presets: [
        { label: "1 min", value: 1 * 60 },
        { label: "3 min", value: 3 * 60 },
        { label: "5 min", value: 5 * 60 },
        { label: "7 min", value: 7 * 60 },
      ],
    };
  },
  computed: {
    ...mapState(["modals", "session"]),
  },
  methods: {
    ...mapMutations(["toggleModal"]),
    selectPreset(seconds) {
      this.duration = seconds;
      this.customMinutes = 0;
      this.customSeconds = 0;
    },
    selectCustom() {
      const minutes = Math.max(0, Math.min(180, this.customMinutes || 0));
      const seconds = Math.max(0, Math.min(59, this.customSeconds || 0));
      this.duration = minutes * 60 + seconds;
    },
    formatDuration(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      if (secs === 0) {
        return `${mins} minute${mins !== 1 ? "s" : ""}`;
      }
      return `${mins}m ${secs}s`;
    },
    startTimer() {
      if (this.duration === 0) return;

      const endTime = Date.now() + this.duration * 1000;
      
      this.$store.commit("session/startTimer", {
        duration: this.duration,
        endTime: endTime,
        startedBy: this.$store.state.session.playerId,
      });

      this.$store.state.grimoire.sendTimer({
        action: "start",
        duration: this.duration,
        endTime: endTime,
        startedBy: this.$store.state.session.playerId,
      });

      this.toggleModal("timer");
      
      this.duration = 0;
      this.customMinutes = 0;
      this.customSeconds = 0;
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../vars.scss";

h3 {
  margin: 0 0 24px;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1.5em;
  color: rgba(220, 220, 220, 0.95);
  text-align: center;
  letter-spacing: 0.8px;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.2), 0 2px 4px rgba(0, 0, 0, 0.8);
  font-weight: 400;
  position: relative;
  padding-bottom: 12px;

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 60%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  }
}

.timer-presets {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.preset-button {
  padding: 14px 20px;
  background: linear-gradient(135deg, rgba(20, 20, 20, 0.9) 0%, rgba(30, 30, 30, 0.95) 100%);
  border: 2px solid rgba(100, 100, 100, 0.4);
  border-radius: 8px;
  color: rgba(220, 220, 220, 0.9);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 1.05em;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
    transition: left 0.5s ease;
  }

  &:hover::before {
    left: 100%;
  }

  &:hover {
    background: linear-gradient(135deg, rgba(35, 35, 35, 0.95) 0%, rgba(45, 45, 45, 0.98) 100%);
    border-color: rgba(150, 150, 150, 0.6);
    box-shadow: 0 0 20px rgba(255, 255, 255, 0.15), inset 0 0 20px rgba(50, 50, 50, 0.3);
    transform: translateY(-2px);
  }

  &.active {
    background: linear-gradient(135deg, rgba(50, 50, 50, 0.95) 0%, rgba(60, 60, 60, 0.98) 100%);
    border-color: rgba(180, 180, 180, 0.7);
    box-shadow: 0 0 25px rgba(255, 255, 255, 0.25), inset 0 0 20px rgba(70, 70, 70, 0.4);
    color: rgba(240, 240, 240, 1);
  }

  &:active {
    transform: translateY(0);
  }
}

.custom-duration {
  margin-bottom: 20px;

  .custom-label {
    display: block;
    color: rgba(180, 180, 180, 0.85);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 0.9em;
    letter-spacing: 0.3px;
    margin-bottom: 10px;
  }

  .time-inputs {
    display: flex;
    gap: 12px;
  }

  label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;

    span {
      color: rgba(180, 180, 180, 0.85);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 0.85em;
      letter-spacing: 0.3px;
      text-align: center;
    }

    input {
      padding: 12px 16px;
      background: rgba(20, 20, 20, 0.9);
      border: 2px solid rgba(80, 80, 80, 0.5);
      border-radius: 8px;
      color: rgba(220, 220, 220, 0.95);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 1em;
      transition: all 0.25s ease;

      &:focus {
        outline: none;
        border-color: rgba(150, 150, 150, 0.7);
        box-shadow: 0 0 15px rgba(255, 255, 255, 0.15), inset 0 0 10px rgba(40, 40, 40, 0.5);
        background: rgba(25, 25, 25, 0.95);
      }

      &::placeholder {
        color: rgba(180, 180, 180, 0.4);
      }
    }
  }
}

.timer-display {
  text-align: center;
  margin-bottom: 20px;
  padding: 14px;
  background: linear-gradient(135deg, rgba(30, 30, 30, 0.7) 0%, rgba(40, 40, 40, 0.6) 100%);
  border: 1px solid rgba(100, 100, 100, 0.4);
  border-radius: 8px;
  box-shadow: inset 0 0 15px rgba(10, 10, 10, 0.5);

  em {
    color: rgba(200, 200, 200, 0.95);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 1.1em;
    font-style: normal;
    letter-spacing: 0.3px;
  }
}

.button-group {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;

  button {
    flex: 1;
    padding: 14px 24px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 1em;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.25s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    position: relative;
    overflow: hidden;

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      filter: grayscale(0.5);
    }
  }

  .start-button {
    background: linear-gradient(135deg, rgba(50, 50, 50, 0.9) 0%, rgba(70, 70, 70, 0.95) 100%);
    border: 2px solid rgba(120, 120, 120, 0.6);
    color: rgba(230, 230, 230, 0.95);

    &:hover:not(:disabled) {
      border-color: rgba(160, 160, 160, 0.8);
      box-shadow: 0 0 25px rgba(255, 255, 255, 0.2), inset 0 0 20px rgba(80, 80, 80, 0.5);
      transform: translateY(-2px);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }
  }

  .cancel-button {
    background: linear-gradient(135deg, rgba(25, 25, 25, 0.9) 0%, rgba(35, 35, 35, 0.95) 100%);
    border: 2px solid rgba(80, 80, 80, 0.5);
    color: rgba(200, 200, 200, 0.85);

    &:hover {
      border-color: rgba(120, 120, 120, 0.6);
      box-shadow: 0 0 20px rgba(255, 255, 255, 0.15), inset 0 0 15px rgba(40, 40, 40, 0.5);
      transform: translateY(-2px);
    }

    &:active {
      transform: translateY(0);
    }
  }
}

.timer-info {
  padding: 16px;
  background: linear-gradient(135deg, rgba(30, 30, 30, 0.6) 0%, rgba(40, 40, 40, 0.7) 100%);
  border: 1px solid rgba(80, 80, 80, 0.4);
  border-radius: 8px;
  box-shadow: inset 0 0 15px rgba(10, 10, 10, 0.5);

  p {
    margin: 0;
    color: rgba(200, 200, 200, 0.85);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 0.9em;
    line-height: 1.6;
    display: flex;
    align-items: center;
    gap: 12px;

    svg {
      color: rgba(180, 180, 180, 0.8);
      font-size: 1.1em;
      flex-shrink: 0;
    }
  }
}
</style>
