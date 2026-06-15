import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Easing,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');

const SplashScreen = ({ navigation }) => {
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const gradientAnim = useRef(new Animated.Value(0)).current;
  const particleAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const textGlowAnim = useRef(new Animated.Value(0)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const countdownAnim = useRef(new Animated.Value(60)).current;

  // Countdown timer text
  const [countdown, setCountdown] = React.useState(60);
  const countdownIntervalRef = useRef(null);

  // Create particles with fixed values to avoid floating point issues
  const particles = useRef(
    Array.from({ length: 15 }, (_, i) => ({
      id: i,
      size: 3 + Math.random() * 5,
      startX: Math.random() * width,
      startY: Math.random() * height,
      // Use fixed values for input ranges
      inputRange1: 0,
      inputRange2: 0.5,
      inputRange3: 1,
    }))
  ).current;

  useEffect(() => {
    // Continuous rotation animation for icon
    const rotationLoop = Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // Animated gradient movement
    const gradientSequence = Animated.loop(
      Animated.sequence([
        Animated.timing(gradientAnim, {
          toValue: 1,
          duration: 8000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(gradientAnim, {
          toValue: 0,
          duration: 8000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
      { iterations: -1 }
    );

    // Particle floating animation
    const particleSequence = Animated.loop(
      Animated.sequence([
        Animated.timing(particleAnim, {
          toValue: 1,
          duration: 6000,
          useNativeDriver: true,
        }),
        Animated.timing(particleAnim, {
          toValue: 0,
          duration: 6000,
          useNativeDriver: true,
        }),
      ]),
      { iterations: -1 }
    );

    // Text glow animation
    const textGlowSequence = Animated.loop(
      Animated.sequence([
        Animated.timing(textGlowAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(textGlowAnim, {
          toValue: 0.3,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
      { iterations: -1 }
    );

    // Progress bar animation (60 seconds)
    const progressAnimation = Animated.timing(progressAnim, {
      toValue: 1,
      duration: 59000,
      easing: Easing.linear,
      useNativeDriver: false,
    });

    // Main content animation
    const mainAnimation = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 10,
        useNativeDriver: true,
      }),
    ]);

    // Start countdown timer
    let currentCountdown = 60;
    countdownIntervalRef.current = setInterval(() => {
      currentCountdown -= 1;
      setCountdown(currentCountdown);
      
      // Update animated value for smooth transitions if needed
      Animated.timing(countdownAnim, {
        toValue: currentCountdown,
        duration: 1000,
        useNativeDriver: false,
      }).start();
      
      if (currentCountdown <= 0) {
        clearInterval(countdownIntervalRef.current);
      }
    }, 1000);

    // Start all animations
    Animated.parallel([
      rotationLoop,
      gradientSequence,
      particleSequence,
      textGlowSequence,
      progressAnimation,
      mainAnimation,
    ]).start();

    // Navigate to Login after 60 seconds
    const timer = setTimeout(() => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      navigation.replace('Login');
    }, 60000);

    return () => {
      clearTimeout(timer);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Animated gradient transformation
  const gradientTranslateX = gradientAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 200],
  });

  const gradientTranslateY = gradientAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 100],
  });

  // Text glow effect
  const textGlow = textGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 20],
  });

  // Progress bar width
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Rotation animation for decorative elements
  const rotateInterpolate = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Fixed progress steps for feature animation
  const featureSteps = [0, 0.2, 0.4, 0.6, 0.8, 1];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="transparent" 
        translucent 
      />
      
      {/* Animated Gradient Background */}
      <Animated.View
        style={[
          styles.gradientContainer,
          {
            transform: [
              { translateX: gradientTranslateX },
              { translateY: gradientTranslateY },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['#0A1931', '#1E3A8A', '#0A1931', '#0A1931']}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          colors={['transparent', 'rgba(79, 195, 247, 0.1)', 'transparent']}
          style={styles.gradientOverlay}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* Large rotating decorative rings */}
      <Animated.View style={[styles.decorativeRingLarge, {
        transform: [{ rotate: rotateInterpolate }],
      }]} />
      <Animated.View style={[styles.decorativeRingMedium, {
        transform: [{ rotate: rotateInterpolate.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '-360deg']
        }) }],
      }]} />

      {/* Animated particles - FIXED: Using simple interpolation without floating point issues */}
      {particles.map((particle) => {
        // Create simple interpolations for each particle
        const particleOpacity = particleAnim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.1, 0.6, 0.1]
        });

        const particleTranslateY = particleAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -100]
        });

        const particleTranslateX = particleAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.random() > 0.5 ? 25 : -25]
        });

        const particleRotation = particleAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg']
        });

        const particleScale = particleAnim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1, 1.1, 1]
        });

        return (
          <Animated.View
            key={particle.id}
            style={[
              styles.particle,
              {
                width: particle.size,
                height: particle.size,
                left: particle.startX,
                top: particle.startY,
                opacity: particleOpacity,
                transform: [
                  { translateY: particleTranslateY },
                  { translateX: particleTranslateX },
                  { rotate: particleRotation },
                  { scale: particleScale },
                ],
              },
            ]}
          />
        );
      })}

      {/* Main Content Container */}
      <View style={styles.container}>
        {/* Central Content */}
        <Animated.View
          style={[
            styles.contentContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Icon with enhanced pulse effect */}
          <Animated.View style={[styles.iconContainer, {
            shadowOpacity: textGlowAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 0.9],
            }),
          }]}>
            <LinearGradient
              colors={['#4FC3F7', '#2979FF', '#4FC3F7']}
              style={styles.iconGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Icon name="heart-pulse" size={52} color="#FFFFFF" />
            </LinearGradient>
            
            {/* Multiple pulsing rings */}
            <Animated.View style={[styles.pulseRing1, {
              transform: [{ scale: particleAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1.8]
              }) }],
              opacity: particleAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.3, 0.1, 0]
              }),
            }]} />
            <Animated.View style={[styles.pulseRing2, {
              transform: [{ scale: particleAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 2.2]
              }) }],
              opacity: particleAnim.interpolate({
                inputRange: [0, 0.7, 1],
                outputRange: [0.2, 0.05, 0]
              }),
            }]} />
          </Animated.View>

          {/* App Name with enhanced glow effect */}
          <Animated.View style={[styles.appNameContainer, {
            shadowRadius: textGlow,
          }]}>
            <Text style={styles.appName}>e-Vitals</Text>
            <View style={styles.underlineContainer}>
              <LinearGradient
                colors={['#4FC3F7', '#2979FF', '#4FC3F7']}
                style={styles.underline}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            </View>
          </Animated.View>

          {/* Tagline */}
          <Text style={styles.tagline}>
            Advanced Remote Patient Monitoring
          </Text>

          {/* Countdown Timer Display */}
          <View style={styles.countdownContainer}>
            <View style={styles.countdownBox}>
              <Text style={styles.countdownLabel}>Starting in</Text>
              <Text style={styles.countdownTimer}>
                {countdown.toString().padStart(2, '0')}
              </Text>
              <Text style={styles.countdownUnit}>seconds</Text>
            </View>
          </View>

          {/* Features with staggered animation - FIXED: Using clean input ranges */}
          <View style={styles.featuresContainer}>
            {[
              { icon: 'shield-check', text: 'HIPAA Compliant', color: '#4CAF50', delay: 0 },
              { icon: 'brain', text: 'AI-Powered Analytics', color: '#9C27B0', delay: 0.1 },
              { icon: 'clock-fast', text: 'Real-time Monitoring', color: '#FF9800', delay: 0.2 },
              { icon: 'encryption', text: 'End-to-End Encrypted', color: '#2196F3', delay: 0.3 },
              { icon: 'chart-line', text: 'Predictive Insights', color: '#00BCD4', delay: 0.4 },
              { icon: 'devices', text: 'Multi-Platform', color: '#E91E63', delay: 0.5 },
            ].map((feature, index) => {
              // Create clean animation for each feature
              const featureOpacity = fadeAnim.interpolate({
                inputRange: [0, feature.delay, 1],
                outputRange: [0, 1, 1]
              });

              const featureTranslateY = fadeAnim.interpolate({
                inputRange: [0, feature.delay, 1],
                outputRange: [20, 0, 0]
              });

              return (
                <Animated.View 
                  key={index} 
                  style={[
                    styles.featureItem,
                    {
                      opacity: featureOpacity,
                      transform: [{ translateY: featureTranslateY }],
                    },
                  ]}
                >
                  <Icon 
                    name={feature.icon} 
                    size={18} 
                    color={feature.color} 
                    style={styles.featureIcon}
                  />
                  <Text style={styles.featureText}>{feature.text}</Text>
                </Animated.View>
              );
            })}
          </View>

          {/* Loading Progress Bar with percentage */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>System Initialization</Text>
              <Animated.Text style={styles.progressPercentage}>
                {progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                })}
              </Animated.Text>
            </View>
            
            <View style={styles.progressContainer}>
              <View style={styles.progressBackground}>
                <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
                <Animated.View style={[styles.progressGlow, {
                  left: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                }]} />
              </View>
              
              {/* Progress steps - FIXED: Using clean step values */}
              <View style={styles.progressSteps}>
                {[
                  { label: 'Security', value: 0 },
                  { label: 'Database', value: 0.25 },
                  { label: 'API', value: 0.5 },
                  { label: 'UI', value: 0.75 },
                  { label: 'Complete', value: 1 },
                ].map((step, index) => (
                  <Animated.View 
                    key={step.label}
                    style={[
                      styles.progressStep,
                      {
                        opacity: progressAnim.interpolate({
                          inputRange: [step.value - 0.25, step.value],
                          outputRange: [0.3, 1],
                        }),
                      },
                    ]}
                  >
                    <Text style={styles.progressStepText}>{step.label}</Text>
                  </Animated.View>
                ))}
              </View>
            </View>
            
            <Text style={styles.loadingText}>
              <Icon name="shield-lock" size={14} color="#4FC3F7" /> 
              {' '}Establishing secure connection...
            </Text>
          </View>
        </Animated.View>

        {/* Bottom Info with company details */}
        <View style={styles.bottomContainer}>
          <View style={styles.bottomContent}>
            <Text style={styles.versionText}>
              <Icon name="tag" size={12} color="#90CAF9" /> 
              {' '}Version 2.5.1 • Enterprise Edition
            </Text>
            <Text style={styles.companyText}>
              <Icon name="hospital-building" size={12} color="#90CAF9" /> 
              {' '}MediTech Solutions Inc.
            </Text>
            <Text style={styles.securityText}>
              <Icon name="lock-check" size={12} color="#4FC3F7" /> 
              {' '}ISO 27001 Certified • HIPAA Compliant
            </Text>
          </View>
          
          {/* Mini loading indicator - FIXED: Using clean input ranges */}
          <View style={styles.miniLoader}>
            {[...Array(5)].map((_, i) => {
              const miniDotAnim = particleAnim.interpolate({
                inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
                outputRange: [
                  '#4FC3F7',
                  i === 0 ? '#2979FF' : '#4FC3F7',
                  i <= 1 ? '#2979FF' : '#4FC3F7',
                  i <= 2 ? '#2979FF' : '#4FC3F7',
                  i <= 3 ? '#2979FF' : '#4FC3F7',
                  '#4FC3F7'
                ]
              });

              const miniDotOpacity = particleAnim.interpolate({
                inputRange: [0, i * 0.2, (i + 1) * 0.2, 1],
                outputRange: [0.3, 1, 0.8, 0.3]
              });

              return (
                <Animated.View
                  key={i}
                  style={[
                    styles.miniDot,
                    {
                      backgroundColor: miniDotAnim,
                      opacity: miniDotOpacity,
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A1931',
  },
  gradientContainer: {
    position: 'absolute',
    width: width * 3,
    height: height * 3,
    opacity: 0.9,
  },
  gradient: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  decorativeRingLarge: {
    position: 'absolute',
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: width * 0.75,
    borderWidth: 1,
    borderColor: 'rgba(79, 195, 247, 0.05)',
    borderStyle: 'dashed',
  },
  decorativeRingMedium: {
    position: 'absolute',
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    borderWidth: 1,
    borderColor: 'rgba(41, 121, 255, 0.03)',
    borderStyle: 'dotted',
  },
  particle: {
    position: 'absolute',
    backgroundColor: '#4FC3F7',
    borderRadius: 50,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 500,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 40,
    shadowColor: '#4FC3F7',
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
  },
  iconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 15,
  },
  pulseRing1: {
    position: 'absolute',
    top: -30,
    left: -30,
    right: -30,
    bottom: -30,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: '#4FC3F7',
  },
  pulseRing2: {
    position: 'absolute',
    top: -50,
    left: -50,
    right: -50,
    bottom: -50,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: '#2979FF',
  },
  appNameContainer: {
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#4FC3F7',
    shadowOffset: { width: 0, height: 0 },
  },
  appName: {
    fontSize: 56,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    marginBottom: 15,
    textShadowColor: 'rgba(79, 195, 247, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  underlineContainer: {
    width: 150,
    height: 6,
  },
  underline: {
    width: '100%',
    height: '100%',
    borderRadius: 3,
  },
  tagline: {
    fontSize: 20,
    fontWeight: '300',
    color: '#E3F2FD',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 30,
    opacity: 0.95,
    lineHeight: 28,
  },
  countdownContainer: {
    marginBottom: 40,
  },
  countdownBox: {
    backgroundColor: 'rgba(79, 195, 247, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 30,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: 'rgba(79, 195, 247, 0.2)',
    alignItems: 'center',
    minWidth: 180,
  },
  countdownLabel: {
    fontSize: 14,
    color: '#90CAF9',
    marginBottom: 5,
    letterSpacing: 1,
  },
  countdownTimer: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(79, 195, 247, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  countdownUnit: {
    fontSize: 12,
    color: '#B0BEC5',
    letterSpacing: 1,
    marginTop: 5,
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 50,
    maxWidth: 600,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  featureIcon: {
    marginRight: 8,
  },
  featureText: {
    fontSize: 13,
    color: '#E3F2FD',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  progressSection: {
    width: '100%',
    maxWidth: 500,
    marginBottom: 40,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  progressLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  progressPercentage: {
    fontSize: 16,
    color: '#4FC3F7',
    fontWeight: '700',
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBackground: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 15,
    position: 'relative',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4FC3F7',
    borderRadius: 4,
    position: 'relative',
  },
  progressGlow: {
    position: 'absolute',
    top: 0,
    width: 20,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 4,
  },
  progressSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  progressStep: {
    alignItems: 'center',
  },
  progressStepText: {
    fontSize: 10,
    color: '#90CAF9',
    fontWeight: '500',
    marginTop: 5,
  },
  loadingText: {
    fontSize: 13,
    color: '#B0BEC5',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginTop: 10,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 30,
    alignItems: 'center',
    width: '100%',
  },
  bottomContent: {
    alignItems: 'center',
    marginBottom: 20,
  },
  versionText: {
    fontSize: 13,
    color: 'rgba(144, 202, 249, 0.9)',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  companyText: {
    fontSize: 12,
    color: 'rgba(176, 190, 197, 0.8)',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  securityText: {
    fontSize: 12,
    color: 'rgba(79, 195, 247, 0.9)',
    letterSpacing: 0.5,
  },
  miniLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

export default SplashScreen;