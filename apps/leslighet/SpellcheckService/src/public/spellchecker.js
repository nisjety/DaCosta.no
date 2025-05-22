// ======== STATE VARIABLES ========
let ws;
let checkInProgress = false;
let typingTimer;
let currentMisspellings = [];
let activeWordIndex = -1;
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let reconnectDelay = 1000; // Starting delay in ms

// The primary WebSocket URL with dedicated path - don't include port in URL
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsHost = window.location.hostname; // Just the hostname without port
const wsUrl = 'ws://localhost:5011/api/ws';
// Flag to indicate if WebSocket is unavailable
let wsUnavailable = false;

// Language and dialect settings
let currentLanguage = "norwegian";
let dialectSettings = {
  norwegian: { nb: true, nn: true },
  english: { gb: true, us: true }
};

// ======== DOM ELEMENTS ========
const textInput = document.getElementById("textInput");
const resultDiv = document.getElementById("result");
const tooltipDiv = document.getElementById("tooltip");
const errorMessage = document.getElementById("error-message");
const loadingIndicator = document.getElementById("loading");
const languageSelect = document.getElementById("languageSelect");
const norwegianDialects = document.getElementById("norwegianDialects");
const englishDialects = document.getElementById("englishDialects");
const checkButton = document.getElementById("checkButton");
const clearButton = document.getElementById("clearButton");
const statsContainer = document.getElementById("statsContainer");
const statsContent = document.getElementById("statsContent");

// ======== INITIALIZATION ========
// Initialize on page load
window.addEventListener('load', () => {
  console.log(`Connecting to WebSocket at: ${wsUrl}`);
  
  initWebSocket();
  initEventHandlers();
  
  // Initialize dialect indicators
  updateDialectIndicator();
});

// Initialize all event handlers
function initEventHandlers() {
  // Set up text input events
  textInput.addEventListener("input", handleTextInput);
  textInput.addEventListener("keydown", handleTabKey);
  textInput.addEventListener("click", updateActiveWord);
  textInput.addEventListener("keyup", handleKeyUp);
  
  // Set up control panel events
  languageSelect.addEventListener("change", handleLanguageChange);
  document.querySelectorAll('.toggle input[type="checkbox"]').forEach(toggle => {
    toggle.addEventListener('change', handleDialectToggle);
  });
  
  // Set up button events
  checkButton.addEventListener("click", performSpellCheck);
  clearButton.addEventListener("click", clearText);
  
  // Set up document-wide events
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleEscapeKey);
  
  // Connection settings event handlers
  const connectionForm = document.getElementById('connectionForm');
  if (connectionForm) {
    connectionForm.addEventListener('submit', handleConnectionFormSubmit);
  }
}

// ======== WEBSOCKET HANDLING ========
function initWebSocket() {
  if (ws && ws.readyState !== WebSocket.CLOSED) {
    ws.close();
  }
  
  showLoading(false);
  
  try {
    console.log(`Connecting to WebSocket at: ${wsUrl}`);
    ws = new WebSocket(wsUrl);
    
    ws.onopen = handleWebSocketOpen;
    ws.onclose = handleWebSocketClose;
    ws.onerror = handleWebSocketError;
    ws.onmessage = handleWebSocketMessage;
    
    // Set a connection timeout
    const connectionTimeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        console.warn("WebSocket connection timeout - falling back to REST API");
        // Fallback to REST API if WebSocket fails
        enableRestApiMode();
      }
    }, 5000);
    
    // Clear the timeout if connection succeeds
    ws.addEventListener('open', () => {
      clearTimeout(connectionTimeout);
    });
  } catch (error) {
    console.error("WebSocket connection error:", error);
    showError("Failed to establish WebSocket connection. Please check your connection and try again.");
  }
}

// Fallback to REST API mode if WebSocket fails
function enableRestApiMode() {
  showMessage("Using REST API mode (WebSocket unavailable)", "warning");
  document.getElementById('connectionStatus').textContent = "REST API Mode";
  document.getElementById('connectionStatus').className = "warning";
  
  // Here you would implement REST API versions of all WebSocket functions
  // For now, we'll just show an error when trying to check
  wsUnavailable = true;
}

