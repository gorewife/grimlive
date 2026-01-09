<template>
  <transition name="timer">
    <div v-if="session.timer.isActive" class="timer-display">
      <div class="timer-content">
        <div class="timer-icon">
          <font-awesome-icon icon="hourglass-half" />
        </div>
        <div class="timer-text">
          <div class="time-remaining">{{ formattedTime }}</div>
          <div class="timer-label">Time Remaining</div>
        </div>
        <div v-if="!session.isSpectator" class="timer-controls">
          <button @click="stopTimer" class="stop-button" title="Stop Timer">
            <font-awesome-icon icon="times" />
          </button>
        </div>
      </div>
      <div class="timer-progress">
        <div
          class="progress-bar"
          :style="{ width: progressPercent + '%' }"
        ></div>
      </div>
    </div>
  </transition>
</template>

<script>
import { mapState } from "vuex";

export default {
  data() {
    return {
      now: Date.now(),
      intervalId: null,
    };
  },
  computed: {
    ...mapState(["session"]),
    remainingSeconds() {
      if (!this.session.timer.isActive) {
        return 0;
      }
      if (!this.session.timer.endTime) {
        return 0;
      }
      const remaining = Math.max(
        0,
        Math.floor((this.session.timer.endTime - this.now) / 1000),
      );
      return remaining;
    },
    formattedTime() {
      const minutes = Math.floor(this.remainingSeconds / 60);
      const seconds = this.remainingSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    },
    progressPercent() {
      if (!this.session.timer.duration || this.session.timer.duration === 0) {
        return 0;
      }
      const elapsed = this.session.timer.duration - this.remainingSeconds;
      return Math.min(100, (elapsed / this.session.timer.duration) * 100);
    },
  },
  methods: {
    async stopTimer() {
      if (confirm("Stop the timer?")) {
        this.$store.commit("session/stopTimer");
        this.$store.state.grimoire.sendTimer({
          action: "stop",
        });

        // Cancel timer in Discord bot if session is linked
        const sessionCode = this.$store.state.stats.sessionCode;
        if (sessionCode) {
          try {
            const baseUrl = import.meta.env.PROD
              ? "https://api.hystericca.dev"
              : "http://localhost:8001";

            await fetch(`${baseUrl}/api/timerCancel`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                sessionCode: sessionCode,
              }),
            });
          } catch (error) {
            console.error("Failed to cancel timer:", error);
          }
        }
      }
    },

    updateNow() {
      this.now = Date.now();

      // Check if timer has expired
      if (
        this.remainingSeconds === 0 &&
        this.session.timer.isActive
      ) {
        this.handleTimerComplete();
      }
    },
    handleTimerComplete() {
      // Play bell sound at 80% volume
      const audio = new Audio(
        new URL("@/assets/sounds/countdown.mp3", import.meta.url).href,
      );
      audio.volume = 0.8;
      audio.play();

      // Stop the timer
      this.$store.commit("session/stopTimer");

      // Notify other clients (bot handles town square logic if connected)
      this.$store.state.grimoire.sendTimer({
        action: "complete",
      });
    },
  },
  watch: {
    "session.timer.isActive"(newVal) {
      if (newVal) {
        // Start updating the clock
        this.now = Date.now();
        this.intervalId = setInterval(this.updateNow, 100); // Update every 100ms for smooth countdown
      } else {
        // Stop updating the clock
        if (this.intervalId) {
          clearInterval(this.intervalId);
          this.intervalId = null;
        }
      }
    },
  },
  mounted() {
    // If timer is already active on mount, start the interval
    if (this.session.timer.isActive) {
      this.now = Date.now();
      this.intervalId = setInterval(this.updateNow, 100);
    }
  },
  beforeUnmount() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  },
};
</script>

<style scoped lang="scss">
@use "../vars.scss" as *;

.timer-display {
  position: fixed;
  top: 80px;
  right: 20px;
  min-width: 280px;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.7) 0%,
    rgba(26, 15, 40, 0.9) 100%
  );
  backdrop-filter: blur(6px);
  border: 3px solid rgba(212, 175, 55, 0.5);
  border-radius: 12px;
  box-shadow:
    0 0 30px rgba(0, 0, 0, 0.8),
    0 10px 30px rgba(0, 0, 0, 0.7);
  z-index: 75;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(212, 175, 55, 0.4),
      transparent
    );
  }
}

.timer-content {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
}

.timer-icon {
  font-size: 36px;
  color: $gold;
  animation: pulse 2s ease-in-out infinite;
  filter: drop-shadow(0 0 8px rgba(212, 175, 55, 0.4));
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.75;
  }
}

.timer-text {
  flex: 1;
  text-align: left;
}

.time-remaining {
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 2.2em;
  font-weight: 600;
  color: $gold;
  text-shadow:
    0 0 15px rgba(212, 175, 55, 0.5),
    0 2px 6px rgba(0, 0, 0, 0.8);
  line-height: 1;
  margin-bottom: 4px;
  letter-spacing: 0.5px;
}

.timer-label {
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 0.75em;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 1px;
  opacity: 0.9;
  font-weight: 500;
}

.timer-controls {
  display: flex;
  gap: 8px;
}

.stop-button {
  width: 40px;
  height: 40px;
  background: rgba(0, 0, 0, 0.3);
  border: 2px solid rgba(212, 175, 55, 0.4);
  border-radius: 50%;
  color: $gold;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.25s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(212, 175, 55, 0.15);
    border-color: $gold;
    transform: scale(1.1);
  }

  &:active {
    transform: scale(0.95);
  }
}

.timer-progress {
  height: 4px;
  background: rgba(0, 0, 0, 0.6);
  position: relative;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(
    90deg,
    rgba(212, 175, 55, 0.7) 0%,
    $gold 100%
  );
  transition: width 0.1s linear;
  box-shadow: 0 0 8px rgba(212, 175, 55, 0.5);
}

// Transition animations
.timer-enter-active {
  animation: timerSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.timer-leave-active {
  animation: timerSlideOut 0.4s cubic-bezier(0.6, 0, 0.8, 0.4);
}

@keyframes timerSlideIn {
  from {
    opacity: 0;
    transform: translateX(100%) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes timerSlideOut {
  from {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateX(100%) scale(0.9);
  }
}
</style>
