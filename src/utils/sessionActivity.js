import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_ACTIVITY_KEY = 'sessionLastActivityAt';
const SESSION_MINUTES_KEY = 'sessionTimeoutMinutes';

export const normalizeSessionMinutes = (rawValue, fallback = 30) => {
  const clamp = (minutes) => Math.min(Math.max(minutes, 1), 1440);
  if (rawValue == null) return clamp(fallback);

  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return clamp(Math.floor(rawValue));
  }

  const text = String(rawValue).trim();
  if (!text) return clamp(fallback);

  if (text.includes(':')) {
    const parts = text.split(':').map((part) => Number.parseInt(part, 10));
    if (parts.every((part) => Number.isFinite(part) && part >= 0)) {
      const [hours = 0, minutes = 0, seconds = 0] = parts;
      const totalMinutes = Math.floor((hours * 3600 + minutes * 60 + seconds) / 60);
      return clamp(totalMinutes || fallback);
    }
  }

  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? clamp(parsed) : clamp(fallback);
};

export async function touchSessionActivity(at = Date.now()) {
  try {
    await AsyncStorage.setItem(LAST_ACTIVITY_KEY, String(at));
  } catch (error) {
    console.warn('Failed to store session activity:', error?.message);
  }
  return at;
}

export async function getSessionLastActivity() {
  try {
    const raw = await AsyncStorage.getItem(LAST_ACTIVITY_KEY);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch (error) {
    return null;
  }
}

export async function clearSessionActivity() {
  try {
    await AsyncStorage.multiRemove([LAST_ACTIVITY_KEY, SESSION_MINUTES_KEY]);
  } catch (error) {
    console.warn('Failed to clear session activity:', error?.message);
  }
}

/** Saves the account's session timeout, in minutes (60 = 1 hour). */
export async function setStoredSessionMinutes(rawValue) {
  const minutes = normalizeSessionMinutes(rawValue, 30);
  try {
    await AsyncStorage.setItem(SESSION_MINUTES_KEY, String(minutes));
  } catch (error) {
    console.warn('Failed to store session timeout:', error?.message);
  }
  return minutes;
}

export async function getStoredSessionMinutes() {
  try {
    const raw = await AsyncStorage.getItem(SESSION_MINUTES_KEY);
    if (raw == null || String(raw).trim() === '') return null;
    return normalizeSessionMinutes(raw, 30);
  } catch (error) {
    return null;
  }
}

/**
 * Idle limit in minutes. The value the user saved wins over a missing
 * profile field, so a 60-minute selection is not treated as 30.
 */
export async function resolveSessionMinutes(userSessionTime) {
  const stored = await getStoredSessionMinutes();
  if (stored != null) return stored;
  if (userSessionTime != null && String(userSessionTime).trim() !== '') {
    return setStoredSessionMinutes(userSessionTime);
  }
  return 30;
}

/** True when there is no recorded activity, or the idle limit has already passed. */
export async function isSessionActivityExpired(sessionMinutes = 30) {
  const lastActivity = await getSessionLastActivity();
  if (!lastActivity) return true;
  const timeoutMs = normalizeSessionMinutes(sessionMinutes, 30) * 60 * 1000;
  return Date.now() - lastActivity > timeoutMs;
}
