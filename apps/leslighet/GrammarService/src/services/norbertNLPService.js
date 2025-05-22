//src/grammer/services/norbertNLPService.js
const { spawn } = require('child_process');
const path = require('path');

/**
 * Uses the Python NLP service (nlp_service.py) to perform robust tokenization,
 * POS tagging, lemmatization, and dependency parsing.
 * @param {string} text - The input text.
 * @returns {Promise<Array>} - A promise that resolves with an array of token objects.
 */
function robustTokenize(text) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../models/nlp_service.py');
    const child = spawn('python3', [scriptPath, text]);
    let data = '';
    let errorData = '';
    child.stdout.on('data', chunk => { data += chunk.toString(); });
    child.stderr.on('data', chunk => { errorData += chunk.toString(); });
    child.on('close', code => {
      if (code !== 0) {
        return reject(new Error(`nlp_service.py exited with code ${code}: ${errorData}`));
      }
      try {
        const tokens = JSON.parse(data.trim());
        resolve(tokens);
      } catch (err) {
        reject(err);
      }
    });
  });
}

module.exports = { robustTokenize };
