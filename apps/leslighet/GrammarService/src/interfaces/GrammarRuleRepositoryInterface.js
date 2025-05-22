// src/grammar/interfaces/GrammarRuleRepositoryInterface.js
/**
 * @interface
 * Interface for grammar rule repositories.
 */
class GrammarRuleRepositoryInterface {
  constructor() {
    if (new.target === GrammarRuleRepositoryInterface) {
      throw new Error('Cannot instantiate interface directly');
    }
  }

  /**
   * Retrieves words for a specific grammar category.
   * @param {string} category - Grammar category.
   * @returns {Promise<Set<string>>} Set of words in the category.
   */
  async getCategory(category) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Checks if a word belongs to a grammar category.
   * @param {string} word - Word to check.
   * @param {string} category - Grammar category.
   * @returns {Promise<boolean>} Whether the word belongs to the category.
   */
  async isInCategory(word, category) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Retrieves a regular expression pattern for a specific rule.
   * @param {string} patternName - Pattern name.
   * @returns {RegExp} Regular expression pattern.
   */
  getPattern(patternName) {
    throw new Error('Method not implemented');
  }
}

module.exports = { GrammarRuleRepositoryInterface };
