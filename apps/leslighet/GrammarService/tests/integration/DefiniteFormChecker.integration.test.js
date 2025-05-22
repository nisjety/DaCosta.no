const DefiniteFormChecker = require('../../src/checkers/DefiniteFormChecker');
const GrammarRuleRepository = require('../../src/repositories/GrammarRuleRepository');
const RedisDictionary = require('../../src/dictionaries/RedisDictionary');
const { getRedisClient, cleanupRedis } = require('../helpers/redis-helper');

describe('DefiniteFormChecker Integration Tests', () => {
  let redis;
  let ruleRepository;
  let dictionary;
  let checker;

  beforeAll(async () => {
    // Get a shared Redis client
    redis = await getRedisClient();

    // Seed Redis with test data
    await redis.sadd('norsk:stopwords:possessives', 
      'min:masc:sg', 'mitt:neut:sg', 'mi:fem:sg', 
      'din:masc:sg', 'ditt:neut:sg', 'di:fem:sg',
      'sin:masc:sg', 'sitt:neut:sg', 'si:fem:sg'
    );
    
    await redis.sadd('norsk:stopwords:articles', 'en:masc', 'et:neut', 'ei:fem');
    
    // Add some test noun forms
    await redis.hset('norsk:fullforms', 'bil', 'noun mask sg indef');
    await redis.hset('norsk:fullforms', 'bilen', 'noun mask sg def');
    await redis.hset('norsk:fullforms', 'hus', 'noun nøyt sg indef');
    await redis.hset('norsk:fullforms', 'huset', 'noun nøyt sg def');
    await redis.hset('norsk:fullforms', 'jente', 'noun fem sg indef');
    await redis.hset('norsk:fullforms', 'jenta', 'noun fem sg def');

    // Initialize components with shared Redis instance
    ruleRepository = new GrammarRuleRepository(redis);
    dictionary = new RedisDictionary(redis);
    checker = new DefiniteFormChecker(ruleRepository, dictionary);

    // Initialize rule repository
    await ruleRepository.initialize();
  });

  afterAll(async () => {
    // Clean up resources
    if (dictionary && typeof dictionary.cleanup === 'function') {
      await dictionary.cleanup();
    }
    
    if (ruleRepository && typeof ruleRepository.cleanup === 'function') {
      await ruleRepository.cleanup();
    }
    
    await cleanupRedis();
  });

  it('detects definite form error with possessive', async () => {
    const text = 'min bilen';
    const tokens = [
      { form: 'min', position: 0, upos: 'DET' },
      { form: 'bilen', position: 4, lemma: 'bil', upos: 'NOUN' }
    ];

    const issues = await checker.check(text, 'nb', { tokens });

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      type: 'definite_form_error',
      position: 4,
      issue: 'min bilen',
      suggestion: 'min bil',
      severity: 'medium'
    });
  });

  it('detects definite form error with indefinite article', async () => {
    const text = 'en huset';
    const tokens = [
      { form: 'en', position: 0, upos: 'DET' },
      { form: 'huset', position: 3, lemma: 'hus', upos: 'NOUN' }
    ];

    const issues = await checker.check(text, 'nb', { tokens });

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      type: 'definite_form_error',
      position: 3,
      issue: 'en huset',
      suggestion: 'en hus',
      severity: 'medium'
    });
  });

  it('handles feminine nouns correctly', async () => {
    const text = 'min jenta';
    const tokens = [
      { form: 'min', position: 0, upos: 'DET' },
      { form: 'jenta', position: 4, lemma: 'jente', upos: 'NOUN' }
    ];

    const issues = await checker.check(text, 'nb', { tokens });

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      type: 'definite_form_error',
      position: 4,
      issue: 'min jenta',
      suggestion: 'min jente',
      severity: 'medium'
    });
  });

  it('accepts correct indefinite forms', async () => {
    const text = 'min bil';
    const tokens = [
      { form: 'min', position: 0, upos: 'DET' },
      { form: 'bil', position: 4, upos: 'NOUN' }
    ];

    const issues = await checker.check(text, 'nb', { tokens });
    expect(issues).toHaveLength(0);
  });
});