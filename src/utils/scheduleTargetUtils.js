/**
 * Stable sortable instant for a vitals row (local date + time fields from API).
 * Used to pick practice vs patient target mode at reading time.
 */
export const getMeasurementEpochMs = (measurement) => {
  if (!measurement || typeof measurement !== 'object') return Date.now();
  const datePart =
    measurement.measurement_date ||
    (measurement.measure_new_date_time && String(measurement.measure_new_date_time).split('T')[0]) ||
    (measurement.measure_date_time && String(measurement.measure_date_time).split(/\s|T/)[0]) ||
    (measurement.created_at && String(measurement.created_at).split('T')[0]) ||
    '';
  if (!datePart) return Date.now();
  let timePart =
    measurement.measurement_time ||
    (measurement.measure_new_date_time && String(measurement.measure_new_date_time).includes('T')
      ? String(measurement.measure_new_date_time).split('T')[1]?.slice(0, 8)
      : null) ||
    (measurement.measure_date_time && String(measurement.measure_date_time).split(/\s|T/).slice(1).join('T')) ||
    (measurement.created_at && String(measurement.created_at).split('T')[1]?.slice(0, 8)) ||
    '12:00:00';
  timePart = String(timePart).trim();
  const parts = timePart.split(':');
  const hh = String(parts[0] != null && parts[0] !== '' ? parts[0] : '12').padStart(2, '0');
  const mm = String(parts[1] != null && parts[1] !== '' ? String(parts[1]).slice(0, 2) : '00').padStart(2, '0');
  const ssRaw = parts[2] != null ? String(parts[2]).replace(/\D/g, '').slice(0, 2) : '00';
  const ss = String(ssRaw || '00').padStart(2, '0');
  const iso = `${datePart}T${hh}:${mm}:${ss}`;
  const d = new Date(iso);
  const t = d.getTime();
  return Number.isNaN(t) ? Date.now() : t;
};

const isNonEmptyArray = (value) => Array.isArray(value) && value.length > 0;

const isNonEmptyObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;

export const normalizePeriodName = (value) =>
  String(value || '').toLowerCase().replace(/[\s_-]/g, '');

/** Strip "target" / "targetrange" suffixes so "Wake-up Target Range" matches "Wake-up". */
export const normalizeTargetPeriodKey = (value) =>
  normalizePeriodName(value).replace(/targetranges?$/, '').replace(/targets?$/, '');

