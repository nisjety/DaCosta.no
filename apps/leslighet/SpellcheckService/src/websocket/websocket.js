// src/websocket/websocket.js
const WebSocket = require("ws");
const NorwegianSpellChecker = require("../services/NorwegianSpellChecker");
const EnglishSpellChecker = require("../services/EnglishSpellChecker");
const RedisPubSubAdapter = require("../adapters/RedisPubSubAdapter");

let wss = null;

/**
 * Set up WebSocket server with the HTTP server
 * @param {Object} server HTTP server instance
 */
function setup(server, wsPath) {
  const WS_PATH = wsPath || '/api/ws'; // Dedicated WebSocket path
  console.log(`Setting up WebSocket server on path: ${WS_PATH}`);
  
  wss = new WebSocket.Server({ 
    server, 
    path: WS_PATH,
    // Increase timeout for better reliability
    clientTracking: true,
    perMessageDeflate: {
      zlibDeflateOptions: {
        chunkSize: 1024,
        memLevel: 7,
        level: 3
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024
      },
      concurrencyLimit: 10,
      threshold: 1024
    }
  });

  // Set up heartbeat mechanism to detect dead connections
  function heartbeat() {
    this.isAlive = true;
  }
  
  // Handle WebSocket connection and authenticate
  wss.on("connection", async (ws, req) => {
    // Set up user info without authentication
    ws.user = { id: 'anonymous', authenticated: false };
    ws.isAlive = true;
    ws.on('pong', heartbeat);
    
    // Store connection metadata
    ws.connectionTime = new Date();
    ws.preferredLanguage = 'norwegian';
    
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`WebSocket client connected from ${ip}`);

    ws.on("message", async (message) => {
      try {
        // Convert Buffer to string if needed
        const messageStr = message instanceof Buffer 
          ? message.toString() 
          : message;
          
        const parsedMessage = JSON.parse(messageStr);
        
        // Handle different types of requests
        if (parsedMessage.action === "setLanguage") {
          // Store language preference
          ws.preferredLanguage = parsedMessage.language || 'norwegian';
          
          console.log(`Client set language preference to: ${ws.preferredLanguage}`);
          
          // Return success response
          ws.send(JSON.stringify({
            success: true,
            action: "setLanguage",
            language: ws.preferredLanguage,
            requestId: parsedMessage.requestId
          }));
          
        } else if (parsedMessage.action === "checkText") {
          // Handle full text spell checking
          await handleCheckText(ws, parsedMessage);
        } else if (parsedMessage.action === "feedback") {
          // Handle user feedback on words
          await handleFeedback(ws, parsedMessage);
        } else if (parsedMessage.action === "setDialects") {
          // Handle dialect settings
          await handleSetDialects(ws, parsedMessage);
        } else if (parsedMessage.action === "getDialects") {
          // Get current dialect settings
          handleGetDialects(ws, parsedMessage);
        } else if (parsedMessage.word) {
          // Handle single word checking (backward compatibility)
          await handleCheckWord(ws, parsedMessage);
        } else if (parsedMessage.action === "ping") {
          // Simple ping/pong for connection testing
          ws.send(JSON.stringify({ 
            action: "pong",
            timestamp: new Date().toISOString(),
            requestId: parsedMessage.requestId
          }));
        } else if (parsedMessage.action === "getUserInfo") {
          // Return user info (for client-side verification)
          ws.send(JSON.stringify({
            action: "userInfo",
            user: {
              id: ws.user.id,
              authenticated: ws.user.authenticated,
              roles: ws.user.roles || []
            },
            requestId: parsedMessage.requestId
          }));
        } else {
          ws.send(JSON.stringify({ 
            type: "error",
            message: "Invalid request format",
            errors: [],
            requestId: parsedMessage.requestId
          }));
        }
      } catch (err) {
        console.error("Error processing message:", err);
        ws.send(JSON.stringify({ 
          type: "error",
          message: "Internal server error",
          errors: []
        }));
      }
    });

    ws.on("close", () => {
      const duration = Math.round((new Date() - ws.connectionTime) / 1000);
      console.log(`WebSocket client disconnected - user: ${ws.user.id}, duration: ${duration}s`);
    });
    
    // Send initial connection acknowledgment
    ws.send(JSON.stringify({
      type: "connection",
      status: "connected",
      authenticated: false,
      timestamp: new Date().toISOString(),
      server: "spellchecker-api",
      version: process.env.npm_package_version || "1.0.0"
    }));
  });

  // Setup interval to check for dead connections
  const interval = setInterval(function ping() {
    wss.clients.forEach(function each(ws) {
      if (ws.isAlive === false) return ws.terminate();
      
      ws.isAlive = false;
      ws.ping(() => {});
    });
  }, 30000);
  
  wss.on('close', function close() {
    clearInterval(interval);
  });

  console.log("WebSocket server started");
  
  // Set up Redis Pub/Sub handler for incoming requests
  setupRedisPubSub();
  
  return wss;
}

