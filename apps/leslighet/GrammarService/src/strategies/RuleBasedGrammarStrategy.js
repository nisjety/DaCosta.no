// src/grammar/strategies/RuleBasedGrammarStrategy.js
const BaseGrammarStrategy = require('./BaseGrammarStrategy');

class RuleBasedGrammarStrategy extends BaseGrammarStrategy {
  /**
   * @param {Object} compositeChecker - Composite checker that aggregates multiple rule‑based checkers.
   * @param {Object} feedbackSystem - Feedback system.
   * @param {number} confidenceThreshold - Confidence threshold (e.g., 0.7).
   */
  constructor(compositeChecker, feedbackSystem, confidenceThreshold) {
    super(confidenceThreshold);
    this.compositeChecker = compositeChecker;
    this.feedbackSystem = feedbackSystem;
  }
  
  /**
   * Analyze the text using the composite checker.
   * @param {string} text - Text to analyze.
   * @param {string} dialect - Norwegian dialect.
   * @param {Object} options - Options including pre-tokenized tokens.
   * @returns {Promise<Object>} Analysis results.
   */
  async analyze(text, dialect, options = {}) {
    const issues = await this.compositeChecker.check(text, dialect, options);
    // Optionally, you could add further processing or statistics here.
    return {
      issues,
      totalIssues: issues.length,
      analysisType: 'rule_based'
    };
  }
}

module.exports = RuleBasedGrammarStrategy;
