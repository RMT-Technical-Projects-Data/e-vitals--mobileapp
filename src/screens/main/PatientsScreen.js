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

  const systolic = toCleanNumber(bpObj?.systolic_pressure ?? bpObj?.systolic);
  const diastolic = toCleanNumber(bpObj?.diastolic_pressure ?? bpObj?.diastolic);
  let pulse = toCleanNumber(bpObj?.pulse);
  let bp = (systolic != null && diastolic != null)
    ? `${Math.round(systolic)}/${Math.round(diastolic)}`
    : '--';
  let glucose = bgObj
    ? String(Math.round(bgObj.blood_glucose_value_1 || bgObj.value || 0))
    : (item.glucose ? String(item.glucose) : '--');
  let weight = wtObj
    ? String(Math.round(wtObj.weight || wtObj.weight_value || wtObj.value || 0))
    : (item.weight ? String(item.weight) : '--');

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

  return {
    bp,
    pulse: pulse != null ? Math.round(pulse) : null,
    glucose,
    weight,
  };
};

const getPatientStatusMeta = (status) => {
  const raw = String(status ?? '').trim();
  const lower = raw.toLowerCase();
  const numeric = /^\d+$/.test(lower) ? parseInt(lower, 10) : null;

  if (numeric === 2 || lower === 'active' || lower === 'stable') {
    return { letter: 'A', bg: '#DDF8DD', color: '#249527' };
  }
  if (numeric === 3 || lower === 'pending' || lower === 'review') {
    return { letter: 'P', bg: '#DBB881', color: '#653E00' };
  }
  if (numeric === 4 || lower === 'locked') {
    return { letter: 'L', bg: '#E6DDF8', color: '#490565' };
  }
  if (lower === 'critical') {
    return { letter: 'C', bg: '#FDE8E8', color: '#C62828' };
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

const PAGE_SIZE = 10;

export default function PatientsScreen({ navigation }) {
  const [userRole, setUserRole] = useState('provider');
  const [practiceId, setPracticeId] = useState(null);
  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPatients, setTotalPatients] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const listRef = useRef(null);

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
          const result = await apiService.getPatients(pId, {
            limit: PAGE_SIZE,
            page: currentPage,
            search: debouncedSearch || undefined,
            includeDashboardEnrichment: true,
          });
          if (result?.success && result?.data?.patients) {
            const pagination = result.data.pagination || {};
            setTotalPages(Math.max(1, pagination.total_pages || 1));
            setTotalPatients(pagination.total || result.data.patients.length);

            if (result.data.patients.length > 0) {
              // Sync list rows with patient detail endpoint shape so each row
              // shows the same latest vitals source as PatientHub.
              const enrichedPatients = await Promise.all(
                result.data.patients.map(async (patient) => {
                  const patientId = patient.patient_table_id || patient.id;
                  if (!patientId) return patient;
                  try {
                    const detail = await apiService.getPatientDetailsFast(pId, patientId);
                    const latest = detail?.data?.latest_measurements;
                    if (!latest) return patient;
                    return {
                      ...patient,
                      latest_measurements: latest,
                    };
                  } catch {
                    return patient;
                  }
                })
              );
              setPatients(enrichedPatients);
            } else {
              setPatients([]);
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
  }, [currentPage, debouncedSearch]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  useFocusEffect(
    useCallback(() => {
      fetchPatients();
    }, [fetchPatients])
  );

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
    const statusMeta = getPatientStatusMeta(item.status);

    return (
      <TouchableOpacity
        style={styles.patientCard}
        onPress={() => handlePatientPress(item)}
        activeOpacity={0.85}
      >
        <View style={styles.pcTop}>
          <View style={[styles.pcAvatar, { backgroundColor: themeColor }]}>
            <Text style={styles.pcAvatarText}>
              {item.first_name?.[0]}
              {item.last_name?.[0]}
            </Text>
          </View>
          <View style={styles.pcInfo}>
            <Text style={styles.pcName}>{item.first_name} {item.last_name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusMeta.color }]}>
                {statusMeta.letter}
              </Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={26} color={themeColor} />
        </View>
        <View style={styles.pcVitals}>
          <View style={styles.pcVital}>
            <Text style={styles.pvLbl}>BP</Text>
            <View style={styles.pvValueRow}>
              <Text style={styles.pvVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {vitals.bp}
              </Text>
              {vitals.pulse != null ? (
                <Text style={styles.pvPulse} numberOfLines={1}>
                  {' '}P{vitals.pulse}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.pcVital}>
            <Text style={styles.pvLbl}>BG</Text>
            <Text style={styles.pvVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {vitals.glucose}
            </Text>
          </View>
          <View style={styles.pcVital}>
            <Text style={styles.pvLbl}>Weight</Text>
            <Text style={styles.pvVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {vitals.weight}
            </Text>
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
      <LinearGradient colors={['#fffdfb', '#f7ece7', '#eef1f5']} style={styles.container}>
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
              onPress={() => {}}
              activeOpacity={1}
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

          {isLoading ? (
            <ActivityIndicator size="large" color={themeColor} style={styles.loader} />
          ) : (
            <FlatList
              ref={listRef}
              data={patients}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderPatientItem}
              style={styles.patientList}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No patients found matching your search.</Text>
                </View>
              }
              ListFooterComponent={renderPaginationFooter}
            />
          )}

          <PremiumBottomNav active="patients" navigation={navigation} role={userRole} />
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
    backgroundColor: 'rgba(255,255,255,0.88)',
    marginHorizontal: Math.max(scaleWidth(20), 20),
    marginVertical: scaleWidth(10),
    borderRadius: scaleWidth(20),
    paddingHorizontal: scaleWidth(14),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    minHeight: scaleWidth(50),
    shadowColor: '#071B34',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 26,
    elevation: 3,
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
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: scaleWidth(24),
    padding: scaleWidth(16),
    marginBottom: scaleWidth(12),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    shadowColor: '#071B34',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 3,
  },
  pcTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleWidth(12),
  },
  pcAvatar: {
    width: scaleWidth(44),
    height: scaleWidth(44),
    borderRadius: scaleWidth(16),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scaleWidth(12),
  },
  pcAvatarText: {
    color: '#fff',
    fontSize: scaleFont(13),
    fontWeight: '800',
  },
  pcInfo: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(8),
  },
  pcName: {
    fontSize: scaleFont(15),
    fontWeight: '800',
    color: '#071B34',
    flexShrink: 1,
  },
  statusBadge: {
    width: scaleWidth(28),
    height: scaleWidth(28),
    borderRadius: scaleWidth(14),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  statusBadgeText: {
    fontSize: scaleFont(12),
    fontWeight: '800',
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
