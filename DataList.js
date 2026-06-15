/*  DataList.js – PROFESSIONAL MEDICAL UI (BP, BG, Weight)  */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  Modal,
  FlatList,
  Image,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart } from 'react-native-chart-kit';
import { colors, fonts } from '../../config/globall';
import apiService from './services/apiService';
import Orientation from 'react-native-orientation-locker';
import FullTrendChartModal from './FullTrendChartModal';

import DateTimePicker from '@react-native-community/datetimepicker';

const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

// Functions to make design responsive
const scaleWidth = size => (width / guidelineBaseWidth) * size;
const scaleHeight = size => (height / guidelineBaseHeight) * size;
const scaleFont = size => scaleWidth(size);

/* ──────────────────────  COLORS  ────────────────────── */
const NAVY_BLUE = '#293d55';
const WHITE = '#FFFFFF';
const LIGHT_GREY = '#F4F7F9';
const BORDER_GREY = '#E0E0E0';
const TEXT_LIGHT = '#666666';


/* ──────────────────────  DROPDOWN OPTIONS  ────────────────────── */
const periodOptions = ['All', 'Last 7 days', 'Last 2 weeks', 'Last month', 'Last 3 months', 'Last 6 months', 'Last year', 'Custom range'];
const sortOptions = {
  bloodPressure: ['Date (newest first)', 'Date (oldest first)', 'Systolic (high-low)', 'Diastolic (high-low)', 'Pulse (high-low)'],
  bloodGlucose: ['Date (newest first)', 'Date (oldest first)', 'Glucose (high-low)', 'Glucose (low-high)'],
  weight: ['Date (newest first)', 'Date (oldest first)', 'Weight (high-low)', 'Weight (low-high)'],
};

