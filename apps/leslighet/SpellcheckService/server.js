// SpellcheckerService/server.js
const app = require('./app');
const http = require('http');
const websocket = require('./src/websocket/websocket');
const redisConnection = require('./src/utils/RedisConnection');
const NorwegianSpellChecker = require('./src/services/NorwegianSpellChecker');
const EnglishSpellChecker = require('./src/services/EnglishSpellChecker');

// Create HTTP server
const server = http.createServer(app);

// Define WebSocket path - ensure it matches client expectations
const WS_PATH = '/api/ws';

// Define port
const PORT = process.env.APP_PORT || 5011;
const HOST = process.env.APP_HOST || '0.0.0.0';

// Start time for uptime calculation
const startTime = Date.now();

// Track if services are ready
let servicesReady = false;

// Track server stats
const serverStats = {
  totalRequests: 0,
  activeConnections: 0,
  errors: 0,
  startTime: startTime
};

// Track active connections
server.on('connection', (socket) => {
  serverStats.activeConnections++;
  
  socket.on('close', () => {
    serverStats.activeConnections--;
  });
});

// Track completed requests
app.use((req, res, next) => {
  serverStats.totalRequests++;
  
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      serverStats.errors++;
    }
  });
  
  next();
});

// Middleware to check if services are ready
app.use((req, res, next) => {
  if (!servicesReady && req.path !== '/health') {
    return res.status(503).json({
      error: 'Service is starting up',
      message: 'Dictionaries are still loading. Please try again in a moment.'
    });
  }
  next();
});

/**
 * Get server statistics
 */
function getServerStats() {
  return {
    ...serverStats,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    uptimeHuman: formatUptime(Date.now() - startTime),
    memoryUsage: process.memoryUsage(),
    servicesReady: servicesReady
  };
}

/**
 * Format uptime in human-readable format
 */
function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
}

/**
 * Setup memory management and monitoring
 */
