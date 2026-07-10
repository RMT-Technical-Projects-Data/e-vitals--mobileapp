/**
 * SSE (Server-Sent Events) Service
 * Handles real-time vitals readings via SSE
 */

import { API_CONFIG } from '../config/api';

class SSEService {
  constructor() {
    this.eventSource = null;
    this.isConnected = false;
    this.listeners = new Map();
    this.reconnectTimeout = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  /**
   * Initialize SSE connection
   * @param {Object} options - Connection options
   * @param {number} options.practiceId - Practice ID
   * @param {number} options.patientId - Patient ID (optional, for patient-specific stream)
   */
  connect(options = {}) {
    const { practiceId, patientId } = options;

    if (!practiceId) {
      console.error('❌ Practice ID is required for SSE connection');
      return;
    }

    // Build SSE URL
    let sseUrl;
    if (patientId) {
      // Patient-specific stream
      sseUrl = `${API_CONFIG.BASE_URL}/vitals/sse/${practiceId}/${patientId}`;
    } else {
      // Practice-level stream
      sseUrl = `${API_CONFIG.BASE_URL}/vitals/sse/practice/${practiceId}`;
    }

    console.log('🔌 Connecting to SSE:', sseUrl);

    try {
      // Close existing connection if any
      this.disconnect();

      // Create new EventSource
      this.eventSource = new EventSource(sseUrl);

      // Connection opened
      this.eventSource.onopen = () => {
        console.log('✅ SSE connection opened');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected', { url: sseUrl });
      };

      // Message received
      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // console.log('📊 SSE message received:', data);

          // Handle different message types
          switch (data.type) {
            case 'connected':
              this.emit('connected', data);
              break;
            case 'vital-reading-update':
            case 'patient-vital-update':
              this.emit('vital-reading-update', data);
              break;
            case 'heartbeat':
              // Just acknowledge heartbeat, no need to emit
              break;
            case 'error':
              this.emit('error', data);
              break;
            default:
              this.emit('message', data);
          }
        } catch (error) {
          console.error('❌ Error parsing SSE message:', error);
        }
      };

      // Error occurred
      this.eventSource.onerror = (error) => {
        console.error('❌ SSE error:', error);
        this.isConnected = false;
        this.reconnectAttempts++;

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          // Attempt to reconnect after delay
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
          console.log(`🔄 Reconnecting SSE in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

          this.reconnectTimeout = setTimeout(() => {
            this.connect(options);
          }, delay);
        } else {
          console.error('❌ Max reconnect attempts reached');
          this.emit('error', {
            error: 'Max reconnect attempts reached',
            reconnectAttempts: this.reconnectAttempts
          });
        }

        this.emit('error', { error, reconnectAttempts: this.reconnectAttempts });
      };

    } catch (error) {
      console.error('❌ Failed to create SSE connection:', error);
      this.emit('error', { error: error.message });
    }
  }

  /**
   * Disconnect SSE
   */
  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.eventSource) {
      console.log('🔌 Disconnecting SSE...');
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
      this.listeners.clear();
    }
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function (optional)
   */
  off(event, callback) {
    if (!callback) {
      // Remove all listeners for this event
      this.listeners.delete(event);
      return;
    }

    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} callback:`, error);
        }
      });
    }
  }

  /**
   * Get connection status
   * @returns {boolean}
   */
  getConnectionStatus() {
    return this.isConnected;
  }
}

// Note: EventSource is not available in React Native by default
// For React Native, install: npm install react-native-event-source
// Then import: import EventSource from 'react-native-event-source';
// 
// Alternatively, use WebSocket service which works natively in React Native
// WebSocket is recommended for React Native apps

// Export singleton instance
const sseService = new SSEService();
export default sseService;