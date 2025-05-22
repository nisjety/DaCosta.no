const redisConnection = require('../utils/RedisConnection');
const fs = require('fs').promises;
const path = require('path');
const LRUCache = require('lru-cache');

/**
 * Helper: Decide which encoding to use based on the filename.
 * - English files (en_*, th_en_*) are read as "utf8".
 * - Norwegian files (nb_*, nn_*, th_nb_*, th_nn_*) are read as "latin1".
 */
function detectEncoding(fileName) {
  const lowerName = fileName.toLowerCase();
  if (
    lowerName.includes("en_gb") ||
    lowerName.includes("en_us") ||
    lowerName.includes("th_en_")
  ) {
    return "utf8";
  }
  if (
    lowerName.includes("nb_no") ||
    lowerName.includes("nn_no") ||
    lowerName.includes("th_nb_") ||
    lowerName.includes("th_nn_")
  ) {
    return "latin1";
  }
  return "latin1";
}

/**
 * Read file content from disk with the appropriate encoding.
 * JSON files are always read as "utf8".
 */
async function readFileAutoEncoding(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".json") {
    return fs.readFile(filePath, "utf8");
  }
  const fileName = path.basename(filePath);
  const encoding = detectEncoding(fileName);
  const buffer = await fs.readFile(filePath);
  
  // Convert buffer to string with proper encoding
  if (encoding === "latin1") {
    // For Latin-1 files, we need to handle the conversion carefully
    return buffer.toString("latin1");
  }
  return buffer.toString(encoding);
}

/**
 * Log details about the file data being loaded.
 * - For Hunspell .dic files: if the first line is numeric, log that as the word count;
 *   otherwise, log the number of non-empty lines.
 * - For Thesaurus .idx files: log the number of index entries.
 * - For Thesaurus .dat and hyphenation files: log the number of non-empty lines.
 */
function logFileData(redisKey, data) {
  if (redisKey.includes("hunspell") && redisKey.endsWith("dic")) {
    const lines = data.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length > 0 && /^\d+$/.test(lines[0].trim())) {
      console.log(`--> ${redisKey}: header indicates ${lines[0].trim()} words`);
    } else {
      console.log(`--> ${redisKey}: contains ${lines.length} lines (words)`);
    }
  } else if (redisKey.includes("thesaurus")) {
    if (redisKey.endsWith("idx")) {
      const lines = data.split(/\r?\n/).filter(line => line.trim() !== "");
      console.log(`--> ${redisKey}: contains ${lines.length} index entries`);
    } else if (redisKey.endsWith("dat")) {
      const lines = data.split(/\r?\n/).filter(line => line.trim() !== "");
      console.log(`--> ${redisKey}: contains ${lines.length} lines`);
    }
  } else if (redisKey.includes("hyphenation")) {
    const lines = data.split(/\r?\n/).filter(line => line.trim() !== "");
    console.log(`--> ${redisKey}: contains ${lines.length} hyphenation patterns`);
  }
}

/**
 * Dictionary data loader that handles caching and fallback strategies.
 */
class DictionaryLoader {
  constructor(options = {}) {
    this.dataCache = new LRUCache({
      max: options.cacheSize || 50,
      ttl: options.cacheTtl || 1000 * 60 * 60, // 1 hour default
      updateAgeOnGet: true,
    });
    
    this.localFallbackDir = options.localFallbackDir || 
      path.join(process.cwd(), 'data', 'dictionaries');
    
    this.loadPromises = {};
  }
  
