// src/models/DomainStatus.js
// Single Responsibility: Value object representing domain status

class DomainStatus {
    /**
     * Create a new domain status
     * @param {boolean} isWebsiteUp - Is the website responding
     * @param {boolean} isRegistered - Is the domain registered
     * @param {string|null} registrar - Current registrar if known
     * @param {Date|null} expirationDate - Domain expiration date if known
     * @param {Object} metadata - Additional metadata about the domain
     */
    constructor(isWebsiteUp, isRegistered, registrar = null, expirationDate = null, metadata = {}) {
      this.isWebsiteUp = !!isWebsiteUp;
      this.isRegistered = !!isRegistered;
      this.registrar = registrar;
      this.expirationDate = expirationDate instanceof Date ? expirationDate : null;
      this.metadata = metadata || {};
      this.timestamp = new Date();
    }
  
    /**
     * Get a user-friendly status description
     * @returns {string}
     */
    getStatusDescription() {
      if (this.isRegistered && this.isWebsiteUp) {
        return 'active';
      } else if (this.isRegistered && !this.isWebsiteUp) {
        return 'registered-down';
      } else if (!this.isRegistered) {
        return 'available';
      }
      return 'unknown';
    }
  
    /**
     * Check if domain is available for purchase
     * @returns {boolean}
     */
    isAvailable() {
      return !this.isRegistered;
    }
  
    /**
     * Compare with another domain status
     * @param {DomainStatus} otherStatus 
     * @returns {boolean}
     */
    equals(otherStatus) {
      if (!(otherStatus instanceof DomainStatus)) return false;
      
      return this.isWebsiteUp === otherStatus.isWebsiteUp && 
             this.isRegistered === otherStatus.isRegistered;
    }
  
    /**
     * Convert to a plain object for serialization
     * @returns {Object}
     */
    toJSON() {
      return {
        isWebsiteUp: this.isWebsiteUp,
        isRegistered: this.isRegistered,
        registrar: this.registrar,
        expirationDate: this.expirationDate ? this.expirationDate.toISOString() : null,
        metadata: this.metadata,
        timestamp: this.timestamp.toISOString(),
        statusDescription: this.getStatusDescription()
      };
    }
  
    /**
     * Create from a plain object
     * @param {Object} data 
     * @returns {DomainStatus}
     */
    static fromJSON(data) {
      if (!data) return null;
      
      const status = new DomainStatus(
        data.isWebsiteUp,
        data.isRegistered,
        data.registrar,
        data.expirationDate ? new Date(data.expirationDate) : null,
        data.metadata
      );
      
      if (data.timestamp) {
        status.timestamp = new Date(data.timestamp);
      }
      
      return status;
    }
  }
  
  module.exports = DomainStatus;