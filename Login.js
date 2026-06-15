import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import { colors } from './config/globall';
import apiService from './services/apiService';

// Device dimensions
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

// Scaling helpers
const scaleWidth = size => (width / guidelineBaseWidth) * size;
const scaleHeight = size => (height / guidelineBaseHeight) * size;
const moderateScale = (size, factor = 0.5) =>
  size + (scaleWidth(size) - size) * factor;

const responsiveScale = (size, min = size * 0.85, max = size * 1.15) => {
  const scaled = moderateScale(size);
  return Math.min(Math.max(scaled, min), max);
};

const Login = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUsernameFocused, setIsUsernameFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState('');

  // Log API config on component mount for debugging
  React.useEffect(() => {
    const { API_CONFIG } = require('./config/api');
  }, []);

  const handleLogin = async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Please enter your username');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    setIsLoading(true);
    try {
      const data = await apiService.login(username, password, false);

      // Check if OTP is required
      if (data.requires_otp) {
        setShowOtp(true);
        setIsLoading(false);
        if (data.development_otp) {
          // In development, you might want to auto-fill OTP
        }
        return;
      }

      // Store user data
      if (data.user) {
        await AsyncStorage.setItem('user', JSON.stringify(data.user));

        // Store practice_id
        if (data.user.practice_id) {
          await AsyncStorage.setItem('practiceId', String(data.user.practice_id));
        }

        // IMPORTANT: Store the numeric patients table ID as 'patientId' for measurement APIs.
        const numericPatientId = data.user.patients_table_id || data.user.id;
        if (numericPatientId) {
          await AsyncStorage.setItem('patientId', String(numericPatientId));
          console.log('✅ Stored numeric patientId:', numericPatientId);
        }

        // Store ForaCare string ID if available
        if (data.user.patient_id_string || data.user.patient_id) {
          await AsyncStorage.setItem('patientIdString', String(data.user.patient_id_string || data.user.patient_id));
        }

        // Store latest vitals if provided
        if (data.user.latest_vitals) {
          console.log('✅ Stored latest vitals from login response');
          await AsyncStorage.setItem('latestVitals', JSON.stringify(data.user.latest_vitals));
          // Store fetch timestamp to prevent immediate re-fetch in Home
          await AsyncStorage.setItem('lastVitalsFetch', Date.now().toString());
        } else {
          // Fallback: Pre-fetch only if not included in login response
          try {
            const vitalsData = await apiService.getLatestVitals();
            if (vitalsData && vitalsData.success) {
              await AsyncStorage.setItem('latestVitals', JSON.stringify(vitalsData.data));
              await AsyncStorage.setItem('lastVitalsFetch', Date.now().toString());
            }
          } catch (vitalsError) {
            console.warn('⚠️ Could not pre-fetch latest vitals:', vitalsError.message);
          }
        }
      }

      // Navigate to main app
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch (error) {
      console.error('❌ Login error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });

      // Show user-friendly error message
      let errorMessage = error.message || 'Login failed. Please try again.';

      // Provide specific guidance based on error type
      if (error.message.includes('timeout') || error.message.includes('connect')) {
        errorMessage = 'Cannot connect to server. Please check your internet connection and try again.';
      }

      Alert.alert('Login Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      Alert.alert('Error', 'Please enter the OTP code');
      return;
    }

    setIsLoading(true);
    try {
      const data = await apiService.verifyOTP(otp.trim());

      // Store user data after OTP verification
      if (data.user) {
        await AsyncStorage.setItem('user', JSON.stringify(data.user));

        // Store practice_id
        if (data.user.practice_id) {
          await AsyncStorage.setItem('practiceId', String(data.user.practice_id));
        }

        // IMPORTANT: Store numeric patients table ID as 'patientId'
        const numericPatientId = data.user.patients_table_id || data.user.id;
        if (numericPatientId) {
          await AsyncStorage.setItem('patientId', String(numericPatientId));
          console.log('✅ Stored patientId after OTP:', numericPatientId);
        }

        // Store ForaCare string ID
        if (data.user.patient_id_string || data.user.patient_id) {
          await AsyncStorage.setItem('patientIdString', String(data.user.patient_id_string || data.user.patient_id));
        }

        // Store latest vitals if provided
        if (data.user.latest_vitals) {
          console.log('✅ Received latest vitals in OTP response');
          await AsyncStorage.setItem('latestVitals', JSON.stringify(data.user.latest_vitals));
          await AsyncStorage.setItem('lastVitalsFetch', Date.now().toString());
        } else {
          // Fallback: Pre-fetch if not included
          try {
            const vitalsData = await apiService.getLatestVitals();
            if (vitalsData && vitalsData.success) {
              await AsyncStorage.setItem('latestVitals', JSON.stringify(vitalsData.data));
              await AsyncStorage.setItem('lastVitalsFetch', Date.now().toString());
            }
          } catch (vitalsError) {
            console.warn('⚠️ Could not pre-fetch latest vitals after OTP:', vitalsError.message);
          }
        }
      }

      // Navigate to main app
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch (error) {
      console.error('OTP verification error:', error);
      Alert.alert('OTP Verification Failed', error.message || 'Invalid OTP code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >

          {/* ── SCREEN: single flex column, no ScrollView ── */}
          <View style={styles.screen}>

            {/* TOP — Logo */}
            <View style={styles.logoContainer}>
              <Image
                source={require('./android/app/src/assets/images/logo5.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            {/* MIDDLE — Form card */}
            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>Welcome Back</Text>
              <Text style={styles.formSubtitle}>
                Sign in to access your health data
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Username</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      borderColor: isUsernameFocused
                        ? colors.primaryButton
                        : colors.borderLight,
                    },
                  ]}
                  placeholder="Enter your username"
                  placeholderTextColor={colors.textSecondary}
                  value={username}
                  onChangeText={setUsername}
                  onFocus={() => setIsUsernameFocused(true)}
                  onBlur={() => setIsUsernameFocused(false)}
                  editable={!isLoading}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        borderColor: isPasswordFocused
                          ? colors.primaryButton
                          : colors.borderLight,
                      },
                    ]}
                    placeholder="Enter your password"
                    placeholderTextColor={colors.textSecondary}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setIsPasswordFocused(true)}
                    onBlur={() => setIsPasswordFocused(false)}
                    editable={!isLoading}
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    style={styles.eyeIconWrapper}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Image
                      source={
                        showPassword
                          ? require('./android/app/src/assets/images/eye-open.png')
                          : require('./android/app/src/assets/images/eye-close.png')
                      }
                      style={styles.eyeIcon}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {showOtp ? (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>OTP Code</Text>
                    <TextInput
                      style={[styles.input, { borderColor: colors.primaryButton }]}
                      placeholder="Enter OTP code"
                      placeholderTextColor={colors.textSecondary}
                      value={otp}
                      onChangeText={setOtp}
                      keyboardType="number-pad"
                      editable={!isLoading}
                      autoFocus
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.button}
                    onPress={handleVerifyOtp}
                    disabled={isLoading}
                  >
                    <LinearGradient
                      colors={['#293d55', colors.secondaryButton]}
                      style={styles.buttonGradient}
                    >
                      <Text style={styles.buttonText}>
                        {isLoading ? 'Verifying...' : 'Verify OTP'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setShowOtp(false);
                      setOtp('');
                    }}
                    style={{ marginTop: 10 }}
                  >
                    <Text style={[styles.forgotText, { textAlign: 'center' }]}>
                      Back to Login
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.optionsContainer}>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('ForgotPassword')}
                    >
                      <Text style={styles.forgotText}>Forgot Password?</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.button}
                    onPress={handleLogin}
                    disabled={isLoading}
                  >
                    <LinearGradient
                      colors={['#293d55', colors.secondaryButton]}
                      style={styles.buttonGradient}
                    >
                      <Text style={styles.buttonText}>
                        {isLoading ? 'Logging in...' : 'Login'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}

              <View style={styles.securityContainer}>
                <Text style={styles.securityText}>
                  HIPAA Compliant • End-to-End Encrypted
                </Text>
              </View>
            </View>

            {/* BOTTOM — Footer */}
            <View style={styles.footerContainer}>
              <Text style={styles.developedBy}>Developed By</Text>
              <Text style={styles.companyName}>
                Revive Medical Technologies Inc.
              </Text>
            </View>

          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({

  // SafeAreaView fills the full screen
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // KeyboardAvoidingView fills its parent
  keyboardView: {
    flex: 1,
  },

  // Single flex column — NO ScrollView.
  // justifyContent:'space-between' spreads the three sections
  // (logo / form / footer) evenly on every iPhone from SE to Pro Max.
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsiveScale(24),
    paddingTop: scaleHeight(20),
    paddingBottom: scaleHeight(20),
  },

  // ── LOGO ──
  logoContainer: {
    alignItems: 'center',
    width: '100%',
  },

  // Width + height both scale so the logo never overflows on small screens
  logoImage: {
    width: scaleWidth(140),
    height: scaleHeight(120),
  },

  // ── FORM CARD ──
  formContainer: {
    width: '100%',
    maxWidth: responsiveScale(340),
    backgroundColor: '#ffffff',
    borderRadius: moderateScale(16),
    padding: responsiveScale(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 15,
  },

  formTitle: {
    fontSize: responsiveScale(20),
    fontWeight: '700',
    textAlign: 'center',
    color: '#000000',
    marginBottom: responsiveScale(4),
  },

  formSubtitle: {
    fontSize: responsiveScale(12),
    textAlign: 'center',
    marginBottom: responsiveScale(16),
    color: colors.textSecondary,
  },

  inputGroup: {
    marginBottom: responsiveScale(12),
  },

  label: {
    fontSize: responsiveScale(12),
    marginBottom: responsiveScale(4),
    fontWeight: '600',
    color: '#000000',
  },

  input: {
    borderWidth: 1.5,
    borderRadius: moderateScale(10),
    paddingHorizontal: responsiveScale(12),
    minHeight: responsiveScale(46),
    fontSize: responsiveScale(14),
    color: colors.textPrimary,
    backgroundColor: '#ffffff',
  },

  passwordContainer: {
    position: 'relative',
  },

  eyeIconWrapper: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -10 }],
  },

  eyeIcon: {
    width: responsiveScale(18),
    height: responsiveScale(18),
  },

  optionsContainer: {
    alignItems: 'flex-end',
    marginBottom: responsiveScale(12),
  },

  forgotText: {
    fontSize: responsiveScale(12),
    color: colors.primaryButton,
    fontWeight: '600',
  },

  button: {
    width: '100%',
    borderRadius: moderateScale(12),
    overflow: 'hidden',
  },

  buttonGradient: {
    minHeight: responsiveScale(48),
    justifyContent: 'center',
    alignItems: 'center',
  },

  buttonText: {
    color: '#fff',
    fontSize: responsiveScale(14),
    fontWeight: '700',
  },

  securityContainer: {
    marginTop: responsiveScale(8),
    alignItems: 'center',
  },

  securityText: {
    fontSize: responsiveScale(10),
    color: colors.textSecondary,
  },

  // ── FOOTER ──
  footerContainer: {
    alignItems: 'center',
    width: '100%',
  },

  developedBy: {
    fontSize: responsiveScale(14),
    fontWeight: '700',
    color: '#000000',
    marginBottom: responsiveScale(4),
  },

  companyName: {
    fontSize: responsiveScale(12),
    color: '#000000',
    textAlign: 'center',
  },
});

export default Login;