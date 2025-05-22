// src/services/RegistrarService.js
// Single Responsibility: Handles domain registrar-related operations

const logger = require('../utils/logger');

/**
 * Service for domain registrar operations
 */
class RegistrarService {
  /**
   * Create a new RegistrarService
   * @param {Object} registrarLinks - Configuration for registrar links
   */
  constructor(registrarLinks = {}) {
    this.registrarLinks = {
      // Default registrars
      GoDaddy: (domain) => `https://www.godaddy.com/domainsearch/find?domainToCheck=${domain}`,
      Namecheap: (domain) => `https://www.namecheap.com/domains/registration/results/?domain=${domain}`,
      NetworkSolutions: (domain) => `https://www.networksolutions.com/domain-name-registration/index.jsp?domainToCheck=${domain}`,
      Google: (domain) => `https://domains.google.com/registrar/search?searchTerm=${domain}`,
      Default: (domain) => `https://domains.google.com/registrar/search?searchTerm=${domain}`,
      // Override with provided links
      ...registrarLinks
    };
  }

  /**
   * Add a new registrar
   * @param {string} registrarName
   * @param {Function} linkGenerator
   */
  addRegistrar(registrarName, linkGenerator) {
    if (typeof linkGenerator !== 'function') {
      throw new Error('Link generator must be a function');
    }
    
    this.registrarLinks[registrarName] = linkGenerator;
    logger.info(`Added registrar: ${registrarName}`);
  }

  /**
   * Get all supported registrars
   * @returns {Array<string>}
   */
  getSupportedRegistrars() {
    return Object.keys(this.registrarLinks);
  }

  /**
   * Generate a purchase link for a domain
   * @param {string} domain - Domain name
   * @param {string} preferredRegistrar - Preferred registrar
   * @returns {string} Purchase URL
   */
  getPurchaseLink(domain, preferredRegistrar = 'Default') {
    // Clean domain name
    const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/i, '').split('/')[0];
    
    // Get link generator function
    const getLinkFn = this.registrarLinks[preferredRegistrar] || this.registrarLinks.Default;
    
    // Generate and return link
    return getLinkFn(cleanDomain);
  }
}

module.exports = RegistrarService;