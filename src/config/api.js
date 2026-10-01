// API Configuration
import { Platform } from 'react-native';

// Production API base URL
const getBaseURL = () => 'https://evitals.life/api';

export const API_CONFIG = {
  BASE_URL: getBaseURL(),
  STAGING: false,
  TIMEOUT: 30000, // 30 seconds
};

// Session cookie name
export const SESSION_COOKIE_NAME = 'evitals_session';

// ========== ADD THESE HELPER FUNCTIONS ==========
// Generic fetch function with iOS session handling
export const fetchWithAuth = async (endpoint, options = {}) => {
  const url = `${getBaseURL()}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
  };
  
  // iOS-specific cookie handling
  const fetchOptions = {
    ...options,
    headers,
    credentials: 'include', // Important for cookies
    timeout: API_CONFIG.TIMEOUT,
  };
  
  try {
    const response = await fetch(url, fetchOptions);
    
    // Handle 401 - Unauthorized
    if (response.status === 401) {
      // Clear session and redirect to login
      if (Platform.OS === 'ios') {
        await clearIOSCookies();
      }
      throw new Error('Session expired. Please login again.');
    }
    
    return response;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
};

// Helper for iOS cookie management
const clearIOSCookies = async () => {
  if (Platform.OS === 'ios') {
    try {
      // This will be called from the native bridge
      const { NativeModules } = require('react-native');
      if (NativeModules.NetworkConfig) {
        NativeModules.NetworkConfig.clearCookies();
      }
    } catch (error) {
      console.log('Error clearing iOS cookies:', error);
    }
  }
};

// Specific change password API call with iOS handling
export const changePasswordAPI = async (currentPassword, newPassword) => {
  const response = await fetchWithAuth(API_ENDPOINTS.CHANGE_PASSWORD, {
    method: 'POST',
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Password change failed: ${response.status}`);
  }
  
  return await response.json();
};
// ================================================

