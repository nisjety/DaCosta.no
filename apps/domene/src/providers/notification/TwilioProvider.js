// src/providers/notification/TwilioProvider.js
// Liskov Substitution: Concrete implementation of NotificationProvider

const { Twilio } = require('twilio');
const NotificationProvider = require('./NotificationProvider');
const logger = require('../../utils/logger');

/**
 * Twilio SMS notification provider
 */
class TwilioProvider extends NotificationProvider {
  /**
   * Create a new TwilioProvider
   * @param {Object} config - Twilio configuration
   * @param {string} config.accountSid - Twilio account SID
   * @param {string} config.authToken - Twilio auth token
   * @param {string} config.fromNumber - Phone number to send from
   * @param {string|Array<string>} config.toNumbers - Phone number(s) to send to
   */
  constructor(config) {
    super();
    
    if (!config || !config.accountSid || !config.authToken || !config.fromNumber) {
      throw new Error('TwilioProvider requires accountSid, authToken, and fromNumber');
    }
    
    this.client = new Twilio(config.accountSid, config.authToken);
    this.fromNumber = config.fromNumber;
    
    // Can be a string or array of recipient numbers
    this.toNumbers = Array.isArray(config.toNumbers) 
      ? config.toNumbers 
      : [config.toNumbers];
  }

  /**
   * Send an SMS notification
   * @param {string} message - Message to send
   * @param {Object} data - Additional data
   * @param {Array<string>} data.recipients - Override default recipients
   * @returns {Promise<boolean>} Success status
   */
  async sendNotification(message, data = {}) {
    try {
      const recipients = data.recipients || this.toNumbers;
      
      if (!recipients || recipients.length === 0) {
        throw new Error('No recipient phone numbers specified');
      }
      
      logger.debug(`Sending SMS notification to ${recipients.length} recipients`);
      
      // Send to all recipients
      const results = await Promise.all(
        recipients.map(to => 
          this.client.messages.create({
            body: message,
            from: this.fromNumber,
            to
          })
        )
      );
      
      logger.info(`Successfully sent ${results.length} SMS notifications`);
      return true;
    } catch (error) {
      logger.error(`Error sending Twilio notification: ${error.message}`);
      return false;
    }
  }
}

module.exports = TwilioProvider;