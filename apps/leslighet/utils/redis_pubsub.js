// utils/redis_pubsub.js
const Redis = require('ioredis');

/**
 * Redis Pub/Sub Manager for Readability Services
 * Provides standardized Redis connection handling for publishing and subscribing
 */
class RedisPubSubManager {
  constructor(config = {}) {
    this.config = {
      host: process.env.REDIS_HOST || 'redis',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB || 0,
      // Redis PubSub channels
      channels: {
        SPELLCHECK: 'readability:spellcheck',
        GRAMMAR: 'readability:grammar',
        LIX: 'readability:lix',
        AI: 'readability:nlp', // Updated from ai to nlp, but keeping AI as the variable name for backward compatibility
        // Control channels
        CONTROL: 'readability:control',
        HEARTBEAT: 'readability:heartbeat',
      },
      ...config
    };
    
    this.publisher = null;
    this.subscriber = null;
    this.subscriptions = new Map();
    this.connectionPromise = null;
  }
  
  /**
   * Initialize Redis connections
   */
  async connect() {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }
    
    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        // Create publisher connection
        this.publisher = new Redis({
          host: this.config.host,
          port: this.config.port,
          password: this.config.password,
          db: this.config.db,
          retryStrategy: (times) => {
            const delay = Math.min(Math.floor(Math.random() * 100) + Math.exp(times) * 500, 30000);
            console.log(`Redis publisher reconnecting in ${delay}ms (attempt ${times})`);
            return delay;
          }
        });
        
        // Create separate subscriber connection (required for Redis Pub/Sub)
        this.subscriber = new Redis({
          host: this.config.host,
          port: this.config.port,
          password: this.config.password,
          db: this.config.db,
          retryStrategy: (times) => {
            const delay = Math.min(Math.floor(Math.random() * 100) + Math.exp(times) * 500, 30000);
            console.log(`Redis subscriber reconnecting in ${delay}ms (attempt ${times})`);
            return delay;
          }
        });
        
        // Set up event handlers
        this.publisher.on('connect', () => {
          console.log('Redis publisher connected');
        });
        
        this.publisher.on('error', (err) => {
          console.error('Redis publisher error:', err);
        });
        
        this.subscriber.on('connect', () => {
          console.log('Redis subscriber connected');
          resolve(true);
        });
        
        this.subscriber.on('error', (err) => {
          console.error('Redis subscriber error:', err);
          if (!this.publisher && !this.subscriber) {
            reject(err);
          }
        });
        
        // Handle message events
        this.subscriber.on('message', (channel, message) => {
          const callbacks = this.subscriptions.get(channel) || [];
          callbacks.forEach(callback => {
            try {
              callback(message);
            } catch (err) {
              console.error(`Error in channel ${channel} message handler:`, err);
            }
          });
        });
        
      } catch (err) {
        this.connectionPromise = null;
        reject(err);
      }
    });
    
    return this.connectionPromise;
  }
  
  /**
   * Publish a message to a channel
   * @param {string} channel - The channel to publish to
   * @param {Object} data - The data to publish (will be JSON stringified)
   * @returns {Promise<number>} Number of clients that received the message
   */
  async publish(channel, data) {
    if (!this.publisher) {
      await this.connect();
    }
    
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    return this.publisher.publish(channel, message);
  }
  
  /**
   * Subscribe to a channel
   * @param {string} channel - The channel to subscribe to
   * @param {Function} callback - Function to call when a message is received
   */
  async subscribe(channel, callback) {
    if (!this.subscriber) {
      await this.connect();
    }
    
    // Add callback to subscription list
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, []);
      
      // Subscribe to the channel
      await this.subscriber.subscribe(channel);
      console.log(`Subscribed to Redis channel: ${channel}`);
    }
    
    const callbacks = this.subscriptions.get(channel);
    callbacks.push(callback);
  }
  
  /**
   * Unsubscribe from a channel
   * @param {string} channel - The channel to unsubscribe from
   * @param {Function} callback - The callback to remove
   */
  async unsubscribe(channel, callback) {
    if (!this.subscriber || !this.subscriptions.has(channel)) {
      return;
    }
    
    const callbacks = this.subscriptions.get(channel);
    const index = callbacks.indexOf(callback);
    
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
    
    // If no callbacks left, unsubscribe from the channel
    if (callbacks.length === 0) {
      this.subscriptions.delete(channel);
      await this.subscriber.unsubscribe(channel);
      console.log(`Unsubscribed from Redis channel: ${channel}`);
    }
  }
  
  /**
   * Close Redis connections
   */
  async close() {
    const promises = [];
    
    if (this.publisher) {
      promises.push(this.publisher.quit().catch(err => {
        console.error('Error closing Redis publisher:', err);
      }));
    }
    
    if (this.subscriber) {
      promises.push(this.subscriber.quit().catch(err => {
        console.error('Error closing Redis subscriber:', err);
      }));
    }
    
    await Promise.all(promises);
    this.publisher = null;
    this.subscriber = null;
    this.connectionPromise = null;
    this.subscriptions.clear();
    
    console.log('Redis Pub/Sub connections closed');
  }
  
  /**
   * Get the list of available channels
   * @returns {Object} Channels configuration
   */
  getChannels() {
    return this.config.channels;
  }
}

// Export singleton instance
module.exports = new RedisPubSubManager();