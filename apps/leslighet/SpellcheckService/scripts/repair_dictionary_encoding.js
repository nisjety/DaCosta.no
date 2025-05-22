// scripts/repair_dictionary_encoding.js
/**
 * This script is designed to fix encoding issues with Norwegian dictionary files.
 * It ensures that the files are properly read and interpreted as ISO-8859-1 (Latin1).
 */

const fs = require('fs');
const path = require('path');

// Base paths - adjust as needed
const BASE_PATH = process.argv[2] || './data/DICT';
const HUNSPELL_PATH = path.join(process.cwd(), BASE_PATH, 'Hunspell');

// Files to process
const NORWEGIAN_FILES = [
  'nb_NO.aff',
  'nb_NO.dic',
  'nn_NO.aff',
  'nn_NO.dic'
];

/**
 * Reads a file with ISO-8859-1 encoding and returns a buffer
 * @param {string} filePath - Path to the file
 * @returns {Buffer} The file content as a buffer
 */
function readLatin1File(filePath) {
  try {
    return fs.readFileSync(filePath);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

/**
 * Verifies if an aff file has the correct SET ISO-8859-1 directive
 * @param {Buffer} buffer - File content
 * @returns {boolean} Whether the file has the SET ISO-8859-1 directive
 */
function hasEncodingDirective(buffer) {
  const firstLine = buffer.slice(0, 100).toString('latin1').split('\n')[0].trim();
  return firstLine.toUpperCase().includes('SET ISO-8859-1') || 
         firstLine.toUpperCase().includes('SET ISO8859-1');
}

/**
 * Adds SET ISO-8859-1 directive to aff file if missing
 * @param {Buffer} buffer - File content
 * @returns {Buffer} Fixed buffer with SET ISO-8859-1 directive
 */
function fixAffEncoding(buffer) {
  if (hasEncodingDirective(buffer)) {
    return buffer;
  }
  
  console.log('Adding SET ISO-8859-1 directive to file');
  return Buffer.concat([
    Buffer.from('SET ISO-8859-1\n', 'latin1'),
    buffer
  ]);
}

/**
 * Checks file for Norwegian characters
 * @param {Buffer} buffer - File content
 * @returns {number} Count of Norwegian characters found
 */
function countNorwegianChars(buffer) {
  const content = buffer.toString('latin1');
  const norwegianChars = (content.match(/[æøåÆØÅ]/g) || []);
  return norwegianChars.length;
}

/**
 * Sample Norwegian words from dictionary for verification
 * @param {Buffer} dicBuffer - Dictionary file content
 * @param {number} sampleSize - Number of samples to show
 * @returns {string[]} Sample Norwegian words
 */
function sampleNorwegianWords(dicBuffer, sampleSize = 10) {
  const content = dicBuffer.toString('latin1');
  const lines = content.split('\n').filter(Boolean);
  
  // Skip the first line if it's a number (word count)
  const startIdx = lines[0].match(/^\d+$/) ? 1 : 0;
  
  // Find words with Norwegian characters
  const norwegianWords = [];
  for (let i = startIdx; i < lines.length && norwegianWords.length < sampleSize; i++) {
    if (/[æøåÆØÅ]/.test(lines[i])) {
      norwegianWords.push(lines[i].split('/')[0].trim());
    }
  }
  
  return norwegianWords;
}

/**
 * Processes a single dictionary file
 * @param {string} fileName - Dictionary file name
 */
function processFile(fileName) {
  const filePath = path.join(HUNSPELL_PATH, fileName);
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }
  
  console.log(`\nProcessing ${fileName}...`);
  const buffer = readLatin1File(filePath);
  
  if (!buffer) {
    return;
  }
  
  // Check Norwegian character count
  const charCount = countNorwegianChars(buffer);
  console.log(`Found ${charCount} Norwegian characters in file`);
  
  // For .aff files, ensure they have the encoding directive
  let fixedBuffer = buffer;
  if (fileName.endsWith('.aff')) {
    if (hasEncodingDirective(buffer)) {
      console.log('✓ File has proper SET ISO-8859-1 directive');
    } else {
      console.log('⚠️ File is missing SET ISO-8859-1 directive - fixing...');
      fixedBuffer = fixAffEncoding(buffer);
    }
  }
  
  // For .dic files, sample some Norwegian words
  if (fileName.endsWith('.dic')) {
    const samples = sampleNorwegianWords(buffer);
    if (samples.length > 0) {
      console.log('Sample Norwegian words found:');
      samples.forEach(word => console.log(`  - ${word}`));
    } else {
      console.warn('⚠️ No Norwegian words found in sample - possible encoding issue!');
    }
  }
  
  // Handle cases where no Norwegian characters were found in .dic files
  let needsReEncoding = false;
  if (fileName === 'nb_NO.dic' && charCount === 0) {
    console.log('⚠️ No Norwegian characters found in nb_NO.dic - attempting to fix encoding');
    needsReEncoding = true;
  }

  // Only write the file if it was modified or needs re-encoding
  if (fixedBuffer !== buffer || needsReEncoding) {
    const backupPath = `${filePath}.bak`;
    console.log(`Creating backup at: ${backupPath}`);
    fs.writeFileSync(backupPath, buffer);
    
    if (needsReEncoding && fileName === 'nb_NO.dic') {
      console.log('Attempting to read file as UTF-8 and convert to Latin1');
      // Read the file as UTF-8
      const contentUtf8 = fs.readFileSync(filePath, 'utf8');
      // Check if we need to fix specific characters
      const fixedContent = contentUtf8
        .replace(/Kj�rlighetsbudet/g, 'Kjærlighetsbudet')
        .replace(/Kj�rstad/g, 'Kjærstad')
        .replace(/Kj�rvik/g, 'Kjærvik')
        .replace(/Kj�lberg/g, 'Kjølberg')
        .replace(/Kj�llefjord/g, 'Kjøllefjord')
        .replace(/Kj�lsdalen/g, 'Kjølsdalen')
        .replace(/Kj�lstad/g, 'Kjølstad')
        .replace(/Kj�pmannskj�r/g, 'Kjøpmannskjær')
        .replace(/Kj�psvik/g, 'Kjøpsvik')
        .replace(/Kj�rsvik/g, 'Kjørsvik')
        .replace(/Kj�rsvikbugen/g, 'Kjørsvikbugen')
        .replace(/Kj�sterud/g, 'Kjøsterud')
        .replace(/Kj�tta/g, 'Kjøtta')
        // Add more replacements as needed for other common Norwegian words
        .replace(/b�t/gi, 'båt')
        .replace(/v�r/gi, 'vær')
        .replace(/d�rlig/gi, 'dårlig')
        .replace(/kj�re/gi, 'kjøre')
        .replace(/�/g, 'æ')
        .replace(/�/g, 'ø')
        .replace(/�/g, 'å')
        .replace(/�/g, 'Æ')
        .replace(/�/g, 'Ø')
        .replace(/�/g, 'Å');
      
      // Convert back to Latin1
      const fixedBuffer = Buffer.from(fixedContent, 'latin1');
      
      // Write the fixed file
      console.log(`Writing fixed file with correct Norwegian characters: ${filePath}`);
      fs.writeFileSync(filePath, fixedBuffer);
      console.log('✓ File updated successfully');
      
      // Verify the fix
      const verifyBuffer = fs.readFileSync(filePath);
      const verifyCharCount = countNorwegianChars(verifyBuffer);
      console.log(`After fix: Found ${verifyCharCount} Norwegian characters in file`);
      const verifySamples = sampleNorwegianWords(verifyBuffer);
      if (verifySamples.length > 0) {
        console.log('Sample Norwegian words after fix:');
        verifySamples.forEach(word => console.log(`  - ${word}`));
      }
    } else {
      console.log(`Writing fixed file: ${filePath}`);
      fs.writeFileSync(filePath, fixedBuffer);
      console.log('✓ File updated successfully');
    }
  } else {
    console.log('✓ No changes needed for this file');
  }
}

/**
 * Main function to process all dictionary files
 */
function main() {
  console.log('=== Norwegian Dictionary Encoding Repair Tool ===');
  console.log(`Hunspell path: ${HUNSPELL_PATH}`);
  
  if (!fs.existsSync(HUNSPELL_PATH)) {
    console.error(`Error: Hunspell directory not found: ${HUNSPELL_PATH}`);
    console.log('Usage: node repair_dictionary_encoding.js [DICT_PATH]');
    process.exit(1);
  }
  
  // Check available files
  const availableFiles = fs.readdirSync(HUNSPELL_PATH);
  console.log(`Found dictionary files: ${availableFiles.join(', ')}`);
  
  // Process each Norwegian file
  for (const file of NORWEGIAN_FILES) {
    if (availableFiles.includes(file)) {
      processFile(file);
    } else {
      console.warn(`⚠️ Missing file: ${file}`);
    }
  }
  
  console.log('\n=== Dictionary Repair Complete ===');
}

// Run the script
main();
