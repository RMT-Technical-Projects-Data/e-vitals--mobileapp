import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Modal, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AppState } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/apiService';
import { scale } from '../../config/theme';
import {
  getSessionLastActivity,
  resolveSessionMinutes,
  touchSessionActivity,
} from '../../utils/sessionActivity';

/** Warn during the last minute. Shorter sessions warn at the halfway point. */
const warningLeadMs = (timeoutMs) => {
  if (timeoutMs <= 2 * 60 * 1000) return Math.floor(timeoutMs / 2);
  return 60 * 1000;
};

export default function SessionTimeoutWrapper({ children }) {
  const { isLoggedIn, logout, user } = useAuth();
  const [showWarning, setShowWarningState] = useState(false);
  const [secondsRemaining, setSecondsRemainingState] = useState(0);

  const showWarningRef = useRef(false);
  const secondsRemainingRef = useRef(0);
  const lastActivityRef = useRef(Date.now());
  const userSettingMinutesRef = useRef(30);
  const sessionMinutesReadyRef = useRef(false);
  const timerRef = useRef(null);
  const suppressAutoLogoutRef = useRef(false);
  const stayLoggedInInProgressRef = useRef(false);

  const setShowWarning = useCallback((val) => {
    showWarningRef.current = val;
    setShowWarningState(val);
  }, []);

  const setSecondsRemaining = useCallback((val) => {
    secondsRemainingRef.current = val;
    setSecondsRemainingState(val);
  }, []);

  const clearInactivityTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const lastPersistRef = useRef(0);
  const resetInactivityTimer = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    if (now - lastPersistRef.current < 15000) return;
    lastPersistRef.current = now;
    touchSessionActivity(now);
  }, []);

  const handleAutoLogout = useCallback(async () => {
    if (suppressAutoLogoutRef.current || stayLoggedInInProgressRef.current) {
      return;
    }

    suppressAutoLogoutRef.current = true;
    setShowWarning(false);
    clearInactivityTimer();
    await logout();
    suppressAutoLogoutRef.current = false;
  }, [clearInactivityTimer, logout, setShowWarning]);

  const checkInactivity = useCallback(() => {
    if (!isLoggedIn || !sessionMinutesReadyRef.current || suppressAutoLogoutRef.current || stayLoggedInInProgressRef.current) {
      return;
    }

    if (showWarningRef.current) {
      if (secondsRemainingRef.current <= 0) {
        handleAutoLogout();
        return;
      }
      setSecondsRemaining(secondsRemainingRef.current - 1);
      return;
    }

    const timeoutMs = userSettingMinutesRef.current * 60 * 1000;
    const elapsed = Date.now() - lastActivityRef.current;
    const remainingMs = timeoutMs - elapsed;

    if (remainingMs <= 0) {
      handleAutoLogout();
      return;
    }

    if (remainingMs <= warningLeadMs(timeoutMs)) {
      setSecondsRemaining(Math.ceil(remainingMs / 1000));
      setShowWarning(true);
    }
  }, [handleAutoLogout, isLoggedIn, setSecondsRemaining, setShowWarning]);

  const handleStayLoggedIn = useCallback(async () => {
    stayLoggedInInProgressRef.current = true;
    suppressAutoLogoutRef.current = true;

    setShowWarning(false);
    setSecondsRemaining(0);
    resetInactivityTimer();

    try {
      await apiService.checkSession();
    } catch (err) {
      console.log('Session keep-alive failed:', err);
    } finally {
      stayLoggedInInProgressRef.current = false;
      suppressAutoLogoutRef.current = false;
    }
  }, [resetInactivityTimer, setSecondsRemaining, setShowWarning]);

  const handleLogoutNow = useCallback(async () => {
    suppressAutoLogoutRef.current = true;
    setShowWarning(false);
    clearInactivityTimer();
    await logout();
    suppressAutoLogoutRef.current = false;
  }, [clearInactivityTimer, logout, setShowWarning]);

  useEffect(() => {
    if (!isLoggedIn) {
      setShowWarning(false);
      setSecondsRemaining(0);
      clearInactivityTimer();
      return undefined;
    }

    let cancelled = false;
    sessionMinutesReadyRef.current = false;
    resolveSessionMinutes(user?.session_time).then(async (minutes) => {
      if (cancelled) return;
      userSettingMinutesRef.current = minutes;
      sessionMinutesReadyRef.current = true;
      const lastActivity = await getSessionLastActivity();
      if (cancelled) return;
      const timeoutMs = minutes * 60 * 1000;
      if (!lastActivity || Date.now() - lastActivity > timeoutMs) {
        handleAutoLogout();
        return;
      }
      lastActivityRef.current = lastActivity;
    }).catch(() => {
      if (!cancelled) handleAutoLogout();
    });
    clearInactivityTimer();
    timerRef.current = setInterval(checkInactivity, 1000);

    const heartbeatInterval = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      if (!showWarningRef.current && !stayLoggedInInProgressRef.current) {
        apiService.checkSession().catch((err) => console.log('Session heartbeat failed:', err));
      }
    }, 5 * 60 * 1000);

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      resolveSessionMinutes(user?.session_time).then(async (minutes) => {
        userSettingMinutesRef.current = minutes;
        const lastActivity = await getSessionLastActivity();
        const timeoutMs = minutes * 60 * 1000;
        if (!lastActivity || Date.now() - lastActivity > timeoutMs) {
          handleAutoLogout();
          return;
        }
        lastActivityRef.current = lastActivity;
        if (showWarningRef.current) {
          const remainingMs = timeoutMs - (Date.now() - lastActivity);
          setSecondsRemaining(Math.max(0, Math.ceil(remainingMs / 1000)));
        }
      }).catch(() => handleAutoLogout());
    });

    return () => {
      cancelled = true;
      sessionMinutesReadyRef.current = false;
      appStateSubscription.remove();
      clearInactivityTimer();
      clearInterval(heartbeatInterval);
    };
  }, [checkInactivity, clearInactivityTimer, handleAutoLogout, isLoggedIn, setSecondsRemaining, setShowWarning, user?.session_time]);

  const handleTouch = () => {
    if (!showWarningRef.current) {
      resetInactivityTimer();
    }
    return false;
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={handleTouch}
      onMoveShouldSetResponderCapture={handleTouch}
    >
      {children}

      <Modal
        visible={showWarning}
        transparent
        animationType="fade"
        onRequestClose={handleStayLoggedIn}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.iconContainer}>
              <Text style={styles.warningIcon}>⚠️</Text>
            </View>
            <Text style={styles.modalTitle}>Session Expiring</Text>
            <Text style={styles.modalMessage}>
              Your session will expire in{' '}
              <Text style={styles.countdownText}>{formatTime(secondsRemaining)}</Text>{' '}
              due to inactivity. Would you like to stay logged in?
            </Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogoutNow}>
                <Text style={styles.logoutButtonText}>Logout Now</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.stayButton} onPress={handleStayLoggedIn}>
                <Text style={styles.stayButtonText}>Stay Logged In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: scale(24),
    borderRadius: scale(16),
    width: '85%',
    maxWidth: scale(380),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  iconContainer: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    backgroundColor: '#fff3cd',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(16),
  },
  warningIcon: {
    fontSize: scale(28),
  },
  modalTitle: {
    fontSize: scale(20),
    fontWeight: 'bold',
    color: '#0b1f3f',
    marginBottom: scale(12),
  },
  modalMessage: {
    fontSize: scale(15),
    color: '#687382',
    textAlign: 'center',
    lineHeight: scale(22),
    marginBottom: scale(24),
  },
  countdownText: {
    fontWeight: 'bold',
    color: '#b91427',
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: scale(12),
  },
  logoutButton: {
    flex: 1,
    height: scale(44),
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: '#eadbd4',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  logoutButtonText: {
    fontSize: scale(14),
    fontWeight: '600',
    color: '#687382',
  },
  stayButton: {
    flex: 1.2,
    height: scale(44),
    borderRadius: scale(8),
    backgroundColor: '#0b1f3f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stayButtonText: {
    fontSize: scale(14),
    fontWeight: '600',
    color: '#fff',
  },
});
