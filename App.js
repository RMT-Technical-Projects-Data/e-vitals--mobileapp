import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { PatientSessionTimerProvider } from './src/context/PatientSessionTimerContext';
import AppNavigator from './src/navigation/AppNavigator';
import SessionTimeoutWrapper from './src/components/auth/SessionTimeoutWrapper';
import {
  captureInitialNotificationIntent,
  initializePushNotifications,
} from './src/services/pushNotificationService';
import {
  consumePendingChatOpenUserId,
  setPendingChatOpenUserId,
} from './src/utils/pendingChatNavigation';
import {
  consumePendingAbnormalReviewsOpen,
  setPendingAbnormalReviewsOpen,
} from './src/utils/pendingAbnormalNavigation';

function RootNavigator() {
  return <AppNavigator />;
}

function PushNotificationBootstrap() {
  const { isLoggedIn, isAuthReady } = useAuth();
  const navigationRef = useRef(null);

  useEffect(() => {
    captureInitialNotificationIntent().catch(() => {});
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return undefined;

    const openChatFromNotification = (fromUserId) => {
      if (!navigationRef.current?.isReady?.()) {
        setPendingChatOpenUserId(fromUserId);
        return;
      }
      navigationRef.current.navigate('Chat', { openUserId: fromUserId });
    };

    const openAssignedReviewsFromNotification = () => {
      if (!navigationRef.current?.isReady?.()) {
        setPendingAbnormalReviewsOpen();
        return;
      }
      navigationRef.current.navigate('AssignedAbnormalReviews');
    };

    let cleanup = () => {};
    initializePushNotifications({
      onOpenChat: openChatFromNotification,
      onOpenAssignedReviews: openAssignedReviewsFromNotification,
    })
      .then((unsubscribe) => {
        if (typeof unsubscribe === 'function') {
          cleanup = unsubscribe;
        }
      })
      .catch(() => {});

    return () => {
      cleanup();
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isAuthReady || !isLoggedIn) return undefined;

    const pendingUserId = consumePendingChatOpenUserId();
    const pendingAssignedReviews = consumePendingAbnormalReviewsOpen();

    if (!pendingUserId && !pendingAssignedReviews) return undefined;

    let attempts = 0;
    const maxAttempts = 30;

    const tryNavigate = () => {
      if (navigationRef.current?.isReady?.()) {
        if (pendingUserId) {
          navigationRef.current.navigate('Chat', { openUserId: pendingUserId });
        } else if (pendingAssignedReviews) {
          navigationRef.current.navigate('AssignedAbnormalReviews');
        }
        return;
      }

      attempts += 1;
      if (attempts < maxAttempts) {
        setTimeout(tryNavigate, 100);
      }
    };

    tryNavigate();
    return undefined;
  }, [isAuthReady, isLoggedIn]);

  return (
    <NavigationContainer ref={navigationRef}>
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PatientSessionTimerProvider>
          <SessionTimeoutWrapper>
            <PushNotificationBootstrap />
          </SessionTimeoutWrapper>
        </PatientSessionTimerProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
