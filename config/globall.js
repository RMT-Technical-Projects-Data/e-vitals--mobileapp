import { Dimensions, PixelRatio } from 'react-native';
import { RFValue } from 'react-native-responsive-fontsize';

// Get device dimensions
const { width, height } = Dimensions.get('window');

// Base screen dimensions for scaling reference (e.g., iPhone 11)
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

// Scale helpers
export const scaleWidth = size => (width / guidelineBaseWidth) * size;
export const scaleHeight = size => (height / guidelineBaseHeight) * size;

// Optional font scaling with PixelRatio
export const scaleFont = size => RFValue(size);

export const colors = {
  background: '#FFFFFF',
  backgroundLight: '#F8F9FD',
  primaryButton: '#293d55',
  secondaryButton: '#293d55',
  blackButton: '#000000',
  textPrimary: '#212121',
  textSecondary: '#666666',
  textWhite: '#FFFFFF',
  textBlack: '#000000',
  // textLink: '#00BCD4',
  borderLight: '#E0E0E0',
  borderDark: '#BDBDBD',
  shadow: '#000000',
};

export const fonts = {
  size: {
    sm: scaleFont(12),
    md: scaleFont(14),
    lg: scaleFont(16),
    xl: scaleFont(18),
    xxl: scaleFont(22),
  },
  weight: {
    normal: '400',
    medium: '500',
    semi: '600',
    bold: '700',
  },
  family: 'Inter-Variable',
  italicFamily: 'Inter-Italic',
  heading: {
    fontSize: scaleFont(20),
    fontWeight: '800',
    fontFamily: 'Inter-Variable',
    color: colors.textPrimary,
  },
  subHeading: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    fontFamily: 'Inter-Variable',
    color: colors.textPrimary,
  },
  paragraph: {
    fontSize: scaleFont(14),
    fontWeight: '400',
    fontFamily: 'Inter-Variable',
    color: colors.textSecondary,
  },
  paragraphItalic: {
    fontSize: scaleFont(14),
    fontWeight: '400',
    fontFamily: 'Inter-Italic',
    fontStyle: 'italic',
    color: colors.textSecondary,
  },
  buttonText: (color = colors.textWhite) => ({
    fontSize: scaleFont(16),
    fontWeight: '700',
    fontFamily: 'Inter-Variable',
    color: color,
  }),
};
