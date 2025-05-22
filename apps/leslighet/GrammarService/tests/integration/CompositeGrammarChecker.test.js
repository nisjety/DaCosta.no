const CompositeGrammarChecker = require('../../src/checkers/CompositeGrammarChecker');
const GrammarRuleRepository = require('../../src/repositories/GrammarRuleRepository');
const DictionaryInterface = require('../../src/interfaces/DictionaryInterface');
const TokenizerInterface = require('../../src/interfaces/TokenizerInterface');
const { GrammarCheckerInterface } = require('../../src/interfaces/GrammarCheckerInterface');
const UDTreebankAdapter = require('../../src/adapters/UDTreebankAdapter');
const NorwegianDictionaryAdapter = require('../../src/adapters/NorwegianDictionaryAdapter');
const RobustTokenizerAdapter = require('../../src/adapters/RobustTokenizerAdapter');
const ArticleUsageChecker = require('../../src/checkers/ArticleUsageChecker');
const BasicGrammarChecker = require('../../src/checkers/BasicGrammarChecker');
const VerbConjugationChecker = require('../../src/checkers/VerbConjugationChecker');
const { getRedisClient, setupTestData, cleanupRedis } = require('../helpers/redis-helper');

// Increase Jest timeout for all tests
jest.setTimeout(30000);

// Redis-based dictionary implementation
class RedisDictionary extends DictionaryInterface {
  constructor(redisClient) {
    super();
    this.redis = redisClient;
  }

  async lookup(word) {
    try {
      if (!word) return null;
      const data = await this.redis.hget('norsk:fullforms', word.toLowerCase());
      
      if (!data) return null;

      const [description, ...rest] = data.split('\t');
      
      return {
        inflections: [{
          ordbokTekst: description
        }]
      };
    } catch (error) {
      console.error('Error looking up word:', error);
      return null;
    }
  }

  async getFrequentWords() {
    try {
      const words = await this.redis.hkeys('norsk:fullforms');
      return words.slice(0, 1000);
    } catch (error) {
      console.error('Error getting frequent words:', error);
      return [];
    }
  }

  async cleanup() {
    // Redis client is managed by the test
  }
}

// Simple tokenizer implementation
class SimpleTokenizer extends TokenizerInterface {
  async tokenize(text) {
    const tokens = text.split(/\s+/);
    let position = 0;
    
    return tokens.filter(form => form.length > 0).map(form => {
      const token = {
        form,
        position,
        startPosition: position,
        endPosition: position + form.length,
        lemma: form.toLowerCase(),
        upos: this.inferPartOfSpeech(form)
      };
      
      position += form.length + 1;
      return token;
    });
  }

  inferPartOfSpeech(token) {
    if (token.match(/^(en|ei|et)$/i)) return 'DET';
    if (token.match(/^[A-ZÆØÅ]/)) return 'PROPN';
    if (token.match(/[.,!?]/)) return 'PUNCT';
    return 'NOUN';
  }
}

// Feedback system implementation
class FeedbackSystem {
  applyFeedback(issues) {
    return issues.map(issue => ({
      ...issue,
      confidenceScore: this.getConfidenceScore(issue.type)
    }));
  }

  getConfidenceScore(type) {
    const scores = {
      'article_error': 0.95,
      'capitalization': 0.98,
      'punctuation': 0.92,
      'spacing': 0.99
    };
    return scores[type] || 0.90;
  }
}

