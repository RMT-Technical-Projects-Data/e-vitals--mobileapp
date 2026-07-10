/**
 * Check if response indicates session expired using already-parsed data.
 * @param {Response} response - Fetch response object
 * @param {object|null} data - Parsed response body
 * @returns {boolean} - True if session expired
 */
export const isSessionExpired = (response, data = null) => {
  if (response.status !== 401 && response.status !== 403) {
    return false;
  }

  const message = String(data?.message || '');
  if (
    message.includes('Session expired') ||
    message.includes('Session timeout') ||
    message.includes('Unauthorized') ||
    message.includes('Not authenticated')
  ) {
    return true;
  }

  return response.status === 401;
};

/**
 * Handle API error and return user-friendly message.
 * Pass parsed `data` when the response body has already been read.
 * @param {Response} response - Fetch response object
 * @param {string} defaultMessage - Default error message
 * @param {object|null} data - Parsed response body
 * @returns {string} - Error message
 */
export const handleApiError = (response, defaultMessage = 'An error occurred', data = null) => {
  if (data) {
    return data.message || data.error || defaultMessage;
  }

  if (response.status === 401) {
    return 'Invalid credentials. Please check your username and password.';
  }
  if (response.status === 403) {
    return 'Access denied. Please check your permissions.';
  }
  if (response.status === 404) {
    return `Resource not found: ${response.url || 'Unknown endpoint'}. Please check if the endpoint exists on the server.`;
  }
  if (response.status === 500) {
    return 'Server error. Please try again later.';
  }
  if (response.status === 0 || !response.status) {
    return 'Network error. Please check your connection.';
  }
  return defaultMessage;
};

/**
 * Parse response data safely.
 * Note: This consumes the response body - it cannot be read again after this.
 * @param {Response} response - Fetch response object
 * @returns {Promise<object|null>} - Parsed JSON data or null
 */
export const safeParseResponse = async (response) => {
  try {
    const text = await response.text();
    if (!text || text.trim() === '') {
      return null;
    }
    return JSON.parse(text);
  } catch (error) {
    console.error('Error parsing response:', error);
    return null;
  }
};
