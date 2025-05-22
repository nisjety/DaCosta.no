// src/grammar/providers/GrammarServiceProvider.js
const GrammarRuleRepository = require('../repositories/GrammarRuleRepository');
const BasicTokenizerAdapter = require('../adapters/BasicTokenizerAdapter');
const RobustTokenizerAdapter = require('../adapters/RobustTokenizerAdapter');
const DefiniteFormChecker = require('../checkers/DefiniteFormChecker');
const WordOrderChecker = require('../checkers/WordOrderChecker');
const PassiveVoiceChecker = require('../checkers/PassiveVoiceChecker');
const StyleFormalityChecker = require('../checkers/StyleFormalityChecker');
const CompositeGrammarChecker = require('../checkers/CompositeGrammarChecker');
const RuleBasedGrammarStrategy = require('../strategies/RuleBasedGrammarStrategy');

class GrammarServiceProvider {
  /**
   * Register grammar services with the DI container.
   * @param {Container} container - DI container.
   */
  register(container) {
    // Register the Redis-backed grammar rule repository
    container.registerFactory('grammarRuleRepository', () => new GrammarRuleRepository());
    
    // Register tokenizers using our new adapters.
    container.registerFactory('basicTokenizer', (c) => {
      return new BasicTokenizerAdapter(c.get('grammarRuleRepository'));
    });
    
    container.registerFactory('robustTokenizer', () => new RobustTokenizerAdapter());
    
    // Register checkers using the new repository and dictionary (Redis-based).
    container.registerFactory('definiteFormChecker', (c) => {
      const Dictionary = c.get('dictionary');
      return new DefiniteFormChecker(c.get('grammarRuleRepository'), Dictionary);
    });
    
    container.registerFactory('wordOrderChecker', (c) => {
      return new WordOrderChecker(c.get('grammarRuleRepository'));
    });
    
    container.registerFactory('passiveVoiceChecker', (c) => {
      // If you have a fast database service, pass it; otherwise, pass null.
      return new PassiveVoiceChecker(
        c.get('grammarRuleRepository'),
        c.get('dictionary'),
        c.has('fastDbService') ? c.get('fastDbService') : null
      );
    });
    
    container.registerFactory('styleFormalityChecker', (c) => {
      return new StyleFormalityChecker(c.get('grammarRuleRepository'));
    });
    
    // Register composite checker that combines multiple checkers.
    container.registerFactory('compositeGrammarChecker', (c) => {
      return new CompositeGrammarChecker(
        [
          c.get('definiteFormChecker'),
          c.get('wordOrderChecker'),
          c.get('passiveVoiceChecker'),
          c.get('styleFormalityChecker')
        ],
        c.get('robustTokenizer')
      );
    });
    
    // Register a rule-based grammar strategy that uses our checkers.
    container.registerFactory('ruleBasedStrategy', (c) => {
      // Pass in the dictionary, udTreebank, feedback system, and a confidence threshold.
      return new RuleBasedGrammarStrategy(
        [ c.get('compositeGrammarChecker') ],
        c.get('feedbackSystem'),
        c.get('confidenceManager').manager.thresholds.medium || 0.7
      );
    });
  }
}

module.exports = GrammarServiceProvider;
