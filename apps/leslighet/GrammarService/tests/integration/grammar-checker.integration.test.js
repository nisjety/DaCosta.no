const { GrammarChecker } = require('../../src/services/grammar-checker');
const { GrammarRuleRepository } = require('../../src/repositories/GrammarRuleRepository');
const { RedisDictionary } = require('../../src/services/redis-dictionary');
const { getRedisClient, setupTestData, cleanupAllData } = require('../helpers/redis-helper');
const WordOrderChecker = require('../../src/checkers/WordOrderChecker');
const PassiveVoiceChecker = require('../../src/checkers/PassiveVoiceChecker');
const BasicGrammarChecker = require('../../src/checkers/BasicGrammarChecker');

// Full end-to-end test of the entire grammar checking pipeline
describe('GrammarChecker Integration', () => {
  let redis;
  let repository;
  let dictionary;
  let grammarChecker;

  // Initialize shared components
  beforeAll(async () => {
    jest.setTimeout(30000);
    redis = await getRedisClient();
    await setupTestData();
    
    // Create core dependencies
    repository = new GrammarRuleRepository(redis);
    dictionary = new RedisDictionary(redis);
    
    // Create the main checker with no initial sub-checkers
    grammarChecker = new GrammarChecker(repository, dictionary);
    
    // Add specific checkers
    grammarChecker.addChecker(new WordOrderChecker(repository));
    grammarChecker.addChecker(new PassiveVoiceChecker(repository, dictionary));
    grammarChecker.addChecker(new BasicGrammarChecker(repository, dictionary));
  });

  afterAll(async () => {
    await cleanupAllData();
  });

  test('identifies multiple issues in a text', async () => {
    // This text has multiple issues:
    // 1. Word order in first clause (ikke er → er ikke)
    // 2. Passive voice (could be flagged)
    // 3. Missing capitalization
    // 4. Missing comma before "og"
    const text = 'Han ikke er hjemme, bilen ble kjørt av meg igår og han kommer sent';
    
    const issues = await grammarChecker.analyze(text);
    
    // Check that we found at least some issues
    expect(issues.length).toBeGreaterThan(2);
    
    // Find the word order error
    const wordOrderIssue = issues.find(i => i.type === 'word_order_error');
    expect(wordOrderIssue).toBeDefined();
    expect(wordOrderIssue.issue).toContain('ikke er');
    
    // Find capitalization or punctuation issues
    const styleIssues = issues.filter(
      i => i.type === 'capitalization' || i.type === 'punctuation'
    );
    expect(styleIssues.length).toBeGreaterThan(0);
  });

  test('supports different dialects', async () => {
    const text = 'Han ikke er hjemme'; // Same issue in both dialects
    
    const issuesNB = await grammarChecker.analyze(text, 'nb');
    const issuesNN = await grammarChecker.analyze(text, 'nn');
    
    // Both dialects should detect word order issue
    expect(issuesNB.length).toBeGreaterThan(0);
    expect(issuesNN.length).toBeGreaterThan(0);
  });

  test('returns [] for empty input', async () => {
    expect(await grammarChecker.analyze('')).toEqual([]);
    expect(await grammarChecker.analyze(null)).toEqual([]);
    expect(await grammarChecker.analyze(undefined)).toEqual([]);
  });
});