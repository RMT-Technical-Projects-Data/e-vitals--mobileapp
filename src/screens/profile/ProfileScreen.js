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
  Alert,
  Platform
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { colors, fonts } from '../../config/globall';
import Icon from 'react-native-vector-icons/MaterialIcons';
import apiService from '../../services/apiService';

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
const WHITE = '#FFFFFF';
const LIGHT_GREY = '#F4F7F9';
const SCREEN_BG_COLORS = ['#fffdfb', '#f7ece7', '#eef1f5'];

const PatientProfileScreen = ({ navigation }) => {
  const [userData, setUserData] = useState({
    name: "Loading...",
    email: "Loading...",
    phone: "Loading...",
    dob: "Loading...",
    address: "Loading...",
  });

  const [medicalTeam, setMedicalTeam] = useState({
    practice: "Loading...",
    practice_id: null,
    provider: "Loading...",
    provider_id: null,
    caregiver: "Loading..."
  });

  const [isLoading, setIsLoading] = useState(true);

  // Helper function to safely convert values to strings
  const safeString = (value, fallback = 'Not provided') => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string') return value.trim() || fallback;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'object') {
      // If it's an object, try to extract a meaningful string
      if (value.name) return String(value.name);
      if (value.first_name && value.last_name) return `${value.first_name} ${value.last_name}`.trim();
      if (value.firstName && value.lastName) return `${value.firstName} ${value.lastName}`.trim();
      // If we can't extract a meaningful value, return fallback
      return fallback;
    }
    return String(value) || fallback;
  };

  // Helper function to find a value in an object using multiple possible field names
  const findField = (obj, fieldNames, fallback = null) => {
    if (!obj || typeof obj !== 'object') return fallback;
    for (const fieldName of fieldNames) {
      if (obj[fieldName] !== null && obj[fieldName] !== undefined && obj[fieldName] !== '') {
        return obj[fieldName];
      }
    }
    return fallback;
  };

  // Fetch patient data from API
  const fetchPatientData = async () => {
    try {
      setIsLoading(true);

      let result = null;
      let data = null;
      let currentUserData = null;

      // First, try to get current user to get practice_id and patient_id
      try {
        const userResult = await apiService.getCurrentUser();
        if (userResult && userResult.data) {
          currentUserData = userResult.data.user || userResult.data;
          // Store practice_id and patient_id if available
          if (currentUserData.practice_id) {
            await AsyncStorage.setItem('practiceId', String(currentUserData.practice_id));
          }
          if (currentUserData.patient_id || currentUserData.id) {
            await AsyncStorage.setItem('patientId', String(currentUserData.patient_id || currentUserData.id));
          }
        }
      } catch (userError) {
        console.log('Could not fetch current user:', userError.message);
      }

      // Try to get patient profile
      try {
        result = await apiService.getPatientProfile();
        // Check multiple possible response structures
        if (result) {
          data = result.data || result.patient || result;
        }
      } catch (profileError) {
        console.log('Could not fetch patient profile, trying patient details:', profileError.message);

        // Fallback: Try to get patient details using practice_id and patient_id
        try {
          const practiceId = await AsyncStorage.getItem('practiceId');
          const patientId = await AsyncStorage.getItem('patientId');

          if (practiceId && patientId) {
            result = await apiService.getPatientDetails(parseInt(practiceId), parseInt(patientId));
            // Check multiple possible response structures
            if (result) {
              data = result.data || result.patient || result;
            }
          }
        } catch (detailsError) {
          console.log('Could not fetch patient details:', detailsError.message);
        }
      }

      // Use currentUserData if data is not available or incomplete
      if (!data && currentUserData) {
        data = currentUserData;
      }

      if (data) {
        // Based on API response: data.patient contains all patient info
        // Structure: { success: true, data: { patient: {...}, caregivers: [...] } }
        const patient = data.patient || data.user || data;

        // Extract patient information from new API response structure
        const firstName = patient.first_name || patient.firstName || currentUserData?.first_name || currentUserData?.firstName || '';
        const lastName = patient.last_name || patient.lastName || currentUserData?.last_name || currentUserData?.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim() || patient.name || patient.username || currentUserData?.name || currentUserData?.username || 'Not provided';

        // Format date of birth if available - check multiple locations and field names
        // Based on API response: date_of_birth is in patient object
        let dobFormatted = 'Not provided';
        const dobFieldNames = ['date_of_birth', 'dob', 'birth_date', 'birthDate', 'dateOfBirth'];
        const dobDate = findField(patient, dobFieldNames) ||
          findField(data, dobFieldNames) ||
          findField(result?.data?.patient, dobFieldNames) ||
          findField(result?.data, dobFieldNames) ||
          findField(result, dobFieldNames) ||
          findField(currentUserData, dobFieldNames);
        if (dobDate) {
          try {
            const date = new Date(dobDate);
            if (!isNaN(date.getTime())) {
              dobFormatted = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              });
            } else {
              dobFormatted = String(dobDate);
            }
          } catch (e) {
            dobFormatted = String(dobDate);
          }
        }

        // Format address if available - check multiple locations and field names
        // Based on API response: address_line_1, full_address, city, state_id, zip_code are in patient object
        let addressFormatted = 'Not provided';
        // Try to build from patient fields - check all possible locations
        // Priority: full_address > address_line_1 > other address fields
        const addressLine1 = patient.full_address || patient.address_line_1 || patient.address || patient.addressLine1 || patient.street || patient.street_address ||
          data.full_address || data.address_line_1 || data.address || data.street ||
          result?.data?.patient?.full_address || result?.data?.patient?.address_line_1 ||
          result?.data?.full_address || result?.data?.address_line_1 ||
          currentUserData?.full_address || currentUserData?.address || currentUserData?.address_line_1;
        const city = patient.city || data.city || result?.data?.patient?.city || result?.data?.city || currentUserData?.city;
        const state = patient.state || patient.state_id || data.state || data.state_id || result?.data?.patient?.state || result?.data?.patient?.state_id || result?.data?.state || currentUserData?.state;
        const zip = patient.zip_code || patient.zipCode || patient.zip || patient.postal_code || patient.postalCode ||
          data.zip_code || data.zip || data.postal_code ||
          result?.data?.patient?.zip_code || result?.data?.zip_code || result?.data?.zip ||
          currentUserData?.zip_code || currentUserData?.zip;

        // Build address from components
        if (addressLine1 || city || state || zip) {
          const addrParts = [
            addressLine1,
            city,
            state,
            zip
          ].filter(Boolean);
          addressFormatted = addrParts.length > 0 ? addrParts.join(', ') : 'Not provided';
        } else if (data.address) {
          if (typeof data.address === 'string') {
            addressFormatted = data.address;
          } else if (typeof data.address === 'object') {
            const addrParts = [
              data.address.street || data.address.address_line_1 || data.address.addressLine1,
              data.address.city,
              data.address.state,
              data.address.zip || data.address.zip_code || data.address.postal_code || data.address.postalCode
            ].filter(Boolean);
            addressFormatted = addrParts.length > 0 ? addrParts.join(', ') : 'Not provided';
          }
        } else if (currentUserData?.address) {
          if (typeof currentUserData.address === 'string') {
            addressFormatted = currentUserData.address;
          } else if (typeof currentUserData.address === 'object') {
            const addrParts = [
              currentUserData.address.street || currentUserData.address.address_line_1,
              currentUserData.address.city,
              currentUserData.address.state,
              currentUserData.address.zip || currentUserData.address.zip_code
            ].filter(Boolean);
            addressFormatted = addrParts.length > 0 ? addrParts.join(', ') : 'Not provided';
          }
        }

        // Update user data state - ensure all values are strings
        // Based on API response: phone_number is in patient object
        const emailFieldNames = ['email', 'email_address', 'emailAddress'];
        const phoneFieldNames = ['phone_number', 'phoneNumber', 'cell_phone_number', 'cellPhoneNumber',
          'phone', 'mobile_number', 'mobileNumber', 'telephone', 'tel', 'contact_number'];

        const patientEmail = findField(patient, emailFieldNames) ||
          findField(data, emailFieldNames) ||
          findField(result?.data?.patient, emailFieldNames) ||
          findField(result?.data, emailFieldNames) ||
          findField(result, emailFieldNames) ||
          findField(currentUserData, emailFieldNames) ||
          'Not provided';

        const patientPhone = findField(patient, phoneFieldNames) ||
          findField(data, phoneFieldNames) ||
          findField(result?.data?.patient, phoneFieldNames) ||
          findField(result?.data, phoneFieldNames) ||
          findField(result, phoneFieldNames) ||
          findField(currentUserData, phoneFieldNames) ||
          'Not provided';

        setUserData({
          name: safeString(fullName, 'Not provided'),
          email: safeString(patientEmail, 'Not provided'),
          phone: safeString(patientPhone, 'Not provided'),
          dob: safeString(dobFormatted, 'Not provided'),
          address: safeString(addressFormatted, 'Not provided'),
        });

        // Extract medical team information from new API response
        // Based on API response: practice_id, practice_name, provider_id, provider_name are in patient object
        // Check multiple locations for practice_id
        const practiceId = patient.practice_id || data.practice_id ||
          result?.data?.patient?.practice_id ||
          (data.practice && (data.practice.id || data.practice.practice_id)) ||
          (patient.practice && (patient.practice.id || patient.practice.practice_id)) ||
          result?.data?.practice_id || result?.practice_id ||
          currentUserData?.practice_id || null;

        const providerId = patient.provider_id || data.provider_id ||
          result?.data?.patient?.provider_id ||
          result?.data?.provider_id || result?.provider_id ||
          currentUserData?.provider_id || null;

        // Get practice name - check multiple locations and structures
        // Based on API response: practice_name is directly in patient object
        let practice = 'Not assigned';
        const practiceObj = data.practice || patient.practice || result?.data?.practice || result?.practice || currentUserData?.practice;

        if (practiceObj) {
          if (typeof practiceObj === 'string') {
            practice = practiceObj;
          } else if (practiceObj.name || practiceObj.practice_name) {
            practice = practiceObj.name || practiceObj.practice_name;
          } else if (practiceObj.practice_name) {
            practice = practiceObj.practice_name;
          }
        } else if (patient.practice_name || data.practice_name || result?.data?.patient?.practice_name || result?.data?.practice_name || currentUserData?.practice_name) {
          // Check patient object first (based on actual API response)
          practice = patient.practice_name || data.practice_name || result?.data?.patient?.practice_name || result?.data?.practice_name || currentUserData?.practice_name;
        }
        practice = safeString(practice, 'Not assigned');

        // Get provider name
        // Based on API response: provider_name is directly in patient object
        let provider = 'Not assigned';
        if (patient.provider_name) {
          provider = patient.provider_name;
        } else if (data.provider_name) {
          provider = data.provider_name;
        } else if (result?.data?.patient?.provider_name) {
          provider = result.data.patient.provider_name;
        } else if (data.provider) {
          if (typeof data.provider === 'string') {
            provider = data.provider;
          } else if (data.provider.first_name || data.provider.last_name) {
            provider = `${data.provider.first_name || ''} ${data.provider.last_name || ''}`.trim();
          }
        }
        provider = safeString(provider, 'Not assigned');

        // Get caregiver name
        // Based on API response: caregivers is an array in data object, caregiver_id is in patient object
        let caregiver = 'N/A (No caregiver assigned)';
        // Check if there are caregivers in the data
        const caregivers = data.caregivers || result?.data?.caregivers || [];
        if (caregivers.length > 0 && caregivers[0].full_name) {
          caregiver = caregivers[0].full_name;
        } else if (patient.caregiver_name) {
          caregiver = patient.caregiver_name;
        } else if (data.caregiver_name) {
          caregiver = data.caregiver_name;
        } else if (data.caregiver) {
          if (typeof data.caregiver === 'string') {
            caregiver = data.caregiver;
          } else if (data.caregiver.first_name || data.caregiver.last_name) {
            caregiver = `${data.caregiver.first_name || ''} ${data.caregiver.last_name || ''}`.trim();
          } else if (data.caregiver.full_name) {
            caregiver = data.caregiver.full_name;
          }
        }
        caregiver = safeString(caregiver, 'N/A (No caregiver assigned)');

        setMedicalTeam({
          practice,
          practice_id: practiceId,
          provider,
          provider_id: providerId,
          caregiver
        });

        // Also update AsyncStorage with the fetched data for offline access
        const userData = await AsyncStorage.getItem('user');
        const user = userData ? JSON.parse(userData) : {};

        // Merge data from all sources (patient, data, currentUserData, existing user)
        const mergedUser = {
          ...user,
          ...patient,
          ...(currentUserData || {}),
          first_name: firstName || user.first_name || currentUserData?.first_name,
          last_name: lastName || user.last_name || currentUserData?.last_name,
          email: patientEmail !== 'Not provided' ? patientEmail : (user.email || currentUserData?.email || ''),
          phone: patientPhone !== 'Not provided' ? patientPhone : (user.phone || user.mobile_number || user.phone_number || currentUserData?.phone || currentUserData?.mobile_number || ''),
          dob: dobDate || patient.dob || patient.date_of_birth || user.dob || user.date_of_birth || currentUserData?.dob || currentUserData?.date_of_birth,
          date_of_birth: dobDate || patient.date_of_birth || user.date_of_birth || currentUserData?.date_of_birth,
          address: addressFormatted !== 'Not provided' ? addressFormatted : (user.address || currentUserData?.address || null)
        };

        await AsyncStorage.setItem('user', JSON.stringify(mergedUser));

        // Store medical team data in AsyncStorage
        await AsyncStorage.setItem('medical_team', JSON.stringify({
          practice,
          practice_id: practiceId,
          provider,
          provider_id: providerId,
          caregiver
        }));

      } else {
        // Fallback to AsyncStorage data if API fails
        await loadFromAsyncStorage();
      }
    } catch (error) {
      console.log('Failed to fetch patient data:', error);
      // Don't show alert, just fallback to AsyncStorage
      await loadFromAsyncStorage();
    } finally {
      setIsLoading(false);
    }
  };

  // Fallback function to load data from AsyncStorage
  const loadFromAsyncStorage = async () => {
    try {
      // Load user data from AsyncStorage
      const user = await AsyncStorage.getItem("user");
      if (user) {
        const parsed = JSON.parse(user);
        const fullName = `${parsed.first_name || ''} ${parsed.last_name || ''}`.trim() || parsed.name || parsed.username || 'Not provided';

        // Extract profile data (might be nested in 'profile' or directly in 'user')
        const profile = parsed.profile || {};

        // Format date of birth if available - check multiple field names
        let dobFormatted = 'Not provided';
        const dobDate = profile.date_of_birth || parsed.date_of_birth || parsed.dob || parsed.birth_date || parsed.birthDate;
        if (dobDate) {
          try {
            const date = new Date(dobDate);
            if (!isNaN(date.getTime())) {
              dobFormatted = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              });
            } else {
              dobFormatted = String(dobDate);
            }
          } catch (e) {
            dobFormatted = String(dobDate);
          }
        }

        // Check multiple field name variations for phone
        const phoneValue = profile.phone_number || parsed.phone || parsed.phone_number || parsed.phoneNumber ||
          parsed.mobile_number || parsed.mobileNumber ||
          parsed.cell_phone_number || parsed.cellPhoneNumber ||
          parsed.telephone || parsed.tel;

        // Check multiple field name variations for address
        let addressValue = profile.address || parsed.address;
        if (!addressValue || addressValue === 'Not provided') {
          // Try to build address from components (check both profile and parsed)
          const source = (profile.city || profile.zip_code) ? profile : parsed;
          const addrParts = [
            source.address_line_1 || source.addressLine1 || source.street || source.street_address || source.address,
            source.city,
            source.state || source.state_id,
            source.zip_code || source.zipCode || source.zip || source.postal_code || source.postalCode
          ].filter(Boolean);
          if (addrParts.length > 0) {
            addressValue = addrParts.join(', ');
          }
        }

        setUserData({
          name: safeString(fullName, 'Not provided'),
          email: safeString(parsed.email, 'Not provided'),
          phone: safeString(phoneValue, 'Not provided'),
          dob: safeString(dobFormatted, 'Not provided'),
          address: safeString(addressValue, 'Not provided'),
        });

        // Handle Medical Team from user data
        const practice = parsed.practice_name || parsed.practice?.name || parsed.practice?.practice_name;
        const provider = parsed.provider_name || parsed.provider?.name;
        const caregiver = parsed.caregiver_name || parsed.caregiver?.name || parsed.caregiver?.full_name;

        if (practice || provider || caregiver) {
          setMedicalTeam({
            practice: safeString(practice, 'Not assigned'),
            practice_id: parsed.practice_id || null,
            provider: safeString(provider, 'Not assigned'),
            provider_id: parsed.provider_id || (parsed.provider?.id),
            caregiver: safeString(caregiver, 'N/A (No caregiver assigned)')
          });
        } else {
          // Fallback to separate 'medical_team' key if it exists
          const medicalData = await AsyncStorage.getItem("medical_team");
          if (medicalData) {
            const parsedMedical = JSON.parse(medicalData);
            setMedicalTeam({
              practice: safeString(parsedMedical.practice, 'Not assigned'),
              practice_id: parsedMedical.practice_id || null,
              provider: safeString(parsedMedical.provider, 'Not assigned'),
              provider_id: parsedMedical.provider_id || null,
              caregiver: safeString(parsedMedical.caregiver, 'N/A (No caregiver assigned)')
            });
          } else {
            setMedicalTeam({
              practice: 'Not assigned',
              practice_id: null,
              provider: 'Not assigned',
              provider_id: null,
              caregiver: 'N/A (No caregiver assigned)'
            });
          }
        }
      } else {
        // If no user data, set defaults
        setUserData({
          name: 'Not provided',
          email: 'Not provided',
          phone: 'Not provided',
          dob: 'Not provided',
          address: 'Not provided',
        });
        setMedicalTeam({
          practice: 'Not assigned',
          practice_id: null,
          provider: 'Not assigned',
          provider_id: null,
          caregiver: 'N/A (No caregiver assigned)'
        });
      }
    } catch (e) {
      console.error("Failed to load data from AsyncStorage:", e);
    }
  };

  // Load user data when component mounts
  useEffect(() => {
    const initializeProfile = async () => {
      setIsLoading(true);
      // Load from storage first for instant display
      await loadFromAsyncStorage();

      // Check if we have complete data
      const userStr = await AsyncStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;

      // If data is missing or it's been a while, we could fetch.
      // But based on user request to optimize and avoid unnecessary calls:
      if (!user || (!user.practice_name && !user.practice_id)) {
        console.log("Data missing in storage, fetching from API...");
        await fetchPatientData();
      } else {
        console.log("Using enriched profile data from storage.");
        setIsLoading(false);
      }
    };

    initializeProfile();
  }, []);

  // Custom component for the Read-Only Info Fields
  const InfoField = ({ label, value }) => {
    // Ensure value is always a string
    const displayValue = safeString(value, 'Not provided');
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
              <Text style={styles.loadingText}>Loading patient data...</Text>
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
              <Icon name="arrow-back" size={21} color="#071B34" />
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
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Patient Details</Text>
                </View>

                <View style={styles.infoBox}>
                  <InfoField label="Name" value={userData.name} />
                  <View style={styles.dividerLine} />
                  <InfoField label="Date of Birth" value={userData.dob} />
                  <View style={styles.dividerLine} />
                  <InfoField label="Address" value={userData.address} />
                  <View style={styles.dividerLine} />
                  <InfoField label="Email" value={userData.email} />
                  <View style={styles.dividerLine} />
                  <InfoField label="Phone" value={userData.phone} />
                </View>
              </View>

              {/* Medical Team Section - Already in a box */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Medical Team</Text>
                </View>

                <View style={styles.infoBox}>
                  <View style={styles.medicalTeamRow}>
                    <Text style={styles.infoLabel}>Practice:</Text>
                    <View style={styles.infoValueContainer}>
                      <Text style={styles.infoValue}>{safeString(medicalTeam.practice, 'Not assigned')}</Text>
                      {medicalTeam.practice_id && (
                        <Text style={styles.infoId}>(ID: {medicalTeam.practice_id})</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.dividerLine} />

                  <View style={styles.medicalTeamRow}>
                    <Text style={styles.infoLabel}>Provider:</Text>
                    <View style={styles.infoValueContainer}>
                      <Text style={styles.infoValue}>{safeString(medicalTeam.provider, 'Not assigned')}</Text>
                      {medicalTeam.provider_id && (
                        <Text style={styles.infoId}>(ID: {medicalTeam.provider_id})</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.dividerLine} />

                  <View style={styles.medicalTeamRow}>
                    <Text style={styles.infoLabel}>Caregiver:</Text>
                    <Text style={styles.infoValue}>{safeString(medicalTeam.caregiver, 'N/A (No caregiver assigned)')}</Text>
                  </View>
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
    color: '#071B34',
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
    shadowColor: '#071B34',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 26,
    elevation: 3,
  },
  topbarTitle: {
    flex: 1,
    color: '#071B34',
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
    color: '#071B34',
  },

  // Info Box (Common for both sections)
  infoBox: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: scaleWidth(24),
    padding: scaleWidth(16),
    shadowColor: '#071B34',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 34,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
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
    color: '#071B34',
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