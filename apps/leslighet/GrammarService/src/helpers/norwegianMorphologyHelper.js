/**
 * Norwegian Morphology Helper
 * 
 * Utility for processing and accessing the rich morphological data from Norsk Ordbank
 * Handles loading and processing of various morphological data files
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const LRUCacheAdapter = require('../adapters/LRUCacheAdapter');

/**
 * Helper class for Norwegian morphological analysis
 */
class NorwegianMorphologyHelper {
  /**
   * Create a new morphology helper
   * @param {Object} options Configuration options
   * @param {string} options.dataPath Path to the norsk_ordbank directory
   * @param {boolean} options.cacheEnabled Whether to enable in-memory caching
   * @param {number} options.cacheSize Maximum size of cache (entries)
   */
  constructor(options = {}) {
    this._dataPath = options.dataPath || path.join(process.cwd(), 'data/norsk_ordbank');
    this._cacheEnabled = options.cacheEnabled !== false;
    this._cacheSize = options.cacheSize || 5000;
    
    // Initialize cache
    if (this._cacheEnabled) {
      this._cache = new LRUCacheAdapter({ maxSize: this._cacheSize });
    }
    
    // Initialize data structures
    this._lemmas = new Map();
    this._paradigms = new Map();
    this._inflections = new Map();
    this._inflectionGroups = new Map();
    this._paradigmInflections = new Map();
    this._wordForms = new Map(); // Initialize word forms map here
    this._fullForms = new Map();
    
    // Compound word analysis
    this._compoundAnalysis = new Map();
    
    // Track loading status
    this._dataLoaded = false;
    this._loadingPromise = null;

    // Build indices
    this._buildIndices();
  }
  
  /**
   * Data validation constants
   * @private
   */
  static _DATA_SCHEMAS = {
    BOYING: ['LOEPENR', 'BOY_NUMMER', 'BOY_GRUPPE', 'BOY_TEKST', 'ORDBOK_TEKST'],
    LEMMA: ['LOEPENR', 'LEMMA_ID', 'GRUNNFORM', 'BM_ORDBOK'],
    PARADIGME: ['LOEPENR', 'PARADIGME_ID', 'BOY_GRUPPE', 'ORDKLASSE', 'ORDKLASSE_UTDYPING', 'FORKLARING', 'DOEME', 'ID']
  };

