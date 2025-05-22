// scripts/load_dictionary_to_redis.js
const fs = require("fs");
const path = require("path");
const Redis = require("ioredis");

// Redis config
const redis = new Redis({
  host: process.env.REDIS_HOST || "redis",
  port: process.env.REDIS_PORT || 6379,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

const BASE_PATH = "/app/data/DICT";
const HUNSPELL_PATH = path.join(BASE_PATH, "Hunspell");
const HYPHENATION_PATH = path.join(BASE_PATH, "Hyphenation");
const THESAURUS_PATH = path.join(BASE_PATH, "Thesaurus");
const STOPWORDS_PATH = path.join(BASE_PATH, "Stopword/stopwords-no.json");

// File-to-Redis key mapping
const HUNSPELL_FILES = {
  "nb_NO.aff": "norsk:hunspell:nb:aff",
  "nb_NO.dic": "norsk:hunspell:nb:dic",
  "nn_NO.aff": "norsk:hunspell:nn:aff",
  "nn_NO.dic": "norsk:hunspell:nn:dic",
  "en_GB.aff": "english:hunspell:gb:aff",
  "en_GB.dic": "english:hunspell:gb:dic",
  "en_US.aff": "english:hunspell:us:aff",
  "en_US.dic": "english:hunspell:us:dic",
};

const HYPHENATION_FILES = {
  "hyph_nb_NO.dic": "norsk:hyphenation:nb",
  "hyph_nn_NO.dic": "norsk:hyphenation:nn",
  "hyph_en_GB.dic": "english:hyphenation:gb",
  "hyph_en_US.dic": "english:hyphenation:us",
};

const THESAURUS_FILES = {
  "th_en_US_v2.dat": "english:thesaurus:us:dat",
  "th_en_US_v2.idx": "english:thesaurus:us:idx",
  "th_nb_NO_v2.dat": "norsk:thesaurus:nb:dat",
  "th_nb_NO_v2.idx": "norsk:thesaurus:nb:idx",
  "th_nn_NO_v2.dat": "norsk:thesaurus:nn:dat",
  "th_nn_NO_v2.idx": "norsk:thesaurus:nn:idx",
};

// Encoding detection
function detectEncoding(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes("en_gb") || lower.includes("en_us") || lower.includes("th_en_")) return "utf8";
  if (lower.includes("nb_no") || lower.includes("nn_no") || lower.includes("th_nb_") || lower.includes("th_nn_")) return "latin1";
  return "latin1"; // default fallback
}

// Helper function to verify encoding conversion
function verifyEncodingConversion(originalData, convertedData, fileName) {
  // Check if the conversion preserved the data length
  const originalLength = Buffer.from(originalData, 'latin1').length;
  const convertedLength = Buffer.from(convertedData, 'utf8').length;
  
  if (originalLength !== convertedLength) {
    console.warn(`⚠️ Warning: Length mismatch for ${fileName}`);
    console.warn(`   Original length: ${originalLength}, Converted length: ${convertedLength}`);
  }
  
  // Try to find a Norwegian character in the first 1000 characters
  const sample = convertedData.substring(0, 1000);
  const norwegianChars = ['æ', 'ø', 'å', 'Æ', 'Ø', 'Å'];
  const foundChars = norwegianChars.filter(char => sample.includes(char));
  
  if (foundChars.length === 0) {
    console.warn(`⚠️ Warning: No Norwegian characters found in ${fileName}`);
  } else {
    console.log(`✅ Found Norwegian characters in ${fileName}: ${foundChars.join(', ')}`);
  }
}

// Function to ensure proper encoding in Norwegian dictionary files
function ensureProperEncoding(buffer, fileName) {
  // For AFF files
  if (fileName.endsWith('.aff')) {
    const firstLine = buffer.slice(0, 100).toString('latin1').trim();
    if (!firstLine.toUpperCase().includes('SET ISO8859-1') && !firstLine.toUpperCase().includes('SET ISO-8859-1')) {
      return Buffer.concat([
        Buffer.from('SET ISO-8859-1\n', 'latin1'),
        buffer
      ]);
    }
  }
  // For thesaurus files
  else if (fileName.endsWith('.dat') || fileName.endsWith('.idx')) {
    const firstLine = buffer.toString('latin1').split('\n')[0].trim();
    if (firstLine.toUpperCase() !== 'ISO-8859-1' && firstLine.toUpperCase() !== 'ISO8859-1') {
      return Buffer.concat([
        Buffer.from('ISO-8859-1\n', 'latin1'),
        buffer
      ]);
    }
  }
  return buffer;
}

// File reader preserving encoding
function readFileAutoEncoding(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".json") return fs.readFileSync(filePath, "utf8");
  
  const fileName = path.basename(filePath);
  const encoding = detectEncoding(fileName);
  
  // Read file as buffer first
  const buffer = fs.readFileSync(filePath);
  
  try {
    // For Norwegian files, handle encoding carefully
    if (encoding === "latin1") {
      // For dictionary files, we need to preserve the binary data
      if (fileName.endsWith('.dic') || fileName.endsWith('.aff')) {
        // Keep the data as a buffer for dictionary files
        return buffer;
      }
      
      // For other files, convert to UTF-8
      const latin1String = buffer.toString("latin1");
      return Buffer.from(latin1String, "latin1");
    }
    
    // For other files, use the detected encoding
    return buffer;
  } catch (error) {
    console.error(`Encoding error for file ${fileName}:`, error);
    throw error;
  }
}

