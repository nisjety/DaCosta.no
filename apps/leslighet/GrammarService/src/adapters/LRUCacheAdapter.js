// src/adapters/LRUCacheAdapter.js

/**
 * LRU (Least Recently Used) Cache implementation
 * Provides efficient caching with automatic eviction of older entries
 */
class LRUCacheAdapter {
  /**
   * @param {number} capacity - Maximum number of entries in cache
   * @param {number} ttl - Time to live in milliseconds (0 means no expiration)
   */
  constructor(capacity = 1000, ttl = 0) {
    this._capacity = capacity;
    this._ttl = ttl;
    this._cache = new Map();
    this._stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }

  /**
   * Get a value from the cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined if not found
   */
  get(key) {
    if (!key) return undefined;
    
    // Check if key exists
    if (!this._cache.has(key)) {
      this._stats.misses++;
      return undefined;
    }
    
    const item = this._cache.get(key);
    
    // Check if item is expired
    if (this._ttl > 0 && item.expiry && item.expiry < Date.now()) {
      this._cache.delete(key);
      this._stats.misses++;
      return undefined;
    }
    
    // Move item to the front (most recently used)
    this._cache.delete(key);
    this._cache.set(key, item);
    
    this._stats.hits++;
    return item.value;
  }

  /**
   * Set a value in the cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} [ttl] - Custom TTL for this item (overrides the default)
   * @returns {this} - For method chaining
   */
  set(key, value, ttl) {
    if (!key) return this;
    
    // Remove existing key if present
    if (this._cache.has(key)) {
      this._cache.delete(key);
    } 
    // Check if we need to evict entries
    else if (this._cache.size >= this._capacity) {
      // Evict the oldest item (first key in the Map)
      const oldestKey = this._cache.keys().next().value;
      this._cache.delete(oldestKey);
      this._stats.evictions++;
    }
    
    // Calculate expiry if TTL is set
    const expiry = (this._ttl > 0 || ttl > 0) 
      ? Date.now() + (ttl || this._ttl) 
      : null;
    
    // Add to the cache
    this._cache.set(key, { value, expiry, timestamp: Date.now() });
    
    return this;
  }

  /**
   * Check if a key exists in the cache
   * @param {string} key - Cache key to check
   * @returns {boolean} - True if key exists and is not expired
   */
  has(key) {
    if (!key) return false;
    
    if (!this._cache.has(key)) {
      return false;
    }
    
    const item = this._cache.get(key);
    
    // Check if item is expired
    if (this._ttl > 0 && item.expiry && item.expiry < Date.now()) {
      this._cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Remove a key from the cache
   * @param {string} key - Cache key to remove
   * @returns {boolean} - True if key was removed, false if not found
   */
  delete(key) {
    return this._cache.delete(key);
  }

  /**
   * Clear all items from the cache
   */
  clear() {
    this._cache.clear();
  }

  /**
   * Get the number of items in the cache
   * @returns {number} - Number of cached items
   */
  get size() {
    return this._cache.size;
  }

  /**
   * Get the maximum capacity of the cache
   * @returns {number} - Maximum capacity
   */
  get capacity() {
    return this._capacity;
  }

  /**
   * Set a new capacity for the cache
   * @param {number} newCapacity - New capacity
   */
  set capacity(newCapacity) {
    if (typeof newCapacity !== 'number' || newCapacity < 0) {
      throw new Error('Cache capacity must be a non-negative number');
    }
    
    this._capacity = newCapacity;
    
    // Evict items if cache exceeds new capacity
    if (this._cache.size > newCapacity) {
      const itemsToRemove = this._cache.size - newCapacity;
      const keys = [...this._cache.keys()];
      
      for (let i = 0; i < itemsToRemove; i++) {
        this._cache.delete(keys[i]);
        this._stats.evictions++;
      }
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} - Statistics object
   */
  getStats() {
    return {
      ...this._stats,
      size: this._cache.size,
      capacity: this._capacity
    };
  }

  /**
   * Reset statistics counters
   */
  resetStats() {
    this._stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }
}

module.exports = LRUCacheAdapter;
