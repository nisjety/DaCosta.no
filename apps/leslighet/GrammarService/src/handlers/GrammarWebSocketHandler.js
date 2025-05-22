/**
 * GrammarWebSocketHandler.js
 * Handles WebSocket connections for the grammar checking service
 */

const WebSocket = require('ws');

class GrammarWebSocketHandler {
  /**
   * Initialize the WebSocket handler
   * @param {object} options - Configuration options
   * @param {object} options.grammarService - The grammar service instance
   * @param {object} options.logger - Logger instance
   * @param {object} options.wsOptions - WebSocket server options
   */
  constructor(options = {}) {
    this._grammarService = options.grammarService;
    this._logger = options.logger || console;
    this._wsOptions = options.wsOptions || {};
    this._wss = null;
    this._clients = new Set();
    this._metrics = {
      requestsProcessed: 0,
      errorsEncountered: 0,
      lastRequestTime: null,
      averageProcessingTime: 0
    };
  }

  /**
   * Initialize WebSocket server
   * @param {object} server - HTTP server instance
   */
  initialize(server) {
    if (!server) {
      throw new Error('Server instance is required');
    }

    this._logger.info('Initializing Grammar WebSocket handler on path: /ws/grammar');
    
    try {
      // Merge default options with user provided options
      const wsOptions = {
        server,
        path: '/ws/grammar',
        // Allow all origins by default (more permissive for development)
        verifyClient: (info, callback) => {
          const origin = info.origin || info.req.headers.origin;
          this._logger.info(`Client attempting to connect from origin: ${origin}`);
          // Allow all origins in development
          callback(true);
          return true;
        },
        // Handle protocols to avoid connection failures
        handleProtocols: (protocols) => {
          return protocols && protocols[0] ? protocols[0] : '';
        },
        // Better headers for WebSocket connections
        perMessageDeflate: false, // Disable compression for better compatibility
        clientTracking: true,
        ...this._wsOptions
      };
      
      this._wss = new WebSocket.Server(wsOptions);
      this._wss.startTime = Date.now();

      this._setupEventListeners();
      this._logger.info('Grammar WebSocket handler initialized successfully');
      
      // Perform periodic checks to clean up dead connections
      setInterval(() => this._cleanupConnections(), 30000);
    } catch (err) {
      this._logger.error('Failed to initialize WebSocket server:', err);
      throw err;
    }
  }

  /**
   * Setup WebSocket event listeners
   */
  _setupEventListeners() {
    if (!this._wss) {
      return;
    }

    this._wss.on('connection', (ws, req) => {
      const clientIp = req.socket.remoteAddress;
      const origin = req.headers.origin || 'unknown';
      this._logger.info(`WebSocket connection established from ${clientIp}, Origin: ${origin}`);
      
      // Log headers for debugging
      this._logger.debug('Connection headers:', req.headers);
      
      this._clients.add(ws);

      // Add client-specific properties
      ws.isAlive = true;
      ws.clientIp = clientIp;
      ws.origin = origin;
      ws.connectionTime = new Date();

      // Setup ping-pong for keeping connection alive
      ws.on('pong', () => {
        ws.isAlive = true;
        this._logger.debug(`Received pong from ${clientIp}`);
      });

      ws.on('message', async (message) => {
        try {
          this._logger.info(`Received message from ${clientIp}`);
          await this._handleMessage(ws, message);
        } catch (err) {
          this._metrics.errorsEncountered++;
          this._logger.error('Error handling WebSocket message:', err);
          this._sendError(ws, 'Internal server error processing your request');
        }
      });

      ws.on('close', (code, reason) => {
        this._logger.info(`WebSocket connection closed from ${clientIp}. Code: ${code}, Reason: ${reason || 'No reason provided'}`);
        this._clients.delete(ws);
      });

      ws.on('error', (err) => {
        this._metrics.errorsEncountered++;
        this._logger.error(`WebSocket error from ${clientIp}:`, err);
        this._clients.delete(ws);
      });

      // Send welcome message
      this._send(ws, {
        type: 'info',
        message: 'Connected to Norwegian Grammar Service',
        details: {
          clientIp,
          protocol: ws.protocol || 'none',
          timestamp: new Date().toISOString(),
          activeConnections: this._clients.size
        }
      });
    });
    
    this._wss.on('error', (err) => {
      this._metrics.errorsEncountered++;
      this._logger.error('WebSocket server error:', err);
    });

    this._wss.on('headers', (headers, req) => {
      // Add custom headers for better CORS support
      headers.push('Access-Control-Allow-Origin: *');
      headers.push('Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Sec-WebSocket-Protocol');
      headers.push('Access-Control-Allow-Credentials: true');
    });
  }