// Optional word count / entry log
function logWordCount(fileName, data) {
  if (fileName.endsWith(".dic")) {
    const lines = data.split(/\r?\n/).filter(Boolean);
    if (lines[0]?.match(/^\d+$/)) {
      console.log(`--> ${fileName} header indicates ${lines[0]} words`);
    } else {
      console.log(`--> ${fileName} contains ${lines.length} lines`);
    }
    
    // For Norwegian dictionaries, check for Norwegian characters
    if (fileName.includes('nb_NO') || fileName.includes('nn_NO')) {
      // Look deeper in the file for Norwegian characters (up to 10000 lines)
      const norwegianScan = Math.min(lines.length, 10000);
      const norwegianLines = lines.slice(0, norwegianScan)
        .filter(line => /[æøåÆØÅ]/.test(line));
      
      console.log(`--> Found ${norwegianLines.length} words with Norwegian characters in first ${norwegianScan} lines`);
      
      if (norwegianLines.length > 0) {
        console.log('✅ Sample Norwegian words:');
        norwegianLines.slice(0, 5).forEach(word => console.log(`  ${word.trim()}`));
      } else {
        console.warn('⚠️ No Norwegian characters found in dictionary sample - encoding may be incorrect!');
      }
    }
  } else if (fileName.endsWith(".idx")) {
    const lines = data.split(/\r?\n/).filter(Boolean);
    console.log(`--> ${fileName} contains ${lines.length} index entries`);
  }
}

