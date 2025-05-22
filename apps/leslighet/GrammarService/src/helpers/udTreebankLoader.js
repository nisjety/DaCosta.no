// src/grammar/helpers/udTreebankLoader.js
const Redis = require("ioredis");
const redis = new Redis();

/**
 * Retrieves gender for a lemma from Redis.
 * @param {string} lemma - The lemma to look up.
 * @returns {Promise<string|null>} - "Fem", "Masc", "Neut" or null.
 */
async function getGender(lemma) {
  if (!lemma) return null;
  return await redis.hget("norsk:gender", lemma.toLowerCase());
}

/**
 * Checks if a lemma is feminine.
 * @param {string} lemma - The lemma to check.
 * @returns {Promise<boolean>}
 */
async function isFeminine(lemma) {
  const gender = await getGender(lemma);
  return gender === "Fem";
}

module.exports = { getGender, isFeminine };
