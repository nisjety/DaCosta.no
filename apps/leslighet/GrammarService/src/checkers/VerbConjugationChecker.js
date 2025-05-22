/**
 * VerbConjugationChecker.js
 * Enhanced checker for Norwegian verb conjugation and tense consistency issues
 */
const GrammarCheckerInterface = require('./GrammarCheckerInterface');

class VerbConjugationChecker extends GrammarCheckerInterface {
  constructor(dictionaryAdapter, tokenizer) {
    super();
    this._dictionaryAdapter = dictionaryAdapter;
    this._tokenizer = tokenizer;
    
    // Map of verbs with their conjugation forms
    this._verbConjugations = new Map();
    
    // Time indicators for tense detection
    this._pastTimeIndicators = ['i går', 'tidligere', 'forrige', 'før', 'hadde', 'var'];
    this._presentTimeIndicators = ['i dag', 'nå', 'akkurat nå', 'for tiden', 'er', 'har'];
    this._futureTimeIndicators = ['i morgen', 'senere', 'snart', 'kommer til å', 'vil', 'skal'];
    
    // Common Norwegian verbs with their conjugations
    this._initializeVerbConjugations();
  }
  
  /**
   * Initialize verb conjugations map with common Norwegian verbs
   * @private
   */
  _initializeVerbConjugations() {
    const commonVerbs = [
      // infinitive, present, past, perfect
      { infinitive: 'å gå', present: 'går', past: 'gikk', perfect: 'gått' },
      { infinitive: 'å kjøpe', present: 'kjøper', past: 'kjøpte', perfect: 'kjøpt' },
      { infinitive: 'å komme', present: 'kommer', past: 'kom', perfect: 'kommet' },
      { infinitive: 'å vente', present: 'venter', past: 'ventet', perfect: 'ventet' },
      { infinitive: 'å hjelpe', present: 'hjelper', past: 'hjalp', perfect: 'hjulpet' },
      { infinitive: 'å si', present: 'sier', past: 'sa', perfect: 'sagt' },
      { infinitive: 'å bli', present: 'blir', past: 'ble', perfect: 'blitt' },
      { infinitive: 'å føle', present: 'føler', past: 'følte', perfect: 'følt' },
      { infinitive: 'å regne', present: 'regner', past: 'regnet', perfect: 'regnet' },
      { infinitive: 'å blåse', present: 'blåser', past: 'blåste', perfect: 'blåst' },
      { infinitive: 'å trenge', present: 'trenger', past: 'trengte', perfect: 'trengt' },
      { infinitive: 'å åpne', present: 'åpner', past: 'åpnet', perfect: 'åpnet' },
      { infinitive: 'å lukke', present: 'lukker', past: 'lukket', perfect: 'lukket' },
    ];
    
    // Build the map for easy lookup
    commonVerbs.forEach(verb => {
      // Store with and without "å" prefix for the infinitive
      const bareInfinitive = verb.infinitive.startsWith('å ') ? verb.infinitive.substring(2) : verb.infinitive;
      
      // Store all forms for lookup in both directions
      this._verbConjugations.set(bareInfinitive, {
        infinitive: bareInfinitive,
        present: verb.present,
        past: verb.past,
        perfect: verb.perfect
      });
      
      this._verbConjugations.set(verb.present, {
        infinitive: bareInfinitive,
        present: verb.present,
        past: verb.past,
        perfect: verb.perfect,
        form: 'present'
      });
      
      this._verbConjugations.set(verb.past, {
        infinitive: bareInfinitive,
        present: verb.present,
        past: verb.past,
        perfect: verb.perfect,
        form: 'past'
      });
      
      this._verbConjugations.set(verb.perfect, {
        infinitive: bareInfinitive,
        present: verb.present,
        past: verb.past,
        perfect: verb.perfect,
        form: 'perfect'
      });
    });
  }
  
