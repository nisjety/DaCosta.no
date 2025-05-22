// src/grammar/helpers/tsvParser.js
//(This module is retained mainly for initial data load and won’t be used in the live system.)

const fs = require('fs');
const readline = require('readline');

async function parseTSV(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`TSV file not found: ${filePath}`);
    return [];
  }

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream });
  let header = null;
  const rows = [];

  for await (const line of rl) {
    if (!header) {
      header = line.split('\t');
      continue;
    }
    const parts = line.split('\t');
    const row = Object.fromEntries(header.map((key, i) => [key, parts[i] ? parts[i].trim() : '']));
    rows.push(row);
  }
  return rows;
}

module.exports = { parseTSV };

