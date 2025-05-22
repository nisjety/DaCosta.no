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
        
        // Create subscriber connection (separate from publisher to avoid blocking)
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
        
        // Set up connection event handlers
        this.publisher.on('connect', () => {
          console.log('Redis publisher connected');
        });
        
        this.publisher.on('error', (err) => {
          console.error('Redis publisher error:', err);
        });
        
        this.subscriber.on('connect', () => {
          console.log('Redis subscriber connected');
          resolve();
        });
        
        this.subscriber.on('error', (err) => {
          console.error('Redis subscriber error:', err);
          // Only reject if we're in the connection process
          if (!this.subscriber.status === 'ready') {
            reject(err);
          }
        });
        
        // Handle subscriber message reception
        this.subscriber.on('message', (channel, message) => {
          if (this.subscriptions.has(channel)) {
            try {
              const handlers = this.subscriptions.get(channel);
              const parsedMessage = JSON.parse(message);
              
              handlers.forEach(handler => {
                try {
                  handler(parsedMessage);
                } catch (handlerError) {
                  console.error(`Error in Redis handler for channel ${channel}:`, handlerError);
                }
              });
            } catch (parseError) {
              console.error(`Error parsing Redis message from channel ${channel}:`, parseError);
              // Still try to call handlers with raw message if JSON parsing fails
              const handlers = this.subscriptions.get(channel);
              handlers.forEach(handler => {
                try {
                  handler({ raw: message, error: 'JSON_PARSE_ERROR' });
                } catch (handlerError) {
                  console.error(`Error in Redis handler for channel ${channel}:`, handlerError);
                }
              });
            }
          }
        });
      } catch (err) {
        console.error('Redis connection setup error:', err);
        reject(err);
      }
    });
    
    return this.connectionPromise;
  }
  
  /**
   * Subscribe to a Redis channel
   * @param {string} channel - The channel to subscribe to
   * @param {function} handler - Callback function that receives messages
   * @returns {Promise} - Resolves when subscription is active
   */
  async subscribe(channel, handler) {
    await this.connect();
    
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set([handler]));
      await this.subscriber.subscribe(channel);
      console.log(`Subscribed to Redis channel: ${channel}`);
    } else {
      this.subscriptions.get(channel).add(handler);
      console.log(`Added handler to existing subscription: ${channel}`);
    }
  }
  
  /**
   * Unsubscribe a specific handler from a channel
   * @param {string} channel - The channel to unsubscribe from
   * @param {function} handler - The handler to remove
   */
  async unsubscribe(channel, handler) {
    if (!this.subscriptions.has(channel)) return;
    
    const handlers = this.subscriptions.get(channel);
    handlers.delete(handler);
    
    if (handlers.size === 0) {
      this.subscriptions.delete(channel);
      await this.subscriber.unsubscribe(channel);
      console.log(`Unsubscribed from Redis channel: ${channel}`);
    }
  }
  
  /**
   * Publish a message to a Redis channel
   * @param {string} channel - The channel to publish to
   * @param {object} data - Data object to publish (will be JSON stringified)
   * @returns {Promise<number>} - Number of clients that received the message
   */
  async publish(channel, data) {
    await this.connect();
    
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    return await this.publisher.publish(channel, message);
  }
  
  /**
   * Close Redis connections
   */
  async close() {
    if (this.publisher) {
      await this.publisher.quit();
      this.publisher = null;
    }
    
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
    
    this.subscriptions.clear();
    this.connectionPromise = null;
    console.log('Redis connections closed');
  }
}

const redisPubSub = new RedisPubSubManager();

module.exports = redisPubSub;
