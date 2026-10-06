/**
 * FollowUp.js — Web-Matched Follow Up Screen
 *
 * Mirrors the web FollowUpQuery.jsx logic:
 * - Role-based behaviour (Super Admin, System Caregiver, Practice Admin, Provider, Caregiver)
 * - Program Enrolled detection (RPM / CCM / Both) via practice summary
 * - Conditional RPM-only filters (vitals, serial #)
 * - Super Admin: calls getFollowUpQuery → follow-up rows
 * - Non-admin: calls getPracticePatientsFilteredByProgramTab → patient rows
 * - Applied-filters snapshot pattern
 * - DOB validation
 * - RPM / CCM result tabs when "Both" is selected
 * - PatientHub-identical Add Follow Up modal
 */

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
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../services/apiService';
import { formatLastFirstName } from '../../utils/formatPersonName';
import DatePickerModal from '../../components/common/DatePickerModal';
import SuccessDialog from '../../components/common/SuccessDialog';
import {
  DEFAULT_VITAL_TARGETS,
  checkPulseValue,
  getVitalColor,
  MEASUREMENT_COLORS,
  normalizeWeightToLbs,
} from '../../utils/measurementUtils';
import PulseIcon from '../../components/common/PulseIcon';

const { width } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const scaleWidth = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.25);
const scaleFont = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.2);

const DARK = '#0b1f3f';
const MUTED = '#687382';
const BORDER = '#e8ecf0';
const WHITE = '#ffffff';

const PROGRAM_BOTH = 'both';
const PROGRAM_RPM = 'rpm';
const PROGRAM_CCM = 'ccm';
const PROGRAM_SELECT = '';

const VITAL_TARGETS = DEFAULT_VITAL_TARGETS;

const RPM_SERVICE_TYPES = ['General', 'Call via others'];
const CCM_SERVICE_TYPES = [
  'Care plan review', 'Medication management', 'Patient education',
  'Care coordination', 'Symptom / condition follow-up', 'Other',
];
const STATUS_OPTIONS = ['Continue follow up', 'No need to follow up'];

const STATUS_FILTER_OPTIONS = [
  { value: '', label: '-- All Statuses --' },
  { value: '2', label: 'Active' },
  { value: '3', label: 'Pending' },
  { value: '4', label: 'Locked' },
];

const DOB_OPERATORS = [
  { value: '', label: '-- Select DOB Operator --' },
  { value: 'on', label: 'On' },
  { value: 'onOrBefore', label: 'On or before' },
  { value: 'onOrAfter', label: 'On or after' },
  { value: 'between', label: 'Between' },
];

const VITALS_OPTIONS = [
  { value: '1', label: 'Blood Pressure (BP)' },
  { value: '2', label: 'Blood Glucose (BG)' },
  { value: '3', label: 'Weight (WT)' },
];

const PROGRAM_OPTIONS = [
  { value: PROGRAM_SELECT, label: '-- Select --' },
  { value: PROGRAM_BOTH, label: 'Both' },
  { value: PROGRAM_RPM, label: 'RPM' },
  { value: PROGRAM_CCM, label: 'CCM' },
];

const FALLBACK_TEMPLATES = [
  { id: 'fallback-1', name: 'Normal BP', template: 'Blood pressure is within normal range. Patient educated on maintaining healthy lifestyle, diet, and exercise. Continue current medication regimen. Follow up in 30 days or sooner if symptoms arise.' },
  { id: 'fallback-2', name: 'Emergency Follow-up', template: 'Emergency protocol initiated. Patient reported critical vitals. Immediate care coordination performed. Provider notified. Patient advised to seek emergency care if symptoms worsen. Follow up within 24 hours.' },
  { id: 'fallback-3', name: 'High Blood Pressure', template: 'Patient reported elevated blood pressure readings. Medication adherence reviewed and reinforced. Dietary and lifestyle modifications discussed. Provider notified of persistent hypertension. Follow up in 7 days.' },
  { id: 'fallback-4', name: 'General RPM Check-in', template: 'Routine RPM follow-up completed. Vital signs reviewed. Patient reports feeling well. No significant changes noted. Continue current care plan. Follow up as scheduled.' },
  { id: 'fallback-5', name: 'Medication Adherence', template: 'Patient contacted regarding medication adherence. Barriers to medication use identified and addressed. Pharmacy coordination completed if needed. Patient verbalized understanding of medication importance. Follow up in 14 days.' },
];

const toLocalYmd = (date) => {
  const d = date instanceof Date ? date : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getTodayYmd = () => toLocalYmd(new Date());

const getCurrentTimeHm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const formatFollowUpTimerDisplay = (totalSeconds) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const parseYmdToDate = (ymdStr) => {
  if (!ymdStr) return new Date();
  const parts = ymdStr.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  return new Date();
};

const parseHmToDate = (hmStr) => {
  if (!hmStr) return new Date();
  const parts = hmStr.split(':');
  if (parts.length >= 2) {
    const d = new Date();
    d.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
    return d;
  }
  return new Date();
};

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const normalizeProgramKey = (value) => String(value || '').trim().toLowerCase();

const extractEnrolledPrograms = (summaryPayload) => {
  const data = summaryPayload?.data?.data ?? summaryPayload?.data ?? summaryPayload;
  const enrolled = data?.enrolled_programs;
  if (!Array.isArray(enrolled)) return [];
  return enrolled
    .map((p) => normalizeProgramKey(typeof p === 'string' ? p : (p.short_name || p.id || p.label || '')))
    .filter(Boolean);
};

const extractPatientsPayload = (response) => {
  const payload = response?.data;
  let patientsData = [];
  let pagination = { total: 0 };
  if (payload) {
    if (payload?.success && Array.isArray(payload?.data?.patients)) patientsData = payload.data.patients;
    else if (payload?.success && Array.isArray(payload?.data?.data)) patientsData = payload.data.data;
    else if (payload?.success && Array.isArray(payload?.data)) patientsData = payload.data;
    else if (Array.isArray(payload?.patients)) patientsData = payload.patients;
    else if (Array.isArray(payload?.data)) patientsData = payload.data;
    pagination = payload?.data?.pagination || payload?.pagination || { total: 0 };
  }
  return { patients: Array.isArray(patientsData) ? patientsData : [], total: pagination.total || 0 };
};

const extractFollowUpResults = (response) => {
  const rows = Array.isArray(response?.data?.data?.results)
    ? response.data.data.results
    : Array.isArray(response?.data?.results)
      ? response.data.results
      : Array.isArray(response?.data?.data)
        ? response.data.data
        : Array.isArray(response?.data)
          ? response.data
          : [];
  return (Array.isArray(rows) ? rows : []).map((fu) => ({
    ...fu,
    id: fu.id,
    patient_id: fu.patient_id,
    practice_id: fu.practice_id,
    patient_name: fu.patient_name || 'N/A',
    status: fu.status ?? fu.patient_status ?? 2,
    date_time: fu.date_time || null,
    date: fu.date || fu.date_time || null,
    time: fu.time || fu.raw_time || null,
    created_at: fu.created_at || null,
    fu_note_content: fu.fu_note_content || '',
    service_time: Number(fu.service_time ?? fu.total_service_time ?? 0) || 0,
    caregiver_provider: fu.caregiver_provider || 'N/A',
  }));
};

const filterFollowUpRows = (rows, filters = {}) => {
  const last = String(filters.lastName || '').trim().toLowerCase();
  const first = String(filters.firstName || '').trim().toLowerCase();
  const statusFilter = String(filters.status || '').trim();
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const fullName = String(row.patient_name || '').trim();
    const [lastPart = '', firstPart = ''] = fullName.split(',').map((p) => p.trim());
    if (last) {
      const hay = lastPart.toLowerCase() || fullName.toLowerCase();
      if (!hay.startsWith(last) && !hay.includes(last)) return false;
    }
    if (first) {
      const hay = firstPart.toLowerCase() || fullName.toLowerCase();
      if (!hay.startsWith(first) && !hay.includes(first)) return false;
    }
    if (statusFilter) {
      const sid = String(row.status ?? row.status_id ?? row.patient_status ?? '');
      if (sid !== statusFilter) return false;
    }
    return true;
  });
};

const FollowUpServiceTimer = React.memo(({ initialSeconds, accentColor, active }) => {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!active) return;
    setSeconds(initialSeconds);
    setRunning(true);
  }, [active, initialSeconds]);

  useEffect(() => {
    if (!active || !running) return undefined;
    const intervalId = setInterval(() => setSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(intervalId);
  }, [active, running]);

  return (
    <View style={st.serviceTimeRow}>
      <Text style={[st.timerPreview, { color: accentColor }]}>
        {formatFollowUpTimerDisplay(seconds)}
      </Text>
      <TouchableOpacity
        style={[st.timerPlayBtnSmall, { backgroundColor: accentColor }]}
        onPress={() => setRunning((prev) => !prev)}
      >
        <MaterialIcons name={running ? 'pause' : 'play-arrow'} size={20} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
});

const emptyFollowUpFilters = () => ({
  lastName: '',
  firstName: '',
  phone: '',
  caregiver: '',
  provider: '',
  status: '',
  vitals: [],
  dobOperator: '',
  dobFrom: '',
  dobTo: '',
  serialNumber: '',
  programEnrolled: PROGRAM_SELECT,
});

const emptyAppliedFilters = () => ({
  lastName: '',
  firstName: '',
  provider: '',
  caregiver: '',
  status: '',
  vitals: '',
  serialNumber: '',
  phone: '',
  dobOperator: '',
  dobFrom: '',
  dobTo: '',
  programEnrolled: PROGRAM_SELECT,
});

/* Helper Functions for Vitals & Patient Display */
const toCleanNum = (val) => {
  if (val == null) return null;
  const cleaned = String(val).replace(/[^\d.-]/g, '');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
};

const kgToLb = (kg) => {
  const n = Number(kg);
  return Number.isFinite(n) ? n * 2.20462 : 0;
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
  let bp = (systolic != null && diastolic != null) ? `${Math.round(systolic)}/${Math.round(diastolic)}` : '--';
  let glucose = bgObj
    ? String(Math.round(bgObj.blood_glucose_value_1 || bgObj.value || 0))
    : (item.last_glucose ?? item.glucose ? String(Math.round(item.last_glucose ?? item.glucose)) : '--');

  let rawWt = wtObj ? (wtObj.weight || wtObj.weight_value || wtObj.value) : (item.last_weight ?? item.weight);
  let weightNum = toCleanNum(rawWt);
  let weight = weightNum != null && weightNum > 0 ? weightNum.toFixed(1) : '--';

  if (hasBp) {
    const bpMatch = summary.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
    const pulseMatch = summary.match(/\((\d{2,3})\)/);
    if (bpMatch) {
      bp = `${bpMatch[1]}/${bpMatch[2]}`;
      if (pulse == null && pulseMatch) pulse = toCleanNum(pulseMatch[1]);
    }
  }

  const readingsCount = Number(item.readings_count ?? item.number_of_readings ?? item.readings ?? 0) || 0;
  const serviceTime = Number(item.service_time ?? item.total_service_time ?? 0) || 0;

  return { bp, pulse: pulse != null ? Math.round(pulse) : null, glucose, weight, readingsCount, serviceTime };
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
    if (latest.weight || item.weight_measurement || item.weight) list.push('W');
  }
  const normalized = list.map((v) => {
    const lower = v.toLowerCase();
    if (lower.includes('pressure') || lower === 'bp') return 'BP';
    if (lower.includes('glucose') || lower === 'bg') return 'BG';
    if (lower.includes('weight') || lower === 'wt' || lower === 'w') return 'W';
    if (lower.includes('pulse') || lower === 'hr') return 'Pulse';
    return v;
  });
  const unique = Array.from(new Set(normalized));
  return unique.length > 0 ? unique : ['BP'];
};

