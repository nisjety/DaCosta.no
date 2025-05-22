// src/grammar/helpers/wordFrequency.js
const Redis = require("ioredis");
const redis = new Redis();

/**
 * Retrieves the frequency of a word from Redis.
 * @param {string} word - The word to check.
 * @returns {Promise<number>} - Frequency count.
 */
async function getFrequency(word) {
  if (!word) return 0;
  const freq = await redis.hget("norsk:word_frequencies", word.toLowerCase());
  return parseInt(freq) || 0;
}

/**
 * Increments the frequency of a word in Redis.
 * @param {string} word - The word to update.
 * @param {number} count - Increment count (default: 1).
 */
async function incrementFrequency(word, count = 1) {
  if (!word) return;
  await redis.hincrby("norsk:word_frequencies", word.toLowerCase(), count);
}

/**
 * Retrieves the most frequent words.
 * @param {number} limit - Maximum number of words to return.
 * @returns {Promise<Array<string>>}
 */
async function getFrequentWords(limit = 500) {
  const allWords = await redis.hgetall("norsk:word_frequencies");
  return Object.entries(allWords)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([word]) => word);
}

module.exports = { getFrequency, incrementFrequency, getFrequentWords };
