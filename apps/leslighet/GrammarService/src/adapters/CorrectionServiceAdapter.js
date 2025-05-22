// src/grammar/adapters/CorrectionServiceAdapter.js
const NLPServiceAdapter = require('./NLPServiceAdapter');

class CorrectionServiceAdapter {
  constructor(config = {}) {
    this.nlpService = new NLPServiceAdapter(config);
  }

  /**
   * Generates a correction for the provided text using the T5-based model in NLPService.
   * @param {string} text - The text to correct.
   * @returns {Promise<string>} - Corrected text.
   */
  async generateCorrection(text) {
    try {
      const result = await this.nlpService.generateCorrection(text);
      return result.correctedText || text;
    } catch (error) {
      console.error('Correction service error:', error);
      return text; // Return original text on error
    }
  }
}

module.exports = CorrectionServiceAdapter;
