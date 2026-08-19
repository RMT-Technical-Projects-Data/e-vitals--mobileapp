import React, { useEffect, useState } from 'react';
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
import Svg, { Path } from 'react-native-svg';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../services/apiService';
import { useAuth } from '../../context/AuthContext';
import { unlockAllOrientations, lockToLandscape } from '../../utils/orientationHelper';

const HERO_IMAGE = require('../../assets/images/tablet-login-background.jpeg');
const LOGO_IMAGE = require('../../assets/images/batch_06/logo5.png');
const EYE_OPEN = require('../../assets/images/batch_04/eye-open.png');
const EYE_CLOSED = require('../../assets/images/batch_04/eye-close.png');

const COLORS = {
  page: '#ffffff',
  pageSoft: '#f7fafc',
  navy: '#0b1f3f',
  blue: '#1177c6',
  text: '#152033',
  muted: '#687382',
  border: '#dfe7ef',
  paper: '#ffffff',
  input: '#eef3fa',
  shadow: 'rgba(7, 27, 52, 0.16)',
  shadowSoft: 'rgba(7, 27, 52, 0.08)',
};

const TABLET_OVERLAY_COLORS = [
  'rgba(255,255,255,0.98)',
  'rgba(255,255,255,0.92)',
  'rgba(255,255,255,0.72)',
  'rgba(255,255,255,0.28)',
  'rgba(255,255,255,0.08)',
  'rgba(255,255,255,0)',
  'rgba(255,255,255,0.18)',
  'rgba(255,255,255,0.55)',
  'rgba(255,255,255,0.82)',
  'rgba(255,255,255,0.95)',
];
const TABLET_OVERLAY_LOCATIONS = [0, 0.12, 0.22, 0.34, 0.44, 0.52, 0.62, 0.72, 0.82, 1];

const MOBILE_FEATURES = [
  {
    icon: 'verified-user',
    title: 'Real-time Monitoring',
    copy: 'Track vital signs in real time.',
    tint: '#0f7bcf',
    background: 'rgba(15, 123, 207, 0.10)',
  },
  {
    icon: 'notifications-active',
    title: 'Instant Alerts',
    copy: 'Get notified instantly.',
    tint: '#1b1f8a',
    background: 'rgba(27, 31, 138, 0.08)',
  },
  {
    icon: 'groups',
    title: 'Care Connected',
    copy: 'Your health, your team, always in sync.',
    tint: '#1383c9',
    background: 'rgba(19, 131, 201, 0.10)',
  },
];

const TABLET_FEATURES = [
  {
    icon: 'verified-user',
    title: 'Real-time Monitoring',
    copy: 'Track your vital signs in real time.',
    tint: '#0f7bcf',
    background: 'rgba(15, 123, 207, 0.10)',
  },
  {
    icon: 'notifications-active',
    title: 'Instant Alerts',
    copy: 'Get notified instantly when it matters.',
    tint: '#1b1f8a',
    background: 'rgba(27, 31, 138, 0.08)',
  },
  {
    icon: 'groups',
    title: 'Care Connected',
    copy: 'Your health, your team, always in sync.',
    tint: '#1383c9',
    background: 'rgba(19, 131, 201, 0.10)',
  },
];

const HeartOutline = ({ width, color = '#0077B6', opacity = 0.32 }) => (
  <Svg viewBox="0 0 500 400" width={width} height={width * 0.8} fill="none">
    <Path
      d="M250 360 C230 340 90 235 55 170 C15 95 65 45 125 45
         C175 45 215 75 250 120 C285 75 325 45 375 45
         C435 45 485 95 445 170 C410 235 270 340 250 360Z"
      stroke={color}
      strokeWidth={12}
      strokeOpacity={opacity}
    />
  </Svg>
);

