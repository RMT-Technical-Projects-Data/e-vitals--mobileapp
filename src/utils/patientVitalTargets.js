import {
  DEFAULT_VITAL_TARGETS,
  MEASUREMENT_COLORS,
  checkBGValue,
  checkBPValues,
  checkPulseValue,
  checkWeightValue,
  getCombinedBpAlertLevel,
  getMeasurementAlertStatus,
  getVitalStatusColor,
  normalizeWeightToLbs,
} from './measurementUtils';
import {
  getBloodGlucoseTargetForMeasurement,
  getBloodPressureTargetForMeasurement,
  resolveEffectiveScheduleTargets,
} from './scheduleTargetUtils';

export const resolveFlatTargetsFromRow = (row = {}) => ({
  systolicMin: row.target_sys_min ?? DEFAULT_VITAL_TARGETS.systolicMin,
  systolicMax: row.target_sys_max ?? DEFAULT_VITAL_TARGETS.systolicMax,
  diastolicMin: row.target_dia_min ?? DEFAULT_VITAL_TARGETS.diastolicMin,
  diastolicMax: row.target_dia_max ?? DEFAULT_VITAL_TARGETS.diastolicMax,
  pulseMin: row.target_pulse_min ?? row.pulse_min ?? DEFAULT_VITAL_TARGETS.pulseMin,
  pulseMax: row.target_pulse_max ?? row.pulse_max ?? DEFAULT_VITAL_TARGETS.pulseMax,
  glucoseMin: row.target_bg_min ?? DEFAULT_VITAL_TARGETS.glucoseMin,
  glucoseMax: row.target_bg_max ?? DEFAULT_VITAL_TARGETS.glucoseMax,
  weightMin: row.target_weight_min ?? DEFAULT_VITAL_TARGETS.weightMin,
  weightMax: row.target_weight_max ?? DEFAULT_VITAL_TARGETS.weightMax,
});

const measurementFromReading = (reading = {}) => {
  const rawDate = String(reading.reading_date || reading.assigned_at || '').trim();
  const [datePart, timePart = '12:00:00'] = rawDate.split(/\s+/);
  return {
    measure_date_time: rawDate || undefined,
    measurement_date: datePart || undefined,
    measurement_time: timePart || undefined,
    period_name: reading.period_name,
    period: reading.period,
    measure_note: reading.measure_note,
  };
};

export const resolveEffectiveScheduleForRow = (row, scheduleCache = {}) => {
  const practiceId = row?.practice_id;
  const patientId = row?.patient_id;
  const practiceData = scheduleCache?.practice?.[practiceId] || {};
  const patientData = scheduleCache?.patient?.[`${practiceId}_${patientId}`] || {};
  return resolveEffectiveScheduleTargets(patientData, practiceData);
};

export const getPatientListVitalStatuses = (patient, vitals = {}) => {
  const flat = resolveFlatTargetsFromRow(patient);
  const bpTarget = {
    systolicMin: flat.systolicMin,
    systolicMax: flat.systolicMax,
    diastolicMin: flat.diastolicMin,
    diastolicMax: flat.diastolicMax,
    pulseMin: flat.pulseMin,
    pulseMax: flat.pulseMax,
  };

  const bpParts = String(vitals.bp || '').split('/');
  const sysNum = bpParts[0] ? Number(bpParts[0]) : null;
  const diaNum = bpParts[1] ? Number(bpParts[1]) : null;

  const bpStatus = checkBPValues(
    {
      systolic_pressure: sysNum != null && !Number.isNaN(sysNum) && sysNum > 0 ? sysNum : null,
      diastolic_pressure: diaNum != null && !Number.isNaN(diaNum) && diaNum > 0 ? diaNum : null,
    },
    bpTarget,
  );

  const pulseStatus = vitals.pulse == null
    ? 'normal'
    : (checkPulseValue(vitals.pulse, bpTarget) || 'normal');

  const glucoseStatus = vitals.glucose == null || vitals.glucose === '--'
    ? 'normal'
    : checkBGValue(vitals.glucose, {
      minimum: flat.glucoseMin,
      maximum: flat.glucoseMax,
      target_bg_min: flat.glucoseMin,
      target_bg_max: flat.glucoseMax,
    });

  const weightStatus = vitals.weight == null || vitals.weight === '--'
    ? 'normal'
    : checkWeightValue(vitals.weight, {
      weightMin: flat.weightMin,
      weightMax: flat.weightMax,
      target_weight_min: flat.weightMin,
      target_weight_max: flat.weightMax,
    });

  return { bpStatus, pulseStatus, glucoseStatus, weightStatus };
};

