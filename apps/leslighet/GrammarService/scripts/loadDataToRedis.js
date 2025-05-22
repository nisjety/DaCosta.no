/**
 * Load Norwegian language data to Redis
 * 
 * This script loads data from the Norsk Ordbank into Redis for fast access
 * by the GrammarService components.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Redis = require('ioredis');
const NorwegianMorphologyHelper = require(path.join(process.cwd(), 'src/helpers/norwegianMorphologyHelper'));
const { promisify } = require('util');

// Configuration
const CONFIG = {
  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0')
  },
  
  // Data paths
  dataPath: path.join(process.cwd(), 'data'),
  norskOrdbankPath: path.join(process.cwd(), 'data/norsk_ordbank'),
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Batch size for Redis operations
  batchSize: 1000,
  
  // Whether to log progress
  logProgress: true,
  
  // Whether to prefetch compound words
  loadCompounds: true
};

// Initialize Redis client
const redis = new Redis(CONFIG.redis);

// Initialize logger
const logger = {
  info: (...args) => CONFIG.logLevel !== 'error' && console.log(...args),
  error: (...args) => console.error(...args),
  debug: (...args) => CONFIG.logLevel === 'debug' && console.log('[DEBUG]', ...args)
};

// Use the morphology helper for data processing
const morphologyHelper = new NorwegianMorphologyHelper({
  dataPath: CONFIG.norskOrdbankPath,
  cacheEnabled: false // Don't need caching for this script
});

/**
 * Main function to load all data to Redis
 */
async function loadDataToRedis() {
  logger.info('Starting data load to Redis...');
  
  try {
    // Set TTL for keys (3 days)
    const ttlSeconds = 3 * 24 * 60 * 60;
    let wordsProcessed = 0;
    let wordsFailed = 0;
    
    // First, load the morphological data
    logger.info('Loading Norwegian morphological data...');
    await morphologyHelper.loadData();
    logger.info('Morphology data loaded successfully');
    
    // Process word forms
    logger.info('Processing word forms...');
    
    // Use pipeline for better performance
    let pipeline = redis.pipeline();
    let pipelineCount = 0;
    
    // Process word forms from the morphology helper's internal data
    for (const [wordForm, formInfoArray] of morphologyHelper._wordForms.entries()) {
      try {
        if (!wordForm || !Array.isArray(formInfoArray) || formInfoArray.length === 0) continue;
        
        const key = `word:${wordForm.toLowerCase()}`;
        const wordData = {
          forms: JSON.stringify(formInfoArray),
          lemmas: JSON.stringify(await morphologyHelper.getLemmas(wordForm)),
          features: JSON.stringify(await morphologyHelper.getGrammaticalFeatures(wordForm))
        };
        
        // Get compound analysis if available
        const compoundAnalysis = await morphologyHelper.getCompoundAnalysis(wordForm);
        if (compoundAnalysis) {
          wordData.isCompound = '1';
          wordData.compoundInfo = JSON.stringify(compoundAnalysis);
        }
        
        // Store word data
        pipeline.hmset(key, wordData);
        
        // Store word class indices
        const wordClasses = new Set(formInfoArray.map(f => f.groupName).filter(Boolean));
        for (const wordClass of wordClasses) {
          if (wordClass) {
            pipeline.sadd(`class:${wordClass}`, wordForm);
          }
        }
        
        // Store lemma to form mappings
        for (const lemma of await morphologyHelper.getLemmas(wordForm)) {
          pipeline.sadd(`lemma:${lemma}:forms`, wordForm);
        }
        
        // Store compound word indices
        if (compoundAnalysis) {
          pipeline.sadd('compounds', wordForm);
          for (const component of compoundAnalysis.components) {
            pipeline.sadd(`compound:component:${component}`, wordForm);
          }
        }
        
        // Set TTL for the main word data
        pipeline.expire(key, ttlSeconds);
        
        pipelineCount++;
        wordsProcessed++;
        
        // Execute pipeline in batches
        if (pipelineCount >= CONFIG.batchSize) {
          await pipeline.exec();
          pipeline = redis.pipeline();
          pipelineCount = 0;
          
          if (CONFIG.logProgress && wordsProcessed % (CONFIG.batchSize * 10) === 0) {
            logger.info(`Processed ${wordsProcessed} words...`);
          }
        }
      } catch (error) {
        logger.error(`Error processing word "${wordForm}":`, error.message);
        wordsFailed++;
      }
    }
    
    // Execute final pipeline if needed
    if (pipelineCount > 0) {
      await pipeline.exec();
    }
    
    logger.info(`Completed loading Norwegian language data to Redis.`);
    logger.info(`Processed ${wordsProcessed} words successfully.`);
    if (wordsFailed > 0) {
      logger.info(`Failed to process ${wordsFailed} words.`);
    }
    
    // Store metadata
    await redis.hmset('norwegian:meta', {
      lastUpdated: new Date().toISOString(),
      wordCount: wordsProcessed.toString(),
      source: 'Norsk Ordbank',
      version: '1.0'
    });
    
    return { success: true, wordsProcessed, wordsFailed };
  } catch (error) {
    logger.error('Failed to load data to Redis:', error);
    return { success: false, error: error.message };
  } finally {
    // Close Redis connection
    redis.quit();
  }
}

// Run if called directly
if (require.main === module) {
  loadDataToRedis()
    .then(result => {
      if (result.success) {
        logger.info('Data load completed successfully.');
        process.exit(0);
      } else {
        logger.error('Data load failed:', result.error);
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error('Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { loadDataToRedis };
