// src/grammar/helpers/norwegianGrammarUpdater.js
const Redis = require('ioredis');
const redis = new Redis();

class NorwegianGrammarUpdater {
  /**
   * Update word frequency.
   * @param {string} word
   * @param {number} increment
   */
  static async updateWordFrequency(word, increment = 1) {
    if (!word) return;
    await redis.hincrby('norsk:word_frequencies', word.toLowerCase(), increment);
  }

  /**
   * Update or add inflection data.
   * @param {string} baseWord - The lemma.
   * @param {object} inflectionInfo - e.g., { tense: 'past', form: 'spiste', valid: true }
   */
  static async updateInflectionData(baseWord, inflectionInfo) {
    if (!baseWord || !inflectionInfo) return;
    const key = 'norsk:inflections';
    let existing = await redis.hget(key, baseWord.toLowerCase());
    let inflections = existing ? JSON.parse(existing) : [];
    const index = inflections.findIndex(inf => inf.form === inflectionInfo.form);
    if (index !== -1) {
      inflections[index] = { ...inflections[index], ...inflectionInfo };
    } else {
      inflections.push(inflectionInfo);
    }
    await redis.hset(key, baseWord.toLowerCase(), JSON.stringify(inflections));
  }

  /**
   * Update compound word analysis.
   * @param {string} compound
   * @param {object} compoundData - e.g., { forledd: "øyen", fuge: " ", etterledd: "vippe" }
   */
  static async updateCompoundAnalysis(compound, compoundData) {
    if (!compound || !compoundData) return;
    await redis.hset('norsk:compound_words', compound.toLowerCase(), JSON.stringify(compoundData));
  }

  /**
   * Update gender data for a lemma.
   * @param {string} lemma
   * @param {string} gender - "Fem", "Masc", or "Neut"
   */
  static async updateGenderData(lemma, gender) {
    if (!lemma || !gender) return;
    await redis.hset('norsk:gender', lemma.toLowerCase(), gender);
  }

  /**
   * Record an invalid word form and its correction.
   * @param {string} wrongForm
   * @param {string} correctForm
   * @param {object} context
   */
  static async recordInvalidForm(wrongForm, correctForm, context = {}) {
    if (!wrongForm || !correctForm) return;
    const key = 'norsk:common_errors';
    const errorData = { wrong: wrongForm, correct: correctForm, ...context };
    await redis.rpush(key, JSON.stringify(errorData));
  }
}

module.exports = NorwegianGrammarUpdater;
