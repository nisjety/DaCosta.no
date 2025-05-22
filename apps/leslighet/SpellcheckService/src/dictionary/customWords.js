// src/dictionary/customWords.js
const fs = require('fs').promises;
const path = require('path');
const redisConfig = require('../config/redis');

const REDIS_KEY_PREFIX = 'spellcheck:custom-words';
const CUSTOM_WORDS_FILE_PATH = path.resolve(__dirname, '../../data/custom_words.json');

/**
 * Load custom words from JSON file
 * @returns {Promise<Object>} Custom words data
 */
async function loadCustomWordsFile() {
  try {
    const fileData = await fs.readFile(CUSTOM_WORDS_FILE_PATH, 'utf8');
    return JSON.parse(fileData);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, create default structure
      const defaultData = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        words: {
          no: {},
          en: {}
        }
      };
      
      // Save default structure
      await fs.writeFile(CUSTOM_WORDS_FILE_PATH, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }
    
    console.error('Error loading custom words file:', error);
    throw error;
  }
}

/**
 * Save custom words to JSON file
 * @param {Object} data Custom words data
 * @returns {Promise<boolean>} Success status
 */
async function saveCustomWordsFile(data) {
  try {
    data.lastUpdated = new Date().toISOString();
    await fs.writeFile(CUSTOM_WORDS_FILE_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving custom words file:', error);
    throw error;
  }
}

/**
 * Get custom words from local file and Redis
 * @param {string} lang Language code (e.g., 'en', 'no')
 * @returns {Promise<Array<string>>} Array of custom words
 */
async function getCustomWords(lang = 'no') {
  try {
    // Get words from file
    const fileData = await loadCustomWordsFile();
    const languageWords = fileData.words[lang] || {};
    const fileWords = Object.keys(languageWords);
    
    // Get words from Redis
    const redis = await redisConfig.getClient();
    const redisKey = `${REDIS_KEY_PREFIX}:${lang}`;
    
    const redisData = await redis.get(redisKey);
    let redisWords = [];
    
    if (redisData) {
      try {
        // Try to parse as JSON
        redisWords = JSON.parse(redisData);
      } catch (jsonError) {
        // Fallback to parsing as newline-delimited
        redisWords = redisData.split(/\r?\n/).filter(Boolean);
      }
    }
    
    // Merge words from both sources (file words take precedence)
    const allWords = [...new Set([...fileWords, ...redisWords])];
    return allWords;
  } catch (error) {
    console.error(`Error fetching custom words for language ${lang}:`, error);
    return [];
  }
}

/**
 * Add a custom word to both Redis and JSON file
 * @param {string} word Word to add
 * @param {string} lang Language code (e.g., 'en', 'no')
 * @param {Object} metadata Additional metadata about the word
 * @returns {Promise<boolean>} Success status
 */
async function addCustomWord(word, lang = 'no', metadata = {}) {
  if (!word || typeof word !== 'string') {
    throw new Error('Invalid word');
  }
  
  try {
    // Normalize the word
    const normalizedWord = word.toLowerCase().trim();
    
    // Update Redis
    const redis = await redisConfig.getClient();
    const redisKey = `${REDIS_KEY_PREFIX}:${lang}`;
    
    // Get existing Redis words
    const existingRedisWords = await getCustomWords(lang);
    
    // Check if word already exists in Redis
    if (!existingRedisWords.includes(normalizedWord)) {
      // Add to Redis
      existingRedisWords.push(normalizedWord);
      await redis.set(redisKey, JSON.stringify(existingRedisWords));
    }
    
    // Update JSON file
    const fileData = await loadCustomWordsFile();
    
    // Ensure language exists in the structure
    if (!fileData.words[lang]) {
      fileData.words[lang] = {};
    }
    
    // Check if word already exists in file
    if (!fileData.words[lang][normalizedWord]) {
      // Add word with metadata
      fileData.words[lang][normalizedWord] = {
        addedBy: metadata.addedBy || 'system',
        addedAt: metadata.addedAt || new Date().toISOString(),
        category: metadata.category || 'general',
        notes: metadata.notes || ''
      };
      
      // Save file
      await saveCustomWordsFile(fileData);
    }
    
    return true;
  } catch (error) {
    console.error(`Error adding custom word '${word}' for language ${lang}:`, error);
    throw error;
  }
}

/**
 * Remove a custom word from Redis and JSON file
 * @param {string} word Word to remove
 * @param {string} lang Language code (e.g., 'en', 'no')
 * @returns {Promise<boolean>} Success status
 */
async function removeCustomWord(word, lang = 'no') {
  if (!word || typeof word !== 'string') {
    throw new Error('Invalid word');
  }
  
  try {
    // Normalize the word
    const normalizedWord = word.toLowerCase().trim();
    
    // Remove from Redis
    const redis = await redisConfig.getClient();
    const redisKey = `${REDIS_KEY_PREFIX}:${lang}`;
    
    // Get existing words
    const existingWords = await getCustomWords(lang);
    
    // Check if word exists
    const index = existingWords.indexOf(normalizedWord);
    if (index !== -1) {
      // Remove from Redis
      existingWords.splice(index, 1);
      await redis.set(redisKey, JSON.stringify(existingWords));
    }
    
    // Remove from JSON file
    const fileData = await loadCustomWordsFile();
    
    // Check if language and word exist
    if (fileData.words[lang] && fileData.words[lang][normalizedWord]) {
      // Delete the word
      delete fileData.words[lang][normalizedWord];
      
      // Save file
      await saveCustomWordsFile(fileData);
    }
    
    return true;
  } catch (error) {
    console.error(`Error removing custom word '${word}' for language ${lang}:`, error);
    throw error;
  }
}

/**
 * Get detailed information about a custom word
 * @param {string} word Word to get info for
 * @param {string} lang Language code (e.g., 'en', 'no')
 * @returns {Promise<Object|null>} Word metadata or null if not found
 */
async function getCustomWordInfo(word, lang = 'no') {
  if (!word || typeof word !== 'string') {
    throw new Error('Invalid word');
  }
  
  try {
    // Normalize the word
    const normalizedWord = word.toLowerCase().trim();
    
    // Get file data
    const fileData = await loadCustomWordsFile();
    
    // Check if language and word exist
    if (fileData.words[lang] && fileData.words[lang][normalizedWord]) {
      return {
        word: normalizedWord,
        language: lang,
        ...fileData.words[lang][normalizedWord]
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting info for custom word '${word}' in language ${lang}:`, error);
    throw error;
  }
}

/**
 * Clear all custom words for a language
 * @param {string} lang Language code (e.g., 'en', 'no')
 * @returns {Promise<boolean>} Success status
 */
async function clearCustomWords(lang = 'no') {
  try {
    // Clear from Redis
    const redis = await redisConfig.getClient();
    const redisKey = `${REDIS_KEY_PREFIX}:${lang}`;
    await redis.del(redisKey);
    
    // Clear from JSON file
    const fileData = await loadCustomWordsFile();
    
    // Reset language words
    if (fileData.words[lang]) {
      fileData.words[lang] = {};
      await saveCustomWordsFile(fileData);
    }
    
    return true;
  } catch (error) {
    console.error(`Error clearing custom words for language ${lang}:`, error);
    throw error;
  }
}

/**
 * Export custom words to a JSON file (for backup)
 * @param {string} exportPath File path for export
 * @returns {Promise<boolean>} Success status
 */
async function exportCustomWords(exportPath) {
  try {
    const fileData = await loadCustomWordsFile();
    await fs.writeFile(exportPath, JSON.stringify(fileData, null, 2));
    return true;
  } catch (error) {
    console.error('Error exporting custom words:', error);
    throw error;
  }
}

/**
 * Import custom words from a JSON file
 * @param {string} importPath File path for import
 * @param {boolean} merge Whether to merge with existing words (true) or replace (false)
 * @returns {Promise<boolean>} Success status
 */
async function importCustomWords(importPath, merge = true) {
  try {
    // Read import file
    const importData = JSON.parse(await fs.readFile(importPath, 'utf8'));
    
    if (merge) {
      // Merge with existing data
      const existingData = await loadCustomWordsFile();
      
      // Merge languages and words
      for (const lang in importData.words) {
        if (!existingData.words[lang]) {
          existingData.words[lang] = {};
        }
        
        // Merge words for this language
        for (const word in importData.words[lang]) {
          existingData.words[lang][word] = importData.words[lang][word];
        }
      }
      
      // Save merged data
      await saveCustomWordsFile(existingData);
    } else {
      // Replace existing data
      await saveCustomWordsFile(importData);
    }
    
    return true;
  } catch (error) {
    console.error('Error importing custom words:', error);
    throw error;
  }
}

module.exports = {
  getCustomWords,
  addCustomWord,
  removeCustomWord,
  clearCustomWords,
  getCustomWordInfo,
  exportCustomWords,
  importCustomWords
};