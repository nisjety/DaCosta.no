// src/providers/whois/WhoisApiProvider.js
// Implementation of WhoisProvider using an external WHOIS API service

const axios = require('axios');
const WhoisProvider = require('./WhoisProvider');
const logger = require('../../utils/logger');

/**
 * WhoisApiProvider - Implementation of WhoisProvider using an external API
 * Supports services like WhoisXML API, WhoAPI, etc.
 */
class WhoisApiProvider extends WhoisProvider {
  /**
   * Create a new WhoisApiProvider
   * @param {Object} options - Configuration options
   * @param {string} options.apiKey - API key for the WHOIS service
   * @param {string} options.apiUrl - Base URL for the WHOIS API
   * @param {number} options.timeout - Request timeout in milliseconds
   * @param {number} options.retryCount - Number of retries on failure
   * @param {number} options.retryDelay - Delay between retries in milliseconds
   */
  constructor(options = {}) {
    super();
    
    if (!options.apiKey) {
      throw new Error('WHOIS API key is required');
    }
    
    if (!options.apiUrl) {
      throw new Error('WHOIS API URL is required');
    }
    
    this.apiKey = options.apiKey;
    this.apiUrl = options.apiUrl;
    this.timeout = options.timeout || 10000;
    this.retryCount = options.retryCount || 3;
    this.retryDelay = options.retryDelay || 5000;
    
    // Determine which API service we're using based on URL
    // This helps us format the requests and parse responses appropriately
    if (this.apiUrl.includes('whoisxmlapi.com')) {
      this.apiService = 'whoisxml';
    } else if (this.apiUrl.includes('whoapi.com')) {
      this.apiService = 'whoapi';
    } else {
      this.apiService = 'generic';
    }
    
    logger.info(`Initialized WhoisApiProvider with ${this.apiService} service`);
  }