// Test WebSocket connectivity
function testWebSocketConnection() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return Promise.resolve(false);
  }
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(false);
    }, 2000);
    
    ws.send(JSON.stringify({
      action: "ping"
    }));
    
    const messageHandler = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.action === "pong") {
          clearTimeout(timeout);
          ws.removeEventListener('message', messageHandler);
          resolve(true);
        }
      } catch (e) {
        // Ignore parsing errors
      }
    };
    
    ws.addEventListener('message', messageHandler);
  });
}

function handleWebSocketOpen() {
  console.log(`Successfully connected to WebSocket at ${wsUrl}`);
  hideError();
  reconnectAttempts = 0;
  reconnectDelay = 1000;
  
  // Update connection status if needed
  if (document.getElementById('connectionStatus')) {
    document.getElementById('connectionStatus').textContent = 'Connected';
    document.getElementById('connectionStatus').className = 'connected';
  }
  
  // Send language preference immediately
  setLanguagePreference(currentLanguage);
  
  // Get current dialect settings from server
  getDialectSettings();
}

function handleWebSocketClose(event) {
  console.log("WebSocket closed:", event.code, event.reason);
  
  // Update connection status if needed
  if (document.getElementById('connectionStatus')) {
    document.getElementById('connectionStatus').textContent = 'Disconnected';
    document.getElementById('connectionStatus').className = 'disconnected';
  }
  
  if (reconnectAttempts < maxReconnectAttempts) {
    // Exponential backoff for reconnection attempts
    setTimeout(() => {
      reconnectAttempts++;
      reconnectDelay = Math.min(reconnectDelay * 1.5, 10000);
      initWebSocket();
    }, reconnectDelay);
    
    showError(`Connection lost. Reconnecting (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})...`);
  } else {
    showError("Unable to connect to spell checking service after multiple attempts. Please refresh the page or try again later.");
  }
}

function handleWebSocketError(error) {
  console.error("WebSocket error:", error);
  showError("Error connecting to spell checker service. Please check your connection and try again.");
  
  // Update connection status if needed
  if (document.getElementById('connectionStatus')) {
    document.getElementById('connectionStatus').textContent = 'Error';
    document.getElementById('connectionStatus').className = 'disconnected';
  }
}

function handleWebSocketMessage(event) {
  try {
    const data = JSON.parse(event.data);
    
    if (data.type === "spelling") {
      handleSpellCheckResponse(data);
      
      // Update dialect toggles if settings are included
      if (data.dialectSettings) {
        updateDialectSettingsForCurrentLanguage(data.dialectSettings);
      }
    } 
    else if (data.success !== undefined) {
      // Handle API responses (feedback, dialect settings)
      if (data.dialectSettings) {
        // Update dialect settings for current language
        updateDialectSettingsForCurrentLanguage(data.dialectSettings);
        
        // Re-check text with new settings
        performSpellCheck();
      }
      else if (data.addedToCustomWords) {
        // Handle feedback response - re-check if word was added
        performSpellCheck();
        showMessage(`"${data.word}" has been added to the dictionary.`, "success");
      }
      
      // Show error if needed
      if (!data.success && data.error) {
        console.error("API error:", data.error);
        showError(data.error);
      }
    }
  } catch (error) {
    console.error("Error parsing WebSocket message:", error);
    showError("Received invalid data from the server.");
  }
}

// ======== EVENT HANDLERS ========
// Handle text input with debounce
function handleTextInput() {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(performSpellCheck, 800);
}

// Handle Tab key for auto-completion
function handleTabKey(event) {
  if (event.key === 'Tab') {
    event.preventDefault(); // Prevent default tab behavior
    
    // If no misspellings are found, do nothing
    if (currentMisspellings.length === 0) return;
    
    // If no active word, use the first misspelled word
    if (activeWordIndex === -1 && currentMisspellings.length > 0) {
      activeWordIndex = 0;
    }
    
    const currentWord = currentMisspellings[activeWordIndex];
    
    // Check if there are suggestions for the active word
    if (currentWord && currentWord.suggestions && currentWord.suggestions.length > 0) {
      // Get the first suggestion and apply it
      const suggestion = currentWord.suggestions[0];
      applyCorrection(currentWord.startIndex, currentWord.endIndex, suggestion);
    }
  }
}

// Handle Escape key to close tooltips
function handleEscapeKey(event) {
  if (event.key === 'Escape') {
    hideTooltip();
  }
}

