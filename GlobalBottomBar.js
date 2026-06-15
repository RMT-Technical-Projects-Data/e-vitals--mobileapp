/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable react-native/no-inline-styles */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  Platform,
  TouchableOpacity
} from 'react-native';

// Importing global configuration settings for colors and fonts
import { colors, fonts } from './config/globall';

// --- Responsive Scaling Setup ---
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

// Scaling functions for responsive design
const scaleWidth = (size) => (width / guidelineBaseWidth) * size;
const scaleHeight = (size) => (height / guidelineBaseHeight) * size;
const scaleFont = (size) => scaleWidth(size);

// --- Screen Imports ---
import Home from './Home';
// import Appointment from '../screens/Appointment';
import AIModulesScreen from './AIModulesScreen';
// import ChatScreen from '../screens/ChatScreen';
import ProfileScreen from './ProfileScreen';
import SettingsScreen from './SettingsScreen';

const Tab = createBottomTabNavigator();

/**
 * GlobalBottomBar component defines the primary navigation for the application.
 * 5 tabs: Profile, Appointment, Home, Chat, Settings
 */
export default function GlobalBottomBar({ navigation }) {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.primaryButton,
        tabBarInactiveTintColor: colors.inactive,
        tabBarLabelStyle: styles.tabBarLabel,

        tabBarIcon: ({ focused }) => {
          let iconSource;

          // Load icons based on the route name
          if (route.name === 'Home') {
            iconSource = require('./android/app/src/assets/images/home1.png');
          } else if (route.name === 'Agent') {
            iconSource = require('./android/app/src/assets/images/ai.png');
          } else if (route.name === 'Profile') {
            iconSource = require('./android/app/src/assets/images/user.png');
          } else if (route.name === 'Settings') {
            iconSource = require('./android/app/src/assets/images/settings.png');
          }

          // Return ONLY the icon with background, not wrapped in extra View
          return (
            <View style={[
              styles.iconContainer,
              focused && styles.activeIconBackground,
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
      {/* Tab Screens */}
      {/* <Tab.Screen name="Profile" component={ProfileScreen} /> */}
      {/* <Tab.Screen name="Appointment" component={Appointment} /> */}
      <Tab.Screen name="Home" component={Home} />
      <Tab.Screen name="Agent" component={AIModulesScreen} />
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