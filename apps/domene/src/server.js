// src/server.js
// Simple static file server for the frontend

const express = require('express');
const path = require('path');
const logger = require('./utils/logger');

/**
 * Setup static file server for the frontend
 * @param {Express} app - Express application instance
 */
function setupStaticServer(app) {
  // Serve static files from the public directory
  const publicDir = path.join(process.cwd(), 'public');
  
  app.use(express.static(publicDir));
  
  // Serve index.html for all routes for SPA support
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
  
  logger.info(`Static file server configured: ${publicDir}`);
}

module.exports = { setupStaticServer };