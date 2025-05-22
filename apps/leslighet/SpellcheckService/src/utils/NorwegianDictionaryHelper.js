/**
 * Helper class for Norwegian dictionary and thesaurus handling
 * 
 * This class provides methods to:
 * 1. Load Norwegian dictionary data properly using ISO-8859-1 encoding
 * 2. Handle the thesaurus data as-is (without Norwegian characters)
 * 3. Create compatible interfaces for spell checking and synonym lookup
 */
const { Nodehun } = require('nodehun');
const Redis = require('ioredis');
const fs = require('fs').promises;
const path = require('path');

class NorwegianDictionaryHelper {
  constructor(options = {}) {
    this.options = {
      redisHost: process.env.REDIS_HOST || 'redis',
      redisPort: process.env.REDIS_PORT || 6379,
      cacheSize: 10000,
      ...options
    };
    
    this.redis = new Redis({
      host: this.options.redisHost,
      port: this.options.redisPort
    });
    
    this.dictionaries = {};
    this.thesaurusData = {};
  }
  
  /**
   * Load dictionary for Norwegian dialects
   * @param {string} dialect - Dialect code ('nb' or 'nn')
   * @returns {Promise<Nodehun>} - The Nodehun dictionary instance
   */
  async loadDictionary(dialect) {
    try {
      // Get dictionary files from Redis as raw buffers
      const [affBuffer, dicBuffer] = await Promise.all([
        this.redis.getBuffer(`norsk:hunspell:${dialect}:aff`),
        this.redis.getBuffer(`norsk:hunspell:${dialect}:dic`)
      ]);
      
      if (!affBuffer || !dicBuffer) {
        throw new Error(`Missing dictionary data for ${dialect}`);
      }
      
      console.log(`Creating Nodehun dictionary for ${dialect}: aff=${affBuffer.length} bytes, dic=${dicBuffer.length} bytes`);
      
      // Create Nodehun dictionary with raw buffers
      const dictionary = new Nodehun(affBuffer, dicBuffer);
      
      // Test some Norwegian words
      await this.testDictionary(dictionary, dialect);
      
      // Store and return the dictionary
      this.dictionaries[dialect] = dictionary;
      return dictionary;
    } catch (error) {
      console.error(`Error loading ${dialect} dictionary:`, error);
      throw error;
    }
  }
  
  /**
   * Test the dictionary with some Norwegian words
   */
  async testDictionary(dictionary, dialect) {
    // Skip test if no dictionary
    if (!dictionary) return;
    
    // Test words with Norwegian characters
    const testWords = ['hus', 'båt', 'vær', 'dårlig', 'kjøre'];
    
    console.log(`Testing ${dialect} dictionary with Norwegian words:`);
    for (const word of testWords) {
      try {
        // Use spell() for checking words
        const isCorrect = await dictionary.spell(word);
        console.log(`Word "${word}": ${isCorrect ? '✅ Correct' : '❌ Incorrect'}`);
        
        if (!isCorrect) {
          try {
            // Try to get suggestions
            const suggestions = await dictionary.suggest(word);
            console.log(`Suggestions: ${suggestions.join(', ')}`);
          } catch (err) {
            console.error(`Error getting suggestions for "${word}":`, err);
          }
        }
      } catch (error) {
        console.error(`Error testing word "${word}":`, error);
      }
    }
  }
  
  /**
   * Load thesaurus data for a dialect
   * @param {string} dialect - Dialect code ('nb' or 'nn')
   * @returns {Promise<Object>} - The thesaurus data
   */
  async loadThesaurus(dialect) {
    try {
      // Get thesaurus files from Redis as raw buffers
      const [idxBuffer, datBuffer] = await Promise.all([
        this.redis.getBuffer(`norsk:thesaurus:${dialect}:idx`),
        this.redis.getBuffer(`norsk:thesaurus:${dialect}:dat`)
      ]);
      
      if (!idxBuffer || !datBuffer) {
        throw new Error(`Missing thesaurus data for ${dialect}`);
      }
      
      console.log(`Loading thesaurus for ${dialect}: idx=${idxBuffer.length} bytes, dat=${datBuffer.length} bytes`);
      
      // Create a thesaurus parser
      const { MyThesParser } = require('../utils/MyThesParser');
      const thesaurus = new MyThesParser(idxBuffer, datBuffer);
      
      // Test some words
      this.testThesaurus(thesaurus, dialect);
      
      // Store and return the thesaurus
      this.thesaurusData[dialect] = thesaurus;
      return thesaurus;
    } catch (error) {
      console.error(`Error loading ${dialect} thesaurus:`, error);
      throw error;
    }
  }
  
