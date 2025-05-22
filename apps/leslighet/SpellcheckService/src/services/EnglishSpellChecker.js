// src/services/EnglishSpellChecker.js
const nspell = require("nspell");
const fastLevenshtein = require("fast-levenshtein");
const { createLogger, format, transports } = require("winston");
const BaseSpellChecker = require("./BaseSpellChecker");

/**
 * Winston logger for strukturert logging i EnglishSpellChecker
 */
const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: format.combine(
    format.timestamp(),
    format.printf(({ level, message, timestamp }) =>
      `[${timestamp}] [${level.toUpperCase()}] ${message}`
    )
  ),
  transports: [new transports.Console()],
});

/**
 * English SpellChecker implementation
 * Supports British (gb) and American (us) dialects
 * Advanced version to mirror Norwegian structure
 */
class EnglishSpellChecker extends BaseSpellChecker {
  constructor(options = {}) {
    const englishOptions = {
      ...options,
      languageCode: "en",
      redisKeyPrefix: "english",
      dialectCodes: ["gb", "us"],
      dialectSettings: { gb: true, us: true },
      commonPhrases: [
        "e.g.", "i.e.", "etc.", "vs.", "Mr.", "Mrs.", "Dr.", "Prof.",
        "Inc.", "Ltd.", "Co.", "Corp.", "St.", "Ave.", "Rd.", "Ph.D."
      ],
    };
    super(englishOptions);
  }