  /**
   * Load dictionary file data, with Redis as primary source and local fallback.
   * @param {String} redisKey Redis key for the dictionary file.
   * @param {String} [localPath] Optional local fallback path.
   * @returns {Promise<String>} Dictionary file content.
   */
  async loadDictionaryFile(redisKey, localPath) {
    if (this.dataCache.has(redisKey)) {
      return this.dataCache.get(redisKey);
    }
    
    if (this.loadPromises[redisKey]) {
      return this.loadPromises[redisKey];
    }
    
    this.loadPromises[redisKey] = (async () => {
      try {
        // Try Redis first
        const redis = await redisConnection.getClient();
        const data = await redis.get(redisKey);
        
        if (data) {
          logFileData(redisKey, data);
          this.dataCache.set(redisKey, data);
          return data;
        }
        
        // Fallback: use provided local path
        if (localPath) {
          try {
            const localData = await readFileAutoEncoding(localPath);
            console.log(`Loaded ${redisKey} from local fallback: ${localPath}`);
            logFileData(redisKey, localData);
            this.dataCache.set(redisKey, localData);
            return localData;
          } catch (localErr) {
            console.error(`Failed to load ${redisKey} from local fallback: ${localPath}`, localErr);
            throw new Error(`Dictionary data not found for ${redisKey}`);
          }
        } else {
          // Infer local path from Redis key
          const inferredPath = this.inferLocalPath(redisKey);
          if (inferredPath) {
            try {
              const fallbackData = await readFileAutoEncoding(inferredPath);
              console.log(`Loaded ${redisKey} from inferred path: ${inferredPath}`);
              logFileData(redisKey, fallbackData);
              this.dataCache.set(redisKey, fallbackData);
              return fallbackData;
            } catch (fallbackErr) {
              // Fall through to error below
            }
          }
          
          throw new Error(`Dictionary data not found for ${redisKey}`);
        }
      } catch (err) {
        console.error(`Error loading dictionary file ${redisKey}:`, err);
        throw err;
      } finally {
        delete this.loadPromises[redisKey];
      }
    })();
    
    return this.loadPromises[redisKey];
  }
  
  /**
   * Load dictionary data (aff/dic pair) for a language.
   * @param {String} language Language code.
   * @param {String} dialect Dialect code.
   * @returns {Promise<Object>} Object with affData and dicData.
   */
  async loadDictionaryData(language, dialect) {
    const affKey = `${language}:hunspell:${dialect}:aff`;
    const dicKey = `${language}:hunspell:${dialect}:dic`;
    
    try {
      const [affData, dicData] = await Promise.all([
        this.loadDictionaryFile(affKey),
        this.loadDictionaryFile(dicKey)
      ]);
      
      // For Norwegian files, preserve binary data
      if (language === 'no' || language === 'nb' || language === 'nn') {
        return {
          affData: Buffer.from(affData, 'binary'),
          dicData: Buffer.from(dicData, 'binary')
        };
      }
      
      return { 
        affData: Buffer.from(affData, 'utf8'),
        dicData: Buffer.from(dicData, 'utf8')
      };
    } catch (err) {
      console.error(`Failed to load dictionary data for ${language}:${dialect}:`, err);
      throw new Error(`Could not load dictionary for ${language}:${dialect}: ${err.message}`);
    }
  }
  
  /**
   * Load hyphenation data for a language/dialect.
   * @param {String} language Language code.
   * @param {String} dialect Dialect code.
   * @returns {Promise<String>} Hyphenation data.
   */
  async loadHyphenation(language, dialect) {
    const key = `${language}:hyphenation:${dialect}`;
    return this.loadDictionaryFile(key);
  }
  
