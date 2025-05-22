// src/index.js
// Application entry point with Docker support

const { config, validateConfig } = require('./config/config');
const logger = require('./utils/logger');
const registrarLinks = require('./config/registrars');
const { setupStaticServer } = require('./server');

// Import models
const Domain = require('./models/Domain');
const DomainStatus = require('./models/DomainStatus');

// Import providers
const AxiosStatusProvider = require('./providers/status/AxiosStatusProvider');
const DefaultWhoisProvider = require('./providers/whois/DefaultWhoisProvider');
const TwilioProvider = require('./providers/notification/TwilioProvider');
const RedisCacheProvider = require('./providers/cache/RedisCacheProvider');

// Import repositories
const JSONFileDomainRepository = require('./repositories/JSONFileDomainRepository');
const MongoDomainRepository = require('./repositories/MongoDomainRepository');

// Import services
const RegistrarService = require('./services/RegistrarService');
const DomainService = require('./services/DomainService');
const NotificationService = require('./services/NotificationService');
const MonitorService = require('./services/MonitorService');
const SchedulerService = require('./services/SchedulerService');
const ApiService = require('./services/ApiService');
const WebSocketService = require('./services/WebSocketService');
const EventBusService = require('./services/EventBusService');

// Import event types
const EventTypes = require('./config/eventTypes');

/**
 * Initialize application
 */
async function initialize() {
  logger.info('Initializing Domain Monitor service');
  
  // Validate configuration
  const validation = validateConfig();
  if (!validation.isValid) {
    logger.error('Invalid configuration:', validation.errors);
    process.exit(1);
  }
  
  try {
    // Initialize providers
    logger.info('Initializing providers...');
    
    // Status provider
    const statusProvider = new AxiosStatusProvider({
      timeout: config.http.timeout,
      headers: {
        'User-Agent': config.http.userAgent
      }
    });
    
    // WHOIS provider based on configuration
    let whoisProvider;
    if (config.whois.apiEnabled) {
      logger.info('Initializing WHOIS API provider');
      const WhoisApiProvider = require('./providers/whois/WhoisApiProvider');
      whoisProvider = new WhoisApiProvider({
        apiKey: config.whois.apiKey,
        apiUrl: config.whois.apiUrl,
        timeout: config.whois.timeout,
        retryCount: config.whois.retryCount,
        retryDelay: config.whois.retryDelay
      });
    } else {
      logger.info('Initializing default WHOIS provider');
      whoisProvider = new DefaultWhoisProvider({
        timeout: config.whois.timeout,
        follow: config.whois.follow
      });
    }
    
    // Redis cache provider (if enabled)
    let cacheProvider = null;
    if (config.redis.enabled) {
      logger.info('Initializing Redis cache provider');
      cacheProvider = new RedisCacheProvider({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db,
        keyPrefix: config.redis.keyPrefix
      });
      
      try {
        await cacheProvider.initialize();
      } catch (error) {
        logger.warn(`Redis cache initialization failed, continuing without cache: ${error.message}`);
        cacheProvider = null;
      }
    }
    
    // Notification providers and service
    const notificationProviders = [];
    
    // Twilio SMS provider
    if (config.twilio.enabled) {
      logger.info('Initializing Twilio SMS provider');
      const twilioProvider = new TwilioProvider({
        accountSid: config.twilio.accountSid,
        authToken: config.twilio.authToken,
        fromNumber: config.twilio.fromNumber,
        toNumbers: config.twilio.toNumbers
      });
      notificationProviders.push(twilioProvider);
    } else {
      logger.warn('Twilio SMS provider is disabled');
    }
    
    // Initialize repository based on configuration
    logger.info(`Initializing domain repository using ${config.repository.type}...`);
    let domainRepository;
    
    if (config.repository.type === 'mongodb') {
      domainRepository = new MongoDomainRepository({
        connectionString: config.mongodb.connectionString,
        database: config.mongodb.database,
        collection: config.mongodb.collection
      });
    } else {
      // Default to JSON file repository
      domainRepository = new JSONFileDomainRepository({
        filePath: config.repository.filePath
      });
    }
    
    await domainRepository.initialize();
    
    // Initialize services
    logger.info('Initializing services...');
    
    // Event bus service
    const eventBus = new EventBusService();
    eventBus.registerEvents(Object.values(EventTypes));
    
    // WebSocket service
    const webSocketService = new WebSocketService({
      port: config.app.wsPort || 3002
    });
    
    // Registrar service
    const registrarService = new RegistrarService(registrarLinks);
    
    // Domain service
    const domainService = new DomainService({
      domainRepository,
      statusProvider,
      whoisProvider,
      registrarService,
      eventBus,
      cacheProvider
    });
    
    // Notification service
    const notificationService = new NotificationService(notificationProviders, eventBus);
    
    // Monitor service
    const monitorService = new MonitorService({
      domainService,
      notificationService,
      eventBus
    });
    
    // Scheduler service
    const schedulerService = new SchedulerService({
      monitorService,
      eventBus,
      schedule: config.monitoring.schedule
    });
    
    // API service with WebSocket support
    const apiService = new ApiService({
      domainService,
      monitorService,
      schedulerService,
      notificationService,
      webSocketService,
      eventBus
    }, {
      port: config.app.port || 3001
    });
    
    // Setup static file server for frontend
    setupStaticServer(apiService.app);
    
    // Start the scheduler
    schedulerService.start();
    logger.info('Domain monitoring scheduler started');
    
    // Start the API server
    await apiService.start();
    logger.info('API server started');
    
    // Run an initial check
    logger.info('Running initial domain check...');
    await schedulerService.runNow();
    
    // Setup graceful shutdown
    setupGracefulShutdown(schedulerService, apiService, webSocketService, domainRepository, cacheProvider);
    
    // Publish system initialized event
    eventBus.publish(EventTypes.SYSTEM_INITIALIZED, {
      timestamp: new Date().toISOString()
    });
    
    return {
      domainService,
      monitorService,
      schedulerService,
      notificationService,
      apiService,
      webSocketService,
      eventBus,
      domainRepository,
      cacheProvider
    };
  } catch (error) {
    logger.error(`Initialization failed: ${error.message}`);
    throw error;
  }
}