// Track cursor position to determine active misspelled word
function handleKeyUp(event) {
  // Only update on navigation keys, not during normal typing
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
    updateActiveWord();
  }
}

// Set language preference on the server
function setLanguagePreference(language) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  
  ws.send(JSON.stringify({
    action: 'setLanguage',
    language: language
  }));
}

// Handle language change
function handleLanguageChange() {
  currentLanguage = languageSelect.value;
  
  // Update visible dialect toggles
  if (currentLanguage === "norwegian") {
    norwegianDialects.style.display = "flex";
    englishDialects.style.display = "none";
  } else {
    norwegianDialects.style.display = "none";
    englishDialects.style.display = "flex";
  }
  
  // Update dialect indicator
  updateDialectIndicator();
  
  // Tell the server about the language change
  setLanguagePreference(currentLanguage);
  
  // Get dialect settings from server
  getDialectSettings();
  
  // Re-check text with new language
  performSpellCheck();
}

// Handle dialect toggle changes
function handleDialectToggle(event) {
  const toggle = event.target;
  const dialect = toggle.getAttribute('data-dialect');
  const language = toggle.getAttribute('data-language');
  
  if (!dialect || !language) return;
  
  // Find all toggles for the current language
  const toggles = document.querySelectorAll(`input[type="checkbox"][data-language="${language}"]`);
  
  // Check if at least one toggle is enabled
  let anyEnabled = false;
  toggles.forEach(t => {
    if (t.checked && t !== toggle) {
      anyEnabled = true;
    }
  });
  
  // Prevent disabling both dialects
  if (!toggle.checked && !anyEnabled) {
    toggle.checked = true;
    showMessage("At least one dialect must be enabled", "error");
    return;
  }
  
  // Update settings
  dialectSettings[language][dialect] = toggle.checked;
  
  // Send to server
  setDialectSettings(dialectSettings[language]);
  
  // Update the indicator right away for better UX
  updateDialectIndicator();
}

// Handle document clicks
function handleDocumentClick(event) {
  // Hide tooltip when clicking elsewhere
  if (!event.target.closest('mark') && !event.target.closest('.tooltip')) {
    hideTooltip();
  }
}

// Clear the text area
function clearText() {
  textInput.value = "";
  resultDiv.innerHTML = "";
  currentMisspellings = [];
  statsContainer.style.display = "none";
  hideError();
}

// ======== DIALECT HANDLING ========
function updateDialectSettingsForCurrentLanguage(settings) {
  // Update internal settings
  Object.keys(settings).forEach(key => {
    dialectSettings[currentLanguage][key] = settings[key];
  });
  
  // Update toggle buttons for current language
  document.querySelectorAll(`input[type="checkbox"][data-language="${currentLanguage}"]`).forEach(toggle => {
    const dialect = toggle.getAttribute('data-dialect');
    if (dialect && typeof dialectSettings[currentLanguage][dialect] === 'boolean') {
      toggle.checked = dialectSettings[currentLanguage][dialect];
    }
  });
  
  // Update dialect indicator
  updateDialectIndicator();
}

function updateDialectIndicator() {
  const indicator = document.getElementById('dialectIndicator');
  if (!indicator) return;
  
  let text = 'Using: ';
  
  if (currentLanguage === 'norwegian') {
    text += 'Norwegian (';
    const dialects = [];
    if (dialectSettings.norwegian.nb) dialects.push('Bokmål');
    if (dialectSettings.norwegian.nn) dialects.push('Nynorsk');
    text += dialects.join(' and ') + ')';
  } else if (currentLanguage === 'english') {
    text += 'English (';
    const dialects = [];
    if (dialectSettings.english.gb) dialects.push('British');
    if (dialectSettings.english.us) dialects.push('American');
    text += dialects.join(' and ') + ')';
  }
  
  indicator.textContent = text;
}

function getDialectSettings() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  
  ws.send(JSON.stringify({
    action: 'getDialects',
    language: currentLanguage
  }));
}

function setDialectSettings(settings) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  
  ws.send(JSON.stringify({
    action: 'setDialects',
    language: currentLanguage,
    ...settings
  }));
}

