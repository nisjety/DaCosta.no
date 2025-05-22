// src/services/ApiService.js
// API service for handling HTTP requests - preparation for future frontend

const express = require('express');
const cors = require('cors');
const http = require('http');
const logger = require('../utils/logger');
const validators = require('../utils/validators');
const EventTypes = require('../config/eventTypes');

/**
 * Service for handling API requests
 */
class ApiService {
  /**
   * Create a new ApiService
   * @param {Object} services - Application services
   * @param {DomainService} services.domainService - Domain service
   * @param {MonitorService} services.monitorService - Monitor service
   * @param {SchedulerService} services.schedulerService - Scheduler service
   * @param {NotificationService} services.notificationService - Notification service
   * @param {WebSocketService} services.webSocketService - WebSocket service for real-time updates
   * @param {EventBusService} services.eventBus - Event bus for events
   * @param {Object} options - API configuration options
   * @param {number} options.port - Port to listen on
   */
  constructor(services, options = {}) {
    this.domainService = services.domainService;
    this.monitorService = services.monitorService;
    this.schedulerService = services.schedulerService;
    this.notificationService = services.notificationService;
    this.webSocketService = services.webSocketService;
    this.eventBus = services.eventBus;
    
    this.port = options.port || 3001;
    this.app = express();
    this.server = null;
    
    this._configureApp();
    this._setupRoutes();
    this._setupEventHandlers();
  }

