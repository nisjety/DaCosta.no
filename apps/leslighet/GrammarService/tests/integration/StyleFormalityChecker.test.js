// tests/unit/StyleFormalityChecker.test.js
const StyleFormalityChecker    = require('../../src/checkers/StyleFormalityChecker');
const GrammarRuleRepository    = require('../../src/repositories/GrammarRuleRepository');

describe('StyleFormalityChecker (real repository)', () => {
  let repo;
  let checker;

  beforeAll(() => {
    // Use the real, in-code patterns — no Redis needed here
    repo    = new GrammarRuleRepository();
    checker = new StyleFormalityChecker(repo);
  });

  describe('Mixed Formality Detection', () => {
    test('detects mixed formal & informal markers', async () => {
      const text   = 'Hei! Kunne De vennligst hjelpe meg? Du kan sende det på mail.';
      const issues = await checker.check(text);

      // Expecting two issues: one for mixed formality and one for inconsistent address forms
      expect(issues).toHaveLength(2);
      
      // Check for mixed formality issue
      const mixedFormalityIssue = issues.find(i => i.issue === 'Mixed formality levels');
      expect(mixedFormalityIssue).toMatchObject({
        type: 'style_formality',
        issue: 'Mixed formality levels',
        severity: 'low',
        isInformational: true
      });
    });

    test('does not flag small informal/formal swings', async () => {
      const text   = 'Hei! Kunne du hjelpe meg? Ha det bra!';
      const issues = await checker.check(text);
      expect(issues).toHaveLength(0);
    });
  });

  describe('Inconsistent Address Forms', () => {
    test('flags mixing of "De" and "du"', async () => {
      const text   = 'De kan sende dokumentene. Har du spørsmål, ring meg.';
      const issues = await checker.check(text);

      // one for mixed‐formality, one for inconsistent pronoun
      expect(issues).toHaveLength(2);
      expect(
        issues.find(i => i.issue === 'Inconsistent address forms')
      ).toMatchObject({
        type:        'style_formality',
        explanation: 'Mixing formal "De" and informal "du" is inconsistent.',
        severity:    'medium'
      });
    });

    test('ignores mentions inside quotes', async () => {
      const text   = 'I norsk bruker vi både "De" og "du" som pronomen.';
      const issues = await checker.check(text);
      expect(issues).toHaveLength(0);
    });
  });

  describe('Consistent Formality Levels', () => {
    test('all-formal text passes', async () => {
      const text = 'Kunne De vennligst være så høflig å sende Deres dokumenter?';
      expect(await checker.check(text)).toHaveLength(0);
    });

    test('all-informal text passes', async () => {
      const text = 'Hei! Kan du sende meg dine dokumenter? Ha det bra!';
      expect(await checker.check(text)).toHaveLength(0);
    });

    test('neutral procedural text passes', async () => {
      const text = 'Dokumentene skal sendes innen fredag.';
      expect(await checker.check(text)).toHaveLength(0);
    });
  });

  describe('Edge Cases & Errors', () => {
    [null, undefined, ''].forEach(input => {
      test(`returns [] for ${String(input)}`, async () => {
        expect(await checker.check(input)).toHaveLength(0);
      });
    });
  });
});
