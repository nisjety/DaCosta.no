// src/providers/whois/DefaultWhoisProvider.js
// Liskov Substitution: Concrete implementation of WhoisProvider

const whoisJson = require('whois-json');
const WhoisProvider = require('./WhoisProvider');
const logger = require('../../utils/logger');

/**
 * Default WHOIS provider using whois-json package
 */
class DefaultWhoisProvider extends WhoisProvider {
  /**
   * Create a new DefaultWhoisProvider
   * @param {Object} options - WHOIS configuration options
   */
  constructor(options = {}) {
    super();
    this.options = {
      follow: 3, // Number of redirects to follow
      timeout: 10000, // 10 second timeout
      ...options
    };
  }

  /**
   * Check domain registration status
   * @param {string} domain - Domain to check
   * @returns {Promise<{isRegistered: boolean, registrar: string|null, expirationDate: Date|null, whoisData: Object|null, error: string|null}>}
   */
  async checkDomainRegistration(domain) {
    try {
      // Strip any protocol or path from the domain
      const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/i, '').split('/')[0];
      
      logger.debug(`Checking WHOIS registration for ${cleanDomain}`);
      
      const whoisData = await whoisJson(cleanDomain, this.options);
      
      // Common patterns to check if domain is registered
      const isRegistered = 
        !(whoisData.domainStatus && whoisData.domainStatus.includes('No match for')) && 
        !(whoisData.text && whoisData.text.includes('No match for')) &&
        !(whoisData.text && whoisData.text.includes('NOT FOUND')) &&
        !(whoisData.text && whoisData.text.includes('No Data Found'));
      
      // Get expiration date if available (different registrars use different field names)
      let expirationDate = null;
      const possibleExpirationFields = [
        'registryExpiryDate',
        'expiryDate',
        'registrarRegistrationExpirationDate',
        'expires',
        'expiration_date'
      ];
      
      for (const field of possibleExpirationFields) {
        if (whoisData[field]) {
          try {
            expirationDate = new Date(whoisData[field]);
            if (!isNaN(expirationDate)) break;
          } catch (e) {
            logger.debug(`Failed to parse expiration date from field ${field}: ${whoisData[field]}`);
          }
        }
      }
      
      return {
        isRegistered,
        registrar: whoisData.registrar || null,
        expirationDate,
        whoisData,
        error: null
      };
    } catch (error) {
      logger.error(`Error checking domain registration for ${domain}: ${error.message}`);
      
      return {
        isRegistered: true, // Assume registered on error to avoid false positives
        registrar: null,
        expirationDate: null,
        whoisData: null,
        error: error.message
      };
    }
  }
}

module.exports = DefaultWhoisProvider;