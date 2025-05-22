const VerbConjugationChecker = require('../../src/checkers/VerbConjugationChecker');
const RedisDictionary = require('../../src/dictionaries/RedisDictionary');
const { getRedisClient, setupTestData, cleanupRedis } = require('../helpers/redis-helper');
const GrammarRuleRepository = require('../../src/repositories/GrammarRuleRepository');
const { cleanup } = require('../../src/helpers/GrammarRuleLoader');

// Simple whitespace tokenizer helper (not a mock of your checker logic)
class SimpleTokenizer {
  async tokenize(text) {
    const tokens = text.match(/\S+|\s+/g) || [];
    let position = 0;
    return tokens.map(form => {
      const lower = form.toLowerCase();
      const lemma = this.getLemma(lower);
      const upos  = this.inferPartOfSpeech(lower);
      const tok   = { form, position, lemma, upos };
      position   += form.length;
      return tok;
    });
  }

  getLemma(word) {
    const map = {
      er: 'være', var: 'være',
      spiser: 'spise', spiste: 'spise', spist: 'spise',
      møtes: 'møtes', kommer: 'komme', går: 'gå'
    };
    return map[word] || word;
  }

  inferPartOfSpeech(word) {
    if (['er','var','blir','ble','har','hadde','skal','vil'].includes(word)) return 'VERB';
    if (/^[.!?;:,]$/.test(word)) return 'PUNCT';
    return 'VERB';
  }
}

describe('VerbConjugationChecker Integration Tests', () => {
  let redis, dictionary, tokenizer, checker;

  beforeAll(async () => {
    // Get Redis client and setup data - setupTestData() already handles checking if data exists
    redis = await getRedisClient();
    await setupTestData();

    // Initialize real service instances
    dictionary = new RedisDictionary(redis);
    tokenizer = new SimpleTokenizer();
    checker = new VerbConjugationChecker(dictionary);
  }, 15000); // Increased timeout for data loading

  afterAll(async () => {
    // Clean up connections but don't clear data as other tests may use it
    if (dictionary) {
      await dictionary.cleanup();
    }
    await cleanupRedis();
  });

  // Helper to run checker
  async function checkText(text) {
    const tokens = await tokenizer.tokenize(text);
    return checker.check(text, 'bokmål', { tokens });
  }

  describe('Basic Verb Forms', () => {
    test('flags incorrect infinitive ("Jeg spise mat")', async () => {
      const issues = await checkText('Jeg spise mat');
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('verb_conjugation');
    });

    test('accepts correct present tense', async () => {
      const issues = await checkText('Jeg spiser mat');
      expect(issues).toHaveLength(0);
    });

    test('accepts imperative ("Kom hit!")', async () => {
      const issues = await checkText('Kom hit!');
      expect(issues).toHaveLength(0);
    });
  });

  describe('Complex Verb Forms', () => {
    test('accepts past tense ("Han spiste mat")', async () => {
      const issues = await checkText('Han spiste mat');
      expect(issues).toHaveLength(0);
    });

    test('accepts perfect participle ("Han har spist mat")', async () => {
      const issues = await checkText('Han har spist mat');
      expect(issues).toHaveLength(0);
    });

    test('accepts s-verbs ("De møtes i morgen")', async () => {
      const issues = await checkText('De møtes i morgen');
      expect(issues).toHaveLength(0);
    });
  });

  describe('Multiple Verbs', () => {
    test('handles multiple verbs in one sentence', async () => {
      const issues = await checkText('Han kommer og går som han vil');
      expect(issues).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    test('handles empty input', async () => {
      const issues = await checkText('');
      expect(issues).toHaveLength(0);
    });

    test('handles unknown verbs gracefully', async () => {
      const issues = await checkText('Han xyzabc maten');
      expect(Array.isArray(issues)).toBe(true);
    });
  });
});
