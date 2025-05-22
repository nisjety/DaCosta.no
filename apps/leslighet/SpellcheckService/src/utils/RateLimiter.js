// src/utils/RateLimiter.js

/**
 * Simple in-memory rate limiter for API endpoints
 */
class RateLimiter {
    /**
     * Create a new rate limiter
     * @param {Object} options Configuration options
     * @param {Number} options.windowMs Time window in milliseconds
     * @param {Number} options.maxRequests Maximum requests per window
     * @param {String} options.message Error message
     * @param {Function} options.keyGenerator Function to generate keys
     */
    constructor(options = {}) {
      this.windowMs = options.windowMs || 60000; // Default: 1 minute
      this.maxRequests = options.maxRequests || 100; // Default: 100 requests per minute
      this.message = options.message || 'Too many requests, please try again later';
      this.keyGenerator = options.keyGenerator || ((req) => req.ip);
      
      // Store for request counts
      this.requests = new Map();
      
      // Start cleanup timer
      this.cleanupInterval = setInterval(() => this.cleanup(), this.windowMs);
    }
    
    /**
     * Check if request should be allowed
     * @returns {Function} Express middleware
     */
    check() {
      return (req, res, next) => {
        const key = this.keyGenerator(req);
        const now = Date.now();
        
        // Initialize or get existing record
        let requestRecord = this.requests.get(key);
        
        if (!requestRecord) {
          requestRecord = {
            count: 0,
            resetTime: now + this.windowMs
          };
          this.requests.set(key, requestRecord);
        }
        
        // Check if window has expired and reset if needed
        if (now > requestRecord.resetTime) {
          requestRecord.count = 0;
          requestRecord.resetTime = now + this.windowMs;
        }
        
        // Check limit
        if (requestRecord.count >= this.maxRequests) {
          return res.status(429).json({
            error: this.message,
            status: 'error',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil((requestRecord.resetTime - now) / 1000)
          });
        }
        
        // Increment request count
        requestRecord.count++;
        
        // Add rate limit headers
        res.setHeader('X-RateLimit-Limit', this.maxRequests);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, this.maxRequests - requestRecord.count));
        res.setHeader('X-RateLimit-Reset', Math.ceil(requestRecord.resetTime / 1000));
        
        next();
      };
    }
    
    /**
     * Remove expired entries to prevent memory leaks
     */
    cleanup() {
      const now = Date.now();
      
      for (const [key, record] of this.requests.entries()) {
        if (now > record.resetTime) {
          this.requests.delete(key);
        }
      }
    }
    
    /**
     * Stop cleanup timer
     */
    close() {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }
      this.requests.clear();
    }
  }
  
  module.exports = { RateLimiter };