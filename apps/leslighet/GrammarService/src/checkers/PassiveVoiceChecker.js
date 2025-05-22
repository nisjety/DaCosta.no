// src/checkers/PassiveVoiceChecker.js
const { GrammarCheckerInterface } = require('../interfaces/GrammarCheckerInterface');

/**
 * Checker for passive voice usage in Norwegian text
 */
class PassiveVoiceChecker extends GrammarCheckerInterface {
  /**
   * @param {DictionaryInterface} dictionary - Dictionary for word lookups
   */
  constructor(dictionary) {
    super();
    this.dictionary = dictionary;
    
    // Common Norwegian passive indicators
    this.passiveIndicators = [
      'blir', 'ble', 'blitt',  // Becoming passive
      'er', 'var', 'vært'      // Being passive
    ];
    
    // Norwegian -s passive suffix patterns
    this.sSuffixPattern = /[a-zæøå]+(es|as|s)$/i;
    
    // Words that look like passive but aren't
    this.falsePositives = new Set([
      // Common words ending in 's'
      'ananas', 'adresse', 'finnes', 'minnes', 'sans', 'følelse', 'service', 
      'status', 'virus', 'kurs', 'suksesstatus', 'sms',
      // Names and proper nouns
      'mars', 'venus', 'andreas', 'anders', 'hans', 'lars', 'thomas',
      // Possessives and pronouns
      'hennes', 'hans', 'deres', 'dets', 'ens', 'sin', 'sins',
      // English loan words
      'files', 'windows', 'news', 'apps', 'notes',
      // Other non-passive words
      'kos', 'ros', 'gress', 'fjes', 'stress', 'suss', 'sats', 'puls',
      'ellers', 'mens', 'tvers', 'alltids', 'innenbords', 'utenbords'
    ]);
  }

  /**
   * Check text for passive voice usage
   * @param {string} text - Text to check
   * @param {string} dialect - Norwegian dialect ('nb' or 'nn')
   * @param {Object} options - Check options
   * @returns {Promise<Array>} Issues found
   */
  async check(text, dialect, options = {}) {
    if (!text) return [];

    // If no tokens provided, do basic tokenization
    const tokens = options.tokens || this.basicTokenize(text);
    
    const issues = [];
    
    // Process tokens sequentially to find passive constructions
    for (let i = 0; i < tokens.length - 1; i++) {
      // Check for auxiliary + past participle passive (blir/er + past participle)
      const auxPassive = await this.checkAuxiliaryPassive(tokens, i);
      if (auxPassive) {
        issues.push(auxPassive);
        continue;
      }
      
      // Check for s-passive (verb + s)
      if (i < tokens.length) {  // Safety check
        const sPassive = await this.checkSPassive(tokens[i]);
        if (sPassive) {
          issues.push(sPassive);
        }
      }
    }
    
    // If no tokens or no issues found yet, try pattern-based detection
    if ((tokens.length === 0 || issues.length === 0) && text) {
      const patternIssues = this.checkPatternBasedPassive(text);
      issues.push(...patternIssues);
    }
    
    return issues;
  }
  
  /**
   * Basic tokenization for when no tokens are provided
   * @param {string} text - Text to tokenize
   * @returns {Array} Basic token array
   */
  basicTokenize(text) {
    if (!text) return [];
    
    const tokens = [];
    let position = 0;
    
    // Simple split by whitespace
    const words = text.split(/\s+/);
    
    for (const word of words) {
      if (!word) continue;
      
      const trimmedWord = word.trim();
      if (trimmedWord.length === 0) continue;
      
      position = text.indexOf(trimmedWord, position);
      if (position === -1) continue;
      
      // Create simple token with form and position
      tokens.push({
        form: trimmedWord,
        position,
        lemma: this.simpleLemmatize(trimmedWord),
        upos: this.guessPartOfSpeech(trimmedWord)
      });
      
      position += trimmedWord.length;
    }
    
    return tokens;
  }
  
  /**
   * Simple lemmatization (very basic!)
   * @param {string} word - Word to lemmatize
   * @returns {string} Simple lemma
   */
  simpleLemmatize(word) {
    // Very simple lemmatization for common verb forms
    const lowerWord = word.toLowerCase();
    
    if (lowerWord.endsWith('er')) return lowerWord.slice(0, -2);
    if (lowerWord.endsWith('et')) return lowerWord.slice(0, -2);
    if (lowerWord.endsWith('te')) return lowerWord.slice(0, -2);
    if (lowerWord.endsWith('es')) return lowerWord.slice(0, -2);
    
    return lowerWord;
  }
  
