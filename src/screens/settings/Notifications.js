import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { colors, fonts } from '../../config/globall';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../../services/apiService';
import { dismissAbnormalNotification, dismissChatNotifications } from '../../utils/notificationInbox';

const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

const scaleWidth = size => (width / guidelineBaseWidth) * size;
const scaleHeight = size => (height / guidelineBaseHeight) * size;
const scaleFont = size => scaleWidth(size);

const SCREEN_BG_COLORS = ['#ffffff', '#ffffff', '#ffffff'];
const PRIMARY_ACCENT = '#0b1f3f';
const SECONDARY_ACCENT = colors.secondaryButton || '#D9E0F5';

// Generate unique notification IDs based on type and data
const generateNotificationId = (type, data) => {
  if (type === 'bloodPressure') {
    const systolic = data.systolic || data.systolic_pressure;
    const diastolic = data.diastolic || data.diastolic_pressure;
    return `bp-${systolic}-${diastolic}-${Date.now()}`;
  } else if (type === 'bloodGlucose') {
    const glucose = data.blood_glucose_value_1 || data.value;
    return `glucose-${glucose}-${Date.now()}`;
  } else if (type === 'weight') {
    return `weight-${data.value}-${Date.now()}`;
  }
  return `${type}-${Date.now()}`;
};

// Generate medical alerts with consistent IDs (NO timestamps for consistency)
const generateMedicalAlerts = (patientData) => {
  const alerts = [];
  const measurements = patientData?.measurements || {};

  // Blood Pressure Alerts
  if (measurements.bloodPressure) {
    const bp = measurements.bloodPressure;
    const systolic = bp.systolic || bp.systolic_pressure;
    const diastolic = bp.diastolic || bp.diastolic_pressure;

    if (systolic > 140 || diastolic > 90) {
      alerts.push({
        id: `bp-high-${systolic}-${diastolic}`,
        type: 'Alert',
        title: 'High Blood Pressure',
        message: `Your BP reading ${systolic}/${diastolic} mmHg is above normal range.`,
        date: new Date().toISOString(),
        read: false,
        alertType: 'bloodPressure',
        severity: systolic > 180 || diastolic > 120 ? 'high' : 'medium'
      });
    } else if (systolic < 90 || diastolic < 60) {
      alerts.push({
        id: `bp-low-${systolic}-${diastolic}`,
        type: 'Alert',
        title: 'Low Blood Pressure',
        message: `Your BP reading ${systolic}/${diastolic} mmHg is below normal range.`,
        date: new Date().toISOString(),
        read: false,
        alertType: 'bloodPressure',
        severity: 'medium'
      });
    }
  }

  // Blood Glucose Alerts
  if (measurements.bloodGlucose) {
    const glucose = parseFloat(measurements.bloodGlucose.blood_glucose_value_1 || measurements.bloodGlucose.value || 0);

    if (glucose > 126) {
      alerts.push({
        id: `glucose-high-${glucose}`,
        type: 'Alert',
        title: 'High Blood Glucose',
        message: `Your glucose level ${glucose} mg/dL indicates possible diabetes risk.`,
        date: new Date().toISOString(),
        read: false,
        alertType: 'bloodGlucose',
        severity: 'high'
      });
    } else if (glucose > 0 && glucose < 70) {
      alerts.push({
        id: `glucose-low-${glucose}`,
        type: 'Alert',
        title: 'Low Blood Glucose',
        message: `Your glucose level ${glucose} mg/dL is below normal range.`,
        date: new Date().toISOString(),
        read: false,
        alertType: 'bloodGlucose',
        severity: 'medium'
      });
    }
  }

  // Weight Alerts
  if (measurements.weight) {
    const weight = measurements.weight.value;
    const bmi = (weight / (1.7 * 1.7)).toFixed(1);

    if (bmi > 30) {
      alerts.push({
        id: `weight-high-${weight}`,
        type: 'Alert',
        title: 'Weight Concern',
        message: `Your weight indicates obesity risk (BMI: ${bmi}). Consider lifestyle changes.`,
        date: new Date().toISOString(),
        read: false,
        alertType: 'weight',
        severity: 'medium'
      });
    } else if (bmi < 18.5) {
      alerts.push({
        id: `weight-low-${weight}`,
        type: 'Alert',
        title: 'Underweight Alert',
        message: `Your weight indicates underweight condition (BMI: ${bmi}).`,
        date: new Date().toISOString(),
        read: false,
        alertType: 'weight',
        severity: 'medium'
      });
    }
  }

  return alerts;
};