const colorForBpPart = (status) => {
  if (status === 'high') return MEASUREMENT_COLORS.high;
  if (status === 'low') return MEASUREMENT_COLORS.low;
  if (status === 'normal') return MEASUREMENT_COLORS.normal;
  return MEASUREMENT_COLORS.missing;
};

const bpPartColors = (bpStatus) => ({
  sysColor: colorForBpPart(bpStatus?.sysStatus),
  diaColor: colorForBpPart(bpStatus?.diaStatus),
  bpColor: getVitalStatusColor(getCombinedBpAlertLevel(bpStatus)),
});

export const getPatientListVitalColors = (patient, vitals = {}, scheduleCache = null) => {
  const measurement = {
    systolic_pressure: String(vitals.bp || '').split('/')[0],
    diastolic_pressure: String(vitals.bp || '').split('/')[1],
    glucose: vitals.glucose,
    weight: vitals.weight,
    pulse: vitals.pulse,
    reading_date: patient?.reading_date,
  };

  let bpTarget;
  let bgTarget;
  let weightTarget;

  if (scheduleCache) {
    const scheduleTargets = resolveEffectiveScheduleForRow(patient, scheduleCache);
    const flat = resolveFlatTargetsFromRow(patient);
    bpTarget = getBloodPressureTargetForMeasurement(measurementFromReading(patient), scheduleTargets)
      || {
        systolicMin: flat.systolicMin,
        systolicMax: flat.systolicMax,
        diastolicMin: flat.diastolicMin,
        diastolicMax: flat.diastolicMax,
        pulseMin: flat.pulseMin,
        pulseMax: flat.pulseMax,
      };
    bgTarget = getBloodGlucoseTargetForMeasurement(measurementFromReading(patient), scheduleTargets)
      || { minimum: flat.glucoseMin, maximum: flat.glucoseMax };
    weightTarget = scheduleTargets?.weightTargetRange && typeof scheduleTargets.weightTargetRange === 'object'
      ? scheduleTargets.weightTargetRange
      : {
        weightMin: flat.weightMin,
        weightMax: flat.weightMax,
        target_weight_min: flat.weightMin,
        target_weight_max: flat.weightMax,
      };
  } else {
    const statuses = getPatientListVitalStatuses(patient, vitals);
    return {
      ...bpPartColors(statuses.bpStatus),
      pulseColor: getVitalStatusColor(statuses.pulseStatus),
      glucoseColor: getVitalStatusColor(statuses.glucoseStatus),
      weightColor: getVitalStatusColor(statuses.weightStatus),
      isPulseAbnormal: statuses.pulseStatus === 'high' || statuses.pulseStatus === 'low',
    };
  }

  const bpStatus = checkBPValues(
    {
      systolic_pressure: measurement.systolic_pressure,
      diastolic_pressure: measurement.diastolic_pressure,
    },
    bpTarget,
  );
  const pulseStatus = vitals.pulse == null
    ? 'normal'
    : (checkPulseValue(vitals.pulse, bpTarget) || 'normal');
  const glucoseStatus = vitals.glucose == null || vitals.glucose === '--'
    ? 'normal'
    : checkBGValue(vitals.glucose, bgTarget);
  const weightStatus = vitals.weight == null || vitals.weight === '--'
    ? 'normal'
    : checkWeightValue(vitals.weight, weightTarget);

  return {
    ...bpPartColors(bpStatus),
    pulseColor: getVitalStatusColor(pulseStatus),
    glucoseColor: getVitalStatusColor(glucoseStatus),
    weightColor: getVitalStatusColor(weightStatus),
    isPulseAbnormal: pulseStatus === 'high' || pulseStatus === 'low',
  };
};

