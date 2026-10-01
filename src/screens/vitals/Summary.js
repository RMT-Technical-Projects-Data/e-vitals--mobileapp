import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  TextInput,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, fonts } from '../../config/globall';
import apiService from '../../services/apiService';
import { API_CONFIG } from '../../config/api';

const { width, height } = Dimensions.get('window');

// 🔹 Scaling helpers
const baseWidth = 375;
const baseHeight = 812;
const scaleWidth = (size) => (width / baseWidth) * size;
const scaleHeight = (size) => (height / baseHeight) * size;
const scaleFont = (size) => scaleWidth(size);

/* ──────────────────────  COLORS  ────────────────────── */
const NAVY_BLUE = colors.primaryButton || '#293d55';
const WHITE = '#FFFFFF';
const LIGHT_GREY = '#F4F7F9';
const BORDER_GREY = '#E0E0E0';
const TEXT_LIGHT = '#666666';

/* ──────────────────────  DROPDOWN OPTIONS  ────────────────────── */
const periodOptions = [
  'Last 7 days',
  'Last 2 weeks',
  'Last month',
  'Last 90 Days',
  'Last year',
  'All',
];

const sortOptions = [
  'Weekly average',
  'Date (newest first)',
  'Date (oldest first)',
  'Systolic (highest first)',
  'Diastolic (highest first)',
  'Pulse (highest first)',
];

const weightSortOptions = [
  'Weekly average',
  'Date (newest first)',
  'Date (oldest first)',
  'Weight (highest first)',
  'Weight (lowest first)',
];

const glucoseSortOptions = [
  'Weekly average',
  'Date (newest first)',
  'Date (oldest first)',
  'Glucose (highest first)',
  'Glucose (lowest first)',
];

// Map period options to API values
const periodToApiValue = {
  'Last 7 days': 3,
  'Last 2 weeks': 2,
  'Last month': 1,
  'Last 90 Days': 5,
  'Last year': 4,
  'All': 6,
};

