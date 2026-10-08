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
  return cachedEnabled;
};

export const getNotificationBellVisibleAfter = async () => {
  try {
    const value = await AsyncStorage.getItem(BELL_AFTER_KEY);
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
};

export const markNotificationBellVisibleFromNow = async () => {
  const cutoff = Date.now();
  await AsyncStorage.setItem(BELL_AFTER_KEY, String(cutoff));
  return cutoff;
};

export const isNotificationVisibleInBell = (dateValue, cutoff) => {
  if (!cutoff) return true;
  const time = new Date(dateValue || 0).getTime();
  return Number.isFinite(time) && time >= cutoff;
};
