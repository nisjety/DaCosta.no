const fs = require('fs');
const path = require('path');
const LRUCacheAdapter = require('./LRUCacheAdapter');
const NorwegianMorphologyHelper = require('../helpers/norwegianMorphologyHelper');
const DictionaryInterface = require('../interfaces/DictionaryInterface');

/**
 * NorwegianDictionaryAdapter
 * 
 * Adapter for Norwegian dictionary and morphological analysis
 * Provides access to Norsk Ordbank data for word analysis
 */
class NorwegianDictionaryAdapter extends DictionaryInterface {
  /**
   * Create a new Norwegian dictionary adapter
   * @param {Object} options Configuration options
   * @param {string} options.dataPath Path to the data directory containing Norsk Ordbank
   * @param {boolean} options.useRedis Whether to use Redis for caching
   * @param {Object} options.redisClient Redis client instance (if useRedis is true)
   * @param {boolean} options.loadCompoundData Whether to load compound word data
   * @param {boolean} options.cacheEnabled Whether to enable in-memory caching
   * @param {number} options.cacheSize Maximum size of in-memory cache
   */
  constructor(options = {}) {
    super();
    this._dataPath = options.dataPath || path.join(process.cwd(), 'data/norsk_ordbank');
    this._useRedis = options.useRedis && options.redisClient;
    this._redisClient = options.redisClient;
    this._loadCompoundData = options.loadCompoundData !== false;
    this._cacheEnabled = options.cacheEnabled !== false;
    this._cacheSize = options.cacheSize || 10000;
    
    // Initialize cache
    if (this._cacheEnabled) {
      this._cache = new LRUCacheAdapter({ maxSize: this._cacheSize });
    }
    
    // Initialize Norwegian morphology helper
    this._morphologyHelper = new NorwegianMorphologyHelper({
      dataPath: this._dataPath,
      cacheEnabled: this._cacheEnabled,
      cacheSize: this._cacheSize
    });
    
    // Set up dictionary data structures
    this._dictionary = new Map();
    this._compoundWords = new Map();
    
    // Initialize dictionary and load data asynchronously
    this._dictionaryLoaded = false;
    this._loadDictionaryPromise = this._loadDictionary();
  }
  
  /**
   * Checks if a word exists in the dictionary
   * @param {string} word Word to check
   * @returns {Promise<boolean>} Whether the word exists
   */
  async exists(word) {
    if (!word) return false;
    
    const normalized = word.toLowerCase().trim();
    
    // Check cache first
    if (this._cacheEnabled) {
      const cached = this._cache.get(`exists:${normalized}`);
      if (cached !== undefined) return cached;
    }
    
    // Check Redis if enabled
    if (this._useRedis) {
      try {
        const exists = await this._redisClient.exists(`word:${normalized}`);
        
        if (this._cacheEnabled) {
          this._cache.set(`exists:${normalized}`, exists === 1);
        }
        
        return exists === 1;
      } catch (error) {
        console.error('Redis error in dictionary exists check:', error);
      }
    }
    
    // Ensure dictionary is loaded
    await this._ensureDictionaryLoaded();
    
    // Check if word exists in local dictionary
    const wordForms = await this._morphologyHelper.getWordForms(normalized);
    const exists = wordForms.length > 0;
    
    // Cache the result
    if (this._cacheEnabled) {
      this._cache.set(`exists:${normalized}`, exists);
    }
    
    return exists;
  }
  
