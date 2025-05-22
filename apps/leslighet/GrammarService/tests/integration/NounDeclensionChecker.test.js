// grammar/tests/integration/NounDeclensionChecker.test.js
const NounDeclensionChecker = require('../../src/checkers/NounDeclensionChecker');
const DictionaryInterface = require('../../src/interfaces/DictionaryInterface');
const { getRedisClient, setupTestData, cleanupRedis } = require('../helpers/redis-helper');
const GrammarRuleRepository = require('../../src/repositories/GrammarRuleRepository');
const { cleanup } = require('../../src/helpers/GrammarRuleLoader');

jest.setTimeout(30000);

class RedisDictionary extends DictionaryInterface {
  constructor(redisClient) {
    super();
    this.redis = redisClient;
  }

  async lookup(word) {
    if (!word) return null;
    
    try {
      const data = await this.redis.hget('norsk:fullforms', word.toLowerCase());
      if (!data) {
        console.log(`No data found for word: ${word}`);
        return null;
      }

      // Parse the tab-separated data
      const [description, ...rest] = data.split('\t');

      // Only process if it's a noun (subst)
      if (!description.includes('subst')) {
        console.log(`Word ${word} is not a noun (${description})`);
        return null;
      }

      // Extract gender from description
      let gender = 'mask'; // default to masculine
      if (description.includes('fem')) {
        gender = 'fem';
      } else if (description.includes('nøyt')) {
        gender = 'nøyt';
      }

      return {
        entry: {
          description,
          gender,
          pos: 'noun'
        }
      };
    } catch (error) {
      console.error('Error looking up word:', error);
      return null;
    }
  }

  async cleanup() {
    // Redis client is managed by the test
  }
}

describe('NounDeclensionChecker Integration Tests', () => {
  let ruleRepository;
  let checker;
  let redis;
  let dictionary;

  beforeAll(async () => {
    // Get Redis client and setup data - setupTestData() already handles checking if data exists
    redis = await getRedisClient();
    await setupTestData();
    
    // Add specific test data if needed (won't overwrite existing entries)
    await redis.hset('norsk:fullforms', {
      'bil': 'subst mask appell ent ub\t100\t1\t1996.01.01\t4000\tnormert',
      'bilen': 'subst mask appell ent be\t100\t1\t1996.01.01\t4000\tnormert',
      'jente': 'subst fem appell ent ub\t100\t1\t1996.01.01\t4000\tnormert',
      'jenta': 'subst fem appell ent be\t100\t1\t1996.01.01\t4000\tnormert',
      'barn': 'subst nøyt appell ent ub\t100\t1\t1996.01.01\t4000\tnormert',
      'barnet': 'subst nøyt appell ent be\t100\t1\t1996.01.01\t4000\tnormert'
    });
    
    dictionary = new RedisDictionary(redis);
    ruleRepository = new GrammarRuleRepository(redis);
    await ruleRepository.initialize();
    checker = new NounDeclensionChecker(dictionary);
    
    console.log('Using real dictionary data from Redis');
  });

  afterAll(async () => {
    // Clean up connections but don't clear data as other tests may use it
    if (typeof ruleRepository.cleanup === 'function') {
      await ruleRepository.cleanup();
    }
    await cleanupRedis();
  });

  describe('Basic Noun Declension', () => {
    test('should accept correct singular indefinite form', async () => {
      const text = 'en bil';
      const tokens = [
        { form: 'en', upos: 'DET', position: 0 },
        { form: 'bil', upos: 'NOUN', lemma: 'bil', position: 3 }
      ];

      const issues = await checker.check(text, 'nb', { tokens });
      expect(issues).toHaveLength(0);
    });

    test('should accept correct singular definite form', async () => {
      const text = 'bilen';
      const tokens = [
        { form: 'bilen', upos: 'NOUN', lemma: 'bil', position: 0 }
      ];

      const issues = await checker.check(text, 'nb', { tokens });
      expect(issues).toHaveLength(0);
    });

    test('should detect invalid noun form', async () => {
      const text = 'bilet'; // Invalid form
      const tokens = [
        { form: 'bilet', upos: 'NOUN', lemma: 'bil', position: 0 }
      ];

      const issues = await checker.check(text, 'nb', { tokens });
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        type: 'noun_declension',
        issue: 'bilet',
        severity: 'low'
      });
    });
  });

  describe('Gender-specific Declension', () => {
    test('should handle feminine nouns correctly', async () => {
      const text = 'jenta';
      const tokens = [
        { form: 'jenta', upos: 'NOUN', lemma: 'jente', position: 0 }
      ];

      const issues = await checker.check(text, 'nb', { tokens });
      expect(issues).toHaveLength(0);
    });

    test('should detect invalid feminine noun form', async () => {
      const text = 'jentet'; // Invalid form
      const tokens = [
        { form: 'jentet', upos: 'NOUN', lemma: 'jente', position: 0 }
      ];

      const issues = await checker.check(text, 'nb', { tokens });
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        type: 'noun_declension',
        issue: 'jentet',
        severity: 'low'
      });
    });
  });

  describe('Neuter Noun Declension', () => {
    test('should handle neuter nouns correctly', async () => {
      const text = 'barnet';
      const tokens = [
        { form: 'barnet', upos: 'NOUN', lemma: 'barn', position: 0 }
      ];

      const issues = await checker.check(text, 'nb', { tokens });
      expect(issues).toHaveLength(0);
    });

    test('should detect invalid neuter noun form', async () => {
      const text = 'barnen'; // Invalid form
      const tokens = [
        { form: 'barnen', upos: 'NOUN', lemma: 'barn', position: 0 }
      ];

      const issues = await checker.check(text, 'nb', { tokens });
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        type: 'noun_declension',
        issue: 'barnen',
        severity: 'low'
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle null input', async () => {
      const issues = await checker.check(null, 'nb', { tokens: [] });
      expect(issues).toHaveLength(0);
    });

    test('should handle empty input', async () => {
      const issues = await checker.check('', 'nb', { tokens: [] });
      expect(issues).toHaveLength(0);
    });

    test('should handle missing tokens', async () => {
      const issues = await checker.check('some text', 'nb', {});
      expect(issues).toHaveLength(0);
    });

    test('should handle tokens with missing properties', async () => {
      const text = 'bil';
      const tokens = [
        { form: 'bil' } // missing upos and lemma
      ];

      const issues = await checker.check(text, 'nb', { tokens });
      expect(issues).toHaveLength(0);
    });

    test('should handle unknown words', async () => {
      const text = 'xyz';
      const tokens = [
        { form: 'xyz', upos: 'NOUN', lemma: 'xyz', position: 0 }
      ];

      const issues = await checker.check(text, 'nb', { tokens });
      expect(issues).toHaveLength(0); // Unknown words should not raise issues
    });
  });
});