// API Endpoints (keep your existing endpoints)
export const API_ENDPOINTS = {
  // Authentication
  LOGIN: '/users/login',
  VERIFY_OTP: '/users/verify-otp',
  LOGOUT: '/users/logout',
  GET_CURRENT_USER: '/users/me',
  SESSION_STATUS: '/users/session-status',
  CHANGE_PASSWORD: '/users/change-password',
  FORGOT_PASSWORD_OTP: '/users/forgot-password-otp',
  VERIFY_PASSWORD_RESET_OTP: '/users/verify-password-reset-otp',
  RESET_PASSWORD_OTP: '/users/reset-password-otp',

  // Patient Data
  GET_PATIENT_ME: '/patients/me',
  GET_PATIENTS: (practiceId) => `/practices/${practiceId}/patients`,
  GET_PATIENT_DETAILS: (practiceId, patientId) => `/practices/${practiceId}/patients/${patientId}/details`,
  GET_PATIENT_DETAILS_FAST: (practiceId, patientId) => `/practices/${practiceId}/patients/${patientId}/details-fast`,

  // Patient self-service vitals (mobile)
  GET_MY_BLOOD_PRESSURE: '/patients/me/measurements/blood-pressure',
  GET_MY_BLOOD_GLUCOSE: '/patients/me/measurements/blood-glucose',
  GET_MY_WEIGHT: '/patients/me/measurements/weight',

  // Patient Vitals (practice-scoped)
  GET_BLOOD_PRESSURE: (practiceId, patientId) => `/practices/${practiceId}/patients/${patientId}/measurements/blood-pressure`,
  GET_BLOOD_GLUCOSE: (practiceId, patientId) => `/practices/${practiceId}/patients/${patientId}/measurements/blood-glucose`,
  GET_WEIGHT: (practiceId, patientId) => `/practices/${practiceId}/patients/${patientId}/measurements/weight`,

  // Follow-ups
  GET_FOLLOW_UPS: (practiceId, patientId) => `/practices/${practiceId}/patients/${patientId}/follow-ups`,
  CREATE_FOLLOW_UP: (practiceId, patientId) => `/practices/${practiceId}/patients/${patientId}/follow-ups`,
  GET_FOLLOW_UP_TEMPLATES: '/settings/follow-up-templates',
  GET_FOLLOW_UP_TEMPLATE_BY_ID: (templateId) => `/settings/follow-up-templates/${templateId}`,
  GET_FOLLOW_UP_TEMPLATE_CONTENT: (templateId) => `/settings/follow-up-templates/${templateId}/content`,
  GET_PATIENT_METERS: (practiceId, patientId) => `/practices/${practiceId}/patients/${patientId}/meters`,

  // Caregiver & Provider
  GET_CAREGIVERS: (practiceId) => `/practices/${practiceId}/caregivers`,
  GET_PROVIDERS: (practiceId) => `/practices/${practiceId}/providers`,

  // Settings
  GET_ACCOUNT_SETTINGS: '/settings/account',
  TOGGLE_TWO_WAY_AUTH: (status) => `/settings/two-way-auth/${status}`,
  UPDATE_SESSION_SETTINGS: '/settings/session',
  CLEAR_CACHE: '/settings/clear-cache',

  // Practice Settings
  GET_PRACTICE_RANGES: (practiceId) => `/practices/${practiceId}/settings/ranges`,

  // Anomalies
  GET_BLOOD_PRESSURE_ANOMALIES: (practiceId, patientId) => `/practices/${practiceId}/patients/${patientId}/anomaly/blood-pressure`,
  GET_GLUCOSE_ANOMALIES: (practiceId, patientId) => `/practices/${practiceId}/patients/${patientId}/anomaly/glucose`,
  GET_WEIGHT_ANOMALIES: (practiceId, patientId) => `/practices/${practiceId}/patients/${patientId}/anomaly/weight`,

  // Chat
  CHAT_SEND: '/chat/send',
  CHAT_CONVERSATIONS: (userId) => `/chat/conversations/${userId}`,
  CHAT_HISTORY: (userId1, userId2) => `/chat/history/${userId1}/${userId2}`,
  CHAT_AVAILABLE_USERS: (practiceId, userId) => `/chat/users/${practiceId}/${userId}`,
  CHAT_UNREAD_COUNT: (userId) => `/chat/unread-count/${userId}`,
  CHAT_NOTIFICATIONS: (userId) => `/chat/notifications/${userId}`,
  CHAT_NOTIFICATIONS_READ_ALL: '/chat/notifications/read-all',
  CHAT_EDIT: (messageId) => `/chat/edit/${messageId}`,
  CHAT_DELETE: (messageId) => `/chat/delete/${messageId}`,
  CHAT_DELETE_MANY: '/chat/delete-many',
  CHAT_CONVERSATIONS_DELETE: '/chat/conversations/delete',
  CHAT_UPLOAD: '/chat/upload',
  CHAT_AUDIO: '/chat/audio',
  CHAT_AUDIO_PLAY_URL: (messageId) => `/chat/audio/${messageId}/play-url`,

  // Push notifications
  PUSH_REGISTER: '/push/register',
  PUSH_UNREGISTER: '/push/unregister',
  PUSH_STATUS: '/push/status',

  // Abnormal reading assignment & review
  GET_ASSIGNED_ABNORMAL_REVIEWS: '/patients/assigned-abnormal-reviews',
  GET_PATIENT_ABNORMAL_READINGS: (practiceId, patientId) =>
    `/practices/${practiceId}/patients/${patientId}/abnormal-readings`,
  REVIEW_PATIENT_ABNORMAL: (practiceId, patientId) =>
    `/practices/${practiceId}/patients/${patientId}/review`,
  REVIEW_MEASUREMENT: (practiceId, patientId, vitalType, measurementId) =>
    `/practices/${practiceId}/patients/${patientId}/measurements/${vitalType}/${measurementId}/review`,
  ASSIGN_MEASUREMENT: (practiceId, patientId, vitalType, measurementId) =>
    `/practices/${practiceId}/patients/${patientId}/measurements/${vitalType}/${measurementId}/assign`,
  UNASSIGN_MEASUREMENT: (practiceId, patientId, vitalType, measurementId) =>
    `/practices/${practiceId}/patients/${patientId}/measurements/${vitalType}/${measurementId}/unassign`,
  ASSIGN_PATIENT_CAREGIVER: (practiceId, patientId) =>
    `/practices/${practiceId}/patients/${patientId}/assign-caregiver`,
  ASSIGN_PATIENT_PROVIDER: (practiceId, patientId) =>
    `/practices/${practiceId}/patients/${patientId}/assign-provider`,

  // ... Add other endpoints as needed
};

// Socket.IO base URL (no /api path — socket connects to the server root)
export const SOCKET_BASE_URL = 'https://evitals.life';