  /**
   * Get detailed information about a word
   * @param {string} word Word to get information for
   * @returns {Promise<Object|null>} Word information or null if not found
   */
  async getWordInfo(word) {
    if (!word) return null;
    
    const normalized = word.toLowerCase().trim();
    
    // Check cache first
    if (this._cacheEnabled) {
      const cached = this._cache.get(`info:${normalized}`);
      if (cached) return cached;
    }
    
    // Check Redis if enabled
    if (this._useRedis) {
      try {
        const info = await this._redisClient.hgetall(`word:${normalized}`);
        if (info && Object.keys(info).length > 0) {
          // Convert string representations back to objects/arrays
          if (info.forms) info.forms = JSON.parse(info.forms);
          if (info.grammaticalFeatures) info.grammaticalFeatures = JSON.parse(info.grammaticalFeatures);
          if (info.compoundAnalysis) info.compoundAnalysis = JSON.parse(info.compoundAnalysis);
          
          // Cache the result
          if (this._cacheEnabled) {
            this._cache.set(`info:${normalized}`, info);
          }
          
          return info;
        }
      } catch (error) {
        console.error('Redis error in dictionary word info:', error);
      }
    }
    
    // Ensure dictionary is loaded
    await this._ensureDictionaryLoaded();
    
    // Get detailed information using morphology helper
    const forms = await this._morphologyHelper.getWordForms(normalized);
    
    // If no forms found, try compound word analysis
    if (forms.length === 0) {
      const compoundAnalysis = await this._morphologyHelper.getCompoundAnalysis(normalized);
      if (compoundAnalysis) {
        const result = {
          word: normalized,
          isCompound: true,
          compoundAnalysis: {
            components: compoundAnalysis.components,
            componentCount: compoundAnalysis.components.length
          }
        };
        
        // Store in cache
        if (this._cacheEnabled) {
          this._cache.set(`info:${normalized}`, result);
        }
        
        // Store in Redis if enabled
        if (this._useRedis) {
          try {
            await this._redisClient.hmset(`word:${normalized}`, {
              word: normalized,
              isCompound: '1',
              compoundAnalysis: JSON.stringify(result.compoundAnalysis)
            });
          } catch (error) {
            console.error('Redis error storing compound word:', error);
          }
        }
        
        return result;
      }
      
      // Not found in dictionary or compound analysis
      return null;
    }
    
    // Get grammatical features
    const grammaticalFeatures = await this._morphologyHelper.getGrammaticalFeatures(normalized);
    
    // Get lemmas
    const lemmas = await this._morphologyHelper.getLemmas(normalized);
    
    // Check if word is compound
    const compoundAnalysis = await this._morphologyHelper.getCompoundAnalysis(normalized);
    
    // Build result object
    const result = {
      word: normalized,
      lemmas,
      forms,
      grammaticalFeatures,
      isCompound: !!compoundAnalysis,
      complexity: this._calculateComplexity(forms, grammaticalFeatures, compoundAnalysis)
    };
    
    if (compoundAnalysis) {
      result.compoundAnalysis = {
        components: compoundAnalysis.components,
        componentCount: compoundAnalysis.components.length
      };
    }
    
    // Store in cache
    if (this._cacheEnabled) {
      this._cache.set(`info:${normalized}`, result);
    }
    
    // Store in Redis if enabled
    if (this._useRedis) {
      try {
        await this._redisClient.hmset(`word:${normalized}`, {
          word: normalized,
          lemmas: JSON.stringify(lemmas),
          forms: JSON.stringify(forms),
          grammaticalFeatures: JSON.stringify(grammaticalFeatures),
          isCompound: compoundAnalysis ? '1' : '0',
          complexity: result.complexity.toString(),
          ...(compoundAnalysis ? { compoundAnalysis: JSON.stringify(result.compoundAnalysis) } : {})
        });
      } catch (error) {
        console.error('Redis error storing word info:', error);
      }
    }
    
    return result;
  }
  
  /**
   * Get lemma (base form) of a word
   * @param {string} word Word to get lemma for
   * @returns {Promise<string|null>} Lemma or null if not found
   */
  async getLemma(word) {
    if (!word) return null;
    
    const normalized = word.toLowerCase().trim();
    
    // Check cache first
    if (this._cacheEnabled) {
      const cached = this._cache.get(`lemma:${normalized}`);
      if (cached !== undefined) return cached;
    }
    
    // Try to get from Redis
    if (this._useRedis) {
      try {
        const lemma = await this._redisClient.hget(`word:${normalized}`, 'lemma');
        
        if (lemma) {
          // Cache the result
          if (this._cacheEnabled) {
            this._cache.set(`lemma:${normalized}`, lemma);
          }
          
          return lemma;
        }
      } catch (error) {
        console.error('Redis error in dictionary lemma lookup:', error);
      }
    }
    
    // Get from morphology helper
    const lemmas = await this._morphologyHelper.getLemmas(normalized);
    
    // Return first lemma or null
    const lemma = lemmas.length > 0 ? lemmas[0] : null;
    
    // Cache the result
    if (this._cacheEnabled) {
      this._cache.set(`lemma:${normalized}`, lemma);
    }
    
    // Store in Redis if enabled
    if (this._useRedis && lemma) {
      try {
        await this._redisClient.hset(`word:${normalized}`, 'lemma', lemma);
      } catch (error) {
        console.error('Redis error storing lemma:', error);
      }
    }
    
    return lemma;
  }
  
  /**
   * Check if word is a compound word
   * @param {string} word Word to check
   * @returns {Promise<boolean>} Whether the word is compound
   */
  async isCompoundWord(word) {
    if (!word) return false;
    
    const normalized = word.toLowerCase().trim();
    
    // Check cache first
    if (this._cacheEnabled) {
      const cached = this._cache.get(`isCompound:${normalized}`);
      if (cached !== undefined) return cached;
    }
    
    // Try to get from Redis
    if (this._useRedis) {
      try {
        const isCompound = await this._redisClient.hget(`word:${normalized}`, 'isCompound');
        
        if (isCompound !== null) {
          const result = isCompound === '1';
          
          // Cache the result
          if (this._cacheEnabled) {
            this._cache.set(`isCompound:${normalized}`, result);
          }
          
          return result;
        }
      } catch (error) {
        console.error('Redis error in compound word check:', error);
      }
    }
    
    // Get from morphology helper
    const compoundAnalysis = await this._morphologyHelper.getCompoundAnalysis(normalized);
    const isCompound = !!compoundAnalysis;
    
    // Cache the result
    if (this._cacheEnabled) {
      this._cache.set(`isCompound:${normalized}`, isCompound);
    }
    
    // Store in Redis if enabled
    if (this._useRedis) {
      try {
        await this._redisClient.hset(`word:${normalized}`, 'isCompound', isCompound ? '1' : '0');
      } catch (error) {
        console.error('Redis error storing compound status:', error);
      }
    }
    
    return isCompound;
  }
  
