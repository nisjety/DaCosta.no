/**
 * Universal Dependency Treebank Adapter
 * Processes and provides access to syntactic dependency information from UD treebank data
 */
const fs = require('fs');
const path = require('path');
const LRUCacheAdapter = require('./LRUCacheAdapter');

class UDTreebankAdapter {
  /**
   * Creates a new UDTreebankAdapter
   * @param {Object} options Configuration options
   * @param {string} options.dataPath Path to the UD treebank JSON file
   * @param {boolean} [options.cacheEnabled=true] Whether to enable caching
   * @param {number} [options.cacheSize=1000] Maximum number of entries in the cache
   */
  constructor(options = {}) {
    this._dataPath = options.dataPath || path.resolve(process.cwd(), 'data/no_bokmaal-ud-train.json');
    this._cacheEnabled = options.cacheEnabled !== false;
    this._cacheSize = options.cacheSize || 1000;
    
    // Initialize cache
    if (this._cacheEnabled) {
      this._cache = new LRUCacheAdapter({ maxSize: this._cacheSize });
    }
    
    this._treebank = null;
    this._wordRelationsIndex = new Map();
    this._postTagPatterns = new Map();
    
    // Load data asynchronously
    this._dataLoaded = false;
    this._loadDataPromise = this._loadData();
  }
  
  /**
   * Loads treebank data from file
   * @returns {Promise<void>}
   * @private
   */
  async _loadData() {
    try {
      const data = await fs.promises.readFile(this._dataPath, 'utf8');
      this._treebank = JSON.parse(data);
      
      // Index word relations for faster lookup
      this._indexWordRelations();
      
      // Extract common POS tag patterns
      this._extractPOSPatterns();
      
      this._dataLoaded = true;
    } catch (error) {
      console.error('Failed to load UD treebank data:', error);
      throw new Error(`Failed to load UD treebank data: ${error.message}`);
    }
  }
  
  /**
   * Ensures data is loaded before proceeding
   * @returns {Promise<void>}
   * @private
   */
  async _ensureDataLoaded() {
    if (!this._dataLoaded) {
      await this._loadDataPromise;
    }
  }
  
  /**
   * Creates indices for faster word relationship lookups
   * @private
   */
  _indexWordRelations() {
    if (!this._treebank || !this._treebank.sentences) return;
    
    for (const sentence of this._treebank.sentences) {
      if (!sentence.dependencies) continue;
      
      for (const dep of sentence.dependencies) {
        if (!dep.dep || !dep.gov || !dep.rel) continue;
        
        const dependentWord = dep.dep.toLowerCase();
        const governorWord = dep.gov.toLowerCase();
        const relation = dep.rel;
        
        // Index by dependent word
        if (!this._wordRelationsIndex.has(dependentWord)) {
          this._wordRelationsIndex.set(dependentWord, []);
        }
        this._wordRelationsIndex.get(dependentWord).push({
          governor: governorWord,
          relation,
          sentence: sentence.text
        });
      }
    }
  }
  
  /**
   * Extracts common POS tag patterns from treebank
   * @private
   */
  _extractPOSPatterns() {
    if (!this._treebank || !this._treebank.sentences) return;
    
    for (const sentence of this._treebank.sentences) {
      if (!sentence.words || !Array.isArray(sentence.words)) continue;
      
      // Create n-gram patterns (2-3 word sequences)
      for (let i = 0; i < sentence.words.length - 1; i++) {
        // Create bigram pattern
        if (i < sentence.words.length - 1) {
          const bigram = `${sentence.words[i].pos}_${sentence.words[i+1].pos}`;
          this._postTagPatterns.set(
            bigram, 
            (this._postTagPatterns.get(bigram) || 0) + 1
          );
        }
        
        // Create trigram pattern
        if (i < sentence.words.length - 2) {
          const trigram = `${sentence.words[i].pos}_${sentence.words[i+1].pos}_${sentence.words[i+2].pos}`;
          this._postTagPatterns.set(
            trigram,
            (this._postTagPatterns.get(trigram) || 0) + 1
          );
        }
      }
    }
  }
  
