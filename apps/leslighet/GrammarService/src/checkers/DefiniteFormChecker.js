/**
 * DefiniteFormChecker.js
 * 
 * Specialized checker for Norwegian definite form grammar rules
 * Handles rules such as:
 * - Correct use of definite forms with determiners ("den", "det", "de")
 * - Double definiteness requirements (where both the article and the noun need definite forms)
 * - Inconsistent definiteness in phrases
 */

'use strict';

const GrammarCheckerInterface = require('./GrammarCheckerInterface');

/**
 * Specialized checker for Norwegian definite form usage rules
 * @implements {GrammarCheckerInterface}
 */
class DefiniteFormChecker extends GrammarCheckerInterface {
  /**
   * @param {Object} options - Configuration options
   * @param {number} [options.confidenceThreshold=0.8] - Confidence threshold for reporting issues
   * @param {boolean} [options.checkNestedPrepositions=true] - Whether to check definiteness in nested prepositional phrases
   * @param {Object} dependencies - Required dependencies
   * @param {import('../adapters/NorwegianDictionaryAdapter')} dependencies.norwegianDictionary - Norwegian dictionary adapter
   */
  constructor(options = {}, dependencies = {}) {
    super();
    
    this._confidenceThreshold = options.confidenceThreshold || 0.8;
    this._checkNestedPrepositions = options.checkNestedPrepositions !== false;
    
    if (!dependencies.norwegianDictionary) {
      throw new Error('DefiniteFormChecker requires norwegianDictionary dependency');
    }
    
    this._norwegianDictionary = dependencies.norwegianDictionary;
    
    // Norwegian determiners that require definite form
    this._definiteRequiringDeterminers = new Set([
      'den', 'det', 'de', 'denne', 'dette', 'disse'
    ]);
    
    // Norwegian indefinite articles that conflict with definite form
    this._indefiniteArticles = new Set([
      'en', 'et', 'ei'
    ]);
    
    // Norwegian prepositions that often appear in prepositional phrases
    this._prepositions = new Set([
      'i', 'på', 'til', 'fra', 'med', 'av', 'om', 'for', 'ved',
      'under', 'over', 'bak', 'foran', 'mellom', 'blant'
    ]);
    
    // Norwegian possessives that come after the noun
    this._postNounPossessives = new Set([
      'min', 'mi', 'mitt', 'mine', 
      'din', 'di', 'ditt', 'dine',
      'sin', 'si', 'sitt', 'sine',
      'vår', 'vårt', 'våre',
      'deres'
    ]);
  }
  
  /**
   * Check text for Norwegian definite form issues
   * @param {string} text - The text to check
   * @returns {Promise<Array<Object>>} - Array of grammar issues found
   */
  async check(text) {
    const issues = [];
    
    // Tokenize the text into words and punctuation
    const tokens = await this._tokenize(text);
    
    // Check for definite form issues in the tokenized text
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      
      // Skip non-word tokens
      if (token.type !== 'word') continue;
      
      // Check for missing definite form after definite determiners
      await this._checkMissingDefiniteForm(tokens, i, issues);
      
      // Check for incorrect use of indefinite article with definite form
      await this._checkIndefiniteWithDefinite(tokens, i, issues);
      
      // Check for inconsistent definiteness in prepositional phrases
      if (this._checkNestedPrepositions) {
        await this._checkPrepositionalPhraseConsistency(tokens, i, issues);
      }
    }
    