/**
 * Set up Redis Pub/Sub to handle requests from the Gateway
 */
async function setupRedisPubSub() {
  try {
    await RedisPubSubAdapter.connect();
    
    // Subscribe to requests
    await RedisPubSubAdapter.subscribeToRequests(async (data) => {
      try {
        // Process the request based on content type
        const { clientId, content } = data;
        
        if (!content || !clientId) {
          console.error('Invalid request format, missing clientId or content');
          return;
        }
        
        // Extract requestId if available
        const requestId = content.requestId;
        
        // Determine if this is a text check, word check, or something else
        if (content.text && typeof content.text === 'string') {
          // Full text check
          const targetLanguage = content.language || 'norwegian';
          const dialectSettings = content.dialectSettings;
          
          // Select appropriate spellchecker
          const spellChecker = targetLanguage === 'english' ? 
            EnglishSpellChecker : NorwegianSpellChecker;
          
          // Apply dialect settings if provided
          if (dialectSettings) {
            spellChecker.setDialects(dialectSettings);
          }
          
          // Check text
          const result = await spellChecker.checkText(content.text);
          
          // Add response metadata
          result.language = targetLanguage;
          result.dialectSettings = spellChecker.dialectSettings;
          result.requestId = requestId;
          
          // Publish result back to Redis
          await RedisPubSubAdapter.publishResult({
            clientId,
            content: result
          });
        } else if (content.word && typeof content.word === 'string') {
          // Single word check
          const targetLanguage = content.language || 'norwegian';
          const dialectSettings = content.dialectSettings;
          
          // Select appropriate spellchecker
          const spellChecker = targetLanguage === 'english' ? 
            EnglishSpellChecker : NorwegianSpellChecker;
          
          // Apply dialect settings if provided
          if (dialectSettings) {
            spellChecker.setDialects(dialectSettings);
          }
          
          // Check word
          const result = await spellChecker.checkWord(content.word);
          
          // Add response metadata
          result.language = targetLanguage;
          result.dialectSettings = spellChecker.dialectSettings;
          result.word = content.word;
          result.requestId = requestId;
          
          // Publish result back to Redis
          await RedisPubSubAdapter.publishResult({
            clientId,
            content: result
          });
        } else if (content.action === 'feedback' && content.word) {
          // Handle feedback
          const targetLanguage = content.language || 'norwegian';
          const spellChecker = targetLanguage === 'english' ? 
            EnglishSpellChecker : NorwegianSpellChecker;
            
          const feedbackResult = await spellChecker.processFeedback(
            content.word,
            content.isCorrect === true,
            content.userId || 'anonymous'
          );
          
          // Publish result back to Redis
          await RedisPubSubAdapter.publishResult({
            clientId,
            content: {
              ...feedbackResult,
              language: targetLanguage,
              requestId: requestId
            }
          });
        } else if (content.action === 'getDialects') {
          // Handle dialect settings request
          const targetLanguage = content.language || 'norwegian';
          const spellChecker = targetLanguage === 'english' ? 
            EnglishSpellChecker : NorwegianSpellChecker;
            
          // Publish result back to Redis
          await RedisPubSubAdapter.publishResult({
            clientId,
            content: {
              success: true,
              language: targetLanguage,
              dialectSettings: spellChecker.dialectSettings,
              requestId: requestId
            }
          });
        } else if (content.action === 'setDialects') {
          // Handle dialect settings update
          const targetLanguage = content.language || 'norwegian';
          const spellChecker = targetLanguage === 'english' ? 
            EnglishSpellChecker : NorwegianSpellChecker;
            
          // Update dialect settings
          const settings = {};
          if (targetLanguage === 'english') {
            if (typeof content.gb === 'boolean') settings.gb = content.gb;
            if (typeof content.us === 'boolean') settings.us = content.us;
          } else {
            if (typeof content.nb === 'boolean') settings.nb = content.nb;
            if (typeof content.nn === 'boolean') settings.nn = content.nn;
          }
          
          const success = spellChecker.setDialects(settings);
          
          // Publish result back to Redis
          await RedisPubSubAdapter.publishResult({
            clientId,
            content: {
              success,
              language: targetLanguage,
              dialectSettings: spellChecker.dialectSettings,
              requestId: requestId
            }
          });
        } else {
          console.warn('Unhandled request type:', content);
          // Publish error response
          await RedisPubSubAdapter.publishResult({
            clientId,
            content: {
              success: false,
              error: 'Unsupported request type',
              requestId: requestId
            }
          });
        }
      } catch (error) {
        console.error('Error processing Redis request:', error);
        
        // Publish error response
        if (data && data.clientId) {
          await RedisPubSubAdapter.publishResult({
            clientId: data.clientId,
            content: {
              success: false,
              error: 'Internal server error',
              requestId: data.content?.requestId
            }
          });
        }
      }
    });
    
    console.log('Redis Pub/Sub handler initialized');
  } catch (error) {
    console.error('Failed to set up Redis Pub/Sub:', error);
  }
}

