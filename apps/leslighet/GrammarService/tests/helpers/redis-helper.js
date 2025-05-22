const Redis = require('ioredis');
const { loadData } = require('../../scripts/loadDataToRedis');

let redisClient = null;

/**
 * Get a Redis client instance. Returns an existing client or creates a new one.
 * @returns {Promise<Redis>} Redis client instance
 */
async function getRedisClient() {
  if (!redisClient || redisClient.status !== 'ready') {
    // Close existing client if it exists but isn't ready
    if (redisClient) {
      try {
        await redisClient.quit().catch(() => {});
      } catch (e) {
        // Ignore error
      }
    }

    // Create new client with better error handling
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6380', 10), // Using Docker port from docker-compose.yml
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        console.log(`Redis reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
      },
      reconnectOnError() {
        return true; // Always try to reconnect
      }
    });
    
    // Wait for ready and handle errors
    if (redisClient.status !== 'ready') {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Redis connection timeout'));
        }, 5000);
        
        redisClient.once('ready', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        redisClient.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    }
    
    // Add error handler
    redisClient.on('error', (err) => {
      console.error('Redis error:', err);
    });
  }
  return redisClient;
}

async function cleanupAllData() {
  try {
    const redis = await getRedisClient();
    const keys = await redis.keys('norsk:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Error cleaning up data:', error);
    throw error;
  }
}

/**
 * Checks if required Redis data is already loaded
 * @param {Redis} redis - Redis client instance
 * @returns {Promise<boolean>} - true if data exists, false otherwise
 */
async function checkDataExists(redis) {
  try {
    // Check for a few key indicators that data is loaded
    const fullformsCount = await redis.hlen('norsk:fullforms');
    const wordsCount = await redis.exists('norsk:words');
    
    // If we have fullforms and words data, assume other data is present too
    const dataExists = fullformsCount > 0 && wordsCount === 1;
    
    if (dataExists) {
      console.log('✓ Required Redis data already loaded, skipping data loading');
    } else {
      console.log('! Required Redis data not found, will load data');
    }
    
    return dataExists;
  } catch (error) {
    console.error('Error checking if Redis data exists:', error);
    return false;
  }
}

async function setupTestData() {
  const redis = await getRedisClient();
  
  try {
    // Check if data already exists
    const dataExists = await checkDataExists(redis);
    
    if (!dataExists) {
      await cleanupAllData();
      
      // Load base data from files
      await loadData(redis);
    }

    // Always ensure test-specific data is loaded, even if base data exists
    await redis.hset('norsk:fullforms', 'spiser', 'verb pres spise <trans1>eat</trans1>');
    await redis.hset('norsk:fullforms', 'spise', 'verb inf spise <trans1>eat</trans1>');
    await redis.hset('norsk:fullforms', 'spiste', 'verb past spise <trans1>ate</trans1>');
    await redis.hset('norsk:fullforms', 'vil', 'verb pres ville <trans1>want</trans1> <modal>true</modal>');
    await redis.hset('norsk:fullforms', 'liker', 'verb pres like <trans1>like</trans1> <requires_inf>true</requires_inf>');

    await redis.sadd('norsk:stopwords:articles', 'en', 'et', 'ei');
    await redis.sadd('norsk:stopwords:possessives', 'min:masc:sg', 'mitt:neut:sg', 'mi:fem:sg');
    await redis.sadd('norsk:stopwords:prepositions', 'i', 'på', 'med', 'til');
    await redis.sadd('norsk:stopwords:pronouns', 'jeg', 'du', 'han', 'hun', 'den', 'det', 'vi', 'dere', 'de');

    await redis.sadd('norsk:modal_verbs', 'vil', 'kan', 'må', 'skal');
    await redis.sadd('norsk:verbs_requiring_infinitive', 'liker', 'ønsker', 'prøver');

    // Mock data for dictionary lookup
    await redis.hset('norsk:lemmas', 'bil', 'bil:masc');
    await redis.hset('norsk:lemmas', 'hus', 'hus:neut');
    await redis.hset('norsk:lemmas', 'jente', 'jente:fem');
    
    console.log('✓ Redis connection and test data setup successful');
  } catch (error) {
    console.error('Error setting up test data:', error);
    throw error;
  }
}

async function cleanupRedis() {
  try {
    if (!redisClient) {
      console.log('No Redis client to clean up');
      return;
    }
    
    // Only attempt cleanup if connection is still active
    if (redisClient.status === 'ready') {
      try {
        await cleanupAllData();
      } catch (err) {
        console.log('Warning: Error during data cleanup, continuing with connection closure:', err.message);
      }
    } else {
      console.log(`Redis connection already in '${redisClient.status}' state, skipping data cleanup`);
    }
    
    // Always try to gracefully close the connection if it exists
    try {
      if (redisClient) {
        if (redisClient.status === 'ready' || redisClient.status === 'connect') {
          await redisClient.quit();
        } else {
          // Force disconnect if not in ready state
          redisClient.disconnect();
        }
      }
    } catch (err) {
      console.log('Warning: Could not quit Redis connection gracefully:', err.message);
      // Force disconnect if quit fails
      try {
        redisClient.disconnect();
      } catch (e) {
        // Ignore any errors during forced disconnect
      }
    }
    
    // Always reset the client at the end
    redisClient = null;
  } catch (error) {
    console.log('Error during cleanup:', error.message);
    // Force reset the client even after errors
    try {
      if (redisClient) {
        redisClient.disconnect();
        redisClient = null;
      }
    } catch (e) {
      // Ignore any errors during forced cleanup
    }
  }
}

module.exports = {
  getRedisClient,
  setupTestData,
  cleanupAllData,
  cleanupRedis
};