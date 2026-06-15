/* eslint-disable react-native/no-inline-styles */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { colors } from './config/globall';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useWindowDimensions } from 'react-native';
import apiService from './services/apiService';

const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const NAVY_BLUE = '#293d55';
const RED_ACCENT = colors.secondaryButton || '#FF0000';

// ==================== NOTIFICATION PROCESSING HELPERS ====================

const generateMedicalAlerts = (patientData) => {
  const alerts = [];
  const measurements = patientData?.measurements || {};
  if (measurements.bloodPressure) {
    const bp = measurements.bloodPressure;
    const systolic = bp.systolic || bp.systolic_pressure;
    const diastolic = bp.diastolic || bp.diastolic_pressure;
    if (systolic > 140 || diastolic > 90) {
      alerts.push({ id: `bp-high-${systolic}-${diastolic}`, type: 'Alert', title: 'High Blood Pressure', message: `Your BP reading ${systolic}/${diastolic} mmHg is above normal range.`, date: new Date().toISOString(), read: false, alertType: 'bloodPressure', severity: systolic > 180 || diastolic > 120 ? 'high' : 'medium' });
    } else if (systolic < 90 || diastolic < 60) {
      alerts.push({ id: `bp-low-${systolic}-${diastolic}`, type: 'Alert', title: 'Low Blood Pressure', message: `Your BP reading ${systolic}/${diastolic} mmHg is below normal range.`, date: new Date().toISOString(), read: false, alertType: 'bloodPressure', severity: 'medium' });
    }
  }
  if (measurements.bloodGlucose) {
    const glucose = parseFloat(measurements.bloodGlucose.blood_glucose_value_1 || measurements.bloodGlucose.value || 0);
    if (glucose > 126) alerts.push({ id: `glucose-high-${glucose}`, type: 'Alert', title: 'High Blood Glucose', message: `Your glucose level ${glucose} mg/dL indicates possible diabetes risk.`, date: new Date().toISOString(), read: false, alertType: 'bloodGlucose', severity: 'high' });
    else if (glucose > 0 && glucose < 70) alerts.push({ id: `glucose-low-${glucose}`, type: 'Alert', title: 'Low Blood Glucose', message: `Your glucose level ${glucose} mg/dL is below normal range.`, date: new Date().toISOString(), read: false, alertType: 'bloodGlucose', severity: 'medium' });
  }
  if (measurements.weight) {
    const weight = measurements.weight.value;
    const bmi = (weight / (1.7 * 1.7)).toFixed(1);
    if (bmi > 30) alerts.push({ id: `weight-high-${weight}`, type: 'Alert', title: 'Weight Concern', message: `Your weight indicates obesity risk (BMI: ${bmi}). Consider lifestyle changes.`, date: new Date().toISOString(), read: false, alertType: 'weight', severity: 'medium' });
    else if (bmi < 18.5) alerts.push({ id: `weight-low-${weight}`, type: 'Alert', title: 'Underweight Alert', message: `Your weight indicates underweight condition (BMI: ${bmi}).`, date: new Date().toISOString(), read: false, alertType: 'weight', severity: 'medium' });
  }
  return alerts;
};

const loadSavedNotifications = async () => { try { const d = await AsyncStorage.getItem('notificationsState'); if (d) return JSON.parse(d); } catch (e) {} return null; };
const loadStoredAssessments = async () => { try { const d = await AsyncStorage.getItem('storedAssessments'); if (d) return JSON.parse(d); } catch (e) {} return []; };
const loadSystemNotifications = async () => { try { const d = await AsyncStorage.getItem('systemNotifications'); if (d) return JSON.parse(d); } catch (e) {} return []; };

