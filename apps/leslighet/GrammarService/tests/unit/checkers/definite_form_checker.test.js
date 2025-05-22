/**
 * Unit tests for the DefiniteFormChecker
 */

const DefiniteFormChecker = require('../../../src/checkers/DefiniteFormChecker');
const NorwegianDictionaryAdapter = require('../../../src/adapters/NorwegianDictionaryAdapter');
const path = require('path');

describe('DefiniteFormChecker', () => {
  let checker;
  let norwegianDictionary;
  
  beforeAll(async () => {
    // Create and initialize the Norwegian dictionary
    norwegianDictionary = new NorwegianDictionaryAdapter({
      dataPath: path.resolve(process.cwd(), 'data'),
      useRedis: false,
      cacheEnabled: true
    });
    
    await norwegianDictionary.initialize();
    
    // Create the checker with the dictionary dependency
    checker = new DefiniteFormChecker({
      confidenceThreshold: 0.7 // Lower threshold for testing
    }, {
      norwegianDictionary
    });
  }, 30000); // Increase timeout for dictionary loading
  
  afterAll(async () => {
    // Clean up resources
    if (norwegianDictionary) {
      await norwegianDictionary.close();
    }
  });
  
  test('should detect missing definite form with determiner', async () => {
    const text = 'Den bok er god.'; // Should be "Den boken er god"
    
    const issues = await checker.check(text);
    
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some(issue => 
      issue.rule === 'missing-definite-form' && 
      issue.range.start === text.indexOf('bok')
    )).toBeTruthy();
  });
  
  test('should detect incorrect use of indefinite article with definite form', async () => {
    const text = 'Jeg leser en boken.'; // Should be "Jeg leser en bok"
    
    const issues = await checker.check(text);
    
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some(issue => 
      issue.rule === 'indefinite-article-with-definite-form' && 
      issue.range.start === text.indexOf('boken')
    )).toBeTruthy();
  });
  
  test('should not flag correct definite form usage with preposition', async () => {
    const text = 'Jeg går til butikken.'; // Correct: "to the shop"
    
    const issues = await checker.check(text);
    
    expect(issues.length).toBe(0);
  });
  
  test('should not flag correct double definiteness', async () => {
    const text = 'Den store bilen er rød.'; // Correct: "The big car is red"
    
    const issues = await checker.check(text);
    
    // There should be no issues with correct double definiteness
    expect(issues.some(issue => issue.rule === 'missing-definite-form')).toBeFalsy();
    expect(issues.some(issue => issue.rule === 'missing-determiner')).toBeFalsy();
  });
  
  test('should not flag correct possessive after noun construction', async () => {
    const text = 'Boken min er på bordet.'; // Correct: "My book is on the table"
    
    const issues = await checker.check(text);
    
    // There should be no issues with correct possessive after noun
    expect(issues.some(issue => issue.rule === 'missing-determiner')).toBeFalsy();
  });
  
  test('should detect inconsistent definiteness in prepositional phrases', async () => {
    const text = 'Jeg legger boken på bord.'; // Inconsistent: "the book on table"
    
    const issues = await checker.check(text);
    
    // Should suggest making "bord" definite to match "boken"
    expect(issues.some(issue => 
      issue.rule === 'inconsistent-definiteness' && 
      issue.range.start === text.indexOf('bord')
    )).toBeTruthy();
  });
  
  test('should handle multiple issues in a sentence', async () => {
    const text = 'Den bok ligger på bordet, og en katten sitter ved siden av.';
    // Issues: "Den bok" should be "Den boken" and "en katten" should be "en katt"
    
    const issues = await checker.check(text);
    
    expect(issues.length).toBeGreaterThan(1);
    expect(issues.some(issue => 
      issue.rule === 'missing-definite-form' && 
      issue.range.start === text.indexOf('bok')
    )).toBeTruthy();
    
    expect(issues.some(issue => 
      issue.rule === 'indefinite-article-with-definite-form' && 
      issue.range.start === text.indexOf('katten')
    )).toBeTruthy();
  });
  
  test('should handle longer text with multiple sentences', async () => {
    const text = `
      Jeg liker den bok jeg leste i går. 
      En boken på bordet er min. 
      Stolen er komfortabel.
      I huset finnes det mange rom.
    `;
    
    const issues = await checker.check(text);
    
    // Should find two issues: missing definite form and indefinite article with definite form
    expect(issues.length).toBeGreaterThan(1);
  });
  
  test('should provide useful suggestions for corrections', async () => {
    const text = 'Den bok er interessant.'; // Should be "Den boken er interessant"
    
    const issues = await checker.check(text);
    
    expect(issues.length).toBeGreaterThan(0);
    const issue = issues.find(i => i.rule === 'missing-definite-form');
    
    expect(issue).toBeTruthy();
    expect(issue.suggestions.length).toBeGreaterThan(0);
    expect(issue.suggestions[0].text).toBe('boken'); // Correct definite form
  });
});