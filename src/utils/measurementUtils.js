/**
 * Vital reading status + colors aligned with E-Vital-Frontend (PatientRpmOverview / tokens.css).
 */

export const MEASUREMENT_COLORS = {
  normal: '#15803d',
  high: '#d32f2f',
  low: '#f57c00',
  overweight: '#ea580c',
  underweight: '#d97706',
  missing: '#0b1f3f',
  pulseMissing: '#687382',
};

export const BMI_CATEGORY = {
  UNDERWEIGHT: 'underweight',
  NORMAL: 'normal',
  OVERWEIGHT: 'overweight',
  OBESE: 'obese',
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
  if (status === 'high' || status === BMI_CATEGORY.OBESE) return MEASUREMENT_COLORS.high;
  if (status === BMI_CATEGORY.OVERWEIGHT) return MEASUREMENT_COLORS.overweight;
  if (status === BMI_CATEGORY.UNDERWEIGHT) return MEASUREMENT_COLORS.underweight;
  if (status === 'low') return MEASUREMENT_COLORS.low;
  if (status === 'normal') return MEASUREMENT_COLORS.normal;
  return MEASUREMENT_COLORS.missing;
};

/** Underweight < 18.5 | Normal 18.5–24.9 | Overweight 25.0–29.9 | Obese ≥ 30.0 */
export const getBmiCategoryStatus = (bmiValue, thresholds = {}) => {
  const value = Number(bmiValue);
  if (!Number.isFinite(value)) return BMI_CATEGORY.NORMAL;

  const normalMin = Number(thresholds.bmiNormal ?? 18.5);
  const overweightMin = Number(thresholds.bmiOverweight ?? 25);
  const obeseMin = Number(thresholds.bmiObese ?? 30);

  if (value < normalMin) return BMI_CATEGORY.UNDERWEIGHT;
  if (value < overweightMin) return BMI_CATEGORY.NORMAL;
  if (value < obeseMin) return BMI_CATEGORY.OVERWEIGHT;
  return BMI_CATEGORY.OBESE;
};

export const checkFatValue = (fatValue, target) => {
  let val = fatValue;
  if (fatValue && typeof fatValue === 'object') {
    val = fatValue.fat ?? fatValue.body_fat;
  }
  const numeric = Number(val);
  if (
    val == null
    || val === ''
    || val === 'N/A'
    || Number.isNaN(numeric)
    || numeric <= 0
  ) {
    return 'normal';
  }

  const min = target?.bodyFatMin ?? target?.body_fat_min ?? 14;
  const max = target?.bodyFatMax ?? target?.body_fat_max ?? 27;
  return getMeasurementAlertStatus(numeric, min, max);
};

export const readOptionalVitalNumber = (value) => {
  if (value == null || value === '' || value === 'N/A' || value === '--') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
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

const pickFirstNumber = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined || value === '' || value === 'N/A') continue;
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
};

export const getCombinedBpAlertLevel = (bpStatus) => {
  if (!bpStatus?.isOutOfRange) return 'normal';
  if (bpStatus.sysStatus === 'high' || bpStatus.diaStatus === 'high') return 'high';
  return 'low';
};

