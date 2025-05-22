// ReadabilityGateway/app.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const redisPubSub = require('./utils/redis_pubsub');
const path = require('path');
// Import the realtime analysis handler
const realtimeHandler = require('./realtime_handler');

const app = express();
const PORT = process.env.PORT || 5010;
const HOST = process.env.HOST || '0.0.0.0';

// Service URLs - configurable via environment variables
const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || 'http://nlp-service:5014';
const SPELLCHECK_SERVICE_URL = process.env.SPELLCHECK_SERVICE_URL || 'http://spellchecker:5011';
const LIX_SERVICE_URL = process.env.LIX_SERVICE_URL || 'http://lix-service:8012';

// CORS configuration for both HTTP and WebSocket
const corsOptions = {
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Access-Control-Allow-Headers']
};

app.use(cors(corsOptions));

// Parse JSON bodies for API requests
app.use(express.json());

// Add WebSocket specific headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.headers.origin) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  }
  next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Create API proxies for all services
// NLP Service proxy - handles sentiment, summarization, and text correction
app.use('/api/ai', createProxyMiddleware({
  target: NLP_SERVICE_URL,
  pathRewrite: {
    '^/api/ai/sentiment': '/api/sentiment',
    '^/api/ai/summarize': '/api/summarize',
    '^/api/ai/correct': '/api/correct',
    '^/api/ai': '/api'
  },
  changeOrigin: true,
  logLevel: 'warn',
  onError: (err, req, res) => {
    console.error('NLP service proxy error:', err);
    res.status(500).json({ 
      error: 'NLP service unavailable', 
      message: err.message 
    });
  }
}));

// Text transformation proxy - handles all transformation endpoints
app.use('/api/transform', createProxyMiddleware({
  target: NLP_SERVICE_URL,
  pathRewrite: {
    '^/api/transform': '/api'
  },
  changeOrigin: true,
  logLevel: 'warn',
  onProxyReq: (proxyReq, req, res) => {
    // Make sure the body is properly formatted
    if (req.body && typeof req.body === 'object') {
      const contentType = proxyReq.getHeader('Content-Type');
      const writeBody = (bodyData) => {
        // Update content-length header
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        // Write body data to the proxied request
        proxyReq.write(bodyData);
        proxyReq.end();
      };
      
      if (contentType && contentType.includes('application/json')) {
        writeBody(JSON.stringify(req.body));
      }
    }
  },
  onError: (err, req, res) => {
    console.error('Transform proxy error:', err);
    res.status(500).json({ 
      error: 'Transform service unavailable', 
      message: err.message,
      service: 'nlp-transform'
    });
  }
}));

// Spellcheck service proxy
app.use('/api/spellcheck', createProxyMiddleware({
  target: SPELLCHECK_SERVICE_URL,
  pathRewrite: {
    '^/api/spellcheck': '/api'
  },
  changeOrigin: true,
  logLevel: 'warn',
  onError: (err, req, res) => {
    console.error('Spellcheck proxy error:', err);
    res.status(500).json({ 
      error: 'Spellcheck service unavailable', 
      message: err.message 
    });
  }
}));


// LIX service proxy
app.use('/api/lix', createProxyMiddleware({
  target: LIX_SERVICE_URL,
  pathRewrite: {
    '^/api/lix': '/api'
  },
  changeOrigin: true,
  logLevel: 'warn',
  onError: (err, req, res) => {
    console.error('LIX proxy error:', err);
    res.status(500).json({ 
      error: 'LIX service unavailable', 
      message: err.message 
    });
  }
}));

