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
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';


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
  const [userName, setUserName] = useState('E-Vitals');
  const [userEmail, setUserEmail] = useState('aamirse007@gmail.com');
  const [userRole, setUserRole] = useState('patient');

  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);
  const [isSupportModalVisible, setIsSupportModalVisible] = useState(false);

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
        setUserRole(user.role || 'patient');
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
            await AsyncStorage.multiRemove([
              'notificationsState',
              'unreadBadgeCount',
              'systemNotifications',
              'storedAssessments',
              'latestVitals',
              'patientId',
              'practiceId',
              'user'
            ]);
            navigation.navigate('Login');
          }
        }
      ]
    );
  };

  const toggleSwitch = () => setIsNotificationsEnabled(previousState => !previousState);

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

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.fullScreenContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={WHITE} />

        {/* Header - White Bar perfectly aligned matching blood pressure */}
        <View style={styles.headerContainer}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Home')}
              style={styles.backButtonContainer}
            >
              <Text style={styles.backButtonText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Settings</Text>
          </View>
        </View>

        <View style={[styles.bottomLightSection, { justifyContent: 'space-between' }]}>
          {/* Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <Image source={require('./android/app/src/assets/images/user.png')} style={{ width: scaleWidth(30), height: scaleWidth(30), tintColor: WHITE }} resizeMode="contain" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{userName}</Text>
              <Text style={styles.profileEmail}>{userEmail}</Text>
              <Text style={styles.profileRole}>Role: {userRole}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Preferences</Text>

          {/* Settings List */}
          <View style={styles.settingsListCard}>

            {/* Profile Settings */}
            <TouchableOpacity style={styles.settingRow} onPress={() => navigation.navigate('Profile')}>
              <View style={styles.iconBox}>
                <Image source={require('./android/app/src/assets/images/user-2.png')} style={{ width: scaleWidth(20), height: scaleWidth(20), tintColor: NAVY_BLUE }} resizeMode="contain" />
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
                <Image source={require('./android/app/src/assets/images/notification.png')} style={{ width: scaleWidth(20), height: scaleWidth(20), tintColor: NAVY_BLUE }} resizeMode="contain" />
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

            {/* Privacy Policy */}
            <TouchableOpacity style={styles.settingRow} 
            // onPress={() => navigation.navigate('PrivacyPolicy')}
            >
              <View style={styles.iconBox}>
                <Image source={require('./android/app/src/assets/images/insurance.png')} style={{ width: scaleWidth(18), height: scaleWidth(18), tintColor: NAVY_BLUE }} resizeMode="contain" />
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
                <Image source={require('./android/app/src/assets/images/help-web-button.png')} style={{ width: scaleWidth(20), height: scaleWidth(20), tintColor: NAVY_BLUE }} resizeMode="contain" />
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
                <Image source={require('./android/app/src/assets/images/information-button.png')} style={{ width: scaleWidth(20), height: scaleWidth(20), tintColor: NAVY_BLUE }} resizeMode="contain" />
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
                <Image source={require('./android/app/src/assets/images/logout.png')} style={{ width: scaleWidth(20), height: scaleWidth(20), tintColor: "#D32F2F" }} resizeMode="contain" />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingTitle, { color: '#D32F2F' }]}>Logout</Text>
              </View>
            </TouchableOpacity>

          </View>

          {/* Footer Text */}
          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>E-Vitals Remote Patient Monitoring Services</Text>
            <Text style={styles.footerSubText}>Version 1.0 (Build 2101)</Text>
          </View>
        </View>
      </SafeAreaView>

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

    </SafeAreaProvider >
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: WHITE,
  },
  headerContainer: {
    backgroundColor: WHITE,
    paddingTop: scaleHeight(20),
    paddingBottom: scaleHeight(20),
    paddingHorizontal: scaleWidth(20),
    borderBottomWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: scaleHeight(45),
  },
  backButtonContainer: {
    position: 'absolute',
    left: 0,
    justifyContent: 'center',
    height: '100%',
    zIndex: 10,
  },
  backButtonText: {
    color: '#0A1C30',
    fontSize: scaleFont(38),
    fontWeight: '300',
    lineHeight: scaleFont(42),
    includeFontPadding: false,
  },
  headerTitle: {
    color: '#0A1C30',
    fontSize: scaleFont(24),
    fontWeight: '700',
    textAlign: 'center',
  },
  bottomLightSection: {
    flex: 1,
    padding: scaleWidth(12),
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
    backgroundColor: WHITE,
    borderRadius: scaleWidth(12),
    padding: scaleWidth(12),
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleHeight(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  avatarContainer: {
    width: scaleWidth(60),
    height: scaleWidth(60),
    borderRadius: scaleWidth(30),
    backgroundColor: '#5A6278', // Greyish blue for avatar bg
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    marginLeft: scaleWidth(16),
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
    backgroundColor: WHITE,
    borderRadius: scaleWidth(12),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  settingRow: {
    backgroundColor: WHITE,
    borderRadius: scaleWidth(12),
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