// src/utils/TeXHyphenator.js

/**
 * TeXHyphenator:
 * - Implements the Liang-Knuth hyphenation algorithm used in TeX
 * - Parses hyphenation pattern files and applies patterns to words
 * - Optimized for performance and memory efficiency
 */
class TeXHyphenator {
  /**
   * Constructor: pass in the raw buffer data or content string for pattern file
   * @param {Buffer|string} patternFileContent - Content of the hyphenation pattern file
   * @param {string} encoding - Encoding of the pattern file ('utf8' or 'latin1')
   */
  constructor(patternFileContent, encoding = 'utf8') {
    // Default configuration
    this.leftMin = 2; // Minimum characters before first hyphen
    this.rightMin = 2; // Minimum characters after last hyphen
    this.language = "unknown"; // Language code (e.g., "en", "nb")
    this.encoding = encoding; // Store the encoding for future use
    
    // Store patterns as a Map for faster lookup
    this.patternMap = new Map();
    
    // Additional configuration
    this.exceptions = new Map(); // Explicit hyphenation exceptions
    this.cacheEnabled = true; // Whether to use result caching
    this.cache = new Map(); // Cache of previously hyphenated words
    this.stats = {
      patternCount: 0,
      exceptionCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalProcessed: 0
    };
    
    // Parse pattern file if provided
    if (patternFileContent) {
      this.parsePatternFile(patternFileContent);
    }
  }
  
  /**
   * Parse a TeX hyphenation pattern file
   * @param {Buffer|string} content - The file content (Buffer or string)
   */
  parsePatternFile(content) {
    if (!content) {
      console.warn('Empty pattern file provided to TeXHyphenator');
      return;
    }
    
    console.time('HyphenationParsingTime');
    
    // Convert buffer to string with the proper encoding if needed
    let contentStr = content;
    if (Buffer.isBuffer(content)) {
      contentStr = content.toString(this.encoding);
    } else if (typeof content !== 'string') {
      console.error('Invalid pattern file content type:', typeof content);
      return;
    }
    
    const lines = contentStr.split(/\r?\n/);
    
    // Process each line in the pattern file
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith("#")) continue;
      
      const tokens = trimmed.split(/\s+/);
      const firstToken = tokens[0];
      
