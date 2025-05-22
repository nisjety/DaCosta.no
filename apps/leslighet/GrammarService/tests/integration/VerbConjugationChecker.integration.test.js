const VerbConjugationChecker = require('../../src/checkers/VerbConjugationChecker');
const RedisDictionary = require('../../src/dictionaries/RedisDictionary');
const { getRedisClient, setupTestData, cleanupRedis } = require('../helpers/redis-helper');

describe('VerbConjugationChecker Integration Tests', () => {
  let dictionary;
  let checker;
  let redis;

  beforeAll(async () => {
    redis = await getRedisClient();
    await setupTestData();
    dictionary = new RedisDictionary(redis);
    checker = new VerbConjugationChecker(dictionary);
  }, 20000); // Increased timeout for data loading

  afterAll(async () => {
    if (dictionary && typeof dictionary.cleanup === 'function') {
      await dictionary.cleanup();
    }
    await cleanupRedis();
  });

  // Helper functions to create tokens with Universal Dependencies format
  const createToken = (form, position = 0, upos = 'VERB', lemma = null) => ({
    form,
    position,
    upos,
    lemma: lemma || form
  });

  const createTokens = (text) => {
    const words = text.split(' ');
    let position = 0;
    return words.map((word) => {
      const token = createToken(word, position, guessPos(word));
      position += word.length + 1; // +1 for the space
      return token;
    });
  };

  // Guess POS tag based on common Norwegian words
  const guessPos = (word) => {
    const lower = word.toLowerCase();
    if (['jeg', 'du', 'han', 'hun', 'den', 'det', 'vi', 'dere', 'de'].includes(lower)) return 'PRON';
    if (['vil', 'kan', 'skal', 'må'].includes(lower)) return 'AUX';
    if (['spiser', 'spise', 'liker'].includes(lower)) return 'VERB';
    if (['brød', 'mat'].includes(lower)) return 'NOUN';
    return 'X'; // unknown
  };

  describe('Infinitive Form Tests', () => {
    it('detects incorrect verb form after modal verb', async () => {
      const text = 'jeg vil spiser brød';
      const tokens = createTokens(text);
      const issues = await checker.check(text, 'nb', { tokens });
      
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]).toMatchObject({
        type: 'verb_infinitive_error',
        issue: 'spiser',
        suggestion: 'spise'  // Modal verbs like "vil" take base infinitive without "å"
      });
    });

    it('detects missing infinitive marker after verb requiring infinitive', async () => {
      const text = 'jeg liker spiser mat';
      const tokens = createTokens(text);
      const issues = await checker.check(text, 'nb', { tokens });
      
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]).toMatchObject({
        type: 'verb_infinitive_error',
        issue: 'spiser',
        suggestion: 'å spise'  // Regular verbs like "liker" require "å" before infinitive
      });
    });

    it('accepts correct infinitive form after modal verb', async () => {
      const text = 'jeg vil spise brød';  // Correct form, no "å" after modal verb
      const tokens = createTokens(text);
      const issues = await checker.check(text, 'nb', { tokens });
      expect(issues).toHaveLength(0);
    });
  });

  describe('Verb Tense Tests', () => {
    it('detects incorrect present tense usage', async () => {
      const text = 'jeg spise brød';
      const tokens = createTokens(text);
      const issues = await checker.check(text, 'nb', { tokens });
      
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]).toMatchObject({
        type: 'verb_conjugation',
        issue: 'spise',
        suggestion: 'spiser'
      });
    });

    it('accepts correct present tense', async () => {
      const text = 'jeg spiser brød';
      const tokens = createTokens(text);
      const issues = await checker.check(text, 'nb', { tokens });
      expect(issues).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('handles unknown verbs gracefully', async () => {
      const text = 'jeg xyzabc brød';
      const tokens = createTokens(text);
      const issues = await checker.check(text, 'nb', { tokens });
      expect(issues).toHaveLength(0);
    });

    it('handles empty input gracefully', async () => {
      const issues = await checker.check('', 'nb', { tokens: [] });
      expect(issues).toHaveLength(0);
    });
  });
});