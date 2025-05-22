// src/utils/encodingUtils.js

/**
 * Utility functions for handling encodings in dictionary files
 */

/**
 * Detect encoding from a file name or content
 * @param {string|Buffer} content - File content or file name
 * @param {string} [fileName] - Optional file name to help with detection
 * @returns {string} - Detected encoding ('latin1' or 'utf8')
 */
function detectEncoding(content, fileName = '') {
    // First check fileName patterns
    if (fileName) {
      const lowerName = fileName.toLowerCase();
      if (lowerName.includes('nb_no') || lowerName.includes('nn_no') ||
          lowerName.includes('th_nb_') || lowerName.includes('th_nn_') ||
          lowerName.includes('hyph_nb_') || lowerName.includes('hyph_nn_')) {
        return 'latin1'; // Norwegian files use Latin1
      }
      
      if (lowerName.includes('en_gb') || lowerName.includes('en_us') ||
          lowerName.includes('th_en_')) {
        return 'utf8'; // English files use UTF-8
      }
    }
    
    // Check file content
    if (Buffer.isBuffer(content)) {
      // Check for ISO-8859-1 header in first line
      const firstLine = content.slice(0, 100).toString('latin1').split('\n')[0].trim().toUpperCase();
      if (firstLine === 'ISO-8859-1' || firstLine === 'SET ISO-8859-1' || 
          firstLine === 'ISO8859-1' || firstLine === 'SET ISO8859-1') {
        return 'latin1';
      }
      
      // Check for UTF-8 header
      const utf8FirstLine = content.slice(0, 100).toString('utf8').split('\n')[0].trim().toUpperCase();
      if (utf8FirstLine === 'UTF-8' || utf8FirstLine === 'SET UTF-8') {
        return 'utf8';
      }
      
      // Check for Norwegian characters in Latin1 encoding
      const latin1Sample = content.slice(0, 4000).toString('latin1');
      if (/[æøåÆØÅ]/.test(latin1Sample)) {
        return 'latin1';
      }
    } else if (typeof content === 'string') {
      // Check first line of string content
      const firstLine = content.split('\n')[0].trim().toUpperCase();
      if (firstLine === 'ISO-8859-1' || firstLine === 'SET ISO-8859-1' || 
          firstLine === 'ISO8859-1' || firstLine === 'SET ISO8859-1') {
        return 'latin1';
      }
      if (firstLine === 'UTF-8' || firstLine === 'SET UTF-8') {
        return 'utf8';
      }
      
      // Check for Norwegian characters
      if (/[æøåÆØÅ]/.test(content)) {
        return 'latin1';
      }
    }
    
    // Default to UTF-8 if we can't detect
    return 'utf8';
  }
  
  /**
   * Convert a buffer to string with the appropriate encoding
   * @param {Buffer} buffer - Buffer to convert
   * @param {string} fileName - File name used for encoding detection
   * @returns {string} - String in the appropriate encoding
   */
  function bufferToString(buffer, fileName = '') {
    if (!Buffer.isBuffer(buffer)) {
      return String(buffer || '');
    }
    
    const encoding = detectEncoding(buffer, fileName);
    return buffer.toString(encoding);
  }
  
  /**
   * Convert string to the specified encoding in a Buffer
   * @param {string} str - String to convert
   * @param {string} encoding - Target encoding ('latin1' or 'utf8')
   * @returns {Buffer} - Buffer with the appropriate encoding
   */
  function stringToBuffer(str, encoding = 'utf8') {
    return Buffer.from(str, encoding);
  }
  
  /**
   * Convert between encodings
   * @param {string|Buffer} content - Content to convert
   * @param {string} sourceEncoding - Source encoding ('latin1' or 'utf8')
   * @param {string} targetEncoding - Target encoding ('latin1' or 'utf8')
   * @returns {string|Buffer} - Converted content
   */
  function convertEncoding(content, sourceEncoding = 'latin1', targetEncoding = 'utf8') {
    // If encodings are the same, return the original
    if (sourceEncoding === targetEncoding) {
      return content;
    }
    
    // Convert to buffer with source encoding
    let buffer;
    if (Buffer.isBuffer(content)) {
      buffer = content;
    } else {
      buffer = Buffer.from(String(content), sourceEncoding);
    }
    
    // Return as string with target encoding or as buffer
    return buffer.toString(targetEncoding);
  }
  
  /**
   * Convert UTF-8 string to ISO-8859-1
   * @param {string} str - UTF-8 string to convert
   * @returns {string} - ISO-8859-1 encoded string
   */
  function utf8ToIso88591(str) {
    return convertEncoding(str, 'utf8', 'latin1');
  }

  /**
   * Convert ISO-8859-1 string to UTF-8
   * @param {string} str - ISO-8859-1 string to convert
   * @returns {string} - UTF-8 encoded string
   */
  function iso88591ToUtf8(str) {
    return convertEncoding(str, 'latin1', 'utf8');
  }
  
  module.exports = {
    detectEncoding,
    bufferToString,
    stringToBuffer,
    convertEncoding,
    utf8ToIso88591,
    iso88591ToUtf8
  };