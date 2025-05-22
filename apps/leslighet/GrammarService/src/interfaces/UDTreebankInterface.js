/**
 * Interface for Universal Dependencies (UD) Treebank interactions.
 * Defines methods for checking grammatical gender.
 */
class UDTreebankInterface {
    /**
     * Initializes the treebank data (if necessary).
     * @returns {Promise<void>}
     */
    async initialize() {
      throw new Error("Method 'initialize()' must be implemented.");
    }
  
    /**
     * Checks if a given lemma is feminine.
     * @param {string} lemma - The lemma to check.
     * @returns {Promise<boolean>} - Returns true if feminine, otherwise false.
     */
    async isFeminine(lemma) {
      throw new Error("Method 'isFeminine(lemma)' must be implemented.");
    }
  
    /**
     * Checks if the treebank has been initialized.
     * @returns {boolean} - True if initialized, otherwise false.
     */
    isInitialized() {
      throw new Error("Method 'isInitialized()' must be implemented.");
    }
  }
  
  module.exports = UDTreebankInterface;
  