import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthScreenLayout from '../../components/auth/AuthScreenLayout';
import AuthButton from '../../components/auth/AuthButton';
import AuthFeedback from '../../components/auth/AuthFeedback';
import { authStyles, theme } from '../../config/theme';
import apiService from '../../services/apiService';
import { useAuth } from '../../context/AuthContext';

const Login = ({ navigation }) => {
  const { login } = useAuth();
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

  const showFeedback = (message, tone = 'error') => {
    setFeedback(message);
    setFeedbackTone(tone);
  };

  const clearFeedback = () => setFeedback('');

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

    // Only patient users have /patients/me/latest-vitals access.
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

  const handleLogin = async () => {
    clearFeedback();

    if (!username.trim()) {
      showFeedback('Please enter your email address or username.');
      return;
    }
    if (!password.trim()) {
      showFeedback('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const data = await apiService.login(username, password, rememberMe);

      if (data.requires_otp) {
        setShowOtp(true);
        showFeedback('Enter the verification code sent to you.', 'success');
        return;
      }

      await persistUserSession(data);
      login(); // sets isLoggedIn=true → AppNavigator swaps to AppStack automatically
    } catch (error) {
      let errorMessage = error.message || 'Login failed. Please try again.';
      if (error.message?.includes('timeout') || error.message?.includes('connect')) {
        errorMessage =
          'Cannot connect to server. Please check your internet connection and try again.';
      }
      showFeedback(errorMessage);
    } finally {
      setIsLoading(false);
    }
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
      await persistUserSession(data);
      login(); // sets isLoggedIn=true → AppNavigator swaps to AppStack automatically
    } catch (error) {
      showFeedback(error.message || 'Invalid OTP code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthScreenLayout>
      <Text style={authStyles.title}>Welcome back to connected care.</Text>
      <Text style={authStyles.subheading}>
        Sign in to review patient readings, care activity, alerts, and team follow-ups.
      </Text>

      {showOtp ? (
        <>
          <View style={authStyles.field}>
            <Text style={authStyles.label}>OTP Code</Text>
            <TextInput
              style={[authStyles.input, authStyles.inputFocused]}
              placeholder="Enter OTP code"
              placeholderTextColor={theme.placeholder}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              editable={!isLoading}
              autoFocus
            />
          </View>

          <AuthFeedback message={feedback} tone={feedbackTone} />
          <AuthButton
            label="Verify OTP"
            onPress={handleVerifyOtp}
            loading={isLoading}
          />

          <TouchableOpacity
            onPress={() => {
              setShowOtp(false);
              setOtp('');
              clearFeedback();
            }}
            style={{ marginTop: 14, alignItems: 'center' }}
          >
            <Text style={authStyles.linkText}>Back to Login</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={authStyles.field}>
            <Text style={authStyles.label}>Email or Username</Text>
            <TextInput
              style={[authStyles.input, isUsernameFocused && authStyles.inputFocused]}
              placeholder="name@practice.com or username"
              placeholderTextColor={theme.placeholder}
              value={username}
              onChangeText={setUsername}
              onFocus={() => setIsUsernameFocused(true)}
              onBlur={() => setIsUsernameFocused(false)}
              autoCapitalize="none"
              keyboardType="default"
              autoCorrect={false}
              textContentType="username"
              autoComplete="username"
              editable={!isLoading}
            />
          </View>

          <View style={authStyles.field}>
            <Text style={authStyles.label}>Password</Text>
            <View style={authStyles.passwordWrap}>
              <TextInput
                style={[
                  authStyles.input,
                  authStyles.passwordInput,
                  isPasswordFocused && authStyles.inputFocused,
                ]}
                placeholder="Enter password"
                placeholderTextColor={theme.placeholder}
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
                style={authStyles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Image
                  source={
                    showPassword
                      ? require('../../assets/images/batch_04/eye-open.png')
                      : require('../../assets/images/batch_04/eye-close.png')
                  }
                  style={authStyles.eyeIcon}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={authStyles.formRow}>
            <TouchableOpacity
              style={authStyles.rememberRow}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  authStyles.checkbox,
                  rememberMe && authStyles.checkboxChecked,
                ]}
              >
                {rememberMe ? <Text style={authStyles.checkmark}>✓</Text> : null}
              </View>
              <Text style={authStyles.rememberText}>Remember me</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={authStyles.linkText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          <AuthFeedback message={feedback} tone={feedbackTone} />
          <AuthButton label="Sign In" onPress={handleLogin} loading={isLoading} />

          <Text style={authStyles.finePrint}>
            HIPAA-conscious access for remote patient monitoring teams.
          </Text>
        </>
      )}
    </AuthScreenLayout>
  );
};

export default Login;
