import React, { useState, useEffect } from 'react';
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
  Alert,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../../services/apiService';

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

const ForgotPassword = ({ navigation }) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const shortestSide = Math.min(width, height);
  const isTablet = Platform.isPad || shortestSide >= 768;

  const mobileScale = clamp(width / 390, 0.85, 1.15);
  const ms = n => Math.round(n * mobileScale);

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [otpFocused, setOtpFocused] = useState(false);
  const [newPasswordFocused, setNewPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackTone, setFeedbackTone] = useState('error');
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const showMessage = (message, tone = 'error') => {
    setFeedback(message);
    setFeedbackTone(tone);
  };

  const clearMessage = () => setFeedback('');

  const validateEmail = value => /\S+@\S+\.\S+/.test(value);

  const getPasswordStrength = password => {
    const trimmedPassword = password.trim();
    return {
      hasMinLength: trimmedPassword.length >= 8,
      hasLowercase: /[a-z]/.test(trimmedPassword),
      hasUppercase: /[A-Z]/.test(trimmedPassword),
      hasNumber: /[0-9]/.test(trimmedPassword),
      hasSpecialChar: /[!@#$%^&*]/.test(trimmedPassword),
    };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  const handleNext = async () => {
    clearMessage();

    if (!validateEmail(email)) {
      showMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await apiService.forgotPasswordWithOTP(email.trim());

      if (result?.success) {
        showMessage('OTP has been sent to your email.', 'success');
        setStep(2);
      } else {
        showMessage(result?.message || 'Failed to send OTP.');
      }
    } catch (error) {
      let errorMessage = error.message || 'Something went wrong. Try again.';

      if (
        error.message?.includes('not available on this server') ||
        error.message?.includes('not found') ||
        error.message?.includes('Not Found')
      ) {
        errorMessage = 'No account was found for this email address. Please try again.';
      }

      showMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpVerify = async () => {
    clearMessage();

    if (otp.length !== 6) {
      showMessage('Please enter a 6-digit OTP.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await apiService.verifyPasswordResetOTP(email.trim(), otp.trim());

      if (result?.success) {
        await new Promise(resolve => setTimeout(resolve, 500));
        showMessage('OTP verified successfully.', 'success');
        setStep(3);
      } else {
        showMessage(result?.message || 'Invalid OTP.');
      }
    } catch (error) {
      showMessage(error.message || 'Invalid OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    clearMessage();

    const trimmedNewPassword = newPassword.trim();
    const trimmedConfirmPassword = confirmPassword.trim();
    const strength = getPasswordStrength(trimmedNewPassword);

    if (trimmedNewPassword.length < 8) {
      showMessage('Password must be at least 8 characters long.');
      return;
    }

    if (!strength.hasUppercase) {
      showMessage('Password must contain at least one uppercase letter.');
      return;
    }

    if (!strength.hasLowercase) {
      showMessage('Password must contain at least one lowercase letter.');
      return;
    }

    if (!strength.hasNumber) {
      showMessage('Password must contain at least one number.');
      return;
    }

    if (!strength.hasSpecialChar) {
      showMessage('Password must contain at least one special character (!@#$%^&*).');
      return;
    }

    if (trimmedNewPassword !== trimmedConfirmPassword) {
      showMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await apiService.resetPasswordWithOTP(email.trim(), trimmedNewPassword);

      if (result?.success) {
        Alert.alert('Success', 'Your password has been reset successfully.', [
          { text: 'OK', onPress: () => navigation.replace('Login') },
        ]);
      } else {
        showMessage(result?.message || 'Password reset failed.');
      }
    } catch (error) {
      showMessage(error.message || 'Password reset failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]}>
        <Text style={[styles.stepNumber, step >= 1 && styles.stepNumberActive]}>1</Text>
      </View>
      <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
      <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]}>
        <Text style={[styles.stepNumber, step >= 2 && styles.stepNumberActive]}>2</Text>
      </View>
      <View style={[styles.stepLine, step >= 3 && styles.stepLineActive]} />
      <View style={[styles.stepDot, step >= 3 && styles.stepDotActive]}>
        <Text style={[styles.stepNumber, step >= 3 && styles.stepNumberActive]}>3</Text>
      </View>
    </View>
  );

  const renderPasswordField = ({
    label,
    value,
    onChangeText,
    showPassword,
    onToggle,
    focused,
    onFocus,
    onBlur,
    placeholder,
  }) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputIconWrap}>
        <MaterialIcons name="lock-outline" size={20} color={COLORS.navy} style={styles.fieldIconLeft} />
        <TextInput
          style={[
            styles.input,
            styles.passwordInputWithLock,
            focused && styles.inputFocused,
          ]}
          placeholder={placeholder}
          placeholderTextColor={COLORS.muted}
          secureTextEntry={!showPassword}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          editable={!isLoading}
        />
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={onToggle}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Image
            source={showPassword ? EYE_OPEN : EYE_CLOSED}
            style={styles.eyeIcon}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  const cardMaxWidth = isTablet ? 520 : Math.min(width - 32, 430);
  const logoWidth = isTablet ? ms(150) : ms(130);
  const logoHeight = isTablet ? ms(48) : ms(42);

  return (
    <View style={styles.screenRoot}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <ImageBackground source={HERO_IMAGE} style={styles.fullScreenBg} resizeMode="cover">
        {/* Soft light gradient overlay matching Login screen */}
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
          {/* Brand mark and Back button header */}
          <View style={[styles.brandRow, { paddingTop: 8 }]}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="arrow-back-ios" size={18} color={COLORS.navy} />
            </TouchableOpacity>

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
                {renderStepIndicator()}

                {step === 1 && (
                  <>
                    <Text style={styles.formTitle}>Reset Password</Text>
                    <Text style={styles.formSubtitle}>
                      Enter your email address and we will send a 6-digit verification code to reset your account.
                    </Text>

                    <View style={styles.field}>
                      <Text style={styles.label}>Email Address</Text>
                      <View style={styles.inputIconWrap}>
                        <MaterialIcons name="mail-outline" size={20} color={COLORS.navy} style={styles.fieldIconLeft} />
                        <TextInput
                          style={[
                            styles.input,
                            styles.inputWithLeftIcon,
                            emailFocused && styles.inputFocused,
                          ]}
                          placeholder="name@practice.com"
                          placeholderTextColor={COLORS.muted}
                          value={email}
                          onChangeText={setEmail}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          onFocus={() => setEmailFocused(true)}
                          onBlur={() => setEmailFocused(false)}
                          editable={!isLoading}
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

                    <TouchableOpacity style={styles.primaryButtonWrap} onPress={handleNext} disabled={isLoading} activeOpacity={0.85}>
                      <LinearGradient
                        colors={[COLORS.blueLight, COLORS.blue, COLORS.navy]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.primaryButton}
                      >
                        <Text style={styles.primaryButtonText}>{isLoading ? 'Sending OTP...' : 'Send OTP'}</Text>
                        {!isLoading ? <MaterialIcons name="arrow-forward" size={18} color="#fff" /> : null}
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                )}

                {step === 2 && (
                  <>
                    <Text style={styles.formTitle}>Enter OTP Code</Text>
                    <Text style={styles.formSubtitle}>
                      We sent a 6-digit verification code to{' '}
                      <Text style={styles.emailHighlight}>{email}</Text>
                    </Text>

                    <View style={styles.field}>
                      <Text style={styles.label}>OTP Code</Text>
                      <View style={styles.inputIconWrap}>
                        <MaterialIcons name="pin" size={20} color={COLORS.navy} style={styles.fieldIconLeft} />
                        <TextInput
                          style={[
                            styles.input,
                            styles.inputWithLeftIcon,
                            styles.otpInput,
                            otpFocused && styles.inputFocused,
                          ]}
                          placeholder="000000"
                          placeholderTextColor={COLORS.muted}
                          value={otp}
                          onChangeText={setOtp}
                          keyboardType="number-pad"
                          maxLength={6}
                          onFocus={() => setOtpFocused(true)}
                          onBlur={() => setOtpFocused(false)}
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

                    <TouchableOpacity style={styles.primaryButtonWrap} onPress={handleOtpVerify} disabled={isLoading} activeOpacity={0.85}>
                      <LinearGradient
                        colors={[COLORS.blueLight, COLORS.blue, COLORS.navy]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.primaryButton}
                      >
                        <Text style={styles.primaryButtonText}>{isLoading ? 'Verifying...' : 'Verify OTP'}</Text>
                        {!isLoading ? <MaterialIcons name="arrow-forward" size={18} color="#fff" /> : null}
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setOtp('');
                        setStep(1);
                        clearMessage();
                      }}
                      style={styles.resendTouch}
                    >
                      <Text style={styles.resendText}>Resend OTP</Text>
                    </TouchableOpacity>
                  </>
                )}

                {step === 3 && (
                  <>
                    <Text style={styles.formTitle}>New Password</Text>
                    <Text style={styles.formSubtitle}>
                      Create a strong, secure password for your account.
                    </Text>

                    {renderPasswordField({
                      label: 'New Password',
                      value: newPassword,
                      onChangeText: setNewPassword,
                      showPassword: showNewPassword,
                      onToggle: () => setShowNewPassword(!showNewPassword),
                      focused: newPasswordFocused,
                      onFocus: () => setNewPasswordFocused(true),
                      onBlur: () => setNewPasswordFocused(false),
                      placeholder: 'Enter password',
                    })}

                    {newPassword.length > 0 && (
                      <View style={styles.strengthBox}>
                        <Text
                          style={[
                            styles.strengthText,
                            passwordStrength.hasMinLength && styles.strengthTextDone,
                          ]}
                        >
                          {passwordStrength.hasMinLength ? '✓' : '○'} At least 8 characters
                        </Text>
                        <Text
                          style={[
                            styles.strengthText,
                            passwordStrength.hasUppercase && styles.strengthTextDone,
                          ]}
                        >
                          {passwordStrength.hasUppercase ? '✓' : '○'} Contains uppercase letter
                        </Text>
                        <Text
                          style={[
                            styles.strengthText,
                            passwordStrength.hasLowercase && styles.strengthTextDone,
                          ]}
                        >
                          {passwordStrength.hasLowercase ? '✓' : '○'} Contains lowercase letter
                        </Text>
                        <Text
                          style={[
                            styles.strengthText,
                            passwordStrength.hasNumber && styles.strengthTextDone,
                          ]}
                        >
                          {passwordStrength.hasNumber ? '✓' : '○'} Contains numbers
                        </Text>
                        <Text
                          style={[
                            styles.strengthText,
                            passwordStrength.hasSpecialChar && styles.strengthTextDone,
                          ]}
                        >
                          {passwordStrength.hasSpecialChar ? '✓' : '○'} Contains special character
                        </Text>
                      </View>
                    )}

                    {renderPasswordField({
                      label: 'Confirm Password',
                      value: confirmPassword,
                      onChangeText: setConfirmPassword,
                      showPassword: showConfirmPassword,
                      onToggle: () => setShowConfirmPassword(!showConfirmPassword),
                      focused: confirmPasswordFocused,
                      onFocus: () => setConfirmPasswordFocused(true),
                      onBlur: () => setConfirmPasswordFocused(false),
                      placeholder: 'Enter password',
                    })}

                    {feedback ? (
                      <View style={styles.feedbackWrap}>
                        <Text style={[styles.feedbackText, feedbackTone === 'success' && styles.feedbackTextSuccess]}>
                          {feedback}
                        </Text>
                      </View>
                    ) : null}

                    <TouchableOpacity style={styles.primaryButtonWrap} onPress={handlePasswordReset} disabled={isLoading} activeOpacity={0.85}>
                      <LinearGradient
                        colors={[COLORS.blueLight, COLORS.blue, COLORS.navy]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.primaryButton}
                      >
                        <Text style={styles.primaryButtonText}>{isLoading ? 'Resetting...' : 'Reset Password'}</Text>
                        {!isLoading ? <MaterialIcons name="arrow-forward" size={18} color="#fff" /> : null}
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                )}

                <TouchableOpacity
                  onPress={() => navigation.navigate('Login')}
                  style={styles.backToLoginTouch}
                >
                  <Text style={styles.backToLoginText}>Back to Sign In</Text>
                </TouchableOpacity>

                <View style={styles.secureLine}>
                  <MaterialIcons name="verified-user" size={15} color={COLORS.navy} style={{ opacity: 0.75 }} />
                  <Text style={styles.secureLineText}>Secure. Reliable. Designed for better care.</Text>
                </View>
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
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
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
    paddingTop: 28,
    paddingBottom: 28,
    alignItems: 'flex-start',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 1,
    shadowRadius: 32,
    elevation: 12,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(11, 42, 74, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: COLORS.blue,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.navy,
  },
  stepNumberActive: {
    color: '#ffffff',
  },
  stepLine: {
    width: 32,
    height: 2,
    backgroundColor: 'rgba(11, 42, 74, 0.12)',
    marginHorizontal: 6,
  },
  stepLineActive: {
    backgroundColor: COLORS.blue,
  },
  formTitle: {
    color: COLORS.navy,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  formSubtitle: {
    color: COLORS.muted,
    fontSize: 14.5,
    lineHeight: 20,
    fontWeight: '500',
    marginTop: 6,
    marginBottom: 6,
  },
  emailHighlight: {
    color: COLORS.blue,
    fontWeight: '700',
  },
  field: {
    width: '100%',
    marginTop: 20,
    marginBottom: 0,
  },
  label: {
    color: COLORS.navy,
    opacity: 0.85,
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 8,
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
    height: 56,
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
  otpInput: {
    letterSpacing: 6,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'left',
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
  strengthBox: {
    width: '100%',
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  strengthText: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: 3,
    fontWeight: '500',
  },
  strengthTextDone: {
    color: '#16a34a',
    fontWeight: '700',
  },
  feedbackWrap: {
    width: '100%',
    marginTop: 14,
  },
  feedbackText: {
    color: '#dc2626',
    fontSize: 13.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  feedbackTextSuccess: {
    color: '#16a34a',
  },
  primaryButtonWrap: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 22,
    shadowColor: COLORS.blue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  primaryButton: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  resendTouch: {
    alignSelf: 'center',
    marginTop: 14,
  },
  resendText: {
    color: COLORS.blue,
    fontSize: 14,
    fontWeight: '700',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(28, 111, 217, 0.4)',
  },
  backToLoginTouch: {
    alignSelf: 'center',
    marginTop: 18,
  },
  backToLoginText: {
    color: COLORS.navy,
    opacity: 0.85,
    fontSize: 14,
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

export default ForgotPassword;