// ======== CORE FUNCTIONALITY ========
function performSpellCheck() {
  hideTooltip();
  
  // If WebSocket is unavailable, use REST API fallback
  if (wsUnavailable) {
    performSpellCheckREST();
    return;
  }
  
  if (checkInProgress || !ws || ws.readyState !== WebSocket.OPEN) {
    if (!checkInProgress && ws && ws.readyState !== WebSocket.OPEN) {
      showError("Not connected to spell checker service. Attempting to reconnect...");
      initWebSocket();
    }
    return;
  }
  
  const text = textInput.value;
  if (!text) {
    resultDiv.innerHTML = "";
    currentMisspellings = [];
    statsContainer.style.display = "none";
    return;
  }
  
  checkInProgress = true;
  showLoading(true);
  
  // Send spell check request with language and dialect settings
  ws.send(JSON.stringify({
    action: "checkText",
    text: text,
    language: currentLanguage,
    dialectSettings: dialectSettings[currentLanguage]
  }));
}

// Fallback to REST API for spell checking
async function performSpellCheckREST() {
  hideTooltip();
  
  if (checkInProgress) {
    return;
  }
  
  const text = textInput.value;
  if (!text) {
    resultDiv.innerHTML = "";
    currentMisspellings = [];
    statsContainer.style.display = "none";
    return;
  }
  
  checkInProgress = true;
  showLoading(true);
  
  try {
    // Use the REST API endpoint instead of WebSocket
    const endpoint = currentLanguage === 'norwegian' ? 
      '/api/v1/norwegian/check-text' : 
      '/api/v1/english/check-text';
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        dialectSettings: dialectSettings[currentLanguage]
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const result = await response.json();
    handleSpellCheckResponse(result);
  } catch (error) {
    console.error("Error using REST API:", error);
    showError(`Failed to check spelling: ${error.message}`);
  } finally {
    checkInProgress = false;
    showLoading(false);
  }
}

function handleSpellCheckResponse(data) {
  checkInProgress = false;
  showLoading(false);
  
  // Store all misspellings for tab completion
  currentMisspellings = data.errors || [];
  
  // Get the original text
  const originalText = textInput.value;
  
  // No errors found
  if (currentMisspellings.length === 0) {
    resultDiv.innerHTML = `
      <div class="text-content">
        <div class="highlighted-text">${originalText || ''}</div>
      </div>
    `;
    showMessage("No spelling errors found!", "success");
  } else {
    // Highlight misspelled words
    let highlightedText = originalText;
    
    // Sort by position in reverse order to preserve indices
    currentMisspellings.sort((a, b) => b.startIndex - a.startIndex);
    
    // Apply highlights from end to start
    currentMisspellings.forEach(error => {
      const beforeError = highlightedText.substring(0, error.startIndex);
      const errorText = highlightedText.substring(error.startIndex, error.endIndex + 1);
      const afterError = highlightedText.substring(error.endIndex + 1);
      
      // Determine the error type class
      let errorClass = 'spelling-error';
      if (error.type === 'grammar') errorClass = 'grammar-error';
      if (error.type === 'style') errorClass = 'suggestion';
      if (error.hasFeedback) errorClass += ' feedback';
      
      // Include feedback data in the mark attributes
      const feedbackAttrs = error.hasFeedback ? 
        ` data-has-feedback="true" data-feedback-stats="${encodeURIComponent(JSON.stringify(error.feedbackStats))}"` : '';
      
      highlightedText = 
        beforeError + 
        `<mark 
          class="${errorClass}"
          data-word="${encodeURIComponent(error.word)}" 
          data-suggestions="${encodeURIComponent(JSON.stringify(error.suggestions))}"
          data-start="${error.startIndex}"
          data-end="${error.endIndex}"
          data-type="${error.type || 'spelling'}"${feedbackAttrs}
        >` + 
        errorText + 
        '</mark>' + 
        afterError;
    });
    
    resultDiv.innerHTML = `
      <div class="text-content">
        <div class="highlighted-text">${highlightedText}</div>
      </div>
    `;
  }
  
  // Add event listeners to the highlighted errors
  document.querySelectorAll('.highlighted-text mark').forEach(mark => {
    mark.addEventListener('click', showSuggestions);
  });
  
  // Update active word after spell check
  updateActiveWord();
  
  // Show statistics if available
  if (data.stats) {
    displayStatistics(data.stats);
  }
}