  /**
   * Basic part of speech guess
   * @param {string} word - Word to guess POS for
   * @returns {string} Guessed part of speech
   */
  guessPartOfSpeech(word) {
    if (!word) return 'X';
    
    const lowerWord = word.toLowerCase();
    
    // Check if it's likely a verb
    if (this.passiveIndicators.includes(lowerWord)) {
      return 'VERB';
    }
    
    // Check for verb endings
    if (lowerWord.endsWith('er') || 
        lowerWord.endsWith('te') || 
        lowerWord.endsWith('de') ||
        lowerWord.endsWith('et') ||
        lowerWord.endsWith('dd')) {
      return 'VERB';
    }
    
    // Default
    return 'X';
  }
  
  /**
   * Check text for pattern-based passive voice detection
   * @param {string} text - Text to check
   * @returns {Array} Issues found
   */
  checkPatternBasedPassive(text) {
    if (!text) return [];
    
    const issues = [];
    
    // Patterns for auxiliary + past participle
    const patterns = [
      { 
        pattern: /\b(ble|blir|blitt)\s+(\w+[td])\b/gi,
        type: 'bli_passive'
      },
      { 
        pattern: /\b(er|var|vært)\s+(\w+[td])\b/gi,
        type: 'være_passive'
      }
    ];
    
    for (const { pattern, type } of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const auxiliary = match[1];
        const participle = match[2];
        
        // Skip some common false positives
        if (participle.toLowerCase() === 'at' || 
            participle.toLowerCase() === 'det') {
          continue;
        }
        
        issues.push({
          type: 'passive_voice',
          position: match.index,
          issue: match[0],
          suggestion: `(consider active voice)`,
          explanation: 'Passive voice construction. Consider using active voice for clearer, more direct communication.',
          severity: 'low',
          isInformational: true
        });
      }
    }
    
    // Patterns for s-passive
    const sPassivePattern = /\b(\w{3,})(es|as|s)\b/gi;
    let match;
    
    while ((match = sPassivePattern.exec(text)) !== null) {
      const word = match[0].toLowerCase();
      
      // Skip false positives
      if (this.falsePositives.has(word)) continue;
      
      // Check if it looks like a verb
      if (this.looksLikeVerb(word)) {
        issues.push({
          type: 'passive_voice',
          position: match.index,
          issue: match[0],
          suggestion: match[1], // Base form without -s
          explanation: 'S-passive voice form. Consider using active voice for clearer, more direct communication.',
          severity: 'low',
          isInformational: true
        });
      }
    }
    
