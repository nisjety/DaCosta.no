// src/services/WebSocketService.js
// Single Responsibility: Handles WebSocket communication for real-time updates

const WebSocket = require('ws');
const logger = require('../utils/logger');

/**
 * Service for WebSocket communication
 */
class WebSocketService {
  /**
   * Create a new WebSocketService
   * @param {Object} options - WebSocket configuration options
   * @param {number} options.port - WebSocket server port
   * @param {HttpServer} options.server - HTTP server to attach to (optional)
   */
  constructor(options = {}) {
    this.port = options.port || 3002;
    this.server = null;
    this.wss = null;
    this.clients = new Set();
    this.eventHandlers = {};
    
    // If an HTTP server is provided, use it
    if (options.server) {
      this._initializeWithServer(options.server);
    }
  }

  /**
   * Initialize WebSocket server with an existing HTTP server
   * @param {HttpServer} server - HTTP server to attach to
   * @private
   */
  _initializeWithServer(server) {
    this.wss = new WebSocket.Server({ server });
    this._setupWebSocketServer();
  }

  /**
   * Setup WebSocket server event handlers
   * @private
   */
  _setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      const clientIp = req.socket.remoteAddress;
      logger.info(`WebSocket client connected: ${clientIp}`);
      
      // Add client to set
      this.clients.add(ws);
      
      // Send initial connection confirmation
      ws.send(JSON.stringify({
        type: 'connection',
        status: 'connected',
        timestamp: new Date().toISOString()
      }));
      
      // Handle messages from client
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          logger.debug(`Received WebSocket message: ${data.type}`);
          
          // Handle message based on type
          if (data.type && this.eventHandlers[data.type]) {
            this.eventHandlers[data.type](data, ws);
          }
        } catch (error) {
          logger.error(`Error processing WebSocket message: ${error.message}`);
        }
      });
      
      // Handle client disconnect
      ws.on('close', () => {
        logger.info(`WebSocket client disconnected: ${clientIp}`);
        this.clients.delete(ws);
      });
      
      // Handle errors
      ws.on('error', (error) => {
        logger.error(`WebSocket error: ${error.message}`);
        this.clients.delete(ws);
      });
    });
    
    // Server error handler
    this.wss.on('error', (error) => {
      logger.error(`WebSocket server error: ${error.message}`);
    });
    
    logger.info('WebSocket server initialized');
  }

  /**
   * Register an event handler
   * @param {string} eventType - Event type to handle
   * @param {Function} handler - Handler function
   */
  registerEventHandler(eventType, handler) {
    this.eventHandlers[eventType] = handler;
    logger.debug(`Registered WebSocket handler for event: ${eventType}`);
  }

  /**
   * Broadcast a message to all connected clients
   * @param {Object} data - Data to broadcast
   */
  broadcast(data) {
    if (this.clients.size === 0) {
      return; // No clients connected
    }
    
    const message = JSON.stringify(data);
    logger.debug(`Broadcasting WebSocket message: ${data.type} to ${this.clients.size} clients`);
    
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  /**
   * Send a message to a specific client
   * @param {WebSocket} client - Client to send to
   * @param {Object} data - Data to send
   */
  sendToClient(client, data) {
    if (client.readyState === WebSocket.OPEN) {
      const message = JSON.stringify(data);
      logger.debug(`Sending WebSocket message: ${data.type}`);
      client.send(message);
    }
  }

  /**
   * Start the WebSocket server
   * @returns {Promise<void>}
   */
  async start() {
    // Only start a standalone server if we don't have one already
    if (!this.wss) {
      return new Promise((resolve) => {
        this.server = new WebSocket.Server({ port: this.port });
        this.wss = this.server;
        this._setupWebSocketServer();
        logger.info(`WebSocket server listening on port ${this.port}`);
        resolve();
      });
    }
    
    return Promise.resolve();
  }

  /**
   * Stop the WebSocket server
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.wss) {
      return Promise.resolve();
    }
    
    return new Promise((resolve) => {
      this.wss.close(() => {
        logger.info('WebSocket server stopped');
        this.server = null;
        this.wss = null;
        this.clients.clear();
        resolve();
      });
    });
  }
}

module.exports = WebSocketService;