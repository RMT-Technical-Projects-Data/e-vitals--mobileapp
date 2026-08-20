import { EV } from '../config/colors';

export const DASHBOARD_THEMES = {
  patient: {
    accent: EV.navy,
    accentSoft: 'rgba(11, 31, 63, 0.08)',
    chartSecondary: EV.blueDeep,
  },
  provider: {
    accent: EV.navy,
    accentSoft: 'rgba(11, 31, 63, 0.08)',
    chartSecondary: EV.blueDeep,
  },
  caregiver: {
    accent: EV.navyMid,
    accentSoft: 'rgba(27, 42, 74, 0.08)',
    chartSecondary: EV.blue,
  },
};

export const getDashboardTheme = (role) => {
  const normalized = String(role || 'patient').toLowerCase();
  if (normalized === 'provider') return DASHBOARD_THEMES.provider;
  if (normalized === 'caregiver') return DASHBOARD_THEMES.caregiver;
  return DASHBOARD_THEMES.patient;
};
