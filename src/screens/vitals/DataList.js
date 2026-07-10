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

const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

const scaleWidth = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.25);
const scaleHeight = (size) => Math.min((height / guidelineBaseHeight) * size, size * 1.25);
const scaleFont = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.2);

const PATIENT_SCREEN_BG_COLORS = ['#fffdfb', '#edf1f6', '#eef1f5'];
const DEFAULT_SCREEN_BG_COLORS = ['#fffdfb', '#f7ece7', '#eef1f5'];
const TEXT_DARK = '#071B34';
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
const periodOptions = ['All', 'Last 7 days', 'Last 2 weeks', 'Last month', 'Last 3 months', 'Last 6 months', 'Last year', 'Custom range'];
const sortOptions = {
  bloodPressure: ['Date (newest first)', 'Date (oldest first)', 'Systolic (high-low)', 'Diastolic (high-low)', 'Pulse (high-low)'],
  bloodGlucose: ['Date (newest first)', 'Date (oldest first)', 'Glucose (high-low)', 'Glucose (low-high)'],
  weight: ['Date (newest first)', 'Date (oldest first)', 'Weight (high-low)', 'Weight (low-high)'],
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
    shadowColor: '#071B34',
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

  const [selectedPeriod, setSelectedPeriod] = useState('All'); // Default to 'All' to fetch all records
  const [sortBy, setSortBy] = useState('Date (newest first)');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dateRangeType, setDateRangeType] = useState('range');
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [rawMeasurements, setRawMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Changes Added 
  // Calendar states
  const [showCalendar, setShowCalendar] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState('from'); // 'from' or 'to'
  const [showChartModal, setShowChartModal] = useState(false);
  const [activeTab, setActiveTab] = useState('Data List');


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

    if (selectedPeriod === 'All') {
      // For "All", set a very old date to get all records
      start = new Date('2000-01-01');
      end = new Date('2099-12-31');
    } else if (selectedPeriod === 'Last 7 days') {
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else if (selectedPeriod === 'Last 2 weeks') {
      start.setDate(now.getDate() - 14);
      start.setHours(0, 0, 0, 0);
    } else if (selectedPeriod === 'Last month') {
      start.setMonth(now.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
    } else if (selectedPeriod === 'Last 3 months') {
      start.setMonth(now.getMonth() - 3);
      start.setHours(0, 0, 0, 0);
    } else if (selectedPeriod === 'Last 6 months') {
      start.setMonth(now.getMonth() - 6);
      start.setHours(0, 0, 0, 0);
    } else if (selectedPeriod === 'Last year') {
      start.setFullYear(now.getFullYear() - 1);
      start.setHours(0, 0, 0, 0);
    }

    return { start, end };
  };

  /* ───── SORT LOGIC ───── */
  const sortData = useCallback((data) => {
    const sorted = [...data];
    if (sortBy === 'Date (newest first)') {
      sorted.sort((a, b) => b.timestamp - a.timestamp);
    } else if (sortBy === 'Date (oldest first)') {
      sorted.sort((a, b) => a.timestamp - b.timestamp);
    } else if (sortBy === 'Systolic (high-low)') {
      sorted.sort((a, b) => (b.systolic || 0) - (a.systolic || 0));
    } else if (sortBy === 'Diastolic (high-low)') {
      sorted.sort((a, b) => (b.diastolic || 0) - (a.diastolic || 0));
    } else if (sortBy === 'Pulse (high-low)') {
      sorted.sort((a, b) => (b.pulse || 0) - (a.pulse || 0));
    } else if (sortBy === 'Glucose (high-low)') {
      sorted.sort((a, b) => (b.glucose || 0) - (a.glucose || 0));
    } else if (sortBy === 'Glucose (low-high)') {
      sorted.sort((a, b) => (a.glucose || 0) - (b.glucose || 0));
    } else if (sortBy === 'Weight (high-low)') {
      sorted.sort((a, b) => (b.weight || 0) - (a.weight || 0));
    } else if (sortBy === 'Weight (low-high)') {
      sorted.sort((a, b) => (a.weight || 0) - (b.weight || 0));
    }
    return sorted;
  }, [sortBy]);

  const measurements = useMemo(
    () => sortData(rawMeasurements),
    [rawMeasurements, sortData],
  );

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

  const fetchPatientData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { practiceId, patientId } = await resolveMeasurementIds();

      if (!practiceId || !patientId) {
        throw new Error('Practice ID or Patient ID missing');
      }

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
          const date = new Date(bp.measure_new_date_time || bp.measure_date_time || bp.created_at);
          // Only filter by date if date range is specified
          if (!fromDateStr || !toDateStr || (date >= start && date <= end)) {
            rawList.push({
              id: bp.id || bp.measure_new_date_time || Date.now(),
              timestamp: date.getTime(),
              date: formatDate(bp.measure_new_date_time || bp.measure_date_time || bp.created_at),
              time: formatTime(bp.measure_new_date_time || bp.measure_date_time || bp.created_at),
              systolic: parseFloat(bp.systolic_pressure || bp.systolic || 0),
              diastolic: parseFloat(bp.diastolic_pressure || bp.diastolic || 0),
              pulse: parseFloat(bp.pulse || bp.heart_rate || 0),
            });
          }
        });
      } else if (dataType === 'bloodGlucose') {
        result = await apiService.getBloodGlucose(practiceId, patientId, {
          fromDate: fromDateStr,
          toDate: toDateStr,
        });

        const measurements = extractMeasurements(result);

        measurements.forEach((bg) => {
          const date = new Date(bg.measure_new_date_time || bg.measure_date_time || bg.created_at);
          // Only filter by date if date range is specified
          if (!fromDateStr || !toDateStr || (date >= start && date <= end)) {
            rawList.push({
              id: bg.id || bg.measure_new_date_time || Date.now(),
              timestamp: date.getTime(),
              date: formatDate(bg.measure_new_date_time || bg.measure_date_time || bg.created_at),
              time: formatTime(bg.measure_new_date_time || bg.measure_date_time || bg.created_at),
              glucose: parseFloat(bg.blood_glucose_value_1 || bg.blood_glucose_value || bg.value || 0),
            });
          }
        });
      } else if (dataType === 'weight') {
        result = await apiService.getWeight(practiceId, patientId, {
          fromDate: fromDateStr,
          toDate: toDateStr,
        });

        const measurements = extractMeasurements(result);

        measurements.forEach((w) => {
          const date = new Date(w.measure_new_date_time || w.measure_date_time || w.created_at);
          // Only filter by date if date range is specified
          if (!fromDateStr || !toDateStr || (date >= start && date <= end)) {
            let value = parseFloat(w.weight || w.weight_value || w.value || 0);
            // Convert kg to lbs for display (weight is stored in kg in database)
            if (value > 0) {
              value = parseFloat((value * 2.20462).toFixed(1));
            }
            rawList.push({
              id: w.id || w.measure_new_date_time || Date.now(),
              timestamp: date.getTime(),
              date: formatDate(w.measure_new_date_time || w.measure_date_time || w.created_at),
              time: formatTime(w.measure_new_date_time || w.measure_date_time || w.created_at),
              weight: value,
              unit: 'lb',
            });
          }
        });
      }

      setRawMeasurements(rawList);
    } catch (err) {
      console.log('❌ Error fetching patient data:', err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [dataType, selectedPeriod, fromDate, toDate, dateRangeType, resolveMeasurementIds]);

  useEffect(() => {
    fetchPatientData();
  }, [fetchPatientData]);

  /* ───── HELPERS ───── */
  const formatDate = (iso) => {
    if (!iso) return '--';
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear().toString().slice(2)}`;
  };

  const formatTime = (iso) => {
    if (!iso) return '--';
    const d = new Date(iso);
    const h = d.getHours() % 12 || 12;
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
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
    if (usesCustomRange && (!fromDate || !toDate)) {
      Alert.alert('Select dates', 'Please choose both a start date and an end date for the custom range.');
      return;
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

  /* ───── CHART DATA ───── */
  const getChartDataForDisplay = (limitToFive = false) => {
    if (measurements.length === 0) return { labels: [], datasets: [] };

    const dataToUse = limitToFive ? measurements.slice(-5) : measurements;
    const period = getEffectivePeriod();
    let targetCount = limitToFive ? 5 : 10;

    const step = Math.max(1, Math.ceil(dataToUse.length / targetCount));

    const labels = dataToUse.map((m, index) => {
      // Only show labels at specific intervals to avoid congestion
      if (index % step === 0 || index === dataToUse.length - 1) {
        return getFormattedLabel(m.date, period);
      }
      return "";
    });

    return {
      labels: labels,
      datasets:
        dataType === 'bloodPressure'
          ? [
            { data: dataToUse.map(m => m.systolic), strokeWidth: 3, color: () => themePrimary },
            { data: dataToUse.map(m => m.diastolic), strokeWidth: 3, color: () => typeMeta.chartSecondary },
          ]
          : [
            {
              data: dataToUse.map(m => dataType === 'bloodGlucose' ? m.glucose : m.weight),
              color: () => themePrimary,
              strokeWidth: 3,
            },
          ],
    };
  };

  const chartData = getChartDataForDisplay(true); // Inline chart limited to 5
  const fullChartData = getChartDataForDisplay(false); // Full chart for modal

  const chartConfig = {
    backgroundGradientFrom: WHITE,
    backgroundGradientTo: WHITE,
    decimalPlaces: 0,
    color: () => themePrimary,
    labelColor: () => TEXT_MUTED,
    propsForDots: { r: '5', strokeWidth: '2', stroke: themePrimary },
    propsForLabels: { fontSize: 10 },
    paddingRight: scaleWidth(12),
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
            {activeTab === 'Graph List' && measurements.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Trend</Text>
                {measurements.length <= 5 ? (
                  <>
                    <View style={styles.chartContainer}>
                      <LineChart
                        data={chartData}
                        width={trendChartWidth}
                        height={180}
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
                          <View style={[styles.legendDot, { backgroundColor: themePrimary }]} />
                          <Text style={styles.legendText}>Systolic</Text>
                        </View>
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: typeMeta.chartSecondary }]} />
                          <Text style={styles.legendText}>Diastolic</Text>
                        </View>
                      </View>
                    )}
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.viewChartButton}
                    onPress={handleOpenChartModal}
                  >
                    <Text style={styles.viewChartButtonText}>📊 View Full Chart ({measurements.length} readings)</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Table */}
            {activeTab === 'Data List' && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{getTitle()}</Text>
                <Text style={styles.subtitle}>Date Range: {getDateRangeLabel()}</Text>

                {loading ? (
                  <ActivityIndicator size="large" color={themePrimary} style={{ marginVertical: 30 }} />
                ) : error || measurements.length === 0 ? (
                  <Text style={styles.emptyText}>No data available</Text>
                ) : (
                  <View style={styles.table}>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.th, styles.colDate]}>Date</Text>
                      <Text style={[styles.th, styles.colTime]}>Time</Text>
                      {dataType === 'bloodPressure' ? (
                        <>
                          <Text style={[styles.th, styles.colValue]}>Sys</Text>
                          <Text style={[styles.th, styles.colValue]}>Dia</Text>
                          <Text style={[styles.th, styles.colValue]}>Pulse</Text>
                        </>
                      ) : (
                        <>
                          <Text style={[styles.th, styles.colValue]}>{dataType === 'bloodGlucose' ? 'Glucose' : 'Weight'}</Text>
                          <Text style={[styles.th, styles.colUnit]}>Unit</Text>
                        </>
                      )}
                    </View>

                    {measurements.map((item) => (
                      <View key={item.id} style={styles.tableRow}>
                        <Text style={[styles.td, styles.colDate]}>{item.date}</Text>
                        <Text style={[styles.td, styles.colTime]}>{item.time}</Text>
                        {dataType === 'bloodPressure' ? (
                          <>
                            <Text style={[styles.td, styles.colValue, item.systolic > 140 && styles.danger]}>
                              {item.systolic}
                            </Text>
                            <Text style={[styles.td, styles.colValue, item.diastolic > 90 && styles.danger]}>
                              {item.diastolic}
                            </Text>
                            <Text style={[styles.td, styles.colValue]}>{item.pulse}</Text>
                          </>
                        ) : (
                          <>
                            <Text style={[styles.td, styles.colValue]}>
                              {dataType === 'bloodGlucose' ? item.glucose : item.weight}
                            </Text>
                            <Text style={[styles.td, styles.colUnit]}>
                              {dataType === 'bloodGlucose' ? 'mg/dL' : item.unit || 'lb'}
                            </Text>
                          </>
                        )}
                      </View>
                    ))}
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
        measurements={measurements}
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
    shadowColor: '#071B34',
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
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: scaleWidth(20),
    padding: scaleWidth(4),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    shadowColor: '#071B34',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
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
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: scaleWidth(24),
    padding: scaleWidth(16),
    marginBottom: scaleHeight(14),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    shadowColor: '#071B34',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 34,
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
    alignItems: 'center',
  },
  chart: {
    borderRadius: scaleWidth(16),
    marginVertical: scaleHeight(8),
    alignSelf: 'center',
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
  table: {
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    borderRadius: scaleWidth(18),
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: themeSoft,
    paddingVertical: scaleHeight(10),
    borderBottomWidth: 1,
    borderBottomColor: BORDER_SOFT,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: scaleHeight(12),
    borderBottomWidth: 1,
    borderColor: BORDER_SOFT,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  th: {
    fontWeight: '800',
    fontSize: scaleFont(11),
    color: TEXT_DARK,
  },
  td: {
    fontSize: scaleFont(12),
    color: TEXT_DARK,
    fontWeight: '700',
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
    borderColor: BORDER_SOFT,
    shadowColor: '#071B34',
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