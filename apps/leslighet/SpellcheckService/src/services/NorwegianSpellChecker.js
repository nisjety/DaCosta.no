// src/services/NorwegianSpellChecker.js
const nspell = require("nspell");
const fastLevenshtein = require("fast-levenshtein");
const { createLogger, format, transports } = require("winston");
const BaseSpellChecker = require("./BaseSpellChecker");
const customWords = require("../dictionary/customWords");
const encodingUtils = require("../utils/encodingUtils");

/**
 * Opprett en Winston-logger for å kontrollere loggnivå:
 */
const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: format.combine(
    format.timestamp(),
    format.printf(({ level, message, timestamp }) => {
      return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new transports.Console()
  ],
});

/**
 * Norwegian SpellChecker implementation
 * Støtter Bokmål (nb) og Nynorsk (nn)
 * Håndterer ISO-8859-1-encoding
 */
class NorwegianSpellChecker extends BaseSpellChecker {
  constructor(options = {}) {
    const norwegianOptions = {
      ...options,
      languageCode: "no",
      redisKeyPrefix: "norsk",
      dialectCodes: ["nb", "nn"],
      dialectSettings: { nb: true, nn: true },
      commonPhrases: [
        "bl.a.", "dvs.", "evt.", "f.eks.", "ifm.", "jf.", "kl.", "mht.",
        "mm.", "mv.", "nr.", "osv.", "pga.", "tlf.", "vs.", "etc."
      ],
      name: "Norwegian",
      code: "no",
      defaultDialect: "nb",
    };
    super(norwegianOptions);

    // Eget cache for ordbok-data
    this.dicts = {};
    // Hjelpevariable for å spore lasting
    this.dictionaryLoaded = {};
    this.specialTermsLoaded = false;
  }

