export const DASHBOARD_THEMES = {
  patient: {
    accent: '#071B34',
    accentSoft: 'rgba(7, 27, 52, 0.08)',
    chartSecondary: '#1B3A5C',
  },
  provider: {
    accent: '#071B34',
    accentSoft: 'rgba(7, 27, 52, 0.08)',
    chartSecondary: '#1B3A5C',
  },
  caregiver: {
    accent: '#1B2A47',
    accentSoft: 'rgba(27, 42, 71, 0.08)',
    chartSecondary: '#2F5F8F',
  },
};

export const getDashboardTheme = (role) => {
  const normalized = String(role || 'patient').toLowerCase();
  if (normalized === 'provider') return DASHBOARD_THEMES.provider;
  if (normalized === 'caregiver') return DASHBOARD_THEMES.caregiver;
  return DASHBOARD_THEMES.patient;
};
