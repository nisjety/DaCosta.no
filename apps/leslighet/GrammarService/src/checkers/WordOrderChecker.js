// src/checkers/WordOrderChecker.js
const GrammarCheckerInterface = require('./GrammarCheckerInterface');

/**
 * WordOrderChecker
 * 
 * Specialized checker for Norwegian syntax and word order issues
 * Leverages UD Treebank data for syntactic pattern validation
 */
class WordOrderChecker extends GrammarCheckerInterface {
  /**
   * Create a new WordOrderChecker
   * 
   * @param {Object} options - Configuration options
   * @param {number} [options.confidenceThreshold=0.7] - Confidence threshold for flagging issues
   * @param {Object} dependencies - Required dependencies
   * @param {Object} dependencies.udTreebank - Universal Dependencies treebank adapter
   * @param {Object} dependencies.tokenizer - Tokenizer adapter
   */
  constructor(options = {}, dependencies = {}) {
    super();
    this._confidenceThreshold = options.confidenceThreshold || 0.7;
    this._udTreebank = dependencies.udTreebank;
    this._tokenizer = dependencies.tokenizer;
    
    if (!this._udTreebank) {
      throw new Error('WordOrderChecker requires a UD Treebank adapter');
    }
    
    if (!this._tokenizer) {
      throw new Error('WordOrderChecker requires a tokenizer');
    }
    
    // Norwegian syntax patterns
    this._initSyntaxPatterns();
  }
  
  /**
   * Initialize Norwegian syntax validation patterns
   * @private
   */
  _initSyntaxPatterns() {
    // Common word order patterns for Norwegian main clauses
    this._mainClausePatterns = [
      // SVO: Subject-Verb-Object
      ['NOUN|PRON', 'VERB', 'NOUN|PRON'],
      ['NOUN|PRON', 'VERB', 'ADP', 'NOUN|PRON'], // With preposition
      
      // Adverb in second position (V2 rule)
      ['ADV', 'VERB', 'NOUN|PRON'],
      
      // Question patterns
      ['VERB', 'NOUN|PRON'],
      ['VERB', 'PRON', 'NOUN'],
      
      // Imperative
      ['VERB', 'NOUN|PRON']
    ];
    
    // Subordinate clause patterns
    this._subordinateClausePatterns = [
      // Subject-Object-Verb pattern in subordinate clauses
      ['SCONJ', 'NOUN|PRON', 'NOUN|PRON', 'VERB'],
      ['SCONJ', 'NOUN|PRON', 'ADV', 'VERB'],
      ['SCONJ', 'NOUN|PRON', 'VERB']
    ];
    
    // Negation placement patterns
    this._negationPatterns = [
      // Main clause negation (after finite verb)
      ['NOUN|PRON', 'VERB', 'ADV:ikke'],
      
      // Subordinate clause negation (before finite verb)
      ['SCONJ', 'NOUN|PRON', 'ADV:ikke', 'VERB']
    ];
    
    // Common invalid patterns
    this._invalidPatterns = [
      // English-style double determiners (not valid in Norwegian)
      ['DET', 'DET', 'NOUN'],
      
      // Incorrect adverbial placement
      ['NOUN', 'ADV', 'VERB'],
      
      // Incorrect negation placement
      ['VERB', 'NOUN', 'ADV:ikke']
    ];
  }
  
  /**
   * Check text for word order issues
   * 
   * @param {string} text - Text to check
   * @returns {Promise<Object>} - Checking results with issues
   */
  async check(text) {
    if (!text || typeof text !== 'string') {
      return { valid: true, issues: [] };
    }
    
    try {
      // Tokenize text by sentences
      const sentenceTokens = await this._tokenizer.tokenizeBySentence(text);
      
      const issues = [];
      
      // Check each sentence
      for (let i = 0; i < sentenceTokens.length; i++) {
        const sentenceIssues = await this._checkSentence(sentenceTokens[i], i);
        issues.push(...sentenceIssues);
      }
      
      return {
        valid: issues.length === 0,
        issues
      };
    } catch (error) {
      console.error('Error in WordOrderChecker:', error);
      return {
        valid: false,
        issues: [{
          type: 'internal-error',
          message: 'Error checking word order',
          confidence: 1,
          position: { start: 0, end: text.length }
        }]
      };
    }
  }
  
  /**
   * Check a single sentence for word order issues
   * 
   * @param {Array<Object>} tokens - Tokens in the sentence
   * @param {number} sentenceIndex - Index of the sentence in the text
   * @returns {Promise<Array<Object>>} - Array of issues
   * @private
   */
  async _checkSentence(tokens, sentenceIndex) {
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return [];
    }
    