const patientDisplayName = (patient) =>
  patient?.patient_name || patient?.name ||
  `${patient?.last_name || ''}, ${patient?.first_name || ''}`.replace(/^,\s*|\s*,$/g, '').trim() ||
  'N/A';

const formatFollowUpDateTime = (fu) => {
  const dt = fu.date_time || fu.date;
  if (!dt) return 'N/A';
  try {
    const d = new Date(dt);
    if (isNaN(d.getTime())) return dt;
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return dt; }
};

const SelectModal = ({ visible, title, options, selectedValue, onSelect, onClose }) => {
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={st.modalContent} onStartShouldSetResponder={() => true}>
          <View style={st.modalSelectHeader}>
            <Text style={st.modalSelectTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={st.modalCloseBtn}>
              <MaterialIcons name="close" size={20} color={DARK} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
            {options.map((item) => {
              const isSelected = selectedValue === item.value;
              return (
                <TouchableOpacity
                  key={String(item.value || 'empty')}
                  style={[st.modalItem, isSelected && st.modalItemSelected]}
                  onPress={() => { onSelect(item.value); onClose(); }}
                  activeOpacity={0.7}
                >
                  <Text style={[st.modalItemText, isSelected && st.modalItemTextSelected]}>{item.label}</Text>
                  {isSelected ? <MaterialIcons name="check" size={20} color={DARK} /> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export default function FollowUp({ navigation, route }) {
  const initialPracticeId = route?.params?.practiceId || null;

  // --- Role detection ---
  const [user, setUser] = useState(null);
  const [roleId, setRoleId] = useState(0);
  const isSuperAdmin = roleId === 1;
  const isSystemCaregiver = roleId === 7;
  const isScopedRole = [3, 4, 5, 7].includes(roleId);

  const [practiceId, setPracticeId] = useState(initialPracticeId);
  const [practices, setPractices] = useState([]);
  const [assignedPractices, setAssignedPractices] = useState([]);
  const systemCaregiverMultiPractice = isSystemCaregiver && assignedPractices.length > 1;
  const showPracticeField = !isScopedRole || systemCaregiverMultiPractice || isSuperAdmin;

  const lockedPracticeId = useMemo(() => {
    if (!isScopedRole) return '';
    if (isSystemCaregiver && assignedPractices.length === 1) return String(assignedPractices[0].id);
    return practiceId || '';
  }, [isScopedRole, isSystemCaregiver, assignedPractices, practiceId]);

  const practiceDropdownList = useMemo(() => {
    if (isSystemCaregiver) return assignedPractices;
    return practices;
  }, [isSystemCaregiver, assignedPractices, practices]);

  // --- Program state ---
  const [hasRpm, setHasRpm] = useState(false);
  const [hasCcm, setHasCcm] = useState(false);
  const [programsLoading, setProgramsLoading] = useState(false);
  const hasBoth = hasRpm && hasCcm;
  const showProgramEnrolled = hasBoth;

  // --- Filters ---
  const [formData, setFormData] = useState(emptyFollowUpFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyAppliedFilters);
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState([]);
  const [totalPatients, setTotalPatients] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);
  const [activePracticeId, setActivePracticeId] = useState('');
  const [resultTab, setResultTab] = useState(PROGRAM_RPM);
  const latestRequestRef = useRef(0);

  const effectivePracticeId = useMemo(() => {
    if (systemCaregiverMultiPractice) return formData.practice || '';
    if (isScopedRole) return lockedPracticeId;
    return formData.practice || '';
  }, [systemCaregiverMultiPractice, isScopedRole, lockedPracticeId, formData.practice]);

  const showRpmFilters = useMemo(() => {
    if (!hasRpm && !hasCcm) return false;
    if (hasBoth) return formData.programEnrolled === PROGRAM_BOTH || formData.programEnrolled === PROGRAM_RPM;
    return hasRpm;
  }, [hasRpm, hasCcm, hasBoth, formData.programEnrolled]);

  const showResultTabs = hasQueried && hasBoth && appliedFilters.programEnrolled === PROGRAM_BOTH;

  const activeResultProgram = useMemo(() => {
    if (showResultTabs) return resultTab;
    if (hasBoth) {
      if (appliedFilters.programEnrolled === PROGRAM_CCM) return PROGRAM_CCM;
      if (appliedFilters.programEnrolled === PROGRAM_RPM) return PROGRAM_RPM;
      return resultTab;
    }
    if (hasCcm && !hasRpm) return PROGRAM_CCM;
    return PROGRAM_RPM;
  }, [showResultTabs, resultTab, hasBoth, hasCcm, hasRpm, appliedFilters.programEnrolled]);

  // --- Care team ---
  const [caregivers, setCaregivers] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);

  // --- Filter Modals ---
  const [activeModal, setActiveModal] = useState(null);
  const [showDobFromPicker, setShowDobFromPicker] = useState(false);
  const [showDobToPicker, setShowDobToPicker] = useState(false);

  // --- Add Follow Up Modal ---
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpSuccess, setFollowUpSuccess] = useState(null);
  const [zeroMinutesNotice, setZeroMinutesNotice] = useState(false);
  const followUpSuccessTimerRef = useRef(null);

  useEffect(() => () => {
    if (followUpSuccessTimerRef.current) clearTimeout(followUpSuccessTimerRef.current);
  }, []);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [followUpForm, setFollowUpForm] = useState({
    serviceType: 'General', followUpStatus: 'Continue follow up', assignTo: '',
    manualMinutes: '', manualSeconds: '', date: getTodayYmd(), time: getCurrentTimeHm(),
    templateId: '', content: '',
  });
  const [showServiceTypeDropdown, setShowServiceTypeDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showAssignToDropdown, setShowAssignToDropdown] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showFollowUpDatePicker, setShowFollowUpDatePicker] = useState(false);
  const [showFollowUpTimePicker, setShowFollowUpTimePicker] = useState(false);
  const [submittingFollowUp, setSubmittingFollowUp] = useState(false);
  const [clinicalTemplates, setClinicalTemplates] = useState(FALLBACK_TEMPLATES);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const followUpScrollRef = useRef(null);
  const hasInitializedRef = useRef(false);

  // === Initialization ===
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    (async () => {
      let pId = practiceId;
      let userObj = null;
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        userObj = JSON.parse(userStr);
        setUser(userObj);
        const rid = Number(userObj?.role_id ?? 0);
        setRoleId(rid);
        if (!pId) pId = userObj.practice_id || userObj.practiceId;
      }
      if (!pId) pId = await AsyncStorage.getItem('practiceId');

      const rid = Number(userObj?.role_id ?? 0);
      const _isSuperAdmin = rid === 1;
      const _isSystemCaregiver = rid === 7;
      const _isScopedRole = [3, 4, 5, 7].includes(rid);

      if (_isSystemCaregiver && userObj?.id) {
        try {
          const res = await apiService.getAssignedPracticesForSystemCaregiver(userObj.id);
          const assigned = res?.data?.data || res?.data || [];
          setAssignedPractices(Array.isArray(assigned) ? assigned : []);
          if (Array.isArray(assigned) && assigned.length === 1) {
            pId = String(assigned[0].id);
            setFormData((prev) => ({ ...prev, practice: pId }));
          }
        } catch (e) {
          console.warn('Error loading assigned practices:', e);
          setAssignedPractices([]);
        }
      } else if (!_isScopedRole || _isSuperAdmin) {
        try {
          const res = await apiService.getPractices({ limit: 1000, page: 1 });
          let list = res?.data?.data?.practices || res?.data?.data || res?.data?.practices || res?.data || [];
          if (!Array.isArray(list)) list = [];
          const unique = list.filter((p, i, self) => i === self.findIndex((x) => x.id === p.id));
          setPractices(unique);
        } catch (e) {
          console.warn('Error loading practices:', e);
          setPractices([]);
        }
      }

      if (pId) {
        setPracticeId(String(pId));
        setFormData((prev) => ({ ...prev, practice: String(pId) }));
        loadCareTeam(String(pId));
        loadPracticePrograms(String(pId));
        loadTemplates(String(pId));
      }
    })();
  }, []);

  const loadPracticePrograms = useCallback(async (pId) => {
    if (!pId) { setHasRpm(false); setHasCcm(false); return; }
    setProgramsLoading(true);
    try {
      const response = await apiService.getPracticeSummary(pId);
      const programs = extractEnrolledPrograms(response);
      const rpm = programs.some((p) => p === PROGRAM_RPM);
      const ccm = programs.some((p) => p === PROGRAM_CCM);
      setHasRpm(rpm);
      setHasCcm(ccm);
      setFormData((prev) => ({
        ...prev,
        programEnrolled: rpm && ccm ? PROGRAM_SELECT : rpm ? PROGRAM_RPM : ccm ? PROGRAM_CCM : PROGRAM_SELECT,
      }));
      setResultTab(PROGRAM_RPM);
    } catch (e) {
      console.warn('Error loading practice programs:', e);
      setHasRpm(false);
      setHasCcm(false);
    } finally {
      setProgramsLoading(false);
    }
  }, []);

  const loadCareTeam = async (pId) => {
    try {
      setLoadingDropdowns(true);
      const [providersRes, caregiversRes] = await Promise.all([
        apiService.getPracticeProviders(pId).catch(() => null),
        apiService.getPracticeCaregivers(pId).catch(() => null),
      ]);

      let providersData = providersRes?.data?.data?.providers || providersRes?.data?.providers || providersRes?.data?.data || providersRes?.data || [];
      if (!Array.isArray(providersData)) providersData = [];
      const uniqueProviders = providersData
        .filter((p, i, self) => p && i === self.findIndex((x) => x && x.id === p.id))
        .map((p) => ({
          id: p.id, value: String(p.id),
          label: `${p.last_name || ''}, ${p.first_name || ''}`.replace(/^,\s*|\s*,$/g, '').trim() || p.name || `Provider #${p.id}`,
          name: formatLastFirstName(p) || p.name || p.full_name,
        }));

      let caregiversData = caregiversRes?.data?.data?.caregivers || caregiversRes?.data?.caregivers || caregiversRes?.data?.data || caregiversRes?.data || [];
      if (!Array.isArray(caregiversData)) caregiversData = [];
      const uniqueCaregivers = caregiversData
        .filter((c, i, self) => c && i === self.findIndex((x) => x && x.id === c.id))
        .map((c) => ({
          id: c.id, value: String(c.id),
          label: `${c.last_name || ''}, ${c.first_name || ''}`.replace(/^,\s*|\s*,$/g, '').trim() || c.name || `Caregiver #${c.id}`,
          name: formatLastFirstName(c) || c.name || c.full_name,
        }));

      setProviders(uniqueProviders);
      setCaregivers(uniqueCaregivers);
    } catch (e) {
      console.warn('Error loading care team:', e);
    } finally {
      setLoadingDropdowns(false);
    }
  };

  const loadTemplates = async (pId) => {
    setLoadingTemplates(true);
    try {
      const res = await apiService.getFollowUpTemplates().catch(() => null);
      const list = res?.data?.data || res?.data?.templates || res?.data || [];
      if (Array.isArray(list) && list.length > 0) setClinicalTemplates(list);
      else setClinicalTemplates(FALLBACK_TEMPLATES);
    } catch { setClinicalTemplates(FALLBACK_TEMPLATES); }
    finally { setLoadingTemplates(false); }
  };

  // When practice changes in dropdown, reload providers/caregivers/programs
  useEffect(() => {
    if (!formData.practice) return;
    if (isScopedRole && !systemCaregiverMultiPractice && !isSuperAdmin) return;
    loadCareTeam(formData.practice);
    loadPracticePrograms(formData.practice);
  }, [formData.practice, isScopedRole, systemCaregiverMultiPractice, isSuperAdmin, loadPracticePrograms]);

  // Single-program auto-query (matches web)
  useEffect(() => {
    if (programsLoading || hasQueried) return;
    const pId = effectivePracticeId;
    if (!pId) return;
    const singleProgram = hasRpm && !hasCcm ? PROGRAM_RPM : !hasRpm && hasCcm ? PROGRAM_CCM : null;
    if (!singleProgram) return;

    setFormData((prev) => ({ ...prev, programEnrolled: singleProgram }));
    setResultTab(singleProgram === PROGRAM_CCM ? PROGRAM_CCM : PROGRAM_RPM);
    setHasQueried(true);
    setActivePracticeId(String(pId));
    setAppliedFilters({ ...emptyAppliedFilters(), programEnrolled: singleProgram });
  }, [programsLoading, hasQueried, effectivePracticeId, hasRpm, hasCcm]);

  // === Data fetching (matches web patterns) ===
  const fetchPatientsForProgram = useCallback(async (pId, program, filterOverride = null) => {
    if (!pId || !program) return;
    const requestId = ++latestRequestRef.current;
    setLoading(true);
    setPatients([]);
    setTotalPatients(0);
    try {
      const sourceFilters = filterOverride || appliedFilters;
      const params = {
        program: String(program).toLowerCase(),
        page: 1, limit: 500,
        status: sourceFilters.status || '',
        lastName: sourceFilters.lastName || '',
        firstName: sourceFilters.firstName || '',
        providerId: sourceFilters.provider || '',
        caregiverId: sourceFilters.caregiver || '',
        phone: sourceFilters.phone || '',
        dobOperator: sourceFilters.dobOperator || '',
        dobFrom: sourceFilters.dobFrom || '',
        dobTo: sourceFilters.dobTo || '',
      };
      if (String(program).toLowerCase() === PROGRAM_RPM) {
        params.vitals = sourceFilters.vitals || '';
        params.serialNumber = sourceFilters.serialNumber || '';
      }

      const response = await apiService.getPracticePatientsFilteredByProgramTab(pId, params);
      const { patients: data, total } = extractPatientsPayload(response);
      if (requestId !== latestRequestRef.current) return;
      setPatients(data);
      setTotalPatients(total || data.length);
    } catch (err) {
      console.warn('Error fetching patients:', err);
      if (requestId !== latestRequestRef.current) return;
      setPatients([]);
      setTotalPatients(0);
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  }, [appliedFilters]);

  const fetchSuperAdminFollowUps = useCallback(async (pId, filterOverride = null) => {
    if (!pId) return;
    const requestId = ++latestRequestRef.current;
    setLoading(true);
    setPatients([]);
    setTotalPatients(0);
    try {
      const sf = filterOverride || appliedFilters;
      const response = await apiService.getFollowUpQuery({
        practiceId: pId, page: 1, limit: 5000,
        ...(sf.provider ? { provider: sf.provider } : {}),
        ...(sf.caregiver ? { caregiver: sf.caregiver } : {}),
        ...(sf.lastName ? { lastName: sf.lastName } : {}),
        ...(sf.firstName ? { firstName: sf.firstName } : {}),
        ...(sf.status ? { status: sf.status } : {}),
        ...(sf.phone ? { phone: sf.phone } : {}),
        ...(sf.dobOperator ? { dobOperator: sf.dobOperator } : {}),
        ...(sf.dobFrom ? { dobFrom: sf.dobFrom } : {}),
        ...(sf.dobTo ? { dobTo: sf.dobTo } : {}),
      });
      let rows = extractFollowUpResults(response);

      const needsIntersect = Boolean(sf.vitals) || Boolean(sf.serialNumber);
      if (needsIntersect) {
        const programForVitals = sf.programEnrolled === PROGRAM_CCM ? PROGRAM_CCM : PROGRAM_RPM;
        const patientRes = await apiService.getPracticePatientsFilteredByProgramTab(pId, {
          program: programForVitals, page: 1, limit: 10000,
          status: sf.status || '', lastName: sf.lastName || '', firstName: sf.firstName || '',
          providerId: sf.provider || '', caregiverId: sf.caregiver || '',
          phone: sf.phone || '', dobOperator: sf.dobOperator || '',
          dobFrom: sf.dobFrom || '', dobTo: sf.dobTo || '',
          vitals: sf.vitals || '', serialNumber: sf.serialNumber || '',
        });
        const { patients: matched } = extractPatientsPayload(patientRes);
        const allowedIds = new Set((matched || []).map((p) => String(p.id ?? p.patient_id)).filter(Boolean));
        rows = rows.filter((row) => allowedIds.has(String(row.patient_id)));
      }

      rows = filterFollowUpRows(rows, sf);
      if (requestId !== latestRequestRef.current) return;
      setPatients(rows);
      setTotalPatients(rows.length);
    } catch (err) {
      console.warn('Error fetching follow-ups:', err);
      if (requestId !== latestRequestRef.current) return;
      setPatients([]);
      setTotalPatients(0);
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  }, [appliedFilters]);

  // Re-fetch when applied filters / tab changes
  useEffect(() => {
    if (!hasQueried || !activePracticeId) return;
    if (isSuperAdmin) {
      fetchSuperAdminFollowUps(activePracticeId, appliedFilters);
    } else if (activeResultProgram) {
      fetchPatientsForProgram(activePracticeId, activeResultProgram, appliedFilters);
    }
  }, [hasQueried, activePracticeId, isSuperAdmin, activeResultProgram, appliedFilters, fetchSuperAdminFollowUps, fetchPatientsForProgram]);

  // === Handlers ===
  const todayIso = useMemo(() => getTodayYmd(), []);

  const handlePracticeChange = (value) => {
    setFormData((prev) => ({
      ...prev, practice: value, provider: '', caregiver: '',
      programEnrolled: PROGRAM_SELECT, vitals: [], serialNumber: '',
      phone: '', dobOperator: '', dobFrom: '', dobTo: '',
    }));
    setHasQueried(false);
    setPatients([]);
    setTotalPatients(0);
    setActivePracticeId('');
    setHasRpm(false);
    setHasCcm(false);
  };

  const handleQuery = () => {
    const pId = effectivePracticeId;
    if (!pId) {
      Alert.alert('Required', 'Practice is required');
      return;
    }
    if (hasBoth && !formData.programEnrolled) {
      Alert.alert('Required', 'Program Enrolled is required');
      return;
    }

    // DOB validation (matches web)
    if (formData.dobOperator) {
      if (!formData.dobFrom) {
        Alert.alert('Validation', 'Date of birth is required for the selected DOB filter');
        return;
      }
      if (formData.dobFrom > todayIso) {
        Alert.alert('Validation', 'Date of birth cannot be in the future');
        return;
      }
      if (formData.dobOperator === 'between') {
        if (!formData.dobTo) {
          Alert.alert('Validation', 'DOB (to) is required when using Between');
          return;
        }
        if (formData.dobTo > todayIso) {
          Alert.alert('Validation', 'DOB (to) cannot be in the future');
          return;
        }
        if (formData.dobTo < formData.dobFrom) {
          Alert.alert('Validation', 'DOB (to) must be on or after DOB (from)');
          return;
        }
      }
    } else if (formData.dobFrom || formData.dobTo) {
      Alert.alert('Validation', 'Select a DOB operator (On, On or before, On or after, or Between)');
      return;
    }

    const programEnrolled = isSuperAdmin
      ? formData.programEnrolled || PROGRAM_SELECT
      : hasBoth ? formData.programEnrolled
        : hasRpm ? PROGRAM_RPM : hasCcm ? PROGRAM_CCM : formData.programEnrolled;

    const nextApplied = {
      lastName: formData.lastName || '',
      firstName: formData.firstName || '',
      provider: formData.provider || '',
      caregiver: formData.caregiver || '',
      status: formData.status || '',
      vitals: Array.isArray(formData.vitals) ? formData.vitals.join(',') : (formData.vitals || ''),
      serialNumber: formData.serialNumber || '',
      phone: formData.phone || '',
      dobOperator: formData.dobOperator || '',
      dobFrom: formData.dobFrom || '',
      dobTo: formData.dobOperator === 'between' ? (formData.dobTo || '') : '',
      programEnrolled,
    };

    if (!isSuperAdmin && programEnrolled === PROGRAM_BOTH) setResultTab(PROGRAM_CCM);
    setHasQueried(true);
    setActivePracticeId(String(pId));
    setAppliedFilters(nextApplied);
  };

  const handleReset = () => {
    const fresh = {
      ...emptyFollowUpFilters(),
      practice: systemCaregiverMultiPractice ? '' : isScopedRole ? lockedPracticeId : (isSuperAdmin ? '' : formData.practice),
      programEnrolled: hasBoth ? PROGRAM_SELECT : hasRpm ? PROGRAM_RPM : hasCcm ? PROGRAM_CCM : PROGRAM_SELECT,
    };
    setFormData(fresh);
    setPatients([]);
    setSearchQuery('');
    setHasQueried(false);
    setTotalPatients(0);
    setActivePracticeId('');
    setResultTab(PROGRAM_RPM);
    setAppliedFilters(emptyAppliedFilters());
    if (!isScopedRole || systemCaregiverMultiPractice) {
      setHasRpm(false);
      setHasCcm(false);
      setProviders([]);
      setCaregivers([]);
    } else if (lockedPracticeId) {
      loadPracticePrograms(lockedPracticeId);
    }
  };

  const toggleVitalFilter = (vVal) => {
    setFormData((p) => {
      let current = Array.isArray(p.vitals) ? [...p.vitals] : (p.vitals ? String(p.vitals).split(',') : []);
      if (current.includes(vVal)) current = current.filter((x) => x !== vVal);
      else current.push(vVal);
      return { ...p, vitals: current };
    });
  };

  const getVitalsLabel = () => {
    if (!formData.vitals || formData.vitals.length === 0) return '-- Select Vitals --';
    const arr = Array.isArray(formData.vitals) ? formData.vitals : String(formData.vitals).split(',').filter(Boolean);
    return `${arr.length} selected`;
  };

  const getDobOperatorLabel = () => {
    const found = DOB_OPERATORS.find((d) => d.value === formData.dobOperator);
    return found ? found.label : '-- Select DOB Operator --';
  };

  // Search filter on results
  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return patients;
    const q = searchQuery.toLowerCase().trim();
    return patients.filter((p) => {
      const name = patientDisplayName(p).toLowerCase();
      const phone = String(p.phone || p.phone_number || p.cell_phone_number || '').toLowerCase();
      const note = String(p.fu_note_content || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || note.includes(q);
    });
  }, [patients, searchQuery]);

  // === Add Follow Up Modal ===
  const openFollowUpModal = (patient) => {
    setSelectedPatient(patient);
    setFollowUpForm({
      serviceType: 'General', followUpStatus: 'Continue follow up', assignTo: '',
      manualMinutes: '', manualSeconds: '', date: getTodayYmd(), time: getCurrentTimeHm(),
      templateId: '', content: '',
    });
    setShowServiceTypeDropdown(false);
    setShowStatusDropdown(false);
    setShowAssignToDropdown(false);
    setShowTemplatePicker(false);
    setShowFollowUpDatePicker(false);
    setShowFollowUpTimePicker(false);
    setShowFollowUpModal(true);
  };

  const closeFollowUpModal = () => {
    setShowFollowUpModal(false);
    setShowServiceTypeDropdown(false);
    setShowStatusDropdown(false);
    setShowAssignToDropdown(false);
    setShowTemplatePicker(false);
    setShowFollowUpDatePicker(false);
    setShowFollowUpTimePicker(false);
    setZeroMinutesNotice(false);
  };

  const showFollowUpSuccess = (title, message) => {
    closeFollowUpModal();
    if (followUpSuccessTimerRef.current) clearTimeout(followUpSuccessTimerRef.current);
    // Let the add-follow-up modal finish closing before presenting the next one.
    // Android drops a second Modal opened in the same frame.
    followUpSuccessTimerRef.current = setTimeout(() => {
      setFollowUpSuccess({ title, message });
    }, 280);
  };

  const handleManualTimeChange = (field, text) => {
    setFollowUpForm((prev) => ({ ...prev, [field]: text.replace(/[^0-9]/g, '') }));
  };

  const handleTemplateSelect = (templateId) => {
    if (!templateId) {
      setFollowUpForm((prev) => ({ ...prev, templateId: '', content: '' }));
      setShowTemplatePicker(false);
      return;
    }
    const tmpl = clinicalTemplates.find((t) => String(t.id) === String(templateId));
    if (tmpl) {
      setFollowUpForm((prev) => ({ ...prev, templateId: String(tmpl.id), content: tmpl.template || tmpl.content || tmpl.note || '' }));
    }
    setShowTemplatePicker(false);
  };

  const handleFollowUpDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowFollowUpDatePicker(false);
    if (selectedDate) {
      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const d = String(selectedDate.getDate()).padStart(2, '0');
      setFollowUpForm((prev) => ({ ...prev, date: `${y}-${m}-${d}` }));
    }
  };

  const handleFollowUpTimeChange = (event, selectedTime) => {
    if (Platform.OS === 'android') setShowFollowUpTimePicker(false);
    if (selectedTime) {
      const h = String(selectedTime.getHours()).padStart(2, '0');
      const m = String(selectedTime.getMinutes()).padStart(2, '0');
      setFollowUpForm((prev) => ({ ...prev, time: `${h}:${m}` }));
    }
  };

  const handleFollowUpSubmit = async () => {
    if (!selectedPatient) return;
    if (!followUpForm.content.trim()) {
      Alert.alert('Required Field', 'Please enter follow-up content.');
      return;
    }

    const patientId = selectedPatient.patient_id || selectedPatient.patient_table_id || selectedPatient.id;
    const submitPracticeId = selectedPatient.practice_id || activePracticeId || effectivePracticeId || practiceId;
    if (!patientId || !submitPracticeId) {
      Alert.alert('Error', 'Patient or Practice ID missing.');
      return;
    }

    const manualMins = parseInt(followUpForm.manualMinutes || '0', 10) || 0;
    const manualSecs = Math.min(59, parseInt(followUpForm.manualSeconds || '0', 10) || 0);
    if (manualMins < 1) {
      setZeroMinutesNotice(true);
      return;
    }

    setSubmittingFollowUp(true);
    try {
      const totalSeconds = manualMins * 60 + manualSecs;
      const payload = {
        service_type: followUpForm.serviceType,
        status: followUpForm.followUpStatus,
        fu_note_content: followUpForm.content.trim(),
        content: followUpForm.content.trim(),
        service_time: manualMins,
        service_time_seconds: totalSeconds,
        date_time: `${followUpForm.date}T${followUpForm.time}:00`,
        date: followUpForm.date,
        time: followUpForm.time,
        caregiver_id: followUpForm.assignTo || undefined,
      };

      await apiService.createFollowUp(submitPracticeId, patientId, payload);
      showFollowUpSuccess('Success', 'Follow up saved successfully.');

      // Refresh results
      if (hasQueried && activePracticeId) {
        if (isSuperAdmin) fetchSuperAdminFollowUps(activePracticeId, appliedFilters);
        else if (activeResultProgram) fetchPatientsForProgram(activePracticeId, activeResultProgram, appliedFilters);
      }
    } catch (e) {
      console.warn('Error saving follow up:', e);
      const message = e?.message || 'Failed to save follow up note.';
      if (/cannot be 0/i.test(message)) {
        setZeroMinutesNotice(true);
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setSubmittingFollowUp(false);
    }
  };

  const selectedTemplate = useMemo(() => {
    if (!followUpForm.templateId) return null;
    return clinicalTemplates.find((t) => String(t.id) === String(followUpForm.templateId)) || null;
  }, [followUpForm.templateId, clinicalTemplates]);

  // === Render helpers ===
  const renderSuperAdminCard = (item) => {
    const statusMeta = getPatientStatusMeta(item.status);
    return (
      <TouchableOpacity
        key={String(item.id || Math.random())}
        style={st.patientCard}
        activeOpacity={0.8}
        onPress={() => openFollowUpModal(item)}
      >
        <View style={st.pcTop}>
          <View style={[st.statusBadgePill, { backgroundColor: statusMeta.bg }]}>
            <Text style={[st.statusBadgePillText, { color: statusMeta.color }]}>{statusMeta.letter}</Text>
          </View>
          <View style={st.pcInfo}>
            <Text style={st.pcName} numberOfLines={1}>{patientDisplayName(item)}</Text>
            <Text style={st.pcSubtitle} numberOfLines={1}>
              {formatFollowUpDateTime(item)} · {item.service_time || 0} min
            </Text>
          </View>
          <TouchableOpacity style={st.cardFollowUpBtn} onPress={() => openFollowUpModal(item)} activeOpacity={0.8}>
            <MaterialIcons name="add-comment" size={16} color={WHITE} />
            <Text style={st.cardFollowUpBtnText}>+ F/U</Text>
          </TouchableOpacity>
        </View>
        {item.fu_note_content ? (
          <View style={st.noteContentBox}>
            <Text style={st.noteContentText} numberOfLines={3}>{item.fu_note_content}</Text>
          </View>
        ) : null}
        <View style={st.pcExtraStatsRow}>
          <View style={st.pcExtraStatItem}>
            <MaterialIcons name="person" size={14} color="#687382" />
            <Text style={st.pcExtraStatLabel}>Caregiver/Provider:</Text>
            <Text style={st.pcExtraStatValue} numberOfLines={1}>{item.caregiver_provider || 'N/A'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCCMCard = (item) => {
    const statusMeta = getPatientStatusMeta(item.status ?? item.status_id ?? item.patient_status);
    const fullName = patientDisplayName(item);
    const dob = item.date_of_birth ? formatDisplayDate(item.date_of_birth) : 'N/A';
    const chronic = item.chronic_conditions || item.icd_codes || '';
    const chronicDisplay = Array.isArray(chronic) ? chronic.join(', ') : String(chronic || '');
    const lastActivity = item.last_activity_date ? formatDisplayDate(item.last_activity_date) : 'N/A';
    const serviceTime = item.service_time ?? 0;
    const billing = item.billing_status || 'Pending';
    const first = item.first_name || fullName.split(' ')[0] || 'P';
    const last = item.last_name || '';

    return (
      <TouchableOpacity
        key={String(item.id || item.patient_table_id || Math.random())}
        style={st.patientCard}
        activeOpacity={0.8}
        onPress={() => openFollowUpModal(item)}
      >
        <View style={st.pcTop}>
          <View style={st.avatarWrap}>
            <View style={st.pcAvatarSmall}>
              <Text style={st.pcAvatarTextSmall}>{first?.[0] || 'P'}{last?.[0] || ''}</Text>
            </View>
            <View style={[st.statusBadgeCorner, { backgroundColor: statusMeta.bg }]}>
              <Text style={[st.statusBadgeTextCorner, { color: statusMeta.color }]}>{statusMeta.letter}</Text>
            </View>
          </View>
          <View style={st.pcInfo}>
            <Text style={st.pcName} numberOfLines={1}>{fullName}</Text>
            <Text style={st.pcSubtitle} numberOfLines={1}>DOB: {dob}</Text>
          </View>
          <TouchableOpacity style={st.cardFollowUpBtn} onPress={() => openFollowUpModal(item)} activeOpacity={0.8}>
            <MaterialIcons name="add-comment" size={16} color={WHITE} />
            <Text style={st.cardFollowUpBtnText}>+ F/U</Text>
          </TouchableOpacity>
        </View>
        {chronicDisplay ? (
          <View style={st.noteContentBox}>
            <Text style={st.noteContentLabel}>Chronic Conditions</Text>
            <Text style={st.noteContentText} numberOfLines={2}>{chronicDisplay}</Text>
          </View>
        ) : null}
        <View style={st.pcExtraStatsRow}>
          <View style={st.pcExtraStatItem}>
            <MaterialIcons name="event" size={14} color="#687382" />
            <Text style={st.pcExtraStatLabel}>Last Activity:</Text>
            <Text style={st.pcExtraStatValue}>{lastActivity}</Text>
          </View>
          <View style={st.pcExtraStatItem}>
            <MaterialIcons name="schedule" size={14} color="#687382" />
            <Text style={st.pcExtraStatLabel}>Time:</Text>
            <Text style={st.pcExtraStatValue}>{serviceTime} min</Text>
          </View>
        </View>
        <View style={st.pcExtraStatsRow}>
          <View style={st.pcExtraStatItem}>
            <MaterialIcons name="receipt" size={14} color="#687382" />
            <Text style={st.pcExtraStatLabel}>Billing:</Text>
            <Text style={st.pcExtraStatValue}>{billing}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderRPMCard = (item) => {
    const fullName = patientDisplayName(item);
    const first = item.first_name || item.firstName || fullName.split(' ')[0] || 'P';
    const last = item.last_name || item.lastName || '';
    const vitals = getPatientVitalsDisplay(item);
    const vitalPills = getPatientVitalPills(item);
    const statusMeta = getPatientStatusMeta(item.status ?? item.status_id ?? item.patient_status);

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

    return (
      <View key={String(item.id || item.patient_table_id || Math.random())} style={st.patientCard}>
        <View style={st.pcTop}>
          <View style={st.avatarWrap}>
            <View style={st.pcAvatarSmall}>
              <Text style={st.pcAvatarTextSmall}>{first?.[0] || 'P'}{last?.[0] || ''}</Text>
            </View>
            <View style={[st.statusBadgeCorner, { backgroundColor: statusMeta.bg }]}>
              <Text style={[st.statusBadgeTextCorner, { color: statusMeta.color }]}>{statusMeta.letter}</Text>
            </View>
          </View>
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
          <TouchableOpacity style={st.cardFollowUpBtn} onPress={() => openFollowUpModal(item)} activeOpacity={0.8}>
            <MaterialIcons name="add-comment" size={16} color={WHITE} />
            <Text style={st.cardFollowUpBtnText}>+ F/U</Text>
          </TouchableOpacity>
        </View>
        <View style={st.pcVitals}>
          <View style={st.pcVital}>
            <Text style={st.pvLbl}>BP (mmHg)</Text>
            <View style={st.pvValueRow}>
              {hasSplitBp ? (
                <>
                  <Text style={[st.pvVal, { color: sysColor }]} numberOfLines={1}>{bpParts[0].trim()}</Text>
                  <Text style={st.bpSlash}>/</Text>
                  <Text style={[st.pvVal, { color: diaColor }]} numberOfLines={1}>{bpParts[1].trim()}</Text>
                </>
              ) : (
                <Text style={[st.pvVal, { color: MEASUREMENT_COLORS.missing }]} numberOfLines={1}>{vitals.bp}</Text>
              )}
              {vitals.pulse != null ? (
                <View style={st.pvPulseWrap}>
                  <Text style={[st.pvPulse, { color: pulseColor }]} numberOfLines={1}>{vitals.pulse}</Text>
                  <PulseIcon isAbnormal={isPulseAbnormal} size={scaleFont(11)} />
                </View>
              ) : null}
            </View>
          </View>
          <View style={st.pcVital}>
            <Text style={st.pvLbl}>BG (mg/dL)</Text>
            <Text style={[st.pvVal, { color: glucoseColor }]} numberOfLines={1}>{vitals.glucose}</Text>
          </View>
          <View style={st.pcVital}>
            <Text style={st.pvLbl}>WT (lbs)</Text>
            <Text style={[st.pvVal, { color: weightColor }]} numberOfLines={1}>{vitals.weight}</Text>
          </View>
        </View>
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
      </View>
    );
  };

  const renderPatientCard = (item) => {
    if (isSuperAdmin) return renderSuperAdminCard(item);
    if (activeResultProgram === PROGRAM_CCM) return renderCCMCard(item);
    return renderRPMCard(item);
  };

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={st.header}>
        <TouchableOpacity style={st.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={22} color={DARK} />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Follow Up Query</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Filter Card */}
        <View style={st.card}>
          <TouchableOpacity style={st.cardHeader} onPress={() => setIsFilterExpanded(!isFilterExpanded)} activeOpacity={0.8}>
            <View style={st.cardHeaderLeft}>
              <MaterialIcons name="filter-list" size={20} color={DARK} />
              <Text style={st.cardTitle}>Filter Patients for Follow Up</Text>
            </View>
            <MaterialIcons name={isFilterExpanded ? 'expand-less' : 'expand-more'} size={22} color={MUTED} />
          </TouchableOpacity>

          {isFilterExpanded && (
            <View style={st.formContainer}>
              {/* Practice dropdown (super admin / multi-practice) */}
              {showPracticeField && (
                <View style={[st.row, { marginBottom: 12 }]}>
                  <View style={st.fieldCol}>
                    <Text style={st.label}>Practice {systemCaregiverMultiPractice ? '*' : ''}</Text>
                    <TouchableOpacity
                      style={st.dropdownTrigger}
                      onPress={() => setActiveModal('practice')}
                      activeOpacity={0.75}
                    >
                      <Text style={[st.dropdownTriggerText, !formData.practice && { color: MUTED }]} numberOfLines={1}>
                        {practiceDropdownList.find((p) => String(p.id) === String(formData.practice))?.practice_name
                          || practiceDropdownList.find((p) => String(p.id) === String(formData.practice))?.name
                          || '-- Select Practice --'}
                      </Text>
                      <MaterialIcons name="arrow-drop-down" size={22} color={MUTED} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Row 1: Last Name & First Name */}
              <View style={st.row}>
                <View style={st.fieldCol}>
                  <Text style={st.label}>Last Name</Text>
                  <TextInput style={st.input} value={formData.lastName} onChangeText={(val) => setFormData((p) => ({ ...p, lastName: val }))} placeholder="Enter last name" placeholderTextColor="#94a3b8" />
                </View>
                <View style={st.fieldCol}>
                  <Text style={st.label}>First Name</Text>
                  <TextInput style={st.input} value={formData.firstName} onChangeText={(val) => setFormData((p) => ({ ...p, firstName: val }))} placeholder="Enter first name" placeholderTextColor="#94a3b8" />
                </View>
              </View>

              {/* Row 2: Phone & Status */}
              <View style={st.row}>
                <View style={st.fieldCol}>
                  <Text style={st.label}>Phone Number</Text>
                  <TextInput style={st.input} value={formData.phone} onChangeText={(val) => setFormData((p) => ({ ...p, phone: val }))} placeholder="(000) 000-0000" placeholderTextColor="#94a3b8" keyboardType="phone-pad" />
                </View>
                <View style={st.fieldCol}>
                  <Text style={st.label}>Status</Text>
                  <TouchableOpacity style={st.dropdownTrigger} onPress={() => setActiveModal('statusFilter')} activeOpacity={0.75}>
                    <Text style={[st.dropdownTriggerText, !formData.status && { color: MUTED }]} numberOfLines={1}>
                      {STATUS_FILTER_OPTIONS.find((s) => s.value === formData.status)?.label || '-- All Statuses --'}
                    </Text>
                    <MaterialIcons name="arrow-drop-down" size={22} color={MUTED} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Row 3: Caregiver & Provider */}
              <View style={st.row}>
                <View style={st.fieldCol}>
                  <Text style={st.label}>Caregiver</Text>
                  <TouchableOpacity style={st.dropdownTrigger} onPress={() => setActiveModal('caregiver')} activeOpacity={0.75} disabled={!effectivePracticeId || loadingDropdowns}>
                    <Text style={[st.dropdownTriggerText, !formData.caregiver && { color: MUTED }]} numberOfLines={1}>
                      {caregivers.find((c) => String(c.value) === String(formData.caregiver))?.label || '-- All Caregivers --'}
                    </Text>
                    <MaterialIcons name="arrow-drop-down" size={22} color={MUTED} />
                  </TouchableOpacity>
                </View>
                <View style={st.fieldCol}>
                  <Text style={st.label}>Provider</Text>
                  <TouchableOpacity style={st.dropdownTrigger} onPress={() => setActiveModal('provider')} activeOpacity={0.75} disabled={!effectivePracticeId || loadingDropdowns}>
                    <Text style={[st.dropdownTriggerText, !formData.provider && { color: MUTED }]} numberOfLines={1}>
                      {providers.find((p) => String(p.value) === String(formData.provider))?.label || '-- All Providers --'}
                    </Text>
                    <MaterialIcons name="arrow-drop-down" size={22} color={MUTED} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Row 4: DOB Operator & Date */}
              <View style={st.row}>
                <View style={st.fieldCol}>
                  <Text style={st.label}>DOB</Text>
                  <TouchableOpacity style={st.dropdownTrigger} onPress={() => setActiveModal('dobOperator')} activeOpacity={0.75}>
                    <Text style={[st.dropdownTriggerText, !formData.dobOperator && { color: MUTED }]} numberOfLines={1}>
                      {getDobOperatorLabel()}
                    </Text>
                    <MaterialIcons name="arrow-drop-down" size={22} color={MUTED} />
                  </TouchableOpacity>
                </View>
                {!!formData.dobOperator && (
                  <View style={st.fieldCol}>
                    <Text style={st.label}>{formData.dobOperator === 'between' ? 'DOB (from)' : 'Date of Birth'}</Text>
                    {formData.dobOperator === 'between' ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity style={[st.dateInput, { flex: 1 }]} onPress={() => setShowDobFromPicker(true)}>
                          <Text style={formData.dobFrom ? st.dateText : st.datePlaceholder}>
                            {formData.dobFrom ? formatDisplayDate(formData.dobFrom) : 'From...'}
                          </Text>
                        </TouchableOpacity>
                        <Text style={{ color: MUTED }}>-</Text>
                        <TouchableOpacity style={[st.dateInput, { flex: 1 }]} onPress={() => setShowDobToPicker(true)}>
                          <Text style={formData.dobTo ? st.dateText : st.datePlaceholder}>
                            {formData.dobTo ? formatDisplayDate(formData.dobTo) : 'To...'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={st.dateInput} onPress={() => setShowDobFromPicker(true)}>
                        <Text style={formData.dobFrom ? st.dateText : st.datePlaceholder}>
                          {formData.dobFrom ? formatDisplayDate(formData.dobFrom) : 'mm/dd/yyyy'}
                        </Text>
                        <MaterialIcons name="calendar-today" size={18} color={MUTED} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>

              {/* Program Enrolled (only when both RPM + CCM) */}
              {showProgramEnrolled && (
                <View style={[st.row, { marginBottom: 12 }]}>
                  <View style={st.fieldCol}>
                    <Text style={st.label}>Program Enrolled *</Text>
                    <TouchableOpacity
                      style={st.dropdownTrigger}
                      onPress={() => setActiveModal('programEnrolled')}
                      activeOpacity={0.75}
                      disabled={programsLoading}
                    >
                      <Text style={[st.dropdownTriggerText, !formData.programEnrolled && { color: MUTED }]} numberOfLines={1}>
                        {PROGRAM_OPTIONS.find((o) => o.value === formData.programEnrolled)?.label || '-- Select --'}
                      </Text>
                      <MaterialIcons name="arrow-drop-down" size={22} color={MUTED} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Vitals & Serial Number (RPM-only filters) */}
              {showRpmFilters && (
                <View style={st.row}>
                  <View style={st.fieldCol}>
                    <Text style={st.label}>Vitals</Text>
                    <TouchableOpacity style={st.dropdownTrigger} onPress={() => setActiveModal('vitals')} activeOpacity={0.75}>
                      <Text style={[st.dropdownTriggerText, (!formData.vitals || formData.vitals.length === 0) && { color: MUTED }]} numberOfLines={1}>
                        {getVitalsLabel()}
                      </Text>
                      <MaterialIcons name="arrow-drop-down" size={22} color={MUTED} />
                    </TouchableOpacity>
                  </View>
                  <View style={st.fieldCol}>
                    <Text style={st.label}>Serial #</Text>
                    <TextInput
                      style={st.input}
                      value={formData.serialNumber}
                      onChangeText={(val) => setFormData((p) => ({ ...p, serialNumber: String(val).replace(/\D/g, '').slice(0, 16) }))}
                      placeholder="16 digits"
                      placeholderTextColor="#94a3b8"
                      keyboardType="numeric"
                      maxLength={16}
                    />
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              <View style={st.btnRow}>
                <TouchableOpacity style={st.resetBtn} onPress={handleReset}>
                  <Text style={st.resetBtnText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.queryBtn, (loading || programsLoading) && { opacity: 0.6 }]} onPress={handleQuery} disabled={loading || programsLoading}>
                  <Text style={st.queryBtnText}>{loading ? 'Querying...' : 'Query'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* RPM / CCM Result Tabs */}
        {showResultTabs && (
          <View style={st.resultTabsRow}>
            <TouchableOpacity
              style={[st.resultTab, resultTab === PROGRAM_CCM && st.resultTabActive]}
              onPress={() => { setResultTab(PROGRAM_CCM); }}
            >
              <MaterialIcons name="description" size={16} color={resultTab === PROGRAM_CCM ? WHITE : DARK} />
              <Text style={[st.resultTabText, resultTab === PROGRAM_CCM && st.resultTabTextActive]}>CCM</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.resultTab, resultTab === PROGRAM_RPM && st.resultTabActive]}
              onPress={() => { setResultTab(PROGRAM_RPM); }}
            >
              <MaterialIcons name="favorite" size={16} color={resultTab === PROGRAM_RPM ? WHITE : DARK} />
              <Text style={[st.resultTabText, resultTab === PROGRAM_RPM && st.resultTabTextActive]}>RPM</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Results */}
        {hasQueried && (
          <View style={st.resultsCardContainer}>
            <View style={st.resultsHeader}>
              <Text style={st.resultsTitle}>
                {isSuperAdmin ? 'Follow-Ups' : 'Patients'} ({filteredPatients.length})
              </Text>
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
              <Text style={st.emptyText}>
                {isSuperAdmin ? 'No follow-ups found.' : 'No patients match the selected criteria.'}
              </Text>
            ) : (
              filteredPatients.map((item) => renderPatientCard(item))
            )}
          </View>
        )}
      </ScrollView>

      {/* Add Follow Up Modal */}
      <Modal
        visible={showFollowUpModal}
        animationType="fade"
        transparent
        onRequestClose={closeFollowUpModal}
        statusBarTranslucent
        presentationStyle="overFullScreen"
      >
        <View style={st.modalRoot}>
          <Pressable style={st.modalDimLayer} onPress={closeFollowUpModal} />
          <View style={st.modalCenterWrap} pointerEvents="box-none">
            <KeyboardAvoidingView
              style={st.modalKeyboardWrap}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? scaleWidth(8) : 0}
              pointerEvents="box-none"
            >
              <View style={st.modalCardOuter}>
                <View style={st.modalCard}>
                  <View style={st.modalHubHeader}>
                    <Text style={st.modalHubTitle}>Add Follow Up</Text>
                    <TouchableOpacity onPress={closeFollowUpModal}>
                      <MaterialIcons name="close" size={22} color={DARK} />
                    </TouchableOpacity>
                  </View>
                  <Text style={st.modalHubPatientName}>{patientDisplayName(selectedPatient)}</Text>

                  <ScrollView
                    ref={followUpScrollRef}
                    style={st.modalHubScroll}
                    contentContainerStyle={st.modalHubScrollContent}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator
                    nestedScrollEnabled
                    bounces
                  >
                    {/* Service Type */}
                    <Text style={st.fieldLabel}>Service Type</Text>
                    <TouchableOpacity
                      style={st.selectField}
                      onPress={() => { setShowServiceTypeDropdown((p) => !p); setShowStatusDropdown(false); setShowAssignToDropdown(false); setShowTemplatePicker(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={st.selectFieldText} numberOfLines={1}>{followUpForm.serviceType}</Text>
                      <MaterialIcons name={showServiceTypeDropdown ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={22} color={MUTED} />
                    </TouchableOpacity>
                    {showServiceTypeDropdown && (
                      <View style={st.inlineTemplateContainer}>
                        {(activeResultProgram === PROGRAM_CCM ? CCM_SERVICE_TYPES : RPM_SERVICE_TYPES).map((opt) => (
                          <TouchableOpacity
                            key={opt}
                            style={[st.inlineTemplateItem, followUpForm.serviceType === opt && st.inlineTemplateItemActive]}
                            onPress={() => { setFollowUpForm((p) => ({ ...p, serviceType: opt })); setShowServiceTypeDropdown(false); }}
                          >
                            <Text style={[st.inlineTemplateTitle, followUpForm.serviceType === opt && { color: DARK, fontWeight: '800' }]}>{opt}</Text>
                            {followUpForm.serviceType === opt && <MaterialIcons name="check" size={18} color={DARK} />}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {/* Follow Up Status */}
                    <Text style={st.fieldLabel}>Follow Up Status</Text>
                    <TouchableOpacity
                      style={st.selectField}
                      onPress={() => { setShowStatusDropdown((p) => !p); setShowServiceTypeDropdown(false); setShowAssignToDropdown(false); setShowTemplatePicker(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={st.selectFieldText} numberOfLines={1}>{followUpForm.followUpStatus}</Text>
                      <MaterialIcons name={showStatusDropdown ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={22} color={MUTED} />
                    </TouchableOpacity>
                    {showStatusDropdown && (
                      <View style={st.inlineTemplateContainer}>
                        {STATUS_OPTIONS.map((opt) => (
                          <TouchableOpacity
                            key={opt}
                            style={[st.inlineTemplateItem, followUpForm.followUpStatus === opt && st.inlineTemplateItemActive]}
                            onPress={() => { setFollowUpForm((p) => ({ ...p, followUpStatus: opt })); setShowStatusDropdown(false); }}
                          >
                            <Text style={[st.inlineTemplateTitle, followUpForm.followUpStatus === opt && { color: DARK, fontWeight: '800' }]}>{opt}</Text>
                            {followUpForm.followUpStatus === opt && <MaterialIcons name="check" size={18} color={DARK} />}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {/* Assign To */}
                    <Text style={st.fieldLabel}>Assign To</Text>
                    <TouchableOpacity
                      style={st.selectField}
                      onPress={() => { setShowAssignToDropdown((p) => !p); setShowServiceTypeDropdown(false); setShowStatusDropdown(false); setShowTemplatePicker(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[st.selectFieldText, !followUpForm.assignTo && st.selectFieldPlaceholder]} numberOfLines={1}>
                        {caregivers.find((c) => String(c.id) === String(followUpForm.assignTo))?.name || 'Select caregiver...'}
                      </Text>
                      <MaterialIcons name={showAssignToDropdown ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={22} color={MUTED} />
                    </TouchableOpacity>
                    {showAssignToDropdown && (
                      <View style={st.inlineTemplateContainer}>
                        <TouchableOpacity
                          style={[st.inlineTemplateItem, !followUpForm.assignTo && st.inlineTemplateItemActive]}
                          onPress={() => { setFollowUpForm((p) => ({ ...p, assignTo: '' })); setShowAssignToDropdown(false); }}
                        >
                          <Text style={[st.inlineTemplateTitle, !followUpForm.assignTo && { color: DARK, fontWeight: '800' }]}>Select... (None)</Text>
                          {!followUpForm.assignTo && <MaterialIcons name="check" size={18} color={DARK} />}
                        </TouchableOpacity>
                        {caregivers.map((cg) => {
                          const isSel = String(followUpForm.assignTo) === String(cg.id);
                          return (
                            <TouchableOpacity
                              key={String(cg.id)}
                              style={[st.inlineTemplateItem, isSel && st.inlineTemplateItemActive]}
                              onPress={() => { setFollowUpForm((p) => ({ ...p, assignTo: String(cg.id) })); setShowAssignToDropdown(false); }}
                            >
                              <Text style={[st.inlineTemplateTitle, isSel && { color: DARK, fontWeight: '800' }]}>{cg.name || cg.label}</Text>
                              {isSel && <MaterialIcons name="check" size={18} color={DARK} />}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {/* Service Time Timer */}
                    <Text style={st.fieldLabel}>Service Time *</Text>
                    <FollowUpServiceTimer active={showFollowUpModal} initialSeconds={0} accentColor={DARK} />

                    {/* Manual Time */}
                    <View style={st.manualTimeRow}>
                      <View style={st.manualTimeField}>
                        <Text style={st.fieldLabel}>Manual Min(s) *</Text>
                        <TextInput style={st.fieldInput} value={followUpForm.manualMinutes} onChangeText={(v) => handleManualTimeChange('manualMinutes', v)} placeholder="00" placeholderTextColor={MUTED} keyboardType="number-pad" maxLength={2} />
                      </View>
                      <View style={st.manualTimeField}>
                        <Text style={st.fieldLabel}>Manual Sec(s) *</Text>
                        <TextInput style={st.fieldInput} value={followUpForm.manualSeconds} onChangeText={(v) => handleManualTimeChange('manualSeconds', v)} placeholder="00" placeholderTextColor={MUTED} keyboardType="number-pad" maxLength={2} />
                      </View>
                    </View>

                    {/* Date & Time */}
                    <View style={st.dateTimeRow}>
                      <View style={st.dateTimeField}>
                        <Text style={st.fieldLabel}>Date</Text>
                        <TouchableOpacity style={st.selectField} onPress={() => { setShowFollowUpTimePicker(false); setShowFollowUpDatePicker(true); }}>
                          <Text style={st.selectFieldText} numberOfLines={1}>{formatDisplayDate(followUpForm.date)}</Text>
                          <MaterialIcons name="event" size={18} color={MUTED} />
                        </TouchableOpacity>
                      </View>
                      <View style={st.dateTimeField}>
                        <Text style={st.fieldLabel}>Time</Text>
                        <TouchableOpacity style={st.selectField} onPress={() => { setShowFollowUpDatePicker(false); setShowFollowUpTimePicker(true); }}>
                          <Text style={st.selectFieldText} numberOfLines={1}>
                            {parseHmToDate(followUpForm.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </Text>
                          <MaterialIcons name="schedule" size={18} color={MUTED} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Template */}
                    <Text style={st.fieldLabel}>Template</Text>
                    <TouchableOpacity style={st.selectField} onPress={() => setShowTemplatePicker((p) => !p)} activeOpacity={0.7}>
                      <Text style={[st.selectFieldText, !selectedTemplate && st.selectFieldPlaceholder]}>
                        {selectedTemplate?.name || 'Please Choose a Template'}
                      </Text>
                      {loadingTemplates ? <ActivityIndicator size="small" color={DARK} /> : <MaterialIcons name={showTemplatePicker ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={24} color={MUTED} />}
                    </TouchableOpacity>
                    {showTemplatePicker && (
                      <View style={st.inlineTemplateContainer}>
                        <TouchableOpacity style={st.inlineTemplateItem} onPress={() => handleTemplateSelect('')}>
                          <Text style={st.inlineTemplateTitle}>Please Choose a Template (Clear)</Text>
                        </TouchableOpacity>
                        {clinicalTemplates.map((tmpl) => {
                          const isSel = String(followUpForm.templateId) === String(tmpl.id);
                          const snippet = tmpl.template || tmpl.content || tmpl.note || '';
                          return (
                            <TouchableOpacity key={tmpl.id} style={[st.inlineTemplateItem, isSel && st.inlineTemplateItemActive]} onPress={() => handleTemplateSelect(tmpl.id)} activeOpacity={0.7}>
                              <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={[st.inlineTemplateTitle, isSel && { color: DARK, fontWeight: '800' }]}>{tmpl.name || `Template ${tmpl.id}`}</Text>
                                {snippet ? <Text style={st.inlineTemplateSnippet} numberOfLines={2}>{snippet}</Text> : null}
                              </View>
                              {isSel && <MaterialIcons name="check" size={20} color={DARK} />}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {/* Content */}
                    <Text style={st.fieldLabel}>Content *</Text>
                    <TextInput
                      style={[st.fieldInput, st.contentInput]}
                      value={followUpForm.content}
                      onChangeText={(v) => setFollowUpForm((p) => ({ ...p, content: v }))}
                      placeholder="Enter follow-up note..."
                      placeholderTextColor={MUTED}
                      multiline
                      textAlignVertical="top"
                      onFocus={() => setTimeout(() => followUpScrollRef.current?.scrollToEnd({ animated: true }), 250)}
                    />

                    {/* Actions */}
                    <View style={st.modalActions}>
                      <TouchableOpacity style={st.cancelBtn} onPress={closeFollowUpModal}>
                        <Text style={st.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[st.saveBtn, { backgroundColor: DARK }, submittingFollowUp && st.saveBtnDisabled]} onPress={handleFollowUpSubmit} disabled={submittingFollowUp}>
                        <Text style={st.saveBtnText}>{submittingFollowUp ? 'Saving...' : 'Save'}</Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>

                  {showFollowUpDatePicker && Platform.OS === 'ios' ? (
                    <View style={st.iosPickerSheet}>
                      <View style={st.iosPickerHeader}>
                        <Text style={st.iosPickerTitle}>Select Date</Text>
                        <TouchableOpacity onPress={() => setShowFollowUpDatePicker(false)}>
                          <Text style={[st.iosPickerDone, { color: DARK }]}>Done</Text>
                        </TouchableOpacity>
                      </View>
                      <DateTimePicker value={parseYmdToDate(followUpForm.date)} mode="date" display="spinner" onChange={handleFollowUpDateChange} />
                    </View>
                  ) : null}

                  {showFollowUpTimePicker && Platform.OS === 'ios' ? (
                    <View style={st.iosPickerSheet}>
                      <View style={st.iosPickerHeader}>
                        <Text style={st.iosPickerTitle}>Select Time</Text>
                        <TouchableOpacity onPress={() => setShowFollowUpTimePicker(false)}>
                          <Text style={[st.iosPickerDone, { color: DARK }]}>Done</Text>
                        </TouchableOpacity>
                      </View>
                      <DateTimePicker value={parseHmToDate(followUpForm.time)} mode="time" is24Hour={false} display="spinner" onChange={handleFollowUpTimeChange} />
                    </View>
                  ) : null}
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
          <SuccessDialog
            embedded
            variant="warning"
            visible={zeroMinutesNotice}
            title="Follow-up"
            message="Follow-up minutes cannot be 0"
            onClose={() => setZeroMinutesNotice(false)}
          />
        </View>
      </Modal>

      <SuccessDialog
        visible={Boolean(followUpSuccess)}
        title={followUpSuccess?.title}
        message={followUpSuccess?.message}
        onClose={() => setFollowUpSuccess(null)}
      />

      {showFollowUpDatePicker && Platform.OS === 'android' ? (
        <DateTimePicker value={parseYmdToDate(followUpForm.date)} mode="date" display="default" onChange={handleFollowUpDateChange} />
      ) : null}
      {showFollowUpTimePicker && Platform.OS === 'android' ? (
        <DateTimePicker value={parseHmToDate(followUpForm.time)} mode="time" is24Hour={false} display="default" onChange={handleFollowUpTimeChange} />
      ) : null}

      {/* Filter Modals */}
      <SelectModal
        visible={activeModal === 'statusFilter'}
        title="Select Status"
        options={STATUS_FILTER_OPTIONS}
        selectedValue={formData.status}
        onSelect={(val) => setFormData((p) => ({ ...p, status: val }))}
        onClose={() => setActiveModal(null)}
      />
      <SelectModal
        visible={activeModal === 'caregiver'}
        title="Select Caregiver"
        options={[{ value: '', label: '-- All Caregivers --' }, ...caregivers]}
        selectedValue={formData.caregiver}
        onSelect={(val) => setFormData((p) => ({ ...p, caregiver: val }))}
        onClose={() => setActiveModal(null)}
      />
      <SelectModal
        visible={activeModal === 'provider'}
        title="Select Provider"
        options={[{ value: '', label: '-- All Providers --' }, ...providers]}
        selectedValue={formData.provider}
        onSelect={(val) => setFormData((p) => ({ ...p, provider: val }))}
        onClose={() => setActiveModal(null)}
      />
      <SelectModal
        visible={activeModal === 'dobOperator'}
        title="Date of Birth Filter"
        options={DOB_OPERATORS}
        selectedValue={formData.dobOperator}
        onSelect={(val) => setFormData((p) => ({ ...p, dobOperator: val, ...(val !== 'between' ? { dobTo: '' } : {}) }))}
        onClose={() => setActiveModal(null)}
      />
      <SelectModal
        visible={activeModal === 'programEnrolled'}
        title="Program Enrolled"
        options={PROGRAM_OPTIONS}
        selectedValue={formData.programEnrolled}
        onSelect={(val) => {
          setFormData((p) => ({
            ...p, programEnrolled: val,
            ...(val === PROGRAM_CCM ? { vitals: [], serialNumber: '' } : {}),
          }));
          if (val === PROGRAM_CCM || val === PROGRAM_BOTH) setResultTab(PROGRAM_CCM);
          else if (val === PROGRAM_RPM) setResultTab(PROGRAM_RPM);
        }}
        onClose={() => setActiveModal(null)}
      />
      <SelectModal
        visible={activeModal === 'practice'}
        title="Select Practice"
        options={[{ value: '', label: '-- Select Practice --' }, ...practiceDropdownList.map((p) => ({ value: String(p.id), label: p.practice_name || p.name || `Practice #${p.id}` }))]}
        selectedValue={formData.practice || ''}
        onSelect={(val) => handlePracticeChange(val)}
        onClose={() => setActiveModal(null)}
      />

      {/* Vitals Modal */}
      {activeModal === 'vitals' && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setActiveModal(null)}>
          <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={() => setActiveModal(null)}>
            <View style={st.modalContent} onStartShouldSetResponder={() => true}>
              <View style={st.modalSelectHeader}>
                <Text style={st.modalSelectTitle}>Select Vitals</Text>
                <TouchableOpacity onPress={() => setActiveModal(null)} style={st.modalCloseBtn}>
                  <MaterialIcons name="close" size={20} color={DARK} />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                {VITALS_OPTIONS.map((item) => {
                  const currentV = Array.isArray(formData.vitals) ? formData.vitals : (formData.vitals ? String(formData.vitals).split(',') : []);
                  const isSelected = currentV.includes(item.value);
                  return (
                    <TouchableOpacity key={item.value} style={[st.modalItem, isSelected && st.modalItemSelected]} onPress={() => toggleVitalFilter(item.value)} activeOpacity={0.7}>
                      <Text style={[st.modalItemText, isSelected && st.modalItemTextSelected]}>{item.label}</Text>
                      <MaterialIcons name={isSelected ? 'check-box' : 'check-box-outline-blank'} size={20} color={isSelected ? DARK : MUTED} />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* DOB Pickers */}
      <DatePickerModal
        visible={showDobFromPicker}
        title="Select DOB (from)"
        value={parseYmdToDate(formData.dobFrom)}
        maximumDate={new Date()}
        onClose={() => setShowDobFromPicker(false)}
        onConfirm={(d) => {
          const next = toLocalYmd(d);
          setFormData((p) => ({
            ...p,
            dobFrom: next,
            dobTo: p.dobTo && p.dobTo < next ? '' : p.dobTo,
          }));
          setShowDobFromPicker(false);
        }}
      />
      <DatePickerModal
        visible={showDobToPicker}
        title="Select DOB (to)"
        value={parseYmdToDate(formData.dobTo)}
        minimumDate={formData.dobFrom ? parseYmdToDate(formData.dobFrom) : undefined}
        maximumDate={new Date()}
        onClose={() => setShowDobToPicker(false)}
        onConfirm={(d) => {
          setFormData((p) => ({ ...p, dobTo: toLocalYmd(d) }));
          setShowDobToPicker(false);
        }}
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F9FC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: scaleWidth(16), paddingVertical: 12,
    backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F4F7F9', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: scaleFont(18), fontWeight: '800', color: DARK },
  scroll: { flex: 1 },
  scrollContent: { padding: scaleWidth(16), paddingBottom: 40 },
  card: {
    backgroundColor: WHITE, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: BORDER, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: scaleFont(16), fontWeight: '800', color: DARK },
  formContainer: { marginTop: 16 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  fieldCol: { flex: 1 },
  label: { fontSize: scaleFont(12), fontWeight: '700', color: DARK, marginBottom: 6 },
  input: {
    height: 42, backgroundColor: '#F8FAFC', borderRadius: 10,
    borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12,
    fontSize: scaleFont(13), color: DARK,
  },
  dropdownTrigger: {
    height: 42, backgroundColor: '#F8FAFC', borderRadius: 10,
    borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dropdownTriggerText: { fontSize: scaleFont(13), fontWeight: '600', color: DARK, flex: 1 },
  dateInput: {
    height: 42, backgroundColor: '#F8FAFC', borderRadius: 10,
    borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dateText: { fontSize: scaleFont(13), color: DARK, fontWeight: '600' },
  datePlaceholder: { fontSize: scaleFont(13), color: MUTED },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  resetBtn: {
    flex: 1, height: 44, borderRadius: 12, backgroundColor: '#F1F5F9',
    borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center',
  },
  resetBtnText: { fontSize: scaleFont(14), fontWeight: '700', color: MUTED },
  queryBtn: { flex: 1.5, height: 44, borderRadius: 12, backgroundColor: DARK, alignItems: 'center', justifyContent: 'center' },
  queryBtnText: { fontSize: scaleFont(14), fontWeight: '800', color: WHITE },
  /* Result Tabs */
  resultTabsRow: {
    flexDirection: 'row', gap: 8, marginBottom: 12,
    paddingHorizontal: 4,
  },
  resultTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: BORDER,
  },
  resultTabActive: { backgroundColor: DARK, borderColor: DARK },
  resultTabText: { fontSize: scaleFont(13), fontWeight: '800', color: DARK },
  resultTabTextActive: { color: WHITE },
  /* Results */
  resultsCardContainer: { marginTop: 8 },
  resultsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16, paddingHorizontal: 4,
  },
  resultsTitle: { fontSize: scaleFont(16), fontWeight: '800', color: DARK },
  searchInput: {
    height: 36, width: 140, backgroundColor: WHITE, borderRadius: 10,
    borderWidth: 1, borderColor: BORDER, paddingHorizontal: 10,
    fontSize: scaleFont(11), color: DARK,
  },
  emptyText: { textAlign: 'center', color: MUTED, fontSize: scaleFont(13), marginVertical: 20, fontWeight: '600' },
  /* Patient Card */
  patientCard: {
    backgroundColor: WHITE, borderRadius: scaleWidth(16), padding: scaleWidth(14),
    marginBottom: scaleWidth(12), borderWidth: 1, borderColor: BORDER,
    shadowColor: '#0b1f3f', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  pcTop: { flexDirection: 'row', alignItems: 'center', marginBottom: scaleWidth(12) },
  avatarWrap: { position: 'relative', marginRight: scaleWidth(10) },
  pcAvatarSmall: {
    width: scaleWidth(40), height: scaleWidth(40), borderRadius: scaleWidth(20),
    alignItems: 'center', justifyContent: 'center', backgroundColor: DARK,
  },
  pcAvatarTextSmall: { color: WHITE, fontWeight: '800', fontSize: scaleFont(14) },
  statusBadgeCorner: {
    position: 'absolute', bottom: -2, right: -2,
    width: scaleWidth(18), height: scaleWidth(18), borderRadius: scaleWidth(9),
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: WHITE,
  },
  statusBadgeTextCorner: { fontSize: scaleFont(9), fontWeight: '900' },
  statusBadgePill: {
    width: scaleWidth(32), height: scaleWidth(32), borderRadius: scaleWidth(16),
    alignItems: 'center', justifyContent: 'center', marginRight: scaleWidth(10),
  },
  statusBadgePillText: { fontSize: scaleFont(13), fontWeight: '900' },
  pcInfo: { flex: 1 },
  pcName: { fontSize: scaleFont(14), fontWeight: '800', color: DARK },
  pcSubtitle: { fontSize: scaleFont(11), color: MUTED, fontWeight: '600', marginTop: 2 },
  vitalsPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: scaleWidth(4), marginTop: scaleWidth(2) },
  inlineVitalPill: { backgroundColor: '#f1f5f9', paddingHorizontal: scaleWidth(6), paddingVertical: scaleWidth(2), borderRadius: scaleWidth(4) },
  inlineVitalPillText: { fontSize: scaleFont(9), fontWeight: '700', color: '#475569' },
  cardFollowUpBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: DARK, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  cardFollowUpBtnText: { color: WHITE, fontSize: scaleFont(11), fontWeight: '800' },
  noteContentBox: {
    backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#E2E8F0', marginBottom: scaleWidth(8),
  },
  noteContentLabel: { fontSize: scaleFont(10), fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 4 },
  noteContentText: { fontSize: scaleFont(12), color: DARK, fontWeight: '600', lineHeight: 18 },
  pcVitals: {
    flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: scaleWidth(12),
    padding: scaleWidth(10), justifyContent: 'space-between', borderWidth: 1, borderColor: '#E2E8F0',
  },
  pcVital: { flex: 1, alignItems: 'center' },
  pvLbl: { fontSize: scaleFont(9), fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: scaleWidth(2) },
  pvValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  pvVal: { fontSize: scaleFont(14), fontWeight: '800' },
  bpSlash: { fontSize: scaleFont(13), fontWeight: '700', color: '#64748b', marginHorizontal: 1 },
  pvPulseWrap: { flexDirection: 'row', alignItems: 'center', marginLeft: 4 },
  pvPulse: { fontSize: scaleFont(11), fontWeight: '700' },
  pcExtraStatsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: scaleWidth(10), paddingTop: scaleWidth(8),
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
  },
  pcExtraStatItem: { flexDirection: 'row', alignItems: 'center', gap: scaleWidth(4), flex: 1 },
  pcExtraStatLabel: { fontSize: scaleFont(11), color: '#64748B', fontWeight: '600' },
  pcExtraStatValue: { fontSize: scaleFont(11), color: DARK, fontWeight: '800', flexShrink: 1 },
  /* Modals */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: {
    width: '100%', maxWidth: 360, backgroundColor: WHITE, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 8,
  },
  modalSelectHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: BORDER, marginBottom: 8,
  },
  modalSelectTitle: { fontSize: scaleFont(16), fontWeight: '800', color: DARK },
  modalCloseBtn: { padding: 4 },
  modalItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4,
  },
  modalItemSelected: { backgroundColor: '#F1F5F9' },
  modalItemText: { fontSize: scaleFont(14), fontWeight: '600', color: MUTED },
  modalItemTextSelected: { color: DARK, fontWeight: '800' },
  /* Add Follow-Up Modal */
  modalRoot: { flex: 1 },
  modalDimLayer: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(7, 27, 52, 0.45)' },
  modalCenterWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: scaleWidth(16), paddingVertical: scaleWidth(24) },
  modalKeyboardWrap: { width: '100%', maxHeight: '90%' },
  modalCardOuter: {
    borderRadius: scaleWidth(24), overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 12,
  },
  modalCard: { backgroundColor: '#ffffff', padding: scaleWidth(20), maxHeight: '100%' },
  modalHubHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: scaleWidth(4) },
  modalHubTitle: { fontSize: scaleFont(18), fontWeight: '800', color: DARK },
  modalHubPatientName: { fontSize: scaleFont(13), color: MUTED, fontWeight: '600', marginBottom: scaleWidth(16) },
  modalHubScroll: { maxHeight: scaleWidth(420) },
  modalHubScrollContent: { gap: scaleWidth(12), paddingBottom: scaleWidth(12) },
  fieldLabel: { fontSize: scaleFont(12), fontWeight: '700', color: DARK, marginBottom: scaleWidth(4) },
  fieldInput: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e8ecf0',
    borderRadius: scaleWidth(12), paddingHorizontal: scaleWidth(14), paddingVertical: scaleWidth(10),
    fontSize: scaleFont(13), color: DARK,
  },
  selectField: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e8ecf0',
    borderRadius: scaleWidth(12), paddingHorizontal: scaleWidth(14), paddingVertical: scaleWidth(11),
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  selectFieldText: { fontSize: scaleFont(13), color: DARK, fontWeight: '600', flex: 1 },
  selectFieldPlaceholder: { color: MUTED, fontWeight: '500' },
  inlineTemplateContainer: {
    backgroundColor: '#ffffff', borderRadius: scaleWidth(14),
    borderWidth: 1, borderColor: '#e8ecf0', overflow: 'hidden',
    marginTop: scaleWidth(-4), marginBottom: scaleWidth(4),
  },
  inlineTemplateItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: scaleWidth(14), paddingVertical: scaleWidth(10),
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  inlineTemplateItemActive: { backgroundColor: '#f0f9ff' },
  inlineTemplateTitle: { fontSize: scaleFont(13), fontWeight: '700', color: DARK },
  inlineTemplateSnippet: { fontSize: scaleFont(11), color: MUTED, marginTop: 2 },
  serviceTimeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e8ecf0',
    borderRadius: scaleWidth(14), paddingHorizontal: scaleWidth(14), paddingVertical: scaleWidth(10),
  },
  timerPreview: { fontSize: scaleFont(22), fontWeight: '800', fontVariant: ['tabular-nums'] },
  timerPlayBtnSmall: {
    width: scaleWidth(36), height: scaleWidth(36), borderRadius: scaleWidth(12),
    alignItems: 'center', justifyContent: 'center',
  },
  manualTimeRow: { flexDirection: 'row', gap: scaleWidth(12) },
  manualTimeField: { flex: 1 },
  dateTimeRow: { flexDirection: 'row', gap: scaleWidth(12) },
  dateTimeField: { flex: 1 },
  contentInput: { minHeight: scaleWidth(90), paddingTop: scaleWidth(10) },
  modalActions: { flexDirection: 'row', gap: scaleWidth(10), marginTop: scaleWidth(12) },
  cancelBtn: {
    flex: 1, paddingVertical: scaleWidth(12), borderRadius: scaleWidth(14),
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { fontSize: scaleFont(14), fontWeight: '700', color: MUTED },
  saveBtn: { flex: 1.5, paddingVertical: scaleWidth(12), borderRadius: scaleWidth(14), alignItems: 'center', justifyContent: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: scaleFont(14), fontWeight: '800', color: WHITE },
  iosPickerSheet: { backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e8ecf0', paddingBottom: scaleWidth(16) },
  iosPickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: scaleWidth(16), paddingVertical: scaleWidth(10),
    borderBottomWidth: 1, borderBottomColor: '#e8ecf0',
  },
  iosPickerTitle: { fontSize: scaleFont(14), fontWeight: '700', color: DARK },
  iosPickerDone: { fontSize: scaleFont(14), fontWeight: '800' },
});
