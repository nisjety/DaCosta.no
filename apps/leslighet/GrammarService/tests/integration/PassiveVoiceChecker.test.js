const PassiveVoiceChecker = require('../../src/checkers/PassiveVoiceChecker');
const GrammarRuleRepository = require('../../src/repositories/GrammarRuleRepository');
const RedisDictionary = require('../../src/dictionaries/RedisDictionary');
const { getRedisClient, cleanupRedis } = require('../helpers/redis-helper');

jest.setTimeout(30000);

describe('PassiveVoiceChecker End-to-End Integration', () => {
  let redis;
  let ruleRepository;
  let dictionary;
  let checker;

  beforeAll(async () => {
    // 1) Get Redis client
    redis = await getRedisClient();

    // 2) Seed the Norsk fullforms hash with passive‐voice forms
    //    Values are TSV strings where the first field contains "passiv"
    await redis.hset('norsk:fullforms', 'spist', 'verb perf-part passiv\t020\t9\t1996.01.01\t4000\tnormert');
    await redis.hset('norsk:fullforms', 'bygget', 'verb perf-part passiv\t020\t9\t1996.01.01\t4000\tnormert');
    await redis.hset('norsk:fullforms', 'lest', 'verb pret passiv\t020\t8\t1996.01.01\t4000\tnormert');
    await redis.hset('norsk:fullforms', 'spises', 'verb pres passiv\t020\t6\t1996.01.01\t4000\tnormert');
    await redis.hset('norsk:fullforms', 'leses', 'verb pres passiv\t020\t6\t1996.01.01\t4000\tnormert');

    // 3) Instantiate your real repo & dictionary
    ruleRepository = new GrammarRuleRepository(redis);
    await ruleRepository.initialize();

    dictionary = new RedisDictionary(redis);

    // 4) Build the checker under test
    checker = new PassiveVoiceChecker(ruleRepository, dictionary);
  });

  afterAll(async () => {
    // remove only what we seeded
    await redis.hdel('norsk:fullforms',
      'spist','bygget','lest','spises','leses'
    );
    // close connections
    if (typeof dictionary.cleanup === 'function') {
      await dictionary.cleanup();
    }
    if (typeof ruleRepository.cleanup === 'function') {
      await ruleRepository.cleanup();
    }
    await cleanupRedis();
  });

  describe('Bli-based Passive Voice', () => {
    it('detects present passive "blir spist"', async () => {
      const issues = await checker.check('Maten blir spist', 'nb');
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        type:     'passive_voice',
        issue:    'blir spist',
        severity: 'low'
      });
    });

    it('detects past passive "ble lest"', async () => {
      const issues = await checker.check('Boken ble lest', 'nb');
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        type:     'passive_voice',
        issue:    'ble lest',
        severity: 'low'
      });
    });

    it('detects perfect passive "har blitt bygget"', async () => {
      const issues = await checker.check('Huset har blitt bygget', 'nb');
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        type:     'passive_voice',
        issue:    'blitt bygget',
        severity: 'low'
      });
    });
  });

  describe('S-form Passive Voice', () => {
    it('detects s-passive "spises"', async () => {
      const issues = await checker.check('Maten spises', 'nb');
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        type:     'passive_voice',
        issue:    'spises',
        severity: 'low'
      });
    });

    it('ignores non-passive s-words', async () => {
      const issues = await checker.check('hennes deres files ellers', 'nb');
      expect(issues).toHaveLength(0);
    });

    it('detects s-passive in context "leses"', async () => {
      const issues = await checker.check('Den gamle boken leses av studenten', 'nb');
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        type:     'passive_voice',
        issue:    'leses',
        severity: 'low'
      });
    });
  });

  describe('Active Voice Cases', () => {
    it('does not flag active sentences', async () => {
      const issues = await checker.check('Studenten leser boken', 'nb');
      expect(issues).toHaveLength(0);
    });

    it('does not flag planet names with s-ending', async () => {
      const issues = await checker.check('Mars er en planet', 'nb');
      expect(issues).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('returns [] for null or empty input', async () => {
      expect(await checker.check(null, 'nb')).toHaveLength(0);
      expect(await checker.check('',   'nb')).toHaveLength(0);
    });

    it('returns [] when no verbs present', async () => {
      const issues = await checker.check('en fin dag', 'nb');
      expect(issues).toHaveLength(0);
    });
  });
});
