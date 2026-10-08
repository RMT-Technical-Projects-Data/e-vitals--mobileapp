/* LookupPatient.js — Patient Lookup Screen with Web-matched Filters & Patient List Cards */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Share,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../services/apiService';
import { formatLastFirstName } from '../../utils/formatPersonName';
import DatePickerModal from '../../components/common/DatePickerModal';
import {
  DEFAULT_VITAL_TARGETS,
  checkPulseValue,
  getVitalColor,
  MEASUREMENT_COLORS,
  normalizeWeightToLbs,
} from '../../utils/measurementUtils';
import PulseIcon from '../../components/common/PulseIcon';
import SuccessDialog from '../../components/common/SuccessDialog';
import {
  LOOKUP_COLUMNS,
  isMandatoryLookupColumn,
  buildLookupTable,
  buildLookupCsv,
  buildLookupReportText,
  lookupExportFilename,
  emailListError,
} from './lookupPatientReport';
import { buildLookupPdf } from './lookupPatientPdf';
import { saveExportFile } from './saveExportFile';

const { width } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const scaleWidth = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.25);
const scaleFont = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.2);

const DARK = '#0b1f3f';
const MUTED = '#687382';
const BORDER = '#e8ecf0';
const WHITE = '#ffffff';

const VITAL_TARGETS = DEFAULT_VITAL_TARGETS;
const PAGE_SIZE = 10;

const escapeSearchRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const matchesWordStart = (value, query) => {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return true;
  const text = String(value ?? '').toLowerCase();
  if (!text) return false;
  if (text.startsWith(q)) return true;
  return new RegExp(`(?:^|[\\s,./\\-_@(+])${escapeSearchRegExp(q)}`).test(text);
};

const matchesWordStartAny = (values, query) => {
  const q = String(query ?? '').trim();
  if (!q) return true;
  return values.some((value) => matchesWordStart(value, q));
};

const chronicConditionLabel = (patient) => {
  const raw = patient?.chronic_conditions || patient?.icd_codes || '';
  const items = Array.isArray(raw) ? raw : [raw];
  return items
    .map((entry) => {
      if (entry && typeof entry === 'object') {
        return String(entry.condition_name || entry.name || entry.icd_description || entry.description || '').trim();
      }
      return String(entry || '').trim();
    })
    .filter(Boolean)
    .join(', ');
};

const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');

const phoneDigits = (value) => {
  let digits = digitsOnly(value);
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  return digits;
};

const patientPhoneValues = (patient) => [
  patient?.phone,
  patient?.phone_number,
  patient?.cell_phone_number,
  patient?.cell_phone,
  patient?.homePhone,
  patient?.mobile_phone,
].filter((value) => value != null && String(value).trim() && String(value).trim() !== '-');

const matchesPatientPhone = (patient, query) => {
  const queryDigits = phoneDigits(query);
  if (queryDigits.length < 3) return false;
  return patientPhoneValues(patient).some((phone) => phoneDigits(phone).includes(queryDigits));
};

const lookupPatientMatchesSearch = (patient, query) => {
  if (matchesPatientPhone(patient, query)) return true;
  const queryDigits = phoneDigits(query);
  const queryLetters = String(query ?? '').replace(/[\d\s()+.-]/g, '');
  if (queryDigits.length >= 7 && !queryLetters) return false;

  const last = String(patient?.last_name || patient?.lastName || '').trim();
  const first = String(patient?.first_name || patient?.firstName || '').trim();
  const composed = `${last}${last && first ? ', ' : ''}${first}`.trim();
  const name = patient?.name || patient?.patient_name || patient?.patientName || composed;
  return matchesWordStartAny([
    name,
    composed,
    patient?.email,
    ...patientPhoneValues(patient),
    patient?.vitals,
    chronicConditionLabel(patient),
  ], query);
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

const PROGRAM_RPM = 'rpm';
const PROGRAM_CCM = 'ccm';
const PROGRAM_BOTH = 'both';

const emptyFilters = () => ({
  lastName: '',
  firstName: '',
  phone: '',
  caregiver: '',
  provider: '',
  status: '',
  vitals: [],
  serialNumber: '',
  rpmStartDate: '',
  rpmEndDate: '',
  dobOperator: '',
  dobFrom: '',
  dobTo: '',
  programEnrolled: '',
});

const toLocalIsoDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const todayIsoDate = () => toLocalIsoDate(new Date());

const parseIsoDate = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

const formatLookupDate = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value || '';
  return `${match[2]}/${match[3]}/${match[1]}`;
};

const maskDateInput = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const inspectLookupDate = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return { empty: true };
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const usMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!isoMatch && !usMatch) return { incomplete: true };
  const year = Number(isoMatch ? isoMatch[1] : usMatch[3]);
  const month = Number(isoMatch ? isoMatch[2] : usMatch[1]);
  const day = Number(isoMatch ? isoMatch[3] : usMatch[2]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return { invalid: true };
  }
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { iso, future: iso > todayIsoDate() };
};

const lookupDateError = (value, label) => {
  const checked = inspectLookupDate(value);
  const isTo = label === 'DOB (to)';
  if (checked.empty) {
    return isTo
      ? 'DOB (to) is required when using Between'
      : 'Date of birth is required for the selected DOB filter';
  }
  if (checked.incomplete) return `Enter a complete ${label} (MM/DD/YYYY).`;
  if (checked.invalid) return `Enter a valid ${label}.`;
  if (checked.future) {
    return isTo ? 'DOB (to) cannot be in the future' : 'Date of birth cannot be in the future';
  }
  return '';
};

const normalizeSerialInput = (value) => String(value || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);

/* Helper Functions for Vitals & Patient Display matching PatientsScreen.js */
const toCleanNum = (val) => {
  if (val == null) return null;
  const cleaned = String(val).replace(/[^\d.-]/g, '');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
};

const getPatientStatusMeta = (status) => {
  const raw = String(status ?? '').trim().toLowerCase();
  if (raw === '2' || raw === 'active') return { letter: 'A', bg: '#DDF8DD', color: '#0b1f3f' };
  if (raw === '3' || raw === 'pending') return { letter: 'P', bg: '#caf0f8', color: '#1177c6' };
  if (raw === '4' || raw === 'locked') return { letter: 'L', bg: '#FDE8E8', color: '#d32f2f' };
  return { letter: 'A', bg: '#DDF8DD', color: '#0b1f3f' };
};

const firstPositive = (...values) => {
  for (const value of values) {
    const num = toCleanNum(value);
    if (num != null && num > 0) return num;
  }
  return null;
};

