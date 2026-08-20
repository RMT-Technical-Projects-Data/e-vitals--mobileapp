/* LookupPatient.js — Patient Lookup Screen with Web-matched Filters & Patient List Cards */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../services/apiService';
import DatePickerModal from '../../components/common/DatePickerModal';

const { width } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const scaleWidth = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.25);
const scaleFont = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.2);

const DARK = '#0b1f3f';
const MUTED = '#687382';
const BORDER = '#e8ecf0';
const WHITE = '#ffffff';

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

const DOB_OPERATORS = [
  { value: '', label: '-- Select DOB Operator --' },
  { value: 'on', label: 'On' },
  { value: 'onOrBefore', label: 'On or before' },
  { value: 'onOrAfter', label: 'On or after' },
  { value: 'between', label: 'Between' },
];

const STATUS_OPTIONS = [
  { value: '', label: '-- All Statuses --' },
  { value: '2', label: 'Active' },
  { value: '3', label: 'Pending' },
  { value: '4', label: 'Locked' },
];

const VITALS_OPTIONS = [
  { value: '1', label: 'Blood Pressure (BP)' },
  { value: '2', label: 'Blood Glucose (BG)' },
  { value: '3', label: 'Weight (WT)' },
];

const emptyFilters = () => ({
  lastName: '',
  firstName: '',
  phone: '',
  caregiver: '',
  provider: '',
  status: '',
  vitals: [],
  rpmStartDate: '',
  rpmEndDate: '',
  dobOperator: '',
  dobFrom: '',
  dobTo: '',
});

/* Helper Functions for Vitals & Patient Display matching PatientsScreen.js */
const toCleanNum = (val) => {
  if (val == null) return null;
  const cleaned = String(val).replace(/[^\d.-]/g, '');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
};

const getVitalColor = (value, min, max) => {
  if (value == null || value === '' || value === '--' || value === 'N/A') return '#0b1f3f';
  const num = Number(value);
  if (Number.isNaN(num) || num <= 0) return '#0b1f3f';
  if (num > max) return '#d32f2f'; // High / Abnormal (Red)
  if (num < min) return '#C53030'; // Low / Warning (Orange)
  return '#0b1f3f'; // Normal (Green)
};

const getBpVitalColor = (bpString) => {
  if (!bpString || bpString === '--' || bpString === 'N/A') return '#0b1f3f';
  const parts = String(bpString).split('/');
  if (parts.length !== 2) return '#0b1f3f';
  const sys = Number(parts[0].trim());
  const dia = Number(parts[1].trim());
  const sysColor = getVitalColor(sys, VITAL_TARGETS.systolicMin, VITAL_TARGETS.systolicMax);
  const diaColor = getVitalColor(dia, VITAL_TARGETS.diastolicMin, VITAL_TARGETS.diastolicMax);
  if (sysColor === '#d32f2f' || diaColor === '#d32f2f') return '#d32f2f';
  if (sysColor === '#C53030' || diaColor === '#C53030') return '#C53030';
  return '#0b1f3f';
};

const getPatientStatusMeta = (status) => {
  const raw = String(status ?? '').trim().toLowerCase();
  if (raw === '2' || raw === 'active') return { letter: 'A', bg: '#DDF8DD', color: '#0b1f3f' };
  if (raw === '3' || raw === 'pending') return { letter: 'P', bg: '#caf0f8', color: '#1177c6' };
  if (raw === '4' || raw === 'locked') return { letter: 'L', bg: '#FDE8E8', color: '#d32f2f' };
  return { letter: 'A', bg: '#DDF8DD', color: '#0b1f3f' };
};

