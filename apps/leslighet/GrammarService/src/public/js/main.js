/**
 * Norwegian Grammar Service - Client-side functionality
 * Handles user interactions, API communications, and result presentation
 * Updated with Docker-compatible WebSocket implementation and HTTP fallback
 */

// Global state
const state = {
    websocket: null,
    websocketConnected: false,
    isProcessing: false,
    lastResults: null,
    connectionAttempts: 0,
    maxConnectionAttempts: 5,
    webSocketTimeout: null,
    useHttpMode: false
  };
  
  // DOM elements
  const elements = {
    textInput: document.getElementById('text-input'),
    languageSelector: document.getElementById('language'),
    includeTokensCheckbox: document.getElementById('includeTokens'),
    includeDetailsCheckbox: document.getElementById('includeDetails'),
    checkButton: document.getElementById('check-button'),
    loadingIndicator: document.getElementById('loading-indicator'),
    resultsContainer: document.getElementById('results-container'),
    noIssuesMessage: document.getElementById('no-issues-message'),
    errorMessage: document.getElementById('error-message'),
    errorDetails: document.getElementById('error-details'),
    totalIssues: document.getElementById('total-issues'),
    grammarIssues: document.getElementById('grammar-issues'),
    styleIssues: document.getElementById('style-issues'),
    spellingIssues: document.getElementById('spelling-issues'),
    issuesList: document.getElementById('issues-list'),
    highlightedText: document.getElementById('highlighted-text'),
    tokensContainer: document.getElementById('tokens-container'),
    tokensDisplay: document.getElementById('tokens-display'),
    wsIndicator: document.getElementById('ws-indicator'),
    wsStatusText: document.getElementById('ws-status-text')
  };
  
  // WebSocket setup with special handling for 0.0.0.0
  const setupWebSocket = () => {
    // Don't try to reconnect too many times
    if (state.connectionAttempts >= state.maxConnectionAttempts) {
      console.error('Maximum WebSocket connection attempts reached');
      updateWebSocketStatus(false);
      enableHttpMode();
      return;
    }

    state.connectionAttempts += 1;

    // Use the current protocol (http -> ws, https -> wss)
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    // Get the hostname, but handle the special case of 0.0.0.0
    let wsHost = window.location.hostname;
    const wsPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');

    // Debug information
    console.log(`Current location: ${window.location.href}`);
    console.log(`Original hostname: ${wsHost}, port: ${wsPort}`);

    // If hostname is 0.0.0.0, use alternatives
    if (wsHost === '0.0.0.0') {
      const savedHost = localStorage.getItem('preferredWsHost');
      wsHost = savedHost || 'localhost';
    }

    // Prepare WebSocket URL
    const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}/api/ws`;
    console.log(`Attempting to connect to WebSocket: ${wsUrl} (Attempt ${state.connectionAttempts})`);

    if (state.websocket) {
      try {
        if (state.websocket.readyState === WebSocket.OPEN || state.websocket.readyState === WebSocket.CONNECTING) {
          state.websocket.close();
        }
      } catch (e) {
        console.warn('Error closing previous WebSocket:', e);
      }
    }

    try {
      // Create new WebSocket connection with protocol
      state.websocket = new WebSocket(wsUrl, ['grammar-check-v1']);

      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (!state.websocketConnected) {
          console.error('WebSocket connection timeout');
          try {
            if (state.websocket && (state.websocket.readyState === WebSocket.OPEN || state.websocket.readyState === WebSocket.CONNECTING)) {
              state.websocket.close();
            }
          } catch (e) {
            console.warn('Error closing timed-out WebSocket:', e);
          }

          // If we're on the last attempt, switch to HTTP mode
          if (state.connectionAttempts >= state.maxConnectionAttempts) {
            enableHttpMode();
          } else {
            // Try next hostname
            setupWebSocket();
          }
        }
      }, 5000);

      state.websocket.onopen = (event) => {
        console.log(`WebSocket connection successfully established to ${wsUrl}`, event);
        state.websocketConnected = true;
        state.connectionAttempts = 0;
        updateWebSocketStatus(true);
        clearTimeout(connectionTimeout);

        // Store this working hostname
        localStorage.setItem('preferredWsHost', wsHost);

        // Send initial ping to verify connection
        try {
          state.websocket.send(JSON.stringify({
            type: 'ping',
            timestamp: new Date().toISOString(),
            requestId: 'initial-ping'
          }));
          console.log('Initial ping sent');
        } catch (e) {
          console.error('Error sending initial ping:', e);
        }
      };

      state.websocket.onclose = (event) => {
        console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}, Clean: ${event.wasClean}`);

        // Log more detailed information about the closure
        if (event.code === 1006) {
          console.error('Abnormal closure (1006) - This often means the server is unreachable or the connection was interrupted');
        }

        state.websocketConnected = false;
        updateWebSocketStatus(false);
        clearTimeout(connectionTimeout);

        // Try to reconnect unless HTTP mode is enabled
        if (!state.useHttpMode) {
          const reconnectDelay = Math.min(1000 * Math.pow(1.5, state.connectionAttempts), 10000);
          console.log(`Will attempt to reconnect in ${reconnectDelay}ms`);

          setTimeout(() => {
            if (!state.websocketConnected && !state.useHttpMode) {
              setupWebSocket();
            }
          }, reconnectDelay);
        }
      };

      state.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (error.target && error.target.readyState) {
          console.error(`WebSocket error occurred with readyState: ${error.target.readyState}`);
        }
      };

      state.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received message:', {
            type: data.type,
            requestId: data.requestId,
            preview: JSON.stringify(data).substring(0, 100) + '...'
          });

          if (data.type === 'grammar_result') {
            processGrammarResults(data.payload);
          } else if (data.type === 'error') {
            showError(data.message || 'Unknown error occurred');
          } else if (data.type === 'info') {
            console.log('Info from server:', data.message, data.details || {});
          } else if (data.type === 'pong') {
            console.log('Received pong response');
          }

          // Clear timeout if this was a response we were waiting for
          if (state.webSocketTimeout) {
            clearTimeout(state.webSocketTimeout);
            state.webSocketTimeout = null;
          }

          state.isProcessing = false;
          elements.checkButton.disabled = false;
          elements.loadingIndicator.classList.add('hidden');
        } catch (err) {
          console.error('Error handling WebSocket message:', err);
          showError('Failed to process response from server');
        }
      };
    } catch (err) {
      console.error('Error creating WebSocket:', err);
      updateWebSocketStatus(false);

      // Try again after a delay
      setTimeout(() => {
        if (!state.websocketConnected && !state.useHttpMode) {
          setupWebSocket();
        }
      }, 3000);
    }
  };
  
  // Update WebSocket status indicator with more detailed status
  const updateWebSocketStatus = (isConnected) => {
    elements.wsIndicator.className = 'status-indicator ' + (isConnected ? 'connected' : 'disconnected');
    
    if (state.useHttpMode) {
      elements.wsStatusText.textContent = 'Using HTTP Mode';
      elements.wsStatusText.style.color = '#4285f4'; // Blue for HTTP mode
      return;
    }
    
    if (isConnected) {
      elements.wsStatusText.textContent = 'WebSocket: Connected';
      elements.wsStatusText.style.color = '#34a853'; // Green color for connected state
    } else {
      if (state.connectionAttempts >= state.maxConnectionAttempts) {
        elements.wsStatusText.textContent = 'WebSocket: Failed to connect';
        elements.wsStatusText.style.color = '#ea4335'; // Red color for failure
      } else if (state.connectionAttempts > 0) {
        elements.wsStatusText.textContent = `WebSocket: Reconnecting (${state.connectionAttempts}/${state.maxConnectionAttempts})`;
        elements.wsStatusText.style.color = '#fbbc05'; // Yellow/amber for reconnecting
      } else {
        elements.wsStatusText.textContent = 'WebSocket: Disconnected';
        elements.wsStatusText.style.color = '#ea4335'; // Red for disconnected
      }
    }
  };
  
  // Enable HTTP-only mode
  const enableHttpMode = () => {
    console.log('Switching to HTTP-only mode');
    
    // Store preference in localStorage
    localStorage.setItem('useHttpMode', 'true');
    state.useHttpMode = true;
    
    // Update UI to show we're in HTTP mode
    updateWebSocketStatus(false);
    
    // Close any existing WebSocket connection
    if (state.websocket) {
      try {
        state.websocket.close();
      } catch (e) {
        console.warn('Error closing WebSocket when switching to HTTP mode:', e);
      }
    }
    
    // Update check button to use HTTP directly
    if (elements.checkButton) {
      elements.checkButton.removeEventListener('click', sendGrammarCheck);
      elements.checkButton.addEventListener('click', () => {
        const text = elements.textInput.value.trim();
        
        if (!text) {
          showError('Please enter some text to check.');
          return;
        }
        
        const options = {
          language: elements.languageSelector.value,
          includeTokens: elements.includeTokensCheckbox.checked,
          includeDetails: elements.includeDetailsCheckbox.checked
        };
        
        checkGrammarWithHTTP(text, options);
      });
    }
    
    // Notify the user
    const notification = document.createElement('div');
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.left = '20px';
    notification.style.backgroundColor = '#4285f4';
    notification.style.color = 'white';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '4px';
    notification.style.zIndex = '10000';
    notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    notification.textContent = 'Switched to HTTP mode. WebSockets are disabled.';
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.5s ease-out';
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 500);
    }, 5000);
  };
  
  // Handle WebSocket messages with improved error handling
  const handleWebSocketMessage = (event) => {
    // Clear WebSocket timeout if set
    if (state.webSocketTimeout) {
      clearTimeout(state.webSocketTimeout);
      state.webSocketTimeout = null;
    }
    
    try {
      const data = JSON.parse(event.data);
      
      if (data.type === 'grammar_result') {
        processGrammarResults(data.payload);
      } else if (data.type === 'error') {
        showError(data.message || 'Unknown error occurred');
      } else if (data.type === 'info') {
        console.log('Info message from server:', data.message);
      } else if (data.type === 'pong') {
        console.log('Received pong response from server');
      } else {
        console.log('Received message of unknown type:', data.type);
      }
      
      state.isProcessing = false;
      elements.checkButton.disabled = false;
      elements.loadingIndicator.classList.add('hidden');
      
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
      console.error('Raw message content:', event.data);
      showError('Failed to process response from the server');
    }
  };
  
  // Send text for grammar checking with improved error handling
  const sendGrammarCheck = () => {
    // If HTTP mode is enabled, use HTTP instead
    if (state.useHttpMode) {
      const text = elements.textInput.value.trim();
      const options = {
        language: elements.languageSelector.value,
        includeTokens: elements.includeTokensCheckbox.checked,
        includeDetails: elements.includeDetailsCheckbox.checked
      };
      
      checkGrammarWithHTTP(text, options);
      return;
    }
    
    if (!state.websocketConnected) {
      // Attempt to reconnect before showing error
      if (state.connectionAttempts < state.maxConnectionAttempts) {
        setupWebSocket();
        showError('Attempting to reconnect to server. Please try again in a moment.');
      } else {
        showError('WebSocket connection not available. Switching to HTTP mode.');
        
        // Switch to HTTP mode
        enableHttpMode();
        
        // Try HTTP immediately
        const text = elements.textInput.value.trim();
        if (text) {
          const options = {
            language: elements.languageSelector.value,
            includeTokens: elements.includeTokensCheckbox.checked,
            includeDetails: elements.includeDetailsCheckbox.checked
          };
          
          checkGrammarWithHTTP(text, options);
        }
      }
      return;
    }
    
    const text = elements.textInput.value.trim();
    
    if (!text) {
      showError('Please enter some text to check.');
      return;
    }
    
    // Show loading state
    state.isProcessing = true;
    elements.checkButton.disabled = true;
    elements.loadingIndicator.classList.remove('hidden');
    elements.resultsContainer.classList.add('hidden');
    elements.noIssuesMessage.classList.add('hidden');
    elements.errorMessage.classList.add('hidden');
    
    const message = {
      type: 'grammar_check',
      payload: {
        text,
        language: elements.languageSelector.value,
        options: {
          includeTokens: elements.includeTokensCheckbox.checked,
          includeDetails: elements.includeDetailsCheckbox.checked
        }
      }
    };
    
    try {
      const messageJson = JSON.stringify(message);
      console.log('Sending grammar check request:', messageJson.substring(0, 100) + (messageJson.length > 100 ? '...' : ''));
      state.websocket.send(messageJson);
      
      // Set a response timeout
      state.webSocketTimeout = setTimeout(() => {
        if (state.isProcessing) {
          console.log('Response timeout reached, falling back to HTTP');
          state.isProcessing = false;
          elements.checkButton.disabled = false;
          elements.loadingIndicator.classList.add('hidden');
          
          // Try HTTP fallback since WebSocket is not responding
          const options = {
            language: elements.languageSelector.value,
            includeTokens: elements.includeTokensCheckbox.checked,
            includeDetails: elements.includeDetailsCheckbox.checked
          };
          
          checkGrammarWithHTTP(text, options);
        }
      }, 10000); // 10 second timeout
      
    } catch (err) {
      console.error('Error sending WebSocket message:', err);
      showError('Failed to send request to the server: ' + err.message);
      state.isProcessing = false;
      elements.checkButton.disabled = false;
      elements.loadingIndicator.classList.add('hidden');
      
      // Try HTTP fallback on error
      const options = {
        language: elements.languageSelector.value,
        includeTokens: elements.includeTokensCheckbox.checked,
        includeDetails: elements.includeDetailsCheckbox.checked
      };
      
      checkGrammarWithHTTP(text, options);
    }
  };
  
  // HTTP fallback for grammar checking when WebSocket fails
  const checkGrammarWithHTTP = async (text, options) => {
    if (!text) {
      showError('Please enter some text to check.');
      return;
    }
    
    try {
      console.log('Using HTTP fallback for grammar check');
      
      // Show loading indicator
      elements.loadingIndicator.classList.remove('hidden');
      elements.checkButton.disabled = true;
      elements.resultsContainer.classList.add('hidden');
      elements.noIssuesMessage.classList.add('hidden');
      elements.errorMessage.classList.add('hidden');
      
      // Make an HTTP POST request to the API endpoint
      const response = await fetch('/api/grammar/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          options
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('HTTP grammar check response:', data);
      
      // Process the results
      if (data.result) {
        processGrammarResults(data.result);
      } else if (data.error) {
        showError(data.error);
      } else {
        showError('Invalid response format from server');
      }
      
      // Reset UI state
      elements.checkButton.disabled = false;
      elements.loadingIndicator.classList.add('hidden');
      
      return data;
    } catch (error) {
      console.error('Error in HTTP fallback:', error);
      showError(`Error checking grammar: ${error.message}`);
      
      // Reset UI state
      elements.checkButton.disabled = false;
      elements.loadingIndicator.classList.add('hidden');
      
      throw error;
    }
  };
  
  // Process grammar check results
  const processGrammarResults = (results) => {
    state.lastResults = results;
    
    if (!results.issues || results.issues.length === 0) {
      showNoIssuesMessage();
      return;
    }
    
    // Update statistics
    updateStatistics(results.issues);
    
    // Generate issues list
    generateIssuesList(results.issues);
    
    // Generate highlighted text
    generateHighlightedText(results.text, results.issues);
    
    // Display tokens if requested
    if (results.tokens && elements.includeTokensCheckbox.checked) {
      elements.tokensDisplay.textContent = JSON.stringify(results.tokens, null, 2);
      elements.tokensContainer.classList.remove('hidden');
    } else {
      elements.tokensContainer.classList.add('hidden');
    }
    
    elements.resultsContainer.classList.remove('hidden');
  };
  
  // Update statistics based on issues
  const updateStatistics = (issues) => {
    const counts = {
      total: issues.length,
      grammar: 0,
      style: 0,
      spelling: 0
    };
    
    issues.forEach(issue => {
      if (issue.type === 'grammar') counts.grammar++;
      else if (issue.type === 'style') counts.style++;
      else if (issue.type === 'spelling') counts.spelling++;
    });
    
    elements.totalIssues.textContent = counts.total;
    elements.grammarIssues.textContent = counts.grammar;
    elements.styleIssues.textContent = counts.style;
    elements.spellingIssues.textContent = counts.spelling;
  };
  
  // Generate list of issues
  const generateIssuesList = (issues) => {
    elements.issuesList.innerHTML = '';
    
    issues.forEach(issue => {
      const issueElement = document.createElement('div');
      issueElement.className = `issue-item ${issue.type}`;
      
      const issueTypeSpan = document.createElement('span');
      issueTypeSpan.className = `issue-type ${issue.type}`;
      issueTypeSpan.textContent = issue.type.toUpperCase();
      
      const issueMessage = document.createElement('p');
      issueMessage.className = 'issue-message';
      issueMessage.textContent = issue.message || 'No description available';
      
      const issueContext = document.createElement('div');
      issueContext.className = 'issue-context';
      issueContext.textContent = issue.context || issue.text;
      
      issueElement.appendChild(issueTypeSpan);
      issueElement.appendChild(issueMessage);
      issueElement.appendChild(issueContext);
      
      if (issue.suggestion) {
        const issueSuggestion = document.createElement('p');
        issueSuggestion.className = 'issue-correction';
        issueSuggestion.textContent = `Suggestion: ${issue.suggestion}`;
        issueElement.appendChild(issueSuggestion);
      }
      
      elements.issuesList.appendChild(issueElement);
    });
  };
  
  // Generate highlighted text with issues
  const generateHighlightedText = (text, issues) => {
    // Sort issues by start position (descending) to avoid position changes
    const sortedIssues = [...issues].sort((a, b) => b.position.start - a.position.start);
    
    let highlightedText = text;
    
    // Apply highlights
    sortedIssues.forEach(issue => {
      const { start, end } = issue.position;
      const issueText = highlightedText.substring(start, end);
      const highlightedIssue = `<span class="highlight ${issue.type}" title="${issue.message}">${issueText}</span>`;
      
      highlightedText = highlightedText.substring(0, start) + 
                       highlightedIssue + 
                       highlightedText.substring(end);
    });
    
    // Replace newlines with <br> for proper display
    highlightedText = highlightedText.replace(/\n/g, '<br>');
    elements.highlightedText.innerHTML = highlightedText;
  };
  
  // Show no issues message
  const showNoIssuesMessage = () => {
    elements.resultsContainer.classList.add('hidden');
    elements.noIssuesMessage.classList.remove('hidden');
    elements.errorMessage.classList.add('hidden');
  };
  
  // Show error message
  const showError = (message) => {
    elements.resultsContainer.classList.add('hidden');
    elements.noIssuesMessage.classList.add('hidden');
    elements.errorMessage.classList.remove('hidden');
    elements.errorDetails.textContent = message;
    elements.loadingIndicator.classList.add('hidden');
    elements.checkButton.disabled = false;
  };
  
  // Event listeners
  const setupEventListeners = () => {
    elements.checkButton.addEventListener('click', sendGrammarCheck);
    
    elements.textInput.addEventListener('keydown', (event) => {
      // Send grammar check when Ctrl+Enter or Cmd+Enter is pressed
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        sendGrammarCheck();
      }
    });
    
    elements.includeTokensCheckbox.addEventListener('change', () => {
      // If we have results and the tokens option is changed, update the display
      if (state.lastResults && state.lastResults.tokens) {
        if (elements.includeTokensCheckbox.checked) {
          elements.tokensDisplay.textContent = JSON.stringify(state.lastResults.tokens, null, 2);
          elements.tokensContainer.classList.remove('hidden');
        } else {
          elements.tokensContainer.classList.add('hidden');
        }
      }
    });
  };
  
  // Add an HTTP fallback button
  const addHttpFallbackButton = () => {
    const httpButton = document.createElement('button');
    httpButton.textContent = 'Use HTTP Mode';
    httpButton.style.position = 'fixed';
    httpButton.style.bottom = '100px';
    httpButton.style.right = '20px';
    httpButton.style.zIndex = '10001';
    httpButton.style.padding = '8px 12px';
    httpButton.style.backgroundColor = '#4285f4';
    httpButton.style.color = 'white';
    httpButton.style.border = 'none';
    httpButton.style.borderRadius = '4px';
    httpButton.style.cursor = 'pointer';
    
    httpButton.addEventListener('click', () => {
      enableHttpMode();
      
      // Try HTTP immediately if there's text
      const text = elements.textInput.value.trim();
      if (text) {
        const options = {
          language: elements.languageSelector.value,
          includeTokens: elements.includeTokensCheckbox.checked,
          includeDetails: elements.includeDetailsCheckbox.checked
        };
        
        checkGrammarWithHTTP(text, options);
      }
    });
    
    document.body.appendChild(httpButton);
    
    return httpButton;
  };
  
  // Function to test different potential WebSocket hostnames
  const testWebSocketHostnames = () => {
    console.log('=== Testing WebSocket Hostnames ===');
    
    // Get the current hostname and port
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const originalHost = window.location.hostname;
    const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
    
    console.log(`Page loaded from: ${window.location.href}`);
    console.log(`Testing WebSocket connections from hostname: ${originalHost}`);
    
    // List of hostnames to try (in preferred order)
    const hostnamesToTry = [
      'localhost',
      '127.0.0.1',
      originalHost
    ];
    
    // Filter out duplicates
    const uniqueHosts = [...new Set(hostnamesToTry)];
    
    console.log('Testing the following hostnames:', uniqueHosts);
    
    // Create a results table for easy viewing
    console.log('| Hostname | WebSocket URL | Status |');
    console.log('|----------|--------------|--------|');
    
    // Keep track of successful connections
    let successfulHosts = [];
    
    // Test each hostname
    uniqueHosts.forEach(hostname => {
      const wsUrl = `${protocol}//${hostname}:${port}/api/ws`;
      
      try {
        console.log(`Testing connection to: ${wsUrl}`);
        
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log(`| ${hostname} | ${wsUrl} | ✅ CONNECTED |`);
          successfulHosts.push(hostname);
          
          // Send a test message
          try {
            ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
          } catch (e) {
            console.error(`Error sending ping to ${wsUrl}:`, e);
          }
          
          // Close after a brief delay
          setTimeout(() => {
            ws.close();
          }, 1000);
        };
        
        ws.onerror = () => {
          console.log(`| ${hostname} | ${wsUrl} | ❌ FAILED |`);
        };
        
        ws.onmessage = (event) => {
          console.log(`Received response from ${hostname}:`, event.data);
        };
        
      } catch (err) {
        console.error(`Error testing ${wsUrl}:`, err);
        console.log(`| ${hostname} | ${wsUrl} | ❌ ERROR |`);
      }
    });
    
    // After 5 seconds, show a summary of what worked
    setTimeout(() => {
      console.log('\n=== Hostname Test Results ===');
      if (successfulHosts.length > 0) {
        console.log('✅ Working hostnames for WebSocket connections:');
        successfulHosts.forEach(host => {
          console.log(`- ${host}`);
        });
        
        // Use the first working hostname
        localStorage.setItem('preferredWsHost', successfulHosts[0]);
        
        // Reconnect using the working hostname
        if (!state.websocketConnected && !state.useHttpMode) {
          state.connectionAttempts = 0;
          setupWebSocket();
        }
      } else {
        console.log('❌ No working hostnames found for WebSocket connections.');
        console.log('Fallback to HTTP mode may be necessary.');
        
        // If we've already failed several times, switch to HTTP
        if (state.connectionAttempts >= 3) {
          enableHttpMode();
        }
      }
    }, 5000);
  };
  
  // Sample test data for development purposes
  const loadExampleText = () => {
    elements.textInput.value = 'Dette er en text med mange grammatik feil. ' + 
                              'Jeg har skrivd dette for å teste den norske grammatikksjekken. ' +
                              'Den røde bil er fin. ' +
                              'Han har ikke kommet enda, selv om han lovte å være her tidlig.';
  };
  
  // Initialize app
  const initApp = () => {
    setupEventListeners();
    
    // Check if HTTP mode was previously enabled
    if (localStorage.getItem('useHttpMode') === 'true') {
      state.useHttpMode = true;
      updateWebSocketStatus(false);
    } else {
      // Start WebSocket connection
      console.log('Initializing WebSocket connection');
      setupWebSocket();
      
      // Test different hostnames after a brief delay
      setTimeout(testWebSocketHostnames, 1000);
    }
    
    // Add HTTP fallback button
    addHttpFallbackButton();
    
    // Load example text
    loadExampleText();
    
    console.log('Norwegian Grammar Service interface initialized');
  };
  
  // Start app when DOM is loaded
  document.addEventListener('DOMContentLoaded', initApp);