// src/grammar/interfaces/WebSocketHandlerInterface.js
/**
 * @interface
 * Defines the contract for WebSocket handlers.
 */
class WebSocketHandlerInterface {
  /**
   * Registers a handler for a given event.
   * @param {string} event - The event name.
   * @param {Function} handler - The event handler.
   */
  on(event, handler) {
    throw new Error('Method not implemented');
  }
  
  /**
   * Sends a message via WebSocket.
   * @param {string} event - The event name.
   * @param {*} data - Data to send.
   */
  send(event, data) {
    throw new Error('Method not implemented');
  }
}

module.exports = WebSocketHandlerInterface;
