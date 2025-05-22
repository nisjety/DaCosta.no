// src/providers/whois/WhoisProvider.js
// Interface Segregation: Defines a clear interface for WHOIS lookups

/**
 * Interface for WHOIS domain information lookup
 * Concrete implementations will provide specific ways to query domain registration
 */
class WhoisProvider {
    /**
     * Check domain registration status
     * @param {string} domain - Domain to check
     * @returns {Promise<{isRegistered: boolean, registrar: string|null, expirationDate: Date|null, whoisData: Object|null, error: string|null}>}
     */
    async checkDomainRegistration(domain) {
      throw new Error('Method not implemented: WhoisProvider.checkDomainRegistration must be implemented by subclasses');
    }
  }
  
  module.exports = WhoisProvider;