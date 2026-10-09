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
  await AsyncStorage.multiSet([[STORAGE_KEY, cachedEnabled ? '1' : '0']]);
  await AsyncStorage.removeItem(BELL_AFTER_KEY);
  return cachedEnabled;
};
