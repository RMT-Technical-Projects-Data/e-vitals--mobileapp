/**
 * Vitals Realtime Service
 * Unified service for handling real-time vitals readings
 * Supports both WebSocket and SSE (prefers WebSocket for React Native)
 */

import websocketService from './websocketService';
// import sseService from './sseService'; // Uncomment if using SSE

class VitalsRealtimeService {
  constructor() {
    this.useWebSocket = true; // Prefer WebSocket for React Native
    this.currentPracticeId = null;
    this.currentPatientId = null;
    this.listeners = new Map();
  }

  /**
   * Connect to real-time vitals updates
   * @param {Object} options - Connection options
   * @param {number} options.practiceId - Practice ID (required)
   * @param {number} options.patientId - Patient ID (optional, for patient-specific updates)
   * @param {string} options.method - 'websocket' or 'sse' (default: 'websocket')
   */
  connect(options = {}) {
    const { practiceId, patientId, method = 'websocket' } = options;

    if (!practiceId) {
      console.error('❌ Practice ID is required');
      return;
    }

    this.currentPracticeId = practiceId;
    this.currentPatientId = patientId;
    this.useWebSocket = method === 'websocket' || method !== 'sse';

    if (this.useWebSocket) {
      // Use WebSocket (recommended for React Native)
      websocketService.connect({ practiceId, patientId });

      // Set up WebSocket listeners
      this.setupWebSocketListeners();
    } else {
      // Use SSE (requires polyfill for React Native)
      // sseService.connect({ practiceId, patientId });
      // this.setupSSEListeners();
      console.warn('⚠️ SSE not fully supported in React Native. Using WebSocket instead.');
      this.useWebSocket = true;
      websocketService.connect({ practiceId, patientId });
      this.setupWebSocketListeners();
    }
  }

  /**
   * Set up WebSocket event listeners
   */
  setupWebSocketListeners() {
    // Listen for connection events
    websocketService.on('connected', (data) => {
      console.log('✅ Vitals realtime connected:', data);
      this.emit('connected', data);
    });

    websocketService.on('disconnected', (data) => {
      console.log('❌ Vitals realtime disconnected:', data);
      this.emit('disconnected', data);
    });

    // Listen for vital reading updates
    websocketService.on('vital-reading-update', (data) => {
      // console.log('📊 Vital reading update:', data);
      this.emit('vital-reading-update', data);
    });

    websocketService.on('patient-vital-update', (data) => {
      // console.log('📊 Patient vital update:', data);
      this.emit('patient-vital-update', data);
    });

    websocketService.on('error', (error) => {
      console.error('❌ Vitals realtime error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Disconnect from real-time updates
   */
  disconnect() {
    if (this.useWebSocket) {
      websocketService.disconnect();
    } else {
      // sseService.disconnect();
    }

    this.currentPracticeId = null;
    this.currentPatientId = null;
    this.listeners.clear();
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name ('connected', 'disconnected', 'vital-reading-update', 'patient-vital-update', 'error')
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
  isConnected() {
    if (this.useWebSocket) {
      return websocketService.getConnectionStatus();
    }
    // return sseService.getConnectionStatus();
    return false;
  }

  /**
   * Get current practice and patient IDs
   * @returns {Object}
   */
  getCurrentConnection() {
    return {
      practiceId: this.currentPracticeId,
      patientId: this.currentPatientId,
      method: this.useWebSocket ? 'websocket' : 'sse'
    };
  }
}

// Export singleton instance
const vitalsRealtimeService = new VitalsRealtimeService();
export default vitalsRealtimeService;