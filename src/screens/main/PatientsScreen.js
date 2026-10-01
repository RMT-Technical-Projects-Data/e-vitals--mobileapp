/* eslint-disable react-native/no-inline-styles */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import apiService from '../../services/apiService';
import PremiumBottomNav, { PREMIUM_BOTTOM_NAV_CLEARANCE } from '../../components/navigation/PremiumBottomNav';
import AddPatientModal from '../../components/modals/AddPatientModal';
import { MEASUREMENT_COLORS } from '../../utils/measurementUtils';
import { getPatientListVitalColors } from '../../utils/patientVitalTargets';
import PulseIcon from '../../components/common/PulseIcon';
import PatientAvatar from '../../components/common/PatientAvatar';

const { width } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const scaleWidth = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.25);
const scaleFont = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.2);

const toCleanNumber = (value) => {
  if (value == null) return null;
  const cleaned = String(value).replace(/[^\d.-]/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const getPatientVitalsDisplay = (item) => {
  const latest = item.latest_measurements || {};
  const bpObj = latest.blood_pressure || item.blood_pressure || null;
  const bgObj = latest.blood_glucose || item.blood_glucose || null;
  const wtObj = latest.weight || item.weight_measurement || null;
  const summary = String(item.data_summary || '').trim();
  const hasBp = /\d+\s*\/\s*\d+/.test(summary);
  const hasLbs = /lbs/i.test(summary);

  const systolic = toCleanNumber(bpObj?.systolic_pressure ?? bpObj?.systolic ?? item.last_systolic ?? item.systolic);
  const diastolic = toCleanNumber(bpObj?.diastolic_pressure ?? bpObj?.diastolic ?? item.last_diastolic ?? item.diastolic);
  let pulse = toCleanNumber(bpObj?.pulse ?? item.last_pulse ?? item.pulse);
  let bp = (systolic != null && diastolic != null)
    ? `${Math.round(systolic)}/${Math.round(diastolic)}`
    : '--';
  let glucose = bgObj
    ? String(Math.round(bgObj.blood_glucose_value_1 || bgObj.value || 0))
    : (item.last_glucose ?? item.glucose ? String(Math.round(item.last_glucose ?? item.glucose)) : '--');
  
  let rawWt = wtObj
    ? (wtObj.weight || wtObj.weight_value || wtObj.value)
    : (item.last_weight ?? item.weight);
  let weightNum = toCleanNumber(rawWt);
  let weight = weightNum != null && weightNum > 0 ? weightNum.toFixed(1) : '--';

  if (hasBp) {
    const bpMatch = summary.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
    const pulseMatch = summary.match(/\((\d{2,3})\)/);
    if (bpMatch) {
      bp = `${bpMatch[1]}/${bpMatch[2]}`;
      if (pulse == null && pulseMatch) {
        pulse = toCleanNumber(pulseMatch[1]);
      }
    } else {
      bp = summary.replace(/\s*\([^)]*\)/, '').trim();
    }
  } else if (hasLbs) {
    weight = summary.replace(/\s*lbs/i, '').trim();
  } else if (summary && !hasBp) {
    glucose = summary;
  }

  const readingsCount = Number(item.readings_count ?? item.number_of_readings ?? item.readings ?? 0) || 0;
  const serviceTime = Number(item.service_time ?? item.total_service_time ?? 0) || 0;

  return {
    bp,
    pulse: pulse != null ? Math.round(pulse) : null,
    glucose,
    weight,
    readingsCount,
    serviceTime,
  };
};

const getPatientStatusMeta = (status) => {
  const raw = String(status ?? '').trim();
  const lower = raw.toLowerCase();
  const numeric = /^\d+$/.test(lower) ? parseInt(lower, 10) : null;

  if (numeric === 2 || lower === 'active' || lower === 'stable') {
    return { letter: 'A', bg: '#DDF8DD', color: '#0b1f3f' };
  }
  if (numeric === 3 || lower === 'pending' || lower === 'review') {
    return { letter: 'P', bg: '#caf0f8', color: '#1177c6' };
  }
  if (numeric === 4 || lower === 'locked') {
    return { letter: 'L', bg: '#FDE8E8', color: '#d32f2f' };
  }
  if (lower === 'critical') {
    return { letter: 'C', bg: '#FDE8E8', color: '#d32f2f' };
  }
  if (lower === 'inactive' || lower === 'paused') {
    return { letter: 'I', bg: '#FDE8D4', color: '#A15C00' };
  }

  return {
    letter: raw ? raw.charAt(0).toUpperCase() : 'N',
    bg: '#E8EAED',
    color: '#6C757D',
  };
};

const mapStatusToDbCode = (statusVal) => {
  if (statusVal == null || statusVal === '') return undefined;
  const str = String(statusVal).trim().toLowerCase();
  if (str === '2' || str === 'active' || str === 'stable') return '2';
  if (str === '3' || str === 'pending' || str === 'review') return '3';
  if (str === '4' || str === 'locked') return '4';
  return str;
};

const STATUS_DASHBOARD_KEYS = new Set(['active', 'pending', 'locked', '2', '3', '4']);

const isMissedUploadsFilter = (filter) => String(filter || '').trim().toLowerCase() === 'misseduploads';

const DASHBOARD_FILTERS_WITHOUT_STATUS_PILLS = new Set([
  'misseduploads',
  'abnormalmeasurements',
  'recentuploads',
]);

const hidesStatusPills = (filter) =>
  DASHBOARD_FILTERS_WITHOUT_STATUS_PILLS.has(String(filter || '').trim().toLowerCase());

const MISSED_UPLOAD_MS = 2 * 24 * 60 * 60 * 1000;
const MISSED_SOURCE_PAGE_SIZE = 100;

const aplStatusCode = (statusVal) => {
  if (statusVal == null || statusVal === '') return '2';
  const str = String(statusVal).trim().toLowerCase();
  if (str === '2' || str === 'active' || str === 'stable' || str === 'a') return '2';
  if (str === '3' || str === 'pending' || str === 'review' || str === 'p') return '3';
  if (str === '4' || str === '1' || str === 'locked' || str === 'inactive' || str === 'l' || str === 'i') return '4';
  const numeric = Number(str);
  if (numeric === 1) return '4';
  if (numeric === 2 || numeric === 3 || numeric === 4) return String(numeric);
  return null;
};

const parseUploadTime = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw || raw === 'N/A' || raw === '-') return NaN;

  const usDate = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i);
  if (usDate) {
    let hours = Number(usDate[4] || 0);
    const minutes = Number(usDate[5] || 0);
    const seconds = Number(usDate[6] || 0);
    const ampm = String(usDate[7] || '').toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return new Date(Number(usDate[3]), Number(usDate[1]) - 1, Number(usDate[2]), hours, minutes, seconds).getTime();
  }

  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 23, 59, 59).getTime();
  }

  const normalized = raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') : raw;
  return new Date(normalized).getTime();
};

