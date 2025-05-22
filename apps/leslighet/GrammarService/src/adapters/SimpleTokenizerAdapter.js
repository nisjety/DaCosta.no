// src/adapters/SimpleTokenizerAdapter.js
const TokenizerInterface = require('../interfaces/TokenizerInterface');

/**
 * Simple tokenizer implementation that splits text by whitespace
 */
class SimpleTokenizerAdapter extends TokenizerInterface {
  /**
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super();
    this.options = {
      preserveWhitespace: false,
      preservePunctuation: true,
      normalizeCase: false,
      ...options
    };

    // RegEx pattern to match word boundaries
    this._wordBoundaryPattern = /[\s.,:;!?'"()[\]{}«»„"‟""'‚''‹›]/;
    
    // RegEx to identify punctuation
    this._punctuationPattern = /[.,:;!?'"()[\]{}«»„"‟""'‚''‹›-]/;
    
    // RegEx to identify whitespace
    this._whitespacePattern = /\s+/;
  }

  /**
   * Tokenize text into an array of tokens
   * @param {string} text - The text to tokenize
   * @returns {Array<{text: string, type: string, start: number, end: number}>} - Array of tokens with position info
   */
  tokenize(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const tokens = [];
    let currentTokenStart = 0;
    let currentTokenText = '';
    let inToken = false;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const isPunctuation = this._punctuationPattern.test(char);
      const isWhitespace = this._whitespacePattern.test(char);
      
      // Handle punctuation
      if (isPunctuation) {
        if (inToken) {
          // End current token
          tokens.push({
            text: currentTokenText,
            type: 'word',
            start: currentTokenStart,
            end: i
          });
          inToken = false;
          currentTokenText = '';
        }
        
        if (this.options.preservePunctuation) {
          tokens.push({
            text: char,
            type: 'punctuation',
            start: i,
            end: i + 1
          });
        }
        
        currentTokenStart = i + 1;
        continue;
      }
      
      // Handle whitespace
      if (isWhitespace) {
        if (inToken) {
          // End current token
          tokens.push({
            text: currentTokenText,
            type: 'word',
            start: currentTokenStart,
            end: i
          });
          inToken = false;
          currentTokenText = '';
        }
        
        if (this.options.preserveWhitespace) {
          tokens.push({
            text: char,
            type: 'whitespace',
            start: i,
            end: i + 1
          });
        }
        
        currentTokenStart = i + 1;
        continue;
      }
      
      // Handle regular character
      if (!inToken) {
        inToken = true;
        currentTokenStart = i;
        currentTokenText = char;
      } else {
        currentTokenText += char;
      }
    }
    
    // Handle any remaining token
    if (inToken) {
      tokens.push({
        text: currentTokenText,
        type: 'word',
        start: currentTokenStart,
        end: text.length
      });
    }
    
    // Apply case normalization if needed
    if (this.options.normalizeCase) {
      for (const token of tokens) {
        if (token.type === 'word') {
          token.text = token.text.toLowerCase();
        }
      }
    }
    
    return tokens;
  }
  
  /**
   * Split text into sentences
   * @param {string} text - The text to split
   * @returns {Array<{text: string, start: number, end: number}>} - Array of sentences with position info
   */
  splitSentences(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }
    
    const sentences = [];
    let currentStart = 0;
    let inQuote = false;
    let quoteChar = '';
    
    // Regex to match sentence ending punctuation followed by space or quote
    // This is a simplified approach that won't handle all cases perfectly
    const sentenceEndPattern = /[.!?][\s"'»)]|[.!?]$/g;
    
    let match;
    while ((match = sentenceEndPattern.exec(text)) !== null) {
      // Check if we're in a quoted section
      let i = currentStart;
      while (i < match.index) {
        if ((text[i] === '"' || text[i] === "'" || text[i] === '«') && !inQuote) {
          inQuote = true;
          quoteChar = text[i] === '«' ? '»' : text[i];
        } else if (text[i] === quoteChar && inQuote) {
          inQuote = false;
        }
        i++;
      }
      
      // Skip if we're in a quoted section
      if (inQuote) {
        continue;
      }
      
      const end = match.index + 1;
      
      // Check for common abbreviations to avoid false sentence breaks
      const precedingWord = text.substring(Math.max(0, match.index - 5), match.index).trim();
      const isAbbreviation = this._isCommonAbbreviation(precedingWord);
      
      if (!isAbbreviation) {
        sentences.push({
          text: text.substring(currentStart, end).trim(),
          start: currentStart,
          end
        });
        
        currentStart = end;
      }
    }
    
    // Add the last sentence if there's remaining text
    if (currentStart < text.length) {
      sentences.push({
        text: text.substring(currentStart).trim(),
        start: currentStart,
        end: text.length
      });
    }
    
    return sentences;
  }
  
  /**
   * Check if word is a common abbreviation
   * @param {string} word - Word to check
   * @returns {boolean} - True if it's an abbreviation
   * @private
   */
  _isCommonAbbreviation(word) {
    // Common Norwegian abbreviations that end with a period
    const commonAbbreviations = [
      'dr', 'prof', 'ca', 'f.eks', 'bl.a', 'osv', 'dvs', 
      'mr', 'mrs', 'ms', 'jr', 'sr', 'etc'
    ];
    
    return commonAbbreviations.some(abbr => 
      word.toLowerCase().endsWith(abbr.toLowerCase())
    );
  }
  
  /**
   * Extract keywords from text
   * @param {string} text - The text to analyze
   * @param {Object} options - Options for keyword extraction
   * @returns {Array<string>} - Array of keywords
   */
  extractKeywords(text, options = {}) {
    const tokens = this.tokenize(text);
    const wordTokens = tokens.filter(token => token.type === 'word');
    
    // Simple keyword extraction just returns unique words
    // More sophisticated implementations would use NLP techniques
    const uniqueWords = new Set();
    
    for (const token of wordTokens) {
      let word = token.text;
      
      // Normalize for keyword extraction
      word = word.toLowerCase();
      
      if (word.length > 2) { // Filter out very short words
        uniqueWords.add(word);
      }
    }
    
    return Array.from(uniqueWords);
  }
}

module.exports = SimpleTokenizerAdapter;