  /**
   * Check domain registration status using the WHOIS API
   * @param {string} domain - Domain to check
   * @returns {Promise<{isRegistered: boolean, registrar: string|null, expirationDate: Date|null, whoisData: Object|null, error: string|null}>}
   */
  async checkDomainRegistration(domain) {
    try {
      // Strip any protocol or path from the domain
      const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/i, '').split('/')[0];
      
      logger.debug(`Checking WHOIS registration for ${cleanDomain} via API`);
      
      // Try to get WHOIS data with retries
      const whoisData = await this._fetchWithRetry(cleanDomain, this.retryCount);
      
      // Parse the response based on the API service
      const result = this._parseApiResponse(whoisData, cleanDomain);
      
      return result;
    } catch (error) {
      logger.error(`Error checking domain registration via API for ${domain}: ${error.message}`);
      
      // When in doubt, assume registered to avoid false positives
      return {
        isRegistered: true,
        registrar: null,
        expirationDate: null,
        whoisData: null,
        error: error.message
      };
    }
  }

  /**
   * Fetch WHOIS data with retry mechanism
   * @param {string} domain - Domain to check
   * @param {number} retriesLeft - Number of retries left
   * @returns {Promise<Object>} WHOIS data
   * @private
   */
  async _fetchWithRetry(domain, retriesLeft) {
    try {
      const response = await this._makeApiRequest(domain);
      return response;
    } catch (error) {
      if (retriesLeft <= 0) {
        throw error;
      }
      
      logger.warn(`WHOIS API request failed, retrying (${retriesLeft} retries left): ${error.message}`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      
      // Retry with one less retry
      return this._fetchWithRetry(domain, retriesLeft - 1);
    }
  }

  /**
   * Make a request to the WHOIS API
   * @param {string} domain - Domain to check
   * @returns {Promise<Object>} API response
   * @private
   */
  async _makeApiRequest(domain) {
    // Different API services require different request formats
    switch (this.apiService) {
      case 'whoisxml':
        return this._makeWhoisXmlRequest(domain);
      case 'whoapi':
        return this._makeWhoApiRequest(domain);
      default:
        return this._makeGenericRequest(domain);
    }
  }

  /**
   * Make a request to WhoisXML API
   * @param {string} domain - Domain to check
   * @returns {Promise<Object>} API response
   * @private
   */
  async _makeWhoisXmlRequest(domain) {
    const url = `${this.apiUrl}?apiKey=${this.apiKey}&domainName=${domain}&outputFormat=JSON`;
    
    const response = await axios.get(url, {
      timeout: this.timeout
    });
    
    return response.data;
  }

  /**
   * Make a request to WhoAPI
   * @param {string} domain - Domain to check
   * @returns {Promise<Object>} API response
   * @private
   */
  async _makeWhoApiRequest(domain) {
    const url = `${this.apiUrl}?domain=${domain}&key=${this.apiKey}&r=whois`;
    
    const response = await axios.get(url, {
      timeout: this.timeout
    });
    
    return response.data;
  }

  /**
   * Make a request to a generic WHOIS API
   * @param {string} domain - Domain to check
   * @returns {Promise<Object>} API response
   * @private
   */
  async _makeGenericRequest(domain) {
    // Default to a simple GET request with domain and apiKey as query parameters
    const url = `${this.apiUrl}?domain=${domain}&apiKey=${this.apiKey}`;
    
    const response = await axios.get(url, {
      timeout: this.timeout
    });
    
    return response.data;
  }

  /**
   * Parse the API response based on the API service
   * @param {Object} data - API response data
   * @param {string} domain - Domain that was checked
   * @returns {{isRegistered: boolean, registrar: string|null, expirationDate: Date|null, whoisData: Object}}
   * @private
   */
  _parseApiResponse(data, domain) {
    switch (this.apiService) {
      case 'whoisxml':
        return this._parseWhoisXmlResponse(data);
      case 'whoapi':
        return this._parseWhoApiResponse(data);
      default:
        return this._parseGenericResponse(data, domain);
    }
  }

  /**
   * Parse WhoisXML API response
   * @param {Object} data - API response data
   * @returns {{isRegistered: boolean, registrar: string|null, expirationDate: Date|null, whoisData: Object}}
   * @private
   */
  _parseWhoisXmlResponse(data) {
    // WhoisXML API sends a 'WhoisRecord' with registration info
    const whoisRecord = data.WhoisRecord || {};
    
    // Check if the domain is registered
    // WhoisXML typically has a 'dataError' field for non-existing domains
    const isRegistered = !whoisRecord.dataError;
    
    // Get registrar info
    const registrarInfo = whoisRecord.registrarName || 
                          (whoisRecord.registrar ? whoisRecord.registrar.name : null);
    
    // Get expiration date
    let expirationDate = null;
    if (whoisRecord.registryData && whoisRecord.registryData.expiresDate) {
      expirationDate = new Date(whoisRecord.registryData.expiresDate);
    } else if (whoisRecord.expiresDate) {
      expirationDate = new Date(whoisRecord.expiresDate);
    }
    
    return {
      isRegistered,
      registrar: registrarInfo,
      expirationDate: isNaN(expirationDate) ? null : expirationDate,
      whoisData: whoisRecord
    };
  }

  /**
   * Parse WhoAPI response
   * @param {Object} data - API response data
   * @returns {{isRegistered: boolean, registrar: string|null, expirationDate: Date|null, whoisData: Object}}
   * @private
   */
  _parseWhoApiResponse(data) {
    // WhoAPI typically returns a 'registered' field indicating status
    const isRegistered = data.registered === 'yes' || data.registered === true;
    
    // Get registrar info
    const registrar = data.registrar || null;
    
    // Get expiration date
    let expirationDate = null;
    if (data.date_expires) {
      expirationDate = new Date(data.date_expires);
    }
    
    return {
      isRegistered,
      registrar,
      expirationDate: isNaN(expirationDate) ? null : expirationDate,
      whoisData: data
    };
  }

  /**
   * Parse a generic API response
   * @param {Object} data - API response data
   * @param {string} domain - Domain that was checked
   * @returns {{isRegistered: boolean, registrar: string|null, expirationDate: Date|null, whoisData: Object}}
   * @private
   */
  _parseGenericResponse(data, domain) {
    // Attempt to determine if domain is registered based on common API response patterns
    let isRegistered = true;
    
    // Common response patterns for domain availability
    const availabilityIndicators = [
      data.available === true,
      data.available === 'yes',
      data.registered === false,
      data.registered === 'no',
      data.status === 'available',
      data.status === 'not registered',
      data.domainAvailability === 'AVAILABLE'
    ];
    
    if (availabilityIndicators.some(Boolean)) {
      isRegistered = false;
    }
    
    // Try to find registrar info in common fields
    const registrar = data.registrar || 
                     data.registrarName || 
                     data.sponsoringRegistrar || 
                     null;
    
    // Try to find expiration date in common fields
    let expirationDate = null;
    const possibleExpirationFields = [
      'expirationDate',
      'expires',
      'expires_at',
      'expiry',
      'expiryDate',
      'expiration',
      'registryExpiryDate'
    ];
    
    for (const field of possibleExpirationFields) {
      if (data[field]) {
        try {
          expirationDate = new Date(data[field]);
          if (!isNaN(expirationDate)) break;
        } catch (e) {
          // Continue to next field
        }
      }
    }
    
    return {
      isRegistered,
      registrar,
      expirationDate,
      whoisData: data
    };
  }
}

module.exports = WhoisApiProvider;