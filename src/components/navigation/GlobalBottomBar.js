/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable react-native/no-inline-styles */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';

// Importing global configuration settings for colors
import { colors } from '../../config/globall';

// --- Responsive Scaling Setup ---
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

// Scaling functions for responsive design
const scaleWidth = (size) => (width / guidelineBaseWidth) * size;
const scaleHeight = (size) => (height / guidelineBaseHeight) * size;
const scaleFont = (size) => scaleWidth(size);

// --- AsyncStorage Import ---
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- Screen Imports ---
import Home from '../../screens/main/Home';
import Summary from '../../screens/vitals/Summary';
import ChatScreen from '../../screens/communication/ChatScreen';
import AIModulesScreen from '../../screens/ai/AIModulesScreen';
import SettingsScreen from '../../screens/settings/SettingsScreen';
import PatientsScreen from '../../screens/main/PatientsScreen';
import Appointment from '../../screens/communication/Appointment';

const Tab = createBottomTabNavigator();
const PREMIUM_NAV_ROUTES = new Set(['Home', 'Patients', 'Chat', 'Schedule', 'Settings']);

/**
 * GlobalBottomBar component defines the primary navigation for the application.
 * Dynamic tabs based on user role: Patient, Caregiver, or Provider.
 */
export default function GlobalBottomBar({ navigation }) {
  const [userRole, setUserRole] = React.useState('patient');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;
    const loadRole = async () => {
      try {
        const userStr = await AsyncStorage.getItem('user');
        if (userStr && isMounted) {
          const user = JSON.parse(userStr);
          const roleId = Number(user.role_id);
          if (roleId === 4) {
            setUserRole('provider');
          } else if (roleId === 5 || roleId === 7) {
            setUserRole('caregiver');
          } else {
            setUserRole('patient');
          }
        }
      } catch (e) {
        console.warn('Error loading role in bottom bar:', e);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    loadRole();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: '#ffffff' }} />;
  }

  let activeColor = '#1a3a6b'; // Patient
  if (userRole === 'caregiver') {
    activeColor = '#0a6640';
  } else if (userRole === 'provider') {
    activeColor = '#4a1a8b';
  }

  if (userRole === 'patient') {
    return (
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: PREMIUM_NAV_ROUTES.has(route.name) ? styles.hiddenTabBar : styles.tabBar,
          tabBarHideOnKeyboard: true,
          tabBarShowLabel: true,
          tabBarActiveTintColor: activeColor,
          tabBarInactiveTintColor: colors.inactive,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarIcon: ({ focused }) => {
            let iconSource;
            if (route.name === 'Home') {
              iconSource = require('../../assets/images/home1.png');
            } else if (route.name === 'Readings') {
              iconSource = require('../../assets/images/chart.png');
            } else if (route.name === 'Chat') {
              iconSource = require('../../assets/images/chat.png');
            } else if (route.name === 'Agent') {
              iconSource = require('../../assets/images/ai.png');
            } else if (route.name === 'Settings') {
              iconSource = require('../../assets/images/settings.png');
            }

            return (
              <View style={[
                styles.iconContainer,
                focused && { backgroundColor: activeColor },
              ]}>
                <Image
                  source={iconSource}
                  style={[
                    styles.icon,
                    { tintColor: focused ? colors.background : colors.inactive }
                  ]}
                  resizeMode="contain"
                />
              </View>
            );
          },
        })}
      >
        <Tab.Screen name="Home" component={Home} />
        <Tab.Screen name="Readings" component={Summary} />
        <Tab.Screen name="Chat" component={ChatScreen} />
        <Tab.Screen
          name="Agent"
          component={AIModulesScreen}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
            },
          }}
        />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    );
  }

  // Caregiver or Provider
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: PREMIUM_NAV_ROUTES.has(route.name) ? styles.hiddenTabBar : styles.tabBar,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: true,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: colors.inactive,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIcon: ({ focused }) => {
          let iconSource;
          if (route.name === 'Home') {
            iconSource = require('../../assets/images/home1.png');
          } else if (route.name === 'Patients') {
            iconSource = require('../../assets/images/user-2.png');
          } else if (route.name === 'Chat') {
            iconSource = require('../../assets/images/chat.png');
          } else if (route.name === 'Schedule') {
            iconSource = require('../../assets/images/calendar.png');
          } else if (route.name === 'Settings') {
            iconSource = require('../../assets/images/settings.png');
          }

          return (
            <View style={[
              styles.iconContainer,
              focused && { backgroundColor: activeColor },
            ]}>
              <Image
                source={iconSource}
                style={[
                  styles.icon,
                  { tintColor: focused ? colors.background : colors.inactive }
                ]}
                resizeMode="contain"
              />
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={Home} />
      <Tab.Screen name="Patients" component={PatientsScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Schedule" component={Appointment} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

// --- Stylesheet for the component ---
const styles = StyleSheet.create({
  // Style for the main tab bar container
  tabBar: {
    height: Platform.select({
      ios: scaleHeight(85),
      android: scaleHeight(75)
    }),
    paddingBottom: Platform.select({
      ios: scaleHeight(10),
      android: scaleHeight(8)
    }),
    paddingTop: scaleHeight(5),
    backgroundColor: colors.background,
    elevation: 16,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    borderTopWidth: 0,
  },
  hiddenTabBar: {
    display: 'none',
  },

  // Label styling - will be applied to ALL tabs
  tabBarLabel: {
    fontSize: scaleFont(9.85),
    fontWeight: 'bold',
    marginTop: scaleHeight(4),
  },

  // Background container for the icon
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: scaleWidth(40),
    height: scaleWidth(40),
    borderRadius: scaleWidth(20),
    marginBottom: scaleHeight(2),
  },

  // Blue background when a tab is active/focused
  activeIconBackground: {
    backgroundColor: colors.primaryButton
  },

  // Icon image dimensions
  icon: {
    width: scaleWidth(22),
    height: scaleWidth(22)
  },
});
