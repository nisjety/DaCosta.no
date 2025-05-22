// word_management_routes.js

/**
 * API routes for managing custom words and suggestions
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const logger = require('../utils/logger');
const { authenticate, adminOnly } = require('../middleware/authMidlewares');

// Convert callbacks to promises
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

// File paths
const customWordsPath = path.resolve(__dirname, '../../data/custom_words.json');
const userFeedbackPath = path.resolve(__dirname, '../../data/user_feedback.json');

// Data cache to reduce file system access
let customWordsCache = null;
let userFeedbackCache = null;
let lastCustomWordsUpdate = null;
let lastUserFeedbackUpdate = null;

/**
 * Load custom words data
 */
const loadCustomWords = async () => {
  try {
    // Check if we need to reload from disk
    const stats = await fs.promises.stat(customWordsPath);
    if (customWordsCache && lastCustomWordsUpdate && stats.mtime <= lastCustomWordsUpdate) {
      return customWordsCache;
    }
    
    const data = await readFileAsync(customWordsPath, 'utf8');
    customWordsCache = JSON.parse(data);
    lastCustomWordsUpdate = new Date();
    return customWordsCache;
  } catch (error) {
    logger.error(`Error loading custom words: ${error.message}`);
    // If file doesn't exist or is invalid, initialize with empty structure
    customWordsCache = { en: [], no: [] };
    return customWordsCache;
  }
};

/**
 * Save custom words data
 */
const saveCustomWords = async (data) => {
  try {
    await writeFileAsync(customWordsPath, JSON.stringify(data, null, 2), 'utf8');
    customWordsCache = data;
    lastCustomWordsUpdate = new Date();
  } catch (error) {
    logger.error(`Error saving custom words: ${error.message}`);
    throw error;
  }
};

/**
 * Load user feedback data
 */
const loadUserFeedback = async () => {
  try {
    // Check if we need to reload from disk
    const stats = await fs.promises.stat(userFeedbackPath);
    if (userFeedbackCache && lastUserFeedbackUpdate && stats.mtime <= lastUserFeedbackUpdate) {
      return userFeedbackCache;
    }
    
    const data = await readFileAsync(userFeedbackPath, 'utf8');
    userFeedbackCache = JSON.parse(data);
    
    // Ensure proper structure
    const defaultStructure = {
      pending: { en: [], no: [] },
      approved: { en: [], no: [] },
      rejected: { en: [], no: [] }
    };
    
    // Make sure all required properties exist
    if (!userFeedbackCache.pending) userFeedbackCache.pending = defaultStructure.pending;
    if (!userFeedbackCache.approved) userFeedbackCache.approved = defaultStructure.approved;
    if (!userFeedbackCache.rejected) userFeedbackCache.rejected = defaultStructure.rejected;
    
    // Make sure language objects exist in each category
    if (!userFeedbackCache.pending.en) userFeedbackCache.pending.en = [];
    if (!userFeedbackCache.pending.no) userFeedbackCache.pending.no = [];
    if (!userFeedbackCache.approved.en) userFeedbackCache.approved.en = [];
    if (!userFeedbackCache.approved.no) userFeedbackCache.approved.no = [];
    if (!userFeedbackCache.rejected.en) userFeedbackCache.rejected.en = [];
    if (!userFeedbackCache.rejected.no) userFeedbackCache.rejected.no = [];
    
    lastUserFeedbackUpdate = new Date();
    return userFeedbackCache;
  } catch (error) {
    logger.error(`Error loading user feedback: ${error.message}`);
    // If file doesn't exist or is invalid, initialize with empty structure
    userFeedbackCache = { 
      pending: { en: [], no: [] },
      approved: { en: [], no: [] },
      rejected: { en: [], no: [] }
    };
    return userFeedbackCache;
  }
};

/**
 * Save user feedback data
 */