const periodNamesMatch = (a, b) => {
  const left = normalizeTargetPeriodKey(a);
  const right = normalizeTargetPeriodKey(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
};

const normalizePeriodLookupKey = (value) =>
  normalizePeriodName(value).replace(/time$/i, '');

export const findPeriodByName = (periods, periodName) => {
  if (!Array.isArray(periods) || periods.length === 0 || !periodName) return null;

  const normalizedInput = normalizePeriodName(periodName);
  const inputLookup = normalizePeriodLookupKey(periodName);

  return (
    periods.find((p) => normalizePeriodName(p?.name) === normalizedInput) ||
    periods.find((p) => normalizePeriodLookupKey(p?.name) === inputLookup) ||
    periods.find((p) => {
      const periodLookup = normalizePeriodLookupKey(p?.name);
      return periodLookup.includes(inputLookup) || inputLookup.includes(periodLookup);
    }) ||
    null
  );
};

export const resolvePeriodNameByIdOrLabel = (periods, measurement) => {
  if (!Array.isArray(periods) || periods.length === 0 || !measurement) return null;

  const periodId = measurement?.period_id != null ? String(measurement.period_id) : null;
  if (periodId) {
    const matchedById = periods.find((p) => String(p.id) === periodId);
    if (matchedById?.name) return matchedById.name;
  }

  const rawLabel = measurement?.period_name || measurement?.period || '';
  const normalizedRaw = normalizePeriodName(rawLabel);
  const normalizedRawLookup = normalizePeriodLookupKey(rawLabel);
  if (!normalizedRaw && !normalizedRawLookup) return null;

  const matchedByLabel =
    periods.find((p) => normalizePeriodName(p.name) === normalizedRaw) ||
    periods.find((p) => normalizePeriodLookupKey(p.name) === normalizedRawLookup) ||
    periods.find((p) => {
      const periodLookup = normalizePeriodLookupKey(p.name);
      return periodLookup.includes(normalizedRawLookup) || normalizedRawLookup.includes(periodLookup);
    });
  return matchedByLabel?.name || null;
};

const hasValue = (value) => value !== null && value !== undefined && String(value).trim() !== '';

const getPeriodMergeKey = (period) => {
  const normalizedName = normalizePeriodName(period?.name);
  if (normalizedName) return `name:${normalizedName}`;
  if (period?.id != null) return `id:${String(period.id)}`;
  return 'unknown';
};

const mergePeriodList = (patientList, practiceList) => {
  const patient = Array.isArray(patientList) ? patientList : [];
  const practice = Array.isArray(practiceList) ? practiceList : [];

  if (patient.length === 0) return practice;
  if (practice.length === 0) return patient;

  const patientByKey = new Map(patient.map((p) => [getPeriodMergeKey(p), p]));
  const usedPatientKeys = new Set();

  const merged = practice.map((basePeriod) => {
    const key = getPeriodMergeKey(basePeriod);
    const patientPeriod = patientByKey.get(key);
    if (!patientPeriod) return basePeriod;

    usedPatientKeys.add(key);
    return {
      ...basePeriod,
      ...patientPeriod,
      startTime: hasValue(patientPeriod.startTime) ? patientPeriod.startTime : (basePeriod.startTime || basePeriod.start || ''),
      endTime: hasValue(patientPeriod.endTime) ? patientPeriod.endTime : (basePeriod.endTime || basePeriod.end || ''),
      start: hasValue(patientPeriod.start) ? patientPeriod.start : (basePeriod.start || basePeriod.startTime || ''),
      end: hasValue(patientPeriod.end) ? patientPeriod.end : (basePeriod.end || basePeriod.endTime || '')
    };
  });

  patient.forEach((patientPeriod) => {
    const key = getPeriodMergeKey(patientPeriod);
    if (!usedPatientKeys.has(key) && !practice.some((p) => getPeriodMergeKey(p) === key)) {
      merged.push(patientPeriod);
    }
  });

  return merged;
};

const mergeTargetList = (patientList, practiceList) => {
  const patient = Array.isArray(patientList) ? patientList : [];
  const practice = Array.isArray(practiceList) ? practiceList : [];

  if (patient.length === 0) return practice;
  if (practice.length === 0) return patient;

  const patientByKey = new Map(patient.map((p) => [getPeriodMergeKey(p), p]));
  const usedPatientKeys = new Set();

  const merged = practice.map((baseTarget) => {
    const key = getPeriodMergeKey(baseTarget);
    const patientTarget = patientByKey.get(key);
    if (!patientTarget) return baseTarget;

    usedPatientKeys.add(key);
    return {
      ...baseTarget,
      ...patientTarget
    };
  });

  patient.forEach((patientTarget) => {
    const key = getPeriodMergeKey(patientTarget);
    if (!usedPatientKeys.has(key) && !practice.some((p) => getPeriodMergeKey(p) === key)) {
      merged.push(patientTarget);
    }
  });

  return merged;
};

export const hasAnyScheduleTargets = (data) => {
  if (!data) return false;
  return (
    isNonEmptyArray(data.dailySchedule) ||
    isNonEmptyArray(data.bloodPressureTimePeriod) ||
    isNonEmptyArray(data.bloodPressureTargetRange) ||
    isNonEmptyArray(data.bloodGlucoseTimePeriod) ||
    isNonEmptyArray(data.bloodGlucoseTargetRange) ||
    isNonEmptyArray(data.weightTimePeriod) ||
    isNonEmptyObject(data.weightTargetRange)
  );
};

// Section-wise precedence:
// - Use patient section if it has data
// - Otherwise fallback to practice section
export const resolveEffectiveScheduleTargets = (patientData, practiceData) => {
  const patient = patientData || {};
  const practice = practiceData || {};

  const effective = {
    ...practice,
    ...patient
  };

  // Strict precedence rule:
  // If patient has data for a section, use ONLY patient data for that section.
  // Do not merge with practice data, to avoid accidental fallback mixing.
  effective.dailySchedule = isNonEmptyArray(patient.dailySchedule)
    ? patient.dailySchedule
    : (practice.dailySchedule || []);

  effective.bloodPressureTimePeriod = isNonEmptyArray(patient.bloodPressureTimePeriod)
    ? patient.bloodPressureTimePeriod
    : (practice.bloodPressureTimePeriod || []);

  effective.bloodPressureTargetRange = isNonEmptyArray(patient.bloodPressureTargetRange)
    ? patient.bloodPressureTargetRange
    : (practice.bloodPressureTargetRange || []);

  effective.bloodGlucoseTimePeriod = isNonEmptyArray(patient.bloodGlucoseTimePeriod)
    ? patient.bloodGlucoseTimePeriod
    : (practice.bloodGlucoseTimePeriod || []);

  effective.bloodGlucoseTargetRange = isNonEmptyArray(patient.bloodGlucoseTargetRange)
    ? patient.bloodGlucoseTargetRange
    : (practice.bloodGlucoseTargetRange || []);

  effective.weightTimePeriod = isNonEmptyArray(patient.weightTimePeriod)
    ? patient.weightTimePeriod
    : (practice.weightTimePeriod || []);

  effective.weightTargetRange = isNonEmptyObject(patient.weightTargetRange)
    ? patient.weightTargetRange
    : (practice.weightTargetRange || {});

  return effective;
};

/**
 * When `usePatientTargets` is false, measurement UIs use practice schedule rows only
 * (`is_practice` = practice in the API). When true, patient rows (`is_practice` = patient)
 * win per section when the patient endpoint returns data — controlled in the UI via
 * session preference (see patientScheduleTargetPreference.js).
 */
export const resolveDisplayScheduleTargets = ({ practiceData, patientData, usePatientTargets }) => {
  if (usePatientTargets) {
    return resolveEffectiveScheduleTargets(patientData || {}, practiceData || {});
  }
  return resolveEffectiveScheduleTargets({}, practiceData || {});
};

const pickFirstNumber = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
};

