/**
 * Liar Game word utility – loads CSV and provides random word by category.
 * Used when 방식 is "랜덤".
 */
const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, 'data', 'liar_words.csv');

// In-memory cache: { category: [word1, word2, ...] }
let wordsByCategory = null;

function loadWords() {
  if (wordsByCategory) return wordsByCategory;
  try {
    const content = fs.readFileSync(CSV_PATH, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    wordsByCategory = {};
    for (let i = 1; i < lines.length; i++) {
      const [category, word] = lines[i].split(',').map(s => (s || '').trim());
      if (category && word) {
        if (!wordsByCategory[category]) wordsByCategory[category] = [];
        wordsByCategory[category].push(word);
      }
    }
    return wordsByCategory;
  } catch (err) {
    console.error('Failed to load liar words CSV:', err.message);
    return {};
  }
}

/**
 * Get a random word for the given category.
 * @param {string} category - One of: 물건, 동물, 스포츠, 요리, 장소, 직업, 국가, 인물, 영화, 드라마, 과일, 채소
 * @returns {string|null} Random word or null if category has no words
 */
function getRandomWord(category) {
  const words = loadWords()[category];
  if (!words || words.length === 0) return null;
  return words[Math.floor(Math.random() * words.length)];
}

/**
 * Get all supported categories (from CSV).
 */
function getCategories() {
  return Object.keys(loadWords());
}

module.exports = { getRandomWord, getCategories, loadWords };
