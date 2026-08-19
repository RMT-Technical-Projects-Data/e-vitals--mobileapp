import React from 'react';
import {
  View,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  TouchableOpacity,
  Text,
  Keyboard,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { authStyles, theme } from '../../config/theme';

const TABLET_BREAKPOINT = 768;
const tabletHighlights = [
  'Clinical review at a glance',
  'Less clutter, faster navigation',
  'Secure access to patient workflows',
];

const AuthScreenLayout = ({
  children,
  showLogo = true,
  headerTitle,
  onBack,
  scrollEnabled = true,
  compact = false,
  showBackButton = true,
}) => {
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  const isWideTablet = width >= 900;
  const showCardLogo = showLogo && !isTablet;
  const hasCardHeader = Boolean(onBack || showCardLogo || headerTitle);
  const tabletCardMaxWidth = isWideTablet
    ? Math.min(520, Math.max(440, width * 0.34))
    : Math.min(520, Math.max(400, width * 0.84));
  const tabletShellStyle = [
    styles.tabletShell,
    !isWideTablet && styles.tabletShellStack,
    {
      padding: isWideTablet ? 24 : 18,
      gap: isWideTablet ? 20 : 16,
    },
  ];
  const tabletPromoPaneStyle = [
    styles.tabletPromoPane,
    !isWideTablet && styles.tabletPromoPaneStack,
    isWideTablet
      ? { flex: 1.18 }
      : {
          minHeight: Math.max(280, Math.min(360, width * 0.32)),
        },
  ];
  const tabletFormPaneStyle = [
    styles.tabletFormPane,
    !isWideTablet && styles.tabletFormPaneStack,
    isWideTablet ? { flex: 0.82 } : { width: '100%' },
  ];
  const tabletScrollContentStyle = [
    styles.tabletScrollContent,
    {
      paddingVertical: isWideTablet ? 20 : 16,
      paddingHorizontal: isWideTablet ? 8 : 0,
    },
  ];
  const tabletPromoContentStyle = [
    styles.tabletPromoContent,
    !isWideTablet && styles.tabletPromoContentStack,
  ];
  const tabletPromoSurfaceStyle = [
    styles.tabletPromoSurface,
    {
      maxWidth: isWideTablet ? 420 : 520,
      paddingHorizontal: isWideTablet ? 26 : 22,
      paddingVertical: isWideTablet ? 26 : 22,
    },
  ];
  const tabletPromoTitleStyle = [
    styles.tabletPromoTitle,
    {
      fontSize: width >= 1200 ? 34 : width >= 1024 ? 32 : 30,
      lineHeight: width >= 1200 ? 40 : width >= 1024 ? 38 : 36,
      maxWidth: width >= 1200 ? 440 : width >= 1024 ? 420 : 380,
    },
  ];
  const tabletPromoTextStyle = [
    styles.tabletPromoText,
    {
      fontSize: width >= 1200 ? 15 : 14,
      lineHeight: width >= 1200 ? 23 : 21,
      maxWidth: width >= 1200 ? 460 : 400,
    },
  ];

  const renderCard = () => (
    <View
      style={[
        authStyles.screenCard,
        isTablet && { maxWidth: tabletCardMaxWidth },
        compact && authStyles.screenCardCompact,
      ]}
    >
      {hasCardHeader ? (
        <View style={authStyles.hero}>
          {onBack ? (
            <View style={authStyles.heroRow}>
              {showBackButton !== false ? (
                <TouchableOpacity
                  style={authStyles.backButton}
                  onPress={onBack}
                  activeOpacity={0.8}
                >
                  <Text style={authStyles.backButtonText}>‹</Text>
                </TouchableOpacity>
              ) : (
                <View style={authStyles.headerSpacer} />
              )}

              {showCardLogo ? (
                <Image
                  source={require('../../assets/images/batch_06/logo5.png')}
                  style={authStyles.logo}
                  resizeMode="contain"
                />
              ) : headerTitle ? (
                <Text style={authStyles.headerTitle} numberOfLines={1}>
                  {headerTitle}
                </Text>
              ) : (
                <View style={authStyles.backButton} />
              )}

              <View style={authStyles.headerSpacer} />
            </View>
          ) : (
            showCardLogo && (
              <Image
                source={require('../../assets/images/batch_06/logo5.png')}
                style={authStyles.logo}
                resizeMode="contain"
              />
            )
          )}
        </View>
      ) : null}

      <View style={authStyles.panel}>{children}</View>
    </View>
  );

  if (!isTablet) {
    return (
      <LinearGradient colors={theme.gradient} style={authStyles.gradient}>
        <SafeAreaView style={authStyles.safeArea} edges={['top', 'bottom']}>
          <KeyboardAvoidingView
            style={authStyles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <ScrollView
              style={authStyles.flex}
              contentContainerStyle={authStyles.scrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              bounces={false}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              scrollEnabled={scrollEnabled}
              onScrollBeginDrag={Keyboard.dismiss}
            >
              {renderCard()}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={theme.gradient} style={authStyles.gradient}>
      <SafeAreaView style={authStyles.safeArea} edges={['top', 'bottom']}>
        <View style={tabletShellStyle}>
          <LinearGradient
            colors={['#071b34', '#0d2f58', '#123e73']}
            style={tabletPromoPaneStyle}
          >
            <View style={styles.tabletPromoGlowOne} />
            <View style={styles.tabletPromoGlowTwo} />
            <View style={styles.tabletPromoOverlay} />

            <View style={tabletPromoContentStyle}>
              <View style={tabletPromoSurfaceStyle}>
                <Image
                  source={require('../../assets/images/batch_06/logo5.png')}
                  style={styles.tabletPromoLogo}
                  resizeMode="contain"
                />

                <View style={styles.tabletPromoCopy}>
                  <Text style={styles.tabletPromoEyebrow}>Clinical workspace</Text>
                  <Text style={tabletPromoTitleStyle}>Built for focused review.</Text>
                  <Text style={tabletPromoTextStyle}>
                    A calm, premium tablet layout for reviewing readings, alerts, and follow-up
                    tasks without crowding the screen.
                  </Text>
                </View>

                <View style={styles.tabletHighlights}>
                  {tabletHighlights.map(item => (
                    <View key={item} style={styles.tabletHighlightRow}>
                      <View style={styles.tabletHighlightDot} />
                      <Text style={styles.tabletHighlightText}>{item}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.tabletStatusCard}>
                  <Text style={styles.tabletStatusLabel}>Today</Text>
                  <Text style={styles.tabletStatusValue}>Patient care dashboard ready</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          <KeyboardAvoidingView
            style={tabletFormPaneStyle}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
          >
            <ScrollView
              style={authStyles.flex}
              contentContainerStyle={tabletScrollContentStyle}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              bounces={false}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              scrollEnabled={scrollEnabled}
              onScrollBeginDrag={Keyboard.dismiss}
            >
              {renderCard()}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  tabletShell: {
    flex: 1,
    flexDirection: 'row',
  },
  tabletShellStack: {
    flexDirection: 'column',
  },
  tabletPromoPane: {
    flex: 1.18,
    borderRadius: 36,
    overflow: 'hidden',
    justifyContent: 'center',
    backgroundColor: theme.navyMid,
  },
  tabletPromoPaneStack: {
    flex: 0,
    width: '100%',
  },
  tabletPromoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 27, 52, 0.16)',
  },
  tabletPromoGlowOne: {
    position: 'absolute',
    top: -90,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabletPromoGlowTwo: {
    position: 'absolute',
    left: -80,
    bottom: -100,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(116, 169, 255, 0.12)',
  },
  tabletPromoContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 28,
  },
  tabletPromoContentStack: {
    minHeight: 0,
  },
  tabletPromoSurface: {
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: 26,
    paddingVertical: 26,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  tabletPromoLogo: {
    width: 154,
    height: 60,
    tintColor: '#fff',
  },
  tabletPromoCopy: {
    marginTop: 18,
  },
  tabletPromoEyebrow: {
    color: '#cfe0ff',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 10,
  },
  tabletPromoTitle: {
    color: '#ffffff',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    maxWidth: 420,
  },
  tabletPromoText: {
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '500',
    marginTop: 14,
    maxWidth: 440,
  },
  tabletHighlights: {
    gap: 12,
    paddingTop: 16,
  },
  tabletHighlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  tabletHighlightDot: {
    width: 8,
    height: 8,
    borderRadius: 5,
    marginTop: 7,
    backgroundColor: '#8bb6ff',
  },
  tabletHighlightText: {
    flex: 1,
    color: '#edf4ff',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  tabletStatusCard: {
    alignSelf: 'stretch',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabletStatusLabel: {
    color: '#cfe0ff',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  tabletStatusValue: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  tabletFormPane: {
    flex: 0.82,
    justifyContent: 'center',
  },
  tabletFormPaneStack: {
    flex: 0,
  },
  tabletScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
});

export default AuthScreenLayout;
