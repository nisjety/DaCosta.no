// realtime_handler.js
const WebSocket = require('ws');
const axios = require('axios');
const redisPubSub = require('./utils/redis_pubsub');

// Service URLs - configurable via environment variables
const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || 'http://nlp-service:5014';
const SPELLCHECK_SERVICE_URL = process.env.SPELLCHECK_SERVICE_URL || 'http://spellchecker:5011';
const LIX_SERVICE_URL = process.env.LIX_SERVICE_URL || 'http://lix-service:8012';

// Default service timeouts
const DEFAULT_SERVICE_TIMEOUT = 18000; // 18 seconds - increased to accommodate spellcheck
const REQUEST_CLEANUP_DELAY = 30000; // 30 seconds - keep requests around longer

// WebSocket server instance
let wss = null;

// Track client connections
const clients = new Map();

// Track pending requests - simpler structure
const pendingRequests = new Map();

// Track completed requests to handle late responses
const completedRequests = new Map();

// Track service connections (we'll create per-request connections if needed)
const serviceConnections = {
  lix: null,
  spellcheck: null,
  nlp: null
};

/**
 * Initialize the realtime WebSocket handler
 */
function initialize(server) {
  // Create WebSocket server for realtime analysis
  wss = new WebSocket.Server({
    noServer: true,
    clientTracking: true,
  });

  // Set up client connection handling
  wss.on('connection', handleClientConnection);

  // Set up Redis PubSub for service coordination
  setupRedisPubSub();

  // Clean up old completed requests periodically
  setInterval(() => {
    const now = Date.now();
    for (const [requestId, request] of completedRequests.entries()) {
      if (now - request.timestamp > REQUEST_CLEANUP_DELAY) {
        completedRequests.delete(requestId);
      }
    }
  }, 10000);

  console.log('Realtime analysis WebSocket handler initialized on path: /ws/realtime');
  return wss;
}

/**
 * Handle upgrade requests for the realtime WebSocket
 */
function handleUpgrade(request, socket, head) {
  if (!wss) {
    console.error('WebSocket server not initialized');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
}

/**
 * Handle a client WebSocket connection
 */
function handleClientConnection(ws, req) {
  const clientId = Math.random().toString(36).substring(2, 15);
  
  ws.clientId = clientId;
  ws.isAlive = true;
  
  clients.set(clientId, ws);
  
  console.log(`Realtime analysis client connected: ${clientId}`);
  
  // Send connection acknowledgment
  ws.send(JSON.stringify({
    type: 'connection',
    status: 'connected',
    clientId: clientId,
    timestamp: new Date().toISOString()
  }));
  
  // Handle client messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleClientMessage(ws, data);
    } catch (error) {
      console.error('Error parsing client message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid JSON format',
        timestamp: new Date().toISOString()
      }));
    }
  });
  
  // Handle client disconnection
  ws.on('close', () => {
    console.log(`Realtime client disconnected: ${clientId}`);
    clients.delete(clientId);
    
    // Clean up any pending requests for this client
    for (const [requestId, request] of pendingRequests.entries()) {
      if (request.clientId === clientId) {
        if (request.timeout) clearTimeout(request.timeout);
        pendingRequests.delete(requestId);
      }
    }
  });

  // Set up ping/pong
  ws.on('pong', () => {
    ws.isAlive = true;
  });
}

/**
 * Handle a client message
 */
function handleClientMessage(ws, message) {
  if (message.action === 'analyze') {
    handleAnalyzeRequest(ws, message);
  } else if (message.action === 'ping') {
    ws.send(JSON.stringify({
      action: 'pong',
      timestamp: new Date().toISOString()
    }));
  } else {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Unknown action',
      timestamp: new Date().toISOString()
    }));
  }
}

/**
 * Handle an analyze request from client
 */
async function handleAnalyzeRequest(ws, message) {
  const text = message.text;
  const options = message.options || {};
  
  if (!text) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'No text provided',
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  // Generate request ID
  const clientId = ws.clientId;
  const timestamp = Date.now();
  const requestId = `${clientId}-${timestamp}`;
  
  // Create pending request tracking - include sentiment and other AI services
  const pendingRequest = {
    clientId,
    timestamp,
    text,
    services: new Set(['spellcheck', 'lix', 'sentiment', 'summary']), // Add summary service
    results: {},
    timeout: null,
    completed: false
  };
  
  // Detect language automatically if not specified in options
  const language = options.language || (text.toLowerCase().includes('norwegian') ? 'norwegian' : 'english');
  
  // Override options with detected language
  const enhancedOptions = {
    ...options,
    language: language
  };
  
  pendingRequests.set(requestId, pendingRequest);
  
  // Notify client that analysis has started
  ws.send(JSON.stringify({
    type: 'analysis_started',
    requestId,
    services: Array.from(pendingRequest.services),
    timestamp: new Date().toISOString()
  }));
  
  // Set timeout for partial results
  pendingRequest.timeout = setTimeout(() => {
    handleRequestTimeout(requestId);
  }, DEFAULT_SERVICE_TIMEOUT);
  
  // Call services
  callSpellcheckService(requestId, text, enhancedOptions);
  callLixService(requestId, text, enhancedOptions);
  callSentimentService(requestId, text, enhancedOptions); // Add sentiment analysis
  callSummaryService(requestId, text, enhancedOptions); // Add summary service
}

