import { API_CONFIG, API_ENDPOINTS } from '../config/api';
import { getSessionCookie, buildCookieHeader, setSessionCookie, extractCookieFromResponse } from '../utils/cookieHelper';
import { isSessionExpired, handleApiError, safeParseResponse } from '../utils/errorHandler';

/**
 * Create a timeout promise
 * @param {number} ms - Timeout in milliseconds
 * @returns {Promise} - Promise that rejects after timeout
 */
const createTimeout = (ms) => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms);
  });
};

/**
 * Make API request with session cookie handling and timeout
 * @param {string} endpoint - API endpoint (relative to base URL)
 * @param {object} options - Fetch options
 * @returns {Promise<Response>} - Fetch response
 */
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_CONFIG.BASE_URL}${endpoint}`;

  // Get session cookie (session ID from backend response)
  const sessionCookie = await getSessionCookie();

  // Prepare headers
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
  };

  // Add cookie header if session exists
  // Format: evitals_session=<session_id>
  if (sessionCookie) {
    headers['Cookie'] = buildCookieHeader(sessionCookie);
  }

  // Prepare fetch options
  const fetchOptions = {
    ...options,
    headers,
    credentials: 'include', // Important for cookies (though React Native has limitations)
  };

  try {
    // Create timeout promise
    const timeoutPromise = createTimeout(API_CONFIG.TIMEOUT || 30000);

    // Race between fetch and timeout
    const response = await Promise.race([
      fetch(url, fetchOptions),
      timeoutPromise
    ]);

    // Try to extract cookie from response (may not work in React Native)
    // But also check response body for session_id (for mobile clients)
    try {
      const newCookie = extractCookieFromResponse(response);
      if (newCookie && newCookie !== sessionCookie) {
        await setSessionCookie(newCookie);
      }
    } catch (error) {
      // Ignore cookie extraction errors in React Native
      // The session should be managed via response body for mobile
    }

    return response;
  } catch (error) {
    console.error('❌ API request error:', error.message);
    console.error('📡 Failed URL:', url);

    // Provide more helpful error messages
    if (error.message.includes('timeout')) {
      throw new Error('Request timed out. Please check your internet connection and ensure the server is running.');
    } else if (error.message.includes('Network request failed') || error.message.includes('Failed to connect')) {
      throw new Error('Cannot connect to server. Please check your internet connection and try again.');
    } else {
      throw error;
    }
  }
};

const readApiResponse = async (response, defaultErrorMessage, { requireSuccess = true } = {}) => {
  const data = await safeParseResponse(response);

  if (isSessionExpired(response, data)) {
    await setSessionCookie(null);
    throw new Error('Session expired. Please login again.');
  }

  const failed = !response.ok
    || (requireSuccess && !data?.success);

  if (failed) {
    throw new Error(handleApiError(response, defaultErrorMessage, data));
  }

  return data;
};

/**
 * API Service - Centralized API calls
 */
const apiService = {
  /**
   * Login user
   * @param {string} username - Username
   * @param {string} password - Password
   * @param {boolean} remember - Remember me option
   * @returns {Promise<object>} - Login response
   */
  login: async (username, password, remember = false) => {
    // For mobile clients, add a flag so backend knows to return session_id
    const response = await apiRequest(API_ENDPOINTS.LOGIN, {
      method: 'POST',
      body: JSON.stringify({
        username: username.trim(),
        password: password.trim(),
        remember: remember ? 'on' : '',
        mobile_client: true, // Flag to indicate mobile client
      }),
    });

    // Parse response first (this consumes the response body)
    const data = await safeParseResponse(response);

    // Check response status and data
    if (!response.ok) {
      // Use data message if available, otherwise use status-based message
      const errorMessage = data?.message ||
        (response.status === 401 ? 'Invalid username or password' :
          response.status === 403 ? 'Access denied' :
            response.status === 500 ? 'Server error' :
              'Login failed');
      throw new Error(errorMessage);
    }

    if (!data || !data.success) {
      throw new Error(data?.message || 'Login failed');
    }

    // React Native doesn't expose Set-Cookie headers
    // Backend should return session_id in response body for mobile clients
    if (data.session_id) {
      await setSessionCookie(data.session_id);
      console.log('✅ Session ID stored for mobile client');
    } else {
      // Fallback: Try to extract from headers (won't work in React Native but won't crash)
      try {
        const cookie = extractCookieFromResponse(response);
        if (cookie) {
          await setSessionCookie(cookie);
        } else {
          console.warn('⚠️ Could not extract session cookie. Backend should return session_id in response body for mobile clients.');
        }
      } catch (error) {
        // Ignore cookie extraction errors in React Native
        console.warn('⚠️ Cookie extraction not available in React Native');
      }
    }

    return data;
  },

  /**
   * Verify OTP
   * @param {string} otp - OTP code
   * @returns {Promise<object>} - OTP verification response
   */
  verifyOTP: async (otp) => {
    const response = await apiRequest(API_ENDPOINTS.VERIFY_OTP, {
      method: 'POST',
      body: JSON.stringify({
        otp,
        mobile_client: true // Flag for mobile client
      }),
    });

    const data = await safeParseResponse(response);

    if (!response.ok || !data || !data.success) {
      throw new Error(handleApiError(response, 'OTP verification failed', data));
    }

    // Get session_id from response body (for mobile clients)
    if (data.session_id) {
      await setSessionCookie(data.session_id);
    } else {
      // Fallback: Try to extract from headers
      try {
        const cookie = extractCookieFromResponse(response);
        if (cookie) {
          await setSessionCookie(cookie);
        }
      } catch (error) {
        console.warn('Error extracting cookie:', error.message);
      }
    }

    return data;
  },

  /**
   * Logout user
   * @returns {Promise<boolean>} - True if successful
   */
  logout: async () => {
    try {
      await apiRequest(API_ENDPOINTS.LOGOUT, {
        method: 'POST',
      });

      // Clear session cookie
      await setSessionCookie(null);
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      // Clear cookie anyway
      await setSessionCookie(null);
      return false;
    }
  },

  /**
   * Get current user
   * @returns {Promise<object>} - User data
   */
  getCurrentUser: async () => {
    const response = await apiRequest(API_ENDPOINTS.GET_CURRENT_USER, {
      method: 'GET',
    });

    // Check for session expiry
    return readApiResponse(response, 'Failed to get user data');
  },

  /**
   * Get current patient profile (for patient role)
   * @returns {Promise<object>} - Patient data
   */
  getPatientProfile: async () => {
    const response = await apiRequest(API_ENDPOINTS.GET_PATIENT_ME, {
      method: 'GET',
    });

    return readApiResponse(response, 'Failed to get patient profile');
  },

  getLatestVitals: async () => {
    const response = await apiRequest('/patients/me/latest-vitals', {
      method: 'GET',
    });

    return readApiResponse(response, 'Failed to get latest vitals');
  },

  getMyBloodPressure: async (params = {}) => {
    let endpoint = API_ENDPOINTS.GET_MY_BLOOD_PRESSURE;
    const queryParams = new URLSearchParams();
    if (params.fromDate) queryParams.append('fromDate', params.fromDate);
    if (params.toDate) queryParams.append('toDate', params.toDate);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (queryParams.toString()) {
      endpoint += `?${queryParams.toString()}`;
    }
    const response = await apiRequest(endpoint, { method: 'GET' });
    return readApiResponse(response, 'Failed to get blood pressure data');
  },

  getMyBloodGlucose: async (params = {}) => {
    let endpoint = API_ENDPOINTS.GET_MY_BLOOD_GLUCOSE;
    const queryParams = new URLSearchParams();
    if (params.fromDate) queryParams.append('fromDate', params.fromDate);
    if (params.toDate) queryParams.append('toDate', params.toDate);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (queryParams.toString()) {
      endpoint += `?${queryParams.toString()}`;
    }
    const response = await apiRequest(endpoint, { method: 'GET' });
    return readApiResponse(response, 'Failed to get blood glucose data');
  },

  getMyWeight: async (params = {}) => {
    let endpoint = API_ENDPOINTS.GET_MY_WEIGHT;
    const queryParams = new URLSearchParams();
    if (params.fromDate) queryParams.append('fromDate', params.fromDate);
    if (params.toDate) queryParams.append('toDate', params.toDate);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (queryParams.toString()) {
      endpoint += `?${queryParams.toString()}`;
    }
    const response = await apiRequest(endpoint, { method: 'GET' });
    return readApiResponse(response, 'Failed to get weight data');
  },

  /**
   * Get patient details (with practiceId and patientId)
   * @param {number} practiceId - Practice ID
   * @param {number} patientId - Patient ID
   * @returns {Promise<object>} - Patient details
   */
  getPatientDetails: async (practiceId, patientId) => {
    const endpoint = API_ENDPOINTS.GET_PATIENT_DETAILS(practiceId, patientId);
    const response = await apiRequest(endpoint, {
      method: 'GET',
    });

    return readApiResponse(response, 'Failed to get patient details');
  },

  /**
   * Get blood pressure measurements
   * @param {number} practiceId - Practice ID
   * @param {number} patientId - Patient ID
   * @param {object} params - Query parameters (fromDate, toDate, sortBy)
   * @returns {Promise<object>} - Blood pressure data
   */
  getBloodPressure: async (practiceId, patientId, params = {}) => {
    let endpoint = API_ENDPOINTS.GET_BLOOD_PRESSURE(practiceId, patientId);

    // Add query parameters
    const queryParams = new URLSearchParams();
    if (params.fromDate) queryParams.append('fromDate', params.fromDate);
    if (params.toDate) queryParams.append('toDate', params.toDate);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);

    if (queryParams.toString()) {
      endpoint += `?${queryParams.toString()}`;
    }

    const response = await apiRequest(endpoint, {
      method: 'GET',
    });

    return readApiResponse(response, 'Failed to get blood pressure data');
  },

  /**
   * Get blood glucose measurements
   * @param {number} practiceId - Practice ID
   * @param {number} patientId - Patient ID
   * @param {object} params - Query parameters (fromDate, toDate, sortBy)
   * @returns {Promise<object>} - Blood glucose data
   */
  getBloodGlucose: async (practiceId, patientId, params = {}) => {
    let endpoint = API_ENDPOINTS.GET_BLOOD_GLUCOSE(practiceId, patientId);

    const queryParams = new URLSearchParams();
    if (params.fromDate) queryParams.append('fromDate', params.fromDate);
    if (params.toDate) queryParams.append('toDate', params.toDate);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);

    if (queryParams.toString()) {
      endpoint += `?${queryParams.toString()}`;
    }

    const response = await apiRequest(endpoint, {
      method: 'GET',
    });

    return readApiResponse(response, 'Failed to get blood glucose data');
  },

  /**
   * Get weight measurements
   * @param {number} practiceId - Practice ID
   * @param {number} patientId - Patient ID
   * @param {object} params - Query parameters (fromDate, toDate, sortBy)
   * @returns {Promise<object>} - Weight data
   */
  getWeight: async (practiceId, patientId, params = {}) => {
    let endpoint = API_ENDPOINTS.GET_WEIGHT(practiceId, patientId);

    const queryParams = new URLSearchParams();
    if (params.fromDate) queryParams.append('fromDate', params.fromDate);
    if (params.toDate) queryParams.append('toDate', params.toDate);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);

    if (queryParams.toString()) {
      endpoint += `?${queryParams.toString()}`;
    }

    const response = await apiRequest(endpoint, {
      method: 'GET',
    });

    return readApiResponse(response, 'Failed to get weight data');
  },

  /**
   * Get practice ranges/thresholds
   * @param {number} practiceId - Practice ID
   * @returns {Promise<object>} - Practice ranges
   */
  getPracticeRanges: async (practiceId) => {
    const endpoint = API_ENDPOINTS.GET_PRACTICE_RANGES(practiceId);
    const response = await apiRequest(endpoint, {
      method: 'GET',
    });

    return readApiResponse(response, 'Failed to get practice ranges');
  },

  /**
   * Get account settings
   * @returns {Promise<object>} - Account settings
   */
  getAccountSettings: async () => {
    const response = await apiRequest(API_ENDPOINTS.GET_ACCOUNT_SETTINGS, {
      method: 'GET',
    });

    return readApiResponse(response, 'Failed to get account settings');
  },

  /**
   * Toggle two-way authentication
   * @param {number} status - 0 to disable, 1 to enable
   * @returns {Promise<object>} - Response
   */
  toggleTwoWayAuth: async (status) => {
    const endpoint = API_ENDPOINTS.TOGGLE_TWO_WAY_AUTH(status);
    const response = await apiRequest(endpoint, {
      method: 'PUT',
    });

    return readApiResponse(response, 'Failed to toggle two-way authentication');
  },

  /**
   * Update session settings
   * @param {number} sessionTime - Session timeout in minutes
   * @returns {Promise<object>} - Response
   */
  updateSessionSettings: async (sessionTime) => {
    const response = await apiRequest(API_ENDPOINTS.UPDATE_SESSION_SETTINGS, {
      method: 'PUT',
      body: JSON.stringify({ lifetime: sessionTime }),
    });

    return readApiResponse(response, 'Failed to update session settings');
  },

  /**
   * Clear cache
   * @returns {Promise<object>} - Response
   */
  clearCache: async () => {
    const response = await apiRequest(API_ENDPOINTS.CLEAR_CACHE, {
      method: 'POST',
    });

    return readApiResponse(response, 'Failed to clear cache');
  },

  /**
   * Forgot password with OTP (sends OTP via email)
   * @param {string} email - User email
   * @returns {Promise<object>} - Response
   */
  forgotPasswordWithOTP: async (email) => {
    const endpoint = API_ENDPOINTS.FORGOT_PASSWORD_OTP;
    const fullUrl = `${API_CONFIG.BASE_URL}${endpoint}`;

    const response = await apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });


    const data = await safeParseResponse(response);


    if (!response.ok) {
      // If 404, provide specific error message about missing endpoint
      if (response.status === 404) {
        const errorMessage = `The OTP endpoint is not available on this server. Please ensure the backend server has the '/api/users/forgot-password-otp' endpoint deployed.`;
        console.error('📧 Forgot Password OTP Error - Endpoint not found:', {
          status: response.status,
          endpoint,
          fullUrl,
          serverResponse: data
        });
        throw new Error(errorMessage);
      }

      const errorMessage = handleApiError(response, 'Failed to send OTP', data);
      console.error('📧 Forgot Password OTP Error:', {
        status: response.status,
        errorMessage,
        responseData: data
      });
      throw new Error(errorMessage);
    }

    if (!data || !data.success) {
      const errorMessage = data?.message || 'Failed to send OTP';
      console.error('📧 Forgot Password OTP Error - Invalid response:', {
        responseData: data
      });
      throw new Error(errorMessage);
    }

    return data;
  },

  /**
   * Verify password reset OTP
   * @param {string} email - User email
   * @param {string} otp - OTP code
   * @returns {Promise<object>} - Response
   */
  verifyPasswordResetOTP: async (email, otp) => {

    // Ensure we have a session cookie before making the request
    const sessionCookie = await getSessionCookie();

    const response = await apiRequest(API_ENDPOINTS.VERIFY_PASSWORD_RESET_OTP, {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });


    const data = await safeParseResponse(response);

    // Check if response contains a session_id (for mobile clients)
    if (data && data.session_id) {
      await setSessionCookie(data.session_id);
      console.log('✅ Session ID stored after OTP verification');
    }

    if (!response.ok || !data || !data.success) {
      const errorMessage = data?.message || handleApiError(response, 'Failed to verify OTP', data);
      console.error('❌ Verify OTP error:', errorMessage);
      throw new Error(errorMessage);
    }

    return data;
  },

  /**
   * Change password (for authenticated users)
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<object>} - Response
   */
  changePassword: async (currentPassword, newPassword) => {
    const response = await apiRequest(API_ENDPOINTS.CHANGE_PASSWORD, {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = await safeParseResponse(response);

    if (!response.ok || !data || !data.success) {
      const errorMessage = data?.message || handleApiError(response, 'Failed to change password', data);
      throw new Error(errorMessage);
    }

    return data;
  },

  /**
   * Reset password with OTP (after OTP verification)
   * @param {string} email - User email
   * @param {string} password - New password
   * @returns {Promise<object>} - Response
   */
  resetPasswordWithOTP: async (email, password) => {

    // Ensure we have a session cookie before making the request
    const sessionCookie = await getSessionCookie();

    const response = await apiRequest(API_ENDPOINTS.RESET_PASSWORD_OTP, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });


    const data = await safeParseResponse(response);

    if (!response.ok || !data || !data.success) {
      // Get the actual error message from the backend
      const errorMessage = data?.message || handleApiError(response, 'Failed to reset password', data);
      console.error('❌ Reset password error:', errorMessage);
      console.error('❌ Response status:', response.status);
      console.error('❌ Response data:', data);
      throw new Error(errorMessage);
    }

    return data;
  },

  /**
   * Get blood pressure anomalies
   * @param {number} practiceId - Practice ID
   * @param {number} patientId - Patient ID
   * @returns {Promise<object>} - Anomalies data
   */
  getBloodPressureAnomalies: async (practiceId, patientId) => {
    let endpoint = API_ENDPOINTS.GET_BLOOD_PRESSURE_ANOMALIES(practiceId, patientId);

    // Check if endpoint is defined (in case config wasn't updated yet in some environments)
    if (!endpoint) {
      endpoint = `/practices/${practiceId}/patients/${patientId}/anomaly/blood-pressure`;
    }

    const response = await apiRequest(endpoint, {
      method: 'GET',
    });

    return readApiResponse(response, 'Failed to get anomalies');
  },

  /**
   * Get glucose anomalies
   * @param {number} practiceId - Practice ID
   * @param {number} patientId - Patient ID
   * @returns {Promise<object>} - Anomalies data
   */
  getGlucoseAnomalies: async (practiceId, patientId) => {
    let endpoint = API_ENDPOINTS.GET_GLUCOSE_ANOMALIES(practiceId, patientId);

    if (!endpoint) {
      endpoint = `/practices/${practiceId}/patients/${patientId}/anomaly/glucose`;
    }

    const response = await apiRequest(endpoint, {
      method: 'GET',
    });

    return readApiResponse(response, 'Failed to get glucose anomalies');
  },

  getPatientDetailsFast: async (practiceId, patientId) => {
    const endpoint = API_ENDPOINTS.GET_PATIENT_DETAILS_FAST(practiceId, patientId);
    const response = await apiRequest(endpoint, { method: 'GET' });

    return readApiResponse(response, 'Failed to get patient details');
  },

  getPatients: async (practiceId, params = {}) => {
    let endpoint = `/practices/${practiceId}/patients`;
    const queryParams = [];
    if (params.caregiverId) {
      queryParams.push(`caregiverId=${params.caregiverId}`);
    }
    if (params.providerId) {
      queryParams.push(`providerId=${params.providerId}`);
    }
    if (params.limit) {
      queryParams.push(`limit=${params.limit}`);
    }
    if (params.page) {
      queryParams.push(`page=${params.page}`);
    }
    if (params.search) {
      queryParams.push(`search=${encodeURIComponent(params.search)}`);
    }
    if (params.status) {
      queryParams.push(`status=${params.status}`);
    }
    if (params.includeDashboardEnrichment) {
      queryParams.push('includeDashboardEnrichment=true');
    }
    if (params.includeDashboardStats) {
      queryParams.push('includeDashboardStats=true');
    }
    if (params.statsOnly) {
      queryParams.push('statsOnly=true');
    }

    if (queryParams.length > 0) {
      endpoint += `?${queryParams.join('&')}`;
    }

    const response = await apiRequest(endpoint, {
      method: 'GET',
    });

    return readApiResponse(response, 'Failed to get patients list');
  },

  /**
   * Get follow-ups for a specific patient
   * GET /practices/:practiceId/patients/:patientId/follow-ups
   */
  getFollowUps: async (practiceId, patientId) => {
    const endpoint = API_ENDPOINTS.GET_FOLLOW_UPS(practiceId, patientId);
    const response = await apiRequest(endpoint, { method: 'GET' });

    return readApiResponse(response, 'Failed to get follow-ups');
  },

  createFollowUp: async (practiceId, patientId, followUpData) => {
    const endpoint = API_ENDPOINTS.CREATE_FOLLOW_UP(practiceId, patientId);
    const response = await apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(followUpData),
    });

    return readApiResponse(response, 'Failed to create follow-up');
  },

  /**
   * Get follow-up templates
   * GET /settings/follow-up-templates
   */
  getFollowUpTemplates: async () => {
    const endpoint = API_ENDPOINTS.GET_FOLLOW_UP_TEMPLATES;
    const response = await apiRequest(endpoint, { method: 'GET' });

    return readApiResponse(response, 'Failed to get follow-up templates');
  },

  /**
   * Get patient meters (device serial numbers)
   * GET /practices/:practiceId/patients/:patientId/meters
   */
  getPatientMeters: async (practiceId, patientId) => {
    const endpoint = API_ENDPOINTS.GET_PATIENT_METERS(practiceId, patientId);
    const response = await apiRequest(endpoint, { method: 'GET' });

    return readApiResponse(response, 'Failed to get patient meters');
  },

  /**
   * Get all providers for a practice
   * GET /practices/:practiceId/providers
   */
  getProviders: async (practiceId, params = {}) => {
    let endpoint = API_ENDPOINTS.GET_PROVIDERS(practiceId);
    const queryParams = [];
    if (params.search) queryParams.push(`search=${encodeURIComponent(params.search)}`);
    if (params.limit) queryParams.push(`limit=${params.limit}`);
    if (params.page) queryParams.push(`page=${params.page}`);
    if (queryParams.length > 0) {
      endpoint += `?${queryParams.join('&')}`;
    }

    const response = await apiRequest(endpoint, { method: 'GET' });

    return readApiResponse(response, 'Failed to get providers list');
  },

  /**
   * Get total patient count for a practice (lightweight, no enrichment)
   * Returns: { total, patients }
   */
  getTotalPatients: async (practiceId) => {
    const endpoint = `/practices/${practiceId}/patients?limit=1`;
    const response = await apiRequest(endpoint, { method: 'GET' });

    return readApiResponse(response, 'Failed to get total patients count');
  },

  getChatConversations: async (userId) => {
    const response = await apiRequest(API_ENDPOINTS.CHAT_CONVERSATIONS(userId), { method: 'GET' });
    return readApiResponse(response, 'Failed to load conversations');
  },

  getChatAvailableUsers: async (practiceId, userId) => {
    const response = await apiRequest(API_ENDPOINTS.CHAT_AVAILABLE_USERS(practiceId, userId), { method: 'GET' });
    return readApiResponse(response, 'Failed to load contacts');
  },

  getChatMessages: async (userId1, userId2) => {
    const response = await apiRequest(API_ENDPOINTS.CHAT_HISTORY(userId1, userId2), { method: 'GET' });
    return readApiResponse(response, 'Failed to load messages');
  },

  sendChatMessage: async (payload) => {
    const response = await apiRequest(API_ENDPOINTS.CHAT_SEND, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return readApiResponse(response, 'Failed to send message');
  },
};

export default apiService;