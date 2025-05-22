// src/grammar/interfaces/CacheInterface.js
/**
 * @interface
 * Defines contract for cache services.
 */
class CacheInterface {
  /**
   * Asynchronously gets a value from cache.
   * @param {string} key - Cache key.
   * @returns {Promise<*>} Cached value or undefined.
   */
  async get(key) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Asynchronously sets a value in cache.
   * @param {string} key - Cache key.
   * @param {*} value - Value to cache.
   * @param {Object} options - Cache options.
   * @returns {Promise<boolean>} Success status.
   */
  async set(key, value, options = {}) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Asynchronously checks if a key exists in cache.
   * @param {string} key - Cache key.
   * @returns {Promise<boolean>} Whether key exists.
   */
  async has(key) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Asynchronously removes a value from cache.
   * @param {string} key - The cache key.
   * @returns {Promise<boolean>} Success indicator.
   */
  async delete(key) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Asynchronously clears the cache.
   * @returns {Promise<boolean>} Success status.
   */
  async clear() {
    throw new Error('Method not implemented');
  }
}

module.exports = CacheInterface;
