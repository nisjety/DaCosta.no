// src/providers/cache/RedisCacheProvider.js
// Cache implementation using Redis

const Redis = require('ioredis');
const logger = require('../../utils/logger');

/**
 * Redis cache provider
 */
class RedisCacheProvider {
  /**
   * Create a new RedisCacheProvider
   * @param {Object} options - Redis configuration options
   * @param {string} options.host - Redis host
   * @param {number} options.port - Redis port
   * @param {string} options.password - Redis password
   * @param {number} options.db - Redis database index
   * @param {string} options.keyPrefix - Prefix for all cache keys
   */
  constructor(options = {}) {
    this.options = {
      host: options.host || 'localhost',
      port: options.port || 6379,
      password: options.password,
      db: options.db || 0,
      keyPrefix: options.keyPrefix || 'domain-monitor:'
    };
    
    this.client = null;
  }

  /**
   * Initialize the Redis connection
   */
  async initialize() {
    try {
      this.client = new Redis({
        host: this.options.host,
        port: this.options.port,
        password: this.options.password,
        db: this.options.db,
        keyPrefix: this.options.keyPrefix,
        retryStrategy: (times) => {
          const delay = Math.min(times * 100, 3000);
          return delay;
        }
      });
      
      // Setup event handlers
      this.client.on('error', (error) => {
        logger.error(`Redis error: ${error.message}`);
      });
      
      this.client.on('ready', () => {
        logger.info(`Connected to Redis at ${this.options.host}:${this.options.port}`);
      });
      
      this.client.on('reconnecting', () => {
        logger.warn('Reconnecting to Redis...');
      });
      
      // Test the connection
      await this.client.ping();
      logger.info('Redis cache provider initialized');
      
      return true;
    } catch (error) {
      logger.error(`Error initializing Redis: ${error.message}`);
      throw error;
    }
  }

  /**
   * Set a value in the cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, ttl = null) {
    try {
      // Serialize value if not a string
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (ttl) {
        await this.client.set(key, serialized, 'EX', ttl);
      } else {
        await this.client.set(key, serialized);
      }
      
      return true;
    } catch (error) {
      logger.error(`Error setting Redis cache key ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get a value from the cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached value, or null if not found
   */
  async get(key) {
    try {
      const value = await this.client.get(key);
      
      if (!value) {
        return null;
      }
      
      // Try to parse as JSON, return as string if fails
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    } catch (error) {
      logger.error(`Error getting Redis cache key ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * Delete a value from the cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Success status
   */
  async delete(key) {
    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      logger.error(`Error deleting Redis cache key ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if a key exists in the cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if key exists
   */
  async exists(key) {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Error checking if Redis cache key ${key} exists: ${error.message}`);
      return false;
    }
  }

  /**
   * Set expiration time for a key
   * @param {string} key - Cache key
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} Success status
   */
  async expire(key, ttl) {
    try {
      const result = await this.client.expire(key, ttl);
      return result === 1;
    } catch (error) {
      logger.error(`Error setting expiration for Redis cache key ${key}: ${error.message}`);
      return false;
    }
  }

  /**
   * Close the Redis connection
   */
  async close() {
    if (this.client) {
      this.client.disconnect();
      this.client = null;
      logger.info('Redis connection closed');
    }
  }
}

module.exports = RedisCacheProvider;