/* ──────────────────────  CUSTOM DROPDOWN  ────────────────────── */
const CustomDropdown = ({ visible, options, onSelect, onClose }) => {
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.dropdownMenu}>
          {options.map((item) => (
            <TouchableOpacity
              key={item}
              style={styles.dropdownItem}
              onPress={() => {
                onSelect(item);
                onClose();
              }}>
              <Text style={styles.dropdownItemText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

/* ──────────────────────  MAIN COMPONENT  ────────────────────── */
const DataList = ({ navigation, route }) => {
  const { dataType = 'bloodPressure' } = route.params || {};

  const [selectedPeriod, setSelectedPeriod] = useState('All'); // Default to 'All' to fetch all records
  const [sortBy, setSortBy] = useState('Date (newest first)');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dateRangeType, setDateRangeType] = useState('range');
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Changes Added 
  // Calendar states
  const [showCalendar, setShowCalendar] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState('from'); // 'from' or 'to'
  const [tempDate, setTempDate] = useState(new Date());
  const [showChartModal, setShowChartModal] = useState(false);
  const [activeTab, setActiveTab] = useState('Data List');


  /* ───── DATE FILTER LOGIC ───── */
  const getDateRange = () => {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    // Set end to the very end of today to capture all readings from today
    end.setHours(23, 59, 59, 999);

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
    } else if (selectedPeriod === 'Custom range' && fromDate && toDate) {
      start = parseDate(fromDate);
      start.setHours(0, 0, 0, 0);
      end = parseDate(toDate);
      end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  };

  /* ───── SORT LOGIC ───── */
  const sortData = (data) => {
    const sorted = [...data];
    if (sortBy === 'Date (newest first)') {
      sorted.sort((a, b) => b.timestamp - a.timestamp);
    } else if (sortBy === 'Date (oldest first)') {
      sorted.sort((a, b) => a.timestamp - b.timestamp);
    } else if (sortBy === 'Systolic (high-low)') {
      sorted.sort((a, b) => b.systolic - a.systolic);
    } else if (sortBy === 'Diastolic (high-low)') {
      sorted.sort((a, b) => b.diastolic - a.diastolic);
    } else if (sortBy === 'Pulse (high-low)') {
      sorted.sort((a, b) => b.pulse - a.pulse);
    } else if (sortBy === 'Glucose (high-low)') {
      sorted.sort((a, b) => b.glucose - a.glucose);
    } else if (sortBy === 'Weight (high-low)') {
      sorted.sort((a, b) => b.weight - a.weight);
    }
    return sorted;
  };

  /* ───── FETCH & FILTER DATA ───── */
  const fetchPatientData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get practiceId and patientId from AsyncStorage
      let practiceId = await AsyncStorage.getItem('practiceId');
      let patientId = await AsyncStorage.getItem('patientId');

      if (!practiceId || !patientId) {
        // Fallback: Try to resolve from stored user data if not directly key-stored
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          practiceId = practiceId || user.practice_id;
          // Prioritize numeric patient record ID
          patientId = patientId || user.patients_table_id || user.id || user.patient_id;

          // Store correctly for measurement APIs
          if (practiceId) await AsyncStorage.setItem('practiceId', String(practiceId));
          if (patientId) await AsyncStorage.setItem('patientId', String(patientId));
        }
      }

      // If still missing, try to fetch current user to fill gaps (last resort)
      if (!practiceId || !patientId) {
        try {
          console.log("Resolving IDs from getCurrentUser in DataList...");
          const userResult = await apiService.getCurrentUser();
          const user = userResult?.data?.user || userResult?.data;
          if (user) {
            practiceId = String(user.practice_id);
            // Prioritize numeric patient record ID returned from enriched user object
            patientId = String(user.patients_table_id || user.id);

            // Store for next time
            if (practiceId) await AsyncStorage.setItem('practiceId', practiceId);
            if (patientId) await AsyncStorage.setItem('patientId', patientId);
          }
        } catch (e) {
          console.log("Could not fetch user for ID resolution", e);
        }
      }

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

      // For "All" period, don't send date filters to get all records
      const fromDateStr = selectedPeriod === 'All' ? null : formatDateForAPI(start);
      const toDateStr = selectedPeriod === 'All' ? null : formatDateForAPI(end);

      const rawList = [];
      let result = null;

      // Fetch ALL data based on type using apiService (date filters are optional)
      if (dataType === 'bloodPressure') {
        result = await apiService.getBloodPressure(practiceId, patientId, {
          fromDate: fromDateStr,
          toDate: toDateStr,
        });


        // Backend returns data directly in result.data array (not nested in measurements)
        const measurements = Array.isArray(result.data)
          ? result.data
          : (result.data?.measurements ? (Array.isArray(result.data.measurements) ? result.data.measurements : [result.data.measurements]) : []);



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


        // Backend returns data directly in result.data array (not nested in measurements)
        const measurements = Array.isArray(result.data)
          ? result.data
          : (result.data?.measurements ? (Array.isArray(result.data.measurements) ? result.data.measurements : [result.data.measurements]) : []);



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


        // Backend returns data directly in result.data array (not nested in measurements)
        const measurements = Array.isArray(result.data)
          ? result.data
          : (result.data?.measurements ? (Array.isArray(result.data.measurements) ? result.data.measurements : [result.data.measurements]) : []);



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

      const sorted = sortData(rawList);
      setMeasurements(sorted);
    } catch (err) {
      console.log('❌ Error fetching patient data:', err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [dataType, selectedPeriod, sortBy, fromDate, toDate]);

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
  const parseDate = (dateString) => {
    if (!dateString) return new Date();
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0]) - 1;
      const day = parseInt(parts[1]);
      const year = parseInt(parts[2]) + (parts[2].length === 2 ? 2000 : 0);
      return new Date(year, month, day);
    }
    return new Date();
  };

  const getEffectivePeriod = () => {
    if (selectedPeriod !== 'Custom range') return selectedPeriod;
    if (!fromDate || !toDate) return 'All';
    try {
      const start = parseDate(fromDate);
      const end = parseDate(toDate);
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
            { data: dataToUse.map(m => m.systolic), strokeWidth: 3, color: () => NAVY_BLUE },
            { data: dataToUse.map(m => m.diastolic), strokeWidth: 3, color: () => '#EF4444' },
          ]
          : [
            {
              data: dataToUse.map(m => dataType === 'bloodGlucose' ? m.glucose : m.weight),
              color: () => NAVY_BLUE,
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
    color: () => NAVY_BLUE,
    labelColor: () => TEXT_LIGHT,
    propsForDots: { r: '5', strokeWidth: '2', stroke: NAVY_BLUE },
    propsForLabels: { fontSize: 10 },
  };

  /* ───── Add Changes ───── */
  /* ───── CALENDAR HANDLER ───── */
  const handleDateSelect = (selectedDate) => {
    if (selectedDate) {
      const formattedDate = selectedDate.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });

      if (showDatePicker === 'from') {
        setFromDate(formattedDate);
      } else {
        setToDate(formattedDate);
      }
      setShowCalendar(false);
    }
  };
  const handleCalendarOpen = (type) => {
    setShowDatePicker(type);
    if (type === 'from' && fromDate) {
      setTempDate(parseDate(fromDate));
    } else if (type === 'to' && toDate) {
      setTempDate(parseDate(toDate));
    } else {
      setTempDate(new Date());
    }
    setShowCalendar(true);
  };

  const handleOpenChartModal = () => {
    Orientation.lockToLandscape();
    setShowChartModal(true);
  };

  const handleCloseChartModal = () => {
    Orientation.lockToPortrait();
    setShowChartModal(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: WHITE }]}>
      <StatusBar barStyle="dark-content" backgroundColor={WHITE} />

      <View style={[styles.mainContainer, { backgroundColor: WHITE }]}>
        {/* Header - White Bar */}
        <View style={{ backgroundColor: WHITE, paddingTop: scaleHeight(20), paddingBottom: scaleHeight(20), paddingHorizontal: scaleWidth(20) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', position: 'relative', height: scaleHeight(45) }}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ position: 'absolute', left: 0, justifyContent: 'center', height: '100%', zIndex: 10 }}
            >
              <Text style={{ color: '#0A1C30', fontSize: scaleFont(38), fontWeight: '300', lineHeight: scaleFont(42), includeFontPadding: false }}>‹</Text>
            </TouchableOpacity>
            <Text style={{ color: '#0A1C30', fontSize: scaleFont(24), fontWeight: '700', textAlign: 'center' }}>{getTitle()}</Text>
          </View>
        </View>

        {/* Custom Tabs */}
        <View style={{ paddingHorizontal: scaleWidth(20), paddingBottom: scaleHeight(15), marginTop: scaleHeight(15) }}>
          <View style={{ flexDirection: 'row', borderRadius: scaleWidth(25), borderWidth: 1.5, borderColor: '#293d55', overflow: 'hidden' }}>
            <TouchableOpacity
              style={{ flex: 1, paddingVertical: scaleHeight(12), alignItems: 'center', backgroundColor: activeTab === 'Data List' ? '#293d55' : WHITE, borderRadius: scaleWidth(25) }}
              onPress={() => setActiveTab('Data List')}
            >
              <Text style={{ fontSize: scaleFont(14), fontWeight: '700', color: activeTab === 'Data List' ? WHITE : '#0A1C30' }}>Data List</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, paddingVertical: scaleHeight(12), alignItems: 'center', backgroundColor: activeTab === 'Graph List' ? '#293d55' : WHITE, borderRadius: scaleWidth(25) }}
              onPress={() => setActiveTab('Graph List')}
            >
              <Text style={{ fontSize: scaleFont(14), fontWeight: '700', color: activeTab === 'Graph List' ? WHITE : '#0A1C30' }}>Graph List</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* White section (Body section) */}
        <View style={[styles.bottomLightSection, { marginTop: 0, paddingTop: 10, borderTopLeftRadius: 0, borderTopRightRadius: 0 }]}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            {/* Query Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Query Period</Text>

              <View style={styles.row}>
                <TouchableOpacity style={styles.radio} onPress={() => setDateRangeType('range')}>
                  <View style={[styles.radioCircle, dateRangeType === 'range' && styles.radioActive]} />
                  <Text style={styles.radioLabel}>Quick Select</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dropdown, dateRangeType !== 'range' && styles.disabled]}
                  disabled={dateRangeType !== 'range'}
                  onPress={() => setShowPeriodModal(true)}>
                  <Text style={styles.dropdownText}>{selectedPeriod}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.row}>
                <TouchableOpacity style={styles.radio} onPress={() => setDateRangeType('custom')}>
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
                {/* From Date with Calendar */}
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
                      !fromDate && { color: TEXT_LIGHT }
                    ]}>
                      {fromDate || "mm/dd/yyyy"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.to}>to</Text>

                {/* To Date with Calendar */}
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
                      !toDate && { color: TEXT_LIGHT }
                    ]}>
                      {toDate || "mm/dd/yyyy"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>


              <View style={styles.row}>
                <Text style={styles.sortLabel}>Sort Data by</Text>
                <TouchableOpacity style={styles.dropdown} onPress={() => setShowSortModal(true)}>
                  <Text style={styles.dropdownText}>{sortBy}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.queryBtn} onPress={fetchPatientData}>
                <Text style={styles.queryBtnText}>Query</Text>
              </TouchableOpacity>
            </View>

            {/* Trend Chart */}
            {activeTab === 'Graph List' && measurements.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Trend</Text>
                {measurements.length <= 5 ? (
                  <>
                    <LineChart
                      data={chartData}
                      width={width - 50}
                      height={180}
                      chartConfig={chartConfig}
                      bezier
                      style={styles.chart}
                      withHorizontalLines={true}
                      withVerticalLines={false}
                      fromZero={false}
                    />
                    {dataType === 'bloodPressure' && (
                      <View style={styles.legend}>
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: NAVY_BLUE }]} />
                          <Text style={styles.legendText}>Systolic</Text>
                        </View>
                        <View style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
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
                <Text style={styles.subtitle}>Date Range: {selectedPeriod}</Text>

                {loading ? (
                  <ActivityIndicator size="large" color={NAVY_BLUE} style={{ marginVertical: 30 }} />
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
        </View>
      </View>

      {/* Modals */}
      <CustomDropdown
        visible={showPeriodModal}
        options={periodOptions}
        onSelect={setSelectedPeriod}
        onClose={() => setShowPeriodModal(false)}
      />
      <CustomDropdown
        visible={showSortModal}
        options={sortOptions[dataType] || []}
        onSelect={setSortBy}
        onClose={() => setShowSortModal(false)}
      />

      {/* Calendar Modal */}
      <Modal
        transparent={true}
        visible={showCalendar}
        animationType="fade"
        onRequestClose={() => setShowCalendar(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          activeOpacity={1}
          onPress={() => setShowCalendar(false)}
        >
          <View style={{ backgroundColor: WHITE, borderRadius: 10 }}>
            <DateTimePicker
              value={tempDate}
              mode="date"
              display="spinner"
              onChange={(event, selectedDate) => {
                if (selectedDate) {
                  handleDateSelect(selectedDate);
                }
                setShowCalendar(false);
              }}
              style={{ width: 300, height: 200 }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Full Chart Modal */}
      <FullTrendChartModal
        visible={showChartModal}
        onClose={handleCloseChartModal}
        measurements={measurements}
        dataType={dataType}
        title={`${getTitle()} - Trend Chart`}
      />


    </SafeAreaView>
  );
};

/* ──────────────────────  STYLES  ────────────────────── */
/* ──────────────────────  STYLES  ────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY_BLUE },
  mainContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: NAVY_BLUE,
  },
  scroll: { flex: 1 },
  content: { padding: 16 },

  // --- Header Styles ---
  topDarkSection: {
    backgroundColor: NAVY_BLUE,
    height: scaleHeight(100),
    borderBottomLeftRadius: scaleWidth(35),
    borderBottomRightRadius: scaleWidth(35),
    paddingBottom: scaleHeight(10),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scaleWidth(20),
    paddingTop: scaleHeight(10),
  },
  backButton: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'left',
    minHeight: 55,
    minWidth: 55,
  },
  backButtonText: {
    fontSize: scaleFont(35),
    color: 'white',
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: scaleFont(22),
    fontWeight: Platform.OS === 'ios' ? '900' : 'bold',
    color: WHITE,
    textAlign: 'center',
    flex: 1,
    marginLeft: scaleWidth(5),
    ...Platform.select({
      android: {
        includeFontPadding: false,
        fontFamily: 'sans-serif-condensed',
      },
    }),
  },
  headerSpacer: {
    width: scaleWidth(36),
  },

  // --- Body Styles ---
  bottomLightSection: {
    flex: 1,
    backgroundColor: 'white',
    borderTopLeftRadius: scaleWidth(35),
    borderTopRightRadius: scaleWidth(35),
    marginTop: scaleWidth(-15),
    paddingTop: scaleWidth(20),
  },

  card: {
    backgroundColor: WHITE,
    borderRadius: scaleWidth(10),
    padding: scaleWidth(2),
    marginBottom: scaleHeight(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: scaleFont(18),
    fontWeight: '700',
    color: NAVY_BLUE,
    marginBottom: scaleHeight(12),
  },
  subtitle: {
    fontSize: scaleFont(14),
    color: TEXT_LIGHT,
    marginBottom: scaleHeight(12)
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleHeight(12),
    justifyContent: 'space-between'
  },
  radio: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  radioCircle: {
    width: scaleWidth(20),
    height: scaleWidth(20),
    borderRadius: scaleWidth(10),
    borderWidth: scaleWidth(2),
    borderColor: NAVY_BLUE,
    marginRight: scaleWidth(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: {
    backgroundColor: NAVY_BLUE
  },
  radioLabel: {
    fontSize: scaleFont(14),
    color: TEXT_LIGHT
  },
  dropdown: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: WHITE,
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleHeight(10),
    borderRadius: scaleWidth(8),
    marginLeft: scaleWidth(12),
    borderWidth: scaleWidth(1),
    borderColor: BORDER_GREY,
  },
  disabled: {
    opacity: 0.5
  },
  dropdownText: {
    fontSize: scaleFont(14),
    color: NAVY_BLUE,
    fontWeight: '600',
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scaleHeight(12)
  },
  dateInputContainer: {
    flex: 1,
  },
  dateInputTouchable: {
    height: scaleHeight(40),
    backgroundColor: WHITE,
    borderRadius: scaleWidth(8),
    borderWidth: scaleWidth(1),
    borderColor: BORDER_GREY,
    justifyContent: 'center',
    paddingHorizontal: scaleWidth(12),
  },
  dateInputText: {
    fontSize: scaleFont(14),
    color: NAVY_BLUE,
    fontWeight: '600',
  },
  to: {
    fontSize: scaleFont(14),
    color: TEXT_LIGHT,
    marginHorizontal: scaleWidth(8)
  },

  // Calendar Styles
  calendarModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarContainer: {
    backgroundColor: WHITE,
    borderRadius: scaleWidth(12),
    padding: scaleWidth(20),
    width: '90%',
    maxWidth: 400,
    ...Platform.select({
      ios: {
        marginBottom: scaleHeight(100),
      },
    }),
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scaleHeight(20),
  },
  calendarTitle: {
    fontSize: scaleFont(18),
    fontWeight: '600',
    color: NAVY_BLUE,
  },
  closeButton: {
    padding: scaleWidth(8),
  },
  closeButtonText: {
    fontSize: scaleFont(20),
    color: TEXT_LIGHT,
  },
  dateTimePicker: {
    width: '100%',
    ...Platform.select({
      ios: {
        height: scaleHeight(200),
      },
    }),
  },
  calendarButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: scaleHeight(20),
    gap: scaleWidth(12),
  },
  calendarButton: {
    paddingHorizontal: scaleWidth(20),
    paddingVertical: scaleHeight(10),
    borderRadius: scaleWidth(8),
    borderWidth: scaleWidth(1),
    borderColor: BORDER_GREY,
  },
  calendarButtonText: {
    color: TEXT_LIGHT,
    fontSize: scaleFont(14),
  },
  calendarButtonPrimary: {
    backgroundColor: NAVY_BLUE,
    borderColor: NAVY_BLUE,
  },
  calendarButtonPrimaryText: {
    color: WHITE,
    fontSize: scaleFont(14),
    fontWeight: '600',
  },

  sortLabel: {
    fontSize: scaleFont(14),
    color: TEXT_LIGHT,
    width: scaleWidth(100)
  },
  queryBtn: {
    backgroundColor: NAVY_BLUE,
    paddingVertical: scaleHeight(12),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
    marginTop: scaleHeight(8),
    borderWidth: scaleWidth(1),
    borderColor: NAVY_BLUE,
  },
  queryBtnText: {
    color: WHITE,
    fontWeight: '600',
    fontSize: scaleFont(15)
  },

  chart: {
    borderRadius: scaleWidth(12),
    marginVertical: scaleHeight(8)
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: scaleHeight(8)
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: scaleWidth(12)
  },
  legendDot: {
    width: scaleWidth(10),
    height: scaleWidth(10),
    borderRadius: scaleWidth(5),
    marginRight: scaleWidth(6)
  },
  legendText: {
    fontSize: scaleFont(12),
    color: TEXT_LIGHT
  },

  table: {
    borderWidth: scaleWidth(1),
    borderColor: BORDER_GREY,
    borderRadius: scaleWidth(12),
    overflow: 'hidden',
    backgroundColor: WHITE,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: LIGHT_GREY,
    paddingVertical: scaleHeight(10),
    borderBottomWidth: scaleWidth(1),
    borderBottomColor: BORDER_GREY,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: scaleHeight(12),
    borderBottomWidth: scaleWidth(1),
    borderColor: BORDER_GREY,
    backgroundColor: WHITE,
  },
  th: {
    fontWeight: '600',
    fontSize: scaleFont(12),
    color: NAVY_BLUE
  },
  td: {
    fontSize: scaleFont(13),
    color: NAVY_BLUE,
    fontWeight: '600',
  },
  colDate: {
    width: '22%',
    paddingLeft: scaleWidth(12)
  },
  colTime: {
    width: '22%',
    textAlign: 'center'
  },
  colValue: {
    width: '18%',
    textAlign: 'center'
  },
  colUnit: {
    width: '18%',
    textAlign: 'center'
  },
  danger: {
    color: '#EF4444',
    fontWeight: '600'
  },

  emptyText: {
    textAlign: 'center',
    color: TEXT_LIGHT,
    fontSize: scaleFont(15),
    marginVertical: scaleHeight(20)
  },
  errorText: {
    textAlign: 'center',
    color: '#EF4444',
    fontSize: scaleFont(14),
    marginVertical: scaleHeight(20)
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  dropdownMenu: {
    backgroundColor: WHITE,
    borderRadius: scaleWidth(16),
    width: width * 0.85,
    maxHeight: scaleHeight(300),
    padding: scaleWidth(8),
    borderWidth: scaleWidth(1),
    borderColor: BORDER_GREY,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownItem: {
    padding: scaleHeight(14),
    borderBottomWidth: scaleWidth(1),
    borderColor: BORDER_GREY,
    backgroundColor: WHITE,
  },
  dropdownItemText: {
    fontSize: scaleFont(15),
    color: NAVY_BLUE,
    fontWeight: '600',
  },

  // View Chart Button
  viewChartButton: {
    backgroundColor: NAVY_BLUE,
    paddingVertical: scaleHeight(16),
    paddingHorizontal: scaleWidth(20),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: scaleHeight(10),
  },
  viewChartButtonText: {
    color: WHITE,
    fontSize: scaleFont(16),
    fontWeight: '600',
  },

  // Chart Modal Styles
  chartModalContainer: {
    flex: 1,
    backgroundColor: WHITE,
  },
  chartModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scaleWidth(20),
    paddingVertical: scaleHeight(15),
    backgroundColor: NAVY_BLUE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_GREY,
  },
  chartModalTitle: {
    fontSize: scaleFont(18),
    fontWeight: '700',
    color: WHITE,
    flex: 1,
  },
  chartModalCloseButton: {
    padding: scaleWidth(8),
    marginLeft: scaleWidth(10),
  },
  chartModalCloseText: {
    fontSize: scaleFont(24),
    color: WHITE,
    fontWeight: '300',
  },
  chartModalScroll: {
    flex: 1,
  },
  chartModalContent: {
    padding: scaleWidth(20),
  },
  chartModalChartContainer: {
    backgroundColor: WHITE,
  },
  chartModalChart: {
    borderRadius: scaleWidth(8),
  },
});

export default DataList;