// ======== SUGGESTION HANDLING ========
function showSuggestions(event) {
  const mark = event.currentTarget;
  const word = decodeURIComponent(mark.getAttribute('data-word'));
  const suggestionsList = JSON.parse(decodeURIComponent(mark.getAttribute('data-suggestions')));
  const errorType = mark.getAttribute('data-type') || 'spelling';
  const hasFeedback = mark.getAttribute('data-has-feedback') === 'true';
  const feedbackStats = mark.hasAttribute('data-feedback-stats') 
    ? JSON.parse(decodeURIComponent(mark.getAttribute('data-feedback-stats'))) 
    : null;
  
  // Create tooltip content
  let tooltipContent = `
    <div class="tooltip-header">
      <span class="tooltip-title">${getErrorTypeLabel(errorType)}: "${word}"</span>
      <button class="close-tooltip" aria-label="Close" title="Close">×</button>
    </div>
  `;
  
  if (suggestionsList.length === 0) {
    tooltipContent += '<div>No suggestions available</div>';
  } else {
    tooltipContent += '<div>';
    suggestionsList.forEach((suggestion, index) => {
      tooltipContent += `
        <div class="suggestion-item${index === 0 ? ' current-suggestion' : ''}" 
          data-word="${encodeURIComponent(suggestion)}" 
          data-start="${mark.getAttribute('data-start')}" 
          data-end="${mark.getAttribute('data-end')}">
          ${suggestion}
        </div>
      `;
    });
    tooltipContent += '</div>';
    
    // Add tab hint if suggestions exist
    tooltipContent += `<span class="tab-hint">Press Tab to use the first suggestion or click any suggestion to apply</span>`;
  }
  
  // Add feedback stats if available
  if (hasFeedback && feedbackStats) {
    tooltipContent += `
      <div class="feedback-stats">
        <span class="feedback-positive">✓ ${feedbackStats.correctVotes} users think this is correct</span>
        <span class="feedback-negative">✗ ${feedbackStats.incorrectVotes} users think this is incorrect</span>
      </div>
    `;
  }
  
  // Add feedback controls
  tooltipContent += `
    <div class="feedback-controls">
      <div class="feedback-prompt">Is "${word}" actually correct?</div>
      <div class="feedback-buttons">
        <button class="feedback-button feedback-yes">Yes, it's correct</button>
        <button class="feedback-button feedback-no">No, it's wrong</button>
      </div>
    </div>
  `;
  
  // Position and show tooltip
  tooltipDiv.innerHTML = tooltipContent;
  tooltipDiv.style.display = 'block';
  
  const markRect = mark.getBoundingClientRect();
  const tooltipTop = markRect.bottom + window.scrollY + 5;
  const tooltipLeft = markRect.left + window.scrollX;
  
  tooltipDiv.style.top = `${tooltipTop}px`;
  tooltipDiv.style.left = `${tooltipLeft}px`;
  
  // Add event listeners to suggestions
  document.querySelectorAll('.suggestion-item').forEach(suggestionElem => {
    suggestionElem.addEventListener('click', handleSuggestionClick);
  });
  
  // Add event listener to close button
  tooltipDiv.querySelector('.close-tooltip').addEventListener('click', hideTooltip);
  
  // Add event listeners to feedback buttons
  tooltipDiv.querySelector('.feedback-yes').addEventListener('click', () => {
    sendWordFeedback(word, true);
    hideTooltip();
    showMessage(`Thank you! Your feedback on "${word}" has been recorded.`, "success");
  });
  
  tooltipDiv.querySelector('.feedback-no').addEventListener('click', () => {
    sendWordFeedback(word, false);
    hideTooltip();
    showMessage(`Thank you! Your feedback on "${word}" has been recorded.`, "success");
  });
  
  // Update active word index
  updateActiveWordFromMark(mark);
}

function handleSuggestionClick(event) {
  const suggestionElem = event.currentTarget;
  const suggestion = decodeURIComponent(suggestionElem.getAttribute('data-word'));
  const startIndex = parseInt(suggestionElem.getAttribute('data-start'));
  const endIndex = parseInt(suggestionElem.getAttribute('data-end'));
  
  applyCorrection(startIndex, endIndex, suggestion);
}

