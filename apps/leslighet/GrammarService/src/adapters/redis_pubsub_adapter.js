// src/adapters/redis_pubsub_adapter.js
/**
 * Redis Pub/Sub adapter for GrammarService.
 * Handles Redis connection management and message publishing/subscribing.
 */

const Redis = require('ioredis');
const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

class RedisPubSubAdapter extends EventEmitter {
  /**
   * Initialize Redis adapter with configuration
   * @param {Object} config - Redis configuration
   */
  constructor(config = {}) {
    super();
    
    this._config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || '',
      db: parseInt(process.env.REDIS_DB || '0', 10),
      keyPrefix: 'grammar:',
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      ...config,
      // Channel names
      channels: {
        SPELLCHECK: 'readability:spellcheck',
        GRAMMAR: 'readability:grammar',
        LIX: 'readability:lix',
        NLP: 'readability:nlp',
        // Control channels
        CONTROL: 'readability:control',
        HEARTBEAT: 'readability:heartbeat',
        // Add monitoring channel
        MONITORING: 'readability:monitoring',
      },
    };
    
    this._publisher = null; // Redis client for publishing
    this._subscriber = null; // Redis client for subscribing
    this._connected = false;
    this._subscriptions = new Map(); // channel -> handler mappings
    this._metrics = {
      publishedMessages: 0,
      receivedMessages: 0,
      errors: 0,
      lastError: null,
      startTime: new Date().toISOString(),
      // Enhanced metrics
      messageLatencies: [],
      messagesByChannel: {},
      lastMessageTime: null,
      processingTimes: [],
      validationErrors: 0,
    };
    