const saveUserFeedback = async (data) => {
  try {
    await writeFileAsync(userFeedbackPath, JSON.stringify(data, null, 2), 'utf8');
    userFeedbackCache = data;
    lastUserFeedbackUpdate = new Date();
  } catch (error) {
    logger.error(`Error saving user feedback: ${error.message}`);
    throw error;
  }
};

/**
 * Get current timestamp
 */
const getCurrentTimestamp = () => {
  return new Date().toISOString();
};

/**
 * Find a word in a list
 */
const findWordInList = (wordList, word, lang) => {
  return wordList.find(item => 
    item.word.toLowerCase() === word.toLowerCase() && 
    (!item.language || item.language === lang)
  );
};

/**
 * Remove a word from a list
 */
const removeWordFromList = (wordList, word, lang) => {
  const index = wordList.findIndex(item => 
    item.word.toLowerCase() === word.toLowerCase() && 
    (!item.language || item.language === lang)
  );
  
  if (index !== -1) {
    wordList.splice(index, 1);
    return true;
  }
  return false;
};

// IMPORTANT: Specific routes must be defined before parameterized routes /:word
// ------------------------------------------------------------------------------

/**
 * @route GET /api/words/pending
 * @desc Get pending word suggestions
 * @access Admin
 */
router.get('/pending', authenticate, adminOnly, async (req, res) => {
  try {
    const lang = req.query.lang || 'en';
    const feedback = await loadUserFeedback();
    
    // Return pending words for the specified language
    res.json(feedback.pending[lang] || []);
  } catch (error) {
    logger.error(`Error getting pending words: ${error.message}`);
    res.status(500).json({ message: 'Error retrieving pending words' });
  }
});

/**
 * @route GET /api/words/approved
 * @desc Get approved word suggestions
 * @access Admin
 */
router.get('/approved', authenticate, adminOnly, async (req, res) => {
  try {
    const lang = req.query.lang || 'en';
    const feedback = await loadUserFeedback();
    
    // Return approved words for the specified language
    res.json(feedback.approved[lang] || []);
  } catch (error) {
    logger.error(`Error getting approved words: ${error.message}`);
    res.status(500).json({ message: 'Error retrieving approved words' });
  }
});

/**
 * @route GET /api/words/rejected
 * @desc Get rejected word suggestions
 * @access Admin
 */
router.get('/rejected', authenticate, adminOnly, async (req, res) => {
  try {
    const lang = req.query.lang || 'en';
    const feedback = await loadUserFeedback();
    
    // Return rejected words for the specified language
    res.json(feedback.rejected[lang] || []);
  } catch (error) {
    logger.error(`Error getting rejected words: ${error.message}`);
    res.status(500).json({ message: 'Error retrieving rejected words' });
  }
});

/**
 * @route GET /api/words/custom
 * @desc Get custom dictionary words
 * @access Admin
 */
router.get('/custom', authenticate, adminOnly, async (req, res) => {
  try {
    const lang = req.query.lang || 'en';
    const customWords = await loadCustomWords();
    
    // Return custom words for the specified language
    res.json(customWords[lang] || []);
  } catch (error) {
    logger.error(`Error getting custom words: ${error.message}`);
    res.status(500).json({ message: 'Error retrieving custom words' });
  }
});

/**
 * @route GET /api/words/stats
 * @desc Get statistics about the dictionaries and suggestions
 * @access Admin
 */