// Simple health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'readability-gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root route with basic info
app.get('/', (req, res) => {
  if (req.headers['user-agent']?.includes('Mozilla')) {
    // Browser request - redirect to client example
    res.redirect('/client-example.html');
  } else {
    // API client - return basic info
    res.json({
      service: 'Readability Gateway',
      description: 'API Gateway and WebSocket Service for Readability and NLP Services',
      version: '3.0.0',
      websocket: `ws://${req.get('host')}/ws`,
      realtimeWebsocket: `ws://${req.get('host')}/ws/realtime`,
      nlpWebsockets: {
        sentiment: `ws://${req.get('host')}/ws/ai/sentiment`,
        summarize: `ws://${req.get('host')}/ws/ai/summarize`,
        correct: `ws://${req.get('host')}/ws/ai/correct`
      },
      spellcheckWebsocket: `ws://${req.get('host')}/ws/spellcheck`,
      apiEndpoints: {
        nlp: {
          sentiment: '/api/ai/sentiment',
          summarize: '/api/ai/summarize',
          correct: '/api/ai/correct'
        },
        transform: {
          readability: '/api/transform/readability',
          feedback: '/api/transform/feedback',
          style: '/api/transform/style',
          restructure: '/api/transform/restructure',
          intent: '/api/transform/intent',
          educational: '/api/transform/educational',
          translate: '/api/transform/translate'
        },
        spellcheck: '/api/spellcheck',
        lix: '/api/lix'
      },
      health: `/health`,
      demos: {
        client_example: `/client-example.html`,
        realtime: `/realtime-demo.html`,
        text_transformations: `/text-transformations.html`,
        ai_interface: `/ai-interface.html`
      }
    });
  }
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket servers
const wss = new WebSocket.Server({ 
  noServer: true,  // Don't attach to server automatically
  clientTracking: true
});

// Map of target WebSocket servers
const wsTargets = {
  '/ws/ai': `${NLP_SERVICE_URL.replace('http://', 'ws://')}/ws/grammar`,  // NLP service WebSocket endpoint
  '/ws/spellcheck': `${SPELLCHECK_SERVICE_URL.replace('http://', 'ws://')}/api/ws`
};

// WebSocket proxy function that handles AI message transformation
function proxyWebSocket(request, socket, head, targetUrl, serviceType = null) {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  
  const ws = new WebSocket(targetUrl, {
    headers: request.headers
  });

  ws.on('open', () => {
    const clientWs = new WebSocket.Server({ noServer: true });
    clientWs.handleUpgrade(request, socket, head, (clientSocket) => {
      // For AI services, we need to transform the message format
      if (serviceType) {
        clientSocket.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            
            // Transform the message to match what AI service expects
            const aiMessage = {
              type: serviceType,  // 'sentiment', 'summarize', 'correct', or 'chat'
              payload: message.payload || message,
              requestId: message.requestId
            };
            
            console.log(`Transforming message for ${serviceType}:`, aiMessage);
            ws.send(JSON.stringify(aiMessage));
          } catch (error) {
            console.error('Error transforming AI message:', error);
            ws.send(data);  // Send as-is if parsing fails
          }
        });
        
        ws.on('message', (data) => {
          try {
            const response = JSON.parse(data);
            
            // The AI service already includes the correct response type
            // Just forward it to the client
            clientSocket.send(JSON.stringify(response));
          } catch (error) {
            console.error('Error parsing AI response:', error);
            clientSocket.send(data);  // Send as-is if parsing fails
          }
        });
      } else {
        // For non-AI services, just pipe through
        ws.on('message', (data) => clientSocket.send(data));
        clientSocket.on('message', (data) => ws.send(data));
      }
      
      // Connect the two WebSockets
      ws.on('close', () => clientSocket.close());
      ws.on('error', (err) => {
        console.error('Target WebSocket error:', err);
        clientSocket.close();
      });
      
      clientSocket.on('close', () => ws.close());
      clientSocket.on('error', (err) => {
        console.error('Client WebSocket error:', err);
        ws.close();
      });
    });
  });

  ws.on('error', (error) => {
    console.error('Error connecting to target WebSocket:', error);
    socket.destroy();
  });
}

// Handle upgrade requests
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  const origin = request.headers.origin || '*';

  if (pathname === '/ws/realtime') {
    // Let the realtime handler handle its own upgrades
    realtimeHandler.handleUpgrade(request, socket, head);
  } else if (pathname === '/ws') {
    // Handle main WebSocket upgrades
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else if (pathname.startsWith('/ws/ai/')) {
    // Handle all NLP service WebSocket upgrades by proxying to the single NLP endpoint
    const serviceType = pathname.replace('/ws/ai/', '');
    console.log(`Proxying NLP WebSocket connection ${pathname} to ${wsTargets['/ws/ai']} with service type: ${serviceType}`);
    proxyWebSocket(request, socket, head, wsTargets['/ws/ai'], serviceType);
  } else if (pathname === '/ws/spellcheck') {
    // Handle spellcheck WebSocket upgrade
    console.log(`Proxying WebSocket connection to ${wsTargets[pathname]}`);
    proxyWebSocket(request, socket, head, wsTargets[pathname]);
  } else {
    // Invalid WebSocket path
    console.log(`Invalid WebSocket path: ${pathname}`);
    socket.destroy();
  }
});

