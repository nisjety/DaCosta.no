// src/interfaces/DictionaryInterface.js
/**
 * @interface
 * Interface for dictionary services that can look up word information.
 */
class DictionaryInterface {
  /**
   * Constructor that prevents direct instantiation of this interface.
   */
  constructor() {
    if (new.target === DictionaryInterface) {
      throw new Error('Cannot instantiate interface directly');
    }
  }

  /**
   * Look up a word in the dictionary.
   * @param {string} word - The word to look up.
   * @returns {Promise<Object|null>} Dictionary entry or null if not found.
   */
  async lookup(word) {
    throw new Error('Method not implemented');
  }

  /**
   * Check if a word exists in the dictionary.
   * @param {string} word - The word to check.
   * @returns {Promise<boolean>} True if word exists, false otherwise.
   */
  async exists(word) {
    throw new Error('Method not implemented');
  }

  /**
   * Get inflection forms of a word.
   * @param {string} word - The base word to get inflections for.
   * @returns {Promise<Array<string>|null>} Array of inflected forms or null if not found.
   */
  async getInflections(word) {
    throw new Error('Method not implemented');
  }

  /**
   * Get suggestions for a misspelled word.
   * @param {string} word - The misspelled word.
   * @param {number} [limit=5] - Maximum number of suggestions to return.
   * @returns {Promise<Array<string>>} Array of suggested corrections.
   */
  async getSuggestions(word, limit = 5) {
    throw new Error('Method not implemented');
  }

  /**
   * Clean up resources (like database connections).
   * @returns {Promise<void>}
   */
  async cleanup() {
    // Default implementation does nothing
  }
}

// Export the class directly instead of as a property of an object
module.exports = DictionaryInterface;
