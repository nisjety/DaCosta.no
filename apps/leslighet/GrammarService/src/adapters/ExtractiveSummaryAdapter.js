// src/grammar/adapters/ExtractiveSummaryAdapter.js
const NLPServiceAdapter = require('./NLPServiceAdapter');

class ExtractiveSummaryAdapter {
  constructor(config = {}) {
    this.nlpService = new NLPServiceAdapter(config);
  }

  /**
   * Generate a summary of the given text
   * @param {string} text - Text to summarize
   * @returns {Promise<Object>} Summary object
   */
  async summarize(text) {
    try {
      return await this.nlpService.summarizeText(text);
    } catch (error) {
      console.error('Summary generation error:', error);
      throw error;
    }
  }
}

module.exports = ExtractiveSummaryAdapter;
