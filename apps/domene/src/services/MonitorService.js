// src/services/MonitorService.js
// Single Responsibility & Dependency Inversion: Orchestrates domain monitoring

const logger = require('../utils/logger');
const EventTypes = require('../config/eventTypes');

/**
 * Service for monitoring domains
 */
class MonitorService {
  /**
   * Create a new MonitorService
   * @param {Object} providers - Service providers
   * @param {DomainService} providers.domainService - Service for domain operations
   * @param {NotificationService} providers.notificationService - Service for notifications
   * @param {EventBusService} providers.eventBus - Event bus for publishing events
   */
  constructor({ domainService, notificationService, eventBus }) {
    this.domainService = domainService;
    this.notificationService = notificationService;
    this.eventBus = eventBus;
    this.lastRun = null;
    this.lastResults = null;
  }

  /**
   * Run a monitoring check cycle
   * @returns {Promise<Object>} Results of the monitoring cycle
   */
  async runMonitoringCycle() {
    logger.info('Starting domain monitoring cycle');
    this.lastRun = new Date();
    
    // Publish monitoring started event
    if (this.eventBus) {
      this.eventBus.publish(EventTypes.MONITORING_STARTED, { 
        timestamp: this.lastRun
      });
    }
    
    try {
      // Check all domains
      const availableDomains = await this.domainService.checkAllDomains();
      
      logger.info(`Found ${availableDomains.length} newly available domains`);
      
      // Send notifications for available domains
      if (availableDomains.length > 0) {
        for (const { domain, purchaseLink } of availableDomains) {
          await this.notificationService.sendTemplatedNotification(
            'domain-available',
            [domain, purchaseLink],
            { domain: domain.name, purchaseLink }
          );
        }
        
        // Send a summary notification
        const results = {
          checkedCount: (await this.domainService.getAllDomains()).filter(d => d.isActive).length,
          availableCount: availableDomains.length,
          availableDomains: availableDomains.map(({ domain }) => domain.name)
        };
        
        await this.notificationService.sendTemplatedNotification(
          'monitoring-summary',
          [results]
        );
      }
      
      // Store results
      this.lastResults = {
        success: true,
        timestamp: this.lastRun,
        checkedCount: (await this.domainService.getAllDomains()).filter(d => d.isActive).length,
        availableCount: availableDomains.length,
        availableDomains: availableDomains.map(({ domain }) => domain.name)
      };
      
      // Publish monitoring completed event
      if (this.eventBus) {
        this.eventBus.publish(EventTypes.MONITORING_COMPLETED, this.lastResults);
      }
      
      return this.lastResults;
    } catch (error) {
      logger.error(`Error in monitoring cycle: ${error.message}`);
      
      this.lastResults = {
        success: false,
        timestamp: this.lastRun,
        error: error.message
      };
      
      // Publish monitoring failed event
      if (this.eventBus) {
        this.eventBus.publish(EventTypes.MONITORING_FAILED, this.lastResults);
      }
      
      return this.lastResults;
    }
  }
  
  /**
   * Get the last monitoring results
   * @returns {Object|null} Last monitoring results
   */
  getLastResults() {
    return this.lastResults;
  }
}

module.exports = MonitorService;