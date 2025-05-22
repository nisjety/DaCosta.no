// src/utils/feedback_manager.js
const fs = require('fs').promises;
const path = require('path');
const customWords = require('../dictionary/customWords');

const USER_FEEDBACK_FILE_PATH = path.resolve(__dirname, '../../data/user_feedback.json');

/**
 * Load user feedback data from JSON file
 * @returns {Promise<Object>} User feedback data
 */
async function loadFeedbackFile() {
  try {
    const fileData = await fs.readFile(USER_FEEDBACK_FILE_PATH, 'utf8');
    const parsedData = JSON.parse(fileData);
    
    // Ensure all required properties exist with proper structure
    const defaultData = {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      pendingWords: {
        no: {},
        en: {}
      },
      rejectedWords: {
        no: {},
        en: {}
      },
      approvedWords: {
        no: {},
        en: {}
      }
    };
    
    // Merge parsed data with default structure to ensure all properties exist
    const mergedData = {
      ...defaultData,
      ...parsedData,
      pendingWords: {
        ...defaultData.pendingWords,
        ...(parsedData.pendingWords || {})
      },
      rejectedWords: {
        ...defaultData.rejectedWords,
        ...(parsedData.rejectedWords || {})
      },
      approvedWords: {
        ...defaultData.approvedWords,
        ...(parsedData.approvedWords || {})
      }
    };
    
    return mergedData;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, create default structure
      const defaultData = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        pendingWords: {
          no: {},
          en: {}
        },
        rejectedWords: {
          no: {},
          en: {}
        },
        approvedWords: {
          no: {},
          en: {}
        }
      };
      
      // Save default structure
      await fs.writeFile(USER_FEEDBACK_FILE_PATH, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }
    
    console.error('Error loading user feedback file:', error);
    throw error;
  }
}

/**
 * Save user feedback data to JSON file
 * @param {Object} data User feedback data
 * @returns {Promise<boolean>} Success status
 */
