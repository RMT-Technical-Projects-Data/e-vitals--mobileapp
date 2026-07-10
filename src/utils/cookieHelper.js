import AsyncStorage from '@react-native-async-storage/async-storage';
import { SESSION_COOKIE_NAME } from '../config/api';

/**
 * Extract cookie value from Set-Cookie header string
 * @param {string} setCookieHeader - The Set-Cookie header value
 * @returns {string|null} - The cookie value or null if not found
 */
export const extractCookieValue = (setCookieHeader) => {
  if (!setCookieHeader) return null;
  
  try {
    // Handle multiple cookies (split by comma)
    const cookies = setCookieHeader.split(',');
    
    for (const cookie of cookies) {
      // Find the session cookie
      const match = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // Fallback: try direct match on the whole string
    const directMatch = setCookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    if (directMatch && directMatch[1]) {
      return directMatch[1].trim();
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting cookie:', error);
    return null;
  }
};

/**
 * Extract cookie from response headers
 * @param {Response} response - Fetch response object
 * @returns {string|null} - The cookie value or null if not found
 */
export const extractCookieFromResponse = (response) => {
  try {
    // React Native's fetch API doesn't expose Set-Cookie headers for security reasons
    // Try different methods to access headers
    
    // Method 1: Try get() with different case variations
    let setCookieHeader = null;
    
    // Try lowercase
    try {
      setCookieHeader = response.headers.get('set-cookie');
    } catch (e) {}
    
    // Try uppercase
    if (!setCookieHeader) {
      try {
        setCookieHeader = response.headers.get('Set-Cookie');
      } catch (e) {}
    }
    
    // Method 2: Try to access headers object directly (if available)
    if (!setCookieHeader && response.headers) {
      try {
        // Check if headers has a map or entries method
        if (typeof response.headers.forEach === 'function') {
          response.headers.forEach((value, key) => {
            if (key.toLowerCase() === 'set-cookie' && !setCookieHeader) {
              setCookieHeader = value;
            }
          });
        }
      } catch (e) {
        // Ignore errors
      }
    }
    
    // Method 3: Try headers.raw() only if it exists (browser only, not React Native)
    if (!setCookieHeader) {
      try {
        if (typeof response.headers.raw === 'function') {
          const allHeaders = response.headers.raw();
          if (allHeaders['set-cookie']) {
            const cookies = Array.isArray(allHeaders['set-cookie']) 
              ? allHeaders['set-cookie'] 
              : [allHeaders['set-cookie']];
            
            for (const cookie of cookies) {
              const value = extractCookieValue(cookie);
              if (value) return value;
            }
          }
        }
      } catch (e) {
        // headers.raw() doesn't exist in React Native - this is expected
      }
    }
    
    // If we found a Set-Cookie header, extract the value
    if (setCookieHeader) {
      return extractCookieValue(setCookieHeader);
    }
    
    // React Native doesn't expose Set-Cookie headers - return null
    // The cookie will need to be handled differently (see note below)
    return null;
  } catch (error) {
    console.error('Error extracting cookie from response:', error);
    return null;
  }
};

/**
 * Get session cookie from AsyncStorage
 * @returns {Promise<string|null>} - The stored cookie value or null
 */
export const getSessionCookie = async () => {
  try {
    const cookie = await AsyncStorage.getItem('sessionCookie');
    return cookie;
  } catch (error) {
    console.error('Error getting session cookie:', error);
    return null;
  }
};

/**
 * Store session cookie in AsyncStorage
 * @param {string} cookieValue - The cookie value to store
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
export const setSessionCookie = async (cookieValue) => {
  try {
    if (!cookieValue) {
      await AsyncStorage.removeItem('sessionCookie');
      return true;
    }
    await AsyncStorage.setItem('sessionCookie', cookieValue);
    return true;
  } catch (error) {
    console.error('Error setting session cookie:', error);
    return false;
  }
};

/**
 * Clear session cookie from AsyncStorage
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
export const clearSessionCookie = async () => {
  try {
    await AsyncStorage.removeItem('sessionCookie');
    return true;
  } catch (error) {
    console.error('Error clearing session cookie:', error);
    return false;
  }
};

/**
 * Build Cookie header string for requests
 * @param {string} cookieValue - The cookie value
 * @returns {string} - Cookie header string
 */
export const buildCookieHeader = (cookieValue) => {
  if (!cookieValue) return '';
  return `${SESSION_COOKIE_NAME}=${cookieValue}`;
};