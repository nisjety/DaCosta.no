// src/routes/spellRoutes.js
const express = require("express");
const NorwegianSpellChecker = require("../services/NorwegianSpellChecker");
const EnglishSpellChecker = require("../services/EnglishSpellChecker");

const router = express.Router();

// Split routes to support selective authentication
const publicRouter = express.Router();
const protectedRouter = express.Router();

/**
 * Health check endpoint
 */
publicRouter.get(["/health", "/v1/health"], (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      norwegian: {
        ready: NorwegianSpellChecker.dictionaryLoaded ? Object.values(NorwegianSpellChecker.dictionaryLoaded).some(Boolean) : false,
        dialects: NorwegianSpellChecker.getEnabledDialects ? NorwegianSpellChecker.getEnabledDialects() : []
      },
      english: {
        ready: EnglishSpellChecker.dictionaryLoaded ? Object.values(EnglishSpellChecker.dictionaryLoaded).some(Boolean) : false,
        dialects: EnglishSpellChecker.getEnabledDialects ? EnglishSpellChecker.getEnabledDialects() : []
      }
    }
  });
});

// Register public router routes with the main router
router.use('/', publicRouter);

// Use this health check as a backup
router.get('/health', (req, res) => {
  try {
    // Get detailed stats if requested
    const detailed = req.query.detailed === 'true';
    
    const baseResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        norwegian: {
          ready: NorwegianSpellChecker.dictionaryLoaded ? Object.values(NorwegianSpellChecker.dictionaryLoaded).some(Boolean) : false,
          dialects: NorwegianSpellChecker.getEnabledDialects ? NorwegianSpellChecker.getEnabledDialects() : []
        },
        english: {
          ready: EnglishSpellChecker.dictionaryLoaded ? Object.values(EnglishSpellChecker.dictionaryLoaded).some(Boolean) : false,
          dialects: EnglishSpellChecker.getEnabledDialects ? EnglishSpellChecker.getEnabledDialects() : []
        }
      }
    };
    
    // Add detailed stats if requested
    if (detailed) {
      baseResponse.stats = {
        norwegian: NorwegianSpellChecker.getStats ? NorwegianSpellChecker.getStats() : {},
        english: EnglishSpellChecker.getStats ? EnglishSpellChecker.getStats() : {}
      };
    }
    
    res.json(baseResponse);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Generic spell check endpoint that determines language from request
 * This is the main endpoint used by the gateway
 */
router.post("/check", async (req, res) => {
  try {
    const { text, language = 'norwegian', dialectSettings } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: "Missing 'text' in body" });
    }
    
    // Select the appropriate spellchecker based on language
    const spellChecker = language === 'english' ? EnglishSpellChecker : NorwegianSpellChecker;
    
    // Apply dialect settings if provided
    if (dialectSettings) {
      spellChecker.setDialects(dialectSettings);
    }
    
    const result = await spellChecker.checkText(text);
    res.json({
      ...result,
      language,
      dialectSettings: spellChecker.dialectSettings,
      status: 'success',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error(`Error in generic /check: ${err}`);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * Norwegian Spell Check
 */
router.post("/norwegian/spell", async (req, res) => {
  try {
    const { word } = req.body;
    if (!word) {
      return res.status(400).json({ error: "Missing 'word' in body" });
    }

    const result = await NorwegianSpellChecker.checkWord(word);
    res.json({
      ...result,
      status: 'success',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error in Norwegian /spell:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * Norwegian text check
 */
router.post("/norwegian/check-text", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Missing 'text' in body" });
    }

    const result = await NorwegianSpellChecker.checkText(text);
    res.json({
      ...result,
      status: 'success',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error in Norwegian /check-text:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * Norwegian Hyphenation
 */
router.post("/norwegian/hyphenate", async (req, res) => {
  try {
    const { word } = req.body;
    if (!word) {
      return res.status(400).json({ error: "Missing 'word' in body" });
    }

    const result = await NorwegianSpellChecker.hyphenateWord(word);
    res.json({
      ...result,
      status: 'success',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error in Norwegian /hyphenate:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * Norwegian Synonyms
 */
router.post("/norwegian/synonyms", async (req, res) => {
  try {
    const { word } = req.body;
    if (!word) {
      return res.status(400).json({ error: "Missing 'word' in body" });
    }

    const result = await NorwegianSpellChecker.getSynonyms(word);
    res.json({
      ...result,
      status: 'success',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error in Norwegian /synonyms:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * Norwegian dialect settings
 */
router.post("/norwegian/settings", async (req, res) => {
  try {
    const { dialects } = req.body;
    if (!dialects) {
      return res.status(400).json({ error: "Missing 'dialects' in body" });
    }

    const success = NorwegianSpellChecker.setDialects(dialects);
    res.json({
      success,
      dialectSettings: NorwegianSpellChecker.dialectSettings,
      status: 'success',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error in Norwegian /settings:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * English Spell Check
 */
const englishSpell = express.Router();
englishSpell.post("/", async (req, res) => {
  try {
    const { word } = req.body;
    if (!word) {
      return res.status(400).json({ error: "Missing 'word' in body" });
    }

    const result = await EnglishSpellChecker.checkWord(word);
    res.json({
      ...result,
      status: 'success',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error in English /spell:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * English text check
 */
const englishCheckText = express.Router();
englishCheckText.post("/", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Missing 'text' in body" });
    }

    const result = await EnglishSpellChecker.checkText(text);
    res.json({
      ...result,
      status: 'success',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error in English /check-text:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Add to both routers
router.post("/english/spell", englishSpell);
router.post("/english/check-text", englishCheckText);

/**
 * English Hyphenation
 */
router.post("/english/hyphenate", async (req, res) => {
  try {
    const { word } = req.body;
    if (!word) {
      return res.status(400).json({ error: "Missing 'word' in body" });
    }

    const result = await EnglishSpellChecker.hyphenateWord(word);
    res.json({
      ...result,
      status: 'success',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error in English /hyphenate:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * English Synonyms
 */
router.post("/english/synonyms", async (req, res) => {
  try {
    const { word } = req.body;
    if (!word) {
      return res.status(400).json({ error: "Missing 'word' in body" });
    }

    const result = await EnglishSpellChecker.getSynonyms(word);
    res.json({
      ...result,
      status: 'success',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error in English /synonyms:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * Health check endpoint with detailed statistics
 */
router.get("/health", (req, res) => {
  // Get detailed stats if requested
  const detailed = req.query.detailed === 'true';
  
  const baseResponse = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      norwegian: {
        ready: NorwegianSpellChecker.dictionaryLoaded ? Object.values(NorwegianSpellChecker.dictionaryLoaded).some(Boolean) : false,
        dialects: NorwegianSpellChecker.getEnabledDialects ? NorwegianSpellChecker.getEnabledDialects() : []
      },
      english: {
        ready: EnglishSpellChecker.dictionaryLoaded ? Object.values(EnglishSpellChecker.dictionaryLoaded).some(Boolean) : false,
        dialects: EnglishSpellChecker.getEnabledDialects ? EnglishSpellChecker.getEnabledDialects() : []
      }
    }
  };
  
  // Add detailed stats if requested
  if (detailed) {
    baseResponse.stats = {
      norwegian: NorwegianSpellChecker.getStats ? NorwegianSpellChecker.getStats() : {},
      english: EnglishSpellChecker.getStats ? EnglishSpellChecker.getStats() : {}
    };
  }
  
  res.json(baseResponse);
});

/**
 * English dialect variations
 */
router.post("/english/dialect-variations", async (req, res) => {
  try {
    const { word } = req.body;
    if (!word) {
      return res.status(400).json({ error: "Missing 'word' in body" });
    }

    const result = await EnglishSpellChecker.getDialectVariations(word);
    res.json({
      ...result,
      status: 'success',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error in English /dialect-variations:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * English dialect settings
 */
router.post("/english/settings", async (req, res) => {
  try {
    const { dialects } = req.body;
    if (!dialects) {
      return res.status(400).json({ error: "Missing 'dialects' in body" });
    }

    const success = EnglishSpellChecker.setDialects(dialects);
    res.json({
      success,
      dialectSettings: EnglishSpellChecker.dialectSettings,
      status: 'success',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error in English /settings:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * User information endpoint (requires authentication)
 */
router.get("/user", (req, res) => {
  // This route will only be accessible if authentication is successful
  // req.user is added by the authentication middleware
  res.json({
    user: {
      id: req.user.id,
      roles: req.user.roles || ['user'],
      permissions: req.user.permissions || []
    },
    status: 'success',
    timestamp: new Date().toISOString()
  });
});

// Export both complete router and individual route handlers
module.exports = router;
module.exports.englishSpell = englishSpell;
module.exports.englishCheckText = englishCheckText;
module.exports.protectedRoutes = router;