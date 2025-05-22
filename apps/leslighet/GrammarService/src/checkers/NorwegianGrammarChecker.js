/**
 * Norwegian Grammar Checker
 * 
 * This module implements the GrammarCheckerInterface for checking
 * Norwegian grammar-specific issues.
 */

'use strict';

const CompositeGrammarChecker = require('./CompositeGrammarChecker');
const ArticleUsageChecker = require('./ArticleUsageChecker');
const CompoundWordChecker = require('./CompoundWordChecker');
const NounDeclensionChecker = require('./NounDeclensionChecker');
const DefiniteFormChecker = require('./DefiniteFormChecker');

/**
 * Specializes in checking Norwegian grammar rules
 */
class NorwegianGrammarChecker extends CompositeGrammarChecker {
  /**
   * @param {Object} options - Configuration options
   * @param {Object} dependencies - Required dependencies
   * @param {import('../adapters/NorwegianDictionaryAdapter')} dependencies.norwegianDictionary - Norwegian dictionary adapter
   */
  constructor(options = {}, dependencies = {}) {
    super(options);
    
    if (!dependencies.norwegianDictionary) {
      throw new Error('NorwegianGrammarChecker requires norwegianDictionary dependency');
    }
    
    // Add Norwegian-specific grammar checkers
    this.addChecker(
      new ArticleUsageChecker({ language: 'no' }, { 
        norwegianDictionary: dependencies.norwegianDictionary 
      })
    );
    
    this.addChecker(
      new CompoundWordChecker({
        language: 'no',
        minConfidence: 0.7,
        compoundConfidenceBoost: 0.2
      }, {
        norwegianDictionary: dependencies.norwegianDictionary
      })
    );
    
    this.addChecker(
      new NounDeclensionChecker({ language: 'no' }, {
        norwegianDictionary: dependencies.norwegianDictionary
      })
    );
    
    // Add our new definite form checker
    this.addChecker(
      new DefiniteFormChecker({
        confidenceThreshold: 0.8,
        checkNestedPrepositions: true
      }, {
        norwegianDictionary: dependencies.norwegianDictionary
      })
    );
  }
}

module.exports = NorwegianGrammarChecker;