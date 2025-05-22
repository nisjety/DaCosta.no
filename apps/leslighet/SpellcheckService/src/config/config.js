// src/config/config.js
const path = require('path');

// Load environment variables from .env file in development
if (process.env.NODE_ENV !== 'development') {
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
}

const config = {
  app: {
    port: parseInt(process.env.APP_PORT || process.env.PORT || '5002', 10),
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    useTls: process.env.REDIS_USE_TLS === 'true',
    db: parseInt(process.env.REDIS_DB || '0', 10),
    userCacheTtl: parseInt(process.env.USER_CACHE_TTL || '86400', 10)
  },
  auth: {
    enabled: process.env.AUTH_ENABLED === 'true',
    apiKeyEnabled: process.env.API_KEY_AUTH_ENABLED === 'true',
    jwtSecret: process.env.JWT_SECRET || 'default-jwt-secret',
    jwtIssuer: process.env.JWT_ISSUER || 'spellchecker-service',
    jwtAudience: process.env.JWT_AUDIENCE || 'spellchecker-clients',
    strictMode: false,
    publicSpellcheck: true
  },
  rabbitmq: {
    enabled: process.env.RABBITMQ_ENABLED === 'true',
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    exchange: process.env.RABBITMQ_EXCHANGE || 'spellcheck-exchange',
    userEventsQueue: process.env.RABBITMQ_USER_EVENTS_QUEUE || 'user-events-queue',
    userEventsRoutingKey: process.env.RABBITMQ_USER_EVENTS_ROUTING_KEY || 'user.events'
  },
  cors: {
    enabled: process.env.CORS_ENABLED === 'true',
    origins: process.env.CORS_ORIGINS || '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Requested-With', 'Accept', 'X-User-Id', 'X-User-Roles', 'X-User-Permissions', 'X-Organization-Id']
  },
  cache: {
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '10000', 10),
    ttl: parseInt(process.env.CACHE_TTL || '3600', 10)
  },
  dictionary: {
    hunspellPath: process.env.HUNSPELL_PATH || '/app/data/DICT/Hunspell',
    hyphenationPath: process.env.HYPHENATION_PATH || '/app/data/DICT/Hyphenation',
    thesaurusPath: process.env.THESAURUS_PATH || '/app/data/DICT/Thesaurus',
    stopwordsPath: process.env.STOPWORDS_PATH || '/app/data/DICT/Stopword/stopwords-no.json',
  }
};

// Validate critical configuration in production
if (process.env.NODE_ENV === 'production') {
  const missingFields = [];
  
  if (config.rabbitmq.enabled) {
    if (!config.rabbitmq.url) {
      missingFields.push('RABBITMQ_URL (required when RABBITMQ_ENABLED=true)');
    }
  }
  
  if (missingFields.length > 0) {
    console.error(`Missing required environment variables: ${missingFields.join(', ')}`);
    process.exit(1);
  }
}

module.exports = config;