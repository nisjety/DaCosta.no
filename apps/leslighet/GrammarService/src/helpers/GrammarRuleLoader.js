// src/grammar/helpers/GrammarRuleLoader.js
const Redis = require("ioredis");

let redisClient = null;

async function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis();
  }
  return redisClient;
}

/**
 * Retrieves words for a given rule category from Redis.
 * @param {string} category - e.g., "possessives"
 * @returns {Promise<Array<string>>}
 */
async function getCategoryWords(category) {
  if (!category) return [];
  const redis = await getRedisClient();
  return await redis.smembers(`norsk:stopwords:${category}`);
}

/**
 * Adds a word to a given rule category.
 * @param {string} category
 * @param {string} word
 * @returns {Promise<void>}
 */
async function addWordToCategory(category, word) {
  if (!category || !word) return;
  const redis = await getRedisClient();
  await redis.sadd(`norsk:stopwords:${category}`, word.toLowerCase());
}

/**
 * Retrieves all available stopword categories from Redis.
 * @returns {Promise<Array<string>>}
 */
async function getCategories() {
  const redis = await getRedisClient();
  const keys = await redis.keys("norsk:stopwords:*");
  return keys.map(key => key.replace("norsk:stopwords:", ""));
}

/**
 * Cleanup Redis data and connection.
 * @param {Array<string>} [categories] - Optional list of categories to clean up. If not provided, cleans up all categories.
 * @returns {Promise<void>}
 */
async function cleanup(categories = null) {
  const redis = await getRedisClient();
  
  if (categories) {
    // Delete specific categories
    for (const category of categories) {
      await redis.del(`norsk:stopwords:${category}`);
    }
  } else {
    // Delete all categories
    const keys = await redis.keys("norsk:stopwords:*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  // Disconnect Redis client
  if (redisClient) {
    await redisClient.disconnect();
    redisClient = null;
  }
}

module.exports = { getCategoryWords, addWordToCategory, getCategories, cleanup };
