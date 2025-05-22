class DictionaryInterface {
  /**
   * Look up a word in the dictionary.
   * @param {string} word - Word to look up.
   * @returns {Promise<Object|null>} Word data or null if not found.
   */
  async lookup(word) {
    throw new Error('Not implemented');
  }

  /**
   * Clean up resources.
   */
  async cleanup() {
    throw new Error('Not implemented');
  }
}

module.exports = { DictionaryInterface }; 