// src/grammar/adapters/OpenAIAdapter.js
const LanguageModelInterface = require('../interfaces/LanguageModelInterface');
const NLPServiceAdapter = require('./NLPServiceAdapter');

class OpenAIAdapter extends LanguageModelInterface {
  constructor(config = {}) {
    super();
    this.nlpService = new NLPServiceAdapter(config);
  }
  
  async createChatCompletion(options) {
    return this.nlpService.createChatCompletion(options);
  }
}

module.exports = OpenAIAdapter;
