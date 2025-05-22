// src/services/AuthService.js
const jwt = require('jsonwebtoken');
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');

class AuthService {
  constructor() {
    this.isEnabled = process.env.AUTH_ENABLED === 'true';
    this.jwtSecret = process.env.AUTH_JWT_SECRET || 'default-jwt-secret-key-please-change';
    this.jwtExpiration = parseInt(process.env.AUTH_JWT_EXPIRATION || '86400');
    
    // Parse public routes that don't require authentication
    this.publicRoutes = (process.env.AUTH_PUBLIC_ROUTES || '/api/v1/health,/health')
      .split(',')
      .map(route => route.trim());
    
    // Initialize Redis client for token management
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'redis',
      port: process.env.REDIS_PORT || 6369,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB || 0,
    });
    
    // Cache for verified tokens to reduce verification overhead
    this.tokenCache = new Map();
    
    // Log initialization status
    if (this.isEnabled) {
      console.log('Auth service enabled');
      console.log(`Public routes: ${this.publicRoutes.join(', ')}`);
    } else {
      console.log('Auth service disabled. Set AUTH_ENABLED=true to enable.');
    }
  }
  
  /**
   * Verify JWT token
   * @param {string} token JWT token to verify
   * @returns {Promise<Object|null>} Decoded token payload or null if invalid
   */
  async verifyToken(token) {
    if (!token || !this.isEnabled) return null;
    
    try {
      // Check token cache first
      if (this.tokenCache.has(token)) {
        const cachedToken = this.tokenCache.get(token);
        const now = Math.floor(Date.now() / 1000);
        
        // Return cached token if not expired
        if (cachedToken.exp > now) {
          return cachedToken;
        }
        
        // Remove expired token from cache
        this.tokenCache.delete(token);
      }
      
      // Verify token
      const decoded = jwt.verify(token, this.jwtSecret);
      
      // Cache token for future use
      this.tokenCache.set(token, decoded);
      
      return decoded;
    } catch (error) {
      console.error('Token verification error:', error.message);
      return null;
    }
  }
  
  /**
   * Decode JWT token without verification (for inspection only)
   * @param {string} token JWT token
   * @returns {Object|null} Decoded token payload or null
   */
  decodeToken(token) {
    if (!token) return null;
    
    try {
      return jwt.decode(token);
    } catch (error) {
      console.error('Token decode error:', error.message);
      return null;
    }
  }
  
  /**
   * Extract token from various places in the request
   * @param {Object} req Express request object
   * @returns {string|null} JWT token or null
   */
  extractToken(req) {
    if (!req) return null;
    
    // From Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // From query string
    if (req.query && req.query.token) {
      return req.query.token;
    }
    
    // From cookie
    if (req.cookies && req.cookies.token) {
      return req.cookies.token;
    }
    
    return null;
  }
  
  /**
   * Check if a route is public (doesn't require authentication)
   * @param {string} path Request path
   * @returns {boolean} True if route is public
   */
  isPublicRoute(path) {
    if (!this.isEnabled) return true;
    
    return this.publicRoutes.some(route => {
      // Exact match
      if (route === path) return true;
      
      // Path with wildcard
      if (route.endsWith('*')) {
        const baseRoute = route.slice(0, -1);
        return path.startsWith(baseRoute);
      }
      
      return false;
    });
  }
  
  /**
   * Create an authentication middleware for Express routes
   * @returns {Function} Express middleware
   */
  authMiddleware() {
    return async (req, res, next) => {
      // Skip auth if disabled or public route
      if (!this.isEnabled || this.isPublicRoute(req.path)) {
        return next();
      }
      
      try {
        // Extract token
        const token = this.extractToken(req);
        if (!token) {
          return res.status(401).json({
            error: 'Authentication required',
            status: 'error',
            code: 'AUTH_REQUIRED'
          });
        }
        
        // Verify token
        const decodedToken = await this.verifyToken(token);
        if (!decodedToken) {
          return res.status(401).json({
            error: 'Invalid or expired token',
            status: 'error',
            code: 'INVALID_TOKEN'
          });
        }
        
        // Add user info to request
        req.user = {
          id: decodedToken.sub || decodedToken.userId,
          email: decodedToken.email,
          roles: decodedToken.roles || [],
          permissions: decodedToken.permissions || []
        };
        
        next();
      } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({
          error: 'Authentication error',
          status: 'error',
          code: 'AUTH_ERROR'
        });
      }
    };
  }
  
  /**
   * Create test token for development purposes
   * @param {Object} userData User data to include in token
   * @returns {string} JWT token
   */
  createTestToken(userData = {}) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('Creating test tokens is not allowed in production');
      return null;
    }
    
    const payload = {
      sub: userData.userId || uuidv4(),
      email: userData.email || 'test@example.com',
      roles: userData.roles || ['user'],
      permissions: userData.permissions || ['spell-check:basic'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.jwtExpiration
    };
    
    return jwt.sign(payload, this.jwtSecret);
  }
  
  /**
   * Close connections
   */
  async close() {
    try {
      if (this.redis) {
        await this.redis.quit();
      }
      this.tokenCache.clear();
      console.log('Auth service connections closed');
    } catch (error) {
      console.error('Error closing auth service connections:', error);
    }
  }
}

module.exports = AuthService;