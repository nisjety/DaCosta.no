// src/services/EventBusService.js
// Single Responsibility: Handles application events and event subscriptions

const EventEmitter = require('events');
const logger = require('../utils/logger');

/**
 * Service for application-wide events
 */
class EventBusService {
  /**
   * Create a new EventBusService
   */
  constructor() {
    this.emitter = new EventEmitter();
    
    // Set high limit for event listeners
    this.emitter.setMaxListeners(50);
    
    // Track registered events for debugging
    this.registeredEvents = new Set();
  }

  /**
   * Register event types
   * @param {Array<string>} eventTypes - Event types to register
   */
  registerEvents(eventTypes) {
    eventTypes.forEach(type => {
      this.registeredEvents.add(type);
    });
    
    logger.debug(`Registered event types: ${Array.from(this.registeredEvents).join(', ')}`);
  }

  /**
   * Subscribe to an event
   * @param {string} eventType - Event type to subscribe to
   * @param {Function} handler - Event handler
   * @returns {Function} Unsubscribe function
   */
  subscribe(eventType, handler) {
    if (!this.registeredEvents.has(eventType)) {
      logger.warn(`Subscribing to unregistered event type: ${eventType}`);
    }
    
    this.emitter.on(eventType, handler);
    
    // Return unsubscribe function
    return () => {
      this.emitter.off(eventType, handler);
    };
  }

  /**
   * Publish an event
   * @param {string} eventType - Event type to publish
   * @param {Object} data - Event data
   */
  publish(eventType, data = {}) {
    if (!this.registeredEvents.has(eventType)) {
      logger.warn(`Publishing unregistered event type: ${eventType}`);
    }
    
    logger.debug(`Publishing event: ${eventType}`);
    this.emitter.emit(eventType, { ...data, type: eventType, timestamp: new Date() });
  }

  /**
   * Check if there are subscribers for an event
   * @param {string} eventType - Event type to check
   * @returns {boolean} True if there are subscribers
   */
  hasSubscribers(eventType) {
    return this.emitter.listenerCount(eventType) > 0;
  }

  /**
   * Get all registered event types
   * @returns {Array<string>} Registered event types
   */
  getRegisteredEvents() {
    return Array.from(this.registeredEvents);
  }
}

module.exports = EventBusService;