  /**
   * Configure Express application
   * @private
   */
  _setupEventHandlers() {
    if (!this.eventBus || !this.webSocketService) {
      return;
    }
    
    // Forward all domain events
    this.eventBus.subscribe(EventTypes.DOMAIN_ADDED, (data) => {
      this.webSocketService.broadcast({
        type: 'domain-event',
        event: EventTypes.DOMAIN_ADDED,
        data
      });
    });
    
    this.eventBus.subscribe(EventTypes.DOMAIN_UPDATED, (data) => {
      this.webSocketService.broadcast({
        type: 'domain-event',
        event: EventTypes.DOMAIN_UPDATED,
        data
      });
    });
    
    this.eventBus.subscribe(EventTypes.DOMAIN_DELETED, (data) => {
      this.webSocketService.broadcast({
        type: 'domain-event',
        event: EventTypes.DOMAIN_DELETED,
        data
      });
    });
    
    this.eventBus.subscribe(EventTypes.DOMAIN_STATUS_CHANGED, (data) => {
      this.webSocketService.broadcast({
        type: 'domain-event',
        event: EventTypes.DOMAIN_STATUS_CHANGED,
        data
      });
    });
    
    this.eventBus.subscribe(EventTypes.DOMAIN_BECAME_AVAILABLE, (data) => {
      this.webSocketService.broadcast({
        type: 'domain-event',
        event: EventTypes.DOMAIN_BECAME_AVAILABLE,
        data
      });
    });
    
    // Forward all monitoring events
    this.eventBus.subscribe(EventTypes.MONITORING_STARTED, (data) => {
      this.webSocketService.broadcast({
        type: 'monitoring-event',
        event: EventTypes.MONITORING_STARTED,
        data
      });
    });
    
    this.eventBus.subscribe(EventTypes.MONITORING_COMPLETED, (data) => {
      this.webSocketService.broadcast({
        type: 'monitoring-event',
        event: EventTypes.MONITORING_COMPLETED,
        data
      });
    });
    
    this.eventBus.subscribe(EventTypes.MONITORING_FAILED, (data) => {
      this.webSocketService.broadcast({
        type: 'monitoring-event',
        event: EventTypes.MONITORING_FAILED,
        data
      });
    });
    
    // Forward all scheduler events
    this.eventBus.subscribe(EventTypes.SCHEDULER_STARTED, (data) => {
      this.webSocketService.broadcast({
        type: 'scheduler-event',
        event: EventTypes.SCHEDULER_STARTED,
        data
      });
    });
    
    this.eventBus.subscribe(EventTypes.SCHEDULER_STOPPED, (data) => {
      this.webSocketService.broadcast({
        type: 'scheduler-event',
        event: EventTypes.SCHEDULER_STOPPED,
        data
      });
    });
    
    this.eventBus.subscribe(EventTypes.SCHEDULER_UPDATED, (data) => {
      this.webSocketService.broadcast({
        type: 'scheduler-event',
        event: EventTypes.SCHEDULER_UPDATED,
        data
      });
    });
    
    // Forward all notification events
    this.eventBus.subscribe(EventTypes.NOTIFICATION_SENT, (data) => {
      this.webSocketService.broadcast({
        type: 'notification-event',
        event: EventTypes.NOTIFICATION_SENT,
        data
      });
    });
  }
  _configureApp() {
    this.app.use(express.json());
    this.app.use(cors());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Basic request logging
    this.app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup API routes
   * @private
   */
  _setupRoutes() {
    const app = this.app;
    
    // Health check route
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    
    // Domain routes
    app.get('/api/domains', this._handleAsync(this._getDomains.bind(this)));
    app.get('/api/domains/:name', this._handleAsync(this._getDomain.bind(this)));
    app.post('/api/domains', this._handleAsync(this._addDomain.bind(this)));
    app.put('/api/domains/:name', this._handleAsync(this._updateDomain.bind(this)));
    app.delete('/api/domains/:name', this._handleAsync(this._deleteDomain.bind(this)));
    
    // Monitoring routes
    app.get('/api/monitor/status', this._handleAsync(this._getMonitorStatus.bind(this)));
    app.post('/api/monitor/run', this._handleAsync(this._runMonitor.bind(this)));
    
    // Scheduler routes
    app.get('/api/scheduler', this._handleAsync(this._getSchedulerStatus.bind(this)));
    app.post('/api/scheduler/start', this._handleAsync(this._startScheduler.bind(this)));
    app.post('/api/scheduler/stop', this._handleAsync(this._stopScheduler.bind(this)));
    app.put('/api/scheduler', this._handleAsync(this._updateScheduler.bind(this)));
    
    // Notification routes
    app.get('/api/notifications/history', this._handleAsync(this._getNotificationHistory.bind(this)));
    app.post('/api/notifications/test', this._handleAsync(this._sendTestNotification.bind(this)));
    
    // Error handler
    app.use((err, req, res, next) => {
      logger.error(`API error: ${err.message}`);
      res.status(err.status || 500).json({
        error: {
          message: err.message,
          status: err.status || 500
        }
      });
    });
  }

  /**
   * Wrapper for async route handlers
   * @param {Function} fn - Async route handler
   * @returns {Function} Express middleware
   * @private
   */
  _handleAsync(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  // Domain route handlers
  
  /**
   * Get all domains
   * @private
   */
  async _getDomains(req, res) {
    const domains = await this.domainService.getAllDomains();
    res.json({ domains: domains.map(d => d.toJSON()) });
  }

  /**
   * Get a specific domain
   * @private
   */
  async _getDomain(req, res) {
    const domain = await this.domainService.getDomain(req.params.name);
    
    if (!domain) {
      return res.status(404).json({ error: { message: 'Domain not found' } });
    }
    
    res.json({ domain: domain.toJSON() });
  }

  /**
   * Add a new domain
   * @private
   */
  async _addDomain(req, res) {
    const { name, preferredRegistrar } = req.body;
    
    // Validate domain name
    if (!validators.isValidDomain(name)) {
      return res.status(400).json({ error: { message: 'Invalid domain name' } });
    }
    
    try {
      const domain = await this.domainService.addDomain(name, preferredRegistrar);
      res.status(201).json({ domain: domain.toJSON() });
    } catch (error) {
      if (error.message.includes('already being monitored')) {
        return res.status(409).json({ error: { message: error.message } });
      }
      throw error;
    }
  }

  /**
   * Update a domain
   * @private
   */
  async _updateDomain(req, res) {
    const validation = validators.validateDomainUpdate(req.body);
    
    if (!validation.isValid) {
      return res.status(400).json({ error: { message: validation.errors.join(', ') } });
    }
    
    try {
      const domain = await this.domainService.updateDomain(req.params.name, req.body);
      res.json({ domain: domain.toJSON() });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: { message: error.message } });
      }
      throw error;
    }
  }

  /**
   * Delete a domain
   * @private
   */
  async _deleteDomain(req, res) {
    const success = await this.domainService.deleteDomain(req.params.name);
    
    if (!success) {
      return res.status(404).json({ error: { message: 'Domain not found' } });
    }
    
    res.json({ success: true });
  }

  // Monitor route handlers
  
  /**
   * Get monitoring status
   * @private
   */
  async _getMonitorStatus(req, res) {
    // We don't have a direct status object in MonitorService,
    // so we'll create one with basic info
    res.json({
      status: {
        lastRun: this.monitorService.lastRun || null,
        availableDomains: (await this.domainService.getAllDomains())
          .filter(d => d.lastStatus && !d.lastStatus.isRegistered)
          .map(d => d.name)
      }
    });
  }

  /**
   * Run monitoring cycle
   * @private
   */
  async _runMonitor(req, res) {
    const result = await this.schedulerService.runNow();
    res.json({ result });
  }

  // Scheduler route handlers
  
  /**
   * Get scheduler status
   * @private
   */
  async _getSchedulerStatus(req, res) {
    const status = this.schedulerService.getStatus();
    res.json({ status });
  }

  /**
   * Start scheduler
   * @private
   */
  async _startScheduler(req, res) {
    const success = this.schedulerService.start();
    res.json({ success, status: this.schedulerService.getStatus() });
  }

  /**
   * Stop scheduler
   * @private
   */
  async _stopScheduler(req, res) {
    const success = this.schedulerService.stop();
    res.json({ success, status: this.schedulerService.getStatus() });
  }

  /**
   * Update scheduler
   * @private
   */
  async _updateScheduler(req, res) {
    const { schedule } = req.body;
    
    if (!validators.isValidCronSchedule(schedule)) {
      return res.status(400).json({ error: { message: 'Invalid cron schedule' } });
    }
    
    const success = this.schedulerService.updateSchedule(schedule);
    res.json({ success, status: this.schedulerService.getStatus() });
  }

  // Notification route handlers
  
  /**
   * Get notification history
   * @private
   */
  async _getNotificationHistory(req, res) {
    const limit = parseInt(req.query.limit, 10) || 20;
    const history = this.notificationService.getNotificationHistory(limit);
    res.json({ history });
  }

  /**
   * Send test notification
   * @private
   */
  async _sendTestNotification(req, res) {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: { message: 'Message is required' } });
    }
    
    const results = await this.notificationService.sendNotification(
      message,
      { isTest: true }
    );
    
    res.json({
      success: results.some(Boolean),
      results
    });
  }

  /**
   * Start the API server
   * @returns {Promise<void>}
   */
  async start() {
    return new Promise((resolve) => {
      // Create HTTP server from Express app
      this.server = http.createServer(this.app);
      
      // If we have a WebSocket service, attach it to the HTTP server
      if (this.webSocketService) {
        this.webSocketService._initializeWithServer(this.server);
        logger.info('WebSocket service attached to HTTP server');
      }
      
      // Start the server
      this.server.listen(this.port, () => {
        logger.info(`API server listening on port ${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the API server
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.server) {
      return Promise.resolve();
    }
    
    return new Promise((resolve) => {
      this.server.close(() => {
        logger.info('API server stopped');
        this.server = null;
        resolve();
      });
    });
  }
}

module.exports = ApiService;