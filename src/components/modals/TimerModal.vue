<template>
  <Modal
    v-if="modals.timer && !session.isSpectator"
    @close="toggleModal('timer')"
  >
    <h3>Timer</h3>

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
      <span class="custom-label">Custom Duration</span>
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

    <div class="button-group">
      <button
        @click="startTimer"
        :disabled="duration === 0"
        class="start-button"
      >
        <font-awesome-icon icon="play" />
        Begin
      </button>
      <button @click="toggleModal('timer')" class="cancel-button">
        Cancel
      </button>
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
        { label: "3:00", value: 3 * 60 },
        { label: "3:30", value: 3 * 60 + 30 },
        { label: "4:00", value: 4 * 60 },
        { label: "5:00", value: 5 * 60 },
      ],
    };
  },
  computed: {
    ...mapState(["modals", "session"]),
    ...mapState("stats", {
      sessionCode: (state) => state.sessionCode,
    }),
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
    async startTimer() {
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

      // Send timer announcement to Discord if session is linked
      if (this.sessionCode) {
        try {
          const baseUrl = import.meta.env.PROD
            ? "https://api.hystericca.dev"
            : "http://localhost:8001";

          await fetch(`${baseUrl}/api/timerAnnounce`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionCode: this.sessionCode,
              duration: this.duration,
            }),
          });
        } catch (error) {
          console.error("Failed to announce timer:", error);
        }
      }

      this.toggleModal("timer");

      this.duration = 0;
      this.customMinutes = 0;
      this.customSeconds = 0;
    },
  },
};
</script>

<style scoped lang="scss">
@use "../../vars.scss" as *;

h3 {
  margin: 0 0 0.5em;
  text-align: center;
  font-size: 1.8em;
  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

.timer-description {
  text-align: center;
  margin: 0 0 2em;
  font-size: 1.1em;
  color: white;
  font-style: italic;
}

.timer-presets {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px;
  margin-bottom: 2em;
}

.preset-button {
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.3);
  border: 2px solid rgba(212, 175, 55, 0.3);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 1em;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.5);
    transform: translateY(-2px);
  }

  &.active {
    background: rgba(255, 255, 255, 0.25);
    border-color: white;
    color: white;
  }

  &:active {
    transform: translateY(0);
  }
}

.custom-duration {
  margin-bottom: 2em;
  padding: 1.5em;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3);
}

.custom-label {
  display: block;
  margin-bottom: 1em;
  color: white;
  font-size: 1.1em;
  font-weight: 600;
  text-align: center;
}

.time-inputs {
  display: flex;
  gap: 20px;
  justify-content: center;

  label {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;

    span {
      color: rgba(255, 255, 255, 0.8);
      font-size: 0.9em;
      font-weight: 500;
    }

    input {
      width: 80px;
      padding: 10px;
      background: rgba(0, 0, 0, 0.4);
      border: 2px solid rgba(212, 175, 55, 0.3);
      border-radius: 6px;
      color: white;
      font-size: 1.1em;
      text-align: center;
      transition: all 0.25s ease;

      /* Hide number input arrows */
      appearance: textfield;
      &::-webkit-outer-spin-button,
      &::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }

      &:focus {
        outline: none;
        border-color: white;
      }

      &::placeholder {
        color: rgba(255, 255, 255, 0.3);
      }
    }
  }
}

.timer-display {
  text-align: center;
  margin-bottom: 2em;
  padding: 1em;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;

  em {
    color: white;
    font-size: 1.2em;
    font-weight: 600;
    font-style: normal;
  }
}

.button-group {
  display: flex;
  gap: 1em;
  margin-bottom: 1.5em;

  button {
    flex: 1;
    padding: 14px 24px;
    border-radius: 8px;
    font-size: 1.1em;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.25s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      filter: grayscale(0.5);
    }
  }

  .start-button {
    background: rgba(255, 255, 255, 0.2);
    border: 2px solid white;
    color: white;

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.3);
      box-shadow:
        0 0 20px rgba(255, 255, 255, 0.4),
        0 6px 15px rgba(0, 0, 0, 0.5);
      transform: translateY(-2px);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }
  }

  .cancel-button {
    background: rgba(0, 0, 0, 0.3);
    border: 2px solid rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.7);

    &:hover {
      background: rgba(0, 0, 0, 0.4);
      border-color: rgba(255, 255, 255, 0.3);
      transform: translateY(-2px);
    }

    &:active {
      transform: translateY(0);
    }
  }
}

</style>