const PulseLine = ({ width, height, color = '#0077B6', opacity = 0.32 }) => (
  <Svg viewBox="0 0 650 160" width={width} height={height} fill="none">
    <Path
      d="M0 85 H118 L143 85 L168 115 L198 18 L238 148 L278 85
         H318 L343 85 L373 52 L403 124 L433 85 H650"
      stroke={color}
      strokeWidth={4}
      strokeOpacity={opacity}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const WaveLines = ({ width, height, color = '#0077B6', opacity = 0.65 }) => (
  <Svg viewBox="0 0 700 300" width={width} height={height} preserveAspectRatio="none" fill="none" opacity={opacity}>
    <Path d="M0 80 C120 200 210 220 350 180 C500 130 590 60 700 0" stroke={color} strokeWidth={1.2} />
    <Path d="M0 100 C120 220 210 240 350 200 C500 150 590 80 700 20" stroke={color} strokeWidth={1.2} />
    <Path d="M0 120 C120 240 210 260 350 220 C500 170 590 100 700 40" stroke={color} strokeWidth={1.2} />
    <Path d="M0 140 C120 260 210 280 350 240 C500 190 590 120 700 60" stroke={color} strokeWidth={1.2} />
  </Svg>
);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const Login = ({ navigation }) => {
  const { login } = useAuth();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Use shortest side so large iPhones in landscape are not treated as tablets.
  const shortestSide = Math.min(width, height);
  const isLandscape = width > height;
  const isTablet = Platform.isPad || shortestSide >= 768;
  const isPhoneLandscape = !isTablet && isLandscape;
  // iPad always uses the full-bleed two-pane design (login on the right),
  // matching the tablet mockup in both portrait and landscape.
  const isLargeTablet = isTablet && width >= 1024;

  // Scale relative to iPhone 14 width (390) / iPad landscape content width.
  const mobileScale = clamp(width / 390, 0.82, 1.12);
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

  const handleLogin = async () => {
    clearFeedback();

    if (!username.trim()) {
      showFeedback('Please enter your username.');
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
      await saveRememberedUsername();
      login();
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
      await saveRememberedUsername();
      login();
    } catch (error) {
      showFeedback(error.message || 'Invalid OTP code.');
    } finally {
      setIsLoading(false);
    }
  };

  const formCardStyle = [
    styles.formCard,
    isTablet
      ? styles.formCardTablet
      : isPhoneLandscape
        ? styles.formCardPhoneLandscape
        : [styles.formCardMobile, { paddingHorizontal: ms(20), paddingTop: ms(22), paddingBottom: ms(22) }],
  ];

  const formTitleStyle = [
    styles.formTitle,
    isLargeTablet
      ? styles.formTitleLarge
      : isTablet
        ? styles.formTitleTablet
        : { fontSize: ms(28), lineHeight: ms(32) },
  ];

  const formSubtitleStyle = [
    styles.formSubtitle,
    isLargeTablet
      ? styles.formSubtitleLarge
      : isTablet
        ? styles.formSubtitleTablet
        : { fontSize: ms(15), lineHeight: ms(22) },
  ];

  const heartWidth = isTablet
    ? clamp(width * 0.32, 300, 480)
    : clamp(width * 0.52, 150, 210);
  const pulseWidth = isTablet
    ? clamp(width * 0.34, 310, 500)
    : clamp(width * 0.58, 170, 240);
  const pulseHeight = isTablet ? 130 : 58;
  const waveWidth = width * (isTablet ? 0.42 : 0.72);
  const waveHeight = height * (isTablet ? 0.28 : 0.18);

  const renderFormFields = ({ mailIconSide = 'left', showLockIcon = true } = {}) => {
    if (showOtp) {
      return (
        <>
          <View style={styles.field}>
            <Text style={styles.label}>OTP Code</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter OTP code"
              placeholderTextColor={COLORS.muted}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              editable={!isLoading}
              autoFocus
            />
          </View>

          <View style={styles.feedbackWrap}>
            {feedback ? (
              <Text style={[styles.feedbackText, feedbackTone === 'success' && styles.feedbackTextSuccess]}>
                {feedback}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity style={styles.primaryButtonWrap} onPress={handleVerifyOtp} disabled={isLoading}>
            <LinearGradient colors={['#1d1588', '#1177c6']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{isLoading ? 'Verifying...' : 'Verify OTP'}</Text>
              {!isLoading ? <MaterialIcons name="arrow-forward" size={18} color="#fff" /> : null}
            </LinearGradient>
          </TouchableOpacity>
        </>
      );
    }

    return (
      <>
        <View style={styles.field}>
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputIconWrap}>
            {mailIconSide === 'left' ? (
              <MaterialIcons name="mail-outline" size={18} color={COLORS.muted} style={styles.fieldIconLeft} />
            ) : null}
            <TextInput
              style={[
                styles.input,
                mailIconSide === 'left' ? styles.inputWithLeftIcon : styles.inputWithRightIcon,
                isUsernameFocused && styles.inputFocused,
              ]}
              placeholder="Enter your email"
              placeholderTextColor={COLORS.muted}
              value={username}
              onChangeText={setUsername}
              onFocus={() => setIsUsernameFocused(true)}
              onBlur={() => setIsUsernameFocused(false)}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              textContentType="username"
              autoComplete="username"
              editable={!isLoading}
            />
            {mailIconSide === 'right' ? (
              <MaterialIcons name="mail-outline" size={18} color={COLORS.muted} style={styles.fieldIconRight} />
            ) : null}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordWrap}>
            {showLockIcon ? (
              <MaterialIcons name="lock-outline" size={18} color={COLORS.muted} style={styles.fieldIconLeft} />
            ) : null}
            <TextInput
              style={[
                styles.input,
                showLockIcon ? styles.passwordInputWithLock : styles.passwordInput,
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

        <View style={styles.feedbackWrap}>
          {feedback ? (
            <Text style={[styles.feedbackText, feedbackTone === 'success' && styles.feedbackTextSuccess]}>
              {feedback}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity style={styles.primaryButtonWrap} onPress={handleLogin} disabled={isLoading}>
          <LinearGradient
            colors={['#1d1588', '#1177c6']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>{isLoading ? 'Signing in...' : 'Sign In'}</Text>
            {!isLoading ? <MaterialIcons name="arrow-forward" size={18} color="#fff" /> : null}
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.finePrintRow}>
          <MaterialIcons name="verified" size={14} color={COLORS.blue} />
          <Text style={styles.finePrint}>Secure. Reliable. Designed for better care.</Text>
        </View>
      </>
    );
  };

  const formCard = (options = {}) => (
    <View style={formCardStyle}>
      <Text style={formTitleStyle}>{showOtp ? 'Verify your account' : 'Welcome back!'}</Text>
      <Text style={formSubtitleStyle}>
        {showOtp
          ? 'Enter the verification code sent to you.'
          : 'Enter your credentials to access your account.'}
      </Text>
      {renderFormFields(options)}
    </View>
  );

  const renderFeatures = (features, compact = false) => (
    <View style={[styles.featuresRow, compact && styles.featuresRowCompact]}>
      {features.map(feature => (
        <View key={feature.title} style={styles.featureCard}>
          <View
            style={[
              styles.featureIconWrap,
              compact && styles.featureIconWrapCompact,
              { backgroundColor: feature.background },
            ]}
          >
            <MaterialIcons name={feature.icon} size={compact ? 18 : 22} color={feature.tint} />
          </View>
          <Text style={[styles.featureTitle, compact && styles.featureTitleCompact]}>{feature.title}</Text>
          <Text style={[styles.featureCopy, compact && styles.featureCopyCompact]}>{feature.copy}</Text>
        </View>
      ))}
    </View>
  );

  // ── iPad: two-pane layout matching Image 2 ──
  if (isTablet) {
    return (
      <View style={[styles.screenRoot, { width, height }]}>
        <ImageBackground source={HERO_IMAGE} style={styles.tabletBgFill} resizeMode="cover">
          <LinearGradient
            colors={TABLET_OVERLAY_COLORS}
            locations={TABLET_OVERLAY_LOCATIONS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.tabletDecorLayer} pointerEvents="none">
            <View style={styles.tabletHeartWrap}>
              <HeartOutline width={heartWidth} opacity={0.42} />
            </View>
            <View style={styles.tabletPulseWrap}>
              <PulseLine width={pulseWidth} height={pulseHeight} opacity={0.55} />
            </View>
            <View style={styles.tabletWaveWrap}>
              <WaveLines width={waveWidth} height={waveHeight} opacity={0.55} />
            </View>
          </View>

          <SafeAreaView style={styles.tabletSafeArea} edges={['top', 'bottom', 'left', 'right']}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
            <KeyboardAvoidingView
              style={styles.tabletKeyboardWrap}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <View style={styles.tabletRow}>
                <ScrollView
                  style={styles.tabletLeftPane}
                  contentContainerStyle={[
                    styles.tabletLeftContent,
                    isLargeTablet && styles.tabletLeftContentLarge,
                  ]}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <Image
                    source={LOGO_IMAGE}
                    resizeMode="contain"
                    style={[styles.logoTabletImage, isLargeTablet && styles.logoLarge]}
                  />

                  <View style={styles.heroTextBlock}>
                    <Text
                      style={[
                        styles.heroHeadline,
                        isLargeTablet ? styles.heroHeadlineLarge : styles.heroHeadlineTablet,
                      ]}
                    >
                      <Text style={styles.heroHeadlineDark}>Better Care.</Text>
                      {'\n'}
                      <Text style={styles.heroHeadlineBlue}>Stronger Outcomes.</Text>
                    </Text>
                    <Text style={[styles.heroCopy, styles.heroCopyTablet]}>
                      Empowering patients and care teams with intelligent, real-time remote
                      monitoring for proactive health management and continuous care. Delivering
                      peace of mind through seamless clinical connectivity.
                    </Text>
                  </View>

                  <View style={[styles.featuresRow, styles.featuresRowTablet]}>
                    {TABLET_FEATURES.map(feature => (
                      <View key={feature.title} style={styles.featureCardTablet}>
                        <View style={[styles.featureIconWrap, { backgroundColor: feature.background }]}>
                          <MaterialIcons name={feature.icon} size={24} color={feature.tint} />
                        </View>
                        <Text style={styles.featureTitle}>{feature.title}</Text>
                        <Text style={styles.featureCopy}>{feature.copy}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.securityCard}>
                    <View style={styles.securityBadge}>
                      <MaterialIcons name="lock-outline" size={18} color={COLORS.blue} />
                    </View>
                    <View style={styles.securityTextWrap}>
                      <Text style={styles.securityTitle}>Your health data is safe with us.</Text>
                      <Text style={styles.securityCopy}>
                        We use industry-leading encryption to protect your information.
                      </Text>
                    </View>
                  </View>
                </ScrollView>

                <View style={styles.tabletRightPane}>
                  <ScrollView
                    style={styles.tabletRightScroll}
                    contentContainerStyle={styles.tabletRightScrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    bounces={false}
                  >
                    {formCard({ mailIconSide: 'right', showLockIcon: false })}
                  </ScrollView>
                </View>
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </ImageBackground>
      </View>
    );
  }

  // ── Phone landscape: side-by-side compact layout ──
  if (isPhoneLandscape) {
    return (
      <View style={[styles.screenRoot, styles.phoneLandscapeRoot, { width, height }]}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
          <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.phoneLandscapeRow}>
              <ScrollView
                style={styles.phoneLandscapeLeft}
                contentContainerStyle={styles.phoneLandscapeLeftContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
                keyboardShouldPersistTaps="handled"
              >
                <Image source={LOGO_IMAGE} resizeMode="contain" style={styles.logoPhoneLandscape} />
                <Text style={styles.heroHeadlinePhoneLandscape}>
                  <Text style={styles.heroHeadlineDark}>Better Care.</Text>
                  {'\n'}
                  <Text style={styles.heroHeadlineBlue}>Stronger Outcomes.</Text>
                </Text>
                <Text style={styles.heroCopyPhoneLandscape}>
                  Empowering patients and care teams with intelligent, real-time remote monitoring.
                </Text>
                {renderFeatures(MOBILE_FEATURES, true)}
              </ScrollView>

              <ScrollView
                style={styles.phoneLandscapeRight}
                contentContainerStyle={styles.phoneLandscapeRightContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                bounces={false}
              >
                {formCard({ mailIconSide: 'left', showLockIcon: true })}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  // ── Mobile portrait: stacked layout matching the phone mockup ──
  const mobileBottomPad = Math.max(insets.bottom, ms(12)) + ms(44);
  const mobileHeroW = ms(238);
  const mobileHeroH = ms(256);
  const mobileHeartW = clamp(width * 0.5, 168, 214);
  const mobilePulseW = clamp(width * 0.54, 180, 228);
  const mobilePulseH = ms(62);

  return (
    <View style={[styles.screenRoot, styles.mobileRoot]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.mobileScrollContentPhone,
              {
                paddingHorizontal: ms(20),
                paddingBottom: mobileBottomPad,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            bounces
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            <View style={[styles.mobileShell, { maxWidth: 430 }]}>
              <View style={styles.mobileDecor} pointerEvents="none">
                <View
                  style={[
                    styles.mobileHeroZone,
                    { width: mobileHeroW, height: mobileHeroH, top: ms(2), right: ms(-22) },
                  ]}
                >
                  <Image
                    source={HERO_IMAGE}
                    resizeMode="cover"
                    style={styles.mobileHeroImageFill}
                  />
                  <LinearGradient
                    colors={[
                      'rgba(255,255,255,1)',
                      'rgba(255,255,255,0.92)',
                      'rgba(255,255,255,0.45)',
                      'rgba(255,255,255,0)',
                    ]}
                    locations={[0, 0.22, 0.48, 0.72]}
                    start={{ x: 0, y: 0.45 }}
                    end={{ x: 1, y: 0.55 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <LinearGradient
                    colors={[
                      'rgba(255,255,255,0)',
                      'rgba(255,255,255,0.35)',
                      'rgba(255,255,255,0.82)',
                      'rgba(255,255,255,1)',
                    ]}
                    locations={[0, 0.45, 0.78, 1]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <LinearGradient
                    colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 0.3 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.mobileHeartOverlay}>
                    <HeartOutline width={mobileHeartW} opacity={0.4} />
                  </View>
                  <View style={[styles.mobilePulseOverlay, { top: ms(72), left: ms(-12) }]}>
                    <PulseLine width={mobilePulseW} height={mobilePulseH} opacity={0.52} />
                  </View>
                </View>
                <View style={styles.mobileWaveWrap}>
                  <WaveLines width={waveWidth} height={waveHeight} opacity={0.55} />
                </View>
              </View>

              <Image
                source={LOGO_IMAGE}
                resizeMode="contain"
                style={[styles.logo, { width: ms(150), height: ms(48) }]}
              />

              <View style={[styles.heroTextBlock, { marginTop: ms(18), maxWidth: ms(240) }]}>
                <Text style={[styles.heroHeadline, { fontSize: ms(34), lineHeight: ms(38) }]}>
                  <Text style={styles.heroHeadlineDark}>Better Care.</Text>
                  {'\n'}
                  <Text style={styles.heroHeadlineBlue}>Stronger Outcomes.</Text>
                </Text>
                <Text
                  style={[
                    styles.heroCopy,
                    { marginTop: ms(12), fontSize: ms(13), lineHeight: ms(20), maxWidth: ms(250) },
                  ]}
                >
                  Empowering patients and care teams with intelligent, real-time remote monitoring
                  for proactive health management and continuous care.
                </Text>
              </View>

              <View style={[styles.featuresRow, styles.featuresRowMobile, { marginTop: ms(22) }]}>
                {MOBILE_FEATURES.map(feature => (
                  <View key={feature.title} style={styles.featureCard}>
                    <View
                      style={[
                        styles.featureIconWrap,
                        { width: ms(44), height: ms(44), borderRadius: ms(14), backgroundColor: feature.background },
                      ]}
                    >
                      <MaterialIcons name={feature.icon} size={ms(20)} color={feature.tint} />
                    </View>
                    <Text style={[styles.featureTitle, { fontSize: ms(12), lineHeight: ms(15) }]}>
                      {feature.title}
                    </Text>
                    <Text style={[styles.featureCopy, { fontSize: ms(10), lineHeight: ms(14) }]}>
                      {feature.copy}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={[styles.mobileFormWrap, { marginTop: ms(20), marginBottom: ms(8) }]}>
                {formCard({ mailIconSide: 'left', showLockIcon: true })}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  screenRoot: {
    flex: 1,
    backgroundColor: '#f4f6f7',
  },
  mobileRoot: {
    backgroundColor: COLORS.page,
  },
  phoneLandscapeRoot: {
    backgroundColor: COLORS.page,
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },

  // ── Tablet layout ──
  tabletBgFill: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  tabletDecorLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  tabletSafeArea: {
    flex: 1,
  },
  tabletKeyboardWrap: {
    flex: 1,
  },
  tabletHeartWrap: {
    position: 'absolute',
    top: '6%',
    left: '16%',
  },
  tabletPulseWrap: {
    position: 'absolute',
    top: '20%',
    left: '16%',
  },
  tabletWaveWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
  tabletRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  tabletLeftPane: {
    width: '58%',
    maxHeight: '100%',
  },
  tabletLeftContent: {
    paddingLeft: 44,
    paddingRight: 20,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 20,
  },
  tabletLeftContentLarge: {
    paddingLeft: 56,
    paddingTop: 32,
    paddingBottom: 32,
  },
  tabletRightPane: {
    width: '42%',
    maxHeight: '100%',
    justifyContent: 'center',
    paddingRight: 44,
    paddingLeft: 12,
  },
  tabletRightScroll: {
    flexGrow: 0,
  },
  tabletRightScrollContent: {
    justifyContent: 'center',
    paddingVertical: 16,
  },
  logoTabletImage: {
    width: 190,
    height: 62,
  },

  // ── Phone landscape ──
  phoneLandscapeRow: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  phoneLandscapeLeft: {
    flex: 1.05,
  },
  phoneLandscapeLeftContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingRight: 8,
    paddingVertical: 8,
  },
  phoneLandscapeRight: {
    flex: 0.95,
  },
  phoneLandscapeRightContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  logoPhoneLandscape: {
    width: 128,
    height: 42,
    marginBottom: 10,
  },
  heroHeadlinePhoneLandscape: {
    color: COLORS.navy,
    fontWeight: '900',
    letterSpacing: -0.4,
    fontSize: 26,
    lineHeight: 30,
  },
  heroCopyPhoneLandscape: {
    color: COLORS.muted,
    fontWeight: '500',
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    maxWidth: 280,
    marginBottom: 12,
  },

  // ── iPhone portrait scroll ──
  mobileScrollContentPhone: {
    paddingTop: 8,
  },
  mobileScrollContent: {
    flexGrow: 1,
    paddingTop: 8,
    paddingBottom: 28,
  },
  tabletPortraitScrollContent: {
    paddingTop: 20,
    paddingBottom: 36,
    justifyContent: 'center',
  },
  mobileShell: {
    width: '100%',
    alignSelf: 'center',
    position: 'relative',
  },
  mobileDecor: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  mobileHeroZone: {
    position: 'absolute',
    overflow: 'visible',
    zIndex: 0,
  },
  mobileHeroImageFill: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  mobileHeartOverlay: {
    position: 'absolute',
    top: 6,
    left: -8,
    zIndex: 3,
  },
  mobilePulseOverlay: {
    position: 'absolute',
    zIndex: 3,
  },
  mobileHeartWrap: {
    position: 'absolute',
    top: 8,
    right: -10,
    opacity: 0.9,
  },
  mobileHeartWrapTablet: {
    top: 20,
    right: 40,
  },
  mobilePulseWrap: {
    position: 'absolute',
    top: 78,
    right: -4,
  },
  mobilePulseWrapTablet: {
    top: 110,
    right: 50,
  },
  mobileHeroImage: {
    position: 'absolute',
    top: 0,
    right: -8,
    opacity: 0.92,
  },
  mobileHeroImageTablet: {
    right: 12,
    borderRadius: 24,
  },
  mobileHeroFade: {
    position: 'absolute',
    top: 0,
    right: -8,
  },
  mobileWaveWrap: {
    position: 'absolute',
    left: -20,
    bottom: -10,
  },
  mobileFormWrap: {
    zIndex: 2,
  },

  logo: {
    zIndex: 2,
  },
  logoTablet: {
    width: 190,
    height: 62,
  },
  logoLarge: {
    width: 214,
    height: 68,
  },
  logoTabletPortrait: {
    width: 180,
    height: 58,
  },
  heroTextBlock: {
    zIndex: 2,
  },
  heroHeadline: {
    color: COLORS.navy,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  heroHeadlineDark: {
    color: COLORS.navy,
  },
  heroHeadlineBlue: {
    color: COLORS.blue,
  },
  heroHeadlineTablet: {
    fontSize: 46,
    lineHeight: 48,
    maxWidth: 430,
  },
  heroHeadlineLarge: {
    fontSize: 54,
    lineHeight: 56,
    maxWidth: 500,
  },
  heroHeadlineTabletPortrait: {
    fontSize: 42,
    lineHeight: 46,
  },
  heroCopy: {
    color: COLORS.muted,
    fontWeight: '500',
  },
  heroCopyTablet: {
    marginTop: 16,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 430,
  },
  heroCopyTabletPortrait: {
    marginTop: 14,
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 420,
  },
  featuresRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    zIndex: 2,
  },
  featuresRowCompact: {
    gap: 6,
  },
  featuresRowMobile: {
    alignItems: 'flex-start',
  },
  featuresRowTablet: {
    marginTop: 32,
    maxWidth: 500,
    justifyContent: 'flex-start',
    gap: 32,
  },
  featureCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 4,
  },
  featureCardTablet: {
    flex: 0,
    width: 132,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  featureIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  featureIconWrapCompact: {
    width: 36,
    height: 36,
    borderRadius: 12,
    marginBottom: 6,
  },
  featureIconWrapTabletPortrait: {
    width: 48,
    height: 48,
    borderRadius: 15,
  },
  featureTitle: {
    color: COLORS.navy,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  featureTitleCompact: {
    fontSize: 11,
    lineHeight: 14,
  },
  featureCopy: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
  featureCopyCompact: {
    fontSize: 10,
    lineHeight: 13,
  },
  securityCard: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(99, 127, 167, 0.12)',
    alignSelf: 'flex-start',
    maxWidth: 440,
    shadowColor: COLORS.shadowSoft,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 3,
  },
  securityCardPortrait: {
    marginTop: 22,
    alignSelf: 'stretch',
    maxWidth: '100%',
    backgroundColor: '#fff',
    shadowColor: COLORS.shadowSoft,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
  },
  securityBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17, 119, 198, 0.10)',
  },
  securityTextWrap: {
    flex: 1,
  },
  securityTitle: {
    color: COLORS.navy,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  securityCopy: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    marginTop: 2,
  },
  formCard: {
    width: '100%',
    alignSelf: 'center',
    backgroundColor: COLORS.paper,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(223, 231, 239, 0.95)',
    shadowColor: COLORS.shadowSoft,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 22,
    elevation: 8,
  },
  formCardMobile: {
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 22,
  },
  formCardTablet: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'flex-end',
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 28,
    borderRadius: 32,
  },
  formCardTabletCompact: {
    maxWidth: 400,
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 22,
  },
  formCardPhoneLandscape: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    borderRadius: 22,
  },
  formTitle: {
    color: COLORS.navy,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  formTitleTablet: {
    fontSize: 28,
    lineHeight: 32,
  },
  formTitleLarge: {
    fontSize: 30,
    lineHeight: 34,
  },
  formSubtitle: {
    color: COLORS.muted,
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 8,
    marginBottom: 18,
  },
  formSubtitleTablet: {
    fontSize: 15,
    lineHeight: 22,
  },
  formSubtitleLarge: {
    fontSize: 16,
    lineHeight: 24,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    color: '#3f4754',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    color: COLORS.text,
    backgroundColor: COLORS.input,
    fontSize: 16,
    fontWeight: '600',
  },
  inputFocused: {
    borderColor: 'rgba(17, 119, 198, 0.55)',
    backgroundColor: '#ffffff',
  },
  inputIconWrap: {
    position: 'relative',
  },
  inputWithLeftIcon: {
    paddingLeft: 44,
    paddingRight: 16,
  },
  inputWithRightIcon: {
    paddingRight: 44,
  },
  fieldIconRight: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  fieldIconLeft: {
    position: 'absolute',
    left: 16,
    top: 16,
    zIndex: 1,
  },
  passwordWrap: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 48,
  },
  passwordInputWithLock: {
    paddingLeft: 44,
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    top: 16,
  },
  eyeIcon: {
    width: 18,
    height: 18,
    tintColor: COLORS.muted,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    marginTop: 2,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.4,
    borderColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: COLORS.navy,
  },
  checkmark: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 12,
  },
  rememberText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  linkText: {
    color: COLORS.blue,
    fontSize: 12,
    fontWeight: '800',
  },
  feedbackWrap: {
    minHeight: 18,
    marginBottom: 12,
  },
  feedbackText: {
    color: '#b91427',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
    textAlign: 'center',
  },
  feedbackTextSuccess: {
    color: COLORS.navy,
  },
  primaryButtonWrap: {
    borderRadius: 27,
    overflow: 'hidden',
    shadowColor: 'rgba(7, 27, 52, 0.20)',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 8,
    marginTop: 4,
  },
  primaryButton: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  finePrintRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  finePrint: {
    color: '#7a8491',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    textAlign: 'center',
  },
});

export default Login;