  /**
   * Detect the dominant tense in a sentence
   * @param {String} sentenceText The sentence text
   * @param {Array} tokens Tokens in the sentence
   * @returns {String} The dominant tense ('past', 'present', or 'future')
   */
  _detectSentenceTense(sentenceText, tokens) {
    // Check for time indicators in the full sentence
    const lowerSentence = sentenceText.toLowerCase();
    
    // Find all verbs and their tenses
    const verbsInSentence = tokens.filter(token => token.pos === 'VERB');
    let pastCount = 0, presentCount = 0, futureCount = 0;
    
    // Count explicit tense indicators
    for (const indicator of this._pastTimeIndicators) {
      if (lowerSentence.includes(indicator)) {
        pastCount += 2; // Give time indicators higher weight
      }
    }
    
    for (const indicator of this._presentTimeIndicators) {
      if (lowerSentence.includes(indicator)) {
        presentCount += 2;
      }
    }
    
    for (const indicator of this._futureTimeIndicators) {
      if (lowerSentence.includes(indicator)) {
        futureCount += 2;
      }
    }
    
    // Count verb forms
    for (const verb of verbsInSentence) {
      const verbInfo = this._verbConjugations.get(verb.word.toLowerCase());
      if (verbInfo) {
        switch (verbInfo.form) {
          case 'past':
            pastCount++;
            break;
          case 'present':
            presentCount++;
            break;
          // Perfect forms need auxiliary verbs to determine tense
          default:
            // Look for auxiliary verbs
            if (lowerSentence.includes('har ' + verbInfo.perfect) ||
                lowerSentence.includes('hadde ' + verbInfo.perfect)) {
              // Perfect constructions
              if (lowerSentence.includes('har')) presentCount++;
              if (lowerSentence.includes('hadde')) pastCount++;
            }
        }
      }
    }
    
    // Modal verbs indicating future
    const futureModals = ['vil', 'skal', 'kommer til å'];
    for (const modal of futureModals) {
      if (lowerSentence.includes(modal)) {
        futureCount++;
      }
    }
    
    // Return the dominant tense
    if (pastCount > presentCount && pastCount > futureCount) {
      return 'past';
    } else if (futureCount > pastCount && futureCount > presentCount) {
      return 'future';
    } else {
      return 'present'; // Default to present if tied or no clear indicators
    }
  }
  
  /**
   * Get the correct verb form for a given tense
   * @param {String} verb The verb to check
   * @param {String} targetTense The target tense ('past', 'present', or 'future')
   * @returns {Object|null} Correction suggestion or null if unable to determine
   */
  _getCorrectVerbForm(verb, targetTense) {
    const verbInfo = this._verbConjugations.get(verb.toLowerCase());
    
    if (!verbInfo) {
      return null; // Unknown verb
    }
    
    switch (targetTense) {
      case 'past':
        return { form: verbInfo.past, tense: 'past' };
      case 'present':
        return { form: verbInfo.present, tense: 'present' };
      case 'future':
        // Norwegian uses present tense or modal constructions for future
        return { form: verbInfo.present, tense: 'present', note: 'Use with "skal" or "vil" for future' };
      default:
        return null;
    }
  }
  
  /**
   * Check if a verb is in infinitive form
   * @param {String} verb The verb to check
   * @returns {Boolean} True if the verb is in infinitive form
   */
  _isInfinitive(verb) {
    // Norwegian infinitives typically end with 'e' (but not always)
    return verb.toLowerCase().endsWith('e') || 
           verb.toLowerCase() === 'gå' || 
           verb.toLowerCase() === 'se' || 
           verb.toLowerCase() === 'si';
  }
  
