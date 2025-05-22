// src/services/DomainService.js
// Single Responsibility & Dependency Inversion: Service for domain operations

const Domain = require('../models/Domain');
const DomainStatus = require('../models/DomainStatus');
const logger = require('../utils/logger');
const EventTypes = require('../config/eventTypes');

/**
 * Service for domain management and monitoring
 */
class DomainService {
  /**
   * Create a new DomainService
   * @param {Object} providers - Service providers
   * @param {DomainRepository} providers.domainRepository - Repository for domain storage
   * @param {StatusProvider} providers.statusProvider - Provider for website status checks
   * @param {WhoisProvider} providers.whoisProvider - Provider for WHOIS checks
   * @param {RegistrarService} providers.registrarService - Service for registrar links
   * @param {EventBusService} providers.eventBus - Event bus for publishing events
   */
  constructor({ domainRepository, statusProvider, whoisProvider, registrarService, eventBus }) {
    this.domainRepository = domainRepository;
    this.statusProvider = statusProvider;
    this.whoisProvider = whoisProvider;
    this.registrarService = registrarService;
    this.eventBus = eventBus;
  }

  /**
   * Add a new domain to monitor
   * @param {string} domainName - Domain name
   * @param {string} preferredRegistrar - Preferred registrar for purchase
   * @returns {Promise<Domain>}
   */
  async addDomain(domainName, preferredRegistrar = 'Default') {
    const existingDomain = await this.domainRepository.getDomain(domainName);
    
    if (existingDomain) {
      throw new Error(`Domain ${domainName} is already being monitored`);
    }
    
    const domain = new Domain(domainName, preferredRegistrar);
    
    // Check initial status
    await this.checkDomainStatus(domain);
    
    // Save domain
    const savedDomain = await this.domainRepository.saveDomain(domain);
    
    // Publish event
    if (this.eventBus) {
      this.eventBus.publish(EventTypes.DOMAIN_ADDED, { 
        domain: savedDomain.toJSON() 
      });
    }
    
    return savedDomain;
  }

  /**
   * Get all monitored domains
   * @returns {Promise<Array<Domain>>}
   */
  async getAllDomains() {
    return this.domainRepository.getAllDomains();
  }

  /**
   * Get a specific domain
   * @param {string} domainName
   * @returns {Promise<Domain|null>}
   */
  async getDomain(domainName) {
    return this.domainRepository.getDomain(domainName);
  }

  /**
   * Update domain settings
   * @param {string} domainName
   * @param {Object} updates - Fields to update
   * @returns {Promise<Domain>}
   */
  async updateDomain(domainName, updates) {
    const domain = await this.domainRepository.getDomain(domainName);
    
    if (!domain) {
      throw new Error(`Domain ${domainName} not found`);
    }
    
    // Apply updates
    if (updates.preferredRegistrar) {
      domain.preferredRegistrar = updates.preferredRegistrar;
    }
    
    if (typeof updates.isActive === 'boolean') {
      domain.isActive = updates.isActive;
    }
    
    const updatedDomain = await this.domainRepository.saveDomain(domain);
    
    // Publish event
    if (this.eventBus) {
      this.eventBus.publish(EventTypes.DOMAIN_UPDATED, { 
        domain: updatedDomain.toJSON() 
      });
    }
    
    return updatedDomain;
  }

  /**
   * Delete a domain
   * @param {string} domainName
   * @returns {Promise<boolean>}
   */
  async deleteDomain(domainName) {
    const success = await this.domainRepository.deleteDomain(domainName);
    
    // Publish event
    if (success && this.eventBus) {
      this.eventBus.publish(EventTypes.DOMAIN_DELETED, { 
        domainName 
      });
    }
    
    return success;
  }

  /**
   * Check the status of a single domain
   * @param {Domain} domain - Domain to check
   * @returns {Promise<{domain: Domain, statusChanged: boolean, becameAvailable: boolean}>}
   */
  async checkDomainStatus(domain) {
    try {
      logger.info(`Checking status for domain: ${domain.name}`);
      
      // Step 1: Check website status
      const websiteStatus = await this.statusProvider.checkStatus(domain.name);
      logger.debug(`Website status for ${domain.name}:`, websiteStatus);
      
      // Step 2: Check WHOIS information if website is down or we don't have recent data
      let domainRegistrationInfo = { isRegistered: true };
      
      if (!websiteStatus.isUp) {
        domainRegistrationInfo = await this.whoisProvider.checkDomainRegistration(domain.name);
        logger.debug(`WHOIS status for ${domain.name}:`, domainRegistrationInfo);
      }
      
      // Step 3: Create the new status
      const newStatus = new DomainStatus(
        websiteStatus.isUp,
        domainRegistrationInfo.isRegistered,
        domainRegistrationInfo.registrar,
        domainRegistrationInfo.expirationDate,
        {
          websiteMetadata: websiteStatus.metadata,
          whoisMetadata: domainRegistrationInfo.whoisData
        }
      );
      
      // Step 4: Update the domain with the new status and save the changes
      const statusUpdate = domain.updateStatus(newStatus);
      const updatedDomain = await this.domainRepository.saveDomain(domain);
      
      // Step 5: Determine if the domain became available
      const becameAvailable = statusUpdate.previousStatus && 
                              statusUpdate.previousStatus.isRegistered && 
                              !newStatus.isRegistered;
      
      // Publish events if status changed
      if (this.eventBus && statusUpdate.hasChanged) {
        // Status changed event
        this.eventBus.publish(EventTypes.DOMAIN_STATUS_CHANGED, {
          domain: updatedDomain.toJSON(),
          previousStatus: statusUpdate.previousStatus ? statusUpdate.previousStatus.toJSON() : null,
          currentStatus: newStatus.toJSON()
        });
        
        // Domain became available event
        if (becameAvailable) {
          this.eventBus.publish(EventTypes.DOMAIN_BECAME_AVAILABLE, {
            domain: updatedDomain.toJSON(),
            purchaseLink: this.getPurchaseLink(domain.name, domain.preferredRegistrar)
          });
        }
      }
      
      return {
        domain: updatedDomain,
        statusChanged: statusUpdate.hasChanged,
        becameAvailable
      };
    } catch (error) {
      logger.error(`Error checking domain status for ${domain.name}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate a purchase link for a domain
   * @param {string} domainName
   * @param {string} preferredRegistrar
   * @returns {string} Purchase URL
   */
  getPurchaseLink(domainName, preferredRegistrar) {
    return this.registrarService.getPurchaseLink(domainName, preferredRegistrar);
  }

  /**
   * Check all active domains and return those that have become available
   * @returns {Promise<Array<{domain: Domain, purchaseLink: string}>>}
   */
  async checkAllDomains() {
    const activeDomains = await this.domainRepository.getActiveDomains();
    const availableDomains = [];
    
    logger.info(`Checking ${activeDomains.length} active domains`);
    
    for (const domain of activeDomains) {
      try {
        const result = await this.checkDomainStatus(domain);
        
        if (result.becameAvailable) {
          const purchaseLink = this.getPurchaseLink(domain.name, domain.preferredRegistrar);
          availableDomains.push({ domain, purchaseLink });
        }
      } catch (error) {
        logger.error(`Error processing domain ${domain.name}: ${error.message}`);
        // Continue with next domain
      }
    }
    
    return availableDomains;
  }
}

module.exports = DomainService;