router.get('/stats', authenticate, adminOnly, async (req, res) => {
  try {
    const feedback = await loadUserFeedback();
    const customWords = await loadCustomWords();
    
    // Count total words in each category
    const customWordCount = Object.values(customWords).reduce((total, words) => total + words.length, 0);
    const pendingCount = Object.values(feedback.pending).reduce((total, words) => total + words.length, 0);
    const approvedCount = Object.values(feedback.approved).reduce((total, words) => total + words.length, 0);
    const rejectedCount = Object.values(feedback.rejected).reduce((total, words) => total + words.length, 0);
    
    // Count by language
    const languageDistribution = {};
    
    // Add custom words to language distribution
    Object.entries(customWords).forEach(([lang, words]) => {
      languageDistribution[lang] = (languageDistribution[lang] || 0) + words.length;
    });
    
    // Count recent suggestions (last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoTimestamp = oneWeekAgo.toISOString();
    
    let recentSuggestions = 0;
    
    // Count recent suggestions across all languages
    Object.values(feedback.pending).forEach(words => {
      recentSuggestions += words.filter(word => word.addedAt > oneWeekAgoTimestamp).length;
    });
    
    // Count unique users who submitted feedback
    const uniqueUsers = new Set();
    
    // Collect users from all feedback categories
    ['pending', 'approved', 'rejected'].forEach(category => {
      Object.values(feedback[category]).forEach(words => {
        words.forEach(word => {
          if (word.voters) {
            word.voters.forEach(voter => uniqueUsers.add(voter));
          }
          if (word.addedBy) {
            uniqueUsers.add(word.addedBy);
          }
        });
      });
    });
    
    const stats = {
      customWordCount,
      pendingCount,
      approvedCount,
      rejectedCount,
      totalWordCount: customWordCount,
      languageDistribution,
      recentSuggestions,
      activeUsers: uniqueUsers.size,
      totalFeedbackCount: pendingCount + approvedCount + rejectedCount,
      lastUpdated: new Date().toISOString(),
      databaseStatus: 'OK',
      cacheHitRate: lastCustomWordsUpdate && lastUserFeedbackUpdate ? '100' : '0'
    };
    
    res.json(stats);
  } catch (error) {
    logger.error(`Error generating statistics: ${error.message}`);
    res.status(500).json({ message: 'Error retrieving statistics' });
  }
});

/**
 * @route POST /api/words/approve
 * @desc Approve a pending word
 * @access Admin
 */
router.post('/approve', authenticate, adminOnly, async (req, res) => {
  try {
    const { word, lang } = req.body;
    
    if (!word || !lang) {
      return res.status(400).json({ message: 'Word and language are required' });
    }
    
    const feedback = await loadUserFeedback();
    
    // Check if word exists in pending
    const pendingWord = findWordInList(feedback.pending[lang] || [], word, lang);
    if (!pendingWord) {
      return res.status(404).json({ message: 'Word not found in pending suggestions' });
    }
    
    // Remove from pending
    removeWordFromList(feedback.pending[lang] || [], word, lang);
    
    // Add to approved with timestamp and admin info
    const approvedWord = {
      ...pendingWord,
      approvedBy: req.user.username,
      approvedAt: getCurrentTimestamp()
    };
    
    if (!feedback.approved[lang]) {
      feedback.approved[lang] = [];
    }
    feedback.approved[lang].push(approvedWord);
    
    // Add to custom dictionary
    const customWords = await loadCustomWords();
    if (!customWords[lang]) {
      customWords[lang] = [];
    }
    
    const customWord = {
      word,
      language: lang,
      category: 'user_suggestion',
      addedBy: req.user.username,
      addedAt: getCurrentTimestamp(),
      notes: `Approved from user suggestion with ${pendingWord.votes || 0} votes`
    };
    
    customWords[lang].push(customWord);
    
    // Save changes
    await saveUserFeedback(feedback);
    await saveCustomWords(customWords);
    
    res.json({ message: 'Word approved successfully', word: approvedWord });
  } catch (error) {
    logger.error(`Error approving word: ${error.message}`);
    res.status(500).json({ message: 'Error approving word' });
  }
});

/**
 * @route POST /api/words/reject
 * @desc Reject a pending word
 * @access Admin
 */