  /**
   * Check text for verb conjugation issues
   * @param {String} text The text to check
   * @param {Object} options Additional options
   * @returns {Array} Array of grammar issues
   */
  async check(text, options = {}) {
    const issues = [];
    
    // Get tokenized sentences
    let sentences;
    try {
      sentences = await this._tokenizer.tokenize(text);
    } catch (error) {
      console.error('Error tokenizing text:', error);
      return issues;
    }
    
    let textOffset = 0;
    
    // Process each sentence
    for (const sentence of sentences) {
      const tokens = sentence.tokens || [];
      
      // Detect the dominant tense in this sentence
      const dominantTense = this._detectSentenceTense(sentence.text, tokens);
      
      // Analyze each verb in the sentence
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        
        // Skip non-verbs
        if (token.pos !== 'VERB') {
          continue;
        }
        
        const verb = token.word;
        const position = {
          start: textOffset + token.start,
          end: textOffset + token.end
        };
        
        // Check for incorrect infinitive usage (without 'å')
        if (this._isInfinitive(verb) && i > 0) {
          const prevToken = tokens[i - 1];
          // Only infinites with 'å' or after modal verbs are valid
          if (prevToken.word !== 'å' && 
              !['vil', 'skal', 'kan', 'må', 'bør'].includes(prevToken.word.toLowerCase())) {
            
            const verbInfo = this._verbConjugations.get(verb.toLowerCase());
            if (verbInfo) {
              const correctForm = this._getCorrectVerbForm(verb, dominantTense);
              
              if (correctForm && correctForm.form !== verb) {
                issues.push({
                  type: 'grammar',
                  subtype: 'verb-conjugation',
                  message: `Incorrect verb form: "${verb}" should be conjugated to match the ${dominantTense} tense`,
                  position,
                  suggestion: correctForm.form,
                  context: this._getContext(text, position.start, position.end)
                });
              }
            }
          }
        }
        
        // Check for tense consistency
        const verbInfo = this._verbConjugations.get(verb.toLowerCase());
        if (verbInfo && verbInfo.form) {
          // If verb has a tense that doesn't match the dominant tense
          if (verbInfo.form !== dominantTense && 
             !(verbInfo.form === 'perfect' && dominantTense === 'past')) {
            
            const correctForm = this._getCorrectVerbForm(verbInfo.infinitive, dominantTense);
            
            if (correctForm && correctForm.form !== verb) {
              issues.push({
                type: 'grammar',
                subtype: 'tense-consistency',
                message: `Inconsistent verb tense: "${verb}" should be in ${dominantTense} tense to match the rest of the sentence`,
                position,
                suggestion: correctForm.form,
                context: this._getContext(text, position.start, position.end)
              });
            }
          }
        }
        
        // Special case: modal verb followed by non-infinitive
        if (['skal', 'vil', 'kan', 'må', 'bør'].includes(verb.toLowerCase()) && i < tokens.length - 1) {
          const nextToken = tokens[i + 1];
          if (nextToken.pos === 'VERB') {
            const nextVerb = nextToken.word;
            const nextVerbInfo = this._verbConjugations.get(nextVerb.toLowerCase());
            
            // Next verb should be infinitive after a modal
            if (nextVerbInfo && !this._isInfinitive(nextVerb)) {
              issues.push({
                type: 'grammar',
                subtype: 'modal-verb-construction',
                message: `After modal verb "${verb}", use the infinitive form instead of "${nextVerb}"`,
                position: {
                  start: textOffset + nextToken.start,
                  end: textOffset + nextToken.end
                },
                suggestion: nextVerbInfo.infinitive,
                context: this._getContext(text, textOffset + nextToken.start, textOffset + nextToken.end)
              });
            }
          }
        }
      }
      
      textOffset += sentence.text.length + 1; // +1 for the space or newline
    }
    
    return issues;
  }
  
  /**
   * Get context around a position in text
   * @private
   */
  _getContext(text, start, end) {
    const contextSize = 20;
    const contextStart = Math.max(0, start - contextSize);
    const contextEnd = Math.min(text.length, end + contextSize);
    
    return `...${text.substring(contextStart, contextEnd)}...`;
  }
}

module.exports = VerbConjugationChecker;
