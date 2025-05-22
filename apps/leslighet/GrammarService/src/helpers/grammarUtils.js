// src/grammar/helpers/grammarUtils.js
const Redis = require("ioredis");
const redis = new Redis();

/**
 * Check for double spaces in text.
 * @param {string} text
 * @returns {Array<Object>}
 */
function checkDoubleSpaces(text) {
  if (!text) return [];
  const issues = [];
  const regex = /\s{2,}/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    issues.push({
      type: "spacing",
      issue: "Dobbelt mellomrom",
      position: match.index,
      suggestion: " "
    });
  }
  return issues;
}

/**
 * Check punctuation usage in text.
 * @param {string} text
 * @returns {Array<Object>}
 */
function checkPunctuationUsage(text) {
  if (!text) return [];
  const issues = [];
  const regex = /(\w+)\s+(og|men|eller)\s+(\w+)/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    issues.push({
      type: "punctuation",
      issue: match[0],
      suggestion: `${match[1]}, ${match[2]} ${match[3]}`
    });
  }
  return issues;
}

/**
 * Convert a definite noun to its indefinite form.
 * @param {string} word
 * @returns {string}
 */
function getIndefiniteForm(word) {
  if (!word) return '';
  if (word.endsWith("ene")) return word.slice(0, -3);
  if (word.endsWith("en") || word.endsWith("et")) return word.slice(0, -2);
  if (word.endsWith("a")) return word.slice(0, -1);
  return word;
}

/**
 * Infer part-of-speech for a word using live grammar data from Redis.
 * Queries the Redis hash "norsk:grammar" for advanced POS tagging.
 * @param {string} word
 * @returns {Promise<string>} POS tag or "UNKNOWN"
 */
async function inferPartOfSpeech(word) {
  if (!word) return "UNKNOWN";
  const pos = await redis.hget("norsk:grammar", word.toLowerCase());
  return pos || "UNKNOWN";
}

module.exports = {
  checkDoubleSpaces,
  checkPunctuationUsage,
  getIndefiniteForm,
  inferPartOfSpeech
};
