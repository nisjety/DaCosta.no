const Redis = require('ioredis');
const { RedisDictionary } = require('../../src/repositories/RedisDictionary');
const { GrammarRuleRepository } = require('../../src/repositories/GrammarRuleRepository');
const { ArticleUsageChecker } = require('../../src/checkers/ArticleUsageChecker');
const debug = require('debug')('grammar:test');

describe('ArticleUsageChecker Integration Tests', () => {
  let redis;
  let dictionary;
  let repository;
  let checker;

  beforeAll(async () => {
    // Initialize Redis with retry strategy
    redis = new Redis({
      port: process.env.REDIS_PORT || 6380,
      host: process.env.REDIS_HOST || 'localhost',
      retryStrategy: (times) => {
        if (times > 3) {
          throw new Error('Redis connection failed');
        }
        return Math.min(times * 100, 3000);
      }
    });

    // Clean up any existing test data
    await redis.flushall();

    // Seed test data with actual dictionary format
    await redis.hset('norsk:fullforms', {
      'bil': 'subst mask appell ent ub normert\t769\t1\t1996.01.01\t4000\tnormert',
      'bok': 'subst fem appell ent ub normert\t769\t1\t1996.01.01\t4000\tnormert',
      'hus': 'subst nøyt appell ent ub normert\t769\t1\t1996.01.01\t4000\tnormert'
    });
    await redis.sadd('grammar:indefiniteArticles', 'en', 'ei', 'et');

    // Verify test data was seeded correctly
    const words = await redis.hgetall('norsk:fullforms');
    debug('Seeded words:', words);
    const articles = await redis.smembers('grammar:indefiniteArticles');
    debug('Seeded articles:', articles);

    // Verify dictionary lookups work correctly
    dictionary = new RedisDictionary(redis);
    repository = new GrammarRuleRepository(redis);
    checker = new ArticleUsageChecker(dictionary);

    // Test each word lookup
    const bilLookup = await dictionary.lookupWord('bil');
    debug('bil lookup:', bilLookup);
    const bokLookup = await dictionary.lookupWord('bok');
    debug('bok lookup:', bokLookup);
    const husLookup = await dictionary.lookupWord('hus');
    debug('hus lookup:', husLookup);

    // Verify gender mappings
    if (!bilLookup || !bilLookup.attributes.includes('mask')) {
      throw new Error('Failed to map masculine gender for bil');
    }
    if (!bokLookup || !bokLookup.attributes.includes('fem')) {
      throw new Error('Failed to map feminine gender for bok');
    }
    if (!husLookup || !husLookup.attributes.includes('nøyt')) {
      throw new Error('Failed to map neuter gender for hus');
    }
  });

  afterAll(async () => {
    // Clean up test data and connections
    await Promise.all([
      redis.multi()
        .del('norsk:fullforms')
        .del('grammar:indefiniteArticles')
        .exec(),
      dictionary.cleanup(),
      repository.cleanup(),
      redis.quit()
    ]);
  });

  it('detects incorrect article usage for masculine noun', async () => {
    const text = 'ei bil';
    const tokens = [
      { form: 'ei', upos: 'DET', position: { start: 0, end: 2 } },
      { form: 'bil', upos: 'NOUN', position: { start: 3, end: 6 } }
    ];
    const issues = await checker.check(text, 'nb', { tokens });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      type: 'article_agreement_error',
      issue: 'ei bil',
      suggestion: 'en bil',
      explanation: 'Article must agree with noun gender.',
      severity: 'medium'
    });
  });

  it('detects incorrect article usage for feminine noun', async () => {
    const text = 'en bok';
    const tokens = [
      { form: 'en', upos: 'DET', position: { start: 0, end: 2 } },
      { form: 'bok', upos: 'NOUN', position: { start: 3, end: 6 } }
    ];
    const issues = await checker.check(text, 'nb', { tokens });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      type: 'article_agreement_error',
      issue: 'en bok',
      suggestion: 'ei bok',
      explanation: 'Article must agree with noun gender.',
      severity: 'medium'
    });
  });

  it('detects incorrect article usage for neuter noun', async () => {
    const text = 'en hus';
    const tokens = [
      { form: 'en', upos: 'DET', position: { start: 0, end: 2 } },
      { form: 'hus', upos: 'NOUN', position: { start: 3, end: 6 } }
    ];
    const issues = await checker.check(text, 'nb', { tokens });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      type: 'article_agreement_error',
      issue: 'en hus',
      suggestion: 'et hus',
      explanation: 'Article must agree with noun gender.',
      severity: 'medium'
    });
  });

  it('accepts correct article usage', async () => {
    const text = 'en bil';
    const tokens = [
      { form: 'en', upos: 'DET', position: { start: 0, end: 2 } },
      { form: 'bil', upos: 'NOUN', position: { start: 3, end: 6 } }
    ];
    const issues = await checker.check(text, 'nb', { tokens });
    expect(issues).toHaveLength(0);
  });

  it('handles unknown words gracefully', async () => {
    const text = 'en xyz';
    const tokens = [
      { form: 'en', upos: 'DET', position: { start: 0, end: 2 } },
      { form: 'xyz', upos: 'NOUN', position: { start: 3, end: 6 } }
    ];
    const issues = await checker.check(text, 'nb', { tokens });
    expect(issues).toHaveLength(0);
  });
}); 