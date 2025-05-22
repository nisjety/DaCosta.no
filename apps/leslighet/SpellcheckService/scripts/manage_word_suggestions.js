// scripts/manage_word_suggestions.js
require('../src/config/loadEnv')(); // Load environment variables
const feedbackManager = require('../utils/feedback_manager');
const customWords = require('../dictionary/customWords');
const readline = require('readline');

// Override Redis host to use localhost when running outside Docker
process.env.REDIS_HOST = 'localhost';

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Display a menu and get user choice
 * @returns {Promise<number>} Selected option
 */
function showMenu() {
  return new Promise((resolve) => {
    console.log('\n===== Word Suggestion Manager =====');
    console.log('1. List pending word suggestions');
    console.log('2. Approve a word');
    console.log('3. Reject a word');
    console.log('4. Show statistics');
    console.log('5. Export custom words');
    console.log('6. Exit');
    console.log('==================================');
    
    rl.question('Select an option (1-6): ', (answer) => {
      const option = parseInt(answer, 10);
      if (isNaN(option) || option < 1 || option > 6) {
        console.log('Invalid option. Please try again.');
        return resolve(showMenu());
      }
      resolve(option);
    });
  });
}

/**
 * List pending word suggestions with details
 */
async function listPendingWords() {
  try {
    const pendingWords = await feedbackManager.getPendingWordSuggestions();
    
    if (pendingWords.length === 0) {
      console.log('No pending word suggestions found.');
      return;
    }
    
    console.log(`\nFound ${pendingWords.length} pending word suggestions:`);
    console.log('------------------------------------------------------');
    
    pendingWords.forEach((word, index) => {
      console.log(`${index + 1}. "${word.word}" (${word.language})`);
      console.log(`   Votes: ${word.votes} | Added: ${new Date(word.addedAt).toLocaleString()}`);
      console.log(`   Voters: ${word.voters.length} unique users`);
      if (word.notes) {
        console.log(`   Notes: ${word.notes}`);
      }
      console.log('------------------------------------------------------');
    });
  } catch (error) {
    console.error('Error listing pending words:', error);
  }
}

/**
 * Approve a pending word suggestion
 */
async function approveWord() {
  try {
    const pendingWords = await feedbackManager.getPendingWordSuggestions();
    
    if (pendingWords.length === 0) {
      console.log('No pending word suggestions to approve.');
      return;
    }
    
    // List words with numbers for selection
    console.log('\nSelect a word to approve:');
    pendingWords.forEach((word, index) => {
      console.log(`${index + 1}. "${word.word}" (${word.language}) - Votes: ${word.votes}`);
    });
    
    const answer = await new Promise((resolve) => {
      rl.question('\nEnter number or word to approve (0 to cancel): ', resolve);
    });
    
    if (answer === '0') {
      return;
    }
    
    let selectedWord;
    let language;
    
    // Check if input is a number (index) or a word
    const index = parseInt(answer, 10);
    if (!isNaN(index) && index > 0 && index <= pendingWords.length) {
      selectedWord = pendingWords[index - 1].word;
      language = pendingWords[index - 1].language;
    } else {
      // User entered a word directly
      const inputWord = answer.toLowerCase().trim();
      const foundWord = pendingWords.find(w => w.word === inputWord);
      
      if (!foundWord) {
        console.log(`Word "${inputWord}" not found in pending suggestions.`);
        return;
      }
      
      selectedWord = foundWord.word;
      language = foundWord.language;
    }
    
    // Get additional metadata
    const category = await new Promise((resolve) => {
      rl.question('Enter category (press Enter for "general"): ', (answer) => {
        resolve(answer.trim() || 'general');
      });
    });
    
    const notes = await new Promise((resolve) => {
      rl.question('Enter notes (optional): ', resolve);
    });
    
    // Approve the word
    console.log(`\nApproving word "${selectedWord}" in language "${language}"...`);
    
    const result = await feedbackManager.approveWordSuggestion(selectedWord, language, 'admin');
    
    if (result.success) {
      // Update metadata if provided
      if (category !== 'general' || notes) {
        const customWordInfo = await customWords.getCustomWordInfo(selectedWord, language);
        
        if (customWordInfo) {
          // Remove and re-add with updated metadata
          await customWords.removeCustomWord(selectedWord, language);
          await customWords.addCustomWord(selectedWord, language, {
            addedBy: 'admin',
            addedAt: new Date().toISOString(),
            category,
            notes: notes || customWordInfo.notes
          });
        }
      }
      
      console.log(`✅ Successfully approved "${selectedWord}"`);
    } else {
      console.log(`❌ Failed to approve "${selectedWord}": ${result.message}`);
    }
  } catch (error) {
    console.error('Error approving word:', error);
  }
}

