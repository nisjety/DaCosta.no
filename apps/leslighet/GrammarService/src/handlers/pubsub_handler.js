// src/handlers/pubsub_handler.js
const redisPubSub = require('../adapters/redis_pubsub_adapter');
const grammarService = require('../services/grammar_service');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');

/**
 * Request validation schema for grammar check
 */
const requestSchema = Joi.object({
  clientId: Joi.string().required(),
  content: Joi.object({
    text: Joi.string().required().min(1).max(50000),
    options: Joi.object({
      check_style: Joi.boolean().default(true),
      check_punctuation: Joi.boolean().default(true),
      language: Joi.string().default('no'),
    }).default({}),
  }).required(),
  timestamp: Joi.string().isoDate(),
  requestId: Joi.string(),
}).unknown(true);

class PubSubHandler {
  constructor() {
    this._running = false;
    this._pendingRequests = new Map();
    this._metricsEnabled = process.env.ENABLE_METRICS === 'true';
    this._metrics = {
      totalRequests: 0,
      failedRequests: 0,
      processingTimes: [],
      avgProcessingTime: 0,
    };
  }
  
  /**
   * Start the PubSub handler
   */
  async start() {
    if (this._running) {
      return;
    }
    
    try {
      // Connect to Redis
      await redisPubSub.connect();
      
      // Announce service availability
      await redisPubSub.publishStatus('online');
      
      // Subscribe to Grammar channel
      await redisPubSub.subscribe(
        redisPubSub.getChannels().GRAMMAR, 
        this._handleMessage.bind(this)
      );
      
      // Subscribe to heartbeat channel
      await redisPubSub.subscribe(
        redisPubSub.getChannels().HEARTBEAT,
        this._handleHeartbeat.bind(this)
      );
      
      this._running = true;
      console.log('Grammar PubSub handler started');
    } catch (err) {
      console.error('Failed to start PubSub handler:', err);
      throw err;
    }
  }
  
  /**
   * Process an incoming message from Redis
   * @param {string} messageStr - JSON string message
   * @private
   */
  async _handleMessage(messageStr) {
    const startTime = Date.now();
    let clientId = null;
    let requestId = null;
    
    try {
      // Parse message
      const message = typeof messageStr === 'string' ? JSON.parse(messageStr) : messageStr;
      clientId = message.clientId;
      requestId = message.requestId || uuidv4();
      
      this._metrics.totalRequests++;
      
      // Validate request
      const { error, value } = requestSchema.validate(message);
      if (error) {
        console.error('Invalid message format:', error.message);
        await this._sendErrorResponse(clientId, `Invalid request: ${error.message}`, requestId);
        return;
      }
      
      const { text, options } = value.content;
      
      // Add to pending requests
      this._pendingRequests.set(requestId, {
        clientId,
        startTime,
        text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
      });
      
      // Process grammar check
      const result = await grammarService.checkText(text, options);
      
      // Send result back
      await redisPubSub.publish(redisPubSub.getChannels().GRAMMAR, {
        clientId,
        requestId,
        content: result,
        timestamp: new Date().toISOString(),
      });
      
      // Update metrics
      const processingTime = Date.now() - startTime;
      this._metrics.processingTimes.push(processingTime);
      
      // Keep only the last 100 processing times for average calculation
      if (this._metrics.processingTimes.length > 100) {
        this._metrics.processingTimes.shift();
      }
      
      // Calculate average processing time
      this._metrics.avgProcessingTime = this._metrics.processingTimes.reduce(
        (sum, time) => sum + time, 0
      ) / this._metrics.processingTimes.length;
      
      // Remove from pending
      this._pendingRequests.delete(requestId);
      
    } catch (err) {
      console.error('Error processing message:', err);
      this._metrics.failedRequests++;
      
      // Send error response
      if (clientId) {
        await this._sendErrorResponse(clientId, `Processing error: ${err.message}`, requestId);
      }
      
      // Remove from pending
      if (requestId) {
        this._pendingRequests.delete(requestId);
      }
    }
  }
  
  /**
   * Handle heartbeat messages
   * @param {string} messageStr - JSON string message
   * @private
   */
  async _handleHeartbeat(messageStr) {
    try {
      const message = typeof messageStr === 'string' ? JSON.parse(messageStr) : messageStr;
      
      if (message.action === 'ping') {
        // Reply to ping with service status
        await redisPubSub.publish(redisPubSub.getChannels().HEARTBEAT, {
          action: 'pong',
          service: 'grammar',
          status: 'healthy',
          metrics: this.getMetrics(),
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Error handling heartbeat:', err);
    }
  }
  
  /**
   * Send error response back to client
   * @param {string} clientId - Client ID
   * @param {string} errorMessage - Error message
   * @param {string} requestId - Request ID
   * @private
   */
  async _sendErrorResponse(clientId, errorMessage, requestId) {
    try {
      await redisPubSub.publish(redisPubSub.getChannels().GRAMMAR, {
        clientId,
        requestId,
        content: {
          error: errorMessage,
          success: false,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error sending error response:', err);
    }
  }
  
  /**
   * Stop the PubSub handler
   */
  async stop() {
    if (!this._running) {
      return;
    }
    
    try {
      // Announce service unavailability
      await redisPubSub.publishStatus('offline');
      
      // Close Redis connections
      await redisPubSub.close();
      
      this._running = false;
      console.log('Grammar PubSub handler stopped');
    } catch (err) {
      console.error('Error stopping PubSub handler:', err);
      throw err;
    }
  }
  
  /**
   * Get handler status
   */
  getStatus() {
    return {
      running: this._running,
      pendingRequests: Array.from(this._pendingRequests.entries()).map(([id, req]) => ({
        id,
        clientId: req.clientId,
        startTime: req.startTime,
        elapsedMs: Date.now() - req.startTime,
        textPreview: req.text,
      })),
    };
  }
  
  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this._metrics,
      pendingCount: this._pendingRequests.size,
      redisMetrics: redisPubSub.getMetrics(),
      timestamp: new Date().toISOString(),
    };
  }
}

// Export singleton instance
module.exports = new PubSubHandler();