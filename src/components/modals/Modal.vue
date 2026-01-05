<template>
  <transition name="modal-fade">
    <div class="modal-backdrop" @click="close">
      <div
        class="modal"
        :class="{ maximized: isMaximized }"
        role="dialog"
        aria-labelledby="modalTitle"
        aria-describedby="modalDescription"
        @click.stop=""
      >
        <div class="top-right-buttons">
          <font-awesome-icon
            @click="isMaximized = !isMaximized"
            class="top-right-button"
            :icon="['fas', isMaximized ? 'window-minimize' : 'window-maximize']"
          />
          <font-awesome-icon
            @click="close"
            class="top-right-button"
            icon="times-circle"
          />
        </div>
        <div class="slot">
          <slot></slot>
        </div>
      </div>
    </div>
  </transition>
</template>

<script>
export default {
  data: function () {
    return {
      isMaximized: false,
    };
  },
  methods: {
    close() {
      this.$emit("close");
    },
  },
};
</script>

<style lang="scss">
.modal-backdrop {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  background: radial-gradient(
    ellipse at center,
    rgba(42, 26, 61, 0.7) 0%,
    rgba(0, 0, 0, 0.85) 100%
  );
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
  animation: backdropFadeIn 0.3s ease;
}

@keyframes backdropFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal {
  background: linear-gradient(
    135deg,
    rgba(42, 26, 61, 0.95) 0%,
    rgba(26, 15, 40, 0.98) 100%
  );
  padding: 20px 30px;
  border-radius: 15px;
  border: 2px solid rgba(212, 175, 55, 0.3);
  box-shadow:
    0 0 40px rgba(123, 44, 191, 0.4),
    0 8px 32px rgba(0, 0, 0, 0.8),
    inset 0 0 60px rgba(139, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  max-height: 80%;
  max-width: 80%;
  position: relative;
  animation: modalSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);

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
      rgba(212, 175, 55, 0.5),
      transparent
    );
  }

  @keyframes modalSlideIn {
    from {
      transform: translateY(-20px) scale(0.95);
      opacity: 0;
    }
    to {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
  }

  @media (orientation: portrait) {
    max-width: 90%;
    max-height: 100%;
  }

  .vote-history &,
  .night-reference &,
  .characters & {
    overflow-y: auto;
  }

  .role & {
    max-height: 100%;
  }

  .roles &,
  .characters & {
    max-height: 100%;
    max-width: 60%;

    @media (orientation: portrait) {
      max-width: 90%;
    }
  }

  ul {
    list-style-type: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    align-content: center;
    align-items: center;
    justify-content: center;
    line-height: 100%;
  }

  > .top-right-buttons {
    position: absolute;
    z-index: 100;
    top: 15px;
    right: 20px;
    > .top-right-button {
      cursor: pointer;
      width: 28px;
      color: rgba(212, 175, 55, 0.6);
      filter: drop-shadow(0 0 8px rgba(212, 175, 55, 0.3));
      transition: all 250ms ease;
      &:hover {
        color: rgba(212, 175, 55, 1);
        filter: drop-shadow(0 0 15px rgba(212, 175, 55, 0.6));
        transform: scale(1.1);
      }
    }

    @media (orientation: portrait) {
      top: 15px;
      right: 5px;
      > .top-right-button {
        width: 25px;
        height: 15px;
      }
    }
  }

  > .slot {
    max-height: 100%;
    position: initial;

    @media (orientation: portrait) {
      ul.heading {
        grid-template-columns: min-content 1fr;
        justify-items: left;
      }
      h3 {
        text-align: left;
        text-wrap: wrap;
        padding-bottom: 5px;
        padding-right: 25px;
        font-size: 16px;
        line-height: 15px;
      }
    }
  }
}

.maximized {
  background: rgba(0, 0, 0, 0.95);
  padding: 0;
  border-radius: 0;
  height: 100%;
  width: 100%;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  align-content: center;
  justify-content: center;
  .roles &,
  .characters & {
    max-width: 100%;
    padding: 10px;
  }
  .role &,
  .roles & {
    overflow-y: auto;
    overflow-x: hidden;
  }
}

.modal-fade-enter-from,
.modal-fade-leave-active {
  opacity: 0;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
</style>
