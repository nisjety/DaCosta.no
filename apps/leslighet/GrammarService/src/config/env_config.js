/**
 * Environment configuration loader
 * Loads environment variables from .env file and validates them
 */

// Safely try to import dotenv - won't crash if module is missing
let dotenv;
try {
  dotenv = require('dotenv');
  const path = require('path');
  const fs = require('fs');
  
  // Define the path to the .env file
  const envPath = path.resolve(process.cwd(), '.env');

  // Check if .env exists and load it
  const envFileExists = fs.existsSync(envPath);
  if (envFileExists) {
    const result = dotenv.config({ path: envPath });
    
    if (result.error) {
      console.error('Error loading .env file:', result.error);
    } else {
      console.log(`Environment variables loaded from ${envPath}`);
    }
  } else {
    console.warn(`.env file not found at ${envPath}. Using default environment variables.`);
  }
} catch (error) {
  console.warn('dotenv module not available. Using environment variables directly.');
  console.warn('Install dotenv with: npm install dotenv --save');
}

// Environment configuration object with defaults
const envConfig = {
  // Server configuration
  app: {
    port: parseInt(process.env.APP_PORT || '3000', 10),
    host: process.env.APP_HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development',
  },
  
  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

// Function to validate required environment variables
const validateEnv = () => {
  const requiredVars = [
    'APP_PORT',
    'APP_HOST',
    // Add other required variables here
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn(`Missing recommended environment variables: ${missingVars.join(', ')}`);
    console.warn('Using default values instead.');
  }
  
  return missingVars.length === 0;
};

// Validate environment variables
const isValid = validateEnv();

module.exports = {
  envConfig,
  isValid,
};