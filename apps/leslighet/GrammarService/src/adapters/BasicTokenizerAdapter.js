// src/adapters/BasicTokenizerAdapter.js
const TokenizerInterface = require('../interfaces/TokenizerInterface');

class BasicTokenizerAdapter extends TokenizerInterface {
  /**
   * @param {GrammarRuleRepository} ruleRepository - Grammar rule repository (used for category checks)
   */
  constructor(ruleRepository) {
    super();
    this.ruleRepository = ruleRepository;
  }
  
  /**
   * Tokenize text using basic rules.
   * Now asynchronous to await Redis‑based POS inference.
   * @param {string} text - Text to tokenize.
   * @returns {Promise<Array>} Tokenized text.
   */
  async tokenize(text) {
    if (!text) return [];
    
    const tokens = [];
    let position = 0;
    const parts = text.split(/(\s+)/);
    
    for (let part of parts) {
      if (part.trim() === '') {
        position += part.length;
      } else {
        // Await asynchronous POS inference
        const pos = await inferPartOfSpeech(part);
        tokens.push({
          form: part,
          lemma: part.toLowerCase(),
          upos: pos,
          position: position
        });
        position += part.length;
      }
    }
    
    return tokens;
  }
}

module.exports = BasicTokenizerAdapter;
