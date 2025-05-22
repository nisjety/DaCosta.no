// src/middleware/authMidlewares.js
const logger = require('../utils/logger');
const { getUserFromCache } = require('../auth/userCache');
const config = require('../config/config');

/**
 * Middleware to authenticate API requests
 */
async function authenticate(req, res, next) {
  // Skip authentication if disabled in config
  if (!config || !config.auth || config.auth.enabled === false) {
    req.user = { id: 'anonymous', authenticated: false };
    return next();
  }
  
  try {
    // Extract token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // For demo or development, allow a simple token
    if (config.auth.devMode && token === config.auth.devToken) {
      req.user = {
        id: 'admin',
        username: 'admin',
        roles: ['admin'],
        authenticated: true
      };
      return next();
    }
    
    // Check if user exists in cache
    const userId = req.headers['x-user-id'];
    if (userId) {
      const cachedUser = await getUserFromCache(userId);
      if (cachedUser) {
        req.user = {
          ...cachedUser,
          authenticated: true
        };
        return next();
      }
    }
    
    // Failed authentication
    logger.warn(`Authentication failed for token: ${token.substring(0, 10)}...`);
    return res.status(401).json({ message: 'Invalid authentication' });
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(500).json({ message: 'Authentication error' });
  }
}

/**
 * Middleware to check if user has admin role
 */
function adminOnly(req, res, next) {
  // Skip role check if authentication is disabled
  if (!config || !config.auth || config.auth.enabled === false) {
    return next();
  }
  
  if (!req.user || !req.user.authenticated) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  // Check if user has admin role
  if (!req.user.roles || !req.user.roles.includes('admin')) {
    logger.warn(`Access denied for user ${req.user.id} - missing admin role`);
    return res.status(403).json({ message: 'Access denied' });
  }
  
  next();
}

module.exports = {
  authenticate,
  adminOnly
};