    const issues = [];
    
    // Get sentence text from tokens
    const sentenceText = tokens.map(token => token.originalText).join(' ');
    
    // Extract POS sequence
    const posSequence = tokens.map(token => token.pos || 'UNKNOWN');
    
    // Calculate sentence start position
    const sentenceStartPos = tokens[0].startOffset || 0;
    const sentenceEndPos = tokens[tokens.length - 1].endOffset || sentenceText.length;
    
    // Check if sentence follows valid patterns using UD Treebank data
    const syntaxAnalysis = await this._udTreebank.analyzeSyntax(tokens);
    
    if (!syntaxAnalysis.valid) {
      // Process each syntax issue found
      for (const syntaxIssue of syntaxAnalysis.issues) {
        // Calculate exact position of the issue
        let issueStartPos = sentenceStartPos;
        let issueEndPos = sentenceEndPos;
        
        if (syntaxIssue.position) {
          const startTokenIndex = Math.max(0, syntaxIssue.position.start);
          const endTokenIndex = Math.min(tokens.length - 1, syntaxIssue.position.end);
          
          if (tokens[startTokenIndex].startOffset !== undefined) {
            issueStartPos = tokens[startTokenIndex].startOffset;
          }
          
          if (tokens[endTokenIndex].endOffset !== undefined) {
            issueEndPos = tokens[endTokenIndex].endOffset;
          }
        }
        
        // Create a normalized issue object
        issues.push({
          type: 'word-order',
          message: this._getSyntaxErrorMessage(syntaxIssue),
          confidence: syntaxIssue.confidence || 0.7,
          position: { 
            start: issueStartPos,
            end: issueEndPos
          },
          suggestions: await this._generateSuggestions(tokens, syntaxIssue)
        });
      }
    }
    
    // Perform additional checks for specific Norwegian syntax rules
    await this._checkNegationPlacement(tokens, issues);
    await this._checkV2Rule(tokens, issues);
    await this._checkAdjectivePlacement(tokens, issues);
    