const convertTimeToMinutes = (timeString) => {
  if (!timeString) return 0;
  if (timeString.includes('AM') || timeString.includes('PM')) {
    const [time, ampm] = String(timeString).trim().split(/\s+/);
    const [hh, mm] = time.split(':').map(Number);
    let hour = hh;
    if (ampm?.toUpperCase() === 'PM' && hour !== 12) hour += 12;
    if (ampm?.toUpperCase() === 'AM' && hour === 12) hour = 0;
    return hour * 60 + (mm || 0);
  }
  const [hh, mm] = String(timeString).split(':').map(Number);
  return (hh || 0) * 60 + (mm || 0);
};

export const resolvePeriodByTime = (timeString, periods) => {
  if (!timeString || !Array.isArray(periods) || periods.length === 0) return '';
  const cur = convertTimeToMinutes(timeString);
  for (const p of periods) {
    const start = convertTimeToMinutes(p.startTime || p.start);
    let end = convertTimeToMinutes(p.endTime || p.end);
    if (end < start) end += 1440;
    if (cur >= start && cur <= end) return p.name;
    if (cur + 1440 >= start && cur + 1440 <= end) return p.name;
  }
  return '';
};

export const resolveMeasurementPeriodName = (measurement, periods) => {
  if (!measurement || !Array.isArray(periods) || periods.length === 0) return '';

  const rawLabel =
    measurement.period_name ||
    measurement.period ||
    measurement.measure_note ||
    measurement.note ||
    '';

  if (rawLabel) {
    const fromConfigured = resolvePeriodNameByIdOrLabel(periods, {
      ...measurement,
      period_name: rawLabel
    });
    if (fromConfigured) return fromConfigured;
    const normalizedRaw = normalizePeriodName(rawLabel);
    const direct = periods.find((p) => normalizePeriodName(p?.name) === normalizedRaw);
    if (direct?.name) return direct.name;
    return String(rawLabel);
  }

  const mTime =
    measurement.measurement_time ||
    measurement.measure_new_date_time?.split('T')[1]?.slice(0, 8) ||
    measurement.measure_date_time?.split(' ')[1];
  if (mTime) {
    const timeResolved = resolvePeriodByTime(mTime, periods);
    if (timeResolved) return timeResolved;
  }
  return '';
};

