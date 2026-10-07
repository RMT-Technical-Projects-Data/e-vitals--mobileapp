/*  DataList.js – Patient measurement logs (BP, BG, Weight)  */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart } from 'react-native-chart-kit';
import apiService from '../../services/apiService';
import { lockToLandscape, lockToPortrait } from '../../utils/orientationHelper';
import FullTrendChartModal from '../../components/common/FullTrendChartModal';
import DatePickerModal from '../../components/common/DatePickerModal';
import { getDashboardTheme } from '../../constants/dashboardThemes';
import PulseIcon from '../../components/common/PulseIcon';
import { getDataListRowColors } from '../../utils/patientVitalTargets';
import {
  checkBGValue,
  checkPulseValue,
  checkWeightValue,
  DEFAULT_VITAL_TARGETS,
  getMeasurementAlertStatus,
  readOptionalVitalNumber,
} from '../../utils/measurementUtils';
import {
  getBloodGlucoseTargetForMeasurement,
  getBloodPressureTargetForMeasurement,
  resolveEffectiveScheduleTargets,
} from '../../utils/scheduleTargetUtils';

const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

const scaleWidth = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.25);
const scaleHeight = (size) => Math.min((height / guidelineBaseHeight) * size, size * 1.25);
const scaleFont = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.2);

const PATIENT_SCREEN_BG_COLORS = ['#ffffff', '#ffffff', '#ffffff'];
const DEFAULT_SCREEN_BG_COLORS = ['#ffffff', '#ffffff', '#ffffff'];
const TEXT_DARK = '#0b1f3f';
const TEXT_MUTED = '#687382';
const WHITE = '#FFFFFF';
const BORDER_SOFT = 'rgba(15, 23, 42, 0.08)';

const parseInputDate = (dateString) => {
  if (!dateString) return new Date();
  const parts = dateString.split('/');
  if (parts.length === 3) {
    const month = parseInt(parts[0], 10) - 1;
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    const fullYear = parts[2].length === 2 ? 2000 + year : year;
    return new Date(fullYear, month, day);
  }
  return new Date(dateString);
};

const formatDateForDisplay = (date) => date.toLocaleDateString('en-US', {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
});


/* ──────────────────────  DROPDOWN OPTIONS  ────────────────────── */
const periodOptions = [
  'Last 30 days',
  'Last 7 days',
  'Last 14 days',
  'Last 60 days',
  'Last 90 days',
  'All',
];
const sortOptions = {
  bloodPressure: [
    'Date (newest first)',
    'Date (oldest first)',
    'Systolic (high)',
    'Systolic (low)',
    'Diastolic (high)',
    'Diastolic (low)',
    'Pulse (high)',
    'Pulse (low)',
  ],
  bloodGlucose: [
    'Date (newest first)',
    'Date (oldest first)',
    'Glucose (high)',
    'Glucose (low)',
  ],
  weight: [
    'Date (newest first)',
    'Date (oldest first)',
    'Weight (high)',
    'Weight (low)',
  ],
};

/* ──────────────────────  CUSTOM DROPDOWN  ────────────────────── */
const dropdownStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    backgroundColor: WHITE,
    borderRadius: scaleWidth(20),
    width: width * 0.85,
    maxHeight: scaleHeight(300),
    padding: scaleWidth(8),
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    shadowColor: '#0b1f3f',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  dropdownItem: {
    padding: scaleHeight(14),
    borderBottomWidth: 1,
    borderColor: BORDER_SOFT,
    backgroundColor: WHITE,
  },
  dropdownItemText: {
    fontSize: scaleFont(14),
    color: TEXT_DARK,
    fontWeight: '700',
  },
});

const extractWallClockDateYmd = (value) => {
  if (value == null || value === '') return '';
  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
};

const extractWallClockTimeHms = (value) => {
  if (value == null || value === '') return '';
  const raw = String(value).trim();
  if (/AM|PM/i.test(raw)) return raw;

  const isoMatch = raw.match(/T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (isoMatch) {
    return `${isoMatch[1]}:${isoMatch[2]}:${isoMatch[3] || '00'}`;
  }

  const spaceTime = raw.includes(' ')
    ? raw.split(/\s+/).slice(1).join(' ')
    : raw;
  const timeMatch = spaceTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!timeMatch) return '';
  return `${String(timeMatch[1]).padStart(2, '0')}:${timeMatch[2]}:${timeMatch[3] || '00'}`;
};

const getMeasurementWallClockDateYmd = (measurement) =>
  extractWallClockDateYmd(measurement?.measurement_date) ||
  extractWallClockDateYmd(measurement?.measure_date_time) ||
  extractWallClockDateYmd(measurement?.measure_new_date_time) ||
  extractWallClockDateYmd(measurement?.created_at) ||
  '';

const getMeasurementWallClockTimeHms = (measurement) =>
  extractWallClockTimeHms(measurement?.measurement_time) ||
  extractWallClockTimeHms(measurement?.measure_date_time) ||
  extractWallClockTimeHms(measurement?.measure_new_date_time) ||
  extractWallClockTimeHms(measurement?.created_at) ||
  '';

const formatMeasurementTableDate = (dateString) => {
  const ymd = extractWallClockDateYmd(dateString);
  if (!ymd) return dateString || '';
  const [year, month, day] = ymd.split('-');
  return `${month}-${day}-${year}`;
};

const formatMeasurementTableTime = (timeString) => {
  if (timeString == null || timeString === '') return '';
  const raw = String(timeString).trim();
  if (/AM|PM/i.test(raw)) return raw;

  const hms = extractWallClockTimeHms(raw);
  if (!hms) return '';
  const [hStr, mStr] = hms.split(':');
  const h = Number(hStr);
  if (!Number.isFinite(h)) return '';
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHours = h % 12 || 12;
  return `${displayHours}:${mStr} ${period}`;
};

const PERIOD_TIME_WINDOWS = {
  bloodPressure: {
    'Wake-up': '06:01 AM – 08:00 AM',
    Morning: '08:01 AM – 11:00 AM',
    Noon: '11:01 AM – 02:00 PM',
    Afternoon: '02:01 PM – 06:00 PM',
    Evening: '06:01 PM – 06:00 AM',
  },
  bloodGlucose: {
    'Wake up': '06:00 AM – 07:00 AM',
    'Wake-up Time': '06:00 AM – 07:00 AM',
    'Before-Breakfast': '07:01 AM – 09:00 AM',
    'After-Breakfast': '09:01 AM – 11:00 AM',
    'Before-Lunch': '11:01 AM – 01:00 PM',
    'After-Lunch': '01:01 PM – 05:00 PM',
    'Before-Dinner': '05:01 PM – 07:00 PM',
    'After-Dinner': '07:01 PM – 08:29 PM',
    Bedtime: '08:30 PM – 09:59 PM',
    Midnight: '10:00 PM – 05:59 AM',
  },
  weight: {
    Morning: '06:00 AM – 11:59 AM',
    Afternoon: '12:00 PM – 05:59 PM',
    Evening: '06:00 PM – 05:59 AM',
  },
};

const getPeriodTimeWindow = (periodName, type) => {
  if (!periodName || periodName === 'All') return '';
  const typeMap = PERIOD_TIME_WINDOWS[type] || {};
  if (typeMap[periodName]) return typeMap[periodName];
  const lower = String(periodName).toLowerCase();
  const matchKey = Object.keys(typeMap).find((k) => k.toLowerCase() === lower);
  return matchKey ? typeMap[matchKey] : '';
};