export const checkBPValues = (bpData, target) => {
  if (!bpData || !target) {
    return { sysStatus: 'normal', diaStatus: 'normal', isOutOfRange: false };
  }

  const sys = bpData.systolic_pressure ?? bpData.systolic ?? bpData.last_systolic ?? bpData.sys;
  const dia = bpData.diastolic_pressure ?? bpData.diastolic ?? bpData.last_diastolic ?? bpData.dia;
  const sysMin = pickFirstNumber(
    target.systolicMin,
    target.sysMin,
    target.systolic_min,
    target.systolic_pressure_min,
    target.target_sys_min,
    target.sys_min,
  );
  const sysMax = pickFirstNumber(
    target.systolicMax,
    target.sysMax,
    target.systolic_max,
    target.systolic_pressure_max,
    target.target_sys_max,
    target.sys_max,
  );
  const diaMin = pickFirstNumber(
    target.diastolicMin,
    target.diaMin,
    target.diastolic_min,
    target.diastolic_pressure_min,
    target.target_dia_min,
    target.dia_min,
  );
  const diaMax = pickFirstNumber(
    target.diastolicMax,
    target.diaMax,
    target.diastolic_max,
    target.diastolic_pressure_max,
    target.target_dia_max,
    target.dia_max,
  );

  const sysStatus = (sys != null && sys !== 'N/A' && Number(sys) > 0)
    ? getMeasurementAlertStatus(sys, sysMin, sysMax)
    : 'normal';
  const diaStatus = (dia != null && dia !== 'N/A' && Number(dia) > 0)
    ? getMeasurementAlertStatus(dia, diaMin, diaMax)
    : 'normal';

  return {
    sysStatus,
    diaStatus,
    isOutOfRange: sysStatus !== 'normal' || diaStatus !== 'normal',
  };
};

export const checkBGValue = (bgValue, target) => {
  let val = bgValue;
  if (bgValue && typeof bgValue === 'object') {
    val = bgValue.blood_glucose_value_1
      ?? bgValue.blood_glucose_value
      ?? bgValue.glucose
      ?? bgValue.last_glucose;
  }
  const numeric = Number(val);
  if (
    val === null
    || val === undefined
    || val === ''
    || val === 'N/A'
    || Number.isNaN(numeric)
    || numeric <= 0
    || !target
  ) {
    return 'normal';
  }

  const min = pickFirstNumber(
    target.minimum,
    target.min,
    target.bgMin,
    target.target_bg_min,
    target.bg_min,
  );
  const max = pickFirstNumber(
    target.maximum,
    target.max,
    target.bgMax,
    target.target_bg_max,
    target.bg_max,
  );
  if (min == null || max == null) return 'normal';

  return getMeasurementAlertStatus(numeric, min, max);
};

export const checkPulseValue = (pulseValue, target) => {
  if (pulseValue === null || pulseValue === undefined || pulseValue === '' || pulseValue === 'N/A') {
    return null;
  }
  const numeric = Number(pulseValue);
  if (Number.isNaN(numeric) || numeric <= 0) return null;

  const min = pickFirstNumber(
    target?.pulseMin,
    target?.pulse_min,
    target?.target_pulse_min,
    target?.minPulse,
    target?.min,
  ) ?? DEFAULT_VITAL_TARGETS.pulseMin;
  const max = pickFirstNumber(
    target?.pulseMax,
    target?.pulse_max,
    target?.target_pulse_max,
    target?.maxPulse,
    target?.max,
  ) ?? DEFAULT_VITAL_TARGETS.pulseMax;

  return getMeasurementAlertStatus(numeric, min, max);
};

export const checkWeightValue = (weightKgOrLbs, target) => {
  let weightInLb = null;

  if (weightKgOrLbs && typeof weightKgOrLbs === 'object') {
    const raw = weightKgOrLbs.weight_lbs ?? weightKgOrLbs.weight ?? weightKgOrLbs.last_weight;
    const num = Number(raw);
    if (!Number.isNaN(num) && num > 0) weightInLb = num;
  } else {
    const numeric = Number(weightKgOrLbs);
    if (!Number.isNaN(numeric) && numeric > 0) weightInLb = numeric;
  }

  if (weightInLb == null || !target) return 'normal';

  const min = pickFirstNumber(
    target.weightMin,
    target.weight_min,
    target.target_weight_min,
    target.minLbs,
    target.min,
    target.minimum,
  ) ?? DEFAULT_VITAL_TARGETS.weightMin;
  const max = pickFirstNumber(
    target.weightMax,
    target.weight_max,
    target.target_weight_max,
    target.maxLbs,
    target.max,
    target.maximum,
  ) ?? DEFAULT_VITAL_TARGETS.weightMax;

  return getMeasurementAlertStatus(weightInLb, min, max);
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
