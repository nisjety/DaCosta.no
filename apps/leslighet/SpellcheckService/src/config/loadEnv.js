// src/config/loadEnv.js
const path = require('path');
const fs = require('fs');

/**
 * Simple environment loader
 * You can replace this with dotenv when you install it
 */
function loadEnv() {
  // Default .env file path
  const envPath = path.resolve(process.cwd(), '.env');
  
  // Check if .env file exists
  if (fs.existsSync(envPath)) {
    console.log(`Loading environment from ${envPath}`);
    
    try {
      // Simple env file parser
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envLines = envContent.split('\n');
      
      envLines.forEach(line => {
        // Skip comments and empty lines
        if (line.startsWith('#') || !line.trim()) return;
        
        // Parse key=value pairs
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || '';
          
          // Remove quotes if they exist
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
          }
          
          // Set environment variable if not already set
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      });
      
    } catch (error) {
      console.error(`Error loading .env file: ${error.message}`);
    }
  } else {
    console.warn(`No .env file found at ${envPath}, using defaults and environment variables`);
  }
  
  // Set default values for required variables
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  process.env.REDIS_HOST = process.env.REDIS_HOST || 'redis';
  process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
  process.env.APP_PORT = process.env.APP_PORT || '5002';
  
  // Log the current environment
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`API running on port: ${process.env.APP_PORT}`);
  console.log(`Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
}

module.exports = loadEnv;