/**
 * Reject a pending word suggestion
 */
async function rejectWord() {
  try {
    const pendingWords = await feedbackManager.getPendingWordSuggestions();
    
    if (pendingWords.length === 0) {
      console.log('No pending word suggestions to reject.');
      return;
    }
    
    // List words with numbers for selection
    console.log('\nSelect a word to reject:');
    pendingWords.forEach((word, index) => {
      console.log(`${index + 1}. "${word.word}" (${word.language}) - Votes: ${word.votes}`);
    });
    
    const answer = await new Promise((resolve) => {
      rl.question('\nEnter number or word to reject (0 to cancel): ', resolve);
    });
    
    if (answer === '0') {
      return;
    }
    
    let selectedWord;
    let language;
    
    // Check if input is a number (index) or a word
    const index = parseInt(answer, 10);
    if (!isNaN(index) && index > 0 && index <= pendingWords.length) {
      selectedWord = pendingWords[index - 1].word;
      language = pendingWords[index - 1].language;
    } else {
      // User entered a word directly
      const inputWord = answer.toLowerCase().trim();
      const foundWord = pendingWords.find(w => w.word === inputWord);
      
      if (!foundWord) {
        console.log(`Word "${inputWord}" not found in pending suggestions.`);
        return;
      }
      
      selectedWord = foundWord.word;
      language = foundWord.language;
    }
    
    // Get rejection reason
    const reason = await new Promise((resolve) => {
      rl.question('Enter reason for rejection (optional): ', resolve);
    });
    
    // Reject the word
    console.log(`\nRejecting word "${selectedWord}" in language "${language}"...`);
    
    const result = await feedbackManager.rejectWordSuggestion(
      selectedWord, 
      language, 
      'admin', 
      reason
    );
    
    if (result.success) {
      console.log(`✅ Successfully rejected "${selectedWord}"`);
    } else {
      console.log(`❌ Failed to reject "${selectedWord}": ${result.message}`);
    }
  } catch (error) {
    console.error('Error rejecting word:', error);
  }
}

/**
 * Show statistics about word suggestions
 */
async function showStats() {
  try {
    const stats = await feedbackManager.getWordSuggestionStats();
    
    console.log('\n===== Word Suggestion Statistics =====');
    console.log(`Last updated: ${new Date(stats.lastUpdated).toLocaleString()}`);
    console.log('\nPending words:');
    for (const lang in stats.pending) {
      console.log(`  ${lang}: ${stats.pending[lang]}`);
    }
    console.log(`  Total: ${stats.totalPending}`);
    
    console.log('\nApproved words:');
    for (const lang in stats.approved) {
      console.log(`  ${lang}: ${stats.approved[lang]}`);
    }
    console.log(`  Total: ${stats.totalApproved}`);
    
    console.log('\nRejected words:');
    for (const lang in stats.rejected) {
      console.log(`  ${lang}: ${stats.rejected[lang]}`);
    }
    console.log(`  Total: ${stats.totalRejected}`);
    
    console.log('\n===================================');
  } catch (error) {
    console.error('Error showing statistics:', error);
  }
}

/**
 * Export custom words to a file
 */
async function exportCustomWords() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportPath = `./data/custom_words_export_${timestamp}.json`;
    
    await customWords.exportCustomWords(exportPath);
    console.log(`✅ Successfully exported custom words to ${exportPath}`);
  } catch (error) {
    console.error('Error exporting custom words:', error);
  }
}

/**
 * Main function to run the CLI tool
 */
async function main() {
  console.log('Word Suggestion Manager');
  console.log('This tool allows you to review and manage word suggestions from users.');
  
  try {
    while (true) {
      const option = await showMenu();
      
      switch (option) {
        case 1:
          await listPendingWords();
          break;
        case 2:
          await approveWord();
          break;
        case 3:
          await rejectWord();
          break;
        case 4:
          await showStats();
          break;
        case 5:
          await exportCustomWords();
          break;
        case 6:
          console.log('Exiting Word Suggestion Manager...');
          rl.close();
          process.exit(0);
      }
    }
  } catch (error) {
    console.error('An error occurred:', error);
    rl.close();
    process.exit(1);
  }
}

// Run the main function
main();