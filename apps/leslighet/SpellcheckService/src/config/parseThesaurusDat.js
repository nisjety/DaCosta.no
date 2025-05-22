/**
 * Parse the .dat content from thesaurus files into structured entries
 * Expected format example:
 * 1|2
 * (adj)|one|i|ane|cardinal (similar term)
 * (noun)|one|I|ace|single|unity|digit (generic term)|figure (generic term)
 *
 * @param {string|Buffer} data - Raw .dat file content, can be string or buffer
 * @param {string} [encoding='utf8'] - The encoding to use ('latin1' for Norwegian, 'utf8' for English)
 * @returns {Array} Parsed thesaurus entries [{ headword, senses: [] }]
 */
function parseThesaurusDat(data, encoding = 'utf8') {
  // Convert Buffer to string if needed, using the specified encoding
  let contentStr;
  if (Buffer.isBuffer(data)) {
      contentStr = data.toString(encoding);
  } else {
      contentStr = String(data || '');
  }

  // Check first line for encoding marker
  const firstLine = contentStr.split(/\r?\n/)[0]?.trim().toUpperCase();
  if (firstLine === 'ISO-8859-1' || firstLine === 'ISO8859-1') {
      console.log('Detected ISO-8859-1 encoding marker in thesaurus file');
      encoding = 'latin1';
      // Remove the encoding line
      contentStr = contentStr.split(/\r?\n/).slice(1).join('\n');
  }

  const lines = contentStr.split(/\r?\n/).filter(Boolean);
  const entries = [];
  let currentEntry = null;

  for (const line of lines) {
    if (/^\S+\|\d+/.test(line)) {
      // New headword entry (like "1|2" or "someword|number")
      currentEntry = {
        headword: line,
        senses: []
      };
      entries.push(currentEntry);
    } else if (currentEntry && line.trim()) {
      // Sense/meaning line belonging to the current headword
      currentEntry.senses.push(line.trim());
    }
  }

  return entries;
}

/**
* Detect encoding from thesaurus content
* 
* @param {string|Buffer} content - Raw content to check
* @returns {string} - Detected encoding ('latin1' or 'utf8')
*/
function detectThesaurusEncoding(content) {
  // If it's a buffer, check the first line
  if (Buffer.isBuffer(content)) {
      // Try both encodings for the first line
      const latin1FirstLine = content.slice(0, 100).toString('latin1').split('\n')[0].trim();
      
      // Look for ISO-8859-1 marker
      if (latin1FirstLine.toUpperCase() === 'ISO-8859-1' || 
          latin1FirstLine.toUpperCase() === 'ISO8859-1') {
          return 'latin1';
      }
      
      // Look for UTF-8 marker
      const utf8FirstLine = content.slice(0, 100).toString('utf8').split('\n')[0].trim();
      if (utf8FirstLine.toUpperCase() === 'UTF-8') {
          return 'utf8';
      }
      
      // Check for Norwegian characters
      if (/[æøåÆØÅ]/.test(content.toString('latin1'))) {
          return 'latin1';
      }
  } else if (typeof content === 'string') {
      // If it's a string, check the first line
      const firstLine = content.split('\n')[0].trim();
      if (firstLine.toUpperCase() === 'ISO-8859-1' || 
          firstLine.toUpperCase() === 'ISO8859-1') {
          return 'latin1';
      }
      if (firstLine.toUpperCase() === 'UTF-8') {
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

module.exports = {
  parseThesaurusDat,
  detectThesaurusEncoding
};