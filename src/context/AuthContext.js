import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../services/apiService';
import { getSessionCookie, clearSessionCookie } from '../utils/cookieHelper';
import { registerPushTokenWithBackend, unregisterPushTokenFromBackend } from '../services/pushNotificationService';
import {
  clearSessionActivity,
  getStoredSessionMinutes,
  isSessionActivityExpired,
  resolveSessionMinutes,
  setStoredSessionMinutes,
  touchSessionActivity,
} from '../utils/sessionActivity';

const AuthContext = createContext(null);

const AUTH_KEYS = [
  'user',
  'patientId',
  'practiceId',
  'patientIdString',
  'latestVitals',
  'lastVitalsFetch',
  'notificationsState',
  'unreadBadgeCount',
  'systemNotifications',
  'storedAssessments',
];

export function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  // showSplash is true only on very first app launch.
  // After logout, this becomes false so AuthStack starts at Login directly.
  const [showSplash, setShowSplash] = useState(true);
  const appState = useRef(AppState.currentState);

  const login = useCallback(async () => {
    setShowSplash(false); // after first login, never show Splash again in this session
    await touchSessionActivity();
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const parsed = JSON.parse(userStr);
        if (parsed?.session_time != null && String(parsed.session_time).trim() !== '') {
          const minutes = await setStoredSessionMinutes(parsed.session_time);
          parsed.session_time = minutes;
          await AsyncStorage.setItem('user', JSON.stringify(parsed));
        }
        setUser(parsed);
      }
    } catch (e) {
      console.warn('Error reading user on login:', e);
    }
    setIsLoggedIn(true);
    registerPushTokenWithBackend().catch(() => {});
  }, []);

  const logout = useCallback(async () => {
    // Clear all stored session data
    try {
      await unregisterPushTokenFromBackend().catch(() => {});
      await Promise.all([
        AsyncStorage.multiRemove(AUTH_KEYS),
        clearSessionCookie(),
        clearSessionActivity(),
      ]);
    } catch (e) {
      console.warn('Error clearing auth storage:', e);
    }
    setUser(null);
    // showSplash stays false → AuthStack will start at Login, not Splash
    setShowSplash(false);
    setIsLoggedIn(false);
  }, []);

  const restoreSession = useCallback(async () => {
    const sessionCookie = await getSessionCookie();
    if (!sessionCookie) {
      return false;
    }

    try {
      const storedUserRaw = await AsyncStorage.getItem('user');
      const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
      const sessionMinutes = await resolveSessionMinutes(storedUser?.session_time);
      if (await isSessionActivityExpired(sessionMinutes)) {
        await logout();
        return false;
      }
    } catch (error) {
      await logout();
      return false;
    }

    try {
      const result = await apiService.checkSession();
      if (!result?.success || !result.authenticated || !result.user) {
        await logout();
        return false;
      }

      const selectedMinutes = await getStoredSessionMinutes();
      if (selectedMinutes != null) {
        result.user.session_time = selectedMinutes;
      } else if (result.user?.session_time != null && String(result.user.session_time).trim() !== '') {
        result.user.session_time = await setStoredSessionMinutes(result.user.session_time);
      }
      await AsyncStorage.setItem('user', JSON.stringify(result.user));
      setUser(result.user);
      if (result.user.practice_id) {
        await AsyncStorage.setItem('practiceId', String(result.user.practice_id));
      }
      setIsLoggedIn(true);
      registerPushTokenWithBackend().catch(() => {});
      return true;
    } catch (error) {
      // A network failure must not destroy a potentially valid session. It can
      // be checked again when the app returns to the foreground.
      if (error.message?.includes('Session') || error.message?.includes('Unauthorized')) {
        await logout();
      } else {
        // Even if network fails, try to load user from AsyncStorage to keep context populated
        try {
          const storedUser = await AsyncStorage.getItem('user');
          if (storedUser) {
            setUser(JSON.parse(storedUser));
          }
        } catch (e) {}
      }
      return false;
    }
  }, [logout]);

  useEffect(() => {
    let mounted = true;

    restoreSession()
      .catch(() => {})
      .finally(() => {
        if (mounted) {
          setIsAuthReady(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [restoreSession]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      const returningToForeground =
        /inactive|background/.test(appState.current) && nextState === 'active';
      appState.current = nextState;
      if (returningToForeground) {
        restoreSession();
      }
    });
    return () => subscription.remove();
  }, [restoreSession]);

  const updateUser = useCallback(async (updatedUserFields) => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const currentUser = JSON.parse(userStr);
        const newUser = { ...currentUser, ...updatedUserFields };
        if (updatedUserFields?.session_time != null && String(updatedUserFields.session_time).trim() !== '') {
          newUser.session_time = await setStoredSessionMinutes(updatedUserFields.session_time);
        }
        await AsyncStorage.setItem('user', JSON.stringify(newUser));
        setUser(newUser);
      }
    } catch (e) {
      console.warn('Error updating user settings:', e);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ isLoggedIn, isAuthReady, showSplash, user, login, logout, restoreSession, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