const processNotifications = async (patientData) => {
  try {
    const storedAssessments = await loadStoredAssessments();
    const systemNotifications = await loadSystemNotifications();
    const savedNotifications = await loadSavedNotifications();
    const newAlerts = patientData ? generateMedicalAlerts(patientData) : [];
    const map = new Map();
    if (savedNotifications?.length > 0) savedNotifications.forEach(n => map.set(n.id, n));
    [...newAlerts, ...storedAssessments, ...systemNotifications].forEach(a => map.set(a.id, map.has(a.id) ? { ...a, read: map.get(a.id).read } : a));
    const now = new Date();
    map.forEach((n, id) => { if ((now - new Date(n.date)) / 86400000 > 30) map.delete(id); });
    const final = Array.from(map.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
    await AsyncStorage.setItem('notificationsState', JSON.stringify(final));
    const unread = final.filter(n => !n.read).length;
    await AsyncStorage.setItem('unreadBadgeCount', unread.toString());
    return unread;
  } catch (e) { return 0; }
};

// ==================== END NOTIFICATION PROCESSING HELPERS ====================

export default function Home({ navigation }) {
  const { width, height } = useWindowDimensions();
  const scaleWidth = size => Math.min((width / guidelineBaseWidth) * size, size * 1.25);
  const scaleHeight = size => Math.min((height / guidelineBaseHeight) * size, size * 1.25);
  const scaleFont = size => Math.min((width / guidelineBaseWidth) * size, size * 1.2);

  const [userName, setUserName] = useState('');
  const [greeting, setGreeting] = useState('Good Morning');
  const [unreadCount, setUnreadCount] = useState(0);
  const [measurements, setMeasurements] = useState({ bloodPressure: null, bloodGlucose: null, weight: null });
  const [practiceRanges, setPracticeRanges] = useState(null);
  const [vitalsStatus, setVitalsStatus] = useState({ bloodPressure: 'normal', bloodGlucose: 'normal', weight: 'normal' });
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  const fetchDebounceTimeoutRef = useRef(null);

  const setTimeBasedGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 17) setGreeting('Good Afternoon');
    else if (hour < 21) setGreeting('Good Evening');
    else setGreeting('Good Night');
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      if (isFetchingRef.current) return;
      const saved = await AsyncStorage.getItem('unreadBadgeCount');
      setUnreadCount(saved !== null ? parseInt(saved, 10) : 0);
    } catch { setUnreadCount(0); }
  }, []);

  const fetchPracticeRanges = useCallback(async (practiceId) => {
    try {
      if (!practiceId) return null;
      const result = await apiService.getPracticeRanges(practiceId);
      if (result?.data) { const r = result.data.ranges || result.data; setPracticeRanges(r); return r; }
      return null;
    } catch { return null; }
  }, []);

  const determineVitalsStatus = useCallback((md, ranges) => {
    const s = { bloodPressure: 'normal', bloodGlucose: 'normal', weight: 'normal' };
    if (!ranges) return s;
    if (md.bloodPressure) {
      const sys = parseFloat(md.bloodPressure.systolic_pressure || md.bloodPressure.systolic);
      const dia = parseFloat(md.bloodPressure.diastolic_pressure || md.bloodPressure.diastolic);
      if (!isNaN(sys) && !isNaN(dia)) {
        const r = ranges.blood_pressure || {};
        if (sys >= (r.high?.systolic?.min || 140) || dia >= (r.high?.diastolic?.min || 90)) s.bloodPressure = 'high';
        else if (sys <= (r.low?.systolic?.max || 90) || dia <= (r.low?.diastolic?.max || 60)) s.bloodPressure = 'low';
      }
    }
    if (md.bloodGlucose) {
      const g = parseFloat(md.bloodGlucose.value || md.bloodGlucose.blood_glucose_value_1);
      if (!isNaN(g) && g > 0) { const r = ranges.blood_glucose || {}; if (g >= (r.high?.min || 126)) s.bloodGlucose = 'high'; else if (g <= (r.low?.max || 70)) s.bloodGlucose = 'low'; }
    }
    if (md.weight) {
      const w = parseFloat(md.weight.value);
      if (!isNaN(w) && w > 0) { const bmi = (w / 2.20462) / (1.7 * 1.7); const r = ranges.weight || {}; if (bmi >= (r.high_bmi?.min || 30)) s.weight = 'high'; else if (bmi <= (r.low_bmi?.max || 18.5)) s.weight = 'low'; }
    }
    return s;
  }, []);

  const getStatusColor = useCallback((status) => {
    switch (status) { case 'high': return '#EF4444'; case 'low': return '#F59E0B'; default: return '#10B981'; }
  }, []);

  const processMeasurementsData = useCallback((lm) => {
    const p = { bloodPressure: null, bloodGlucose: null, weight: null };
    if (!lm) return p;
    if (lm.blood_pressure) { const bp = lm.blood_pressure; p.bloodPressure = { systolic_pressure: bp.systolic_pressure || '--', diastolic_pressure: bp.diastolic_pressure || '--', pulse: bp.pulse || '--', measure_new_date_time: bp.measure_new_date_time || bp.measure_date_time || bp.created_at || 'Recent' }; }
    if (lm.blood_glucose && lm.blood_glucose !== null) { const bg = lm.blood_glucose; const v = bg.blood_glucose_value_1; p.bloodGlucose = { value: v !== null && v !== undefined && v !== '' ? String(v) : '--', measure_new_date_time: bg.measure_new_date_time || bg.measure_date_time || bg.created_at || '--' }; }
    if (lm.weight && lm.weight !== null) { const w = lm.weight; let wv = w.weight !== null && w.weight !== undefined ? w.weight : w.weight_value || null; if (!wv && wv !== 0) { wv = '--'; } else { const n = parseFloat(wv); wv = !isNaN(n) && n > 0 ? (n * 2.20462).toFixed(1) : String(wv); } p.weight = { value: wv, measure_new_date_time: w.measure_new_date_time || w.measure_date_time || w.created_at || '--', unit: 'lb' }; }
    return p;
  }, []);

  const loadCachedData = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem('latestVitals');
      if (cached) {
        const processed = processMeasurementsData(JSON.parse(cached));
        setMeasurements(prev => JSON.stringify(prev) === JSON.stringify(processed) ? prev : processed);
        if (practiceRanges) { const s = determineVitalsStatus(processed, practiceRanges); setVitalsStatus(prev => JSON.stringify(prev) === JSON.stringify(s) ? prev : s); }
        if (processed.bloodPressure || processed.bloodGlucose || processed.weight) setIsLoadingData(false);
      }
    } catch (e) {}
  }, [processMeasurementsData, determineVitalsStatus, practiceRanges]);

  const fetchPatientData = useCallback(async () => {
    if (isFetchingRef.current) return null;
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 5000) return null;
    try { const lf = await AsyncStorage.getItem('lastVitalsFetch'); if (lf && now - parseInt(lf, 10) < 120000 && !measurements.bloodPressure) { await loadCachedData(); return null; } } catch (e) {}
    isFetchingRef.current = true; lastFetchTimeRef.current = now;
    if (!measurements.bloodPressure && !measurements.bloodGlucose && !measurements.weight) setIsLoadingData(true);
    try {
      let practiceId = null, patientId = null;
      const [userData, storedPracticeId, storedPatientId, cachedVitals] = await Promise.all([AsyncStorage.getItem('user'), AsyncStorage.getItem('practiceId'), AsyncStorage.getItem('patientId'), AsyncStorage.getItem('latestVitals')]);
      if (cachedVitals) { const p = processMeasurementsData(JSON.parse(cachedVitals)); setMeasurements(prev => JSON.stringify(prev) === JSON.stringify(p) ? prev : p); if (p.bloodPressure || p.bloodGlucose || p.weight) setIsLoadingData(false); }
      if (userData) { const u = JSON.parse(userData); practiceId = u.practice_id; patientId = u.patients_table_id || u.id || u.user_id; if (patientId && !isNaN(patientId)) await AsyncStorage.setItem('patientId', String(patientId)); }
      if (!practiceId) practiceId = storedPracticeId;
      if (!patientId) { if (storedPatientId && !isNaN(storedPatientId) && storedPatientId !== '') patientId = storedPatientId; else if (storedPatientId && isNaN(storedPatientId)) await AsyncStorage.removeItem('patientId'); }
      if (!practiceId || !patientId) { try { const ur = await apiService.getCurrentUser(); if (ur?.data) { const u = ur.data.user || ur.data; if (u.practice_id) { practiceId = String(u.practice_id); await AsyncStorage.setItem('practiceId', practiceId); } if (u.id) { patientId = String(u.id); await AsyncStorage.setItem('patientId', patientId); } } } catch (e) {} }
      if (!practiceId || !patientId) { isFetchingRef.current = false; return null; }
      let lm = {};
      try {
        const vr = await apiService.getLatestVitals();
        if (vr?.success) { lm = vr.data || {}; if (lm.practice_id) { await AsyncStorage.setItem('practiceId', String(lm.practice_id)); practiceId = String(lm.practice_id); } if (lm.patients_table_id) { await AsyncStorage.setItem('patientId', String(lm.patients_table_id)); patientId = String(lm.patients_table_id); } await AsyncStorage.setItem('latestVitals', JSON.stringify(lm)); }
        else { const dr = await apiService.getPatientDetails(practiceId, patientId); if (dr?.success) lm = (dr.data || dr).latest_measurements || {}; }
      } catch (e) { isFetchingRef.current = false; setIsLoadingData(false); return null; }
      const pm = processMeasurementsData(lm);
      setMeasurements(prev => JSON.stringify(prev) === JSON.stringify(pm) ? prev : pm);
      setIsLoadingData(false);
      const updateStatus = (r) => { const s = determineVitalsStatus(pm, r); setVitalsStatus(prev => JSON.stringify(prev) === JSON.stringify(s) ? prev : s); };
      if (!practiceRanges && practiceId) { const r = await fetchPracticeRanges(practiceId); if (r) updateStatus(r); } else if (practiceRanges) updateStatus(practiceRanges);
      setTimeout(async () => { try { await processNotifications({ measurements: pm, practiceId }); await fetchUnreadCount(); } catch (e) {} }, 0);
      isFetchingRef.current = false;
      return { measurements: pm, practiceId };
    } catch (e) { isFetchingRef.current = false; return null; }
  }, [fetchPracticeRanges, determineVitalsStatus, fetchUnreadCount, practiceRanges, processMeasurementsData]);

  const debouncedFetchPatientData = useCallback(async () => {
    if (fetchDebounceTimeoutRef.current) clearTimeout(fetchDebounceTimeoutRef.current);
    fetchDebounceTimeoutRef.current = setTimeout(() => fetchPatientData(), 300);
  }, [fetchPatientData]);

  useEffect(() => {
    const init = async () => {
      try {
        setTimeBasedGreeting();
        const ud = await AsyncStorage.getItem('user');
        if (ud) { const p = JSON.parse(ud); setUserName(p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.name || p.username || ''); }
        await loadCachedData(); await fetchUnreadCount(); debouncedFetchPatientData();
      } catch (e) {}
    };
    init();
    return () => { if (fetchDebounceTimeoutRef.current) clearTimeout(fetchDebounceTimeoutRef.current); };
  }, [setTimeBasedGreeting, debouncedFetchPatientData, loadCachedData, fetchUnreadCount]);

  useFocusEffect(React.useCallback(() => {
    const loadData = async () => {
      try {
        setTimeBasedGreeting();
        const u = await AsyncStorage.getItem('user');
        if (u) { const p = JSON.parse(u); setUserName(p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.name || p.username || ''); }
        await loadCachedData(); await fetchUnreadCount(); debouncedFetchPatientData();
      } catch (e) {}
    };
    loadData();
    const v = setInterval(() => debouncedFetchPatientData(), 30000);
    const b = setInterval(() => fetchUnreadCount(), 15000);
    return () => { clearInterval(v); clearInterval(b); if (fetchDebounceTimeoutRef.current) clearTimeout(fetchDebounceTimeoutRef.current); };
  }, [setTimeBasedGreeting, debouncedFetchPatientData, fetchUnreadCount, loadCachedData]));

  const openList = (type) => navigation.navigate('DataList', { dataType: type });
  const openNotifications = () => navigation.navigate('Notifications');

  const formatDateTime = useCallback((dt) => {
    if (!dt || dt === '--' || dt === 'Recent') return 'Recent';
    try { const d = new Date(dt); if (isNaN(d.getTime())) return dt; return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).replace(',', ' ·'); } catch { return dt; }
  }, []);

  const getFormattedDate = () => new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' });

  const categories = [
    { type: 'bloodPressure', title: 'Blood Pressure', unit: 'mmHg', data: measurements.bloodPressure },
    { type: 'bloodGlucose', title: 'Blood Glucose', unit: 'mg/dl', data: measurements.bloodGlucose },
    { type: 'weight', title: 'Weight', unit: 'lb', data: measurements.weight },
  ];

  const st = styles(scaleWidth, scaleHeight, scaleFont);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F7F9" />
      <SafeAreaView style={st.root} edges={['top']}>

        {/* HEADER */}
        <View style={st.headerContainer}>
          <View style={st.headerTopRow}>
            <TouchableOpacity style={st.profileIconBg} 
            // onPress={() => navigation.navigate('Profile')}
            >
              <Image source={require('./android/app/src/assets/images/user.png')} style={st.profileIcon} />
            </TouchableOpacity>
            <TouchableOpacity style={st.notificationButtonBg} onPress={openNotifications}>
              <Image source={require('./android/app/src/assets/images/bell.png')} style={st.notificationImageDark} />
              {unreadCount > 0 && (
                <View style={st.notificationBadge}>
                  <Text style={st.notificationBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          <Text style={st.dateText}>{getFormattedDate()}</Text>
          <Text style={st.greetingTextDark} numberOfLines={1}>Hi, {userName || 'User'}</Text>
        </View>

        {/* CATEGORY LABEL */}
        <Text style={st.sectionTitle}>Category</Text>

        {/*
          KEY FIX: carouselWrapper has flex:1
          This makes the carousel GROW to fill all available space
          between the header above and the Quick Access below.
          The card inside also uses flex:1 to fill the wrapper.
          Result: no empty gap anywhere — the card fills it.
        */}
        <View style={st.carouselWrapper}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            style={{ flex: 1 }}
            onScroll={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / width);
              setActiveCardIndex(index);
            }}
          >
            {categories.map((cat) => {
              const hasData = cat.data !== null && cat.data !== undefined;
              let msVal = '--', subVal = null;
              if (hasData) {
                if (cat.type === 'bloodPressure') {
                  msVal = `${cat.data.systolic_pressure ?? '--'}/${cat.data.diastolic_pressure ?? '--'}`;
                  subVal = `Pulse Rate: ${cat.data.pulse || '--'} bpm`;
                } else {
                  msVal = cat.data.value || '--';
                }
              }
              return (
                <View key={cat.type} style={{ width, flex: 1, paddingHorizontal: scaleWidth(20) }}>
                  <View style={st.categoryCard}>
                    <Text style={st.cardTitleNew}>{cat.title}</Text>
                    <View style={st.cardValueRow}>
                      <Text style={st.cardMainValueNew} adjustsFontSizeToFit numberOfLines={1}>{msVal}</Text>
                      <Text style={st.cardUnitTextNew}> {cat.unit}</Text>
                    </View>
                    {subVal ? <Text style={st.cardSubValue}>{subVal}</Text> : null}
                    <Text style={st.cardLastDateNew}>
                      Last: {hasData ? formatDateTime(cat.data.measure_new_date_time) : 'No data available'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* PAGINATION DOTS inside carousel wrapper */}
          <View style={st.paginationDots}>
            {categories.map((_, i) => (
              <View key={i} style={[st.dot, activeCardIndex === i && st.activeDot]} />
            ))}
          </View>
        </View>

        {/* QUICK ACCESS — sits naturally below the flex:1 carousel */}
        <View style={st.quickAccessSection}>
          <Text style={st.sectionTitleQa}>Quick Access</Text>
          <View style={st.quickAccessRow}>
            <TouchableOpacity style={st.qaCard} onPress={() => openList('bloodPressure')}>
              <View style={st.qaIconBg}>
                <Image source={require('./android/app/src/assets/images/technology.png')} style={st.qaIcon} resizeMode="contain" />
              </View>
              <Text style={st.qaText}>Blood Pressure</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.qaCard} onPress={() => openList('bloodGlucose')}>
              <View style={st.qaIconBg}>
                <Image source={require('./android/app/src/assets/images/sugar-blood-level.png')} style={st.qaIcon} resizeMode="contain" />
              </View>
              <Text style={st.qaText}>Blood Glucose</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.qaCard} onPress={() => openList('weight')}>
              <View style={st.qaIconBg}>
                <Image source={require('./android/app/src/assets/images/scale.png')} style={st.qaIcon} resizeMode="contain" />
              </View>
              <Text style={st.qaText}>Weight</Text>
            </TouchableOpacity>
          </View>
        </View>

      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// ==================== STYLES ====================
const styles = (scaleWidth, scaleHeight, scaleFont) => StyleSheet.create({

  // flex:1 column — header + carouselWrapper(flex:1) + quickAccess stack vertically
  // edges={['top']} on SafeAreaView means NO bottom padding added automatically
  root: {
    flex: 1,
    backgroundColor: '#F4F7F9',
  },

  headerContainer: {
    paddingTop: scaleHeight(16),
    paddingHorizontal: scaleWidth(20),
    paddingBottom: scaleHeight(8),
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scaleHeight(12),
  },
  profileIconBg: {
    backgroundColor: NAVY_BLUE,
    width: scaleWidth(46),
    height: scaleWidth(46),
    borderRadius: scaleWidth(23),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  profileIcon: { width: scaleWidth(22), height: scaleWidth(22), tintColor: '#FFFFFF' },
  notificationButtonBg: {
    backgroundColor: NAVY_BLUE,
    width: scaleWidth(46),
    height: scaleWidth(46),
    borderRadius: scaleWidth(23),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  notificationImageDark: { width: scaleWidth(24), height: scaleWidth(24), tintColor: '#FFFFFF' },
  notificationBadge: {
    position: 'absolute',
    right: scaleWidth(-4),
    top: scaleHeight(-4),
    backgroundColor: '#EF4444',
    borderRadius: scaleWidth(10),
    minWidth: scaleWidth(18),
    height: scaleWidth(18),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: NAVY_BLUE,
    paddingHorizontal: scaleWidth(3),
  },
  notificationBadgeText: { color: '#FFFFFF', fontSize: scaleFont(10), fontWeight: '700', textAlign: 'center', lineHeight: scaleFont(12) },
  dateText: { fontSize: scaleFont(15), color: '#707070', marginBottom: scaleHeight(4) },
  greetingTextDark: { fontSize: scaleFont(26), fontWeight: '800', color: '#0A1C30' },

  sectionTitle: {
    fontSize: scaleFont(20),
    fontWeight: '800',
    color: '#0A1C30',
    paddingHorizontal: scaleWidth(20),
    marginTop: scaleHeight(14),
    marginBottom: scaleHeight(12),
  },

  // THIS IS THE KEY: flex:1 makes carousel fill all remaining space
  carouselWrapper: {
    flex: 1,
    width: '100%',
  },

  // card also flex:1 so it stretches inside the wrapper
  categoryCard: {
    flex: 1,
    backgroundColor: '#E2E6EC',
    borderRadius: scaleWidth(16),
    paddingHorizontal: scaleWidth(24),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleNew: { fontSize: scaleFont(20), fontWeight: '800', color: '#0A1C30', marginBottom: scaleHeight(10), textAlign: 'center' },
  cardValueRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: scaleHeight(6) },
  cardMainValueNew: { fontSize: scaleFont(34), fontWeight: '800', color: '#0B1C2A', flexShrink: 1 },
  cardUnitTextNew: { fontSize: scaleFont(15), fontWeight: '600', color: '#707070', marginLeft: scaleWidth(4) },
  cardSubValue: { fontSize: scaleFont(13), fontWeight: '600', color: '#707070', marginBottom: scaleHeight(10), textAlign: 'center' },
  cardLastDateNew: { fontSize: scaleFont(12), color: '#707070', fontStyle: 'italic', textAlign: 'center' },

  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: scaleHeight(12),
  },
  dot: { width: scaleWidth(8), height: scaleWidth(8), borderRadius: scaleWidth(4), backgroundColor: '#AEB8C1', marginHorizontal: scaleWidth(4) },
  activeDot: { backgroundColor: NAVY_BLUE, width: scaleWidth(10), height: scaleWidth(10), borderRadius: scaleWidth(5) },

  // Quick Access sits naturally at the bottom — no flex, no absolute
  quickAccessSection: {
    paddingBottom: scaleHeight(16),
  },
  sectionTitleQa: {
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: '#0A1C30',
    paddingHorizontal: scaleWidth(20),
    marginBottom: scaleHeight(10),
  },
  quickAccessRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: scaleWidth(20),
  },
  qaCard: {
    flex: 1,
    marginHorizontal: scaleWidth(5),
    backgroundColor: '#E2E6EC',
    borderRadius: scaleWidth(12),
    paddingVertical: scaleHeight(14),
    paddingHorizontal: scaleWidth(8),
    alignItems: 'center',
  },
  qaIconBg: {
    width: scaleWidth(52),
    height: scaleWidth(52),
    borderRadius: scaleWidth(26),
    backgroundColor: NAVY_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: scaleHeight(8),
  },
  qaIcon: { width: scaleWidth(28), height: scaleWidth(28), tintColor: '#FFFFFF' },
  qaText: { fontSize: scaleFont(11), fontWeight: '600', color: '#0A1C30', textAlign: 'center' },
});