const getLastUploadMs = (patient) => {
  const stamps = [
    patient?.last_bp_at,
    patient?.last_bg_at,
    patient?.last_wt_at,
    patient?.last_vital_upload_at,
    patient?.last_upload_at,
    patient?.upload_date,
    patient?.last_upload_date,
  ].map(parseUploadTime).filter((time) => !Number.isNaN(time));
  if (stamps.length === 0) return null;
  return Math.max(...stamps);
};

const getLastUploadRaw = (patient) => {
  const uploadMs = getLastUploadMs(patient);
  if (uploadMs != null) return uploadMs;
  return patient?.last_vital_upload_at
    || patient?.last_upload_at
    || patient?.upload_date
    || patient?.last_upload_date
    || null;
};

const isMissedUploadPatient = (patient) => {
  const uploadMs = getLastUploadMs(patient);
  if (uploadMs != null) return Date.now() - uploadMs >= MISSED_UPLOAD_MS;
  if (patient?.has_missed_upload === true) return true;
  if (patient?.has_missed_upload === false || patient?.has_recent_upload === true) return false;
  return true;
};

const formatLastUploadDate = (value) => {
  if (value == null || value === '') return 'Never';
  if (typeof value === 'number') {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Never';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}/${day}/${date.getFullYear()}`;
  }
  const raw = String(value).trim();
  if (!raw || raw === 'N/A' || raw === '-') return 'Never';

  const usDate = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usDate) {
    return `${usDate[1].padStart(2, '0')}/${usDate[2].padStart(2, '0')}/${usDate[3]}`;
  }

  const normalized = raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') : raw;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return 'Never';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}/${date.getFullYear()}`;
};

const resolveRouteFilterParams = (params = {}) => {
  const dashboardFilter = params.dashboardFilter || null;
  const filterTitle = params.filterTitle || null;
  const normalizedKey = dashboardFilter ? String(dashboardFilter).trim().toLowerCase() : '';

  // Active / Pending / Locked must use the status API filter, not dashboardFilter.
  if (normalizedKey && STATUS_DASHBOARD_KEYS.has(normalizedKey)) {
    return {
      activeFilter: null,
      activeFilterTitle: null,
      statusFilter: mapStatusToDbCode(normalizedKey),
    };
  }

  return {
    activeFilter: dashboardFilter,
    activeFilterTitle: filterTitle,
    statusFilter: null,
  };
};