export const getBloodPressureTargetForMeasurement = (measurement, scheduleTargets) => {
  const ranges = Array.isArray(scheduleTargets?.bloodPressureTargetRange)
    ? scheduleTargets.bloodPressureTargetRange
    : [];
  const periods = Array.isArray(scheduleTargets?.bloodPressureTimePeriod)
    ? scheduleTargets.bloodPressureTimePeriod
    : [];
  if (ranges.length === 0) return null;

  const periodName = resolveMeasurementPeriodName(measurement, periods);
  const normalizedInput = normalizeTargetPeriodKey(periodName);
  const period = periods.find((p) => normalizeTargetPeriodKey(p?.name) === normalizedInput);
  const target =
    ranges.find((t) => {
      const targetKey = normalizeTargetPeriodKey(t?.name);
      return (
        periodNamesMatch(t?.name, periodName) ||
        (normalizedInput && targetKey.includes(normalizedInput)) ||
        (normalizedInput && normalizedInput.includes(targetKey)) ||
        t.id === period?.id
      );
    }) || ranges[0];

  return {
    systolicMin: pickFirstNumber(target.systolicMin, target.sysMin, target.systolic_min, target.systolic_pressure_min),
    systolicMax: pickFirstNumber(target.systolicMax, target.sysMax, target.systolic_max, target.systolic_pressure_max),
    diastolicMin: pickFirstNumber(target.diastolicMin, target.diaMin, target.diastolic_min, target.diastolic_pressure_min),
    diastolicMax: pickFirstNumber(target.diastolicMax, target.diaMax, target.diastolic_max, target.diastolic_pressure_max),
    pulseMin: pickFirstNumber(target.pulseMin, target.pulse_min, target.minPulse) ?? 60,
    pulseMax: pickFirstNumber(target.pulseMax, target.pulse_max, target.maxPulse) ?? 100
  };
};

export const getBloodGlucoseTargetForMeasurement = (measurement, scheduleTargets) => {
  const targets = Array.isArray(scheduleTargets?.bloodGlucoseTargetRange)
    ? scheduleTargets.bloodGlucoseTargetRange
    : [];
  if (targets.length === 0) return null;

  const periods = Array.isArray(scheduleTargets?.bloodGlucoseTimePeriod)
    ? scheduleTargets.bloodGlucoseTimePeriod
    : [];
  const periodName = resolveMeasurementPeriodName(measurement, periods);
  const normalizedPeriod = normalizeTargetPeriodKey(periodName);

  const findTargetByNameIncludes = (...needles) =>
    targets.find((t) => {
      const key = normalizeTargetPeriodKey(t?.name);
      return needles.some((needle) => key.includes(needle));
    });

  // Prefer period-specific target rows (Before-Breakfast, After-Lunch, ...),
  // then fall back to legacy Before-Meal / After-Meal shared rows.
  const periodSpecific = findTargetByNameIncludes(normalizedPeriod);
  if (periodSpecific) {
    return {
      minimum: pickFirstNumber(periodSpecific.minimum, periodSpecific.min) ?? 60,
      maximum: pickFirstNumber(periodSpecific.maximum, periodSpecific.max) ?? 110
    };
  }

  if (
    normalizedPeriod === normalizeTargetPeriodKey('Before-Meal') ||
    ['beforebreakfast', 'beforelunch', 'beforedinner'].includes(normalizedPeriod)
  ) {
    const target = findTargetByNameIncludes('beforemeal') || targets[0];
    return {
      minimum: pickFirstNumber(target.minimum, target.min) ?? 60,
      maximum: pickFirstNumber(target.maximum, target.max) ?? 110
    };
  }

  if (
    normalizedPeriod === normalizeTargetPeriodKey('After-Meal') ||
    ['afterbreakfast', 'afterlunch', 'afterdinner'].includes(normalizedPeriod)
  ) {
    const target = findTargetByNameIncludes('aftermeal') || targets[0];
    return {
      minimum: pickFirstNumber(target.minimum, target.min) ?? 70,
      maximum: pickFirstNumber(target.maximum, target.max) ?? 140
    };
  }

  const period = periods.find((p) => normalizeTargetPeriodKey(p?.name) === normalizedPeriod);
  const target =
    targets.find(
      (t) =>
        periodNamesMatch(t?.name, periodName) ||
        periodNamesMatch(t?.periodName, periodName) ||
        t.id === period?.id
    ) || targets[0];

  return {
    minimum: pickFirstNumber(target.minimum, target.min) ?? 60,
    maximum: pickFirstNumber(target.maximum, target.max) ?? 110
  };
};

