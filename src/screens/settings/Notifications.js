import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Modal,
  StatusBar,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { colors, fonts } from '../../config/globall';
import { API_CONFIG } from '../../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

const scaleWidth = size => (width / guidelineBaseWidth) * size;
const scaleHeight = size => (height / guidelineBaseHeight) * size;
const scaleFont = size => scaleWidth(size);

const SCREEN_BG_COLORS = ['#fffdfb', '#edf1f6', '#eef1f5'];
const PRIMARY_ACCENT = '#071B34';
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
        {item.title} - <Text style={styles.notificationType}>[{item.type}]</Text>
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
  const [activeFilter, setActiveFilter] = useState('All');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Save notifications to AsyncStorage
  const saveNotificationsState = async (notificationsList) => {
    try {
      await AsyncStorage.setItem('notificationsState', JSON.stringify(notificationsList));
      console.log('✅ Saved notifications state:', notificationsList.length);
    } catch (error) {
      console.error("Error saving notifications state:", error);
    }
  };

  // Load saved notifications
  const loadSavedNotifications = async () => {
    try {
      const savedData = await AsyncStorage.getItem('notificationsState');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        console.log('📖 Loaded saved notifications:', parsed.length);
        return parsed;
      }
    } catch (error) {
      console.error("Error loading saved notifications:", error);
    }
    return null;
  };

  // Update badge count
  const updateBadgeCount = async (notificationsList) => {
    const unreadCount = notificationsList.filter(n => !n.read).length;
    await AsyncStorage.setItem('unreadBadgeCount', unreadCount.toString());
    console.log('🔔 Updated badge count:', unreadCount);
  };

  // Load notifications with proper merging logic (FIXED - No Duplicates)
  const loadRealNotifications = async () => {
    try {
      setLoading(true);

      // Fetch fresh data
      const patientData = await fetchPatientDataForAlerts();
      const storedAssessments = await loadStoredAssessments();
      const systemNotifications = await loadSystemNotifications();

      // Generate new alerts from API
      const newAlerts = patientData ? generateMedicalAlerts(patientData) : [];

      // Load saved notifications
      const savedNotifications = await loadSavedNotifications();

      // Use a Map to ensure unique notifications by ID
      const notificationMap = new Map();

      // STEP 1: Add all saved notifications first (preserve their read status)
      if (savedNotifications && savedNotifications.length > 0) {
        console.log('📖 Found saved notifications:', savedNotifications.length);
        savedNotifications.forEach(notif => {
          notificationMap.set(notif.id, notif);
        });
      }

      // STEP 2: Process new alerts - only add if not already in map
      console.log('🔍 Processing new alerts:', newAlerts.length);
      newAlerts.forEach(newAlert => {
        if (notificationMap.has(newAlert.id)) {
          const existing = notificationMap.get(newAlert.id);
          notificationMap.set(newAlert.id, {
            ...newAlert,
            read: existing.read
          });
          console.log('♻️ Updated existing alert:', newAlert.id);
        } else {
          notificationMap.set(newAlert.id, newAlert);
          console.log('✨ Added new alert:', newAlert.id);
        }
      });

      // STEP 3: Process stored assessments - only add if not already in map
      console.log('🔍 Processing assessments:', storedAssessments.length);
      storedAssessments.forEach(assessment => {
        if (notificationMap.has(assessment.id)) {
          const existing = notificationMap.get(assessment.id);
          notificationMap.set(assessment.id, {
            ...assessment,
            read: existing.read
          });
          console.log('♻️ Updated existing assessment:', assessment.id);
        } else {
          notificationMap.set(assessment.id, assessment);
          console.log('✨ Added new assessment:', assessment.id);
        }
      });

      // STEP 4: Process system notifications - only add if not already in map
      console.log('🔍 Processing system notifications:', systemNotifications.length);
      systemNotifications.forEach(sysNotif => {
        if (notificationMap.has(sysNotif.id)) {
          const existing = notificationMap.get(sysNotif.id);
          notificationMap.set(sysNotif.id, {
            ...sysNotif,
            read: existing.read
          });
          console.log('♻️ Updated existing system notification:', sysNotif.id);
        } else {
          notificationMap.set(sysNotif.id, sysNotif);
          console.log('✨ Added new system notification:', sysNotif.id);
        }
      });

      // STEP 5: Clean up old notifications (older than 30 days)
      const now = new Date();
      const idsToRemove = [];
      notificationMap.forEach((notif, id) => {
        const notifDate = new Date(notif.date);
        const daysDiff = (now - notifDate) / (1000 * 60 * 60 * 24);
        if (daysDiff > 30) {
          idsToRemove.push(id);
        }
      });
      idsToRemove.forEach(id => notificationMap.delete(id));
      if (idsToRemove.length > 0) {
        console.log('🗑️ Removed old notifications:', idsToRemove.length);
      }

      // STEP 6: Convert Map to array (Map ensures uniqueness)
      const finalNotifications = Array.from(notificationMap.values());

      // STEP 7: Sort by date (newest first)
      finalNotifications.sort((a, b) => new Date(b.date) - new Date(a.date));

      console.log('✅ Final unique notifications:', finalNotifications.length);
      console.log('📋 Notification IDs:', finalNotifications.map(n => n.id));

      // Save state
      await saveNotificationsState(finalNotifications);
      await updateBadgeCount(finalNotifications);

      setNotifications(finalNotifications);

    } catch (error) {
      console.error('❌ Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load on mount and when screen focuses
  useFocusEffect(
    useCallback(() => {
      loadRealNotifications();
    }, [])
  );

  // Mark single notification as read
  const handleMarkAsRead = async (notificationId) => {
    console.log('📖 Marking as read:', notificationId);

    const updatedNotifications = notifications.map(notification =>
      notification.id === notificationId
        ? { ...notification, read: true }
        : notification
    );

    setNotifications(updatedNotifications);
    await saveNotificationsState(updatedNotifications);
    await updateBadgeCount(updatedNotifications);
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    const updatedNotifications = notifications.map(notification => ({
      ...notification,
      read: true
    }));

    setNotifications(updatedNotifications);
    await saveNotificationsState(updatedNotifications);
    await updateBadgeCount(updatedNotifications);

    console.log('✅ All notifications marked as read');
  };

  // Handle notification press
  const handleNotificationPress = (notification) => {
    if (notification.type === 'Store') {
      navigation.navigate('StoreSummary', { assessmentData: notification });
      return;
    }

    if (notification.type === 'Alert' && notification.alertType) {
      navigation.navigate('MCQ_Agent', {
        alertType: notification.alertType,
        notificationData: notification
      });
      return;
    }

    // Handle System type notifications
    if (notification.type === 'System') {
      console.log('System notification clicked:', notification.id);
      return;
    }
  };

  // Filter notifications
  const filteredNotifications = notifications.filter(notif => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Unread') return !notif.read;
    return notif.type === activeFilter;
  });

  // Generate notification types with System and Alert always included (no Store)
  const uniqueTypes = [...new Set(notifications.map(n => n.type))];
  const baseTypes = ['Alert', 'System'];
  const allTypes = [...new Set([...baseTypes, ...uniqueTypes])].filter(type => type !== 'Store');
  const notificationTypes = ['All', 'Unread', ...allTypes];

  const renderItem = useCallback(({ item }) => (
    <NotificationItem
      item={item}
      onPress={handleNotificationPress}
      onMarkAsRead={handleMarkAsRead}
    />
  ), [notifications]);

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
                <MaterialIcons name="arrow-back" size={21} color="#071B34" />
              </TouchableOpacity>
              <Text style={styles.topbarTitle}>Medical Alerts</Text>
              <TouchableOpacity
                style={styles.filterIconButton}
                onPress={() => setShowDateFilter(!showDateFilter)}
              >
                <MaterialIcons name="expand-more" size={22} color="#071B34" />
              </TouchableOpacity>
            </View>

            <View style={styles.contentSection}>
              <View style={styles.filterRow}>
                {notificationTypes.map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.filterButton,
                      activeFilter === type && styles.activeFilterButton,
                    ]}
                    onPress={() => setActiveFilter(type)}>
                    <Text
                      style={[
                        styles.filterText,
                        activeFilter === type && styles.activeFilterText,
                      ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionTitle}>
                {activeFilter} Notifications ({filteredNotifications.length})
              </Text>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading medical alerts...</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredNotifications}
                  renderItem={renderItem}
                  keyExtractor={item => item.id}
                  extraData={notifications.length}
                  contentContainerStyle={styles.listContentContainer}
                  ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>No {activeFilter.toLowerCase()} alerts.</Text>
                    </View>
                  )}
                  showsVerticalScrollIndicator={false}
                  removeClippedSubviews={true}
                />
              )}
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* ── FILTER DROPDOWN MODAL — closes on outside tap ── */}
        <Modal
          transparent={true}
          visible={showDateFilter}
          animationType="fade"
          onRequestClose={() => setShowDateFilter(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowDateFilter(false)}
          >
            <View style={styles.filterDropdown}>
              {['Today', 'Last 7 days', 'Last 30 days', 'All time'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={styles.filterDropdownItem}
                  onPress={() => setShowDateFilter(false)}
                >
                  <Text style={styles.filterDropdownText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
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
    shadowColor: '#071B34',
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
    color: '#071B34',
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
    shadowColor: '#071B34',
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
    backgroundColor: colors.backgroundLight,
    borderRadius: scaleWidth(10),
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
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