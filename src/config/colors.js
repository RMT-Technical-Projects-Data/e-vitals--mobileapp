/**
 * App-wide color palette aligned with:
 * - Login Sign In button: #4FA3F5 → #1177c6 → #0b1f3f
 * - E-Vital-Frontend tokens (Coolors + navy)
 *
 * Clinical exceptions (allowed outside the brand blues):
 * - Critical alerts
 * - Abnormal readings
 */

export const EV = {
  // Sign In button / brand
  navy: '#0b1f3f',
  navyMid: '#1B2A4A',
  navyDark: '#03045e',
  blue: '#1177c6',
  blueDeep: '#0077b6',
  blueLight: '#4FA3F5',
  accent: '#00b4d8',
  blueTint: '#90e0ef',
  bluePale: '#caf0f8',

  // Surfaces & text (frontend tokens)
  bgPage: '#f4f9fc',
  surface: '#ffffff',
  text: '#152033',
  textMain: '#0f172a',
  textBody: '#1e293b',
  muted: '#64748b',
  mutedLight: '#94a3b8',
  border: '#e2e8f0',
  borderBlue: '#dbeafe',
  line: '#e8ecf0',

  // Sign In gradient
  buttonGradient: ['#4FA3F5', '#1177c6', '#0b1f3f'],

  // Clinical exceptions only
  critical: '#C4162E',
  criticalStrong: '#C62828',
  criticalBg: '#FCEBEB',
  abnormal: '#C53030',

  // Measurement vitals (match E-Vital-Frontend tokens.css)
  measurementNormal: '#15803d',
  measurementHigh: '#d32f2f',
  measurementLow: '#f57c00',
};

export default EV;