  /**
   * Test the thesaurus with some words
   */
  testThesaurus(thesaurus, dialect) {
    // Skip test if no thesaurus
    if (!thesaurus) return;
    
    // Test words
    const testWords = ['hus', 'god', 'dårlig', 'kjøre', 'være'];
    
    console.log(`Testing ${dialect} thesaurus with sample words:`);
    for (const word of testWords) {
      try {
        const synonyms = thesaurus.getSynonyms(word);
        console.log(`Word "${word}": ${synonyms.length} synonyms`);
        
        if (synonyms.length > 0) {
          console.log(`  Sample: ${synonyms.slice(0, 5).join(', ')}`);
        }
      } catch (error) {
        console.error(`Error getting synonyms for "${word}":`, error);
      }
    }
  }
  
  /**
   * Get Norwegian characters info
   * @returns {Object} - Info about Norwegian characters in the files
   */
  async getNorwegianCharInfo() {
    const info = {
      dictionary: {},
      thesaurus: {}
    };
    
    try {
      // Check dictionary files
      for (const dialect of ['nb', 'nn']) {
        try {
          const dicBuffer = await this.redis.getBuffer(`norsk:hunspell:${dialect}:dic`);
          if (dicBuffer) {
            // Check for Norwegian characters
            const sample = dicBuffer.toString('latin1').slice(0, 10000);
            const norwegianChars = (sample.match(/[æøåÆØÅ]/g) || []).length;
            
            info.dictionary[dialect] = {
              norwegianChars,
              encoding: 'latin1',
              size: dicBuffer.length
            };
            
            // Get sample words
            if (norwegianChars > 0) {
              const norwegianWords = [];
              const regex = /\b\w*[æøåÆØÅ]\w*\b/g;
              let match;
              
              while ((match = regex.exec(sample)) !== null && norwegianWords.length < 5) {
                norwegianWords.push(match[0]);
              }
              
              info.dictionary[dialect].sampleWords = norwegianWords;
            }
          }
        } catch (err) {
          console.error(`Error checking dictionary ${dialect}:`, err);
        }
      }
      
      // Check thesaurus files
      for (const dialect of ['nb', 'nn']) {
        try {
          const idxBuffer = await this.redis.getBuffer(`norsk:thesaurus:${dialect}:idx`);
          const datBuffer = await this.redis.getBuffer(`norsk:thesaurus:${dialect}:dat`);
          
          if (idxBuffer && datBuffer) {
            // Check for Norwegian characters
            const idxSample = idxBuffer.toString('latin1').slice(0, 10000);
            const datSample = datBuffer.toString('latin1').slice(0, 10000);
            
            const idxNorwegianChars = (idxSample.match(/[æøåÆØÅ]/g) || []).length;
            const datNorwegianChars = (datSample.match(/[æøåÆØÅ]/g) || []).length;
            
            info.thesaurus[dialect] = {
              idxNorwegianChars,
              datNorwegianChars,
              encoding: 'latin1',
              idxSize: idxBuffer.length,
              datSize: datBuffer.length
            };
          }
        } catch (err) {
          console.error(`Error checking thesaurus ${dialect}:`, err);
        }
      }
    } catch (err) {
      console.error('Error getting Norwegian character info:', err);
    }
    
    return info;
  }
  
  /**
   * Check spelling of a word using the Nodehun dictionary
   * @param {string} word - Word to check
   * @param {string} dialect - Dialect to use ('nb' or 'nn')
   * @returns {Promise<{correct: boolean, suggestions: string[]}>} - Spelling result
   */
  async checkSpelling(word, dialect = 'nb') {
    if (!word) return { correct: false, suggestions: [] };
    
    try {
      // Load dictionary if needed
      if (!this.dictionaries[dialect]) {
        await this.loadDictionary(dialect);
      }
      
      const dictionary = this.dictionaries[dialect];
      if (!dictionary) {
        throw new Error(`Dictionary for ${dialect} not available`);
      }
      
      // Check spelling
      const correct = await dictionary.spell(word);
      
      // Get suggestions if incorrect
      let suggestions = [];
      if (!correct) {
        suggestions = await dictionary.suggest(word);
      }
      
      return { correct, suggestions };
    } catch (error) {
      console.error(`Error checking spelling for "${word}":`, error);
      return { correct: false, suggestions: [], error: error.message };
    }
  }
  
  /**
   * Get synonyms for a word
   * @param {string} word - Word to look up
   * @param {string} dialect - Dialect to use ('nb' or 'nn')
   * @returns {Promise<string[]>} - Array of synonyms
   */
  async getSynonyms(word, dialect = 'nb') {
    if (!word) return [];
    
    try {
      // Load thesaurus if needed
      if (!this.thesaurusData[dialect]) {
        await this.loadThesaurus(dialect);
      }
      
      const thesaurus = this.thesaurusData[dialect];
      if (!thesaurus) {
        throw new Error(`Thesaurus for ${dialect} not available`);
      }
      
      // Get synonyms
      return thesaurus.getSynonyms(word);
    } catch (error) {
      console.error(`Error getting synonyms for "${word}":`, error);
      return [];
    }
  }
  
  /**
   * Close connections
   */
  async close() {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

module.exports = NorwegianDictionaryHelper;