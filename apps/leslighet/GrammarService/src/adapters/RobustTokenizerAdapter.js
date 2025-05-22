// src/adapters/RobustTokenizerAdapter.js
const fs = require('fs');
const path = require('path');

/**
 * RobustTokenizerAdapter
 * Provides advanced tokenization capabilities with specific support for Norwegian language
 */
const TokenizerInterface = require('../interfaces/TokenizerInterface');

/**
 * Enhanced tokenizer specialized for Norwegian text
 */
class RobustTokenizerAdapter extends TokenizerInterface {
  /**
   * Creates a new tokenizer instance
   * @param {Object} options Configuration options
   * @param {string} options.language Language code (default: 'nb-NO' for Norwegian Bokmål)
   * @param {boolean} options.preserveCase Whether to preserve case in tokens
   * @param {boolean} options.includePositions Whether to include character positions in output
   */
  constructor(options = {}) {
    super();
    this._language = options.language || 'nb-NO';
    this._preserveCase = options.preserveCase !== false;
    this._includePositions = options.includePositions === true;
    
    // Norwegian-specific abbreviations
    this._abbreviations = new Set([
      'bl.a.', 'dvs.', 'e.g.', 'etc.', 'f.eks.', 'ibid.', 
      'if.', 'ifm.', 'ift.', 'iht.', 'inkl.', 'jf.', 'kl.', 
      'mht.', 'mm.', 'mv.', 'nr.', 'osv.', 'pga.', 'pkt.', 
      'ref.', 'tlf.', 'vs.'
    ]);
    
    // Word splitting prefixes/suffixes
    this._compoundDelimiters = ['-', '–'];
    
    // Load stopwords
    this._stopwords = this._loadStopwords();
  }
  
  /**
   * Loads Norwegian stopwords from JSON file
   * @returns {Set<string>} Set of stopwords
   * @private
   */
  _loadStopwords() {
    try {
      const stopwordsPath = path.resolve(process.cwd(), 'data/stopwords-no.json');
      if (fs.existsSync(stopwordsPath)) {
        const stopwordsData = JSON.parse(fs.readFileSync(stopwordsPath, 'utf8'));
        return new Set(stopwordsData);
      }
      return new Set();
    } catch (error) {
      console.warn('Failed to load stopwords:', error.message);
      return new Set();
    }
  }
  
  /**
   * Tokenizes text into individual words
   * @param {string} text Input text to tokenize
   * @returns {Array<Object>} Array of token objects
   */
  tokenize(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }
    
    // Pre-process text
    const normalizedText = this._preprocessText(text);
    
    // Split text into sentences first
    const sentences = this._splitIntoSentences(normalizedText);
    
    // Tokenize each sentence separately
    const tokens = [];
    let globalOffset = 0;
    
    for (const sentence of sentences) {
      // Initial splitting by whitespace
      const sentenceTokens = this._tokenizeSentence(sentence, globalOffset);
      tokens.push(...sentenceTokens);
      
      // Update offset for next sentence
      globalOffset += sentence.length + 1; // +1 for the removed sentence delimiter
    }
    
