// src/utils/redis_pubsub.js
const Redis = require('ioredis');
const config = require('../config/config');
const logger = require('./logger');

/**
 * Redis PubSub utility for SpellcheckService
 * Provides publish/subscribe functionality via Redis
 */
class RedisPubSub {
  constructor() {
    this.publisher = null;
    this.subscribers = {};
    this.channels = {
      SPELLCHECK: 'readability:spellcheck',
      GRAMMAR: 'readability:grammar',
      LIX: 'readability:lix',
      NLP: 'readability:nlp',
      CONTROL: 'readability:control',
      HEARTBEAT: 'readability:heartbeat'
    };
    this.connected = false;
  }

  /**
   * Get channel names
   * @returns {Object} Channel names
   */
  getChannels() {
    return this.channels;
  }

  /**
   * Initialize Redis connections
   */
  async connect() {
    if (this.connected) {
      return;
    }
    
    try {
      // Create publisher client
      this.publisher = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db,
        tls: config.redis.useTls ? {} : undefined
      });
      
      // Set up event handlers
      this.publisher.on('error', (err) => {
        logger.error('Redis publisher error:', err);
      });
      
      this.publisher.on('connect', () => {
        logger.info('Redis publisher connected');
      });
      
      this.connected = true;
      logger.info('Redis PubSub initialized');
    } catch (error) {
      logger.error('Failed to initialize Redis PubSub:', error);
      throw error;
    }
  }
  
  /**
   * Subscribe to a channel
   * @param {string} channel - Channel name
   * @param {Function} handler - Message handler
   */
  async subscribe(channel, handler) {
    try {
      // Create new subscriber client if not exists
      if (!this.subscribers[channel]) {
        const subscriber = new Redis({
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password,
          db: config.redis.db,
          tls: config.redis.useTls ? {} : undefined
        });
        
        // Set up event handlers
        subscriber.on('error', (err) => {
          logger.error(`Redis subscriber error for ${channel}:`, err);
        });
        
        subscriber.on('connect', () => {
          logger.info(`Redis subscriber connected for ${channel}`);
        });
        
        this.subscribers[channel] = subscriber;
      }
      
      // Subscribe to channel
      await this.subscribers[channel].subscribe(channel);
      logger.info(`Subscribed to channel: ${channel}`);
      
      // Set up message handler
      this.subscribers[channel].on('message', (receivedChannel, message) => {
        if (receivedChannel === channel) {
          try {
            const data = typeof message === 'string' ? JSON.parse(message) : message;
            handler(data);
          } catch (err) {
            logger.error(`Error processing message from ${channel}:`, err);
          }
        }
      });
    } catch (error) {
      logger.error(`Error subscribing to ${channel}:`, error);
      throw error;
    }
  }
  
  /**
   * Publish a message to a channel
   * @param {string} channel - Channel name
   * @param {Object} data - Data to publish
   */
  async publish(channel, data) {
    if (!this.connected) {
      await this.connect();
    }
    
    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      await this.publisher.publish(channel, message);
      logger.debug(`Published message to ${channel}`);
    } catch (error) {
      logger.error(`Error publishing to ${channel}:`, error);
      throw error;
    }
  }
  
  /**
   * Close all Redis connections
   */
  async close() {
    const closePromises = [];
    
    // Close publisher
    if (this.publisher) {
      closePromises.push(this.publisher.quit().catch(err => {
        logger.error('Error closing Redis publisher:', err);
      }));
    }
    
    // Close all subscribers
    for (const channel of Object.keys(this.subscribers)) {
      const subscriber = this.subscribers[channel];
      closePromises.push(
        subscriber.quit().catch(err => {
          logger.error(`Error closing Redis subscriber for ${channel}:`, err);
        })
      );
    }
    
    // Wait for all connections to close
    await Promise.all(closePromises);
    this.publisher = null;
    this.subscribers = {};
    this.connected = false;
    logger.info('All Redis PubSub connections closed');
  }
}

// Export a singleton instance
module.exports = new RedisPubSub();