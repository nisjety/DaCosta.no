// src/config/eventTypes.js
// Defines event types for application-wide use

/**
 * Application event types
 */
const EventTypes = {
    // Domain events
    DOMAIN_ADDED: 'domain.added',
    DOMAIN_UPDATED: 'domain.updated',
    DOMAIN_DELETED: 'domain.deleted',
    DOMAIN_STATUS_CHANGED: 'domain.status.changed',
    DOMAIN_BECAME_AVAILABLE: 'domain.became.available',
    
    // Monitoring events
    MONITORING_STARTED: 'monitoring.started',
    MONITORING_COMPLETED: 'monitoring.completed',
    MONITORING_FAILED: 'monitoring.failed',
    
    // Scheduler events
    SCHEDULER_STARTED: 'scheduler.started',
    SCHEDULER_STOPPED: 'scheduler.stopped',
    SCHEDULER_UPDATED: 'scheduler.updated',
    
    // Notification events
    NOTIFICATION_SENT: 'notification.sent',
    
    // System events
    SYSTEM_INITIALIZED: 'system.initialized',
    SYSTEM_ERROR: 'system.error'
  };
  
  module.exports = EventTypes;