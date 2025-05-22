// src/repositories/DomainRepository.js
// Interface Segregation: Defines a repository interface for domain data

/**
 * Interface for domain data storage and retrieval
 * Concrete implementations will provide specific storage methods
 */
class DomainRepository {
    /**
     * Get a domain by name
     * @param {string} domainName
     * @returns {Promise<Domain|null>}
     */
    async getDomain(domainName) {
      throw new Error('Method not implemented: DomainRepository.getDomain must be implemented by subclasses');
    }
  
    /**
     * Get all domains
     * @returns {Promise<Array<Domain>>}
     */
    async getAllDomains() {
      throw new Error('Method not implemented: DomainRepository.getAllDomains must be implemented by subclasses');
    }
  
    /**
     * Get active domains (those that should be monitored)
     * @returns {Promise<Array<Domain>>}
     */
    async getActiveDomains() {
      throw new Error('Method not implemented: DomainRepository.getActiveDomains must be implemented by subclasses');
    }
  
    /**
     * Save a domain
     * @param {Domain} domain
     * @returns {Promise<Domain>}
     */
    async saveDomain(domain) {
      throw new Error('Method not implemented: DomainRepository.saveDomain must be implemented by subclasses');
    }
  
    /**
     * Save multiple domains
     * @param {Array<Domain>} domains
     * @returns {Promise<Array<Domain>>}
     */
    async saveDomains(domains) {
      throw new Error('Method not implemented: DomainRepository.saveDomains must be implemented by subclasses');
    }
  
    /**
     * Delete a domain
     * @param {string} domainName
     * @returns {Promise<boolean>} Success status
     */
    async deleteDomain(domainName) {
      throw new Error('Method not implemented: DomainRepository.deleteDomain must be implemented by subclasses');
    }
  }
  
  module.exports = DomainRepository;