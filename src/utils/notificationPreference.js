import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'notificationsEnabled';
const BELL_AFTER_KEY = 'notificationBellVisibleAfter';

let cachedEnabled = true;
let loaded = false;

export const loadNotificationPreference = async () => {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    cachedEnabled = value == null ? true : value === '1';
  } catch {
    cachedEnabled = true;
  }
  loaded = true;
  return cachedEnabled;
};

export const areNotificationsEnabled = async () => {
  if (!loaded) return loadNotificationPreference();
  return cachedEnabled;
};

export const setNotificationsEnabled = async (enabled) => {
  cachedEnabled = Boolean(enabled);
  loaded = true;
  await AsyncStorage.setItem(STORAGE_KEY, cachedEnabled ? '1' : '0');
  try {
    await AsyncStorage.removeItem(BELL_AFTER_KEY);
  } catch {
    // Preference is already saved; this key is only used to hide stale bell items.
  }
  return cachedEnabled;
};