export const formatTimeWindowLabel = (start, end) => {
  const fmt = (value) => {
    if (!value) return '';
    const raw = String(value).trim();
    if (!raw) return '';
    if (/[ap]m/i.test(raw)) {
      return raw.replace(/\s+/g, ' ').replace(/am/ig, 'AM').replace(/pm/ig, 'PM');
    }
    const mins = convertTimeToMinutes(raw);
    const hour24 = Math.floor(mins / 60) % 24;
    const minute = mins % 60;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${ampm}`;
  };
  const from = fmt(start);
  const to = fmt(end);
  if (!from || !to) return '';
  return `${from}–${to}`;
};

export const buildPeriodWindowsFromSchedule = (periods, fallbackList, fallbackRanges) => {
  if (!Array.isArray(periods) || periods.length === 0) {
    return { periodList: fallbackList, periodTimeRanges: fallbackRanges };
  }
  const periodList = [];
  const periodTimeRanges = {};
  periods.forEach((period) => {
    const name = String(period?.name || '').trim();
    if (!name) return;
    periodList.push(name);
    const label = formatTimeWindowLabel(period.startTime || period.start, period.endTime || period.end);
    if (label) periodTimeRanges[name] = label;
  });
  if (!periodList.length) {
    return { periodList: fallbackList, periodTimeRanges: fallbackRanges };
  }
  return { periodList, periodTimeRanges };
};

export const matchMeasurementToPeriod = (measurement, periods, fallbackName = '') => {
  if (!Array.isArray(periods) || periods.length === 0) return fallbackName;
  const names = new Set(periods.map((period) => period?.name).filter(Boolean));
  const resolved = resolveMeasurementPeriodName(measurement, periods);
  if (resolved && names.has(resolved)) return resolved;
  const time =
    measurement?.measurement_time ||
    measurement?.time_recorded ||
    measurement?.measure_new_date_time?.split('T')[1]?.slice(0, 8) ||
    (measurement?.measure_date_time && String(measurement.measure_date_time).split(/\s|T/)[1]);
  const byTime = time ? resolvePeriodByTime(time, periods) : '';
  if (byTime && names.has(byTime)) return byTime;
  return fallbackName || periods[0]?.name || '';
};

export const getPrimaryBloodPressureTarget = (scheduleTargets) =>
  getBloodPressureTargetForMeasurement({}, scheduleTargets);

export const getPrimaryBloodGlucoseTarget = (scheduleTargets) =>
  getBloodGlucoseTargetForMeasurement({}, scheduleTargets);

export const formatBloodPressureTargetLabel = (target) => {
  if (!target) return '120-140 / 70-90';
  const sysMin = target.systolicMin ?? 120;
  const sysMax = target.systolicMax ?? 140;
  const diaMin = target.diastolicMin ?? 70;
  const diaMax = target.diastolicMax ?? 90;
  return `${sysMin}-${sysMax} / ${diaMin}-${diaMax}`;
};

export const formatBloodGlucoseTargetLabel = (target) => {
  if (!target) return '70-140 mg/dL';
  const min = target.minimum ?? 70;
  const max = target.maximum ?? 140;
  return `${min}-${max} mg/dL`;
};

export const formatWeightTargetLabel = (range) => {
  const min = pickFirstNumber(range?.weightMin, range?.min) ?? 66;
  const max = pickFirstNumber(range?.weightMax, range?.max) ?? 220;
  return `${min}–${max} lbs`;
};

export const getAiTargetBounds = (scheduleTargets) => {
  const bp = getPrimaryBloodPressureTarget(scheduleTargets);
  const bg = getPrimaryBloodGlucoseTarget(scheduleTargets);
  const weight = scheduleTargets?.weightTargetRange && typeof scheduleTargets.weightTargetRange === 'object'
    ? scheduleTargets.weightTargetRange
    : {};
  return {
    systolicMin: bp?.systolicMin ?? 120,
    systolicMax: bp?.systolicMax ?? 140,
    diastolicMin: bp?.diastolicMin ?? 70,
    diastolicMax: bp?.diastolicMax ?? 90,
    pulseMin: bp?.pulseMin ?? 60,
    pulseMax: bp?.pulseMax ?? 100,
    glucoseMin: bg?.minimum ?? 70,
    glucoseMax: bg?.maximum ?? 140,
    weightMin: pickFirstNumber(weight.weightMin, weight.min) ?? 66,
    weightMax: pickFirstNumber(weight.weightMax, weight.max) ?? 220,
    bodyFatMin: pickFirstNumber(weight.bodyFatMin) ?? 14,
    bodyFatMax: pickFirstNumber(weight.bodyFatMax) ?? 27,
    bmiNormal: pickFirstNumber(weight.bmiNormal) ?? 18.5,
    bmiOverweight: pickFirstNumber(weight.bmiOverweight) ?? 25
  };
};
