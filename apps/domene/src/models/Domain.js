// src/models/Domain.js
// Single Responsibility: Represents a domain entity and its properties

class Domain {
    constructor(name, preferredRegistrar = 'Default') {
      if (!name || typeof name !== 'string') {
        throw new Error('Domain name is required and must be a string');
      }
      
      this.name = name;
      this.preferredRegistrar = preferredRegistrar;
      this.lastChecked = null;
      this.lastStatus = null;
      this.isActive = true;
      this.history = [];
    }
  
    /**
     * Update the domain status and record in history
     * @param {DomainStatus} status - The new domain status
     */
    updateStatus(status) {
      const previousStatus = this.lastStatus;
      this.lastStatus = status;
      this.lastChecked = new Date();
      
      // Add to history
      this.history.push({
        timestamp: new Date(),
        status: status
      });
      
      // Trim history if it gets too large (keep last 100 entries)
      if (this.history.length > 100) {
        this.history = this.history.slice(this.history.length - 100);
      }
      
      return {
        previousStatus,
        currentStatus: status,
        hasChanged: previousStatus !== null && !previousStatus.equals(status)
      };
    }
  
    /**
     * Check if status has changed from active to available
     * @param {DomainStatus} previousStatus
     * @param {DomainStatus} currentStatus
     * @returns {boolean}
     */
    hasStatusChangedToAvailable(previousStatus, currentStatus) {
      return previousStatus && 
             currentStatus && 
             previousStatus.isRegistered && 
             !currentStatus.isRegistered;
    }
  
    /**
     * Convert domain to plain object for serialization
     */
    toJSON() {
      return {
        name: this.name,
        preferredRegistrar: this.preferredRegistrar,
        lastChecked: this.lastChecked,
        lastStatus: this.lastStatus ? this.lastStatus.toJSON() : null,
        isActive: this.isActive,
        history: this.history.map(h => ({
          timestamp: h.timestamp,
          status: h.status ? h.status.toJSON() : null
        }))
      };
    }
  
    /**
     * Create domain from plain object
     * @param {Object} data 
     * @returns {Domain}
     */
    static fromJSON(data) {
      const domain = new Domain(data.name, data.preferredRegistrar);
      domain.lastChecked = data.lastChecked ? new Date(data.lastChecked) : null;
      domain.lastStatus = data.lastStatus ? DomainStatus.fromJSON(data.lastStatus) : null;
      domain.isActive = data.isActive !== undefined ? data.isActive : true;
      
      // Convert history if available
      if (Array.isArray(data.history)) {
        domain.history = data.history.map(h => ({
          timestamp: new Date(h.timestamp),
          status: h.status ? DomainStatus.fromJSON(h.status) : null
        }));
      }
      
      return domain;
    }
  }
  
  module.exports = Domain;