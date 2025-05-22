// src/providers/notification/NotificationProvider.js
// Interface Segregation: Defines a clear interface for notifications

/**
 * Interface for sending notifications
 * Concrete implementations will provide specific ways to send notifications
 */
class NotificationProvider {
    /**
     * Send a notification
     * @param {string} message - Message to send
     * @param {Object} data - Additional data for the notification
     * @returns {Promise<boolean>} Success status
     */
    async sendNotification(message, data = {}) {
      throw new Error('Method not implemented: NotificationProvider.sendNotification must be implemented by subclasses');
    }
  }
  
  module.exports = NotificationProvider;