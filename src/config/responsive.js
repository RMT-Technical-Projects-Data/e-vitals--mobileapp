import { Dimensions, PixelRatio } from 'react-native';

const { width, height } = Dimensions.get('window');

// Width percentage
export const wp = (percentage) => {
  const value = (percentage * width) / 100;
  return Math.round(value);
};

// Height percentage
export const hp = (percentage) => {
  const value = (percentage * height) / 100;
  return Math.round(value);
};

// Responsive Font Size
export const RFValue = (fontSize) => {
  const standardScreenHeight = 680;
  const heightPercent = (fontSize * height) / standardScreenHeight;
  return Math.round(PixelRatio.roundToNearestPixel(heightPercent));
};
