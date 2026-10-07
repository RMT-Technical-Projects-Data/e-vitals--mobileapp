import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
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
import PatientAvatar from '../../components/common/PatientAvatar';
import { formatLastFirstName } from '../../utils/formatPersonName';
import {
  disableBiometricLogin,
  enableBiometricLogin,
  getBiometricStatus,
} from '../../services/biometricAuth';
import {
  registerPushTokenWithBackend,
  unregisterPushTokenFromBackend,
} from '../../services/pushNotificationService';
import { refreshNotificationInbox } from '../../utils/notificationInbox';
import {
  areNotificationsEnabled,
  setNotificationsEnabled,
} from '../../utils/notificationPreference';
import notifee from '@notifee/react-native';
import { pick, types, errorCodes, isErrorWithCode } from '@react-native-documents/picker';

const TICKET_CATEGORIES = ['Bug', 'Error', 'Enhancement', 'Feature Request', 'Other'];
const MAX_EVIDENCE_BYTES = 20 * 1024 * 1024;
const MAX_EVIDENCE_FILE_COUNT = 20;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];

const formatEvidenceSize = (bytes) => {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

const imageMimeFromFile = (file) => {
  const mime = String(file?.type || '').toLowerCase();
  if (ALLOWED_IMAGE_TYPES.includes(mime)) return mime === 'image/jpg' ? 'image/jpeg' : mime;
  const name = String(file?.name || file?.uri || '').toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.gif')) return 'image/gif';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  return '';
};


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
const SettingsScreen = ({ navigation }) => {
  const { logout, updateUser } = useAuth();
  const [userName, setUserName] = useState('E-Vitals');
  const [userEmail, setUserEmail] = useState('aamirse007@gmail.com');
  const [userRole, setUserRole] = useState('patient');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profilePic, setProfilePic] = useState(null);

  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState(Platform.OS === 'ios' ? 'Face ID' : 'Biometric login');
  const [isSupportModalVisible, setIsSupportModalVisible] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isSessionModalVisible, setIsSessionModalVisible] = useState(false);
  const [sessionNotice, setSessionNotice] = useState(null);
  const [isLogoutVisible, setIsLogoutVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [sessionTimeInput, setSessionTimeInput] = useState('30');
  const [sessionTime, setSessionTime] = useState(30);

  const [ticketCategory, setTicketCategory] = useState(TICKET_CATEGORIES[0]);
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketDescriptionError, setTicketDescriptionError] = useState('');
  const [ticketFormError, setTicketFormError] = useState('');
  const [ticketImages, setTicketImages] = useState([]);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        const storedFirst = user.first_name || '';
        const storedLast = user.last_name || '';
        setFirstName(storedFirst);
        setLastName(storedLast);
        setUserName(formatLastFirstName({ first_name: storedFirst, last_name: storedLast }) || 'E-Vitals');
        setUserEmail(user.email || 'aamirse007@gmail.com');
        setUserRole(user.role_name || user.role || 'patient');
        setProfilePic(user.profile_pic || user.profilePic || user.profile_image || null);

        const isPatient = Number(user.role_id) === 6
          || String(user.role_name || user.role || '').toLowerCase() === 'patient';
        if (isPatient) {
          try {
            const patientResult = await apiService.getPatientProfile();
            const patientRecord = patientResult?.data?.patient || patientResult?.data || null;
            const picture = patientRecord?.profile_pic || patientRecord?.profilePic || patientRecord?.profile_image || null;
            if (picture) setProfilePic(picture);
            if (patientRecord?.first_name) setFirstName(patientRecord.first_name);
            if (patientRecord?.last_name) setLastName(patientRecord.last_name);
            const recordName = formatLastFirstName(patientRecord);
            if (recordName) setUserName(recordName);
          } catch (patientError) {
            console.log('Could not load patient profile picture:', patientError.message);
          }
        }
        
        let sessionMinutes = 30;
        if (user.session_time) {
          const parsed = parseInt(user.session_time, 10);
          if (!isNaN(parsed) && parsed >= 1) {
            sessionMinutes = parsed;
          }
        }
        setSessionTime(sessionMinutes);
      }

      setIsNotificationsEnabled(await areNotificationsEnabled());

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
    setIsLogoutVisible(true);
  };

  const confirmLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      try { await apiService.logout(); } catch (_) {}
      await logout();
    } finally {
      setIsLoggingOut(false);
      setIsLogoutVisible(false);
    }
  };

  const toggleNotifications = async () => {
    const next = !isNotificationsEnabled;
    setIsNotificationsEnabled(next);
    try {
      await setNotificationsEnabled(next);
      if (next) {
        await registerPushTokenWithBackend();
      } else {
        await unregisterPushTokenFromBackend();
        await notifee.cancelAllNotifications();
        await refreshNotificationInbox();
      }
    } catch (error) {
      const reverted = !next;
      setIsNotificationsEnabled(reverted);
      await setNotificationsEnabled(reverted);
      Alert.alert('Notifications', 'Could not update notification settings. Please try again.');
    }
  };

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

  const resetTicketForm = () => {
    setTicketCategory(TICKET_CATEGORIES[0]);
    setTicketTitle('');
    setTicketDescription('');
    setTicketDescriptionError('');
    setTicketFormError('');
    setTicketImages([]);
  };

  const closeTicketModal = () => {
    if (isSubmittingTicket) return;
    setIsSupportModalVisible(false);
    setIsCategoryOpen(false);
  };

  const addTicketImages = async () => {
    try {
      const picked = await pick({
        allowMultiSelection: true,
        type: [types.images],
      });
      const next = [...ticketImages];
      let formError = '';
      for (const file of picked) {
        const mime = imageMimeFromFile(file);
        if (!mime) {
          formError = `"${file.name || 'Image'}" is not allowed. Use PNG, JPG, JPEG, or GIF.`;
          continue;
        }
        if (file.size != null && file.size > MAX_EVIDENCE_BYTES) {
          formError = `"${file.name || 'Image'}" exceeds 20MB.`;
          continue;
        }
        const duplicate = next.some((existing) => existing.uri === file.uri && existing.size === file.size);
        if (duplicate) continue;
        next.push({
          uri: file.uri,
          name: file.name || `evidence-${Date.now()}.jpg`,
          type: mime,
          size: Number(file.size) || 0,
        });
      }
      if (next.length > MAX_EVIDENCE_FILE_COUNT) {
        formError = `You can upload up to ${MAX_EVIDENCE_FILE_COUNT} images.`;
      }
      const limited = next.slice(0, MAX_EVIDENCE_FILE_COUNT);
      const total = limited.reduce((sum, file) => sum + (file.size || 0), 0);
      if (total > MAX_EVIDENCE_BYTES) {
        setTicketFormError('Total size of all images must not exceed 20MB.');
        return;
      }
      setTicketFormError(formError);
      setTicketImages(limited);
    } catch (error) {
      if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) return;
      setTicketFormError('Unable to choose images.');
    }
  };

  const handleSubmitTicket = async () => {
    const description = ticketDescription.trim();
    if (!description) {
      setTicketDescriptionError('Description is required.');
      return;
    }
    const totalBytes = ticketImages.reduce((sum, file) => sum + (file.size || 0), 0);
    if (totalBytes > MAX_EVIDENCE_BYTES) {
      setTicketFormError('Total size of all images must not exceed 20MB.');
      return;
    }
    setTicketFormError('');

    const formData = new FormData();
    formData.append('category', ticketCategory);
    formData.append('title', ticketTitle.trim());
    formData.append('description', description);
    ticketImages.forEach((file) => {
      formData.append('evidence', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      });
    });

    setIsSubmittingTicket(true);
    try {
      const result = await apiService.createSupportTicket(formData);
      if (!result?.success) {
        const message = result?.message || 'Failed to submit ticket.';
        if (/description is required/i.test(message)) {
          setTicketDescriptionError('Description is required.');
          return;
        }
        setTicketFormError(message);
        return;
      }
      resetTicketForm();
      setIsSupportModalVisible(false);
      setTimeout(() => {
        setSessionNotice({
          title: 'Submit Support Ticket',
          message: 'Support ticket submitted successfully.',
        });
      }, 280);
    } catch (error) {
      const message = error?.message || 'Failed to submit ticket.';
      if (/description is required/i.test(message)) {
        setTicketDescriptionError('Description is required.');
      } else {
        setTicketFormError(message);
      }
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const handleOpenSessionModal = () => {
    setSessionTimeInput(String(sessionTime));
    setIsSessionModalVisible(true);
  };

  const handleSaveSessionTime = async () => {
    const parsed = parseInt(sessionTimeInput, 10);
    if (isNaN(parsed) || parsed < 1) {
      setSessionNotice({
        title: 'Session timeout',
        message: 'Please enter a valid session time of at least 1 minute.',
      });
      return;
    }

    try {
      const result = await apiService.updateSessionSettings(parsed);
      if (result && result.success) {
        setSessionTime(parsed);
        await updateUser({ session_time: parsed });
        setIsSessionModalVisible(false);
        setSessionNotice({
          title: 'Session timeout',
          message: 'Session timeout updated successfully.',
        });
      } else {
        setSessionNotice({
          title: 'Session timeout',
          message: result?.message || 'Failed to update session settings.',
        });
      }
    } catch (error) {
      console.log('Error saving session time:', error);
      setSessionNotice({
        title: 'Session timeout',
        message: error.message || 'Failed to update session settings.',
      });
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
              <MaterialIcons name="arrow-back" size={21} color="#0b1f3f" />
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
                {profilePic ? (
                  <PatientAvatar
                    profilePic={profilePic}
                    firstName={firstName}
                    lastName={lastName}
                    size={scaleWidth(60)}
                    borderRadius={scaleWidth(20)}
                    backgroundColor="#0b1f3f"
                  />
                ) : (
                  <Image source={require('../../assets/images/batch_09/user.png')} style={styles.avatarIcon} resizeMode="contain" />
                )}
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{userName}</Text>
                <Text style={styles.profileEmail}>{userEmail}</Text>
                <Text style={styles.profileRole}>Role: {userRole}</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Preferences</Text>

            <View style={styles.settingsListCard}>

            {/* Profile */}
            <TouchableOpacity style={styles.settingRow} onPress={() => navigation.navigate('Profile')}>
              <View style={styles.iconBox}>
                <Image source={require('../../assets/images/batch_08/user-2.png')} style={{ width: scaleWidth(20), height: scaleWidth(20), tintColor: NAVY_BLUE }} resizeMode="contain" />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Profile</Text>
                <Text style={styles.settingSubtitle}>View your profile information</Text>
              </View>
              <Text style={{ fontSize: scaleFont(24), color: '#c7c7cc', paddingHorizontal: scaleWidth(5) }}>›</Text>
            </TouchableOpacity>
            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.iconBox}>
                <Image source={require('../../assets/images/batch_06/notification.png')} style={{ width: scaleWidth(20), height: scaleWidth(20), tintColor: NAVY_BLUE }} resizeMode="contain" />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Notifications</Text>
                <Text style={styles.settingSubtitle}>
                  {isNotificationsEnabled ? 'You will receive notifications' : 'Notifications are turned off'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.toggleContainer, isNotificationsEnabled ? styles.toggleActive : styles.toggleInactive]}
                onPress={toggleNotifications}
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

            <TouchableOpacity style={styles.settingRow} onPress={() => setIsSupportModalVisible(true)}>
              <View style={styles.iconBox}>
                <Image source={require('../../assets/images/batch_04/help-web-button.png')} style={{ width: scaleWidth(20), height: scaleWidth(20), tintColor: NAVY_BLUE }} resizeMode="contain" />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Submit Support Ticket</Text>
                <Text style={styles.settingSubtitle}>Report a bug, error, or request</Text>
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

      <Modal
        visible={isSupportModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeTicketModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.ticketModal]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Submit Support Ticket</Text>

              <Text style={styles.fieldLabel}>Category</Text>
              <TouchableOpacity style={styles.inputField} onPress={() => setIsCategoryOpen((open) => !open)}>
                <View style={styles.categoryTrigger}>
                  <Text style={styles.fieldValue}>{ticketCategory}</Text>
                  <MaterialIcons name={isCategoryOpen ? 'expand-less' : 'expand-more'} size={22} color="#64748b" />
                </View>
              </TouchableOpacity>
              {isCategoryOpen ? TICKET_CATEGORIES.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={styles.categoryRow}
                  onPress={() => {
                    setTicketCategory(item);
                    setIsCategoryOpen(false);
                  }}
                >
                  <Text style={styles.fieldValue}>{item}</Text>
                  {ticketCategory === item ? <MaterialIcons name="check" size={18} color={NAVY_BLUE} /> : null}
                </TouchableOpacity>
              )) : null}

              <Text style={styles.fieldLabel}>Subject <Text style={styles.optionalLabel}>(optional)</Text></Text>
              <TextInput
                style={styles.inputField}
                value={ticketTitle}
                onChangeText={setTicketTitle}
                placeholder="Brief summary of the issue"
                placeholderTextColor="#999"
                maxLength={255}
              />

              <Text style={styles.fieldLabel}>Description <Text style={styles.requiredMark}>*</Text></Text>
              <TextInput
                style={[styles.inputField, styles.textArea, ticketDescriptionError ? styles.inputError : null]}
                value={ticketDescription}
                onChangeText={(value) => {
                  setTicketDescription(value);
                  if (ticketDescriptionError && value.trim()) setTicketDescriptionError('');
                }}
                placeholder="Describe the issue in detail. If submitting a video, please upload it to Google Drive and paste the shareable link here."
                placeholderTextColor="#999"
                multiline={true}
                textAlignVertical="top"
              />
              {ticketDescriptionError ? <Text style={styles.fieldError}>{ticketDescriptionError}</Text> : null}

              <Text style={styles.fieldLabel}>Upload images</Text>
              <TouchableOpacity style={styles.uploadBox} onPress={addTicketImages}>
                <Text style={styles.uploadTitle}>Tap to choose images</Text>
                <Text style={styles.uploadHint}>
                  PNG, JPG, JPEG, GIF. Up to {MAX_EVIDENCE_FILE_COUNT} images, {formatEvidenceSize(ticketImages.reduce((sum, file) => sum + (file.size || 0), 0))} / 20 MB total.
                </Text>
              </TouchableOpacity>
              {ticketImages.map((file, index) => (
                <View key={`${file.uri}-${index}`} style={styles.uploadRow}>
                  <View style={styles.uploadMeta}>
                    <Text style={styles.uploadName} numberOfLines={1}>{file.name}</Text>
                    <Text style={styles.uploadHint}>{formatEvidenceSize(file.size)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setTicketImages((prev) => prev.filter((_, i) => i !== index))}>
                    <MaterialIcons name="close" size={20} color="#D32F2F" />
                  </TouchableOpacity>
                </View>
              ))}
              {ticketFormError ? <Text style={styles.fieldError}>{ticketFormError}</Text> : null}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeTicketModal} disabled={isSubmittingTicket}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.sendBtn} onPress={handleSubmitTicket} disabled={isSubmittingTicket}>
                  <Text style={styles.sendBtnText}>{isSubmittingTicket ? 'Sending…' : 'Send'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
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
              <Pressable
                onPress={() => setIsSessionModalVisible(false)}
                style={({ pressed }) => [
                  styles.sessionCancelBtn,
                  pressed && styles.sessionCancelBtnPressed,
                ]}
                android_ripple={{ color: 'rgba(1, 68, 91, 0.16)' }}
              >
                {({ pressed }) => (
                  <Text style={[styles.sessionCancelBtnText, pressed && styles.sessionCancelBtnTextPressed]}>
                    Cancel
                  </Text>
                )}
              </Pressable>
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

      <Modal
        visible={!!sessionNotice}
        transparent
        animationType="fade"
        onRequestClose={() => setSessionNotice(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{sessionNotice?.title}</Text>
            <Text style={styles.noticeBody}>{sessionNotice?.message}</Text>
            <View style={styles.noticeActions}>
              <TouchableOpacity
                style={styles.sendBtn}
                onPress={() => setSessionNotice(null)}
              >
                <Text style={styles.sendBtnText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isLogoutVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isLoggingOut) setIsLogoutVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Logout</Text>
            <Text style={styles.logoutConfirmText}>Are you sure you want to log out?</Text>
            <View style={styles.logoutActions}>
              <TouchableOpacity
                style={styles.logoutActionBtn}
                onPress={() => setIsLogoutVisible(false)}
                disabled={isLoggingOut}
              >
                <Text style={styles.logoutActionText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.logoutActionBtn, styles.logoutActionDanger]}
                onPress={confirmLogout}
                disabled={isLoggingOut}
              >
                <Text
                  style={styles.logoutActionText}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  {isLoggingOut ? 'Logging out…' : 'Logout'}
                </Text>
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
    shadowColor: '#0b1f3f',
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
    shadowColor: '#0b1f3f',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  avatarContainer: {
    width: scaleWidth(60),
    height: scaleWidth(60),
    borderRadius: scaleWidth(20),
    backgroundColor: '#0b1f3f',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
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
    shadowColor: '#0b1f3f',
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
  ticketModal: {
    maxHeight: '88%',
  },
  fieldLabel: {
    fontSize: scaleFont(13),
    fontWeight: '700',
    color: TEXT_DARK,
    marginBottom: scaleHeight(6),
  },
  optionalLabel: {
    fontWeight: '500',
    color: TEXT_MUTED,
  },
  requiredMark: {
    color: '#D32F2F',
  },
  fieldValue: {
    fontSize: scaleFont(14),
    color: TEXT_DARK,
    fontWeight: '600',
  },
  fieldError: {
    color: '#D32F2F',
    fontSize: scaleFont(12),
    marginTop: scaleHeight(-6),
    marginBottom: scaleHeight(10),
  },
  inputError: {
    borderColor: '#D32F2F',
  },
  uploadBox: {
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: scaleWidth(8),
    borderStyle: 'dashed',
    padding: scaleWidth(14),
    marginBottom: scaleHeight(10),
  },
  uploadTitle: {
    fontSize: scaleFont(14),
    fontWeight: '700',
    color: NAVY_BLUE,
    marginBottom: scaleHeight(4),
  },
  uploadHint: {
    fontSize: scaleFont(12),
    color: TEXT_MUTED,
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scaleHeight(8),
  },
  uploadMeta: {
    flex: 1,
    marginRight: scaleWidth(8),
  },
  uploadName: {
    fontSize: scaleFont(13),
    color: TEXT_DARK,
    fontWeight: '600',
  },
  categoryTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scaleHeight(12),
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
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
  sessionCancelBtn: {
    paddingVertical: scaleHeight(10),
    paddingHorizontal: scaleWidth(20),
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: scaleWidth(8),
    marginRight: scaleWidth(10),
  },
  sessionCancelBtnPressed: {
    backgroundColor: NAVY_BLUE,
    borderColor: NAVY_BLUE,
  },
  sessionCancelBtnText: {
    color: NAVY_BLUE,
    fontWeight: '600',
    fontSize: scaleFont(14),
  },
  sessionCancelBtnTextPressed: {
    color: WHITE,
  },
  sendBtn: {
    paddingVertical: scaleHeight(10),
    paddingHorizontal: scaleWidth(20),
    backgroundColor: NAVY_BLUE,
    borderRadius: scaleWidth(8),
  },
  logoutActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    marginTop: scaleHeight(10),
    gap: scaleWidth(10),
  },
  logoutActionBtn: {
    flex: 1,
    minHeight: scaleHeight(44),
    paddingVertical: scaleHeight(10),
    paddingHorizontal: scaleWidth(8),
    backgroundColor: '#ced4da',
    borderRadius: scaleWidth(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutActionDanger: {
    backgroundColor: '#D32F2F',
  },
  logoutActionText: {
    color: WHITE,
    fontWeight: '600',
    fontSize: scaleFont(14),
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  sendBtnText: {
    color: WHITE,
    fontWeight: '600',
    fontSize: scaleFont(14),
  },
  logoutConfirmText: {
    width: '100%',
    alignSelf: 'stretch',
    textAlign: 'center',
    fontSize: scaleFont(14),
    lineHeight: scaleFont(20),
    color: TEXT_DARK,
    marginBottom: scaleHeight(8),
  },
  noticeBody: {
    fontSize: scaleFont(14),
    lineHeight: scaleFont(20),
    color: TEXT_DARK,
    textAlign: 'center',
    marginTop: scaleHeight(-8),
    marginBottom: scaleHeight(8),
  },
  noticeActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: scaleHeight(8),
  },
});

export default SettingsScreen;