  /**
   * Validates data file content against expected schema
   * @private
   * @param {string} content File content
   * @param {string[]} expectedColumns Expected column names
   * @returns {boolean} True if valid
   * @throws {Error} If validation fails
   */
  _validateDataContent(content, expectedColumns) {
    const lines = content.split('\n');
    if (lines.length < 2) {
      throw new Error('File appears to be empty or corrupted');
    }

    // Clean header row by removing quotes and trimming whitespace
    const headers = lines[0].split('\t').map(col => col.replace(/['"]/g, '').trim());
    const isValid = expectedColumns.every(col => headers.includes(col));
    
    if (!isValid) {
      throw new Error(`Invalid file format. Expected columns: ${expectedColumns.join(', ')}`);
    }
    return true;
  }

  /**
   * Clean and normalize text data
   * @private
   * @param {string} text Text to clean
   * @returns {string} Cleaned text
   */
  _normalizeText(text) {
    // First decode any HTML entities
    const decodedText = text
      .replace(/&aelig;|ï¿½/g, 'æ')
      .replace(/&oslash;|ï¿½/g, 'ø')
      .replace(/&aring;|ï¿½/g, 'å')
      .replace(/&AElig;|Ï¿½/g, 'Æ')
      .replace(/&Oslash;|Ï¿½/g, 'Ø')
      .replace(/&Aring;|Ï¿½/g, 'Å')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control characters but keep newlines

    return decodedText
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n')
      .trim();
  }

  /**
   * Load and validate a data file
   * @private
   * @param {string} filePath File path
   * @param {string[]} schema Expected schema columns
   */
  async _loadDataFile(filePath, schema) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const normalizedContent = this._normalizeText(content);
      
      this._validateDataContent(normalizedContent, schema);
      return normalizedContent;
    } catch (error) {
      console.error(`Error loading ${filePath}:`, error);
      throw new Error(`Failed to load data file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Load all morphological data
   * @returns {Promise<void>}
   */
  async loadData() {
    // Skip if already loaded or loading
    if (this._dataLoaded) {
      return;
    }

    if (this._loadingPromise) {
      return this._loadingPromise;
    }

    try {
      this._loadingPromise = this._loadAllData();
      await this._loadingPromise;
      this._dataLoaded = true;
    } catch (error) {
      console.error('Failed to load morphological data:', error);
      throw error;
    } finally {
      this._loadingPromise = null;
    }
  }
  
  /**
   * Internal method to load all data files
   * @private
   */
  async _loadAllData() {
    try {
      // First load inflection groups since other data depends on it
      await this._loadInflectionGroups(path.join(this._dataPath, 'boying_grupper.txt'));
      
      // Then load base data files
      const [boyingData, lemmaData, paradigmeData] = await Promise.all([
        this._loadDataFile(path.join(this._dataPath, 'boying.txt'), NorwegianMorphologyHelper._DATA_SCHEMAS.BOYING),
        this._loadDataFile(path.join(this._dataPath, 'lemma.txt'), NorwegianMorphologyHelper._DATA_SCHEMAS.LEMMA),
        this._loadDataFile(path.join(this._dataPath, 'paradigme.txt'), NorwegianMorphologyHelper._DATA_SCHEMAS.PARADIGME)
      ]);

      // Process the base data first
      await this._loadInflections(boyingData);
      await this._loadParadigms(paradigmeData);
      await this._loadLemmas(lemmaData);

      // Load relationships and additional data in parallel
      await Promise.all([
        this._loadParadigmInflections(path.join(this._dataPath, 'paradigme_boying.txt')),
        this._loadLemmaParadigms(path.join(this._dataPath, 'lemma_paradigme.txt')),
        this._loadCompoundAnalysis(path.join(this._dataPath, 'leddanalyse.txt')),
        this._loadFullForms(path.join(this._dataPath, 'fullformsliste.txt'))
      ]);

      // Build word form index once all data is loaded
      this._buildWordFormIndex();
      console.log('Morphology data loaded successfully');
    } catch (error) {
      console.error('Failed to load morphological data:', error);
      throw error;
    }
  }
  
  /**
   * Load inflection groups data
   * @param {string} filePath Path to boying_grupper.txt
   * @private
   */
  async _loadInflectionGroups(filePath) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const lines = this._normalizeText(content).split('\n');
      let loadedCount = 0;

      // Skip header line
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('#') || line.trim() === '') continue;
        
        const parts = line.split('\t');
        if (parts.length >= 2) {  // Changed from >= 3 to >= 2 since some entries might not have descriptions
          const id = parts[0].trim();
          const name = parts[1].trim();
          const description = parts.length > 2 ? parts[2].trim() : '';
          
          this._inflectionGroups.set(id, {
            id,
            name,
            description
          });
          loadedCount++;
        }
      }
      console.log(`Loaded ${loadedCount} inflection groups`);
    } catch (error) {
      console.error(`Error loading inflection groups from ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Load inflections data
   * @param {string} content Content of boying.txt
   * @private
   */
  async _loadInflections(content) {
    try {
      const lines = this._normalizeText(content).split('\n');
      let loadedCount = 0;
      
      // Skip header line
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('#') || line.trim() === '') continue;
        
        const parts = line.split('\t');
        if (parts.length >= 5) {
          const id = parts[0].trim(); // LOEPENR
          const boyNummer = parts[1].trim(); // BOY_NUMMER
          const boyGruppe = parts[2].trim(); // BOY_GRUPPE
          const text = parts[3].trim(); // BOY_TEKST
          const dictText = parts[4].trim(); // ORDBOK_TEKST
          
          this._inflections.set(boyNummer, {
            id,
            boyNummer,
            boyGruppe,
            text,
            dictText: dictText || text
          });
          loadedCount++;
        }
      }
      console.log(`Loaded ${loadedCount} inflections from boying.txt`);
    } catch (error) {
      console.error('Error loading inflections:', error);
      throw error;
    }
  }
  
  /**
   * Load paradigms data
   * @param {string} content Content of paradigme.txt
   * @private
   */
  async _loadParadigms(content) {
    try {
      const lines = this._normalizeText(content).split('\n');
      let loadedCount = 0;
      
      // Skip header line
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('#') || line.trim() === '') continue;
        
        const parts = line.split('\t');
        if (parts.length >= 8) {
          const [id, paradigmeId, boyGruppe, ordklasse, ordklasseUtdyping, forklaring, doeme] = 
            parts.map(p => p.trim());
          
          this._paradigms.set(paradigmeId, {
            id,
            paradigmeId,
            groupId: boyGruppe,
            wordClass: ordklasse,
            wordClassDetail: ordklasseUtdyping,
            description: forklaring,
            example: doeme
          });
          loadedCount++;
        }
      }
      console.log(`Loaded ${loadedCount} paradigms`);
    } catch (error) {
      console.error('Error loading paradigms:', error);
      throw error;
    }
  }

