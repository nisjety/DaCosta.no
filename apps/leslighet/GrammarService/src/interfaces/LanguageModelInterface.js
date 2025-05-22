// src/grammar/interfaces/LanguageModelInterface.js
/**
 * @interface
 * Defines contract for language model services.
 */
class LanguageModelInterface {
  /**
   * Asynchronously creates a chat completion.
   * @param {Object} options - Chat completion options.
   * @returns {Promise<Object>} Completion response.
   */
  async createChatCompletion(options) {
    throw new Error('Method not implemented');
  }
}

module.exports = LanguageModelInterface;
