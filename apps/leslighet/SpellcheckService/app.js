// app.js
// Load environment variables first
const loadEnv = require('./src/config/loadEnv');
loadEnv();

const express = require('express');
const path = require('path');
const logger = require('./src/utils/logger');
const spellRoutes = require('./src/routes/spellRoutes');
const wordManagementRoutes = require('./src/routes/wordManagementRoutes');
const { authenticate } = require('./src/middleware/authMidlewares');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS handling for API requests
if (process.env.CORS_ENABLED === 'true') {
  const cors = require('cors');
  const corsOptions = {
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
    credentials: true
  };
  app.use('/api', cors(corsOptions));
  logger.info(`CORS enabled for origins: ${corsOptions.origin}`);
}

// Serve static files
app.use(express.static(path.join(__dirname, 'src/public')));

// API routes - maintain both /api/spell and /api/v1 paths for backward compatibility
app.use('/api/spell', spellRoutes);
app.use('/api/v1', spellRoutes); // Add v1 namespace for compatibility with client
app.use('/api/words', wordManagementRoutes);

// Admin panel route
app.get('/admin', authenticate, (req, res) => {
  res.sendFile(path.join(__dirname, 'src/public/admin.html'));
});

// Default route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/public/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).send('Something broke!');
});

module.exports = app;