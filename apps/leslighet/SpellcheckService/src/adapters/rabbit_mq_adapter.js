// src/adapters/rabbit_mq_adapter.js
const amqp = require('amqplib');
const logger = require('../utils/logger');

/**
 * RabbitMQ adapter for SpellcheckService
 * Handles message publishing and subscribing
 */
class RabbitMqAdapter {
  constructor() {
    this._connection = null;
    this._channel = null;
    this._connected = false;
    this._exchange = process.env.RABBITMQ_EXCHANGE || 'spellcheck-exchange';
    this._url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
    this._userEventsQueue = process.env.RABBITMQ_USER_EVENTS_QUEUE || 'user-events-queue';
    this._userEventsRoutingKey = process.env.RABBITMQ_USER_EVENTS_ROUTING_KEY || 'user.events';
  }
  
  /**
   * Initialize RabbitMQ connection
   */
  async connect() {
    if (this._connected) {
      return;
    }
    
    try {
      this._connection = await amqp.connect(this._url);
      this._channel = await this._connection.createChannel();
      
      // Set up exchange
      await this._channel.assertExchange(this._exchange, 'topic', { durable: true });
      
      // Set up user events queue
      await this._channel.assertQueue(this._userEventsQueue, { durable: true });
      await this._channel.bindQueue(this._userEventsQueue, this._exchange, this._userEventsRoutingKey);
      
      // Handle connection errors
      this._connection.on('error', (err) => {
        logger.error('RabbitMQ connection error:', err);
        this._connected = false;
        this._attemptReconnect();
      });
      
      this._connection.on('close', () => {
        if (this._connected) {
          logger.warn('RabbitMQ connection closed unexpectedly');
          this._connected = false;
          this._attemptReconnect();
        }
      });
      
      this._connected = true;
      logger.info('Connected to RabbitMQ');
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ:', error);
      this._connected = false;
      this._attemptReconnect();
      throw error;
    }
  }
  
  /**
   * Attempt to reconnect to RabbitMQ with exponential backoff
   * @private
   */
  _attemptReconnect(attempt = 0) {
    const maxAttempts = 10;
    const baseDelayMs = 1000;
    
    if (attempt >= maxAttempts) {
      logger.error(`Failed to reconnect to RabbitMQ after ${maxAttempts} attempts`);
      return;
    }
    
    const delayMs = baseDelayMs * Math.pow(2, attempt);
    
    setTimeout(async () => {
      logger.info(`Attempting to reconnect to RabbitMQ (attempt ${attempt + 1})`);
      try {
        await this.connect();
      } catch (error) {
        this._attemptReconnect(attempt + 1);
      }
    }, delayMs);
  }
  
  /**
   * Subscribe to user events
   * @param {Function} handler - Function to call when a message is received
   */
  async subscribeToUserEvents(handler) {
    if (!this._connected) {
      await this.connect();
    }
    
    await this._channel.consume(this._userEventsQueue, async (msg) => {
      if (!msg) return;
      
      try {
        const content = JSON.parse(msg.content.toString());
        const routingKey = msg.fields.routingKey;
        
        logger.info(`Received RabbitMQ message: routingKey=${routingKey}`);
        await handler(routingKey, content);
        
        // Acknowledge the message
        this._channel.ack(msg);
      } catch (error) {
        logger.error('Error processing RabbitMQ message:', error);
        // Reject the message and don't requeue
        this._channel.reject(msg, false);
      }
    });
    
    logger.info(`Subscribed to user events with routing key: ${this._userEventsRoutingKey}`);
  }
  
  /**
   * Publish a message
   * @param {string} routingKey - The routing key for the message
   * @param {Object} data - The data to publish
   */
  async publish(routingKey, data) {
    if (!this._connected) {
      await this.connect();
    }
    
    const content = Buffer.from(JSON.stringify(data));
    return this._channel.publish(this._exchange, routingKey, content, {
      persistent: true,
      contentType: 'application/json'
    });
  }
  
  /**
   * Close RabbitMQ connections
   */
  async close() {
    if (this._connected) {
      try {
        await this._channel.close();
        await this._connection.close();
        this._connected = false;
        logger.info('Disconnected from RabbitMQ');
      } catch (error) {
        logger.error('Error closing RabbitMQ connections:', error);
      }
    }
  }
  
  /**
   * Check if RabbitMQ is connected
   */
  isConnected() {
    return this._connected;
  }
}

// Export singleton instance
module.exports = new RabbitMqAdapter();