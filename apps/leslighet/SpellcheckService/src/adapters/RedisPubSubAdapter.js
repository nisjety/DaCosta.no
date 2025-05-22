// src/adapters/RedisPubSubAdapter.js
const redisPubSub = require('../utils/redis_pubsub');

/**
 * Redis PubSub adapter for SpellcheckService
 * Handles publishing spellcheck results to Redis
 */
class RedisPubSubAdapter {
  constructor() {
    this.channelName = redisPubSub.getChannels().SPELLCHECK;
    this.connected = false;
  }
  
  /**
   * Initialize Redis connection
   */
  async connect() {
    if (this.connected) {
      return;
    }
    
    try {
      await redisPubSub.connect();
      this.connected = true;
      
      // Publish service status on the control channel
      await redisPubSub.publish(redisPubSub.getChannels().CONTROL, {
        action: 'status',
        service: 'spellcheck',
        status: 'online',
        timestamp: new Date().toISOString()
      });
      
      console.log('Connected to Redis PubSub');
    } catch (error) {
      console.error('Failed to connect to Redis PubSub:', error);
      throw error;
    }
  }
  
  /**
   * Subscribe to requests
   * @param {Function} handler - Function to call when a request is received
   */
  async subscribeToRequests(handler) {
    if (!this.connected) {
      await this.connect();
    }
    
    await redisPubSub.subscribe(this.channelName, async (message) => {
      try {
        const data = JSON.parse(message);
        await handler(data);
      } catch (error) {
        console.error('Error processing spellcheck request:', error);
      }
    });
  }
  
  /**
   * Publish a result
   * @param {Object} data - The data to publish
   */
  async publishResult(data) {
    if (!this.connected) {
      await this.connect();
    }
    
    await redisPubSub.publish(this.channelName, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Close Redis connections
   */
  async close() {
    if (this.connected) {
      try {
        // Publish service status before disconnecting
        await redisPubSub.publish(redisPubSub.getChannels().CONTROL, {
          action: 'status',
          service: 'spellcheck',
          status: 'offline',
          timestamp: new Date().toISOString()
        });
        
        await redisPubSub.close();
        this.connected = false;
      } catch (error) {
        console.error('Error closing Redis PubSub connections:', error);
      }
    }
  }
}

// Export singleton instance
module.exports = new RedisPubSubAdapter();