  /**
   * Load paradigm inflections mappings
   * @param {string} filePath Path to paradigme_boying.txt
   * @private
   */
  async _loadParadigmInflections(filePath) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const lines = this._normalizeText(content).split('\n');
      let loadedCount = 0;
      let uniqueParadigms = new Set();
      
      // Skip header line
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('#') || line.trim() === '') continue;
        
        const parts = line.split('\t');
        if (parts.length >= 5) {
          const paradigmId = parts[1].trim(); // PARADIGME_ID
          const boyNummer = parts[2].trim(); // BOY_NUMMER
          
          if (!this._paradigmInflections.has(paradigmId)) {
            this._paradigmInflections.set(paradigmId, new Set());
          }
          
          this._paradigmInflections.get(paradigmId).add(boyNummer);
          uniqueParadigms.add(paradigmId);
          loadedCount++;
        }
      }
      console.log(`Loaded ${loadedCount} paradigm-inflection mappings for ${uniqueParadigms.size} paradigms`);
    } catch (error) {
      console.error(`Error loading paradigm inflections:`, error);
      throw error;
    }
  }
  
  /**
   * Load lemmas (base forms) data
   * @param {string} content Content of lemma.txt
   * @private
   */
  async _loadLemmas(content) {
    try {
      const lines = this._normalizeText(content).split('\n');
      let loadedCount = 0;
      
      // Skip header line
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('#') || line.trim() === '') continue;
        
        const parts = line.split('\t');
        if (parts.length >= 4) {
          const [loepenr, lemmaId, grunnform, bmOrdbok] = parts.map(p => p.trim());
          
          this._lemmas.set(lemmaId, {
            id: loepenr,
            lemmaId,
            lemma: grunnform,
            inBokmaalDict: bmOrdbok === '1',
            paradigms: []
          });
          loadedCount++;
        }
      }
      console.log(`Loaded ${loadedCount} lemmas`);
    } catch (error) {
      console.error('Error loading lemmas:', error);
      throw error;
    }
  }
  
  /**
   * Load lemma-paradigm mappings
   * @param {string} filePath Path to lemma_paradigme.txt
   * @private
   */
  async _loadLemmaParadigms(filePath) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const lines = this._normalizeText(content).split('\n');
      let loadedCount = 0;
      let uniqueLemmas = new Set();
      
      // Skip header line
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('#') || line.trim() === '') continue;
        
        const parts = line.split('\t');
        if (parts.length >= 2) {
          const lemmaId = parts[0].trim();
          const paradigmId = parts[1].trim();
          
          const lemma = this._lemmas.get(lemmaId);
          if (lemma) {
            lemma.paradigms.push(paradigmId);
            uniqueLemmas.add(lemmaId);
            loadedCount++;
          }
        }
      }
      console.log(`Loaded ${loadedCount} lemma-paradigm mappings for ${uniqueLemmas.size} lemmas`);
    } catch (error) {
      console.error('Error loading lemma-paradigm mappings:', error);
      throw error;
    }
  }

  /**
   * Load compound word analysis data
   * @param {string} filePath Path to leddanalyse.txt
   * @private
   */
  async _loadCompoundAnalysis(filePath) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const lines = this._normalizeText(content).split('\n');
      let loadedCount = 0;
      
      // Skip header line
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('#') || line.trim() === '') continue;
        
        const parts = line.split('\t');
        if (parts.length >= 3) {
          const id = parts[0].trim();
          const word = parts[1].trim();
          const components = parts[2].split('+').map(c => c.trim());
          
          this._compoundAnalysis.set(word.toLowerCase(), {
            id,
            word,
            components
          });
          loadedCount++;
        }
      }
      console.log(`Loaded ${loadedCount} compound word analyses`);
    } catch (error) {
      console.error('Error loading compound analyses:', error);
      throw error;
    }
  }

  /**
   * Load full forms list
   * @param {string} filePath Path to fullformsliste.txt
   * @private
   */
  async _loadFullForms(filePath) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const lines = this._normalizeText(content).split('\n');
      let loadedCount = 0;
      
      // Initialize maps
      this._fullForms = new Map();
      this._wordForms = new Map(); // Reset word forms map before loading
      
      // Skip header line
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('#') || line.trim() === '') continue;
        
        const parts = line.split('\t');
        if (parts.length >= 3) {
          const fullForm = parts[0].trim();
          const lemmaId = parts[1].trim();
          const tag = parts[2].trim();
          
          // Store in both maps
          const key = fullForm.toLowerCase();
          
          // Store in full forms map
          if (!this._fullForms.has(key)) {
            this._fullForms.set(key, []);
          }
          this._fullForms.get(key).push({ fullForm, lemmaId, tag });
          
          // Store in word forms map
          if (!this._wordForms.has(key)) {
            this._wordForms.set(key, []);
          }
          this._wordForms.get(key).push({
            form: fullForm,
            lemmaId,
            tag
          });
          
          loadedCount++;
        }
      }
      console.log(`Loaded ${loadedCount} full forms`);
    } catch (error) {
      console.error('Error loading full forms:', error);
      throw error;
    }
  }
  
  /**
   * Build index of word forms based on loaded data
   * @private
   */
  _buildWordFormIndex() {
    const startTime = Date.now();
    let indexedCount = 0;
    let lemmaCount = 0;

    // Then add any generated forms from paradigm-based inflections
    for (const [lemmaId, lemma] of this._lemmas.entries()) {
      if (!lemma.paradigms || lemma.paradigms.length === 0) {
        continue;
      }
      lemmaCount++;
      
      for (const paradigmId of lemma.paradigms) {
        const inflectionIds = this._paradigmInflections.get(paradigmId);
        if (!inflectionIds) {
          continue;
        }
        
        // Get paradigm and group info for proper classification
        const paradigm = this._paradigms.get(paradigmId);
        const group = paradigm ? this._inflectionGroups.get(paradigm.groupId) : null;
        
        // Generate all inflected forms for this lemma + paradigm
        for (const inflectionId of inflectionIds) {
          const inflection = this._inflections.get(inflectionId);
          if (!inflection) {
            continue;
          }
          
          // Get the base form data
          let inflectedForm;
          if (inflection.dictText && inflection.dictText.trim()) {
            inflectedForm = inflection.dictText.replace('~', lemma.lemma);
          } else {
            inflectedForm = inflection.text ? lemma.lemma + inflection.text : lemma.lemma;
          }
          
          if (!inflectedForm) continue;
          
          // Create word form info object
          const wordFormInfo = {
            form: inflectedForm,
            lemma: lemma.lemma,
            lemmaId,
            inflection: inflection.text || '',
            tag: inflection.boyNummer || '',
            paradigmId,
            groupId: paradigm ? paradigm.groupId : null,
            groupName: group ? group.name : null
          };
          
          // Index by inflected form (lowercased for easier lookup)
          const key = inflectedForm.toLowerCase();
          if (!this._wordForms.has(key)) {
            this._wordForms.set(key, []);
          }
          this._wordForms.get(key).push(wordFormInfo);
          indexedCount++;
        }
      }

      // Add any compound analysis if available
      const compoundInfo = this._compoundAnalysis.get(lemma.lemma.toLowerCase());
      if (compoundInfo) {
        const key = lemma.lemma.toLowerCase();
        const existing = this._wordForms.get(key) || [];
        existing.push({
          form: lemma.lemma,
          lemma: lemma.lemma,
          lemmaId,
          isCompound: true,
          components: compoundInfo.components
        });
        this._wordForms.set(key, existing);
      }
    }
    
    const endTime = Date.now();
    console.log(`Indexed ${indexedCount} generated forms from ${lemmaCount} processed lemmas in ${endTime - startTime}ms`);
  }
  
  /**
   * Get word forms with caching
   * @param {string} word Word to lookup
   * @returns {Promise<Array<Object>>} Array of word form information objects
   */
  async getWordForms(word) {
    await this._ensureDataLoaded();
    
    const key = word.toLowerCase();
    
    // Check cache first
    if (this._cacheEnabled && this._cache.wordForms.has(key)) {
      return this._cache.wordForms.get(key);
    }
    
    const forms = this._wordForms.get(key) || [];
    
    // Cache the result if caching is enabled
    if (this._cacheEnabled) {
      this._cache.wordForms.set(key, forms);
    }
    
    return forms;
  }

  /**
   * Get grammatical features for a word form
   * @param {string} wordForm The word form to analyze
   * @returns {Promise<Array<Object>>} Array of grammatical feature objects
   */
  async getGrammaticalFeatures(wordForm) {
    const forms = await this.getWordForms(wordForm);
    
    // Process tags into grammatical features
    return forms.map(form => {
      const features = this._parseTag(form.tag, form.groupName);
      return {
        lemma: form.lemma,
        form: form.form,
        partOfSpeech: form.groupName,
        inflection: form.inflection,
        ...features
      };
    });
  }
  
  /**
   * Get lemma (base form) for a word form
   * @param {string} wordForm The word form to get lemma for
   * @returns {Promise<Array<string>>} Array of possible lemmas
   */
  async getLemmas(wordForm) {
    const forms = await this.getWordForms(wordForm);
    
    // Extract unique lemmas
    const lemmas = new Set();
    for (const form of forms) {
      lemmas.add(form.lemma);
    }
    
    return Array.from(lemmas);
  }
  
  /**
   * Get compound word analysis
   * @param {string} word The word to analyze
   * @returns {Promise<Object|null>} Compound analysis or null if not a compound
   */
  async getCompoundAnalysis(word) {
    await this._ensureDataLoaded();
    
    const key = word.toLowerCase();
    
    // Check cache first
    if (this._cacheEnabled && this._cache.compounds.has(key)) {
      return this._cache.compounds.get(key);
    }
    
    const analysis = this._compoundAnalysis.get(key) || null;
    
    // Cache the result if caching is enabled
    if (this._cacheEnabled) {
      this._cache.compounds.set(key, analysis);
    }
    
    return analysis;
  }
  
  /**
   * Parse tag string into grammatical features
   * @param {string} tag The tag to parse
   * @param {string} groupName The group name (part of speech)
   * @returns {Object} Object with grammatical features
   * @private
   */
  _parseTag(tag, groupName) {
    const features = {};
    
    // Skip if missing data
    if (!tag) return features;
    
    // Common tag components
    if (tag.includes('ent')) {
      features.number = 'singular';
    } else if (tag.includes('fl')) {
      features.number = 'plural';
    }
    
    if (tag.includes('be')) {
      features.definiteness = 'definite';
    } else if (tag.includes('ub')) {
      features.definiteness = 'indefinite';
    }
    
    // Gender for nouns
    if (groupName === 'substantiv') {
      if (tag.includes('m')) {
        features.gender = 'masculine';
      } else if (tag.includes('f')) {
        features.gender = 'feminine';
      } else if (tag.includes('n')) {
        features.gender = 'neuter';
      }
    }
    
    // Tense for verbs
    if (groupName === 'verb') {
      if (tag.includes('inf')) {
        features.verbForm = 'infinitive';
      } else if (tag.includes('pres')) {
        features.tense = 'present';
      } else if (tag.includes('pret')) {
        features.tense = 'past';
      } else if (tag.includes('perf-part')) {
        features.verbForm = 'participle';
        features.aspect = 'perfect';
      } else if (tag.includes('imp')) {
        features.mood = 'imperative';
      }
    }
    
    // Degree for adjectives
    if (groupName === 'adjektiv') {
      if (tag.includes('pos')) {
        features.degree = 'positive';
      } else if (tag.includes('komp')) {
        features.degree = 'comparative';
      } else if (tag.includes('sup')) {
        features.degree = 'superlative';
      }
    }
    
    return features;
  }
  
  /**
   * Ensure data is loaded before proceeding
   * @private
   */
  async _ensureDataLoaded() {
    if (!this._dataLoaded) {
      await this.loadData();
    }
  }

  /**
   * Cache for morphological lookups
   * @private
   */
  _cache = {
    wordForms: new Map(),
    compounds: new Map(),
    paradigms: new Map()
  };

  /**
   * Clear all caches to free memory
   */
  clearCaches() {
    if (this._cacheEnabled && this._cache) {
      this._cache.wordForms.clear();
      this._cache.compounds.clear();
      this._cache.paradigms.clear();
    }
  }

  /** 
   * Build optimized indices for fast lookups
   * @private 
   */
  _buildIndices() {
    // Word form index is already handled by _wordForms Map
    // Compound word index is already handled by _compoundAnalysis Map
    // Lemma index is already handled by _lemmaTextIndex Map
    // Paradigm index is already handled by _paradigms Map
  }

  /**
   * Generate valid compound words from components
   * @param {string[]} components Words to combine
   * @returns {string[]} Valid compound combinations
   */
  generateCompounds(components) {
    const results = [];
    const validFugeElements = new Set(['s', 'e', '']); // Common binding elements

    for (let i = 0; i < components.length - 1; i++) {
      const firstWord = components[i];
      const secondWord = components[i + 1];

      // Try different binding elements
      for (const fuge of validFugeElements) {
        const compound = firstWord + fuge + secondWord;
        // Verify if compound exists in dictionary
        if (this._lemmaIndex.has(compound.toLowerCase())) {
          results.push(compound);
        }
      }
    }

    return results;
  }

  /**
   * Get possible derivations of a word
   * @param {string} word Base word
   * @returns {Object} Derivation possibilities
   */
  getDerivations(word) {
    const derivations = {
      prefixed: [],
      suffixed: [],
      compounds: []
    };

    // Check common prefixes
    const prefixes = ['u', 'mis', 'van', 'gjen', 'sam'];
    for (const prefix of prefixes) {
      const prefixed = prefix + word;
      if (this._lemmaIndex.has(prefixed.toLowerCase())) {
        derivations.prefixed.push(prefixed);
      }
    }

    // Check common suffixes
    const suffixes = ['het', 'lig', 'else', 'ing'];
    for (const suffix of suffixes) {
      const suffixed = word + suffix;
      if (this._lemmaIndex.has(suffixed.toLowerCase())) {
        derivations.suffixed.push(suffixed);
      }
    }

    // Find compound words where this word is a component
    for (const [compound, analysis] of this._compoundIndex) {
      if (analysis.components.includes(word)) {
        derivations.compounds.push(compound);
      }
    }

    return derivations;
  }
}

module.exports = NorwegianMorphologyHelper;