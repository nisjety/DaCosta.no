// src/services/SpellCheckerFeedbackSystem.js
const customWords = require('../dictionary/customWords');
const redisConfig = require('../config/redis');
const feedbackManager = require('../utils/feedback_manager');

class SpellCheckerFeedbackSystem {
  constructor(options = {}) {
    this.config = {
      minThreshold: options.minThreshold || 2,
      trustedUserMultiplier: options.trustedUserMultiplier || 2,
      feedbackDecayDays: options.feedbackDecayDays || 90,
      trustScoreThreshold: options.trustScoreThreshold || 5,
      autoLearnThreshold: options.autoLearnThreshold || 3
    };
    
    this.feedbackData = {
      wordFeedback: new Map(), // Store feedback for each word
      trustScores: new Map(),  // Store trust scores for users
      customWords: new Set()   // Cache of custom words from Redis
    };
    
    // Load custom words from Redis
    this.loadCustomWords();
    
    // Setup cleanup interval to remove old feedback
    this.setupFeedbackCleanup();
  }
  
  /**
   * Load custom words from Redis
   */
  async loadCustomWords() {
    try {
      const words = await customWords.getCustomWords();
      this.feedbackData.customWords = new Set(words);
      console.log(`Loaded ${words.length} custom words for feedback system`);
    } catch (error) {
      console.error('Error loading custom words for feedback system:', error);
    }
  }
  
  /**
   * Set up periodic cleanup of old feedback data
   */
  setupFeedbackCleanup() {
    // Run cleanup once a day
    const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
    
    this.cleanupInterval = setInterval(() => {
      try {
        this.cleanupOldFeedback();
      } catch (error) {
        console.error('Error during feedback cleanup:', error);
      }
    }, CLEANUP_INTERVAL);
  }
  
