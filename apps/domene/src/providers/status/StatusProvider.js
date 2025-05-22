// src/providers/status/StatusProvider.js
// Interface Segregation: Defines a clear interface for status checking

/**
 * Interface for website status checking
 * Concrete implementations will provide specific ways to check website status
 */
class StatusProvider {
    /**
     * Check if a website is up
     * @param {string} domain - Domain to check
     * @returns {Promise<{isUp: boolean, statusCode: number|null, error: string|null, metadata: Object}>}
     */
    async checkStatus(domain) {
      throw new Error('Method not implemented: StatusProvider.checkStatus must be implemented by subclasses');
    }
  }
  
  module.exports = StatusProvider;