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

class Logger {
  debug(message, ...args) {
    if (CURRENT_LEVEL <= LOG_LEVELS.DEBUG) {
      console.log(`[DEBUG] ${new Date().toISOString()} ${message}`, ...args);
    }
  }

  info(message, ...args) {
    if (CURRENT_LEVEL <= LOG_LEVELS.INFO) {
      console.info(`[INFO] ${new Date().toISOString()} ${message}`, ...args);
    }
  }

  warn(message, ...args) {
    if (CURRENT_LEVEL <= LOG_LEVELS.WARN) {
      console.warn(`[WARN] ${new Date().toISOString()} ${message}`, ...args);
    }
  }

  error(message, ...args) {
    if (CURRENT_LEVEL <= LOG_LEVELS.ERROR) {
      console.error(`[ERROR] ${new Date().toISOString()} ${message}`, ...args);
    }
  }
}

export const logger = new Logger();
