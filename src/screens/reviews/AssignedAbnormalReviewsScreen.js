import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  Alert,
  RefreshControl,
  Dimensions,
  Pressable,
  PanResponder,
  AppState,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import apiService from '../../services/apiService';
import { MEASUREMENT_COLORS } from '../../utils/measurementUtils';
import { subscribeAbnormalAssignmentReceived } from '../../utils/abnormalAssignmentEvents';
import { dismissAbnormalNotification } from '../../utils/notificationInbox';
import { getAssignedReadingVitalColors } from '../../utils/patientVitalTargets';
import PulseIcon from '../../components/common/PulseIcon';

const { width } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const scaleWidth = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.25);
const scaleFont = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.2);

const DARK = '#0b1f3f';
const MUTED = '#687382';
const BORDER = '#e8ecf0';
const WHITE = '#ffffff';
const ABNORMAL_STATUS = { letter: 'A', bg: '#FDE8E8', color: '#d32f2f' };

const patientGroupKey = (item) => `${item.practice_id}_${item.patient_id}`;

const readingItemKey = (item) =>
  `${item.patient_id}_${item.measurement_id || 'patient'}_${item.vital_type || ''}`;

const groupAssignedByPatient = (list) => {
  const groups = [];
  const indexByKey = new Map();

  (list || []).forEach((item) => {
    const key = patientGroupKey(item);
    if (!indexByKey.has(key)) {
      indexByKey.set(key, groups.length);
      groups.push({
        patient_id: item.patient_id,
        practice_id: item.practice_id,
        practice_name: item.practice_name,
        first_name: item.first_name,
        last_name: item.last_name,
        account_number: item.account_number,
        readings: [],
      });
    }
    groups[indexByKey.get(key)].readings.push(item);
  });

  groups.forEach((group) => {
    group.readings.sort((a, b) =>
      String(b?.reading_date || b?.assigned_at || '').localeCompare(
        String(a?.reading_date || a?.assigned_at || ''),
      ));
  });

  return groups;
};

const classifyVitalType = (vitalType) => {
  const vt = String(vitalType || '').toLowerCase();
  if (vt.includes('glucose') || vt === 'bg') return 'bg';
  if (vt.includes('weight') || vt === 'wt') return 'weight';
  if (vt.includes('pressure') || vt === 'bp') return 'bp';
  return 'other';
};

const parseAssignedReadingValues = (reading) => {
  const type = classifyVitalType(reading?.vital_type);
  const parsed = { type, sys: null, dia: null, pulse: null, glucose: null, weight: null };
  const raw = String(reading?.reading_value || '');

  if (type === 'bp') {
    const match = raw.match(/([\d.]+)\s*\/\s*([\d.]+)/);
    if (match) {
      parsed.sys = Math.round(Number(match[1]));
      parsed.dia = Math.round(Number(match[2]));
    }
    const pulse = Number(reading?.pulse);
    if (Number.isFinite(pulse) && pulse > 0) parsed.pulse = Math.round(pulse);
  } else if (type === 'bg') {
    const match = raw.match(/([\d.]+)/);
    if (match) parsed.glucose = Math.round(Number(match[1]));
  } else if (type === 'weight') {
    const match = raw.match(/([\d.]+)/);
    if (match) parsed.weight = Number(match[1]);
  }

  return parsed;
};

const vitalPillForReading = (reading) => {
  const type = classifyVitalType(reading?.vital_type);
  if (type === 'bp') return 'BP';
  if (type === 'bg') return 'BG';
  if (type === 'weight') return 'Weight';
  return null;
};

const isMeasurementReading = (reading) =>
  Boolean(
    reading?.vital_type
    && reading?.measurement_id
    && reading.vital_type !== 'patient'
    && reading.vital_type !== 'assigned_review',
  );

