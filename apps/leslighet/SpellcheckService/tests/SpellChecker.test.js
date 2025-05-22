const norwegianSpellChecker = require("../services/NorwegianSpellChecker");

async function runTests() {
    await norwegianSpellChecker.loadDictionary();

    console.log("🔍 Checking spelling for 'norsk'");
    const result1 = await norwegianSpellChecker.checkWord("norsk");
    console.log(`✅ Correct: ${result1.correct}`);

    console.log("🔍 Checking spelling for 'nrosk'");
    const result2 = await norwegianSpellChecker.checkWord("nrosk");
    console.log(`❌ Correct: ${result2.correct}`);
    console.log(`💡 Suggestions: ${result2.suggestions.join(", ") || "None"}`);

    console.log("📝 Adding 'nrosk' to dictionary...");
    await norwegianSpellChecker.addWord("nrosk");

    console.log("🔍 Checking spelling for 'nrosk' after adding...");
    const result3 = await norwegianSpellChecker.checkWord("nrosk");
    console.log(`✅ Correct: ${result3.correct}`);

    console.log("\n=============================\n");

    // Additional spell-checking tests
    const words = ["hei", "norskk", "bok", "høyst", "skrivefjel"];
    
    for (const word of words) {
        const result = await norwegianSpellChecker.checkWord(word);
        console.log(`📝 Word: "${word}"`);
        console.log(`✅ Correct: ${result.correct}`);
        console.log(`💡 Suggestions: ${result.suggestions.join(", ") || "None"}`);
        console.log("----------------------------");
    }
}

// Run the tests
runTests().catch(console.error);
