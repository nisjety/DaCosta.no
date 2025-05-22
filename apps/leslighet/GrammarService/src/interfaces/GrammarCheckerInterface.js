// src/interfaces/GrammarCheckerInterface.js

/**
 * @interface
 * Interface for grammar checker implementations
 */
class GrammarCheckerInterface {
  /**
   * Constructor that prevents direct instantiation of this interface
   */
  constructor() {
    if (new.target === GrammarCheckerInterface) {
      throw new Error('Cannot instantiate interface directly');
    }
  }

  /**
   * Check text for grammar issues
   * @param {string} text - Text to check
   * @param {string} dialect - Norwegian dialect ('nb' or 'nn')
   * @param {Object} options - Check options
   * @returns {Promise<Array>} Array of issues found
   */
  async check(text, dialect, options = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Get recommended solutions for an issue
   * @param {Object} issue - Issue to get solutions for
   * @returns {Promise<Array>} Array of possible solutions
   */
  async getSolutions(issue) {
    // Default implementation returns the suggestion if available
    if (issue && issue.suggestion) {
      return [issue.suggestion];
    }
    return [];
  }

  /**
   * Get name of the checker
   * @returns {string} Name of the checker
   */
  getName() {
    return this.constructor.name;
  }

  /**
   * Check if this checker can handle a specific rule category
   * @param {string} category - Grammar rule category
   * @returns {boolean} Whether this checker handles the category
   */
  canHandle(category) {
    return false; // Default implementation handles no categories
  }
}

module.exports = {
  GrammarCheckerInterface
};
