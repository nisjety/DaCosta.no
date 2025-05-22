/**
 * Grammar Service - Main service for grammar checking
 * This service coordinates grammar checking functionality by leveraging other specialized services
 */

// Import dependencies
const GptGrammarService = require('./GptGrammarService');
const grammarChecker = require('./grammar-checker');

class GrammarService {
  constructor() {
    this.gptService = new GptGrammarService();
    
    // Configurable settings
    this.useGpt = process.env.USE_GPT === 'true';
    this.debugMode = process.env.DEBUG_MODE === 'true';
  }
  
  /**
   * Check text for grammar issues
   * @param {string} text - Text to check
   * @param {object} options - Options for grammar checking
   * @returns {Promise<object>} Result with corrections and suggestions
   */
  async checkText(text, options = {}) {
    try {
      if (this.debugMode) {
        console.log(`GrammarService: Processing text (${text.length} chars) with options:`, options);
      }
      
      // Use different strategies based on configuration and text size
      if (this.useGpt && text.length < 5000) {
        // Use GPT for shorter texts when enabled
        return await this.gptService.processText(text, options);
      } else {
        // Use rule-based checker for longer texts or when GPT is disabled
        return await grammarChecker.checkText(text, options);
      }
    } catch (error) {
      console.error('Error in grammar service:', error);
      throw new Error(`Grammar check failed: ${error.message}`);
    }
  }
  
  /**
   * Get service status
   * @returns {object} Service status
   */
  getStatus() {
    return {
      ready: true,
      useGpt: this.useGpt,
      debugMode: this.debugMode
    };
  }
}

// Export singleton instance
module.exports = new GrammarService();