/**
 * Vital reading status + colors aligned with E-Vital-Frontend (PatientRpmOverview / tokens.css).
 */

export const MEASUREMENT_COLORS = {
  normal: '#15803d',
  high: '#d32f2f',
  low: '#f57c00',
  missing: '#0b1f3f',
  pulseMissing: '#687382',
};

export const MEASUREMENT_BADGE = {
  normal: { label: 'Normal', bg: '#DDF8DD', color: MEASUREMENT_COLORS.normal },
  high: { label: 'High', bg: '#FDE8E8', color: MEASUREMENT_COLORS.high },
  low: { label: 'Low', bg: '#FFEDD5', color: MEASUREMENT_COLORS.low },
};

export const DEFAULT_VITAL_TARGETS = {
  systolicMin: 100,
  systolicMax: 140,
  diastolicMin: 60,
  diastolicMax: 90,
  glucoseMin: 60,
  glucoseMax: 110,
  weightMin: 66,
  weightMax: 220,
  pulseMin: 60,
  pulseMax: 100,
};

export const getMeasurementAlertStatus = (value, min, max) => {
  const numericValue = Number(value);
  const numericMin = Number(min);
  const numericMax = Number(max);

  if (
    value == null
    || value === ''
    || value === '--'
    || value === 'N/A'
    || min == null
    || min === ''
    || max == null
    || max === ''
    || Number.isNaN(numericValue)
    || numericValue <= 0
    || Number.isNaN(numericMin)
    || Number.isNaN(numericMax)
  ) {
    return 'missing';
  }

  if (numericValue > numericMax) return 'high';
  if (numericValue < numericMin) return 'low';
  return 'normal';
};

export const getVitalStatusColor = (status) => {
  if (status === 'high') return MEASUREMENT_COLORS.high;
  if (status === 'low') return MEASUREMENT_COLORS.low;
  if (status === 'normal') return MEASUREMENT_COLORS.normal;
  return MEASUREMENT_COLORS.missing;
};

export const getVitalColor = (value, min, max) => (
  getVitalStatusColor(getMeasurementAlertStatus(value, min, max))
);

const worstVitalColor = (colors) => {
  if (colors.some((c) => c === MEASUREMENT_COLORS.high)) return MEASUREMENT_COLORS.high;
  if (colors.some((c) => c === MEASUREMENT_COLORS.low)) return MEASUREMENT_COLORS.low;
  if (colors.some((c) => c === MEASUREMENT_COLORS.normal)) return MEASUREMENT_COLORS.normal;
  return MEASUREMENT_COLORS.missing;
};

export const getBpVitalColor = (
  bpString,
  targets = DEFAULT_VITAL_TARGETS,
) => {
  if (!bpString || bpString === '--' || bpString === 'N/A') {
    return MEASUREMENT_COLORS.missing;
  }

  const parts = String(bpString).split('/');
  if (parts.length !== 2) return MEASUREMENT_COLORS.missing;

  const sys = Number(parts[0].trim());
  const dia = Number(parts[1].trim());

  return worstVitalColor([
    getVitalColor(sys, targets.systolicMin, targets.systolicMax),
    getVitalColor(dia, targets.diastolicMin, targets.diastolicMax),
  ]);
};

export const normalizeWeightToLbs = (value, unit = 'lb') => {
  const num = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  if (Number.isNaN(num) || num <= 0) return null;
  if (unit === 'kg' || num <= 110) return num * 2.20462;
  return num;
};

export const getReadingStatusMeta = (row, type, targets = DEFAULT_VITAL_TARGETS) => {
  if (type === 'bloodPressure') {
    const sysStatus = getMeasurementAlertStatus(row.systolic, targets.systolicMin, targets.systolicMax);
    const diaStatus = getMeasurementAlertStatus(row.diastolic, targets.diastolicMin, targets.diastolicMax);
    const status = sysStatus === 'high' || diaStatus === 'high'
      ? 'high'
      : sysStatus === 'low' || diaStatus === 'low'
        ? 'low'
        : sysStatus === 'normal' && diaStatus === 'normal'
          ? 'normal'
          : 'missing';
    return MEASUREMENT_BADGE[status] || MEASUREMENT_BADGE.normal;
  }

  if (type === 'bloodGlucose') {
    const status = getMeasurementAlertStatus(row.glucose, targets.glucoseMin, targets.glucoseMax);
    return MEASUREMENT_BADGE[status] || MEASUREMENT_BADGE.normal;
  }

  if (type === 'weight') {
    const wtLbs = normalizeWeightToLbs(row.weight, row.unit);
    const status = getMeasurementAlertStatus(wtLbs, targets.weightMin, targets.weightMax);
    return MEASUREMENT_BADGE[status] || MEASUREMENT_BADGE.normal;
  }

  return MEASUREMENT_BADGE.normal;
};