function applyCorrection(startIndex, endIndex, suggestion) {
  // Replace the misspelled word in the textarea
  const text = textInput.value;
  textInput.value = text.substring(0, startIndex) + suggestion + text.substring(endIndex + 1);
  
  // Hide tooltip
  hideTooltip();
  
  // Update cursor position to be after the corrected word
  const newPosition = startIndex + suggestion.length;
  textInput.setSelectionRange(newPosition, newPosition);
  textInput.focus();
  
  // Re-run spell check
  setTimeout(performSpellCheck, 300);
}

function hideTooltip() {
  tooltipDiv.style.display = 'none';
}

// ======== USER FEEDBACK ========
function sendWordFeedback(word, isCorrect) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error('WebSocket not connected');
    showError("Not connected to spell checker service. Unable to send feedback.");
    return;
  }
  
  ws.send(JSON.stringify({
    action: 'feedback',
    word: word,
    isCorrect: isCorrect,
    language: currentLanguage,
    userId: getUserId()
  }));
}

// ======== HELPER FUNCTIONS ========
function getUserId() {
  // Simple implementation for demo purposes
  let userId = localStorage.getItem('spellchecker_user_id');
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('spellchecker_user_id', userId);
  }
  return userId;
}

function updateActiveWord() {
  const cursorPosition = textInput.selectionStart;
  activeWordIndex = -1;
  
  // Find which misspelled word contains the cursor
  for (let i = 0; i < currentMisspellings.length; i++) {
    const word = currentMisspellings[i];
    if (cursorPosition >= word.startIndex && cursorPosition <= word.endIndex + 1) {
      activeWordIndex = i;
      break;
    }
  }
}

function updateActiveWordFromMark(mark) {
  const startIndex = parseInt(mark.getAttribute('data-start'));
  
  // Find which misspelled word this is
  for (let i = 0; i < currentMisspellings.length; i++) {
    if (currentMisspellings[i].startIndex === startIndex) {
      activeWordIndex = i;
      break;
    }
  }
}

function getErrorTypeLabel(type) {
  switch(type) {
    case 'grammar': return 'Grammar Error';
    case 'style': return 'Style Suggestion';
    case 'spelling':
    default: return 'Spelling Error';
  }
}

function showMessage(message, type = "info") {
  // Create message element
  const messageDiv = document.createElement('div');
  messageDiv.className = `feedback-message feedback-${type}`;
  messageDiv.textContent = message;
  
  // Add to the document
  document.body.appendChild(messageDiv);
  
  // Remove after a delay
  setTimeout(() => {
    messageDiv.classList.add('fade-out');
    setTimeout(() => {
      if (document.body.contains(messageDiv)) {
        document.body.removeChild(messageDiv);
      }
    }, 500);
  }, 3000);
}

function showError(message) {
  if (!message) {
    errorMessage.style.display = "none";
    return;
  }
  
  errorMessage.textContent = message;
  errorMessage.style.display = "block";
}

function hideError() {
  errorMessage.style.display = "none";
}

function showLoading(show) {
  loadingIndicator.style.display = show ? "flex" : "none";
}

