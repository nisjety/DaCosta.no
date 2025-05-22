// src/services/redis-dictionary.js
/**
 * This file re-exports the RedisDictionary class from the repositories directory
 * for backward compatibility with tests and other code that imports it from here.
 */

const RedisDictionary = require('../repositories/RedisDictionary');

module.exports = {
  RedisDictionary
};