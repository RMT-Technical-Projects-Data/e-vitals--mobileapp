import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { RFValue } from 'react-native-responsive-fontsize';
import { colors, fonts, scaleFont } from './config/globall';
import apiService from './services/apiService';

// Get device width and height
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

// Scale helpers
const scaleWidth = (size) => (width / guidelineBaseWidth) * size;
const scaleHeight = (size) => (height / guidelineBaseHeight) * size;

const ForgotPassword = ({ navigation }) => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validateEmail = (email) => /\S+@\S+\.\S+/.test(email);

  // Password strength validation (matches backend validation for role_id 6 - Patient)
  // Backend regex: /^(?=.*\d)(?=.*[a-zA-Z])[a-zA-Z0-9]{7,}$/
  // This means: at least 7 chars, contains letter, contains number, only alphanumeric
  const getPasswordStrength = (password) => {
    const trimmedPassword = password.trim();
    return {
      hasMinLength: trimmedPassword.length >= 7,
      hasLetter: /[a-zA-Z]/.test(trimmedPassword),
      hasNumber: /[0-9]/.test(trimmedPassword),
      isAlphanumericOnly: /^[a-zA-Z0-9]+$/.test(trimmedPassword), // Only letters and numbers, no special chars
      hasUppercase: /[A-Z]/.test(trimmedPassword),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(trimmedPassword),
    };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  // Step 1: Send OTP
  const handleNext = async () => {
    if (!validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await apiService.forgotPasswordWithOTP(email.trim());
      
      if (result && result.success) {
        Alert.alert("Success", "OTP has been sent to your email.");
        setStep(2);
      } else {
        Alert.alert("Error", result?.message || "Failed to send OTP");
      }
    } catch (error) {
      console.error('❌ Error sending OTP:', error);
      
      // Provide more helpful error message
      let errorMessage = error.message || "Something went wrong. Try again.";
      let errorTitle = "Error";
      
      if (error.message && error.message.includes('not available on this server')) {
        errorTitle = "Server Configuration Error";
        errorMessage = "The OTP endpoint is not available on the staging server.\n\nPlease ensure the backend server has been updated with the latest code that includes the '/api/users/forgot-password-otp' endpoint.\n\nContact your administrator to deploy the updated backend code.";
      } else if (error.message && error.message.includes('not found')) {
        errorTitle = "Endpoint Not Found";
        errorMessage = "The forgot password OTP endpoint is not available on this server.\n\nPlease contact support to update the backend server with the latest code.";
      }
      
      Alert.alert(errorTitle, errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleOtpVerify = async () => {
    if (otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter a 6-digit OTP.');
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await apiService.verifyPasswordResetOTP(email.trim(), otp.trim());
      
      if (result && result.success) {
        // Wait a moment to ensure session is saved
        await new Promise(resolve => setTimeout(resolve, 500));
        Alert.alert("Success", "OTP verified successfully.");
        setStep(3);
      } else {
        Alert.alert("Error", result?.message || "Invalid OTP");
      }
    } catch (error) {
      console.error('❌ Error verifying OTP:', error);
      Alert.alert("Error", error.message || "Invalid OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Reset Password
  const handlePasswordReset = async () => {
    // Trim passwords to avoid whitespace issues
    const trimmedNewPassword = newPassword.trim();
    const trimmedConfirmPassword = confirmPassword.trim();
    
    // Validate password strength (must match backend validation for role_id 6)
    const strength = getPasswordStrength(trimmedNewPassword);
    
    // Check minimum 7 characters
    if (trimmedNewPassword.length < 7) {
      Alert.alert('Error', 'Password must be at least 7 characters long.');
      return;
    }
    
    // Check for letters and numbers (required for role_id 6 - Patient)
    if (!strength.hasLetter || !strength.hasNumber) {
      Alert.alert('Weak Password', 'Password must contain both letters and numbers.');
      return;
    }
    
    // Check that password contains only alphanumeric characters (no special chars for patients)
    if (!strength.isAlphanumericOnly) {
      Alert.alert('Invalid Password', 'Password can only contain letters and numbers. Special characters are not allowed.');
      return;
    }
    
    // Compare passwords
    if (trimmedNewPassword !== trimmedConfirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await apiService.resetPasswordWithOTP(email.trim(), trimmedNewPassword);
      
      if (result && result.success) {
        Alert.alert("Success", "Your password has been reset successfully.", [
          {
            text: 'OK',
            onPress: () => navigation.replace('Login')
          }
        ]);
      } else {
        Alert.alert("Error", result?.message || "Password reset failed.");
      }
    } catch (error) {
      console.error('❌ Error resetting password:', error);
      Alert.alert("Error", error.message || "Password reset failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const HEADER_COLOR = colors.primaryButton || '#293d55';
  const WHITE = '#FFFFFF';

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.fullScreenContainer}>
        <StatusBar barStyle="default" />
        
        <View style={styles.mainContainer}>
          {/* Header */}
          <View style={styles.topDarkSection}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.backButtonText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Forgot Password</Text>
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
                <View style={styles.formContainer}>
                  {/* Step Indicator */}
                  <View style={styles.stepIndicator}>
                    <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
                    <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
                    <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
                    <View style={[styles.stepLine, step >= 3 && styles.stepLineActive]} />
                    <View style={[styles.stepDot, step >= 3 && styles.stepDotActive]} />
                  </View>

                  {step === 1 && (
                    <View style={styles.stepContent}>
                      <View style={styles.iconContainer}>
                        <Text style={styles.iconText}>📧</Text>
                      </View>
                      <Text style={styles.sectionTitle}>Enter Your Email</Text>
                      <Text style={styles.description}>
                        We'll send you an OTP code to reset your password.
                      </Text>
                      <View style={styles.inputContainer}>
                        <Text style={styles.label}>Email Address</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Enter your email"
                          value={email}
                          onChangeText={setEmail}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          placeholderTextColor={colors.textSecondary}
                          editable={!isLoading}
                        />
                      </View>
                      <TouchableOpacity 
                        style={[styles.button, isLoading && styles.buttonDisabled]} 
                        onPress={handleNext}
                        disabled={isLoading}
                        activeOpacity={0.8}
                      >
                        {isLoading ? (
                          <ActivityIndicator size="small" color={WHITE} />
                        ) : (
                          <Text style={styles.buttonText}>Send OTP</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  {step === 2 && (
                    <View style={styles.stepContent}>
                      <View style={styles.iconContainer}>
                        <Text style={styles.iconText}>🔐</Text>
                      </View>
                      <Text style={styles.sectionTitle}>Verify OTP</Text>
                      <Text style={styles.description}>
                        Enter the 6-digit OTP code sent to{'\n'}
                        <Text style={styles.emailHighlight}>{email}</Text>
                      </Text>
                      <View style={styles.inputContainer}>
                        <Text style={styles.label}>Enter OTP</Text>
                        <TextInput
                          style={[styles.input, styles.otpInput]}
                          placeholder="000000"
                          value={otp}
                          onChangeText={setOtp}
                          keyboardType="numeric"
                          maxLength={6}
                          placeholderTextColor={colors.textSecondary}
                          editable={!isLoading}
                          autoFocus
                          textAlign="center"
                        />
                      </View>
                      <TouchableOpacity 
                        style={[styles.button, isLoading && styles.buttonDisabled]} 
                        onPress={handleOtpVerify}
                        disabled={isLoading}
                        activeOpacity={0.8}
                      >
                        {isLoading ? (
                          <ActivityIndicator size="small" color={WHITE} />
                        ) : (
                          <Text style={styles.buttonText}>Verify OTP</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => {
                          setOtp('');
                          setStep(1);
                        }}
                        style={styles.resendButton}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.resendText}>Resend OTP</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {step === 3 && (
                    <View style={styles.stepContent}>
                      <View style={styles.iconContainer}>
                        <Text style={styles.iconText}>🔑</Text>
                      </View>
                      <Text style={styles.sectionTitle}>Reset Password</Text>
                      <Text style={styles.description}>
                        Enter your new password below. Make sure it's secure!
                      </Text>
                      <View style={styles.inputContainer}>
                        <Text style={styles.label}>New Password</Text>
                        <View style={styles.passwordContainer}>
                          <TextInput
                            style={styles.input}
                            placeholder="New password (min 7 chars)"
                            secureTextEntry={!showNewPassword}
                            value={newPassword}
                            onChangeText={setNewPassword}
                            placeholderTextColor={colors.textSecondary}
                            editable={!isLoading}
                          />
                          <TouchableOpacity
                            style={styles.eyeIconWrapper}
                            onPress={() => setShowNewPassword(!showNewPassword)}
                          >
                            <Image
                              source={
                                showNewPassword
                                  ? require('./android/app/src/assets/images/eye-open.png')
                                  : require('./android/app/src/assets/images/eye-close.png')
                              }
                              style={styles.eyeIcon}
                            />
                          </TouchableOpacity>
                        </View>
                        {/* Password Strength Indicators */}
                        <View style={styles.passwordStrengthContainer}>
                          <View style={styles.strengthRow}>
                            <Text style={[styles.strengthText, passwordStrength.hasMinLength && styles.strengthTextCompleted]}>
                              {passwordStrength.hasMinLength ? '✓' : '○'} At least 7 characters
                            </Text>
                          </View>
                          <View style={styles.strengthRow}>
                            <Text style={[styles.strengthText, passwordStrength.hasLetter && styles.strengthTextCompleted]}>
                              {passwordStrength.hasLetter ? '✓' : '○'} Contains letters
                            </Text>
                          </View>
                          <View style={styles.strengthRow}>
                            <Text style={[styles.strengthText, passwordStrength.hasNumber && styles.strengthTextCompleted]}>
                              {passwordStrength.hasNumber ? '✓' : '○'} Contains numbers
                            </Text>
                          </View>
                          <View style={styles.strengthRow}>
                            <Text style={[styles.strengthText, passwordStrength.hasUppercase && styles.strengthTextCompleted]}>
                              {passwordStrength.hasUppercase ? '✓' : '○'} Contains uppercase letter
                            </Text>
                          </View>
                          <View style={styles.strengthRow}>
                            <Text style={[styles.strengthText, passwordStrength.isAlphanumericOnly && !passwordStrength.hasSpecialChar && styles.strengthTextCompleted, passwordStrength.hasSpecialChar && styles.strengthTextError]}>
                              {passwordStrength.isAlphanumericOnly && !passwordStrength.hasSpecialChar ? '✓' : passwordStrength.hasSpecialChar ? '✗' : '○'} Only letters and numbers (no special characters)
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.inputContainer}>
                        <Text style={styles.label}>Confirm Password</Text>
                        <View style={styles.passwordContainer}>
                          <TextInput
                            style={styles.input}
                            placeholder="Confirm new password"
                            secureTextEntry={!showConfirmPassword}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholderTextColor={colors.textSecondary}
                            editable={!isLoading}
                          />
                          <TouchableOpacity
                            style={styles.eyeIconWrapper}
                            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            <Image
                              source={
                                showConfirmPassword
                                  ? require('./android/app/src/assets/images/eye-open.png')
                                  : require('./android/app/src/assets/images/eye-close.png')
                              }
                              style={styles.eyeIcon}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <TouchableOpacity 
                        style={[styles.button, isLoading && styles.buttonDisabled]} 
                        onPress={handlePasswordReset}
                        disabled={isLoading}
                        activeOpacity={0.8}
                      >
                        {isLoading ? (
                          <ActivityIndicator size="small" color={WHITE} />
                        ) : (
                          <Text style={styles.buttonText}>Reset Password</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  <TouchableOpacity 
                    onPress={() => navigation.navigate('Login')}
                    style={styles.backToLoginButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.backToLogin}>
                      <Text style={styles.backArrow}>← </Text>
                      Back to Login
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

export default ForgotPassword;

const HEADER_COLOR = colors.primaryButton || '#293d55';
const WHITE = '#FFFFFF';

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: HEADER_COLOR,
  },
  mainContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: HEADER_COLOR,
  },
  topDarkSection: {
    backgroundColor: HEADER_COLOR,
    height: scaleHeight(120),
    borderBottomLeftRadius: scaleWidth(35),
    borderBottomRightRadius: scaleWidth(35),
    paddingBottom: scaleHeight(10),
    justifyContent: 'flex-start',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scaleWidth(20),
    paddingTop: scaleHeight(20),
  },
  backButton: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'left',
    minHeight: 55,
    minWidth: 55,
  },
  backButtonText: {
    fontSize: scaleFont(35),
    color: 'white',
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: scaleFont(22),
    fontWeight: Platform.OS === 'ios' ? '900' : 'bold',
    color: WHITE,
    textAlign: 'center',
    flex: 1,
    marginLeft: scaleWidth(5),
    ...Platform.select({
      android: {
        includeFontPadding: false,
        fontFamily: 'sans-serif-condensed',
      },
    }),
  },
  headerSpacer: {
    width: scaleWidth(36),
  },
  bottomLightSection: {
    flex: 1,
    backgroundColor: 'white',
    borderTopLeftRadius: scaleWidth(35),
    borderTopRightRadius: scaleWidth(35),
    marginTop: scaleWidth(-30),
    paddingTop: scaleWidth(20),
    paddingHorizontal: scaleWidth(20),
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollViewStyle: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: scaleHeight(40),
  },
  formContainer: {
    paddingHorizontal: scaleWidth(20),
    paddingTop: scaleHeight(20),
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: scaleHeight(30),
    paddingHorizontal: scaleWidth(40),
  },
  stepDot: {
    width: scaleWidth(12),
    height: scaleWidth(12),
    borderRadius: scaleWidth(6),
    backgroundColor: colors.borderLight,
    borderWidth: 2,
    borderColor: colors.borderLight,
  },
  stepDotActive: {
    backgroundColor: HEADER_COLOR,
    borderColor: HEADER_COLOR,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.borderLight,
    marginHorizontal: scaleWidth(8),
  },
  stepLineActive: {
    backgroundColor: HEADER_COLOR,
  },
  stepContent: {
    width: '100%',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: scaleHeight(20),
  },
  iconText: {
    fontSize: scaleFont(48),
  },
  sectionTitle: {
    fontSize: scaleFont(24),
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: scaleHeight(12),
  },
  description: {
    fontSize: scaleFont(14),
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: scaleHeight(30),
    lineHeight: scaleFont(20),
    paddingHorizontal: scaleWidth(10),
  },
  emailHighlight: {
    color: HEADER_COLOR,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: scaleHeight(20),
  },
  label: {
    fontSize: scaleFont(15),
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: scaleHeight(8),
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    borderRadius: scaleWidth(12),
    paddingVertical: scaleHeight(16),
    paddingHorizontal: scaleWidth(18),
    paddingRight: scaleWidth(50), // Space for eye icon
    fontSize: scaleFont(16),
    backgroundColor: WHITE,
    color: colors.textPrimary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    flex: 1,
  },
  otpInput: {
    fontSize: scaleFont(28),
    fontWeight: '700',
    letterSpacing: scaleWidth(8),
    paddingVertical: scaleHeight(20),
  },
  hintText: {
    fontSize: scaleFont(12),
    color: colors.textSecondary,
    marginTop: scaleHeight(6),
    fontStyle: 'italic',
  },
  passwordContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyeIconWrapper: {
    position: 'absolute',
    right: scaleWidth(15),
    padding: scaleWidth(5),
    zIndex: 1,
  },
  eyeIcon: {
    width: scaleWidth(24),
    height: scaleWidth(24),
    tintColor: colors.textSecondary,
  },
  passwordStrengthContainer: {
    marginTop: scaleHeight(10),
    paddingVertical: scaleHeight(8),
    paddingHorizontal: scaleWidth(12),
    backgroundColor: colors.backgroundLight || '#F8F9FD',
    borderRadius: scaleWidth(8),
  },
  strengthRow: {
    marginVertical: scaleHeight(4),
  },
  strengthText: {
    fontSize: scaleFont(12),
    color: colors.textSecondary,
  },
  strengthTextCompleted: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  button: {
    backgroundColor: HEADER_COLOR,
    paddingVertical: scaleHeight(16),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scaleHeight(10),
    minHeight: scaleHeight(52),
    shadowColor: HEADER_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: scaleFont(17),
    fontWeight: '700',
    color: WHITE,
    letterSpacing: 0.5,
  },
  resendButton: {
    marginTop: scaleHeight(20),
    alignItems: 'center',
    paddingVertical: scaleHeight(10),
  },
  resendText: {
    fontSize: scaleFont(15),
    color: HEADER_COLOR,
    fontWeight: '600',
  },
  backToLoginButton: {
    marginTop: scaleHeight(30),
    alignItems: 'center',
    paddingVertical: scaleHeight(12),
  },
  backToLogin: {
    textAlign: 'center',
    fontSize: scaleFont(15),
    color: colors.textSecondary,
  },
  backArrow: {
    fontSize: scaleFont(18),
    color: colors.textSecondary,
  },
});