// Create connection settings panel
function createConnectionSettings() {
  // Create the connection settings panel if it doesn't exist
  if (!document.getElementById('connectionSettings')) {
    const settingsDiv = document.createElement('div');
    settingsDiv.id = 'connectionSettings';
    settingsDiv.className = 'connection-settings';
    settingsDiv.style.display = 'none';
    
    // Create URL selector options from our list of URLs
    let urlOptions = '';
    possibleWsUrls.forEach((url, index) => {
      urlOptions += `<option value="${url}">${url} (Option ${index + 1})</option>`;
    });
    
    settingsDiv.innerHTML = `
      <div class="connection-header">
        <h3>Connection Settings</h3>
        <button type="button" class="close-settings">×</button>
      </div>
      <p>Configure WebSocket connection if you're having trouble connecting to the spell checker service.</p>
      <form id="connectionForm">
        <div class="form-group">
          <label for="wsUrlSelect">Try a predefined connection:</label>
          <select id="wsUrlSelect" class="form-select">
            ${urlOptions}
            <option value="custom">Custom URL...</option>
          </select>
        </div>
        <div class="form-group" id="customUrlGroup" style="display: none;">
          <label for="wsUrlInput">Custom WebSocket URL:</label>
          <input type="text" id="wsUrlInput" value="${wsUrl}" placeholder="ws://hostname:port">
        </div>
        <div class="form-actions">
          <button type="submit" class="primary-button">Connect</button>
          <button type="button" class="secondary-button reset-connection">Reset to Default</button>
        </div>
      </form>
      <div class="connection-status">
        <p>Current connection: <span id="connectionStatusText">Disconnected</span></p>
        <p>Attempted URLs:</p>
        <ul id="attemptedUrls" class="attempted-urls">
          ${possibleWsUrls.map((url, idx) => 
            `<li class="${idx === currentWsUrlIndex ? 'current' : (idx < currentWsUrlIndex ? 'tried' : '')}">${url}</li>`
          ).join('')}
        </ul>
      </div>
    `;
    
    document.body.appendChild(settingsDiv);
    
    // Add event listeners
    const closeButton = settingsDiv.querySelector('.close-settings');
    closeButton.addEventListener('click', hideConnectionSettings);
    
    const resetButton = settingsDiv.querySelector('.reset-connection');
    resetButton.addEventListener('click', resetConnection);
    
    const urlSelect = document.getElementById('wsUrlSelect');
    urlSelect.addEventListener('change', handleUrlSelectChange);
    
    updateConnectionStatus();
  } else {
    // Update the attempted URLs list if the settings panel already exists
    updateAttemptedUrlsList();
  }
}

function handleUrlSelectChange(event) {
  const urlSelect = event.target;
  const customUrlGroup = document.getElementById('customUrlGroup');
  const wsUrlInput = document.getElementById('wsUrlInput');
  
  if (urlSelect.value === 'custom') {
    customUrlGroup.style.display = 'block';
    wsUrlInput.focus();
  } else {
    customUrlGroup.style.display = 'none';
    wsUrlInput.value = urlSelect.value;
  }
}

function updateAttemptedUrlsList() {
  const attemptedUrls = document.getElementById('attemptedUrls');
  if (attemptedUrls) {
    attemptedUrls.innerHTML = possibleWsUrls.map((url, idx) => 
      `<li class="${idx === currentWsUrlIndex ? 'current' : (idx < currentWsUrlIndex ? 'tried' : '')}">${url}</li>`
    ).join('');
  }
}

function createQuickConnectionSelector() {
  // Add a connection selector to the main UI for quick access
  const indicator = document.getElementById('dialectIndicator');
  if (indicator) {
    const connectionSelector = document.createElement('div');
    connectionSelector.className = 'connection-indicator';
    connectionSelector.innerHTML = `
      <span id="quickConnectionStatus">WebSocket: Connecting...</span>
      <button id="quickSettingsButton" class="mini-button">Configure</button>
    `;
    
    indicator.parentNode.insertBefore(connectionSelector, indicator.nextSibling);
    
    // Add event listener
    document.getElementById('quickSettingsButton').addEventListener('click', showConnectionSettings);
  }
}

function updateQuickConnectionStatus() {
  const statusElement = document.getElementById('quickConnectionStatus');
  if (statusElement) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      statusElement.textContent = "WebSocket: Connected";
      statusElement.className = "connected";
    } else if (ws && ws.readyState === WebSocket.CONNECTING) {
      statusElement.textContent = "WebSocket: Connecting...";
      statusElement.className = "connecting";
    } else {
      statusElement.textContent = "WebSocket: Disconnected";
      statusElement.className = "disconnected";
    }
  }
}

function showConnectionSettings() {
  const settingsDiv = document.getElementById('connectionSettings');
  if (settingsDiv) {
    settingsDiv.style.display = 'block';
    const input = document.getElementById('wsUrlInput');
    if (input) {
      input.value = wsUrl;
      input.focus();
    }
  }
}

function hideConnectionSettings() {
  const settingsDiv = document.getElementById('connectionSettings');
  if (settingsDiv) {
    settingsDiv.style.display = 'none';
  }
}

