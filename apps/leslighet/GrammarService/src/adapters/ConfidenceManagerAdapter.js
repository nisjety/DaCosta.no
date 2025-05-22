// src/grammar/adapters/ConfidenceManagerAdapter.js
const ConfidenceManagerInterface = require('../interfaces/ConfidenceManagerInterface');
const OriginalConfidenceManager = require('../services/ConfidenceManager');

class ConfidenceManagerAdapter extends ConfidenceManagerInterface {
  constructor(options = {}) {
    super();
    this.manager = new OriginalConfidenceManager(options);
  }
  
  calculateConfidence(issue, context = {}) {
    return this.manager.calculateConfidence(issue, context);
  }
  
  filterIssues(issues, options = {}) {
    return this.manager.filterIssues(issues, options);
  }
  
  filterIssuesByConfidence(issues, options = {}) {
    return this.manager.filterIssues(issues, options);
  }
  
  formatOutput(categorizedIssues, options = {}) {
    const result = [];
    if (categorizedIssues.show && Array.isArray(categorizedIssues.show)) {
      result.push(...categorizedIssues.show);
    }
    if (options.showOptionalSuggestions && categorizedIssues.suggest && Array.isArray(categorizedIssues.suggest)) {
      result.push(...categorizedIssues.suggest);
    }
    return result;
  }
}

module.exports = ConfidenceManagerAdapter;
