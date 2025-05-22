/**
 * Base interface for all grammar checkers.
 * Each checker should extend this class and implement the check method.
 */
class GrammarCheckerInterface {
  /**
   * Check a text for grammar issues.
   * @param {Array} tokens - Array of token objects with text and position info
   * @param {string} lang - Language code (e.g. 'nb' for Norwegian Bokmål)
   * @returns {Promise<Array>} Array of grammar issues found
   */
  async check(tokens, lang) {
    throw new Error('check() method must be implemented by subclass');
  }
}

module.exports = GrammarCheckerInterface; 