const CustomDropdown = ({ visible, options, onSelect, onClose }) => {
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={dropdownStyles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View onStartShouldSetResponder={() => true} style={dropdownStyles.dropdownMenu}>
          {options.map((item) => (
            <TouchableOpacity
              key={item}
              style={dropdownStyles.dropdownItem}
              onPress={() => {
                onSelect(item);
                onClose();
              }}>
              <Text style={dropdownStyles.dropdownItemText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

/* ──────────────────────  MAIN COMPONENT  ────────────────────── */
const DataList = ({ navigation, route }) => {
  const {
    dataType = 'bloodPressure',
    patientId: routePatientId,
    practiceId: routePracticeId,
    dashboardRole = 'patient',
  } = route.params || {};
  const { accent: themePrimary, accentSoft: themeSoft, chartSecondary } = getDashboardTheme(dashboardRole);
  const screenBgColors = dashboardRole === 'patient' ? PATIENT_SCREEN_BG_COLORS : DEFAULT_SCREEN_BG_COLORS;
  const styles = useMemo(() => createStyles(themePrimary, themeSoft), [themePrimary, themeSoft]);
  const trendChartWidth = useMemo(() => {
    const contentPadding = Math.max(scaleWidth(20), 20);
    const cardPadding = scaleWidth(16);
    return Math.floor(width - contentPadding * 2 - cardPadding * 2);
  }, []);

  const [selectedPeriod, setSelectedPeriod] = useState('7 days'); // Default to '7 days'
  const [selectedSlotFilter, setSelectedSlotFilter] = useState('All');
  const [sortBy, setSortBy] = useState('Date (newest first)');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dateRangeType, setDateRangeType] = useState('range');
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [rawMeasurements, setRawMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scheduleTargets, setScheduleTargets] = useState(null);

  // Changes Added 
  // Calendar states
  const [showCalendar, setShowCalendar] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState('from'); // 'from' or 'to'
  const [showChartModal, setShowChartModal] = useState(false);
  const [activeTab, setActiveTab] = useState('Data List');

  const getPeriodListForType = (type) => {
    if (type === 'bloodPressure') {
      return ['Wake-up', 'Morning', 'Noon', 'Afternoon', 'Evening'];
    }
    if (type === 'bloodGlucose') {
      return [
        'Wake up',
        'Before-Breakfast',
        'After-Breakfast',
        'Before-Lunch',
        'After-Lunch',
        'Before-Dinner',
        'After-Dinner',
        'Bedtime',
        'Midnight',
      ];
    }
    if (type === 'weight') {
      return ['Morning', 'Afternoon', 'Evening'];
    }
    return ['Morning', 'Afternoon', 'Evening'];
  };

  const getPeriodOptionsForType = (type) => ['All', ...getPeriodListForType(type)];

  const convertTimeToMinutes = (timeStr) => {
    if (!timeStr) return null;
    const str = String(timeStr).trim();
    if (str.includes('AM') || str.includes('PM')) {
      const match = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (!match) return null;
      let hh = parseInt(match[1], 10);
      const mm = parseInt(match[2], 10);
      const meridiem = match[3] ? match[3].toUpperCase() : null;
      if (meridiem === 'PM' && hh < 12) hh += 12;
      if (meridiem === 'AM' && hh === 12) hh = 0;
      return hh * 60 + mm;
    }
    const match2 = str.match(/(\d{1,2}):(\d{2})/);
    if (!match2) return null;
    const h = parseInt(match2[1], 10);
    const m = parseInt(match2[2], 10);
    return h * 60 + m;
  };

  const getPeriodNameForMeasurement = (item, type) => {
    const rawPeriod = item.period_name || item.period || item.measure_note || item.note || '';
    if (rawPeriod) {
      const pLower = String(rawPeriod).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (type === 'bloodPressure') {
        if (pLower.includes('wakeup') || pLower.includes('wake')) return 'Wake-up';
        if (pLower.includes('aftern')) return 'Afternoon';
        if (pLower.includes('morn')) return 'Morning';
        if (pLower.includes('noon')) return 'Noon';
        if (pLower.includes('even')) return 'Evening';
      } else if (type === 'bloodGlucose') {
        if (pLower.includes('wakeup') || pLower.includes('wake')) return 'Wake up';
        if (pLower.includes('before') && pLower.includes('break')) return 'Before-Breakfast';
        if (pLower.includes('after') && pLower.includes('break')) return 'After-Breakfast';
        if (pLower.includes('before') && pLower.includes('lunch')) return 'Before-Lunch';
        if (pLower.includes('after') && pLower.includes('lunch')) return 'After-Lunch';
        if (pLower.includes('before') && pLower.includes('dinn')) return 'Before-Dinner';
        if (pLower.includes('after') && pLower.includes('dinn')) return 'After-Dinner';
        if (pLower.includes('bed')) return 'Bedtime';
        if (pLower.includes('midn') || pLower.includes('night')) return 'Midnight';
      } else if (type === 'weight') {
        if (pLower.includes('aftern')) return 'Afternoon';
        if (pLower.includes('morn')) return 'Morning';
        if (pLower.includes('noon')) return 'Afternoon';
        if (pLower.includes('even') || pLower.includes('night')) return 'Evening';
      }
    }

    // Exact Web Time Windows (matching web measurementPeriodUtils.js)
    const timeStr = item.timeHms || getMeasurementWallClockTimeHms(item) || item.time || item.created_at || '';
    const current = convertTimeToMinutes(timeStr);

    if (current != null) {
      if (type === 'bloodPressure') {
        if (current >= 361 && current <= 480) return 'Wake-up'; // 06:01 AM - 08:00 AM
        if (current >= 481 && current <= 660) return 'Morning'; // 08:01 AM - 11:00 AM
        if (current >= 661 && current <= 840) return 'Noon';    // 11:01 AM - 02:00 PM
        if (current >= 841 && current <= 1080) return 'Afternoon'; // 02:01 PM - 06:00 PM
        return 'Evening'; // 06:01 PM - 06:00 AM (Overnight)
      }

      if (type === 'bloodGlucose') {
        if (current >= 360 && current <= 420) return 'Wake up'; // 06:00 AM - 07:00 AM
        if (current >= 421 && current <= 540) return 'Before-Breakfast'; // 07:01 AM - 09:00 AM
        if (current >= 541 && current <= 660) return 'After-Breakfast';  // 09:01 AM - 11:00 AM
        if (current >= 661 && current <= 780) return 'Before-Lunch';     // 11:01 AM - 01:00 PM
        if (current >= 781 && current <= 1020) return 'After-Lunch';    // 01:01 PM - 05:00 PM
        if (current >= 1021 && current <= 1140) return 'Before-Dinner'; // 05:01 PM - 07:00 PM
        if (current >= 1141 && current <= 1229) return 'After-Dinner';  // 07:01 PM - 08:29 PM
        if (current >= 1230 && current <= 1319) return 'Bedtime';       // 08:30 PM - 09:59 PM
        return 'Midnight'; // 10:00 PM - 05:59 AM (Overnight)
      }

      if (type === 'weight') {
        if (current >= 360 && current <= 719) return 'Morning';   // 06:00 AM - 11:59 AM
        if (current >= 720 && current <= 1079) return 'Afternoon'; // 12:00 PM - 05:59 PM
        return 'Evening'; // 06:00 PM - 05:59 AM (Overnight)
      }
    }

    return type === 'bloodGlucose' ? 'Wake up' : 'Morning';
  };


  /* ───── DATE FILTER LOGIC ───── */
  const usesCustomRange = dateRangeType === 'custom' || selectedPeriod === 'Custom range';

  const getDateRange = () => {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    end.setHours(23, 59, 59, 999);

    if (usesCustomRange) {
      if (fromDate && toDate) {
        start = parseInputDate(fromDate);
        start.setHours(0, 0, 0, 0);
        end = parseInputDate(toDate);
        end.setHours(23, 59, 59, 999);
      } else {
        start = new Date('2000-01-01');
        end = new Date('2099-12-31');
      }
      return { start, end };
    }

    if (selectedPeriod === 'All' || String(selectedPeriod).toUpperCase() === 'ALL') {
      start = new Date('2000-01-01');
      end = new Date('2099-12-31');
    } else {
      const days = parseInt(String(selectedPeriod).replace(/\D/g, ''), 10) || 30;
      start.setDate(now.getDate() - days);
      start.setHours(0, 0, 0, 0);
    }

    return { start, end };
  };

  /* ───── SORT LOGIC ───── */
  const sortMetric = useMemo(() => {
    const label = String(sortBy || '').toLowerCase();
    if (label.includes('systolic')) return 'systolic';
    if (label.includes('diastolic')) return 'diastolic';
    if (label.includes('pulse')) return 'pulse';
    if (label.includes('glucose')) return 'glucose';
    if (label.includes('weight')) return 'weight';
    return null;
  }, [sortBy]);

  const sortLevel = useMemo(() => {
    const label = String(sortBy || '').toLowerCase();
    if (label.includes('(low') || label.includes('low-high') || label.includes('lowest')) return 'low';
    if (label.includes('(high') || label.includes('high-low') || label.includes('highest')) return 'high';
    return null;
  }, [sortBy]);

  const readingAlertStatus = useCallback((item, metric) => {
    const effective = scheduleTargets && typeof scheduleTargets === 'object' ? scheduleTargets : {};
    const measurement = {
      measure_date_time: item.rawDateTime,
      measurement_date: item.dateYmd,
      measurement_time: item.timeHms || item.time,
      period_name: item.period_name || item.period,
      period: item.period || item.period_name,
      measure_note: item.period_name || item.period,
    };

    if (metric === 'systolic' || metric === 'diastolic' || metric === 'pulse') {
      const bpTarget = getBloodPressureTargetForMeasurement(measurement, effective) || {
        systolicMin: DEFAULT_VITAL_TARGETS.systolicMin,
        systolicMax: DEFAULT_VITAL_TARGETS.systolicMax,
        diastolicMin: DEFAULT_VITAL_TARGETS.diastolicMin,
        diastolicMax: DEFAULT_VITAL_TARGETS.diastolicMax,
        pulseMin: DEFAULT_VITAL_TARGETS.pulseMin,
        pulseMax: DEFAULT_VITAL_TARGETS.pulseMax,
      };
      if (metric === 'systolic') {
        return getMeasurementAlertStatus(item.systolic, bpTarget.systolicMin, bpTarget.systolicMax);
      }
      if (metric === 'diastolic') {
        return getMeasurementAlertStatus(item.diastolic, bpTarget.diastolicMin, bpTarget.diastolicMax);
      }
      return checkPulseValue(item.pulse, bpTarget);
    }

    if (metric === 'glucose') {
      const bgTarget = getBloodGlucoseTargetForMeasurement(measurement, effective) || {
        minimum: DEFAULT_VITAL_TARGETS.glucoseMin,
        maximum: DEFAULT_VITAL_TARGETS.glucoseMax,
      };
      return checkBGValue(item.glucose, bgTarget);
    }

    const weightTarget = effective.weightTargetRange && typeof effective.weightTargetRange === 'object'
      ? effective.weightTargetRange
      : {
        weightMin: DEFAULT_VITAL_TARGETS.weightMin,
        weightMax: DEFAULT_VITAL_TARGETS.weightMax,
      };
    return checkWeightValue(item.weight, weightTarget);
  }, [scheduleTargets]);

  const metricValue = (item, metric) => {
    const value = Number(item?.[metric]);
    return Number.isFinite(value) ? value : 0;
  };

  const sortData = useCallback((data) => {
    const sorted = [...data];
    if (sortBy === 'Date (oldest first)') {
      sorted.sort((a, b) => a.timestamp - b.timestamp);
      return sorted;
    }
    if (sortMetric) {
      const direction = sortLevel === 'low' ? 1 : -1;
      sorted.sort((a, b) => (metricValue(a, sortMetric) - metricValue(b, sortMetric)) * direction);
      return sorted;
    }
    sorted.sort((a, b) => b.timestamp - a.timestamp);
    return sorted;
  }, [sortBy, sortLevel, sortMetric]);

  /* ───── FETCH & FILTER DATA ───── */
  const resolveMeasurementIds = useCallback(async () => {
    if (routePracticeId && routePatientId) {
      return {
        practiceId: String(routePracticeId),
        patientId: String(routePatientId),
      };
    }

    let practiceId = routePracticeId || await AsyncStorage.getItem('practiceId');
    let patientId = routePatientId || await AsyncStorage.getItem('patientId');

    // Patient quick-access: refresh IDs from latest-vitals (same source as dashboard hero)
    if (dashboardRole === 'patient' && !routePatientId) {
      try {
        const vitalsRes = await apiService.getLatestVitals();
        if (vitalsRes?.success && vitalsRes.data) {
          if (vitalsRes.data.practice_id) {
            practiceId = String(vitalsRes.data.practice_id);
            await AsyncStorage.setItem('practiceId', practiceId);
          }
          if (vitalsRes.data.patients_table_id) {
            patientId = String(vitalsRes.data.patients_table_id);
            await AsyncStorage.setItem('patientId', patientId);
          }
        }
      } catch (e) {
        console.log('Could not resolve patient IDs from latest vitals', e);
      }
    }

    if (!practiceId || !patientId) {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        practiceId = practiceId || (user.practice_id ? String(user.practice_id) : null);
        patientId = patientId || (user.patients_table_id ? String(user.patients_table_id) : null);

        if (practiceId) await AsyncStorage.setItem('practiceId', practiceId);
        if (patientId) await AsyncStorage.setItem('patientId', patientId);
      }
    }

    if (!practiceId || !patientId) {
      try {
        const userResult = await apiService.getCurrentUser();
        const user = userResult?.data?.user || userResult?.data;
        if (user) {
          practiceId = practiceId || (user.practice_id ? String(user.practice_id) : null);
          patientId = patientId || (user.patients_table_id ? String(user.patients_table_id) : null);

          if (practiceId) await AsyncStorage.setItem('practiceId', practiceId);
          if (patientId) await AsyncStorage.setItem('patientId', patientId);
        }
      } catch (e) {
        console.log('Could not fetch user for ID resolution', e);
      }
    }

    return { practiceId, patientId };
  }, [routePatientId, routePracticeId, dashboardRole]);

  const extractMeasurements = (result) => {
    if (!result) return [];
    if (Array.isArray(result.data)) return result.data;
    if (result.data?.measurements) {
      const nested = result.data.measurements;
      return Array.isArray(nested) ? nested : [nested];
    }
    return [];
  };

  const loadScheduleTargets = useCallback(async (practiceId, patientId) => {
    try {
      const [practiceRes, patientRes] = await Promise.all([
        apiService.getPracticeScheduleTargets(practiceId),
        apiService.getPatientScheduleTargets(practiceId, patientId),
      ]);
      const effective = resolveEffectiveScheduleTargets(
        patientRes?.data || {},
        practiceRes?.data || {},
      );
      setScheduleTargets(effective);
    } catch (targetErr) {
      console.warn('Failed to load schedule targets for DataList:', targetErr?.message || targetErr);
      setScheduleTargets(null);
    }
  }, []);

  const fetchPatientData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { practiceId, patientId } = await resolveMeasurementIds();

      if (!practiceId || !patientId) {
        throw new Error('Practice ID or Patient ID missing');
      }

      loadScheduleTargets(practiceId, patientId);

      const { start, end } = getDateRange();

      // Format dates for API (YYYY-MM-DD)
      const formatDateForAPI = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const shouldFilterByDate = usesCustomRange
        ? Boolean(fromDate && toDate)
        : selectedPeriod !== 'All';
      const fromDateStr = shouldFilterByDate ? formatDateForAPI(start) : null;
      const toDateStr = shouldFilterByDate ? formatDateForAPI(end) : null;

      const rawList = [];
      let result = null;

      // Fetch data using the same practice-scoped APIs as caregiver/provider views
      if (dataType === 'bloodPressure') {
        result = await apiService.getBloodPressure(practiceId, patientId, {
          fromDate: fromDateStr,
          toDate: toDateStr,
        });

        const measurements = extractMeasurements(result);

        measurements.forEach((bp) => {
          const ymd = getMeasurementWallClockDateYmd(bp);
          const hms = getMeasurementWallClockTimeHms(bp);
          const dateLabel = formatDate(ymd || bp.measure_date_time || bp.created_at);
          const timeLabel = formatTime(hms || bp.measure_date_time || bp.created_at);

          const rawDateStr = bp.measure_new_date_time || bp.measure_date_time || bp.created_at;
          const parsedDate = new Date(String(rawDateStr).replace(' ', 'T'));
          const ts = !isNaN(parsedDate.getTime()) ? parsedDate.getTime() : Date.now();

          rawList.push({
            id: bp.id || bp.measure_new_date_time || Date.now(),
            timestamp: ts,
            date: dateLabel,
            dateYmd: ymd,
            rawDateTime: rawDateStr,
            time: timeLabel,
            timeHms: hms,
            period_name: bp.period_name || bp.period || bp.measure_note || bp.note || '',
            period: bp.period || bp.period_name || '',
            systolic: parseFloat(bp.systolic_pressure || bp.systolic || 0),
            diastolic: parseFloat(bp.diastolic_pressure || bp.diastolic || 0),
            pulse: parseFloat(bp.pulse || bp.heart_rate || 0),
          });
        });
      } else if (dataType === 'bloodGlucose') {
        result = await apiService.getBloodGlucose(practiceId, patientId, {
          fromDate: fromDateStr,
          toDate: toDateStr,
        });

        const measurements = extractMeasurements(result);

        measurements.forEach((bg) => {
          const ymd = getMeasurementWallClockDateYmd(bg);
          const hms = getMeasurementWallClockTimeHms(bg);
          const dateLabel = formatDate(ymd || bg.measure_date_time || bg.created_at);
          const timeLabel = formatTime(hms || bg.measure_date_time || bg.created_at);

          const rawDateStr = bg.measure_new_date_time || bg.measure_date_time || bg.created_at;
          const parsedDate = new Date(String(rawDateStr).replace(' ', 'T'));
          const ts = !isNaN(parsedDate.getTime()) ? parsedDate.getTime() : Date.now();

          rawList.push({
            id: bg.id || bg.measure_new_date_time || Date.now(),
            timestamp: ts,
            date: dateLabel,
            dateYmd: ymd,
            rawDateTime: rawDateStr,
            time: timeLabel,
            timeHms: hms,
            period_name: bg.period_name || bg.period || bg.measure_note || bg.note || '',
            period: bg.period || bg.period_name || '',
            glucose: parseFloat(bg.blood_glucose_value_1 || bg.blood_glucose_value || bg.value || 0),
          });
        });
      } else if (dataType === 'weight') {
        result = await apiService.getWeight(practiceId, patientId, {
          fromDate: fromDateStr,
          toDate: toDateStr,
        });

        const measurements = extractMeasurements(result);

        measurements.forEach((w) => {
          const ymd = getMeasurementWallClockDateYmd(w);
          const hms = getMeasurementWallClockTimeHms(w);
          const dateLabel = formatDate(ymd || w.measure_date_time || w.created_at);
          const timeLabel = formatTime(hms || w.measure_date_time || w.created_at);

          const rawDateStr = w.measure_new_date_time || w.measure_date_time || w.created_at;
          const parsedDate = new Date(String(rawDateStr).replace(' ', 'T'));
          const ts = !isNaN(parsedDate.getTime()) ? parsedDate.getTime() : Date.now();
          let rawVal = parseFloat(w.weight || w.weight_value || w.value || 0);
          let weightInLbs = 0;
          if (rawVal > 0) {
            weightInLbs = parseFloat(rawVal.toFixed(1));
          }

          rawList.push({
            id: w.id || w.measure_new_date_time || Date.now(),
            timestamp: ts,
            date: dateLabel,
            dateYmd: ymd,
            rawDateTime: rawDateStr,
            time: timeLabel,
            timeHms: hms,
            period_name: w.period_name || w.period || w.measure_note || w.note || '',
            period: w.period || w.period_name || '',
            weight: weightInLbs,
            fat: readOptionalVitalNumber(w.fat ?? w.body_fat),
            bmi: readOptionalVitalNumber(w.bmi),
            unit: 'lb',
          });
        });
      }

      setRawMeasurements(rawList);
    } catch (err) {
      console.log('❌ Error fetching patient data:', err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [dataType, selectedPeriod, fromDate, toDate, dateRangeType, resolveMeasurementIds, loadScheduleTargets]);

  useEffect(() => {
    fetchPatientData();
  }, [fetchPatientData]);

  /* ───── HELPERS ───── */
  const formatDate = (val) => {
    if (!val) return '--';
    const ymd = typeof val === 'object' ? getMeasurementWallClockDateYmd(val) : (extractWallClockDateYmd(val) || (val.includes('-') ? val : ''));
    if (ymd) {
      const [year, month, day] = ymd.split('-');
      return `${parseInt(month, 10)}/${parseInt(day, 10)}/${year.slice(2)}`;
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear().toString().slice(2)}`;
    }
    return String(val);
  };

  const formatTime = (val) => {
    if (!val) return '--';
    const hms = typeof val === 'object' ? getMeasurementWallClockTimeHms(val) : (extractWallClockTimeHms(val) || val);
    if (hms) {
      return formatMeasurementTableTime(hms);
    }
    return String(val);
  };

  /* ───── ADD Chnages ───── */
  const getDateRangeLabel = () => {
    if (usesCustomRange && fromDate && toDate) {
      return `${fromDate} to ${toDate}`;
    }
    if (usesCustomRange) {
      return 'Custom range';
    }
    return selectedPeriod;
  };

  const handlePeriodSelect = (value) => {
    setSelectedPeriod(value);
    if (value === 'Custom range') {
      setDateRangeType('custom');
    } else {
      setDateRangeType('range');
    }
  };

  const handleCustomRangeSelect = () => {
    setDateRangeType('custom');
    setSelectedPeriod('Custom range');
  };

  const applySelectedDate = (selectedDate) => {
    if (!selectedDate) return;
    const formattedDate = formatDateForDisplay(selectedDate);
    if (showDatePicker === 'from') {
      setFromDate(formattedDate);
    } else {
      setToDate(formattedDate);
    }
    setDateRangeType('custom');
    setSelectedPeriod('Custom range');
  };

  const getCalendarValue = () => {
    if (showDatePicker === 'from' && fromDate) {
      const parsed = parseInputDate(fromDate);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    if (showDatePicker === 'to' && toDate) {
      const parsed = parseInputDate(toDate);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  };

  const getCalendarMinimumDate = () => {
    if (showDatePicker === 'to' && fromDate) {
      const parsed = parseInputDate(fromDate);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return undefined;
  };

  const getCalendarMaximumDate = () => {
    if (showDatePicker === 'from' && toDate) {
      const parsed = parseInputDate(toDate);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  };

  const handleQueryPress = () => {
    if (usesCustomRange) {
      if (!fromDate || !toDate) {
        Alert.alert('Select dates', 'Please choose both a start date and an end date for the custom range.');
        return;
      }
      const start = parseInputDate(fromDate);
      const end = parseInputDate(toDate);
      const today = new Date();
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      if (start > today) {
        Alert.alert('Validation', 'Start date cannot be in the future');
        return;
      }
      if (end > today) {
        Alert.alert('Validation', 'End date cannot be in the future');
        return;
      }
      if (end < start) {
        Alert.alert('Validation', 'End date must be on or after the start date');
        return;
      }
    }
    fetchPatientData();
  };

  const getEffectivePeriod = () => {
    if (selectedPeriod !== 'Custom range') return selectedPeriod;
    if (!fromDate || !toDate) return 'All';
    try {
      const start = parseInputDate(fromDate);
      const end = parseInputDate(toDate);
      const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));
      if (diffDays <= 8) return 'Last 7 days';
      if (diffDays <= 16) return 'Last 2 weeks';
      if (diffDays <= 45) return 'Last month';
      if (diffDays <= 110) return 'Last 3 months';
      if (diffDays <= 200) return 'Last 6 months';
      if (diffDays <= 380) return 'Last year';
      return 'All';
    } catch (e) {
      return 'All';
    }
  };

  const getFormattedLabel = (label, period) => {
    try {
      // DataList dates are usually DD/MM/YY via formatDate helper
      const parts = label.split('/');
      const date = new Date(2000 + parseInt(parts[2]), parts[0] - 1, parts[1]);

      if (date && !isNaN(date.getTime())) {
        const day = date.getDate();
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = monthNames[date.getMonth()];

        if (period === 'Last year' || period === 'All' || period === 'Last 6 months') {
          return month;
        } else if (period === 'Last month' || period === 'Last 3 months') {
          return `${day} ${month}`;
        } else {
          return `${day}/${date.getMonth() + 1}`;
        }
      }
    } catch (e) {
      return label;
    }
    return label;
  };

  const getTitle = () => ({
    bloodPressure: 'Blood Pressure',
    bloodGlucose: 'Blood Glucose',
    weight: 'Weight',
  })[dataType] || 'Data';

  const getTypeMeta = () => ({
    bloodPressure: {
      subtitle: 'Review blood pressure readings, filter by date, and track trends.',
      chartSecondary,
    },
    bloodGlucose: {
      subtitle: 'Review blood glucose readings, filter by date, and track trends.',
      chartSecondary: '#E89A5F',
    },
    weight: {
      subtitle: 'Review weight readings, filter by date, and track trends.',
      chartSecondary: '#8DA1B8',
    },
  })[dataType] || {
    subtitle: 'Review readings, filter by date, and track trends.',
    chartSecondary,
  };

  const typeMeta = getTypeMeta();

  const displayMeasurements = useMemo(() => {
    let list = [...rawMeasurements];

    if (selectedSlotFilter && selectedSlotFilter !== 'All') {
      const normSelected = selectedSlotFilter.toLowerCase().replace(/[^a-z0-9]/g, '');
      list = list.filter((item) => {
        const p = getPeriodNameForMeasurement(item, dataType);
        const normP = p.toLowerCase().replace(/[^a-z0-9]/g, '');
        return normP === normSelected;
      });
    }

    if (sortMetric && sortLevel) {
      list = list.filter((item) => readingAlertStatus(item, sortMetric) === sortLevel);
    }

    return sortData(list);
  }, [rawMeasurements, selectedSlotFilter, dataType, sortMetric, sortLevel, readingAlertStatus, sortData]);

  const matrixData = useMemo(() => {
    const periodList = getPeriodListForType(dataType);
    const dateMap = {};

    rawMeasurements.forEach((m) => {
      const dateStr = m.date || 'Unknown';
      const period = getPeriodNameForMeasurement(m, dataType);
      if (!dateMap[dateStr]) {
        dateMap[dateStr] = {};
        periodList.forEach((p) => { dateMap[dateStr][p] = []; });
      }
      if (!dateMap[dateStr][period]) {
        dateMap[dateStr][period] = [];
      }
      dateMap[dateStr][period].push(m);
    });

    const dates = Object.keys(dateMap);
    if (sortBy === 'Date (newest first)') {
      dates.sort((a, b) => {
        const tA = dateMap[a][periodList[0]]?.[0]?.timestamp || 0;
        const tB = dateMap[b][periodList[0]]?.[0]?.timestamp || 0;
        return tB - tA;
      });
    } else {
      dates.sort((a, b) => {
        const tA = dateMap[a][periodList[0]]?.[0]?.timestamp || 0;
        const tB = dateMap[b][periodList[0]]?.[0]?.timestamp || 0;
        return tA - tB;
      });
    }

    return { dates, dateMap, periodList };
  }, [rawMeasurements, dataType, sortBy]);

  /* ───── CHART DATA ───── */
  const getChartDataForDisplay = () => {
    if (displayMeasurements.length === 0) return { labels: [], datasets: [] };

    // Trend charts must always run chronologically (oldest -> newest left-to-right)
    const chronologicalData = [...displayMeasurements].sort((a, b) => a.timestamp - b.timestamp);

    // For smooth visual display without horizontal scrolling:
    // If readings count is small, show all. If large (>12), sample up to ~12 points across the dataset.
    let dataToUse = chronologicalData;
    if (chronologicalData.length > 12) {
      const step = (chronologicalData.length - 1) / 11;
      dataToUse = [];
      for (let i = 0; i < 12; i++) {
        const idx = Math.min(Math.round(i * step), chronologicalData.length - 1);
        dataToUse.push(chronologicalData[idx]);
      }
    }

    const period = getEffectivePeriod();
    const targetCount = 6;
    const labelStep = Math.max(1, Math.ceil(dataToUse.length / targetCount));

    const labels = dataToUse.map((m, index) => {
      if (index % labelStep === 0 || index === dataToUse.length - 1) {
        return getFormattedLabel(m.date, period);
      }
      return "";
    });

    const systolicColor = '#d32f2f'; // Web App Systolic Red
    const diastolicColor = '#1976d2'; // Web App Diastolic Blue

    return {
      labels: labels,
      datasets:
        dataType === 'bloodPressure'
          ? [
            { data: dataToUse.map(m => Number(m.systolic) || 0), strokeWidth: 2, color: () => systolicColor },
            { data: dataToUse.map(m => Number(m.diastolic) || 0), strokeWidth: 2, color: () => diastolicColor },
          ]
          : [
            {
              data: dataToUse.map(m => Number(dataType === 'bloodGlucose' ? m.glucose : m.weight) || 0),
              color: () => themePrimary,
              strokeWidth: 2,
            },
          ],
    };
  };

  const chartData = getChartDataForDisplay();

  const chartConfig = {
    backgroundGradientFrom: WHITE,
    backgroundGradientTo: WHITE,
    fillShadowGradientFromOpacity: 0,
    fillShadowGradientToOpacity: 0,
    fillShadowGradientOpacity: 0,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    labelColor: () => TEXT_MUTED,
    propsForDots: { r: '4', strokeWidth: '1.5', stroke: WHITE },
    propsForBackgroundLines: { stroke: '#E5E7EB', strokeWidth: 1 },
    propsForLabels: { fontSize: 10 },
    paddingLeft: scaleWidth(0),
    paddingRight: scaleWidth(16),
  };

  /* ───── CALENDAR HANDLER ───── */
  const handleCalendarOpen = (type) => {
    setDateRangeType('custom');
    setSelectedPeriod('Custom range');
    setShowDatePicker(type);
    setShowCalendar(true);
  };

  const handleOpenChartModal = () => {
    lockToLandscape();
    setShowChartModal(true);
  };

  const handleCloseChartModal = () => {
    lockToPortrait();
    setShowChartModal(false);
  };

  return (
    <View style={styles.screenRoot}>
      <LinearGradient colors={screenBgColors} style={styles.fullScreenContainer}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

          <View style={styles.topbar}>
            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back">
              <MaterialIcons name="arrow-back" size={21} color={themePrimary} />
            </TouchableOpacity>
            <Text style={styles.topbarTitle} numberOfLines={1}>{getTitle()}</Text>
            <View style={styles.topbarSpacer} />
          </View>

          <View style={styles.headerContainer}>
            <Text style={styles.headerSubtitle}>{typeMeta.subtitle}</Text>
          </View>

          <View style={styles.tabWrap}>
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'Data List' && styles.tabButtonActive]}
                onPress={() => setActiveTab('Data List')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'Data List' && styles.tabButtonTextActive]}>Data List</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'Graph List' && styles.tabButtonActive]}
                onPress={() => setActiveTab('Graph List')}
              >
                <Text style={[styles.tabButtonText, activeTab === 'Graph List' && styles.tabButtonTextActive]}>Graph List</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Query Period</Text>

              <View style={styles.row}>
                <TouchableOpacity style={styles.radio} onPress={() => {
                  setDateRangeType('range');
                }}>
                  <View style={[styles.radioCircle, dateRangeType === 'range' && styles.radioActive]} />
                  <Text style={styles.radioLabel}>Quick Select</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dropdown, dateRangeType !== 'range' && styles.disabled]}
                  disabled={dateRangeType !== 'range'}
                  onPress={() => setShowPeriodModal(true)}>
                  <Text style={styles.dropdownText}>{selectedPeriod}</Text>
                  <MaterialIcons name="expand-more" size={18} color={TEXT_MUTED} />
                </TouchableOpacity>
              </View>

              <View style={styles.row}>
                <TouchableOpacity style={styles.radio} onPress={handleCustomRangeSelect}>
                  <View style={[styles.radioCircle, dateRangeType === 'custom' && styles.radioActive]} />
                  <Text style={styles.radioLabel}>Custom Range</Text>
                </TouchableOpacity>
              </View>

              {/* <View style={styles.dateRow}>
                <TextInput
                  style={[styles.dateInput, dateRangeType !== 'custom' && styles.disabled]}
                  placeholder="mm/dd/yyyy"
                  value={fromDate}
                  editable={dateRangeType === 'custom'}
                  onChangeText={setFromDate}
                  placeholderTextColor={TEXT_LIGHT}
                />
                <Text style={styles.to}>to</Text>
                <TextInput
                  style={[styles.dateInput, dateRangeType !== 'custom' && styles.disabled]}
                  placeholder="mm/dd/yyyy"
                  value={toDate}
                  editable={dateRangeType === 'custom'}
                  onChangeText={setToDate}
                  placeholderTextColor={TEXT_LIGHT}
                />
              </View> */}


              <View style={styles.dateRow}>
                <View style={styles.dateInputContainer}>
                  <TouchableOpacity
                    style={[
                      styles.dateInputTouchable,
                      dateRangeType !== 'custom' && styles.disabled
                    ]}
                    disabled={dateRangeType !== 'custom'}
                    onPress={() => handleCalendarOpen('from')}
                  >
                    <Text style={[
                      styles.dateInputText,
                      !fromDate && { color: TEXT_MUTED }
                    ]}>
                      {fromDate || 'mm/dd/yyyy'}
                    </Text>
                    <MaterialIcons name="event" size={18} color={themePrimary} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.to}>to</Text>

                <View style={styles.dateInputContainer}>
                  <TouchableOpacity
                    style={[
                      styles.dateInputTouchable,
                      dateRangeType !== 'custom' && styles.disabled
                    ]}
                    disabled={dateRangeType !== 'custom'}
                    onPress={() => handleCalendarOpen('to')}
                  >
                    <Text style={[
                      styles.dateInputText,
                      !toDate && { color: TEXT_MUTED }
                    ]}>
                      {toDate || 'mm/dd/yyyy'}
                    </Text>
                    <MaterialIcons name="event" size={18} color={themePrimary} />
                  </TouchableOpacity>
                </View>
              </View>


              <View style={styles.row}>
                <Text style={styles.sortLabel}>Sort Data by</Text>
                <TouchableOpacity style={styles.dropdown} onPress={() => setShowSortModal(true)}>
                  <Text style={styles.dropdownText} numberOfLines={1}>{sortBy}</Text>
                  <MaterialIcons name="expand-more" size={18} color={TEXT_MUTED} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.queryBtn} onPress={handleQueryPress}>
                <Text style={styles.queryBtnText}>Query</Text>
              </TouchableOpacity>
            </View>

            {/* Trend Chart */}
            {activeTab === 'Graph List' && displayMeasurements.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Trend</Text>
                <View style={styles.chartContainer}>
                  <LineChart
                    data={chartData}
                    width={trendChartWidth}
                    height={220}
                    chartConfig={chartConfig}
                    bezier
                    style={styles.chart}
                    withHorizontalLines={true}
                    withVerticalLines={false}
                    fromZero={false}
                  />
                </View>
                {dataType === 'bloodPressure' && (
                  <View style={styles.legend}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#d32f2f' }]} />
                      <Text style={styles.legendText}>Systolic</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#1976d2' }]} />
                      <Text style={styles.legendText}>Diastolic</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Vertical Fixed-Width Table */}
            {activeTab === 'Data List' && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{getTitle()}</Text>
                <Text style={styles.subtitle}>Date Range: {getDateRangeLabel()}</Text>

                {/* Time Slot Period Filter Bar */}
                <View style={styles.vSlotFilterWrap}>
                  <Text style={styles.vSlotFilterLabel}>Filter Period Slot:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vSlotFilterScroll}>
                    {getPeriodOptionsForType(dataType).map((slot) => {
                      const isSelected = selectedSlotFilter === slot || (slot === 'All' && !selectedSlotFilter);
                      return (
                        <TouchableOpacity
                          key={slot}
                          style={[styles.vSlotChip, isSelected && styles.vSlotChipActive]}
                          onPress={() => setSelectedSlotFilter(slot)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.vSlotChipText, isSelected && styles.vSlotChipTextActive]}>
                            {slot}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {loading ? (
                  <ActivityIndicator size="large" color={themePrimary} style={{ marginVertical: 30 }} />
                ) : displayMeasurements.length === 0 ? (
                  <Text style={styles.emptyText}>
                    {sortLevel
                      ? `No ${sortLevel} readings match the selected filter.`
                      : 'No measurement data available for the selected period'}
                  </Text>
                ) : (
                  <View style={styles.vTable}>
                    {/* Navy Blue Table Header */}
                    <View style={styles.vTableHeader}>
                      <Text style={[styles.vTh, { flex: 2.8, paddingLeft: scaleWidth(8) }]}>Date / Time</Text>
                      <Text style={[styles.vTh, { flex: 3.8, textAlign: 'center' }]}>Period</Text>
                      <Text style={[styles.vTh, { flex: 3.4, textAlign: 'center' }]}>Reading</Text>
                    </View>

                    {/* Vertical Rows */}
                    {displayMeasurements.map((item, index) => {
                      const isEven = index % 2 === 1;
                      const periodName = getPeriodNameForMeasurement(item, dataType);
                      const timeWindow = getPeriodTimeWindow(periodName, dataType);

                      const rowColors = getDataListRowColors(item, dataType, scheduleTargets);
                      const sysColor = rowColors.sysColor;
                      const diaColor = rowColors.diaColor;
                      const pulseColor = rowColors.pulseColor;
                      const isPulseAbnormal = rowColors.isPulseAbnormal;
                      const bgValColor = rowColors.glucoseColor;
                      const wtValColor = rowColors.weightColor;
                      const fatColor = rowColors.fatColor;
                      const bmiColor = rowColors.bmiColor;

                      return (
                        <View key={item.id || index} style={[styles.vTableRow, isEven ? styles.vTableRowEven : styles.vTableRowOdd]}>
                          {/* Date & Time */}
                          <View style={{ flex: 2.8, paddingLeft: scaleWidth(8) }}>
                            <Text style={styles.vTdDate}>{item.date}</Text>
                            <Text style={styles.vTdTime}>{item.time}</Text>
                          </View>

                          {/* Period Tag with Time Window */}
                          <View style={{ flex: 3.8, alignItems: 'center' }}>
                            <View style={styles.vPeriodPill}>
                              <Text style={styles.vPeriodPillText}>{periodName}</Text>
                              {timeWindow ? <Text style={styles.vPeriodPillSubText}>{timeWindow}</Text> : null}
                            </View>
                          </View>

                          {/* Reading Values */}
                          <View style={{ flex: 3.4, alignItems: 'center' }}>
                            {dataType === 'bloodPressure' ? (
                              <View style={{ alignItems: 'center' }}>
                                <View style={styles.vBpRow}>
                                  <Text style={[styles.vValText, { color: sysColor }]}>{item.systolic}</Text>
                                  <Text style={styles.vValSep}>/</Text>
                                  <Text style={[styles.vValText, { color: diaColor }]}>{item.diastolic}</Text>
                                </View>
                                {item.pulse != null && item.pulse !== '' ? (
                                  <View style={styles.vPulseWrap}>
                                    <Text style={[styles.vPulseText, { color: pulseColor }]}>
                                      {item.pulse}
                                    </Text>
                                    <PulseIcon isAbnormal={isPulseAbnormal} size={scaleFont(10)} />
                                  </View>
                                ) : null}
                              </View>
                            ) : dataType === 'bloodGlucose' ? (
                              <Text style={[styles.vValTextSingle, { color: bgValColor }]}>
                                {item.glucose} <Text style={styles.vUnitText}>mg/dL</Text>
                              </Text>
                            ) : (
                              <View style={styles.vWeightStack}>
                                <Text style={[styles.vValTextSingle, { color: wtValColor }]}>
                                  {item.weight} <Text style={styles.vUnitText}>lb</Text>
                                </Text>
                                {item.fat != null ? (
                                  <Text style={[styles.vMetricSubText, { color: fatColor }]}>
                                    Fat {Number(item.fat).toFixed(1)}
                                  </Text>
                                ) : null}
                                {item.bmi != null ? (
                                  <Text style={[styles.vMetricSubText, { color: bmiColor }]}>
                                    BMI {Number(item.bmi).toFixed(1)}
                                  </Text>
                                ) : null}
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>

      {/* Modals */}
      <CustomDropdown
        visible={showPeriodModal}
        options={periodOptions}
        onSelect={handlePeriodSelect}
        onClose={() => setShowPeriodModal(false)}
      />
      <CustomDropdown
        visible={showSortModal}
        options={sortOptions[dataType] || []}
        onSelect={setSortBy}
        onClose={() => setShowSortModal(false)}
      />

      <DatePickerModal
        visible={showCalendar}
        title={showDatePicker === 'from' ? 'Select start date' : 'Select end date'}
        value={getCalendarValue()}
        minimumDate={getCalendarMinimumDate()}
        maximumDate={getCalendarMaximumDate()}
        accentColor={themePrimary}
        onClose={() => setShowCalendar(false)}
        onConfirm={(date) => {
          applySelectedDate(date);
          setShowCalendar(false);
        }}
      />

      {/* Full Chart Modal */}
      <FullTrendChartModal
        visible={showChartModal}
        onClose={handleCloseChartModal}
        measurements={displayMeasurements}
        dataType={dataType}
        title={`${getTitle()} - Trend Chart`}
        themePrimary={themePrimary}
        chartSecondary={typeMeta.chartSecondary}
      />
    </View>
  );
};

const createStyles = (themePrimary, themeSoft) => StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: '#fffdfb',
  },
  fullScreenContainer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  topbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Math.max(scaleWidth(16), 16),
    paddingTop: scaleHeight(8),
    paddingBottom: scaleHeight(10),
  },
  topbarTitle: {
    flex: 1,
    color: TEXT_DARK,
    fontSize: scaleFont(20),
    lineHeight: scaleFont(24),
    fontWeight: '800',
    textAlign: 'center',
    marginHorizontal: scaleWidth(8),
  },
  iconButton: {
    width: Math.max(scaleWidth(42), 42),
    height: Math.max(scaleWidth(42), 42),
    borderRadius: scaleWidth(14),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    shadowColor: '#0b1f3f',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 26,
    elevation: 3,
  },
  topbarSpacer: {
    width: Math.max(scaleWidth(42), 42),
  },
  headerContainer: {
    paddingHorizontal: Math.max(scaleWidth(20), 20),
    paddingBottom: scaleHeight(12),
  },
  headerSubtitle: {
    marginTop: scaleHeight(6),
    color: TEXT_MUTED,
    fontSize: scaleFont(13),
    lineHeight: scaleFont(20),
    fontWeight: '600',
  },
  tabWrap: {
    paddingHorizontal: Math.max(scaleWidth(20), 20),
    paddingBottom: scaleHeight(12),
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: scaleWidth(20),
    padding: scaleWidth(4),
    borderWidth: 1,
    borderColor: '#e8ecf0',
    shadowColor: '#0b1f3f',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: scaleHeight(11),
    alignItems: 'center',
    borderRadius: scaleWidth(16),
  },
  tabButtonActive: {
    backgroundColor: themePrimary,
  },
  tabButtonText: {
    fontSize: scaleFont(13),
    fontWeight: '800',
    color: TEXT_DARK,
  },
  tabButtonTextActive: {
    color: WHITE,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Math.max(scaleWidth(20), 20),
    paddingBottom: scaleHeight(28),
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: scaleWidth(24),
    padding: scaleWidth(16),
    marginBottom: scaleHeight(14),
    borderWidth: 1,
    borderColor: '#e8ecf0',
    shadowColor: '#0b1f3f',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  cardTitle: {
    fontSize: scaleFont(16),
    fontWeight: '800',
    color: TEXT_DARK,
    marginBottom: scaleHeight(12),
  },
  subtitle: {
    fontSize: scaleFont(13),
    color: TEXT_MUTED,
    marginBottom: scaleHeight(12),
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleHeight(12),
    justifyContent: 'space-between',
  },
  radio: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioCircle: {
    width: scaleWidth(20),
    height: scaleWidth(20),
    borderRadius: scaleWidth(10),
    borderWidth: scaleWidth(2),
    borderColor: themePrimary,
    marginRight: scaleWidth(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: {
    backgroundColor: themePrimary,
  },
  radioLabel: {
    fontSize: scaleFont(13),
    color: TEXT_MUTED,
    fontWeight: '600',
  },
  dropdown: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleHeight(10),
    borderRadius: scaleWidth(14),
    marginLeft: scaleWidth(12),
    borderWidth: 1,
    borderColor: BORDER_SOFT,
  },
  disabled: {
    opacity: 0.5,
  },
  dropdownText: {
    flex: 1,
    fontSize: scaleFont(13),
    color: TEXT_DARK,
    fontWeight: '700',
    marginRight: scaleWidth(4),
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scaleHeight(12),
  },
  dateInputContainer: {
    flex: 1,
  },
  dateInputTouchable: {
    height: scaleHeight(42),
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: scaleWidth(14),
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaleWidth(12),
  },
  dateInputText: {
    fontSize: scaleFont(13),
    color: TEXT_DARK,
    fontWeight: '700',
  },
  to: {
    fontSize: scaleFont(13),
    color: TEXT_MUTED,
    marginHorizontal: scaleWidth(8),
    fontWeight: '600',
  },
  sortLabel: {
    fontSize: scaleFont(13),
    color: TEXT_MUTED,
    width: scaleWidth(100),
    fontWeight: '600',
  },
  queryBtn: {
    backgroundColor: themePrimary,
    paddingVertical: scaleHeight(13),
    borderRadius: scaleWidth(16),
    alignItems: 'center',
    marginTop: scaleHeight(8),
    shadowColor: themePrimary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 4,
  },
  queryBtnText: {
    color: WHITE,
    fontWeight: '800',
    fontSize: scaleFont(14),
  },
  chartContainer: {
    width: '100%',
    overflow: 'hidden',
    alignItems: 'flex-start',
    marginLeft: -scaleWidth(16),
  },
  chart: {
    borderRadius: scaleWidth(16),
    marginVertical: scaleHeight(8),
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: scaleHeight(8),
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: scaleWidth(12),
  },
  legendDot: {
    width: scaleWidth(10),
    height: scaleWidth(10),
    borderRadius: scaleWidth(5),
    marginRight: scaleWidth(6),
  },
  legendText: {
    fontSize: scaleFont(12),
    color: TEXT_MUTED,
    fontWeight: '700',
  },
  vSlotFilterWrap: {
    marginBottom: scaleHeight(12),
  },
  vSlotFilterLabel: {
    fontSize: scaleFont(12),
    fontWeight: '800',
    color: '#0b1f3f',
    marginBottom: scaleHeight(6),
  },
  vSlotFilterScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(6),
    paddingRight: scaleWidth(10),
  },
  vSlotChip: {
    paddingHorizontal: scaleWidth(10),
    paddingVertical: scaleHeight(5),
    borderRadius: scaleWidth(12),
    backgroundColor: 'rgba(7, 27, 52, 0.05)',
    borderWidth: 1,
    borderColor: '#e8ecf0',
  },
  vSlotChipActive: {
    backgroundColor: '#0b1f3f',
    borderColor: '#0b1f3f',
  },
  vSlotChipText: {
    fontSize: scaleFont(11),
    fontWeight: '700',
    color: '#687382',
  },
  vSlotChipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  vTable: {
    borderWidth: 1,
    borderColor: '#e8ecf0',
    borderRadius: scaleWidth(14),
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    shadowColor: '#0b1f3f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    width: '100%',
  },
  vTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b1f3f',
    paddingVertical: scaleHeight(10),
    paddingHorizontal: scaleWidth(4),
  },
  vTh: {
    fontSize: scaleFont(11),
    fontWeight: '800',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  vTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scaleHeight(10),
    paddingHorizontal: scaleWidth(4),
    borderBottomWidth: 1,
    borderColor: '#e8ecf0',
  },
  vTableRowEven: {
    backgroundColor: 'rgba(7, 27, 52, 0.025)',
  },
  vTableRowOdd: {
    backgroundColor: '#ffffff',
  },
  vTdDate: {
    fontSize: scaleFont(12),
    fontWeight: '800',
    color: '#0b1f3f',
  },
  vTdTime: {
    fontSize: scaleFont(10),
    fontWeight: '700',
    color: '#64748b',
    marginTop: 1,
  },
  vValTextRow: {
    fontSize: scaleFont(12),
    fontWeight: '800',
  },
  vUnitTextRow: {
    fontSize: scaleFont(12),
    fontWeight: '700',
    color: '#64748b',
  },
  vPeriodPill: {
    paddingHorizontal: scaleWidth(6),
    paddingVertical: scaleHeight(3),
    borderRadius: scaleWidth(8),
    backgroundColor: 'rgba(7, 27, 52, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(7, 27, 52, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vPeriodPillText: {
    fontSize: scaleFont(10),
    fontWeight: '800',
    color: '#0b1f3f',
    textAlign: 'center',
  },
  vPeriodPillSubText: {
    fontSize: scaleFont(8),
    fontWeight: '700',
    color: '#475569',
    marginTop: scaleHeight(1),
    textAlign: 'center',
  },
  vBpRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vValText: {
    fontSize: scaleFont(13),
    fontWeight: '800',
  },
  vValSep: {
    fontSize: scaleFont(12),
    color: '#64748b',
    marginHorizontal: 1,
  },
  vValTextSingle: {
    fontSize: scaleFont(12),
    fontWeight: '800',
  },
  vWeightStack: {
    alignItems: 'center',
  },
  vMetricSubText: {
    fontSize: scaleFont(10),
    fontWeight: '700',
    marginTop: 1,
    textAlign: 'center',
  },
  vUnitText: {
    fontSize: scaleFont(10),
    fontWeight: '700',
    color: '#64748b',
  },
  vPulseWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  vPulseText: {
    fontSize: scaleFont(10),
    fontWeight: '700',
  },
  vStatusPill: {
    paddingHorizontal: scaleWidth(8),
    paddingVertical: scaleHeight(3),
    borderRadius: scaleWidth(8),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vStatusPillText: {
    fontSize: scaleFont(10),
    fontWeight: '900',
  },
  matrixRowEven: {
    backgroundColor: 'rgba(7, 27, 52, 0.025)',
  },
  matrixRowOdd: {
    backgroundColor: '#ffffff',
  },
  matrixTdDate: {
    width: scaleWidth(88),
    paddingLeft: scaleWidth(10),
    fontSize: scaleFont(11),
    fontWeight: '800',
    color: '#0b1f3f',
  },
  matrixTdCell: {
    width: scaleWidth(115),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scaleHeight(6),
  },
  matrixTdCellActive: {
    width: scaleWidth(115),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scaleHeight(6),
    paddingHorizontal: scaleWidth(2),
  },
  matrixEmptyText: {
    fontSize: scaleFont(14),
    color: '#a0aab4',
    fontWeight: '600',
  },
  matrixBpValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matrixValText: {
    fontSize: scaleFont(13),
    fontWeight: '800',
  },
  matrixValSep: {
    fontSize: scaleFont(12),
    color: '#64748b',
    marginHorizontal: 1,
  },
  matrixValTextSingle: {
    fontSize: scaleFont(12),
    fontWeight: '800',
  },
  matrixPulseText: {
    fontSize: scaleFont(10),
    fontWeight: '700',
    marginTop: 1,
  },
  matrixTimeText: {
    fontSize: scaleFont(9),
    fontWeight: '700',
    color: '#64748b',
    marginTop: 2,
  },
  matrixReadingsCount: {
    fontSize: scaleFont(8),
    fontWeight: '800',
    color: '#0077b6',
    marginBottom: 1,
  },
  colDate: {
    width: '22%',
    paddingLeft: scaleWidth(12),
  },
  colTime: {
    width: '22%',
    textAlign: 'center',
  },
  colValue: {
    width: '18%',
    textAlign: 'center',
  },
  colUnit: {
    width: '18%',
    textAlign: 'center',
  },
  danger: {
    color: themePrimary,
    fontWeight: '800',
  },
  emptyText: {
    textAlign: 'center',
    color: TEXT_MUTED,
    fontSize: scaleFont(14),
    marginVertical: scaleHeight(20),
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    backgroundColor: WHITE,
    borderRadius: scaleWidth(20),
    width: width * 0.85,
    maxHeight: scaleHeight(300),
    padding: scaleWidth(8),
    borderWidth: 1,
    borderColor: '#e8ecf0',
    shadowColor: '#0b1f3f',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  dropdownItem: {
    padding: scaleHeight(14),
    borderBottomWidth: 1,
    borderColor: BORDER_SOFT,
    backgroundColor: WHITE,
  },
  dropdownItemText: {
    fontSize: scaleFont(14),
    color: TEXT_DARK,
    fontWeight: '700',
  },
  viewChartButton: {
    backgroundColor: themePrimary,
    paddingVertical: scaleHeight(14),
    paddingHorizontal: scaleWidth(20),
    borderRadius: scaleWidth(16),
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: scaleHeight(10),
  },
  viewChartButtonText: {
    color: WHITE,
    fontSize: scaleFont(14),
    fontWeight: '800',
  },
});

export default DataList;