    return tokens;
  }
  
  /**
   * Preprocesses text for tokenization
   * @param {string} text Input text
   * @returns {string} Normalized text
   * @private
   */
  _preprocessText(text) {
    // Replace multiple spaces with single space
    let normalized = text.replace(/\s+/g, ' ');
    
    // Normalize quotes
    normalized = normalized.replace(/[«»"„‟""]/g, '"');
    
    return normalized.trim();
  }
  
  /**
   * Splits text into sentences
   * @param {string} text Input text
   * @returns {Array<string>} Array of sentences
   * @private
   */
  _splitIntoSentences(text) {
    // Basic sentence splitting by punctuation while respecting abbreviations
    const rawSentences = [];
    let currentSentence = '';
    let i = 0;
    
    while (i < text.length) {
      currentSentence += text[i];
      
      // Check for sentence endings
      if (['.', '!', '?'].includes(text[i]) && i + 1 < text.length && /\s/.test(text[i + 1])) {
        // Look back to check if this is an abbreviation
        const lastWord = currentSentence.split(' ').pop();
        if (!this._abbreviations.has(lastWord)) {
          rawSentences.push(currentSentence.trim());
          currentSentence = '';
        }
      }
      
      i++;
    }
    
    // Add the last sentence if there's any text left
    if (currentSentence.trim().length > 0) {
      rawSentences.push(currentSentence.trim());
    }
    
    return rawSentences;
  }
  
  /**
   * Tokenizes a single sentence into words
   * @param {string} sentence The sentence to tokenize
   * @param {number} baseOffset Character offset from the start of the text
   * @returns {Array<Object>} Array of token objects
   * @private
   */
  _tokenizeSentence(sentence, baseOffset = 0) {
    // Split on whitespace first
    const rawTokens = sentence.split(/\s+/);
    const tokens = [];
    let currentOffset = baseOffset;
    
    for (let rawToken of rawTokens) {
      // Skip empty tokens
      if (!rawToken) {
        currentOffset += 1; // For the space
        continue;
      }
      
      // Track the original token position
      const startOffset = currentOffset;
      
      // Handle punctuation and special cases
      const processedTokens = this._processPunctuation(rawToken, startOffset);
      tokens.push(...processedTokens);
      
      // Update the offset
      currentOffset += rawToken.length + 1; // +1 for the space
    }
    
    // Add POS tags based on basic rules
    return this._addPartOfSpeechTags(tokens);
  }
  
  /**
   * Process a token to handle punctuation and compound words
   * @param {string} token The raw token
   * @param {number} startOffset Character offset from the start of the text
   * @returns {Array<Object>} Array of processed token objects
   * @private
   */
  _processPunctuation(token, startOffset) {
    const tokens = [];
    let remaining = token;
    let currentOffset = startOffset;
    
    // Handle leading punctuation
    while (remaining.length > 0 && /^[,.!?;:"(){}\[\]<>]/.test(remaining)) {
      const punctuation = remaining[0];
      tokens.push({
        text: punctuation,
        originalText: punctuation,
        type: 'punctuation',
        ...(this._includePositions ? { startOffset: currentOffset, endOffset: currentOffset + 1 } : {}),
        isStopword: false
      });
      
      remaining = remaining.substring(1);
      currentOffset++;
    }
    
    // Handle compound words with hyphens
    let wordParts = [];
    for (const delimiter of this._compoundDelimiters) {
      if (remaining.includes(delimiter)) {
        wordParts = remaining.split(delimiter);
        
        for (let i = 0; i < wordParts.length; i++) {
          const part = wordParts[i];
          
          if (part) {
            const tokenText = this._preserveCase ? part : part.toLowerCase();
            
            tokens.push({
              text: tokenText,
              originalText: part,
              type: 'word',
              ...(this._includePositions ? { 
                startOffset: currentOffset, 
                endOffset: currentOffset + part.length 
              } : {}),
              isStopword: this._stopwords.has(tokenText.toLowerCase()),
              isCompoundPart: true
            });
            
            currentOffset += part.length;
          }
          
          // Add the delimiter token except for the last part
          if (i < wordParts.length - 1) {
            tokens.push({
              text: delimiter,
              originalText: delimiter,
              type: 'compoundDelimiter',
              ...(this._includePositions ? { 
                startOffset: currentOffset, 
                endOffset: currentOffset + delimiter.length 
              } : {}),
              isStopword: false
            });
            
            currentOffset += delimiter.length;
          }
        }
        
        // If we've processed a compound word, we're done with this token
        if (wordParts.length > 1) {
          remaining = '';
        }
      }
    }
    
    // If anything remains after compound word processing
    if (remaining) {
      // Process the main part of the token
      if (remaining.length > 0) {
        const tokenText = this._preserveCase ? remaining : remaining.toLowerCase();
        
        tokens.push({
          text: tokenText,
          originalText: remaining,
          type: 'word',
          ...(this._includePositions ? { 
            startOffset: currentOffset, 
            endOffset: currentOffset + remaining.length 
          } : {}),
          isStopword: this._stopwords.has(tokenText.toLowerCase())
        });
        
        currentOffset += remaining.length;
      }
    }
    
    // Handle trailing punctuation
    const lastToken = tokens[tokens.length - 1];
    if (lastToken && lastToken.type === 'word') {
      const text = lastToken.text;
      const trailingPunctuation = text.match(/[,.!?;:"]+$/);
      
      if (trailingPunctuation) {
        const punctuation = trailingPunctuation[0];
        const wordPart = text.substring(0, text.length - punctuation.length);
        
        // Update the word token
        lastToken.text = this._preserveCase ? wordPart : wordPart.toLowerCase();
        lastToken.originalText = wordPart;
        lastToken.isStopword = this._stopwords.has(lastToken.text.toLowerCase());
        
        if (this._includePositions) {
          lastToken.endOffset = lastToken.startOffset + wordPart.length;
        }
        
        // Add the punctuation token
        tokens.push({
          text: punctuation,
          originalText: punctuation,
          type: 'punctuation',
          ...(this._includePositions ? { 
            startOffset: lastToken.endOffset, 
            endOffset: lastToken.endOffset + punctuation.length 
          } : {}),
          isStopword: false
        });
      }
    }
    
    return tokens;
  }
  
  /**
   * Adds basic part-of-speech tags to tokens using simple rules
   * @param {Array<Object>} tokens Array of token objects
   * @returns {Array<Object>} Tokens with added POS tags
   * @private
   */
  _addPartOfSpeechTags(tokens) {
    // Common Norwegian determiners
    const determiners = ['en', 'et', 'den', 'det', 'de', 'denne', 'dette', 'disse'];
    
    // Common Norwegian prepositions
    const prepositions = ['i', 'på', 'til', 'fra', 'med', 'av', 'om', 'for', 'ved', 'under', 'over'];
    
    // Common Norwegian conjunctions
    const conjunctions = ['og', 'eller', 'men', 'for', 'så'];
    
    // Apply basic rules for POS tagging
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      
      if (token.type === 'punctuation') {
        token.pos = 'PUNCT';
        continue;
      }
      
      if (token.type === 'compoundDelimiter') {
        token.pos = 'PUNCT';
        continue;
      }
      
      // Convert to lowercase for comparison
      const lower = token.text.toLowerCase();
      
      // Apply basic rules
      if (determiners.includes(lower)) {
        token.pos = 'DET';
      } else if (prepositions.includes(lower)) {
        token.pos = 'ADP';
      } else if (conjunctions.includes(lower)) {
        token.pos = 'CCONJ';
      } else if (/^[0-9]+$/.test(token.text)) {
        token.pos = 'NUM';
      } else if (i > 0 && tokens[i-1].text.toLowerCase() === 'å') {
        // Verbs following 'å' are likely infinitives
        token.pos = 'VERB';
      } else if (token.text.endsWith('er') || token.text.endsWith('ar')) {
        // Common verb endings for present tense
        token.pos = 'VERB';
      } else if (token.text.endsWith('ene') || token.text.endsWith('ane')) {
        // Common noun endings for definite plural
        token.pos = 'NOUN';
      } else {
        // Default to noun
        token.pos = 'NOUN';
      }
    }
    
    return tokens;
  }
  
  /**
   * Tokenizes text and groups tokens into sentences
   * @param {string} text Input text
   * @returns {Array<Array<Object>>} Array of sentences, each containing token objects
   */
  tokenizeBySentence(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }
    
    // Pre-process text
    const normalizedText = this._preprocessText(text);
    
    // Split text into sentences
    const sentences = this._splitIntoSentences(normalizedText);
    
    // Tokenize each sentence separately
    return sentences.map((sentence, index) => {
      const sentenceStartOffset = sentences
        .slice(0, index)
        .reduce((sum, s) => sum + s.length + 1, 0);
        
      return this._tokenizeSentence(sentence, sentenceStartOffset);
    });
  }
}

module.exports = RobustTokenizerAdapter;