function setupMemoryManagement() {
  // Run cleanup every hour
  const CACHE_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
  
  const cleanupInterval = setInterval(() => {
    console.log('Running scheduled cache cleanup');
    
    try {
      // Clear caches if they're large
      const norwegianStats = NorwegianSpellChecker.getStats 
        ? NorwegianSpellChecker.getStats() 
        : { cacheStats: { size: 0, maxSize: 10000 } };

      const englishStats = EnglishSpellChecker.getStats 
        ? EnglishSpellChecker.getStats() 
        : { cacheStats: { size: 0, maxSize: 10000 } };
      
      // Norwegian
      if (norwegianStats.cacheStats.size > norwegianStats.cacheStats.maxSize * 0.9) {
        console.log('Norwegian spellchecker cache is near capacity, clearing');
        if (NorwegianSpellChecker.clearCache) {
          NorwegianSpellChecker.clearCache();
        }
      }
      
      // English
      if (englishStats.cacheStats.size > englishStats.cacheStats.maxSize * 0.9) {
        console.log('English spellchecker cache is near capacity, clearing');
        if (EnglishSpellChecker.clearCache) {
          EnglishSpellChecker.clearCache();
        }
      }
      
      // Clear thesaurus caches
      if (NorwegianSpellChecker.thesaurusParsers) {
        for (const [dialect, parser] of Object.entries(NorwegianSpellChecker.thesaurusParsers)) {
          if (parser?.clearCache) {
            parser.clearCache();
            console.log(`Cleared Norwegian ${dialect} thesaurus cache`);
          }
        }
      }
      if (EnglishSpellChecker.thesaurusParsers) {
        for (const [dialect, parser] of Object.entries(EnglishSpellChecker.thesaurusParsers)) {
          if (parser?.clearCache) {
            parser.clearCache();
            console.log(`Cleared English ${dialect} thesaurus cache`);
          }
        }
      }
      
      // Clear hyphenation caches
      if (NorwegianSpellChecker.hyphenators) {
        for (const [dialect, hyphenator] of Object.entries(NorwegianSpellChecker.hyphenators)) {
          if (hyphenator?.clearCache) {
            hyphenator.clearCache();
            console.log(`Cleared Norwegian ${dialect} hyphenation cache`);
          }
        }
      }
      if (EnglishSpellChecker.hyphenators) {
        for (const [dialect, hyphenator] of Object.entries(EnglishSpellChecker.hyphenators)) {
          if (hyphenator?.clearCache) {
            hyphenator.clearCache();
            console.log(`Cleared English ${dialect} hyphenation cache`);
          }
        }
      }
      
      // Force garbage collection if possible
      if (global.gc) {
        global.gc();
        console.log('Forced garbage collection run');
      }
      
      // Log memory usage
      const memUsage = process.memoryUsage();
      console.log('Memory usage:', {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)} MB`
      });
    } catch (error) {
      console.error('Error during cache cleanup:', error);
    }
  }, CACHE_CLEANUP_INTERVAL);
  
  // Clean up on exit
  process.on('SIGTERM', () => clearInterval(cleanupInterval));
  process.on('SIGINT', () => clearInterval(cleanupInterval));
  
  return cleanupInterval;
}

/**
 * Initialize spell-check services, then start the server
 */
async function initializeServices() {
  console.log('Initializing spellchecker services...');
  
  const cleanupInterval = setupMemoryManagement();

  try {
    // *** Wait for dictionaries to load ***
    console.log('Loading Norwegian and English dictionaries...');
    await Promise.all([
      NorwegianSpellChecker.loadAll(),
      EnglishSpellChecker.loadAll()
    ]);
    
    console.log('All dictionaries loaded successfully');
    servicesReady = true;
    
    // Optionally ensure getStats is available
    if (!NorwegianSpellChecker.getStats) {
      NorwegianSpellChecker.getStats = function() {
        return {
          cacheStats: {
            size: this.cache ? this.cache.size : 0,
            maxSize: this.cacheMaxSize || 10000
          },
          dialectSettings: { ...this.dialectSettings },
          enabledDialects: this.getEnabledDialects ? this.getEnabledDialects() : []
        };
      };
    }
    if (!EnglishSpellChecker.getStats) {
      EnglishSpellChecker.getStats = function() {
        return {
          cacheStats: {
            size: this.cache ? this.cache.size : 0,
            maxSize: this.cacheMaxSize || 10000
          },
          dialectSettings: { ...this.dialectSettings },
          enabledDialects: this.getEnabledDialects ? this.getEnabledDialects() : []
        };
      };
    }

    // Now start the server and set up WebSocket after dictionaries are loaded
    server.listen(PORT, HOST, () => {
      console.log(`SpellChecker Service running on http://${HOST}:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
      console.log(`Using Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
      
      // Set up WebSocket server after dictionaries are loaded
      websocket.setup(server, WS_PATH);
      
      // Log memory usage at startup
      const memUsage = process.memoryUsage();
      console.log('Initial memory usage:', {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`
      });
    });

    return cleanupInterval;
  } catch (error) {
    console.error('Error loading dictionaries:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
function shutdown() {
  console.log('Shutting down gracefully...');
  servicesReady = false;
  
  server.close(async () => {
    console.log('HTTP server closed');
    
    try {
      await redisConnection.close();
      console.log('Redis connections closed');
      
      if (NorwegianSpellChecker.close) {
        await NorwegianSpellChecker.close();
        console.log('Norwegian SpellChecker service closed');
      }
      if (EnglishSpellChecker.close) {
        await EnglishSpellChecker.close();
        console.log('English SpellChecker service closed');
      }
      
      websocket.close();
      console.log('WebSocket server closed');
      
      const stats = getServerStats();
      console.log('Final server statistics:', {
        uptime: stats.uptimeHuman,
        totalRequests: stats.totalRequests,
        errors: stats.errors
      });
      
      console.log('Shutdown complete');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  });
  
  // Force exit if not done in 10s
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

// Set up signal handlers
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught exceptions/rejections
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  shutdown();
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  // We won't forcibly shutdown, but you can if you prefer
});

// Make stats available globally for health checks
global.serverStats = getServerStats;

// Start the application
initializeServices().catch(error => {
  console.error('Failed to initialize services:', error);
  process.exit(1);
});

// Export the server for testing
module.exports = server;