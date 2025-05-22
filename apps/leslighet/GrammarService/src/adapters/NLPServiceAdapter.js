// src/adapters/NLPServiceAdapter.js
const axios = require('axios');

/**
 * Adapter for communicating with the external NLPService
 */
class NLPServiceAdapter {
  /**
   * Constructor
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    this.config = {
      baseUrl: process.env.NLP_SERVICE_URL || 'http://localhost:5014',
      timeout: parseInt(process.env.NLP_SERVICE_TIMEOUT || '30000', 10),
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };
  }

  /**
   * Create a chat completion using OpenAI via the NLPService
   * @param {Object} options - Chat completion options
   * @returns {Promise<Object>} - Promise resolving with completion response
   */
  async createChatCompletion(options) {
    return this.makeRequest('post', '/api/chat', options);
  }
  
  /**
   * Check grammar using local AI model via NLPService
   * @param {string} text - Text to check
   * @returns {Promise<Array>} - Promise resolving with grammar issues
   */
  async checkGrammar(text) {
    return this.makeRequest('post', '/api/grammar', { text });
  }
  
  /**
   * Analyze sentiment using local AI model via NLPService
   * @param {string} text - Text to analyze
   * @returns {Promise<Object>} - Promise resolving with sentiment analysis
   */
  async analyzeSentiment(text) {
    return this.makeRequest('post', '/api/sentiment', { text });
  }
  
  /**
   * Summarize text using local AI model via NLPService
   * @param {string} text - Text to summarize
   * @returns {Promise<Object>} - Promise resolving with summary
   */
  async summarizeText(text) {
    return this.makeRequest('post', '/api/summarize', { text });
  }
  
  /**
   * Generate correction using T5 model via NLPService
   * @param {string} text - Text to correct
   * @returns {Promise<Object>} - Promise resolving with correction
   */
  async generateCorrection(text) {
    return this.makeRequest('post', '/api/correct', { text });
  }
  
  /**
   * Make request to NLPService with retries
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @returns {Promise<any>} - Promise resolving with response data
   */
  async makeRequest(method, endpoint, data) {
    let retries = 0;
    let lastError = null;
    
    while (retries <= this.config.maxRetries) {
      try {
        const response = await axios({
          method,
          url: `${this.config.baseUrl}${endpoint}`,
          data,
          timeout: this.config.timeout,
          headers: { 'Content-Type': 'application/json' }
        });
        
        return response.data;
      } catch (error) {
        lastError = error;
        
        // Retry on connection issues or 5xx errors
        if (error.code === 'ECONNREFUSED' || 
            error.code === 'ETIMEDOUT' || 
            (error.response && error.response.status >= 500)) {
          retries++;
          console.warn(`Retrying NLPService request (${retries}/${this.config.maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * Math.pow(2, retries - 1)));
        } else {
          // Don't retry on 4xx errors
          throw error;
        }
      }
    }
    
    throw lastError;
  }
}

module.exports = NLPServiceAdapter;
