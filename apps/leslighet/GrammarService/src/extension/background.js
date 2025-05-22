// extension/background.js
// The background script coordinates all activities in the extension

class NorwegianGrammarExtension {
  constructor() {
    this._connections = new Map();
    this._pendingResponses = new Map();
    this._socket = null;
    this._reconnectAttempts = 0;
    this._maxReconnectAttempts = 5;
    this._reconnectDelay = 1000;

    this.setupListeners();
    this.connectWebSocket();
  }

  setupListeners() {
    // Handle port connections from content scripts
    chrome.runtime.onConnect.addListener((port) => {
      const portId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      console.log(`New connection established: ${port.name}, id: ${portId}`);
      
      this._connections.set(portId, port);

      port.onDisconnect.addListener(() => {
        console.log(`Port disconnected: ${portId}`);
        this._connections.delete(portId);
        
        // Clean up any pending responses for this port
        for (const [requestId, { port: pendingPort }] of this._pendingResponses) {
          if (pendingPort === port) {
            this._pendingResponses.delete(requestId);
          }
        }
      });

      port.onMessage.addListener(async (message) => {
        console.log('Received message from content script:', message);
        
        try {
          const response = await this.handleMessage(message, port);
          if (message.requestId) {
            port.postMessage({
              requestId: message.requestId,
              data: response
            });
          }
        } catch (error) {
          console.error('Error handling message:', error);
          if (message.requestId) {
            port.postMessage({
              requestId: message.requestId,
              error: error.message
            });
          }
        }
      });
    });
  }

  async handleMessage(message, port) {
    const { type, data, requestId } = message;

    switch (type) {
      case 'TEXT_CHANGED':
        return await this.handleTextChanged(data, requestId);
      case 'RUN_GPT_ANALYSIS':
        return await this.handleGptAnalysis(data, requestId);
      case 'SUBMIT_FEEDBACK':
        return await this.handleUserFeedback(data, requestId);
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  }

  async handleTextChanged(data, requestId) {
    if (this._socket?.readyState === WebSocket.OPEN) {
      return new Promise((resolve, reject) => {
        this._pendingResponses.set(requestId, { resolve, reject });
        this._socket.send(JSON.stringify({
          type: 'grammar_check',
          requestId,
          payload: data
        }));

        // Set timeout for WebSocket response
        setTimeout(() => {
          if (this._pendingResponses.has(requestId)) {
            const { reject } = this._pendingResponses.get(requestId);
            this._pendingResponses.delete(requestId);
            reject(new Error('WebSocket response timeout'));
          }
        }, 10000);
      });
    } else {
      return await this.analyzeGrammarREST(data);
    }
  }

  connectWebSocket() {
    if (this._socket) {
      try {
        this._socket.close();
      } catch (e) {
        console.warn('Error closing existing WebSocket:', e);
      }
    }

    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = location.hostname === '0.0.0.0' ? 'localhost' : location.hostname;
    const port = location.port || (location.protocol === 'https:' ? '443' : '80');
    
    this._socket = new WebSocket(`${wsProtocol}//${host}:${port}/api/ws`, ['grammar-check-v1']);

    this._socket.onopen = () => {
      console.log('WebSocket connection established');
      this._reconnectAttempts = 0;

      // Send initial ping to verify connection
      this._socket.send(JSON.stringify({
        type: 'ping',
        timestamp: new Date().toISOString()
      }));
    };

    this._socket.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        console.log('Received WebSocket message:', response);
        
        if (response.requestId && this._pendingResponses.has(response.requestId)) {
          const { resolve } = this._pendingResponses.get(response.requestId);
          this._pendingResponses.delete(response.requestId);
          resolve(response.payload);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    this._socket.onclose = (event) => {
      if (event.wasClean) {
        console.log('WebSocket connection closed cleanly');
      } else {
        console.error('WebSocket connection died');
        this.attemptReconnect();
      }
    };

    this._socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  attemptReconnect() {
    if (this._reconnectAttempts >= this._maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this._reconnectAttempts++;
    const delay = this._reconnectDelay * Math.pow(2, this._reconnectAttempts - 1);
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this._reconnectAttempts})`);

    setTimeout(() => this.connectWebSocket(), delay);
  }

  async handleGptAnalysis(data, requestId) {
    if (this._socket?.readyState === WebSocket.OPEN) {
      return new Promise((resolve, reject) => {
        this._pendingResponses.set(requestId, { resolve, reject });
        this._socket.send(JSON.stringify({
          type: 'gpt_analysis',
          requestId,
          payload: data
        }));
      });
    } else {
      return await this.analyzeWithGptREST(data);
    }
  }

  async handleUserFeedback(data, requestId) {
    // Handle user feedback
    console.log('User feedback received:', data);
    return { status: 'success' };
  }

  async analyzeGrammarREST(data) {
    const response = await fetch('/api/grammar/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return await response.json();
  }

  async analyzeWithGptREST(data) {
    const response = await fetch('/api/gpt/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return await response.json();
  }
}

// Initialize the extension
const extension = new NorwegianGrammarExtension();