// app.js
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { config } = require('./src/config/config');
// Import environment configuration
const { envConfig, isValid } = require('./src/config/env_config');
// Import PubSub handler
const pubsubHandler = require('./src/handlers/pubsub_handler');

// Import routes
const grammarRoutes = require('./src/routes/grammar_routes');

const app = express();
// Use environment configuration for port and host
const PORT = envConfig.app.port;
const HOST = envConfig.app.host;

// Get allowed origins from environment or use defaults
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS ? 
  process.env.CORS_ALLOWED_ORIGINS.split(',') : 
  ['http://localhost:3000', 'http://127.0.0.1:3000'];

console.log('CORS allowed origins:', allowedOrigins);

// Enhanced CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,
  exposedHeaders: ['Access-Control-Allow-Origin'],
  maxAge: 86400 // Cache preflight requests for 24 hours
};

// Apply CORS middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '5mb' }));

// Handle CORS preflight for all routes
app.options('*', cors(corsOptions));

// Add middleware to log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} from ${req.ip}, Origin: ${req.headers.origin || 'none'}`);
  next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'src', 'public')));

// Routes
app.use('/api/grammar', grammarRoutes);

// Health check route
app.get('/health', async (req, res) => {
  // Include PubSub status in health check
  const pubsubStatus = pubsubHandler._running ? 'connected' : 'disconnected';
  const pubsubMetrics = pubsubHandler.getMetrics();
  
  res.json({
    status: 'ok',
    service: 'grammar-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    redis_pubsub: {
      status: pubsubStatus,
      metrics: pubsubMetrics
    },
    network: {
      host: HOST,
      port: PORT,
      cors: {
        allowedOrigins: '*'
      }
    }
  });
});

// Create HTTP server
const server = http.createServer(app);

// Start the server
server.listen(PORT, HOST, async () => {
  console.log(`Grammar Service running on http://${HOST}:${PORT}`);
  
  // Log network interfaces for debugging
  try {
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    console.log('Available network interfaces:');
    for (const [name, interfaces] of Object.entries(networkInterfaces)) {
      for (const iface of interfaces) {
        if (iface.family === 'IPv4' || iface.family === 4) {
          console.log(`- ${name}: ${iface.address}`);
        }
      }
    }
  } catch (err) {
    console.error('Error getting network interfaces:', err);
  }
  
  // Start PubSub handler
  try {
    await pubsubHandler.start();
    console.log('Redis PubSub handler started');
  } catch (err) {
    console.error('Failed to start Redis PubSub handler:', err);
    // Continue running the service even if PubSub fails
  }
});

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down Grammar Service...');
  
  // Stop the PubSub handler
  try {
    await pubsubHandler.stop();
  } catch (err) {
    console.error('Error stopping PubSub handler:', err);
  }
  
  // Close the HTTP server
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
  
  // Force exit after timeout
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle termination signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = { app, server };