  /**
   * Hjelpefunksjon for å kalle Redis med sikker feilhåndtering
   */
  async safeLoad(fn, errorMsg) {
    try {
      return await fn();
    } catch (error) {
      logger.error(`${errorMsg}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Liten funksjon for å hente buffer fra Redis
   */
  async getBufferFromRedis(key) {
    return this.safeLoad(
      () => this.redis.getBuffer(key),
      `Failed to load buffer from key: ${key}`
    );
  }

  /**
   * Verifiserer encoding i aff-filen
   */
  verifyEncodingHeader(buffer, dialectCode) {
    const header = buffer.slice(0, 100).toString("latin1");
    if (header.toLowerCase().includes("set iso-8859-1") || header.toLowerCase().includes("set iso8859-1")) {
      logger.info(`✓ Verifisert ISO-8859-1 for ${dialectCode}`);
    } else {
      logger.warn(`⚠️ Manglende SET ISO-8859-1 i aff-fil for ${dialectCode} - dette vil bli lagt til automatisk`);
      
      // Check for Norwegian characters to verify encoding
      const sample = buffer.toString("latin1").substring(0, 2000);
      const norwegianChars = (sample.match(/[æøåÆØÅ]/g) || []).length;
      
      if (norwegianChars > 0) {
        logger.info(`✓ Funnet ${norwegianChars} norske tegn i ${dialectCode} aff-fil - encoding virker å være korrekt`);
      } else {
        logger.warn(`⚠️ Ingen norske tegn funnet i ${dialectCode} aff-fil - dette kan indikere encoding-problemer`);
      }
    }
  }

  /**
   * Oppretter nspell-ordbok fra aff/dic-buffere
   */
  createDictionary(affBuffer, dicBuffer) {
    // Force the correct encoding handling
    const affContent = affBuffer.toString("latin1");
    const dicContent = dicBuffer.toString("latin1");
    
    // Ensure the first line in the aff file has SET ISO8859-1
    let affLines = affContent.split('\n');
    if (!affLines[0].toLowerCase().includes('set iso8859-1') && !affLines[0].toLowerCase().includes('set iso-8859-1')) {
      affLines.unshift('SET ISO8859-1');
      logger.info('Added missing SET ISO8859-1 directive to aff file');
    }
    
    return nspell({
      aff: affLines.join('\n'),
      dic: dicContent,
      encoding: 'latin1'
    });
  }

  /**
   * Tester ordboken med et sett norske ord
   */
  testDictionaryWords(dict, dialectCode) {
    const testWords = ["hus", "båt", "vær", "dårlig", "kjøre", "dør"];
    
    // Test encoding by checking if special characters are preserved
    const hasNorwegianChars = word => /[æøåÆØÅ]/.test(word);
    
    // Check if the words with Norwegian characters are correctly handled
    const norwegianWords = testWords.filter(hasNorwegianChars);
    logger.info(`Testing ${norwegianWords.length} Norwegian words with special characters: ${norwegianWords.join(', ')}`);
    
    // Count correct words
    let correctCount = 0;
    
    testWords.forEach((word) => {
      const correct = dict.correct(word);
      if (!correct) {
        const suggestions = dict.suggest(word);
        logger.warn(
          `TEST FEIL: "${word}" i ${dialectCode} er ukjent. Forslag: ${suggestions.join(", ")}`
        );
        
        if (hasNorwegianChars(word)) {
          logger.error(`Encoding problem detected: Norwegian word "${word}" not recognized - this indicates an encoding issue!`);
        }
      } else {
        correctCount++;
        logger.info(`TEST OK: "${word}" i ${dialectCode}`);
      }
    });
    
    // Better summary of test results
    logger.info(`Dictionary test results: ${correctCount}/${testWords.length} words passed for ${dialectCode}`);
    if (correctCount < testWords.length) {
      logger.warn(`Some Norwegian words failed - possible encoding issue with ${dialectCode} dictionary`);
    } else {
      logger.info(`✓ All Norwegian words passed - dictionary ${dialectCode} encoding looks good`);
    }
  }

  /**
   * Last inn dictionary med parallell henting av aff/dic-buffer
   */
  async loadDictionary(dialectCode) {
    try {
      const affKey = `norsk:hunspell:${dialectCode}:aff`;
      const dicKey = `norsk:hunspell:${dialectCode}:dic`;

      logger.info(`Laster inn Norwegian ${dialectCode} dictionary...`);
      const [affBuffer, dicBuffer] = await Promise.all([
        this.getBufferFromRedis(affKey),
        this.getBufferFromRedis(dicKey),
      ]);

      if (!affBuffer || !dicBuffer) {
        throw new Error(`Mangler ordbokfiler for ${dialectCode}`);
      }

      this.verifyEncodingHeader(affBuffer, dialectCode);
      this.dicts[dialectCode] = this.createDictionary(affBuffer, dicBuffer);

      // Test ordboken
      this.testDictionaryWords(this.dicts[dialectCode], dialectCode);

      this.dictionaryLoaded[dialectCode] = true;
      logger.info(`Dictionary lastet for ${dialectCode}`);
    } catch (error) {
      logger.error(`Kunne ikke laste dictionary for ${dialectCode}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Laster spesialord for Norsk (stop words + common phrases)
   */
  async loadSpecialTerms() {
    if (this.specialTermsLoaded) return;
    
    const key = "norsk:specialterms";
    try {
      const buffer = await this.safeLoad(
        () => this.redis.getBuffer(key),
        `Kan ikke laste Norwegian special terms fra Redis-nøkkel: ${key}`
      );
      if (buffer) {
        const json = buffer.toString("utf8");
        const categories = JSON.parse(json);
        categories.forEach((category) => {
          if (Array.isArray(category.words)) {
            category.words.forEach((term) => this.specialTerms.add(term.toLowerCase().trim()));
          }
        });
      } else {
        logger.warn("Ingen Norwegian special terms funnet i Redis");
      }
      // Legg til felles fraser
      this.commonPhrases.forEach((abbr) => this.specialTerms.add(abbr.toLowerCase().trim()));
      this.specialTermsLoaded = true;
      logger.info(`Lastet ${this.specialTerms.size} spesialord/fraser for Norsk`);
    } catch (error) {
      logger.error(`Feil ved lasting av special terms: ${error.message}`);
    }
  }

  /**
   * Last hyphenation-data (både nb og nn) i parallell
   */
  async loadHyphenation() {
    try {
      const [nbBuffer, nnBuffer] = await Promise.all([
        this.getBufferFromRedis("norsk:hyphenation:nb"),
        this.getBufferFromRedis("norsk:hyphenation:nn"),
      ]);

      // Bokmål
      if (nbBuffer) {
        const firstLine = encodingUtils.bufferToString(nbBuffer.slice(0, 100), "latin1")
          .split("\n")[0].trim();
        if (firstLine.includes("ISO-8859-1")) {
          logger.debug(`Bokmål hyphenation marker: ${firstLine}`);
        }
        if (!this.hyphenators.nb) {
          const { TeXHyphenator } = require("../utils/TeXHyphenator");
          this.hyphenators.nb = new TeXHyphenator(nbBuffer, "latin1");
          logger.info("Lastet Bokmål hyphenation");
        }
      } else {
        logger.warn("Mangler Bokmål hyphenation-data");
      }

      // Nynorsk
      if (nnBuffer) {
        const firstLine = encodingUtils.bufferToString(nnBuffer.slice(0, 100), "latin1")
          .split("\n")[0].trim();
        if (firstLine.includes("ISO-8859-1")) {
          logger.debug(`Nynorsk hyphenation marker: ${firstLine}`);
        }
        if (!this.hyphenators.nn) {
          const { TeXHyphenator } = require("../utils/TeXHyphenator");
          this.hyphenators.nn = new TeXHyphenator(nnBuffer, "latin1");
          logger.info("Lastet Nynorsk hyphenation");
        }
      } else {
        logger.warn("Mangler Nynorsk hyphenation-data");
      }
    } catch (error) {
      logger.error(`Feil ved lasting av hyphenation-data: ${error.message}`);
    }
  }

  /**
   * Last inn Thesaurus (både nb og nn)
   */
  async loadThesaurus() {
    logger.info("Laster Norwegian Thesaurus...");

    try {
      const [nbDatBuffer, nbIdxBuffer, nnDatBuffer, nnIdxBuffer] = await Promise.all([
        this.getBufferFromRedis("norsk:thesaurus:nb:dat"),
        this.getBufferFromRedis("norsk:thesaurus:nb:idx"),
        this.getBufferFromRedis("norsk:thesaurus:nn:dat"),
        this.getBufferFromRedis("norsk:thesaurus:nn:idx"),
      ]);
      const { MyThesParser } = require("../utils/MyThesParser");

      // Bokmål
      if (nbDatBuffer && nbIdxBuffer) {
        this.thesaurusParsers.nb = new MyThesParser(nbIdxBuffer, nbDatBuffer);
        logger.info(
          `Lastet Bokmål Thesaurus (${this.thesaurusParsers.nb.wordCount} ord, ${this.thesaurusParsers.nb.synCount} synonymer)`
        );
      } else {
        logger.warn("Ingen Bokmål thesaurus-data i Redis");
        this.thesaurusParsers.nb = null;
      }

      // Nynorsk
      if (nnDatBuffer && nnIdxBuffer) {
        this.thesaurusParsers.nn = new MyThesParser(nnIdxBuffer, nnDatBuffer);
        logger.info(
          `Lastet Nynorsk Thesaurus (${this.thesaurusParsers.nn.wordCount} ord, ${this.thesaurusParsers.nn.synCount} synonymer)`
        );
      } else {
        logger.warn("Ingen Nynorsk thesaurus-data i Redis");
        this.thesaurusParsers.nn = null;
      }
    } catch (error) {
      logger.error(`Feil ved lasting av Norwegian Thesaurus: ${error.message}`);
    }
  }

  /**
   * Sjekker om et ord er korrekt stavet (Bokmål/Nynorsk)
   */
  async checkWord(word, dialectCodes = ["nb", "nn"]) {
    // Større krav til inputvalidering
    if (!word || typeof word !== "string" || !word.trim()) {
      return { correct: false, suggestions: [], message: "Mangler gyldig innhold i ord." };
    }

    logger.debug(`Sjekker ord: "${word}"`);

    const customCheck = await this.checkInCustomWords(word);
    if (customCheck.correct) {
      logger.debug(`Ordet "${word}" funnet i customWords`);
      return customCheck;
    }

    let isCorrect = false;
    let allSuggestions = [];

    for (const dialectCode of dialectCodes) {
      // Last dictionary om ikke allerede lastet
      if (!this.dicts[dialectCode]) {
        await this.loadDictionary(dialectCode);
      }

      const dict = this.dicts[dialectCode];
      if (!dict) {
        logger.warn(`Dictionary ikke tilgjengelig for ${dialectCode}`);
        continue;
      }

      try {
        const correct = dict.correct(word);
        logger.debug(`Sjekk for "${word}" i ${dialectCode}: ${correct ? "OK" : "FEIL"}`);
        if (correct) {
          isCorrect = true;
          break;
        } else {
          const suggestions = dict.suggest(word) || [];
          // Filtrer ut ugyldige forslag
          const validSuggestions = suggestions.filter(
            (sugg) => sugg && !sugg.includes("�") && sugg.length > 0
          );
          allSuggestions.push(...validSuggestions);
        }
      } catch (error) {
        logger.error(`Feil ved sjekk av "${word}" i ${dialectCode}: ${error.message}`);
      }
    }

    if (!isCorrect) {
      // Kall på en "avansert" suggestions-metode
      const enhancedSuggestions = await this.getEnhancedSuggestions(word, dialectCodes);
      if (enhancedSuggestions && enhancedSuggestions.length > 0) {
        allSuggestions = allSuggestions.concat(enhancedSuggestions);
      }
    }

    const uniqueSuggestions = [...new Set(allSuggestions)].slice(0, 10);

    return {
      correct: isCorrect,
      suggestions: uniqueSuggestions,
    };
  }

  /**
   * Avansert forslagshenting - sammensetning av mange kilder
   */
  async getEnhancedSuggestions(word, dialectCodes) {
    if (!word || word.length < 2) return [];

    // Avslutt tidlig om ordet er i specialTerms
    const normalized = word.toLowerCase().trim();
    if (this.specialTerms.has(normalized)) {
      logger.debug(`"${normalized}" er markert som spesialord`);
      return [normalized];
    }

    let allSuggestions = [];

    // Kjør alt parallelt for hver dialekt (Word forms, compound, thesaurus, binding, standard-suggestions)
    await Promise.all(
      dialectCodes.map(async (dialectCode) => {
        if (!this.dicts[dialectCode]) {
          await this.loadDictionary(dialectCode);
        }
        if (!this.thesaurusParsers[dialectCode]) {
          // Unngå crash om thesaurus ikke finnes
          // men forsøk å laste i bakgrunnen:
          await this.loadThesaurus();
        }

        // 1) Word forms
        const forms = this.getWordForms(normalized, dialectCode);
        if (forms && forms.length > 0) {
          allSuggestions.push(...forms.map((f) => f.base));
        }

        // 2) Compound suggestions
        const compounds = this.getCompoundSuggestions(normalized, dialectCode);
        allSuggestions.push(...compounds);

        // 3) Thesaurus-lignende ord i samme kategori
        const { categories, meanings } = this.getThesaurusCategories(normalized, dialectCode);
        for (const cat of categories) {
          const wordsInCat = await this.getWordsInCategory(cat, dialectCode);
          allSuggestions.push(...wordsInCat);
        }
        for (const meaning of meanings) {
          const wordsSameMeaning = await this.getWordsWithMeaning(meaning, dialectCode);
          allSuggestions.push(...wordsSameMeaning);
        }

        // 4) Hyphenation
        const hyphenSuggestions = this.getHyphenationSuggestions(normalized, dialectCode);
        allSuggestions.push(...hyphenSuggestions);

        // 5) Dictionary suggestions
        const dict = this.dicts[dialectCode];
        if (dict) {
          const suggestions = dict.suggest(normalized) || [];
          const validSugg = suggestions.filter((s) => s && s.trim().length > 0);
          allSuggestions.push(...validSugg);
        }
      })
    );

    // 6) Stop word-lignende ord
    const stopWordSuggestions = this.getStopWordSuggestions(normalized);
    allSuggestions.push(...stopWordSuggestions);

    // 7) Karaktervariasjoner (å <-> a, ø <-> o, osv.)
    const variations = [];
    const charPatterns = {
      a: ["å"],
      o: ["ø"],
      e: ["æ"],
      å: ["a"],
      ø: ["o"],
      æ: ["e"],
    };
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];
      if (charPatterns[char]) {
        const variation = normalized.slice(0, i) + charPatterns[char][0] + normalized.slice(i + 1);
        variations.push(variation);
      }
    }

    // Sjekk om variasjoner er korrekte
    variations.forEach((v) => {
      dialectCodes.forEach((dialectCode) => {
        if (this.dicts[dialectCode] && this.dicts[dialectCode].correct(v)) {
          allSuggestions.push(v);
        }
      });
    });

    // Fjerner duplikater
    const unique = [...new Set(allSuggestions)].filter((s) => s && s.trim().length > 0);

    // Sorter etter Levenshtein for relevans
    const sorted = unique.sort(
      (a, b) => fastLevenshtein.get(normalized, a.toLowerCase()) -
                fastLevenshtein.get(normalized, b.toLowerCase())
    );

    const MAX_SUGGESTIONS = 15;
    const finalSuggestions = sorted.slice(0, MAX_SUGGESTIONS);

    logger.debug(`Avansert forslag for "${word}": ${finalSuggestions.join(", ")}`);
    return finalSuggestions.length > 0 ? finalSuggestions : [normalized];
  }

  /**
   * Sjekker om vi skal hoppe over stavekontroll
   */
  shouldSkipSpellCheck(word) {
    return (
      super.shouldSkipSpellCheck(word) ||
      /^\d{4}$/.test(word) ||                  // Postnummer
      /^(\+47)?[2-9]\d{7}$/.test(word)         // Telefonnummer
    );
  }

  /**
   * Grunnleggende morfologisk analyse
   */
  getMorphologicalAnalysis(word, dialectCode) {
    if (!this.dicts[dialectCode]) return [];
    try {
      const analysis = this.dicts[dialectCode].analyze(word);
      logger.debug(`Morph analysis for "${word}" i ${dialectCode}: ${JSON.stringify(analysis)}`);
      return analysis;
    } catch (error) {
      logger.error(`Feil i morphological analysis for "${word}": ${error.message}`);
      return [];
    }
  }

  /**
   * Del opp sammensatte ord via bindestrek og sjekk ordbok
   */
  getCompoundParts(word, dialectCode) {
    if (!this.hyphenators[dialectCode] || !this.dicts[dialectCode]) return [];
    try {
      const parts = this.hyphenators[dialectCode].hyphenate(word);
      if (!parts || parts.length <= 1) return [];
      const validParts = parts.filter(
        (p) => this.dicts[dialectCode].correct(p) && !this.specialTerms.has(p.toLowerCase())
      );
      logger.debug(`Sammensatte deler for "${word}": ${validParts.join(", ")}`);
      return validParts;
    } catch (error) {
      logger.error(`Feil ved sammensatte deler for "${word}": ${error.message}`);
      return [];
    }
  }

  /**
   * Thesaurus-info for ord
   */
  getThesaurusInfo(word, dialectCode) {
    if (!this.thesaurusParsers[dialectCode]) return null;
    try {
      const info = this.thesaurusParsers[dialectCode].getWordInfo(word);
      logger.debug(`Thesaurus-info for "${word}": ${JSON.stringify(info)}`);
      return info;
    } catch (error) {
      logger.error(`Feil ved henting av Thesaurus-info: ${error.message}`);
      return null;
    }
  }

  /**
   * Henter ordboksformer via affix-regler i Hunspell
   */
  getWordForms(word, dialectCode) {
    const analysis = this.getMorphologicalAnalysis(word, dialectCode);
    if (!analysis || !analysis.length) return [];
    const forms = analysis.map((a) => {
      const [base, ...affixes] = a.split("/");
      return { base, affixes };
    });
    logger.debug(`Word forms for "${word}" i ${dialectCode}: ${JSON.stringify(forms)}`);
    return forms;
  }

  /**
   * Identifiserer sammensatte ord
   */
  getCompoundSuggestions(word, dialectCode) {
    const analysis = this.getMorphologicalAnalysis(word, dialectCode);
    if (!analysis || !analysis.length) return [];
    const compounds = analysis.filter(
      (a) => a.includes("COMPOUND") || a.includes("compound") || a.includes("CMPD")
    );
    if (compounds.length) {
      logger.debug(`Sammensatt ord-analyse for "${word}": ${JSON.stringify(compounds)}`);
      return compounds.map((c) => c.split("/")[0]);
    }
    return [];
  }

  /**
   * Henter kategorier og betydninger fra Thesaurus
   */
  getThesaurusCategories(word, dialectCode) {
    const info = this.getThesaurusInfo(word, dialectCode);
    if (!info) return { categories: [], meanings: [] };
    const categories = info.categories || [];
    const meanings = info.meanings || [];
    logger.debug(`Thesaurus-kategorier for "${word}": ${categories.join(", ")}`);
    return { categories, meanings };
  }

  /**
   * Henter alle ord i en gitt thesaurus-kategori
   */
  async getWordsInCategory(category, dialectCode) {
    if (!this.thesaurusParsers[dialectCode]) return [];
    try {
      const words = await this.thesaurusParsers[dialectCode].getWordsInCategory(category);
      return words || [];
    } catch (error) {
      logger.error(`Feil ved henting av ord i kategori "${category}": ${error.message}`);
      return [];
    }
  }

  /**
   * Henter ord som har en gitt betydning
   */
  async getWordsWithMeaning(meaning, dialectCode) {
    if (!this.thesaurusParsers[dialectCode]) return [];
    try {
      const words = await this.thesaurusParsers[dialectCode].getWordsWithMeaning(meaning);
      return words || [];
    } catch (error) {
      logger.error(`Feil ved henting av ord med betydning "${meaning}": ${error.message}`);
      return [];
    }
  }

  /**
   * Forslag basert på stop words og vanlige fraser
   */
  getStopWordSuggestions(word) {
    if (!this.specialTerms) return [];
    const normalized = word.toLowerCase().trim();
    const similar = [];
    this.specialTerms.forEach((term) => {
      const dist = fastLevenshtein.get(normalized, term);
      if (dist <= 2 && term.length >= normalized.length - 2 && term.length <= normalized.length + 2) {
        similar.push(term);
      }
    });
    return similar;
  }

  /**
   * Forslag basert på bindestrek-regler
   */
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
      logger.error(`Feil ved hyphenation suggestions for "${word}": ${error.message}`);
      return [];
    }
  }

  /**
   * Henter synonymer for et ord
   */
  getSynonyms(word) {
    if (!word || typeof word !== "string") return [];
    const normalizedWord = word.toLowerCase().trim();
    logger.debug(`Henter synonymer for "${normalizedWord}"`);

    let allSynonyms = [];
    // Bokmål
    if (this.thesaurusParsers.nb) {
      try {
        const nbSyn = this.thesaurusParsers.nb.getSynonyms(normalizedWord) || [];
        allSynonyms.push(...nbSyn);
      } catch (err) {
        logger.error(`Feil ved henting av Bokmål-synonymer: ${err.message}`);
      }
    }
    // Nynorsk
    if (this.thesaurusParsers.nn) {
      try {
        const nnSyn = this.thesaurusParsers.nn.getSynonyms(normalizedWord) || [];
        allSynonyms.push(...nnSyn);
      } catch (err) {
        logger.error(`Feil ved henting av Nynorsk-synonymer: ${err.message}`);
      }
    }
    const uniqueSynonyms = [...new Set(allSynonyms)].filter((s) => !s.includes("�"));
    return uniqueSynonyms;
  }
}

module.exports = new NorwegianSpellChecker();
module.exports.NorwegianSpellChecker = NorwegianSpellChecker;
