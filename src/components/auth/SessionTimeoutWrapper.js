import React, { useState, useEffect, useRef } from 'react';
import { View, Modal, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/apiService';
import { scale } from '../../config/theme';

export default function SessionTimeoutWrapper({ children }) {
  const { isLoggedIn, logout, user } = useAuth();
  const [showWarning, setShowWarningState] = useState(false);
  const [secondsRemaining, setSecondsRemainingState] = useState(0);
  const [userSettingMinutes, setUserSettingMinutes] = useState(30);

  const showWarningRef = useRef(false);
  const secondsRemainingRef = useRef(0);
  const lastActivityRef = useRef(Date.now());
  const timerRef = useRef(null);

  const setShowWarning = (val) => {
    showWarningRef.current = val;
    setShowWarningState(val);
  };

  const setSecondsRemaining = (val) => {
    secondsRemainingRef.current = val;
    setSecondsRemainingState(val);
  };

  // Load user session time from AsyncStorage / context
  useEffect(() => {
    if (!isLoggedIn) {
      setShowWarning(false);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const loadSessionTime = () => {
      let sessionMinutes = 30;
      if (user?.session_time) {
        const parsed = parseInt(user.session_time, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 1440) {
          sessionMinutes = parsed;
        }
      }
      setUserSettingMinutes(sessionMinutes);
    };

    loadSessionTime();
    lastActivityRef.current = Date.now();

    // Check inactivity every second
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(checkInactivity, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLoggedIn, user]);

  const resetInactivityTimer = () => {
    lastActivityRef.current = Date.now();
  };

  const handleTouch = () => {
    resetInactivityTimer();
    return false; // Do not capture the touch, let child components receive it
  };

  const checkInactivity = () => {
    if (showWarningRef.current) {
      // Countdown mode: decrement seconds remaining
      if (secondsRemainingRef.current <= 1) {
        handleAutoLogout();
      } else {
        setSecondsRemaining(secondsRemainingRef.current - 1);
      }
      return;
    }

    const timeoutMs = userSettingMinutes * 60 * 1000;
    const warningMs = Math.floor(timeoutMs / 2);
    const elapsed = Date.now() - lastActivityRef.current;

    if (elapsed >= timeoutMs - warningMs) {
      // User has been inactive for (timeoutMs - warningMs). Start countdown warning.
      setSecondsRemaining(Math.ceil(warningMs / 1000));
      setShowWarning(true);
    }
  };

  const handleAutoLogout = async () => {
    setShowWarning(false);
    await logout();
  };

  const handleStayLoggedIn = () => {
    setShowWarning(false);
    resetInactivityTimer();
    // Heartbeat call to keep session alive on server
    apiService.checkSession().catch((err) => console.log('Session keep-alive failed:', err));
  };

  const handleLogoutNow = async () => {
    setShowWarning(false);
    await logout();
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
        transparent={true}
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
