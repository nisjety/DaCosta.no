// src/grammar/interfaces/GrammarStrategyInterface.js
/**
 * @interface
 * Defines contract for grammar analysis strategies.
 */
class GrammarStrategyInterface {
  /**
   * Asynchronously analyzes text for grammar issues.
   * @param {string} text - Text to analyze.
   * @param {string} dialect - Norwegian dialect.
   * @param {Object} options - Analysis options.
   * @returns {Promise<Object>} Analysis results.
   */
  async analyze(text, dialect, options = {}) {
    throw new Error('Method not implemented');
  }
}

module.exports = GrammarStrategyInterface;