export const getAssignedReadingVitalColors = (reading, parsed, scheduleCache = null) => {
  const vitals = {
    bp: parsed.sys != null && parsed.dia != null ? `${parsed.sys}/${parsed.dia}` : '--',
    pulse: parsed.pulse,
    glucose: parsed.glucose != null ? String(parsed.glucose) : null,
    weight: parsed.weight != null ? String(parsed.weight) : null,
  };
  const colors = getPatientListVitalColors(reading, vitals, scheduleCache);
  return {
    ...colors,
    glucoseColor: parsed.glucose != null ? colors.glucoseColor : MEASUREMENT_COLORS.missing,
    weightColor: parsed.weight != null ? colors.weightColor : MEASUREMENT_COLORS.missing,
    pulseColor: parsed.pulse != null ? colors.pulseColor : MEASUREMENT_COLORS.pulseMissing,
    isPulseAbnormal: parsed.pulse != null ? colors.isPulseAbnormal : false,
  };
};

export const missingVitalColor = MEASUREMENT_COLORS.missing;

const measurementFromDataListItem = (item = {}) => ({
  measure_date_time: item.rawDateTime || undefined,
  measurement_date: item.dateYmd || undefined,
  measurement_time: item.timeHms || item.time || undefined,
  period_name: item.period_name || item.period,
  period: item.period || item.period_name,
  measure_note: item.period_name || item.period,
});

/** Period-aware row colors for DataList (matches web PatientRpmOverview table). */
export const getDataListRowColors = (item, dataType, scheduleTargets = null) => {
  const effective = scheduleTargets && typeof scheduleTargets === 'object' ? scheduleTargets : {};
  const measurement = measurementFromDataListItem(item);

  if (dataType === 'bloodPressure') {
    const bpTarget = getBloodPressureTargetForMeasurement(measurement, effective) || {
      systolicMin: DEFAULT_VITAL_TARGETS.systolicMin,
      systolicMax: DEFAULT_VITAL_TARGETS.systolicMax,
      diastolicMin: DEFAULT_VITAL_TARGETS.diastolicMin,
      diastolicMax: DEFAULT_VITAL_TARGETS.diastolicMax,
      pulseMin: DEFAULT_VITAL_TARGETS.pulseMin,
      pulseMax: DEFAULT_VITAL_TARGETS.pulseMax,
    };
    const sysStatus = getMeasurementAlertStatus(item.systolic, bpTarget.systolicMin, bpTarget.systolicMax);
    const diaStatus = getMeasurementAlertStatus(item.diastolic, bpTarget.diastolicMin, bpTarget.diastolicMax);
    const pulseStatus = item.pulse != null && item.pulse !== ''
      ? checkPulseValue(item.pulse, bpTarget)
      : null;

    return {
      sysColor: getVitalStatusColor(sysStatus),
      diaColor: getVitalStatusColor(diaStatus),
      pulseColor: pulseStatus
        ? getVitalStatusColor(pulseStatus || 'normal')
        : MEASUREMENT_COLORS.pulseMissing,
      isPulseAbnormal: pulseStatus === 'high' || pulseStatus === 'low',
    };
  }

  if (dataType === 'bloodGlucose') {
    const bgTarget = getBloodGlucoseTargetForMeasurement(measurement, effective) || {
      minimum: DEFAULT_VITAL_TARGETS.glucoseMin,
      maximum: DEFAULT_VITAL_TARGETS.glucoseMax,
    };
    const glucoseStatus = checkBGValue(item.glucose, bgTarget);
    return {
      glucoseColor: getVitalStatusColor(glucoseStatus || 'normal'),
    };
  }

  const weightTarget = effective?.weightTargetRange && typeof effective.weightTargetRange === 'object'
    ? effective.weightTargetRange
    : {
      weightMin: DEFAULT_VITAL_TARGETS.weightMin,
      weightMax: DEFAULT_VITAL_TARGETS.weightMax,
    };
  const wtLbs = normalizeWeightToLbs(item.weight, item.unit);
  const weightStatus = checkWeightValue(wtLbs, weightTarget);
  return {
    weightColor: getVitalStatusColor(weightStatus || 'normal'),
  };
};