  /**
   * Laster ordbok for engelsk dialekt (gb/us)
   */
  async loadDictionary(dialectCode) {
    try {
      const affKey = `english:hunspell:${dialectCode}:aff`;
      const dicKey = `english:hunspell:${dialectCode}:dic`;

      logger.info(`Loading English dictionary for dialect: ${dialectCode}`);
      const [affBuffer, dicBuffer] = await Promise.all([
        this.safeLoad(() => this.redis.getBuffer(affKey), `Cannot load AFF from ${affKey}`),
        this.safeLoad(() => this.redis.getBuffer(dicKey), `Cannot load DIC from ${dicKey}`),
      ]);

      if (!affBuffer || !dicBuffer) {
        throw new Error(`Missing dictionary data for English ${dialectCode}`);
      }

      // Check encoding in first 100 bytes of AFF
      const affHeader = affBuffer.slice(0, 100).toString("utf8");
      if (affHeader.includes("UTF-8") || affHeader.includes("UTF8")) {
        logger.debug(`Verified UTF-8 for English ${dialectCode} dictionary`);
      } else {
        logger.warn(`No explicit UTF-8 header; assuming UTF-8 for English ${dialectCode}`);
      }

      this.dicts[dialectCode] = nspell({
        aff: affBuffer.toString("utf8"),
        dic: dicBuffer.toString("utf8"),
        encoding: "utf8",
      });

      // Test words (British/American variations)
      this.testDictionaryWords(this.dicts[dialectCode], dialectCode);

      this.dictionaryLoaded[dialectCode] = true;
      logger.info(`Dictionary loaded for English ${dialectCode}`);
    } catch (error) {
      logger.error(`Error loading English ${dialectCode} dictionary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Test dictionary with some example words
   */
  testDictionaryWords(dict, dialectCode) {
    const testWords = ["color", "colour", "favorite", "favourite", "organization", "organisation"];
    testWords.forEach((word) => {
      const correct = dict.correct(word);
      if (!correct) {
        const suggestions = dict.suggest(word);
        logger.debug(
          `TEST FAIL: "${word}" is unknown in ${dialectCode}. Suggestions: ${suggestions.join(", ")}`
        );
      } else {
        logger.debug(`TEST OK: "${word}" recognized in ${dialectCode}.`);
      }
    });
  }

  /**
   * Load English special terms/phrases
   */
  async loadSpecialTerms() {
    if (this.specialTermsLoaded) return;

    const key = "english:specialterms";
    logger.info(`Loading English special terms from Redis key: ${key}`);
    try {
      const data = await this.safeLoad(
        () => this.redis.get(key),
        `Cannot load English special terms from ${key}`
      );
      if (data) {
        // Try JSON parse
        try {
          const terms = JSON.parse(data);
          if (Array.isArray(terms)) {
            terms.forEach((term) => this.specialTerms.add(term.toLowerCase().trim()));
          }
        } catch {
          // fallback: line-delimited
          const lines = data.split(/\r?\n/).filter(Boolean);
          lines.forEach((term) => this.specialTerms.add(term.toLowerCase().trim()));
        }
      }
      // Add common phrases
      this.commonPhrases.forEach((phrase) =>
        this.specialTerms.add(phrase.toLowerCase().trim())
      );

      this.specialTermsLoaded = true;
      logger.info(`Loaded ${this.specialTerms.size} English special terms`);
    } catch (error) {
      logger.error(`Error loading English special terms: ${error.message}`);
    }
  }

  /**
   * Load custom words for English
   */
  async loadCustomWords() {
    try {
      logger.info("Loading English custom words... (if applicable)");
      // Example approach: read from a local file, or from Redis: "english:customwords"
      // Implementation depends on your project. For now, do nothing or load from some method:
      const customWords = await this.getLocalEnglishCustomWords();
      if (Array.isArray(customWords)) {
        customWords.forEach((w) => this.addSpecialTerm(w));
        logger.info(`Loaded ${customWords.length} English custom words`);
      }
    } catch (error) {
      logger.error(`Error loading English custom words: ${error.message}`);
    }
  }

  /**
   * Example method to retrieve custom English words from local or external source
   */
  async getLocalEnglishCustomWords() {
    // E.g. read a file or do a minimal example
    return [];
  }

  /**
   * Load hyphenation data for English dialects
   */
  async loadHyphenation() {
    logger.info("Loading English hyphenation for gb/us...");
    try {
      const [gbContent, usContent] = await Promise.all([
        this.safeLoad(() => this.redis.get("english:hyphenation:gb"), "Cannot load hyphenation gb"),
        this.safeLoad(() => this.redis.get("english:hyphenation:us"), "Cannot load hyphenation us"),
      ]);

      const { TeXHyphenator } = require("../utils/TeXHyphenator");

      if (gbContent && !this.hyphenators.gb) {
        this.hyphenators.gb = new TeXHyphenator(gbContent);
        logger.info("Loaded British English hyphenation");
      }
      if (usContent && !this.hyphenators.us) {
        this.hyphenators.us = new TeXHyphenator(usContent);
        logger.info("Loaded American English hyphenation");
      }
    } catch (error) {
      logger.error(`Error loading English hyphenation: ${error.message}`);
    }
  }

  /**
   * Load thesaurus data for English (gb/us)
   */
  async loadThesaurus() {
    logger.info("Loading English thesaurus for gb/us...");
    try {
      const [gbDat, gbIdx, usDat, usIdx] = await Promise.all([
        this.safeLoad(() => this.redis.get("english:thesaurus:gb:dat"), "Cannot load gb:dat"),
        this.safeLoad(() => this.redis.get("english:thesaurus:gb:idx"), "Cannot load gb:idx"),
        this.safeLoad(() => this.redis.get("english:thesaurus:us:dat"), "Cannot load us:dat"),
        this.safeLoad(() => this.redis.get("english:thesaurus:us:idx"), "Cannot load us:idx"),
      ]);
      const { MyThesParser } = require("../utils/MyThesParser");

      if (gbDat && gbIdx && !this.thesaurusParsers.gb) {
        this.thesaurusParsers.gb = new MyThesParser(gbIdx, gbDat);
        logger.info("Loaded British English thesaurus");
      }
      if (usDat && usIdx && !this.thesaurusParsers.us) {
        this.thesaurusParsers.us = new MyThesParser(usIdx, usDat);
        logger.info("Loaded American English thesaurus");
      }
    } catch (error) {
      logger.error(`Error loading English thesaurus: ${error.message}`);
    }
  }

  /**
   * Overstyr checkWord for engelsk logikk (f.eks. apostrofer).
   */
  async checkWord(word) {
    const baseResult = await super.checkWord(word);
    if (baseResult.correct) {
      return baseResult;
    }

    // Check for apostrophes, e.g. "it's" -> "its"
    if (word.includes("'")) {
      const withoutApostrophe = word.replace(/'/g, "");
      const secondResult = await super.checkWord(withoutApostrophe);
      if (secondResult.correct) {
        return {
          ...secondResult,
          originalWord: word,
          transformedWord: withoutApostrophe,
        };
      }
    }
    return baseResult;
  }

  /**
   * Advanced suggestion retrieval combining ordbok, thesaurus, hyphenation, etc.
   */
  async getEnhancedSuggestions(word, dialectCodes) {
    if (!word || word.length < 2) return [];

    const normalized = word.toLowerCase().trim();
    if (this.specialTerms.has(normalized)) {
      logger.debug(`"${normalized}" is marked as English special term`);
      return [normalized];
    }

    let allSuggestions = [];

    await Promise.all(
      dialectCodes.map(async (dialectCode) => {
        if (!this.dicts[dialectCode]) {
          await this.loadDictionary(dialectCode);
        }
        if (!this.thesaurusParsers[dialectCode]) {
          await this.loadThesaurus();
        }

        // (1) Word forms
        const forms = this.getWordForms(normalized, dialectCode);
        if (forms && forms.length > 0) {
          allSuggestions.push(...forms.map((f) => f.base));
        }

        // (2) Compound suggestions
        const compounds = this.getCompoundSuggestions(normalized, dialectCode);
        allSuggestions.push(...compounds);

        // (3) Thesaurus-lignende ord
        const { categories, meanings } = this.getThesaurusCategories(normalized, dialectCode);
        for (const cat of categories) {
          const catWords = await this.getWordsInCategory(cat, dialectCode);
          allSuggestions.push(...catWords);
        }
        for (const meaning of meanings) {
          const meaningWords = await this.getWordsWithMeaning(meaning, dialectCode);
          allSuggestions.push(...meaningWords);
        }

        // (4) Hyphenation-based suggestions
        const hyphenSuggestions = this.getHyphenationSuggestions(normalized, dialectCode);
        allSuggestions.push(...hyphenSuggestions);

        // (5) Dictionary suggestions
        const dict = this.dicts[dialectCode];
        if (dict) {
          const directSuggestions = dict.suggest(normalized) || [];
          allSuggestions.push(...directSuggestions);
        }
      })
    );

    // (6) Stop word-lignende
    const stopWordSuggestions = this.getStopWordSuggestions(normalized);
    allSuggestions.push(...stopWordSuggestions);

    // (7) Karaktervariasjoner: For engelsk, kan du evt. håndtere britiske/amerikanske forskjeller
    //    (color/colour, etc.). Du kan også utvide for diakritiske tegn eller lignende.
    //    Her viser vi et “dummy” eksempel med farge-variasjoner:
    const variations = [];
    // Simple mapping av 'color' <-> 'colour', 'organize' <-> 'organise', etc.
    const charPatterns = {
      color: "colour",
      flavour: "flavor",
      organise: "organize",
      organisation: "organization",
      analyse: "analyze",
      analysed: "analyzed",
    };
    if (charPatterns[normalized]) {
      variations.push(charPatterns[normalized]);
    }
    // Sjekk om "colour" => "color", etc.
    const reversedMap = Object.entries(charPatterns).reduce((acc, [k, v]) => {
      acc[v] = k;
      return acc;
    }, {});
    if (reversedMap[normalized]) {
      variations.push(reversedMap[normalized]);
    }

    // Legg til variasjoner i allSuggestions
    variations.forEach((v) => allSuggestions.push(v));

    // Fjern duplikater og sorter etter Levenshtein
    const unique = [...new Set(allSuggestions)].filter((s) => s && s.trim().length > 0);
    const sorted = unique.sort(
      (a, b) => fastLevenshtein.get(normalized, a.toLowerCase()) - fastLevenshtein.get(normalized, b.toLowerCase())
    );

    const MAX_SUGGESTIONS = 15;
    const finalSuggestions = sorted.slice(0, MAX_SUGGESTIONS);

    logger.debug(`Advanced suggestions for "${word}": ${finalSuggestions.join(", ")}`);
    return finalSuggestions.length > 0 ? finalSuggestions : [normalized];
  }

  /**
   * Morphological analysis (for English, often limited or less robust than for Norwegian)
   */
  getMorphologicalAnalysis(word, dialectCode) {
    if (!this.dicts[dialectCode]) return [];
    try {
      const analysis = this.dicts[dialectCode].analyze(word);
      logger.debug(`Morph analysis for "${word}" in ${dialectCode}: ${JSON.stringify(analysis)}`);
      return analysis;
    } catch (error) {
      logger.error(`Error in morphological analysis for "${word}": ${error.message}`);
      return [];
    }
  }

  /**
   * Sammensatte ord - for engelsk er det sjeldnere enn norsk, men vi viser eksempelets skyld
   */
  getCompoundParts(word, dialectCode) {
    if (!this.hyphenators[dialectCode] || !this.dicts[dialectCode]) return [];
    try {
      const parts = this.hyphenators[dialectCode].hyphenate(word);
      if (!parts || parts.length <= 1) return [];
      const validParts = parts.filter((p) => this.dicts[dialectCode].correct(p));
      logger.debug(`Compound parts for "${word}": ${validParts.join(", ")}`);
      return validParts;
    } catch (error) {
      logger.error(`Error getting compound parts for "${word}": ${error.message}`);
      return [];
    }
  }

  /**
   * Thesaurus info for a word
   */
  getThesaurusInfo(word, dialectCode) {
    if (!this.thesaurusParsers[dialectCode]) return null;
    try {
      const info = this.thesaurusParsers[dialectCode].getWordInfo(word);
      logger.debug(`Thesaurus info for "${word}" in ${dialectCode}: ${JSON.stringify(info)}`);
      return info;
    } catch (error) {
      logger.error(`Error retrieving thesaurus info for "${word}": ${error.message}`);
      return null;
    }
  }

  getWordForms(word, dialectCode) {
    const analysis = this.getMorphologicalAnalysis(word, dialectCode);
    if (!analysis || !analysis.length) return [];
    const forms = analysis.map((a) => {
      const [base, ...affixes] = a.split("/");
      return { base, affixes };
    });
    logger.debug(`Word forms for "${word}" in ${dialectCode}: ${JSON.stringify(forms)}`);
    return forms;
  }

  getCompoundSuggestions(word, dialectCode) {
    const analysis = this.getMorphologicalAnalysis(word, dialectCode);
    if (!analysis || !analysis.length) return [];
    const compounds = analysis.filter((a) => a.includes("COMPOUND"));
    if (compounds.length) {
      logger.debug(`Compound analysis for "${word}": ${JSON.stringify(compounds)}`);
      return compounds.map((c) => c.split("/")[0]);
    }
    return [];
  }

  getThesaurusCategories(word, dialectCode) {
    const info = this.getThesaurusInfo(word, dialectCode);
    if (!info) return { categories: [], meanings: [] };
    const categories = info.categories || [];
    const meanings = info.meanings || [];
    logger.debug(`Thesaurus categories for "${word}": ${categories.join(", ")}`);
    return { categories, meanings };
  }

  async getWordsInCategory(category, dialectCode) {
    if (!this.thesaurusParsers[dialectCode]) return [];
    try {
      const words = await this.thesaurusParsers[dialectCode].getWordsInCategory(category);
      return words || [];
    } catch (error) {
      logger.error(`Error getting words in category "${category}": ${error.message}`);
      return [];
    }
  }

  async getWordsWithMeaning(meaning, dialectCode) {
    if (!this.thesaurusParsers[dialectCode]) return [];
    try {
      const words = await this.thesaurusParsers[dialectCode].getWordsWithMeaning(meaning);
      return words || [];
    } catch (error) {
      logger.error(`Error getting words with meaning "${meaning}": ${error.message}`);
      return [];
    }
  }

  getStopWordSuggestions(word) {
    if (!this.specialTerms) return [];
    const normalized = word.toLowerCase().trim();
    const similar = [];
    this.specialTerms.forEach((term) => {
      // Toleranse på Levenshtein avstand 2
      const dist = fastLevenshtein.get(normalized, term);
      if (dist <= 2 && Math.abs(term.length - normalized.length) <= 2) {
        similar.push(term);
      }
    });
    return similar;
  }

  getHyphenationSuggestions(word, dialectCode) {
    if (!this.hyphenators[dialectCode]) return [];
    try {
      const parts = this.hyphenators[dialectCode].hyphenate(word);
      if (!parts || parts.length <= 1) return [];
      const suggestions = [];
      parts.forEach((part) => {
        if (this.dicts[dialectCode].correct(part)) {
          suggestions.push(part);
        }
      });
      return suggestions;
    } catch (error) {
      logger.error(`Error in hyphenation suggestions for "${word}": ${error.message}`);
      return [];
    }
  }

  /**
   * Retrieve synonyms for an English word
   */
  getSynonyms(word) {
    if (!word || typeof word !== "string") return [];
    const normalized = word.toLowerCase().trim();
    logger.debug(`Getting English synonyms for "${normalized}"`);

    let allSynonyms = [];
    // Check British + American
    for (const code of ["gb", "us"]) {
      if (this.thesaurusParsers[code]) {
        try {
          const synonyms = this.thesaurusParsers[code].getSynonyms(normalized);
          if (synonyms && synonyms.length > 0) {
            allSynonyms.push(...synonyms);
          }
        } catch (err) {
          logger.error(`Error getting synonyms for "${normalized}" in ${code}: ${err.message}`);
        }
      }
    }

    const uniqueSynonyms = [...new Set(allSynonyms)].filter((s) => !s.includes("�"));
    return uniqueSynonyms;
  }
}

module.exports = new EnglishSpellChecker();
module.exports.EnglishSpellChecker = EnglishSpellChecker;