router.post('/reject', authenticate, adminOnly, async (req, res) => {
  try {
    const { word, lang, reason } = req.body;
    
    if (!word || !lang) {
      return res.status(400).json({ message: 'Word and language are required' });
    }
    
    const feedback = await loadUserFeedback();
    
    // Check if word exists in pending
    const pendingWord = findWordInList(feedback.pending[lang] || [], word, lang);
    if (!pendingWord) {
      return res.status(404).json({ message: 'Word not found in pending suggestions' });
    }
    
    // Remove from pending
    removeWordFromList(feedback.pending[lang] || [], word, lang);
    
    // Add to rejected with timestamp, admin info, and reason
    const rejectedWord = {
      ...pendingWord,
      rejectedBy: req.user.username,
      rejectedAt: getCurrentTimestamp(),
      rejectionReason: reason || 'No reason provided'
    };
    
    if (!feedback.rejected[lang]) {
      feedback.rejected[lang] = [];
    }
    feedback.rejected[lang].push(rejectedWord);
    
    // Save changes
    await saveUserFeedback(feedback);
    
    res.json({ message: 'Word rejected successfully', word: rejectedWord });
  } catch (error) {
    logger.error(`Error rejecting word: ${error.message}`);
    res.status(500).json({ message: 'Error rejecting word' });
  }
});

/**
 * @route POST /api/words/delete
 * @desc Delete a word from approved or custom list
 * @access Admin
 */
router.post('/delete', authenticate, adminOnly, async (req, res) => {
  try {
    const { word, lang, type } = req.body;
    
    if (!word || !lang) {
      return res.status(400).json({ message: 'Word and language are required' });
    }
    
    if (type === 'custom') {
      // Delete from custom dictionary
      const customWords = await loadCustomWords();
      if (!customWords[lang]) {
        return res.status(404).json({ message: 'Language not found in custom dictionary' });
      }
      
      if (removeWordFromList(customWords[lang], word, lang)) {
        await saveCustomWords(customWords);
        res.json({ message: 'Word deleted from custom dictionary' });
      } else {
        res.status(404).json({ message: 'Word not found in custom dictionary' });
      }
    } else if (type === 'approved') {
      // Delete from approved feedback
      const feedback = await loadUserFeedback();
      if (!feedback.approved[lang]) {
        return res.status(404).json({ message: 'Language not found in approved suggestions' });
      }
      
      if (removeWordFromList(feedback.approved[lang], word, lang)) {
        await saveUserFeedback(feedback);
        
        // Also check if it's in custom words and remove it
        const customWords = await loadCustomWords();
        if (customWords[lang]) {
          removeWordFromList(customWords[lang], word, lang);
          await saveCustomWords(customWords);
        }
        
        res.json({ message: 'Word deleted from approved suggestions' });
      } else {
        res.status(404).json({ message: 'Word not found in approved suggestions' });
      }
    } else {
      res.status(400).json({ message: 'Invalid type. Must be "custom" or "approved"' });
    }
  } catch (error) {
    logger.error(`Error deleting word: ${error.message}`);
    res.status(500).json({ message: 'Error deleting word' });
  }
});

/**
 * @route POST /api/words/restore
 * @desc Restore a rejected word to pending
 * @access Admin
 */
router.post('/restore', authenticate, adminOnly, async (req, res) => {
  try {
    const { word, lang } = req.body;
    
    if (!word || !lang) {
      return res.status(400).json({ message: 'Word and language are required' });
    }
    
    const feedback = await loadUserFeedback();
    
    // Check if word exists in rejected
    const rejectedWord = findWordInList(feedback.rejected[lang] || [], word, lang);
    if (!rejectedWord) {
      return res.status(404).json({ message: 'Word not found in rejected suggestions' });
    }
    
    // Remove from rejected
    removeWordFromList(feedback.rejected[lang] || [], word, lang);
    
    // Add to pending (restore original data, but update timestamp)
    const pendingWord = {
      word: rejectedWord.word,
      language: rejectedWord.language,
      votes: rejectedWord.votes || 1,
      addedAt: getCurrentTimestamp(),
      restoredBy: req.user.username,
      notes: rejectedWord.notes || 'Restored from rejected list'
    };
    
    if (!feedback.pending[lang]) {
      feedback.pending[lang] = [];
    }
    feedback.pending[lang].push(pendingWord);
    
    // Save changes
    await saveUserFeedback(feedback);
    
    res.json({ message: 'Word restored to pending successfully', word: pendingWord });
  } catch (error) {
    logger.error(`Error restoring word: ${error.message}`);
    res.status(500).json({ message: 'Error restoring word' });
  }
});

