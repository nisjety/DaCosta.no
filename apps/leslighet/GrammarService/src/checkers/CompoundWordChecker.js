/**
 * CompoundWordChecker
 * 
 * Specialized grammar checker for Norwegian compound words.
 * Norwegian differs from English in that compound words should be written as one word,
 * not as separate words as often seen in English.
 */
const GrammarCheckerInterface = require('./GrammarCheckerInterface');

class CompoundWordChecker extends GrammarCheckerInterface {
  /**
   * Create a new CompoundWordChecker
   * @param {Object} options Configuration options
   * @param {number} [options.confidenceThreshold=0.7] Confidence threshold for reporting issues
   * @param {number} [options.maxCompoundParts=3] Maximum number of compound parts to consider
   * @param {Object} dependencies Dependencies
   * @param {Object} dependencies.norwegianDictionary Norwegian dictionary adapter
   */
  constructor(options = {}, dependencies = {}) {
    super();
    this._confidenceThreshold = options.confidenceThreshold || 0.7;
    this._maxCompoundParts = options.maxCompoundParts || 3;
    this._norwegianDictionary = dependencies.norwegianDictionary;
    
    if (!this._norwegianDictionary) {
      throw new Error('CompoundWordChecker requires a Norwegian dictionary adapter');
    }
  }
  
  /**
   * Check text for compound word errors
   * @param {string} text Text to check
   * @returns {Promise<Object>} Object with issues array
   */
  async check(text) {
    if (!text) {
      return { valid: true, issues: [] };
    }
    
    // Split text into words
    const words = this._tokenizeText(text);
    
    const issues = [];
    
    // Analyze sequences of words to find potential compound word errors
    for (let i = 0; i < words.length - 1; i++) {
      // Check pairs of words (most common case for compounds)
      await this._checkWordPair(words[i], words[i+1], text, issues);
      
      // Check for longer compounds with up to maxCompoundParts
      if (i < words.length - 2 && this._maxCompoundParts >= 3) {
        await this._checkWordSequence(words.slice(i, i+3), text, issues);
      }
      
      if (i < words.length - 3 && this._maxCompoundParts >= 4) {
        await this._checkWordSequence(words.slice(i, i+4), text, issues);
      }
    }
    
    return {
      valid: issues.length === 0,
      issues: issues.filter(issue => issue.confidence >= this._confidenceThreshold)
    };
  }
  
  /**
   * Check a pair of words for compound word errors
   * @private
   * @param {Object} firstWord First word
   * @param {Object} secondWord Second word
   * @param {string} originalText Original text
   * @param {Array} issues Issues array to add to
   */
  async _checkWordPair(firstWord, secondWord, originalText, issues) {
    // Skip if either word is not a content word
    if (!this._isContentWord(firstWord.text) || !this._isContentWord(secondWord.text)) {
      return;
    }
    
    const compoundCandidate = firstWord.text + secondWord.text;
    
    // Check if the compound exists in dictionary
    const compoundExists = await this._norwegianDictionary.exists(compoundCandidate);
    
    if (compoundExists) {
      // Check if this is actually a compound or just a coincidence
      const isCompound = await this._norwegianDictionary.isCompoundWord(compoundCandidate);
      
      if (isCompound) {
        // Get components to verify our compound analysis is correct
        const components = await this._norwegianDictionary.getCompoundComponents(compoundCandidate);
        
        // Calculate confidence based on various factors
        const confidence = await this._calculateCompoundConfidence(
          firstWord.text, 
          secondWord.text, 
          compoundCandidate,
          components
        );
        
        if (confidence >= this._confidenceThreshold) {
          issues.push({
            type: 'compound-word',
            message: `Sammensatte ord skrives normalt som ett ord på norsk: "${compoundCandidate}"`,
            position: {
              start: firstWord.start,
              end: secondWord.end
            },
            confidence,
            suggestions: [compoundCandidate],
            original: `${firstWord.text} ${secondWord.text}`
          });
        }
      }
    }
  }
  
