import { createRef } from 'react';
import { CommonActions } from '@react-navigation/native';

// A ref to the root NavigationContainer.
// Attach this to <NavigationContainer ref={navigationRef}> in App.js.
// Then call navigationRef.current?.dispatch(...) from anywhere in the app.
export const navigationRef = createRef();

/**
 * Navigate to the Login screen and clear the entire navigation stack.
 * Works from any screen, no matter how deeply nested.
 */
export function navigateToLogin() {
  if (navigationRef.current) {
    navigationRef.current.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      })
    );
  }
}