const getPatientVitalsDisplay = (item) => {
  const latest = item.latest_measurements || {};
  const bpObj = latest.blood_pressure || item.blood_pressure || null;
  const bgObj = latest.blood_glucose || item.blood_glucose || null;
  const wtObj = latest.weight || item.weight_measurement || null;
  const summary = String(item.data_summary || '').trim();
  const hasBp = /\d+\s*\/\s*\d+/.test(summary);

  const systolic = firstPositive(
    bpObj?.systolic_pressure,
    bpObj?.systolic,
    item.last_systolic,
    item.systolic,
  );
  const diastolic = firstPositive(
    bpObj?.diastolic_pressure,
    bpObj?.diastolic,
    item.last_diastolic,
    item.diastolic,
  );
  let pulse = firstPositive(bpObj?.pulse, item.last_pulse, item.pulse);
  let bp = (systolic != null && diastolic != null)
    ? `${Math.round(systolic)}/${Math.round(diastolic)}`
    : '--';
  const glucoseNum = firstPositive(
    bgObj?.blood_glucose_value_1,
    bgObj?.blood_glucose_value_2,
    bgObj?.blood_glucose_value_3,
    bgObj?.value,
    item.last_glucose,
    item.glucose,
  );
  let glucose = glucoseNum != null ? String(Math.round(glucoseNum)) : '--';

  const weightNum = firstPositive(
    wtObj?.weight,
    wtObj?.weight_value,
    wtObj?.value,
    item.last_weight,
    item.weight,
  );
  let weight = weightNum != null ? weightNum.toFixed(1) : '--';

  if (bp === '--' && hasBp) {
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
    pulse: bp !== '--' && pulse != null ? Math.round(pulse) : null,
    glucose,
    weight,
    readingsCount,
    serviceTime,
  };
};

const registeredVitalCodes = (item) => {
  const codes = new Set();
  const addToken = (token) => {
    const text = String(token || '').trim().toUpperCase();
    if (!text || text === '-') return;
    if (text === 'BP' || text.includes('BLOOD PRESSURE')) codes.add('BP');
    else if (text === 'BG' || text.includes('GLUCOSE')) codes.add('BG');
    else if (text === 'WT' || text === 'W' || text === 'WEIGHT' || text.includes('WEIGHT')) codes.add('WT');
  };
  const sources = [
    item?.registered_vitals,
    item?.assigned_vital_types,
    item?.vitals,
  ];
  sources.forEach((source) => {
    const parts = Array.isArray(source) ? source : String(source || '').split(',');
    parts.forEach(addToken);
  });
  return codes;
};

const getPatientVitalPills = (item) => {
  const display = getPatientVitalsDisplay(item);
  const registered = registeredVitalCodes(item);
  const pills = [];
  if (registered.has('BP') || display.bp !== '--') pills.push('BP');
  if (registered.has('BG') || display.glucose !== '--') pills.push('BG');
  if (registered.has('WT') || display.weight !== '--') pills.push('W');
  return pills;
};

const patientHasLatestReading = (patient) => {
  const display = getPatientVitalsDisplay(patient);
  return display.bp !== '--' || display.glucose !== '--' || display.weight !== '--';
};

const withLatestReadingFields = (patient, source = {}) => {
  const latest = source.latest_measurements || patient.latest_measurements || {};
  const bp = latest.blood_pressure || null;
  const bg = latest.blood_glucose || null;
  const wt = latest.weight || null;
  const lastSystolic = firstPositive(patient.last_systolic, patient.systolic, source.last_systolic, source.systolic, bp?.systolic_pressure, bp?.systolic);
  const lastDiastolic = firstPositive(patient.last_diastolic, patient.diastolic, source.last_diastolic, source.diastolic, bp?.diastolic_pressure, bp?.diastolic);
  const lastPulse = firstPositive(patient.last_pulse, patient.pulse, source.last_pulse, source.pulse, bp?.pulse);
  const lastGlucose = firstPositive(patient.last_glucose, patient.glucose, source.last_glucose, source.glucose, bg?.blood_glucose_value_1, bg?.value);
  const lastWeight = firstPositive(patient.last_weight, source.last_weight, wt?.weight, wt?.weight_value, wt?.value);
  const readingsCount = Number(patient.readings_count ?? patient.number_of_readings) || Number(source.readings_count ?? source.number_of_readings) || 0;
  const serviceTime = Number(patient.service_time ?? patient.total_service_time) || Number(source.service_time ?? source.total_service_time) || 0;
  const registered = [...new Set([
    ...registeredVitalCodes(patient),
    ...registeredVitalCodes(source),
  ])];
  return {
    ...patient,
    registered_vitals: registered,
    vitals: registered.length ? registered.join(', ') : (patient.vitals || '-'),
    latest_measurements: {
      blood_pressure: (lastSystolic != null || lastDiastolic != null)
        ? { systolic_pressure: lastSystolic, diastolic_pressure: lastDiastolic, pulse: lastPulse }
        : null,
      blood_glucose: lastGlucose != null ? { blood_glucose_value_1: lastGlucose } : null,
      weight: lastWeight != null ? { weight: lastWeight } : null,
    },
    last_systolic: lastSystolic,
    last_diastolic: lastDiastolic,
    last_pulse: lastPulse,
    last_glucose: lastGlucose,
    last_weight: lastWeight,
    systolic: lastSystolic,
    diastolic: lastDiastolic,
    pulse: lastPulse,
    glucose: lastGlucose,
    weight: lastWeight,
    readings_count: readingsCount,
    number_of_readings: readingsCount,
    service_time: serviceTime,
  };
};

const mapWithConcurrency = async (items, limit, worker) => {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
};

const practiceVitalIndexCache = new Map();

const loadPracticeVitalIndex = (practiceId) => {
  const key = String(practiceId);
  if (practiceVitalIndexCache.has(key)) return practiceVitalIndexCache.get(key);
  const promise = (async () => {
    const index = new Map();
    let page = 1;
    let pages = 1;
    while (page <= pages && page <= 40) {
      const res = await apiService.getPatients(practiceId, {
        program: 'rpm',
        limit: 100,
        page,
      });
      const payload = res?.data?.patients ? res.data : (res?.data?.data || {});
      const batch = Array.isArray(payload.patients) ? payload.patients : [];
      batch.forEach((row) => {
        const id = String(row.patient_table_id || row.id || '');
        if (id) index.set(id, row);
      });
      pages = Number(payload.pagination?.total_pages) || 1;
      if (batch.length === 0) break;
      page += 1;
    }
    return index;
  })().catch((error) => {
    practiceVitalIndexCache.delete(key);
    throw error;
  });
  practiceVitalIndexCache.set(key, promise);
  return promise;
};

