import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import AuthScreenLayout from '../../components/auth/AuthScreenLayout';
import AuthButton from '../../components/auth/AuthButton';
import AuthFeedback from '../../components/auth/AuthFeedback';
import { authStyles, theme } from '../../config/theme';
import apiService from '../../services/apiService';

const ForgotPassword = ({ navigation }) => {
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

  const showMessage = (message, tone = 'error') => {
    setFeedback(message);
    setFeedbackTone(tone);
  };

  const clearMessage = () => setFeedback('');

  const validateEmail = value => /\S+@\S+\.\S+/.test(value);

  const getPasswordStrength = password => {
    const trimmedPassword = password.trim();
    return {
      hasMinLength: trimmedPassword.length >= 7,
      hasLetter: /[a-zA-Z]/.test(trimmedPassword),
      hasNumber: /[0-9]/.test(trimmedPassword),
      isAlphanumericOnly: /^[a-zA-Z0-9]+$/.test(trimmedPassword),
      hasUppercase: /[A-Z]/.test(trimmedPassword),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(trimmedPassword),
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

      if (error.message?.includes('not available on this server')) {
        errorMessage =
          'The OTP endpoint is not available on this server. Please contact your administrator.';
      } else if (error.message?.includes('not found')) {
        errorMessage =
          'The forgot password endpoint is not available. Please contact support.';
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

    if (trimmedNewPassword.length < 7) {
      showMessage('Password must be at least 7 characters long.');
      return;
    }

    if (!strength.hasLetter || !strength.hasNumber) {
      showMessage('Password must contain both letters and numbers.');
      return;
    }

    if (!strength.isAlphanumericOnly) {
      showMessage('Password can only contain letters and numbers.');
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
    <View style={authStyles.stepIndicator}>
      <View style={[authStyles.stepDot, step >= 1 && authStyles.stepDotActive]} />
      <View style={[authStyles.stepLine, step >= 2 && authStyles.stepLineActive]} />
      <View style={[authStyles.stepDot, step >= 2 && authStyles.stepDotActive]} />
      <View style={[authStyles.stepLine, step >= 3 && authStyles.stepLineActive]} />
      <View style={[authStyles.stepDot, step >= 3 && authStyles.stepDotActive]} />
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
    <View style={authStyles.field}>
      <Text style={authStyles.label}>{label}</Text>
      <View style={authStyles.passwordWrap}>
        <TextInput
          style={[
            authStyles.input,
            authStyles.passwordInput,
            focused && authStyles.inputFocused,
          ]}
          placeholder={placeholder}
          placeholderTextColor={theme.placeholder}
          secureTextEntry={!showPassword}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          editable={!isLoading}
        />
        <TouchableOpacity
          style={authStyles.eyeButton}
          onPress={onToggle}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Image
            source={
              showPassword
                ? require('../../assets/images/eye-open.png')
                : require('../../assets/images/eye-close.png')
            }
            style={authStyles.eyeIcon}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <AuthScreenLayout
      onBack={() => navigation.goBack()}
      showLogo={false}
      headerTitle="Forgot Password"
    >
      {renderStepIndicator()}

      {step === 1 && (
        <>
          <Text style={authStyles.eyebrow}>Account Recovery</Text>
          <Text style={authStyles.title}>Reset your password.</Text>
          <Text style={authStyles.subheading}>
            Enter your email and we will send a one-time code to verify your account.
          </Text>

          <View style={authStyles.field}>
            <Text style={authStyles.label}>Email Address</Text>
            <TextInput
              style={[authStyles.input, emailFocused && authStyles.inputFocused]}
              placeholder="name@practice.com"
              placeholderTextColor={theme.placeholder}
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

          <AuthFeedback message={feedback} tone={feedbackTone} />
          <AuthButton label="Send OTP" onPress={handleNext} loading={isLoading} />
        </>
      )}

      {step === 2 && (
        <>
          <Text style={authStyles.eyebrow}>Verification</Text>
          <Text style={authStyles.title}>Enter your OTP code.</Text>
          <Text style={authStyles.subheading}>
            We sent a 6-digit code to{' '}
            <Text style={authStyles.emailHighlight}>{email}</Text>
          </Text>

          <View style={authStyles.field}>
            <Text style={authStyles.label}>OTP Code</Text>
            <TextInput
              style={[
                authStyles.input,
                authStyles.otpInput,
                otpFocused && authStyles.inputFocused,
              ]}
              placeholder="000000"
              placeholderTextColor={theme.placeholder}
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

          <AuthFeedback message={feedback} tone={feedbackTone} />
          <AuthButton label="Verify OTP" onPress={handleOtpVerify} loading={isLoading} />

          <TouchableOpacity
            onPress={() => {
              setOtp('');
              setStep(1);
              clearMessage();
            }}
            style={{ marginTop: 14, alignItems: 'center' }}
          >
            <Text style={authStyles.linkText}>Resend OTP</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 3 && (
        <>
          <Text style={authStyles.eyebrow}>New Password</Text>
          <Text style={authStyles.title}>Create a secure password.</Text>
          <Text style={authStyles.subheading}>
            Use at least 7 characters with letters and numbers only.
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
            placeholder: 'New password',
          })}

          <View style={authStyles.strengthBox}>
            <Text
              style={[
                authStyles.strengthText,
                passwordStrength.hasMinLength && authStyles.strengthTextDone,
              ]}
            >
              {passwordStrength.hasMinLength ? '✓' : '○'} At least 7 characters
            </Text>
            <Text
              style={[
                authStyles.strengthText,
                passwordStrength.hasLetter && authStyles.strengthTextDone,
              ]}
            >
              {passwordStrength.hasLetter ? '✓' : '○'} Contains letters
            </Text>
            <Text
              style={[
                authStyles.strengthText,
                passwordStrength.hasNumber && authStyles.strengthTextDone,
              ]}
            >
              {passwordStrength.hasNumber ? '✓' : '○'} Contains numbers
            </Text>
            <Text
              style={[
                authStyles.strengthText,
                passwordStrength.isAlphanumericOnly &&
                !passwordStrength.hasSpecialChar &&
                authStyles.strengthTextDone,
                passwordStrength.hasSpecialChar && authStyles.strengthTextError,
              ]}
            >
              {passwordStrength.isAlphanumericOnly && !passwordStrength.hasSpecialChar
                ? '✓'
                : passwordStrength.hasSpecialChar
                  ? '✗'
                  : '○'}{' '}
              Only letters and numbers
            </Text>
          </View>

          {renderPasswordField({
            label: 'Confirm Password',
            value: confirmPassword,
            onChangeText: setConfirmPassword,
            showPassword: showConfirmPassword,
            onToggle: () => setShowConfirmPassword(!showConfirmPassword),
            focused: confirmPasswordFocused,
            onFocus: () => setConfirmPasswordFocused(true),
            onBlur: () => setConfirmPasswordFocused(false),
            placeholder: 'Confirm new password',
          })}

          <AuthFeedback message={feedback} tone={feedbackTone} />
          <AuthButton
            label="Reset Password"
            onPress={handlePasswordReset}
            loading={isLoading}
          />
        </>
      )}

      <TouchableOpacity
        onPress={() => navigation.navigate('Login')}
        style={{ marginTop: 18, alignItems: 'center' }}
      >
        <Text style={authStyles.mutedLink}>← Back to Login</Text>
      </TouchableOpacity>

      <Text style={authStyles.finePrint}>
        HIPAA-conscious access for remote patient monitoring teams.
      </Text>
    </AuthScreenLayout>
  );
};

export default ForgotPassword;
