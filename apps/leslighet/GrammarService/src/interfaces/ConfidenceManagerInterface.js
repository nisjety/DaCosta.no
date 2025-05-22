// src/grammar/interfaces/ConfidenceManagerInterface.js
/**
 * @interface
 * Defines contract for confidence management.
 */
class ConfidenceManagerInterface {
  /**
   * Asynchronously calculates confidence score for a grammar issue.
   * @param {Object} issue - Grammar issue.
   * @param {Object} context - Context information.
   * @returns {Promise<number>} Confidence score.
   */
  async calculateConfidence(issue, context = {}) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Asynchronously filters issues based on confidence.
   * @param {Array} issues - Grammar issues.
   * @param {Object} options - Filtering options.
   * @returns {Promise<Object>} Categorized issues.
   */
  async filterIssues(issues, options = {}) {
    throw new Error('Method not implemented');
  }
}

module.exports = ConfidenceManagerInterface;