  /**
   * Clean up old feedback data to prevent memory growth
   */
  cleanupOldFeedback() {
    const now = Date.now();
    const ageThreshold = this.config.feedbackDecayDays * 24 * 60 * 60 * 1000;
    let removedCount = 0;
    
    for (const [word, data] of this.feedbackData.wordFeedback.entries()) {
      // If the word has been added to custom words, we can remove the feedback
      if (this.feedbackData.customWords.has(word)) {
        this.feedbackData.wordFeedback.delete(word);
        removedCount++;
        continue;
      }
      
      // If the word has timestamp and is old, or has very few votes, remove it
      if ((data.lastUpdated && now - data.lastUpdated > ageThreshold) || 
          (data.correctVotes + data.incorrectVotes < this.config.minThreshold)) {
        this.feedbackData.wordFeedback.delete(word);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} outdated feedback entries`);
    }
  }
  
  /**
   * Process user feedback about a word
   * @param {string} word - The word the user is providing feedback on
   * @param {boolean} isCorrect - Whether the user thinks it's correct
   * @param {string} userId - ID of the user providing feedback
   * @returns {Promise<Object>} - Result of the feedback processing
   */
  async processFeedback(word, isCorrect, userId = 'anonymous') {
    if (!word || typeof word !== 'string') {
      return { success: false, error: 'Invalid word' };
    }
    
    // Normalize the word
    const normalizedWord = word.toLowerCase().trim();
    
    try {
      // Update the user's trust score
      this.updateTrustScore(userId, isCorrect ? 'correct' : 'incorrect');
      const trustScore = this.getTrustScore(userId);
      const isTrusted = trustScore >= this.config.trustScoreThreshold;
      
      // Get existing feedback for this word or initialize new
      if (!this.feedbackData.wordFeedback.has(normalizedWord)) {
        this.feedbackData.wordFeedback.set(normalizedWord, {
          correctVotes: 0,
          incorrectVotes: 0,
          users: new Set(),
          lastUpdated: Date.now()
        });
      }
      
      const wordData = this.feedbackData.wordFeedback.get(normalizedWord);
      wordData.lastUpdated = Date.now();
      
      // Only count one vote per user per word
      if (!wordData.users.has(userId)) {
        wordData.users.add(userId);
        
        // Apply trust multiplier for trusted users
        const voteWeight = isTrusted ? this.config.trustedUserMultiplier : 1;
        
        if (isCorrect) {
          wordData.correctVotes += voteWeight;
          
          // Add suggestion to user feedback system for review
          await feedbackManager.addWordSuggestion(normalizedWord, 'no', {
            userId,
            context: '',
            notes: `Suggested via spell checker feedback. Trust score: ${trustScore}`
          });
          
          // Immediately add to custom words if user marks as correct and is trusted
          let addedToCustomWords = false;
          if (isTrusted && !this.feedbackData.customWords.has(normalizedWord)) {
            addedToCustomWords = await this.addToCustomWords(normalizedWord);
          }
          
          return {
            success: true,
            word: normalizedWord,
            addedToCustomWords,
            isTrusted,
            trustScore,
            feedbackStats: {
              correctVotes: wordData.correctVotes,
              incorrectVotes: wordData.incorrectVotes,
              totalUsers: wordData.users.size
            }
          };
        } else {
          wordData.incorrectVotes += voteWeight;
        }
      }
      
      // For incorrect feedback, check if we should remove from custom words
      if (!isCorrect && this.feedbackData.customWords.has(normalizedWord)) {
        // Remove from custom words if incorrect votes exceed correct votes
        if (wordData.incorrectVotes > wordData.correctVotes) {
          await customWords.removeCustomWord(normalizedWord);
          this.feedbackData.customWords.delete(normalizedWord);
          console.log(`Removed "${normalizedWord}" from custom words due to negative feedback`);
        }
      }
      
      return {
        success: true,
        word: normalizedWord,
        addedToCustomWords: false,
        isTrusted,
        trustScore,
        feedbackStats: {
          correctVotes: wordData.correctVotes,
          incorrectVotes: wordData.incorrectVotes,
          totalUsers: wordData.users.size
        }
      };
    } catch (error) {
      console.error('Error processing spell check feedback:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Check if a word has reached the threshold to be added to custom words
   * @param {string} word - The word to check
   * @returns {boolean} - Whether the word should be added
   */
  shouldAddToCustomWords(word) {
    // If already in custom words, no need to add again
    if (this.feedbackData.customWords.has(word)) {
      return false;
    }
    
    const wordData = this.feedbackData.wordFeedback.get(word);
    if (!wordData) {
      return false;
    }
    
    // The word should be added if it has enough correct votes
    // and the ratio of correct to incorrect is strongly positive
    return (
      wordData.correctVotes >= this.config.autoLearnThreshold &&
      wordData.correctVotes > wordData.incorrectVotes * 2 // At least 2:1 ratio
    );
  }
  
  /**
   * Add a word to the custom words in Redis
   * @param {string} word - The word to add
   * @returns {Promise<boolean>} - Whether the operation was successful
   */
  async addToCustomWords(word) {
    try {
      await customWords.addCustomWord(word);
      this.feedbackData.customWords.add(word);
      console.log(`Added "${word}" to custom words dictionary`);
      return true;
    } catch (error) {
      console.error(`Error adding "${word}" to custom words:`, error);
      return false;
    }
  }
  
  /**
   * Check if a word is in the custom words dictionary
   * @param {string} word - The word to check
   * @returns {boolean} - Whether the word is in the custom dictionary
   */
  isCustomWord(word) {
    if (!word) return false;
    return this.feedbackData.customWords.has(word.toLowerCase().trim());
  }
  
  /**
   * Get the trust score for a user
   * @param {string} userId - The user ID
   * @returns {number} - The user's trust score
   */
  getTrustScore(userId) {
    if (!userId) return 0;
    return this.feedbackData.trustScores.get(userId) || 0;
  }
  
  /**
   * Update a user's trust score based on their feedback
   * @param {string} userId - The user ID
   * @param {string} action - The type of feedback (correct/incorrect)
   */
  updateTrustScore(userId, action) {
    if (!userId) return;
    
    const currentScore = this.feedbackData.trustScores.get(userId) || 0;
    // Giving correct feedback (accepting system's suggestion) increases trust more
    // than marking words as incorrect (which could be subjective)
    const adjustment = action === 'correct' ? 1 : 0.5;
    
    this.feedbackData.trustScores.set(userId, currentScore + adjustment);
  }
  
  /**
   * Get the current feedback status for a word
   * @param {string} word - The word to check
   * @returns {Object} - The feedback data for the word
   */
  getWordFeedbackStatus(word) {
    if (!word) return null;
    const normalizedWord = word.toLowerCase().trim();
    
    const isCustomWord = this.isCustomWord(normalizedWord);
    const feedbackData = this.feedbackData.wordFeedback.get(normalizedWord);
    
    return {
      word: normalizedWord,
      isCustomWord,
      feedback: feedbackData || { correctVotes: 0, incorrectVotes: 0, users: new Set() },
      shouldAccept: isCustomWord || (feedbackData && this.shouldAddToCustomWords(normalizedWord))
    };
  }
  
  /**
   * Clean up resources used by the feedback system
   */
  close() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
  
  /**
   * Get pending word suggestions for admin review
   * @param {string} lang Optional language filter
   * @returns {Promise<Array>} List of pending word suggestions
   */
  async getPendingWordSuggestions(lang = null) {
    try {
      return await feedbackManager.getPendingWordSuggestions(lang);
    } catch (error) {
      console.error('Error getting pending word suggestions:', error);
      throw error;
    }
  }
  
  /**
   * Approve a pending word suggestion
   * @param {string} word Word to approve
   * @param {string} lang Language code
   * @param {string} approvedBy ID or name of approver
   * @returns {Promise<Object>} Result of the operation
   */
  async approveWordSuggestion(word, lang = 'no', approvedBy = 'admin') {
    try {
      const result = await feedbackManager.approveWordSuggestion(word, lang, approvedBy);
      if (result.success) {
        // Update local cache
        this.feedbackData.customWords.add(word.toLowerCase().trim());
      }
      return result;
    } catch (error) {
      console.error(`Error approving word suggestion '${word}':`, error);
      throw error;
    }
  }
  
  /**
   * Reject a pending word suggestion
   * @param {string} word Word to reject
   * @param {string} lang Language code
   * @param {string} rejectedBy ID or name of rejector
   * @param {string} reason Reason for rejection
   * @returns {Promise<Object>} Result of the operation
   */
  async rejectWordSuggestion(word, lang = 'no', rejectedBy = 'admin', reason = '') {
    try {
      return await feedbackManager.rejectWordSuggestion(word, lang, rejectedBy, reason);
    } catch (error) {
      console.error(`Error rejecting word suggestion '${word}':`, error);
      throw error;
    }
  }
  
  /**
   * Get statistics about word suggestions
   * @returns {Promise<Object>} Statistics about word suggestions
   */
  async getWordSuggestionStats() {
    try {
      return await feedbackManager.getWordSuggestionStats();
    } catch (error) {
      console.error('Error getting word suggestion statistics:', error);
      throw error;
    }
  }
}

module.exports = SpellCheckerFeedbackSystem;