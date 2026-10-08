import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../services/apiService';

const EVENT = 'unreadMessageCountChanged';

let count = 0;
let refreshPromise = null;
let refreshQueued = false;

export const getUnreadMessageCount = () => count;

export const setUnreadMessageCount = (next) => {
  const value = Math.max(0, Number(next) || 0);
  if (value === count) return count;
  count = value;
  DeviceEventEmitter.emit(EVENT, count);
  return count;
};

export const subscribeUnreadMessageCount = (listener) => {
  const subscription = DeviceEventEmitter.addListener(EVENT, listener);
  return () => subscription.remove();
};

export const refreshUnreadMessageCount = () => {
  if (refreshPromise) {
    refreshQueued = true;
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      if (!user?.id) {
        return setUnreadMessageCount(0);
      }
      const result = await apiService.getChatUnreadCount(user.id);
      return setUnreadMessageCount(result?.data?.count || 0);
    } catch {
      return count;
    } finally {
      refreshPromise = null;
      if (refreshQueued) {
        refreshQueued = false;
        refreshUnreadMessageCount();
      }
    }
  })();

  return refreshPromise;
};
