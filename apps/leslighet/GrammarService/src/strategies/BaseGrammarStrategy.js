// src/strategies/BaseGrammarStrategy.js
const GrammarStrategyInterface = require('../interfaces/GrammarStrategyInterface');
  
/**
 * Enhanced Grammar Strategy base class 
 */
class BaseGrammarStrategy extends GrammarStrategyInterface {
  constructor(confidenceThreshold = 0.75) {
    super();
    this.confidenceThreshold = confidenceThreshold;
  }
  
  /**
   * Finds common error types in issues
   * @param {Array} issues - Grammar issues
   * @returns {Object} Error type counts
   */
  static findCommonErrors(issues) {
    const errorTypes = {};
    
    if (Array.isArray(issues)) {
      for (const issue of issues) {
        if (!issue) continue;
        const type = issue.type || 'ukjent';
        errorTypes[type] = (errorTypes[type] || 0) + 1;
      }
    }
    
    return errorTypes;
  }
  
  /**
   * Filters out low confidence issues
   * @param {Array} issues - Grammar issues
   * @returns {Array} Filtered issues
   */
  filterLowConfidence(issues) {
    if (!Array.isArray(issues)) return [];
    
    return issues.filter(issue => 
      issue && (issue.confidenceScore || 0) >= this.confidenceThreshold
    );
  }
  
  // Each subclass must implement analyze()
}

module.exports = BaseGrammarStrategy;