    return issues;
  }
  
  /**
   * Gets a user-friendly error message for syntax issues
   * 
   * @param {Object} syntaxIssue - The syntax issue object
   * @returns {string} - User-friendly error message
   * @private
   */
  _getSyntaxErrorMessage(syntaxIssue) {
    if (syntaxIssue.message) {
      return syntaxIssue.message;
    }
    
    // Default message
    return 'Uvanlig ordrekkefølge. Vurder å omformulere setningen.';
  }
  
  /**
   * Generate suggestions to fix word order issues
   * 
   * @param {Array<Object>} tokens - Tokens in the sentence
   * @param {Object} issue - The issue object
   * @returns {Promise<Array<string>>} - Array of suggestions
   * @private
   */
  async _generateSuggestions(tokens, issue) {
    // Simple case: return original if we can't generate suggestions
    if (!tokens || tokens.length === 0) {
      return [];
    }
    
    // Extract original texts in order
    const originalTokens = tokens.map(token => token.originalText);
    
    // For position-specific issues, try to find better orderings
    if (issue.position && issue.type === 'word-order') {
      const startIdx = Math.max(0, issue.position.start);
      const endIdx = Math.min(tokens.length - 1, issue.position.end);
      
      // Only handle issues that span a reasonable number of words
      if (endIdx - startIdx <= 5) {
        const problematicTokens = tokens.slice(startIdx, endIdx + 1);
        
        // Try some common reorderings based on Norwegian syntax
        const suggestions = [];
        
        // Check if it might be a V2 rule violation
        if (this._isLikelyV2Violation(problematicTokens)) {
          const reordered = [...originalTokens];
          
          // Move the verb to second position
          for (let i = startIdx; i <= endIdx; i++) {
            if (tokens[i].pos === 'VERB') {
              // Remove verb from current position
              const verb = reordered.splice(i, 1)[0];
              // Insert at position 1 (after first token)
              reordered.splice(1, 0, verb);
              break;
            }
          }
          
          suggestions.push(reordered.join(' '));
        }
        
        // Try moving adjectives before nouns for adjective placement issues
        if (this._isLikelyAdjectivePlacementIssue(problematicTokens)) {
          const reordered = [...originalTokens];
          
          for (let i = startIdx; i < endIdx; i++) {
            if (tokens[i].pos === 'NOUN' && tokens[i+1].pos === 'ADJ') {
              // Swap adjective and noun
              [reordered[i], reordered[i+1]] = [reordered[i+1], reordered[i]];
              break;
            }
          }
          
          suggestions.push(reordered.join(' '));
        }
        
        // Return suggestions if we found any
        if (suggestions.length > 0) {
          return suggestions;
        }
      }
    }
    
    // If we can't generate a specific suggestion, return empty array
    return [];
  }
  
  /**
   * Check if tokens violate the V2 rule (verb in second position)
   * 
   * @param {Array<Object>} tokens - Token sequence
   * @returns {boolean} - Whether it's likely a V2 violation
   * @private
   */
  _isLikelyV2Violation(tokens) {
    if (tokens.length < 3) return false;
    
    // Check if there's a verb beyond position 2
    let hasFrontSubject = false;
    let verbPosition = -1;
    
    for (let i = 0; i < tokens.length; i++) {
      if (i === 0 && (tokens[i].pos === 'NOUN' || tokens[i].pos === 'PRON')) {
        hasFrontSubject = true;
      }
      
      if (tokens[i].pos === 'VERB') {
        verbPosition = i;
        break;
      }
    }
    
    // V2 violation: subject followed by non-verb in position 2
    return hasFrontSubject && verbPosition > 1;
  }
  
  /**
   * Check if tokens contain adjective placement issues
   * 
   * @param {Array<Object>} tokens - Token sequence
   * @returns {boolean} - Whether there's an adjective placement issue
   * @private
   */
  _isLikelyAdjectivePlacementIssue(tokens) {
    for (let i = 0; i < tokens.length - 1; i++) {
      // In Norwegian, adjectives usually come before nouns
      if (tokens[i].pos === 'NOUN' && tokens[i+1].pos === 'ADJ') {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Check for proper negation placement in Norwegian sentences
   * 
   * @param {Array<Object>} tokens - Tokens in the sentence
   * @param {Array<Object>} issues - Issues array to add to
   * @returns {Promise<void>}
   * @private
   */
  async _checkNegationPlacement(tokens, issues) {
    // Check for "ikke" (not) placement
    const negationIndex = tokens.findIndex(token => 
      token.text.toLowerCase() === 'ikke'
    );
    
    if (negationIndex === -1) return; // No negation in this sentence
    
    // Find main verb position
    const verbIndices = tokens
      .map((token, index) => token.pos === 'VERB' ? index : -1)
      .filter(index => index !== -1);
      
    if (verbIndices.length === 0) return; // No verb found
    
    const mainVerbIndex = verbIndices[0];
    
    // In main clauses: negation should come after the main verb
    // Check if this looks like a main clause
    const isLikelySubordinateClause = tokens.some(token => 
      ['at', 'som', 'fordi', 'når', 'hvis', 'dersom'].includes(token.text.toLowerCase())
    );
    
    if (!isLikelySubordinateClause) {
      // In main clauses: negation after finite verb
      if (negationIndex < mainVerbIndex) {
        const startPos = tokens[negationIndex].startOffset || 0;
        const endPos = tokens[negationIndex].endOffset || startPos + 4; // "ikke"
        
        issues.push({
          type: 'negation-placement',
          message: 'I hovedsetninger skal nektelsen "ikke" plasseres etter det finitte verbet.',
          confidence: 0.85,
          position: {
            start: startPos,
            end: endPos
          },
          suggestions: [this._generateNegationSuggestion(tokens, negationIndex, mainVerbIndex)]
        });
      }
    } else {
      // In subordinate clauses: negation before finite verb
      if (negationIndex > mainVerbIndex) {
        const startPos = tokens[negationIndex].startOffset || 0;
        const endPos = tokens[negationIndex].endOffset || startPos + 4; // "ikke"
        
        issues.push({
          type: 'negation-placement',
          message: 'I leddsetninger skal nektelsen "ikke" vanligvis plasseres før det finitte verbet.',
          confidence: 0.8,
          position: {
            start: startPos,
            end: endPos
          },
          suggestions: [this._generateNegationSuggestion(tokens, negationIndex, mainVerbIndex, true)]
        });
      }
    }
  }
  
  /**
   * Generate suggestion for negation placement
   * 
   * @param {Array<Object>} tokens - Original tokens
   * @param {number} negationIndex - Current position of negation
   * @param {number} verbIndex - Position of main verb
   * @param {boolean} isSubordinate - Whether this is a subordinate clause
   * @returns {string} - Suggested correction
   * @private
   */
  _generateNegationSuggestion(tokens, negationIndex, verbIndex, isSubordinate = false) {
    const originalTexts = tokens.map(token => token.originalText);
    const result = [...originalTexts];
    
    // Remove negation from current position
    result.splice(negationIndex, 1);
    
    if (isSubordinate) {
      // Place negation before verb for subordinate clauses
      result.splice(verbIndex, 0, 'ikke');
    } else {
      // Place negation after verb for main clauses
      result.splice(verbIndex + 1, 0, 'ikke');
    }
    
    return result.join(' ');
  }
  
  /**
   * Check for adherence to Norwegian V2 rule (verb in second position in main clauses)
   * 
   * @param {Array<Object>} tokens - Tokens in the sentence
   * @param {Array<Object>} issues - Issues array to add to
   * @returns {Promise<void>}
   * @private
   */
  async _checkV2Rule(tokens, issues) {
    // Skip very short sentences or likely subordinate clauses
    if (tokens.length < 4) return;
    
    const isLikelySubordinateClause = tokens.some(token => 
      ['at', 'som', 'fordi', 'når', 'hvis', 'dersom'].includes(token.text.toLowerCase())
    );
    
    if (isLikelySubordinateClause) return;
    
    // Find verb positions
    const verbPositions = tokens
      .map((token, index) => token.pos === 'VERB' ? index : -1)
      .filter(index => index !== -1);
    
    // Check if the first verb is in position other than 1 (0-indexed, so position 2)
    if (verbPositions.length > 0 && verbPositions[0] > 1) {
      // Check if we have a topicalized element + subject before the verb
      const possibleElements = tokens.slice(0, verbPositions[0]);
      const hasTwoNominalElements = possibleElements
        .filter(token => token.pos === 'NOUN' || token.pos === 'PRON').length >= 2;
      
      if (hasTwoNominalElements) {
        const firstVerbPos = verbPositions[0];
        
        issues.push({
          type: 'v2-rule',
          message: 'Hovedsetninger skal følge V2-regelen med verbet på andreplass.',
          confidence: 0.75,
          position: {
            start: tokens[0].startOffset || 0,
            end: tokens[Math.min(firstVerbPos + 1, tokens.length - 1)].endOffset || 0
          },
          suggestions: [this._generateV2Suggestion(tokens, firstVerbPos)]
        });
      }
    }
  }
  
  /**
   * Generate suggestion to fix V2 rule violation
   * 
   * @param {Array<Object>} tokens - Original tokens
   * @param {number} verbPosition - Current position of the verb
   * @returns {string} - Suggested correction
   * @private
   */
  _generateV2Suggestion(tokens, verbPosition) {
    const originalTexts = tokens.map(token => token.originalText);
    const result = [...originalTexts];
    
    // Extract the verb
    const verb = result.splice(verbPosition, 1)[0];
    
    // Insert after first element (position 1)
    result.splice(1, 0, verb);
    
    return result.join(' ');
  }
  
  /**
   * Check adjective placement (adjectives come before nouns in Norwegian)
   * 
   * @param {Array<Object>} tokens - Tokens in the sentence
   * @param {Array<Object>} issues - Issues array to add to
   * @returns {Promise<void>}
   * @private
   */
  async _checkAdjectivePlacement(tokens, issues) {
    for (let i = 0; i < tokens.length - 1; i++) {
      if (tokens[i].pos === 'NOUN' && tokens[i+1].pos === 'ADJ') {
        // Check if this is likely a real issue (there are exceptions)
        // Skip cases with certain verbs between them that allow this structure
        if (i > 0 && ['er', 'var', 'blir', 'ble'].includes(tokens[i-1].text.toLowerCase())) {
          continue;
        }
        
        issues.push({
          type: 'adjective-placement',
          message: 'I norsk kommer adjektiver vanligvis før substantivet.',
          confidence: 0.7,
          position: {
            start: tokens[i].startOffset || 0,
            end: tokens[i+1].endOffset || 0
          },
          suggestions: [this._generateAdjectiveSuggestion(tokens, i, i+1)]
        });
      }
    }
  }
  
  /**
   * Generate suggestion to fix adjective placement
   * 
   * @param {Array<Object>} tokens - Original tokens
   * @param {number} nounIndex - Position of the noun
   * @param {number} adjectiveIndex - Position of the adjective
   * @returns {string} - Suggested correction
   * @private
   */
  _generateAdjectiveSuggestion(tokens, nounIndex, adjectiveIndex) {
    const originalTexts = tokens.map(token => token.originalText);
    const result = [...originalTexts];
    
    // Swap the noun and adjective
    [result[nounIndex], result[adjectiveIndex]] = [result[adjectiveIndex], result[nounIndex]];
    
    return result.join(' ');
  }
}

module.exports = WordOrderChecker;
