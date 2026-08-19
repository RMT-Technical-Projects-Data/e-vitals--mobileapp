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
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import apiService from '../../services/apiService';
import PremiumBottomNav, { PREMIUM_BOTTOM_NAV_CLEARANCE } from '../../components/navigation/PremiumBottomNav';
import AddPatientModal from '../../components/modals/AddPatientModal';

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
  if (weightNum != null && weightNum > 0) {
    if (weightNum <= 110) {
      weightNum = weightNum * 2.20462;
    }
  }
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

const VITAL_TARGETS = {
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

const getVitalColor = (value, min, max) => {
  if (value == null || value === '' || value === '--' || value === 'N/A') return '#071B34';
  const num = Number(value);
  if (Number.isNaN(num) || num <= 0) return '#071B34';
  if (num > max) return '#d32f2f'; // High / Abnormal (Red)
  if (num < min) return '#f57c00'; // Low / Warning (Orange)
  return '#15803d'; // Normal (Green)
};

const getBpVitalColor = (bpString) => {
  if (!bpString || bpString === '--' || bpString === 'N/A') return '#071B34';
  const parts = String(bpString).split('/');
  if (parts.length !== 2) return '#071B34';
  const sys = Number(parts[0].trim());
  const dia = Number(parts[1].trim());
  const sysColor = getVitalColor(sys, VITAL_TARGETS.systolicMin, VITAL_TARGETS.systolicMax);
  const diaColor = getVitalColor(dia, VITAL_TARGETS.diastolicMin, VITAL_TARGETS.diastolicMax);
  if (sysColor === '#d32f2f' || diaColor === '#d32f2f') return '#d32f2f';
  if (sysColor === '#f57c00' || diaColor === '#f57c00') return '#f57c00';
  return '#15803d';
};

const getPatientStatusMeta = (status) => {
  const raw = String(status ?? '').trim();
  const lower = raw.toLowerCase();
  const numeric = /^\d+$/.test(lower) ? parseInt(lower, 10) : null;

  if (numeric === 2 || lower === 'active' || lower === 'stable') {
    return { letter: 'A', bg: '#DDF8DD', color: '#15803d' };
  }
  if (numeric === 3 || lower === 'pending' || lower === 'review') {
    return { letter: 'P', bg: '#FEF3C7', color: '#D97706' };
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

const fallbackPatients = [
  {
    id: 'mock-1',
    first_name: 'Cyrus',
    last_name: 'Nguyen',
    status: 4,
    data_summary: '165/102 (92)',
    glucose: '118',
    weight: '74',
  },
  {
    id: 'mock-2',
    first_name: 'Anna',
    last_name: 'Lee',
    status: 3,
    data_summary: '118/72 (76)',
    glucose: '142',
    weight: '68',
  },
  {
    id: 'mock-3',
    first_name: 'Robert',
    last_name: 'Mills',
    status: 2,
    data_summary: '122/78 (72)',
    glucose: '105',
    weight: '80',
  },
];

const STATUS_TABS = [
  { key: null, label: 'All', activeBg: '#071B34', inactiveBorder: '#E2E8F0', activeColor: '#FFFFFF', inactiveColor: '#64748B' },
  { key: '2', label: 'Active', activeBg: '#15803d', inactiveBorder: '#BBF7D0', activeColor: '#FFFFFF', inactiveColor: '#15803d', dot: '#15803d' },
  { key: '3', label: 'Pending', activeBg: '#D97706', inactiveBorder: '#FDE68A', activeColor: '#FFFFFF', inactiveColor: '#D97706', dot: '#D97706' },
  { key: '4', label: 'Locked', activeBg: '#d32f2f', inactiveBorder: '#FCA5A5', activeColor: '#FFFFFF', inactiveColor: '#d32f2f', dot: '#d32f2f' },
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
  const [activeFilter, setActiveFilter] = useState(route?.params?.dashboardFilter || null);
  const [activeFilterTitle, setActiveFilterTitle] = useState(route?.params?.filterTitle || null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (route?.params?.dashboardFilter !== undefined || route?.params?.filterTitle !== undefined) {
      setActiveFilter(route?.params?.dashboardFilter || null);
      setActiveFilterTitle(route?.params?.filterTitle || null);
      setStatusFilter(null);
      setCurrentPage(1);
    }
  }, [route?.params?.dashboardFilter, route?.params?.filterTitle]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchPatients = useCallback(async () => {
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
          const apiStatusParam = mapStatusToDbCode(statusFilter);
          const result = await apiService.getPatients(pId, {
            limit: PAGE_SIZE,
            page: currentPage,
            search: debouncedSearch || undefined,
            status: !activeFilter ? apiStatusParam : undefined,
            dashboardFilter: activeFilter || undefined,
            program: activeFilter ? 'rpm' : undefined,
            includeDashboardEnrichment: true,
          });
          if (result?.success && result?.data?.patients) {
            const pagination = result.data.pagination || {};
            const fetchedPatients = result.data.patients;
            setTotalPages(Math.max(1, pagination.total_pages || 1));
            setTotalPatients(pagination.total || fetchedPatients.length);

            // Render patients INSTANTLY (ultra-fast, zero blocking lag)
            setPatients(fetchedPatients);

            // Asynchronous background enrichment for missing measurements (non-blocking)
            const missingEnrich = fetchedPatients.filter(p => !p.latest_measurements);
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
                const validUpdates = updates.filter(u => u && u.latest);
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
            setPatients(fallbackPatients);
            setTotalPages(1);
            setTotalPatients(fallbackPatients.length);
          }
        } else {
          setPatients(fallbackPatients);
          setTotalPages(1);
          setTotalPatients(fallbackPatients.length);
        }
      } else {
        setPatients(fallbackPatients);
        setTotalPages(1);
        setTotalPatients(fallbackPatients.length);
      }
    } catch (error) {
      console.warn('Error fetching patients list screen:', error);
      setPatients(fallbackPatients);
      setTotalPages(1);
      setTotalPatients(fallbackPatients.length);
    } finally {
      setIsLoading(false);
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
      navigation.setParams({ dashboardFilter: undefined, filterTitle: undefined });
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
  const themeColor = isCaregiver ? '#1B2A47' : '#071B34';
  const accentColor = isCaregiver ? '#2F5F8F' : '#9B1230';
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

    const bpColor = getBpVitalColor(vitals.bp);
    const pulseColor = vitals.pulse != null ? getVitalColor(vitals.pulse, VITAL_TARGETS.pulseMin, VITAL_TARGETS.pulseMax) : '#687382';
    const glucoseColor = getVitalColor(vitals.glucose, VITAL_TARGETS.glucoseMin, VITAL_TARGETS.glucoseMax);

    let weightNum = vitals.weight && vitals.weight !== '--' ? Number(String(vitals.weight).replace(/[^\d.-]/g, '')) : null;
    if (weightNum != null && !Number.isNaN(weightNum) && weightNum <= 110) {
      weightNum = weightNum * 2.20462;
    }
    const weightColor = weightNum != null ? getVitalColor(weightNum, VITAL_TARGETS.weightMin, VITAL_TARGETS.weightMax) : '#071B34';

    return (
      <TouchableOpacity
        style={styles.patientCard}
        onPress={() => handlePatientPress(item)}
        activeOpacity={0.85}
      >
        <View style={styles.pcTop}>
          {/* Avatar with status badge overlay */}
          <View style={styles.avatarWrap}>
            <View style={[styles.pcAvatarSmall, { backgroundColor: themeColor }]}>
              <Text style={styles.pcAvatarTextSmall}>
                {item.first_name?.[0]}
                {item.last_name?.[0]}
              </Text>
            </View>
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
              <Text style={[styles.pvVal, { color: bpColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {vitals.bp}
              </Text>
              {vitals.pulse != null ? (
                <Text style={[styles.pvPulse, { color: pulseColor }]} numberOfLines={1}>
                  {' '}P{vitals.pulse}
                </Text>
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
              <MaterialIcons name="arrow-back" size={21} color="#071B34" />
            </TouchableOpacity>
            <Text style={styles.topbarTitle}>Patients List</Text>
            <TouchableOpacity
              style={styles.topbarActionButton}
              onPress={() => {
                // Add Patient Modal opening disabled for now
                // setShowAddModal(true);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Add patient"
            >
              <MaterialIcons name="person-add" size={21} color="#071B34" />
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

          {/* Filter indication / Status filter bar */}
          {activeFilterTitle ? (
            <View style={styles.activeFilterBanner}>
              <View style={styles.activeFilterPill}>
                <MaterialIcons name="filter-list" size={18} color="#071B34" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeFilterText}>Filtered by: {activeFilterTitle}</Text>
                  <Text style={styles.activeFilterSubtext}>Applied on active patients</Text>
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
          ) : (
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
    shadowColor: '#071B34',
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
    color: '#071B34',
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
    shadowColor: '#071B34',
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
    color: '#071B34',
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
    color: '#071B34',
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
    shadowColor: '#071B34',
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
    color: '#071B34',
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
    color: '#071B34',
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
    color: '#071B34',
    lineHeight: scaleFont(14),
    flexShrink: 1,
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
    color: '#071B34',
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
    shadowColor: '#071B34',
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
    color: '#071B34',
  },
  paginationBtnTextDisabled: {
    color: '#A0AAB4',
  },
  paginationPageText: {
    fontSize: scaleFont(13),
    fontWeight: '800',
    color: '#071B34',
  },
});