function handleConnectionFormSubmit(event) {
  event.preventDefault();
  
  const urlSelect = document.getElementById('wsUrlSelect');
  const wsUrlInput = document.getElementById('wsUrlInput');
  
  let newUrl;
  if (urlSelect.value === 'custom') {
    // Use the custom URL input
    newUrl = wsUrlInput.value.trim();
  } else {
    // Use the selected predefined URL
    newUrl = urlSelect.value;
  }
  
  if (newUrl) {
    // Save the new URL
    wsUrl = newUrl;
    localStorage.setItem('spellchecker_ws_url', wsUrl);
    
    // Reset URL index if we're using a custom URL
    if (!possibleWsUrls.includes(wsUrl)) {
      currentWsUrlIndex = -1;
    } else {
      currentWsUrlIndex = possibleWsUrls.indexOf(wsUrl);
    }
    
    // Reconnect
    if (ws) {
      ws.close();
      ws = null;
    }
    reconnectAttempts = 0;
    initWebSocket();
    
    // Update UI
    updateAttemptedUrlsList();
    updateConnectionStatus();
    updateQuickConnectionStatus();
    hideConnectionSettings();
    showMessage("Connection settings updated. Attempting to connect...", "info");
  }
}

function resetConnection() {
  // Reset to first URL in our list
  currentWsUrlIndex = 0;
  wsUrl = possibleWsUrls[currentWsUrlIndex];
  
  // Update select and input field
  const urlSelect = document.getElementById('wsUrlSelect');
  const wsUrlInput = document.getElementById('wsUrlInput');
  if (urlSelect && wsUrlInput) {
    urlSelect.value = wsUrl;
    wsUrlInput.value = wsUrl;
    document.getElementById('customUrlGroup').style.display = 'none';
  }
  
  // Clear stored URL
  localStorage.removeItem('spellchecker_ws_url');
  
  // Reconnect
  if (ws) {
    ws.close();
    ws = null;
  }
  reconnectAttempts = 0;
  initWebSocket();
  
  // Update UI
  updateAttemptedUrlsList();
  updateConnectionStatus();
  updateQuickConnectionStatus();
  showMessage("Connection settings reset. Attempting to connect...", "info");
}

function updateConnectionStatus() {
  const statusText = document.getElementById('connectionStatusText');
  if (statusText) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      statusText.textContent = "Connected";
      statusText.className = "connected";
    } else if (ws && ws.readyState === WebSocket.CONNECTING) {
      statusText.textContent = "Connecting...";
      statusText.className = "connecting";
    } else {
      statusText.textContent = "Disconnected";
      statusText.className = "disconnected";
    }
  }
  
  // Also update the quick connection status
  updateQuickConnectionStatus();
  
  // Update URL selector to match current URL
  const urlSelect = document.getElementById('wsUrlSelect');
  if (urlSelect) {
    if (possibleWsUrls.includes(wsUrl)) {
      urlSelect.value = wsUrl;
      document.getElementById('customUrlGroup').style.display = 'none';
    } else {
      urlSelect.value = 'custom';
      document.getElementById('customUrlGroup').style.display = 'block';
      document.getElementById('wsUrlInput').value = wsUrl;
    }
  }
}

function displayStatistics(stats) {
  if (!stats) {
    statsContainer.style.display = "none";
    return;
  }
  
  statsContainer.style.display = "block";
  
  // Create statistics grid
  let statsHtml = '<div class="stats-grid">';
  
  // Total words
  statsHtml += createStatItem('Total Words', stats.totalWords || 0);
  
  // Error count
  statsHtml += createStatItem('Errors Found', stats.errorCount || 0);
  
  // Error rate
  const errorRate = stats.errorRate ? (stats.errorRate * 100).toFixed(1) + '%' : '0%';
  statsHtml += createStatItem('Error Rate', errorRate);
  
  // Cache performance
  if (stats.cacheHits !== undefined && stats.cacheMisses !== undefined) {
    const totalChecks = stats.cacheHits + stats.cacheMisses;
    const hitRate = totalChecks > 0 ? ((stats.cacheHits / totalChecks) * 100).toFixed(1) + '%' : '0%';
    statsHtml += createStatItem('Cache Hit Rate', hitRate);
  }
  
  // Processing time
  if (stats.processingTime !== undefined) {
    statsHtml += createStatItem('Processing Time', `${stats.processingTime}ms`);
  }
  
  statsHtml += '</div>';
  statsContent.innerHTML = statsHtml;
}

function createStatItem(label, value) {
  return `
    <div class="stat-item">
      <span class="stat-label">${label}</span>
      <span class="stat-value">${value}</span>
    </div>
  `;
}