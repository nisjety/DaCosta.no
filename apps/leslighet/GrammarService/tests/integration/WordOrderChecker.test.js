const WordOrderChecker = require('../../src/checkers/WordOrderChecker');
const GrammarRuleRepository = require('../../src/repositories/GrammarRuleRepository');
const Redis = require('ioredis');
const { getRedisClient, setupTestData, cleanupRedis } = require('../helpers/redis-helper');

jest.setTimeout(30000);

describe('WordOrderChecker Integration Tests', () => {
  let redis;
  let ruleRepository;
  let checker;

  beforeAll(async () => {
    try {
      // 1) Spin up Redis client using our helper
      redis = await getRedisClient();
      
      // 2) Set up test data (will skip loading if data already exists)
      await setupTestData();

      // 3) Initialize repository with Redis
      ruleRepository = new GrammarRuleRepository(redis);
      await ruleRepository.initialize();

      // 4) Wire up the checker
      checker = new WordOrderChecker(ruleRepository);
    } catch (error) {
      console.error('Error during test setup:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      // Clean up resources in reverse order of creation
      if (typeof ruleRepository?.cleanup === 'function') {
        await ruleRepository.cleanup();
      }
      
      // Use the imported cleanupRedis helper
      await cleanupRedis();
      
      // Close Redis connection if it's still open
      if (redis && redis.status === 'ready') {
        await redis.quit();
      }
    } catch (error) {
      console.error('Error during test cleanup:', error);
    }
  });

  it('flags V2-violation: "Han ikke er hjemme" → "Han er ikke hjemme"', async () => {
    const text   = 'Han ikke er hjemme';
    const issues = await checker.check(text, 'nb');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      type:       'word_order_error',
      issue:      text,
      suggestion: 'Han er ikke hjemme',
      severity:   'high'
    });
  });

  it('accepts correct V2 order: "Han er ikke hjemme"', async () => {
    const issues = await checker.check('Han er ikke hjemme', 'nb');
    expect(issues).toHaveLength(0);
  });

  it('flags missing inversion after adverbial: "I går han spiste brød" → "I går spiste han brød"', async () => {
    const text   = 'I går han spiste brød';
    const issues = await checker.check(text, 'nb');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      type:       'word_order_error',
      issue:      text,
      suggestion: 'I går spiste han brød',
      severity:   'medium'
    });
  });

  it('accepts correct inversion: "I går spiste han brød"', async () => {
    const issues = await checker.check('I går spiste han brød', 'nb');
    expect(issues).toHaveLength(0);
  });

  it('ignores subordinate clauses starting with "fordi"', async () => {
    const issues = await checker.check('fordi han spiste brød', 'nb');
    expect(issues).toHaveLength(0);
  });

  it('does not flag questions or imperatives', async () => {
    expect(await checker.check('Spis maten!',        'nb')).toHaveLength(0);
    expect(await checker.check('Leser du boken?',    'nb')).toHaveLength(0);
  });

  it('skips too-short clauses', async () => {
    expect(await checker.check('Hei!', 'nb')).toHaveLength(0);
  });

  it('handles multiple clauses separated by commas and conjunctions', async () => {
    const text = 'Han ikke leste boken, men hun leste den.';
    const issues = await checker.check(text, 'nb');
    // Only the first clause violates V2
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      issue:      'Han ikke leste boken',
      suggestion: 'Han leste ikke boken'
    });
  });

  it('returns [] for null or empty input', async () => {
    expect(await checker.check(null, 'nb')).toHaveLength(0);
    expect(await checker.check('',   'nb')).toHaveLength(0);
  });
});
