// src/providers/status/AxiosStatusProvider.js
// Liskov Substitution: Concrete implementation of StatusProvider

const axios = require('axios');
const StatusProvider = require('./StatusProvider');
const logger = require('../../utils/logger');

/**
 * Website status checker using Axios HTTP client
 */
class AxiosStatusProvider extends StatusProvider {
  /**
   * Create a new AxiosStatusProvider
   * @param {Object} options - Axios configuration options
   */
  constructor(options = {}) {
    super();
    this.options = {
      timeout: 5000, // 5 second timeout
      validateStatus: null, // Don't throw on any status code
      ...options
    };
  }

  /**
   * Check if a website is up
   * @param {string} domain - Domain to check
   * @returns {Promise<{isUp: boolean, statusCode: number|null, error: string|null, metadata: Object}>}
   */
  async checkStatus(domain) {
    try {
      // Ensure domain doesn't already have protocol
      const url = domain.startsWith('http') ? domain : `https://${domain}`;
      
      logger.debug(`Checking website status for ${url}`);
      
      // Make the request
      const response = await axios.get(url, this.options);
      
      return {
        isUp: response.status < 500, // Consider anything below 500 as "up"
        statusCode: response.status,
        error: null,
        metadata: {
          headers: response.headers,
          contentType: response.headers['content-type'],
          responseTime: response.headers['x-response-time'] || null
        }
      };
    } catch (error) {
      // Log the error but don't throw
      logger.debug(`Error checking website status for ${domain}: ${error.message}`);
      
      // Determine if this is a DNS error (site doesn't exist) or other error
      const isDNSError = error.code === 'ENOTFOUND';
      
      return {
        isUp: false,
        statusCode: error.response?.status || null,
        error: error.message,
        metadata: {
          code: error.code,
          isDNSError,
          isTimeout: error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT',
          isConnectionRefused: error.code === 'ECONNREFUSED'
        }
      };
    }
  }
}

module.exports = AxiosStatusProvider;