// src/services/SchedulerService.js
// Single Responsibility: Handles scheduling of monitoring tasks

const cron = require('node-cron');
const logger = require('../utils/logger');

/**
 * Service for scheduling domain monitoring
 */
class SchedulerService {
  /**
   * Create a new SchedulerService
   * @param {Object} config
   * @param {MonitorService} config.monitorService - Service for domain monitoring
   * @param {string} config.schedule - Cron schedule expression
   */
  constructor({ monitorService, schedule = '0 * * * *' }) {
    this.monitorService = monitorService;
    this.schedule = schedule;
    this.task = null;
  }

  /**
   * Start scheduled monitoring
   * @returns {boolean} Success status
   */
  start() {
    if (this.task) {
      logger.warn('Scheduler is already running');
      return false;
    }
    
    if (!cron.validate(this.schedule)) {
      logger.error(`Invalid cron schedule: ${this.schedule}`);
      return false;
    }
    
    logger.info(`Starting scheduler with schedule: ${this.schedule}`);
    
    this.task = cron.schedule(this.schedule, async () => {
      logger.info(`Running scheduled monitoring at ${new Date().toISOString()}`);
      
      try {
        const result = await this.monitorService.runMonitoringCycle();
        
        if (result.success) {
          logger.info(`Monitoring cycle completed. Found ${result.availableCount} available domains.`);
        } else {
          logger.error(`Monitoring cycle failed: ${result.error}`);
        }
      } catch (error) {
        logger.error(`Unexpected error in monitoring cycle: ${error.message}`);
      }
    });
    
    // Publish scheduler started event
    if (this.eventBus) {
      this.eventBus.publish(EventTypes.SCHEDULER_STARTED, {
        schedule: this.schedule,
        nextRun: cron.nextDate(this.schedule).toISOString()
      });
    }
    
    return true;
  }

  /**
   * Stop scheduled monitoring
   * @returns {boolean} Success status
   */
  stop() {
    if (!this.task) {
      logger.warn('Scheduler is not running');
      return false;
    }
    
    logger.info('Stopping scheduler');
    
    this.task.stop();
    this.task = null;
    
    // Publish scheduler stopped event
    if (this.eventBus) {
      this.eventBus.publish(EventTypes.SCHEDULER_STOPPED, {
        timestamp: new Date().toISOString()
      });
    }
    
    return true;
  }

  /**
   * Update the schedule
   * @param {string} schedule - New cron schedule expression
   * @returns {boolean} Success status
   */
  updateSchedule(schedule) {
    if (!cron.validate(schedule)) {
      logger.error(`Invalid cron schedule: ${schedule}`);
      return false;
    }
    
    this.schedule = schedule;
    
    // Restart if already running
    if (this.task) {
      this.stop();
      this.start();
    }
    
    // Publish scheduler updated event
    if (this.eventBus) {
      this.eventBus.publish(EventTypes.SCHEDULER_UPDATED, {
        schedule: this.schedule,
        isRunning: !!this.task,
        nextRun: this.task ? cron.nextDate(this.schedule).toISOString() : null
      });
    }
    
    logger.info(`Schedule updated to: ${schedule}`);
    return true;
  }

  /**
   * Run monitoring cycle immediately
   * @returns {Promise<Object>} Monitoring results
   */
  async runNow() {
    logger.info('Running manual monitoring cycle');
    return this.monitorService.runMonitoringCycle();
  }

  /**
   * Get current scheduler status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isRunning: !!this.task,
      schedule: this.schedule,
      nextRun: this.task ? cron.nextDate(this.schedule).toISOString() : null
    };
  }
}

module.exports = SchedulerService;