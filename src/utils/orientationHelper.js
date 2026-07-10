import { NativeModules } from 'react-native';

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

export const lockToLandscape = () => {
  getOrientationModule()?.lockToLandscape?.();
};

export const lockToPortrait = () => {
  getOrientationModule()?.lockToPortrait?.();
};

export const unlockAllOrientations = () => {
  getOrientationModule()?.unlockAllOrientations?.();
};