  /**
   * Load thesaurus data for a language/dialect.
   * This method now integrates a parser for the .dat file.
   * @param {String} language Language code.
   * @param {String} dialect Dialect code.
   * @returns {Promise<Object>} Object with datData, idxData, and parsed entries.
   */
  async loadThesaurus(language, dialectCode = null) {
    try {
      // Format the language code (e.g., 'nb_NO' to 'nb')
      const langCode = language.toLowerCase();
      const isNorwegian = langCode === 'nb' || langCode === 'nn' || langCode === 'no';
      
      // Determine full dialect code
      const fullDialectCode = dialectCode || 
        (langCode === 'nb' ? 'nb_NO' : 
         langCode === 'nn' ? 'nn_NO' : 
         language);
      
      console.log(`Loading thesaurus for ${fullDialectCode}`);
      
      // Build Redis keys for the thesaurus files
      const idxKey = `thesaurus:${fullDialectCode}:idx`;
      const datKey = `thesaurus:${fullDialectCode}:dat`;
      
      // Get thesaurus data from Redis
      const [idxData, datData] = await Promise.all([
        this.redisClient.getBuffer(idxKey),
        this.redisClient.getBuffer(datKey)
      ]);
      
      if (!idxData || !datData) {
        console.warn(`Thesaurus data not found for ${fullDialectCode}`);
        return null;
      }
      
      console.log(`Thesaurus data loaded from Redis: idx=${idxData.length} bytes, dat=${datData.length} bytes`);
      
      // For Norwegian thesaurus, we need to handle special encoding
      if (isNorwegian) {
        console.log(`Processing Norwegian thesaurus for ${fullDialectCode}`);
        
        // Check if the first line of the idx file specifies encoding
        const firstLine = idxData.slice(0, 20).toString('latin1').split('\n')[0].trim();
        if (firstLine === 'ISO-8859-1' || firstLine === 'ISO8859-1') {
          console.log(`Thesaurus idx file specifies ISO-8859-1 encoding`);
        } else {
          console.log(`Thesaurus idx file does not specify encoding explicitly: ${firstLine}`);
        }
        
        // Import the thesaurus parser
        const ThesaurusParser = require('../utils/MyThesParser');
        
        // Create a new thesaurus parser with the raw buffer data
        return new ThesaurusParser(idxData, datData);
      } else {
        // For non-Norwegian languages, convert to strings with UTF-8
        const idxString = idxData.toString('utf8');
        const datString = datData.toString('utf8');
        
        // Import the thesaurus parser
        const ThesaurusParser = require('../utils/MyThesParser');
        
        // Create a new thesaurus parser
        return new ThesaurusParser(idxString, datString);
      }
    } catch (error) {
      console.error(`Error loading thesaurus for ${language}:`, error);
      return null;
    }
  }
  
  /**
   * Load special terms for a language.
   * @param {String} language Language code.
   * @returns {Promise<Array<String>>} Array of special terms.
   */
  async loadSpecialTerms(language) {
    const key = `${language}:specialterms`;
    
    try {
      const data = await this.loadDictionaryFile(key);
      try {
        const json = JSON.parse(data);
        if (Array.isArray(json)) {
          return json;
        } else if (typeof json === 'object') {
          const terms = [];
          for (const category of Object.values(json)) {
            if (Array.isArray(category.words)) {
              terms.push(...category.words);
            } else if (Array.isArray(category)) {
              terms.push(...category);
            }
          }
          return terms;
        }
      } catch (jsonErr) {
        return data.split(/\r?\n/).filter(Boolean).map(term => term.trim());
      }
    } catch (err) {
      console.warn(`Failed to load special terms for ${language}:`, err);
      return [];
    }
  }
  
  /**
   * Try to infer a local file path from a Redis key.
   * @param {String} redisKey Redis key.
   * @returns {String|null} Inferred local path or null.
   */
  inferLocalPath(redisKey) {
    const parts = redisKey.split(':');
    let fileName = '';
    
    if (parts.length === 4 && parts[1] === 'hunspell') {
      fileName = `${parts[0]}_${parts[2]}.${parts[3]}`;
    } else if (parts.length === 3 && parts[1] === 'hyphenation') {
      fileName = `hyph_${parts[0]}_${parts[2]}.dic`;
    } else if (parts.length === 4 && parts[1] === 'thesaurus') {
      fileName = `th_${parts[0]}_${parts[2]}.${parts[3]}`;
    } else if (parts.length === 2 && parts[1] === 'specialterms') {
      fileName = `${parts[0]}_specialterms.json`;
    } else {
      return null;
    }
    
    return path.join(this.localFallbackDir, fileName);
  }
  
  /**
   * Get cache statistics.
   * @returns {Object} Cache statistics.
   */
  getCacheStats() {
    return {
      size: this.dataCache.size,
      maxSize: this.dataCache.max,
      keys: [...this.dataCache.keys()]
    };
  }
  
  /**
   * Clear the cache.
   */
  clearCache() {
    this.dataCache.clear();
  }
}

module.exports = new DictionaryLoader();
module.exports.DictionaryLoader = DictionaryLoader;