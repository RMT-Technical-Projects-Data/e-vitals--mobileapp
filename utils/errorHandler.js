/**
 * Check if response indicates session expired
 * @param {Response} response - Fetch response object
 * @returns {boolean} - True if session expired
 */
export const isSessionExpired = async (response) => {
  if (response.status === 401 || response.status === 403) {
    try {
      const data = await response.json();
      const message = data.message || '';
      return (
        message.includes('Session expired') ||
        message.includes('Session timeout') ||
        message.includes('Unauthorized') ||
        message.includes('Not authenticated')
      );
    } catch {
      // If we can't parse JSON, assume session expired for 401/403
      return true;
    }
  }
  return false;
};

/**
 * Handle API error and return user-friendly message
 * Note: Response body may already be consumed, so this should be called before parsing
 * @param {Response} response - Fetch response object
 * @param {string} defaultMessage - Default error message
 * @returns {Promise<string>} - Error message
 */
export const handleApiError = async (response, defaultMessage = 'An error occurred') => {
  try {
    const text = await response.text();
    if (text) {
      try {
        const data = JSON.parse(text);
        return data.message || data.error || defaultMessage;
      } catch (e) {
        // Not JSON, return text or default
        return text || defaultMessage;
      }
    }
  } catch (error) {
    // If response body is already consumed or other error, use status-based message
    console.warn('Could not read response body:', error.message);
  }
  
  // Fallback: return status-based message
  if (response.status === 401) {
    return 'Invalid credentials. Please check your username and password.';
  }
  if (response.status === 403) {
    return 'Access denied. Please check your permissions.';
  }
  if (response.status === 404) {
    // Try to get more details from response
    try {
      const text = await response.text();
      if (text) {
        try {
          const data = JSON.parse(text);
          return data.message || `Resource not found: ${response.url || 'Unknown endpoint'}`;
        } catch (e) {
          return `Resource not found: ${response.url || 'Unknown endpoint'}. Please check if the endpoint exists on the server.`;
        }
      }
    } catch (error) {
      // Response body already consumed
    }
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
 * Parse response data safely
 * Note: This consumes the response body - it cannot be read again after this
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