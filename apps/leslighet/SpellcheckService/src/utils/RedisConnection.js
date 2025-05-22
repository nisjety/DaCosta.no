// src/utils/RedisConnection.js
const Redis = require("ioredis");
const config = require('../config/config');
const logger = require('./logger');

/**
 * Singleton Redis connection manager
 * Provides a shared Redis client to prevent connection overload
 */
class RedisConnection {
  constructor() {
    this.client = null;
    this.subscribers = {};
    this.connectionPromise = null;
    this.connectionAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.isConnecting = false;
  }

  /**
   * Get Redis client instance
   * @param {Object} options Redis connection options
   * @returns {Promise<Redis>} Redis client
   */
  async getClient(options = {}) {
    // Return existing client if connected
    if (this.client && this.client.status === 'ready') {
      return this.client;
    }

    // Return existing connection promise if already connecting
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // Create new connection
    this.isConnecting = true;
    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        // Configure Redis client
        const client = new Redis({
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password,
          db: config.redis.db,
          tls: config.redis.useTls ? {} : undefined,
          retryStrategy: (times) => {
            if (times > this.maxReconnectAttempts) {
              logger.error(`Max Redis reconnect attempts (${this.maxReconnectAttempts}) exceeded`);
              return null; // Stop retrying
            }
            // Exponential backoff with jitter
            const delay = Math.min(Math.floor(Math.random() * 100) + Math.exp(times) * 500, 30000);
            logger.info(`Redis reconnecting in ${delay}ms (attempt ${times})`);
            return delay;
          },
          ...options
        });

        // Set up event handlers
        client.on('connect', () => {
          logger.info('Redis connected');
          this.connectionAttempts = 0;
        });

        client.on('ready', () => {
          logger.info('Redis ready');
          this.client = client;
          this.isConnecting = false;
          this.connectionPromise = null;
          resolve(client);
        });

        client.on('error', (err) => {
          logger.error('Redis error:', err);
          // Only reject if this is the initial connection
          if (this.isConnecting) {
            this.isConnecting = false;
            this.connectionPromise = null;
            reject(err);
          }
        });

        client.on('close', () => {
          logger.info('Redis connection closed');
        });

        client.on('reconnecting', () => {
          this.connectionAttempts++;
          logger.info(`Redis reconnecting (attempt ${this.connectionAttempts})`);
        });

        client.on('end', () => {
          logger.info('Redis connection ended');
          this.client = null;
        });
      } catch (err) {
        this.isConnecting = false;
        this.connectionPromise = null;
        reject(err);
      }
    });

    return this.connectionPromise;
  }

  /**
   * Close all Redis connections
   */
  async close() {
    const closePromises = [];

    // Close the main client
    if (this.client) {
      closePromises.push(this.client.quit().catch(err => {
        logger.error('Error closing Redis client:', err);
      }));
    }

    // Close all subscribers
    for (const pattern of Object.keys(this.subscribers)) {
      const subscriber = this.subscribers[pattern];
      closePromises.push(
        subscriber.quit().catch(err => {
          logger.error(`Error closing Redis subscriber for ${pattern}:`, err);
        })
      );
    }

    // Wait for all connections to close
    await Promise.all(closePromises);
    this.client = null;
    this.subscribers = {};
    logger.info('All Redis connections closed');
  }
}

// Export a singleton instance
module.exports = new RedisConnection();