const DefiniteFormChecker = require('../../src/checkers/DefiniteFormChecker');
const GrammarRuleRepository = require('../../src/repositories/GrammarRuleRepository');
const SimpleTokenizer = require('../../src/adapters/SimpleTokenizerAdapter');
const RedisDictionary = require('../../src/dictionaries/RedisDictionary');
const Redis = require('ioredis');
const { getRedisClient, cleanupRedis } = require('../helpers/redis-helper');

jest.setTimeout(30000);

describe("DefiniteFormChecker Integration Tests", () => {
  let redis;
  let ruleRepository;
  let dictionary;
  let checker;

  beforeAll(async () => {
    redis = new Redis();
    
    // Clean up any existing data using the imported cleanupRedis helper
    await cleanupRedis(["possessives", "indefiniteArticles", "norsk:fullforms"]);
    
    // Seed test data with proper grammatical information
    await redis
      .multi()
      // Add test words with their forms
      .sadd("norsk:fullforms", "bil:masc:noun:sg:indef", "bilen:masc:noun:sg:def")
      .sadd("norsk:fullforms", "hus:neut:noun:sg:indef", "huset:neut:noun:sg:def")
      .sadd("norsk:fullforms", "jente:fem:noun:sg:indef", "jenta:fem:noun:sg:def")
      // Add possessives and articles with their properties
      .sadd("norsk:stopwords:possessives", "min:masc:sg", "mitt:neut:sg", "mi:fem:sg")
      .sadd("norsk:stopwords:indefiniteArticles", "en:masc", "et:neut", "ei:fem")
      .exec();
    
    // Initialize repository and dictionary with Redis instance
    ruleRepository = new GrammarRuleRepository(redis);
    await ruleRepository.initialize();
    
    dictionary = new RedisDictionary(redis);
    checker = new DefiniteFormChecker(ruleRepository, dictionary);
  });

  afterAll(async () => {
    // First cleanup the data using the imported cleanupRedis helper
    await cleanupRedis(["possessives", "indefiniteArticles", "norsk:fullforms"]);
    
    // Then cleanup the services in reverse order of initialization
    await checker.cleanup?.();
    await dictionary.cleanup();
    await ruleRepository.cleanup();
    
    // Finally close the Redis connection
    await redis.quit();
  });

  describe('Possessive‐Triggered Errors', () => {
    it('flags "min bilen" → "min bil"', async () => {
      const text   = 'min bilen';
      const tokens = [
        { form:'min',   position:0, upos:'DET'  },
        { form:'bilen', position:4, lemma:'bil', upos:'NOUN' }
      ];

      const issues = await checker.check(text, 'nb', { tokens });
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        type:       'definite_form_error',
        position:   4,
        issue:      'min bilen',
        suggestion: 'min bil',
        severity:   'medium'
      });
    });

    it('accepts "min bil"', async () => {
      const text   = 'min bil';
      const tokens = [
        { form:'min', position:0, upos:'DET' },
        { form:'bil', position:4, upos:'NOUN' }
      ];

      const issues = await checker.check(text, 'nb', { tokens });
      expect(issues).toHaveLength(0);
    });
  });

  describe('Indefinite-Article Errors', () => {
    it('flags "en bilen" → "en bil"', async () => {
      const text   = 'en bilen';
      const tokens = [
        { form:'en',   position:0, upos:'DET'  },
        { form:'bilen',position:3, lemma:'bil', upos:'NOUN' }
      ];

      const issues = await checker.check(text, 'nb', { tokens });
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        type:       'definite_form_error',
        position:   3,
        issue:      'en bilen',
        suggestion: 'en bil',
        severity:   'medium'
      });
    });

    it('accepts "en bil"', async () => {
      const text   = 'en bil';
      const tokens = [
        { form:'en', position:0, upos:'DET' },
        { form:'bil',position:3, upos:'NOUN' }
      ];

      const issues = await checker.check(text, 'nb', { tokens });
      expect(issues).toHaveLength(0);
    });
  });

  describe('Gender-Specific Definite Errors', () => {
    it('feminine: "min jenta" → "min jente"', async () => {
      const text   = 'min jenta';
      const tokens = [
        { form:'min',  position:0, upos:'DET'    },
        { form:'jenta',position:4, lemma:'jente', upos:'NOUN' }
      ];

      const issues = await checker.check(text, 'nb', { tokens });
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        type:        'definite_form_error',
        position:    4,
        issue:       'min jenta',
        suggestion:  'min jente',
        severity:    'medium'
      });
    });

    it('neuter: "et huset" → "et hus"', async () => {
      const text   = 'et huset';
      const tokens = [
        { form:'et',    position:0, upos:'DET'   },
        { form:'huset', position:3, lemma:'hus', upos:'NOUN' }
      ];

      const issues = await checker.check(text, 'nb', { tokens });
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        type:        'definite_form_error',
        position:    3,
        issue:       'et huset',
        suggestion:  'et hus',
        severity:    'medium'
      });
    });
  });

  describe('Edge Cases', () => {
    it('returns [] for null or empty text', async () => {
      expect(await checker.check(null, 'nb', { tokens: [] })).toHaveLength(0);
      expect(await checker.check('',   'nb', { tokens: [] })).toHaveLength(0);
    });

    it('returns [] if no tokens provided', async () => {
      expect(await checker.check('hei på deg', 'nb', {})).toHaveLength(0);
    });

    it('does not crash on tokens missing fields', async () => {
      const text   = 'min bilen';
      const tokens = [{ form:'min' }, { form:'bilen' }];
      expect(await checker.check(text, 'nb', { tokens })).toHaveLength(0);
    });
  });
});