// Fetch Patient Data for Real Alerts
const fetchPatientDataForAlerts = async () => {
  try {
    const userData = await AsyncStorage.getItem('user');
    if (!userData) throw new Error('User not found');
    const user = JSON.parse(userData);
    const patientId = user.id || user.patient_id;
    if (!patientId) throw new Error('Patient ID missing');

    const token = await AsyncStorage.getItem('authToken');
    if (!token) throw new Error('Auth token missing');

    const response = await fetch(`${API_CONFIG.BASE_URL}/patients/${patientId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    if (!response.ok) throw new Error(`API failed: ${response.status}`);
    const result = await response.json();
    if (!result.success || !result.data) throw new Error('Invalid response');

    return result.data;
  } catch (error) {
    // console.error("Error fetching patient data for alerts:", error);
    return null;
  }
};

// Load stored assessments
const loadStoredAssessments = async () => {
  try {
    const storedData = await AsyncStorage.getItem('storedAssessments');
    if (storedData) {
      return JSON.parse(storedData);
    }
  } catch (error) {
    console.error("Error loading stored assessments:", error);
  }
  return [];
};

// Load system notifications (non-hardcoded, dynamic)
const loadSystemNotifications = async () => {
  try {
    const systemData = await AsyncStorage.getItem('systemNotifications');
    if (systemData) {
      return JSON.parse(systemData);
    }
  } catch (error) {
    console.error("Error loading system notifications:", error);
  }
  return [];
};

// Notification Item Component
const NotificationItem = React.memo(({ item, onPress, onMarkAsRead }) => (
  <TouchableOpacity
    style={[styles.notificationCard, !item.read && styles.unreadCard]}
    onPress={() => {
      onPress(item);
      onMarkAsRead(item.id);
    }}
  >
    <View style={styles.notificationTextContent}>
      <Text style={styles.notificationTitle} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.notificationMessage} numberOfLines={2}>
        {item.message}
      </Text>
    </View>
    <Text style={styles.notificationDate}>{new Date(item.date).toLocaleDateString()}</Text>
    {!item.read && <View style={styles.unreadDot} />}
  </TouchableOpacity>
));

// Main Notifications Component
export default function Notifications({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRealNotifications = async () => {
    try {
      setLoading(true);
      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const items = [];

      if (user?.id) {
        const chatResult = await apiService.getChatNotifications(user.id).catch(() => null);
        const messages = Array.isArray(chatResult?.data) ? chatResult.data : [];
        messages.forEach((message) => {
          if (Number(message.is_read) === 1) return;
          const sender = String(message.from_user_name || '').trim() || 'New message';
          items.push({
            id: `chat-${message.id}`,
            kind: 'message',
            title: sender,
            message: message.message || 'Sent you a message',
            date: message.created_at,
            read: false,
            fromUserId: message.from_user_id,
          });
        });
      }

      const appResult = await apiService.getInAppNotifications().catch(() => null);
      const appRows = Array.isArray(appResult?.data) ? appResult.data : [];
      appRows.forEach((row) => {
        if (Number(row.is_read) === 1) return;
        const isReview = row.kind === 'assigned_review';
        items.push({
          id: `${row.kind || 'notice'}-${row.id}`,
          sourceId: row.id,
          kind: isReview ? 'review' : 'notice',
          title: row.ticket_title || (isReview ? 'Abnormal Reading Assigned' : 'Notification'),
          message: row.message || row.patient_name || '',
          date: row.created_at,
          read: false,
          practiceId: row.practice_id,
          patientId: row.patient_id,
        });
      });

      items.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setNotifications(items);
      await AsyncStorage.setItem('unreadBadgeCount', String(items.length));
    } catch (error) {
      console.warn('Error loading notifications:', error?.message || error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadRealNotifications();
    }, [])
  );

  const handleNotificationPress = async (notification) => {
    setNotifications((prev) => prev.filter((item) => item.id !== notification.id));

    if (notification.kind === 'message' && notification.fromUserId) {
      dismissChatNotifications(notification.fromUserId);
      navigation.navigate('Chat', { openUserId: notification.fromUserId });
      return;
    }

    if (notification.kind === 'review') {
      if (notification.sourceId) {
        apiService.markInAppNotificationRead(notification.sourceId).catch(() => null);
      }
      dismissAbnormalNotification({
        practiceId: notification.practiceId,
        patientId: notification.patientId,
      });
      navigation.navigate('AssignedAbnormalReviews');
      return;
    }

    if (notification.sourceId) {
      apiService.markInAppNotificationRead(notification.sourceId).catch(() => null);
    }
  };

  const renderItem = useCallback(({ item }) => (
    <NotificationItem
      item={item}
      onPress={handleNotificationPress}
      onMarkAsRead={() => {}}
    />
  ), []);

  return (
    <SafeAreaProvider>
      <View style={styles.screenRoot}>
        <LinearGradient colors={SCREEN_BG_COLORS} style={styles.fullScreenContainer}>
          <SafeAreaView style={styles.safeArea} edges={['top']}>
            <StatusBar backgroundColor="transparent" barStyle="dark-content" translucent />

            <View style={styles.topbar}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
              >
                <MaterialIcons name="arrow-back" size={21} color="#0b1f3f" />
              </TouchableOpacity>
              <Text style={styles.topbarTitle}>Notifications</Text>
              <View style={styles.filterIconButton} />
            </View>

            <View style={styles.contentSection}>
              <Text style={styles.sectionTitle}>
                Notifications ({notifications.length})
              </Text>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading notifications...</Text>
                </View>
              ) : (
                <FlatList
                  data={notifications}
                  renderItem={renderItem}
                  keyExtractor={(item) => String(item.id)}
                  extraData={notifications.length}
                  contentContainerStyle={styles.listContentContainer}
                  ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>No notifications.</Text>
                    </View>
                  )}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: '#fffdfb',
  },
  fullScreenContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },

  // ── HEADER ──
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Math.max(scaleWidth(16), 16),
    paddingTop: scaleHeight(8),
    paddingBottom: scaleHeight(10),
  },
  backButton: {
    width: Math.max(scaleWidth(42), 42),
    height: Math.max(scaleWidth(42), 42),
    borderRadius: scaleWidth(14),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    shadowColor: '#0b1f3f',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 26,
    elevation: 3,
  },
  topbarTitle: {
    flex: 1,
    fontSize: scaleFont(20),
    lineHeight: scaleFont(24),
    fontWeight: '800',
    color: '#0b1f3f',
    textAlign: 'center',
    marginHorizontal: scaleWidth(8),
  },
  filterIconButton: {
    width: Math.max(scaleWidth(42), 42),
    height: Math.max(scaleWidth(42), 42),
    borderRadius: scaleWidth(14),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    shadowColor: '#0b1f3f',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 26,
    elevation: 3,
  },
  markAllReadButton: {
    alignSelf: 'flex-end',
    marginTop: scaleHeight(8),
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: scaleWidth(10),
    paddingVertical: scaleHeight(6),
    borderRadius: scaleWidth(8),
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  markAllReadText: {
    fontSize: scaleFont(11),
    color: '#0A1C30',
    fontWeight: '500',
  },

  // ── BODY ──
  contentSection: {
    flex: 1,
    paddingTop: scaleHeight(4),
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scaleWidth(20),
    paddingBottom: scaleHeight(15),
    paddingTop: scaleHeight(5),
  },
  filterButton: {
    paddingHorizontal: scaleWidth(10),
    paddingVertical: scaleHeight(5),
    borderRadius: scaleWidth(12),
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: '#DEE2E6',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: scaleWidth(2),
  },
  activeFilterButton: {
    backgroundColor: PRIMARY_ACCENT,
    borderColor: PRIMARY_ACCENT,
  },
  filterText: {
    fontSize: scaleFont(10),
    fontWeight: '500',
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },
  activeFilterText: {
    color: 'white',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: scaleFont(18),
    fontWeight: '700',
    marginBottom: scaleHeight(10),
    paddingHorizontal: scaleWidth(20),
    color: colors.textPrimary,
    marginTop: scaleHeight(5),
    textAlign: 'left',
  },
  listContentContainer: {
    paddingHorizontal: scaleWidth(20),
    paddingBottom: scaleHeight(40),
  },

  // ── NOTIFICATION CARD ──
  notificationCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: scaleWidth(10),
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(12),
    shadowColor: '#0b1f3f',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e8ecf0',
    borderLeftWidth: scaleWidth(4),
    borderLeftColor: SECONDARY_ACCENT,
    marginBottom: scaleHeight(10),
    position: 'relative',
  },
  unreadCard: {
    borderLeftColor: PRIMARY_ACCENT,
    backgroundColor: '#F5F8FF',
  },
  notificationTextContent: {
    flex: 1,
    marginRight: scaleWidth(10),
  },
  notificationTitle: {
    fontSize: scaleFont(14),
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: scaleHeight(4),
  },
  notificationType: {
    fontSize: scaleFont(11),
    fontWeight: '400',
    color: colors.textSecondary,
  },
  notificationMessage: {
    fontSize: scaleFont(12),
    color: colors.textSecondary,
    lineHeight: scaleHeight(16),
  },
  notificationDate: {
    fontSize: scaleFont(10),
    color: colors.textSecondary,
    marginTop: scaleHeight(2),
  },
  unreadDot: {
    position: 'absolute',
    top: scaleHeight(8),
    right: scaleWidth(8),
    width: scaleWidth(6),
    height: scaleWidth(6),
    borderRadius: scaleWidth(3),
    backgroundColor: colors.danger || 'red',
  },

  // ── LOADING / EMPTY ──
  loadingContainer: {
    alignItems: 'center',
    marginTop: scaleHeight(50),
    paddingHorizontal: scaleWidth(20),
  },
  loadingText: {
    fontSize: scaleFont(14),
    color: colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: scaleHeight(50),
    paddingHorizontal: scaleWidth(20),
  },
  emptyText: {
    fontSize: scaleFont(14),
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // ── FILTER DROPDOWN MODAL ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  filterDropdown: {
    position: 'absolute',
    top: scaleHeight(90),
    right: scaleWidth(20),
    backgroundColor: '#FFFFFF',
    borderRadius: scaleWidth(10),
    paddingVertical: scaleHeight(6),
    minWidth: scaleWidth(150),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  filterDropdownItem: {
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(12),
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filterDropdownText: {
    fontSize: scaleFont(14),
    color: '#0A1C30',
    fontWeight: '500',
  },
});