/**
 * Call spellcheck service
 */
async function callSpellcheckService(requestId, text, options) {
  const request = pendingRequests.get(requestId) || completedRequests.get(requestId);
  if (!request) return;

  try {
    // Use the language from options, defaulting to 'english' for better compatibility with the text shown
    const language = options.language || 'english';
    const dialectSettings = options.dialectSettings || { gb: true, us: true };
    
    // Use the correct endpoint based on language
    const endpoint = language === 'norwegian' ? 
      '/api/v1/norwegian/check-text' : 
      '/api/v1/english/check-text';
    
    const url = `${SPELLCHECK_SERVICE_URL}${endpoint}`;
    console.log(`Making HTTP request to: ${url} for language: ${language}`);
    
    const response = await axios.post(url, {
      text,
      dialectSettings
    }, {
      timeout: 15000 // Increase timeout to 15 seconds for spellcheck
    });
    
    // Handle the response
    handleServiceResponse('spellcheck', requestId, response.data);
    
  } catch (error) {
    console.error(`spellcheck service error: ${error.message}`);
    console.error(`Full error:`, error.response?.data || error);
    handleServiceResponse('spellcheck', requestId, {
      error: error.response?.data?.error || error.message,
      status: error.response?.status,
      success: false
    });
  }
}

/**
 * Call LIX service
 */
async function callLixService(requestId, text, options) {
  const request = pendingRequests.get(requestId) || completedRequests.get(requestId);
  if (!request) return;

  try {
    // Try without /api prefix as the service might not use it
    const url = `${LIX_SERVICE_URL}/analyze`;
    console.log(`Making HTTP request to: ${url}`);
    
    const response = await axios.post(url, {
      text,
      include_word_analysis: options.include_word_analysis !== false,
      include_sentence_analysis: options.include_sentence_analysis !== false
    }, {
      timeout: 10000 // 10 second timeout for LIX
    });
    
    // Handle the response
    handleServiceResponse('lix', requestId, response.data);
    
  } catch (error) {
    console.error(`LIX service error: ${error.message}`);
    console.error(`Full error:`, error.response?.data || error);
    handleServiceResponse('lix', requestId, {
      error: error.response?.data?.error || error.message,
      status: error.response?.status,
      success: false
    });
  }
}

/**
 * Call AI sentiment service
 */
async function callSentimentService(requestId, text, options) {
  const request = pendingRequests.get(requestId) || completedRequests.get(requestId);
  if (!request) return;

  try {
    const url = `${NLP_SERVICE_URL}/api/sentiment`;
    console.log(`Making HTTP request to: ${url}`);
    
    const response = await axios.post(url, {
      text
    }, {
      timeout: 10000 // 10 second timeout for sentiment
    });
    
    // Handle the response
    handleServiceResponse('sentiment', requestId, response.data);
    
  } catch (error) {
    console.error(`sentiment service error: ${error.message}`);
    handleServiceResponse('sentiment', requestId, {
      error: error.message,
      success: false
    });
  }
}

/**
 * Handle a service response
 */
function handleServiceResponse(serviceType, requestId, data) {
  // Check both pending and completed requests
  let request = pendingRequests.get(requestId);
  let wasCompleted = false;
  
  if (!request) {
    request = completedRequests.get(requestId);
    wasCompleted = true;
  }
  
  if (!request) {
    console.warn(`Received ${serviceType} response for unknown request ID: ${requestId}`);
    return;
  }
  
  // Store result
  if (!request.results) {
    request.results = {};
  }
  
  request.results[serviceType] = data;
  
  // Mark service as completed
  request.services.delete(serviceType);
  
  console.log(`Received response from ${serviceType} for request ${requestId}. Services remaining: ${request.services.size}`);
  
  // If this was a completed request with late response, send an update
  if (wasCompleted && !request.updateSent) {
    sendLateUpdateToClient(request.clientId, requestId, serviceType, data);
    request.updateSent = true;
  }
  
  // If all services have responded or timeout occurred, send aggregated result
  if (!wasCompleted && (request.services.size === 0 || request.timedOut)) {
    sendAggregatedResponse(requestId);
  }
}

/**
 * Handle request timeout
 */
function handleRequestTimeout(requestId) {
  const request = pendingRequests.get(requestId);
  
  if (!request || request.completed) return;
  
  request.timedOut = true;
  
  console.log(`Timeout reached for request ${requestId}. Sending partial response.`);
  
  sendAggregatedResponse(requestId);
}

/**
 * Send aggregated response to client
 */