/* ──────────────────────  CUSTOM DROPDOWN  ────────────────────── */
const CustomDropdown = ({ visible, options, onSelect, onClose }) => {
  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.dropdownMenu}>
          <FlatList
            data={options}
            keyExtractor={(item, index) => `${item}-${index}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <Text style={styles.dropdownItemText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export default function SummaryScreen({ navigation, route }) {
  const [activeChart, setActiveChart] = useState('bloodPressure');
  const [selectedPeriod, setSelectedPeriod] = useState('Last 7 days');
  const [sortBy, setSortBy] = useState('Weekly average');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dateRangeType, setDateRangeType] = useState('range');
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [apiData, setApiData] = useState(null);
  const [patientId, setPatientId] = useState(null);
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);

  useEffect(() => {
    if (route.params?.chartType) {
      setActiveChart(route.params.chartType);
    }
    fetchPatientData();
  }, [route.params]);

  // Refetch data when activeChart changes
  useEffect(() => {
    if (patientId) {
      if (patientId) {
        const dateRangeValue = periodToApiValue[selectedPeriod];
        fetchGraphData(patientId, dateRangeValue, dateRangeType, fromDate, toDate);
      }
    }
  }, [activeChart]);

  const fetchPatientData = async () => {
    try {
      setIsLoading(true);

      // Prioritize direct keys in AsyncStorage
      let practiceId = await AsyncStorage.getItem('practiceId');
      let patientId = await AsyncStorage.getItem('patientId');

      if (!practiceId || !patientId) {
        // Fallback to 'user' object if direct keys are missing
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          practiceId = practiceId || user.practice_id;
          patientId = patientId || user.patients_table_id || user.id;

          // Store for future use
          if (practiceId) await AsyncStorage.setItem('practiceId', String(practiceId));
          if (patientId) await AsyncStorage.setItem('patientId', String(patientId));
        }
      }

      if (patientId) {
        setPatientId(patientId);
        const dateRangeValue = periodToApiValue[selectedPeriod];
        fetchGraphData(patientId, dateRangeValue, dateRangeType, fromDate, toDate);
      } else {
        // Final fallback: fetch user to resolve IDs
        const userResult = await apiService.getCurrentUser();
        const user = userResult?.data?.user || userResult?.data;
        if (user) {
          practiceId = String(user.practice_id);
          patientId = String(user.patients_table_id || user.id);

          if (practiceId) await AsyncStorage.setItem('practiceId', practiceId);
          if (patientId) await AsyncStorage.setItem('patientId', patientId);

          setPatientId(patientId);
          const dateRangeValue = periodToApiValue[selectedPeriod];
          fetchGraphData(patientId, dateRangeValue, dateRangeType, fromDate, toDate);
        } else {
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('Error fetching patient data:', error);
      setIsLoading(false);
    }
  };

  const formatDateForAPI = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateForDisplay = (date) => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const fetchGraphData = async (id, dateRangeValue, isQuickSelect, startDate = null, endDate = null) => {
    setIsLoading(true);
    try {
      // Get practiceId and patientId from AsyncStorage
      // These are stored by Home.js from the latest-vitals API
      let practiceId = await AsyncStorage.getItem('practiceId');
      let patientId = await AsyncStorage.getItem('patientId');

      // Use passed id if available and valid
      if (id && !patientId) {
        patientId = id;
      }

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
          console.log("Resolving IDs from getCurrentUser...");
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

      // Calculate date range based on period selection
      const now = new Date();
      let fromDateStr = null;
      let toDateStr = null;

      if (isQuickSelect === 'range') {
        // Calculate date range based on periodToApiValue
        const daysMap = {
          1: 30,   // Last month
          2: 14,   // Last 2 weeks
          3: 7,    // Last 7 days
          4: 365,  // Last year
          5: 90,   // Last 90 Days
          6: null  // All
        };

        const days = daysMap[dateRangeValue];
        if (days) {
          const startDate = new Date(now);
          startDate.setDate(startDate.getDate() - days);

          // Use local date strings instead of UTC toISOString
          const formatDateLocal = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          };

          fromDateStr = formatDateLocal(startDate);
          toDateStr = formatDateLocal(now);
        }
      } else {
        // Custom date range
        if (startDate && endDate) {
          fromDateStr = startDate;
          toDateStr = endDate;
        } else {
          console.log("⚠️ Custom range selected but dates are missing");
          // Only show alert if this was triggered by a manual query (handled in handleQuery)
          // For initial loads, just skip silently
          setIsLoading(false);
          return;
        }
      }

      // Fetch measurements based on active chart type

      try {
        let measurementsResult = null;
        let measurements = [];

        // Fetch data based on chart type
        if (activeChart === 'bloodPressure') {
          measurementsResult = await apiService.getBloodPressure(practiceId, patientId, {
            fromDate: fromDateStr,
            toDate: toDateStr,
          });
        } else if (activeChart === 'bloodGlucose') {
          measurementsResult = await apiService.getBloodGlucose(practiceId, patientId, {
            fromDate: fromDateStr,
            toDate: toDateStr,
          });
        } else if (activeChart === 'weight') {
          measurementsResult = await apiService.getWeight(practiceId, patientId, {
            fromDate: fromDateStr,
            toDate: toDateStr,
          });
        }

        console.log(`✅ ${activeChart} API Response:`, JSON.stringify(measurementsResult, null, 2));

        if (measurementsResult && measurementsResult.success && measurementsResult.data) {
          measurements = Array.isArray(measurementsResult.data)
            ? measurementsResult.data
            : (measurementsResult.data?.measurements ? (Array.isArray(measurementsResult.data.measurements) ? measurementsResult.data.measurements : [measurementsResult.data.measurements]) : []);

          if (measurements.length > 0) {
          }

          if (measurements.length === 0) {
            setApiData({
              success: true,
              data: {
                dailyTrendDate: [],
                dailyTrendGraphData: activeChart === 'bloodPressure' ? { systolic: [], diastolic: [] } : { values: [] },
                MeanChart: [],
                xAxisData: []
              }
            });
            setIsLoading(false);
            return;
          }

          // Transform measurements into graph data format based on chart type
          let graphData = {
            success: true,
            data: {
              dailyTrendDate: [],
              dailyTrendGraphData: {},
              MeanChart: [],
              xAxisData: []
            }
          };

          // Sort measurements by date
          measurements.sort((a, b) => {
            const dateA = new Date(a.measure_new_date_time || a.measure_date_time || a.created_at);
            const dateB = new Date(b.measure_new_date_time || b.measure_date_time || b.created_at);
            return dateA - dateB;
          });

          // Group by date and calculate daily averages
          const dailyData = {};
          let processedCount = 0;
          measurements.forEach(measurement => {
            const dateStr = measurement.measure_new_date_time || measurement.measure_date_time || measurement.created_at;
            if (!dateStr) {
              console.log('⚠️ Measurement missing date:', measurement);
              return;
            }

            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
              console.log('⚠️ Invalid date in measurement:', dateStr, measurement);
              return;
            }

            const dateKey = date.toISOString().split('T')[0];
            processedCount++;

            if (!dailyData[dateKey]) {
              dailyData[dateKey] = {
                dates: [],
                values: []
              };
            }

            if (activeChart === 'bloodPressure') {
              const systolic = parseFloat(measurement.systolic_pressure || measurement.systolic || 0);
              const diastolic = parseFloat(measurement.diastolic_pressure || measurement.diastolic || 0);

              if (!dailyData[dateKey].systolic) dailyData[dateKey].systolic = [];
              if (!dailyData[dateKey].diastolic) dailyData[dateKey].diastolic = [];

              // Allow 0 values but filter out NaN
              if (!isNaN(systolic)) {
                dailyData[dateKey].systolic.push(systolic);
              }
              if (!isNaN(diastolic)) {
                dailyData[dateKey].diastolic.push(diastolic);
              }
            } else if (activeChart === 'bloodGlucose') {
              const glucose = parseFloat(measurement.blood_glucose_value_1 || measurement.blood_glucose_value || measurement.value || 0);
              // Allow 0 values but filter out NaN
              if (!isNaN(glucose)) {
                dailyData[dateKey].values.push(glucose);
              }
            } else if (activeChart === 'weight') {
              let weight = parseFloat(measurement.weight || measurement.weight_value || measurement.value || 0);
              if (!isNaN(weight)) {
                dailyData[dateKey].values.push(weight);
              }
            }

            dailyData[dateKey].dates.push(date);
          });

          // Initialize graph data structure
          if (activeChart === 'bloodPressure') {
            graphData.data.dailyTrendGraphData = { systolic: [], diastolic: [] };
          } else {
            graphData.data.dailyTrendGraphData = { values: [] };
          }

          // Create trend data (daily averages)
          const sortedDates = Object.keys(dailyData).sort();

          if (sortedDates.length === 0) {
            console.log('⚠️ No dates found in dailyData, measurements might be empty or invalid');
            setApiData({
              success: true,
              data: {
                dailyTrendDate: [],
                dailyTrendGraphData: activeChart === 'bloodPressure' ? { systolic: [], diastolic: [] } : { values: [] },
                MeanChart: [],
                xAxisData: []
              }
            });
            setIsLoading(false);
            return;
          }

          sortedDates.forEach(dateKey => {
            const dayData = dailyData[dateKey];
            graphData.data.dailyTrendDate.push(dateKey);

            if (activeChart === 'bloodPressure') {
              const avgSystolic = dayData.systolic && dayData.systolic.length > 0
                ? dayData.systolic.reduce((a, b) => a + b, 0) / dayData.systolic.length
                : null;
              const avgDiastolic = dayData.diastolic && dayData.diastolic.length > 0
                ? dayData.diastolic.reduce((a, b) => a + b, 0) / dayData.diastolic.length
                : null;

              // Only push if we have valid averages
              if (avgSystolic !== null && !isNaN(avgSystolic)) {
                graphData.data.dailyTrendGraphData.systolic.push(avgSystolic);
              } else {
                graphData.data.dailyTrendGraphData.systolic.push(0);
              }

              if (avgDiastolic !== null && !isNaN(avgDiastolic)) {
                graphData.data.dailyTrendGraphData.diastolic.push(avgDiastolic);
              } else {
                graphData.data.dailyTrendGraphData.diastolic.push(0);
              }

              // Mean chart data (same as trend for now)
              graphData.data.MeanChart.push({
                avgOfSystolic: avgSystolic !== null && !isNaN(avgSystolic) ? avgSystolic : 0,
                avgOfDiastolic: avgDiastolic !== null && !isNaN(avgDiastolic) ? avgDiastolic : 0
              });
            } else {
              const avgValue = dayData.values && dayData.values.length > 0
                ? dayData.values.reduce((a, b) => a + b, 0) / dayData.values.length
                : null;

              // Only push if we have valid average
              if (avgValue !== null && !isNaN(avgValue)) {
                graphData.data.dailyTrendGraphData.values.push(avgValue);
              } else {
                graphData.data.dailyTrendGraphData.values.push(0);
              }

              // Mean chart data (same as trend for now)
              if (activeChart === 'bloodGlucose') {
                graphData.data.MeanChart.push({
                  avgOfGlucose: avgValue !== null && !isNaN(avgValue) ? avgValue : 0
                });
              } else if (activeChart === 'weight') {
                graphData.data.MeanChart.push({
                  avgOfWeight: avgValue !== null && !isNaN(avgValue) ? avgValue : 0
                });
              }
            }

            graphData.data.xAxisData.push({
              hAxis: dateKey
            });
          });

          setApiData(graphData);
        } else {
          setApiData({
            success: true, data: {
              dailyTrendDate: [],
              dailyTrendGraphData: {},
              MeanChart: [],
              xAxisData: []
            }
          });
        }
      } catch (measurementsError) {
        console.error("❌ Error fetching measurements:", measurementsError);
        throw new Error('Failed to fetch graph data: ' + measurementsError.message);
      }
    } catch (error) {
      console.error("🔥 Error fetching graph data:", error);
      Alert.alert('Error', error.message || 'Failed to load graph data');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate properly spaced Y-axis values for blood pressure (0-200 mmHg)
  const generateYAxisValues = () => {
    const values = [];
    for (let i = 0; i <= 200; i += 20) {
      values.push(i);
    }
    return values.reverse();
  };

  const getEffectivePeriod = () => {
    if (dateRangeType === 'range') return selectedPeriod;
    if (!fromDate || !toDate) return 'All';
    try {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));
      if (diffDays <= 8) return 'Last 7 days';
      if (diffDays <= 16) return 'Last 2 weeks';
      if (diffDays <= 45) return 'Last month';
      if (diffDays <= 110) return 'Last 90 Days';
      if (diffDays <= 380) return 'Last year';
      return 'All';
    } catch (e) {
      return 'All';
    }
  };

  // Helper function to get trend X-axis
  const getTrendXAxis = (dates, period) => {
    if (!dates || !Array.isArray(dates) || dates.length === 0) return [];

    let targetCount = 6; // Default to ~6 labels
    if (period === 'Last 7 days') targetCount = 7;
    if (period === 'Last month') targetCount = 5;
    if (period === 'Last year' || period === 'All' || period === 'Last 90 Days') targetCount = 6;

    const step = Math.max(1, Math.ceil(dates.length / targetCount));
    const result = [];

    for (let i = 0; i < dates.length; i += step) {
      result.push(dates[i]);
    }

    // Ensure last date is always included if not already
    if (dates.length > 0 && result[result.length - 1] !== dates[dates.length - 1]) {
      // If we have many items, replace the last one if it's too close, or just add it
      if (result.length > 1 && (dates.length - 1 - dates.indexOf(result[result.length - 1])) < step / 2) {
        result[result.length - 1] = dates[dates.length - 1];
      } else {
        result.push(dates[dates.length - 1]);
      }
    }

    return result;
  };

  // Helper function to get mean X-axis
  const getMeanXAxis = (xAxisData) => {
    if (!xAxisData || !Array.isArray(xAxisData)) return [];

    const labels = xAxisData.map(item => item.hAxis || '');
    if (labels.length <= 6) return labels;

    // Filter to ~6 labels if there are too many
    const step = Math.ceil(labels.length / 6);
    const result = [];
    for (let i = 0; i < labels.length; i += step) {
      result.push(labels[i]);
    }

    // Ensure the last label is included
    if (labels.length > 0 && result[result.length - 1] !== labels[labels.length - 1]) {
      result.push(labels[labels.length - 1]);
    }

    return result;
  };

  const getChartData = () => {
    const yAxisValues = generateYAxisValues();
    const defaultData = {
      bloodPressure: {
        title: 'Blood Pressure',
        trend: { systolic: [], diastolic: [] },
        mean: { systolic: [], diastolic: [] },
        colors: { primary: NAVY_BLUE, secondary: '#EF4444' },
        yAxis: yAxisValues,
        xAxis: []
      },
      bloodGlucose: {
        title: 'Blood Glucose',
        trend: { glucose: [] },
        mean: { glucose: [] },
        colors: { primary: NAVY_BLUE },
        yAxis: [200, 150, 100, 50, 0],
        xAxis: []
      },
      weight: {
        title: 'Weight',
        trend: { weight: [] },
        mean: { weight: [] },
        colors: { primary: NAVY_BLUE },
        yAxis: [200, 175, 150, 125, 100],
        xAxis: []
      },
    };

    // Process data for all chart types
    if (!apiData || !apiData.data) {
      return defaultData[activeChart];
    }

    // Process API data based on chart type
    const trendDates = apiData.data?.dailyTrendDate || [];

    if (activeChart === 'bloodPressure') {
      const systolicData = apiData.data?.dailyTrendGraphData?.systolic || [];
      const diastolicData = apiData.data?.dailyTrendGraphData?.diastolic || [];

      // Create aligned arrays where each date has corresponding data
      const alignedSystolic = [];
      const alignedDiastolic = [];

      trendDates.forEach((date, index) => {
        if (index < systolicData.length) {
          const num = parseFloat(systolicData[index]);
          alignedSystolic.push(isNaN(num) ? 0 : num);
        } else {
          alignedSystolic.push(0);
        }

        if (index < diastolicData.length) {
          const num = parseFloat(diastolicData[index]);
          alignedDiastolic.push(isNaN(num) ? 0 : num);
        } else {
          alignedDiastolic.push(0);
        }
      });

      const trendData = {
        systolic: alignedSystolic,
        diastolic: alignedDiastolic
      };

      // Process API data for blood pressure chart - Mean Chart
      let meanData = { systolic: [], diastolic: [] };
      if (apiData.data?.MeanChart && Array.isArray(apiData.data.MeanChart) && apiData.data.MeanChart.length > 0) {
        meanData = {
          systolic: apiData.data.MeanChart.map(item => {
            const num = parseFloat(item.avgOfSystolic || 0);
            return isNaN(num) ? 0 : num;
          }),
          diastolic: apiData.data.MeanChart.map(item => {
            const num = parseFloat(item.avgOfDiastolic || 0);
            return isNaN(num) ? 0 : num;
          })
        };
      }

      return {
        title: 'Blood Pressure',
        trend: trendData,
        mean: meanData,
        colors: { primary: NAVY_BLUE, secondary: '#EF4444' },
        yAxis: yAxisValues,
        trendXAxis: getTrendXAxis(trendDates, getEffectivePeriod()),
        meanXAxis: getMeanXAxis(apiData.data?.xAxisData),
        allTrendDates: trendDates
      };
    } else if (activeChart === 'bloodGlucose') {
      const glucoseData = apiData.data?.dailyTrendGraphData?.values || [];
      const alignedGlucose = trendDates.map((date, index) => {
        if (index < glucoseData.length) {
          const num = parseFloat(glucoseData[index]);
          return isNaN(num) ? 0 : num;
        }
        return 0;
      });

      let meanData = { glucose: [] };
      if (apiData.data?.MeanChart && Array.isArray(apiData.data.MeanChart) && apiData.data.MeanChart.length > 0) {
        meanData = {
          glucose: apiData.data.MeanChart.map(item => {
            const num = parseFloat(item.avgOfGlucose || 0);
            return isNaN(num) ? 0 : num;
          })
        };
      }

      return {
        title: 'Blood Glucose',
        trend: { glucose: alignedGlucose },
        mean: meanData,
        colors: { primary: NAVY_BLUE },
        yAxis: [200, 150, 100, 50, 0],
        trendXAxis: getTrendXAxis(trendDates, getEffectivePeriod()),
        meanXAxis: getMeanXAxis(apiData.data?.xAxisData),
        allTrendDates: trendDates
      };
    } else if (activeChart === 'weight') {
      const weightData = apiData.data?.dailyTrendGraphData?.values || [];
      const alignedWeight = trendDates.map((date, index) => {
        if (index < weightData.length) {
          const num = parseFloat(weightData[index]);
          return isNaN(num) ? 0 : num;
        }
        return 0;
      });

      let meanData = { weight: [] };
      if (apiData.data?.MeanChart && Array.isArray(apiData.data.MeanChart) && apiData.data.MeanChart.length > 0) {
        meanData = {
          weight: apiData.data.MeanChart.map(item => {
            const num = parseFloat(item.avgOfWeight || 0);
            return isNaN(num) ? 0 : num;
          })
        };
      }

      return {
        title: 'Weight',
        trend: { weight: alignedWeight },
        mean: meanData,
        colors: { primary: NAVY_BLUE },
        yAxis: [200, 175, 150, 125, 100],
        trendXAxis: getTrendXAxis(trendDates, getEffectivePeriod()),
        meanXAxis: getMeanXAxis(apiData.data?.xAxisData),
        allTrendDates: trendDates
      };
    }

    return defaultData[activeChart];
  };

  const getSortOptions = () => {
    switch (activeChart) {
      case 'bloodPressure':
        return sortOptions;
      case 'bloodGlucose':
        return glucoseSortOptions;
      case 'weight':
        return weightSortOptions;
      default:
        return sortOptions;
    }
  };

  const createPath = (data, chartH, minValue, maxValue) => {
    if (!data || data.length === 0) {
      console.log('⚠️ createPath: Empty or no data provided');
      return '';
    }

    const validData = Array.isArray(data)
      ? data.map(val => {
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
      })
      : [0];

    if (validData.length === 0) {
      console.log('⚠️ createPath: No valid data after parsing');
      return '';
    }

    const xDivisor = Math.max(1, validData.length - 1);
    const range = maxValue - minValue;
    const effectiveRange = range === 0 ? 1 : range;

    const path = validData
      .map((value, index) => {
        const x = (index / xDivisor) * scaleWidth(250);
        const y = chartH - ((value - minValue) / effectiveRange) * chartH;

        return `${index === 0 ? 'M' : 'L'}${x} ${y}`;
      })
      .join(' ');

    console.log(`📈 createPath: Created path with ${validData.length} points, path length: ${path.length}`);
    return path;
  };

  const renderXAxis = (xAxisData, isMeanChart = false) => {
    if (!xAxisData || xAxisData.length === 0) return null;

    const effectivePeriod = getEffectivePeriod();

    return (
      <View style={styles.xAxis}>
        {xAxisData.map((label, index) => {
          let formattedLabel = label;
          try {
            // Check if it's a weekly range format
            let dateToFormat = label;
            if (label.includes('~')) {
              dateToFormat = label.split('~')[0].trim();
            }

            // Standardize format to recognizable date
            let date;
            if (dateToFormat.includes('-')) {
              date = new Date(dateToFormat);
            } else if (dateToFormat.includes('/')) {
              const parts = dateToFormat.split('/');
              date = new Date(parts[2], parts[0] - 1, parts[1]);
            } else {
              // Try parsing DD MMM formats (like "01 Jan")
              date = new Date(dateToFormat + " " + new Date().getFullYear());
            }

            if (date && !isNaN(date.getTime())) {
              const day = date.getDate();
              const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
              const month = monthNames[date.getMonth()];

              if (effectivePeriod === 'Last year' || effectivePeriod === 'All') {
                formattedLabel = month;
              } else if (effectivePeriod === 'Last month' || effectivePeriod === 'Last 90 Days') {
                formattedLabel = `${day} ${month}`;
              } else {
                formattedLabel = `${day}/${date.getMonth() + 1}`;
              }
            }
          } catch (error) {
            console.error('Error formatting label:', error);
          }

          return (
            <Text key={index} style={styles.xAxisLabel} numberOfLines={1}>
              {formattedLabel}
            </Text>
          );
        })}
      </View>
    );
  };

  const renderChart = (data, isMeanChart = false) => {
    if (isLoading) {
      return (
        <View style={styles.chartContainer}>
          <ActivityIndicator size="large" color={NAVY_BLUE} />
        </View>
      );
    }

    const chartHeight = scaleHeight(150);
    const currentChart = getChartData();
    const xAxisData = isMeanChart ? currentChart.meanXAxis : currentChart.trendXAxis;

    // Debug logging
    console.log(`📊 Rendering ${isMeanChart ? 'Mean' : 'Trend'} Chart for ${activeChart}:`, {
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : [],
      dataLengths: data ? Object.keys(data).map(key => ({ [key]: Array.isArray(data[key]) ? data[key].length : 'not array' })) : [],
      xAxisLength: xAxisData?.length || 0,
      currentChartKeys: Object.keys(currentChart)
    });

    // Adjust max/min values based on chart type and data range
    let maxVal = 200;
    let minVal = 0;

    if (activeChart === 'bloodGlucose') {
      const values = Array.isArray(data) ? data : (data.glucose || data.values || []);
      const actualMax = values.length > 0 ? Math.max(...values) : 200;
      maxVal = Math.max(200, Math.ceil((actualMax + 20) / 20) * 20);
      minVal = 0;
    } else if (activeChart === 'weight') {
      const values = Array.isArray(data) ? data : (data.weight || data.values || []);
      const actualMax = values.length > 0 ? Math.max(...values) : 200;
      const actualMin = values.length > 0 ? Math.min(...values) : 100;
      maxVal = Math.max(200, Math.ceil((actualMax + 20) / 20) * 20);
      minVal = Math.max(0, Math.floor((actualMin - 20) / 20) * 20);
    } else if (activeChart === 'bloodPressure') {
      maxVal = 200;
      minVal = 0;
    }

    // Generate dynamic Y-axis values for display if they aren't provided by currentChart
    const dynamicYAxis = [];
    const step = (maxVal - minVal) / 5;
    for (let i = 0; i <= 5; i++) {
      dynamicYAxis.push(Math.round(maxVal - (i * step)));
    }

    return (
      <View style={styles.chartWrapper}>
        <View style={styles.chartContainer}>
          <View style={styles.yAxis}>
            {dynamicYAxis.map((value, index) => {
              const y = chartHeight - ((value - minVal) / (maxVal - minVal)) * chartHeight;
              return (
                <Text
                  key={`${value}-${index}`}
                  style={[styles.yAxisLabel, { position: 'absolute', top: y - 6 }]}
                >
                  {value}
                </Text>
              );
            })}
          </View>
          <View style={styles.chart}>
            <Svg height={chartHeight} width="100%">
              {/* Horizontal grid lines */}
              {dynamicYAxis.map((value, i) => {
                const y = chartHeight - ((value - minVal) / (maxVal - minVal)) * chartHeight;
                return (
                  <Line
                    key={i}
                    x1="0"
                    y1={y}
                    x2={scaleWidth(250)}
                    y2={y}
                    stroke={BORDER_GREY}
                    strokeWidth="1"
                  />
                );
              })}

              {activeChart === 'bloodPressure' && data && data.systolic && data.diastolic && (
                <>
                  {data.systolic.length > 0 && (
                    <Path
                      d={createPath(data.systolic, chartHeight, minVal, maxVal)}
                      fill="none"
                      stroke={currentChart.colors.primary}
                      strokeWidth="2"
                    />
                  )}
                  {data.diastolic.length > 0 && (
                    <Path
                      d={createPath(data.diastolic, chartHeight, minVal, maxVal)}
                      fill="none"
                      stroke={currentChart.colors.secondary}
                      strokeWidth="2"
                    />
                  )}
                </>
              )}

              {activeChart === 'bloodGlucose' && data && data.glucose && (
                data.glucose.length > 0 ? (
                  <Path
                    d={createPath(
                      data.glucose,
                      chartHeight,
                      minVal,
                      maxVal
                    )}
                    fill="none"
                    stroke={currentChart.colors.primary}
                    strokeWidth="2"
                  />
                ) : null
              )}

              {activeChart === 'weight' && data && data.weight && (
                data.weight.length > 0 ? (
                  <Path
                    d={createPath(
                      data.weight,
                      chartHeight,
                      minVal,
                      maxVal
                    )}
                    fill="none"
                    stroke={currentChart.colors.primary}
                    strokeWidth="2"
                  />
                ) : null
              )}
            </Svg>
          </View>
        </View>
        {xAxisData && xAxisData.length > 0 ? (
          renderXAxis(xAxisData, isMeanChart)
        ) : (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>No data available for selected period</Text>
            <Text style={styles.noDataSubtext}>Try selecting a different date range or check if measurements exist</Text>
          </View>
        )}
      </View>
    );
  };

  const handleQuery = () => {
    if (patientId) {
      setIsLoading(true);
      const dateRangeValue = periodToApiValue[selectedPeriod];
      console.log("🚀 Querying with mode:", dateRangeType, "Quick select:", selectedPeriod);

      if (dateRangeType === 'custom' && (!fromDate || !toDate)) {
        console.log("❌ Missing dates for custom range");
        Alert.alert('Error', 'Please select both start and end dates for custom range');
        setIsLoading(false);
        return;
      }

      fetchGraphData(patientId, dateRangeValue, dateRangeType, fromDate, toDate);
    }
  };

  const handleFromDateChange = (event, selectedDate) => {
    setShowFromDatePicker(false);
    if (selectedDate) {
      const formattedDate = formatDateForAPI(selectedDate);
      setFromDate(formattedDate);
    }
  };

  const handleToDateChange = (event, selectedDate) => {
    setShowToDatePicker(false);
    if (selectedDate) {
      const formattedDate = formatDateForAPI(selectedDate);
      setToDate(formattedDate);
    }
  };

  const getTitle = () => ({
    bloodPressure: 'Blood Pressure',
    bloodGlucose: 'Blood Glucose',
    weight: 'Weight',
  })[activeChart] || 'Summary';

  const currentChart = getChartData();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="default" />

      {/* Main Container with Navy Blue Background */}
      <View style={styles.mainContainer}>
        {/* Header - Navy Blue Bar */}
        <View style={styles.topDarkSection}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{getTitle()}</Text>
            <View style={styles.headerSpacer} />
          </View>
        </View>

        {/* White section (Body section) */}
        <View style={styles.bottomLightSection}>
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

              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={[styles.dateInput, dateRangeType !== 'custom' && styles.disabled]}
                  onPress={() => dateRangeType === 'custom' && setShowFromDatePicker(true)}
                >
                  <Text style={fromDate ? styles.dateText : styles.placeholderText}>
                    {fromDate ? formatDateForDisplay(new Date(fromDate)) : 'mm/dd/yyyy'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.to}>to</Text>
                <TouchableOpacity
                  style={[styles.dateInput, dateRangeType !== 'custom' && styles.disabled]}
                  onPress={() => dateRangeType === 'custom' && setShowToDatePicker(true)}
                >
                  <Text style={toDate ? styles.dateText : styles.placeholderText}>
                    {toDate ? formatDateForDisplay(new Date(toDate)) : 'mm/dd/yyyy'}
                  </Text>
                </TouchableOpacity>
              </View>

              {showFromDatePicker && (
                <DateTimePicker
                  value={fromDate ? new Date(fromDate) : new Date()}
                  mode="date"
                  display="default"
                  maximumDate={toDate ? new Date(toDate) : new Date()}
                  onChange={handleFromDateChange}
                />
              )}

              {showToDatePicker && (
                <DateTimePicker
                  value={toDate ? new Date(toDate) : new Date()}
                  mode="date"
                  display="default"
                  maximumDate={new Date()}
                  minimumDate={fromDate ? new Date(fromDate) : undefined}
                  onChange={handleToDateChange}
                />
              )}

              <TouchableOpacity style={styles.queryBtn} onPress={handleQuery}>
                <Text style={styles.queryBtnText}>Query</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.chartTitle}>Daily Trend Chart</Text>
            {renderChart(currentChart.trend, false)}

            <Text style={styles.chartTitle}>Measurement Period Chart</Text>
            {renderChart(currentChart.mean, true)}
          </ScrollView>
        </View>
      </View>

      {/* Dropdowns */}
      <CustomDropdown
        options={periodOptions}
        onSelect={(value) => {
          setSelectedPeriod(value);
          setDateRangeType('range');
        }}
        visible={showPeriodModal}
        onClose={() => setShowPeriodModal(false)}
      />
      <CustomDropdown
        options={getSortOptions()}
        onSelect={setSortBy}
        visible={showSortModal}
        onClose={() => setShowSortModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAVY_BLUE
  },
  mainContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: NAVY_BLUE,
  },
  scroll: {
    flex: 1
  },
  content: {
    padding: scaleWidth(16)
  },

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
    padding: scaleWidth(16),
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
    color: TEXT_LIGHT,
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
  dateInput: {
    flex: 1,
    backgroundColor: WHITE,
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleHeight(10),
    borderRadius: scaleWidth(8),
    fontSize: scaleFont(14),
    marginHorizontal: scaleWidth(4),
    borderWidth: scaleWidth(1),
    borderColor: BORDER_GREY,
    justifyContent: 'center',
    height: scaleHeight(40),
  },
  dateText: {
    fontSize: scaleFont(14),
    color: NAVY_BLUE,
    fontWeight: '600',
  },
  placeholderText: {
    fontSize: scaleFont(14),
    color: TEXT_LIGHT
  },
  to: {
    fontSize: scaleFont(14),
    color: TEXT_LIGHT,
    marginHorizontal: scaleWidth(8)
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

  chartTitle: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: NAVY_BLUE,
    marginTop: scaleHeight(24),
    marginBottom: scaleHeight(8)
  },
  chartWrapper: {
    marginBottom: scaleHeight(16),
    backgroundColor: WHITE,
    borderRadius: scaleWidth(8),
    padding: scaleWidth(16),
    borderWidth: scaleWidth(1),
    borderColor: BORDER_GREY,
  },
  chartContainer: {
    flexDirection: 'row',
    height: scaleHeight(160)
  },
  yAxis: {
    width: scaleWidth(45),
    position: 'relative'
  },
  yAxisLabel: {
    fontSize: scaleFont(10),
    color: TEXT_LIGHT,
    textAlign: 'right',
    paddingRight: scaleWidth(4),
    height: scaleHeight(16)
  },
  chart: {
    flex: 1,
    borderWidth: scaleWidth(1),
    borderColor: BORDER_GREY,
    borderRadius: scaleWidth(8),
    padding: scaleWidth(8),
    paddingRight: scaleWidth(12)
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: scaleHeight(18),
    marginLeft: scaleWidth(45),
    paddingRight: scaleWidth(8),
  },
  xAxisLabel: {
    fontSize: scaleFont(10),
    color: TEXT_LIGHT
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scaleHeight(20),
    paddingHorizontal: scaleWidth(16),
  },
  noDataText: {
    textAlign: 'center',
    marginTop: scaleHeight(8),
    color: TEXT_LIGHT,
    fontSize: scaleFont(14),
    fontWeight: '600'
  },
  noDataSubtext: {
    textAlign: 'center',
    marginTop: scaleHeight(4),
    color: TEXT_LIGHT,
    fontSize: scaleFont(12),
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
});