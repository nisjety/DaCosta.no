/**
 * NounDeclensionChecker.js
 * Enhanced checker for Norwegian noun declension issues including definite form detection
 */
const GrammarCheckerInterface = require('./GrammarCheckerInterface');

/**
 * Implementation of grammar checker focused on noun declension in Norwegian
 * Enhanced to use Norsk Ordbank morphological data
 */
class NounDeclensionChecker extends GrammarCheckerInterface {
  /**
   * @param {NorwegianDictionaryAdapter} norwegianDictionary - Norwegian dictionary adapter
   * @param {Object} options - Configuration options
   */
  constructor(norwegianDictionary, options = {}) {
    super();
    this.dictionary = norwegianDictionary;
    this.options = {
      maxSuggestions: 3,
      checkPluralForms: true,
      checkDefiniteForms: true,
      ...options
    };
  }

  /**
   * Check grammar rules related to noun declension
   * @param {string} text - Text to check
   * @returns {Promise<Array<Object>>} Array of grammar errors found
   */
  async checkGrammar(text) {
    if (!text) return [];
    
    // Initialize dictionary if needed
    if (this.dictionary && !this.dictionary.loaded) {
      await this.dictionary.initialize();
    }
    
    const errors = [];
    
    // Tokenize text into sentences
    const sentences = this.tokenizeSentences(text);
    
    for (const sentence of sentences) {
      const tokens = this.tokenizeWords(sentence.text);
      
      // Check for incorrect noun forms
      const nounErrors = await this.checkNounForms(sentence.text, tokens, sentence.offset);
      errors.push(...nounErrors);
    }
    
    return errors;
  }

  /**
   * Check for incorrect noun forms in a sentence
   * @param {string} sentenceText - Full sentence text
   * @param {Array<string>} tokens - Tokenized words
   * @param {number} offset - Character offset of sentence in original text
   * @returns {Promise<Array<Object>>} Array of grammar errors found
   * @private
   */
  async checkNounForms(sentenceText, tokens, offset = 0) {
    const errors = [];
    
    // Check each word that might be a noun
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      
      // Skip short words and likely non-nouns
      if (token.length < 3 || /[,.!?;:(){}[\]<>]/.test(token)) {
        continue;
      }
      
      // Check if the word is a noun
      const pos = await this.dictionary.getPartOfSpeech(token);
      if (pos !== 'noun') continue;
      
      // Check for potential issues in agreement with preceding words
      if (i > 0) {
        const errors1 = await this.checkNounAgreement(sentenceText, tokens[i-1], token, offset, i);
        errors.push(...errors1);
      }
      
      // Check for potential incorrect plural forms
      if (this.options.checkPluralForms) {
        const errors2 = await this.checkPluralForm(sentenceText, token, offset, i);
        errors.push(...errors2);
      }
      
      // Check for potential incorrect definite forms
      if (this.options.checkDefiniteForms) {
        const errors3 = await this.checkDefiniteForm(sentenceText, token, offset, i);
        errors.push(...errors3);
      }
    }
    
