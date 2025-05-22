// src/services/BaseSpellChecker.js
const Redis = require("ioredis");
const fastLevenshtein = require("fast-levenshtein");
const { createLogger, format, transports } = require("winston");
const SpellCheckerFeedbackSystem = require("./SpellCheckerFeedbackSystem");
const { TeXHyphenator } = require("../utils/TeXHyphenator");
const { MyThesParser } = require("../utils/MyThesParser");

/**
 * Winston logger for strukturert logging
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

class BaseSpellChecker {
  /**
   * @param {Object} options Konfigurasjonsobjekt
   * @param {String} options.languageCode F.eks. 'en', 'no'
   * @param {String} options.redisKeyPrefix F.eks. 'english', 'norsk'
   * @param {String[]} options.dialectCodes Dialektkoder, f.eks. ['gb','us'] eller ['nb','nn']
   * @param {Object} options.dialectSettings Hvilke dialekter er aktive
   * @param {Array<String>} options.commonPhrases Evt. felles fraser som skal regnes som “spesialord”
   * @param {Number} options.cacheMaxSize Hvor mange entries cachen kan lagre
   * @param {Object} options.redis Redis-innstillinger (host, port, etc.)
   */
  constructor(options = {}) {
    this.languageCode = options.languageCode || "generic";
    this.redisKeyPrefix = options.redisKeyPrefix || "spellchecker";
    
    // Dialekter og ordbøker
    this.dialectCodes = options.dialectCodes || [];
    this.dialectSettings = {};
    this.dicts = {};
    this.dictionaryLoaded = {};

    this.dialectCodes.forEach((code) => {
      this.dicts[code] = null;
      this.dictionaryLoaded[code] = false;
      // Standard: true hvis ikke spesifisert
      this.dialectSettings[code] = options.dialectSettings?.[code] ?? true;
    });

    // Spesialord / vanlige fraser
    this.specialTerms = new Set();
    this.specialTermsLoaded = false;
    this.commonPhrases = new Set(options.commonPhrases || []);

    // Ekstra verktøy
    this.hyphenators = {};
    this.thesaurusParsers = {};

    // Feedback system
    this.feedbackSystem = new SpellCheckerFeedbackSystem(options.feedback);

    // Caching
    this.cache = new Map();
    this.cacheMaxSize = options.cacheMaxSize || 10000;
    this.cacheHits = 0;
    this.cacheMisses = 0;

    // Redis-tilkobling
    this.redis = new Redis(
      options.redis || {
        host: process.env.REDIS_HOST || "localhost",
        port: process.env.REDIS_PORT || 6379,
      }
    );
    this.redis.on("error", (err) => {
      logger.error(`[${this.languageCode}] Redis error: ${err.message}`);
    });
    this.redis.on("connect", () => {
      logger.info(`[${this.languageCode}] Redis connected`);
    });
  }

  /**
   * Hjelpefunksjon for trygg lasting av data fra Redis
   */
  async safeLoad(fn, errMsg) {
    try {
      return await fn();
    } catch (error) {
      logger.error(`${errMsg}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Hovedmetode for å sjekke om et ord er korrekt stavet
   * @param {String} word Ordet som skal sjekkes
   * @returns {Promise<{correct: boolean, suggestions: string[], [key: string]: any}>}
   */
  async checkWord(word) {
    if (!word || typeof word !== "string") {
      return { correct: false, suggestions: [], message: "Invalid input" };
    }

    const normalized = word.toLowerCase().trim();
    if (!normalized) {
      return { correct: false, suggestions: [], message: "Empty input" };
    }

    // Hopp over visse ord (tall, URLs, eposter, etc.)
    if (this.shouldSkipSpellCheck(normalized)) {
      return { correct: true, suggestions: [], type: "skip" };
    }

    // Cache-sjekk
    const cacheKey = this.getCacheKey(normalized);
    if (this.cache.has(cacheKey)) {
      this.cacheHits++;
      return this.cache.get(cacheKey);
    }
    this.cacheMisses++;

    // Sjekk spesialord og feedback
    if (await this.isSpecialTerm(normalized)) {
      const result = { correct: true, suggestions: [], source: "special_term" };
      this.addToCache(normalized, result);
      return result;
    }

    const feedbackStatus = this.feedbackSystem.getWordFeedbackStatus(normalized);
    if (feedbackStatus?.shouldAccept) {
      const fbResult = { correct: true, suggestions: [], source: "user_feedback" };
      this.addToCache(normalized, fbResult);
      return fbResult;
    }

    // Sørg for at ordbøker er lastet
    await this.loadDictionaries();

    // Sjekk i hver aktiv ordbok
    const enabledDicts = this.getEnabledDictionaryObjects();
    let isCorrect = false;
    let allSuggestions = [];

    for (const { dict, code } of enabledDicts) {
      const correct = dict.correct(normalized);
      if (correct) {
        isCorrect = true;
        break;
      } else {
        const suggestions = dict.suggest(normalized) || [];
        allSuggestions.push(...suggestions);
      }
    }

    if (isCorrect) {
      const resOk = { correct: true, suggestions: [] };
      this.addToCache(normalized, resOk);
      return resOk;
    }

    // Hvis fortsatt feil, hent mer avanserte forslag
    const advSuggestions = await this.getEnhancedSuggestions(normalized, enabledDicts.map(d => d.code));
    allSuggestions.push(...advSuggestions);

    const unique = [...new Set(allSuggestions)].slice(0, 10);
    const result = { correct: false, suggestions: unique };
    this.addToCache(normalized, result);
    return result;
  }

  /**
   * Standardmetode for å hente “avanserte” forslag
   * Overstyr gjerne i subklassen med språklig logikk
   */
  async getEnhancedSuggestions(word, dialectCodes) {
    if (!word || word.length < 2) return [];

    // Gjenkjenner spesialord
    if (this.specialTerms.has(word)) {
      logger.debug(`[${this.languageCode}] Word "${word}" in special terms`);
      return [word];
    }

    let allSuggestions = [];
    
    // Parallell-løp dialekter
    await Promise.all(dialectCodes.map(async (dial) => {
      // Morf/analyse
      const forms = this.getWordForms(word, dial);
      if (forms.length > 0) {
        allSuggestions.push(...forms.map(f => f.base));
      }

      // Compound words
      const compounds = this.getCompoundSuggestions(word, dial);
      allSuggestions.push(...compounds);

      // Thesaurus-lignende ord
      const { categories, meanings } = this.getThesaurusCategories(word, dial);
      for (const cat of categories) {
        const catWords = await this.getWordsInCategory(cat, dial);
        allSuggestions.push(...catWords);
      }
      for (const meaning of meanings) {
        const meaningWords = await this.getWordsWithMeaning(meaning, dial);
        allSuggestions.push(...meaningWords);
      }

      // Ordbok-suggestions
      const dict = this.dicts[dial];
      if (dict) {
        const dictSugg = dict.suggest(word) || [];
        allSuggestions.push(...dictSugg);
      }

      // Hyphenation
      const hyphenSugg = this.getHyphenationSuggestions(word, dial);
      allSuggestions.push(...hyphenSugg);

    }));

    // Stopword-lignende
    const stopWordSugg = this.getStopWordSuggestions(word);
    allSuggestions.push(...stopWordSugg);

    // Sorter unike
    const unique = [...new Set(allSuggestions)].filter(s => s && s.trim());
    const sorted = unique.sort(
      (a, b) => fastLevenshtein.get(word, a.toLowerCase()) - fastLevenshtein.get(word, b.toLowerCase())
    );

    return sorted.slice(0, 15);
  }

  /**
   * Sjekk tekst for skrivefeil
   * @param {String} text Tekst å sjekke
   * @returns {Promise<Object>} Objekt med `errors`, `stats`, `dialectSettings`
   */
  async checkText(text) {
    if (!text || typeof text !== "string") {
      return { errors: [], dialectSettings: {...this.dialectSettings} };
    }
    // Last alt (ordbøker, spesialord, etc.)
    await this.loadAll();

    const words = this.extractWords(text);
    const errors = [];
    const batchSize = 15;

    for (let i = 0; i < words.length; i += batchSize) {
      const batch = words.slice(i, i + batchSize);
      const checkPromises = batch.map(async (w) => {
        if (this.shouldSkipSpellCheck(w.word)) return null;

        const res = await this.checkWord(w.word);
        if (!res.correct) {
          return {
            ...w,
            suggestions: res.suggestions,
            source: res.source || "dictionary",
          };
        }
        return null;
      });
      const results = await Promise.all(checkPromises);
      errors.push(...results.filter(Boolean));
    }

    return {
      type: "spelling",
      errors,
      dialectSettings: { ...this.dialectSettings },
      stats: {
        totalWords: words.length,
        errorCount: errors.length,
        errorRate: words.length > 0 ? errors.length / words.length : 0,
        cacheHits: this.cacheHits,
        cacheMisses: this.cacheMisses,
      },
    };
  }

  /**
   * Hent synonymer på tvers av dialekter (standard-implementasjon)
   * Subklasser kan overstyre for språkspesifikk logikk
   */
  getSynonyms(word) {
    if (!word || typeof word !== "string") return [];
    const normalized = word.toLowerCase().trim();
    logger.debug(`[${this.languageCode}] getSynonyms("${normalized}")`);

    const synonyms = [];
    for (const code of this.dialectCodes) {
      if (!this.thesaurusParsers[code]) continue;
      try {
        const arr = this.thesaurusParsers[code].getSynonyms(normalized);
        if (arr && arr.length) {
          synonyms.push(...arr);
        }
      } catch (error) {
        logger.error(`[${this.languageCode}] getSynonyms error: ${error.message}`);
      }
    }

    return [...new Set(synonyms)].filter(s => s && !s.includes("�"));
  }

  /**
   * Morfologisk analyse for ord
   */
  getMorphologicalAnalysis(word, dialectCode) {
    if (!this.dicts[dialectCode]) return [];
    try {
      const analysis = this.dicts[dialectCode].analyze(word);
      logger.debug(`[${this.languageCode}] morphAnalysis("${word}", ${dialectCode}):`, analysis);
      return analysis;
    } catch (error) {
      logger.error(`[${this.languageCode}] morphAnalysis error: ${error.message}`);
      return [];
    }
  }

  /**
   * Hent mulige ordformer
   */
  getWordForms(word, dialectCode) {
    const analysis = this.getMorphologicalAnalysis(word, dialectCode);
    return analysis.map(a => {
      const [base, ...affixes] = a.split("/");
      return { base, affixes };
    });
  }

  /**
   * Foreslå sammensatte ord
   */
  getCompoundSuggestions(word, dialectCode) {
    const analysis = this.getMorphologicalAnalysis(word, dialectCode);
    const compounds = analysis.filter(a => a.includes("COMPOUND"));
    return compounds.map(c => c.split("/")[0]);
  }

  /**
   * Hent bindestrek-baserte forslag
   */
  getHyphenationSuggestions(word, dialectCode) {
    const hyphenator = this.hyphenators[dialectCode];
    if (!hyphenator || !this.dicts[dialectCode]) return [];
    try {
      const parts = hyphenator.hyphenate(word);
      if (!parts || parts.length <= 1) return [];
      
      const suggestions = parts.filter(p => this.dicts[dialectCode].correct(p));
      return suggestions;
    } catch (error) {
      logger.error(`[${this.languageCode}] Hyphenation error: ${error.message}`);
      return [];
    }
  }

  /**
   * Hent thesaurus-info for ord
   */
  getThesaurusInfo(word, dialectCode) {
    const parser = this.thesaurusParsers[dialectCode];
    if (!parser) return null;
    try {
      return parser.getWordInfo(word);
    } catch (error) {
      logger.error(`[${this.languageCode}] Thesaurus info error: ${error.message}`);
      return null;
    }
  }

  /**
   * Hent kategorier & betydninger for et ord
   */
  getThesaurusCategories(word, dialectCode) {
    const info = this.getThesaurusInfo(word, dialectCode);
    if (!info) return { categories: [], meanings: [] };
    const categories = info.categories || [];
    const meanings = info.meanings || [];
    return { categories, meanings };
  }

  /**
   * Hent alle ord i en gitt kategori (thesaurus)
   */
  async getWordsInCategory(category, dialectCode) {
    const parser = this.thesaurusParsers[dialectCode];
    if (!parser) return [];
    try {
      const words = await parser.getWordsInCategory(category);
      return words || [];
    } catch (error) {
      logger.error(`[${this.languageCode}] getWordsInCategory("${category}") error: ${error.message}`);
      return [];
    }
  }

  /**
   * Hent alle ord med lignende betydning
   */
  async getWordsWithMeaning(meaning, dialectCode) {
    const parser = this.thesaurusParsers[dialectCode];
    if (!parser) return [];
    try {
      const words = await parser.getWordsWithMeaning(meaning);
      return words || [];
    } catch (error) {
      logger.error(`[${this.languageCode}] getWordsWithMeaning("${meaning}") error: ${error.message}`);
      return [];
    }
  }

  /**
   * Forslag basert på 'stop words' / spesialord
   */
  getStopWordSuggestions(word) {
    if (!this.specialTerms || !word) return [];
    const normalized = word.toLowerCase().trim();

    const suggestions = [];
    this.specialTerms.forEach((term) => {
      const dist = fastLevenshtein.get(normalized, term);
      if (dist <= 2 && Math.abs(term.length - normalized.length) <= 2) {
        suggestions.push(term);
      }
    });
    return suggestions;
  }

  /**
   * Sjekk om ord skal hoppes over (URL, tall, e-post, #hashtag, @mention, etc.)
   */
  shouldSkipSpellCheck(word) {
    return (
      // HELTALL / DESIMALTALL
      /^\d+(\.\d+)?$/.test(word) ||
      // URL
      /^https?:\/\/[^\s]+$/.test(word) ||
      // E-post
      /^[^\s]+@[^\s]+\.[^\s]+$/.test(word) ||
      // Hashtag / mention
      /^[#@].+/.test(word)
    );
  }

  /**
   * Hjelpemetode for å hente ut ord og posisjoner fra tekst
   */
  extractWords(text) {
    const wordRegex = /[^\s,.;!?"'()]+/g;
    const matches = [];
    let match;
    while ((match = wordRegex.exec(text)) !== null) {
      matches.push({
        word: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length - 1,
      });
    }
    return matches;
  }

  /**
   * Hjelpemetode for å generere cache-nøkkel
   */
  getCacheKey(word) {
    const dialectPart = this.dialectCodes
      .map((c) => `${c}:${this.dialectSettings[c] ? 1 : 0}`)
      .join("|");
    return `${this.languageCode}:${word}:${dialectPart}`;
  }

  /**
   * Legg resultat i cache (LRU-liknende ved å slette eldste)
   */
  addToCache(word, result) {
    if (this.cache.size >= this.cacheMaxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(this.getCacheKey(word), result);
  }

  /**
   * Sjekk om ordet finnes i custom words / spesialord
   */
  async isSpecialTerm(word) {
    // Pass på at spesialord er lastet
    if (!this.specialTermsLoaded) {
      await this.loadSpecialTerms();
    }
    // Sjekk feedback system
    if (this.feedbackSystem.isCustomWord(word)) {
      return true;
    }
    // Sjekk specialTerms-set
    return this.specialTerms.has(word);
  }

  /**
   * Fjern alt fra cache
   */
  clearCache() {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Lukk stavekontrollen (f.eks. Redis)
   */
  async close() {
    try {
      await this.redis.quit();
      this.cache.clear();
      logger.info(`[${this.languageCode}] SpellChecker closed`);
    } catch (error) {
      logger.error(`[${this.languageCode}] Error closing: ${error.message}`);
    }
  }

  /**
   * Hent dialekt-objekter som er aktivert
   */
  getEnabledDictionaryObjects() {
    return this.dialectCodes
      .filter((code) => this.dialectSettings[code] && this.dicts[code])
      .map((code) => ({ dict: this.dicts[code], code }));
  }

  /**
   * Last alt – ordbok, spesialord, custom words, hyphenation, thesaurus
   */
  async loadAll() {
    try {
      await Promise.all([
        this.loadDictionaries(),
        this.loadSpecialTerms(),
        this.loadCustomWords(),
        this.loadHyphenation(),
        this.loadThesaurus(),
      ]);
    } catch (error) {
      logger.error(`[${this.languageCode}] loadAll error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Last alle dialekter
   */
  async loadDictionaries() {
    const promises = [];
    for (const code of this.dialectCodes) {
      if (!this.dictionaryLoaded[code]) {
        promises.push(this.loadDictionary(code));
      }
    }
    await Promise.all(promises);
  }

  /**
   * Standardimplementasjon for loadDictionary
   * Overstyr i subklasse for språksøm (NB, EN, osv.)
   */
  async loadDictionary(dialectCode) {
    logger.warn(`[${this.languageCode}] loadDictionary: default implementation used!`);
    // Standard -> gjør ingenting eller kast en feilmelding
    // Du kan endre til å hente “this.redisKeyPrefix:hunspell:${dialectCode}” her
  }

  /**
   * Standard for spesialord – overstyr i subklasser
   */
  async loadSpecialTerms() {
    logger.warn(`[${this.languageCode}] loadSpecialTerms: default implementation used!`);
    // Kan lastes f.eks. fra “this.redisKeyPrefix:specialterms”
    this.specialTermsLoaded = true;
  }

  /**
   * Standard for custom words
   */
  async loadCustomWords() {
    logger.warn(`[${this.languageCode}] loadCustomWords: default implementation used!`);
    // Evt. last “customwords” fra Redis, fil, etc.
  }

  /**
   * Standard for hyphenation – overstyr i subklasser
   */
  async loadHyphenation() {
    logger.warn(`[${this.languageCode}] loadHyphenation: default implementation used!`);
  }

  /**
   * Standard for thesaurus – overstyr i subklasser
   */
  async loadThesaurus() {
    logger.warn(`[${this.languageCode}] loadThesaurus: default implementation used!`);
  }

  /**
   * Endre hvilke dialekter som er aktivert
   */
  setDialects(settings = {}) {
    const enabledCount = Object.values(settings).filter(Boolean).length;
    if (enabledCount === 0) {
      // Må ha minst én dialekt
      return false;
    }
    this.dialectCodes.forEach((code) => {
      if (typeof settings[code] === "boolean") {
        this.dialectSettings[code] = settings[code];
      }
    });
    // Rensk opp cache
    this.clearCache();
    return true;
  }

  /**
   * Check if a word exists in custom words dictionary
   * @param {string} word - Word to check
   * @returns {Promise<Object>} Result with correct flag and suggestions
   */
  async checkInCustomWords(word) {
    if (!word || typeof word !== 'string') {
      return { correct: false, suggestions: [] };
    }

    try {
      // Get custom words from Redis
      const customWordsKey = `${this.redisKeyPrefix}:customwords`;
      const customWordsBuffer = await this.redis.getBuffer(customWordsKey);
      
      if (!customWordsBuffer) {
        return { correct: false, suggestions: [] };
      }

      // Convert buffer to string with proper encoding
      const customWordsJson = customWordsBuffer.toString('utf8');
      const customWords = JSON.parse(customWordsJson);
      
      // Check if word exists in custom words (case insensitive)
      const normalizedWord = word.toLowerCase().trim();
      const exists = customWords.some(customWord => 
        customWord.toLowerCase() === normalizedWord
      );

      return {
        correct: exists,
        suggestions: exists ? [] : customWords.filter(customWord => 
          this.levenshteinDistance(normalizedWord, customWord.toLowerCase()) <= 2
        ).slice(0, 5)
      };
    } catch (error) {
      console.error(`Error checking custom words for ${this.languageCode}:`, error);
      return { correct: false, suggestions: [] };
    }
  }

  /**
   * Hent litt statistikk om cachen/dialekter
   */
  getStats() {
    const baseStats = {
      cache: {
        size: this.cache.size,
        hits: this.cacheHits,
        misses: this.cacheMisses,
        maxSize: this.cacheMaxSize,
      },
      dialectSettings: { ...this.dialectSettings },
    };

    const thesaurusStats = {};
    for (const [code, parser] of Object.entries(this.thesaurusParsers)) {
      if (parser && typeof parser.getStats === "function") {
        thesaurusStats[code] = parser.getStats();
      }
    }

    const hyphenationStats = {};
    for (const [code, hyphenator] of Object.entries(this.hyphenators)) {
      if (hyphenator && typeof hyphenator.getStats === "function") {
        hyphenationStats[code] = hyphenator.getStats();
      }
    }

    return {
      ...baseStats,
      thesaurus: thesaurusStats,
      hyphenation: hyphenationStats,
    };
  }

  /**
   * Behandle brukertilbakemeldinger om ord
   */
  async processFeedback(word, isCorrect, userId = "anonymous") {
    const res = await this.feedbackSystem.processFeedback(word, isCorrect, userId);
    if (res.success && res.addedToCustomWords) {
      // Legg til i spesialord + rensk cache
      this.addSpecialTerm(res.word);
      this.removeFromCache(res.word);
    }
    return res;
  }

  /**
   * Legg til ord i spesialord
   */
  addSpecialTerm(term) {
    if (term && typeof term === "string") {
      this.specialTerms.add(term.toLowerCase().trim());
    }
  }

  /**
   * Fjern ord fra spesialord
   */
  removeSpecialTerm(term) {
    if (term && typeof term === "string") {
      this.specialTerms.delete(term.toLowerCase().trim());
    }
  }

  /**
   * Fjern et ord fra cache (for alle dialekt-kombinasjoner)
   */
  removeFromCache(word) {
    if (!word) return;
    const normalized = word.toLowerCase().trim();

    // Siden cacheKey inkluderer dialekter, fjern alt ved å brute-force
    const keysToRemove = [];
    for (const key of this.cache.keys()) {
      if (key.includes(`${this.languageCode}:${normalized}:`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => this.cache.delete(k));
  }
}

module.exports = BaseSpellChecker;
