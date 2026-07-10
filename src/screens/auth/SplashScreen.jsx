import React, { useEffect, useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  StatusBar,
} from 'react-native';

const SPLASH_BG = '#F7F4F0';
const SPLASH_NAVIGATE_MS = 3000;

const SplashScreen = ({ navigation }) => {
  const hasNavigated = useRef(false);
  const navigationRef = useRef(navigation);

  navigationRef.current = navigation;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (hasNavigated.current) {
        return;
      }

      hasNavigated.current = true;
      navigationRef.current.replace('Login');
    }, SPLASH_NAVIGATE_MS);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={SPLASH_BG} translucent />
      <Image
        source={require('../../assets/branding/splash-hero.jpeg')}
        style={styles.splashImage}
        resizeMode="cover"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SPLASH_BG,
  },
  splashImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
});

export default SplashScreen;
