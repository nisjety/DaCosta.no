const StyleFormalityChecker = require('../../src/checkers/StyleFormalityChecker');

// Move test file to unit tests since it doesn't need Redis
const targetPath = '/Volumes/Lagring/services/ReadabilityService/GrammarService/tests/unit/StyleFormalityChecker.test.js';

class MockGrammarRuleRepository {
  constructor() {
    this.patterns = {
      mainClauseV2: /^(?:\w+)\s+(?:er|var|har|kan|vil|skal|må|bør)/i,
      inversionAfterIntro: /^(?:nå|her|der|da|når|fordi|siden|hvis|om)\s+(?:\w+)\s+(?:er|var|har|kan|vil|skal|må|bør)/i,
      passiveBliBased: /\b(bli|blir|ble|blitt)\s+(\w+et|\w+t|\w+dd)\b/i,
      passiveSForm: /\b(\w+es|\w+as)\b/i,
      passiveEndings: /\b(\w+es|\w+tes|\w+des)\b/i
    };

    this.formalityPatterns = {
      informal: [
        /\bdu\b/i,
        /\bdeg\b/i,
        /\bdere\b/i,
        /\bditt\b|\bdine\b/i,
        /\bganske\b/i,
        /\bkjempefin\b/i,
        /\bliksom\b/i,
        /\bkul\b/i,
        /\bgrei\b/i,
        /\bjepp\b/i
      ],
      formal: [
        /\bDe\b/,
        /\bDeres\b/,
        /\bvennligst\b/i,
        /\bhøflig\b/i,
        /\bdersom\b/i,
        /\bimidlertid\b/i,
        /\bsåledes\b/i,
        /\bvedrørende\b/i,
        /\bundertegnede\b/i
      ]
    };
  }

  getFormalityPatterns(type) {
    return this.formalityPatterns[type] || [];
  }

  getPattern(patternName) {
    return this.patterns[patternName];
  }
}

describe('StyleFormalityChecker Tests', () => {
  let checker;
  let ruleRepository;

  beforeEach(() => {
    ruleRepository = new MockGrammarRuleRepository();
    checker = new StyleFormalityChecker(ruleRepository);
  });

  describe('Mixed Formality Detection', () => {
    test('should detect mixed formality levels', async () => {
      const text = 'Hei! Kunne De vennligst hjelpe meg? Du kan sende det på mail.';
      const issues = await checker.check(text);

      // Expecting two issues: one for mixed formality and one for inconsistent address forms
      expect(issues).toHaveLength(2);
      
      // Check for mixed formality issue
      const mixedFormalityIssue = issues.find(i => i.issue === 'Mixed formality levels');
      expect(mixedFormalityIssue).toMatchObject({
        type: 'style_formality',
        position: 0,
        issue: 'Mixed formality levels',
        explanation: 'Text mixes formal and informal language styles inconsistently.',
        severity: 'low',
        isInformational: true
      });
      
      // Check for inconsistent address forms issue
      const addressFormsIssue = issues.find(i => i.issue === 'Inconsistent address forms');
      expect(addressFormsIssue).toMatchObject({
        type: 'style_formality',
        position: 0,
        issue: 'Inconsistent address forms',
        explanation: 'Mixing formal "De" and informal "du" is inconsistent.',
        severity: 'medium',
        isInformational: true
      });
    });

    test('should not flag slight formality variations', async () => {
      const text = 'Hei! Kunne du hjelpe meg? Ha det bra!';
      const issues = await checker.check(text);
      expect(issues).toHaveLength(0);
    });
  });

  describe('Inconsistent Address Forms', () => {
    test('should detect mixing of De and du', async () => {
      const text = 'De kan sende dokumentene. Har du spørsmål, ring meg.';
      const issues = await checker.check(text);

      expect(issues).toHaveLength(2); // One for mixed formality, one for inconsistent address
      expect(issues.find(i => i.issue === 'Inconsistent address forms')).toMatchObject({
        type: 'style_formality',
        issue: 'Inconsistent address forms',
        explanation: 'Mixing formal "De" and informal "du" is inconsistent.',
        severity: 'medium'
      });
    });

    test('should not flag quoted address forms', async () => {
      const text = 'I norsk bruker vi både "De" og "du" som pronomen.';
      const issues = await checker.check(text);
      expect(issues).toHaveLength(0);
    });
  });

  describe('Formality Level Detection', () => {
    test('should identify predominantly formal text', async () => {
      const text = 'Kunne De vennligst være så høflig å sende Deres dokumenter?';
      const issues = await checker.check(text);
      expect(issues).toHaveLength(0); // Consistently formal
    });

    test('should identify predominantly informal text', async () => {
      const text = 'Hei! Kan du sende meg dine dokumenter? Ha det bra!';
      const issues = await checker.check(text);
      expect(issues).toHaveLength(0); // Consistently informal
    });

    test('should handle neutral text', async () => {
      const text = 'Dokumentene skal sendes innen fredag.';
      const issues = await checker.check(text);
      expect(issues).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle null input', async () => {
      const issues = await checker.check(null);
      expect(issues).toHaveLength(0);
    });

    test('should handle empty string', async () => {
      const issues = await checker.check('');
      expect(issues).toHaveLength(0);
    });

    test('should handle undefined input', async () => {
      const issues = await checker.check(undefined);
      expect(issues).toHaveLength(0);
    });
  });

  describe('Pattern Matching', () => {
    test('should correctly count formal patterns', async () => {
      const text = 'Kunne De vennligst sende Deres dokumenter vedrørende saken?';
      const issues = await checker.check(text);
      expect(issues).toHaveLength(0); // Multiple formal patterns, consistent
    });

    test('should correctly count informal patterns', async () => {
      const text = 'Hei du! Kan du sende dine dokumenter? Det er ganske kult!';
      const issues = await checker.check(text);
      expect(issues).toHaveLength(0); // Multiple informal patterns, consistent
    });

    test('should handle text with no formality markers', async () => {
      const text = 'Dokumentene skal sendes innen fredag klokken tolv.';
      const issues = await checker.check(text);
      expect(issues).toHaveLength(0);
    });
  });
});