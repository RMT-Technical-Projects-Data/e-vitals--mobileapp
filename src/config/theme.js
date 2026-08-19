import { Dimensions, Platform, StyleSheet } from 'react-native';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;
const authCardMaxWidth = isTablet ? Math.min(760, Math.max(620, width - 80)) : 430;
const authTextMaxWidth = isTablet ? 560 : 340;

export const scale = size => (width / 375) * size;

export const theme = {
  navy: '#071b34',
  navyMid: '#0d2f58',
  blue: '#0d47a1',
  red: '#b91427',
  cream: '#ffffff',
  creamMid: '#ffffff',
  cream2: '#ffffff',
  line: '#e8ecf0',
  text: '#152033',
  muted: '#687382',
  placeholder: '#a8afb8',
  paper: '#ffffff',
  card: '#ffffff',
  success: '#2E7D32',
  gradient: ['#ffffff', '#ffffff', '#ffffff'],
};

export const authStyles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: isTablet ? 24 : scale(10),
    paddingVertical: isTablet ? 24 : scale(8),
    justifyContent: 'center',
  },
  screenCard: {
    width: '100%',
    maxWidth: authCardMaxWidth,
    minHeight: isTablet ? 680 : scale(600),
    alignSelf: 'center',
    borderRadius: isTablet ? 36 : scale(32),
    borderWidth: 1,
    borderColor: '#e8ecf0',
    backgroundColor: theme.card,
    shadowColor: '#071b34',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 12,
  },
  screenCardCompact: {
    minHeight: 0,
  },
  hero: {
    paddingHorizontal: isTablet ? 28 : scale(20),
    paddingTop: isTablet ? 28 : scale(20),
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: theme.line,
  },
  headerSpacer: {
    width: scale(36),
    height: scale(36),
  },
  backButtonText: {
    color: theme.navy,
    fontSize: scale(22),
    fontWeight: '400',
    lineHeight: scale(24),
    marginTop: -2,
  },
  headerTitle: {
    flex: 1,
    color: theme.text,
    fontSize: scale(20),
    fontWeight: '800',
    textAlign: 'center',
  },
  logo: {
    width: isTablet ? 148 : scale(128),
    height: isTablet ? 60 : scale(52),
  },
  panel: {
    paddingHorizontal: isTablet ? 32 : scale(22),
    paddingTop: isTablet ? 30 : scale(24),
    paddingBottom: isTablet ? 36 : scale(30),
  },
  eyebrow: {
    color: theme.red,
    fontSize: scale(12),
    fontWeight: '800',
    marginBottom: scale(5),
    textTransform: 'uppercase',
  },
  title: {
    color: theme.text,
    fontSize: isTablet ? 30 : scale(26),
    lineHeight: isTablet ? 36 : scale(30),
    fontWeight: '800',
    maxWidth: authTextMaxWidth,
  },
  subheading: {
    color: theme.muted,
    fontSize: isTablet ? 16 : scale(14),
    lineHeight: isTablet ? 24 : scale(22),
    fontWeight: '500',
    marginTop: isTablet ? 10 : scale(8),
    marginBottom: isTablet ? 24 : scale(20),
    maxWidth: authTextMaxWidth,
  },
  field: {
    marginBottom: isTablet ? 18 : scale(16),
  },
  label: {
    color: '#3f4754',
    fontSize: scale(12),
    fontWeight: '800',
    marginBottom: scale(5),
  },
  input: {
    height: isTablet ? 52 : scale(48),
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: isTablet ? 18 : scale(16),
    paddingHorizontal: isTablet ? 18 : scale(16),
    color: theme.text,
    backgroundColor: theme.paper,
    fontSize: isTablet ? 17 : scale(16),
    fontWeight: '600',
    letterSpacing: 0,
  },
  inputFocused: {
    borderColor: 'rgba(13, 71, 161, 0.55)',
    backgroundColor: '#fff',
  },
  otpInput: {
    fontSize: scale(24),
    fontWeight: '800',
    letterSpacing: scale(6),
    textAlign: 'center',
  },
  passwordWrap: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: scale(48),
    // Android can render secure-entry text with a monospace font unless this
    // is set explicitly, which makes the placeholder look inconsistent.
    fontFamily: Platform.select({ android: 'sans-serif', ios: undefined }),
    letterSpacing: 0,
  },
  eyeButton: {
    position: 'absolute',
    right: isTablet ? 16 : scale(14),
    top: isTablet ? 16 : scale(14),
  },
  eyeIcon: {
    width: isTablet ? 19 : scale(18),
    height: isTablet ? 19 : scale(18),
    tintColor: theme.muted,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: isTablet ? 18 : scale(14),
    marginTop: scale(2),
    marginBottom: isTablet ? 20 : scale(16),
    flexWrap: 'wrap',
  },
  linkText: {
    color: theme.navy,
    fontSize: scale(12),
    fontWeight: '800',
  },
  mutedLink: {
    color: theme.muted,
    fontSize: scale(12),
    fontWeight: '700',
    textAlign: 'center',
  },
  feedback: {
    marginBottom: scale(14),
    paddingHorizontal: scale(14),
    paddingVertical: scale(12),
    borderRadius: scale(14),
    borderWidth: 1,
    borderColor: 'rgba(185, 20, 39, 0.16)',
    backgroundColor: 'rgba(185, 20, 39, 0.07)',
  },
  feedbackSuccess: {
    borderColor: 'rgba(13, 71, 161, 0.18)',
    backgroundColor: 'rgba(13, 71, 161, 0.07)',
  },
  feedbackText: {
    color: theme.red,
    fontSize: scale(12),
    fontWeight: '800',
    lineHeight: scale(16),
  },
  feedbackTextSuccess: {
    color: theme.navy,
  },
  primaryBtnWrap: {
    borderRadius: scale(18),
    overflow: 'hidden',
    shadowColor: 'rgba(7, 27, 52, 0.24)',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 8,
    marginTop: scale(4),
  },
  primaryBtn: {
    height: scale(50),
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: scale(16),
    fontWeight: '800',
  },
  finePrint: {
    marginTop: isTablet ? 42 : scale(36),
    color: '#7a8491',
    fontSize: isTablet ? 12 : scale(11),
    fontWeight: '600',
    lineHeight: isTablet ? 18 : scale(16),
    textAlign: 'center',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: scale(18),
    paddingHorizontal: scale(12),
  },
  stepDot: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
    backgroundColor: theme.line,
    borderWidth: 2,
    borderColor: theme.line,
  },
  stepDotActive: {
    backgroundColor: theme.navy,
    borderColor: theme.navy,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: theme.line,
    marginHorizontal: scale(6),
  },
  stepLineActive: {
    backgroundColor: theme.navy,
  },
  strengthBox: {
    marginTop: scale(8),
    paddingVertical: scale(10),
    paddingHorizontal: scale(12),
    backgroundColor: theme.cream,
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: theme.line,
  },
  strengthText: {
    fontSize: scale(11),
    color: theme.muted,
    fontWeight: '600',
    marginVertical: scale(2),
  },
  strengthTextDone: {
    color: theme.success,
    fontWeight: '800',
  },
  strengthTextError: {
    color: theme.red,
    fontWeight: '800',
  },
  emailHighlight: {
    color: theme.navy,
    fontWeight: '800',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  checkbox: {
    width: scale(17),
    height: scale(17),
    borderRadius: scale(4),
    borderWidth: 1.5,
    borderColor: theme.navy,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: theme.navy,
  },
  checkmark: {
    color: '#fff',
    fontSize: scale(11),
    fontWeight: '800',
    lineHeight: scale(12),
  },
  rememberText: {
    color: theme.muted,
    fontSize: scale(12),
    fontWeight: '700',
  },
});
