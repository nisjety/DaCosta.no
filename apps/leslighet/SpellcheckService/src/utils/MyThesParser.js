// src/utils/MyThesParser.js

/**
 * MyThesParser:
 * - Parses a .idx file into a map of word -> offset.
 * - Parses a .dat file into structured synonym/antonym entries at each offset.
 * - Provides getSynonyms(word) for thesaurus lookups.
 * - Optimized for memory efficiency and properly handles ISO-8859-1 encoding.
 */
class MyThesParser {
  /**
   * Constructor: pass in the raw buffer data from .idx/.dat files
   * @param {Buffer} idxBuffer - Raw buffer containing the .idx file
   * @param {Buffer} datBuffer - Raw buffer containing the .dat file
   */
  constructor(idxBuffer, datBuffer) {
    // Store raw buffers
    this.idxBuffer = Buffer.isBuffer(idxBuffer) ? idxBuffer : Buffer.from(idxBuffer || '');
    this.datBuffer = Buffer.isBuffer(datBuffer) ? datBuffer : Buffer.from(datBuffer || '');
    
    // Data structures
    this.index = new Map();   // word -> offset map
    this.synMap = new Map();  // word -> synonyms map
    this.cache = new Map();   // Lookup cache
    
    // Stats
    this.wordCount = 0;
    this.synCount = 0;
    
    // Detect encoding from file headers
    this.encoding = this.detectEncoding();
    console.log(`ThesaurusParser using encoding: ${this.encoding}`);
    
    // Parse data
    const startTime = Date.now();
    this.parseData();
    const endTime = Date.now();
    
    console.log(`ThesaurusParsingTime: ${endTime - startTime}ms`);
    console.log(`Thesaurus loaded: ${this.wordCount} words, ${this.synCount} synonyms`);
  }
  
  /**
   * Detect encoding from file headers
   * @returns {string} Detected encoding ('latin1' or 'utf8')
   */
  detectEncoding() {
    // Default to latin1 for Norwegian files
    let encoding = 'latin1';
    
    // Check for encoding headers in index file
    if (this.idxBuffer && this.idxBuffer.length > 0) {
      const firstLine = this.getFirstLine(this.idxBuffer);
      if (firstLine.toUpperCase() === 'ISO-8859-1' || firstLine.toUpperCase() === 'ISO8859-1') {
        console.log('Detected ISO-8859-1 encoding in thesaurus index file');
        encoding = 'latin1';
      } else if (firstLine.toUpperCase() === 'UTF-8') {
        console.log('Detected UTF-8 encoding in thesaurus index file');
        encoding = 'utf8';
      }
    }
    
    // Check for encoding headers in data file
    if (this.datBuffer && this.datBuffer.length > 0) {
      const firstLine = this.getFirstLine(this.datBuffer);
      if (firstLine.toUpperCase() === 'ISO-8859-1' || firstLine.toUpperCase() === 'ISO8859-1') {
        console.log('Detected ISO-8859-1 encoding in thesaurus data file');
        encoding = 'latin1';
      } else if (firstLine.toUpperCase() === 'UTF-8') {
        console.log('Detected UTF-8 encoding in thesaurus data file');
        encoding = 'utf8';
      }
    }
    
    // For Norwegian files, default to latin1 even if no encoding header is found
    return encoding;
  }
  
  /**
   * Get the first line from a buffer
   * @param {Buffer} buffer - Buffer to extract first line from
   * @returns {string} First line of the buffer
   */
  getFirstLine(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      return '';
    }
    
    // Find the first newline character
    let newlineIndex = -1;
    for (let i = 0; i < Math.min(buffer.length, 200); i++) {
      if (buffer[i] === 10 || buffer[i] === 13) { // LF or CR
        newlineIndex = i;
        break;
      }
    }
    
    if (newlineIndex === -1) {
      return buffer.toString('latin1', 0, Math.min(buffer.length, 100));
    }
    