const getPatientVitalsDisplay = (item) => {
  const latest = item.latest_measurements || {};
  const bpObj = latest.blood_pressure || item.blood_pressure || null;
  const bgObj = latest.blood_glucose || item.blood_glucose || null;
  const wtObj = latest.weight || item.weight_measurement || null;
  const summary = String(item.data_summary || item.vitals || '').trim();
  const hasBp = /\d+\s*\/\s*\d+/.test(summary);

  const systolic = toCleanNum(bpObj?.systolic_pressure ?? bpObj?.systolic ?? item.last_systolic ?? item.systolic);
  const diastolic = toCleanNum(bpObj?.diastolic_pressure ?? bpObj?.diastolic ?? item.last_diastolic ?? item.diastolic);
  let pulse = toCleanNum(bpObj?.pulse ?? item.last_pulse ?? item.pulse);
  let bp = (systolic != null && diastolic != null)
    ? `${Math.round(systolic)}/${Math.round(diastolic)}`
    : '--';
  let glucose = bgObj
    ? String(Math.round(bgObj.blood_glucose_value_1 || bgObj.value || 0))
    : (item.last_glucose ?? item.glucose ? String(Math.round(item.last_glucose ?? item.glucose)) : '--');
  
  let rawWt = wtObj
    ? (wtObj.weight || wtObj.weight_value || wtObj.value)
    : (item.last_weight ?? item.weight);
  let weightNum = toCleanNum(rawWt);
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
        pulse = toCleanNum(pulseMatch[1]);
      }
    }
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