  /**
   * Gets syntactic relations for a specific word
   * @param {string} word The word to lookup
   * @returns {Promise<Array>} Array of relation objects
   */
  async getWordRelations(word) {
    await this._ensureDataLoaded();
    
    const lowerWord = word.toLowerCase();
    
    // Check cache first
    if (this._cacheEnabled) {
      const cached = this._cache.get(`relation:${lowerWord}`);
      if (cached) return cached;
    }
    
    const relations = this._wordRelationsIndex.get(lowerWord) || [];
    
    // Store in cache
    if (this._cacheEnabled) {
      this._cache.set(`relation:${lowerWord}`, relations);
    }
    
    return relations;
  }
  
  /**
   * Checks if a sequence of POS tags is grammatically valid based on treebank data
   * @param {Array<string>} posTags Array of POS tags to check
   * @returns {Promise<{isValid: boolean, confidence: number}>} Validation result with confidence score
   */
  async validatePOSSequence(posTags) {
    await this._ensureDataLoaded();
    
    if (!posTags || !Array.isArray(posTags) || posTags.length < 2) {
      return { isValid: false, confidence: 0 };
    }
    
    // Check cache first
    const cacheKey = `pos:${posTags.join('_')}`;
    if (this._cacheEnabled) {
      const cached = this._cache.get(cacheKey);
      if (cached) return cached;
    }
    
    let totalPatterns = 0;
    let matchCount = 0;
    
    // Check bigrams and trigrams
    for (let i = 0; i < posTags.length - 1; i++) {
      // Check bigrams
      if (i < posTags.length - 1) {
        const bigram = `${posTags[i]}_${posTags[i+1]}`;
        const bigramCount = this._postTagPatterns.get(bigram) || 0;
        
        if (bigramCount > 0) {
          matchCount++;
        }
        totalPatterns++;
      }
      
      // Check trigrams
      if (i < posTags.length - 2) {
        const trigram = `${posTags[i]}_${posTags[i+1]}_${posTags[i+2]}`;
        const trigramCount = this._postTagPatterns.get(trigram) || 0;
        
        if (trigramCount > 0) {
          matchCount++;
        }
        totalPatterns++;
      }
    }
    
    const result = {
      isValid: matchCount > 0,
      confidence: totalPatterns > 0 ? matchCount / totalPatterns : 0
    };
    
    // Store in cache
    if (this._cacheEnabled) {
      this._cache.set(cacheKey, result);
    }
    
    return result;
  }
  
  /**
   * Get example sentences containing a specific word
   * @param {string} word Word to find examples for
   * @param {number} [limit=5] Maximum number of examples to return
   * @returns {Promise<Array<string>>} Array of example sentences
   */
  async getExampleSentences(word, limit = 5) {
    await this._ensureDataLoaded();
    
    const lowerWord = word.toLowerCase();
    
    // Check cache first
    const cacheKey = `examples:${lowerWord}:${limit}`;
    if (this._cacheEnabled) {
      const cached = this._cache.get(cacheKey);
      if (cached) return cached;
    }
    
    const examples = new Set();
    
    // Find sentences containing the word
    if (this._treebank && this._treebank.sentences) {
      for (const sentence of this._treebank.sentences) {
        if (examples.size >= limit) break;
        
        if (sentence.text && sentence.text.toLowerCase().includes(lowerWord)) {
          examples.add(sentence.text);
        }
      }
    }
    
    const result = Array.from(examples);
    
    // Store in cache
    if (this._cacheEnabled) {
      this._cache.set(cacheKey, result);
    }
    
    return result;
  }
  
  /**
   * Analyzes the syntactic structure of a sentence
   * @param {Array<Object>} tokenizedSentence Array of word objects with text and pos properties
   * @returns {Promise<Object>} Syntactic analysis results
   */
  async analyzeSyntax(tokenizedSentence) {
    await this._ensureDataLoaded();
    
    if (!tokenizedSentence || !Array.isArray(tokenizedSentence)) {
      return { valid: false, issues: ['Invalid input'] };
    }
    
    const posSequence = tokenizedSentence.map(token => token.pos);
    const posValidation = await this.validatePOSSequence(posSequence);
    
    const issues = [];
    
    // Check for invalid POS sequences
    if (!posValidation.isValid || posValidation.confidence < 0.5) {
      issues.push({
        type: 'syntax',
        message: 'Unusual word order detected',
        confidence: 1 - posValidation.confidence,
        position: {
          start: 0,
          end: tokenizedSentence.length
        }
      });
    }
    
    return {
      valid: issues.length === 0,
      issues,
      confidence: posValidation.confidence
    };
  }
}

module.exports = UDTreebankAdapter;
