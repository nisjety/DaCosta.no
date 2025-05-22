/**
 * Example demonstrating the usage of the Norwegian definite form checker
 * 
 * This example shows how to use the DefiniteFormChecker to identify
 * common issues with definite forms in Norwegian text.
 */

const DefiniteFormChecker = require('../checkers/DefiniteFormChecker');
const NorwegianDictionaryAdapter = require('../adapters/NorwegianDictionaryAdapter');
const path = require('path');

/**
 * Run a definite form check on the provided Norwegian text
 * @param {string} text - Text to check for definite form issues
 */
async function checkDefiniteForm(text) {
  console.log(`Checking text: "${text}"`);
  console.log('-------------');
  
  // Initialize the Norwegian dictionary adapter
  const norwegianDictionary = new NorwegianDictionaryAdapter({
    dataPath: path.resolve(process.cwd(), 'data'),
    useRedis: false,
    cacheEnabled: true
  });
  
  await norwegianDictionary.initialize();
  console.log('Dictionary initialized');
  
  // Create the definite form checker
  const checker = new DefiniteFormChecker({
    confidenceThreshold: 0.7,
    checkNestedPrepositions: true
  }, {
    norwegianDictionary
  });
  
  // Perform the check
  const issues = await checker.check(text);
  
  // Display results
  if (issues.length === 0) {
    console.log('No definite form issues found.');
  } else {
    console.log(`Found ${issues.length} definite form issues:`);
    
    issues.forEach((issue, index) => {
      console.log(`\nIssue ${index + 1}:`);
      console.log(`- Rule: ${issue.rule}`);
      console.log(`- Message: ${issue.message}`);
      console.log(`- Position: ${issue.range.start} to ${issue.range.end}`);
      console.log(`- Confidence: ${issue.confidence.toFixed(2)}`);
      
      if (issue.suggestions && issue.suggestions.length > 0) {
        console.log('- Suggestions:');
        issue.suggestions.forEach(suggestion => {
          console.log(`  * ${suggestion.text} (confidence: ${suggestion.confidence.toFixed(2)})`);
        });
      }
      
      // Mark the issue in the text
      const beforeIssue = text.substring(0, issue.range.start);
      const issueText = text.substring(issue.range.start, issue.range.end);
      const afterIssue = text.substring(issue.range.end);
      
      console.log(`\n${beforeIssue}[${issueText}]${afterIssue}`);
    });
  }
  
  // Clean up resources
  await norwegianDictionary.close();
}

// Example texts with various definite form issues in Norwegian
const exampleTexts = [
  'Den bok er interessant.', // Missing definite form with determiner
  'En boken ligger på bordet.', // Incorrect use of indefinite article with definite form
  'Jeg legger boken på bord.', // Inconsistent definiteness in prepositional phrase
  'Den store hus er fint.', // Missing definite form with adjective
  'Denne huset er stort.', // Incorrect gender agreement
  'Boken min er på bordet.', // Correct: possessive after noun
  'Den store bilen er rød.' // Correct: double definiteness
];

// Run the examples
async function runExamples() {
  console.log('NORWEGIAN DEFINITE FORM CHECKER EXAMPLES');
  console.log('=======================================\n');
  
  for (const text of exampleTexts) {
    await checkDefiniteForm(text);
    console.log('\n---------------------------------------\n');
  }
}

// Execute if this file is run directly
if (require.main === module) {
  runExamples()
    .then(() => console.log('Examples completed.'))
    .catch(error => console.error('Error running examples:', error));
}

module.exports = { checkDefiniteForm };