/**
 * @route POST /api/words/add
 * @desc Add a new word to the custom dictionary
 * @access Admin
 */
router.post('/add', authenticate, adminOnly, async (req, res) => {
  try {
    const { word, lang, category, notes } = req.body;
    
    if (!word || !lang) {
      return res.status(400).json({ message: 'Word and language are required' });
    }
    
    const customWords = await loadCustomWords();
    
    // Check if language exists
    if (!customWords[lang]) {
      customWords[lang] = [];
    }
    
    // Check if word already exists
    if (findWordInList(customWords[lang], word, lang)) {
      return res.status(409).json({ message: 'Word already exists in dictionary' });
    }
    
    // Add new word
    const newWord = {
      word: word.trim(),
      language: lang,
      category: category || 'general',
      addedBy: req.user.username,
      addedAt: getCurrentTimestamp(),
      notes: notes || ''
    };
    
    customWords[lang].push(newWord);
    
    // Save changes
    await saveCustomWords(customWords);
    
    res.status(201).json({ message: 'Word added successfully', word: newWord });
  } catch (error) {
    logger.error(`Error adding word: ${error.message}`);
    res.status(500).json({ message: 'Error adding word' });
  }
});

/**
 * @route POST /api/words/update
 * @desc Update a word in the custom dictionary
 * @access Admin
 */
router.post('/update', authenticate, adminOnly, async (req, res) => {
  try {
    const { word, lang, category, notes } = req.body;
    
    if (!word || !lang) {
      return res.status(400).json({ message: 'Word and language are required' });
    }
    
    const customWords = await loadCustomWords();
    
    // Check if language exists
    if (!customWords[lang]) {
      return res.status(404).json({ message: 'Language not found in dictionary' });
    }
    
    // Find word in list
    const wordIndex = customWords[lang].findIndex(item => 
      item.word.toLowerCase() === word.toLowerCase() && 
      (!item.language || item.language === lang)
    );
    
    if (wordIndex === -1) {
      return res.status(404).json({ message: 'Word not found in dictionary' });
    }
    
    // Update fields
    const updatedWord = {
      ...customWords[lang][wordIndex],
      category: category || customWords[lang][wordIndex].category,
      notes: notes !== undefined ? notes : customWords[lang][wordIndex].notes,
      updatedBy: req.user.username,
      updatedAt: getCurrentTimestamp()
    };
    
    customWords[lang][wordIndex] = updatedWord;
    
    // Save changes
    await saveCustomWords(customWords);
    
    res.json({ message: 'Word updated successfully', word: updatedWord });
  } catch (error) {
    logger.error(`Error updating word: ${error.message}`);
    res.status(500).json({ message: 'Error updating word' });
  }
});

// This MUST be the last route - catch-all for specific word lookups
/**
 * @route GET /api/words/:word
 * @desc Get details for a specific word
 * @access Admin
 */
router.get('/:word', authenticate, adminOnly, async (req, res) => {
  try {
    const { word } = req.params;
    const lang = req.query.lang || 'en';
    
    if (!word) {
      return res.status(400).json({ message: 'Word parameter is required' });
    }
    
    const feedback = await loadUserFeedback();
    const customWords = await loadCustomWords();
    
    // Check in all lists for the word
    const wordData = findWordInList(feedback.pending[lang] || [], word, lang) || 
                     findWordInList(feedback.approved[lang] || [], word, lang) || 
                     findWordInList(feedback.rejected[lang] || [], word, lang) || 
                     findWordInList(customWords[lang] || [], word, lang);
    
    if (wordData) {
      res.json(wordData);
    } else {
      res.status(404).json({ message: 'Word not found' });
    }
  } catch (error) {
    logger.error(`Error getting word details: ${error.message}`);
    res.status(500).json({ message: 'Error retrieving word details' });
  }
});

module.exports = router;