      if (firstToken === "LANGUAGE") {
        // Set the language code
        this.language = tokens[1] || "unknown";
      } 
      else if (firstToken === "LEFTHYPHENMIN") {
        // Set minimum characters before first hyphen
        this.leftMin = parseInt(tokens[1], 10) || 2;
      } 
      else if (firstToken === "RIGHTHYPHENMIN") {
        // Set minimum characters after last hyphen
        this.rightMin = parseInt(tokens[1], 10) || 2;
      }
      else if (firstToken === "EXCEPTION" && tokens.length > 1) {
        // Handle explicit exceptions like "EXCEPTION ta-ble"
        const exceptionWord = tokens[1];
        const parts = exceptionWord.split('-');
        const word = parts.join('');
        this.exceptions.set(word, parts);
        this.stats.exceptionCount++;
      }
      else {
        // It's a regular hyphenation pattern
        this.addPattern(trimmed);
        this.stats.patternCount++;
      }
    }
    
    console.timeEnd('HyphenationParsingTime');
    console.log(`Hyphenation patterns loaded for ${this.language}: ${this.stats.patternCount} patterns, ${this.stats.exceptionCount} exceptions`);
  }
  
  /**
   * Add a hyphenation pattern to the pattern map
   * @param {string} pattern - The pattern to add
   */
  addPattern(pattern) {
    // Process the pattern and store it in a more efficient format
    const processedPattern = this.parsePattern(pattern);
    const purePattern = processedPattern.map(p => p.char).join('');
    
    if (!purePattern) return;
    
    this.patternMap.set(purePattern, processedPattern);
  }
  
  /**
   * Convert a pattern string like "a2b3c" to a structured format
   * @param {string} patternStr - The pattern string
   * @returns {Array} Array of {char, lvl} objects
   */
  parsePattern(patternStr) {
    const result = [];
    
    // Process each character in the pattern
    for (let i = 0; i < patternStr.length; i++) {
      const c = patternStr[i];
      
      if (/\d/.test(c)) {
        // It's a digit - update the level of the appropriate character
        const lvl = parseInt(c, 10);
        
        if (result.length === 0) {
          // Digit before first letter - position 0
          result.push({ char: '', lvl });
        } else {
          // Apply to the last character added
          const last = result[result.length - 1];
          if (last.lvl < lvl) {
            last.lvl = lvl;
          }
        }
      } else {
        // It's a letter - add a new character entry
        result.push({ char: c, lvl: 0 });
      }
    }
    
    return result;
  }
  
  /**
   * Hyphenate a word according to TeX rules
   * @param {string} word - The word to hyphenate
   * @returns {string[]} Array of word parts after hyphenation
   */
  hyphenate(word) {
    if (!word) return [word];
    
    this.stats.totalProcessed++;
    
    // Normalize the word
    const normalizedWord = word.toLowerCase();
    
    // Check minimum length requirement
    if (normalizedWord.length < this.leftMin + this.rightMin) {
      return [word];
    }
    
    // Check cache first if enabled
    if (this.cacheEnabled && this.cache.has(normalizedWord)) {
      this.stats.cacheHits++;
      return this.cache.get(normalizedWord);
    }
    
    this.stats.cacheMisses++;
    
    // Check explicit exceptions first
    if (this.exceptions.has(normalizedWord)) {
      const parts = this.exceptions.get(normalizedWord);
      
      // Store in cache if enabled
      if (this.cacheEnabled) {
        this.cache.set(normalizedWord, parts);
      }
      
      return parts;
    }
    
    // Standard TeX algorithm: add dots at word boundaries
    const text = `.${normalizedWord}.`;
    
    // Array to track hyphenation levels between characters
    // Initialize with all zeros
    const positions = new Array(text.length + 1).fill(0);
    
    // Apply all patterns that match within the word
    this.applyPatterns(text, positions);
    
    // Extract hyphenation points
    const parts = this.extractHyphenationPoints(normalizedWord, positions);
    
    // Store in cache if enabled
    if (this.cacheEnabled) {
      this.cache.set(normalizedWord, parts);
    }
    
    return parts;
  }
  
  /**
   * Apply all relevant patterns to a word
   * @param {string} text - The word with boundary markers
   * @param {number[]} positions - Array to track hyphenation levels
   */
  applyPatterns(text, positions) {
    // For each possible substring of the word
    for (let start = 0; start < text.length; start++) {
      for (let len = 1; len <= text.length - start; len++) {
        const substr = text.substring(start, start + len);
        
        // Check if this substring matches a pattern
        if (this.patternMap.has(substr)) {
          const pattern = this.patternMap.get(substr);
          
          // Apply pattern levels to positions
          for (let i = 0; i < pattern.length; i++) {
            const { lvl } = pattern[i];
            if (lvl > 0) {
              const posIndex = start + i;
              if (posIndex < positions.length && lvl > positions[posIndex]) {
                positions[posIndex] = lvl;
              }
            }
          }
        }
      }
    }
  }
  
  /**
   * More efficient pattern application - optimized algorithm
   * @param {string} text - The word with boundary markers
   * @param {Array} positions - Array to track hyphenation levels
   */
  applyPatterns(text, positions) {
    // More efficient approach: check patterns directly
    for (const [purePattern, pattern] of this.patternMap.entries()) {
      // Find all occurrences of this pattern in the text
      let startIndex = 0;
      while (true) {
        const found = text.indexOf(purePattern, startIndex);
        if (found === -1) break;
        
        // Apply the pattern's levels to the positions array
        for (let i = 0; i < pattern.length; i++) {
          const { lvl } = pattern[i];
          if (lvl > 0) {
            const posIndex = found + i;
            if (posIndex < positions.length && lvl > positions[posIndex]) {
              positions[posIndex] = lvl;
            }
          }
        }
        
        startIndex = found + 1;
      }
    }
  }
  
  /**
   * Extract hyphenation points based on positions array
   * @param {string} word - The original word
   * @param {number[]} positions - Array of hyphenation levels
   * @returns {string[]} Array of word parts after hyphenation
   */
  extractHyphenationPoints(word, positions) {
    const wordParts = [];
    let lastBreak = 1; // Start after the leading dot
    const endOfWord = word.length + 1; // Position before the trailing dot
    
    // Find hyphenation points
    for (let i = 1; i < endOfWord; i++) {
      const lvl = positions[i + 1]; // Position after character i
      
      // Hyphenate if level is odd and respects min distances
      const distanceFromStart = i;
      const distanceToEnd = word.length - i;
      
      const canBreak =
        lvl % 2 === 1 &&
        distanceFromStart >= this.leftMin &&
        distanceToEnd >= this.rightMin;
      
      if (canBreak) {
        // Add the part from lastBreak to current position
        const part = word.slice(lastBreak - 1, i);
        wordParts.push(part);
        lastBreak = i + 1;
      }
    }
    
    // Add the final part
    wordParts.push(word.slice(lastBreak - 1));
    
    return wordParts;
  }
  
  /**
   * Hyphenate a word and return a string with hyphens
   * @param {string} word - The word to hyphenate
   * @param {string} [hyphenChar='-'] - Character to use for hyphenation
   * @returns {string} Hyphenated word
   */
  hyphenateText(word, hyphenChar = '-') {
    const parts = this.hyphenate(word);
    return parts.join(hyphenChar);
  }
  
  /**
   * Get statistics about hyphenation operations
   * @returns {Object} Stats object
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      hitRate: this.stats.totalProcessed ? 
        (this.stats.cacheHits / this.stats.totalProcessed).toFixed(2) : 0
    };
  }
  
  /**
   * Clear the hyphenation cache
   */
  clearCache() {
    this.cache.clear();
    this.stats.cacheHits = 0;
    this.stats.cacheMisses = 0;
  }
  
  /**
   * Enable or disable result caching
   * @param {boolean} enabled - Whether caching should be enabled
   */
  setCaching(enabled) {
    this.cacheEnabled = enabled;
    if (!enabled) {
      this.clearCache();
    }
  }
}

module.exports = { TeXHyphenator };