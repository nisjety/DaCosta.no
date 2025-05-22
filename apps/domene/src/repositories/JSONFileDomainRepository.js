// src/repositories/JSONFileDomainRepository.js
// Liskov Substitution: Concrete implementation of DomainRepository

const fs = require('fs').promises;
const path = require('path');
const DomainRepository = require('./DomainRepository');
const Domain = require('../models/Domain');
const DomainStatus = require('../models/DomainStatus');
const logger = require('../utils/logger');

/**
 * JSON file-based domain repository
 */
class JSONFileDomainRepository extends DomainRepository {
  /**
   * Create a new JSONFileDomainRepository
   * @param {Object} options - Repository options
   * @param {string} options.filePath - Path to JSON storage file
   */
  constructor(options = {}) {
    super();
    this.filePath = options.filePath || path.join(process.cwd(), 'data', 'domains.json');
    this.domains = null; // Cache
  }

  /**
   * Initialize the repository
   */
  async initialize() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      
      // Create file if it doesn't exist
      try {
        await fs.access(this.filePath);
      } catch (error) {
        logger.info(`Creating new domains storage file at ${this.filePath}`);
        await fs.writeFile(this.filePath, JSON.stringify({ domains: [] }));
      }
      
      // Load domains into cache
      await this._loadDomains();
      
      logger.info(`Initialized domain repository with ${this.domains.length} domains`);
      return true;
    } catch (error) {
      logger.error(`Error initializing domain repository: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load domains from file into memory
   * @private
   */
  async _loadDomains() {
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(data);
      
      // Convert plain objects to Domain instances
      this.domains = Array.isArray(parsed.domains) 
        ? parsed.domains.map(d => Domain.fromJSON(d))
        : [];
        
      return this.domains;
    } catch (error) {
      logger.error(`Error loading domains: ${error.message}`);
      this.domains = [];
      return [];
    }
  }

  /**
   * Save domains to file
   * @private
   */
  async _saveDomains() {
    try {
      const data = JSON.stringify({
        domains: this.domains.map(d => d.toJSON()),
        lastUpdated: new Date().toISOString()
      }, null, 2);
      
      await fs.writeFile(this.filePath, data, 'utf8');
      return true;
    } catch (error) {
      logger.error(`Error saving domains: ${error.message}`);
      return false;
    }
  }

  /**
   * Get a domain by name
   * @param {string} domainName
   * @returns {Promise<Domain|null>}
   */
  async getDomain(domainName) {
    if (!this.domains) await this._loadDomains();
    
    return this.domains.find(d => d.name.toLowerCase() === domainName.toLowerCase()) || null;
  }

  /**
   * Get all domains
   * @returns {Promise<Array<Domain>>}
   */
  async getAllDomains() {
    if (!this.domains) await this._loadDomains();
    return [...this.domains]; // Return a copy
  }

  /**
   * Get active domains (those that should be monitored)
   * @returns {Promise<Array<Domain>>}
   */
  async getActiveDomains() {
    if (!this.domains) await this._loadDomains();
    return this.domains.filter(d => d.isActive);
  }

  /**
   * Save a domain
   * @param {Domain} domain
   * @returns {Promise<Domain>}
   */
  async saveDomain(domain) {
    if (!this.domains) await this._loadDomains();
    
    // Check if domain already exists
    const index = this.domains.findIndex(d => d.name.toLowerCase() === domain.name.toLowerCase());
    
    if (index >= 0) {
      // Update existing
      this.domains[index] = domain;
    } else {
      // Add new
      this.domains.push(domain);
    }
    
    await this._saveDomains();
    return domain;
  }

  /**
   * Save multiple domains
   * @param {Array<Domain>} domains
   * @returns {Promise<Array<Domain>>}
   */
  async saveDomains(domains) {
    if (!this.domains) await this._loadDomains();
    
    // Update or add each domain
    for (const domain of domains) {
      const index = this.domains.findIndex(d => d.name.toLowerCase() === domain.name.toLowerCase());
      
      if (index >= 0) {
        // Update existing
        this.domains[index] = domain;
      } else {
        // Add new
        this.domains.push(domain);
      }
    }
    
    await this._saveDomains();
    return domains;
  }

  /**
   * Delete a domain
   * @param {string} domainName
   * @returns {Promise<boolean>} Success status
   */
  async deleteDomain(domainName) {
    if (!this.domains) await this._loadDomains();
    
    const initialLength = this.domains.length;
    this.domains = this.domains.filter(d => d.name.toLowerCase() !== domainName.toLowerCase());
    
    if (this.domains.length !== initialLength) {
      await this._saveDomains();
      return true;
    }
    
    return false;
  }
}

module.exports = JSONFileDomainRepository;