const hydrateLookupReadings = async (practiceId, list) => {
  const rows = Array.isArray(list) ? list : [];
  if (!practiceId || rows.length === 0) return rows;
  if (rows.every(patientHasLatestReading)) return rows;

  if (rows.filter((row) => !patientHasLatestReading(row)).length <= 12) {
    const extras = new Map();
    await mapWithConcurrency(rows, 4, async (patient) => {
      if (patientHasLatestReading(patient)) return;
      const id = patient.patient_table_id || patient.id;
      const pid = patient.practice_id || practiceId;
      if (!id || !pid) return;
      try {
        const body = await apiService.getPatientDetailsFast(pid, id);
        const payload = body?.data || {};
        if (!payload.latest_measurements) return;
        extras.set(String(id), {
          latest_measurements: payload.latest_measurements,
          vitals: payload.patient?.vitals,
          registered_vitals: payload.patient?.registered_vitals,
          assigned_vital_types: payload.patient?.assigned_vital_types,
          readings_count: payload.billing_compliance?.measurement_days,
          service_time: payload.billing_compliance?.service_time_minutes,
        });
      } catch (error) {
        console.warn('Lookup latest vitals failed:', error?.message || error);
      }
    });
    return rows.map((patient) => {
      const extra = extras.get(String(patient.patient_table_id || patient.id));
      return extra ? withLatestReadingFields(patient, extra) : patient;
    });
  }

  try {
    const index = await loadPracticeVitalIndex(practiceId);
    return rows.map((patient) => {
      const source = index.get(String(patient.patient_table_id || patient.id));
      return source ? withLatestReadingFields(patient, source) : patient;
    });
  } catch (error) {
    console.warn('Lookup latest vitals failed:', error?.message || error);
    return rows;
  }
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
  const [searchMatches, setSearchMatches] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPatients, setTotalPatients] = useState(0);
  const [currentUserLabel, setCurrentUserLabel] = useState('User');
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState(LOOKUP_COLUMNS);
  const [emailForm, setEmailForm] = useState({ to: '', cc: '', bcc: '', subject: '', content: '' });
  const [emailErrors, setEmailErrors] = useState({});
  const [reportNotice, setReportNotice] = useState(null);
  const scrollRef = useRef(null);
  const appliedFiltersRef = useRef(null);

  // Modal selector states
  const [activeModal, setActiveModal] = useState(null); // 'status' | 'caregiver' | 'provider' | 'vitals' | 'dobOperator'
  const [showDatePicker, setShowDatePicker] = useState(null); // 'rpmStart' | 'rpmEnd' | 'dobFrom' | 'dobTo'

  // Care team dropdown lists
  const [caregivers, setCaregivers] = useState([]);
  const [providers, setProviders] = useState([]);
  const [hasRpm, setHasRpm] = useState(false);
  const [hasCcm, setHasCcm] = useState(false);
  const [programsLoading, setProgramsLoading] = useState(false);

  // Load practice ID & fetch caregivers/providers across patient roster
  useEffect(() => {
    (async () => {
      let pId = await AsyncStorage.getItem('practiceId');
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (!pId) pId = user.practice_id;
          const name = formatLastFirstName(user)
            || user.name
            || user.username
            || 'User';
          setCurrentUserLabel(name);
        } catch (error) {
          console.warn('Could not read signed-in user:', error);
        }
      }
      if (pId) {
        setPracticeId(String(pId));
        setProgramsLoading(true);
        try {
          const summary = await apiService.getPracticeSummary(pId);
          const data = summary?.data?.data ?? summary?.data ?? summary;
          const enrolled = Array.isArray(data?.enrolled_programs) ? data.enrolled_programs : [];
          const keys = enrolled.map((item) => String(typeof item === 'string' ? item : (item?.short_name || item?.id || item?.label || '')).trim().toLowerCase());
          const rpm = keys.includes(PROGRAM_RPM);
          const ccm = keys.includes(PROGRAM_CCM);
          setHasRpm(rpm);
          setHasCcm(ccm);
          setFilters((prev) => ({
            ...prev,
            programEnrolled: rpm && ccm ? '' : rpm ? PROGRAM_RPM : ccm ? PROGRAM_CCM : '',
          }));
        } catch (error) {
          console.warn('Could not load practice programs:', error);
        } finally {
          setProgramsLoading(false);
        }
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
              const name = formatLastFirstName(p) || p.name || p.full_name || p.username || `Provider #${p.id}`;
              return { value: String(p.id || name), label: name.trim() };
            });

          // Process Caregivers matching Web LookupPatient.jsx
          let caregiversData = caregiversRes?.data?.data?.caregivers || caregiversRes?.data?.caregivers || caregiversRes?.data?.data || caregiversRes?.data || [];
          if (!Array.isArray(caregiversData)) caregiversData = [];

          const uniqueCaregivers = caregiversData
            .filter((c, index, self) => c && index === self.findIndex((item) => item && (item.id != null && c.id != null ? item.id === c.id : item.name === c.name)))
            .map((c) => {
              const name = formatLastFirstName(c) || c.name || c.full_name || c.username || `Caregiver #${c.id}`;
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
                  : formatLastFirstName({ first_name: p.provider_first_name, last_name: p.provider_last_name });
                if (pvName && !fallbackPv.has(pvName)) {
                  fallbackPv.set(pvName, { value: String(p.provider_id || p.providerId || pvName), label: pvName });
                }

                const cgName = typeof p.caregiver === 'string' && p.caregiver !== '-'
                  ? p.caregiver
                  : formatLastFirstName({ first_name: p.caregiver_first_name, last_name: p.caregiver_last_name });
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

  const applyLookupPage = (res, requestedPage) => {
    const payload = res?.data?.patients ? res.data : (res?.data?.data || res?.data || {});
    const list = Array.isArray(payload?.patients)
      ? payload.patients
      : (Array.isArray(payload) ? payload : []);
    const pagination = payload?.pagination || res?.data?.pagination || {};
    const total = Number(pagination.total);
    const pages = Number(pagination.total_pages);
    setPatients(list);
    setTotalPatients(Number.isFinite(total) ? total : list.length);
    setTotalPages(Math.max(1, Number.isFinite(pages) && pages > 0 ? pages : 1));
    setCurrentPage(Number(pagination.current_page) || requestedPage);
  };

  const includeRpmFilters = !(hasRpm && hasCcm && filters.programEnrolled === PROGRAM_CCM);

  const buildLookupRequest = (source, page, limit) => {
    const rpmFilters = !(hasRpm && hasCcm && source.programEnrolled === PROGRAM_CCM);
    return {
      ...source,
      dobFrom: inspectLookupDate(source.dobFrom).iso || '',
      dobTo: source.dobOperator === 'between' ? (inspectLookupDate(source.dobTo).iso || '') : '',
      vitals: rpmFilters ? (source.vitals || []).join(',') : '',
      serialNumber: rpmFilters ? (source.serialNumber || '') : '',
      rpmStartDate: rpmFilters ? (source.rpmStartDate || '') : '',
      rpmEndDate: rpmFilters ? (source.rpmEndDate || '') : '',
      programEnrolled: source.programEnrolled || '',
      page,
      limit,
    };
  };

  const loadLookupPage = useCallback(async (page) => {
    if (!practiceId) return;
    const requestedPage = Math.max(1, page);
    appliedFiltersRef.current = {
      ...filters,
      vitals: [...(filters.vitals || [])],
    };
    setLoading(true);
    setHasQueried(true);
    try {
      const res = await apiService.lookupPatient(practiceId, buildLookupRequest(filters, requestedPage, PAGE_SIZE));
      const parsed = extractLookupList(res);
      const withVitals = await hydrateLookupReadings(practiceId, parsed.list);
      applyLookupPage(res, requestedPage);
      setPatients(withVitals);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (err) {
      console.warn('Error querying patients:', err);
      setPatients([]);
      setTotalPatients(0);
      setTotalPages(1);
      setCurrentPage(1);
      setReportNotice({
        title: 'Look up Patient',
        message: 'The patient query could not be completed. Please try again.',
        variant: 'warning',
      });
    } finally {
      setLoading(false);
    }
  }, [practiceId, filters, hasRpm, hasCcm]);

  const handleQuery = () => {
    const today = todayIsoDate();
    if (hasRpm && hasCcm && !filters.programEnrolled) {
      setReportNotice({ title: 'Program Enrolled', message: 'Program Enrolled is required', variant: 'warning' });
      return;
    }
    if (includeRpmFilters && filters.serialNumber && !/^[A-Za-z0-9]{16}$/.test(filters.serialNumber)) {
      setReportNotice({
        title: 'Serial number',
        message: 'Serial number must be exactly 16 alphanumeric characters.',
        variant: 'warning',
      });
      return;
    }
    if (filters.dobOperator) {
      const fromLabel = filters.dobOperator === 'between' ? 'DOB (from)' : 'date of birth';
      const fromError = lookupDateError(filters.dobFrom, fromLabel);
      if (fromError) {
        setReportNotice({ title: 'Date of birth', message: fromError, variant: 'warning' });
        return;
      }
      if (filters.dobOperator === 'between') {
        const toError = lookupDateError(filters.dobTo, 'DOB (to)');
        if (toError) {
          setReportNotice({ title: 'Date of birth', message: toError, variant: 'warning' });
          return;
        }
        const fromIso = inspectLookupDate(filters.dobFrom).iso;
        const toIso = inspectLookupDate(filters.dobTo).iso;
        if (toIso < fromIso) {
          setReportNotice({ title: 'Date of birth', message: 'DOB (to) must be on or after DOB (from)', variant: 'warning' });
          return;
        }
      }
    } else if (filters.dobFrom || filters.dobTo) {
      setReportNotice({ title: 'Date of birth', message: 'Select a DOB operator (On, On or before, On or after, or Between)', variant: 'warning' });
      return;
    }

    if (filters.rpmStartDate || filters.rpmEndDate) {
      if (filters.rpmStartDate && filters.rpmStartDate > today) {
        setReportNotice({ title: 'RPM start date', message: 'RPM Service Date (from) cannot be in the future', variant: 'warning' });
        return;
      }
      if (filters.rpmEndDate && filters.rpmEndDate > today) {
        setReportNotice({ title: 'RPM start date', message: 'RPM Service Date (to) cannot be in the future', variant: 'warning' });
        return;
      }
      if (filters.rpmStartDate && filters.rpmEndDate && filters.rpmEndDate < filters.rpmStartDate) {
        setReportNotice({ title: 'RPM start date', message: 'RPM Service Date (to) must be on or after RPM Service Date (from)', variant: 'warning' });
        return;
      }
    }

    loadLookupPage(1);
  };

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    if (hasQueried && currentPage !== 1) {
      loadLookupPage(1);
    }
  };

  const defaultProgramEnrolled = hasRpm && hasCcm ? '' : hasRpm ? PROGRAM_RPM : hasCcm ? PROGRAM_CCM : '';
  const hasSelectedCriteria = useMemo(() => {
    const text = (value) => String(value || '').trim().length > 0;
    return (
      text(filters.lastName)
      || text(filters.firstName)
      || text(filters.phone)
      || text(filters.caregiver)
      || text(filters.provider)
      || text(filters.status)
      || (Array.isArray(filters.vitals) && filters.vitals.length > 0)
      || text(filters.serialNumber)
      || text(filters.rpmStartDate)
      || text(filters.rpmEndDate)
      || text(filters.dobOperator)
      || text(filters.dobFrom)
      || text(filters.dobTo)
      || String(filters.programEnrolled || '') !== defaultProgramEnrolled
      || text(searchQuery)
    );
  }, [filters, defaultProgramEnrolled, searchQuery]);

  const handleReset = () => {
    if (!hasSelectedCriteria) return;
    setFilters({
      ...emptyFilters(),
      programEnrolled: hasRpm && hasCcm ? '' : hasRpm ? PROGRAM_RPM : hasCcm ? PROGRAM_CCM : '',
    });
    setPatients([]);
    setHasQueried(false);
    setCurrentPage(1);
    setTotalPages(1);
    setTotalPatients(0);
    setSearchQuery('');
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
    const fullName = formatLastFirstName({ first_name: first, last_name: last }) || 'Patient #' + (p.id || p.patient_table_id || '');
    return { firstName: first, lastName: last, fullName };
  };

  // Filter returned list by live search term
  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return patients;
    return patients.filter((patient) => lookupPatientMatchesSearch(patient, searchQuery));
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
        return found ? found.label.replace(/\s*\([^)]*\)\s*$/, '') : '';
      })
      .filter(Boolean);
    return labels.join(', ');
  };

  const getDobOperatorLabel = () => {
    const found = DOB_OPERATORS.find((d) => d.value === filters.dobOperator);
    return found ? found.label : '-- Select DOB Operator --';
  };

  const showingSearch = searchQuery.trim().length > 0;
  const visiblePatients = showingSearch ? (searchMatches || []) : filteredPatients;
  const canReport = hasQueried && visiblePatients.length > 0 && !loading && !searchLoading && !isExporting;

  const showReportNotice = (title, message, variant = 'success') => {
    setReportNotice({ title, message, variant });
  };

  const extractLookupList = (res) => {
    const payload = res?.data?.patients ? res.data : (res?.data?.data || res?.data || {});
    const list = Array.isArray(payload?.patients)
      ? payload.patients
      : (Array.isArray(payload) ? payload : []);
    const pagination = payload?.pagination || res?.data?.pagination || {};
    const total = Number(pagination.total);
    return { list, total: Number.isFinite(total) ? total : list.length };
  };

  const patientMatchesSearch = (patient, query) => lookupPatientMatchesSearch(patient, query);

  const fetchAllLookupPatients = async () => {
    const source = appliedFiltersRef.current || filters;
    const pageSize = 100;
    let page = 1;
    let all = [];
    let total = Infinity;
    while (all.length < total && page <= 100) {
      const res = await apiService.lookupPatient(practiceId, buildLookupRequest(source, page, pageSize));
      const parsed = extractLookupList(res);
      total = parsed.total;
      all = all.concat(parsed.list);
      if (parsed.list.length < pageSize) break;
      page += 1;
    }
    const query = searchQuery.trim();
    const matched = !query ? all : all.filter((patient) => patientMatchesSearch(patient, query));
    return hydrateLookupReadings(practiceId, matched);
  };

  useEffect(() => {
    const query = searchQuery.trim();
    if (!hasQueried || !query) {
      setSearchMatches(null);
      setSearchLoading(false);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const rows = await fetchAllLookupPatients();
        if (!cancelled) setSearchMatches(rows);
      } catch (error) {
        console.warn('Lookup search failed:', error);
        if (!cancelled) setSearchMatches([]);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, hasQueried, patients]);

  const reportMeta = () => {
    const source = appliedFiltersRef.current || filters;
    const criteria = ['Query criteria:'];
    if (source.lastName) criteria.push(`• Last name: ${source.lastName}`);
    if (source.firstName) criteria.push(`• First name: ${source.firstName}`);
    if (source.phone) criteria.push(`• Phone: ${source.phone}`);
    if (source.status) criteria.push(`• Status: ${STATUS_OPTIONS.find((item) => item.value === source.status)?.label || source.status}`);
    if (source.caregiver) criteria.push(`• Caregiver: ${caregivers.find((item) => item.value === source.caregiver)?.label || source.caregiver}`);
    if (source.provider) criteria.push(`• Provider: ${providers.find((item) => item.value === source.provider)?.label || source.provider}`);
    if (source.programEnrolled) criteria.push(`• Program enrolled: ${source.programEnrolled.toUpperCase()}`);
    if (source.serialNumber) criteria.push(`• Serial number: ${source.serialNumber}`);
    if (source.vitals?.length) criteria.push(`• Vitals: ${source.vitals.join(', ')}`);
    if (source.rpmStartDate || source.rpmEndDate) {
      criteria.push(`• RPM dates: ${formatLookupDate(source.rpmStartDate) || 'Any'} to ${formatLookupDate(source.rpmEndDate) || 'Any'}`);
    }
    if (source.dobOperator) criteria.push(`• DOB: ${source.dobOperator} ${formatLookupDate(source.dobFrom) || ''} ${formatLookupDate(source.dobTo) || ''}`.trim());
    if (searchQuery.trim()) criteria.push(`• Search: ${searchQuery.trim()}`);
    if (criteria.length === 1) criteria.push('• All patients');
    return {
      generatedAt: new Date().toLocaleString(),
      user: currentUserLabel,
      criteria,
    };
  };

  const openPrint = () => {
    if (!canReport) {
      showReportNotice('Print', 'No data to print', 'warning');
      return;
    }
    setSelectedColumns([...LOOKUP_COLUMNS]);
    setShowPrintModal(true);
  };

  const performPrint = async () => {
    setShowPrintModal(false);
    setIsExporting(true);
    try {
      const rows = await fetchAllLookupPatients();
      if (rows.length === 0) {
        showReportNotice('Print', 'No data to print', 'warning');
        return;
      }
      const table = buildLookupTable(rows, selectedColumns);
      const message = buildLookupReportText(table, reportMeta());
      await Share.share({ title: 'Look up Patient', message });
    } catch (error) {
      showReportNotice('Print', error?.message || 'Failed to print', 'warning');
    } finally {
      setIsExporting(false);
    }
  };

  const exportLookup = async (kind) => {
    if (!canReport || isExporting) return;
    setShowExportMenu(false);
    setIsExporting(true);
    try {
      const rows = await fetchAllLookupPatients();
      if (rows.length === 0) {
        showReportNotice('Export', 'No data to export', 'warning');
        return;
      }
      const table = buildLookupTable(rows);
      if (kind === 'csv') {
        const filename = lookupExportFilename('csv');
        await saveExportFile(filename, 'text/csv', buildLookupCsv(table));
        showReportNotice('Export', `Saved to Downloads as ${filename}`);
      } else {
        const meta = reportMeta();
        const filename = lookupExportFilename('pdf');
        const pdf = buildLookupPdf({
          title: 'Look up Patient',
          metaLines: [
            `Generated: ${meta.generatedAt}`,
            `User: ${meta.user}`,
            ...meta.criteria,
            `Total records: ${table.rows.length}`,
          ],
          headers: table.headers,
          rows: table.rows,
        });
        await saveExportFile(filename, 'application/pdf', pdf);
        showReportNotice('Export', `Saved to Downloads as ${filename}`);
      }
    } catch (error) {
      showReportNotice('Export', error?.message || 'Failed to export', 'warning');
    } finally {
      setIsExporting(false);
    }
  };

  const openEmail = () => {
    if (!canReport) {
      showReportNotice('Email', 'No data to email', 'warning');
      return;
    }
    const meta = reportMeta();
    setSelectedColumns([...LOOKUP_COLUMNS]);
    setEmailErrors({});
    setEmailForm({
      to: '',
      cc: '',
      bcc: '',
      subject: 'Look up Patient',
      content: [
        'Please find the Look up Patient results attached as a CSV file.',
        '',
        ...meta.criteria,
        '',
        `Generated: ${meta.generatedAt}`,
        `Generated by: ${meta.user}`,
      ].join('\n'),
    });
    setShowEmailModal(true);
  };

  const toggleReportColumn = (column) => {
    if (isMandatoryLookupColumn(column)) return;
    setSelectedColumns((prev) => (
      prev.includes(column) ? prev.filter((item) => item !== column) : [...prev, column]
    ));
  };

  const sendLookupEmail = async () => {
    const nextErrors = {
      to: emailListError(emailForm.to, { required: true }),
      cc: emailListError(emailForm.cc),
      bcc: emailListError(emailForm.bcc),
      subject: String(emailForm.subject || '').trim() ? '' : 'Subject is required',
      content: String(emailForm.content || '').trim() ? '' : 'Content is required',
    };
    setEmailErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setIsExporting(true);
    try {
      const rows = await fetchAllLookupPatients();
      if (rows.length === 0) throw new Error('No data to email');
      const table = buildLookupTable(rows, selectedColumns);
      await apiService.sendCustomEmail({
        to: emailForm.to.trim(),
        cc: emailForm.cc.trim(),
        bcc: emailForm.bcc.trim(),
        subject: emailForm.subject.trim(),
        text: emailForm.content,
        html: `<pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${String(emailForm.content).replace(/</g, '&lt;')}</pre>`,
        event_id: 11,
        inlineAttachmentName: lookupExportFilename('csv'),
        inlineAttachmentContent: buildLookupCsv(table),
        inlineAttachmentType: 'text/csv',
        sendImmediately: true,
      });
      setShowEmailModal(false);
      showReportNotice('Email', 'Email Sent Successfully');
    } catch (error) {
      showReportNotice('Email', error?.message || 'Failed to send email', 'warning');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Top Header */}
      <View style={st.header}>
        <TouchableOpacity style={st.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={22} color={DARK} />
        </TouchableOpacity>
        <Text style={st.headerTitle} numberOfLines={1}>Look up Patient</Text>
        <View style={st.headerSearch}>
          <Text style={st.headerSearchLabel}>Search:</Text>
          <View style={st.headerSearchField}>
            <TextInput
              style={st.headerSearchInput}
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search patients"
            />
            <MaterialIcons name="search" size={14} color="#999999" style={st.headerSearchIcon} />
          </View>
        </View>
      </View>

      <ScrollView ref={scrollRef} style={st.scroll} contentContainerStyle={st.scrollContent} showsVerticalScrollIndicator={false}>
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

              <View style={st.fieldFull}>
                <Text style={st.label}>Program Enrolled{hasRpm && hasCcm ? ' *' : ''}</Text>
                <TouchableOpacity
                  style={st.dropdownTrigger}
                  onPress={() => setActiveModal('programEnrolled')}
                  activeOpacity={0.75}
                  disabled={programsLoading}
                >
                  <Text style={[st.dropdownTriggerText, !filters.programEnrolled && { color: MUTED }]} numberOfLines={1}>
                    {filters.programEnrolled === PROGRAM_BOTH
                      ? 'Both'
                      : filters.programEnrolled === PROGRAM_RPM
                        ? 'RPM'
                        : filters.programEnrolled === PROGRAM_CCM
                          ? 'CCM'
                          : '-- Select --'}
                  </Text>
                  <MaterialIcons name="arrow-drop-down" size={22} color={MUTED} />
                </TouchableOpacity>
              </View>

              {includeRpmFilters && (
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
              )}

              {includeRpmFilters && (
              <View style={st.fieldFull}>
                <Text style={st.label}>Serial Number</Text>
                <TextInput
                  style={st.input}
                  value={filters.serialNumber}
                  onChangeText={(val) => setFilters((p) => ({ ...p, serialNumber: normalizeSerialInput(val) }))}
                  placeholder="16-character alphanumeric"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={16}
                />
              </View>
              )}

              {includeRpmFilters && (
              <View style={st.fieldFull}>
                <Text style={st.label}>RPM Start Date Range</Text>
                <View style={st.row}>
                  <TouchableOpacity
                    style={[st.dateBtn, st.fieldCol]}
                    onPress={() => setShowDatePicker('rpmStart')}
                  >
                    <Text style={st.dateBtnText}>{formatLookupDate(filters.rpmStartDate) || 'Start Date'}</Text>
                    <MaterialIcons name="event" size={18} color={DARK} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[st.dateBtn, st.fieldCol]}
                    onPress={() => setShowDatePicker('rpmEnd')}
                  >
                    <Text style={st.dateBtnText}>{formatLookupDate(filters.rpmEndDate) || 'End Date'}</Text>
                    <MaterialIcons name="event" size={18} color={DARK} />
                  </TouchableOpacity>
                </View>
              </View>
              )}

              <View style={st.fieldFull}>
                <Text style={st.label}>Date of Birth (DOB)</Text>
                <Text style={st.fieldHint}>Choose how the date of birth should match, then enter a complete date.</Text>
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
                  <View style={st.fieldCol}>
                    <Text style={st.label}>{filters.dobOperator === 'between' ? 'DOB (from)' : 'Date of Birth'}</Text>
                    <View style={st.dateEntry}>
                      <TextInput
                        style={[st.input, st.dateEntryInput]}
                        value={formatLookupDate(filters.dobFrom)}
                        onChangeText={(val) => setFilters((p) => ({ ...p, dobFrom: maskDateInput(val) }))}
                        placeholder="MM/DD/YYYY"
                        placeholderTextColor="#94a3b8"
                        keyboardType="number-pad"
                        maxLength={10}
                      />
                      <TouchableOpacity style={st.dateIconBtn} onPress={() => setShowDatePicker('dobFrom')}>
                        <MaterialIcons name="event" size={20} color={DARK} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {filters.dobOperator === 'between' && (
                    <View style={st.fieldCol}>
                      <Text style={st.label}>DOB (to)</Text>
                      <View style={st.dateEntry}>
                        <TextInput
                          style={[st.input, st.dateEntryInput]}
                          value={formatLookupDate(filters.dobTo)}
                          onChangeText={(val) => setFilters((p) => ({ ...p, dobTo: maskDateInput(val) }))}
                          placeholder="MM/DD/YYYY"
                          placeholderTextColor="#94a3b8"
                          keyboardType="number-pad"
                          maxLength={10}
                        />
                        <TouchableOpacity style={st.dateIconBtn} onPress={() => setShowDatePicker('dobTo')}>
                          <MaterialIcons name="event" size={20} color={DARK} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Action Buttons: Reset & Query */}
              <View style={st.btnRow}>
                <TouchableOpacity
                  style={[st.resetBtn, !hasSelectedCriteria && st.resetBtnDisabled]}
                  onPress={handleReset}
                  disabled={!hasSelectedCriteria}
                  activeOpacity={hasSelectedCriteria ? 0.7 : 1}
                  accessibilityState={{ disabled: !hasSelectedCriteria }}
                >
                  <Text style={[st.resetBtnText, !hasSelectedCriteria && st.resetBtnTextDisabled]}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.queryBtn} onPress={handleQuery}>
                  <Text style={st.queryBtnText}>Query</Text>
                </TouchableOpacity>
              </View>
              <View style={st.reportBtnRow}>
                <TouchableOpacity
                  style={[st.reportBtn, !canReport && st.reportBtnDisabled]}
                  onPress={openPrint}
                  disabled={!canReport}
                >
                  <MaterialIcons name="print" size={16} color={WHITE} />
                  <Text style={st.reportBtnText}>Print</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.reportBtn, !canReport && st.reportBtnDisabled]}
                  onPress={() => setShowExportMenu(true)}
                  disabled={!canReport}
                >
                  <MaterialIcons name="file-download" size={16} color={WHITE} />
                  <Text style={st.reportBtnText}>{isExporting ? 'Exporting...' : 'Export'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.reportBtn, !canReport && st.reportBtnDisabled]}
                  onPress={openEmail}
                  disabled={!canReport}
                >
                  <MaterialIcons name="email" size={16} color={WHITE} />
                  <Text style={st.reportBtnText}>Email</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Results Section */}
        {hasQueried && (
          <View style={st.resultsCardContainer}>
            <View style={st.resultsHeader}>
              <Text style={st.resultsTitle}>
                {showingSearch ? `Search Results (${visiblePatients.length})` : `Query Results (${totalPatients})`}
              </Text>
            </View>

            {loading || (showingSearch && (searchLoading || searchMatches == null)) ? (
              <ActivityIndicator size="large" color={DARK} style={{ marginVertical: 30 }} />
            ) : visiblePatients.length === 0 ? (
              <Text style={st.emptyText}>
                {showingSearch ? 'No patients match this search.' : 'No patients match the selected criteria.'}
              </Text>
            ) : (
              visiblePatients.map((item) => {
                const { firstName, lastName, fullName } = getPatientNameParts(item);
                const vitals = getPatientVitalsDisplay(item);
                const vitalPills = getPatientVitalPills(item);
                const statusMeta = getPatientStatusMeta(item.status);

                const pulseStatus = vitals.pulse != null ? checkPulseValue(vitals.pulse, VITAL_TARGETS) : null;
                const pulseColor = vitals.pulse != null ? getVitalColor(vitals.pulse, VITAL_TARGETS.pulseMin, VITAL_TARGETS.pulseMax) : MEASUREMENT_COLORS.pulseMissing;
                const isPulseAbnormal = pulseStatus === 'high' || pulseStatus === 'low';
                const bpParts = String(vitals.bp || '').split('/');
                const hasSplitBp = bpParts.length === 2 && vitals.bp !== '--';
                const sysColor = hasSplitBp ? getVitalColor(bpParts[0], VITAL_TARGETS.systolicMin, VITAL_TARGETS.systolicMax) : MEASUREMENT_COLORS.missing;
                const diaColor = hasSplitBp ? getVitalColor(bpParts[1], VITAL_TARGETS.diastolicMin, VITAL_TARGETS.diastolicMax) : MEASUREMENT_COLORS.missing;
                const glucoseColor = getVitalColor(vitals.glucose, VITAL_TARGETS.glucoseMin, VITAL_TARGETS.glucoseMax);

                const weightNum = normalizeWeightToLbs(vitals.weight);
                const weightColor = weightNum != null ? getVitalColor(weightNum, VITAL_TARGETS.weightMin, VITAL_TARGETS.weightMax) : MEASUREMENT_COLORS.missing;
                const showBp = registeredVitalCodes(item).has('BP') || vitals.bp !== '--';
                const showGlucose = registeredVitalCodes(item).has('BG') || vitals.glucose !== '--';
                const showWeight = registeredVitalCodes(item).has('WT') || vitals.weight !== '--';
                const glucoseText = vitals.glucose !== '--' ? vitals.glucose : 'null';
                const weightText = vitals.weight !== '--' ? vitals.weight : 'null';

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
                    {(showBp || showGlucose || showWeight) ? (
                      <View style={st.pcVitals}>
                        {showBp ? (
                          <View style={st.pcVital}>
                            <Text style={st.pvLbl}>BP (mmHg)</Text>
                            <View style={st.pvValueRow}>
                              {hasSplitBp ? (
                                <>
                                  <Text style={[st.pvVal, { color: sysColor }]} numberOfLines={1}>
                                    {bpParts[0].trim()}
                                  </Text>
                                  <Text style={st.bpSlash}>/</Text>
                                  <Text style={[st.pvVal, { color: diaColor }]} numberOfLines={1}>
                                    {bpParts[1].trim()}
                                  </Text>
                                </>
                              ) : (
                                <Text style={[st.pvVal, { color: MEASUREMENT_COLORS.missing }]} numberOfLines={1}>
                                  null
                                </Text>
                              )}
                              {vitals.pulse != null ? (
                                <View style={st.pvPulseWrap}>
                                  <Text style={[st.pvPulse, { color: pulseColor }]} numberOfLines={1}>
                                    {vitals.pulse}
                                  </Text>
                                  <PulseIcon isAbnormal={isPulseAbnormal} size={scaleFont(11)} />
                                </View>
                              ) : null}
                            </View>
                          </View>
                        ) : null}
                        {showGlucose ? (
                          <View style={st.pcVital}>
                            <Text style={st.pvLbl}>BG (mg/dL)</Text>
                            <Text style={[st.pvVal, { color: vitals.glucose === '--' ? MEASUREMENT_COLORS.missing : glucoseColor }]} numberOfLines={1}>
                              {glucoseText}
                            </Text>
                          </View>
                        ) : null}
                        {showWeight ? (
                          <View style={st.pcVital}>
                            <Text style={st.pvLbl}>WT (lbs)</Text>
                            <Text style={[st.pvVal, { color: vitals.weight === '--' ? MEASUREMENT_COLORS.missing : weightColor }]} numberOfLines={1}>
                              {weightText}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}

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
            {!loading && !showingSearch && totalPatients > 0 && (
              <View style={st.paginationBar}>
                <Text style={st.paginationInfo}>
                  {`${((currentPage - 1) * PAGE_SIZE) + 1}–${Math.min(currentPage * PAGE_SIZE, totalPatients)} of ${totalPatients}`}
                </Text>
                <View style={st.paginationControls}>
                  <TouchableOpacity
                    style={[st.paginationBtn, currentPage <= 1 && st.paginationBtnDisabled]}
                    onPress={() => loadLookupPage(currentPage - 1)}
                    disabled={currentPage <= 1 || loading}
                  >
                    <MaterialIcons name="chevron-left" size={20} color={currentPage <= 1 ? '#A0AAB4' : DARK} />
                    <Text style={[st.paginationBtnText, currentPage <= 1 && st.paginationBtnTextDisabled]}>Previous</Text>
                  </TouchableOpacity>
                  <Text style={st.paginationPageText}>{`Page ${currentPage} of ${totalPages}`}</Text>
                  <TouchableOpacity
                    style={[st.paginationBtn, currentPage >= totalPages && st.paginationBtnDisabled]}
                    onPress={() => loadLookupPage(currentPage + 1)}
                    disabled={currentPage >= totalPages || loading}
                  >
                    <Text style={[st.paginationBtnText, currentPage >= totalPages && st.paginationBtnTextDisabled]}>Next</Text>
                    <MaterialIcons name="chevron-right" size={20} color={currentPage >= totalPages ? '#A0AAB4' : DARK} />
                  </TouchableOpacity>
                </View>
              </View>
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

      <Modal transparent animationType="fade" visible={showExportMenu} onRequestClose={() => setShowExportMenu(false)}>
        <Pressable style={st.modalOverlay} onPress={() => setShowExportMenu(false)}>
          <View style={st.modalContent}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>Export</Text>
              <TouchableOpacity onPress={() => setShowExportMenu(false)} style={st.modalCloseBtn}>
                <MaterialIcons name="close" size={20} color={DARK} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={st.modalItem} onPress={() => exportLookup('csv')} disabled={isExporting}>
              <Text style={st.modalItemText}>CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.modalItem} onPress={() => exportLookup('pdf')} disabled={isExporting}>
              <Text style={st.modalItemText}>PDF</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal transparent animationType="fade" visible={showPrintModal} onRequestClose={() => setShowPrintModal(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>Print Look up Patient</Text>
              <TouchableOpacity onPress={() => setShowPrintModal(false)} style={st.modalCloseBtn}>
                <MaterialIcons name="close" size={20} color={DARK} />
              </TouchableOpacity>
            </View>
            <Text style={st.reportHint}>Select the columns to include in the printed report.</Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {LOOKUP_COLUMNS.map((column) => {
                const locked = isMandatoryLookupColumn(column);
                const checked = selectedColumns.includes(column);
                return (
                  <TouchableOpacity
                    key={column}
                    style={st.modalItem}
                    onPress={() => toggleReportColumn(column)}
                    disabled={locked}
                  >
                    <Text style={st.modalItemText}>{column}{locked ? ' (Required)' : ''}</Text>
                    <MaterialIcons
                      name={checked ? 'check-box' : 'check-box-outline-blank'}
                      size={20}
                      color={checked ? DARK : MUTED}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={st.reportConfirmBtn} onPress={performPrint} disabled={selectedColumns.length === 0}>
              <Text style={st.reportBtnText}>Print</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="fade" visible={showEmailModal} onRequestClose={() => setShowEmailModal(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>Email</Text>
              <TouchableOpacity onPress={() => setShowEmailModal(false)} style={st.modalCloseBtn}>
                <MaterialIcons name="close" size={20} color={DARK} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {[
                ['to', 'To', 'Recipient email'],
                ['cc', 'Cc', 'Optional'],
                ['bcc', 'Bcc', 'Optional'],
                ['subject', 'Subject', 'Subject'],
              ].map(([field, label, placeholder]) => (
                <View key={field} style={st.emailField}>
                  <Text style={st.label}>{label}</Text>
                  <TextInput
                    style={st.input}
                    value={emailForm[field]}
                    onChangeText={(value) => setEmailForm((prev) => ({ ...prev, [field]: value }))}
                    placeholder={placeholder}
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                    keyboardType={field === 'subject' ? 'default' : 'email-address'}
                  />
                  {emailErrors[field] ? <Text style={st.fieldError}>{emailErrors[field]}</Text> : null}
                </View>
              ))}
              <View style={st.emailField}>
                <Text style={st.label}>Message</Text>
                <TextInput
                  style={[st.input, st.emailMessage]}
                  value={emailForm.content}
                  onChangeText={(value) => setEmailForm((prev) => ({ ...prev, content: value }))}
                  multiline
                  textAlignVertical="top"
                />
                {emailErrors.content ? <Text style={st.fieldError}>{emailErrors.content}</Text> : null}
              </View>
              <Text style={st.reportHint}>Columns included in the CSV attachment</Text>
              {LOOKUP_COLUMNS.map((column) => {
                const locked = isMandatoryLookupColumn(column);
                const checked = selectedColumns.includes(column);
                return (
                  <TouchableOpacity
                    key={column}
                    style={st.modalItem}
                    onPress={() => toggleReportColumn(column)}
                    disabled={locked}
                  >
                    <Text style={st.modalItemText}>{column}{locked ? ' (Required)' : ''}</Text>
                    <MaterialIcons
                      name={checked ? 'check-box' : 'check-box-outline-blank'}
                      size={20}
                      color={checked ? DARK : MUTED}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={st.reportConfirmBtn} onPress={sendLookupEmail} disabled={isExporting}>
              <Text style={st.reportBtnText}>{isExporting ? 'Sending...' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <SuccessDialog
        visible={Boolean(reportNotice)}
        variant={reportNotice?.variant || 'success'}
        title={reportNotice?.title}
        message={reportNotice?.message}
        onClose={() => setReportNotice(null)}
      />

      <SelectModal
        visible={activeModal === 'programEnrolled'}
        title="Program Enrolled"
        options={[
          { value: '', label: '-- Select --' },
          ...((hasRpm && hasCcm) || (!hasRpm && !hasCcm) ? [{ value: PROGRAM_BOTH, label: 'Both' }] : []),
          ...(hasRpm || (!hasRpm && !hasCcm) ? [{ value: PROGRAM_RPM, label: 'RPM' }] : []),
          ...(hasCcm || (!hasRpm && !hasCcm) ? [{ value: PROGRAM_CCM, label: 'CCM' }] : []),
        ]}
        selectedValue={filters.programEnrolled}
        onSelect={(val) => setFilters((p) => ({ ...p, programEnrolled: val }))}
        onClose={() => setActiveModal(null)}
      />

      <SelectModal
        visible={activeModal === 'dobOperator'}
        title="Select DOB Operator"
        options={DOB_OPERATORS}
        selectedValue={filters.dobOperator}
        onSelect={(val) => setFilters((p) => ({ ...p, dobOperator: val, dobTo: val === 'between' ? p.dobTo : '' }))}
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
                ? (filters.dobOperator === 'between' ? 'Select DOB (from)' : 'Select Date of Birth')
                : 'Select DOB (to)'
        }
        value={parseIsoDate(
          showDatePicker === 'rpmStart'
            ? filters.rpmStartDate
            : showDatePicker === 'rpmEnd'
              ? filters.rpmEndDate
              : showDatePicker === 'dobFrom'
                ? filters.dobFrom
                : filters.dobTo
        ) || new Date()}
        minimumDate={
          showDatePicker === 'rpmEnd'
            ? parseIsoDate(filters.rpmStartDate) || undefined
            : showDatePicker === 'dobTo'
              ? parseIsoDate(filters.dobFrom) || undefined
              : undefined
        }
        maximumDate={new Date()}
        onClose={() => setShowDatePicker(null)}
        onConfirm={(date) => {
          const formattedIso = toLocalIsoDate(date);
          if (showDatePicker === 'rpmStart') {
            setFilters((prev) => ({
              ...prev,
              rpmStartDate: formattedIso,
              rpmEndDate: prev.rpmEndDate && prev.rpmEndDate < formattedIso ? '' : prev.rpmEndDate,
            }));
          } else if (showDatePicker === 'rpmEnd') {
            setFilters((prev) => ({ ...prev, rpmEndDate: formattedIso }));
          } else if (showDatePicker === 'dobFrom') {
            setFilters((prev) => ({
              ...prev,
              dobFrom: formattedIso,
              dobTo: prev.dobTo && prev.dobTo < formattedIso ? '' : prev.dobTo,
            }));
          } else if (showDatePicker === 'dobTo') {
            setFilters((prev) => ({ ...prev, dobTo: formattedIso }));
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
    paddingHorizontal: scaleWidth(12),
    paddingVertical: 10,
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 8,
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
    fontSize: scaleFont(16),
    fontWeight: '800',
    color: DARK,
    flexShrink: 1,
  },
  headerSearch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  headerSearchLabel: {
    fontSize: scaleFont(13),
    fontWeight: '500',
    color: '#333333',
  },
  headerSearchField: {
    flex: 1,
    maxWidth: 160,
    minWidth: 72,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  headerSearchInput: {
    height: 28,
    paddingVertical: 0,
    paddingLeft: 4,
    paddingRight: 18,
    fontSize: scaleFont(13),
    color: DARK,
  },
  headerSearchIcon: {
    position: 'absolute',
    right: 0,
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
  fieldHint: {
    fontSize: scaleFont(12),
    color: MUTED,
    marginBottom: 8,
    lineHeight: scaleFont(16),
  },
  dateEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateEntryInput: {
    flex: 1,
  },
  dateIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#03045E',
    borderWidth: 1,
    borderColor: '#03045E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: BORDER,
  },
  resetBtnText: {
    fontSize: scaleFont(14),
    fontWeight: '700',
    color: WHITE,
  },
  resetBtnTextDisabled: {
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
  reportBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  reportBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#03045E',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  reportBtnDisabled: {
    opacity: 0.45,
  },
  reportBtnText: {
    fontSize: scaleFont(13),
    fontWeight: '800',
    color: WHITE,
  },
  reportHint: {
    fontSize: scaleFont(12),
    color: MUTED,
    fontWeight: '600',
    marginBottom: 8,
  },
  reportConfirmBtn: {
    marginTop: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#03045E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailField: {
    marginBottom: 10,
  },
  emailMessage: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  fieldError: {
    marginTop: 4,
    color: '#dc3545',
    fontSize: scaleFont(11),
    fontWeight: '700',
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
  paginationBar: {
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  paginationInfo: {
    fontSize: scaleFont(12),
    fontWeight: '700',
    color: MUTED,
    textAlign: 'center',
    marginBottom: 8,
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paginationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F4F7FB',
  },
  paginationBtnDisabled: {
    opacity: 0.55,
  },
  paginationBtnText: {
    fontSize: scaleFont(13),
    fontWeight: '800',
    color: DARK,
  },
  paginationBtnTextDisabled: {
    color: '#A0AAB4',
  },
  paginationPageText: {
    fontSize: scaleFont(13),
    fontWeight: '800',
    color: DARK,
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
  pvPulseWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  pvVal: {
    fontSize: scaleFont(14),
    fontWeight: '800',
  },
  bpSlash: {
    fontSize: scaleFont(13),
    fontWeight: '700',
    color: '#64748b',
    marginHorizontal: 1,
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
