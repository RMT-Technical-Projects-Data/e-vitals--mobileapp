/**
 * WebSocket Service
 * Handles real-time vitals readings via Socket.IO
 */

import { io } from 'socket.io-client';
import { API_CONFIG } from '../config/api';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  /**
   * Initialize WebSocket connection
   * @param {Object} options - Connection options
   * @param {number} options.practiceId - Practice ID
   * @param {number} options.patientId - Patient ID (optional, for patient-specific room)
   */
  connect(options = {}) {
    const { practiceId, patientId } = options;

    // Get base URL from API config (remove /api suffix for socket connection)
    const baseUrl = API_CONFIG.BASE_URL.replace('/api', '');
    const socketUrl = baseUrl.replace('http://', 'http://').replace('https://', 'https://');

    console.log('🔌 Connecting to WebSocket:', socketUrl);

    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
      timeout: 20000,
    });

    // Connection event handlers
    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected:', this.socket.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Join patient room if practiceId and patientId are provided
      if (practiceId && patientId) {
        this.joinPatientRoom(practiceId, patientId);
      }

      // Join practice room if only practiceId is provided
      if (practiceId && !patientId) {
        this.joinPracticeRoom(practiceId);
      }

      // Notify listeners
      this.emit('connected', { socketId: this.socket.id });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      this.isConnected = false;
      this.emit('disconnected', { reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error.message);
      this.reconnectAttempts++;
      this.emit('error', { error: error.message, reconnectAttempts: this.reconnectAttempts });
    });

    this.socket.on('joined-room', (data) => {
      console.log('✅ Joined room:', data);
      this.emit('joined-room', data);
    });

    // Listen for vital reading updates
    this.socket.on('vital-reading-update', (data) => {
      // console.log('📊 Vital reading update received:', data);
      this.emit('vital-reading-update', data);
    });

    // Listen for practice-level patient vital updates
    this.socket.on('patient-vital-update', (data) => {
      // console.log('📊 Patient vital update received:', data);
      this.emit('patient-vital-update', data);
    });

    this.socket.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
      this.emit('error', { error });
    });
  }

  /**
   * Join patient room for real-time updates
   * @param {number} practiceId - Practice ID
   * @param {number} patientId - Patient ID
   */
  joinPatientRoom(practiceId, patientId) {
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ Cannot join room: WebSocket not connected');
      return;
    }

    console.log(`🏠 Joining patient room: practice-${practiceId}-patient-${patientId}`);
    this.socket.emit('join-patient-room', { practiceId, patientId });
  }

  /**
   * Join practice room for all patients in a practice
   * @param {number} practiceId - Practice ID
   */
  joinPracticeRoom(practiceId) {
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ Cannot join room: WebSocket not connected');
      return;
    }

    console.log(`🏠 Joining practice room: practice-${practiceId}`);
    this.socket.emit('join-practice-room', practiceId);
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting WebSocket...');
      this.socket.disconnect();
      this.socket = null;
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

// Export singleton instance
const websocketService = new WebSocketService();
export default websocketService;