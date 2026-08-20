import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform, 
  Dimensions,
  StatusBar,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../config/globall';
import apiService from '../../services/apiService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateSavedPassword } from '../../services/biometricAuth';

const { width, height } = Dimensions.get('window');

// Set base design sizes for responsive scaling
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

// Functions to make design responsive
const scaleWidth = size => (width / guidelineBaseWidth) * size;
const scaleHeight = size => (height / guidelineBaseHeight) * size;
const scaleFont = size => scaleWidth(size);

// Define colors for UI
const HEADER_COLOR = colors.primaryButton || '#dae2f7';
const WHITE = '#FFFFFF';

export default function ChangePassword({ navigation }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Password strength validation (matches backend validation for role_id 6 - Patient)
  // Backend regex: /^(?=.*\d)(?=.*[a-zA-Z])[a-zA-Z0-9]{7,}$/
  // This means: at least 7 chars, contains letter, contains number, only alphanumeric
  const getPasswordStrength = (password) => {
    const trimmedPassword = password.trim();
    return {
      hasMinLength: trimmedPassword.length >= 8,
      hasLetter: /[a-zA-Z]/.test(trimmedPassword),
      hasNumber: /[0-9]/.test(trimmedPassword),
      isAlphanumericOnly: /^[a-zA-Z0-9]+$/.test(trimmedPassword), // Only letters and numbers, no special chars
      hasUppercase: /[A-Z]/.test(trimmedPassword),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(trimmedPassword),
    };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  const onSave = async () => {
    if (!currentPassword.trim()) {
      Alert.alert('Error', 'Please enter your current password.');
      return;
    }

    // Trim passwords to avoid whitespace issues
    const trimmedNewPassword = newPassword.trim();
    const trimmedConfirmPassword = confirmPassword.trim();

    // Validate password strength (must match backend validation)
    const strength = getPasswordStrength(trimmedNewPassword);
    
    // Check minimum 8 characters
    if (trimmedNewPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long.');
      return;
    }
    // Check for standard complexity requirements
    if (!strength.hasUppercase) {
      Alert.alert('Weak Password', 'Password must contain at least one uppercase letter.');
      return;
    }

    if (!strength.hasLowercase) {
      Alert.alert('Weak Password', 'Password must contain at least one lowercase letter.');
      return;
    }

    if (!strength.hasNumber) {
      Alert.alert('Weak Password', 'Password must contain at least one number.');
      return;
    }

    if (!strength.hasSpecialChar) {
      Alert.alert('Weak Password', 'Password must contain at least one special character (!@#$%^&*).');
      return;
    }

    // Compare passwords
    if (trimmedNewPassword !== trimmedConfirmPassword) {
      Alert.alert('Error', 'New password and confirm password do not match.');
      return;
    }

    setIsLoading(true);
    try {
      // Send trimmed password to backend
      const result = await apiService.changePassword(currentPassword.trim(), trimmedNewPassword);
      
      if (result && result.success) {
        try {
          const userStr = await AsyncStorage.getItem('user');
          const user = userStr ? JSON.parse(userStr) : null;
          await updateSavedPassword(user?.email || user?.username, trimmedNewPassword);
        } catch (biometricError) {
          console.warn('Could not update Face ID credentials:', biometricError.message);
        }
        Alert.alert('Success', 'Password changed successfully!', [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]);
      } else {
        Alert.alert('Error', result?.message || 'Failed to change password.');
      }
    } catch (error) {
      console.error('❌ Error changing password:', error);
      Alert.alert('Error', error.message || 'Failed to change password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.fullScreenContainer}>
        {/* Status Bar */}
        {/* <StatusBar backgroundColor={HEADER_COLOR} barStyle="light-content" /> */}
        <StatusBar barStyle="default" />

        
        <View style={styles.mainContainer}>
          {/* Header with Back Button */}
          <View style={styles.topDarkSection}>
            <View style={styles.headerRow}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.backButtonText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Change Password</Text>
              <View style={styles.headerSpacer} />
            </View>
          </View>

          {/* White section (Body section) */}
          <View style={styles.bottomLightSection}>
            <KeyboardAvoidingView
              style={styles.keyboardContainer}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <ScrollView 
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.formContainer}>
                  <Text style={styles.label}>Current Password</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter password"
                      secureTextEntry={!showCurrentPassword}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      placeholderTextColor={colors.textSecondary}
                      editable={!isLoading}
                    />
                    <TouchableOpacity
                      style={styles.eyeIconWrapper}
                      onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      <Image
                        source={
                          showCurrentPassword
                            ? require('../../assets/images/batch_04/eye-open.png')
                            : require('../../assets/images/batch_04/eye-close.png')
                        }
                        style={styles.eyeIcon}
                      />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.label}>New Password</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter password"
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
                            ? require('../../assets/images/batch_04/eye-open.png')
                            : require('../../assets/images/batch_04/eye-close.png')
                        }
                        style={styles.eyeIcon}
                      />
                    </TouchableOpacity>
                  </View>
                  {/* Password Strength Indicators */}
                  {newPassword.length > 0 && (
                    <View style={styles.passwordStrengthContainer}>
                      <View style={styles.strengthRow}>
                        <Text style={[styles.strengthText, passwordStrength.hasMinLength && styles.strengthTextCompleted]}>
                          {passwordStrength.hasMinLength ? '✓' : '○'} At least 8 characters
                        </Text>
                      </View>
                      <View style={styles.strengthRow}>
                        <Text style={[styles.strengthText, passwordStrength.hasUppercase && styles.strengthTextCompleted]}>
                          {passwordStrength.hasUppercase ? '✓' : '○'} Contains uppercase letter
                        </Text>
                      </View>
                      <View style={styles.strengthRow}>
                        <Text style={[styles.strengthText, passwordStrength.hasLowercase && styles.strengthTextCompleted]}>
                          {passwordStrength.hasLowercase ? '✓' : '○'} Contains lowercase letter
                        </Text>
                      </View>
                      <View style={styles.strengthRow}>
                        <Text style={[styles.strengthText, passwordStrength.hasNumber && styles.strengthTextCompleted]}>
                          {passwordStrength.hasNumber ? '✓' : '○'} Contains numbers
                        </Text>
                      </View>
                      <View style={styles.strengthRow}>
                        <Text style={[styles.strengthText, passwordStrength.hasSpecialChar && styles.strengthTextCompleted]}>
                          {passwordStrength.hasSpecialChar ? '✓' : '○'} Contains special character
                        </Text>
                      </View>
                    </View>
                  )}

                  <Text style={styles.label}>Confirm New Password</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter password"
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
                            ? require('../../assets/images/batch_04/eye-open.png')
                            : require('../../assets/images/batch_04/eye-close.png')
                        }
                        style={styles.eyeIcon}
                      />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity 
                    style={[styles.saveButton, isLoading && styles.buttonDisabled]} 
                    onPress={onSave}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color={WHITE} />
                    ) : (
                      <Text style={styles.saveButtonText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

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

  // --- Header Styles ---
  topDarkSection: {
    backgroundColor: HEADER_COLOR,
    height: scaleHeight(120),
    borderBottomLeftRadius: scaleWidth(35),
    borderBottomRightRadius: scaleWidth(35),
    paddingBottom: scaleHeight(10),
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
  minHeight: 55, // Removed scaleHeight
  minWidth: 55, // Removed scaleWidth
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
        fontFamily: 'sans-serif-condensed', // Android system font
      },
    }),
    },
    headerSpacer: {
      width: scaleWidth(36),
    },

  // --- Body Styles ---
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: scaleHeight(40),
  },
  formContainer: {
    paddingHorizontal: scaleWidth(20),
    paddingTop: scaleHeight(10),
  },

  // --- Form Styles ---
  label: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: scaleHeight(8),
    marginTop: scaleHeight(15),
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    borderRadius: scaleWidth(12),
    paddingVertical: scaleHeight(16),
    paddingHorizontal: scaleWidth(18),
    paddingRight: scaleWidth(50), // Space for eye icon
    marginBottom: scaleHeight(5),
    fontSize: scaleFont(16),
    backgroundColor: WHITE,
    color: colors.textPrimary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    flex: 1,
    fontFamily: Platform.select({ android: 'sans-serif', ios: undefined }),
    letterSpacing: 0,
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
    marginBottom: scaleHeight(10),
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
  strengthTextError: {
    color: '#F44336',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: HEADER_COLOR,
    paddingVertical: scaleHeight(16),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scaleHeight(30),
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
  saveButtonText: {
    fontSize: scaleFont(18),
    fontWeight: '700',
    color: WHITE,
  },
});