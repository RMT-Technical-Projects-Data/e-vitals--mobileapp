import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Modal,
  Alert,
  Image,
  TextInput,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/apiService';
import PremiumBottomNav from '../../components/navigation/PremiumBottomNav';
import {
  disableBiometricLogin,
  enableBiometricLogin,
  getBiometricStatus,
} from '../../services/biometricAuth';


const { width, height } = Dimensions.get('window');

const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

const scaleWidth = size => (width / guidelineBaseWidth) * size;
const scaleHeight = size => (height / guidelineBaseHeight) * size;
const scaleFont = size => scaleWidth(size);

const NAVY_BLUE = '#01445b';
const WHITE = '#FFFFFF';
const LIGHT_GREY = '#F8F9FA';
const BORDER_COLOR = '#E0E0E0';
const TEXT_DARK = '#0A1C30';
const TEXT_MUTED = '#6c757d';
const CONTACT_SUPPORT_EMAIL = 'rsaiyed@evitalsrpm.com';
const SettingsScreen = ({ navigation }) => {
  const { logout, updateUser } = useAuth();
  const [userName, setUserName] = useState('E-Vitals');
  const [userEmail, setUserEmail] = useState('aamirse007@gmail.com');
  const [userRole, setUserRole] = useState('patient');

  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState(Platform.OS === 'ios' ? 'Face ID' : 'Biometric login');
  const [isSupportModalVisible, setIsSupportModalVisible] = useState(false);
  const [isSessionModalVisible, setIsSessionModalVisible] = useState(false);
  const [sessionTimeInput, setSessionTimeInput] = useState('30');
  const [sessionTime, setSessionTime] = useState(30);

  // Support Form State
  const [supportEmail, setSupportEmail] = useState('');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserName(`${user.first_name || ''} ${user.last_name || ''}`.trim() || 'E-Vitals');
        setUserEmail(user.email || 'aamirse007@gmail.com');
        setSupportEmail(user.email || 'aamirse007@gmail.com');
        setUserRole(user.role_name || user.role || 'patient');
        
        let sessionMinutes = 30;
        if (user.session_time) {
          const parsed = parseInt(user.session_time, 10);
          if (!isNaN(parsed) && parsed >= 1) {
            sessionMinutes = parsed;
          }
        }
        setSessionTime(sessionMinutes);
      }

      const biometricStatus = await getBiometricStatus();
      setIsBiometricAvailable(biometricStatus.available);
      setIsBiometricEnabled(biometricStatus.enabled);
      setBiometricLabel(biometricStatus.label);

      // Also try fetching from API to keep it fresh
      const settingsResult = await apiService.getAccountSettings();
      if (settingsResult?.success && settingsResult?.data) {
        const dbSessionTime = settingsResult.data.session_time;
        const parsed = parseInt(dbSessionTime, 10);
        if (!isNaN(parsed) && parsed >= 1) {
          setSessionTime(parsed);
          await updateUser({ session_time: parsed });
        }
      }
    } catch (error) {
      console.log('Error loading user data:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            // Call API logout (ignore errors — always proceed)
            try { await apiService.logout(); } catch (_) {}
            // logout() clears AsyncStorage + sets isLoggedIn=false
            // App.js re-renders automatically and shows Login screen
            await logout();
          },
        },
      ]
    );
  };

  const toggleSwitch = () => setIsNotificationsEnabled(previousState => !previousState);

  const toggleBiometricLogin = async () => {
    if (!isBiometricAvailable) {
      Alert.alert(
        biometricLabel,
        `${biometricLabel} is not available on this device.`,
      );
      return;
    }

    if (isBiometricEnabled) {
      await disableBiometricLogin();
      setIsBiometricEnabled(false);
      return;
    }

    await enableBiometricLogin();
    setIsBiometricEnabled(true);
    Alert.alert(
      `${biometricLabel} enabled`,
      `Sign out and sign in once with your password to activate ${biometricLabel}. After 2 failed attempts, you can use your credentials.`,
    );
  };

  const handleSendSupport = () => {
    if (!supportMessage.trim()) {
      Alert.alert('Error', 'Please enter a message.');
      return;
    }
    // In a real app, you would send an API request here
    console.log(`Sending support email to ${CONTACT_SUPPORT_EMAIL}`, {
      from: supportEmail,
      subject: supportSubject,
      message: supportMessage
    });
    Alert.alert('Success', 'Your message has been sent to support.');
    setIsSupportModalVisible(false);
    setSupportSubject('');
    setSupportMessage('');
  };

  const handleOpenSessionModal = () => {
    setSessionTimeInput(String(sessionTime));
    setIsSessionModalVisible(true);
  };

  const handleSaveSessionTime = async () => {
    const parsed = parseInt(sessionTimeInput, 10);
    if (isNaN(parsed) || parsed < 1) {
      Alert.alert('Error', 'Please enter a valid session time of at least 1 minute.');
      return;
    }

    try {
      const result = await apiService.updateSessionSettings(parsed);
      if (result && result.success) {
        setSessionTime(parsed);
        await updateUser({ session_time: parsed });
        Alert.alert('Success', 'Session timeout updated successfully.');
        setIsSessionModalVisible(false);
      } else {
        Alert.alert('Error', result?.message || 'Failed to update session settings.');
      }
    } catch (error) {
      console.log('Error saving session time:', error);
      Alert.alert('Error', error.message || 'Failed to update session settings.');
    }
  };

  return (
    <SafeAreaProvider>
      <LinearGradient colors={['#ffffff', '#ffffff', '#ffffff']} style={styles.fullScreenContainer}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

          <View style={styles.topbar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
            >
              <MaterialIcons name="arrow-back" size={21} color="#071B34" />
            </TouchableOpacity>
            <Text style={styles.topbarTitle}>Settings</Text>
            <View style={styles.topbarSpacer} />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.bottomLightSection}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.profileCard}>
              <View style={styles.avatarContainer}>
                <Image source={require('../../assets/images/batch_09/user.png')} style={styles.avatarIcon} resizeMode="contain" />
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{userName}</Text>
                <Text style={styles.profileEmail}>{userEmail}</Text>
                <Text style={styles.profileRole}>Role: {userRole}</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Preferences</Text>

            <View style={styles.settingsListCard}>

            {/* Profile Settings */}
            <TouchableOpacity style={styles.settingRow} onPress={() => navigation.navigate('Profile')}>
              <View style={styles.iconBox}>
                <Image source={require('../../assets/images/batch_08/user-2.png')} style={{ width: scaleWidth(20), height: scaleWidth(20), tintColor: NAVY_BLUE }} resizeMode="contain" />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Profile Settings</Text>
                <Text style={styles.settingSubtitle}>Your personal information</Text>
              </View>
              <Text style={{ fontSize: scaleFont(24), color: '#c7c7cc', paddingHorizontal: scaleWidth(5) }}>›</Text>
            </TouchableOpacity>
            <View style={styles.divider} />

            {/* Notifications */}
            <View style={styles.settingRow}>
              <View style={styles.iconBox}>
                <Image source={require('../../assets/images/batch_06/notification.png')} style={{ width: scaleWidth(20), height: scaleWidth(20), tintColor: NAVY_BLUE }} resizeMode="contain" />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Notifications</Text>
                <Text style={styles.settingSubtitle}>Manage your notification preferences</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggleContainer, isNotificationsEnabled ? styles.toggleActive : styles.toggleInactive]}
                onPress={toggleSwitch}
                activeOpacity={1}
              >
                <View style={[styles.toggleCircle, isNotificationsEnabled ? styles.circleActive : styles.circleInactive]} />
              </TouchableOpacity>
            </View>
            <View style={styles.divider} />

            {isBiometricAvailable ? (
              <>
                <View style={styles.settingRow}>
                  <View style={styles.iconBox}>
                    <MaterialIcons
                      name={Platform.OS === 'ios' ? 'face' : 'fingerprint'}
                      size={scaleWidth(20)}
                      color={NAVY_BLUE}
                    />
                  </View>
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingTitle}>{biometricLabel}</Text>
                    <Text style={styles.settingSubtitle}>
                      Sign in faster. After 2 failed attempts, use your password.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.toggleContainer, isBiometricEnabled ? styles.toggleActive : styles.toggleInactive]}
                    onPress={toggleBiometricLogin}
                    activeOpacity={1}
                  >
                    <View style={[styles.toggleCircle, isBiometricEnabled ? styles.circleActive : styles.circleInactive]} />
                  </TouchableOpacity>
                </View>
                <View style={styles.divider} />
              </>
            ) : null}

            {/* Session Timeout */}
            <TouchableOpacity style={styles.settingRow} onPress={handleOpenSessionModal}>
              <View style={styles.iconBox}>
                <Image source={require('../../assets/images/batch_05/information-button.png')} style={{ width: scaleWidth(20), height: scaleWidth(20), tintColor: NAVY_BLUE }} resizeMode="contain" />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Session Timeout</Text>
                <Text style={styles.settingSubtitle}>
                  Current: {sessionTime} {sessionTime === 1 ? 'minute' : 'minutes'}
                </Text>
              </View>
              <Text style={{ fontSize: scaleFont(24), color: '#c7c7cc', paddingHorizontal: scaleWidth(5) }}>›</Text>
            </TouchableOpacity>
            <View style={styles.divider} />

            {/* Privacy Policy */}
            <TouchableOpacity style={styles.settingRow}
            // onPress={() => navigation.navigate('PrivacyPolicy')}
            >
              <View style={styles.iconBox}>
                <Image source={require('../../assets/images/batch_05/insurance.png')} style={{ width: scaleWidth(18), height: scaleWidth(18), tintColor: NAVY_BLUE }} resizeMode="contain" />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Privacy Policy</Text>
                <Text style={styles.settingSubtitle}>How we collect, use, and protect your data</Text>
              </View>
              <Text style={{ fontSize: scaleFont(24), color: '#c7c7cc', paddingHorizontal: scaleWidth(5) }}>›</Text>
            </TouchableOpacity>
            <View style={styles.divider} />

            {/* Help & Support */}
            <TouchableOpacity style={styles.settingRow} onPress={() => setIsSupportModalVisible(true)}>
              <View style={styles.iconBox}>
                <Image source={require('../../assets/images/batch_04/help-web-button.png')} style={{ width: scaleWidth(20), height: scaleWidth(20), tintColor: NAVY_BLUE }} resizeMode="contain" />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Help & Support</Text>
                <Text style={styles.settingSubtitle}>Get help and contact support</Text>
              </View>
              <Text style={{ fontSize: scaleFont(24), color: '#c7c7cc', paddingHorizontal: scaleWidth(5) }}>›</Text>
            </TouchableOpacity>
            <View style={styles.divider} />

            {/* About App */}
            <TouchableOpacity style={styles.settingRow} onPress={() => navigation.navigate('AboutApp')}>
              <View style={styles.iconBox}>
                <Image source={require('../../assets/images/batch_05/information-button.png')} style={{ width: scaleWidth(20), height: scaleWidth(20), tintColor: NAVY_BLUE }} resizeMode="contain" />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>About App</Text>
                <Text style={styles.settingSubtitle}>App version and information</Text>
              </View>
              <Text style={styles.versionText}>v1.0</Text>
              <Text style={{ fontSize: scaleFont(24), color: '#c7c7cc', paddingHorizontal: scaleWidth(5) }}>›</Text>
            </TouchableOpacity>
            <View style={styles.divider} />

            {/* Logout */}
            <TouchableOpacity style={styles.settingRow} onPress={handleLogout}>
              <View style={[styles.iconBox]}>
                <Image source={require('../../assets/images/batch_06/logout.png')} style={{ width: scaleWidth(20), height: scaleWidth(20), tintColor: "#D32F2F" }} resizeMode="contain" />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingTitle, { color: '#D32F2F' }]}>Logout</Text>
              </View>
            </TouchableOpacity>

            </View>

            <View style={styles.footerContainer}>
              <Text style={styles.footerText}>E-Vitals Remote Patient Monitoring Services</Text>
              <Text style={styles.footerSubText}>Version 1.0 (Build 2101)</Text>
            </View>
          </ScrollView>
          <PremiumBottomNav active="settings" navigation={navigation} />
        </SafeAreaView>
      </LinearGradient>

      {/* Contact Support Modal */}
      <Modal
        visible={isSupportModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsSupportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Contact Support</Text>

            <TextInput
              style={styles.inputField}
              value={supportEmail}
              onChangeText={setSupportEmail}
              placeholder="Email"
              placeholderTextColor="#999"
              editable={false} // Usually you don't want them changing their own email
            />

            <TextInput
              style={styles.inputField}
              value={supportSubject}
              onChangeText={setSupportSubject}
              placeholder="Subject (optional)"
              placeholderTextColor="#999"
            />

            <TextInput
              style={[styles.inputField, styles.textArea]}
              value={supportMessage}
              onChangeText={setSupportMessage}
              placeholder="Enter your message"
              placeholderTextColor="#999"
              multiline={true}
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsSupportModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sendBtn}
                onPress={handleSendSupport}
              >
                <Text style={styles.sendBtnText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Session Timeout Modal */}
      <Modal
        visible={isSessionModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsSessionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Session Timeout Settings</Text>
            
            <Text style={[styles.settingSubtitle, { marginBottom: scaleHeight(12), textAlign: 'center' }]}>
              Enter session inactivity lifetime (in minutes, min 1)
            </Text>

            <TextInput
              style={styles.inputField}
              value={sessionTimeInput}
              onChangeText={setSessionTimeInput}
              placeholder="Session timeout (minutes)"
              placeholderTextColor="#999"
              keyboardType="number-pad"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsSessionModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sendBtn}
                onPress={handleSaveSessionTime}
              >
                <Text style={styles.sendBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaProvider >
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  topbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    color: TEXT_DARK,
    fontSize: scaleFont(20),
    lineHeight: scaleFont(24),
    fontWeight: '800',
    textAlign: 'center',
    marginHorizontal: scaleWidth(8),
  },
  topbarSpacer: {
    width: Math.max(scaleWidth(42), 42),
  },
  scroll: {
    flex: 1,
  },
  bottomLightSection: {
    paddingHorizontal: Math.max(scaleWidth(20), 20),
    paddingTop: scaleHeight(8),
    paddingBottom: scaleHeight(130),
  },
  iconBox: {
    width: scaleWidth(40),
    height: scaleWidth(40),
    backgroundColor: 'transparent', // Removed background box
    borderRadius: scaleWidth(10),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scaleWidth(15),
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: scaleWidth(24),
    padding: scaleWidth(16),
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleHeight(18),
    borderWidth: 1,
    borderColor: '#e8ecf0',
    shadowColor: '#071B34',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  avatarContainer: {
    width: scaleWidth(60),
    height: scaleWidth(60),
    borderRadius: scaleWidth(20),
    backgroundColor: '#071B34',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarIcon: {
    width: scaleWidth(30),
    height: scaleWidth(30),
    tintColor: WHITE,
  },
  profileInfo: {
    marginLeft: scaleWidth(16),
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: TEXT_DARK,
  },
  profileEmail: {
    fontSize: scaleFont(13),
    color: TEXT_MUTED,
    marginVertical: scaleHeight(2),
  },
  profileRole: {
    fontSize: scaleFont(13),
    color: TEXT_MUTED,
  },
  sectionTitle: {
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: TEXT_DARK,
    marginBottom: scaleHeight(8),
  },
  settingsListCard: {
    backgroundColor: '#ffffff',
    borderRadius: scaleWidth(24),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e8ecf0',
    shadowColor: '#071B34',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  settingRow: {
    backgroundColor: 'transparent',
    padding: scaleWidth(12),
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingTextContainer: {
    flex: 1,
    marginLeft: scaleWidth(16),
    justifyContent: 'center',
  },
  settingTitle: {
    fontSize: scaleFont(15),
    fontWeight: '600',
    color: TEXT_DARK,
  },
  settingSubtitle: {
    fontSize: scaleFont(12),
    color: TEXT_MUTED,
    marginTop: scaleHeight(2),
  },
  divider: {
    height: 1,
    backgroundColor: BORDER_COLOR,
    marginLeft: scaleWidth(56), // Align with text
  },
  versionText: {
    fontSize: scaleFont(14),
    color: TEXT_MUTED,
    marginRight: scaleWidth(8),
  },

  // Custom Toggle Switch Styles
  toggleContainer: {
    width: scaleWidth(50),
    height: scaleHeight(28),
    borderRadius: scaleHeight(14),
    justifyContent: 'center',
    padding: scaleWidth(2),
  },
  toggleActive: {
    backgroundColor: NAVY_BLUE,
  },
  toggleInactive: {
    backgroundColor: '#D1D1D6',
  },
  toggleCircle: {
    width: scaleHeight(24),
    height: scaleHeight(24),
    borderRadius: scaleHeight(12),
    backgroundColor: WHITE,
  },
  circleActive: {
    alignSelf: 'flex-end',
  },
  circleInactive: {
    alignSelf: 'flex-start',
  },

  // Footer
  footerContainer: {
    marginTop: scaleHeight(30),
    alignItems: 'center',
  },
  footerText: {
    fontSize: scaleFont(13),
    color: TEXT_MUTED,
  },
  footerSubText: {
    fontSize: scaleFont(12),
    color: '#ced4da',
    marginTop: scaleHeight(4),
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: WHITE,
    borderRadius: scaleWidth(12),
    padding: scaleWidth(20),
  },
  modalTitle: {
    fontSize: scaleFont(18),
    fontWeight: '700',
    color: NAVY_BLUE,
    textAlign: 'center',
    marginBottom: scaleHeight(20),
  },
  inputField: {
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: scaleWidth(8),
    paddingHorizontal: scaleWidth(12),
    paddingVertical: Platform.OS === 'ios' ? scaleHeight(12) : scaleHeight(8),
    fontSize: scaleFont(14),
    color: TEXT_DARK,
    marginBottom: scaleHeight(12),
  },
  textArea: {
    height: scaleHeight(100),
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: scaleHeight(10),
  },
  cancelBtn: {
    paddingVertical: scaleHeight(10),
    paddingHorizontal: scaleWidth(20),
    backgroundColor: '#ced4da',
    borderRadius: scaleWidth(8),
    marginRight: scaleWidth(10),
  },
  cancelBtnText: {
    color: WHITE,
    fontWeight: '600',
    fontSize: scaleFont(14),
  },
  sendBtn: {
    paddingVertical: scaleHeight(10),
    paddingHorizontal: scaleWidth(20),
    backgroundColor: NAVY_BLUE,
    borderRadius: scaleWidth(8),
  },
  sendBtnText: {
    color: WHITE,
    fontWeight: '600',
    fontSize: scaleFont(14),
  },
});

export default SettingsScreen;