// Track active connections by client ID
const clients = new Map();

// Set up heartbeat mechanism
function heartbeat() {
  this.isAlive = true;
}

// Client session class to manage client subscriptions
class ClientSession {
  constructor(ws, id) {
    this.ws = ws;
    this.id = id;
    this.subscriptions = new Set(); // Track which services this client is subscribed to
    this.isAlive = true;
  }
  
  // Send message to this client
  send(data) {
    if (this.ws.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      this.ws.send(message);
      return true;
    }
    return false;
  }
  
  // Subscribe to a service
  subscribe(service) {
    this.subscriptions.add(service);
  }
  
  // Unsubscribe from a service
  unsubscribe(service) {
    this.subscriptions.delete(service);
  }
  
  // Check if subscribed to a service
  isSubscribedTo(service) {
    return this.subscriptions.has(service);
  }
}

// Handle WebSocket connections
wss.on('connection', async (ws, req) => {
  // Generate a unique client ID
  const clientId = Math.random().toString(36).substring(2, 15);
  const clientSession = new ClientSession(ws, clientId);
  
  // Store client session
  clients.set(clientId, clientSession);
  console.log(`WebSocket client connected: ${clientId}`);
  
  // Set up heartbeat
  ws.isAlive = true;
  ws.on('pong', heartbeat);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connection',
    clientId: clientId,
    status: 'connected',
    message: 'Connected to Readability Gateway'
  }));
  
  // Handle messages from client
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      // Handle service subscriptions
      if (data.action === 'subscribe') {
        const service = data.service?.toLowerCase();
        if (service) {
          clientSession.subscribe(service);
          ws.send(JSON.stringify({
            type: 'subscription',
            status: 'subscribed',
            service: service
          }));
        }
      } 
      // Handle service unsubscriptions
      else if (data.action === 'unsubscribe') {
        const service = data.service?.toLowerCase();
        if (service) {
          clientSession.unsubscribe(service);
          ws.send(JSON.stringify({
            type: 'subscription',
            status: 'unsubscribed',
            service: service
          }));
        }
      }
      // Handle service requests
      else if (data.action === 'request') {
        const service = data.service?.toLowerCase();
        const content = data.content;
        
        if (!service || !content) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid request format. Missing service or content.'
          }));
          return;
        }
        
        // Publish the request to the appropriate Redis channel
        const channels = redisPubSub.getChannels();
        let channel;
        
        switch (service) {
          case 'spellcheck':
            channel = channels.SPELLCHECK;
            break;
          case 'lix':
            channel = channels.LIX;
            break;
          case 'nlp':
            channel = channels.AI; // Keeping the same channel for backward compatibility
            break;
          case 'ai': // For backward compatibility
            channel = channels.AI;
            break;
          default:
            ws.send(JSON.stringify({
              type: 'error',
              message: `Unknown service: ${service}`
            }));
            return;
        }
        
        // Auto-subscribe client to the service
        clientSession.subscribe(service);
        
        // Include client ID with request so service can route response
        await redisPubSub.publish(channel, {
          clientId: clientId,
          content: content,
          timestamp: new Date().toISOString()
        });
        
        ws.send(JSON.stringify({
          type: 'request',
          status: 'sent',
          service: service,
          requestId: data.requestId || null
        }));
      }
      // Handle ping request
      else if (data.action === 'ping') {
        ws.send(JSON.stringify({
          action: 'pong',
          timestamp: new Date().toISOString()
        }));
      }
      // Handle unknown actions
      else {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Unknown action'
        }));
      }
    } catch (error) {
      console.error('Error processing client message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });
  
  // Handle client disconnection
  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`WebSocket client disconnected: ${clientId}`);
  });
});

