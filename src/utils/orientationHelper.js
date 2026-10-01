import { NativeModules, Platform } from 'react-native';

let orientationModule;

const getOrientationModule = () => {
  if (!NativeModules.Orientation) {
    return null;
  }

  if (!orientationModule) {
    orientationModule = require('react-native-orientation-locker').default;
  }

  return orientationModule;
};

// SENSOR / SENSOR_LANDSCAPE ignore the system Auto-rotate switch. Only request a
// forced orientation when that switch is on; otherwise leave the user's lock alone.
const runWhenAutoRotateAllows = (action) => {
  const orientation = getOrientationModule();
  if (!orientation) {
    return;
  }

  if (Platform.OS !== 'android' || typeof orientation.getAutoRotateState !== 'function') {
    action(orientation);
    return;
  }

  orientation.getAutoRotateState(enabled => {
    if (enabled) {
      action(orientation);
    }
  });
};

export const lockToLandscape = () => {
  runWhenAutoRotateAllows(orientation => {
    orientation.lockToLandscape?.();
  });
};

export const lockToPortrait = () => {
  runWhenAutoRotateAllows(orientation => {
    orientation.lockToPortrait?.();
  });
};

export const unlockAllOrientations = () => {
  runWhenAutoRotateAllows(orientation => {
    orientation.unlockAllOrientations?.();
  });
};
