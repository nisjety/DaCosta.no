const Redis = require('ioredis');
const { GrammarRuleRepository } = require('../../src/repositories/GrammarRuleRepository');

describe('GrammarRuleRepository Integration Tests', () => {
  let redis;
  let repository;

  beforeAll(async () => {
    // Create Redis client for seeding test data with proper error handling
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      commandTimeout: 5000,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          throw new Error('Redis connection failed after 3 retries');
        }
        return Math.min(times * 100, 3000);
      }
    });

    // Handle Redis errors
    redis.on('error', (error) => {
      console.error('Redis connection error:', error);
    });

    // Wait for Redis connection to be ready
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Redis connection timeout'));
      }, 5000);

      redis.once('ready', () => {
        clearTimeout(timeout);
        resolve();
      });

      redis.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    // Seed test data
    await redis.multi()
      .sadd('grammar:possessives', 'min', 'din', 'sin', 'vår', 'deres')
      .sadd('grammar:indefiniteArticles', 'en', 'ei', 'et')
      .sadd('grammar:definiteForms', 'bilen', 'huset', 'jenta')
      .exec();

    // Create repository instance with same Redis connection
    repository = new GrammarRuleRepository(redis);
  }, 10000); // Increase timeout for beforeAll

  afterAll(async () => {
    // Clean up test data
    try {
      if (redis && redis.status === 'ready') {
        await redis.multi()
          .del('grammar:possessives')
          .del('grammar:indefiniteArticles')
          .del('grammar:definiteForms')
          .exec();
      }
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }

    // Close connections with proper error handling
    try {
      if (repository) {
        await repository.cleanup();
      }
      if (redis && redis.status === 'ready') {
        await redis.quit();
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }, 10000); // Increase timeout for afterAll

  // Add a longer timeout for Redis operations
  jest.setTimeout(10000);

  it('retrieves possessive pronouns from Redis', async () => {
    const possessives = await repository.getPossessives();
    expect(possessives).toBeInstanceOf(Set);
    expect(possessives.size).toBe(5);
    expect(possessives.has('min')).toBe(true);
    expect(possessives.has('din')).toBe(true);
    expect(possessives.has('sin')).toBe(true);
    expect(possessives.has('vår')).toBe(true);
    expect(possessives.has('deres')).toBe(true);
  });

  it('retrieves indefinite articles from Redis', async () => {
    const articles = await repository.getIndefiniteArticles();
    expect(articles).toBeInstanceOf(Set);
    expect(articles.size).toBe(3);
    expect(articles.has('en')).toBe(true);
    expect(articles.has('ei')).toBe(true);
    expect(articles.has('et')).toBe(true);
  });

  it('retrieves definite forms from Redis', async () => {
    const forms = await repository.getDefiniteForms();
    expect(forms).toBeInstanceOf(Set);
    expect(forms.size).toBe(3);
    expect(forms.has('bilen')).toBe(true);
    expect(forms.has('huset')).toBe(true);
    expect(forms.has('jenta')).toBe(true);
  });

  it('returns empty set when Redis key does not exist', async () => {
    // Delete the test data for this specific test
    await redis.del('grammar:possessives');
    
    const possessives = await repository.getPossessives();
    expect(possessives).toBeInstanceOf(Set);
    expect(possessives.size).toBe(0);

    // Reseed the data for other tests
    await redis.sadd('grammar:possessives', 'min', 'din', 'sin', 'vår', 'deres');
  });

  it('handles Redis connection errors gracefully', async () => {
    // Create a repository with an invalid Redis connection
    const badRedis = new Redis({
      host: 'nonexistent-host',
      port: 6379,
      connectTimeout: 1000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null // Disable retries for faster test
    });

    const badRepository = new GrammarRuleRepository(badRedis);

    // Wait for connection to fail
    await new Promise(resolve => setTimeout(resolve, 1000));

    const possessives = await badRepository.getPossessives();
    expect(possessives).toBeInstanceOf(Set);
    expect(possessives.size).toBe(0);

    try {
      await badRepository.cleanup();
    } catch (error) {
      // Ignore cleanup errors for bad connection
    }
  });
}); 