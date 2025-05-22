// src/repositories/MongoDomainRepository.js
// MongoDB implementation of domain repository

const { MongoClient, ObjectId } = require('mongodb');
const DomainRepository = require('./DomainRepository');
const Domain = require('../models/Domain');
const DomainStatus = require('../models/DomainStatus');
const logger = require('../utils/logger');

/**
 * MongoDB-based domain repository
 */
class MongoDomainRepository extends DomainRepository {
  /**
   * Create a new MongoDomainRepository
   * @param {Object} options - Repository options
   * @param {string} options.connectionString - MongoDB connection string
   * @param {string} options.database - Database name
   * @param {string} options.collection - Collection name
   */
  constructor(options = {}) {
    super();
    this.connectionString = options.connectionString || 'mongodb://localhost:27017';
    this.dbName = options.database || 'domain_monitor';
    this.collectionName = options.collection || 'domains';
    this.client = null;
    this.db = null;
    this.collection = null;
  }

  /**
   * Initialize the repository
   */
  async initialize() {
    try {
      // Connect to MongoDB
      // Removed deprecated options as they're now default in MongoDB driver v4+
      this.client = new MongoClient(this.connectionString);
      
      await this.client.connect();
      logger.info(`Connected to MongoDB: ${this.connectionString}`);
      
      // Get database and collection
      this.db = this.client.db(this.dbName);
      this.collection = this.db.collection(this.collectionName);
      
      // Create indexes
      await this.collection.createIndex({ name: 1 }, { unique: true });
      await this.collection.createIndex({ isActive: 1 });
      
      logger.info(`Initialized MongoDB domain repository: ${this.dbName}.${this.collectionName}`);
      return true;
    } catch (error) {
      logger.error(`Error initializing MongoDB repository: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a domain by name
   * @param {string} domainName
   * @returns {Promise<Domain|null>}
   */
  async getDomain(domainName) {
    try {
      const doc = await this.collection.findOne({ name: domainName.toLowerCase() });
      
      if (!doc) {
        return null;
      }
      
      return this._mapToDomain(doc);
    } catch (error) {
      logger.error(`Error getting domain from MongoDB: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all domains
   * @returns {Promise<Array<Domain>>}
   */
  async getAllDomains() {
    try {
      const docs = await this.collection.find().toArray();
      return docs.map(doc => this._mapToDomain(doc));
    } catch (error) {
      logger.error(`Error getting all domains from MongoDB: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get active domains (those that should be monitored)
   * @returns {Promise<Array<Domain>>}
   */
  async getActiveDomains() {
    try {
      const docs = await this.collection.find({ isActive: true }).toArray();
      return docs.map(doc => this._mapToDomain(doc));
    } catch (error) {
      logger.error(`Error getting active domains from MongoDB: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save a domain
   * @param {Domain} domain
   * @returns {Promise<Domain>}
   */
  async saveDomain(domain) {
    try {
      const doc = this._mapFromDomain(domain);
      
      // Save with upsert (insert if not exists, update if exists)
      // MongoDB 4.x has different options for findOneAndUpdate
      const result = await this.collection.findOneAndUpdate(
        { name: domain.name.toLowerCase() },
        { $set: doc },
        { 
          upsert: true, 
          returnDocument: 'after'  // Note: In newer MongoDB driver versions, 'after' is correct
        }
      );
      
      // If we can't get the updated document from result.value, fetch it directly
      if (!result || !result.value) {
        const savedDoc = await this.collection.findOne({ name: domain.name.toLowerCase() });
        if (!savedDoc) {
          throw new Error(`Failed to retrieve saved domain: ${domain.name}`);
        }
        return this._mapToDomain(savedDoc);
      }
      
      return this._mapToDomain(result.value);
    } catch (error) {
      logger.error(`Error saving domain to MongoDB: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save multiple domains
   * @param {Array<Domain>} domains
   * @returns {Promise<Array<Domain>>}
   */
  async saveDomains(domains) {
    try {
      const results = [];
      
      // Use a transaction for multiple updates
      for (const domain of domains) {
        const result = await this.saveDomain(domain);
        results.push(result);
      }
      
      return results;
    } catch (error) {
      logger.error(`Error saving multiple domains to MongoDB: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a domain
   * @param {string} domainName
   * @returns {Promise<boolean>} Success status
   */
  async deleteDomain(domainName) {
    try {
      const result = await this.collection.deleteOne({ name: domainName.toLowerCase() });
      return result.deletedCount > 0;
    } catch (error) {
      logger.error(`Error deleting domain from MongoDB: ${error.message}`);
      throw error;
    }
  }

  /**
   * Map MongoDB document to Domain entity
   * @param {Object} doc - MongoDB document
   * @returns {Domain} Domain entity
   * @private
   */
  _mapToDomain(doc) {
    if (!doc || typeof doc !== 'object') {
      logger.error(`Cannot map invalid document to Domain: ${JSON.stringify(doc)}`);
      throw new Error('Invalid document structure. Cannot map to Domain.');
    }
    
    if (!doc.name) {
      logger.error(`Document missing required name property: ${JSON.stringify(doc)}`);
      throw new Error('Document missing required name property');
    }
    
    const domain = new Domain(doc.name, doc.preferredRegistrar || 'Default');
    
    domain.lastChecked = doc.lastChecked ? new Date(doc.lastChecked) : null;
    domain.isActive = doc.isActive !== undefined ? doc.isActive : true;
    
    // Map lastStatus
    if (doc.lastStatus) {
      domain.lastStatus = new DomainStatus(
        doc.lastStatus.isWebsiteUp,
        doc.lastStatus.isRegistered,
        doc.lastStatus.registrar,
        doc.lastStatus.expirationDate ? new Date(doc.lastStatus.expirationDate) : null,
        doc.lastStatus.metadata || {}
      );
      
      if (doc.lastStatus.timestamp) {
        domain.lastStatus.timestamp = new Date(doc.lastStatus.timestamp);
      }
    }
    
    // Map history
    if (Array.isArray(doc.history)) {
      domain.history = doc.history.map(h => ({
        timestamp: new Date(h.timestamp),
        status: h.status ? new DomainStatus(
          h.status.isWebsiteUp,
          h.status.isRegistered,
          h.status.registrar,
          h.status.expirationDate ? new Date(h.status.expirationDate) : null,
          h.status.metadata || {}
        ) : null
      }));
      
      // Ensure history has timestamps
      domain.history.forEach(h => {
        if (h.status && h.status.timestamp) {
          h.status.timestamp = new Date(h.status.timestamp);
        }
      });
    }
    
    return domain;
  }

  /**
   * Map Domain entity to MongoDB document
   * @param {Domain} domain - Domain entity
   * @returns {Object} MongoDB document
   * @private
   */
  _mapFromDomain(domain) {
    if (!domain || typeof domain !== 'object') {
      logger.error('Cannot map invalid domain to document');
      throw new Error('Invalid domain object');
    }
    
    if (!domain.name) {
      logger.error(`Domain missing required name property: ${JSON.stringify(domain)}`);
      throw new Error('Domain missing required name property');
    }
    
    const doc = {
      name: domain.name.toLowerCase(),
      preferredRegistrar: domain.preferredRegistrar || 'Default',
      lastChecked: domain.lastChecked || null,
      isActive: domain.isActive !== undefined ? domain.isActive : true
    };
    
    // Map lastStatus
    if (domain.lastStatus) {
      doc.lastStatus = {
        isWebsiteUp: domain.lastStatus.isWebsiteUp,
        isRegistered: domain.lastStatus.isRegistered,
        registrar: domain.lastStatus.registrar,
        expirationDate: domain.lastStatus.expirationDate,
        timestamp: domain.lastStatus.timestamp,
        metadata: domain.lastStatus.metadata
      };
    }
    
    // Map history
    if (Array.isArray(domain.history)) {
      doc.history = domain.history.map(h => ({
        timestamp: h.timestamp,
        status: h.status ? {
          isWebsiteUp: h.status.isWebsiteUp,
          isRegistered: h.status.isRegistered,
          registrar: h.status.registrar,
          expirationDate: h.status.expirationDate,
          timestamp: h.status.timestamp,
          metadata: h.status.metadata
        } : null
      }));
    }
    
    return doc;
  }

  /**
   * Close the MongoDB connection
   */
  async close() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.collection = null;
      logger.info('Closed MongoDB connection');
    }
  }
}

module.exports = MongoDomainRepository;