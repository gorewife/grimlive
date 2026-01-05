<template>
  <div class="error-boundary">
    <slot v-if="!hasError"></slot>
    <div v-else class="error-fallback" role="alert" aria-live="assertive">
      <h2>{{ fallbackTitle }}</h2>
      <p>{{ fallbackMessage }}</p>
      <button
        @click="resetError"
        class="retry-button"
        aria-label="Retry after error"
      >
        <font-awesome-icon icon="redo-alt" />
        Try Again
      </button>
      <details v-if="errorDetails">
        <summary>Error Details</summary>
        <pre>{{ errorDetails }}</pre>
      </details>
    </div>
  </div>
</template>

<script>
export default {
  name: "ErrorBoundary",
  props: {
    fallbackTitle: {
      type: String,
      default: "Something went wrong",
    },
    fallbackMessage: {
      type: String,
      default:
        "An error occurred while rendering this component. Please try again.",
    },
    onError: {
      type: Function,
      default: null,
    },
  },
  data() {
    return {
      hasError: false,
      errorDetails: null,
    };
  },
  errorCaptured(err, instance, info) {
    this.hasError = true;
    this.errorDetails = `${err.message}\n\nComponent: ${instance?.$options.name || "Unknown"}\nInfo: ${info}`;

    // Log to console for debugging
    console.error("ErrorBoundary caught error:", {
      error: err,
      instance,
      info,
    });

    // Call custom error handler if provided
    if (this.onError) {
      this.onError(err, instance, info);
    }

    // Prevent error from propagating
    return false;
  },
  methods: {
    resetError() {
      this.hasError = false;
      this.errorDetails = null;
    },
  },
};
</script>

<style lang="scss" scoped>
.error-boundary {
  width: 100%;
  height: 100%;
}

.error-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: rgba(139, 0, 0, 0.1);
  border: 2px solid $crimson;
  border-radius: 10px;
  margin: 1rem;

  h2 {
    color: $crimson;
    margin-bottom: 1rem;
    font-size: 1.5rem;
  }

  p {
    color: $parchment;
    margin-bottom: 1.5rem;
    text-align: center;
    max-width: 600px;
  }

  .retry-button {
    background: $crimson;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 5px;
    cursor: pointer;
    font-size: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s ease;

    &:hover {
      background: color.adjust($crimson, $lightness: 10%);
      transform: translateY(-2px);
    }

    &:active {
      transform: translateY(0);
    }

    &:focus {
      outline: 3px solid $gold;
      outline-offset: 2px;
    }
  }

  details {
    margin-top: 1rem;
    width: 100%;
    max-width: 800px;

    summary {
      cursor: pointer;
      color: $gold;
      padding: 0.5rem;

      &:hover {
        text-decoration: underline;
      }

      &:focus {
        outline: 2px solid $gold;
        outline-offset: 2px;
      }
    }

    pre {
      background: rgba(0, 0, 0, 0.3);
      padding: 1rem;
      border-radius: 5px;
      overflow: auto;
      color: $parchment;
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }
  }
}
</style>
