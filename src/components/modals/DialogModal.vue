<template>
  <teleport to="body">
    <transition name="blur">
      <div class="dialog-backdrop" v-if="visible" @click="handleBackdropClick">
      <div class="dialog-box">
        <h3 v-if="title">{{ title }}</h3>
        <p>{{ message }}</p>
        <input
          v-if="type === 'prompt'"
          ref="input"
          v-model="inputValue"
          type="text"
          @keyup.enter="handleConfirm"
          @keyup.esc="handleCancel"
        />
        <div class="button-group">
          <button v-if="type !== 'alert'" @click="handleCancel">Cancel</button>
          <button @click="handleConfirm" class="primary">OK</button>
        </div>
      </div>
    </div>
    </transition>
  </teleport>
</template>

<script>
export default {
  name: "DialogModal",
  data() {
    return {
      visible: false,
      type: "alert",
      title: "",
      message: "",
      inputValue: "",
      resolve: null
    };
  },
  methods: {
    show(type, message, defaultValue = "", title = "") {
      this.type = type;
      this.message = message;
      this.title = title;
      this.inputValue = defaultValue;
      this.visible = true;
      
      if (type === "prompt") {
        this.$nextTick(() => {
          if (this.$refs.input) {
            this.$refs.input.focus();
            this.$refs.input.select();
          }
        });
      }
      
      return new Promise(resolve => {
        this.resolve = resolve;
      });
    },
    handleConfirm() {
      this.visible = false;
      if (this.resolve) {
        if (this.type === "prompt") {
          this.resolve(this.inputValue);
        } else if (this.type === "confirm") {
          this.resolve(true);
        } else {
          this.resolve();
        }
      }
    },
    handleCancel() {
      this.visible = false;
      if (this.resolve) {
        this.resolve(this.type === "prompt" ? null : false);
      }
    },
    handleBackdropClick(e) {
      if (e.target === e.currentTarget) {
        this.handleCancel();
      }
    }
  }
};
</script>

<style scoped lang="scss">
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  overflow: auto;
}

.dialog-box {
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.9) 100%);
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  padding: 20px 30px;
  min-width: 300px;
  max-width: 500px;
  box-shadow: 0 10px 50px rgba(0, 0, 0, 0.5);
  
  h3 {
    margin: 0 0 15px 0;
    color: #fff;
    font-size: 1.3em;
    text-shadow: 0 0 5px rgba(255, 255, 255, 0.3);
  }
  
  p {
    margin: 0 0 15px 0;
    color: rgba(255, 255, 255, 0.9);
    font-size: 1.1em;
    line-height: 1.5;
    white-space: pre-line;
  }
  
  input {
    width: 100%;
    padding: 10px;
    margin-bottom: 15px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    font-size: 1em;
    box-sizing: border-box;
    
    &:focus {
      outline: none;
      border-color: #c33;
      background: rgba(255, 255, 255, 0.15);
    }
  }
}

.button-group {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  
  button {
    padding: 10px 20px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    font-size: 1em;
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.5);
    }
    
    &.primary {
      background: linear-gradient(180deg, #c33, #a22);
      border-color: #c33;
      
      &:hover {
        background: linear-gradient(180deg, #d44, #b33);
      }
    }
  }
}

.blur-enter-active,
.blur-leave-active {
  transition: opacity 0.2s;
  
  .dialog-box {
    transition: transform 0.2s, opacity 0.2s;
  }
}

.blur-enter-from,
.blur-leave-to {
  opacity: 0;
  
  .dialog-box {
    transform: scale(0.9);
    opacity: 0;
  }
}
</style>
