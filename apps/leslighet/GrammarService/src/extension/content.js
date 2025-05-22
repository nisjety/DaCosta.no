// extension/content.js
// Handles text field monitoring and grammar feedback UI

class NorwegianGrammarChecker {
  constructor() {
    // Message port management
    this._port = null;
    this._pendingRequests = new Map();
    this._messageQueue = [];
    this._isConnected = false;
    this._reconnectAttempts = 0;
    this._maxReconnectAttempts = 5;

    this.initializeI18n()
      .then(() => this.setupMessagePort())
      .catch(err => console.error('Failed to initialize:', err));
  }

  async initializeI18n() {
    try {
      await i18next.init({
        debug: true,
        lng: 'nb-NO',
        fallbackLng: ['en'],
        ns: ['translation'],
        defaultNS: ['translation'],
        resources: {
          'nb-NO': {
            translation: {
              // Add translations here
            }
          }
        }
      });
      console.log('i18next initialized', i18next.options);
    } catch (err) {
      console.error('Failed to initialize i18next:', err);
    }
  }

  setupMessagePort() {
    if (this._port) {
      try {
        this._port.disconnect();
      } catch (e) {
        console.warn('Error disconnecting existing port:', e);
      }
    }

    // Create a long-lived connection
    this._port = chrome.runtime.connect({ name: 'grammar-checker' });
    
    this._port.onDisconnect.addListener(() => {
      console.log('Port disconnected, checking chrome.runtime.lastError:', chrome.runtime.lastError);
      this._isConnected = false;
      this._port = null;

      // Attempt to reconnect if not at max attempts
      if (this._reconnectAttempts < this._maxReconnectAttempts) {
        this._reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts - 1), 10000);
        console.log(`Will attempt to reconnect in ${delay}ms (attempt ${this._reconnectAttempts})`);
        setTimeout(() => this.setupMessagePort(), delay);
      } else {
        console.error('Max reconnection attempts reached');
      }
    });

    this._port.onMessage.addListener((response) => {
      console.log('Received message from background:', response);
      
      if (response.requestId) {
        const { resolve, reject } = this._pendingRequests.get(response.requestId) || {};
        if (resolve) {
          this._pendingRequests.delete(response.requestId);
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.data);
          }
        }
      }
    });

    this._isConnected = true;
    this._reconnectAttempts = 0;

    // Process any queued messages
    while (this._messageQueue.length > 0) {
      const { message, resolve, reject } = this._messageQueue.shift();
      this.sendMessage(message).then(resolve).catch(reject);
    }
  }

  async sendMessage(message) {
    return new Promise((resolve, reject) => {
      if (!this._isConnected || !this._port) {
        // Queue message if not connected
        this._messageQueue.push({ message, resolve, reject });
        if (!this._port) {
          this.setupMessagePort();
        }
        return;
      }

      const requestId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      this._pendingRequests.set(requestId, { resolve, reject });

      try {
        this._port.postMessage({ ...message, requestId });
        
        // Set up timeout to clean up abandoned requests
        setTimeout(() => {
          if (this._pendingRequests.has(requestId)) {
            this._pendingRequests.delete(requestId);
            reject(new Error('Request timed out'));
          }
        }, 30000); // 30 second timeout
      } catch (err) {
        this._pendingRequests.delete(requestId);
        reject(err);
      }
    });
  }

  // ... rest of the class methods ...
}

// Initialize the grammar checker
const grammarChecker = new NorwegianGrammarChecker();