const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4,
};

const CURRENT_LEVEL = import.meta.env.VITE_LOG_LEVEL
  ? LOG_LEVELS[import.meta.env.VITE_LOG_LEVEL.toUpperCase()]
  : import.meta.env.PROD
    ? LOG_LEVELS.ERROR
    : LOG_LEVELS.DEBUG;

class Logger {
  debug(message, ...args) {
    if (CURRENT_LEVEL <= LOG_LEVELS.DEBUG) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message, ...args) {
    if (CURRENT_LEVEL <= LOG_LEVELS.INFO) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  warn(message, ...args) {
    if (CURRENT_LEVEL <= LOG_LEVELS.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message, ...args) {
    if (CURRENT_LEVEL <= LOG_LEVELS.ERROR) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
}

export const logger = new Logger();
