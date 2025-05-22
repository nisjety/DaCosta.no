// src/grammar/interfaces/FeedbackInterface.js
/**
 * @interface
 * Defines contract for feedback services.
 */
class FeedbackInterface {
  /**
   * Asynchronously processes feedback on a grammar issue.
   * @param {string} issueId - Issue identifier.
   * @param {boolean} accepted - Whether the suggestion was accepted.
   * @param {string} suggestion - User's suggestion.
   * @param {string} userId - User identifier.
   * @returns {Promise<Object>} Status of feedback submission.
   */
  async processFeedback(issueId, accepted, suggestion, userId) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Synchronously enhances grammar results with user feedback.
   * @param {Array} issues - Grammar issues.
   * @returns {Array} Enhanced issues.
   */
  enhanceGrammarResults(issues) {
    throw new Error('Method not implemented');
  }
}

module.exports = FeedbackInterface;