function sendAggregatedResponse(requestId) {
  const request = pendingRequests.get(requestId);
  
  if (!request) return;
  
  // Check if client is still connected
  const clientWs = clients.get(request.clientId);
  if (!clientWs || clientWs.readyState !== WebSocket.OPEN) {
    pendingRequests.delete(requestId);
    return;
  }
  
  // Prepare response
  const response = {
    type: 'analysis_result',
    requestId,
    partial: request.services.size > 0,
    text: request.text,
    timestamp: new Date().toISOString(),
    services: {}
  };
  
  // Include all collected results
  if (request.results.spellcheck) {
    response.services.spellcheck = request.results.spellcheck;
  } else if (request.services.has('spellcheck')) {
    // Service didn't respond in time
    response.services.spellcheck = {
      error: 'Service timeout',
      success: false
    };
  }
  
  if (request.results.lix) {
    response.services.lix = request.results.lix;
  } else if (request.services.has('lix')) {
    // Service didn't respond in time
    response.services.lix = {
      error: 'Service timeout',
      success: false
    };
  }
  
  // Include AI services results
  if (request.results.sentiment || request.results.summary) {
    // Format the AI results in the expected structure
    response.services.ai = {};
    
    if (request.results.sentiment) {
      response.services.ai.sentiment = request.results.sentiment;
    } else if (request.services.has('sentiment')) {
      // Service didn't respond in time
      response.services.ai.sentiment = {
        error: 'Service timeout',
        success: false
      };
    }
    
    if (request.results.summary) {
      response.services.ai.summary = request.results.summary;
    } else if (request.services.has('summary')) {
      // Service didn't respond in time
      response.services.ai.summary = {
        error: 'Service timeout',
        success: false
      };
    }
  }
  
  if (request.services.size > 0) {
    response.missingServices = Array.from(request.services);
  }
  
  // Send response
  clientWs.send(JSON.stringify(response));
  
  // Mark as completed but keep in memory for late responses
  request.completed = true;
  
  // Clean up timeout
  if (request.timeout) {
    clearTimeout(request.timeout);
  }
  
  // Move to completed requests
  pendingRequests.delete(requestId);
  completedRequests.set(requestId, request);
}

/**
 * Send late update to client
 */
function sendLateUpdateToClient(clientId, requestId, serviceType, data) {
  const clientWs = clients.get(clientId);
  if (!clientWs || clientWs.readyState !== WebSocket.OPEN) {
    return;
  }
  
  const update = {
    type: 'analysis_update',
    requestId,
    serviceType,
    data,
    timestamp: new Date().toISOString()
  };
  
  clientWs.send(JSON.stringify(update));
  console.log(`Sent late update for ${serviceType} to client ${clientId}`);
}

/**
 * Setup Redis PubSub
 */
function setupRedisPubSub() {
  const channels = redisPubSub.getChannels();
  
  // Subscribe to heartbeat channel
  redisPubSub.subscribe(channels.HEARTBEAT, (message) => {
    try {
      const data = JSON.parse(message);
      if (data.service && data.status) {
        console.log(`Service heartbeat: ${data.service} - ${data.status}`);
      }
    } catch (error) {
      console.error('Error processing heartbeat message:', error);
    }
  });
}

/**
 * Start heartbeat mechanism
 */
function startHeartbeat() {
  // Ping all connected clients periodically
  const interval = setInterval(() => {
    for (const [clientId, ws] of clients.entries()) {
      if (ws.isAlive === false) {
        console.log(`Client ${clientId} is not responding, terminating connection`);
        ws.terminate();
        clients.delete(clientId);
      } else {
        ws.isAlive = false;
        ws.ping(() => {});
      }
    }
  }, 30000);
  
  return interval;
}

/**
 * Call AI summary service
 */
async function callSummaryService(requestId, text, options) {
  const request = pendingRequests.get(requestId) || completedRequests.get(requestId);
  if (!request) return;

  try {
    const url = `${NLP_SERVICE_URL}/api/summarize`;
    console.log(`Making HTTP request to: ${url}`);
    
    // Summary options
    const summaryOptions = {
      text,
      maxLength: options.maxLength || 200,
      type: options.type || 'concise'
    };
    
    const response = await axios.post(url, summaryOptions, {
      timeout: 10000 // 10 second timeout for summary
    });
    
    // Handle the response
    handleServiceResponse('summary', requestId, response.data);
    
  } catch (error) {
    console.error(`summary service error: ${error.message}`);
    handleServiceResponse('summary', requestId, {
      error: error.message,
      success: false
    });
  }
}

/**
 * Close handler
 */
function close() {
  if (wss) {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1000, 'Server shutting down');
      }
    });
    
    wss.close();
    console.log('Realtime analysis WebSocket server closed');
  }
  
  // Clear any pending requests
  for (const [requestId, request] of pendingRequests.entries()) {
    if (request.timeout) {
      clearTimeout(request.timeout);
    }
  }
  pendingRequests.clear();
  completedRequests.clear();
  clients.clear();
}

// Export handler functions
module.exports = {
  initialize,
  close,
  handleUpgrade,
  handleServiceResponse,
  startHeartbeat
};