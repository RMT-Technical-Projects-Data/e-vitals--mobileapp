import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SplashScreen from '../screens/SplashScreen';
import Login from '../screens/Login';
import ForgotPassword from '../screens/ForgotPassword';
import Summary from '../screens/Summary';
import Appointment from '../screens/Appointment';
import AudioCall from '../screens/AudioCall';
import VideoCall from '../screens/VideoCall';
import SMS from '../screens/SMS';
import ProfileScreen from '../screens/ProfileScreen'; // Add this import
import ChangePassword from '../screens/ChangePassword';
import PatientEditForm from'../screens/PatientEditScreen';
// Global Bottom Bar
import GlobalBottomBar from './GlobalBottomBar';
import Notifications from '../screens/Notifications'; //  Add this import
import AccountSettings from '../screens/AccountSettings';
import FollowUp  from '../screens/FollowUp';


// import ChangePassword from '../screens/ChangePassword';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Auth */}
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="ForgotPassword" component={ForgotPassword} />

      {/* Main App */}
      <Stack.Screen name="MainTabs" component={GlobalBottomBar} />

      {/* Other Screens */}
      <Stack.Screen name="Summary" component={Summary} />
      <Stack.Screen name="Appointment" component={Appointment} />
      <Stack.Screen name="AudioCall" component={AudioCall} />
      <Stack.Screen name="VideoCall" component={VideoCall} />
      <Stack.Screen name="SMS" component={SMS} />
      <Stack.Screen name ="PatientEditForm" component={PatientEditForm}/>
      <Stack.Screen name="ChangePassword" component={ChangePassword}/>
      <Stack.Screen name="AccountSettings" component={AccountSettings}/>
      <Stack.Screen name="FollowUp" component={FollowUp}/>
      
      <Stack.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{
          headerShown: true, // Show header for this screen only
          title: 'User Profile', // Custom title
          headerStyle: {
            backgroundColor: '#007AFF', // Match your app's theme
          },
          headerTintColor: '#fff', // White text
        }}
      />
      <Stack.Screen 
  name="Notifications" 
  component={Notifications} 
  options={{
    headerShown: true, 
    title: 'Notifications',
    headerStyle: { backgroundColor: '#007AFF' },
    headerTintColor: '#fff',
  }}
/>
    </Stack.Navigator>
  );
}