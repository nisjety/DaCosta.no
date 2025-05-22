// src/auth/wsAuth.js
const { getUserFromCache, addUserToCache } = require('./userCache');
const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * Authenticate WebSocket connection
 * @param {Object} req - HTTP request object from WebSocket upgrade
 * @returns {Object|null} User object if authenticated, null otherwise
 */
async function authenticateWebSocket(req) {
  // Skip authentication if disabled
  if (!config || !config.auth || config.auth.enabled === false) {
    return { id: 'anonymous', authenticated: false };
  }

  try {
    // Extract user ID from header (from gateway)
    const userId = req.headers['x-user-id'];
    
    if (!userId) {
      logger.warn('WebSocket connection attempt without x-user-id header');
      return null;
    }
    
    // Check if user exists in cache
    let userDetails = await getUserFromCache(userId);
    
    if (!userDetails) {
      // Create minimal user info based on header
      userDetails = {
        id: userId,
        roles: ['user'], // Default role
        permissions: [], // Default empty permissions
        lastUpdated: new Date().toISOString()
      };
      
      // Additional headers that might contain user info
      if (req.headers['x-user-roles']) {
        try {
          userDetails.roles = JSON.parse(req.headers['x-user-roles']);
        } catch (e) {
          logger.warn('Failed to parse x-user-roles header');
        }
      }
      
      if (req.headers['x-user-permissions']) {
        try {
          userDetails.permissions = JSON.parse(req.headers['x-user-permissions']);
        } catch (e) {
          logger.warn('Failed to parse x-user-permissions header');
        }
      }
      
      if (req.headers['x-organization-id']) {
        userDetails.organizationId = req.headers['x-organization-id'];
      }
      
      // Store this user in cache
      await addUserToCache(userId, userDetails);
    }

    // Create user object for WebSocket connection
    const user = {
      ...userDetails,
      authenticated: true
    };

    logger.debug(`WebSocket authenticated: ${userId}`);
    return user;
  } catch (error) {
    logger.error('WebSocket authentication error:', error.message);
    return null;
  }
}

module.exports = {
  authenticateWebSocket
};