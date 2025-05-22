// src/grammar/adapters/SentimentAnalysisAdapter.js
const NLPServiceAdapter = require('./NLPServiceAdapter');

class SentimentAnalysisAdapter {
  constructor(config = {}) {
    this.nlpService = new NLPServiceAdapter(config);
  }

  /**
   * Asynchronously analyzes the sentiment of the given text.
   * @param {string} text - The text to analyze.
   * @returns {Promise<Object>} Sentiment analysis result.
   */
  async analyze(text) {
    try {
      return await this.nlpService.analyzeSentiment(text);
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      throw error;
    }
  }
}

module.exports = SentimentAnalysisAdapter;