// Set up heartbeat interval to detect dead connections
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    
    ws.isAlive = false;
    ws.ping(() => {});
  });
}, 30000);

// Handle WebSocket server closure
wss.on('close', () => {
  clearInterval(interval);
});

// Subscribe to all Redis channels to route messages to clients
async function subscribeToRedisChannels() {
  const channels = redisPubSub.getChannels();
  
  // Helper to process messages from Redis
  const processRedisMessage = (channel, serviceType) => async (message) => {
    try {
      const data = JSON.parse(message);
      
      // Skip if this is a request message (avoid processing our own requests)
      if (data.content && data.content.text && data.content.endpoint) {
        console.debug(`Skipping request message on ${serviceType} channel`);
        return;
      }
      
      // Check if this is a response (should have content field)
      if (!data.content && !data.error) {
        console.debug(`Skipping message without content or error on ${serviceType} channel`);
        return;
      }
      
      // Check if this is a response to a realtime analysis request
      if (data.requestId && data.requestId.includes('-') && data.clientId) {
        // Route to realtime handler
        console.log(`Routing ${serviceType} response to realtime handler for request ${data.requestId}`);
        realtimeHandler.handleServiceResponse(serviceType, data);
      }
      // If response has a clientId, send only to that client
      else if (data.clientId && clients.has(data.clientId)) {
        const client = clients.get(data.clientId);
        
        // Only forward if client is subscribed to this service
        if (client.isSubscribedTo(serviceType)) {
          client.send({
            type: serviceType,
            data: data.content || data,
            timestamp: data.timestamp || new Date().toISOString()
          });
        }
      } 
      // If it's a broadcast message, send to all subscribed clients
      else if (data.broadcast) {
        for (const [_, client] of clients) {
          if (client.isSubscribedTo(serviceType)) {
            client.send({
              type: serviceType,
              data: data.content,
              broadcast: true,
              timestamp: data.timestamp || new Date().toISOString()
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error processing ${serviceType} message:`, error);
    }
  };
  
  // Subscribe to each service channel
  await redisPubSub.subscribe(channels.SPELLCHECK, processRedisMessage(channels.SPELLCHECK, 'spellcheck'));
  await redisPubSub.subscribe(channels.LIX, processRedisMessage(channels.LIX, 'lix'));
  await redisPubSub.subscribe(channels.AI, processRedisMessage(channels.AI, 'ai'));
  
  // Subscribe to control channel
  await redisPubSub.subscribe(channels.CONTROL, async (message) => {
    try {
      const data = JSON.parse(message);
      
      // Process control messages
      if (data.action === 'status') {
        // Broadcast service status to all clients
        for (const [_, client] of clients) {
          client.send({
            type: 'status',
            services: data.services,
            timestamp: data.timestamp || new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error('Error processing control message:', error);
    }
  });
  
  console.log('Subscribed to all Redis channels');
}

// Start the server
async function start() {
  try {
    // Connect to Redis
    await redisPubSub.connect();
    
    // Subscribe to Redis channels
    await subscribeToRedisChannels();
    
    // Initialize realtime handler
    realtimeHandler.initialize(server);
    realtimeHandler.startHeartbeat();
    console.log('Realtime analysis handler initialized');
    
    // Start the HTTP server
    server.listen(PORT, HOST, () => {
      console.log(`Gateway service running at http://${HOST}:${PORT}`);
      
      // Publish service status
      redisPubSub.publish(redisPubSub.getChannels().CONTROL, {
        action: 'status',
        service: 'gateway',
        status: 'online'
      });
    });
  } catch (error) {
    console.error('Failed to start Gateway service:', error);
    process.exit(1);
  }
}

// Graceful shutdown
function shutdown() {
  console.log('Shutting down Gateway service...');
  
  // Close HTTP server
  server.close(async () => {
    console.log('HTTP server closed');
    
    // Close Redis connections
    await redisPubSub.close();
    
    // Close realtime WebSocket handler
    realtimeHandler.close();
    console.log('Realtime analysis handler closed');
    
    // Close all WebSocket connections
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1000, 'Server shutting down');
      }
    });
    
    console.log('Shutdown complete');
    process.exit(0);
  });
  
  // Force exit after timeout
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

// Handle termination signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the service
start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});

module.exports = { app, server };