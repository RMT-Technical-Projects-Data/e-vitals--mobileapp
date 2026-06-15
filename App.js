import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';  // ADD THIS IMPORT

// ========== ADD THIS IMPORT ==========
// import IOSNetworkConfig from './src/utils/iosNetworkConfig';
// =====================================

// Screens
import Login from './Login';
import ForgotPassword from './ForgotPassword';
import Summary from './Summary';
import Appointment from './Appointment';
import AudioCall from './AudioCall';
import SMS from './SMS';
import ProfileScreen from './ProfileScreen';
import PatientEditForm from './PatientEditScreen';
import ChangePassword from './ChangePassword';
import AccountSettings from './AccountSettings';
import FollowUp from './FollowUp';
import DataList from './DataList';
import ChatScreen from './ChatScreen';
import AIModulesScreen from './AIModulesScreen';
import PredictiveAnalysisScreen from './PredictiveAnalysisScreen';
import Notifications from './Notifications';
import SettingsScreen from './SettingsScreen';
import MCQ_Agent from './MCQ_Agent';
import StoreSummaryScreen from './StoreSummaryScreen';
import AboutAppScreen from './AboutAppScreen';

// Global Bottom Bar
import GlobalBottomBar from './GlobalBottomBar';

const Stack = createNativeStackNavigator();

export default function App() {
  
  // ========== ADD THIS useEffect ==========
  // useEffect(() => {
  //   // Initialize iOS network configuration
  //   if (Platform.OS === 'ios') {
  //     IOSNetworkConfig.setup();
      
  //     // Optional: Clear expired cookies on startup
  //     clearOldCookies();
  //   }
  // }, []);
  
  // const clearOldCookies = async () => {
  //   try {
  //     // This will be implemented in the iosNetworkConfig.js file
  //     // For now, we'll just log
  //     console.log('iOS cookie cleanup initialized');
  //   } catch (error) {
  //     console.log('Error clearing cookies:', error);
  //   }
  // };
  // ========================================

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        {/* Auth Flow */}
        <Stack.Screen name="Login" component={Login} />
        <Stack.Screen name="ForgotPassword" component={ForgotPassword} />

        {/* Main App */}
        <Stack.Screen name="MainTabs" component={GlobalBottomBar} />

        {/* Other Screens */}
        <Stack.Screen name="Summary" component={Summary} />
        <Stack.Screen name="Appointment" component={Appointment} />
        <Stack.Screen name="AudioCall" component={AudioCall} />
        <Stack.Screen name="SMS" component={SMS} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="PatientEditForm" component={PatientEditForm} />
        <Stack.Screen name="ChangePassword" component={ChangePassword} />
        <Stack.Screen name="AccountSettings" component={AccountSettings} />
        <Stack.Screen name="FollowUp" component={FollowUp} />
        <Stack.Screen name="DataList" component={DataList} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="AIModules" component={AIModulesScreen} />
        <Stack.Screen name="PredictiveAnalysis" component={PredictiveAnalysisScreen} />
        <Stack.Screen name="Notifications" component={Notifications} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="MCQ_Agent" component={MCQ_Agent} />
        <Stack.Screen name="StoreSummary" component={StoreSummaryScreen} />
        <Stack.Screen name="AboutApp" component={AboutAppScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}