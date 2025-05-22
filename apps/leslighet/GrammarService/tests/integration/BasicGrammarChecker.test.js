const BasicGrammarChecker = require('../../src/checkers/BasicGrammarChecker');
const DictionaryInterface = require('../../src/interfaces/DictionaryInterface');
const TokenizerInterface = require('../../src/interfaces/TokenizerInterface');
const Redis = require('ioredis');
const GrammarRuleRepository = require('../../src/repositories/GrammarRuleRepository');
const { getRedisClient, cleanupRedis } = require('../helpers/redis-helper');

// Increase Jest timeout for all tests
jest.setTimeout(30000);

// Redis-based dictionary implementation
class RedisDictionary extends DictionaryInterface {
  constructor() {
    super();
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6380', 10), // Match Docker port
      maxRetriesPerRequest: 2,
      retryStrategy(times) {
        if (times > 3) {
          return null; // stop retrying
        }
        return Math.min(times * 200, 1000);
      }
    });

    // Handle Redis errors
    this.redis.on('error', (error) => {
      console.error('Redis error:', error);
    });
  }

  async lookup(word) {
    try {
      const data = await this.redis.hget('norsk:fullforms', word.toLowerCase());
      if (!data) return null;

      // Parse the TSV data
      const [description] = data.split('\t');
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
      // Get all words from Redis
      const words = await this.redis.hkeys('norsk:fullforms');
      // Return the first 1000 most common words (we can improve this later)
      return words.slice(0, 1000);
    } catch (error) {
      console.error('Error getting frequent words:', error);
      return [];
    }
  }

  async cleanup() {
    try {
      await this.redis.quit();
    } catch (error) {
      console.error('Error during Redis cleanup:', error);
    }
  }
}

// Simple tokenizer implementation
class SimpleTokenizer extends TokenizerInterface {
  async tokenize(text) {
    // Split on word boundaries, keeping punctuation
    const tokens = text.match(/\S+|\s+/g) || [];
    let position = 0;
    
    return tokens.map(form => {
      const token = {
        form,
        position,
        lemma: form.toLowerCase(),
        upos: this.inferPartOfSpeech(form)
      };
      position += form.length;
      return token;
    });
  }

  inferPartOfSpeech(word) {
    const lower = word.toLowerCase();
    // Common Norwegian function words
    if (['og', 'eller', 'men'].includes(lower)) return 'CCONJ';
    if (['i', 'på', 'med', 'til', 'av', 'fra'].includes(lower)) return 'ADP';
    if (['jeg', 'du', 'han', 'hun', 'det', 'vi', 'dere', 'de'].includes(lower)) return 'PRON';
    if (['en', 'ei', 'et', 'den', 'det', 'de'].includes(lower)) return 'DET';
    if (['er', 'var', 'blir', 'ble'].includes(lower)) return 'AUX';
    if (/^[.!?;:,]$/.test(word)) return 'PUNCT';
    if (/^\d+$/.test(word)) return 'NUM';
    // Default to NOUN for unknown words to ensure they're checked
    return 'NOUN';
  }
}

describe('BasicGrammarChecker Integration Tests', () => {
  let ruleRepository;
  let checker;
  let dictionary;
  let tokenizer;
  let redis;

  beforeAll(async () => {
    redis = await getRedisClient();
    
    ruleRepository = new GrammarRuleRepository(redis);
    await ruleRepository.initialize();
    
    // Create instances of dictionary and tokenizer first
    dictionary = new RedisDictionary();
    tokenizer = new SimpleTokenizer();
    
    // Initialize checker with tokenizer and dictionary (fix the initialization)
    checker = new BasicGrammarChecker(tokenizer, dictionary);

    // Wait for Redis connection
    try {
      await dictionary.redis.ping();
      console.log('✓ Redis connection successful');
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (typeof ruleRepository.cleanup === 'function') {
      await ruleRepository.cleanup();
    }
    await dictionary.cleanup();
    await cleanupRedis();
  });

  test('checks capitalization at sentence start', async () => {
    const text = 'hei på deg. Hvordan har du det?';
    const result = await checker.check(text);
    
    expect(result).toContainEqual(expect.objectContaining({
      type: 'capitalization',
      issue: 'hei',
      suggestion: 'Hei'
    }));
  });

  test('checks unknown words using Redis dictionary', async () => {
    const text = 'Dette er en nonexistentword som ikke finnes.';
    const result = await checker.check(text);
    
    expect(result.some(issue => 
      issue.type === 'unknown_word' && 
      issue.issue === 'nonexistentword'
    )).toBe(true);
  });

  test('checks abbreviation formatting', async () => {
    const text = 'Dette er feks et eksempel.';
    const result = await checker.check(text);
    
    expect(result).toContainEqual(expect.objectContaining({
      type: 'abbreviation',
      issue: 'feks',
      suggestion: 'f.eks.'
    }));
  });

  test('checks punctuation spacing', async () => {
    const text = 'Hei på deg,og hvordan har du det ?';
    const result = await checker.check(text);
    
    // Should find both the missing space after comma and space before question mark
    expect(result).toContainEqual(expect.objectContaining({
      type: 'punctuation_spacing',
      issue: ' ?',
      suggestion: '?'
    }));

    expect(result).toContainEqual(expect.objectContaining({
      type: 'punctuation_spacing',
      issue: ',o',
      suggestion: ', o'
    }));
  });

  test('handles empty input gracefully', async () => {
    const result = await checker.check('');
    expect(result).toHaveLength(0);
  });

  test('handles null input gracefully', async () => {
    const result = await checker.check(null);
    expect(result).toHaveLength(0);
  });

  test('checks proper noun capitalization', async () => {
    const text = 'jeg bor i norge og snakker norsk.';
    const result = await checker.check(text);
    
    expect(result).toContainEqual(expect.objectContaining({
      type: 'capitalization',
      issue: 'jeg',
      suggestion: 'Jeg'
    }));
  });

  test('checks multiple punctuation marks', async () => {
    const text = 'Dette er en test!!';
    const result = await checker.check(text);
    
    expect(result).toContainEqual(expect.objectContaining({
      type: 'punctuation_usage',
      issue: '!!',
      suggestion: '!'
    }));
  });
});
