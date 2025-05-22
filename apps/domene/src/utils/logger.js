// src/utils/logger.js
// Logger utility for consistent logging

const { config } = require('../config/config');

// Define log levels
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

// Get numeric value for configured log level
const configuredLevel = LOG_LEVELS[config.app.logLevel.toLowerCase()] || LOG_LEVELS.info;

/**
 * Simple logger utility that respects configured log level
 */
const logger = {
  /**
   * Log error message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  error: (message, ...args) => {
    if (configuredLevel >= LOG_LEVELS.error) {
      console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args);
    }
  },

  /**
   * Log warning message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  warn: (message, ...args) => {
    if (configuredLevel >= LOG_LEVELS.warn) {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
    }
  },

  /**
   * Log info message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  info: (message, ...args) => {
    if (configuredLevel >= LOG_LEVELS.info) {
      console.info(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
    }
  },

  /**
   * Log debug message (only in debug mode)
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  debug: (message, ...args) => {
    if (configuredLevel >= LOG_LEVELS.debug) {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
    }
  }
};

module.exports = logger;