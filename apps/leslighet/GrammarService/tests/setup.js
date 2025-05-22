const { setupTestData } = require('./helpers/redis-helper');
const Redis = require('ioredis');

module.exports = async () => {
  try {
    // Create Redis client and set up test data
    const redis = new Redis();
    await setupTestData();
    
    // Export Redis client for tests to use
    global.__redis__ = redis;
    
    console.log('✓ Redis connection and test data setup successful');
  } catch (error) {
    console.error('Redis setup failed:', error);
    throw error;
  }
}; 