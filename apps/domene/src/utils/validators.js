// src/utils/validators.js
// Utility functions for input validation

/**
 * Validate a domain name
 * @param {string} domain - Domain name to validate
 * @returns {boolean} True if valid
 */
function isValidDomain(domain) {
    if (!domain || typeof domain !== 'string') return false;
    
    // Basic domain regex pattern
    // Allows domain names with letters, numbers, hyphens, and dots
    // Requires at least one dot and a valid TLD (at least 2 chars)
    const domainPattern = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    
    return domainPattern.test(domain);
  }
  
  /**
   * Validate a cron schedule expression
   * @param {string} schedule - Cron schedule to validate
   * @returns {boolean} True if valid
   */
  function isValidCronSchedule(schedule) {
    if (!schedule || typeof schedule !== 'string') return false;
    
    try {
      // Use node-cron's validate function
      const cron = require('node-cron');
      return cron.validate(schedule);
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Validate an email address
   * @param {string} email - Email to validate
   * @returns {boolean} True if valid
   */
  function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    
    // Email regex pattern
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    return emailPattern.test(email);
  }
  
  /**
   * Validate a phone number
   * @param {string} phone - Phone number to validate
   * @returns {boolean} True if valid
   */
  function isValidPhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return false;
    
    // Accept E.164 format: +[country code][number]
    // This is the format required by Twilio
    const phonePattern = /^\+[1-9]\d{1,14}$/;
    
    return phonePattern.test(phone);
  }
  
  /**
   * Validate a URL
   * @param {string} url - URL to validate
   * @returns {boolean} True if valid
   */
  function isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Validate domain update data
   * @param {Object} updateData - Data to update a domain
   * @returns {{isValid: boolean, errors: Array<string>}} Validation result
   */
  function validateDomainUpdate(updateData) {
    const errors = [];
    
    if (!updateData || typeof updateData !== 'object') {
      return { isValid: false, errors: ['Update data must be an object'] };
    }
    
    if ('preferredRegistrar' in updateData && typeof updateData.preferredRegistrar !== 'string') {
      errors.push('preferredRegistrar must be a string');
    }
    
    if ('isActive' in updateData && typeof updateData.isActive !== 'boolean') {
      errors.push('isActive must be a boolean');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  module.exports = {
    isValidDomain,
    isValidCronSchedule,
    isValidEmail,
    isValidPhoneNumber,
    isValidUrl,
    validateDomainUpdate
  };