    return issues;
  }
  
  /**
   * Simple check if a word looks like a verb
   * @param {string} word - Word to check
   * @returns {boolean} Whether it looks like a verb
   */
  looksLikeVerb(word) {
    if (!word) return false;
    
    const lowerWord = word.toLowerCase();
    
    // Skip common non-verb words ending with s
    if (this.falsePositives.has(lowerWord)) return false;
    
    // Skip capitalized words (likely proper nouns)
    if (/^[A-ZÆØÅ]/.test(word) && word.length > 1) return false;
    
    // Skip common non-verb endings
    const nonVerbEndings = ['ens', 'ans', 'ers', 'els', 'ets', 'ors'];
    for (const ending of nonVerbEndings) {
      if (lowerWord.endsWith(ending)) return false;
    }
    
    return true;
  }

  /**
   * Check for auxiliary + past participle passive form
   * @param {Array} tokens - Token array
   * @param {number} index - Current token index
   * @returns {Promise<Object|null>} Issue or null if no issue found
   */
  async checkAuxiliaryPassive(tokens, index) {
    const currentToken = tokens[index];
    const nextToken = tokens[index + 1];
    
    if (!currentToken || !nextToken) return null;
    
    // Check if current token is a passive auxiliary
    if (this.passiveIndicators.includes(currentToken.form.toLowerCase()) && 
        nextToken && nextToken.upos === 'VERB') {
      
      // Verify if the next word is a past participle
      const isPastParticiple = await this.isPastParticiple(nextToken.form, nextToken.lemma);
      
      if (isPastParticiple) {
        const passivePhrase = `${currentToken.form} ${nextToken.form}`;
        const activeAlternative = await this.suggestActiveAlternative(currentToken, nextToken);
        
        return {
          type: 'passive_voice',
          position: currentToken.position,
          issue: passivePhrase,
          suggestion: activeAlternative || '(consider active voice)',
          explanation: 'Passive voice construction. Consider using active voice for clearer, more direct communication.',
          severity: 'low',
          isInformational: true
        };
      }
    }
    
    return null;
  }

  /**
   * Check for s-passive form (verb ending in -s)
   * @param {Object} token - Token to check
   * @returns {Promise<Object|null>} Issue or null if no issue found
   */
  async checkSPassive(token) {
    if (!token || !token.form || token.upos !== 'VERB') return null;
    
    const word = token.form.toLowerCase();
    
    // Skip false positives
    if (this.falsePositives.has(word)) return null;
    
    // Check for -s ending characteristic of Norwegian passive
    if (this.sSuffixPattern.test(word) && !word.endsWith('ss')) {
      // Confirm it's a verb form with dictionary if available
      const isRealPassive = await this.confirmSPassive(word, token.lemma);
      
      if (isRealPassive) {
        const activeForm = word.replace(/([a-zæøå]+)(es|as|s)$/, '$1');
        
        return {
          type: 'passive_voice',
          position: token.position,
          issue: word,
          suggestion: activeForm,
          explanation: 'S-passive voice form. Consider using active voice for clearer, more direct communication.',
          severity: 'low',
          isInformational: true
        };
      }
    }
    
    return null;
  }

  /**
   * Confirm if a word with -s ending is truly a passive verb form
   * @param {string} word - Word to check
   * @param {string} lemma - Lemma of the word
   * @returns {Promise<boolean>} Whether word is a passive form
   */
  async confirmSPassive(word, lemma) {
    if (!word) return false;
    
    // If we have a lemma and it's different from the word but without the -s,
    // it's likely not an s-passive but a different form
    const baseForm = word.replace(/([a-zæøå]+)(es|as|s)$/, '$1');
    if (lemma && lemma !== baseForm) {
      return false;
    }
    
    // Check dictionary
    try {
      if (this.dictionary) {
        const result = await this.dictionary.lookup(word);
        if (result && result.entry && result.entry[0]) {
          // Check if dictionary entry mentions passive form
          return result.entry[0].includes('pass');
        }
      }
    } catch (error) {
      console.error(`Error confirming s-passive for "${word}":`, error);
    }
    
    // Default to true if we have a verb with -s ending not in false positives
    return true;
  }

  /**
   * Check if a word is a past participle
   * @param {string} word - Word to check
   * @param {string} lemma - Lemma of the word
   * @returns {Promise<boolean>} Whether word is a past participle
   */
  async isPastParticiple(word, lemma) {
    if (!word) return false;
    
    // Common Norwegian past participle endings
    const ppEndings = [
      't', 'et', 'dd', 'dt', 'tt'
    ];
    
    // Check for typical endings
    for (const ending of ppEndings) {
      if (word.toLowerCase().endsWith(ending)) {
        // If we have the lemma, check if it's different (indicating inflection)
        if (lemma && word.toLowerCase() !== lemma.toLowerCase()) {
          return true;
        }
        
        // Check dictionary
        try {
          if (this.dictionary) {
            const result = await this.dictionary.lookup(word);
            if (result && result.entry && result.entry[0]) {
              return result.entry[0].includes('perf-part');
            }
          }
        } catch (error) {
          console.error(`Error checking past participle for "${word}":`, error);
        }
        
        // Default to true if we have a common ending
        return true;
      }
    }
    
    return false;
  }

  /**
   * Suggest an active voice alternative to a passive construction
   * @param {Object} auxiliaryToken - Auxiliary verb token
   * @param {Object} participleToken - Past participle token
   * @returns {Promise<string>} Suggested active alternative
   */
  async suggestActiveAlternative(auxiliaryToken, participleToken) {
    // This is a simplified suggestion. A more advanced system would need
    // to reconstruct the full sentence with subject and object swapped.
    return `(consider using active voice with "${participleToken.lemma}")`;
  }
}

module.exports = PassiveVoiceChecker;