/**
 * Determine if an action requires authentication
 * @param {string} action - Action name
 * @returns {boolean} True if authentication is required
 */
function isAuthRequiredForAction(action) {
  // For simplicity, all actions public for now
  return false;
}

/**
 * Handle a request to check text for spelling errors
 */
async function handleCheckText(ws, message) {
  const { text, dialectSettings, language, requestId } = message;
  
  // Use explicit language parameter or fallback to connection preference
  const targetLanguage = language || ws.preferredLanguage || 'norwegian';
  
  // Select the appropriate spellchecker service
  const spellChecker = targetLanguage === 'english' ? 
    EnglishSpellChecker : NorwegianSpellChecker;
  
  // Apply dialect settings if provided
  if (dialectSettings) {
    spellChecker.setDialects(dialectSettings);
  }
  
  if (!text || typeof text !== 'string') {
    ws.send(JSON.stringify({ 
      type: "spelling",
      language: targetLanguage,
      errors: [],
      dialectSettings: spellChecker.dialectSettings,
      requestId: requestId
    }));
    return;
  }
  
  const startTime = Date.now();
  const result = await spellChecker.checkText(text);
  const endTime = Date.now();
  
  // Add performance metrics for monitoring
  const response = {
    type: "spelling",
    ...result,
    language: targetLanguage,
    dialectSettings: spellChecker.dialectSettings,
    requestId: requestId,
    meta: {
      processingTime: endTime - startTime,
      textLength: text.length,
      errorCount: result.errors ? result.errors.length : 0,
      timestamp: new Date().toISOString()
    }
  };
  
  ws.send(JSON.stringify(response));
}

/**
 * Handle a request to check a single word
 */
async function handleCheckWord(ws, message) {
  const { word, dialectSettings, language, requestId } = message;
  
  // Use explicit language parameter or fallback to connection preference
  const targetLanguage = language || ws.preferredLanguage || 'norwegian';
  
  // Select the appropriate spellchecker service
  const spellChecker = targetLanguage === 'english' ? 
    EnglishSpellChecker : NorwegianSpellChecker;
  
  // Apply dialect settings if provided
  if (dialectSettings) {
    spellChecker.setDialects(dialectSettings);
  }
  
  const result = await spellChecker.checkWord(word);
  
  // Format response to be compatible with both old and new clients
  const response = {
    ...result,
    type: "spelling",
    language: targetLanguage,
    word,
    dialectSettings: spellChecker.dialectSettings,
    requestId: requestId
  };
  
  ws.send(JSON.stringify(response));
}

