// src/grammar/di/Container.js
const path = require('path');
const NorwegianDictionaryAdapter = require('../adapters/NorwegianDictionaryAdapter');
const DefiniteFormChecker = require('../checkers/DefiniteFormChecker');
const CompoundWordChecker = require('../checkers/CompoundWordChecker');
const NounDeclensionChecker = require('../checkers/NounDeclensionChecker');
const ArticleUsageChecker = require('../checkers/ArticleUsageChecker');
const NorwegianGrammarChecker = require('../checkers/NorwegianGrammarChecker');
const GrammarAnalyzer = require('../analyzers/GrammarAnalyzer');
const UDTreebankAdapter = require('../adapters/UDTreebankAdapter');
const RobustTokenizerAdapter = require('../adapters/RobustTokenizerAdapter');

/**
 * Enhanced dependency injection container with async support.
 */
class Container {
  constructor() {
    this.services = new Map();
    this.factories = new Map();
  }
  
  /**
   * Register a service instance.
   * @param {string} name - Service name.
   * @param {*} instance - Service instance.
   */
  register(name, instance) {
    this.services.set(name, instance);
  }
  
  /**
   * Register a factory function that may be async.
   * @param {string} name - Service name.
   * @param {Function} factory - Factory function that receives the container.
   */
  registerFactory(name, factory) {
    this.factories.set(name, factory);
  }
  
  /**
   * Asynchronously retrieve a service.
   * If the service instance is not already created, it uses the factory.
   * @param {string} name - Service name.
   * @returns {Promise<*>} Service instance.
   */
  async get(name) {
    if (this.services.has(name)) {
      const instance = this.services.get(name);
      return instance instanceof Promise ? await instance : instance;
    }
    
    if (this.factories.has(name)) {
      const factory = this.factories.get(name);
      const instance = await factory(this);
      this.services.set(name, instance);
      return instance;
    }
    
    throw new Error(`Service '${name}' not found`);
  }
  
  /**
   * Check if a service or factory is registered.
   * @param {string} name - Service name.
   * @returns {boolean} Whether the service exists.
   */
  has(name) {
    return this.services.has(name) || this.factories.has(name);
  }
  
  /**
   * Remove a registered service.
   * @param {string} name - Service name.
   */
  remove(name) {
    this.services.delete(name);
    this.factories.delete(name);
  }
  
  /**
   * Clear all registered services and factories.
   */
  clear() {
    this.services.clear();
    this.factories.clear();
  }

  /**
   * Register all default services
   * @returns {Promise<void>}
   */
  async registerDefaults() {
    // Register adapters
    this.registerFactory('norwegianDictionary', async (container) => {
      const redisClient = container.has('redisClient') ? await container.get('redisClient') : null;
      
      return new NorwegianDictionaryAdapter({
        dataPath: path.resolve(process.cwd(), 'data/norsk_ordbank'),
        useRedis: !!redisClient,
        redisClient,
        loadCompoundData: true,
        cacheEnabled: true
      });
    });
    
    // Register UD Treebank adapter for syntactic analysis
    this.registerFactory('udTreebank', async () => {
      return new UDTreebankAdapter({
        dataPath: path.resolve(process.cwd(), 'data/no_bokmaal-ud-train.json'),
        cacheEnabled: true
      });
    });
    
    // Register tokenizer
    this.registerFactory('tokenizer', async () => {
      return new RobustTokenizerAdapter({
        language: 'nb-NO' // Norwegian Bokmål
      });
    });
    
    // Register grammar checkers
    this.registerFactory('definiteFormChecker', async (container) => {
      const norwegianDictionary = await container.get('norwegianDictionary');
      
      return new DefiniteFormChecker({
        confidenceThreshold: 0.75
      }, {
        norwegianDictionary
      });
    });
    
    this.registerFactory('compoundWordChecker', async (container) => {
      const norwegianDictionary = await container.get('norwegianDictionary');
      
      return new CompoundWordChecker({
        confidenceThreshold: 0.8,
        maxCompoundParts: 4
      }, {
        norwegianDictionary
      });
    });
    
    this.registerFactory('nounDeclensionChecker', async (container) => {
      const norwegianDictionary = await container.get('norwegianDictionary');
      
      return new NounDeclensionChecker({
        confidenceThreshold: 0.8
      }, {
        norwegianDictionary
      });
    });
    
    this.registerFactory('articleUsageChecker', async (container) => {
      const norwegianDictionary = await container.get('norwegianDictionary');
      const udTreebank = await container.get('udTreebank');
      
      return new ArticleUsageChecker({
        confidenceThreshold: 0.7
      }, {
        norwegianDictionary,
        udTreebank
      });
    });
    
    // Register composite grammar checker that combines all individual checkers
    this.registerFactory('norwegianGrammarChecker', async (container) => {
      const definiteFormChecker = await container.get('definiteFormChecker');
      const compoundWordChecker = await container.get('compoundWordChecker');
      const nounDeclensionChecker = await container.get('nounDeclensionChecker');
      const articleUsageChecker = await container.get('articleUsageChecker');
      const tokenizer = await container.get('tokenizer');
      
      return new NorwegianGrammarChecker({
        checkers: [
          definiteFormChecker,
          compoundWordChecker,
          nounDeclensionChecker,
          articleUsageChecker
        ],
        tokenizer
      });
    });
    
    // Register grammar analyzer
    this.registerFactory('grammarAnalyzer', async (container) => {
      const norwegianGrammarChecker = await container.get('norwegianGrammarChecker');
      const norwegianDictionary = await container.get('norwegianDictionary');
      
      return new GrammarAnalyzer({
        grammarChecker: norwegianGrammarChecker,
        dictionary: norwegianDictionary
      });
    });
  }
}

module.exports = Container;
