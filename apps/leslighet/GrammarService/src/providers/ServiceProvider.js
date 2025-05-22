// src/grammar/providers/ServiceProvider.js
const Container = require('../di/Container');
const GrammarServiceProvider = require('./GrammarServiceProvider');
const NorwegianDictionaryAdapter = require('../adapters/NorwegianDictionaryAdapter');
const UDTreebankAdapter = require('../adapters/UDTreebankAdapter');
const ConfidenceManagerAdapter = require('../adapters/ConfidenceManagerAdapter');
const LRUCacheAdapter = require('../adapters/LRUCacheAdapter');
const FeedbackSystemAdapter = require('../adapters/FeedbackSystemAdapter');

// Use only rule‑based strategy now.
const RuleBasedGrammarStrategy = require('../strategies/RuleBasedGrammarStrategy');
const GrammarAnalyzer = require('../analyzers/GrammarAnalyzer');

class ServiceProvider {
  /**
   * Register services with the DI container.
   * @param {Container} container - DI container.
   */
  register(container) {
    // Register dictionary, UD Treebank, and supporting services.
    container.registerFactory('dictionary', () => new NorwegianDictionaryAdapter());
    container.registerFactory('udTreebank', () => new UDTreebankAdapter());
    container.registerFactory('confidenceManager', () => new ConfidenceManagerAdapter({
      highThreshold: 0.85,
      mediumThreshold: 0.75,
      lowThreshold: 0.65,
      verifyThreshold: 0.60,
      hideThreshold: 0.50
    }));
    container.registerFactory('cache', () => new LRUCacheAdapter(200));
    container.registerFactory('feedbackSystem', () => new FeedbackSystemAdapter());

    // Register grammar services via the GrammarServiceProvider.
    const grammarServiceProvider = new GrammarServiceProvider();
    grammarServiceProvider.register(container);
    
    // Register only the rule‑based grammar strategy.
    container.registerFactory('ruleBasedStrategy', (c) => {
      return new RuleBasedGrammarStrategy(
        c.get('compositeGrammarChecker'),
        c.get('feedbackSystem'),
        // Use the medium threshold from the confidence manager (default 0.7)
        c.get('confidenceManager').manager.thresholds.medium || 0.7
      );
    });
    
    // Register the main grammar analyzer which now only uses the rule‑based strategy.
    container.registerFactory('grammarAnalyzer', (c) => {
      return new GrammarAnalyzer(
        c.get('ruleBasedStrategy'),
        c.get('cache'),
        c.get('feedbackSystem'),
        {
          highConfidenceThreshold: 0.85,
          mediumConfidenceThreshold: 0.7
        }
      );
    });
  }
  
  /**
   * Bootstrap asynchronous components.
   * @param {Container} container - DI container.
   * @returns {Promise<void>}
   */
  async bootstrap(container) {
    try {
      const udTreebank = await container.get('udTreebank');
      await udTreebank.initialize();
      
      const analyzer = await container.get('grammarAnalyzer');
      await analyzer.initialize();
      
      console.log('Services bootstrapped successfully');
    } catch (error) {
      console.error('Error bootstrapping services:', error);
    }
  }
}

module.exports = ServiceProvider;
