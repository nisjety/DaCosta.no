// src/config/redis.js
const RedisConnection = require("../utils/RedisConnection");

// Configuration object to use when creating Redis connections
const redisConfig = {
  host: process.env.REDIS_HOST || "redis",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_DB || 0,
  retryStrategy: (times) => {
    // Exponential backoff with jitter
    const delay = Math.min(Math.floor(Math.random() * 100) + Math.exp(times) * 500, 30000);
    console.log(`Redis reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  }
};

// Export the configuration and methods to get Redis clients
module.exports = {
  config: redisConfig,
  
  // Get a Redis client using the shared connection manager
  async getClient() {
    return RedisConnection.getClient(redisConfig);
  },
  
  // Get a Redis subscriber client for pub/sub
  async getSubscriber(channelPattern, messageHandler) {
    return RedisConnection.getSubscriber(channelPattern, messageHandler, redisConfig);
  }
};