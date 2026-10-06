import { API_CONFIG, API_ENDPOINTS } from '../config/api';
import { getSessionCookie, setSessionCookie, extractCookieFromResponse } from '../utils/cookieHelper';
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
    // Do not rely on the native User-Agent: it differs between iOS and Android.
    // The API uses this to return the session id in JSON for React Native.
    'X-Mobile-Client': 'true',
    ...options.headers,
  };

  // React Native stores the raw session ID returned by the API. Express-session
  // expects a signed cookie, so send the raw ID in a dedicated header; the
  // backend converts it to its signed session cookie before loading the session.
  if (sessionCookie) {
    headers['X-EVitals-Session-Id'] = sessionCookie;
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
        (response.status === 401 ? 'Invalid email/username or password' :
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
        mobile_client: true, // Flag for mobile client
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

  /** Check whether the persisted mobile session is still valid. */
  checkSession: async () => {
    const response = await apiRequest(API_ENDPOINTS.SESSION_STATUS, {
      method: 'GET',
    });

    const data = await safeParseResponse(response);
    if (!response.ok) {
      throw new Error(handleApiError(response, 'Failed to verify session', data));
    }
    return data;
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
      body: JSON.stringify({ email, mobile_client: true }),
    });


    const data = await safeParseResponse(response);

    if (!response.ok) {
      // A registered-email lookup also returns 404. Preserve its useful API
      // message instead of incorrectly claiming that the endpoint is missing.
      if (response.status === 404) {
        throw new Error(data?.message || 'No account was found for this email address.');
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

    // Password-reset OTPs are authorized by a temporary server session. React
    // Native cannot reliably retain Set-Cookie, so keep the returned session id
    // for the verify and reset requests that follow.
    if (data.session_id) {
      await setSessionCookie(data.session_id);
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
    const response = await apiRequest(API_ENDPOINTS.VERIFY_PASSWORD_RESET_OTP, {
      method: 'POST',
      body: JSON.stringify({ email, otp, mobile_client: true }),
    });


    const data = await safeParseResponse(response);

    if (!response.ok || !data || !data.success) {
      const errorMessage = data?.message || handleApiError(response, 'Failed to verify OTP', data);
      console.error('❌ Verify OTP error:', errorMessage);
      throw new Error(errorMessage);
    }

    // Verification refreshes the same password-reset session. Persist its id
    // before the next request so the API can see the verified OTP state.
    if (data.session_id) {
      await setSessionCookie(data.session_id);
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
  resetPasswordWithOTP: async (email, password, resetToken) => {
    const response = await apiRequest(API_ENDPOINTS.RESET_PASSWORD_OTP, {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        reset_token: resetToken,
        mobile_client: true,
      }),
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
    const isProgramFiltered = !params.standardList && (!!params.dashboardFilter || !!params.program);
    let endpoint = isProgramFiltered
      ? `/practices/${practiceId}/patients/program-filtered`
      : `/practices/${practiceId}/patients`;
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
    if (params.dashboardFilter) {
      queryParams.push(`dashboardFilter=${encodeURIComponent(params.dashboardFilter)}`);
    }
    if (params.program) {
      queryParams.push(`program=${encodeURIComponent(params.program)}`);
    }
    if (params.includeDashboardEnrichment) {
      queryParams.push('includeDashboardEnrichment=true');
    }
    if (params.includeUploadFlags) {
      queryParams.push('includeUploadFlags=true');
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
   * Get practice providers
   * GET /practices/:practiceId/providers
   */
  getPracticeProviders: async (practiceId) => {
    const response = await apiRequest(`/practices/${practiceId}/providers`, { method: 'GET' });
    return readApiResponse(response, 'Failed to get practice providers');
  },

  /**
   * Get practice caregivers
   * GET /practices/:practiceId/caregivers
   */
  getPracticeCaregivers: async (practiceId) => {
    const response = await apiRequest(`/practices/${practiceId}/caregivers`, { method: 'GET' });
    return readApiResponse(response, 'Failed to get practice caregivers');
  },

  /**
   * Lookup patients with filters
   * GET /practices/:practiceId/lookup
   */
  lookupPatient: async (practiceId, params = {}) => {
    let endpoint = `/practices/${practiceId}/lookup`;
    const queryParams = [];
    if (params.lastName) queryParams.push(`lastName=${encodeURIComponent(params.lastName)}`);
    if (params.firstName) queryParams.push(`firstName=${encodeURIComponent(params.firstName)}`);
    if (params.phone) queryParams.push(`phone=${encodeURIComponent(params.phone)}`);
    if (params.caregiver) queryParams.push(`caregiver=${params.caregiver}`);
    if (params.provider) queryParams.push(`provider=${params.provider}`);
    if (params.status) queryParams.push(`status=${params.status}`);
    if (params.dobOperator) queryParams.push(`dobOperator=${params.dobOperator}`);
    if (params.dobFrom) queryParams.push(`dobFrom=${encodeURIComponent(params.dobFrom)}`);
    if (params.dobTo) queryParams.push(`dobTo=${encodeURIComponent(params.dobTo)}`);
    if (params.rpmStartDate) queryParams.push(`billingStartRpm=${encodeURIComponent(params.rpmStartDate)}`);
    if (params.rpmEndDate) queryParams.push(`billingEndRpm=${encodeURIComponent(params.rpmEndDate)}`);
    if (params.programEnrolled) queryParams.push(`programEnrolled=${params.programEnrolled}`);
    if (params.vitals) {
      const vVal = Array.isArray(params.vitals) ? params.vitals.join(',') : params.vitals;
      queryParams.push(`vitals=${encodeURIComponent(vVal)}`);
    }
    if (params.serialNumber) queryParams.push(`serialNumber=${encodeURIComponent(params.serialNumber)}`);
    if (params.search) queryParams.push(`search=${encodeURIComponent(params.search)}`);
    if (params.limit) queryParams.push(`limit=${params.limit}`);
    if (params.page) queryParams.push(`page=${params.page}`);

    if (queryParams.length > 0) {
      endpoint += `?${queryParams.join('&')}`;
    }

    const response = await apiRequest(endpoint, { method: 'GET' });
    return readApiResponse(response, 'Failed to lookup patients');
  },

  /**
   * Lookup patients by RPM date range
   * GET /practices/:practiceId/lookup-rpm
   */
  lookupPatientRPM: async (practiceId, params = {}) => {
    let endpoint = `/practices/${practiceId}/lookup-rpm`;
    const queryParams = [];
    if (params.startDate) queryParams.push(`billingStartRpm=${encodeURIComponent(params.startDate)}`);
    if (params.endDate) queryParams.push(`billingEndRpm=${encodeURIComponent(params.endDate)}`);
    if (params.search) queryParams.push(`search=${encodeURIComponent(params.search)}`);
    if (params.limit) queryParams.push(`limit=${params.limit}`);
    if (params.page) queryParams.push(`page=${params.page}`);

    if (queryParams.length > 0) {
      endpoint += `?${queryParams.join('&')}`;
    }

    const response = await apiRequest(endpoint, { method: 'GET' });
    return readApiResponse(response, 'Failed to lookup patients by RPM date');
  },

  /**
   * Lookup patients by CCM date range
   * GET /practices/:practiceId/lookup-ccm
   */
  lookupPatientCCM: async (practiceId, params = {}) => {
    let endpoint = `/practices/${practiceId}/lookup-ccm`;
    const queryParams = [];
    if (params.startDate) queryParams.push(`startDate=${params.startDate}`);
    if (params.endDate) queryParams.push(`endDate=${params.endDate}`);
    if (params.search) queryParams.push(`search=${encodeURIComponent(params.search)}`);
    if (params.limit) queryParams.push(`limit=${params.limit}`);
    if (params.page) queryParams.push(`page=${params.page}`);

    if (queryParams.length > 0) {
      endpoint += `?${queryParams.join('&')}`;
    }

    const response = await apiRequest(endpoint, { method: 'GET' });
    return readApiResponse(response, 'Failed to lookup patients by CCM date');
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
   * Get follow-up query records with filters
   * GET /care-management/follow-up-query
   */
  getFollowUpQuery: async (params = {}) => {
    let endpoint = `/care-management/follow-up-query`;
    const queryParams = [];
    if (params.practiceId) queryParams.push(`practiceId=${params.practiceId}`);
    if (params.lastName) queryParams.push(`lastName=${encodeURIComponent(params.lastName)}`);
    if (params.firstName) queryParams.push(`firstName=${encodeURIComponent(params.firstName)}`);
    if (params.phone) queryParams.push(`phone=${encodeURIComponent(params.phone)}`);
    if (params.caregiver) queryParams.push(`practiceCaregiverId=${params.caregiver}`);
    if (params.provider) queryParams.push(`providerId=${params.provider}`);
    if (params.status) queryParams.push(`status=${params.status}`);
    if (params.vitals) queryParams.push(`vitals=${params.vitals}`);
    if (params.dobOperator) queryParams.push(`dobOperator=${params.dobOperator}`);
    if (params.dobFrom) queryParams.push(`dobFrom=${params.dobFrom}`);
    if (params.dobTo) queryParams.push(`dobTo=${params.dobTo}`);
    if (params.serialNumber) queryParams.push(`serialNumber=${encodeURIComponent(params.serialNumber)}`);
    if (params.limit) queryParams.push(`limit=${params.limit}`);
    if (params.page) queryParams.push(`page=${params.page}`);

    if (queryParams.length > 0) {
      endpoint += `?${queryParams.join('&')}`;
    }

    const response = await apiRequest(endpoint, { method: 'GET' });
    return readApiResponse(response, 'Failed to query follow-ups');
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
   * Get single follow-up template by ID
   * GET /settings/follow-up-templates/:templateId
   */
  getFollowUpTemplateById: async (templateId) => {
    const endpoint = API_ENDPOINTS.GET_FOLLOW_UP_TEMPLATE_BY_ID(templateId);
    const response = await apiRequest(endpoint, { method: 'GET' });

    return readApiResponse(response, 'Failed to get follow-up template');
  },

  /**
   * Get template content by ID
   * GET /settings/follow-up-templates/:templateId/content
   */
  getFollowUpTemplateContent: async (templateId) => {
    const endpoint = API_ENDPOINTS.GET_FOLLOW_UP_TEMPLATE_CONTENT(templateId);
    const response = await apiRequest(endpoint, { method: 'GET' });

    return readApiResponse(response, 'Failed to get follow-up template content');
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
  getTotalPatients: async (practiceId, params = {}) => {
    let endpoint = `/practices/${practiceId}/patients?limit=1`;
    const queryParams = [];
    Object.keys(params).forEach((key) => {
      if (params[key] !== undefined && params[key] !== null) {
        queryParams.push(`${key}=${encodeURIComponent(params[key])}`);
      }
    });
    if (queryParams.length > 0) {
      endpoint += `&${queryParams.join('&')}`;
    }
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

  checkChatSendAccess: async ({ from_user_id, to_user_id, practice_id }) => {
    const params = new URLSearchParams({
      from_user_id: String(from_user_id),
      to_user_id: String(to_user_id),
    });
    if (practice_id) params.set('practice_id', String(practice_id));
    const response = await apiRequest(`${API_ENDPOINTS.CHAT_CAN_SEND}?${params.toString()}`, { method: 'GET' });
    return readApiResponse(response, 'Failed to check chat access');
  },

  sendChatMessage: async (payload) => {
    const response = await apiRequest(API_ENDPOINTS.CHAT_SEND, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return readApiResponse(response, 'Failed to send message');
  },

  getChatUnreadCount: async (userId) => {
    const response = await apiRequest(API_ENDPOINTS.CHAT_UNREAD_COUNT(userId), { method: 'GET' });
    return readApiResponse(response, 'Failed to load unread count', { requireSuccess: false });
  },

  getChatNotifications: async (userId) => {
    const response = await apiRequest(`${API_ENDPOINTS.CHAT_NOTIFICATIONS(userId)}?unread=1&limit=50`, { method: 'GET' });
    return readApiResponse(response, 'Failed to load message notifications', { requireSuccess: false });
  },

  getInAppNotifications: async () => {
    const response = await apiRequest('/tickets/notifications?unread=1', { method: 'GET' });
    return readApiResponse(response, 'Failed to load notifications', { requireSuccess: false });
  },

  getInAppNotificationCount: async () => {
    const response = await apiRequest('/tickets/notifications/count', { method: 'GET' });
    return readApiResponse(response, 'Failed to load notification count', { requireSuccess: false });
  },

  markInAppNotificationRead: async (notificationId) => {
    const response = await apiRequest(`/tickets/notifications/${notificationId}/read`, { method: 'PATCH' });
    return readApiResponse(response, 'Failed to mark notification read', { requireSuccess: false });
  },

  markChatNotificationsRead: async (userId) => {
    const response = await apiRequest(API_ENDPOINTS.CHAT_NOTIFICATIONS_READ_ALL, {
      method: 'PATCH',
      body: JSON.stringify({ userId }),
    });
    return readApiResponse(response, 'Failed to mark notifications read', { requireSuccess: false });
  },

  registerPushToken: async ({ fcm_token, platform, device_id }) => {
    const response = await apiRequest(API_ENDPOINTS.PUSH_REGISTER, {
      method: 'POST',
      body: JSON.stringify({ fcm_token, platform, device_id }),
    });
    return readApiResponse(response, 'Failed to register push token', { requireSuccess: false });
  },

  unregisterPushToken: async ({ fcm_token }) => {
    const response = await apiRequest(API_ENDPOINTS.PUSH_UNREGISTER, {
      method: 'POST',
      body: JSON.stringify({ fcm_token }),
    });
    return readApiResponse(response, 'Failed to unregister push token', { requireSuccess: false });
  },

  editChatMessage: async (messageId, userId, newMessage) => {
    const response = await apiRequest(API_ENDPOINTS.CHAT_EDIT(messageId), {
      method: 'PUT',
      body: JSON.stringify({ userId, newMessage }),
    });
    return readApiResponse(response, 'Failed to edit message');
  },

  deleteChatMessage: async (messageId, userId, mode = 'me') => {
    const response = await apiRequest(API_ENDPOINTS.CHAT_DELETE(messageId), {
      method: 'DELETE',
      body: JSON.stringify({ userId, mode }),
    });
    return readApiResponse(response, 'Failed to delete message');
  },

  deleteChatMessages: async ({ userId, mode = 'me', messageIds }) => {
    const response = await apiRequest(API_ENDPOINTS.CHAT_DELETE_MANY, {
      method: 'POST',
      body: JSON.stringify({ userId, mode, messageIds }),
    });
    return readApiResponse(response, 'Failed to delete messages');
  },

  deleteChatConversations: async (userId, otherUserIds) => {
    const response = await apiRequest(API_ENDPOINTS.CHAT_CONVERSATIONS_DELETE, {
      method: 'POST',
      body: JSON.stringify({ userId, otherUserIds }),
    });
    return readApiResponse(response, 'Failed to delete conversation');
  },

  uploadChatFile: async (formData) => {
    const url = `${API_CONFIG.BASE_URL}${API_ENDPOINTS.CHAT_UPLOAD}`;
    const sessionCookie = await getSessionCookie();
    const headers = { Accept: 'application/json', 'X-Mobile-Client': 'true' };
    if (sessionCookie) headers['X-EVitals-Session-Id'] = sessionCookie;
    const response = await fetch(url, { method: 'POST', headers, body: formData });
    return readApiResponse(response, 'Failed to upload file');
  },

  uploadChatAudio: async ({
    uri,
    from_user_id,
    to_user_id,
    practice_id,
    patient_id,
    audio_duration,
    mimeType,
  }) => {
    const normalizedUri = uri && !String(uri).startsWith('file://') && !String(uri).startsWith('content://')
      ? `file://${uri}`
      : uri;

    const lowerUri = String(normalizedUri || '').toLowerCase();
    const extension = lowerUri.includes('.mp4') ? 'mp4' : 'm4a';
    const resolvedMimeType = mimeType
      || (extension === 'mp4' ? 'audio/mp4' : 'audio/m4a');

    const formData = new FormData();
    formData.append('audio', {
      uri: normalizedUri,
      type: resolvedMimeType,
      name: `voice-${Date.now()}.${extension}`,
    });
    formData.append('from_user_id', String(from_user_id));
    formData.append('to_user_id', String(to_user_id));
    formData.append('audio_duration', String(audio_duration));
    if (practice_id != null) formData.append('practice_id', String(practice_id));
    if (patient_id != null) formData.append('patient_id', String(patient_id));

    const sessionCookie = await getSessionCookie();
    const headers = {
      Accept: 'application/json',
      'X-Mobile-Client': 'true',
    };
    if (sessionCookie) headers['X-EVitals-Session-Id'] = sessionCookie;

    const response = await fetch(`${API_CONFIG.BASE_URL}${API_ENDPOINTS.CHAT_AUDIO}`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return readApiResponse(response, 'Failed to upload voice message');
  },

  getChatAudioPlayUrl: async (messageId, userId) => {
    const response = await apiRequest(
      `${API_ENDPOINTS.CHAT_AUDIO_PLAY_URL(messageId)}?userId=${encodeURIComponent(userId)}`,
      { method: 'GET' },
    );
    return readApiResponse(response, 'Failed to get audio playback URL');
  },

  /**
   * Get program analytics (total, active, pending, locked, recent uploads,
   * missed uploads, abnormal measurements, CPT counts) for a practice program tab.
   * This is the same API that the web frontend uses on the patient management dashboard.
   *
   * GET /practices/:practiceId/patients/program-analytics?program=rpm
   *
   * Returns data shaped as:
   * {
   *   summary: { total, active, pending, locked, recent, missed, abnormal },
   *   cpt: { cpt99453, cpt99454, cpt99457, cpt99458, ... },
   *   billing_period: { date_from, date_to, label }
   * }
   *
   * @param {string|number} practiceId - Practice ID
   * @param {string} [program='rpm'] - Care program key (e.g. 'rpm', 'ccm')
   * @returns {Promise<object>} - Analytics data
   */
  getProgramAnalytics: async (practiceId, program = 'rpm') => {
    const endpoint = `/practices/${practiceId}/patients/program-analytics?program=${encodeURIComponent(program)}&refresh=1`;
    const response = await apiRequest(endpoint, { method: 'GET' });
    return readApiResponse(response, 'Failed to get program analytics');
  },

  checkUsername: async (username, excludeUserId = null) => {
    let endpoint = `/users/check-username?username=${encodeURIComponent(username)}`;
    if (excludeUserId) endpoint += `&excludeUserId=${excludeUserId}`;
    const response = await apiRequest(endpoint, { method: 'GET' });
    return readApiResponse(response, 'Failed to check username');
  },

  checkEmail: async (email, excludeUserId = null) => {
    let endpoint = `/users/check-email?email=${encodeURIComponent(email)}`;
    if (excludeUserId) endpoint += `&excludeUserId=${excludeUserId}`;
    const response = await apiRequest(endpoint, { method: 'GET' });
    return readApiResponse(response, 'Failed to check email');
  },

  checkSsn: async (ssn, excludePatientId = null) => {
    let endpoint = `/users/check-ssn?ssn=${encodeURIComponent(ssn)}`;
    if (excludePatientId) endpoint += `&excludePatientId=${excludePatientId}`;
    const response = await apiRequest(endpoint, { method: 'GET' });
    return readApiResponse(response, 'Failed to check SSN');
  },

  createPatient: async (practiceId, patientData) => {
    const response = await apiRequest(`/practices/${practiceId}/patients`, {
      method: 'POST',
      body: JSON.stringify(patientData),
    });
    return readApiResponse(response, 'Failed to create patient');
  },

  getPracticeProviders: async (practiceId) => {
    const response = await apiRequest(`/practices/${practiceId}/providers`, { method: 'GET' });
    return readApiResponse(response, 'Failed to get practice providers');
  },

  getPracticeCaregivers: async (practiceId) => {
    const response = await apiRequest(`/practices/${practiceId}/caregivers`, { method: 'GET' });
    return readApiResponse(response, 'Failed to get practice caregivers');
  },

  getSystemCaregivers: async () => {
    const response = await apiRequest(`/users/system-caregivers`, { method: 'GET' });
    return readApiResponse(response, 'Failed to get system caregivers');
  },

  getPracticeDetails: async (practiceId) => {
    const response = await apiRequest(`/practices/${practiceId}`, { method: 'GET' });
    return readApiResponse(response, 'Failed to get practice details');
  },

  getPracticeSummary: async (practiceId) => {
    const response = await apiRequest(`/practices/${practiceId}/summary`, { method: 'GET' });
    return readApiResponse(response, 'Failed to get practice summary');
  },

  getPractices: async (params = {}) => {
    let endpoint = '/practices';
    const queryParams = [];
    if (params.limit) queryParams.push(`limit=${params.limit}`);
    if (params.page) queryParams.push(`page=${params.page}`);
    if (queryParams.length > 0) endpoint += `?${queryParams.join('&')}`;
    const response = await apiRequest(endpoint, { method: 'GET' });
    return readApiResponse(response, 'Failed to get practices');
  },

  getPracticePatientsFilteredByProgramTab: async (practiceId, params = {}) => {
    let endpoint = `/practices/${practiceId}/patients/program-filtered`;
    const queryParams = [];
    Object.entries(params).forEach(([key, value]) => {
      if (value !== '' && value != null) {
        queryParams.push(`${key}=${encodeURIComponent(value)}`);
      }
    });
    if (queryParams.length > 0) endpoint += `?${queryParams.join('&')}`;
    const response = await apiRequest(endpoint, { method: 'GET' });
    return readApiResponse(response, 'Failed to get program-filtered patients');
  },

  getAssignedPracticesForSystemCaregiver: async (userId) => {
    const response = await apiRequest(`/users/${userId}/assigned-practices`, { method: 'GET' });
    return readApiResponse(response, 'Failed to get assigned practices');
  },

  getPracticeScheduleTargets: async (practiceId) => {
    const response = await apiRequest(`/practices/${practiceId}/schedule-targets`, { method: 'GET' });
    return readApiResponse(response, 'Failed to get practice schedule targets');
  },

  getPatientScheduleTargets: async (practiceId, patientId) => {
    const response = await apiRequest(
      `/practices/${practiceId}/patients/${patientId}/schedule-targets`,
      { method: 'GET' },
    );
    return readApiResponse(response, 'Failed to get patient schedule targets');
  },

  getAssignedAbnormalReviews: async (practiceId = null) => {
    let endpoint = API_ENDPOINTS.GET_ASSIGNED_ABNORMAL_REVIEWS;
    if (practiceId && practiceId !== 'all') {
      endpoint = `/practices/${practiceId}/patients/assigned-abnormal-reviews`;
    }
    const response = await apiRequest(endpoint, { method: 'GET' });
    return readApiResponse(response, 'Failed to get assigned abnormal reviews');
  },

  getPatientAbnormalReadings: async (practiceId, patientId, params = {}) => {
    let endpoint = API_ENDPOINTS.GET_PATIENT_ABNORMAL_READINGS(practiceId, patientId);
    const query = Object.entries(params)
      .filter(([, value]) => value != null && value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    if (query) endpoint += `?${query}`;
    const response = await apiRequest(endpoint, { method: 'GET' });
    return readApiResponse(response, 'Failed to get patient abnormal readings');
  },

  reviewPatientAbnormal: async (practiceId, patientId) => {
    const response = await apiRequest(
      API_ENDPOINTS.REVIEW_PATIENT_ABNORMAL(practiceId, patientId),
      { method: 'PUT' },
    );
    return readApiResponse(response, 'Failed to mark patient review complete');
  },

  reviewPatientMeasurement: async (practiceId, patientId, vitalType, measurementId) => {
    const response = await apiRequest(
      API_ENDPOINTS.REVIEW_MEASUREMENT(practiceId, patientId, vitalType, measurementId),
      { method: 'PUT' },
    );
    return readApiResponse(response, 'Failed to mark measurement reviewed');
  },

  assignMeasurementReading: async (practiceId, patientId, vitalType, measurementId, payload) => {
    const response = await apiRequest(
      API_ENDPOINTS.ASSIGN_MEASUREMENT(practiceId, patientId, vitalType, measurementId),
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    );
    return readApiResponse(response, 'Failed to assign measurement reading');
  },

  assignPatientCaregiverForReview: async (practiceId, patientId, payload) => {
    const response = await apiRequest(
      API_ENDPOINTS.ASSIGN_PATIENT_CAREGIVER(practiceId, patientId),
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    );
    return readApiResponse(response, 'Failed to assign caregiver');
  },

  assignPatientProviderForReview: async (practiceId, patientId, payload) => {
    const response = await apiRequest(
      API_ENDPOINTS.ASSIGN_PATIENT_PROVIDER(practiceId, patientId),
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    );
    return readApiResponse(response, 'Failed to assign provider');
  },

  sendCustomEmail: async (payload) => {
    const response = await apiRequest('/email/custom', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return readApiResponse(response, 'Failed to send email');
  },

  createSupportTicket: async (formData) => {
    const url = `${API_CONFIG.BASE_URL}/tickets/create`;
    const sessionCookie = await getSessionCookie();
    const headers = { Accept: 'application/json', 'X-Mobile-Client': 'true' };
    if (sessionCookie) headers['X-EVitals-Session-Id'] = sessionCookie;
    const response = await fetch(url, { method: 'POST', headers, body: formData });
    return readApiResponse(response, 'Failed to submit ticket.');
  },
};

export default apiService;
