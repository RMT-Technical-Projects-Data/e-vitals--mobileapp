import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ImageBackground,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../services/apiService';
import { useAuth } from '../../context/AuthContext';
import { unlockAllOrientations, lockToLandscape } from '../../utils/orientationHelper';
import {
  MAX_BIOMETRIC_ATTEMPTS,
  authenticateWithBiometrics,
  canPromptBiometricLogin,
  getBiometricStatus,
  getSavedCredentials,
  offerBiometricAfterLogin,
} from '../../services/biometricAuth';

const HERO_IMAGE = require('../../assets/images/tablet-login-background.jpeg');
const LOGO_IMAGE = require('../../assets/images/batch_06/logo5.png');
const EYE_OPEN = require('../../assets/images/batch_04/eye-open.png');
const EYE_CLOSED = require('../../assets/images/batch_04/eye-close.png');

const COLORS = {
  navy: '#0b1f3f',
  blue: '#1177c6',
  blueLight: '#4FA3F5',
  text: '#152033',
  muted: '#64748b',
  border: 'rgba(11, 42, 74, 0.14)',
  inputBg: 'rgba(255, 255, 255, 0.65)',
  inputFocusedBg: '#ffffff',
  shadow: 'rgba(11, 42, 74, 0.28)',
  cardBg: 'rgba(255, 255, 255, 0.62)',
  cardBorder: 'rgba(255, 255, 255, 0.85)',
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const Login = ({ navigation }) => {
  const { login } = useAuth();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const shortestSide = Math.min(width, height);
  const isTablet = Platform.isPad || shortestSide >= 768;

  const mobileScale = clamp(width / 390, 0.85, 1.15);
  const ms = n => Math.round(n * mobileScale);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUsernameFocused, setIsUsernameFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackTone, setFeedbackTone] = useState('error');
  const [biometricLabel, setBiometricLabel] = useState(Platform.OS === 'ios' ? 'Face ID' : 'Biometric login');
  const [showBiometricButton, setShowBiometricButton] = useState(false);
  const failedBiometricAttempts = useRef(0);
  const biometricPromptedRef = useRef(false);

  useEffect(() => {
    if (isTablet) {
      lockToLandscape();
      return unlockAllOrientations;
    }
    unlockAllOrientations();
    return undefined;
  }, [isTablet]);

  useEffect(() => {
    const restoreRememberedUsername = async () => {
      const savedUsername = await AsyncStorage.getItem('rememberedUsername');
      if (savedUsername) {
        setUsername(savedUsername);
        setRememberMe(true);
      }
    };

    restoreRememberedUsername().catch(error => {
      console.warn('Could not restore remembered username:', error.message);
    });
  }, []);

  useEffect(() => {
    const prepareBiometrics = async () => {
      const status = await getBiometricStatus();
      setBiometricLabel(status.label);
      const canPrompt = status.available && status.enabled && status.hasCredentials;
      setShowBiometricButton(canPrompt);
      if (!canPrompt || biometricPromptedRef.current) {
        return;
      }
      biometricPromptedRef.current = true;
      setTimeout(() => {
        promptBiometricLogin(true);
      }, 450);
    };

    prepareBiometrics().catch(error => {
      console.warn('Could not prepare biometric login:', error.message);
    });
  }, []);

  const showFeedback = (message, tone = 'error') => {
    setFeedback(message);
    setFeedbackTone(tone);
  };

  const clearFeedback = () => setFeedback('');

  const saveRememberedUsername = async () => {
    if (rememberMe) {
      await AsyncStorage.setItem('rememberedUsername', username.trim());
      return;
    }
    await AsyncStorage.removeItem('rememberedUsername');
  };

  const persistUserSession = async data => {
    if (!data?.user) {
      return;
    }

    await AsyncStorage.setItem('user', JSON.stringify(data.user));

    if (data.user.practice_id) {
      await AsyncStorage.setItem('practiceId', String(data.user.practice_id));
    }

    const numericPatientId = data.user.patients_table_id;
    if (numericPatientId) {
      await AsyncStorage.setItem('patientId', String(numericPatientId));
    }

    if (data.user.patient_id_string || data.user.patient_id) {
      await AsyncStorage.setItem(
        'patientIdString',
        String(data.user.patient_id_string || data.user.patient_id),
      );
    }

    if (data.user.latest_vitals) {
      await AsyncStorage.setItem('latestVitals', JSON.stringify(data.user.latest_vitals));
      await AsyncStorage.setItem('lastVitalsFetch', Date.now().toString());
      return;
    }

    const roleId = Number(data.user.role_id);
    if (roleId === 4 || roleId === 5 || roleId === 7) {
      return;
    }

    try {
      const vitalsData = await apiService.getLatestVitals();
      if (vitalsData?.success && vitalsData.data) {
        await AsyncStorage.setItem('latestVitals', JSON.stringify(vitalsData.data));
        await AsyncStorage.setItem('lastVitalsFetch', Date.now().toString());
        if (vitalsData.data.practice_id) {
          await AsyncStorage.setItem('practiceId', String(vitalsData.data.practice_id));
        }
        if (vitalsData.data.patients_table_id) {
          await AsyncStorage.setItem('patientId', String(vitalsData.data.patients_table_id));
        }
      }
    } catch (vitalsError) {
      console.warn('Could not pre-fetch latest vitals:', vitalsError.message);
    }
  };

  const finishAuthenticatedSession = async (data, loginUsername, loginPassword) => {
    await persistUserSession(data);
    await saveRememberedUsername();
    await offerBiometricAfterLogin(loginUsername, loginPassword);
    login();
  };

  const loginWithCredentials = async (loginUsername, loginPassword, fromBiometric = false) => {
    clearFeedback();
    setIsLoading(true);
    try {
      const data = await apiService.login(loginUsername, loginPassword, rememberMe);

      if (data.requires_otp) {
        setUsername(loginUsername);
        setPassword(loginPassword);
        setShowOtp(true);
        showFeedback('Enter the verification code sent to you.', 'success');
        return;
      }

      failedBiometricAttempts.current = 0;
      await finishAuthenticatedSession(data, loginUsername, loginPassword);
    } catch (error) {
      let errorMessage = error.message || 'Login failed. Please try again.';
      if (error.message?.includes('timeout') || error.message?.includes('connect')) {
        errorMessage =
          'Cannot connect to server. Please check your internet connection and try again.';
      }
      if (fromBiometric) {
        errorMessage = `${errorMessage} Please sign in with your credentials.`;
        setShowBiometricButton(false);
      }
      showFeedback(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const promptBiometricLogin = async (autoRetry = false) => {
    if (failedBiometricAttempts.current >= MAX_BIOMETRIC_ATTEMPTS || isLoading) {
      return;
    }

    const canPrompt = await canPromptBiometricLogin();
    if (!canPrompt) {
      setShowBiometricButton(false);
      return;
    }

    const result = await authenticateWithBiometrics(`Sign in with ${biometricLabel}`);
    if (result.success) {
      const creds = await getSavedCredentials();
      if (!creds?.username || !creds?.password) {
        setShowBiometricButton(false);
        showFeedback(`${biometricLabel} is unavailable. Please sign in with your credentials.`);
        return;
      }
      setUsername(creds.username);
      setPassword(creds.password);
      await loginWithCredentials(creds.username, creds.password, true);
      return;
    }

    if (result.cancelled) {
      return;
    }

    failedBiometricAttempts.current += 1;
    if (failedBiometricAttempts.current >= MAX_BIOMETRIC_ATTEMPTS) {
      setShowBiometricButton(false);
      showFeedback(`${biometricLabel} failed twice. Please sign in with your credentials.`);
      return;
    }

    showFeedback(`${biometricLabel} not recognized. Try again.`);
    if (autoRetry) {
      await promptBiometricLogin(true);
    }
  };

  const handleLogin = async () => {
    if (!username.trim()) {
      showFeedback('Please enter your email or username.');
      return;
    }
    if (!password.trim()) {
      showFeedback('Please enter your password.');
      return;
    }

    await loginWithCredentials(username, password);
  };

  const handleVerifyOtp = async () => {
    clearFeedback();

    if (!otp.trim()) {
      showFeedback('Please enter the OTP code.');
      return;
    }

    setIsLoading(true);
    try {
      const data = await apiService.verifyOTP(otp.trim());
      failedBiometricAttempts.current = 0;
      await finishAuthenticatedSession(data, username, password);
    } catch (error) {
      showFeedback(error.message || 'Invalid OTP code.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderFormFields = () => {
    if (showOtp) {
      return (
        <>
          <View style={styles.field}>
            <Text style={styles.label}>OTP Code</Text>
            <View style={styles.inputIconWrap}>
              <MaterialIcons name="pin" size={20} color={COLORS.muted} style={styles.fieldIconLeft} />
              <TextInput
                style={[styles.input, styles.inputWithLeftIcon]}
                placeholder="Enter OTP code"
                placeholderTextColor={COLORS.muted}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                editable={!isLoading}
                autoFocus
              />
            </View>
          </View>

          {feedback ? (
            <View style={styles.feedbackWrap}>
              <Text style={[styles.feedbackText, feedbackTone === 'success' && styles.feedbackTextSuccess]}>
                {feedback}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity style={styles.primaryButtonWrap} onPress={handleVerifyOtp} disabled={isLoading} activeOpacity={0.85}>
            <LinearGradient
              colors={[COLORS.blueLight, COLORS.blue, COLORS.navy]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryButton}
            >
              <View style={styles.primaryButtonInner}>
                <Text style={styles.primaryButtonText}>{isLoading ? 'Verifying...' : 'Verify OTP'}</Text>
                {!isLoading ? <MaterialIcons name="arrow-forward" size={18} color="#fff" style={styles.primaryButtonIcon} /> : null}
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </>
      );
    }

    return (
      <>
        <View style={styles.field}>
          <Text style={styles.label}>Email or username</Text>
          <View style={styles.inputIconWrap}>
            <MaterialIcons name="person-outline" size={20} color={COLORS.navy} style={styles.fieldIconLeft} />
            <TextInput
              style={[
                styles.input,
                styles.inputWithLeftIcon,
                isUsernameFocused && styles.inputFocused,
              ]}
              placeholder="Enter your email or username"
              placeholderTextColor={COLORS.muted}
              value={username}
              onChangeText={setUsername}
              onFocus={() => setIsUsernameFocused(true)}
              onBlur={() => setIsUsernameFocused(false)}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              autoComplete="username"
              editable={!isLoading}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputIconWrap}>
            <MaterialIcons name="lock-outline" size={20} color={COLORS.navy} style={styles.fieldIconLeft} />
            <TextInput
              style={[
                styles.input,
                styles.passwordInputWithLock,
                isPasswordFocused && styles.inputFocused,
              ]}
              placeholder="Enter password"
              placeholderTextColor={COLORS.muted}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setIsPasswordFocused(true)}
              onBlur={() => setIsPasswordFocused(false)}
              textContentType="password"
              autoComplete="password"
              editable={!isLoading}
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Image source={showPassword ? EYE_OPEN : EYE_CLOSED} style={styles.eyeIcon} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.formRow}>
          <TouchableOpacity
            style={styles.rememberRow}
            onPress={() => setRememberMe(!rememberMe)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
              {rememberMe ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <Text style={styles.rememberText}>Remember me</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.linkText}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        {feedback ? (
          <View style={styles.feedbackWrap}>
            <Text style={[styles.feedbackText, feedbackTone === 'success' && styles.feedbackTextSuccess]}>
              {feedback}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.primaryButtonWrap} onPress={handleLogin} disabled={isLoading} activeOpacity={0.85}>
          <LinearGradient
            colors={[COLORS.blueLight, COLORS.blue, COLORS.navy]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryButton}
          >
            <View style={styles.primaryButtonInner}>
              <Text style={styles.primaryButtonText}>{isLoading ? 'Signing in...' : 'Sign In'}</Text>
              {!isLoading ? <MaterialIcons name="arrow-forward" size={18} color="#fff" style={styles.primaryButtonIcon} /> : null}
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {showBiometricButton ? (
          <TouchableOpacity
            style={styles.biometricButton}
            onPress={() => promptBiometricLogin(false)}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name={Platform.OS === 'ios' ? 'face' : 'fingerprint'}
              size={22}
              color={COLORS.navy}
            />
            <Text style={styles.biometricButtonText}>Sign in with {biometricLabel}</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.secureLine}>
          <MaterialIcons name="verified-user" size={15} color={COLORS.navy} style={{ opacity: 0.75 }} />
          <Text style={styles.secureLineText}>Secure. Reliable. Designed for better care.</Text>
        </View>
      </>
    );
  };

  const cardMaxWidth = isTablet ? 520 : Math.min(width - 32, 430);
  const logoWidth = isTablet ? ms(180) : ms(168);
  const logoHeight = isTablet ? ms(58) : ms(54);

  return (
    <View style={styles.screenRoot}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <ImageBackground source={HERO_IMAGE} style={styles.fullScreenBg} resizeMode="cover">
        {/* Soft light gradient overlay — keeps the photo visible while giving
            the top brand mark and bottom card enough contrast to read */}
        <LinearGradient
          colors={[
            'rgba(255, 255, 255, 0.55)',
            'rgba(255, 255, 255, 0.10)',
            'rgba(255, 255, 255, 0.06)',
            'rgba(255, 255, 255, 0.55)',
            'rgba(255, 255, 255, 0.85)',
          ]}
          locations={[0, 0.2, 0.45, 0.72, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
          {/* Brand mark sits directly on the photo — no card/background behind it */}
          <View style={[styles.brandRow, { paddingTop: 8 }]}>
            <Image
              source={LOGO_IMAGE}
              resizeMode="contain"
              style={{ width: logoWidth, height: logoHeight }}
            />
          </View>

          <KeyboardAvoidingView
            style={styles.keyboardWrap}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces
            >
              {/* Glassmorphic centered card */}
              <View style={[styles.glassCard, { maxWidth: cardMaxWidth }]}>
                {showOtp ? (
                  <Text style={styles.formEyebrow}>Verification</Text>
                ) : null}
                <Text style={styles.formTitle}>
                  {showOtp ? 'Verify your account' : 'Sign in to continue'}
                </Text>
                {showOtp ? (
                  <Text style={styles.formSubtitle}>
                    Enter the verification code sent to you.
                  </Text>
                ) : null}

                {renderFormFields()}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: '#071b34',
  },
  fullScreenBg: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    // subtle lift so the mark reads clearly against any part of the photo
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  keyboardWrap: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  glassCard: {
    width: '100%',
    justifyContent: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 30,
    paddingTop: 34,
    paddingBottom: 30,
    alignItems: 'flex-start',
    // Layered shadow so the card visibly floats over the photo
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 1,
    shadowRadius: 32,
    elevation: 12,
  },
  formEyebrow: {
    color: COLORS.blue,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  formTitle: {
    color: COLORS.navy,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  formSubtitle: {
    color: COLORS.muted,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
    marginTop: 8,
  },
  field: {
    width: '100%',
    marginTop: 26,
    marginBottom: 0,
  },
  label: {
    color: COLORS.navy,
    opacity: 0.85,
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 9,
  },
  inputIconWrap: {
    position: 'relative',
    width: '100%',
    justifyContent: 'center',
  },
  fieldIconLeft: {
    position: 'absolute',
    left: 16,
    zIndex: 2,
  },
  input: {
    height: 58,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 18,
    color: COLORS.text,
    backgroundColor: COLORS.inputBg,
    fontSize: 16,
    fontWeight: '600',
  },
  inputWithLeftIcon: {
    paddingLeft: 48,
    paddingRight: 18,
  },
  passwordInputWithLock: {
    paddingLeft: 48,
    paddingRight: 52,
  },
  inputFocused: {
    borderColor: COLORS.blue,
    backgroundColor: COLORS.inputFocusedBg,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    zIndex: 2,
    padding: 4,
  },
  eyeIcon: {
    width: 22,
    height: 22,
    tintColor: COLORS.navy,
    opacity: 0.7,
  },
  formRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 26,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(11, 42, 74, 0.4)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  checkboxChecked: {
    backgroundColor: COLORS.blue,
    borderColor: COLORS.blue,
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 14,
  },
  rememberText: {
    color: COLORS.navy,
    opacity: 0.85,
    fontSize: 14,
    fontWeight: '600',
  },
  linkText: {
    color: COLORS.blue,
    fontSize: 14,
    fontWeight: '700',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(28, 111, 217, 0.4)',
  },
  feedbackWrap: {
    width: '100%',
    marginBottom: 14,
  },
  feedbackText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  feedbackTextSuccess: {
    color: '#16a34a',
  },
  primaryButtonWrap: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 2,
    shadowColor: COLORS.blue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  primaryButton: {
    height: 58,
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
  },
  primaryButtonInner: {
    flex: 1,
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
    lineHeight: 22,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  primaryButtonIcon: {
    marginLeft: 8,
  },
  biometricButton: {
    width: '100%',
    marginTop: 14,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(11, 42, 74, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    paddingHorizontal: 16,
    gap: 8,
  },
  biometricButtonText: {
    color: COLORS.navy,
    fontSize: 15,
    fontWeight: '700',
  },
  secureLine: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 20,
  },
  secureLineText: {
    color: COLORS.navy,
    opacity: 0.65,
    fontSize: 12.5,
    fontWeight: '600',
  },
});

export default Login;