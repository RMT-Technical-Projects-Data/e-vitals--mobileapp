import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';

import GlobalBottomBar from '../components/navigation/GlobalBottomBar';
import Login from '../screens/auth/Login';

const Stack = createNativeStackNavigator();

const lazyScreen = (loader) => () => loader();

/** Auth stack — shown when the user is NOT logged in */
function AuthStack() {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen
        name="Login"
        component={Login}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen
        name="ForgotPassword"
        getComponent={lazyScreen(() => require('../screens/auth/ForgotPassword').default)}
      />
      <Stack.Screen
        name="ChangePassword"
        getComponent={lazyScreen(() => require('../screens/auth/ChangePassword').default)}
      />
    </Stack.Navigator>
  );
}

/** App stack — shown when the user IS logged in */
function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={GlobalBottomBar} />

      <Stack.Screen
        name="PatientHub"
        getComponent={lazyScreen(() => require('../screens/main/PatientHubScreen').default)}
      />
      <Stack.Screen
        name="Summary"
        getComponent={lazyScreen(() => require('../screens/vitals/Summary').default)}
      />
      <Stack.Screen
        name="AudioCall"
        getComponent={lazyScreen(() => require('../screens/communication/AudioCall').default)}
      />
      <Stack.Screen
        name="VideoCall"
        getComponent={lazyScreen(() => require('../screens/communication/VideoCall').default)}
      />
      <Stack.Screen
        name="SMS"
        getComponent={lazyScreen(() => require('../screens/communication/SMS').default)}
      />
      <Stack.Screen
        name="Chat"
        getComponent={lazyScreen(() => require('../screens/communication/ChatScreen').default)}
      />
      <Stack.Screen
        name="FollowUp"
        getComponent={lazyScreen(() => require('../screens/communication/FollowUp').default)}
      />
      <Stack.Screen
        name="LookupPatient"
        getComponent={lazyScreen(() => require('../screens/patient/LookupPatient').default)}
      />
      <Stack.Screen
        name="Profile"
        getComponent={lazyScreen(() => require('../screens/profile/ProfileScreen').default)}
      />
      <Stack.Screen
        name="PatientEditForm"
        getComponent={lazyScreen(() => require('../screens/profile/PatientEditScreen').default)}
      />
      <Stack.Screen
        name="AccountSettings"
        getComponent={lazyScreen(() => require('../screens/profile/AccountSettings').default)}
      />
      <Stack.Screen
        name="AIModules"
        getComponent={lazyScreen(() => require('../screens/ai/AIModulesScreen').default)}
      />
      <Stack.Screen
        name="PredictiveAnalysis"
        getComponent={lazyScreen(() => require('../screens/vitals/PredictiveAnalysisScreen').default)}
      />
      <Stack.Screen
        name="MCQ_Agent"
        getComponent={lazyScreen(() => require('../screens/ai/MCQ_Agent').default)}
      />
      <Stack.Screen
        name="DataList"
        getComponent={lazyScreen(() => require('../screens/vitals/DataList').default)}
      />
      <Stack.Screen
        name="StoreSummary"
        getComponent={lazyScreen(() => require('../screens/vitals/StoreSummaryScreen').default)}
      />
      <Stack.Screen
        name="Settings"
        getComponent={lazyScreen(() => require('../screens/settings/SettingsScreen').default)}
      />
      <Stack.Screen
        name="AboutApp"
        getComponent={lazyScreen(() => require('../screens/settings/AboutAppScreen').default)}
      />
      <Stack.Screen
        name="Notifications"
        getComponent={lazyScreen(() => require('../screens/settings/Notifications').default)}
      />
      <Stack.Screen
        name="AssignedAbnormalReviews"
        getComponent={lazyScreen(() => require('../screens/reviews/AssignedAbnormalReviewsScreen').default)}
      />
    </Stack.Navigator>
  );
}

/**
 * Root navigator — switches between AuthStack and AppStack
 * based on isLoggedIn from AuthContext.
 *
 * When logout() is called → isLoggedIn = false → AuthStack renders automatically.
 * No navigation.dispatch() or getParent() needed at all.
 */
export default function AppNavigator() {
  const { isLoggedIn, isAuthReady } = useAuth();

  if (!isAuthReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#0b1f3f" />
      </View>
    );
  }

  return isLoggedIn ? <AppStack /> : <AuthStack />;
}
