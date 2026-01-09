const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

const CURRENT_LEVEL = process.env.LOG_LEVEL 
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] 
  : (process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG);

// Timestamp caching - cache for 1 second to reduce CPU overhead
let cachedTimestamp = '';
let lastTimestampMs = 0;

function getTimestamp() {
  const now = Date.now();
  if (now - lastTimestampMs >= 1000) {
    cachedTimestamp = new Date(now).toISOString();
    lastTimestampMs = now;
  }
  return cachedTimestamp;
}

class Logger {
  debug(message, ...args) {
    if (CURRENT_LEVEL <= LOG_LEVELS.DEBUG) {
      console.log(`[DEBUG] ${getTimestamp()} ${message}`, ...args);
    }
  }

  info(message, ...args) {
    if (CURRENT_LEVEL <= LOG_LEVELS.INFO) {
      console.info(`[INFO] ${getTimestamp()} ${message}`, ...args);
    }
  }

  warn(message, ...args) {
    if (CURRENT_LEVEL <= LOG_LEVELS.WARN) {
      console.warn(`[WARN] ${getTimestamp()} ${message}`, ...args);
    }
  }

  error(message, ...args) {
    if (CURRENT_LEVEL <= LOG_LEVELS.ERROR) {
      console.error(`[ERROR] ${getTimestamp()} ${message}`, ...args);
    }
  }
}

export const logger = new Logger();
