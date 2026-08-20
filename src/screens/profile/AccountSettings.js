import React, { useState, useEffect } from 'react'; 
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../config/globall';
import { scale, verticalScale } from 'react-native-size-matters';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../services/apiService';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const { width, height } = Dimensions.get('window');

const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

const scaleWidth = size => (width / guidelineBaseWidth) * size;
const scaleHeight = size => (height / guidelineBaseHeight) * size;
const scaleFont = size => scaleWidth(size);

const HEADER_COLOR = colors.primaryButton || '#293d55';
const WHITE = '#FFFFFF';

const AccountSettings = ({ navigation }) => {
  const [twoWayAuthEnabled, setTwoWayAuthEnabled] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [sessionTimeout, setSessionTimeout] = useState('60');
  const [isLoading, setIsLoading] = useState(false);
  const [isTogglingAuth, setIsTogglingAuth] = useState(false);
  const [isUpdatingSession, setIsUpdatingSession] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);

  // Load current settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        
        // Load two-way auth status from user data
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          setTwoWayAuthEnabled(user.is_two_way_auth === 1 || user.is_two_way_auth === true);
        }
        
        // Try to get account settings from API
        try {
          const settingsResult = await apiService.getAccountSettings();
          if (settingsResult && settingsResult.data) {
            const settings = settingsResult.data;
            if (settings.is_two_way_auth !== undefined) {
              setTwoWayAuthEnabled(settings.is_two_way_auth === 1 || settings.is_two_way_auth === true);
            }
            if (settings.session_time) {
              setSessionTimeout(String(settings.session_time));
            }
          }
        } catch (apiError) {
          console.log('⚠️ Could not fetch account settings from API:', apiError.message);
          // Continue with data from AsyncStorage
        }
      } catch (error) {
        console.error('❌ Error loading settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSettings();
  }, []);

  const handleUpdateSessionTimeout = async () => {
    const timeoutValue = parseInt(sessionTimeout);
    
    if (!timeoutValue || timeoutValue < 1) {
      Alert.alert('Error', 'Please enter a valid session timeout (minimum 1 minute)');
      return;
    }
    
    setIsUpdatingSession(true);
    try {
      const result = await apiService.updateSessionSettings(timeoutValue);
      
      if (result && result.success) {
        Alert.alert('Success', `Session timeout updated to ${timeoutValue} minutes`);
        
        // Update user data in AsyncStorage if available
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          user.session_time = timeoutValue;
          await AsyncStorage.setItem('user', JSON.stringify(user));
        }
      } else {
        Alert.alert('Error', result?.message || 'Failed to update session timeout');
      }
    } catch (error) {
      console.error('❌ Error updating session timeout:', error);
      Alert.alert('Error', error.message || 'Failed to update session timeout');
    } finally {
      setIsUpdatingSession(false);
    }
  };

  const toggleTwoWayAuth = async () => {
    const newStatus = twoWayAuthEnabled ? 0 : 1;
    
    setIsTogglingAuth(true);
    try {
      const result = await apiService.toggleTwoWayAuth(newStatus);
      
      if (result && result.success) {
        setTwoWayAuthEnabled(newStatus === 1);
        
        // Update user data in AsyncStorage
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          user.is_two_way_auth = newStatus;
          await AsyncStorage.setItem('user', JSON.stringify(user));
        }
        
        Alert.alert(
          'Success',
          `Two-way authentication ${newStatus === 1 ? 'enabled' : 'disabled'} successfully`
        );
      } else {
        Alert.alert('Error', result?.message || 'Failed to toggle two-way authentication');
      }
    } catch (error) {
      console.error('❌ Error toggling two-way auth:', error);
      Alert.alert('Error', error.message || 'Failed to toggle two-way authentication');
    } finally {
      setIsTogglingAuth(false);
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'Are you sure you want to clear cache? This will remove temporary files and stored data.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            setIsClearingCache(true);
            try {
              // Clear AsyncStorage cache (keep essential data like user session)
              const keysToKeep = ['user', 'practiceId', 'patientId', 'evitals_session'];
              const allKeys = await AsyncStorage.getAllKeys();
              
              const keysToRemove = allKeys.filter(key => !keysToKeep.includes(key));
              
              if (keysToRemove.length > 0) {
                await AsyncStorage.multiRemove(keysToRemove);
                console.log('✅ Cleared cache keys:', keysToRemove);
              }
              
              // Also call backend API to clear server-side cache
              try {
                await apiService.clearCache();
              } catch (apiError) {
                console.log('⚠️ Backend cache clear failed (non-critical):', apiError.message);
              }
              
              Alert.alert('Success', 'Cache cleared successfully!');
            } catch (error) {
              console.error('❌ Error clearing cache:', error);
              Alert.alert('Error', 'Failed to clear cache. Please try again.');
            } finally {
              setIsClearingCache(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.fullScreenContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

        <View style={styles.mainContainer}>
          
          {/* Header */}
          <View style={styles.topDarkSection}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Settings'))}
              >
                <MaterialIcons name="arrow-back" size={21} color="#0b1f3f" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Account Settings</Text>
              <View style={styles.headerSpacer} />
            </View>
          </View>

          {/* Body */}
          <View style={styles.bottomLightSection}>
            <KeyboardAvoidingView
              style={styles.keyboardContainer}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <ScrollView
                style={styles.scrollViewStyle}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={HEADER_COLOR} />
                    <Text style={styles.loadingText}>Loading settings...</Text>
                  </View>
                ) : (
                  <>

                {/* ✅ Security Section (unchanged) */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}># Security</Text>

                  {/* Two-way Authentication */}
                  <View style={styles.securityItem}>
                    <View style={styles.securityInfo}>
                      <Text style={styles.securityTitle}>Two-way Authentication</Text>
                      <Text style={styles.securityDescription}>
                        Add an extra layer of security to your account
                      </Text>
                    </View>
                    {isTogglingAuth ? (
                      <ActivityIndicator size="small" color={HEADER_COLOR} />
                    ) : (
                      <Switch
                        trackColor={{ false: colors.borderLight, true: HEADER_COLOR }}
                        thumbColor={colors.white}
                        ios_backgroundColor={colors.borderLight}
                        onValueChange={toggleTwoWayAuth}
                        value={twoWayAuthEnabled}
                        disabled={isTogglingAuth}
                      />
                    )}
                  </View>

                  <View style={styles.separator} />

                  {/* Clear Cache */}
                  <View style={styles.securityItem}>
                    <View style={styles.securityInfo}>
                      <Text style={styles.securityTitle}>Clear Cache</Text>
                      <Text style={styles.securityDescription}>
                        Remove temporary files and free up space
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={[styles.clearCacheButton, isClearingCache && styles.clearCacheButtonDisabled]} 
                      onPress={handleClearCache}
                      disabled={isClearingCache}
                    >
                      {isClearingCache ? (
                        <ActivityIndicator size="small" color={colors.textWhite} />
                      ) : (
                        <Text style={styles.clearCacheText}>Clear</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* ✅ Session Settings */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}># Session Settings</Text>

                  <View style={styles.sessionItem}>
                    <View style={styles.sessionInfo}>
                      <Text style={styles.sessionTitle}>Session Timeout</Text>
                      <Text style={styles.sessionDescription}>
                        Automatically log out after a period of inactivity
                      </Text>
                    </View>

                    <View style={styles.sessionInputRow}>
                      <TextInput
                        style={[
                          styles.sessionInput,
                          focusedField === 'sessionTimeout' && styles.inputFocused
                        ]}
                        placeholder="minutes"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="numeric"
                        value={sessionTimeout}
                        onChangeText={setSessionTimeout}
                        onFocus={() => setFocusedField('sessionTimeout')}
                        onBlur={() => setFocusedField(null)}
                      />
                      <TouchableOpacity 
                        style={[styles.updateSessionButton, isUpdatingSession && styles.updateSessionButtonDisabled]} 
                        onPress={handleUpdateSessionTimeout}
                        disabled={isUpdatingSession}
                      >
                        {isUpdatingSession ? (
                          <ActivityIndicator size="small" color={colors.textWhite} />
                        ) : (
                          <Text style={styles.updateSessionButtonText}>Update</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                </>
                )}
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

export default AccountSettings;

// --- SAME STYLES AS BEFORE (NO CHANGES NEEDED) ---

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: WHITE,
  },
  mainContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: WHITE,
  },

  // --- Header Styles ---
  topDarkSection: {
    backgroundColor: WHITE,
    paddingTop: scaleHeight(8),
    paddingBottom: scaleHeight(10),
    paddingHorizontal: Math.max(scaleWidth(16), 16),
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
   headerTitle: {
    fontSize: scaleFont(20),
    fontWeight: '800',
    color: '#0b1f3f',
    textAlign: 'center',
    flex: 1,
    marginHorizontal: scaleWidth(8),
    },
    headerSpacer: {
      width: Math.max(scaleWidth(42), 42),
    },

  // --- Body Styles (Matching NotificationSettings) ---
  bottomLightSection: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: scaleWidth(10),
    paddingHorizontal: scaleWidth(20),
  },

  keyboardContainer: {
    flex: 1,
  },
  scrollViewStyle: {
    flex: 1,
  },
  scrollContent: { 
    paddingHorizontal: scaleWidth(20), 
    paddingVertical: verticalScale(20),
    flexGrow: 1,
  },

  // --- Existing Account Settings Styles ---
  sectionContainer: {
    marginBottom: verticalScale(20),
    padding: scaleWidth(20),
    backgroundColor: colors.white,
    borderRadius: scaleWidth(12),
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  sectionTitle: {
    ...fonts.subHeading,
    fontSize: scaleFont(18),
    fontWeight: '700',
    marginBottom: verticalScale(20),
    color: colors.textPrimary,
  },
  inputGroup: {
    marginBottom: verticalScale(16),
  },
  inputLabel: {
    ...fonts.subHeading,
    fontSize: scaleFont(14),
    marginBottom: verticalScale(8),
    color: colors.textPrimary,
    fontWeight: '600',
  },
  // Read-only field styles
  readOnlyFieldContainer: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: scaleWidth(8),
    padding: scaleWidth(16),
    backgroundColor: colors.backgroundLight,
    height: verticalScale(48),
    justifyContent: 'center',
  },
  readOnlyFieldText: {
    ...fonts.paragraph,
    fontSize: scaleFont(16),
    color: colors.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: scaleWidth(8),
    padding: scaleWidth(16),
    ...fonts.paragraph,
    backgroundColor: colors.backgroundLight,
    height: verticalScale(48),
    fontSize: scaleFont(16),
    color: colors.textPrimary,
  },
  inputFocused: {
    borderColor: HEADER_COLOR,
    borderWidth: 2,
    backgroundColor: colors.white,
  },
  separator: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: verticalScale(20),
  },
  // Changed from saveButton to editInfoButton
  editInfoButton: {
  backgroundColor: '#293d55', // Change this line
  paddingVertical: verticalScale(16),
  borderRadius: scaleWidth(8),
  alignItems: 'center',
  borderWidth: 1,
  borderColor: colors.borderLight,
  },
  editInfoButtonText: {
    ...fonts.buttonText(colors.textWhite),
    fontSize: scaleFont(16),
    fontWeight: '600',
  },
  // Keep the old saveButton styles in case needed elsewhere
  saveButton: {
    backgroundColor: HEADER_COLOR,
    paddingVertical: verticalScale(16),
    borderRadius: scaleWidth(8),
    alignItems: 'center',
  },
  saveButtonText: {
    ...fonts.buttonText(colors.textWhite),
    fontSize: scaleFont(16),
    fontWeight: '700',
  },
  securityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: verticalScale(8),
  },
  securityInfo: {
    flex: 1,
    marginRight: scaleWidth(12),
  },
  securityTitle: { 
    ...fonts.subHeading,
    fontSize: scaleFont(16),
    fontWeight: '600',
    marginBottom: verticalScale(4),
    color: colors.textPrimary,
  },
  securityDescription: {
    ...fonts.paragraph,
    fontSize: scaleFont(12),
    color: colors.textSecondary,
    lineHeight: scaleFont(16),
  },
  clearCacheButton: {
    backgroundColor: colors.error,
    paddingVertical: verticalScale(8),
    paddingHorizontal: scaleWidth(16),
    borderRadius: scaleWidth(6),
  },
  clearCacheText: {
    ...fonts.buttonText(colors.textWhite),
    fontSize: scaleFont(14),
    fontWeight: '600',
  },
  sessionItem: {
    paddingVertical: verticalScale(8),
  },
  sessionInfo: {
    marginBottom: verticalScale(12),
  },
  sessionTitle: {
    ...fonts.subHeading,
    fontSize: scaleFont(16),
    fontWeight: '600',
    marginBottom: verticalScale(4),
    color: colors.textPrimary,
  },
  sessionDescription: {
    ...fonts.paragraph,
    fontSize: scaleFont(12),
    color: colors.textSecondary,
    lineHeight: scaleFont(16),
  },
  sessionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(12)
  },
  sessionInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: scaleWidth(8),
    padding: scaleWidth(16),
    ...fonts.paragraph,
    backgroundColor: colors.backgroundLight,
    height: verticalScale(48),
    fontSize: scaleFont(16),
    color: colors.textPrimary,
  },
  updateSessionButton: {
    backgroundColor: HEADER_COLOR,
    paddingVertical: verticalScale(16),
    paddingHorizontal: scaleWidth(20),
    borderRadius: scaleWidth(8),
    height: verticalScale(48),
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateSessionButtonText: { 
    ...fonts.buttonText(colors.textWhite),
    fontSize: scaleFont(14),
    fontWeight: '600',
  },
  updateSessionButtonDisabled: {
    opacity: 0.6,
  },
  clearCacheButtonDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: verticalScale(40),
  },
  loadingText: {
    marginTop: verticalScale(12),
    fontSize: scaleFont(14),
    color: colors.textSecondary,
  },
});