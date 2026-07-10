import React, { createContext, useContext, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  // showSplash is true only on very first app launch.
  // After logout, this becomes false so AuthStack starts at Login directly.
  const [showSplash, setShowSplash] = useState(true);

  const login = useCallback(() => {
    setShowSplash(false); // after first login, never show Splash again in this session
    setIsLoggedIn(true);
  }, []);

  const logout = useCallback(async () => {
    // Clear all stored session data
    try {
      await AsyncStorage.multiRemove(AUTH_KEYS);
    } catch (e) {
      console.warn('Error clearing auth storage:', e);
    }
    // showSplash stays false → AuthStack will start at Login, not Splash
    setShowSplash(false);
    setIsLoggedIn(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isLoggedIn, showSplash, login, logout }}>
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
