// src/grammar/services/GptGrammarService.js
const { v4: uuidv4 } = require('uuid');
const LRUCache = require('lru-cache');
const NLPServiceAdapter = require('../adapters/NLPServiceAdapter');

class GptGrammarService {
  constructor(config = {}) {
    this.config = {
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4',
      confidenceThreshold: 0.80,
      maxRetries: 3,
      retryDelay: 1000,
      maxBatchSize: 5,
      maxContextLength: 4000,
      useFallback: true,
      ...config
    };

    this.cache = new LRUCache({
      max: 1000,
      ttl: 24 * 60 * 60 * 1000,
    });

    this.nlpService = new NLPServiceAdapter(this.config);
    this.pendingBatches = new Map();
    this.requestsInFlight = 0;
    this.maxConcurrentRequests = 10;
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      apiCalls: 0,
      errors: 0,
      avgResponseTime: 0
    };
  }

  async enhanceGrammarAnalysis(text, ruleBasedResults, options = {}) {
    try {
      this.stats.totalRequests++;
      if (!text || typeof text !== 'string' || text.length < 5) return ruleBasedResults;
      if (!this.config.apiKey && !options.apiKey) {
        console.warn('No OpenAI API key configured. Using rule-based results only.');
        return ruleBasedResults;
      }
      
      if (this.hasAllHighConfidence(ruleBasedResults) && !options.forceGptAnalysis) {
        return ruleBasedResults;
      }
      
      const cacheKey = this.generateCacheKey(text, options);
      if (this.cache.has(cacheKey)) {
        this.stats.cacheHits++;
        const cachedResult = this.cache.get(cacheKey);
        return this.mergeResults(ruleBasedResults, cachedResult, options);
      }
      
      if (this.requestsInFlight >= this.maxConcurrentRequests && this.config.useFallback) {
        console.warn('Concurrent limit reached; using rule-based results only.');
        return ruleBasedResults;
      }
      
      const gptResults = await this.analyzeWithGpt(text, options);
      this.cache.set(cacheKey, gptResults);
      return this.mergeResults(ruleBasedResults, gptResults, options);
    } catch (error) {
      console.error('Error enhancing grammar analysis with GPT:', error);
      this.stats.errors++;
      return ruleBasedResults;
    }
  }

  hasAllHighConfidence(results) {
    if (!results || !results.issues || results.issues.length === 0) return true;
    return results.issues.every(issue => (issue.confidenceScore || 0) >= this.config.confidenceThreshold);
  }

  generateCacheKey(text, options) {
    const key = `${text}:${options.dialect || 'bokmål'}:${options.model || this.config.model}`;
    return this.hashString(key);
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  async analyzeWithGpt(text, options = {}) {
    const processedText = this.preprocessText(text);
    const startTime = Date.now();
    const requestId = uuidv4();

    if (options.batch !== false && this.shouldBatch()) {
      return this.queueForBatch(requestId, processedText, options);
    }
    
    try {
      this.requestsInFlight++;
      this.stats.apiCalls++;
      const messages = this.createGrammarPrompt(processedText, options);
      
      // Use the NLPService adapter for the OpenAI call
      const response = await this.nlpService.createChatCompletion({
        model: options.model || this.config.model,
        messages,
        temperature: options.temperature || 0.2,
        max_tokens: options.max_tokens || 1000,
        top_p: 0.95,
        frequency_penalty: 0,
        presence_penalty: 0,
        apiKey: options.apiKey || this.config.apiKey
      });
      
      const results = this.extractGrammarResults(response, text);
      const duration = Date.now() - startTime;
      this.updateResponseTimeStats(duration);
      return results;
    } catch (error) {
      console.error('Error in GPT grammar analysis:', error);
      this.stats.errors++;
      return { issues: [], error: error.message };
    } finally {
      this.requestsInFlight--;
    }
  }

  createGrammarPrompt(text, options) {
    const dialect = options.dialect || 'bokmål';
    return [
      {
        role: 'system',
        content: `Du er en ekspert i norsk grammatikk (${dialect}). Analyser teksten for grammatikkfeil og gi konkrete forslag til forbedringer. Returner resultatet som et JSON-array med objekter som inkluderer: type, position, issue, suggestion, explanation, confidence, severity, and optional.`
      },
      {
        role: 'user',
        content: text
      }
    ];
  }

  extractGrammarResults(response, originalText) {
    try {
      const content = response.choices[0].message.content.trim();
      let issues = [];
      try {
        issues = JSON.parse(content);
      } catch (parseError) {
        const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
        if (jsonMatch) {
          issues = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Failed to parse GPT response as JSON');
        }
      }
      if (!Array.isArray(issues)) issues = [issues];
      issues = issues.filter(issue => issue && issue.type && issue.issue && issue.suggestion)
                       .map(issue => ({
                         type: issue.type,
                         position: issue.position ? (Array.isArray(issue.position) ? issue.position[0] : issue.position) : 0,
                         issue: issue.issue,
                         suggestion: issue.suggestion,
                         explanation: issue.explanation || 'Grammatisk feil oppdaget',
                         confidenceScore: issue.confidence || 0.8,
                         severity: issue.severity || 'medium',
                         optional: !!issue.optional,
                         source: 'gpt'
                       }));
      return { issues, totalIssues: issues.length, model: response.model, source: 'gpt' };
    } catch (error) {
      console.error('Error extracting GPT grammar results:', error);
      console.log('API response:', response);
      return { issues: [], error: error.message };
    }
  }

  mergeResults(ruleBasedResults, gptResults, options = {}) {
    const threshold = options.mergeThreshold || 0.75;
    const merged = [...(ruleBasedResults.issues || [])];
    const rbIssues = new Set(merged.map(issue => `${issue.type}-${issue.position}-${issue.issue}`));
    
    // Add GPT issues that don't overlap with rule-based issues
    (gptResults.issues || []).forEach(gptIssue => {
      const key = `${gptIssue.type}-${gptIssue.position}-${gptIssue.issue}`;
      const rbIssue = merged.find(i => `${i.type}-${i.position}-${i.issue}` === key);
      
      if (rbIssue) {
        // Increase confidence of rule-based issue if GPT also found it
        if ((rbIssue.confidenceScore || 0) < threshold) {
          rbIssue.confidenceScore = Math.min(1.0, (rbIssue.confidenceScore || 0.5) + 0.15);
        }
      } else {
        if ((gptIssue.confidenceScore || 0) >= threshold) {
          merged.push(gptIssue);
        }
      }
    });
    
    merged.sort((a, b) => (a.position || 0) - (b.position || 0));
    return { issues: merged, totalIssues: merged.length, commonErrors: this.categorizeErrors(merged), hybridAnalysis: true, sources: ['rule-based', 'gpt'] };
  }

  categorizeErrors(issues) {
    const categories = {};
    issues.forEach(issue => {
      const type = issue.type || 'unknown';
      categories[type] = (categories[type] || 0) + 1;
    });
    return categories;
  }

  preprocessText(text) {
    if (!text) return '';
    if (text.length > this.config.maxContextLength) {
      return text.substring(0, this.config.maxContextLength) + '... [teksten fortsetter]';
    }
    return text;
  }

  shouldBatch() {
    return this.pendingBatches.size > 0 && this.requestsInFlight < this.maxConcurrentRequests / 2;
  }

  queueForBatch(requestId, text, options) {
    return new Promise((resolve, reject) => {
      const batch = this.findOrCreateBatch(text.length, options);
      batch.requests.push({text, options, resolve, reject});
      
      if (batch.requests.length >= this.config.maxBatchSize) {
        const batchKey = [...this.pendingBatches.entries()]
          .find(([key, val]) => val === batch)?.[0];
        if (batchKey) {
          this.processBatch(batchKey);
        }
      }
    });
  }

  findOrCreateBatch(textLength, options) {
    // Find an existing batch with similar options and available capacity
    for (const [key, batch] of this.pendingBatches.entries()) {
      if (batch.requests.length < this.config.maxBatchSize &&
          batch.totalLength + textLength <= this.config.maxContextLength &&
          batch.dialect === (options.dialect || 'bokmål') &&
          batch.model === (options.model || this.config.model)) {
        batch.totalLength += textLength;
        return batch;
      }
    }
    
    // Create a new batch
    const newBatch = {
      requests: [],
      totalLength: 0,
      dialect: options.dialect || 'bokmål',
      model: options.model || this.config.model,
      timestamp: Date.now()
    };
    
    const batchKey = `batch-${uuidv4()}`;
    this.pendingBatches.set(batchKey, newBatch);
    
    // Schedule processing
    setTimeout(() => this.processBatch(batchKey), 200);
    
    return newBatch;
  }

  async processBatch(batchKey) {
    if (!this.pendingBatches.has(batchKey)) return;
    const batch = this.pendingBatches.get(batchKey);
    this.pendingBatches.delete(batchKey);
    for (const request of batch.requests) {
      try {
        const result = await this.analyzeWithGpt(request.text, { ...request.options, batch: false });
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }
    }
  }

  updateResponseTimeStats(duration) {
    const n = this.stats.apiCalls;
    const oldAvg = this.stats.avgResponseTime;
    this.stats.avgResponseTime = oldAvg + (duration - oldAvg) / n;
  }

  getStatistics() {
    return { ...this.stats, cacheSize: this.cache.size, pendingBatches: this.pendingBatches.size, requestsInFlight: this.requestsInFlight };
  }

  clearCache() {
    this.cache.clear();
    console.log('GPT grammar service cache cleared');
  }
}

module.exports = GptGrammarService;