    return issues;
  }
  
  /**
   * Tokenize text into words and punctuation
   * @param {string} text - The text to tokenize
   * @returns {Promise<Array<Object>>} - Array of tokens with positions
   * @private
   */
  async _tokenize(text) {
    // Simple tokenization by whitespace and some punctuation
    const tokens = [];
    let currentPos = 0;
    
    // Split on whitespace and keep track of positions
    const words = text.split(/(\s+|[,.!?;:()[\]{}])/);
    
    for (const word of words) {
      if (!word.trim()) {
        // Skip empty strings and just advance position
        currentPos += word.length;
        continue;
      }
      
      const start = currentPos;
      const end = currentPos + word.length;
      
      // Determine token type
      let type = 'word';
      if (/^[,.!?;:()[\]{}]$/.test(word)) {
        type = 'punctuation';
      } else if (/^\s+$/.test(word)) {
        type = 'whitespace';
      }
      
      tokens.push({
        text: word,
        start,
        end,
        type,
        // Add morphological info for word tokens
        ...(type === 'word' ? { 
          lemma: await this._norwegianDictionary.getLemma(word.toLowerCase()),
          isDefinite: await this._isDefiniteForm(word.toLowerCase()),
          posTag: await this._norwegianDictionary.getPartOfSpeech(word.toLowerCase())
        } : {})
      });
      
      currentPos = end;
    }
    
    return tokens;
  }
  
  /**
   * Check if a word is in definite form
   * @param {string} word - The word to check
   * @returns {Promise<boolean>} - Whether the word is in definite form
   * @private
   */
  async _isDefiniteForm(word) {
    // First check if the word is a noun
    const posTag = await this._norwegianDictionary.getPartOfSpeech(word);
    if (posTag !== 'substantiv') return false;
    
    // For Norwegian nouns, definite forms typically end with -en, -et, -a, or -ene
    const definiteEndings = ['en', 'et', 'a', 'ene', 'ne'];
    
    // Check if word ends with a definite ending
    for (const ending of definiteEndings) {
      if (word.endsWith(ending)) {
        // Verify with dictionary to avoid false positives
        const forms = await this._norwegianDictionary.getWordForms(word);
        if (forms && forms.some(form => 
          form.grammaticalFeatures && 
          form.grammaticalFeatures.definiteness === 'bestemt'
        )) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Check for missing definite form after definite determiners
   * @param {Array<Object>} tokens - Tokenized text
   * @param {number} index - Current token index
   * @param {Array<Object>} issues - Issues array to add to
   * @private
   */
  async _checkMissingDefiniteForm(tokens, index, issues) {
    const token = tokens[index];
    
    // Skip if not a word or if it's the last token
    if (token.type !== 'word' || index === tokens.length - 1) return;
    
    // Check if the current token is a definite determiner
    if (this._definiteRequiringDeterminers.has(token.text.toLowerCase())) {
      // Look for the next noun
      let nounIndex = -1;
      let adjectiveFound = false;
      
      for (let i = index + 1; i < tokens.length && i <= index + 5; i++) {
        if (tokens[i].type !== 'word') continue;
        
        const posTag = await this._norwegianDictionary.getPartOfSpeech(tokens[i].text.toLowerCase());
        
        if (posTag === 'adjektiv') {
          adjectiveFound = true;
          continue;
        }
        
        if (posTag === 'substantiv') {
          nounIndex = i;
          break;
        }
      }
      
      // If we found a noun, check if it's in definite form
      if (nounIndex !== -1) {
        const noun = tokens[nounIndex];
        
        // In Norwegian, after a definite determiner, the noun should be in definite form (double definiteness)
        if (!await this._isDefiniteForm(noun.text.toLowerCase())) {
          // Get the definite form suggestion
          const definiteForm = await this._getDefiniteFormSuggestion(noun.text);
          
          issues.push({
            rule: 'missing-definite-form',
            message: adjectiveFound 
              ? `With a definite determiner and adjective, the noun should be in definite form: "${token.text} ... ${noun.text}" → "${token.text} ... ${definiteForm}"`
              : `With a definite determiner, the noun should be in definite form: "${token.text} ${noun.text}" → "${token.text} ${definiteForm}"`,
            range: {
              start: noun.start,
              end: noun.end
            },
            severity: 'error',
            confidence: 0.85,
            suggestions: definiteForm ? [{
              text: definiteForm,
              confidence: 0.9
            }] : []
          });
        }
      }
    }
  }
  
  /**
   * Check for incorrect use of indefinite article with definite form
   * @param {Array<Object>} tokens - Tokenized text
   * @param {number} index - Current token index
   * @param {Array<Object>} issues - Issues array to add to
   * @private
   */
  async _checkIndefiniteWithDefinite(tokens, index, issues) {
    const token = tokens[index];
    
    // Skip if not a word or if it's the last token
    if (token.type !== 'word' || index === tokens.length - 1) return;
    
    // Check if the current token is an indefinite article
    if (this._indefiniteArticles.has(token.text.toLowerCase())) {
      // Look for the next noun
      let nounIndex = -1;
      
      for (let i = index + 1; i < tokens.length && i <= index + 3; i++) {
        if (tokens[i].type !== 'word') continue;
        
        const posTag = await this._norwegianDictionary.getPartOfSpeech(tokens[i].text.toLowerCase());
        
        if (posTag === 'substantiv') {
          nounIndex = i;
          break;
        }
      }
      
      // If we found a noun, check if it's in definite form
      if (nounIndex !== -1) {
        const noun = tokens[nounIndex];
        
        // In Norwegian, after an indefinite article, the noun should be in indefinite form
        if (await this._isDefiniteForm(noun.text.toLowerCase())) {
          // Get the indefinite form suggestion
          const indefiniteForm = await this._getIndefiniteFormSuggestion(noun.text);
          
          issues.push({
            rule: 'indefinite-article-with-definite-form',
            message: `After an indefinite article, the noun should be in indefinite form: "${token.text} ${noun.text}" → "${token.text} ${indefiniteForm}"`,
            range: {
              start: noun.start,
              end: noun.end
            },
            severity: 'error',
            confidence: 0.9,
            suggestions: indefiniteForm ? [{
              text: indefiniteForm,
              confidence: 0.85
            }] : []
          });
        }
      }
    }
  }
  
  /**
   * Check for inconsistent definiteness in prepositional phrases
   * @param {Array<Object>} tokens - Tokenized text
   * @param {number} index - Current token index
   * @param {Array<Object>} issues - Issues array to add to
   * @private
   */
  async _checkPrepositionalPhraseConsistency(tokens, index, issues) {
    const token = tokens[index];
    
    // Skip if not a preposition
    if (token.type !== 'word' || !this._prepositions.has(token.text.toLowerCase())) {
      return;
    }
    
    // Find previous noun and next noun
    let prevNounIndex = -1;
    let nextNounIndex = -1;
    
    // Look back for previous noun (limited context)
    for (let i = index - 1; i >= 0 && i >= index - 5; i--) {
      if (tokens[i].type !== 'word') continue;
      
      const posTag = await this._norwegianDictionary.getPartOfSpeech(tokens[i].text.toLowerCase());
      
      if (posTag === 'substantiv') {
        prevNounIndex = i;
        break;
      }
    }
    
    // Look ahead for next noun (limited context)
    for (let i = index + 1; i < tokens.length && i <= index + 5; i++) {
      if (tokens[i].type !== 'word') continue;
      
      const posTag = await this._norwegianDictionary.getPartOfSpeech(tokens[i].text.toLowerCase());
      
      if (posTag === 'substantiv') {
        nextNounIndex = i;
        break;
      }
    }
    
    // If we found both nouns, check for definiteness consistency
    if (prevNounIndex !== -1 && nextNounIndex !== -1) {
      const prevNoun = tokens[prevNounIndex];
      const nextNoun = tokens[nextNounIndex];
      
      const prevIsDefinite = await this._isDefiniteForm(prevNoun.text.toLowerCase());
      const nextIsDefinite = await this._isDefiniteForm(nextNoun.text.toLowerCase());
      
      // Check if there's a possessive after the next noun
      let hasPostNounPossessive = false;
      
      if (nextNounIndex + 1 < tokens.length && tokens[nextNounIndex + 1].type === 'word') {
        hasPostNounPossessive = this._postNounPossessives.has(
          tokens[nextNounIndex + 1].text.toLowerCase()
        );
      }
      
      // In Norwegian prepositional phrases, definiteness should typically be consistent
      // Unless there's a possessive after the noun (which implies definiteness)
      if (prevIsDefinite !== nextIsDefinite && !hasPostNounPossessive) {
        // Suggest making the next noun match the definiteness of the previous noun
        const suggestion = prevIsDefinite 
          ? await this._getDefiniteFormSuggestion(nextNoun.text)
          : await this._getIndefiniteFormSuggestion(nextNoun.text);
        
        issues.push({
          rule: 'inconsistent-definiteness',
          message: prevIsDefinite
            ? `In a prepositional phrase, the noun after the preposition should match the definiteness of the subject: "${nextNoun.text}" → "${suggestion}"`
            : `In a prepositional phrase, the noun after the preposition should match the definiteness of the subject: "${nextNoun.text}" → "${suggestion}"`,
          range: {
            start: nextNoun.start,
            end: nextNoun.end
          },
          severity: 'warning',
          confidence: 0.75,
          suggestions: suggestion ? [{
            text: suggestion,
            confidence: 0.8
          }] : []
        });
      }
    }
  }
  
  /**
   * Get definite form suggestion for a noun
   * @param {string} noun - The indefinite noun
   * @returns {Promise<string>} - The definite form suggestion
   * @private
   */
  async _getDefiniteFormSuggestion(noun) {
    const lemma = await this._norwegianDictionary.getLemma(noun.toLowerCase());
    if (!lemma) return noun + 'en'; // Fallback if lemma not found
    
    const forms = await this._norwegianDictionary.getWordForms(lemma);
    
    // Find definite singular form
    const definiteForm = forms.find(form => 
      form.grammaticalFeatures && 
      form.grammaticalFeatures.definiteness === 'bestemt' && 
      form.grammaticalFeatures.number === 'entall'
    );
    
    return definiteForm ? definiteForm.form : noun + 'en';
  }
  
  /**
   * Get indefinite form suggestion for a noun
   * @param {string} noun - The definite noun
   * @returns {Promise<string>} - The indefinite form suggestion
   * @private
   */
  async _getIndefiniteFormSuggestion(noun) {
    const lemma = await this._norwegianDictionary.getLemma(noun.toLowerCase());
    if (!lemma) {
      // Fallback if lemma not found: remove common definite endings
      if (noun.endsWith('en')) return noun.slice(0, -2);
      if (noun.endsWith('et')) return noun.slice(0, -2);
      if (noun.endsWith('a')) return noun.slice(0, -1);
      if (noun.endsWith('ene')) return noun.slice(0, -3);
      return noun;
    }
    
    const forms = await this._norwegianDictionary.getWordForms(lemma);
    
    // Find indefinite singular form
    const indefiniteForm = forms.find(form => 
      form.grammaticalFeatures && 
      form.grammaticalFeatures.definiteness === 'ubestemt' && 
      form.grammaticalFeatures.number === 'entall'
    );
    
    return indefiniteForm ? indefiniteForm.form : lemma;
  }
}

module.exports = DefiniteFormChecker;
