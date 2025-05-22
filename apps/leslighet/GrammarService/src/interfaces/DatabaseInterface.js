// src/grammar/interfaces/DatabaseInterface.js
/**
 * @interface
 * Interface for database access.
 */
class DatabaseInterface {
  /**
   * Asynchronously initializes the database.
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('Method not implemented');
  }
  
  /**
   * Asynchronously looks up a word in the database.
   * @param {string} word - Word to look up.
   * @param {string} type - Type of lookup (dictionary, gender, etc.).
   * @returns {Promise<Object|null>} Word information or null.
   */
  async lookup(word, type = 'dictionary') {
    throw new Error('Method not implemented');
  }
  
  /**
   * Asynchronously checks if a word has feminine gender.
   * @param {string} word - Word to check.
   * @returns {Promise<boolean>} Whether the word is feminine.
   */
  async isFeminine(word) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Asynchronously checks for a compound word alternative.
   * @param {string} words - Space-separated words.
   * @returns {Promise<string|null>} Compound suggestion or null.
   */
  async checkCompound(words) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Asynchronously retrieves database statistics.
   * @returns {Promise<Object>} Database statistics.
   */
  async getStats() {
    throw new Error('Method not implemented');
  }
  
  /**
   * Asynchronously stores feedback data.
   * @param {Object} feedback - Feedback data.
   * @returns {Promise<boolean>} Success indicator.
   */
  async storeFeedback(feedback) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Asynchronously closes the database.
   * @returns {Promise<void>}
   */
  async close() {
    throw new Error('Method not implemented');
  }
}

module.exports = DatabaseInterface;
