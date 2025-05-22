/**
 * Grammar routes handling HTTP API requests for grammar checking
 */
const express = require('express');
const router = express.Router();

/**
 * Norwegian grammar rules and patterns
 */
const norwegianGrammarRules = {
  // Regular expressions for detecting common grammar errors in Norwegian
  verbTenseInconsistency: {
    pastTimePresent: {
      pattern: /\b(i\s+går|i\s+forrige\s+uke|forrige|tidligere)\b.{0,30}?\b(gå|kjøper|kommer|er|har|gjør|kan|vil|skal|må|hjelpe|vente|trenger)\b/i,
      message: 'Verb tense inconsistency: Use past tense with past time expressions'
    },
    presentTimePast: {
      pattern: /\b(nå|i\s+dag|denne\s+uken|akkurat\s+nå)\b.{0,30}?\b(gikk|kom|var|hadde|gjorde|kunne|ville|skulle|måtte|hjalp|ventet|trengte)\b/i,
      message: 'Verb tense inconsistency: Use present tense with present time expressions'
    }
  },
  wordOrder: {
    negationPosition: {
      pattern: /\b(det|han|hun|de|vi|jeg|du)\s+(ikke)\s+(er|var|har|hadde)\b/i,
      message: 'Incorrect word order with negation: Negation should come after the verb in main clauses',
      suggestionFn: (match) => {
        const [, subject, neg, verb] = match.match(/\b(det|han|hun|de|vi|jeg|du)\s+(ikke)\s+(er|var|har|hadde)\b/i);
        return `${subject} ${verb} ${neg}`;
      }
    },
    questionOrder: {
      pattern: /\b(hvorfor|når|hvor|hva|hvem|hvilken|hvordan)\s+(\w+)\s+(ikke)\s+(\w+)\b/i,
      message: 'Incorrect word order in question: In questions with "ikke", the word order should be different',
      suggestionFn: (match) => {
        const [, qWord, subj, neg, verb] = match.match(/\b(hvorfor|når|hvor|hva|hvem|hvilken|hvordan)\s+(\w+)\s+(ikke)\s+(\w+)\b/i);
        return `${qWord} ${verb} ${subj} ${neg}`;
      }
    }
  },
  missingArticles: {
    indefinite: {
      pattern: /\b(en|et)\s+(\w+)\b/i,
      antipattern: /\b(til|i|på|med|for|om|av|fra)\s+(\w+)\b/i,
      message: 'Missing indefinite article (en/et) before noun',
      checkFn: (text, position) => {
        // Check if common nouns are missing articles
        const commonNouns = ['dag', 'mann', 'kvinne', 'bok', 'hus', 'bil', 'butikk'];
        let issues = [];
        
        commonNouns.forEach(noun => {
          const nounRegex = new RegExp(`\\b${noun}\\b`, 'gi');
          let match;
          
          while ((match = nounRegex.exec(text)) !== null) {
            // Check if there's an article before the noun or if it's after a preposition
            const beforeText = text.substring(Math.max(0, match.index - 20), match.index);
            if (!/(en|et|den|det|denne|dette)\s+$/.test(beforeText) && 
                !/(til|i|på|med|for|om|av|fra)\s+$/.test(beforeText) &&
                !/(min|din|sin|vår|deres|hans|hennes)\s+$/.test(beforeText)) {
              issues.push({
                type: 'grammar',
                message: `Missing article before "${noun}"`,
                position: {
                  start: match.index,
                  end: match.index + noun.length
                },
                suggestion: `en ${noun}`,
                context: text.substring(Math.max(0, match.index - 15), Math.min(text.length, match.index + noun.length + 15))
              });
            }
          }
        });
        
        return issues;
      }
    },
    definite: {
      pattern: /\b(til|i|på|med|for|om|av|fra)\s+(\w+)\b/i,
      message: 'Nouns after prepositions often need definite form',
      checkFn: (text) => {
        const prepositions = ['til', 'i', 'på', 'med', 'for', 'om', 'av', 'fra'];
        const commonNouns = {
          'butikk': 'butikken',
          'dag': 'dagen',
          'uke': 'uken',
          'måned': 'måneden',
          'år': 'året',
          'bil': 'bilen',
          'hus': 'huset',
          'bok': 'boken'
        };
        let issues = [];
        
        prepositions.forEach(prep => {
          const prepRegex = new RegExp(`\\b${prep}\\s+(\\w+)\\b`, 'gi');
          let match;
          
          while ((match = prepRegex.exec(text)) !== null) {
            const noun = match[1].toLowerCase();
            if (commonNouns[noun]) {
              issues.push({
                type: 'grammar',
                message: `After preposition "${prep}", the noun should usually be in definite form`,
                position: {
                  start: match.index + prep.length + 1,
                  end: match.index + prep.length + 1 + noun.length
                },
                suggestion: commonNouns[noun],
                context: text.substring(Math.max(0, match.index - 10), Math.min(text.length, match.index + prep.length + noun.length + 10))
              });
            }
          }
        });
        
        return issues;
      }
    }
  },
  verbForms: {
    infinitiveMarker: {
      pattern: /\bå\s+(\w+er)\b/i,
      message: 'Incorrect verb form after infinitive marker "å"',
      suggestionFn: (match) => match.replace(/å\s+(\w+)er\b/i, 'å $1e')
    },
    presentPastMix: {
      irregularVerbs: {
        'gå': 'gikk',
        'komme': 'kom',
        'være': 'var',
        'ha': 'hadde',
        'gjøre': 'gjorde',
        'se': 'så',
        'si': 'sa',
        'få': 'fikk',
        'ta': 'tok',
        'gi': 'gav',
        'vite': 'visste',
        'dra': 'dro',
        'kjøpe': 'kjøpte',
        'vente': 'ventet',
        'hjelpe': 'hjalp',
        'blåse': 'blåste'
      },
      regularVerbs: {
        pattern: /(\w+)er\b/i,
        pastForm: (verb) => verb.replace(/er$/, 'et')
      }
    }
  },
  adjectiveAgreement: {
    masculine: {
      pattern: /\b(en|den)\s+(\w+t)\s+(bil|mann|gutt|stol|dag)\b/i,
      message: 'Adjective ending should agree with masculine noun',
      suggestionFn: (match) => match.replace(/(\w+)t\s+/, '$1 ')
    },
    feminine: {
      pattern: /\b(ei|den)\s+(\w+t)\s+(bok|jente|dør|hylle)\b/i,
      message: 'Adjective ending should agree with feminine noun',
      suggestionFn: (match) => match.replace(/(\w+)t\s+/, '$1 ')
    },
    neuter: {
      pattern: /\b(et|det)\s+(\w+)\s+(hus|barn|bord|rom)\b/i,
      antipattern: /\b(et|det)\s+(\w+t)\s+(hus|barn|bord|rom)\b/i,
      message: 'Adjective before neuter noun should end with -t',
      suggestionFn: (match) => match.replace(/(\w+)\s+/, '$1t ')
    }
  }
};

