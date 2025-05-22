const DictionaryInterface = require('../interfaces/DictionaryInterface');
const { promisify } = require('util');

/**
 * Dictionary implementation that uses Redis as a backend store
 */
class RedisDictionary extends DictionaryInterface {
  /**
   * @param {Object} redisClient - Redis client instance
   * @param {string} [prefix='dict:'] - Key prefix for dictionary entries
   * @param {Object} [options={}] - Additional options
   */
  constructor(redisClient, prefix = 'dict:', options = {}) {
    super();
    this.redis = redisClient;
    this.prefix = prefix;
    this.options = {
      cacheEnabled: true,
      cacheSize: 1000,
      fuzzyMatching: true,
      ...options
    };

    // Promisify Redis methods
    this.getAsync = promisify(this.redis.get).bind(this.redis);
    this.existsAsync = promisify(this.redis.exists).bind(this.redis);
    this.keysAsync = promisify(this.redis.keys).bind(this.redis);
    this.smembersAsync = promisify(this.redis.smembers).bind(this.redis);
    this.hgetallAsync = promisify(this.redis.hgetall).bind(this.redis);
    
    // Simple in-memory cache
    this.cache = new Map();
  }

  /**
   * Look up a word in the dictionary
   * @param {string} word - Word to look up
   * @returns {Promise<Object|null>} Dictionary entry or null if not found
   */
  async lookup(word) {
    if (!word) return null;
    
    const normalizedWord = this.normalizeWord(word);
    
    // Check cache first
    if (this.options.cacheEnabled && this.cache.has(normalizedWord)) {
      return this.cache.get(normalizedWord);
    }
    
    try {
      // Try direct lookup first
      const key = `${this.prefix}${normalizedWord}`;
      let result = await this.hgetallAsync(key);
      
      // If not found, try as a form
      if (!result) {
        const formKey = `${this.prefix}form:${normalizedWord}`;
        const baseKey = await this.getAsync(formKey);
        
        if (baseKey) {
          result = await this.hgetallAsync(`${this.prefix}${baseKey}`);
        }
      }
      
      // Format result
      let entry = null;
      if (result) {
        entry = {
          word: normalizedWord,
          entry: result.entry ? JSON.parse(result.entry) : [],
          inflections: result.inflections ? JSON.parse(result.inflections) : [],
          attributes: result.attributes ? JSON.parse(result.attributes) : [],
          pos: result.pos || null
        };
        
        // Cache result
        if (this.options.cacheEnabled) {
          this.cache.set(normalizedWord, entry);
          
          // Simple LRU-like cache management
          if (this.cache.size > this.options.cacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
          }
        }
      }
      
      return entry;
    } catch (error) {
      console.error(`Error looking up word "${word}":`, error);
      return null;
    }
  }

  /**
   * Check if a word exists in the dictionary
   * @param {string} word - Word to check
   * @returns {Promise<boolean>} True if word exists, false otherwise
   */
  async exists(word) {
    if (!word) return false;
    
    const normalizedWord = this.normalizeWord(word);
    
    try {
      // Check cache first
      if (this.options.cacheEnabled && this.cache.has(normalizedWord)) {
        return true;
      }
      
      const key = `${this.prefix}${normalizedWord}`;
      const exists = await this.existsAsync(key);
      
      if (exists) return true;
      
      // Check if it's a form
      const formKey = `${this.prefix}form:${normalizedWord}`;
      const formExists = await this.existsAsync(formKey);
      
      return formExists;
    } catch (error) {
      console.error(`Error checking existence for word "${word}":`, error);
      return false;
    }
  }

  /**
   * Get inflection forms of a word
   * @param {string} word - Base word to get inflections for
   * @returns {Promise<Array<string>|null>} Array of inflected forms or null if not found
   */
  async getInflections(word) {
    if (!word) return null;
    
    try {
      const entry = await this.lookup(word);
      
      if (entry && entry.inflections && Array.isArray(entry.inflections)) {
        return entry.inflections;
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting inflections for word "${word}":`, error);
      return null;
    }
  }

  /**
   * Get suggestions for a misspelled word
   * @param {string} word - Misspelled word
   * @param {number} [limit=5] - Maximum number of suggestions to return
   * @returns {Promise<Array<string>>} Array of suggested corrections
   */
  async getSuggestions(word, limit = 5) {
    if (!word) return [];
    
    const normalizedWord = this.normalizeWord(word);
    
    try {
      // First check if the word exists
      if (await this.exists(normalizedWord)) {
        return [normalizedWord];
      }
      
      // If fuzzy matching is disabled, return empty array
      if (!this.options.fuzzyMatching) {
        return [];
      }
      
      // Use prefix search to find similar words
      const searchPattern = `${this.prefix}${normalizedWord.slice(0, 3)}*`;
      const keys = await this.keysAsync(searchPattern);
      
      // Extract words from keys and filter out those too different
      const candidates = keys
        .map(key => key.replace(this.prefix, ''))
        .filter(candidate => this.calculateDistance(normalizedWord, candidate) <= 2);
      
      // Sort by edit distance
      candidates.sort((a, b) => 
        this.calculateDistance(normalizedWord, a) - 
        this.calculateDistance(normalizedWord, b)
      );
      
      return candidates.slice(0, limit);
    } catch (error) {
      console.error(`Error getting suggestions for word "${word}":`, error);
      return [];
    }
  }

  /**
   * Normalize a word for consistent lookup
   * @param {string} word - Word to normalize
   * @returns {string} Normalized word
   */
  normalizeWord(word) {
    if (!word) return '';
    
    // Remove punctuation, convert to lowercase
    return word
      .toLowerCase()
      .replace(/[.,!?;:()[\]{}'"]/g, '')
      .trim();
  }

  /**
   * Calculate Levenshtein edit distance between two strings
   * @param {string} a - First string
   * @param {string} b - Second string
   * @returns {number} Edit distance
   */
  calculateDistance(a, b) {
    if (!a || !b) return a ? a.length : b ? b.length : 0;
    
    const matrix = [];
    
    // Initialize matrix
    for (let i = 0; i <= a.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= b.length; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        if (a[i - 1] === b[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[a.length][b.length];
  }
}

module.exports = RedisDictionary;