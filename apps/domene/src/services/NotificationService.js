// src/services/NotificationService.js
// Single Responsibility: Handles all notification functionality

const logger = require('../utils/logger');
const EventTypes = require('../config/eventTypes');

/**
 * Service for managing and sending notifications
 */
class NotificationService {
  /**
   * Create a new NotificationService
   * @param {Array<NotificationProvider>} providers - Notification providers
   * @param {EventBusService} eventBus - Event bus for publishing events
   */
  constructor(providers = [], eventBus = null) {
    this.providers = providers;
    this.eventBus = eventBus;
    this.templates = {};
    this.notificationHistory = [];
    
    // Initialize with default templates
    this.registerTemplate('domain-available', (domain, purchaseLink) => {
      return {
        subject: `Domain Alert: ${domain.name} is now available`,
        message: `DOMAIN ALERT: ${domain.name} appears to be available for purchase!\n\n` +
                 `Status: ${domain.lastStatus.getStatusDescription()}\n` +
                 `Last checked: ${domain.lastChecked.toLocaleString()}\n\n` +
                 `Purchase link: ${purchaseLink}`
      };
    });
    
    this.registerTemplate('monitoring-summary', (results) => {
      return {
        subject: `Domain Monitoring Summary: ${results.availableCount} domains available`,
        message: `Domain Monitoring Summary\n\n` +
                 `Checked domains: ${results.checkedCount}\n` +
                 `Available domains: ${results.availableCount}\n\n` +
                 `${results.availableDomains.length > 0 ? 
                   `Available domains:\n${results.availableDomains.join('\n')}` : 
                   'No domains are currently available.'}`
      };
    });
  }

  /**
   * Add a notification provider
   * @param {NotificationProvider} provider
   */
  addProvider(provider) {
    this.providers.push(provider);
    logger.info('Notification provider added');
  }

  /**
   * Register a notification template
   * @param {string} name - Template name
   * @param {Function} template - Template function
   */
  registerTemplate(name, template) {
    if (typeof template !== 'function') {
      throw new Error('Template must be a function');
    }
    
    this.templates[name] = template;
  }

  /**
   * Send a notification using a template
   * @param {string} templateName - Name of template to use
   * @param {Array<any>} templateParams - Parameters for template
   * @param {Object} options - Additional options
   * @returns {Promise<Array<boolean>>} Success status for each provider
   */
  async sendTemplatedNotification(templateName, templateParams = [], options = {}) {
    if (!this.templates[templateName]) {
      throw new Error(`Template ${templateName} not found`);
    }
    
    // Get content from template
    const content = this.templates[templateName](...templateParams);
    
    // Extract subject and message
    const { subject, message } = content;
    
    // Add metadata
    const data = {
      subject,
      timestamp: new Date(),
      template: templateName,
      ...options
    };
    
    // Send using all providers
    return this.sendNotification(message, data);
  }

  /**
   * Send a notification using all providers
   * @param {string} message - Message to send
   * @param {Object} data - Additional data
   * @returns {Promise<Array<boolean>>} Success status for each provider
   */
  async sendNotification(message, data = {}) {
    if (this.providers.length === 0) {
      logger.warn('No notification providers configured');
      return [];
    }
    
    logger.info(`Sending notification through ${this.providers.length} providers`);
    
    // Record in history
    const notificationRecord = {
      timestamp: new Date(),
      message: message.slice(0, 100) + (message.length > 100 ? '...' : ''),
      data
    };
    
    this.notificationHistory.push(notificationRecord);
    
    // Trim history if it gets too large
    if (this.notificationHistory.length > 100) {
      this.notificationHistory = this.notificationHistory.slice(this.notificationHistory.length - 100);
    }
    
    // Send through all providers
    const results = await Promise.all(
      this.providers.map(provider => 
        provider.sendNotification(message, data)
          .catch(error => {
            logger.error(`Error sending notification: ${error.message}`);
            return false;
          })
      )
    );
    
    const successCount = results.filter(Boolean).length;
    logger.info(`Successfully sent ${successCount}/${results.length} notifications`);
    
    // Publish notification sent event
    if (this.eventBus) {
      this.eventBus.publish(EventTypes.NOTIFICATION_SENT, {
        ...notificationRecord,
        success: successCount > 0,
        successCount,
        totalCount: results.length
      });
    }
    
    return results;
  }

  /**
   * Get notification history
   * @param {number} limit - Maximum number of entries to return
   * @returns {Array<Object>} Notification history
   */
  getNotificationHistory(limit = 20) {
    return this.notificationHistory
      .slice(-Math.min(limit, this.notificationHistory.length))
      .reverse();
  }
}

module.exports = NotificationService;