// test_data_loader.js
const fs = require('fs');
const path = require('path');
const Redis = require('ioredis');

async function loadTestData() {
  const redis = new Redis({
    port: process.env.REDIS_PORT || 6379,
    host: process.env.REDIS_HOST || 'localhost',
    retryStrategy: (times) => {
      if (times > 3) {
        console.error('Failed to connect to Redis after multiple retries');
        return null;
      }
      return Math.min(times * 100, 2000);
    }
  });

  try {
    // Load noun declension test data
    const nounData = JSON.parse(fs.readFileSync(
      path.join(__dirname, '../data/test_data/noun_declension_test_data.json')
    ));
    
    // Load article usage test data
    const articleData = JSON.parse(fs.readFileSync(
      path.join(__dirname, '../data/test_data/article_usage_test_data.json')
    ));
    
    // Load grammar rules data
    const rulesData = JSON.parse(fs.readFileSync(
      path.join(__dirname, '../data/test_data/grammar_rules_data.json')
    ));
    
    // Load word order test data
    const wordOrderData = JSON.parse(fs.readFileSync(
      path.join(__dirname, '../data/test_data/word_order_test_data.json')
    ));
    
    console.log('Loading noun declension data...');
    for (const [key, value] of Object.entries(nounData['norsk:fullforms'])) {
      if (value !== null) {
        await redis.hset('norsk:fullforms', key, value);
      }
    }
    
    console.log('Loading article usage data...');
    for (const [key, value] of Object.entries(articleData['norsk:fullforms'])) {
      await redis.hset('norsk:fullforms', key, value);
    }
    
    console.log('Loading grammar rules...');
    for (const [key, value] of Object.entries(rulesData)) {
      if (Array.isArray(value)) {
        await redis.del(key); // Clear existing members
        if (value.length > 0) {
          await redis.sadd(key, ...value);
        }
      } else if (typeof value === 'object') {
        await redis.del(key); // Clear existing hash
        if (Object.keys(value).length > 0) {
          await redis.hset(key, value);
        }
      }
    }
    
    console.log('Loading word order rules...');
    for (const [key, value] of Object.entries(wordOrderData)) {
      if (Array.isArray(value)) {
        await redis.del(key); // Clear existing members
        if (value.length > 0) {
          await redis.sadd(key, ...value);
        }
      }
    }
    
    console.log('Test data loaded successfully!');
  } catch (error) {
    console.error('Error loading test data:', error);
  } finally {
    redis.quit();
  }
}

loadTestData();