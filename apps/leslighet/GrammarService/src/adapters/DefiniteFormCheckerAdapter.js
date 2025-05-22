// src/grammar/adapters/DefiniteFormCheckerAdapter.js
const GrammarCheckerInterface = require('../interfaces/GrammarCheckerInterface');

class DefiniteFormCheckerAdapter extends GrammarCheckerInterface {
  /**
   * @param {Object} originalChecker - Original definite form checker
   */
  constructor(originalChecker) {
    super();
    this.checker = originalChecker;
  }
  
  async check(text, dialect, options = {}) {
    return this.checker.check(text, dialect, options);
  }
}

module.exports = DefiniteFormCheckerAdapter;