// Load files into Redis - directly as binary for Norwegian files
async function loadFileMapToRedis(dirPath, fileMap, label) {
  console.log(`\n📂 Loading ${label} from: ${dirPath}`);
  try {
    const files = fs.readdirSync(dirPath);
    console.log(`📃 Directory contents: [${files.join(", ")}]`);
  } catch (err) {
    console.error(`❌ Cannot read directory ${dirPath}:`, err);
  }

  for (const [fileName, redisKey] of Object.entries(fileMap)) {
    const filePath = path.join(dirPath, fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Missing file: ${filePath}`);
      continue;
    }

    try {
      // For Norwegian dictionary files (Hunspell .aff and .dic)
      if ((fileName.includes("nb_NO") || fileName.includes("nn_NO")) && 
          (fileName.endsWith(".aff") || fileName.endsWith(".dic"))) {
        
        // Read file as raw buffer
        let buffer = fs.readFileSync(filePath);
        
        // Ensure proper encoding
        buffer = ensureProperEncoding(buffer, fileName);
        
        // Check encoding in the first line if it's an .aff file
        if (fileName.endsWith(".aff")) {
          const firstLine = buffer.slice(0, 100).toString('latin1').trim();
          console.log(`First line of ${fileName}: ${firstLine}`);
          
          // Verify ISO-8859-1 encoding is specified correctly
          if (firstLine.toUpperCase().includes("SET ISO8859-1") || firstLine.toUpperCase().includes("SET ISO-8859-1")) {
            console.log(`✅ ${fileName} correctly specifies ISO-8859-1 encoding`);
          } else {
            console.warn(`⚠️ ${fileName} does not specify ISO-8859-1 encoding in first line. This is required for proper handling of Norwegian characters.`);
          }
          
          // Log a few lines from the file to check encoding visually
          const previewLines = buffer.toString('latin1').split('\n').slice(0, 5);
          console.log(`Preview of ${fileName} (first 5 lines):`);
          previewLines.forEach(line => console.log(`  ${line}`));
        }
        
        // Store the raw buffer without any encoding conversion
        // This preserves the original ISO-8859-1 encoding
        await redis.set(redisKey, buffer);
        
        // For .dic files, count words and show sample to verify encoding
        if (fileName.endsWith('.dic')) {
          // Read the first 100 lines to get a sample
          const previewText = buffer.toString('latin1').split('\n').slice(0, 100);
          
          if (previewText.length > 0 && /^\d+$/.test(previewText[0].trim())) {
            console.log(`--> ${fileName} header indicates ${previewText[0].trim()} words`);
          }
          
          // Display sample words with Norwegian characters to verify encoding
          const norwegianSampleWords = previewText.slice(1, 20)
            .filter(line => /[æøåÆØÅ]/.test(line))
            .slice(0, 5);
          
          if (norwegianSampleWords.length > 0) {
            console.log(`✅ Sample Norwegian words from ${fileName}:`);
            norwegianSampleWords.forEach(word => console.log(`  ${word.trim()}`));
          } else {
            // Show general samples if no Norwegian characters found in the first samples
            console.log(`✅ Sample words from ${fileName} (no Norwegian chars in first samples):`);
            previewText.slice(1, 6).forEach(word => console.log(`  ${word.trim()}`));
          }
        }
        
        console.log(`✅ Loaded ${fileName} -> Redis as ${redisKey} (Raw ISO-8859-1 binary data)`);
      }
      // For Norwegian hyphenation and thesaurus files
      else if (fileName.includes("hyph_nb_NO") || fileName.includes("hyph_nn_NO") || 
              fileName.includes("th_nb_NO") || fileName.includes("th_nn_NO")) {
        
        // Read file as raw buffer
        let buffer = fs.readFileSync(filePath);
        
        // Ensure proper encoding
        buffer = ensureProperEncoding(buffer, fileName);
        
        // For thesaurus files, check the encoding and contents
        if (fileName.endsWith(".dat") || fileName.endsWith(".idx")) {
          // Check first line for encoding info
          const firstLine = buffer.toString('latin1').split('\n')[0].trim();
          
          // Log the first line which should contain encoding info for thesaurus files
          console.log(`First line of ${fileName}: ${firstLine}`);
          
          if (firstLine.toUpperCase().includes("ISO-8859-1") || firstLine.toUpperCase().includes("ISO8859-1")) {
            console.log(`✅ ${fileName} correctly specifies ISO-8859-1 encoding`);
          } else {
            console.warn(`⚠️ ${fileName} does not specify ISO-8859-1 encoding in first line`);
          }
          
          // For .dat files, check for Norwegian characters
          if (fileName.endsWith('.dat')) {
            // Read more lines for thorough checking
            const lines = buffer.toString('latin1').split(/\r?\n/).filter(Boolean);
            
            // Scan through more of the file (up to 1000 lines) to find Norwegian characters
            const scanDepth = Math.min(lines.length, 1000);
            const norwegianLines = lines.slice(0, scanDepth).filter(line => /[æøåÆØÅ]/.test(line));
            
            if (norwegianLines.length > 0) {
              console.log(`✅ Found ${norwegianLines.length} lines with Norwegian characters in ${fileName}`);
              console.log(`✅ Sample: ${norwegianLines[0].substring(0, 50)}...`);
            } else {
              console.warn(`⚠️ No Norwegian characters found in first ${scanDepth} lines of ${fileName}`);
              console.log(`ℹ️ This might be normal for some thesaurus files. The file will still be loaded.`);
              // Show a sample of some lines for debugging
              if (lines.length > 5) {
                console.log(`ℹ️ Sample content from ${fileName}:`);
                lines.slice(1, 6).forEach(line => console.log(`  ${line.substring(0, 60)}...`));
              }
            }
          }
          
          // For .idx files, check entries and sample
          if (fileName.endsWith('.idx')) {
            const lines = buffer.toString('latin1').split(/\r?\n/).filter(Boolean);
            console.log(`--> ${fileName} contains ${lines.length} index entries`);
            
            // Scan more entries for Norwegian characters
            const scanDepth = Math.min(lines.length, 1000);
            const norwegianEntries = lines.slice(1, scanDepth).filter(line => /[æøåÆØÅ]/.test(line));
            
            if (norwegianEntries.length > 0) {
              console.log(`✅ Sample Norwegian entries from ${fileName}:`);
              norwegianEntries.slice(0, 5).forEach(entry => console.log(`  ${entry.trim()}`));
            } else {
              console.log(`⚠️ No entries with Norwegian characters found in the first ${scanDepth} lines of ${fileName}`);
              console.log(`ℹ️ This might be normal for some thesaurus files. The file will still be loaded.`);
              // Show some sample entries for debugging
              if (lines.length > 5) {
                console.log(`ℹ️ Sample entries from ${fileName}:`);
                lines.slice(1, 6).forEach(entry => console.log(`  ${entry.trim()}`));
              }
            }
          }
        }
        
        // Store binary data as raw buffer
        await redis.set(redisKey, buffer);
        
        // Log entry count
        if (fileName.endsWith('.idx')) {
          const lines = buffer.toString('latin1').split(/\r?\n/).filter(Boolean);
          console.log(`--> ${fileName} contains ${lines.length} index entries`);
        } else if (fileName.endsWith('.dic')) {
          const lines = buffer.toString('latin1').split(/\r?\n/).filter(Boolean);
          console.log(`--> ${fileName} contains ${lines.length} lines`);
        }
        
        console.log(`✅ Loaded ${fileName} -> Redis as ${redisKey} (Raw binary data)`);
      } 
      // English files or other non-Norwegian files
      else {
        const data = fs.readFileSync(filePath, "utf8");
        
        // Log word count for English files
        if (fileName.endsWith('.dic')) {
          const lines = data.split(/\r?\n/).filter(Boolean);
          if (lines.length > 0 && /^\d+$/.test(lines[0].trim())) {
            console.log(`--> ${fileName} header indicates ${lines[0].trim()} words`);
          } else {
            console.log(`--> ${fileName} contains ${lines.length} lines`);
          }
        } else if (fileName.endsWith('.idx')) {
          const lines = data.split(/\r?\n/).filter(Boolean);
          console.log(`--> ${fileName} contains ${lines.length} index entries`);
        }
        
        await redis.set(redisKey, data);
        console.log(`✅ Loaded ${fileName} -> Redis as ${redisKey}`);
      }
    } catch (err) {
      console.error(`❌ Error loading ${fileName}:`, err);
      throw err; // Re-throw to stop the process
    }
  }
}

// Load stopwords JSON and categories
async function loadStopwords() {
  console.log("\n📂 Loading stopwords...");
  if (!fs.existsSync(STOPWORDS_PATH)) {
    console.error(`❌ Missing stopwords file: ${STOPWORDS_PATH}`);
    return;
  }

  try {
    const jsonData = fs.readFileSync(STOPWORDS_PATH, "utf8");
    await redis.set("norsk:specialterms", jsonData);
    console.log("✅ Loaded stopwords -> Redis as norsk:specialterms");

    const categories = JSON.parse(jsonData);
    for (const cat of categories) {
      const key = `norsk:specialterms:${cat.category}`;
      await redis.set(key, JSON.stringify(cat.words));
      console.log(`✅ Category '${cat.category}' -> Redis as ${key}`);
    }
  } catch (err) {
    console.error("❌ Error loading stopwords:", err);
  }
}

// Test Norwegian dictionary encoding
async function testNorwegianDictionaryEncoding() {
  console.log('\n=== 🧪 Testing Norwegian dictionary encoding ===');
  
  // Test words with Norwegian characters
  const testWords = ['båt', 'vær', 'dårlig', 'kjøre', 'hus', 'æble', 'øye', 'år'];
  
  try {
    // Get the affixes and dictionary data
    const nbAff = await redis.getBuffer('norsk:hunspell:nb:aff');
    const nbDic = await redis.getBuffer('norsk:hunspell:nb:dic');
    
    if (!nbAff || !nbDic) {
      console.error('❌ Norwegian dictionary data not found in Redis');
      return;
    }
    
    console.log(`✅ Dictionary buffers retrieved: aff=${nbAff.length} bytes, dic=${nbDic.length} bytes`);
    
    // Check encoding in first line of aff file
    const affFirstLine = nbAff.slice(0, 100).toString('latin1').trim();
    console.log(`First line of aff: ${affFirstLine}`);
    
    if (affFirstLine.toUpperCase().includes('SET ISO8859-1') || affFirstLine.toUpperCase().includes('SET ISO-8859-1')) {
      console.log('✅ Affixes file has correct encoding specification');
    } else {
      console.warn('⚠️ Affixes file might have incorrect encoding specification');
    }
    
    // Count Norwegian characters in dictionary
    const dicContent = nbDic.toString('latin1');
    const norwegianChars = (dicContent.match(/[æøåÆØÅ]/g) || []).length;
    console.log(`Norwegian characters in dictionary: ${norwegianChars}`);
    
    if (norwegianChars > 0) {
      console.log('✅ Dictionary contains Norwegian characters');
    } else {
      console.warn('⚠️ No Norwegian characters found in dictionary - encoding may be incorrect');
    }
    
    // For manual verification later in the app
    console.log('\nManual verification information:');
    console.log('1. Ensure your spellchecker correctly loads these files');
    console.log('2. Test words with Norwegian characters like: båt, vær, kjøre, dårlig');
    console.log('3. If still failing, check your spellchecker\'s encoding handling');
    
  } catch (err) {
    console.error('❌ Error testing Norwegian encoding:', err);
  }
}

// Main loading sequence
async function loadAllData() {
  console.log("=== 🚀 Starting dictionary data load into Redis ===");
  console.log(`Base path: ${BASE_PATH}`);
  console.log(`Redis host: ${process.env.REDIS_HOST || "redis"}`);
  console.log(`Redis port: ${process.env.REDIS_PORT || 6379}`);

  try {
    if (!fs.existsSync(BASE_PATH)) {
      console.error(`❌ Base path missing: ${BASE_PATH}`);
      return;
    }

    // Test Redis connection first
    try {
      await redis.ping();
      console.log("✅ Redis connection successful");
    } catch (redisError) {
      console.error("❌ Redis connection failed:", redisError);
      throw redisError;
    }

    console.log(`📃 Base contents: [${fs.readdirSync(BASE_PATH).join(", ")}]`);
    await loadFileMapToRedis(HUNSPELL_PATH, HUNSPELL_FILES, "Hunspell");
    await loadFileMapToRedis(HYPHENATION_PATH, HYPHENATION_FILES, "Hyphenation");
    await loadFileMapToRedis(THESAURUS_PATH, THESAURUS_FILES, "Thesaurus");
    await loadStopwords();

    console.log("\n✅✅✅ All dictionary data successfully loaded into Redis!");
    
    // Test Norwegian dictionary encoding after loading
    await testNorwegianDictionaryEncoding();
  } catch (err) {
    console.error("❌ Unexpected error during data load:", err);
    process.exit(1);
  } finally {
    redis.quit();
  }
}

// CLI entry point
if (require.main === module) {
  console.log("🗂️ Dictionary loader script started");
  loadAllData().catch((err) => {
    console.error("❌ Loader crashed:", err);
    redis.quit();
    process.exit(1);
  });
}

module.exports = loadAllData;