const getPatientVitalPills = (item) => {
  const rawVitals = item.vitals || item.measurement_types || '';
  let list = [];
  if (Array.isArray(rawVitals)) {
    list = rawVitals.map((v) => String(v).trim()).filter(Boolean);
  } else if (typeof rawVitals === 'string' && rawVitals.trim().length > 0 && !rawVitals.includes('/')) {
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

/* Modal Dropdown Component for Clean Selection */
const SelectModal = ({ visible, title, options, selectedValue, onSelect, onClose, isMulti = false }) => {
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={st.modalContent} onStartShouldSetResponder={() => true}>
          <View style={st.modalHeader}>
            <Text style={st.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={st.modalCloseBtn}>
              <MaterialIcons name="close" size={20} color={DARK} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
            {options.map((item) => {
              const isSelected = isMulti
                ? Array.isArray(selectedValue) && selectedValue.includes(item.value)
                : selectedValue === item.value;
              return (
                <TouchableOpacity
                  key={String(item.value || 'empty')}
                  style={[st.modalItem, isSelected && st.modalItemSelected]}
                  onPress={() => {
                    onSelect(item.value);
                    if (!isMulti) onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[st.modalItemText, isSelected && st.modalItemTextSelected]}>
                    {item.label}
                  </Text>
                  {isMulti ? (
                    <MaterialIcons
                      name={isSelected ? 'check-box' : 'check-box-outline-blank'}
                      size={20}
                      color={isSelected ? DARK : MUTED}
                    />
                  ) : isSelected ? (
                    <MaterialIcons name="check" size={20} color={DARK} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export default function LookupPatient({ navigation }) {
  const [practiceId, setPracticeId] = useState(null);
  const [filters, setFilters] = useState(emptyFilters());
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);

  // Modal selector states
  const [activeModal, setActiveModal] = useState(null); // 'status' | 'caregiver' | 'provider' | 'vitals' | 'dobOperator'
  const [showDatePicker, setShowDatePicker] = useState(null); // 'rpmStart' | 'rpmEnd' | 'dobFrom' | 'dobTo'

  // Care team dropdown lists
  const [caregivers, setCaregivers] = useState([]);
  const [providers, setProviders] = useState([]);

  // Load practice ID & fetch caregivers/providers across patient roster
  useEffect(() => {
    (async () => {
      let pId = await AsyncStorage.getItem('practiceId');
      if (!pId) {
        const userStr = await AsyncStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          pId = user.practice_id;
        }
      }
      if (pId) {
        setPracticeId(String(pId));
        try {
          const [providersRes, caregiversRes] = await Promise.all([
            apiService.getPracticeProviders(pId).catch(() => null),
            apiService.getPracticeCaregivers(pId).catch(() => null),
          ]);

          // Process Providers matching Web LookupPatient.jsx
          let providersData = providersRes?.data?.data?.providers || providersRes?.data?.providers || providersRes?.data?.data || providersRes?.data || [];
          if (!Array.isArray(providersData)) providersData = [];

          const uniqueProviders = providersData
            .filter((p, index, self) => p && index === self.findIndex((item) => item && (item.id != null && p.id != null ? item.id === p.id : item.name === p.name)))
            .map((p) => {
              const name = p.name || p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username || `Provider #${p.id}`;
              return { value: String(p.id || name), label: name.trim() };
            });

          // Process Caregivers matching Web LookupPatient.jsx
          let caregiversData = caregiversRes?.data?.data?.caregivers || caregiversRes?.data?.caregivers || caregiversRes?.data?.data || caregiversRes?.data || [];
          if (!Array.isArray(caregiversData)) caregiversData = [];

          const uniqueCaregivers = caregiversData
            .filter((c, index, self) => c && index === self.findIndex((item) => item && (item.id != null && c.id != null ? item.id === c.id : item.name === c.name)))
            .map((c) => {
              const name = c.name || c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.username || `Caregiver #${c.id}`;
              return { value: String(c.id || name), label: name.trim() };
            });

          if (uniqueProviders.length > 0) {
            setProviders(uniqueProviders);
          }
          if (uniqueCaregivers.length > 0) {
            setCaregivers(uniqueCaregivers);
          }

          // Fallback only if endpoints return no items
          if (uniqueProviders.length === 0 || uniqueCaregivers.length === 0) {
            const patientsRes = await apiService.getPatients(pId, { limit: 500 }).catch(() => null);
            const list = patientsRes?.data?.patients || patientsRes?.data || [];
            if (Array.isArray(list)) {
              const fallbackCg = new Map();
              const fallbackPv = new Map();
              list.forEach((p) => {
                const pvName = p.provider && typeof p.provider === 'string' && p.provider !== '-'
                  ? p.provider
                  : (p.provider_first_name ? `${p.provider_first_name} ${p.provider_last_name || ''}`.trim() : '');
                if (pvName && !fallbackPv.has(pvName)) {
                  fallbackPv.set(pvName, { value: String(p.provider_id || p.providerId || pvName), label: pvName });
                }

                const cgName = typeof p.caregiver === 'string' && p.caregiver !== '-'
                  ? p.caregiver
                  : (p.caregiver_first_name ? `${p.caregiver_first_name} ${p.caregiver_last_name || ''}`.trim() : '');
                if (cgName && !fallbackCg.has(cgName)) {
                  fallbackCg.set(cgName, { value: String(p.caregiver_id || p.caregiverId || cgName), label: cgName });
                }
              });

              if (uniqueProviders.length === 0 && fallbackPv.size > 0) {
                setProviders(Array.from(fallbackPv.values()));
              }
              if (uniqueCaregivers.length === 0 && fallbackCg.size > 0) {
                setCaregivers(Array.from(fallbackCg.values()));
              }
            }
          }
        } catch (e) {
          console.warn('Could not load care team list:', e);
        }
      }
    })();
  }, []);

  const handleQuery = useCallback(async () => {
    if (!practiceId) return;
    setLoading(true);
    setHasQueried(true);
    try {
      let data = [];
      if (filters.rpmStartDate || filters.rpmEndDate) {
        const res = await apiService.lookupPatientRPM(practiceId, {
          startDate: filters.rpmStartDate || undefined,
          endDate: filters.rpmEndDate || undefined,
          limit: 500,
        });
        data = res?.data?.patients || res?.data?.data || res?.data || [];
      } else {
        const res = await apiService.lookupPatient(practiceId, {
          ...filters,
          vitals: filters.vitals.join(','),
          limit: 500,
        });
        data = res?.data?.patients || res?.data?.data || res?.data || [];
      }
      setPatients(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Error querying patients:', err);
      try {
        const fallbackRes = await apiService.getPatients(practiceId, {
          search: filters.lastName || filters.firstName || undefined,
          status: filters.status || undefined,
          caregiverId: filters.caregiver || undefined,
          providerId: filters.provider || undefined,
          limit: 500,
        });
        const list = fallbackRes?.data?.patients || fallbackRes?.data || [];
        setPatients(Array.isArray(list) ? list : []);
      } catch (e) {
        setPatients([]);
      }
    } finally {
      setLoading(false);
    }
  }, [practiceId, filters]);

  const handleReset = () => {
    setFilters(emptyFilters());
    setPatients([]);
    setHasQueried(false);
  };

  const toggleVital = (id) => {
    setFilters((prev) => {
      const vitals = prev.vitals.includes(id)
        ? prev.vitals.filter((v) => v !== id)
        : [...prev.vitals, id];
      return { ...prev, vitals };
    });
  };

  // Helper to extract patient name parts cleanly
  const getPatientNameParts = (p) => {
    let first = p.first_name || p.firstName || '';
    let last = p.last_name || p.lastName || '';
    if (!first && !last && p.patientName) {
      if (p.patientName.includes(',')) {
        const parts = p.patientName.split(',');
        last = (parts[0] || '').trim();
        first = (parts[1] || '').trim();
      } else {
        const parts = p.patientName.split(' ');
        first = (parts[0] || '').trim();
        last = (parts.slice(1).join(' ') || '').trim();
      }
    }
    const fullName = `${first} ${last}`.trim() || 'Patient #' + (p.id || p.patient_table_id || '');
    return { firstName: first, lastName: last, fullName };
  };

  // Filter returned list by live search term
  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return patients;
    const q = searchQuery.toLowerCase().trim();
    return patients.filter((p) => {
      const { fullName } = getPatientNameParts(p);
      const phone = String(p.phone || p.phone_number || p.cell_phone_number || '').toLowerCase();
      const ssn = String(p.ssn || '').toLowerCase();
      return fullName.toLowerCase().includes(q) || phone.includes(q) || ssn.includes(q);
    });
  }, [patients, searchQuery]);

  // Label display helpers for dropdown triggers
  const getStatusLabel = () => {
    const found = STATUS_OPTIONS.find((s) => s.value === filters.status);
    return found ? found.label : '-- All Statuses --';
  };

  const getCaregiverLabel = () => {
    const found = caregivers.find((c) => c.value === filters.caregiver);
    return found ? found.label : '-- All Caregivers --';
  };

  const getProviderLabel = () => {
    const found = providers.find((p) => p.value === filters.provider);
    return found ? found.label : '-- All Providers --';
  };

  const getVitalsLabel = () => {
    if (!filters.vitals || filters.vitals.length === 0) return '-- All Vitals --';
    const labels = filters.vitals
      .map((id) => {
        const found = VITALS_OPTIONS.find((v) => v.value === id);
        return found ? found.label.split(' ')[0] : '';
      })
      .filter(Boolean);
    return labels.join(', ');
  };

  const getDobOperatorLabel = () => {
    const found = DOB_OPERATORS.find((d) => d.value === filters.dobOperator);
    return found ? found.label : '-- Select DOB Operator --';
  };

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Top Header */}
      <View style={st.header}>
        <TouchableOpacity style={st.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={22} color={DARK} />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Look up Patient</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Filter Card */}
        <View style={st.card}>
          <TouchableOpacity
            style={st.cardHeader}
            onPress={() => setIsFilterExpanded(!isFilterExpanded)}
            activeOpacity={0.8}
          >
            <View style={st.cardHeaderLeft}>
              <MaterialIcons name="filter-list" size={20} color={DARK} />
              <Text style={st.cardTitle}>Filter Patients</Text>
            </View>
            <MaterialIcons
              name={isFilterExpanded ? 'expand-less' : 'expand-more'}
              size={22}
              color={MUTED}
            />
          </TouchableOpacity>

          {isFilterExpanded && (
            <View style={st.formContainer}>
              {/* Row 1: First Name & Last Name */}
              <View style={st.row}>
                <View style={st.fieldCol}>
                  <Text style={st.label}>Last Name</Text>
                  <TextInput
                    style={st.input}
                    value={filters.lastName}
                    onChangeText={(val) => setFilters((p) => ({ ...p, lastName: val }))}
                    placeholder="Enter last name"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View style={st.fieldCol}>
                  <Text style={st.label}>First Name</Text>
                  <TextInput
                    style={st.input}
                    value={filters.firstName}
                    onChangeText={(val) => setFilters((p) => ({ ...p, firstName: val }))}
                    placeholder="Enter first name"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              {/* Row 2: Phone Number & Status Dropdown */}
              <View style={st.row}>
                <View style={st.fieldCol}>
                  <Text style={st.label}>Phone Number</Text>
                  <TextInput
                    style={st.input}
                    value={filters.phone}
                    onChangeText={(val) => setFilters((p) => ({ ...p, phone: val }))}
                    placeholder="(000) 000-0000"
                    placeholderTextColor="#94a3b8"
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={st.fieldCol}>
                  <Text style={st.label}>Status</Text>
                  <TouchableOpacity
                    style={st.dropdownTrigger}
                    onPress={() => setActiveModal('status')}
                    activeOpacity={0.75}
                  >
                    <Text style={[st.dropdownTriggerText, !filters.status && { color: MUTED }]} numberOfLines={1}>
                      {getStatusLabel()}
                    </Text>
                    <MaterialIcons name="arrow-drop-down" size={22} color={MUTED} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Row 3: Caregiver & Provider Dropdowns */}
              <View style={st.row}>
                <View style={st.fieldCol}>
                  <Text style={st.label}>Caregiver</Text>
                  <TouchableOpacity
                    style={st.dropdownTrigger}
                    onPress={() => setActiveModal('caregiver')}
                    activeOpacity={0.75}
                  >
                    <Text style={[st.dropdownTriggerText, !filters.caregiver && { color: MUTED }]} numberOfLines={1}>
                      {getCaregiverLabel()}
                    </Text>
                    <MaterialIcons name="arrow-drop-down" size={22} color={MUTED} />
                  </TouchableOpacity>
                </View>

                <View style={st.fieldCol}>
                  <Text style={st.label}>Provider</Text>
                  <TouchableOpacity
                    style={st.dropdownTrigger}
                    onPress={() => setActiveModal('provider')}
                    activeOpacity={0.75}
                  >
                    <Text style={[st.dropdownTriggerText, !filters.provider && { color: MUTED }]} numberOfLines={1}>
                      {getProviderLabel()}
                    </Text>
                    <MaterialIcons name="arrow-drop-down" size={22} color={MUTED} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Row 4: Vitals Dropdown */}
              <View style={st.fieldFull}>
                <Text style={st.label}>Vitals Filter</Text>
                <TouchableOpacity
                  style={st.dropdownTrigger}
                  onPress={() => setActiveModal('vitals')}
                  activeOpacity={0.75}
                >
                  <Text style={[st.dropdownTriggerText, filters.vitals.length === 0 && { color: MUTED }]} numberOfLines={1}>
                    {getVitalsLabel()}
                  </Text>
                  <MaterialIcons name="arrow-drop-down" size={22} color={MUTED} />
                </TouchableOpacity>
              </View>

              {/* Row 5: RPM Start Date Range */}
              <View style={st.fieldFull}>
                <Text style={st.label}>RPM Start Date Range</Text>
                <View style={st.row}>
                  <TouchableOpacity
                    style={[st.dateBtn, st.fieldCol]}
                    onPress={() => setShowDatePicker('rpmStart')}
                  >
                    <Text style={st.dateBtnText}>{filters.rpmStartDate || 'Start Date'}</Text>
                    <MaterialIcons name="event" size={18} color={DARK} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[st.dateBtn, st.fieldCol]}
                    onPress={() => setShowDatePicker('rpmEnd')}
                  >
                    <Text style={st.dateBtnText}>{filters.rpmEndDate || 'End Date'}</Text>
                    <MaterialIcons name="event" size={18} color={DARK} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Row 6: DOB Operator & Dates */}
              <View style={st.fieldFull}>
                <Text style={st.label}>Date of Birth (DOB)</Text>
                <TouchableOpacity
                  style={st.dropdownTrigger}
                  onPress={() => setActiveModal('dobOperator')}
                  activeOpacity={0.75}
                >
                  <Text style={[st.dropdownTriggerText, !filters.dobOperator && { color: MUTED }]} numberOfLines={1}>
                    {getDobOperatorLabel()}
                  </Text>
                  <MaterialIcons name="arrow-drop-down" size={22} color={MUTED} />
                </TouchableOpacity>
              </View>

              {!!filters.dobOperator && (
                <View style={st.row}>
                  <TouchableOpacity
                    style={[st.dateBtn, st.fieldCol]}
                    onPress={() => setShowDatePicker('dobFrom')}
                  >
                    <Text style={st.dateBtnText}>{filters.dobFrom || 'DOB From'}</Text>
                    <MaterialIcons name="event" size={18} color={DARK} />
                  </TouchableOpacity>
                  {filters.dobOperator === 'between' && (
                    <TouchableOpacity
                      style={[st.dateBtn, st.fieldCol]}
                      onPress={() => setShowDatePicker('dobTo')}
                    >
                      <Text style={st.dateBtnText}>{filters.dobTo || 'DOB To'}</Text>
                      <MaterialIcons name="event" size={18} color={DARK} />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Action Buttons: Reset & Query */}
              <View style={st.btnRow}>
                <TouchableOpacity style={st.resetBtn} onPress={handleReset}>
                  <Text style={st.resetBtnText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.queryBtn} onPress={handleQuery}>
                  <Text style={st.queryBtnText}>Query</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Results Section */}
        {hasQueried && (
          <View style={st.resultsCardContainer}>
            <View style={st.resultsHeader}>
              <Text style={st.resultsTitle}>Query Results ({filteredPatients.length})</Text>
              <TextInput
                style={st.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search..."
                placeholderTextColor="#94a3b8"
              />
            </View>

            {loading ? (
              <ActivityIndicator size="large" color={DARK} style={{ marginVertical: 30 }} />
            ) : filteredPatients.length === 0 ? (
              <Text style={st.emptyText}>No patients match the selected criteria.</Text>
            ) : (
              filteredPatients.map((item) => {
                const { firstName, lastName, fullName } = getPatientNameParts(item);
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
                const weightColor = weightNum != null ? getVitalColor(weightNum, VITAL_TARGETS.weightMin, VITAL_TARGETS.weightMax) : '#0b1f3f';

                return (
                  <TouchableOpacity
                    key={String(item.id || item.patient_table_id || Math.random())}
                    style={st.patientCard}
                    onPress={() => navigation.navigate('PatientHub', {
                      patientId: item.patient_table_id || item.id,
                      practiceId: practiceId || item.practice_id,
                      patientName: fullName,
                    })}
                    activeOpacity={0.85}
                  >
                    <View style={st.pcTop}>
                      {/* Avatar with status badge overlay */}
                      <View style={st.avatarWrap}>
                        <View style={st.pcAvatarSmall}>
                          <Text style={st.pcAvatarTextSmall}>
                            {firstName?.[0] || fullName?.[0] || 'P'}
                            {lastName?.[0] || ''}
                          </Text>
                        </View>
                        <View style={[st.statusBadgeCorner, { backgroundColor: statusMeta.bg }]}>
                          <Text style={[st.statusBadgeTextCorner, { color: statusMeta.color }]}>
                            {statusMeta.letter}
                          </Text>
                        </View>
                      </View>

                      {/* Name + Vital Pills */}
                      <View style={st.pcInfo}>
                        <Text style={st.pcName} numberOfLines={1}>{fullName}</Text>
                        <View style={st.vitalsPillRow}>
                          {vitalPills.map((pill, idx) => (
                            <View key={idx} style={st.inlineVitalPill}>
                              <Text style={st.inlineVitalPillText}>{pill}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                      <MaterialIcons name="chevron-right" size={24} color={DARK} />
                    </View>

                    {/* Vitals Values Box */}
                    <View style={st.pcVitals}>
                      <View style={st.pcVital}>
                        <Text style={st.pvLbl}>BP (mmHg)</Text>
                        <View style={st.pvValueRow}>
                          <Text style={[st.pvVal, { color: bpColor }]} numberOfLines={1}>
                            {vitals.bp}
                          </Text>
                          {vitals.pulse != null ? (
                            <Text style={[st.pvPulse, { color: pulseColor }]} numberOfLines={1}>
                              {' '}P{vitals.pulse}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={st.pcVital}>
                        <Text style={st.pvLbl}>BG (mg/dL)</Text>
                        <Text style={[st.pvVal, { color: glucoseColor }]} numberOfLines={1}>
                          {vitals.glucose}
                        </Text>
                      </View>
                      <View style={st.pcVital}>
                        <Text style={st.pvLbl}>WT (lbs)</Text>
                        <Text style={[st.pvVal, { color: weightColor }]} numberOfLines={1}>
                          {vitals.weight}
                        </Text>
                      </View>
                    </View>

                    {/* Additional Stats Row */}
                    <View style={st.pcExtraStatsRow}>
                      <View style={st.pcExtraStatItem}>
                        <MaterialIcons name="assessment" size={14} color="#687382" />
                        <Text style={st.pcExtraStatLabel}>Readings:</Text>
                        <Text style={st.pcExtraStatValue}>{vitals.readingsCount}</Text>
                      </View>
                      <View style={st.pcExtraStatItem}>
                        <MaterialIcons name="schedule" size={14} color="#687382" />
                        <Text style={st.pcExtraStatLabel}>Service Time:</Text>
                        <Text style={st.pcExtraStatValue}>{vitals.serviceTime} min</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* Select Modals */}
      <SelectModal
        visible={activeModal === 'status'}
        title="Select Status"
        options={STATUS_OPTIONS}
        selectedValue={filters.status}
        onSelect={(val) => setFilters((p) => ({ ...p, status: val }))}
        onClose={() => setActiveModal(null)}
      />

      <SelectModal
        visible={activeModal === 'caregiver'}
        title="Select Caregiver"
        options={[{ value: '', label: '-- All Caregivers --' }, ...caregivers]}
        selectedValue={filters.caregiver}
        onSelect={(val) => setFilters((p) => ({ ...p, caregiver: val }))}
        onClose={() => setActiveModal(null)}
      />

      <SelectModal
        visible={activeModal === 'provider'}
        title="Select Provider"
        options={[{ value: '', label: '-- All Providers --' }, ...providers]}
        selectedValue={filters.provider}
        onSelect={(val) => setFilters((p) => ({ ...p, provider: val }))}
        onClose={() => setActiveModal(null)}
      />

      <SelectModal
        visible={activeModal === 'vitals'}
        title="Select Vitals Filter"
        options={VITALS_OPTIONS}
        selectedValue={filters.vitals}
        onSelect={toggleVital}
        onClose={() => setActiveModal(null)}
        isMulti
      />

      <SelectModal
        visible={activeModal === 'dobOperator'}
        title="Select DOB Operator"
        options={DOB_OPERATORS}
        selectedValue={filters.dobOperator}
        onSelect={(val) => setFilters((p) => ({ ...p, dobOperator: val }))}
        onClose={() => setActiveModal(null)}
      />

      {/* Date Pickers */}
      <DatePickerModal
        visible={!!showDatePicker}
        title={
          showDatePicker === 'rpmStart'
            ? 'Select RPM Start Date'
            : showDatePicker === 'rpmEnd'
              ? 'Select RPM End Date'
              : showDatePicker === 'dobFrom'
                ? 'Select DOB From'
                : 'Select DOB To'
        }
        value={new Date()}
        onClose={() => setShowDatePicker(null)}
        onConfirm={(date) => {
          const formattedIso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          const formattedUs = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
          if (showDatePicker === 'rpmStart') {
            setFilters((prev) => ({ ...prev, rpmStartDate: formattedIso }));
          } else if (showDatePicker === 'rpmEnd') {
            setFilters((prev) => ({ ...prev, rpmEndDate: formattedIso }));
          } else if (showDatePicker === 'dobFrom') {
            setFilters((prev) => ({ ...prev, dobFrom: formattedUs }));
          } else if (showDatePicker === 'dobTo') {
            setFilters((prev) => ({ ...prev, dobTo: formattedUs }));
          }
          setShowDatePicker(null);
        }}
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaleWidth(16),
    paddingVertical: 12,
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F4F7F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: scaleFont(18),
    fontWeight: '800',
    color: DARK,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: scaleWidth(16),
    paddingBottom: 40,
  },
  card: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: scaleFont(16),
    fontWeight: '800',
    color: DARK,
  },
  formContainer: {
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  fieldCol: {
    flex: 1,
  },
  fieldFull: {
    marginBottom: 12,
  },
  label: {
    fontSize: scaleFont(12),
    fontWeight: '700',
    color: DARK,
    marginBottom: 6,
  },
  input: {
    height: 42,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    fontSize: scaleFont(13),
    color: DARK,
  },
  dropdownTrigger: {
    height: 42,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownTriggerText: {
    fontSize: scaleFont(13),
    fontWeight: '600',
    color: DARK,
    flex: 1,
  },
  dateBtn: {
    height: 42,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateBtnText: {
    fontSize: scaleFont(12),
    color: MUTED,
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  resetBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: {
    fontSize: scaleFont(14),
    fontWeight: '700',
    color: MUTED,
  },
  queryBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 12,
    backgroundColor: DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queryBtnText: {
    fontSize: scaleFont(14),
    fontWeight: '800',
    color: WHITE,
  },
  /* Modal Styles */
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
  modalItemSelected: {
    backgroundColor: '#F1F5F9',
  },
  modalItemText: {
    fontSize: scaleFont(14),
    fontWeight: '600',
    color: MUTED,
  },
  modalItemTextSelected: {
    color: DARK,
    fontWeight: '800',
  },
  /* Results Styles */
  resultsCardContainer: {
    marginTop: 8,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  resultsTitle: {
    fontSize: scaleFont(16),
    fontWeight: '800',
    color: DARK,
  },
  searchInput: {
    height: 36,
    width: 140,
    backgroundColor: WHITE,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 10,
    fontSize: scaleFont(11),
    color: DARK,
  },
  emptyText: {
    textAlign: 'center',
    color: MUTED,
    fontSize: scaleFont(13),
    marginVertical: 20,
    fontWeight: '600',
  },
  /* Patient Card Styles — Identical to PatientsScreen.js */
  patientCard: {
    backgroundColor: WHITE,
    borderRadius: scaleWidth(16),
    padding: scaleWidth(14),
    marginBottom: scaleWidth(12),
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#0b1f3f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
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
    width: scaleWidth(40),
    height: scaleWidth(40),
    borderRadius: scaleWidth(20),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DARK,
  },
  pcAvatarTextSmall: {
    color: WHITE,
    fontWeight: '800',
    fontSize: scaleFont(14),
  },
  statusBadgeCorner: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: scaleWidth(18),
    height: scaleWidth(18),
    borderRadius: scaleWidth(9),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: WHITE,
  },
  statusBadgeTextCorner: {
    fontSize: scaleFont(9),
    fontWeight: '900',
  },
  pcInfo: {
    flex: 1,
  },
  pcName: {
    fontSize: scaleFont(15),
    fontWeight: '800',
    color: DARK,
  },
  vitalsPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scaleWidth(6),
    marginTop: scaleWidth(4),
  },
  inlineVitalPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: scaleWidth(8),
    paddingVertical: scaleWidth(2),
    borderRadius: scaleWidth(6),
  },
  inlineVitalPillText: {
    fontSize: scaleFont(10),
    fontWeight: '700',
    color: '#475569',
  },
  pcVitals: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: scaleWidth(12),
    padding: scaleWidth(10),
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pcVital: {
    flex: 1,
    alignItems: 'center',
  },
  pvLbl: {
    fontSize: scaleFont(9),
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: scaleWidth(2),
  },
  pvValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  pvVal: {
    fontSize: scaleFont(14),
    fontWeight: '800',
  },
  pvPulse: {
    fontSize: scaleFont(11),
    fontWeight: '700',
  },
  pcExtraStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: scaleWidth(10),
    paddingTop: scaleWidth(8),
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  pcExtraStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(4),
  },
  pcExtraStatLabel: {
    fontSize: scaleFont(11),
    color: '#64748B',
    fontWeight: '600',
  },
  pcExtraStatValue: {
    fontSize: scaleFont(11),
    color: DARK,
    fontWeight: '800',
  },
});
