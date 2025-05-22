// src/grammar/adapters/FeedbackSystemAdapter.js
const FeedbackInterface = require('../interfaces/FeedbackInterface');
const UserFeedbackSystem = require('../services/UserFeedbackSystem');

class FeedbackSystemAdapter extends FeedbackInterface {
  constructor(options = {}) {
    super();
    this.feedbackSystem = new UserFeedbackSystem(options);
  }
  
  async processFeedback(issueId, accepted, suggestion, userId) {
    const feedback = {
      userId,
      action: accepted ? 'accept' : 'reject',
      modification: suggestion
    };
    return this.feedbackSystem.addFeedback(issueId, feedback);
  }
  
  enhanceGrammarResults(issues) {
    return this.feedbackSystem.enhanceGrammarResults(issues);
  }
  
  applyFeedback(issues) {
    return this.feedbackSystem.enhanceGrammarResults(issues);
  }
}

module.exports = FeedbackSystemAdapter;
