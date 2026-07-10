import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { PatientSessionTimerProvider } from './src/context/PatientSessionTimerContext';
import AppNavigator from './src/navigation/AppNavigator';

function RootNavigator() {
  // AppNavigator handles Splash → Login → MainTabs internally.
  // AuthContext.logout() will cause re-render which resets everything.
  return <AppNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PatientSessionTimerProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </PatientSessionTimerProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