const getPatientVitalPills = (item) => {
  const rawVitals = item.vitals || item.measurement_types || '';
  let list = [];
  if (Array.isArray(rawVitals)) {
    list = rawVitals.map((v) => String(v).trim()).filter(Boolean);
  } else if (typeof rawVitals === 'string' && rawVitals.trim().length > 0) {
    list = rawVitals.split(',').map((v) => v.trim()).filter(Boolean);
  }

  if (list.length === 0) {
    const latest = item.latest_measurements || {};
    if (latest.blood_pressure || item.blood_pressure || (item.data_summary && String(item.data_summary).includes('/'))) list.push('BP');
    if (latest.blood_glucose || item.blood_glucose || item.glucose) list.push('BG');
    if (latest.weight || item.weight_measurement || item.weight) list.push('Weight');
  }

  const normalized = list.map((v) => {
    const lower = v.toLowerCase();
    if (lower.includes('pressure') || lower === 'bp') return 'BP';
    if (lower.includes('glucose') || lower === 'bg') return 'BG';
    if (lower.includes('weight') || lower === 'wt') return 'Weight';
    if (lower.includes('pulse') || lower === 'hr') return 'Pulse';
    return v;
  });

  const unique = Array.from(new Set(normalized));
  return unique.length > 0 ? unique : ['BP'];
};

const STATUS_TABS = [
  { key: null, label: 'All', activeBg: '#0b1f3f', inactiveBorder: '#E2E8F0', activeColor: '#FFFFFF', inactiveColor: '#64748B' },
  { key: '2', label: 'Active', activeBg: '#0077b6', inactiveBorder: '#90e0ef', activeColor: '#FFFFFF', inactiveColor: '#0077b6', dot: '#00b4d8' },
  { key: '3', label: 'Pending', activeBg: '#1177c6', inactiveBorder: '#4FA3F5', activeColor: '#FFFFFF', inactiveColor: '#1177c6', dot: '#4FA3F5' },
  { key: '4', label: 'Locked', activeBg: '#1B2A4A', inactiveBorder: '#1B2A4A', activeColor: '#FFFFFF', inactiveColor: '#1B2A4A', dot: '#1B2A4A' },
];

const PAGE_SIZE = 10;

