import React, { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { colors, fonts } from '../../config/globall';
import Icon from 'react-native-vector-icons/MaterialIcons';
import apiService from '../../services/apiService';
import PatientAvatar from '../../components/common/PatientAvatar';
import { formatLastFirstName } from '../../utils/formatPersonName';

// Get screen width and height
const { width, height } = Dimensions.get('window');

// Set base design sizes for responsive scaling
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

// Functions to make design responsive
const scaleWidth = size => (width / guidelineBaseWidth) * size;
const scaleHeight = size => (height / guidelineBaseHeight) * size;
const scaleFont = size => scaleWidth(size);

// Define colors for UI
const NAVY_BLUE = colors.primaryButton || '#293d55';
const LIGHT_GREY = '#F4F7F9';
const SCREEN_BG_COLORS = ['#ffffff', '#ffffff', '#ffffff'];
const PATIENT_ROLE_ID = 6;
const ROLE_LABELS = {
  1: 'Super Admin',
  2: 'System Admin',
  3: 'Practice Admin',
  4: 'Provider',
  5: 'Caregiver',
  6: 'Patient',
  7: 'System Caregiver',
};

const displayText = (value, fallback = 'Not provided') => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const formatPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (local.length !== 10) return String(value || '').trim();
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
};

const formatDob = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const US_STATE_NAMES_BY_ID = {
  1: 'Alabama', 2: 'Alaska', 3: 'Arizona', 4: 'Arkansas', 5: 'California',
  6: 'Colorado', 7: 'Connecticut', 8: 'Delaware', 9: 'District of Columbia', 10: 'Florida',
  11: 'Georgia', 12: 'Hawaii', 13: 'Idaho', 14: 'Illinois', 15: 'Indiana',
  16: 'Iowa', 17: 'Kansas', 18: 'Kentucky', 19: 'Louisiana', 20: 'Maine',
  21: 'Maryland', 22: 'Massachusetts', 23: 'Michigan', 24: 'Minnesota', 25: 'Mississippi',
  26: 'Missouri', 27: 'Montana', 28: 'Nebraska', 29: 'Nevada', 30: 'New Hampshire',
  31: 'New Jersey', 32: 'New Mexico', 33: 'New York', 34: 'North Carolina', 35: 'North Dakota',
  36: 'Ohio', 37: 'Oklahoma', 38: 'Oregon', 39: 'Pennsylvania', 40: 'Puerto Rico',
  41: 'Rhode Island', 42: 'South Carolina', 43: 'South Dakota', 44: 'Tennessee', 45: 'Texas',
  46: 'Utah', 47: 'Vermont', 48: 'Virginia', 49: 'Washington', 50: 'West Virginia',
  51: 'Wisconsin', 52: 'Wyoming',
};

const US_STATE_NAMES_BY_CODE = Object.fromEntries(
  Object.entries(US_STATE_NAMES_BY_ID).map(([, name]) => {
    const code = {
      Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
      Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', 'District of Columbia': 'DC', Florida: 'FL',
      Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN',
      Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME',
      Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS',
      Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH',
      'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND',
      Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Puerto Rico': 'PR',
      'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX',
      Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV',
      Wisconsin: 'WI', Wyoming: 'WY',
    }[name];
    return [code, name];
  })
);

