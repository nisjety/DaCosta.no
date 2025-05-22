// src/grammar/helpers/norwegianDictionary.js
const Redis = require("ioredis");
const redis = new Redis();

/**
 * Looks up a word in the dictionary.
 * The dictionary is stored in Redis hash "norsk:fullforms".
 * 
 * We assume that each stored value is a TSV string and that the lemma (normalized form)
 * is stored in the third column (index 2).
 * 
 * @param {string} word - The word to lookup.
 * @returns {Promise<Object|null>} - An object with a property fullForms (an array) or null.
 */
async function lookup(word) {
  if (!word) return null;
  // Remove trailing punctuation for a clean lookup
  const cleanWord = word.replace(/[.,!?;:]+$/, '').toLowerCase();
  
  const result = await redis.hget("norsk:fullforms", cleanWord);
  if (result) {
    const columns = result.split("\t");
    // We assume that column index 2 (third field) is the normalized lemma.
    const normering = columns[2] || cleanWord;
    return {
      fullForms: [{ normering }]
    };
  }
  return null;
}

/**
 * Records usage of a word to update its frequency.
 * @param {string} word - The word.
 * @param {number} count - The increment (default 1).
 */
async function recordWordUsage(word, count = 1) {
  if (!word) return;
  await redis.hincrby("norsk:word_frequencies", word.toLowerCase(), count);
}

/**
 * Records processed text for frequency updates.
 * Splits text into words and increments their frequency.
 * @param {string} text - The text to process.
 */
async function recordTextProcessed(text) {
  if (!text) return;
  const words = text.split(/\s+/)
    .map(w => w.replace(/[^\wæøåÆØÅ]/g, ''))
    .filter(w => w.length > 1);
  for (const word of words) {
    await recordWordUsage(word, 1);
  }
}

/**
 * Processes user feedback to improve dictionary data.
 * @param {object} feedbackData - E.g., { action: 'accept', suggestion: 'går' }.
 */
async function processFeedback(feedbackData) {
  if (!feedbackData || !feedbackData.action) return;
  if (feedbackData.action === 'accept' && feedbackData.suggestion) {
    await recordWordUsage(feedbackData.suggestion, 2);
  }
  if (feedbackData.action === 'modify' && feedbackData.modification) {
    await recordWordUsage(feedbackData.modification, 3);
  }
}

module.exports = {
  lookup,
  recordWordUsage,
  recordTextProcessed,
  processFeedback
};
