/**
 * GrammarAnalyzer
 * 
 * Responsible for comprehensive grammar analysis of Norwegian text,
 * integrating multiple grammar checkers and linguistic resources.
 */
class GrammarAnalyzer {
  /**
   * Create a new GrammarAnalyzer
   * 
   * @param {Object} options - Configuration options
   * @param {Object} options.grammarChecker - The grammar checker to use
   * @param {Object} options.dictionary - Norwegian dictionary adapter
   * @param {Object} [options.confidenceThreshold=0.7] - Confidence threshold for grammar issues
   */
  constructor(options = {}) {
    this._grammarChecker = options.grammarChecker;
    this._dictionary = options.dictionary;
    this._confidenceThreshold = options.confidenceThreshold || 0.7;
    this._analyzeCount = 0;
  }
  
  /**
   * Perform comprehensive grammar analysis on text
   * 
   * @param {string} text - The text to analyze
   * @param {Object} [options={}] - Analysis options
   * @param {boolean} [options.includeSuggestions=true] - Whether to include suggestions for corrections
   * @param {boolean} [options.includeExplanations=false] - Whether to include detailed explanations
   * @param {boolean} [options.includeStatistics=false] - Whether to include text statistics
   * @returns {Promise<Object>} - Analysis results including issues and metrics
   */
  async analyzeText(text, options = {}) {
    if (!text || typeof text !== 'string') {
      return { 
        valid: true, 
        issues: [], 
        statistics: this._generateEmptyStatistics() 
      };
    }
    
    const includeSuggestions = options.includeSuggestions !== false;
    const includeExplanations = options.includeExplanations === true;
    const includeStatistics = options.includeStatistics === true;
    
    this._analyzeCount++;
    const startTime = Date.now();
    
    try {
      // Get grammar issues from the grammar checker
      const grammarResults = await this._grammarChecker.check(text);
      
      // Filter issues based on confidence threshold
      const issues = grammarResults.issues
        .filter(issue => issue.confidence >= this._confidenceThreshold)
        .map(issue => {
          // Normalize issue format
          const normalizedIssue = {
            type: issue.type,
            message: issue.message,
            position: issue.position,
            confidence: issue.confidence,
            severity: issue.severity || this._calculateSeverity(issue)
          };
          
          // Add suggestions if requested
          if (includeSuggestions && issue.suggestions) {
            normalizedIssue.suggestions = issue.suggestions;
          }
          
          // Add explanation if requested
          if (includeExplanations) {
            normalizedIssue.explanation = this._getExplanation(issue);
          }
          
          return normalizedIssue;
        });
      
      // Calculate metrics and statistics
      const statistics = includeStatistics 
        ? await this._calculateTextStatistics(text) 
        : this._generateEmptyStatistics();
      
      return {
        valid: issues.length === 0,
        issues,
        statistics,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Error analyzing text:', error);
      return { 
        valid: false, 
        error: 'Analysis failed', 
        message: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }
  
  /**
   * Calculate severity based on issue properties
   * 
   * @param {Object} issue - Grammar issue
   * @returns {string} - Severity level
   * @private
   */
  _calculateSeverity(issue) {
    // Default to medium severity
    if (!issue.confidence) return 'medium';
    
    // Use confidence to determine severity
    if (issue.confidence > 0.9) return 'high';
    if (issue.confidence > 0.75) return 'medium';
    return 'low';
  }
  
  /**
   * Get detailed explanation for grammar issue
   * 
   * @param {Object} issue - Grammar issue
   * @returns {string} - Detailed explanation
   * @private
   */
  _getExplanation(issue) {
    // Map of common grammar issues to explanations in Norwegian
    const explanations = {
      'definite-form': 'I norsk er bestemt form (the/den/det) brukt når man refererer til noe spesifikt som er kjent for både sender og mottaker.',
      'compound-word': 'Sammensatte ord skal i norsk skrives som ett ord, ikke som separate ord som på engelsk.',
      'noun-declension': 'Substantiv i norsk bøyes i kjønn, tall og bestemthet.',
      'article-usage': 'Artikler (en, et, den, det) må samsvare med substantivets kjønn.',
      'word-order': 'Norsk har vanligvis rekkefølgen subjekt-verbal-objekt, men med visse unntak.',
      'passive-voice': 'Passiv form brukes når handlingen er viktigere enn hvem som utfører den.',
      'style-formality': 'Formalitetsnivå i teksten bør være konsistent.'
    };
    
    // Return specific explanation or generic one
    return explanations[issue.type] || 
      'Dette er et potensielt grammatisk problem i norsk tekst.';
  }
  
  /**
   * Calculate comprehensive text statistics
   * 
   * @param {string} text - The text to analyze
   * @returns {Promise<Object>} - Text statistics
   * @private
   */
  async _calculateTextStatistics(text) {
    // Tokenize the text for analysis
    const tokens = await this._grammarChecker.tokenize(text);
    
    if (!tokens || !Array.isArray(tokens)) {
      return this._generateEmptyStatistics();
    }
    
    // Count words, excluding punctuation
    const words = tokens.filter(token => token.type === 'word');
    
    // Count sentences (naively by counting punctuation marks that end sentences)
    const sentenceEndMarks = tokens.filter(token => 
      token.type === 'punctuation' && 
      ['.', '!', '?'].includes(token.text)
    );
    
    const sentenceCount = Math.max(1, sentenceEndMarks.length);
    
    // Count unique words
    const uniqueWords = new Set(words.map(token => token.text.toLowerCase()));
    
    // Count complex words (if dictionary available)
    let complexWordCount = 0;
    if (this._dictionary) {
      for (const token of words) {
        try {
          const wordInfo = await this._dictionary.getWordInfo(token.text);
          if (wordInfo && wordInfo.complexity && wordInfo.complexity > 0.7) {
            complexWordCount++;
          }
        } catch (e) {
          // Ignore errors for individual words
        }
      }
    } else {
      // Fallback - consider words longer than 7 characters as complex
      complexWordCount = words.filter(word => word.text.length > 7).length;
    }
    
    // Calculate readability metrics
    const wordsPerSentence = words.length / sentenceCount;
    const lexicalDiversity = uniqueWords.size / words.length;
    
    return {
      wordCount: words.length,
      uniqueWordCount: uniqueWords.size,
      sentenceCount,
      complexWordCount,
      wordsPerSentence,
      lexicalDiversity,
      fleschKincaidReadabilityScore: this._calculateFleschKincaidScore(words.length, sentenceCount, complexWordCount)
    };
  }
  
  /**
   * Calculate a simplified Flesch-Kincaid readability score
   * (Adjusted for Norwegian language)
   * 
   * @param {number} wordCount - Total words
   * @param {number} sentenceCount - Total sentences
   * @param {number} complexWordCount - Complex words
   * @returns {number} - Readability score
   * @private
   */
  _calculateFleschKincaidScore(wordCount, sentenceCount, complexWordCount) {
    if (wordCount === 0 || sentenceCount === 0) return 0;
    
    // Modified Flesch-Kincaid calculation adjusted for Norwegian
    const sentenceLength = wordCount / sentenceCount;
    const complexWordPercentage = (complexWordCount / wordCount) * 100;
    
    // Higher score means easier to read (0-100 scale)
    const score = 206.835 - (1.015 * sentenceLength) - (0.846 * complexWordPercentage);
    
    // Clamp between 0-100
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Generate empty statistics object when analysis isn't possible
   * 
   * @returns {Object} - Empty statistics
   * @private
   */
  _generateEmptyStatistics() {
    return {
      wordCount: 0,
      uniqueWordCount: 0,
      sentenceCount: 0,
      complexWordCount: 0,
      wordsPerSentence: 0,
      lexicalDiversity: 0,
      fleschKincaidReadabilityScore: 0
    };
  }
  
  /**
   * Get information about this analyzer instance
   * 
   * @returns {Object} - Analyzer information
   */
  getInfo() {
    return {
      analyzeCount: this._analyzeCount,
      confidenceThreshold: this._confidenceThreshold,
      grammarCheckerType: this._grammarChecker.constructor.name,
      dictionaryType: this._dictionary ? this._dictionary.constructor.name : 'None'
    };
  }
}

module.exports = GrammarAnalyzer;
