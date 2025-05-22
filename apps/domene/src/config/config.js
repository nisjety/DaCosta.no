// src/config/config.js
// Configuration loader with defaults and Docker support

const path = require('path');
require('dotenv').config();

/**
 * Get configuration with fallbacks to defaults
 */
const config = {
  // General app settings
  app: {
    env: process.env.NODE_ENV || 'development',
    dataDir: process.env.DATA_DIR || path.join(process.cwd(), 'data'),
    logLevel: process.env.LOG_LEVEL || 'info',
    debug: process.env.DEBUG_MODE === 'true',
    port: parseInt(process.env.PORT || '3001', 10),
    wsPort: parseInt(process.env.WS_PORT || '3002', 10),
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*']
  },
  
  // Monitoring settings
  monitoring: {
    schedule: process.env.MONITORING_SCHEDULE || '0 * * * *', // Default: hourly
    interval: parseInt(process.env.MONITORING_INTERVAL || '60', 10), // Minutes
    retryCount: parseInt(process.env.RETRY_COUNT || '3', 10),
    retryDelay: parseInt(process.env.RETRY_DELAY || '5000', 10) // ms
  },
  
  // Domain repository settings
  repository: {
    type: process.env.REPOSITORY_TYPE || 'json', // 'json' or 'mongodb'
    filePath: process.env.REPOSITORY_FILE || path.join(process.cwd(), 'data', 'domains.json')
  },
  
  // MongoDB settings (if using MongoDB repository)
  mongodb: {
    connectionString: process.env.MONGO_CONNECTION_STRING || 'mongodb://admin:password@mongo:27017/domain_monitor?authSource=admin',
    database: process.env.MONGO_DATABASE || 'domain_monitor',
    collection: process.env.MONGO_COLLECTION || 'domains'
  },
  
  // Redis cache settings
  redis: {
    enabled: process.env.REDIS_ENABLED !== 'false',
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'domain-monitor:'
  },
  
  // Twilio SMS settings
  twilio: {
    enabled: process.env.TWILIO_ENABLED !== 'false',
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_PHONE_NUMBER,
    toNumbers: process.env.RECIPIENT_PHONE_NUMBER 
      ? process.env.RECIPIENT_PHONE_NUMBER.split(',').map(num => num.trim())
      : []
  },
  
  // HTTP settings for website status checks
  http: {
    timeout: parseInt(process.env.HTTP_TIMEOUT || '5000', 10), // ms
    userAgent: process.env.HTTP_USER_AGENT || 'DomainMonitor/1.0',
    followRedirects: process.env.HTTP_FOLLOW_REDIRECTS !== 'false'
  },
  
  // WHOIS settings
  whois: {
    timeout: parseInt(process.env.WHOIS_TIMEOUT || '10000', 10), // ms
    follow: parseInt(process.env.WHOIS_FOLLOW || '3', 10),
    apiEnabled: process.env.WHOIS_API_ENABLED === 'true',
    apiKey: process.env.WHOIS_API_KEY || '',
    apiUrl: process.env.WHOIS_API_URL || 'https://www.whoisxmlapi.com/whoisserver/WhoisService',
    retryCount: parseInt(process.env.WHOIS_RETRY_COUNT || '3', 10),
    retryDelay: parseInt(process.env.WHOIS_RETRY_DELAY || '5000', 10)
  }
};

/**
 * Validate critical configuration
 */
function validateConfig() {
  const errors = [];
  
  // Check SMS settings if enabled
  if (config.twilio.enabled) {
    if (!config.twilio.accountSid) errors.push('TWILIO_ACCOUNT_SID is required when Twilio is enabled');
    if (!config.twilio.authToken) errors.push('TWILIO_AUTH_TOKEN is required when Twilio is enabled');
    if (!config.twilio.fromNumber) errors.push('TWILIO_PHONE_NUMBER is required when Twilio is enabled');
    if (config.twilio.toNumbers.length === 0) errors.push('RECIPIENT_PHONE_NUMBER is required when Twilio is enabled');
  }
  
  // Check MongoDB settings if used
  if (config.repository.type === 'mongodb') {
    if (!config.mongodb.connectionString) errors.push('MONGO_CONNECTION_STRING is required when using MongoDB repository');
  }
  
  // Check Redis settings if enabled
  if (config.redis.enabled) {
    if (!config.redis.host) errors.push('REDIS_HOST is required when Redis is enabled');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Export both the config and validation function
module.exports = {
  config,
  validateConfig
};