// Helper function to extract context around a position
const getContext = (text, start, end, contextSize = 15) => {
  return text.substring(Math.max(0, start - contextSize), Math.min(text.length, end + contextSize));
};

/**
 * In-memory mock grammar service for demo purposes
 * In a real implementation this would be injected through DI
 */
const mockGrammarService = {
  check: async (text, options) => {
    console.log('HTTP API mock grammar check called with text:', text.substring(0, 30) + '...');
    console.log('Options:', options);
    
    // Wait to simulate processing
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Generate mock results based on the input text
    const issues = [];
    
    // Check for verb tense inconsistency with "i går" (yesterday)
    if (text.includes('i går')) {
      const presentTenseVerbs = text.match(/\bi\s+går.{0,30}?\b(gå|kjøper|kommer|er|gjør|venter?|trenger|hjelper?)\b/gi);
      if (presentTenseVerbs) {
        presentTenseVerbs.forEach(match => {
          const verbMatch = match.match(/\b(gå|kjøper|kommer|er|gjør|venter?|trenger|hjelper?)\b/i);
          if (verbMatch) {
            const verb = verbMatch[0];
            const verbPosition = match.lastIndexOf(verb);
            const startPos = text.indexOf(match) + verbPosition;
            
            let pastForm = '';
            let suggestion = '';
            
            // Get correct past form
            switch(verb.toLowerCase()) {
              case 'gå': 
                pastForm = 'gikk'; 
                suggestion = match.replace(/\bgå\b/i, 'gikk');
                break;
              case 'kjøper': 
                pastForm = 'kjøpte'; 
                suggestion = match.replace(/\bkjøper\b/i, 'kjøpte');
                break;
              case 'kommer': 
                pastForm = 'kom'; 
                suggestion = match.replace(/\bkommer\b/i, 'kom');
                break;
              case 'er': 
                pastForm = 'var'; 
                suggestion = match.replace(/\ber\b/i, 'var');
                break;
              case 'gjør': 
                pastForm = 'gjorde'; 
                suggestion = match.replace(/\bgjør\b/i, 'gjorde');
                break;
              case 'venter': 
                pastForm = 'ventet'; 
                suggestion = match.replace(/\bventer\b/i, 'ventet');
                break;
              case 'vente': 
                pastForm = 'ventet'; 
                suggestion = match.replace(/\bvente\b/i, 'ventet');
                break;
              case 'trenger': 
                pastForm = 'trengte'; 
                suggestion = match.replace(/\btrenger\b/i, 'trengte');
                break;
              case 'hjelpe': 
                pastForm = 'hjalp'; 
                suggestion = match.replace(/\bhjelpe\b/i, 'hjalp');
                break;
              case 'hjelper': 
                pastForm = 'hjalp'; 
                suggestion = match.replace(/\bhjelper\b/i, 'hjalp');
                break;
              default: 
                pastForm = verb + 'et';
                suggestion = match; 
            }
            
            issues.push({
              type: 'grammar',
              message: `Verb tense inconsistency: with "i går" (yesterday), use past tense "${pastForm}" instead of present tense "${verb}"`,
              position: {
                start: startPos,
                end: startPos + verb.length
              },
              suggestion: pastForm,
              context: getContext(text, startPos, startPos + verb.length)
            });
          }
        });
      }
    }
    
    // Check for missing articles before common nouns
    const commonNounCheck = (noun, article) => {
      const nounRegex = new RegExp(`\\b${noun}\\b`, 'gi');
      let match;
      
      while ((match = nounRegex.exec(text)) !== null) {
        // Check if there's an article before the noun or if it's after a preposition
        const beforeText = text.substring(Math.max(0, match.index - 20), match.index);
        if (!/(en|et|den|det|denne|dette)\s+$/.test(beforeText) && 
            !/(til|i|på|med|for|om|av|fra)\s+$/.test(beforeText) &&
            !/(min|din|sin|vår|deres|hans|hennes)\s+$/.test(beforeText)) {
          issues.push({
            type: 'grammar',
            message: `Missing article before "${noun}"`,
            position: {
              start: match.index,
              end: match.index + noun.length
            },
            suggestion: `${article} ${noun}`,
            context: getContext(text, match.index, match.index + noun.length)
          });
        }
      }
    };
    
    // Check common masculine nouns
    commonNounCheck('dag', 'en');
    commonNounCheck('butikk', 'en');
    
    // Check for incorrect word order with negation
    const negationPattern = /\b(det|han|hun|de|vi|jeg|du)\s+(ikke)\s+(er|var|har|hadde)\b/gi;
    let negationMatch;
    
    while ((negationMatch = negationPattern.exec(text)) !== null) {
      const [fullMatch, subject, neg, verb] = negationMatch;
      issues.push({
        type: 'grammar',
        message: 'Incorrect word order: In Norwegian, negation should come after the verb in main clauses',
        position: {
          start: negationMatch.index,
          end: negationMatch.index + fullMatch.length
        },
        suggestion: `${subject} ${verb} ${neg}`,
        context: getContext(text, negationMatch.index, negationMatch.index + fullMatch.length)
      });
    }
    
    // Check for incorrect verb after infinitive marker "å"
    const infinitivePattern = /\bå\s+(\w+er)\b/gi;
    let infinitiveMatch;
    
    while ((infinitiveMatch = infinitivePattern.exec(text)) !== null) {
      const verbWithEr = infinitiveMatch[1];
      const correctForm = verbWithEr.replace(/er$/, 'e');
      
      issues.push({
        type: 'grammar',
        message: 'Incorrect verb form after "å": use infinitive form without -er ending',
        position: {
          start: infinitiveMatch.index + 2, // After "å "
          end: infinitiveMatch.index + 2 + verbWithEr.length
        },
        suggestion: correctForm,
        context: getContext(text, infinitiveMatch.index, infinitiveMatch.index + 2 + verbWithEr.length)
      });
    }
    
    // Check for preposition + indefinite noun (should often be definite)
    const prepNounPattern = /\b(til|i|på|med|for|om|av|fra)\s+(butikk|dag|uke|måned|år|bil|hus|bok)\b/gi;
    let prepMatch;
    
    while ((prepMatch = prepNounPattern.exec(text)) !== null) {
      const [fullMatch, prep, noun] = prepMatch;
      let definiteForms = {
        'butikk': 'butikken',
        'dag': 'dagen',
        'uke': 'uken',
        'måned': 'måneden',
        'år': 'året',
        'bil': 'bilen',
        'hus': 'huset',
        'bok': 'boken'
      };
      
      issues.push({
        type: 'grammar',
        message: `After preposition "${prep}", the noun should usually be in definite form`,
        position: {
          start: prepMatch.index + prep.length + 1,
          end: prepMatch.index + fullMatch.length
        },
        suggestion: definiteForms[noun.toLowerCase()],
        context: getContext(text, prepMatch.index, prepMatch.index + fullMatch.length)
      });
    }
    
    // Add Norwegian mock grammar issues based on the original rules
    if (text.includes('grammatik feil')) {
      issues.push({
        type: 'grammar',
        message: 'Incorrect spelling: "grammatik" should be "grammatikk"',
        position: {
          start: text.indexOf('grammatik'),
          end: text.indexOf('grammatik') + 9
        },
        suggestion: 'grammatikk',
        context: '...text med mange grammatik feil...'
      });
    }
    
    if (text.includes('skrivd')) {
      issues.push({
        type: 'grammar',
        message: 'Incorrect verb form: "skrivd" should be "skrevet"',
        position: {
          start: text.indexOf('skrivd'),
          end: text.indexOf('skrivd') + 6
        },
        suggestion: 'skrevet',
        context: '...har skrivd dette for å...'
      });
    }
    
    // Add a mock style issue
    if (text.includes('røde bil')) {
      issues.push({
        type: 'style',
        message: 'In Norwegian, adjectives should agree with the gender of the noun. "bil" is masculine, so "rød bil" is correct.',
        position: {
          start: text.indexOf('røde bil'),
          end: text.indexOf('røde bil') + 8
        },
        suggestion: 'rød bil',
        context: '...Den røde bil er fin...'
      });
    }
    
    // Add a mock spelling issue
    if (text.includes('lovte')) {
      issues.push({
        type: 'spelling',
        message: 'Spelling error: "lovte" should be "lovet"',
        position: {
          start: text.indexOf('lovte'),
          end: text.indexOf('lovte') + 5
        },
        suggestion: 'lovet',
        context: '...selv om han lovte å være...'
      });
    }
    
    // Check for "blåse" when past tense is needed
    if (text.includes('blåse') && (text.includes('i går') || text.includes('regnet'))) {
      issues.push({
        type: 'grammar',
        message: 'Incorrect verb tense: "blåse" should be "blåste" (past tense)',
        position: {
          start: text.indexOf('blåse'),
          end: text.indexOf('blåse') + 5
        },
        suggestion: 'blåste',
        context: getContext(text, text.indexOf('blåse'), text.indexOf('blåse') + 5)
      });
    }
    
    // Check for adjective agreement with "butikken"
    if (text.includes('butikken') && text.includes('åpent')) {
      const startPos = text.indexOf('åpent');
      issues.push({
        type: 'grammar',
        message: 'Adjective agreement error: "åpent" should be "åpen" to agree with "butikken" (masculine)',
        position: {
          start: startPos,
          end: startPos + 5
        },
        suggestion: 'åpen',
        context: getContext(text, startPos, startPos + 5)
      });
    }
    
    // Generate mock tokens if requested
    const tokens = options.includeTokens ? text.split(' ').map((word, i) => ({
      word,
      index: i,
      pos: Math.random() > 0.5 ? 'NOUN' : Math.random() > 0.5 ? 'VERB' : 'ADJ'
    })) : null;
    
    return {
      text,
      issues,
      tokens,
      language: options.language || 'nb-NO'
    };
  }
};

/**
 * @route POST /api/grammar/check
 * @description Check grammar in text
 * @access Public
 */
router.post('/check', async (req, res) => {
  try {
    const { text, language = 'nb-NO', includeTokens = false, includeDetails = false } = req.body;
    
    if (!text) {
      return res.status(400).json({
        status: 'error',
        message: 'Text is required'
      });
    }
    
    console.log(`Processing HTTP grammar check for language: ${language}, text length: ${text.length}`);
    
    // Use the mock grammar service
    const startTime = Date.now();
    const result = await mockGrammarService.check(text, {
      language,
      includeTokens,
      includeDetails
    });
    const processingTime = Date.now() - startTime;
    
    // Return success response with grammar check results
    return res.json({
      status: 'success',
      result,
      metadata: {
        processingTime,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error in grammar check:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error processing grammar check',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;