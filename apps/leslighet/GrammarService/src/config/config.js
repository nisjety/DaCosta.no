// src/config/config.js
/**
 * Configuration for the Grammar Service
 */

const config = {
  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    connectTimeout: 10000,
    retryStrategy: (times) => {
      return Math.min(times * 50, 2000);
    }
  },
  
  // Service configuration
  service: {
    name: 'grammar-service',
    version: '1.0.0',
  },

  // PubSub channels
  pubsub: {
    channels: {
      grammarAnalysis: 'grammar:analysis',
      grammarResults: 'grammar:results',
      notifications: 'grammar:notifications',
    }
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.NODE_ENV === 'production' ? 'json' : 'pretty',
  }
};

module.exports = { config };