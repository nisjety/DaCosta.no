// src/repositories/RedisDictionary.js
const DictionaryInterface = require('../interfaces/DictionaryInterface');
const Redis = require('ioredis');

/**
 * Redis-based implementation of the Dictionary Interface
 */
class RedisDictionary extends DictionaryInterface {
  /**
   * @param {Object} redisClient - Redis client instance
   */
  constructor(redisClient) {
    super();
    this.redis = redisClient || new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      maxRetriesPerRequest: 3
    });

    this.redis.on('error', (error) => {
      console.error('Redis dictionary error:', error);
    });
  }

  /**
   * Look up a word in the dictionary
   * @param {string} word - Word to look up
   * @returns {Promise<Object|null>} Word information or null
   */
  async lookup(word) {
    if (!word || typeof word !== 'string') return null;
    
    try {
      // Remove trailing punctuation
      const cleanWord = word.replace(/[.,!?;:]+$/, '');
      
      // Look up the word in the Redis hash "norsk:fullforms"
      const result = await this.redis.hget('norsk:fullforms', cleanWord.toLowerCase());
      
      if (!result) return null;

      // Parse the tab-separated data
      const [description, ...rest] = result.split('\t');

      // Extract attributes like gender, word class, etc.
      const attributes = [];
      
      if (description.includes('mask')) attributes.push('mask');
      if (description.includes('fem')) attributes.push('fem');
      if (description.includes('nøyt')) attributes.push('nøyt');
      if (description.includes('subst')) attributes.push('noun');
      if (description.includes('verb')) attributes.push('verb');
      if (description.includes('adj')) attributes.push('adjective');

      return {
        word: cleanWord,
        entry: result.split('\t'),
        attributes,
        inflections: [{
          ordbokTekst: description
        }]
      };
    } catch (error) {
      console.error(`Error looking up word "${word}":`, error);
      return null;
    }
  }

  /**
   * Look up a word in the dictionary (alias for lookup)
   * @param {string} word - Word to look up
   * @returns {Promise<Object|null>} Word information or null
   */
  async lookupWord(word) {
    return this.lookup(word);
  }

  /**
   * Check if a word exists in the dictionary
   * @param {string} word - Word to check
   * @returns {Promise<boolean>} Whether word exists
   */
  async hasWord(word) {
    if (!word || typeof word !== 'string') return false;
    
    try {
      const cleanWord = word.replace(/[.,!?;:]+$/, '');
      const exists = await this.redis.hexists('norsk:fullforms', cleanWord.toLowerCase());
      return exists === 1;
    } catch (error) {
      console.error(`Error checking if word "${word}" exists:`, error);
      return false;
    }
  }

  /**
   * Get top frequent words from the dictionary
   * @param {number} limit - Maximum number of words to return
   * @returns {Promise<Array<string>>} Array of words
   */
  async getFrequentWords(limit = 500) {
    try {
      // Use the Redis sorted set
      const words = await this.redis.zrange('norsk:words', 0, limit - 1);
      return words;
    } catch (error) {
      console.error('Error getting frequent words:', error);
      return [];
    }
  }

  /**
   * Record text being processed (for analytics)
   * @param {string} text - Text being processed
   * @returns {Promise<void>}
   */
  async recordTextProcessed(text) {
    // This is a stub for now
    return;
  }

  /**
   * Check if a word is feminine
   * @param {string} word - Word to check
   * @returns {Promise<boolean>} Whether word is feminine
   */
  async isFeminine(word) {
    if (!word || typeof word !== 'string') return false;
    
    try {
      const result = await this.lookup(word);
      return result && result.attributes && result.attributes.includes('fem');
    } catch (error) {
      console.error(`Error checking if "${word}" is feminine:`, error);
      return false;
    }
  }

  /**
   * Get gender of a word
   * @param {string} word - Word to check
   * @returns {Promise<string|null>} Gender ('mask', 'fem', 'nøyt') or null
   */
  async getGender(word) {
    if (!word || typeof word !== 'string') return null;
    
    try {
      const result = await this.lookup(word);
      if (!result || !result.attributes) return null;
      
      if (result.attributes.includes('mask')) return 'mask';
      if (result.attributes.includes('fem')) return 'fem';
      if (result.attributes.includes('nøyt')) return 'nøyt';
      
      return null;
    } catch (error) {
      console.error(`Error getting gender for "${word}":`, error);
      return null;
    }
  }

  /**
   * Clean up resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      if (this.redis && this.redis.status === 'ready') {
        await this.redis.quit();
      }
    } catch (error) {
      console.error('Error during Redis dictionary cleanup:', error);
    }
  }
}

module.exports = RedisDictionary;
module.exports.RedisDictionary = RedisDictionary;