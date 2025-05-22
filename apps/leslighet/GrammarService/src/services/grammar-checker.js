// src/services/grammar-checker.js
/**
 * Main grammar checker service that orchestrates the various checkers
 */
class GrammarChecker {
  /**
   * @param {Object} repository - Grammar rule repository
   * @param {Object} dictionary - Dictionary instance
   * @param {Array} checkers - Array of checker instances
   */
  constructor(repository, dictionary, checkers = []) {
    this.repository = repository;
    this.dictionary = dictionary;
    this.checkers = checkers;
  }

  /**
   * Add a checker to the pipeline
   * @param {Object} checker - Checker instance
   */
  addChecker(checker) {
    if (checker && typeof checker.check === 'function') {
      this.checkers.push(checker);
    } else {
      console.warn('Invalid checker provided to GrammarChecker.addChecker');
    }
  }

  /**
   * Analyze text for grammar issues
   * @param {string} text - Text to analyze
   * @param {string} dialect - Norwegian dialect (nb or nn)
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} Array of issues found
   */
  async analyze(text, dialect = 'nb', options = {}) {
    if (!text) return [];
    
    try {
      let allIssues = [];
      
      for (const checker of this.checkers) {
        const issues = await checker.check(text, dialect, options);
        if (Array.isArray(issues) && issues.length > 0) {
          allIssues = allIssues.concat(issues);
        }
      }
      
      // Sort issues by position
      allIssues.sort((a, b) => {
        return (a.position || 0) - (b.position || 0);
      });
      
      return allIssues;
    } catch (error) {
      console.error('Error in GrammarChecker.analyze:', error);
      return [];
    }
  }

  /**
   * Get rules repository
   * @returns {Object} Repository instance 
   */
  getRepository() {
    return this.repository;
  }

  /**
   * Get dictionary
   * @returns {Object} Dictionary instance
   */
  getDictionary() {
    return this.dictionary;
  }
}

module.exports = { GrammarChecker };