  /**
   * Get compound components of a word
   * @param {string} word Word to analyze
   * @returns {Promise<Array<string>|null>} Array of components or null if not a compound
   */
  async getCompoundComponents(word) {
    if (!word) return null;
    
    const normalized = word.toLowerCase().trim();
    
    // Check cache first
    if (this._cacheEnabled) {
      const cached = this._cache.get(`components:${normalized}`);
      if (cached !== undefined) return cached;
    }
    
    // Try to get from Redis
    if (this._useRedis) {
      try {
        const compoundAnalysis = await this._redisClient.hget(`word:${normalized}`, 'compoundAnalysis');
        
        if (compoundAnalysis) {
          const analysis = JSON.parse(compoundAnalysis);
          const components = analysis.components;
          
          // Cache the result
          if (this._cacheEnabled) {
            this._cache.set(`components:${normalized}`, components);
          }
          
          return components;
        }
      } catch (error) {
        console.error('Redis error in compound components lookup:', error);
      }
    }
    
    // Get from morphology helper
    const compoundAnalysis = await this._morphologyHelper.getCompoundAnalysis(normalized);
    const components = compoundAnalysis ? compoundAnalysis.components : null;
    
    // Cache the result
    if (this._cacheEnabled) {
      this._cache.set(`components:${normalized}`, components);
    }
    
    return components;
  }
  
  /**
   * Check grammatical gender of a noun
   * @param {string} noun Noun to check
   * @returns {Promise<string|null>} Gender ('masculine', 'feminine', 'neuter') or null
   */
  async getNounGender(noun) {
    if (!noun) return null;
    
    const normalized = noun.toLowerCase().trim();
    
    // Check cache first
    if (this._cacheEnabled) {
      const cached = this._cache.get(`gender:${normalized}`);
      if (cached !== undefined) return cached;
    }
    
    // Get grammatical features
    const features = await this._morphologyHelper.getGrammaticalFeatures(normalized);
    
    // Find noun entries and extract gender
    const nounFeatures = features.filter(f => f.partOfSpeech === 'substantiv');
    let gender = null;
    
    if (nounFeatures.length > 0 && nounFeatures[0].gender) {
      gender = nounFeatures[0].gender;
    }
    
    // Cache the result
    if (this._cacheEnabled) {
      this._cache.set(`gender:${normalized}`, gender);
    }
    
    return gender;
  }
  
  /**
   * Load the dictionary data
   * @private
   * @returns {Promise<void>}
   */
  async _loadDictionary() {
    // No need to load dictionary explicitly now, as we use the morphology helper
    // Just initialize the morphology helper to load the data
    await this._morphologyHelper.loadData();
    
    this._dictionaryLoaded = true;
  }
  
  /**
   * Ensure dictionary is loaded before proceeding
   * @private
   * @returns {Promise<void>}
   */
  async _ensureDictionaryLoaded() {
    if (!this._dictionaryLoaded) {
      await this._loadDictionaryPromise;
    }
  }
  
  /**
   * Calculate word complexity score based on various factors
   * @private
   * @param {Array} forms Word forms information
   * @param {Array} grammaticalFeatures Grammatical features
   * @param {Object|null} compoundAnalysis Compound analysis if available
   * @returns {number} Complexity score (0-1)
   */
  _calculateComplexity(forms, grammaticalFeatures, compoundAnalysis) {
    let score = 0;
    
    // Longer words are more complex
    const wordLength = forms && forms.length > 0 ? forms[0].form.length : 0;
    if (wordLength > 12) {
      score += 0.4;
    } else if (wordLength > 8) {
      score += 0.2;
    }
    
    // Compound words are more complex
    if (compoundAnalysis) {
      const componentCount = compoundAnalysis.components.length;
      score += Math.min(0.3, componentCount * 0.1);
    }
    
    // Words with many grammatical features are more complex
    if (grammaticalFeatures && grammaticalFeatures.length > 0) {
      // More possible interpretations = more complex
      score += Math.min(0.2, (grammaticalFeatures.length - 1) * 0.05);
      
      // Some parts of speech are more complex than others
      if (grammaticalFeatures.some(f => f.partOfSpeech === 'verb')) {
        score += 0.1;
      }
    }
    
    return Math.min(1, score);
  }
}

module.exports = NorwegianDictionaryAdapter;
