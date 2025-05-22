// src/utils/logger.js
const winston = require('winston');
const { createLogger, format, transports } = winston;

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
});

// Ensure all logging methods exist
if (!logger.debug) {
  logger.debug = logger.info;
}

module.exports = logger;