async function saveFeedbackFile(data) {
  try {
    data.lastUpdated = new Date().toISOString();
    await fs.writeFile(USER_FEEDBACK_FILE_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving user feedback file:', error);
    throw error;
  }
}

/**
 * Add a word suggestion from user feedback
 * @param {string} word Word suggested by user
 * @param {string} lang Language code (e.g., 'en', 'no')
 * @param {Object} metadata Additional metadata about the suggestion
 * @returns {Promise<Object>} Result of the operation
 */
async function addWordSuggestion(word, lang = 'no', metadata = {}) {
  if (!word || typeof word !== 'string') {
    throw new Error('Invalid word');
  }
  
  try {
    // Normalize the word
    const normalizedWord = word.toLowerCase().trim();
    
    // Check if word already exists in custom words
    const customWordInfo = await customWords.getCustomWordInfo(normalizedWord, lang);
    if (customWordInfo) {
      return {
        success: true,
        status: 'exists',
        message: 'Word already exists in custom dictionary',
        word: normalizedWord
      };
    }
    
    // Load feedback data
    const feedbackData = await loadFeedbackFile();
    
    // Check if word is already in any category
    if (feedbackData.approvedWords[lang] && feedbackData.approvedWords[lang][normalizedWord]) {
      return {
        success: true,
        status: 'approved',
        message: 'Word is already approved',
        word: normalizedWord
      };
    }
    
    if (feedbackData.rejectedWords[lang] && feedbackData.rejectedWords[lang][normalizedWord]) {
      return {
        success: true,
        status: 'rejected',
        message: 'Word has been previously rejected',
        word: normalizedWord
      };
    }
    
    // Ensure language exists in pendingWords
    if (!feedbackData.pendingWords[lang]) {
      feedbackData.pendingWords[lang] = {};
    }
    
    // Add or update pending word
    const existingEntry = feedbackData.pendingWords[lang][normalizedWord];
    
    if (existingEntry) {
      // Update existing entry
      existingEntry.votes += 1;
      existingEntry.lastUpdated = new Date().toISOString();
      
      // Add user to voters if not already present
      if (metadata.userId && !existingEntry.voters.includes(metadata.userId)) {
        existingEntry.voters.push(metadata.userId);
      }
      
      // Update context if provided
      if (metadata.context) {
        existingEntry.contexts.push(metadata.context);
      }
    } else {
      // Create new entry
      feedbackData.pendingWords[lang][normalizedWord] = {
        word: normalizedWord,
        addedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        votes: 1,
        voters: metadata.userId ? [metadata.userId] : [],
        contexts: metadata.context ? [metadata.context] : [],
        notes: metadata.notes || ''
      };
    }
    
    // Save updated feedback data
    await saveFeedbackFile(feedbackData);
    
    return {
      success: true,
      status: 'pending',
      message: 'Word added to pending suggestions',
      word: normalizedWord
    };
  } catch (error) {
    console.error(`Error adding word suggestion '${word}' for language ${lang}:`, error);
    throw error;
  }
}

/**
 * Approve a word suggestion and add to custom dictionary
 * @param {string} word Word to approve
 * @param {string} lang Language code (e.g., 'en', 'no')
 * @param {string} approvedBy ID or name of approver
 * @returns {Promise<Object>} Result of the operation
 */
async function approveWordSuggestion(word, lang = 'no', approvedBy = 'admin') {
  if (!word || typeof word !== 'string') {
    throw new Error('Invalid word');
  }
  
  try {
    // Normalize the word
    const normalizedWord = word.toLowerCase().trim();
    
    // Load feedback data
    const feedbackData = await loadFeedbackFile();
    
    // Check if word is pending
    if (!feedbackData.pendingWords[lang] || !feedbackData.pendingWords[lang][normalizedWord]) {
      return {
        success: false,
        status: 'not_found',
        message: 'Word not found in pending suggestions',
        word: normalizedWord
      };
    }
    
    // Get pending word data
    const pendingWordData = feedbackData.pendingWords[lang][normalizedWord];
    
    // Move from pending to approved
    if (!feedbackData.approvedWords[lang]) {
      feedbackData.approvedWords[lang] = {};
    }
    
    // Add to approved words with approval info
    feedbackData.approvedWords[lang][normalizedWord] = {
      ...pendingWordData,
      approvedBy,
      approvedAt: new Date().toISOString()
    };
    
    // Remove from pending words
    delete feedbackData.pendingWords[lang][normalizedWord];
    
    // Save updated feedback data
    await saveFeedbackFile(feedbackData);
    
    // Add to custom words
    await customWords.addCustomWord(normalizedWord, lang, {
      addedBy: approvedBy,
      addedAt: new Date().toISOString(),
      category: 'user_suggested',
      notes: pendingWordData.notes || `Approved from user suggestion with ${pendingWordData.votes} votes`
    });
    
    return {
      success: true,
      status: 'approved',
      message: 'Word approved and added to custom dictionary',
      word: normalizedWord
    };
  } catch (error) {
    console.error(`Error approving word suggestion '${word}' for language ${lang}:`, error);
    throw error;
  }
}

/**
 * Reject a word suggestion
 * @param {string} word Word to reject
 * @param {string} lang Language code (e.g., 'en', 'no')
 * @param {string} rejectedBy ID or name of rejector
 * @param {string} reason Reason for rejection
 * @returns {Promise<Object>} Result of the operation
 */
async function rejectWordSuggestion(word, lang = 'no', rejectedBy = 'admin', reason = '') {
  if (!word || typeof word !== 'string') {
    throw new Error('Invalid word');
  }
  
  try {
    // Normalize the word
    const normalizedWord = word.toLowerCase().trim();
    
    // Load feedback data
    const feedbackData = await loadFeedbackFile();
    
    // Check if word is pending
    if (!feedbackData.pendingWords[lang] || !feedbackData.pendingWords[lang][normalizedWord]) {
      return {
        success: false,
        status: 'not_found',
        message: 'Word not found in pending suggestions',
        word: normalizedWord
      };
    }
    
    // Get pending word data
    const pendingWordData = feedbackData.pendingWords[lang][normalizedWord];
    
    // Move from pending to rejected
    if (!feedbackData.rejectedWords[lang]) {
      feedbackData.rejectedWords[lang] = {};
    }
    
    // Add to rejected words with rejection info
    feedbackData.rejectedWords[lang][normalizedWord] = {
      ...pendingWordData,
      rejectedBy,
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason
    };
    
    // Remove from pending words
    delete feedbackData.pendingWords[lang][normalizedWord];
    
    // Save updated feedback data
    await saveFeedbackFile(feedbackData);
    
    return {
      success: true,
      status: 'rejected',
      message: 'Word suggestion rejected',
      word: normalizedWord
    };
  } catch (error) {
    console.error(`Error rejecting word suggestion '${word}' for language ${lang}:`, error);
    throw error;
  }
}

/**
 * Get all pending word suggestions
 * @param {string} lang Optional language filter
 * @returns {Promise<Array>} List of pending word suggestions
 */
async function getPendingWordSuggestions(lang = null) {
  try {
    const feedbackData = await loadFeedbackFile();
    const result = [];
    
    // Process all languages or just the specified one
    const languages = lang ? [lang] : Object.keys(feedbackData.pendingWords);
    
    for (const language of languages) {
      const langWords = feedbackData.pendingWords[language] || {};
      
      for (const word in langWords) {
        result.push({
          word,
          language,
          ...langWords[word]
        });
      }
    }
    
    // Sort by vote count (highest first) and then by date (newest first)
    return result.sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      return new Date(b.lastUpdated) - new Date(a.lastUpdated);
    });
  } catch (error) {
    console.error('Error getting pending word suggestions:', error);
    throw error;
  }
}

/**
 * Get statistics about word suggestions
 * @returns {Promise<Object>} Statistics about word suggestions
 */
async function getWordSuggestionStats() {
  try {
    const feedbackData = await loadFeedbackFile();
    const stats = {
      pending: {},
      approved: {},
      rejected: {},
      totalPending: 0,
      totalApproved: 0,
      totalRejected: 0,
      lastUpdated: feedbackData.lastUpdated
    };
    
    // Count words by language
    for (const lang in feedbackData.pendingWords) {
      const count = Object.keys(feedbackData.pendingWords[lang]).length;
      stats.pending[lang] = count;
      stats.totalPending += count;
    }
    
    for (const lang in feedbackData.approvedWords) {
      const count = Object.keys(feedbackData.approvedWords[lang]).length;
      stats.approved[lang] = count;
      stats.totalApproved += count;
    }
    
    for (const lang in feedbackData.rejectedWords) {
      const count = Object.keys(feedbackData.rejectedWords[lang]).length;
      stats.rejected[lang] = count;
      stats.totalRejected += count;
    }
    
    return stats;
  } catch (error) {
    console.error('Error getting word suggestion statistics:', error);
    throw error;
  }
}

module.exports = {
  addWordSuggestion,
  approveWordSuggestion,
  rejectWordSuggestion,
  getPendingWordSuggestions,
  getWordSuggestionStats
};