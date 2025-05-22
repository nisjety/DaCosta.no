const GrammarRuleRepository = require('../../src/repositories/GrammarRuleRepository');
const { getRedisClient, setupTestData, cleanupRedis } = require('../helpers/redis-helper');
const { addWordToCategory } = require('../../src/helpers/GrammarRuleLoader');

// Increase Jest timeout for all tests
jest.setTimeout(30000);

describe('GrammarRuleRepository Integration Tests', () => {
  let repository;
  let redis;

  beforeAll(async () => {
    // Get Redis client and setup data - setupTestData() already handles checking if data exists
    redis = await getRedisClient();
    await setupTestData();

    try {
      await redis.ping();
      console.log('✓ Redis connection successful');
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }

    repository = new GrammarRuleRepository(redis);
    await repository.initializeCategoryMaps();
  });

  afterAll(async () => {
    // Clean up connections but don't clear data as other tests may use it
    if (repository && typeof repository.cleanup === 'function') {
      await repository.cleanup();
    }
    await cleanupRedis();
  });

  test('initializes with real Redis data', async () => {
    const categories = await repository.getCategories();
    expect(categories).toBeDefined();
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBeGreaterThan(0);
  });

  test('checks word categories correctly', async () => {
    // Add test words to categories
    await addWordToCategory('testCategory', 'testWord');
    await repository.refresh();

    expect(repository.isInCategory('testWord', 'testCategory')).toBe(true);
    expect(repository.isInCategory('nonexistentWord', 'testCategory')).toBe(false);
  });

  test('retrieves sentence patterns', () => {
    const v2Pattern = repository.getPattern('mainClauseV2');
    expect(v2Pattern).toBeDefined();
    expect(v2Pattern instanceof RegExp).toBe(true);
    
    // Test pattern matching
    expect(v2Pattern.test('Han er glad')).toBe(true);
    expect(v2Pattern.test('Glad er han')).toBe(false);
  });

  test('retrieves formality patterns', () => {
    const formalPatterns = repository.getFormalityPatterns('formal');
    const informalPatterns = repository.getFormalityPatterns('informal');

    expect(Array.isArray(formalPatterns)).toBe(true);
    expect(Array.isArray(informalPatterns)).toBe(true);
    expect(formalPatterns.length).toBeGreaterThan(0);
    expect(informalPatterns.length).toBeGreaterThan(0);

    // Test pattern matching
    const formalText = 'De er velkommen';
    const informalText = 'du er velkommen';

    expect(formalPatterns.some(pattern => pattern.test(formalText))).toBe(true);
    expect(informalPatterns.some(pattern => pattern.test(informalText))).toBe(true);
  });

  test('adds new words to categories', async () => {
    const testWord = 'newTestWord';
    const testCategory = 'testCategory';

    const success = await repository.addWord(testCategory, testWord);
    expect(success).toBe(true);

    // Verify the word was added
    expect(repository.isInCategory(testWord, testCategory)).toBe(true);
  });

  test('creates new categories', async () => {
    const newCategory = 'newTestCategory';
    const words = ['word1', 'word2'];

    const success = await repository.createCategory(newCategory, 'Test purpose', words);
    expect(success).toBe(true);

    // Verify category was created with words
    const categories = await repository.getCategories();
    expect(categories).toContain(newCategory);
    expect(repository.isInCategory('word1', newCategory)).toBe(true);
    expect(repository.isInCategory('word2', newCategory)).toBe(true);
  });

  test('refreshes data from Redis', async () => {
    await repository.refresh();
    const categories = await repository.getCategories();
    expect(categories).toBeDefined();
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBeGreaterThan(0);
  });
});