export default function PatientsScreen({ route, navigation }) {
  const [userRole, setUserRole] = useState('provider');
  const [practiceId, setPracticeId] = useState(null);
  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPatients, setTotalPatients] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const initialRouteFilter = resolveRouteFilterParams(route?.params);
  const [activeFilter, setActiveFilter] = useState(initialRouteFilter.activeFilter);
  const [activeFilterTitle, setActiveFilterTitle] = useState(initialRouteFilter.activeFilterTitle);
  const [statusFilter, setStatusFilter] = useState(initialRouteFilter.statusFilter);
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const listRef = useRef(null);
  const fetchRequestIdRef = useRef(0);
  const missedPoolRef = useRef({ key: '', patients: [] });

  useEffect(() => {
    if (
      route?.params?.dashboardFilter !== undefined
      || route?.params?.filterTitle !== undefined
      || route?.params?.filterToken !== undefined
    ) {
      const next = resolveRouteFilterParams(route?.params);
      setActiveFilter(next.activeFilter);
      setActiveFilterTitle(next.activeFilterTitle);
      setStatusFilter(next.statusFilter);
      setCurrentPage(1);
    }
  }, [route?.params?.dashboardFilter, route?.params?.filterTitle, route?.params?.filterToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchPatients = useCallback(async () => {
    const requestId = ++fetchRequestIdRef.current;
    setIsLoading(true);
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        const roleId = Number(user.role_id);
        const role = (roleId === 5 || roleId === 7) ? 'caregiver' : 'provider';
        setUserRole(role);

        const pId = await AsyncStorage.getItem('practiceId') || user.practice_id;
        setPracticeId(pId);
        if (pId) {
          const missedUploadsView = isMissedUploadsFilter(activeFilter);
          let fetchedPatients = [];

          if (missedUploadsView) {
            const cacheKey = `${pId}|${debouncedSearch}`;
            let missedPatients = missedPoolRef.current.key === cacheKey
              ? missedPoolRef.current.patients
              : null;

            if (!missedPatients) {
              missedPatients = [];
              let sourcePage = 1;
              let sourceTotalPages = 1;
              do {
                const sourceResult = await apiService.getPatients(pId, {
                  limit: MISSED_SOURCE_PAGE_SIZE,
                  page: sourcePage,
                  search: debouncedSearch || undefined,
                  program: 'rpm',
                  includeDashboardEnrichment: true,
                });
                if (requestId !== fetchRequestIdRef.current) return;
                const batch = sourceResult?.data?.patients || [];
                missedPatients.push(...batch.filter((patient) => (
                  isMissedUploadPatient(patient) && aplStatusCode(patient?.status) === '2'
                )));
                sourceTotalPages = Math.max(1, sourceResult?.data?.pagination?.total_pages || 1);
                if (batch.length === 0) break;
                sourcePage += 1;
              } while (sourcePage <= sourceTotalPages && sourcePage <= 50);

              missedPoolRef.current = { key: cacheKey, patients: missedPatients };
            }

            const start = (currentPage - 1) * PAGE_SIZE;
            fetchedPatients = missedPatients.slice(start, start + PAGE_SIZE);
            setTotalPages(Math.max(1, Math.ceil(missedPatients.length / PAGE_SIZE) || 1));
            setTotalPatients(missedPatients.length);
          } else {
            const apiStatusParam = mapStatusToDbCode(statusFilter);
            const result = await apiService.getPatients(pId, {
              limit: PAGE_SIZE,
              page: currentPage,
              search: debouncedSearch || undefined,
              status: !activeFilter ? apiStatusParam : undefined,
              dashboardFilter: activeFilter || undefined,
              program: 'rpm',
              includeDashboardEnrichment: true,
            });

            if (requestId !== fetchRequestIdRef.current) {
              return;
            }

            if (result?.success && result?.data?.patients) {
              const pagination = result.data.pagination || {};
              fetchedPatients = result.data.patients;
              setTotalPages(Math.max(1, pagination.total_pages || 1));
              setTotalPatients(pagination.total || fetchedPatients.length);
            } else {
              fetchedPatients = [];
              setTotalPages(1);
              setTotalPatients(0);
            }
          }

          if (requestId !== fetchRequestIdRef.current) {
            return;
          }

          setPatients(fetchedPatients);

          const missingEnrich = fetchedPatients.filter((p) => !p.latest_measurements);
          if (missingEnrich.length > 0) {
            Promise.all(
              missingEnrich.map(async (patient) => {
                const patientId = patient.patient_table_id || patient.id;
                if (!patientId) return null;
                try {
                  const detail = await apiService.getPatientDetailsFast(pId, patientId);
                  return { id: patient.id, latest: detail?.data?.latest_measurements };
                } catch {
                  return null;
                }
              })
            ).then((updates) => {
              if (requestId !== fetchRequestIdRef.current) {
                return;
              }
              const validUpdates = updates.filter((u) => u && u.latest);
              if (validUpdates.length > 0) {
                setPatients((prev) =>
                  prev.map((p) => {
                    const match = validUpdates.find((u) => u.id === p.id);
                    return match ? { ...p, latest_measurements: match.latest } : p;
                  })
                );
              }
            });
          }
        } else {
          setPatients([]);
          setTotalPages(1);
          setTotalPatients(0);
        }
      } else {
        setPatients([]);
        setTotalPages(1);
        setTotalPatients(0);
      }
    } catch (error) {
      if (requestId !== fetchRequestIdRef.current) {
        return;
      }
      console.warn('Error fetching patients list screen:', error);
      setPatients([]);
      setTotalPages(1);
      setTotalPatients(0);
    } finally {
      if (requestId === fetchRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [currentPage, debouncedSearch, activeFilter, statusFilter]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  useFocusEffect(
    useCallback(() => {
      fetchPatients();
    }, [fetchPatients])
  );

  const handleResetFilter = () => {
    setActiveFilter(null);
    setActiveFilterTitle(null);
    setStatusFilter(null);
    setCurrentPage(1);
    if (navigation.setParams) {
      navigation.setParams({
        dashboardFilter: null,
        filterTitle: null,
        filterToken: Date.now(),
      });
    }
  };

  const handlePatientPress = (patient) => {
    const resolvedPatientId = patient.patient_table_id || patient.id;
    navigation.navigate('PatientHub', {
      patientId: resolvedPatientId,
      practiceId,
      patientName: `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
      dashboardRole: userRole,
    });
  };

  const isCaregiver = userRole === 'caregiver';
  const themeColor = isCaregiver ? '#1B2A4A' : '#0b1f3f';
  const accentColor = isCaregiver ? '#0077b6' : '#1177c6';
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;
  const rangeStart = totalPatients === 0 ? 0 : ((currentPage - 1) * PAGE_SIZE) + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, totalPatients);

  const handlePreviousPage = () => {
    if (!canGoPrevious || isLoading) return;
    setCurrentPage((prev) => Math.max(1, prev - 1));
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const handleNextPage = () => {
    if (!canGoNext || isLoading) return;
    setCurrentPage((prev) => prev + 1);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const renderPatientItem = ({ item }) => {
    const vitals = getPatientVitalsDisplay(item);
    const vitalPills = getPatientVitalPills(item);
    const statusMeta = getPatientStatusMeta(item.status);

    const {
      sysColor,
      diaColor,
      pulseColor,
      glucoseColor,
      weightColor,
      isPulseAbnormal,
    } = getPatientListVitalColors(item, vitals);
    const bpParts = String(vitals.bp || '').split('/');
    const hasSplitBp = bpParts.length === 2 && vitals.bp !== '--';

    return (
      <TouchableOpacity
        style={styles.patientCard}
        onPress={() => handlePatientPress(item)}
        activeOpacity={0.85}
      >
        <View style={styles.pcTop}>
          {/* Avatar with status badge overlay */}
          <View style={styles.avatarWrap}>
            <PatientAvatar
              profilePic={item.profile_pic || item.profilePic || item.profile_image}
              firstName={item.first_name}
              lastName={item.last_name}
              size={scaleWidth(38)}
              borderRadius={scaleWidth(14)}
              backgroundColor={themeColor}
              textStyle={styles.pcAvatarTextSmall}
            />
            <View style={[styles.statusBadgeCorner, { backgroundColor: statusMeta.bg, borderColor: '#ffffff' }]}>
              <Text style={[styles.statusBadgeTextCorner, { color: statusMeta.color }]}>
                {statusMeta.letter}
              </Text>
            </View>
          </View>

          {/* Name + Vital Pills (BP, BG, Weight, etc.) */}
          <View style={styles.pcInfo}>
            <Text style={styles.pcName} numberOfLines={1}>{item.first_name} {item.last_name}</Text>
            <View style={styles.vitalsPillRow}>
              {vitalPills.map((pill, idx) => (
                <View key={idx} style={styles.inlineVitalPill}>
                  <Text style={styles.inlineVitalPillText}>{pill}</Text>
                </View>
              ))}
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={themeColor} />
        </View>

        <View style={styles.pcVitals}>
          <View style={styles.pcVital}>
            <Text style={styles.pvLbl}>BP (mmHg)</Text>
            <View style={styles.pvValueRow}>
              {hasSplitBp ? (
                <>
                  <Text style={[styles.pvVal, { color: sysColor }]} numberOfLines={1}>{bpParts[0].trim()}</Text>
                  <Text style={styles.bpSlash}>/</Text>
                  <Text style={[styles.pvVal, { color: diaColor }]} numberOfLines={1}>{bpParts[1].trim()}</Text>
                </>
              ) : (
                <Text style={[styles.pvVal, { color: MEASUREMENT_COLORS.missing }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {vitals.bp}
                </Text>
              )}
              {vitals.pulse != null ? (
                <View style={styles.pvPulseWrap}>
                  <Text
                    style={[styles.pvPulse, { color: vitals.pulse != null ? pulseColor : MEASUREMENT_COLORS.pulseMissing }]}
                    numberOfLines={1}
                  >
                    {vitals.pulse}
                  </Text>
                  <PulseIcon isAbnormal={isPulseAbnormal} size={scaleFont(11)} />
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.pcVital}>
            <Text style={styles.pvLbl}>BG (mg/dL)</Text>
            <Text style={[styles.pvVal, { color: glucoseColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {vitals.glucose}
            </Text>
          </View>
          <View style={styles.pcVital}>
            <Text style={styles.pvLbl}>WT (lbs)</Text>
            <Text style={[styles.pvVal, { color: weightColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {vitals.weight}
            </Text>
          </View>
        </View>

        {/* Additional Stats Row: Service Time & Readings Count */}
        <View style={styles.pcExtraStatsRow}>
          <View style={styles.pcExtraStatItem}>
            <MaterialIcons name="assessment" size={14} color="#687382" />
            <Text style={styles.pcExtraStatLabel}>Readings:</Text>
            <Text style={styles.pcExtraStatValue}>{vitals.readingsCount}</Text>
          </View>
          <View style={styles.pcExtraStatItem}>
            <MaterialIcons name="schedule" size={14} color="#687382" />
            <Text style={styles.pcExtraStatLabel}>Service Time:</Text>
            <Text style={styles.pcExtraStatValue}>{vitals.serviceTime} min</Text>
          </View>
        </View>

        {isMissedUploadsFilter(activeFilter) ? (
          <View style={styles.pcExtraStatsRow}>
            <View style={styles.pcExtraStatItem}>
              <MaterialIcons name="event" size={14} color="#687382" />
              <Text style={styles.pcExtraStatLabel}>Last Upload Date:</Text>
              <Text style={styles.pcExtraStatValue} numberOfLines={1}>
                {formatLastUploadDate(getLastUploadRaw(item))}
              </Text>
            </View>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderPaginationFooter = () => {
    if (totalPatients <= 0) return null;

    return (
      <View style={styles.paginationBar}>
        <Text style={styles.paginationInfo}>
          {rangeStart}-{rangeEnd} of {totalPatients}
        </Text>
        <View style={styles.paginationControls}>
          <TouchableOpacity
            style={[styles.paginationBtn, !canGoPrevious && styles.paginationBtnDisabled]}
            onPress={handlePreviousPage}
            disabled={!canGoPrevious || isLoading}
            accessibilityRole="button"
            accessibilityLabel="Previous page"
          >
            <MaterialIcons
              name="chevron-left"
              size={22}
              color={canGoPrevious ? themeColor : '#A0AAB4'}
            />
            <Text style={[styles.paginationBtnText, !canGoPrevious && styles.paginationBtnTextDisabled]}>
              Prev
            </Text>
          </TouchableOpacity>
          <Text style={styles.paginationPageText}>
            Page {currentPage} of {totalPages}
          </Text>
          <TouchableOpacity
            style={[styles.paginationBtn, !canGoNext && styles.paginationBtnDisabled]}
            onPress={handleNextPage}
            disabled={!canGoNext || isLoading}
            accessibilityRole="button"
            accessibilityLabel="Next page"
          >
            <Text style={[styles.paginationBtnText, !canGoNext && styles.paginationBtnTextDisabled]}>
              Next
            </Text>
            <MaterialIcons
              name="chevron-right"
              size={22}
              color={canGoNext ? themeColor : '#A0AAB4'}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaProvider>
      <LinearGradient colors={['#ffffff', '#ffffff', '#ffffff']} style={styles.container}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={styles.topbar}>
            <TouchableOpacity
              style={styles.topbarActionButton}
              onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <MaterialIcons name="arrow-back" size={21} color="#0b1f3f" />
            </TouchableOpacity>
            <Text style={styles.topbarTitle}>Patients List</Text>
            <TouchableOpacity
              style={styles.topbarActionButton}
              onPress={() => setShowComingSoonModal(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Add patient"
            >
              <MaterialIcons name="person-add" size={21} color="#0b1f3f" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBarContainer}>
            <MaterialIcons name="search" size={20} color={accentColor} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name..."
              placeholderTextColor="#a0aab4"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* KPI dashboard filter banner (status tabs stay visible for Active/Pending/Locked) */}
          {activeFilter ? (
            <View style={styles.activeFilterBanner}>
              <View style={styles.activeFilterPill}>
                <MaterialIcons name="filter-list" size={18} color="#0b1f3f" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeFilterText}>
                    Filtered by: {activeFilterTitle || activeFilter}
                  </Text>
                  <Text style={styles.activeFilterSubtext}>RPM patients matching dashboard criteria</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.resetFilterBtn}
                onPress={handleResetFilter}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Reset filter"
              >
                <MaterialIcons name="close" size={14} color="#C62828" />
                <Text style={styles.resetFilterText}>Reset Filter</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {hidesStatusPills(activeFilter) ? null : (
          <View style={styles.statusFilterRow}>
              {STATUS_TABS.map((tab) => {
                const currentCode = mapStatusToDbCode(statusFilter);
                const isSelected = tab.key === null ? !currentCode : currentCode === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.label}
                    style={[
                      styles.statusFilterChip,
                      {
                        backgroundColor: isSelected ? tab.activeBg : '#FFFFFF',
                        borderColor: isSelected ? tab.activeBg : tab.inactiveBorder,
                      },
                    ]}
                    onPress={() => {
                      setStatusFilter(tab.key);
                      setCurrentPage(1);
                    }}
                    activeOpacity={0.8}
                  >
                    {tab.dot ? (
                      <View
                        style={[
                          styles.statusMiniDot,
                          { backgroundColor: isSelected ? '#FFFFFF' : tab.dot },
                        ]}
                      />
                    ) : null}
                    <Text
                      style={[
                        styles.statusFilterText,
                        { color: isSelected ? tab.activeColor : tab.inactiveColor },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
          </View>
          )}

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={themeColor} />
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={patients}
              keyExtractor={(item, index) => item.id ? String(item.id) : String(index)}
              renderItem={renderPatientItem}
              style={styles.patientList}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No patients found matching your search/filter.</Text>
                </View>
              }
              ListFooterComponent={renderPaginationFooter}
            />
          )}

          <PremiumBottomNav active="patients" navigation={navigation} role={userRole} />

          <Modal
            visible={showComingSoonModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowComingSoonModal(false)}
          >
            <View style={styles.comingSoonOverlay}>
              <View style={styles.comingSoonCard}>
                <View style={styles.comingSoonIconWrap}>
                  <MaterialIcons name="auto-awesome" size={34} color="#0b1f3f" />
                </View>
                <Text style={styles.comingSoonEyebrow}>Coming soon</Text>
                <Text style={styles.comingSoonTitle}>Add Patient</Text>
                <Text style={styles.comingSoonMessage}>
                  This feature will be implemented in the next version.
                </Text>
                <TouchableOpacity
                  style={styles.comingSoonButton}
                  onPress={() => setShowComingSoonModal(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.comingSoonButtonText}>Got it</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* AddPatientModal disabled for now
          <AddPatientModal
            visible={showAddModal}
            onClose={() => setShowAddModal(false)}
            onSuccess={() => {
              setShowAddModal(false);
              fetchPatients();
            }}
            practiceId={practiceId}
          />
          */}
        </SafeAreaView>
      </LinearGradient>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Math.max(scaleWidth(16), 16),
    paddingTop: scaleWidth(8),
    paddingBottom: scaleWidth(10),
  },
  topbarActionButton: {
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
    flexShrink: 0,
  },
  topbarTitle: {
    flex: 1,
    fontSize: scaleFont(20),
    fontWeight: '800',
    color: '#0b1f3f',
    textAlign: 'center',
    marginHorizontal: scaleWidth(8),
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: Math.max(scaleWidth(20), 20),
    marginVertical: scaleWidth(10),
    borderRadius: scaleWidth(20),
    paddingHorizontal: scaleWidth(14),
    borderWidth: 1,
    borderColor: '#e8ecf0',
    minHeight: scaleWidth(50),
    shadowColor: '#0b1f3f',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  searchIcon: {
    marginRight: scaleWidth(10),
  },
  searchInput: {
    flex: 1,
    color: '#0b1f3f',
    fontSize: scaleFont(14),
    fontWeight: '700',
  },
  activeFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Math.max(scaleWidth(20), 20),
    marginBottom: scaleWidth(10),
    paddingHorizontal: scaleWidth(14),
    paddingVertical: scaleWidth(10),
    backgroundColor: '#F0F4F8',
    borderRadius: scaleWidth(16),
    borderWidth: 1,
    borderColor: '#D0DBE5',
  },
  activeFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(6),
    flex: 1,
  },
  activeFilterText: {
    fontSize: scaleFont(13),
    fontWeight: '800',
    color: '#0b1f3f',
    flexShrink: 1,
  },
  activeFilterSubtext: {
    fontSize: scaleFont(11),
    fontWeight: '700',
    color: '#64748b',
    marginTop: 2,
  },
  statusFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Math.max(scaleWidth(16), 16),
    marginBottom: scaleWidth(12),
    gap: scaleWidth(6),
  },
  statusFilterChip: {
    flex: 1,
    height: Math.max(scaleWidth(34), 34),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scaleWidth(4),
    paddingHorizontal: scaleWidth(4),
    borderRadius: scaleWidth(17),
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e8ecf0',
  },
  statusFilterText: {
    fontSize: scaleFont(11),
    fontWeight: '800',
  },
  statusMiniDot: {
    width: scaleWidth(6),
    height: scaleWidth(6),
    borderRadius: scaleWidth(3),
  },
  resetFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(4),
    paddingHorizontal: scaleWidth(10),
    paddingVertical: scaleWidth(6),
    backgroundColor: '#FDE8E8',
    borderRadius: scaleWidth(12),
    borderWidth: 1,
    borderColor: '#F8B4B4',
  },
  resetFilterText: {
    fontSize: scaleFont(12),
    fontWeight: '800',
    color: '#C62828',
  },
  patientList: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Math.max(scaleWidth(20), 20),
    paddingTop: scaleWidth(6),
    paddingBottom: PREMIUM_BOTTOM_NAV_CLEARANCE + scaleWidth(16),
    flexGrow: 1,
  },
  patientCard: {
    backgroundColor: '#ffffff',
    borderRadius: scaleWidth(24),
    padding: scaleWidth(16),
    marginBottom: scaleWidth(12),
    borderWidth: 1,
    borderColor: '#e8ecf0',
    shadowColor: '#0b1f3f',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  pcTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleWidth(12),
  },
  avatarWrap: {
    position: 'relative',
    marginRight: scaleWidth(12),
  },
  pcAvatarSmall: {
    width: scaleWidth(38),
    height: scaleWidth(38),
    borderRadius: scaleWidth(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pcAvatarTextSmall: {
    color: '#fff',
    fontSize: scaleFont(12),
    fontWeight: '800',
  },
  statusBadgeCorner: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: scaleWidth(18),
    height: scaleWidth(18),
    borderRadius: scaleWidth(9),
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeTextCorner: {
    fontSize: scaleFont(9),
    fontWeight: '900',
  },
  pcInfo: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(8),
    flexWrap: 'wrap',
  },
  pcName: {
    fontSize: scaleFont(15),
    fontWeight: '800',
    color: '#0b1f3f',
    flexShrink: 1,
  },
  vitalsPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(4),
    flexWrap: 'wrap',
  },
  inlineVitalPill: {
    paddingHorizontal: scaleWidth(6),
    paddingVertical: scaleWidth(2),
    borderRadius: scaleWidth(6),
    backgroundColor: 'rgba(7,27,52,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(7,27,52,0.12)',
  },
  inlineVitalPillText: {
    fontSize: scaleFont(10),
    fontWeight: '800',
    color: '#0b1f3f',
  },
  pcVitals: {
    flexDirection: 'row',
    gap: scaleWidth(8),
  },
  pcVital: {
    flex: 1,
    backgroundColor: 'rgba(7,27,52,0.05)',
    borderRadius: scaleWidth(14),
    paddingVertical: scaleWidth(8),
    paddingHorizontal: scaleWidth(4),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: scaleWidth(50),
  },
  pvValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    flexWrap: 'nowrap',
    maxWidth: '100%',
  },
  pvVal: {
    fontSize: scaleFont(12),
    fontWeight: '800',
    color: '#0b1f3f',
    lineHeight: scaleFont(14),
    flexShrink: 1,
  },
  bpSlash: {
    fontSize: scaleFont(12),
    fontWeight: '700',
    color: '#64748b',
    marginHorizontal: 1,
  },
  pvPulseWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: scaleWidth(4),
    flexShrink: 0,
  },
  pvPulse: {
    fontSize: scaleFont(10),
    fontWeight: '700',
    color: '#687382',
    lineHeight: scaleFont(12),
    flexShrink: 0,
  },
  pvLbl: {
    fontSize: scaleFont(10),
    color: '#687382',
    marginBottom: scaleWidth(3),
    fontWeight: '800',
  },
  pcExtraStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: scaleWidth(8),
    paddingTop: scaleWidth(8),
    borderTopWidth: 1,
    borderTopColor: 'rgba(7,27,52,0.06)',
  },
  pcExtraStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(4),
  },
  pcExtraStatLabel: {
    fontSize: scaleFont(11),
    color: '#687382',
    fontWeight: '600',
  },
  pcExtraStatValue: {
    fontSize: scaleFont(11),
    color: '#0b1f3f',
    fontWeight: '800',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: scaleWidth(40),
  },
  emptyText: {
    fontSize: scaleFont(14),
    color: '#687382',
    fontWeight: '700',
  },
  loader: {
    marginTop: scaleWidth(40),
  },
  paginationBar: {
    marginTop: scaleWidth(8),
    marginBottom: scaleWidth(4),
    paddingHorizontal: scaleWidth(14),
    paddingVertical: scaleWidth(12),
    borderRadius: scaleWidth(18),
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    shadowColor: '#0b1f3f',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  paginationInfo: {
    fontSize: scaleFont(12),
    fontWeight: '700',
    color: '#687382',
    textAlign: 'center',
    marginBottom: scaleWidth(8),
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paginationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(2),
    paddingHorizontal: scaleWidth(10),
    paddingVertical: scaleWidth(8),
    borderRadius: scaleWidth(12),
    backgroundColor: 'rgba(7,27,52,0.05)',
  },
  paginationBtnDisabled: {
    opacity: 0.55,
  },
  paginationBtnText: {
    fontSize: scaleFont(13),
    fontWeight: '800',
    color: '#0b1f3f',
  },
  paginationBtnTextDisabled: {
    color: '#A0AAB4',
  },
  paginationPageText: {
    fontSize: scaleFont(13),
    fontWeight: '800',
    color: '#0b1f3f',
  },
  comingSoonOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 27, 52, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scaleWidth(28),
  },
  comingSoonCard: {
    width: '100%',
    maxWidth: scaleWidth(340),
    borderRadius: scaleWidth(28),
    backgroundColor: '#FFFFFF',
    paddingHorizontal: scaleWidth(24),
    paddingTop: scaleWidth(28),
    paddingBottom: scaleWidth(22),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8ECF0',
    shadowColor: '#0b1f3f',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 12,
  },
  comingSoonIconWrap: {
    width: scaleWidth(68),
    height: scaleWidth(68),
    borderRadius: scaleWidth(22),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF2F7',
    marginBottom: scaleWidth(16),
  },
  comingSoonEyebrow: {
    color: '#0077b6',
    fontSize: scaleFont(12),
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: scaleWidth(6),
  },
  comingSoonTitle: {
    color: '#0b1f3f',
    fontSize: scaleFont(24),
    fontWeight: '900',
    marginBottom: scaleWidth(10),
  },
  comingSoonMessage: {
    color: '#687382',
    fontSize: scaleFont(15),
    fontWeight: '600',
    lineHeight: scaleFont(22),
    textAlign: 'center',
    marginBottom: scaleWidth(22),
  },
  comingSoonButton: {
    width: '100%',
    height: scaleWidth(50),
    borderRadius: scaleWidth(16),
    backgroundColor: '#0b1f3f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  comingSoonButtonText: {
    color: '#FFFFFF',
    fontSize: scaleFont(15),
    fontWeight: '800',
  },
});
