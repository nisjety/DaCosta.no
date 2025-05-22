  // src/examples/grammar-checking.js
  const { startGrammarService } = require('../../app');
  
  async function checkGrammar() {
    try {
      // Start grammar service
      const { analyzer, container } = await startGrammarService();
      
      // Get composite grammar checker
      const grammarChecker = container.get('compositeGrammarChecker');
      
      // Check some text
      const text = "Min bilen er rød. Jeg liker min nye bilen. Nå jeg går til skolen.";
      const issues = await grammarChecker.check(text, 'bokmål');
      
      console.log(`Found ${issues.length} grammar issues:`);
      for (const issue of issues) {
        console.log(`- ${issue.type}: "${issue.issue}" -> "${issue.suggestion || '(no suggestion)'}" (${issue.explanation})`);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }
  
  // Run example
  checkGrammar();