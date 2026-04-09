const words = require('../data/words_tw.json');
const logger = require('../utils/logger');

/**
 * Pick a random word pair that hasn't been used yet.
 * Returns { civilianWord, spyWord, wordId } or null if all pairs exhausted.
 */
function pickWordPair(usedWordIds = []) {
  const available = words.filter((w) => !usedWordIds.includes(w.id));
  if (available.length === 0) return null;

  const chosen = available[Math.floor(Math.random() * available.length)];

  // 50/50 chance which word is civilian vs spy
  const flip = Math.random() < 0.5;
  return {
    civilianWord: flip ? chosen.wordA : chosen.wordB,
    spyWord: flip ? chosen.wordB : chosen.wordA,
    wordId: chosen.id,
    category: chosen.category,
  };
}

module.exports = { pickWordPair };