describe('CompositeGrammarChecker Integration Tests', () => {
  // Longer timeout for these tests since they involve Redis data loading
  jest.setTimeout(120000);
  
  let redis;
  let dictionary;
  let tokenizer;
  let basicChecker;
  let verbChecker;
  let articleChecker;
  let compositeChecker;
  let ruleRepository;
  let feedbackSystem; // Added missing feedbackSystem declaration

  beforeAll(async () => {
    // Get Redis client and setup data - setupTestData() already handles checking if data exists
    redis = await getRedisClient();
    await setupTestData();
    
    console.log('Redis connection successful');
    
    // Setup treebank for more advanced POS tagging
    const udTreebank = new UDTreebankAdapter();
    await udTreebank.initialize();
    
    // Initialize dictionary with Redis connection
    dictionary = new NorwegianDictionaryAdapter(redis);
    await dictionary.initialize();
    
    // Create grammar rule repository
    ruleRepository = new GrammarRuleRepository(redis);
    await ruleRepository.initialize();
    
    // Initialize tokenizer
    tokenizer = new RobustTokenizerAdapter(udTreebank);
    
    // Create individual checkers
    basicChecker = new BasicGrammarChecker(dictionary, udTreebank);
    verbChecker = new VerbConjugationChecker(dictionary);
    articleChecker = new ArticleUsageChecker(dictionary, udTreebank);
    
    // Initialize feedback system
    feedbackSystem = new FeedbackSystem();
    
    // Create composite checker with all the individual checkers
    compositeChecker = new CompositeGrammarChecker(
      [basicChecker, verbChecker, articleChecker],
      tokenizer,
      feedbackSystem, // Now using the initialized feedback system
      { debug: true } // Enable debug logging
    );
  });
  
  afterAll(async () => {
    // Only try to call cleanup if ruleRepository was initialized
    if (ruleRepository && typeof ruleRepository.cleanup === 'function') {
      await ruleRepository.cleanup();
    }
    await cleanupRedis();
  });

  test('combines issues from multiple checkers', async () => {
    const text = 'en jente bor i norge.';
    const result = await compositeChecker.check(text, 'nob');
    
    expect(result.length).toBeGreaterThan(0);
    
    const articleError = result.find(issue => 
      issue.type === 'article_error' && 
      issue.issue.toLowerCase().includes('en jente')
    );
    expect(articleError).toBeTruthy();

    const countryCapError = result.find(issue => 
      issue.type === 'capitalization' && 
      issue.issue.toLowerCase() === 'norge'
    );
    expect(countryCapError).toBeTruthy();

    const sentenceCapError = result.find(issue => 
      issue.type === 'capitalization' && 
      issue.issue === 'en'
    );
    expect(sentenceCapError).toBeTruthy();
  });

  test('removes duplicate issues', async () => {
    const text = 'en jente og en gutt.';
    const result = await compositeChecker.check(text, 'nob');
    
    const articleErrors = result.filter(issue => 
      issue.type === 'article_error' && 
      issue.issue.toLowerCase().includes('en jente')
    );
    expect(articleErrors.length).toBe(1);
  });

  test('respects maxIssuesPerCategory limit', async () => {
    const text = 'en jente og en gutt og en bil og en bok.';
    compositeChecker.options.maxIssuesPerCategory = 2;
    const result = await compositeChecker.check(text, 'nob');
    
    const articleErrors = result.filter(issue => issue.type === 'article_error');
    expect(articleErrors.length).toBeLessThanOrEqual(2);
  });

  test('applies confidence threshold filtering', async () => {
    const text = 'dette er en test.';
    compositeChecker.options.confidenceThreshold = 0.9;
    const result = await compositeChecker.check(text, 'nob');
    
    expect(result.every(issue => 
      issue.confidenceScore && issue.confidenceScore >= 0.9
    )).toBe(true);
  });

  test('handles checker failures gracefully', async () => {
    const text = 'en jente og en gutt.';
    const failingChecker = {
      check: async () => { throw new Error('Checker failed'); }
    };
    
    // Create a new composite checker with the failing checker first
    compositeChecker = new CompositeGrammarChecker(
      [failingChecker, basicChecker],
      tokenizer,
      feedbackSystem,
      {
        removeDuplicates: true,
        prioritizeIssues: true,
        maxIssuesPerCategory: 3,
        confidenceThreshold: 0.5
      }
    );

    const result = await compositeChecker.check(text, 'nob');
    expect(Array.isArray(result)).toBe(true);
    // Should still get capitalization errors from basicChecker
    const capError = result.find(issue => issue.type === 'capitalization');
    expect(capError).toBeTruthy();
  });

  test('processes issues in correct order', async () => {
    const text = 'en jente bor i norge og en gutt bor i sverige.';
    const result = await compositeChecker.check(text, 'nob');
    
    // Issues should be sorted by position
    for (let i = 1; i < result.length; i++) {
      const prevPos = result[i-1].position || result[i-1].startPosition || 0;
      const currPos = result[i].position || result[i].startPosition || 0;
      expect(currPos).toBeGreaterThanOrEqual(prevPos);
    }
  });

  test('handles empty input gracefully', async () => {
    const result = await compositeChecker.check('', 'nob');
    expect(result).toHaveLength(0);
  });

  test('handles null input gracefully', async () => {
    const result = await compositeChecker.check(null, 'nob');
    expect(result).toHaveLength(0);
  });
});