    return errors;
  }

  /**
   * Check for noun agreement with preceding determiners, numbers, etc.
   * @param {string} sentenceText - Full sentence text
   * @param {string} precedingWord - Word preceding the noun
   * @param {string} noun - The noun to check
   * @param {number} offset - Character offset of sentence
   * @param {number} nounIndex - Token index of noun
   * @returns {Promise<Array<Object>>} Array of grammar errors found
   * @private
   */
  async checkNounAgreement(sentenceText, precedingWord, noun, offset, nounIndex) {
    const errors = [];
    
    // Get information about the words
    const precedingPos = await this.dictionary.getPartOfSpeech(precedingWord);
    const nounInfo = await this.dictionary.lookup(noun);
    
    if (!nounInfo) return errors;
    
    // Check number agreement
    if (precedingPos === 'determiner' || precedingPos === 'adjective') {
      // Check for determiners that require definite or indefinite form
      const requiresDefinite = ['den', 'det', 'de', 'denne', 'dette', 'disse'].includes(precedingWord.toLowerCase());
      const requiresIndefinite = ['en', 'ei', 'et', 'ett'].includes(precedingWord.toLowerCase());
      
      const isDefinite = this.isDefiniteForm(noun, nounInfo);
      const tokenPos = this.findTokenPosition(sentenceText, noun, nounIndex);
      
      // Check if definite form is required but missing
      if (requiresDefinite && !isDefinite) {
        const suggestions = await this.getSuggestedDefiniteForm(noun, nounInfo);
        
        errors.push({
          type: 'definite_form_required',
          message: `"${precedingWord}" krever at substantivet står i bestemt form`,
          severity: 'error',
          offset: offset + tokenPos,
          length: noun.length,
          suggestions: suggestions.slice(0, this.options.maxSuggestions)
        });
      }
      
      // Check if indefinite form is required but missing
      if (requiresIndefinite && isDefinite) {
        const suggestions = await this.getSuggestedIndefiniteForm(noun, nounInfo);
        
        errors.push({
          type: 'indefinite_form_required',
          message: `"${precedingWord}" krever at substantivet står i ubestemt form`,
          severity: 'error',
          offset: offset + tokenPos,
          length: noun.length,
          suggestions: suggestions.slice(0, this.options.maxSuggestions)
        });
      }
      
      // Check gender agreement
      if (requiresIndefinite && nounInfo.gender) {
        const gender = nounInfo.gender;
        let genderMismatch = false;
        
        // Check gender agreement for indefinite articles
        if (precedingWord.toLowerCase() === 'en' && gender !== 'mask') {
          genderMismatch = true;
        } else if (precedingWord.toLowerCase() === 'ei' && gender !== 'fem') {
          genderMismatch = true;
        } else if ((precedingWord.toLowerCase() === 'et' || precedingWord.toLowerCase() === 'ett') && gender !== 'nøyt') {
          genderMismatch = true;
        }
        
        if (genderMismatch) {
          const correctArticle = this.getCorrectArticle(gender);
          const precedingPos = this.findTokenPosition(sentenceText, precedingWord, nounIndex - 1);
          
          errors.push({
            type: 'article_gender_mismatch',
            message: `Artikkelen "${precedingWord}" passer ikke med substantivets kjønn (${gender})`,
            severity: 'error',
            offset: offset + precedingPos,
            length: precedingWord.length,
            suggestions: correctArticle ? [correctArticle] : []
          });
        }
      }
    }
    
    // Check for numeral agreement
    else if (precedingPos === 'numeral' || /^\d+$/.test(precedingWord)) {
      const numberValue = parseInt(precedingWord, 10);
      
      // Only check if we can parse a number value
      if (!isNaN(numberValue)) {
        const tokenPos = this.findTokenPosition(sentenceText, noun, nounIndex);
        const isPlural = this.isPluralForm(noun, nounInfo);
        
        // For numbers greater than 1, noun should be in plural
        if (numberValue > 1 && !isPlural) {
          const suggestions = await this.getSuggestedPluralForm(noun, nounInfo);
          
          errors.push({
            type: 'plural_form_required',
            message: `Etter tall som "${precedingWord}" bør substantivet stå i flertallsform`,
            severity: 'error',
            offset: offset + tokenPos,
            length: noun.length,
            suggestions: suggestions.slice(0, this.options.maxSuggestions)
          });
        }
      }
    }
    
    return errors;
  }

  /**
   * Check for potential incorrect plural forms
   * @param {string} sentenceText - Full sentence text
   * @param {string} noun - The noun to check
   * @param {number} offset - Character offset of sentence
   * @param {number} tokenIndex - Token index of noun
   * @returns {Promise<Array<Object>>} Array of grammar errors found
   * @private
   */
  async checkPluralForm(sentenceText, noun, offset, tokenIndex) {
    const errors = [];
    
    // Skip common pronouns and proper nouns
    if (noun.match(/^[A-ZÆØÅ]/)) return errors;
    
    const nounInfo = await this.dictionary.lookup(noun);
    if (!nounInfo) return errors;
    
    // Check if the noun exists in our dictionary as is
    const exists = await this.dictionary.exists(noun);
    if (!exists) {
      // If not found, see if any of its potential correct forms exist
      const isProperForm = this.isDefiniteForm(noun, nounInfo) || this.isPluralForm(noun, nounInfo);
      
      if (!isProperForm) {
        // Try to find valid forms (inflections)
        const inflections = await this.dictionary.getInflections(noun);
        
        if (inflections && inflections.length > 0) {
          // If we found inflections but the current form isn't valid,
          // suggest corrections
          const tokenPos = this.findTokenPosition(sentenceText, noun, tokenIndex);
          
          errors.push({
            type: 'unknown_noun_form',
            message: `"${noun}" er ikke en gyldig bøyningsform`,
            severity: 'warning',
            offset: offset + tokenPos,
            length: noun.length,
            suggestions: inflections.slice(0, this.options.maxSuggestions)
          });
        }
      }
    }
    
    return errors;
  }

  /**
   * Check for potential incorrect definite form usage
   * @param {string} sentenceText - Full sentence text
   * @param {string} noun - The noun to check
   * @param {number} offset - Character offset of sentence
   * @param {number} tokenIndex - Token index of noun
   * @returns {Promise<Array<Object>>} Array of grammar errors found
   * @private
   */
  async checkDefiniteForm(sentenceText, noun, offset, tokenIndex) {
    // This method is for future expansion
    // Currently, most definite form checks are handled in checkNounAgreement
    return [];
  }

  /**
   * Get the correct article for a given gender
   * @param {string} gender - The gender to get article for
   * @returns {string|null} The correct article or null
   * @private
   */
  getCorrectArticle(gender) {
    if (gender === 'mask') return 'en';
    if (gender === 'fem') return 'ei';
    if (gender === 'nøyt') return 'et';
    return null;
  }

  /**
   * Check if a noun is in definite form
   * @param {string} noun - The noun to check
   * @param {Object} nounInfo - Dictionary info for the noun
   * @returns {boolean} True if the noun is in definite form
   * @private
   */
  isDefiniteForm(noun, nounInfo) {
    // Common definite endings in Norwegian
    return noun.endsWith('en') || 
           noun.endsWith('et') || 
           noun.endsWith('a') ||
           (nounInfo.wordClass?.tags && nounInfo.wordClass.tags.includes('be'));
  }

  /**
   * Check if a noun is in plural form
   * @param {string} noun - The noun to check
   * @param {Object} nounInfo - Dictionary info for the noun
   * @returns {boolean} True if the noun is in plural form
   * @private
   */
  isPluralForm(noun, nounInfo) {
    // Common plural endings in Norwegian
    return noun.endsWith('er') || 
           noun.endsWith('ene') || 
           noun.endsWith('ar') || 
           noun.endsWith('ane') ||
           noun.endsWith('r') ||
           (nounInfo.wordClass?.tags && nounInfo.wordClass.tags.includes('fl'));
  }

  /**
   * Get suggested definite form for a noun
   * @param {string} noun - The noun
   * @param {Object} nounInfo - Dictionary info for the noun
   * @returns {Promise<Array<string>>} Suggested definite forms
   * @private
   */
  async getSuggestedDefiniteForm(noun, nounInfo) {
    try {
      // Get all inflections
      const inflections = await this.dictionary.getInflections(nounInfo.lemma || noun);
      
      if (!inflections || inflections.length === 0) {
        // Fallback to common definite endings based on gender
        if (nounInfo.gender === 'mask') return [noun + 'en'];
        if (nounInfo.gender === 'fem') return [noun + 'a', noun + 'en'];
        if (nounInfo.gender === 'nøyt') return [noun + 'et'];
        return [noun + 'en']; // Default
      }
      
      // Find definite forms among inflections
      const definiteForms = inflections.filter(form => {
        return form.endsWith('en') || form.endsWith('et') || form.endsWith('a');
      });
      
      return definiteForms.length > 0 ? definiteForms : [noun + 'en'];
    } catch (error) {
      console.error(`Error getting suggested definite form for "${noun}":`, error);
      return [noun + 'en']; // Default fallback
    }
  }

  /**
   * Get suggested indefinite form for a noun
   * @param {string} noun - The noun
   * @param {Object} nounInfo - Dictionary info for the noun
   * @returns {Promise<Array<string>>} Suggested indefinite forms
   * @private
   */
  async getSuggestedIndefiniteForm(noun, nounInfo) {
    try {
      // Get lemma (base form)
      const lemma = nounInfo.lemma || noun;
      
      // Get all inflections
      const inflections = await this.dictionary.getInflections(lemma);
      
      if (!inflections || inflections.length === 0) {
        // If the noun ends with a common definite ending, try to remove it
        if (noun.endsWith('en')) return [noun.substring(0, noun.length - 2)];
        if (noun.endsWith('et')) return [noun.substring(0, noun.length - 2)];
        if (noun.endsWith('a')) return [noun.substring(0, noun.length - 1)];
        return [lemma]; // Default to lemma
      }
      
      // Find indefinite singular forms among inflections
      const indefiniteForms = inflections.filter(form => {
        // Indefinite forms usually don't have these definite endings
        return !form.endsWith('en') && !form.endsWith('et') && 
               !form.endsWith('a') && !form.endsWith('er') && 
               !form.endsWith('ene') && !form.endsWith('ar') && 
               !form.endsWith('ane');
      });
      
      return indefiniteForms.length > 0 ? indefiniteForms : [lemma];
    } catch (error) {
      console.error(`Error getting suggested indefinite form for "${noun}":`, error);
      return [noun]; // Default fallback
    }
  }

  /**
   * Get suggested plural form for a noun
   * @param {string} noun - The noun
   * @param {Object} nounInfo - Dictionary info for the noun
   * @returns {Promise<Array<string>>} Suggested plural forms
   * @private
   */
  async getSuggestedPluralForm(noun, nounInfo) {
    try {
      // Get lemma (base form)
      const lemma = nounInfo.lemma || noun;
      
      // Get all inflections
      const inflections = await this.dictionary.getInflections(lemma);
      
      if (!inflections || inflections.length === 0) {
        // Fallback to common plural endings based on gender
        if (nounInfo.gender === 'mask') return [lemma + 'er'];
        if (nounInfo.gender === 'fem') return [lemma + 'er'];
        if (nounInfo.gender === 'nøyt') return [lemma + 'er', lemma];
        return [lemma + 'er']; // Default
      }
      
      // Find plural forms among inflections
      const pluralForms = inflections.filter(form => {
        return form.endsWith('er') || form.endsWith('ene') || 
               form.endsWith('ar') || form.endsWith('ane') ||
               (form !== lemma && form.endsWith('r'));
      });
      
      return pluralForms.length > 0 ? pluralForms : [lemma + 'er'];
    } catch (error) {
      console.error(`Error getting suggested plural form for "${noun}":`, error);
      return [noun + 'er']; // Default fallback
    }
  }

  /**
   * Find the position of a token in a sentence
   * @param {string} sentence - The sentence text
   * @param {string} token - The token to find
   * @param {number} expectedIndex - Expected token index for disambiguation
   * @returns {number} Position of token in sentence
   * @private
   */
  findTokenPosition(sentence, token, expectedIndex = 0) {
    if (!sentence || !token) return 0;
    
    // Try to find the token
    let pos = 0;
    let count = 0;
    let startPos = 0;
    
    while ((pos = sentence.indexOf(token, startPos)) !== -1) {
      if (count === expectedIndex) {
        return pos;
      }
      startPos = pos + token.length;
      count++;
    }
    
    return sentence.indexOf(token); // Fallback
  }

  /**
   * Tokenize text into sentences
   * @param {string} text - Text to tokenize
   * @returns {Array<{text: string, offset: number}>} Array of sentences with offsets
   * @private
   */
  tokenizeSentences(text) {
    if (!text) return [];
    
    // Simple sentence tokenization using common Norwegian sentence endings
    const sentenceRegex = /([.!?])\s+(?=[A-ZÆØÅ])|([.!?])$/g;
    const sentences = [];
    let lastIndex = 0;
    let match;
    
    while ((match = sentenceRegex.exec(text)) !== null) {
      const endIndex = match.index + match[0].length;
      const sentenceText = text.substring(lastIndex, endIndex).trim();
      
      if (sentenceText) {
        sentences.push({
          text: sentenceText,
          offset: lastIndex
        });
      }
      
      lastIndex = endIndex;
    }
    
    // Add the last sentence if any
    if (lastIndex < text.length) {
      const sentenceText = text.substring(lastIndex).trim();
      if (sentenceText) {
        sentences.push({
          text: sentenceText,
          offset: lastIndex
        });
      }
    }
    
    return sentences;
  }

  /**
   * Tokenize a sentence into words
   * @param {string} sentence - Sentence to tokenize
   * @returns {Array<string>} Array of tokens
   * @private
   */
  tokenizeWords(sentence) {
    if (!sentence) return [];
    
    // Simple word tokenization
    // Split on spaces and punctuation but keep the tokens
    return sentence.split(/(\s+|[,.!?;:"'()\[\]{}<>])/g)
      .filter(token => token.trim().length > 0);
  }
}

module.exports = NounDeclensionChecker;