/**
 * Setup signal handlers for graceful shutdown
 * @param {SchedulerService} schedulerService
 * @param {ApiService} apiService
 * @param {WebSocketService} webSocketService
 * @param {DomainRepository} domainRepository
 * @param {RedisCacheProvider} cacheProvider
 */
function setupGracefulShutdown(schedulerService, apiService, webSocketService, domainRepository, cacheProvider) {
  // Handle process termination signals
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    
    // Stop the scheduler
    schedulerService.stop();
    logger.info('Monitoring scheduler stopped');
    
    // Stop the API server
    if (apiService) {
      await apiService.stop();
      logger.info('API server stopped');
    }
    
    // Stop the WebSocket server
    if (webSocketService) {
      await webSocketService.stop();
      logger.info('WebSocket server stopped');
    }
    
    // Close the repository connection
    if (domainRepository && typeof domainRepository.close === 'function') {
      await domainRepository.close();
      logger.info('Domain repository connection closed');
    }
    
    // Close the cache connection
    if (cacheProvider) {
      await cacheProvider.close();
      logger.info('Cache provider connection closed');
    }
    
    process.exit(0);
  };

  // Listen for termination signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.message}`, error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection:', reason);
  process.exit(1);
});

// Initialize and start the application
if (require.main === module) {
  initialize()
    .then(() => {
      logger.info('Domain Monitor service initialized successfully');
    })
    .catch((error) => {
      logger.error(`Failed to initialize service: ${error.message}`);
      process.exit(1);
    });
} else {
  // Export for testing or programmatic use
  module.exports = { initialize };
}