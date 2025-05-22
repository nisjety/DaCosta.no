// src/kafka/handlers/userEventHandler.js
const { addUserToCache, removeUserFromCache } = require('../../auth/userCache');
const logger = require('../../utils/logger');

/**
 * Handle user events from Kafka
 * @param {string} key - Message key
 * @param {Object} value - Message value
 */
async function userEventHandler(key, value) {
  if (!value || !value.eventType) {
    logger.warn('Received invalid user event data');
    return;
  }

  const { eventType, user } = value;

  // Skip if user data is missing
  if (!user || !user.id) {
    logger.warn('User event missing user ID data');
    return;
  }

  switch (eventType) {
    case 'user.created':
    case 'user.updated':
    case 'user.login':
      // Store minimal user information needed for authorization
      const userData = {
        id: user.id,
        roles: user.roles || ['user'],
        permissions: user.permissions || [],
        organizationId: user.organizationId,
        lastUpdated: new Date().toISOString()
      };

      logger.info(`Adding/updating user in cache: ${user.id}`);
      await addUserToCache(user.id, userData);
      break;

    case 'user.deleted':
    case 'user.logout':
      logger.info(`Removing user from cache: ${user.id}`);
      await removeUserFromCache(user.id);
      break;

    default:
      logger.warn(`Unhandled user event type: ${eventType}`);
  }
}

module.exports = {
  userEventHandler
};