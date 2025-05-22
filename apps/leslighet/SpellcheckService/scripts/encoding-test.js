// scripts/encoding-test-fix.js
/**
 * Improved encoding test to diagnose and fix Norwegian character issues
 */

const Redis = require('ioredis');
const fs = require('fs');
const nspell = require('nspell');

// Create Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: process.env.REDIS_PORT || 6379
});

/**
 * Test different methods of buffer to string conversion
 * @param {Buffer} buffer - Buffer to test
 * @param {string} label - Label for logging
 */
function testEncodingConversions(buffer, label) {
  if (!Buffer.isBuffer(buffer)) {
    console.log(`${label} is not a buffer!`);
    return;
  }
  
  console.log(`\nTesting encoding conversions for ${label} (${buffer.length} bytes):`);
  
  // Sample first 500 bytes for tests
  const sampleSize = Math.min(buffer.length, 500);
  const sampleBuffer = buffer.slice(0, sampleSize);
  
  // Try different encodings
  const encodings = ['latin1', 'utf8', 'ascii', 'binary'];
  for (const encoding of encodings) {
    try {
      const sample = sampleBuffer.toString(encoding);
      const norwegianChars = (sample.match(/[æøåÆØÅ]/g) || []).length;
      console.log(`- ${encoding}: ${norwegianChars} Norwegian chars found`);
      
      if (norwegianChars > 0) {
        // Show sample Norwegian characters
        const charMatches = [...sample.matchAll(/[æøåÆØÅ][^æøåÆØÅ]{0,10}/g)]
          .slice(0, 3)
          .map(m => m[0])
          .join(', ');
        console.log(`  Sample: ${charMatches}`);
      }
    } catch (err) {
      console.log(`- ${encoding}: ERROR - ${err.message}`);
    }
  }
  
  // Check for specific encoding markers in the file
  const firstLine = buffer.slice(0, 100).toString('latin1').split('\n')[0].trim();
  if (firstLine.toUpperCase() === 'ISO-8859-1' || firstLine.toUpperCase() === 'SET ISO-8859-1') {
    console.log('✅ Found ISO-8859-1 encoding marker');
  }
}

/**
 * Fix buffer encoding issue by directly accessing the buffer
 * @param {Buffer} buffer - Buffer to fix
 * @returns {string} Fixed string with proper encoding
 */
function fixBufferEncoding(buffer) {
  if (!Buffer.isBuffer(buffer)) return '';
  
  // Force Latin1 encoding for Norwegian special characters
  return buffer.toString('latin1');
}

/**
 * Test Norwegian character encoding in thesaurus
 */
async function testThesaurusEncoding() {
  console.log('\n=== TESTING THESAURUS ENCODING ===');
  
  try {
    const thesIdxBuffer = await redis.getBuffer('norsk:thesaurus:nb:idx');
    const thesDatBuffer = await redis.getBuffer('norsk:thesaurus:nb:dat');
    
    if (!thesIdxBuffer || !thesDatBuffer) {
      console.error('❌ Failed to get thesaurus buffers from Redis');
      return;
    }
    
    console.log(`Got thesaurus buffers: idx=${thesIdxBuffer.length} bytes, dat=${thesDatBuffer.length} bytes`);
    
    // Test different encoding methods
    testEncodingConversions(thesIdxBuffer, 'Index file');
    testEncodingConversions(thesDatBuffer, 'Data file');
    
    // Fix encoding and test again
    console.log('\nTrying to fix encoding issues:');
    const idxString = fixBufferEncoding(thesIdxBuffer);
    
    // Count Norwegian characters after fix
    const norwegianChars = (idxString.match(/[æøåÆØÅ]/g) || []).length;
    console.log(`After fix: ${norwegianChars} Norwegian chars found`);
    
    if (norwegianChars > 0) {
      console.log('✅ Successfully fixed Norwegian character encoding!');
      
      // Show some examples of fixed words
      const norwegianWords = [...idxString.matchAll(/\w*[æøåÆØÅ]\w*\|\d+/g)]
        .slice(0, 10)
        .map(match => match[0]);
      
      if (norwegianWords.length > 0) {
        console.log('\nFixed Norwegian words from thesaurus:');
        norwegianWords.forEach(word => console.log(`- ${word}`));
      }
    } else {
      console.log('❌ Failed to fix Norwegian character encoding');
    }
  } catch (err) {
    console.error('Error testing thesaurus encoding:', err);
  }
}

/**
 * Test Norwegian character encoding in dictionary
 */
async function testDictionaryEncoding() {
  console.log('\n=== TESTING DICTIONARY ENCODING ===');
  
  try {
    const nbDicBuffer = await redis.getBuffer('norsk:hunspell:nb:dic');
    const nbAffBuffer = await redis.getBuffer('norsk:hunspell:nb:aff');
    
    if (!nbDicBuffer || !nbAffBuffer) {
      console.error('❌ Failed to get dictionary buffers from Redis');
      return;
    }
    
    console.log(`Got dictionary buffers: aff=${nbAffBuffer.length} bytes, dic=${nbDicBuffer.length} bytes`);
    
    // Test different encoding methods
    testEncodingConversions(nbDicBuffer, 'Dictionary file');
    
    // Try to create a dictionary with proper encoding
    try {
      console.log('\nTesting nspell with direct buffer access:');
      
      // Convert buffers to strings with latin1 encoding for Norwegian
      const affString = nbAffBuffer.toString('latin1');
      const dicString = nbDicBuffer.toString('latin1');
      
      // Create nspell dictionary
      const dict = nspell(affString, dicString);
      
      // Test some Norwegian words
      const testWords = ['hus', 'båt', 'vær', 'dårlig', 'kjøre'];
      for (const word of testWords) {
        const isCorrect = dict.correct(word);
        console.log(`Word "${word}": ${isCorrect ? '✅ Correct' : '❌ Incorrect'}`);
        
        if (!isCorrect) {
          // Get suggestions
          const suggestions = dict.suggest(word);
          console.log(`Suggestions: ${suggestions.join(', ')}`);
        }
      }
    } catch (err) {
      console.error('Error testing dictionary:', err);
    }
  } catch (err) {
    console.error('Error testing dictionary encoding:', err);
  }
}

/**
 * Main test function
 */
async function testNorwegianEncoding() {
  console.log('=== NORWEGIAN ENCODING TEST & FIX ===');
  
  try {
    await testThesaurusEncoding();
    await testDictionaryEncoding();
  } catch (err) {
    console.error('Error during encoding test:', err);
  } finally {
    redis.quit();
  }
}

// Run the test
testNorwegianEncoding().then(() => {
  console.log('\nEncoding test completed');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});