const cleanText = (value) => {
  if (value == null) return '';
  const text = String(value).trim();
  if (!text || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') return '';
  return text;
};

const stateNameFromId = (value) => {
  const text = cleanText(value);
  if (!/^\d+$/.test(text)) return '';
  return US_STATE_NAMES_BY_ID[Number(text)] || '';
};

const stateNameFromText = (value) => {
  const text = cleanText(value);
  if (!text || /^\d+$/.test(text)) return '';
  if (US_STATE_NAMES_BY_CODE[text.toUpperCase()]) return US_STATE_NAMES_BY_CODE[text.toUpperCase()];
  const byName = Object.values(US_STATE_NAMES_BY_ID).find((name) => name.toLowerCase() === text.toLowerCase());
  return byName || '';
};

const resolveStateName = (source) => {
  if (!source || typeof source !== 'object') return '';
  const named = stateNameFromText(source.state) || stateNameFromText(source.state_name);
  if (named) return named;
  return stateNameFromId(source.state_id) || stateNameFromId(source.state);
};

const buildProfileAddress = (patientRecord, userAddress) => {
  const userAddr = userAddress && typeof userAddress === 'object' ? userAddress : {};
  const patient = patientRecord && typeof patientRecord === 'object' ? patientRecord : null;
  if (!patient) return userAddr;

  const namedState = stateNameFromText(patient.state) || stateNameFromText(patient.state_name);
  const numericStateId = namedState
    ? ''
    : (stateNameFromId(patient.state) ? patient.state : (stateNameFromId(patient.state_id) ? patient.state_id : userAddr.state_id));

  return {
    address_line_1: cleanText(patient.address) || cleanText(patient.address_line_1) || cleanText(userAddr.address_line_1),
    address_line_2: cleanText(patient.address_line_2) || cleanText(userAddr.address_line_2),
    city: cleanText(patient.city) || cleanText(userAddr.city),
    state: namedState,
    state_id: numericStateId,
    zip_code: cleanText(patient.zip_code) || cleanText(userAddr.zip_code),
  };
};

const formatAddress = (source) => {
  if (!source) return '';
  if (typeof source === 'string') return source.trim();
  const parts = [
    source.address_line_1 || source.full_address || source.address || source.street,
    source.address_line_2,
    source.city,
    resolveStateName(source),
    source.zip_code || source.zip,
  ]
    .map((part) => (part == null ? '' : String(part).trim()))
    .filter(Boolean);
  return parts.join(', ');
};

const PatientProfileScreen = ({ navigation }) => {
  const [userData, setUserData] = useState({
    name: "Loading...",
    firstName: "",
    lastName: "",
    email: "Loading...",
    phone: "Loading...",
    dob: "Loading...",
    address: "Loading...",
    profilePic: null,
  });

  const [medicalTeam, setMedicalTeam] = useState({
    practice: "Loading...",
    roleName: "",
    provider: "",
    caregiver: "",
  });
  const [isPatient, setIsPatient] = useState(false);

  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const userResult = await apiService.getCurrentUser();
      const user = userResult?.user || userResult?.data?.user || userResult?.data || null;
      if (!user) {
        throw new Error('Profile could not be loaded.');
      }

      const roleId = Number(user.role_id);
      const patientRole = roleId === PATIENT_ROLE_ID;
      let patientRecord = null;
      if (patientRole) {
        try {
          const patientResult = await apiService.getPatientProfile();
          patientRecord = patientResult?.data?.patient || patientResult?.data || null;
        } catch (patientError) {
          console.log('Could not load patient profile:', patientError.message);
        }
      }

      const firstName = user.first_name || patientRecord?.first_name || '';
      const lastName = user.last_name || patientRecord?.last_name || '';
      const fullName = formatLastFirstName({ first_name: firstName, last_name: lastName }) || user.username || 'Not provided';
      const phoneSource = user.phone || user.cell_phone || patientRecord?.phone_number || patientRecord?.cell_phone_number || '';
      const address = formatAddress(buildProfileAddress(patientRecord, user.address));
      const dob = patientRole ? formatDob(patientRecord?.date_of_birth || patientRecord?.dob) : '';

      setIsPatient(patientRole);
      setUserData({
        name: displayText(fullName),
        firstName,
        lastName,
        email: displayText(user.email || patientRecord?.email),
        phone: displayText(formatPhone(phoneSource)),
        dob: displayText(dob),
        address: displayText(address),
        profilePic: patientRecord?.profile_pic || user.profile_pic || null,
      });
      setMedicalTeam({
        practice: displayText(patientRecord?.practice_name || user.practice_name, 'Not assigned'),
        roleName: displayText(user.role_name || ROLE_LABELS[roleId] || ''),
        provider: displayText(patientRecord?.provider_name, 'Not assigned'),
        caregiver: displayText(patientRecord?.caregiver_name, 'Not assigned'),
      });

      const storedUser = await AsyncStorage.getItem('user');
      const parsedUser = storedUser ? JSON.parse(storedUser) : {};
      await AsyncStorage.setItem('user', JSON.stringify({
        ...parsedUser,
        ...user,
        phone: user.phone || parsedUser.phone || null,
        cell_phone: user.cell_phone || parsedUser.cell_phone || null,
      }));
    } catch (error) {
      console.log('Failed to load profile:', error.message);
      setUserData((current) => ({
        ...current,
        name: current.name === 'Loading...' ? 'Not provided' : current.name,
        email: current.email === 'Loading...' ? 'Not provided' : current.email,
        phone: current.phone === 'Loading...' ? 'Not provided' : current.phone,
        dob: current.dob === 'Loading...' ? 'Not provided' : current.dob,
        address: current.address === 'Loading...' ? 'Not provided' : current.address,
      }));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  // Custom component for the Read-Only Info Fields
  const InfoField = ({ label, value }) => {
    // Ensure value is always a string
    const displayValue = displayText(value, 'Not provided');
    return (
      <View style={styles.infoFieldRow}>
        <Text style={styles.infoLabel}>{label}:</Text>
        <Text style={styles.infoValue}>{displayValue}</Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <LinearGradient colors={SCREEN_BG_COLORS} style={styles.fullScreenContainer}>
          <SafeAreaView style={styles.safeArea} edges={['top']}>
            <StatusBar backgroundColor="transparent" barStyle="dark-content" translucent />
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading profile...</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <LinearGradient colors={SCREEN_BG_COLORS} style={styles.fullScreenContainer}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <StatusBar backgroundColor="transparent" barStyle="dark-content" translucent />

          <View style={styles.topbar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Settings'))}
            >
              <Icon name="arrow-back" size={21} color="#0b1f3f" />
            </TouchableOpacity>
            <Text style={styles.topbarTitle}>Profile</Text>
            <View style={styles.topbarSpacer} />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
              {/* Patient Details Section - Now in a box */}
              <View style={styles.sectionContainer}>
                <View style={styles.profilePhotoRow}>
                  <PatientAvatar
                    profilePic={userData.profilePic}
                    firstName={userData.firstName}
                    lastName={userData.lastName}
                    size={scaleWidth(84)}
                    borderRadius={scaleWidth(42)}
                    backgroundColor={NAVY_BLUE}
                    textStyle={styles.profileInitials}
                  />
                  <Text style={styles.profileName} numberOfLines={2}>{userData.name}</Text>
                </View>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{isPatient ? 'Patient Details' : 'Profile'}</Text>
                </View>

                <View style={styles.infoBox}>
                  <InfoField label="Name" value={userData.name} />
                  {isPatient ? (
                    <>
                      <View style={styles.dividerLine} />
                      <InfoField label="Date of Birth" value={userData.dob} />
                    </>
                  ) : null}
                  <View style={styles.dividerLine} />
                  <InfoField label="Address" value={userData.address} />
                  <View style={styles.dividerLine} />
                  <InfoField label="Email" value={userData.email} />
                  <View style={styles.dividerLine} />
                  <InfoField label="Phone" value={userData.phone} />
                </View>
              </View>

              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Medical Team</Text>
                </View>

                <View style={styles.infoBox}>
                  <InfoField label="Practice" value={medicalTeam.practice} />
                  {isPatient ? (
                    <>
                      <View style={styles.dividerLine} />
                      <InfoField label="Provider" value={medicalTeam.provider} />
                      <View style={styles.dividerLine} />
                      <InfoField label="Caregiver" value={medicalTeam.caregiver} />
                    </>
                  ) : (
                    <>
                      <View style={styles.dividerLine} />
                      <InfoField label="Role" value={medicalTeam.roleName} />
                    </>
                  )}
                </View>
              </View>

          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </SafeAreaProvider>
  );
};

// --- STYLES ---

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: scaleFont(16),
    color: '#0b1f3f',
    fontWeight: '600',
  },
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
    color: '#0b1f3f',
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
  scrollContent: {
    paddingBottom: scaleHeight(40),
    paddingHorizontal: Math.max(scaleWidth(20), 20),
    paddingTop: scaleHeight(8),
  },

  // Section Container (for both Patient Details and Medical Team)
  profilePhotoRow: {
    alignItems: 'center',
    marginBottom: scaleHeight(16),
    gap: scaleHeight(10),
  },
  profileName: {
    fontSize: scaleFont(18),
    fontWeight: '800',
    color: '#0b1f3f',
    textAlign: 'center',
  },
  profileInitials: {
    fontSize: scaleFont(26),
    fontWeight: '800',
    color: '#ffffff',
  },
  sectionContainer: {
    width: '100%',
    marginBottom: scaleHeight(25),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scaleHeight(10),
  },
  sectionTitle: {
    fontSize: scaleFont(16),
    fontWeight: '800',
    color: '#0b1f3f',
  },

  // Info Box (Common for both sections)
  infoBox: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: scaleWidth(24),
    padding: scaleWidth(16),
    shadowColor: '#0b1f3f',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#e8ecf0',
  },

  // Info Field Rows
  infoFieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: scaleHeight(6),
  },
  medicalTeamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: scaleHeight(6),
  },
  infoLabel: {
    fontSize: scaleFont(14),
    color: colors.textSecondary || '#666',
    fontWeight: '500',
    flex: 1,
  },
  infoValueContainer: {
    flex: 2,
    alignItems: 'flex-end',
  },
  infoValue: {
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: '#0b1f3f',
    textAlign: 'right',
    flex: 2,
  },
  infoId: {
    fontSize: scaleFont(12),
    fontWeight: '400',
    color: colors.textSecondary || '#666',
    textAlign: 'right',
    marginTop: scaleHeight(2),
  },

  // Divider Line inside boxes
  dividerLine: {
    height: 1,
    backgroundColor: LIGHT_GREY,
    marginVertical: scaleHeight(4),
    width: '100%',
  },
});

export default PatientProfileScreen;