  /**
   * Check a sequence of words for compound word errors
   * @private
   * @param {Array<Object>} words Sequence of words
   * @param {string} originalText Original text
   * @param {Array} issues Issues array to add to
   */
  async _checkWordSequence(words, originalText, issues) {
    if (words.length < 3) return;
    
    // Skip if any word is not a content word
    if (!words.every(word => this._isContentWord(word.text))) {
      return;
    }
    
    const compoundCandidate = words.map(word => word.text).join('');
    
    // Check if the compound exists in dictionary
    const compoundExists = await this._norwegianDictionary.exists(compoundCandidate);
    
    if (compoundExists) {
      // Check if this is actually a compound or just a coincidence
      const isCompound = await this._norwegianDictionary.isCompoundWord(compoundCandidate);
      
      if (isCompound) {
        // Get components to verify our compound analysis is correct
        const components = await this._norwegianDictionary.getCompoundComponents(compoundCandidate);
        
        // For longer compounds, we want to be more confident
        const baseConfidence = 0.6 + (0.1 * Math.min(components ? components.length : 0, words.length));
        
        // Calculate confidence based on various factors
        const confidence = await this._calculateCompoundConfidence(
          words.map(word => word.text),
          null,
          compoundCandidate,
          components,
          baseConfidence
        );
        
        if (confidence >= this._confidenceThreshold) {
          issues.push({
            type: 'compound-word',
            message: `Sammensatte ord skrives normalt som ett ord på norsk: "${compoundCandidate}"`,
            position: {
              start: words[0].start,
              end: words[words.length - 1].end
            },
            confidence,
            suggestions: [compoundCandidate],
            original: words.map(word => word.text).join(' ')
          });
        }
      }
    }
  }
  
  /**
   * Calculate confidence score for a compound word suggestion
   * @private
   * @param {string|Array<string>} firstPart First part of compound (or array of parts)
   * @param {string|null} secondPart Second part of compound (or null if firstPart is array)
   * @param {string} compoundWord Full compound word
   * @param {Array<string>|null} components Component analysis from dictionary
   * @param {number} [baseConfidence=0.7] Base confidence score to adjust
   * @returns {Promise<number>} Confidence score (0-1)
   */
  async _calculateCompoundConfidence(firstPart, secondPart, compoundWord, components, baseConfidence = 0.7) {
    let confidence = baseConfidence;
    let parts;
    
    if (Array.isArray(firstPart)) {
      parts = firstPart;
    } else {
      parts = [firstPart, secondPart];
    }
    
    // If we have component analysis, boost confidence if it matches our parts
    if (components && components.length === parts.length) {
      // Check if parts match components (approximately)
      let matchCount = 0;
      for (let i = 0; i < Math.min(parts.length, components.length); i++) {
        if (components[i].toLowerCase().includes(parts[i].toLowerCase()) || 
            parts[i].toLowerCase().includes(components[i].toLowerCase())) {
          matchCount++;
        }
      }
      
      const matchRatio = matchCount / parts.length;
      confidence += (matchRatio * 0.2); // Up to 0.2 boost for matching components
    }
    
    // Get word info for the compound
    const wordInfo = await this._norwegianDictionary.getWordInfo(compoundWord);
    
    // If we have frequency information, use it to adjust confidence
    if (wordInfo && wordInfo.frequency) {
      // Higher frequency = higher confidence
      confidence += Math.min(0.2, wordInfo.frequency / 1000);
    }
    
    // For shorter compounds, be more strict to avoid false positives
    if (compoundWord.length < 8) {
      confidence -= 0.1;
    }
    
    // Special case: known English-style compounds that should be written separately in Norwegian
    // These are rare exceptions to the rule
    const englishStyleCompounds = ['e post', 'e mail', 'web side', 'new york', 'los angeles'];
    const normalizedOriginal = parts.join(' ').toLowerCase();
    
    if (englishStyleCompounds.includes(normalizedOriginal)) {
      confidence -= 0.3;
    }
    
    // Adjust for part of speech if available
    if (wordInfo && wordInfo.grammaticalFeatures) {
      // Noun compounds are more common than other types
      const isNounCompound = wordInfo.grammaticalFeatures.some(
        f => f.partOfSpeech === 'substantiv'
      );
      
      if (isNounCompound) {
        confidence += 0.05;
      }
    }
    
    // Ensure confidence is in valid range
    return Math.max(0, Math.min(1, confidence));
  }
  
  /**
   * Check if word is a content word that could form part of a compound
   * @private
   * @param {string} word Word to check
   * @returns {boolean} Whether this is a content word
   */
  _isContentWord(word) {
    // Ignore very short words, likely prepositions or articles
    if (word.length < 2) return false;
    
    // Ignore common words that shouldn't form compounds
    const nonContentWords = ['og', 'eller', 'men', 'for', 'som', 'med', 'til', 'på', 'av', 'den', 'det', 'de'];
    return !nonContentWords.includes(word.toLowerCase());
  }
  
  /**
   * Simple tokenization of text into words with positions
   * @private
   * @param {string} text Text to tokenize
   * @returns {Array<Object>} Array of word objects with positions
   */
  _tokenizeText(text) {
    const words = [];
    const regex = /\b[\wæøåÆØÅ]+\b/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      words.push({
        text: match[0],
        start: match.index,
        end: match.index + match[0].length
      });
    }
    
    return words;
  }
}

module.exports = CompoundWordChecker;