  /**
   * Clean up dead connections with ping-pong
   */
  _cleanupConnections() {
    if (!this._wss) return;
    
    this._logger.debug(`Checking WebSocket connections. Active clients: ${this._clients.size}`);
    
    this._clients.forEach(ws => {
      if (ws.isAlive === false) {
        this._logger.info(`Terminating inactive WebSocket connection from ${ws.clientIp}`);
        this._clients.delete(ws);
        return ws.terminate();
      }
      
      ws.isAlive = false;
      try {
        ws.ping('', false);
      } catch (err) {
        this._logger.warn(`Error sending ping to client ${ws.clientIp}:`, err);
        this._clients.delete(ws);
        ws.terminate();
      }
    });
  }

  /**
   * Handle incoming WebSocket message
   * @param {WebSocket} ws - WebSocket connection
   * @param {string|Buffer} message - Raw message data
   */
  async _handleMessage(ws, message) {
    let parsedMessage;
    let messageString;
    
    try {
      // Handle Buffer or string message
      messageString = message instanceof Buffer ? message.toString() : message;
      parsedMessage = JSON.parse(messageString);
    } catch (err) {
      this._logger.error('Failed to parse WebSocket message:', err);
      return this._sendError(ws, 'Invalid JSON message');
    }

    if (!parsedMessage.type) {
      this._logger.warn('Received message with missing type');
      return this._sendError(ws, 'Missing message type');
    }

    // Handle ping explicitly for client testing
    if (parsedMessage.type === 'ping') {
      this._logger.info('Received ping message, responding with pong');
      return this._send(ws, {
        type: 'pong',
        timestamp: new Date().toISOString(),
        requestId: parsedMessage.requestId
      });
    }

    switch (parsedMessage.type) {
      case 'grammar_check':
        this._logger.info(`Processing grammar check request of type ${parsedMessage.type}`);
        await this._handleGrammarCheck(ws, parsedMessage.payload, parsedMessage.requestId);
        break;
      default:
        this._logger.warn(`Received message with unknown type: ${parsedMessage.type}`);
        this._sendError(ws, `Unknown message type: ${parsedMessage.type}`);
    }
  }

  /**
   * Handle grammar check request
   * @param {WebSocket} ws - WebSocket connection
   * @param {object} payload - Request payload
   * @param {string} requestId - Optional request ID for response correlation
   */
  async _handleGrammarCheck(ws, payload, requestId = null) {
    if (!payload || !payload.text) {
      this._logger.warn('Received grammar check request with missing text');
      return this._sendError(ws, 'Missing text to check', requestId);
    }

    const { text, language = 'nb-NO', options = {} } = payload;

    try {
      // Process the grammar check
      this._logger.info(`Processing grammar check for language: ${language}, text length: ${text.length}`);
      
      // Update metrics
      this._metrics.requestsProcessed++;
      this._metrics.lastRequestTime = new Date();
      
      // Get grammar service results
      const startTime = Date.now();
      const results = await this._grammarService.check(text, {
        language,
        includeTokens: options.includeTokens || false,
        includeDetails: options.includeDetails || false
      });
      const processingTime = Date.now() - startTime;
      
      // Update average processing time
      this._metrics.averageProcessingTime = 
        (this._metrics.averageProcessingTime * (this._metrics.requestsProcessed - 1) + processingTime) / 
        this._metrics.requestsProcessed;
      
      this._logger.info(`Grammar check processed in ${processingTime}ms, found ${results.issues ? results.issues.length : 0} issues`);

      // Send the results back
      this._send(ws, {
        type: 'grammar_result',
        payload: results,
        requestId,
        metadata: {
          processingTime,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      this._metrics.errorsEncountered++;
      this._logger.error('Error checking grammar:', err);
      this._sendError(ws, 'Error checking grammar: ' + err.message, requestId);
    }
  }

  /**
   * Send message to client
   * @param {WebSocket} ws - WebSocket connection
   * @param {object} data - Data to send
   */
  _send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        const message = JSON.stringify(data);
        ws.send(message);
      } catch (err) {
        this._metrics.errorsEncountered++;
        this._logger.error('Error stringifying or sending message:', err);
      }
    } else {
      this._logger.warn(`Attempted to send message to client in state: ${ws.readyState}`);
    }
  }

  /**
   * Send error message to client
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} message - Error message
   * @param {string} requestId - Optional request ID for response correlation
   */
  _sendError(ws, message, requestId = null) {
    this._send(ws, {
      type: 'error',
      message,
      requestId,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Get current status of the WebSocket handler
   * @returns {object} Status information
   */
  getStatus() {
    return {
      active: !!this._wss,
      connections: this._clients.size,
      uptime: this._wss ? (Date.now() - this._wss.startTime) : 0,
      metrics: { ...this._metrics }
    };
  }
}

module.exports = GrammarWebSocketHandler;