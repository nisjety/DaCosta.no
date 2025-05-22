// src/interfaces/TokenizerInterface.js

/**
 * Interface for tokenizer implementations
 * Defines the contract that all tokenizer adapters must implement
 */
class TokenizerInterface {
  /**
   * Tokenize text into an array of tokens
   * @param {string} text - The text to tokenize
   * @returns {Array<{text: string, type: string, start: number, end: number}>} - Array of tokens with position info
   */
  tokenize(text) {
    throw new Error('Method tokenize() must be implemented by subclass');
  }
  
  /**
   * Split text into sentences
   * @param {string} text - The text to split
   * @returns {Array<{text: string, start: number, end: number}>} - Array of sentences with position info
   */
  splitSentences(text) {
    throw new Error('Method splitSentences() must be implemented by subclass');
  }
  
  /**
   * Extract keywords from text
   * @param {string} text - The text to analyze
   * @param {Object} options - Options for keyword extraction
   * @returns {Array<string>} - Array of keywords
   */
  extractKeywords(text, options = {}) {
    throw new Error('Method extractKeywords() must be implemented by subclass');
  }
}

// Export the class directly instead of as a property of an object
module.exports = TokenizerInterface;