    return buffer.toString('latin1', 0, newlineIndex).trim();
  }
  
  /**
   * Decode buffer to string using the detected encoding
   * @param {Buffer} buffer - Buffer to decode
   * @param {number} start - Start position
   * @param {number} end - End position
   * @returns {string} Decoded string
   */
  decodeBuffer(buffer, start = 0, end = null) {
    if (!Buffer.isBuffer(buffer)) {
      return String(buffer || '');
    }
    
    const endPos = end === null ? buffer.length : Math.min(end, buffer.length);
    return buffer.toString(this.encoding, start, endPos);
  }
  
  /**
   * Parse both index and data files
   */
  parseData() {
    try {
      this.parseIndex();
      this.parseDataFile();
    } catch (error) {
      console.error('Error parsing thesaurus data:', error);
      throw error;
    }
  }
  
  /**
   * Parse the index file to build word -> offset mapping
   */
  parseIndex() {
    if (!this.idxBuffer || this.idxBuffer.length === 0) {
      throw new Error('Empty or missing index buffer');
    }
    
    console.log('Starting thesaurus index parsing...');
    
    // Get full index content
    const idxContent = this.decodeBuffer(this.idxBuffer);
    const lines = idxContent.split(/\r?\n/).filter(Boolean);
    
    if (lines.length === 0) {
      throw new Error('No content found in index file');
    }
    
    // Show sample of first few lines for debugging
    console.log(`Found ${lines.length} lines in the index file`);
    console.log(`First ${Math.min(3, lines.length)} lines of index file:`);
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      console.log(`  Line ${i+1}: "${lines[i]}"`);
    }
    
    // Skip the first line if it's just encoding info
    let startLine = 0;
    if (lines[0].trim().toUpperCase() === 'ISO-8859-1' || 
        lines[0].trim().toUpperCase() === 'UTF-8' || 
        lines[0].trim().toUpperCase() === 'ISO8859-1') {
      startLine = 1;
    }
    
    // If the second line contains only a number, it's the entry count
    let nextLine = startLine;
    if (nextLine < lines.length && /^\d+$/.test(lines[nextLine].trim())) {
      const entryCount = parseInt(lines[nextLine].trim(), 10);
      console.log(`Index header indicates ${entryCount} entries`);
      nextLine++;
    }
    
    // Parse the remaining lines to build the index
    let entriesProcessed = 0;
    let norwegianEntries = 0;
    
    for (let i = nextLine; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split('|');
      if (parts.length >= 2) {
        const word = parts[0].trim();
        const offset = parseInt(parts[1], 10);
        
        if (word && !isNaN(offset)) {
          this.index.set(word.toLowerCase(), offset);
          this.wordCount++;
          entriesProcessed++;
          
          // Debug every 1000th entry or the first 5
          if (entriesProcessed % 1000 === 0 || entriesProcessed <= 5) {
            console.log(`Added entry #${entriesProcessed}: "${word}" -> offset ${offset}`);
          }
          
          // Track entries with Norwegian characters
          if (/[æøåÆØÅ]/.test(word)) {
            norwegianEntries++;
            
            // Debug the first few Norwegian entries
            if (norwegianEntries <= 5) {
              console.log(`Norwegian entry: "${word}"`);
            }
          }
        }
      }
    }
    
    console.log(`Parsed ${this.wordCount} words from index (processed ${entriesProcessed} entries)`);
    console.log(`Found ${norwegianEntries} entries with Norwegian characters`);
    
    if (this.wordCount === 0) {
      throw new Error('No valid entries found in thesaurus index');
    }
  }
  
  /**
   * Parse the data file to extract synonyms
   */
  parseDataFile() {
    if (!this.datBuffer || this.datBuffer.length === 0) {
      throw new Error('Empty or missing data buffer');
    }
    
    console.log('Starting thesaurus data file parsing...');
    
    // Get full data content
    const datContent = this.decodeBuffer(this.datBuffer);
    const lines = datContent.split(/\r?\n/);
    
    if (lines.length < 2) {
      throw new Error('Invalid or empty data file');
    }
    
    // Show sample lines for debugging
    console.log(`Data file has ${lines.length} lines`);
    console.log(`First ${Math.min(3, lines.length)} lines of data file:`);
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      console.log(`  Line ${i+1}: "${lines[i]}"`);
    }
    
    // Skip encoding header if present
    let startLine = 0;
    if (lines[0].trim().toUpperCase() === 'ISO-8859-1' || 
        lines[0].trim().toUpperCase() === 'UTF-8' || 
        lines[0].trim().toUpperCase() === 'ISO8859-1') {
      startLine = 1;
    }
    
    // Calculate line offsets for efficient lookup
    const lineOffsets = this.calculateLineOffsets(lines);
    
    // Process each word in the index
    let entriesProcessed = 0;
    let synonymsFound = 0;
    let entriesWithNorwegianChars = 0;
    
    for (const [word, offset] of this.index.entries()) {
      try {
        entriesProcessed++;
        
        // Detailed logging for first 5 entries and every 1000th
        const logDetail = entriesProcessed <= 5 || entriesProcessed % 1000 === 0;
        
        if (logDetail) {
          console.log(`Processing entry #${entriesProcessed}: "${word}" at offset ${offset}`);
        }
        
        // Read the synonym entry (typically 2-3 lines at most)
        const chunk = this.readChunkAtOffset(offset, lines, lineOffsets, logDetail);
        
        if (!chunk) {
          if (logDetail) console.warn(`Empty chunk for word "${word}" at offset ${offset}`);
          continue;
        }
        
        // Parse the chunk to extract synonyms
        const synonyms = this.parseSynonymBlock(chunk);
        
        if (synonyms.length > 0) {
          this.synMap.set(word, synonyms);
          this.synCount += synonyms.length;
          synonymsFound++;
          
          // Check for Norwegian characters in synonyms
          const norwegianSynonyms = synonyms.filter(syn => /[æøåÆØÅ]/.test(syn));
          if (norwegianSynonyms.length > 0) {
            entriesWithNorwegianChars++;
            
            // Log the first few entries with Norwegian characters
            if (entriesWithNorwegianChars <= 5) {
              console.log(`Entry with Norwegian synonyms: "${word}" -> ${norwegianSynonyms.slice(0, 3).join(', ')}`);
            }
          }
          
          if (logDetail) {
            console.log(`Parsed ${synonyms.length} synonyms for "${word}"`);
            console.log(`  Sample synonyms: ${synonyms.slice(0, 5).join(', ')}`);
          }
        }
      } catch (error) {
        console.error(`Error processing entry for "${word}":`, error);
      }
    }
    
    console.log(`Finished processing ${entriesProcessed} entries`);
    console.log(`Found synonyms for ${synonymsFound} words (${this.synCount} total synonyms)`);
    console.log(`Found ${entriesWithNorwegianChars} entries with Norwegian characters in synonyms`);
    
    if (this.synCount === 0) {
      throw new Error('No synonyms found in thesaurus data');
    }
  }
  
  /**
   * Calculate byte offsets for each line in the data file
   * This is critical for correct offset-based lookups
   * @param {string[]} lines - Array of lines from the data file
   * @returns {number[]} Array of byte offsets for each line
   */
  calculateLineOffsets(lines) {
    const offsets = [];
    let currentOffset = 0;
    
    // Account for encoding length differences
    const encoder = this.encoding === 'utf8' ? 
      new TextEncoder() : 
      { encode: (str) => Buffer.from(str, 'latin1') };
    
    // For each line, calculate its offset
    for (let i = 0; i < lines.length; i++) {
      offsets.push(currentOffset);
      
      // Calculate byte length considering encoding
      // Note: This needs to account for the line endings too
      const lineBytes = encoder.encode(lines[i]);
      currentOffset += lineBytes.length;
      
      // Add bytes for line endings (LF = 1 byte, CRLF = 2 bytes)
      // We'll assume LF for simplicity but could be more precise
      currentOffset += 1; 
    }
    
    return offsets;
  }
  
  /**
   * Read a chunk of data from the .dat file at a specific offset
   * @param {number} offset - The byte offset from the index
   * @param {string[]} lines - Array of lines from the data file
   * @param {number[]} lineOffsets - Array of byte offsets for each line
   * @param {boolean} logDetail - Whether to log detailed information
   * @returns {string} Chunk of text from the offset
   */
  readChunkAtOffset(offset, lines, lineOffsets, logDetail = false) {
    // First validate the offset is within bounds
    if (offset < 0 || offset >= this.datBuffer.length) {
      console.warn(`Invalid offset ${offset}: Out of bounds of data file (0-${this.datBuffer.length-1})`);
      return '';
    }
    
    // Find the line number that corresponds to this offset
    // Binary search would be more efficient for large files
    let lineNumber = -1;
    for (let i = 0; i < lineOffsets.length; i++) {
      if (lineOffsets[i] === offset) {
        lineNumber = i;
        break;
      } else if (lineOffsets[i] > offset) {
        // We've gone too far
        lineNumber = i - 1;
        break;
      }
    }
    
    // Check if we found a valid line
    if (lineNumber < 0 || lineNumber >= lines.length) {
      console.warn(`Invalid offset ${offset}: No matching line found`);
      return '';
    }
    
    if (logDetail) {
      console.log(`Offset ${offset} maps to line ${lineNumber}`);
    }
    
    // Read a reasonable chunk of data (3 lines)
    const endLine = Math.min(lineNumber + 2, lines.length - 1);
    const chunk = lines.slice(lineNumber, endLine + 1).join('\n');
    
    if (logDetail) {
      console.log(`Read chunk of ${chunk.length} characters (${endLine - lineNumber + 1} lines) from line ${lineNumber}`);
    }
    
    // Handle empty chunks
    if (!chunk.trim()) {
      console.warn(`Empty chunk for word at offset ${offset}`);
    }
    
    return chunk;
  }
  
  /**
   * Parse a synonym block into an array of synonyms
   * @param {string} text - Text chunk to parse
   * @returns {string[]} Array of synonyms
   */
  parseSynonymBlock(text) {
    const synonyms = [];
    const lines = text.split(/\r?\n/).filter(Boolean);
    
    if (lines.length < 1) {
      return synonyms;
    }
    
    // Standard Norwegian thesaurus format:
    // Line 1: word|1
    // Line 2: -|synonym1|synonym2|...
    
    // Check if this is a Norwegian thesaurus entry
    if (lines.length >= 2 && lines[1].startsWith('-|')) {
      // Process the synonyms line
      const synLine = lines[1];
      const parts = synLine.split('|');
      
      // Skip the "-" part and add all synonyms
      if (parts.length > 1) {
        synonyms.push(...parts.slice(1).filter(Boolean));
      }
    } else {
      // Traditional format where each line may contain synonyms
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        // Skip the first word which is usually a part of speech or category
        const parts = trimmed.split(/\s+/).slice(1);
        if (parts.length > 0) {
          synonyms.push(...parts);
        }
      }
    }
    
    // Remove duplicates and return
    return [...new Set(synonyms)];
  }
  
  /**
   * Get synonyms for a word
   * @param {string} word - Word to look up
   * @returns {string[]} Array of synonyms
   */
  getSynonyms(word) {
    if (!word) return [];
    
    const normalizedWord = word.toLowerCase().trim();
    
    // Check cache first
    if (this.cache.has(normalizedWord)) {
      return this.cache.get(normalizedWord);
    }
    
    // Look up in the synonym map
    const synonyms = this.synMap.get(normalizedWord) || [];
    
    // Cache result for future lookups
    this.cache.set(normalizedWord, synonyms);
    
    return synonyms;
  }
  
  /**
   * Get statistics about the thesaurus
   * @returns {Object} Stats object
   */
  getStats() {
    return {
      wordCount: this.wordCount,
      synonymCount: this.synCount,
      cacheSize: this.cache.size
    };
  }
  
  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = { MyThesParser };