/**
 * Handle user feedback on words
 */
async function handleFeedback(ws, message) {
  const { word, isCorrect, userId, language, requestId } = message;
  
  // Use explicit language parameter or fallback to connection preference
  const targetLanguage = language || ws.preferredLanguage || 'norwegian';
  
  // Select the appropriate spellchecker service
  const spellChecker = targetLanguage === 'english' ? 
    EnglishSpellChecker : NorwegianSpellChecker;
  
  if (!word || typeof word !== 'string') {
    ws.send(JSON.stringify({ 
      success: false, 
      error: 'Invalid word',
      language: targetLanguage,
      requestId: requestId
    }));
    return;
  }
  
  // Use authenticated user ID if available, otherwise use provided or anonymous
  const feedbackUserId = ws.user.authenticated ? ws.user.id : (userId || 'anonymous');
  
  const result = await spellChecker.processFeedback(
    word, 
    isCorrect === true, // Ensure boolean
    feedbackUserId
  );
  
  // Add language and requestId to response
  ws.send(JSON.stringify({
    ...result,
    language: targetLanguage,
    requestId: requestId
  }));
}

/**
 * Handle setting dialect preferences
 */
async function handleSetDialects(ws, message) {
  const { language, requestId, ...dialectSettings } = message;
  
  // Use explicit language parameter or fallback to connection preference
  const targetLanguage = language || ws.preferredLanguage || 'norwegian';
  
  // Select the appropriate spellchecker service
  const spellChecker = targetLanguage === 'english' ? 
    EnglishSpellChecker : NorwegianSpellChecker;
  
  // For English
  if (targetLanguage === 'english') {
    const { gb, us } = dialectSettings;
    
    if (typeof gb !== 'boolean' && typeof us !== 'boolean') {
      ws.send(JSON.stringify({ 
        success: false, 
        error: 'Invalid dialect settings. Provide at least one of: gb, us',
        language: 'english',
        requestId: requestId
      }));
      return;
    }
    
    const settings = {};
    if (typeof gb === 'boolean') settings.gb = gb;
    if (typeof us === 'boolean') settings.us = us;
    
    const success = spellChecker.setDialects(settings);
    
    ws.send(JSON.stringify({
      success,
      language: 'english',
      dialectSettings: spellChecker.dialectSettings,
      requestId: requestId
    }));
  } 
  // For Norwegian
  else {
    const { nb, nn } = dialectSettings;
    
    if (typeof nb !== 'boolean' && typeof nn !== 'boolean') {
      ws.send(JSON.stringify({ 
        success: false, 
        error: 'Invalid dialect settings. Provide at least one of: nb, nn',
        language: 'norwegian',
        requestId: requestId
      }));
      return;
    }
    
    const settings = {};
    if (typeof nb === 'boolean') settings.nb = nb;
    if (typeof nn === 'boolean') settings.nn = nn;
    
    const success = spellChecker.setDialects(settings);
    
    ws.send(JSON.stringify({
      success,
      language: 'norwegian',
      dialectSettings: spellChecker.dialectSettings,
      requestId: requestId
    }));
  }
}

/**
 * Handle getting current dialect settings
 */
function handleGetDialects(ws, message) {
  const targetLanguage = message?.language || ws.preferredLanguage || 'norwegian';
  const requestId = message?.requestId;
  
  const spellChecker = targetLanguage === 'english' ? 
    EnglishSpellChecker : NorwegianSpellChecker;
  
  ws.send(JSON.stringify({
    success: true,
    language: targetLanguage,
    dialectSettings: spellChecker.dialectSettings,
    requestId: requestId
  }));
}

/**
 * Close the WebSocket server
 */
function close() {
  if (wss) {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1000, 'Server shutting down');
      }
    });
    
    wss.close(() => {
      console.log("WebSocket server closed");
    });
  }
  
  // Close Redis PubSub
  RedisPubSubAdapter.close().catch(err => {
    console.error('Error closing Redis PubSub:', err);
  });
}

module.exports = {
  setup,
  close
};