    // Start health check reporting
    this._initHealthCheck();
  }
  
  /**
   * Initialize health check reporting
   * @private
   */
  _initHealthCheck() {
    // Report health status every minute
    this._healthCheckInterval = setInterval(() => {
      this._reportHealth();
    }, 60000); // 60 seconds
    
    // Clean up metrics data every hour
    this._metricsCleanupInterval = setInterval(() => {
      this._cleanupMetricsData();
    }, 3600000); // 60 minutes
  }
  
  /**
   * Report health status to monitoring channel
   * @private
   */
  _reportHealth() {
    if (!this._connected) {
      return;
    }
    
    const metrics = this.getMetrics();
    const healthData = {
      service: 'grammar',
      status: this._connected ? 'healthy' : 'unhealthy',
      metrics: {
        publishedMessages: metrics.publishedMessages,
        receivedMessages: metrics.receivedMessages,
        errors: metrics.errors,
        validationErrors: metrics.validationErrors,
        uptime: metrics.uptime,
        avgLatency: this._calculateAverageLatency(),
        avgProcessingTime: this._calculateAverageProcessingTime(),
      },
      timestamp: new Date().toISOString(),
    };
    
    this.publish(this._config.channels.MONITORING, healthData).catch(err => {
      console.error('Failed to publish health data:', err.message);
    });
  }
  
  /**
   * Calculate average message latency
   * @private
   * @returns {number} Average latency in milliseconds
   */
  _calculateAverageLatency() {
    if (this._metrics.messageLatencies.length === 0) {
      return 0;
    }
    
    const sum = this._metrics.messageLatencies.reduce((acc, val) => acc + val, 0);
    return sum / this._metrics.messageLatencies.length;
  }
  
  /**
   * Calculate average message processing time
   * @private
   * @returns {number} Average processing time in milliseconds
   */
  _calculateAverageProcessingTime() {
    if (this._metrics.processingTimes.length === 0) {
      return 0;
    }
    
    const sum = this._metrics.processingTimes.reduce((acc, val) => acc + val, 0);
    return sum / this._metrics.processingTimes.length;
  }
  
  /**
   * Clean up old metrics data to prevent memory leaks
   * @private
   */
  _cleanupMetricsData() {
    // Keep only the last 1000 entries for latencies and processing times
    if (this._metrics.messageLatencies.length > 1000) {
      this._metrics.messageLatencies = this._metrics.messageLatencies.slice(-1000);
    }
    
    if (this._metrics.processingTimes.length > 1000) {
      this._metrics.processingTimes = this._metrics.processingTimes.slice(-1000);
    }
  }
  
  /**
   * Connect to Redis and initialize publisher/subscriber
   * @returns {Promise<boolean>} True if successful
   */
  async connect() {
    if (this._connected) {
      return true;
    }
    
    try {
      // Create Redis publisher connection
      this._publisher = new Redis({
        host: this._config.host,
        port: this._config.port,
        password: this._config.password || undefined,
        db: this._config.db,
        keyPrefix: this._config.keyPrefix,
        retryStrategy: this._config.retryStrategy,
      });
      
      // Create Redis subscriber connection
      this._subscriber = new Redis({
        host: this._config.host,
        port: this._config.port,
        password: this._config.password || undefined,
        db: this._config.db,
        keyPrefix: this._config.keyPrefix,
        retryStrategy: this._config.retryStrategy,
      });
      
      // Set up event listeners for both connections
      for (const client of [this._publisher, this._subscriber]) {
        client.on('error', (err) => {
          this._handleError('connection', err);
        });
        
        client.on('reconnecting', () => {
          console.log(`Redis client reconnecting to ${this._config.host}:${this._config.port}`);
        });
        
        client.on('end', () => {
          this._connected = false;
          console.log('Redis connection closed');
        });
      }
      
      // Set up subscriber event handlers
      this._subscriber.on('message', (channel, message) => {
        this._handleMessage(channel, message);
      });
      
      this._connected = true;
      console.log(`Redis connection established to ${this._config.host}:${this._config.port}`);
      
      return true;
    } catch (err) {
      this._handleError('connection', err);
      return false;
    }
  }
  
  /**
   * Handle incoming Redis messages
   * @private
   * @param {string} channel - The channel the message was received on
   * @param {string} message - The message data
   */
  _handleMessage(channel, message) {
    this._metrics.receivedMessages++;
    
    // Track message by channel
    if (!this._metrics.messagesByChannel[channel]) {
      this._metrics.messagesByChannel[channel] = 0;
    }
    this._metrics.messagesByChannel[channel]++;
    
    // Record message time for latency calculation
    const now = Date.now();
    this._metrics.lastMessageTime = now;
    
    try {
      // Parse message if it's JSON
      const data = typeof message === 'string' ? JSON.parse(message) : message;
      
      // Validate the message structure
      const validationResult = this._validateMessage(channel, data);
      if (!validationResult.valid) {
        this._handleError('validation', new Error(validationResult.error), { channel });
        this._metrics.validationErrors++;
        return;
      }
      
      const startProcess = Date.now();
      
      // Calculate latency if timestamp is available
      if (data.timestamp) {
        const messageTime = new Date(data.timestamp).getTime();
        const latency = now - messageTime;
        if (latency > 0 && latency < 300000) { // Ignore if latency > 5 minutes (likely wrong timestamp)
          this._metrics.messageLatencies.push(latency);
        }
      }
      
      // Find and call the appropriate handler
      const handler = this._subscriptions.get(channel);
      if (handler) {
        handler(data);
      }
      
      // Record processing time
      const processingTime = Date.now() - startProcess;
      this._metrics.processingTimes.push(processingTime);
      
      // Emit event for anyone listening
      this.emit('message', channel, data);
    } catch (err) {
      this._handleError('parse', err, { channel });
    }
  }
  
  /**
   * Validate message structure based on channel
   * @private
   * @param {string} channel - The channel name
   * @param {Object} message - The parsed message
   * @returns {Object} Validation result {valid: boolean, error: string}
   */
  _validateMessage(channel, message) {
    // Base validation - must be an object
    if (!message || typeof message !== 'object') {
      return { valid: false, error: 'Invalid message format: must be an object' };
    }
    
    // Channel-specific validation
    switch (channel) {
      case this._config.channels.GRAMMAR:
        if (!message.text) {
          return { valid: false, error: 'Missing required field: text' };
        }
        if (!message.requestId) {
          return { valid: false, error: 'Missing required field: requestId' };
        }
        break;
        
      case this._config.channels.CONTROL:
        if (!message.action) {
          return { valid: false, error: 'Missing required field: action' };
        }
        break;
        
      case this._config.channels.HEARTBEAT:
        if (!message.service) {
          return { valid: false, error: 'Missing required field: service' };
        }
        if (!message.timestamp) {
          return { valid: false, error: 'Missing required field: timestamp' };
        }
        break;
    }
    
    return { valid: true };
  }
  
  /**
   * Publish a message to a Redis channel
   * @param {string} channel - The channel to publish to
   * @param {*} data - The data to publish
   * @returns {Promise<boolean>} True if successful
   */
  async publish(channel, data) {
    if (!this._connected) {
      await this.connect();
    }
    
    if (!this._publisher) {
      return false;
    }
    
    try {
      // Ensure data has required fields
      const enhancedData = {
        ...data,
        requestId: data.requestId || uuidv4(),
        timestamp: data.timestamp || new Date().toISOString(),
      };
      
      // Convert data to string if needed
      const message = typeof enhancedData === 'string' ? enhancedData : JSON.stringify(enhancedData);
      
      // Publish the message
      const result = await this._publisher.publish(channel, message);
      this._metrics.publishedMessages++;
      
      // Track message by channel
      if (!this._metrics.messagesByChannel[channel]) {
        this._metrics.messagesByChannel[channel] = 0;
      }
      this._metrics.messagesByChannel[channel]++;
      
      return result > 0;
    } catch (err) {
      this._handleError('publish', err, { channel });
      return false;
    }
  }
  
  /**
   * Publish Grammar service status to control channel
   * @param {string} status - Status message ('online', 'offline', etc)
   * @returns {Promise<boolean>} True if successful
   */
  async publishStatus(status) {
    const data = {
      action: 'status',
      service: 'grammar',
      status,
      capabilities: ['grammar_check', 'sentence_structure', 'proofreading'],
      timestamp: new Date().toISOString(),
    };
    
    return this.publish(this._config.channels.CONTROL, data);
  }
  
  /**
   * Subscribe to a Redis channel
   * @param {string} channel - The channel to subscribe to
   * @param {Function} handler - Function to call when messages arrive
   * @returns {Promise<boolean>} True if successful
   */
  async subscribe(channel, handler) {
    if (!this._connected) {
      await this.connect();
    }
    
    if (!this._subscriber) {
      return false;
    }
    
    try {
      // Subscribe to the channel
      await this._subscriber.subscribe(channel);
      this._subscriptions.set(channel, handler);
      
      console.log(`Subscribed to Redis channel: ${channel}`);
      return true;
    } catch (err) {
      this._handleError('subscribe', err, { channel });
      return false;
    }
  }
  
  /**
   * Unsubscribe from a Redis channel
   * @param {string} channel - The channel to unsubscribe from
   * @returns {Promise<boolean>} True if successful
   */
  async unsubscribe(channel) {
    if (!this._connected || !this._subscriber) {
      return false;
    }
    
    try {
      // Unsubscribe from the channel
      await this._subscriber.unsubscribe(channel);
      
      // Remove handler
      this._subscriptions.delete(channel);
      
      console.log(`Unsubscribed from Redis channel: ${channel}`);
      return true;
    } catch (err) {
      this._handleError('unsubscribe', err, { channel });
      return false;
    }
  }
  
  /**
   * Get the list of available channels
   * @returns {Object} Channel names
   */
  getChannels() {
    return this._config.channels;
  }
  
  /**
   * Get metrics about Redis Pub/Sub usage
   * @returns {Object} Metrics data
   */
  getMetrics() {
    const now = new Date();
    const startTime = new Date(this._metrics.startTime);
    const uptime = (now - startTime) / 1000; // seconds
    
    return {
      ...this._metrics,
      connectionStatus: this._connected ? 'connected' : 'disconnected',
      subscriptions: Array.from(this._subscriptions.keys()),
      timestamp: now.toISOString(),
      uptime: this._connected ? uptime : 0,
      avgLatency: this._calculateAverageLatency(),
      avgProcessingTime: this._calculateAverageProcessingTime(),
      messagesByChannel: { ...this._metrics.messagesByChannel },
    };
  }
  
  /**
   * Close Redis connections
   * @returns {Promise<void>}
   */
  async close() {
    try {
      // Clear intervals
      if (this._healthCheckInterval) {
        clearInterval(this._healthCheckInterval);
        this._healthCheckInterval = null;
      }
      
      if (this._metricsCleanupInterval) {
        clearInterval(this._metricsCleanupInterval);
        this._metricsCleanupInterval = null;
      }
      
      // Close Redis connections
      if (this._publisher) {
        this._publisher.quit();
      }
      
      if (this._subscriber) {
        this._subscriber.quit();
      }
      
      this._publisher = null;
      this._subscriber = null;
      this._connected = false;
      this._subscriptions.clear();
      
      console.log('Redis connections closed');
    } catch (err) {
      this._handleError('close', err);
    }
  }
}

// Export singleton instance
module.exports = new RedisPubSubAdapter();