const formatAssigneeName = (person) => {
  const name = `${person?.first_name || ''} ${person?.last_name || ''}`.trim();
  return name || person?.name || person?.username || `User #${person?.id || ''}`;
};

const formatPatientName = (group) => {
  const formatted = `${group.last_name || ''}, ${group.first_name || ''}`.replace(/^,\s*|\s*,$/g, '').trim();
  return formatted || `Patient #${group.patient_id}`;
};

const AssignedAbnormalReviewsScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assignedReadings, setAssignedReadings] = useState([]);
  const [processingKey, setProcessingKey] = useState(null);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignees, setAssignees] = useState([]);
  const [assigneesLoading, setAssigneesLoading] = useState(false);
  const [assigningId, setAssigningId] = useState(null);
  const [activeReadingByPatient, setActiveReadingByPatient] = useState({});
  const [scheduleCache, setScheduleCache] = useState({ practice: {}, patient: {} });

  const groupedPatients = useMemo(
    () => groupAssignedByPatient(assignedReadings),
    [assignedReadings],
  );

  const loadScheduleTargetsForReadings = useCallback(async (list) => {
    const practiceIds = [...new Set((list || []).map((item) => item.practice_id).filter(Boolean))];
    const patientPairs = [...new Set(
      (list || [])
        .filter((item) => item.practice_id && item.patient_id)
        .map((item) => `${item.practice_id}_${item.patient_id}`),
    )];

    const nextCache = { practice: {}, patient: {} };

    await Promise.all(practiceIds.map(async (practiceId) => {
      try {
        const res = await apiService.getPracticeScheduleTargets(practiceId);
        nextCache.practice[practiceId] = res?.data || {};
      } catch (error) {
        console.warn(`Failed to load practice schedule targets (${practiceId}):`, error?.message || error);
      }
    }));

    await Promise.all(patientPairs.map(async (pairKey) => {
      const [practiceId, patientId] = pairKey.split('_');
      try {
        const res = await apiService.getPatientScheduleTargets(practiceId, patientId);
        nextCache.patient[pairKey] = res?.data || {};
      } catch (error) {
        console.warn(`Failed to load patient schedule targets (${pairKey}):`, error?.message || error);
      }
    }));

    setScheduleCache(nextCache);
  }, []);

  const fetchAssigned = useCallback(async ({ refresh = false, silent = false } = {}) => {
    try {
      if (refresh) setRefreshing(true);
      else if (!silent) setLoading(true);

      const res = await apiService.getAssignedAbnormalReviews();
      const list = Array.isArray(res?.data) ? res.data : [];
      setAssignedReadings(list);
      loadScheduleTargetsForReadings(list);
    } catch (error) {
      console.warn('Failed to fetch assigned abnormal reviews:', error?.message || error);
      if (!silent) {
        Alert.alert('Error', error?.message || 'Failed to load assigned reviews');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadScheduleTargetsForReadings]);

  useFocusEffect(
    useCallback(() => {
      fetchAssigned();
    }, [fetchAssigned]),
  );

  useEffect(() => {
    const unsubscribePush = subscribeAbnormalAssignmentReceived(() => {
      fetchAssigned({ silent: true });
    });

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        fetchAssigned({ silent: true });
      }
    });

    return () => {
      unsubscribePush();
      appStateSub.remove();
    };
  }, [fetchAssigned]);

  const reviewOneReading = async (reading) => {
    if (!reading.practice_id || !reading.patient_id) return false;

    if (isMeasurementReading(reading)) {
      await apiService.reviewPatientMeasurement(
        reading.practice_id,
        reading.patient_id,
        reading.vital_type,
        reading.measurement_id,
      );
      return true;
    }

    await apiService.reviewPatientAbnormal(reading.practice_id, reading.patient_id);
    return true;
  };

  const shiftReading = useCallback((groupKey, readingsLength, delta) => {
    if (readingsLength <= 1) return;
    setActiveReadingByPatient((prev) => {
      const current = Number(prev[groupKey] || 0);
      const next = Math.min(readingsLength - 1, Math.max(0, current + delta));
      if (next === current) return prev;
      return { ...prev, [groupKey]: next };
    });
  }, []);

  const buildReadingSwipeHandlers = useCallback((groupKey, readingsLength) => (
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => (
        readingsLength > 1
        && Math.abs(gesture.dx) > 14
        && Math.abs(gesture.dx) > Math.abs(gesture.dy)
      ),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > 36) {
          shiftReading(groupKey, readingsLength, 1);
        } else if (gesture.dx < -36) {
          shiftReading(groupKey, readingsLength, -1);
        }
      },
    }).panHandlers
  ), [shiftReading]);

  const handleReviewReading = async (group, reading) => {
    const groupKey = patientGroupKey(group);
    if (!group?.practice_id || !group?.patient_id || !reading || processingKey) return;

    setProcessingKey(groupKey);
    try {
      const reviewed = await reviewOneReading(reading);
      if (!reviewed) {
        Alert.alert('Review failed', 'Could not mark this reading as reviewed.');
        return;
      }

      const reviewedKey = readingItemKey(reading);
      setAssignedReadings((prev) => prev.filter((item) => readingItemKey(item) !== reviewedKey));
      dismissAbnormalNotification({
        practiceId: reading.practice_id,
        patientId: reading.patient_id,
        vitalType: reading.vital_type,
        measurementId: reading.measurement_id,
      });

      setActiveReadingByPatient((prev) => {
        const next = { ...prev };
        delete next[groupKey];
        return next;
      });
    } catch (error) {
      Alert.alert('Review failed', error?.message || 'Failed to complete review');
    } finally {
      setProcessingKey(null);
    }
  };

  const openAssignModal = async (reading) => {
    setAssignTarget(reading);
    setAssignModalVisible(true);
    setAssigneesLoading(true);

    try {
      const [providersRes, caregiversRes] = await Promise.all([
        apiService.getPracticeProviders(reading.practice_id),
        apiService.getPracticeCaregivers(reading.practice_id),
      ]);

      let providersData = providersRes?.data?.providers
        || providersRes?.data?.data?.providers
        || providersRes?.data
        || [];
      let caregiversData = caregiversRes?.data?.caregivers
        || caregiversRes?.data?.data?.caregivers
        || caregiversRes?.data
        || [];

      if (!Array.isArray(providersData)) providersData = [];
      if (!Array.isArray(caregiversData)) caregiversData = [];

      const providers = providersData.map((p) => ({ ...p, assigneeRole: 'provider' }));
      const caregivers = caregiversData.map((c) => ({ ...c, assigneeRole: 'caregiver' }));

      setAssignees([...providers, ...caregivers]);
    } catch (error) {
      Alert.alert('Error', error?.message || 'Failed to load team members');
      setAssignModalVisible(false);
      setAssignTarget(null);
    } finally {
      setAssigneesLoading(false);
    }
  };

  const handleAssignTo = async (assignee) => {
    if (!assignTarget || !assignee?.id) return;

    setAssigningId(assignee.id);
    try {
      const payload = {
        assigneeId: assignee.id,
        role: assignee.assigneeRole,
        purpose: 'invite',
      };

      if (isMeasurementReading(assignTarget)) {
        await apiService.assignMeasurementReading(
          assignTarget.practice_id,
          assignTarget.patient_id,
          assignTarget.vital_type,
          assignTarget.measurement_id,
          payload,
        );
      } else if (assignee.assigneeRole === 'provider') {
        await apiService.assignPatientProviderForReview(
          assignTarget.practice_id,
          assignTarget.patient_id,
          { providerId: assignee.id, purpose: 'invite' },
        );
      } else {
        await apiService.assignPatientCaregiverForReview(
          assignTarget.practice_id,
          assignTarget.patient_id,
          { caregiverId: assignee.id, purpose: 'invite' },
        );
      }

      setAssignModalVisible(false);
      setAssignTarget(null);
      Alert.alert('Assigned', `Reading reassigned to ${formatAssigneeName(assignee)}.`);
      await fetchAssigned(true);
    } catch (error) {
      Alert.alert('Assign failed', error?.message || 'Failed to reassign reading');
    } finally {
      setAssigningId(null);
    }
  };

  const openPatientHub = (group) => {
    navigation.navigate('PatientHub', {
      patientId: group.patient_id,
      practiceId: group.practice_id,
      patientName: `${group.first_name || ''} ${group.last_name || ''}`.trim(),
    });
  };

  const renderGroup = ({ item: group }) => {
    const groupKey = patientGroupKey(group);
    const readings = group.readings || [];
    const activeIndex = Math.min(
      Number(activeReadingByPatient[groupKey] || 0),
      Math.max(0, readings.length - 1),
    );
    const activeReading = readings[activeIndex] || readings[0] || {};
    const readingNumber = Math.max(1, readings.length - activeIndex);
    const patientName = `${group.first_name || ''} ${group.last_name || ''}`.trim() || formatPatientName(group);
    const isProcessing = processingKey === groupKey;
    const activeVitalType = classifyVitalType(activeReading.vital_type);
    const values = parseAssignedReadingValues(activeReading);
    const activeVitalPill = vitalPillForReading(activeReading);
    const firstInitial = group.first_name?.[0] || patientName?.[0] || 'P';
    const lastInitial = group.last_name?.[0] || '';

    const bpDisplay = values.sys != null && values.dia != null
      ? `${values.sys}/${values.dia}`
      : '--';
    const weightDisplay = values.weight != null ? Number(values.weight).toFixed(1) : '--';
    const {
      sysColor,
      diaColor,
      pulseColor,
      glucoseColor,
      weightColor,
      isPulseAbnormal,
    } = getAssignedReadingVitalColors(activeReading, values, scheduleCache);

    const swipeHandlers = buildReadingSwipeHandlers(groupKey, readings.length);

    return (
      <View style={st.patientCard}>
        <View style={st.pcTop}>
          <View style={st.avatarWrap}>
            <View style={st.pcAvatarSmall}>
              <Text style={st.pcAvatarTextSmall}>{firstInitial}{lastInitial}</Text>
            </View>
            <View style={[st.statusBadgeCorner, { backgroundColor: ABNORMAL_STATUS.bg, borderColor: WHITE }]}>
              <Text style={[st.statusBadgeTextCorner, { color: ABNORMAL_STATUS.color }]}>
                {ABNORMAL_STATUS.letter}
              </Text>
            </View>
          </View>

          <View style={st.pcInfoCol}>
            <View style={st.pcInfoRow}>
              <Text style={st.pcName} numberOfLines={1}>{patientName}</Text>
              {activeVitalPill ? (
                <View style={st.inlineVitalPill}>
                  <Text style={st.inlineVitalPillText}>{activeVitalPill}</Text>
                </View>
              ) : null}
              <Text style={st.readingDateEnd} numberOfLines={1}>
                {activeReading.reading_date || activeReading.assigned_at || 'Recently assigned'}
              </Text>
            </View>
            {activeReading.assigned_by_name ? (
              <Text style={st.assignedByLine} numberOfLines={1}>
                Assigned by {activeReading.assigned_by_name}
              </Text>
            ) : null}
          </View>
        </View>

        <View {...swipeHandlers}>
          <View style={st.pcVitals}>
            {activeVitalType === 'bp' ? (
              <View style={[st.pcVital, st.pcVitalSingle]}>
                <Text style={st.pvLbl}>BP (mmHg)</Text>
                <View style={st.pvValueRow}>
                  {values.sys != null && values.dia != null ? (
                    <>
                      <Text style={[st.pvVal, { color: sysColor }]} numberOfLines={1}>{values.sys}</Text>
                      <Text style={st.bpSlash}>/</Text>
                      <Text style={[st.pvVal, { color: diaColor }]} numberOfLines={1}>{values.dia}</Text>
                    </>
                  ) : (
                    <Text style={[st.pvVal, { color: MEASUREMENT_COLORS.missing }]} numberOfLines={1}>
                      {bpDisplay}
                    </Text>
                  )}
                  {values.pulse != null ? (
                    <View style={st.pvPulseWrap}>
                      <Text style={[st.pvPulse, { color: pulseColor }]} numberOfLines={1}>
                        {values.pulse}
                      </Text>
                      <PulseIcon isAbnormal={isPulseAbnormal} size={scaleFont(11)} />
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}
            {activeVitalType === 'bg' ? (
              <View style={[st.pcVital, st.pcVitalSingle]}>
                <Text style={st.pvLbl}>BG (mg/dL)</Text>
                <Text
                  style={[st.pvVal, { color: glucoseColor }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {values.glucose ?? '--'}
                </Text>
              </View>
            ) : null}
            {activeVitalType === 'weight' ? (
              <View style={[st.pcVital, st.pcVitalSingle]}>
                <Text style={st.pvLbl}>WT (lbs)</Text>
                <Text
                  style={[st.pvVal, { color: weightColor }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {weightDisplay}
                </Text>
              </View>
            ) : null}
          </View>

          {readings.length > 1 ? (
            <View style={st.readingSwitcher}>
              <TouchableOpacity
                style={[st.switchBtn, activeIndex >= readings.length - 1 && st.switchBtnDisabled]}
                onPress={() => shiftReading(groupKey, readings.length, 1)}
                disabled={activeIndex >= readings.length - 1}
                accessibilityLabel="Previous assigned reading"
              >
                <Text style={[st.switchBtnText, activeIndex >= readings.length - 1 && st.switchBtnTextDisabled]}>
                  Prev
                </Text>
              </TouchableOpacity>
              <Text style={st.readingSwitcherCount}>
                {readingNumber} / {readings.length}
              </Text>
              <TouchableOpacity
                style={[st.switchBtn, activeIndex <= 0 && st.switchBtnDisabled]}
                onPress={() => shiftReading(groupKey, readings.length, -1)}
                disabled={activeIndex <= 0}
                accessibilityLabel="Next assigned reading"
              >
                <Text style={[st.switchBtnText, activeIndex <= 0 && st.switchBtnTextDisabled]}>
                  Next
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={st.actionsRow}>
          <TouchableOpacity
            style={[st.actionBtn, st.actionBtnPrimary, isProcessing && { opacity: 0.6 }]}
            onPress={() => handleReviewReading(group, activeReading)}
            disabled={isProcessing}
            activeOpacity={0.85}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={WHITE} />
            ) : (
              <Text style={st.actionBtnPrimaryText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                Mark Review
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={st.actionBtn}
            onPress={() => openAssignModal(activeReading)}
            activeOpacity={0.85}
          >
            <Text style={st.actionBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              Reassign
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={st.actionBtn}
            onPress={() => openPatientHub(group)}
            activeOpacity={0.85}
          >
            <Text style={st.actionBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              View
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const listHeader = () => (
    <View style={st.summaryCard}>
      <Text style={st.cardTitle}>Assigned Abnormal Readings</Text>
      <Text style={st.summaryText}>
        {assignedReadings.length > 0
          ? `${assignedReadings.length} reading${assignedReadings.length === 1 ? '' : 's'} across ${groupedPatients.length} patient${groupedPatients.length === 1 ? '' : 's'}. Swipe or use Prev/Next when a patient has multiple readings.`
          : 'When an abnormal reading is assigned to you, it will appear here.'}
      </Text>
    </View>
  );

  return (
    <SafeAreaProvider>
      <LinearGradient colors={['#ffffff', '#ffffff', '#ffffff']} style={st.container}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={st.topbar}>
            <TouchableOpacity
              style={st.topbarActionButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <MaterialIcons name="arrow-back" size={21} color={DARK} />
            </TouchableOpacity>
            <Text style={st.topbarTitle}>Assigned Reviews</Text>
            <View style={st.topbarSpacer} />
          </View>

          {loading && !refreshing ? (
            <View style={st.centerState}>
              <ActivityIndicator size="large" color={DARK} />
            </View>
          ) : (
            <FlatList
              data={groupedPatients}
              keyExtractor={(item) => patientGroupKey(item)}
              renderItem={renderGroup}
              ListHeaderComponent={listHeader}
              contentContainerStyle={st.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={(
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => fetchAssigned({ refresh: true })}
                  tintColor={DARK}
                />
              )}
              ListEmptyComponent={(
                <View style={st.emptyWrap}>
                  <MaterialIcons name="assignment-turned-in" size={48} color="#94a3b8" />
                  <Text style={st.emptyTitle}>No assigned readings</Text>
                  <Text style={st.emptyText}>
                    Pull down to refresh. You are all caught up.
                  </Text>
                </View>
              )}
            />
          )}

          <Modal
            visible={assignModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setAssignModalVisible(false)}
          >
            <Pressable style={st.modalOverlay} onPress={() => setAssignModalVisible(false)}>
              <Pressable style={st.modalContent} onPress={(e) => e.stopPropagation()}>
                <View style={st.modalHeader}>
                  <Text style={st.modalTitle}>Reassign Reading</Text>
                  <TouchableOpacity style={st.modalCloseBtn} onPress={() => setAssignModalVisible(false)}>
                    <MaterialIcons name="close" size={22} color={DARK} />
                  </TouchableOpacity>
                </View>

                {assigneesLoading ? (
                  <ActivityIndicator size="large" color={DARK} style={{ marginVertical: 24 }} />
                ) : (
                  <FlatList
                    data={assignees}
                    keyExtractor={(item) => `${item.assigneeRole}-${item.id}`}
                    style={{ maxHeight: 320 }}
                    ListEmptyComponent={(
                      <Text style={st.emptyText}>No providers or caregivers found for this practice.</Text>
                    )}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={st.modalItem}
                        onPress={() => handleAssignTo(item)}
                        disabled={assigningId === item.id}
                        activeOpacity={0.75}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={st.modalItemText}>{formatAssigneeName(item)}</Text>
                          <Text style={st.modalItemSubtext}>
                            {item.assigneeRole === 'provider' ? 'Provider' : 'Caregiver'}
                          </Text>
                        </View>
                        {assigningId === item.id ? (
                          <ActivityIndicator size="small" color={DARK} />
                        ) : (
                          <MaterialIcons name="chevron-right" size={22} color={MUTED} />
                        )}
                      </TouchableOpacity>
                    )}
                  />
                )}
              </Pressable>
            </Pressable>
          </Modal>
        </SafeAreaView>
      </LinearGradient>
    </SafeAreaProvider>
  );
};

const st = StyleSheet.create({
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
  topbarSpacer: {
    width: Math.max(scaleWidth(42), 42),
    height: Math.max(scaleWidth(42), 42),
    flexShrink: 0,
  },
  topbarTitle: {
    flex: 1,
    fontSize: scaleFont(20),
    fontWeight: '800',
    color: DARK,
    textAlign: 'center',
    marginHorizontal: scaleWidth(8),
  },
  listContent: {
    padding: scaleWidth(16),
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: scaleWidth(12),
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: scaleWidth(10),
  },
  cardTitle: {
    fontSize: scaleFont(14),
    fontWeight: '800',
    color: DARK,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: scaleFont(12),
    color: MUTED,
    fontWeight: '600',
    lineHeight: 18,
  },
  patientCard: {
    backgroundColor: WHITE,
    borderRadius: scaleWidth(12),
    padding: scaleWidth(10),
    marginBottom: scaleWidth(10),
    borderWidth: 1,
    borderColor: BORDER,
  },
  pcTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    backgroundColor: DARK,
  },
  pcAvatarTextSmall: {
    color: WHITE,
    fontWeight: '800',
    fontSize: scaleFont(12),
  },
  statusBadgeCorner: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: scaleWidth(18),
    height: scaleWidth(18),
    borderRadius: scaleWidth(9),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: WHITE,
  },
  statusBadgeTextCorner: {
    fontSize: scaleFont(9),
    fontWeight: '900',
  },
  pcInfoCol: {
    flex: 1,
    minWidth: 0,
    gap: scaleWidth(2),
  },
  pcInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(8),
  },
  pcName: {
    flexShrink: 1,
    fontSize: scaleFont(15),
    fontWeight: '800',
    color: DARK,
    minWidth: 0,
  },
  readingDateEnd: {
    flexShrink: 0,
    marginLeft: 'auto',
    fontSize: scaleFont(10),
    color: MUTED,
    fontWeight: '600',
    textAlign: 'right',
    lineHeight: scaleFont(14),
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
    color: DARK,
  },
  pcVitals: {
    flexDirection: 'row',
    gap: scaleWidth(8),
    marginBottom: scaleWidth(8),
  },
  assignedByLine: {
    fontSize: scaleFont(10),
    color: MUTED,
    fontWeight: '600',
    lineHeight: scaleFont(14),
  },
  readingSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scaleWidth(10),
    marginTop: scaleWidth(4),
    marginBottom: scaleWidth(10),
  },
  readingSwitcherCount: {
    minWidth: scaleWidth(48),
    textAlign: 'center',
    fontSize: scaleFont(12),
    fontWeight: '800',
    color: DARK,
  },
  switchBtn: {
    paddingHorizontal: scaleWidth(10),
    paddingVertical: scaleWidth(4),
    borderRadius: scaleWidth(8),
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  switchBtnDisabled: {
    opacity: 0.45,
  },
  switchBtnText: {
    fontSize: scaleFont(11),
    fontWeight: '700',
    color: DARK,
  },
  switchBtnTextDisabled: {
    color: '#94a3b8',
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
  pcVitalSingle: {
    flex: 0,
    width: '100%',
  },
  pvLbl: {
    fontSize: scaleFont(10),
    color: MUTED,
    marginBottom: scaleWidth(3),
    fontWeight: '800',
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
    color: DARK,
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
    color: MUTED,
    lineHeight: scaleFont(12),
    flexShrink: 0,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: scaleWidth(6),
    marginTop: scaleWidth(10),
  },
  actionBtn: {
    flex: 1,
    height: scaleWidth(36),
    borderRadius: scaleWidth(10),
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scaleWidth(4),
  },
  actionBtnPrimary: {
    backgroundColor: DARK,
    borderColor: DARK,
  },
  actionBtnText: {
    fontSize: scaleFont(11),
    fontWeight: '700',
    color: DARK,
  },
  actionBtnPrimaryText: {
    fontSize: scaleFont(11),
    fontWeight: '800',
    color: WHITE,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: scaleFont(16),
    fontWeight: '800',
    color: DARK,
    marginTop: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: MUTED,
    fontSize: scaleFont(13),
    marginTop: 8,
    fontWeight: '600',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: scaleFont(16),
    fontWeight: '800',
    color: DARK,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  modalItemText: {
    fontSize: scaleFont(14),
    fontWeight: '800',
    color: DARK,
  },
  modalItemSubtext: {
    fontSize: scaleFont(11),
    fontWeight: '600',
    color: MUTED,
    marginTop: 2,
  },
});

export default AssignedAbnormalReviewsScreen;
