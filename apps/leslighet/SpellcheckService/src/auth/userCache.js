// src/auth/userCache.js
const redisConnection = require('../utils/RedisConnection');
const config = require('../config/config');
const logger = require('../utils/logger');

// Redis key prefix for user cache
const USER_CACHE_PREFIX = 'spellchecker:user:';

/**
 * Add or update user in cache
 * @param {string} userId - User ID (ClerkID)
 * @param {Object} userData - User data to cache
 */
async function addUserToCache(userId, userData) {
  try {
    const redis = await redisConnection.getClient();
    const key = `${USER_CACHE_PREFIX}${userId}`;
    
    // Store only essential data needed for authorization
    await redis.set(key, JSON.stringify(userData), 'EX', config.redis.userCacheTtl);
    
    logger.debug(`User ${userId} added to cache`);
    return true;
  } catch (error) {
    logger.error('Error adding user to cache:', error);
    return false;
  }
}

/**
 * Get user from cache
 * @param {string} userId - User ID (ClerkID)
 * @returns {Object|null} User data or null if not found
 */
async function getUserFromCache(userId) {
  try {
    const redis = await redisConnection.getClient();
    const key = `${USER_CACHE_PREFIX}${userId}`;
    
    const userData = await redis.get(key);
    if (!userData) return null;
    
    // Refresh TTL on successful retrieval
    await redis.expire(key, config.redis.userCacheTtl);
    
    return JSON.parse(userData);
  } catch (error) {
    logger.error('Error getting user from cache:', error);
    return null;
  }
}

/**
 * Remove user from cache
 * @param {string} userId - User ID (ClerkID)
 */
async function removeUserFromCache(userId) {
  try {
    const redis = await redisConnection.getClient();
    const key = `${USER_CACHE_PREFIX}${userId}`;
    
    await redis.del(key);
    logger.debug(`User ${userId} removed from cache`);
    return true;
  } catch (error) {
    logger.error('Error removing user from cache:', error);
    return false;
  }
}

/**
 * Check if user exists in cache
 * @param {string} userId - User ID (ClerkID)
 * @returns {boolean} True if user exists
 */
async function userExistsInCache(userId) {
  try {
    const redis = await redisConnection.getClient();
    const key = `${USER_CACHE_PREFIX}${userId}`;
    
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (error) {
    logger.error('Error checking user in cache:', error);
    return false;
  }
}

module.exports = {
  addUserToCache,
  getUserFromCache,
  removeUserFromCache,
  userExistsInCache
};