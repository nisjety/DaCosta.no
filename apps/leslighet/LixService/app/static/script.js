// Example texts
const exampleTexts = {
    easy: "Solen skinner på den blå himmelen. Fuglene synger i trærne. Det er en fin dag i parken. Barn leker på gresset. Noen spiser is på benken. En hund løper etter en ball. Blomstene dufter søtt i vårluften.",
    medium: "Lesbarhetsindeksen (LIX) er en metode for å måle tekstens vanskelighetsgrad. Den ble utviklet av pedagogikkforskeren Carl-Hugo Björnsson på 1960-tallet. Formelen baserer seg på gjennomsnittlig setningslengde og andelen lange ord. I nordiske språk regnes ord med seks eller flere bokstaver som lange.",
    hard: "Den fenomenologiske hermeneutikkens epistemologiske premisser manifesterer seg gjennom fortolkningsprosessens dialektiske selvrefleksjon. Subjektivitetens transcendentale aspekter konstituerer forståelseshorisonten, hvorved den intersubjektive meningskonstruksjonens betingelser etableres. Gjennom den hermeneutiske sirkelbevegelsens kontinuerlige vekselvirkning mellom del og helhet muliggjøres en progressiv tilnærming til tekstens immanente betydningsstrukturer."
  };
  
  // DOM elements
  const textInput = document.getElementById('textInput');
  const lixScore = document.getElementById('lixScore');
  const lixCategory = document.getElementById('lixCategory');
  const rixScore = document.getElementById('rixScore');
  const rixCategory = document.getElementById('rixCategory');
  const wordCount = document.getElementById('wordCount');
  const avgSentenceLength = document.getElementById('avgSentenceLength');
  const interpretation = document.getElementById('interpretation');
  const sentenceList = document.getElementById('sentenceList');
  const exampleEasy = document.getElementById('exampleEasy');
  const exampleMedium = document.getElementById('exampleMedium');
  const exampleHard = document.getElementById('exampleHard');
  
  // Load example texts
  exampleEasy.addEventListener('click', () => {
    textInput.value = exampleTexts.easy;
    analyzeText();
  });
  
  exampleMedium.addEventListener('click', () => {
    textInput.value = exampleTexts.medium;
    analyzeText();
  });
  
  exampleHard.addEventListener('click', () => {
    textInput.value = exampleTexts.hard;
    analyzeText();
  });
  
  // Analyze text when input changes
  textInput.addEventListener('input', () => {
    clearTimeout(window.analysisTimer);
    window.analysisTimer = setTimeout(analyzeText, 500);
  });
  
  // Format class name based on category
  function getCategoryClass(category) {
    const lowerCategory = category.toLowerCase();
    if (lowerCategory.includes('lett') || lowerCategory.includes('enkel')) {
      return 'category-easy';
    } else if (lowerCategory.includes('middels') || lowerCategory.includes('normal')) {
      return 'category-medium';
    } else {
      return 'category-hard';
    }
  }
  
  // Main function to analyze text using the backend API
  async function analyzeText() {
    const text = textInput.value.trim();
    
    // Reset UI if text is empty
    if (!text) {
      resetUI();
      return;
    }
    
    try {
      // Show loading state while waiting for API response
      showLoading(true);
      
      // Call the backend API to analyze the text
      const response = await fetch('/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          include_sentence_analysis: true,
          include_word_analysis: false
        })
      });
      
      // Check if response is successful
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      // Parse the JSON response
      const result = await response.json();
      
      // Update UI with the analysis results
      updateUI(result);
      
    } catch (error) {
      console.error('Error analyzing text:', error);
      interpretation.innerHTML = `<p>Det oppstod en feil under analysen: ${error.message}</p>`;
    } finally {
      showLoading(false);
    }
  }
  
  // Update UI with analysis results
  function updateUI(result) {
    const readability = result.readability;
    const textAnalysis = result.text_analysis;
    
    // Update metrics
    lixScore.textContent = readability.lix.score;
    lixCategory.textContent = readability.lix.category;
    lixCategory.className = `metric-category ${getCategoryClass(readability.lix.category)}`;
    
    rixScore.textContent = readability.rix.score;
    rixCategory.textContent = readability.rix.category;
    rixCategory.className = `metric-category ${getCategoryClass(readability.rix.category)}`;
    
    wordCount.textContent = textAnalysis.statistics.word_count;
    avgSentenceLength.textContent = textAnalysis.statistics.avg_sentence_length;
    
    // Update interpretation
    let interpretationHtml = `<p><strong>Lesbarhetsvurdering:</strong> ${readability.lix.description} ${readability.lix.audience || ''}</p>`;
    
    if (textAnalysis.statistics.avg_sentence_length > 25) {
      interpretationHtml += `<p>Setningene er <strong>svært lange</strong> (gjennomsnitt på ${textAnalysis.statistics.avg_sentence_length} ord), noe som kan gjøre teksten vanskeligere å følge.</p>`;
    } else if (textAnalysis.statistics.avg_sentence_length < 10) {
      interpretationHtml += `<p>Setningene er <strong>korte og lettleste</strong> (${textAnalysis.statistics.avg_sentence_length} ord).</p>`;
    }
    
    interpretation.innerHTML = interpretationHtml;
    
    // Display recommendations if available
    if (readability.recommendations && readability.recommendations.length > 0) {
      interpretationHtml += '<p><strong>Anbefalinger:</strong></p><ul>';
      readability.recommendations.forEach(rec => {
        interpretationHtml += `<li><strong>${rec.title}</strong>: ${rec.suggestion}</li>`;
      });
      interpretationHtml += '</ul>';
      interpretation.innerHTML = interpretationHtml;
    }
    
    // Display sentence analysis
    displaySentenceAnalysis(textAnalysis.sentence_analysis || []);
  }
  
  // Display the sentence analysis
  function displaySentenceAnalysis(sentences) {
    sentenceList.innerHTML = "<h3>Setningsanalyse:</h3>";
    
    if (!sentences || sentences.length === 0) {
      sentenceList.innerHTML += "<p>Ingen setningsanalyse tilgjengelig.</p>";
      return;
    }
    
    sentences.forEach((sentence, index) => {
      if (sentence.word_count < 3) return; // Skip very short sentences
      
      const sentenceEl = document.createElement('div');
      sentenceEl.className = 'sentence-item';
      
      // Build metrics display
      let metrics = `Ord: ${sentence.word_count}`;
      
      if (sentence.lix_score !== undefined) {
        metrics += ` | LIX: ${sentence.lix_score.toFixed(1)} (${sentence.complexity || 'normal'})`;
      }
      
      // Add issues if any
      let issuesText = '';
      if (sentence.issues && sentence.issues.length > 0) {
        issuesText = `<div style="color: #d32f2f; margin-top: 3px;">Issues: ${sentence.issues.join(', ')}</div>`;
      }
      
      sentenceEl.innerHTML = `
        <div>${sentence.sentence}</div>
        <div style="font-size: 14px; color: #666; margin-top: 5px;">
          ${metrics}
        </div>
        ${issuesText}
      `;
      
      sentenceList.appendChild(sentenceEl);
    });
  }
  
  // Reset UI elements
  function resetUI() {
    lixScore.textContent = "-";
    lixCategory.textContent = "-";
    lixCategory.className = "metric-category";
    rixScore.textContent = "-";
    rixCategory.textContent = "-";
    rixCategory.className = "metric-category";
    wordCount.textContent = "-";
    avgSentenceLength.textContent = "-";
    interpretation.innerHTML = "<p>Skriv inn tekst ovenfor for å se en vurdering av lesbarheten.</p>";
    sentenceList.innerHTML = "";
  }
  
  // Show or hide loading state
  function showLoading(isLoading) {
    if (isLoading) {
      document.body.style.cursor = 'wait';
      // Additional loading indicators could be added here
    } else {
      document.body.style.cursor = 'default';
    }
  }
  
  // Initial check if there's text
  if (textInput.value.trim()) {
    analyzeText();
  }