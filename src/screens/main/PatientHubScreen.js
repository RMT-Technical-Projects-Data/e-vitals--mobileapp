import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../services/apiService';
import { usePatientSessionTimer } from '../../context/PatientSessionTimerContext';
import { getDashboardTheme } from '../../constants/dashboardThemes';
import {
  DEFAULT_VITAL_TARGETS,
  checkBPValues,
  checkPulseValue,
  checkWeightValue,
  getVitalColor,
  getVitalStatusColor,
  MEASUREMENT_COLORS,
} from '../../utils/measurementUtils';
import { resolveEffectiveScheduleTargets } from '../../utils/scheduleTargetUtils';
import PulseIcon from '../../components/common/PulseIcon';
import PatientAvatar from '../../components/common/PatientAvatar';
import { formatLastFirstName } from '../../utils/formatPersonName';
import SuccessDialog from '../../components/common/SuccessDialog';

const { width, height: screenHeight } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const scaleWidth = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.25);
const scaleFont = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.2);

const SCREEN_BG_COLORS = ['#ffffff', '#ffffff', '#ffffff'];
const PANEL_ACCENT = '#0b1f3f';
const TEXT_DARK = '#0b1f3f';
const TEXT_MUTED = '#687382';

const RPM_SERVICE_TYPES = ['General', 'Call via others'];
const CCM_SERVICE_TYPES = [
  'Care plan review',
  'Medication management',
  'Patient education',
  'Care coordination',
  'Symptom / condition follow-up',
  'Other',
];
const STATUS_OPTIONS = ['Continue follow up', 'No need to follow up'];

const getTodayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getCurrentTimeHm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const formatTimer = (totalSeconds) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatFollowUpTimerDisplay = (totalSeconds) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
    const intervalId = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [active, running]);

  return (
    <View style={styles.serviceTimeRow}>
      <Text style={[styles.timerPreview, { color: accentColor }]}>
        {formatFollowUpTimerDisplay(seconds)}
      </Text>
      <TouchableOpacity
        style={[styles.timerPlayBtnSmall, { backgroundColor: accentColor }]}
        onPress={() => setRunning((prev) => !prev)}
      >
        <MaterialIcons
          name={running ? 'pause' : 'play-arrow'}
          size={20}
          color="#fff"
        />
      </TouchableOpacity>
    </View>
  );
});

const parseYmdToDate = (ymd) => {
  const match = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return new Date();
  const [, year, month, day] = match;
  return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
};

const formatDateToYmd = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseHmToDate = (hm) => {
  const match = String(hm || '').match(/^(\d{1,2}):(\d{2})/);
  const date = new Date();
  if (!match) return date;
  date.setHours(parseInt(match[1], 10), parseInt(match[2], 10), 0, 0);
  return date;
};

const formatDateToHm = (date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const formatDisplayDate = (dateValue) => {
  if (!dateValue) return '-';
  const raw = String(dateValue).trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    }
  }
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

const resolveDeviceSerial = (detailsData, meters) => {
  let serials = [];
  if (Array.isArray(detailsData?.device_serials)) {
    serials = detailsData.device_serials.filter(Boolean);
  } else if (detailsData?.device_serial) {
    serials = String(detailsData.device_serial)
      .split(',')
      .map((serial) => serial.trim())
      .filter(Boolean);
  }
  if (Array.isArray(meters) && meters.length > 0) {
    const meterSerials = meters
      .map((meter) => String(meter.serial_number || '').trim())
      .filter(Boolean);
    if (meterSerials.length > 0) {
      serials = [...new Set(meterSerials)];
    }
  }
  return serials.length > 0 ? serials.join(', ') : '-';
};

const getGenderText = (gender) => {
  if (gender === 1 || gender === '1' || String(gender).toLowerCase() === 'male') return 'Male';
  if (gender === 0 || gender === '0' || gender === 2 || gender === '2' || String(gender).toLowerCase() === 'female') {
    return 'Female';
  }
  if (gender === 3 || gender === '3' || String(gender).toLowerCase() === 'other') return 'Other';
  return 'N/A';
};

const getStatusLabel = (status) => {
  const normalized = String(status ?? '').trim().toLowerCase();
  const numeric = /^\d+$/.test(normalized) ? parseInt(normalized, 10) : null;
  if (numeric === 2 || normalized === 'active') return 'Active';
  if (numeric === 3 || normalized === 'pending') return 'Pending';
  if (numeric === 4 || normalized === 'locked') return 'Locked';
  if (normalized === 'paused') return 'Paused';
  return status || 'N/A';
};

const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue} numberOfLines={2}>{value || '-'}</Text>
  </View>
);

const formatVitalDateParts = (dateValue) => {
  if (!dateValue) return { date: '--', time: '' };
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return { date: '--', time: '' };
  return {
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
};

const VitalUploadCard = ({
  title,
  icon,
  dateValue,
  primary,
  secondary,
  pulse,
  unit,
  onPress,
  accentColor,
  weightTarget,
}) => {
  const { date, time } = formatVitalDateParts(dateValue);

  const t = DEFAULT_VITAL_TARGETS;
  let valueColor = MEASUREMENT_COLORS.missing;
  let sysColor = MEASUREMENT_COLORS.missing;
  let diaColor = MEASUREMENT_COLORS.missing;
  const bpParts = title === 'Blood Pressure' && primary && primary !== '-'
    ? String(primary).split('/')
    : null;

  if (primary && primary !== '-') {
    if (bpParts && bpParts.length === 2) {
      const bpCheck = checkBPValues(
        {
          systolic_pressure: bpParts[0].trim(),
          diastolic_pressure: bpParts[1].trim(),
        },
        t,
      );
      sysColor = bpCheck.sysStatus === 'high'
        ? MEASUREMENT_COLORS.high
        : bpCheck.sysStatus === 'low'
          ? MEASUREMENT_COLORS.low
          : MEASUREMENT_COLORS.normal;
      diaColor = bpCheck.diaStatus === 'high'
        ? MEASUREMENT_COLORS.high
        : bpCheck.diaStatus === 'low'
          ? MEASUREMENT_COLORS.low
          : MEASUREMENT_COLORS.normal;
    } else if (title === 'Blood Glucose') {
      valueColor = getVitalColor(String(primary).replace(/[^\d.-]/g, ''), t.glucoseMin, t.glucoseMax);
    } else if (title === 'Weight') {
      valueColor = getVitalStatusColor(checkWeightValue(primary, weightTarget || t));
    }
  }

  const pulseStatus = pulse != null && pulse !== ''
    ? checkPulseValue(pulse, t)
    : null;
  const pulseColor = pulseStatus
    ? getVitalColor(pulse, t.pulseMin, t.pulseMax)
    : TEXT_MUTED;
  const isPulseAbnormal = pulseStatus === 'high' || pulseStatus === 'low';

  let secondaryColor = TEXT_MUTED;
  if (secondary) {
    const pulseMatch = String(secondary).match(/\d+/);
    if (pulseMatch) {
      secondaryColor = getVitalColor(pulseMatch[0], t.pulseMin, t.pulseMax);
    }
  }

  const content = (
    <View style={styles.vitalCard}>
      <View style={styles.vitalCardTopRow}>
        <View style={styles.vitalTitleWrap}>
          <View style={[styles.vitalReadingIcon, { backgroundColor: `${accentColor}14` }]}>
            <MaterialIcons name={icon} size={19} color={accentColor} />
          </View>
          <Text style={styles.vitalCardTitle}>{title}</Text>
        </View>
        {onPress ? (
          <View style={[styles.vitalNavBtn, { backgroundColor: `${accentColor}12` }]}>
            <MaterialIcons name="chevron-right" size={22} color={accentColor} />
          </View>
        ) : null}
      </View>

      <View style={styles.vitalCardDivider} />

      <View style={styles.vitalCardContent}>
        <View style={styles.vitalMetaCol}>
          <Text style={styles.vitalDateText}>{date}</Text>
          {time ? <Text style={styles.vitalTimeText}>{time}</Text> : null}
        </View>
        <View style={styles.vitalValueCol}>
          <View style={styles.vitalValueRow}>
            {bpParts && bpParts.length === 2 ? (
              <>
                <Text style={[styles.vitalCardValue, { color: sysColor }]}>{bpParts[0].trim()}</Text>
                <Text style={styles.vitalSlash}>/</Text>
                <Text style={[styles.vitalCardValue, { color: diaColor }]}>{bpParts[1].trim()}</Text>
              </>
            ) : (
              <Text style={[styles.vitalCardValue, { color: valueColor }]}>{primary}</Text>
            )}
            {unit ? <Text style={styles.vitalCardUnit}>{unit}</Text> : null}
          </View>
          {pulse != null && pulse !== '' ? (
            <View style={styles.vitalPulseRow}>
              <Text style={[styles.vitalCardSecondary, styles.vitalPulseText, { color: pulseColor }]}>
                {Math.round(Number(pulse))}
              </Text>
              <PulseIcon isAbnormal={isPulseAbnormal} size={scaleFont(13)} />
            </View>
          ) : secondary ? (
            <Text style={[styles.vitalCardSecondary, { color: secondaryColor }]}>{secondary}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88}>
      {content}
    </TouchableOpacity>
  );
};

const HUB_FALLBACK_TEMPLATES = [
  {
    id: 'fallback-1',
    name: 'Normal BP',
    template: 'Blood pressure is within normal range. Patient educated on maintaining healthy lifestyle, diet, and exercise. Continue current medication regimen. Follow up in 30 days or sooner if symptoms arise.',
  },
  {
    id: 'fallback-2',
    name: 'Emergency Follow-up',
    template: 'Emergency protocol initiated. Patient reported critical vitals. Immediate care coordination performed. Provider notified. Patient advised to seek emergency care if symptoms worsen. Follow up within 24 hours.',
  },
  {
    id: 'fallback-3',
    name: 'High Blood Pressure',
    template: 'Patient reported elevated blood pressure readings. Medication adherence reviewed and reinforced. Dietary and lifestyle modifications discussed. Provider notified of persistent hypertension. Follow up in 7 days.',
  },
  {
    id: 'fallback-4',
    name: 'General RPM Check-in',
    template: 'Routine RPM follow-up completed. Vital signs reviewed. Patient reports feeling well. No significant changes noted. Continue current care plan. Follow up as scheduled.',
  },
  {
    id: 'fallback-5',
    name: 'Medication Adherence',
    template: 'Patient contacted regarding medication adherence. Barriers to medication use identified and addressed. Pharmacy coordination completed if needed. Patient verbalized understanding of medication importance. Follow up in 14 days.',
  },
  {
    id: 'fallback-ccm-1',
    name: 'CCM – Care Plan Review',
    template: `CCM care management contact completed.\n\nCondition(s) addressed:\nActivity: Care plan review\n\nDiscussion summary:\n- Reviewed current care plan goals and progress\n- Identified barriers:\n- Patient education provided:\n- Medication/adherence reviewed:\n- Coordination/actions taken:\n\nPatient response / agreement:\nNext steps / follow-up:`,
  },
  {
    id: 'fallback-ccm-2',
    name: 'CCM – Medication Management',
    template: `CCM care management contact completed.\n\nCondition(s) addressed:\nActivity: Medication management\n\nDiscussion summary:\n- Current medications reviewed\n- Adherence discussed:\n- Side effects / concerns:\n- Refills / pharmacy coordination:\n- Changes recommended or coordinated:\n\nPatient response / agreement:\nNext steps / follow-up:`,
  },
  {
    id: 'fallback-ccm-3',
    name: 'CCM – Patient Education',
    template: `CCM care management contact completed.\n\nCondition(s) addressed:\nActivity: Patient education\n\nDiscussion summary:\n- Education topic(s):\n- Teaching method / materials used:\n- Patient understanding / teach-back:\n- Barriers to self-management:\n- Support provided:\n\nPatient response / agreement:\nNext steps / follow-up:`,
  },
];

export default function PatientHubScreen({ navigation, route }) {
  const {
    patientId,
    practiceId: routePracticeId,
    patientName: routePatientName,
    dashboardRole = 'provider',
    careProgram: routeCareProgram = 'RPM',
  } = route.params || {};
  const theme = getDashboardTheme(dashboardRole);
  const accentColor = theme.accent;
  const insets = useSafeAreaInsets();

  const {
    timer,
    setTimer,
    isRunning,
    setIsRunning,
    startSession,
    endSession,
  } = usePatientSessionTimer();

  const [practiceId, setPracticeId] = useState(routePracticeId || null);
  const [patientData, setPatientData] = useState(null);
  const [notes, setNotes] = useState([]);
  const [weightTarget, setWeightTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpSuccess, setFollowUpSuccess] = useState(null);
  const [zeroMinutesNotice, setZeroMinutesNotice] = useState(false);
  const followUpSuccessTimerRef = useRef(null);

  useEffect(() => () => {
    if (followUpSuccessTimerRef.current) clearTimeout(followUpSuccessTimerRef.current);
  }, []);
  const [submittingFollowUp, setSubmittingFollowUp] = useState(false);
  const [followUpTemplates, setFollowUpTemplates] = useState(HUB_FALLBACK_TEMPLATES);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showServiceTypeDropdown, setShowServiceTypeDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showAssignToDropdown, setShowAssignToDropdown] = useState(false);
  const [showFollowUpDatePicker, setShowFollowUpDatePicker] = useState(false);
  const [showFollowUpTimePicker, setShowFollowUpTimePicker] = useState(false);
  const followUpScrollRef = useRef(null);
  const [followUpForm, setFollowUpForm] = useState({
    serviceType: 'General',
    followUpStatus: 'Continue follow up',
    assignTo: '',
    manualMinutes: '00',
    manualSeconds: '00',
    date: getTodayYmd(),
    time: getCurrentTimeHm(),
    templateId: '',
    content: '',
  });
  const practiceIsLocked = false;

  const isCcm = String(routeCareProgram).toUpperCase() === 'CCM';

  const filteredFollowUpTemplates = useMemo(() => {
    const list = Array.isArray(followUpTemplates) && followUpTemplates.length > 0 ? followUpTemplates : HUB_FALLBACK_TEMPLATES;
    if (isCcm) {
      const ccmOnly = list.filter((t) => /ccm/i.test(String(t.name || '')));
      return ccmOnly.length ? ccmOnly : list;
    }
    const rpmOnly = list.filter((t) => !/ccm/i.test(String(t.name || '')));
    return rpmOnly.length ? rpmOnly : list;
  }, [followUpTemplates, isCcm]);

  useEffect(() => {
    if (patientId && !practiceIsLocked) {
      startSession(patientId);
    }
  }, [patientId, practiceIsLocked, startSession]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      endSession();
    });
    return unsubscribe;
  }, [navigation, endSession]);

  const loadNotes = useCallback(async (pId, pPatientId) => {
    if (!pId || !pPatientId || String(pPatientId).startsWith('mock')) {
      setNotes([]);
      return;
    }
    const notesResult = await apiService.getFollowUps(pId, pPatientId).catch(() => null);
    const noteList = Array.isArray(notesResult?.data) ? notesResult.data : [];
    setNotes(noteList);
  }, []);

  const loadFollowUpTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const result = await apiService.getFollowUpTemplates();
      const templates = Array.isArray(result?.data) ? result.data : (Array.isArray(result) ? result : []);
      if (templates.length > 0) {
        setFollowUpTemplates(templates);
      } else {
        setFollowUpTemplates(HUB_FALLBACK_TEMPLATES);
      }
    } catch (error) {
      console.warn('Failed to load follow-up templates:', error.message);
      setFollowUpTemplates(HUB_FALLBACK_TEMPLATES);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  const fetchHubData = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      let pId = routePracticeId;
      if (!pId) {
        const stored = await AsyncStorage.getItem('practiceId');
        const userStr = await AsyncStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        pId = stored || user?.practice_id;
      }
      setPracticeId(pId);

      if (!pId || String(patientId).startsWith('mock')) {
        setPatientData({
          patient: {
            first_name: routePatientName?.split(' ')[0] || 'Patient',
            last_name: routePatientName?.split(' ').slice(1).join(' ') || '',
            date_of_birth: '1968-05-12',
            gender: 'Male',
            provider_name: 'Dr. Smith',
            caregiver_name: 'Jane Doe',
            patient_id: 'P-1001',
            status: 2,
          },
          latest_measurements: {
            blood_pressure: {
              systolic_pressure: 142,
              diastolic_pressure: 90,
              pulse: 78,
              measure_new_date_time: new Date().toISOString(),
            },
            blood_glucose: {
              blood_glucose_value_1: 118,
              measure_new_date_time: new Date().toISOString(),
            },
            weight: {
              weight: 74,
              measure_new_date_time: new Date().toISOString(),
            },
          },
          device_serial: 'SN-48291',
        });
        setNotes([]);
        return;
      }

      const [detailsResult, metersResult, practiceTargets, patientTargets] = await Promise.all([
        apiService.getPatientDetailsFast(pId, patientId).catch(() => null),
        apiService.getPatientMeters(pId, patientId).catch(() => null),
        apiService.getPracticeScheduleTargets(pId).catch(() => null),
        apiService.getPatientScheduleTargets(pId, patientId).catch(() => null),
      ]);

      const effectiveTargets = resolveEffectiveScheduleTargets(
        patientTargets?.data || {},
        practiceTargets?.data || {},
      );
      setWeightTarget(
        effectiveTargets?.weightTargetRange && typeof effectiveTargets.weightTargetRange === 'object'
          ? effectiveTargets.weightTargetRange
          : null
      );

      if (detailsResult?.success && detailsResult.data) {
        const meters = metersResult?.data || [];
        const deviceSerial = resolveDeviceSerial(detailsResult.data, meters);
        setPatientData({
          ...detailsResult.data,
          device_serial: deviceSerial === '-' ? null : deviceSerial,
        });
      }

      await loadNotes(pId, patientId);
    } catch (error) {
      console.warn('Patient hub load error:', error.message);
    } finally {
      setLoading(false);
    }
  }, [patientId, routePracticeId, routePatientName, loadNotes]);

  useEffect(() => {
    fetchHubData();
  }, [fetchHubData]);

  useEffect(() => {
    if (practiceId) {
      loadFollowUpTemplates();
    }
  }, [practiceId, loadFollowUpTemplates]);

  const closeFollowUpModal = () => {
    Keyboard.dismiss();
    setShowTemplatePicker(false);
    setShowFollowUpDatePicker(false);
    setShowFollowUpTimePicker(false);
    setZeroMinutesNotice(false);
    setShowFollowUpModal(false);
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

  const openVitalList = (dataType) => {
    navigation.navigate('DataList', {
      dataType,
      patientId,
      practiceId,
      dashboardRole,
      fromPatientHub: true,
    });
  };

  const openFollowUpModal = () => {
    setFollowUpForm({
      serviceType: 'General',
      followUpStatus: 'Continue follow up',
      assignTo: '',
      manualMinutes: '00',
      manualSeconds: '00',
      date: getTodayYmd(),
      time: getCurrentTimeHm(),
      templateId: '',
      content: '',
    });
    setShowFollowUpModal(true);
  };

  const handleManualTimeChange = (field, value) => {
    const digitsOnly = String(value ?? '').replace(/\D/g, '').substring(0, 2);
    const normalizedValue = field === 'manualSeconds'
      ? (digitsOnly === '' ? '' : String(Math.min(59, parseInt(digitsOnly, 10))))
      : digitsOnly;

    setFollowUpForm((prev) => ({ ...prev, [field]: normalizedValue }));
  };

  const handleTemplateSelect = async (templateId) => {
    if (!templateId) {
      setFollowUpForm((prev) => ({ ...prev, templateId: '', content: '' }));
      setShowTemplatePicker(false);
      return;
    }
    const selected = filteredFollowUpTemplates.find((item) => String(item.id) === String(templateId))
      || followUpTemplates.find((item) => String(item.id) === String(templateId));
    
    let templateText = selected?.template || selected?.content || '';
    if (!templateText && templateId && !String(templateId).startsWith('fallback')) {
      try {
        const res = await apiService.getFollowUpTemplateContent(templateId);
        if (res?.data?.template) {
          templateText = res.data.template;
        }
      } catch (err) {
        console.warn('Failed to fetch template content by ID:', err);
      }
    }

    setFollowUpForm((prev) => ({
      ...prev,
      templateId: String(templateId),
      content: templateText,
    }));
    setShowTemplatePicker(false);
  };

  const handleFollowUpDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowFollowUpDatePicker(false);
    }
    if (event?.type === 'dismissed' || !selectedDate) return;
    setFollowUpForm((prev) => ({ ...prev, date: formatDateToYmd(selectedDate) }));
  };

  const handleFollowUpTimeChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowFollowUpTimePicker(false);
    }
    if (event?.type === 'dismissed' || !selectedDate) return;
    setFollowUpForm((prev) => ({ ...prev, time: formatDateToHm(selectedDate) }));
  };

  const selectedFollowUpTemplate = useMemo(
    () => filteredFollowUpTemplates.find((item) => String(item.id) === String(followUpForm.templateId))
      || followUpTemplates.find((item) => String(item.id) === String(followUpForm.templateId)),
    [filteredFollowUpTemplates, followUpTemplates, followUpForm.templateId],
  );

  const handleFollowUpSubmit = async () => {
    if (!followUpForm.content.trim()) {
      Alert.alert('Required', 'Please enter follow-up content.');
      return;
    }

    const manualMins = parseInt(followUpForm.manualMinutes || '0', 10) || 0;
    const manualSecs = Math.min(59, parseInt(followUpForm.manualSeconds || '0', 10) || 0);
    if (manualMins < 1) {
      setZeroMinutesNotice(true);
      return;
    }

    if (!practiceId || String(patientId).startsWith('mock')) {
      setNotes((prev) => [
        {
          id: `mock-${Date.now()}`,
          content: followUpForm.content.trim(),
          date: followUpForm.date,
          first_name: 'You',
          last_name: '',
        },
        ...prev,
      ]);
      showFollowUpSuccess('Saved', 'Follow-up recorded.');
      return;
    }

    setSubmittingFollowUp(true);
    try {
      const totalSeconds = manualMins * 60 + manualSecs;
      await apiService.createFollowUp(practiceId, patientId, {
        content: followUpForm.content.trim(),
        service_type: followUpForm.serviceType,
        follow_up_status: followUpForm.followUpStatus.toLowerCase().replace(/\s+/g, '_'),
        assign_to: followUpForm.assignTo || null,
        service_time: null,
        service_time_seconds: totalSeconds,
        date: followUpForm.date,
        time: followUpForm.time,
        template_id: followUpForm.templateId || null,
      });
      closeFollowUpModal();
      await loadNotes(practiceId, patientId);
      showFollowUpSuccess('Saved', 'Follow-up recorded successfully.');
    } catch (error) {
      const message = error?.message || 'Failed to save follow-up.';
      if (/cannot be 0/i.test(message)) {
        setZeroMinutesNotice(true);
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setSubmittingFollowUp(false);
    }
  };

  const patient = patientData?.patient || {};
  const latest = patientData?.latest_measurements || {};
  const caregivers = patientData?.caregivers || [];
  const bp = latest.blood_pressure;
  const bg = latest.blood_glucose;
  const wt = latest.weight;

  const displayName = routePatientName
    || formatLastFirstName(patient)
    || 'Patient';

  return (
    <LinearGradient colors={SCREEN_BG_COLORS} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={22} color={TEXT_DARK} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{displayName}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={PANEL_ACCENT} style={styles.loader} />
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom, scaleWidth(12)) + scaleWidth(16) },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.card}>
              <View style={styles.profileHeader}>
                <PatientAvatar
                  profilePic={patient.profile_pic || patient.profilePic || patient.profile_image}
                  firstName={patient.first_name || displayName.split(' ')[0]}
                  lastName={patient.last_name || displayName.split(' ').slice(1).join(' ')}
                  size={scaleWidth(72)}
                  borderRadius={scaleWidth(36)}
                  backgroundColor={accentColor}
                  textStyle={styles.profileInitials}
                />
                <View style={styles.profileHeaderText}>
                  <Text style={styles.profileName} numberOfLines={2}>{displayName}</Text>
                  <Text style={styles.cardTitle}>Patient Details</Text>
                </View>
              </View>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Status</Text>
                {(() => {
                  const raw = String(patient.status ?? '').trim().toLowerCase();
                  const numeric = /^\d+$/.test(raw) ? parseInt(raw, 10) : null;
                  let bg = '#E8EAED';
                  let color = '#6C757D';
                  let label = getStatusLabel(patient.status);
                  if (numeric === 2 || raw === 'active' || raw === 'stable') {
                    bg = '#DDF8DD'; color = '#0b1f3f';
                  } else if (numeric === 3 || raw === 'pending' || raw === 'review') {
                    bg = '#caf0f8'; color = '#1177c6';
                  } else if (numeric === 4 || raw === 'locked') {
                    bg = '#E6DDF8'; color = '#490565';
                  } else if (raw === 'critical') {
                    bg = '#FDE8E8'; color = '#d32f2f';
                  }
                  return (
                    <View style={[styles.statusPill, { backgroundColor: bg }]}>
                      <Text style={[styles.statusPillText, { color }]}>{label}</Text>
                    </View>
                  );
                })()}
              </View>
              <DetailRow label="DOB" value={formatDisplayDate(patient.date_of_birth)} />
              <DetailRow label="Gender" value={getGenderText(patient.gender)} />
              <DetailRow label="Patient ID" value={patient.patient_id} />
              <DetailRow label="Provider" value={patient.provider_name} />
              <DetailRow label="Caregiver" value={patient.caregiver_name} />
              <DetailRow label="Device Serial" value={patientData?.device_serial || '-'} />
            </View>

            {!practiceIsLocked && (
              <View style={styles.timerCard}>
                <View style={styles.timerCardHeader}>
                  <Text style={styles.timerCardTitle}>Session Timer</Text>
                  <View style={[styles.timerLivePill, isRunning && styles.timerLivePillActive]}>
                    <View style={[styles.timerLiveDot, isRunning && { backgroundColor: '#22c55e' }]} />
                    <Text style={styles.timerLiveText}>{isRunning ? 'Recording' : 'Paused'}</Text>
                  </View>
                </View>
                <View style={styles.timerMainRow}>
                  <Text style={[styles.timerDisplay, { color: accentColor }]}>{formatTimer(timer)}</Text>
                  <View style={styles.timerActions}>
                    <TouchableOpacity
                      style={[styles.timerPlayBtn, { backgroundColor: accentColor }]}
                      onPress={() => setIsRunning((prev) => !prev)}
                      accessibilityRole="button"
                      accessibilityLabel={isRunning ? 'Pause timer' : 'Start timer'}
                    >
                      <MaterialIcons
                        name={isRunning ? 'pause' : 'play-arrow'}
                        size={28}
                        color="#fff"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.timerResetBtn}
                      onPress={() => {
                        setIsRunning(false);
                        setTimer(0);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Reset timer"
                    >
                      <MaterialIcons name="close" size={22} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Last Upload Data</Text>
              <View style={styles.vitalsGrid}>
                <VitalUploadCard
                  title="Blood Pressure"
                  icon="favorite-border"
                  accentColor={accentColor}
                  onPress={() => openVitalList('bloodPressure')}
                  dateValue={bp?.measure_new_date_time || bp?.measure_date_time || bp?.created_at}
                  primary={bp ? `${Math.round(bp.systolic_pressure)}/${Math.round(bp.diastolic_pressure)}` : '-'}
                  pulse={bp?.pulse}
                  unit="mmHg"
                />
                <VitalUploadCard
                  title="Blood Glucose"
                  icon="opacity"
                  accentColor={accentColor}
                  onPress={() => openVitalList('bloodGlucose')}
                  dateValue={bg?.measure_new_date_time || bg?.measure_date_time || bg?.created_at}
                  primary={bg?.blood_glucose_value_1 != null ? String(Math.round(bg.blood_glucose_value_1)) : '-'}
                  unit="mg/dl"
                />
                <VitalUploadCard
                  title="Weight"
                  icon="monitor-weight"
                  accentColor={accentColor}
                  onPress={() => openVitalList('weight')}
                  dateValue={wt?.measure_new_date_time || wt?.measure_date_time || wt?.created_at}
                  primary={wt?.weight != null ? parseFloat(wt.weight).toFixed(1) : '-'}
                  unit="lb"
                  weightTarget={weightTarget}
                />
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.notesHeader}>
                <Text style={styles.cardTitle}>Follow Up Notes</Text>
                {!practiceIsLocked && (
                  <TouchableOpacity style={[styles.addFollowUpBtn, { backgroundColor: accentColor }]} onPress={openFollowUpModal}>
                    <MaterialIcons name="add" size={18} color="#fff" />
                    <Text style={styles.addFollowUpText}>Add Follow Up</Text>
                  </TouchableOpacity>
                )}
              </View>
              {notes.length === 0 ? (
                <Text style={styles.emptyNotes}>No notes available</Text>
              ) : (
                notes.slice(0, 10).map((note, index) => (
                  <View key={note.id || index} style={styles.noteItem}>
                    <Text style={styles.noteAuthor}>
                      {note.caregiver_name
                        || `${note.last_name || ''}, ${note.first_name || ''}`.replace(/^,\s*/, '').trim()
                        || 'System Caregiver'}
                    </Text>
                    <Text style={styles.noteDate}>
                      {formatDisplayDate(note.date || note.created_at)}
                    </Text>
                    <Text style={styles.noteText}>{note.content || note.note || ''}</Text>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>

      <Modal
        visible={showFollowUpModal}
        animationType="fade"
        transparent
        onRequestClose={closeFollowUpModal}
        statusBarTranslucent
        presentationStyle="overFullScreen"
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalDimLayer} onPress={closeFollowUpModal} />
          <View style={styles.modalCenterWrap} pointerEvents="box-none">
            <KeyboardAvoidingView
              style={styles.modalKeyboardWrap}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? scaleWidth(8) : 0}
              pointerEvents="box-none"
            >
              <View style={styles.modalCardOuter}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Add Follow Up</Text>
                  <TouchableOpacity onPress={closeFollowUpModal}>
                    <MaterialIcons name="close" size={22} color={TEXT_DARK} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalPatientName}>{displayName}</Text>

                <ScrollView
                  ref={followUpScrollRef}
                  style={styles.modalScroll}
                  contentContainerStyle={styles.modalScrollContent}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  showsVerticalScrollIndicator
                  nestedScrollEnabled
                  bounces
                >
              {/* Service Type Dropdown */}
              <Text style={styles.fieldLabel}>Service Type</Text>
              <TouchableOpacity
                style={styles.selectField}
                onPress={() => {
                  setShowServiceTypeDropdown((prev) => !prev);
                  setShowStatusDropdown(false);
                  setShowTemplatePicker(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.selectFieldText} numberOfLines={1}>{followUpForm.serviceType}</Text>
                <MaterialIcons name={showServiceTypeDropdown ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={22} color={TEXT_MUTED} />
              </TouchableOpacity>

              {showServiceTypeDropdown && (
                <View style={styles.inlineTemplateContainer}>
                  {(isCcm ? CCM_SERVICE_TYPES : RPM_SERVICE_TYPES).map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.inlineTemplateItem, followUpForm.serviceType === opt && styles.inlineTemplateItemActive]}
                      onPress={() => {
                        setFollowUpForm((prev) => ({ ...prev, serviceType: opt }));
                        setShowServiceTypeDropdown(false);
                      }}
                    >
                      <Text style={[styles.inlineTemplateTitle, followUpForm.serviceType === opt && { color: accentColor, fontWeight: '800' }]}>{opt}</Text>
                      {followUpForm.serviceType === opt && <MaterialIcons name="check" size={18} color={accentColor} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Follow Up Status Dropdown */}
              <Text style={styles.fieldLabel}>Follow Up Status</Text>
              <TouchableOpacity
                style={styles.selectField}
                onPress={() => {
                  setShowStatusDropdown((prev) => !prev);
                  setShowServiceTypeDropdown(false);
                  setShowTemplatePicker(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.selectFieldText} numberOfLines={1}>{followUpForm.followUpStatus}</Text>
                <MaterialIcons name={showStatusDropdown ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={22} color={TEXT_MUTED} />
              </TouchableOpacity>

              {showStatusDropdown && (
                <View style={styles.inlineTemplateContainer}>
                  {STATUS_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.inlineTemplateItem, followUpForm.followUpStatus === opt && styles.inlineTemplateItemActive]}
                      onPress={() => {
                        setFollowUpForm((prev) => ({ ...prev, followUpStatus: opt }));
                        setShowStatusDropdown(false);
                      }}
                    >
                      <Text style={[styles.inlineTemplateTitle, followUpForm.followUpStatus === opt && { color: accentColor, fontWeight: '800' }]}>{opt}</Text>
                      {followUpForm.followUpStatus === opt && <MaterialIcons name="check" size={18} color={accentColor} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Assign To Dropdown */}
              <Text style={styles.fieldLabel}>Assign To</Text>
              <TouchableOpacity
                style={styles.selectField}
                onPress={() => {
                  setShowAssignToDropdown((prev) => !prev);
                  setShowServiceTypeDropdown(false);
                  setShowStatusDropdown(false);
                  setShowTemplatePicker(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.selectFieldText, !followUpForm.assignTo && styles.selectFieldPlaceholder]} numberOfLines={1}>
                  {(() => {
                    const selectedCaregiver = caregivers.find(c => String(c.id) === String(followUpForm.assignTo));
                    return selectedCaregiver
                      ? (selectedCaregiver.full_name || selectedCaregiver.name || `Caregiver ${selectedCaregiver.id}`)
                      : 'Select caregiver...';
                  })()}
                </Text>
                <MaterialIcons name={showAssignToDropdown ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={22} color={TEXT_MUTED} />
              </TouchableOpacity>

              {showAssignToDropdown && (
                <View style={styles.inlineTemplateContainer}>
                  <TouchableOpacity
                    style={[styles.inlineTemplateItem, !followUpForm.assignTo && styles.inlineTemplateItemActive]}
                    onPress={() => {
                      setFollowUpForm((prev) => ({ ...prev, assignTo: '' }));
                      setShowAssignToDropdown(false);
                    }}
                  >
                    <Text style={[styles.inlineTemplateTitle, !followUpForm.assignTo && { color: accentColor, fontWeight: '800' }]}>Select... (None)</Text>
                    {!followUpForm.assignTo && <MaterialIcons name="check" size={18} color={accentColor} />}
                  </TouchableOpacity>
                  {caregivers.map((caregiver) => {
                    const isSel = String(followUpForm.assignTo) === String(caregiver.id);
                    const nameStr = caregiver.full_name || caregiver.name || `Caregiver ${caregiver.id}`;
                    return (
                      <TouchableOpacity
                        key={caregiver.id}
                        style={[styles.inlineTemplateItem, isSel && styles.inlineTemplateItemActive]}
                        onPress={() => {
                          setFollowUpForm((prev) => ({ ...prev, assignTo: String(caregiver.id) }));
                          setShowAssignToDropdown(false);
                        }}
                      >
                        <Text style={[styles.inlineTemplateTitle, isSel && { color: accentColor, fontWeight: '800' }]}>{nameStr}</Text>
                        {isSel && <MaterialIcons name="check" size={18} color={accentColor} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={styles.fieldLabel}>Service Time *</Text>
              <FollowUpServiceTimer
                active={showFollowUpModal}
                initialSeconds={timer}
                accentColor={accentColor}
              />

              <View style={styles.manualTimeRow}>
                <View style={styles.manualTimeField}>
                  <Text style={styles.fieldLabel}>Manual Min(s) *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={followUpForm.manualMinutes}
                    onChangeText={(value) => handleManualTimeChange('manualMinutes', value)}
                    placeholder="00"
                    placeholderTextColor={TEXT_MUTED}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
                <View style={styles.manualTimeField}>
                  <Text style={styles.fieldLabel}>Manual Sec(s) *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={followUpForm.manualSeconds}
                    onChangeText={(value) => handleManualTimeChange('manualSeconds', value)}
                    placeholder="00"
                    placeholderTextColor={TEXT_MUTED}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
              </View>

              <View style={styles.dateTimeRow}>
                <View style={styles.dateTimeField}>
                  <Text style={styles.fieldLabel}>Date</Text>
                  <TouchableOpacity
                    style={styles.selectField}
                    onPress={() => {
                      setShowFollowUpTimePicker(false);
                      setShowFollowUpDatePicker(true);
                    }}
                  >
                    <Text style={styles.selectFieldText} numberOfLines={1}>
                      {formatDisplayDate(followUpForm.date)}
                    </Text>
                    <MaterialIcons name="event" size={18} color={TEXT_MUTED} />
                  </TouchableOpacity>
                </View>
                <View style={styles.dateTimeField}>
                  <Text style={styles.fieldLabel}>Time</Text>
                  <TouchableOpacity
                    style={styles.selectField}
                    onPress={() => {
                      setShowFollowUpDatePicker(false);
                      setShowFollowUpTimePicker(true);
                    }}
                  >
                    <Text style={styles.selectFieldText} numberOfLines={1}>
                      {parseHmToDate(followUpForm.time).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                    <MaterialIcons name="schedule" size={18} color={TEXT_MUTED} />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Template</Text>
              <TouchableOpacity
                style={styles.selectField}
                onPress={() => setShowTemplatePicker((prev) => !prev)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.selectFieldText,
                  !selectedFollowUpTemplate && styles.selectFieldPlaceholder,
                ]}>
                  {selectedFollowUpTemplate?.name || 'Please Choose a Template'}
                </Text>
                {loadingTemplates ? (
                  <ActivityIndicator size="small" color={accentColor} />
                ) : (
                  <MaterialIcons name={showTemplatePicker ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={24} color={TEXT_MUTED} />
                )}
              </TouchableOpacity>

              {/* Expandable Inline Template Selector */}
              {showTemplatePicker && (
                <View style={styles.inlineTemplateContainer}>
                  <TouchableOpacity
                    style={styles.inlineTemplateItem}
                    onPress={() => handleTemplateSelect('')}
                  >
                    <Text style={styles.inlineTemplateTitle}>Please Choose a Template (Clear)</Text>
                  </TouchableOpacity>
                  {filteredFollowUpTemplates.length === 0 ? (
                    <Text style={styles.templatePickerEmpty}>
                      {loadingTemplates ? 'Loading templates...' : 'No templates available'}
                    </Text>
                  ) : (
                    filteredFollowUpTemplates.map((template) => {
                      const isSelected = String(followUpForm.templateId) === String(template.id);
                      const snippet = template.template || template.content || '';
                      return (
                        <TouchableOpacity
                          key={template.id}
                          style={[
                            styles.inlineTemplateItem,
                            isSelected && styles.inlineTemplateItemActive,
                          ]}
                          onPress={() => handleTemplateSelect(template.id)}
                          activeOpacity={0.7}
                        >
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={[
                              styles.inlineTemplateTitle,
                              isSelected && { color: accentColor, fontWeight: '800' },
                            ]}>
                              {template.name || `Template ${template.id}`}
                            </Text>
                            {snippet ? (
                              <Text style={styles.inlineTemplateSnippet} numberOfLines={2}>
                                {snippet}
                              </Text>
                            ) : null}
                          </View>
                          {isSelected && <MaterialIcons name="check" size={20} color={accentColor} />}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              )}

              {/* Content */}

              <Text style={styles.fieldLabel}>Content *</Text>
              <TextInput
                style={[styles.fieldInput, styles.contentInput]}
                value={followUpForm.content}
                onChangeText={(value) => setFollowUpForm((prev) => ({ ...prev, content: value }))}
                placeholder="Enter follow-up note..."
                placeholderTextColor={TEXT_MUTED}
                multiline
                textAlignVertical="top"
                onFocus={() => {
                  setTimeout(() => {
                    followUpScrollRef.current?.scrollToEnd({ animated: true });
                  }, 250);
                }}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={closeFollowUpModal}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: accentColor }, submittingFollowUp && styles.saveBtnDisabled]}
                  onPress={handleFollowUpSubmit}
                  disabled={submittingFollowUp}
                >
                  <Text style={styles.saveBtnText}>
                    {submittingFollowUp ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
                </ScrollView>

                {showFollowUpDatePicker && Platform.OS === 'ios' ? (
                  <View style={styles.iosPickerSheet}>
                    <View style={styles.iosPickerHeader}>
                      <Text style={styles.iosPickerTitle}>Select Date</Text>
                      <TouchableOpacity onPress={() => setShowFollowUpDatePicker(false)}>
                        <Text style={[styles.iosPickerDone, { color: accentColor }]}>Done</Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={parseYmdToDate(followUpForm.date)}
                      mode="date"
                      display="spinner"
                      onChange={handleFollowUpDateChange}
                    />
                  </View>
                ) : null}

                {showFollowUpTimePicker && Platform.OS === 'ios' ? (
                  <View style={styles.iosPickerSheet}>
                    <View style={styles.iosPickerHeader}>
                      <Text style={styles.iosPickerTitle}>Select Time</Text>
                      <TouchableOpacity onPress={() => setShowFollowUpTimePicker(false)}>
                        <Text style={[styles.iosPickerDone, { color: accentColor }]}>Done</Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={parseHmToDate(followUpForm.time)}
                      mode="time"
                      is24Hour={false}
                      display="spinner"
                      onChange={handleFollowUpTimeChange}
                    />
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
          <DateTimePicker
            value={parseYmdToDate(followUpForm.date)}
            mode="date"
            display="default"
            onChange={handleFollowUpDateChange}
          />
        ) : null}

        {showFollowUpTimePicker && Platform.OS === 'android' ? (
          <DateTimePicker
            value={parseHmToDate(followUpForm.time)}
            mode="time"
            is24Hour={false}
            display="default"
            onChange={handleFollowUpTimeChange}
          />
        ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaleWidth(12),
    paddingBottom: scaleWidth(10),
    paddingTop: scaleWidth(4),
  },
  backBtn: {
    width: scaleWidth(40),
    height: scaleWidth(40),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: TEXT_DARK,
    fontSize: scaleFont(18),
    fontWeight: '800',
  },
  headerSpacer: { width: scaleWidth(40) },
  loader: { marginTop: scaleWidth(40) },
  scroll: { flex: 1 },
  scrollContent: {
    padding: scaleWidth(16),
    gap: scaleWidth(12),
  },
  sectionBlock: {
    gap: scaleWidth(10),
  },
  sectionTitle: {
    fontSize: scaleFont(16),
    fontWeight: '800',
    color: TEXT_DARK,
    paddingHorizontal: scaleWidth(2),
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: scaleWidth(20),
    padding: scaleWidth(16),
    borderWidth: 1,
    borderColor: '#e8ecf0',
    shadowColor: PANEL_ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(14),
    marginBottom: scaleWidth(14),
  },
  profileHeaderText: {
    flex: 1,
  },
  profileName: {
    fontSize: scaleFont(18),
    fontWeight: '800',
    color: TEXT_DARK,
  },
  profileInitials: {
    fontSize: scaleFont(22),
    fontWeight: '800',
    color: '#ffffff',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scaleWidth(10),
  },
  cardTitle: {
    fontSize: scaleFont(16),
    fontWeight: '800',
    color: TEXT_DARK,
    marginBottom: scaleWidth(8),
  },
  statusPill: {
    backgroundColor: '#d0f0e0',
    paddingHorizontal: scaleWidth(10),
    paddingVertical: scaleWidth(4),
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: scaleFont(10),
    fontWeight: '800',
    color: '#0a6b3f',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: scaleWidth(6),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(7,27,52,0.06)',
    gap: scaleWidth(12),
  },
  detailLabel: {
    fontSize: scaleFont(12),
    color: TEXT_MUTED,
    fontWeight: '600',
    flex: 0.9,
  },
  detailValue: {
    fontSize: scaleFont(12),
    color: TEXT_DARK,
    fontWeight: '700',
    flex: 1.1,
    textAlign: 'right',
  },
  timerCard: {
    backgroundColor: '#ffffff',
    borderRadius: scaleWidth(18),
    borderWidth: 1,
    borderColor: '#e8ecf0',
    padding: scaleWidth(16),
    shadowColor: PANEL_ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  timerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scaleWidth(10),
  },
  timerCardTitle: {
    fontSize: scaleFont(15),
    fontWeight: '800',
    color: TEXT_DARK,
  },
  timerLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(6),
    paddingHorizontal: scaleWidth(10),
    paddingVertical: scaleWidth(5),
    borderRadius: 999,
    backgroundColor: 'rgba(7,27,52,0.06)',
  },
  timerLivePillActive: {
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  timerLiveDot: {
    width: scaleWidth(8),
    height: scaleWidth(8),
    borderRadius: scaleWidth(4),
    backgroundColor: TEXT_MUTED,
  },
  timerLiveText: {
    fontSize: scaleFont(10),
    fontWeight: '800',
    color: TEXT_DARK,
  },
  timerMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timerDisplay: {
    fontSize: scaleFont(36),
    fontWeight: '800',
    letterSpacing: 1.5,
    fontVariant: ['tabular-nums'],
  },
  timerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(8),
  },
  timerPlayBtn: {
    width: scaleWidth(56),
    height: scaleWidth(56),
    borderRadius: scaleWidth(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerResetBtn: {
    width: scaleWidth(56),
    height: scaleWidth(56),
    borderRadius: scaleWidth(18),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
  },
  vitalsGrid: { gap: scaleWidth(10) },
  vitalCard: {
    backgroundColor: '#ffffff',
    borderRadius: scaleWidth(20),
    padding: scaleWidth(14),
    borderWidth: 1,
    borderColor: '#e8ecf0',
    shadowColor: PANEL_ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  vitalCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scaleWidth(10),
  },
  vitalTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(8),
    minWidth: 0,
  },
  vitalReadingIcon: {
    width: scaleWidth(32),
    height: scaleWidth(32),
    borderRadius: scaleWidth(13),
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  vitalCardTitle: {
    fontSize: scaleFont(16),
    fontWeight: '800',
    color: TEXT_DARK,
    flexShrink: 1,
  },
  vitalNavBtn: {
    width: scaleWidth(36),
    height: scaleWidth(36),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  vitalCardDivider: {
    height: 1,
    backgroundColor: 'rgba(7,27,52,0.06)',
    marginVertical: scaleWidth(12),
  },
  vitalCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: scaleWidth(14),
  },
  vitalMetaCol: {
    flex: 1,
    minWidth: 0,
  },
  vitalDateText: {
    fontSize: scaleFont(13),
    color: TEXT_DARK,
    fontWeight: '700',
    lineHeight: scaleFont(18),
  },
  vitalTimeText: {
    fontSize: scaleFont(12),
    color: TEXT_MUTED,
    fontWeight: '600',
    marginTop: scaleWidth(3),
  },
  vitalValueCol: {
    flexShrink: 0,
    alignItems: 'flex-end',
    maxWidth: '52%',
  },
  vitalValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: scaleWidth(5),
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  vitalCardValue: {
    fontSize: scaleFont(26),
    fontWeight: '800',
    color: TEXT_DARK,
    fontVariant: ['tabular-nums'],
  },
  vitalSlash: {
    fontSize: scaleFont(22),
    fontWeight: '700',
    color: '#64748b',
    marginHorizontal: 2,
  },
  vitalCardSecondary: {
    fontSize: scaleFont(12),
    color: TEXT_MUTED,
    marginTop: scaleWidth(5),
    fontWeight: '700',
    textAlign: 'right',
  },
  vitalPulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: scaleWidth(5),
  },
  vitalPulseText: {
    marginTop: 0,
  },
  vitalCardUnit: {
    fontSize: scaleFont(12),
    color: TEXT_MUTED,
    fontWeight: '700',
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scaleWidth(8),
  },
  addFollowUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(4),
    paddingHorizontal: scaleWidth(10),
    paddingVertical: scaleWidth(8),
    borderRadius: scaleWidth(12),
  },
  addFollowUpText: {
    color: '#fff',
    fontSize: scaleFont(11),
    fontWeight: '800',
  },
  emptyNotes: {
    fontSize: scaleFont(13),
    color: TEXT_MUTED,
    fontWeight: '600',
  },
  noteItem: {
    paddingVertical: scaleWidth(10),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(7,27,52,0.06)',
  },
  noteAuthor: {
    fontSize: scaleFont(12),
    fontWeight: '800',
    color: TEXT_DARK,
  },
  noteDate: {
    fontSize: scaleFont(10),
    color: TEXT_MUTED,
    marginTop: scaleWidth(2),
    fontWeight: '600',
  },
  noteText: {
    fontSize: scaleFont(12),
    color: TEXT_DARK,
    marginTop: scaleWidth(6),
    lineHeight: scaleFont(18),
    fontWeight: '500',
  },
  modalRoot: {
    flex: 1,
  },
  modalDimLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
  },
  modalCenterWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scaleWidth(20),
    paddingVertical: scaleWidth(14),
  },
  modalKeyboardWrap: {
    width: '100%',
    maxWidth: scaleWidth(380),
    maxHeight: screenHeight * 0.9,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  modalCardOuter: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: scaleWidth(20),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.38,
    shadowRadius: 32,
    elevation: 28,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: scaleWidth(20),
    maxHeight: screenHeight * 0.88,
    borderWidth: 1,
    borderColor: 'rgba(7, 27, 52, 0.1)',
    overflow: 'hidden',
  },
  modalScroll: {
    maxHeight: screenHeight * 0.64,
  },
  modalScrollContent: {
    paddingHorizontal: scaleWidth(20),
    paddingBottom: scaleWidth(20),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaleWidth(20),
    paddingTop: scaleWidth(20),
    marginBottom: scaleWidth(8),
  },
  modalTitle: {
    fontSize: scaleFont(18),
    fontWeight: '800',
    color: TEXT_DARK,
  },
  modalPatientName: {
    fontSize: scaleFont(14),
    fontWeight: '700',
    color: TEXT_MUTED,
    paddingHorizontal: scaleWidth(20),
    marginBottom: scaleWidth(10),
  },
  fieldLabel: {
    fontSize: scaleFont(12),
    fontWeight: '700',
    color: TEXT_DARK,
    marginBottom: scaleWidth(6),
    marginTop: scaleWidth(8),
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: 'rgba(7,27,52,0.12)',
    borderRadius: scaleWidth(12),
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleWidth(10),
    fontSize: scaleFont(13),
    color: TEXT_DARK,
    backgroundColor: '#fff',
  },
  contentInput: {
    minHeight: scaleWidth(100),
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scaleWidth(8),
  },
  optionChip: {
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleWidth(8),
    borderRadius: scaleWidth(12),
    backgroundColor: 'rgba(7,27,52,0.06)',
  },
  optionChipActive: {
    backgroundColor: PANEL_ACCENT,
  },
  optionChipText: {
    fontSize: scaleFont(11),
    fontWeight: '700',
    color: TEXT_MUTED,
  },
  optionChipTextActive: {
    color: '#fff',
  },
  timerPreview: {
    fontSize: scaleFont(24),
    fontWeight: '800',
    color: TEXT_DARK,
    letterSpacing: 1,
  },
  serviceTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaleWidth(12),
    marginBottom: scaleWidth(4),
  },
  timerPlayBtnSmall: {
    width: scaleWidth(40),
    height: scaleWidth(40),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualTimeRow: {
    flexDirection: 'row',
    gap: scaleWidth(10),
  },
  manualTimeField: {
    flex: 1,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: scaleWidth(10),
    alignItems: 'flex-start',
  },
  dateTimeField: {
    flex: 1,
    minWidth: 0,
  },
  iosPickerSheet: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(7,27,52,0.08)',
    paddingBottom: scaleWidth(8),
  },
  iosPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaleWidth(4),
    paddingVertical: scaleWidth(10),
  },
  iosPickerTitle: {
    fontSize: scaleFont(14),
    fontWeight: '800',
    color: TEXT_DARK,
  },
  iosPickerDone: {
    fontSize: scaleFont(14),
    fontWeight: '800',
  },
  selectField: {
    borderWidth: 1,
    borderColor: 'rgba(7,27,52,0.12)',
    borderRadius: scaleWidth(12),
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleWidth(12),
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scaleWidth(8),
  },
  selectFieldText: {
    flex: 1,
    fontSize: scaleFont(13),
    color: TEXT_DARK,
    fontWeight: '600',
  },
  selectFieldPlaceholder: {
    color: TEXT_MUTED,
    fontWeight: '500',
  },
  templatePickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    justifyContent: 'flex-end',
  },
  templatePickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: scaleWidth(20),
    borderTopRightRadius: scaleWidth(20),
    maxHeight: '55%',
    paddingBottom: scaleWidth(20),
  },
  templatePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaleWidth(20),
    paddingVertical: scaleWidth(16),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(7,27,52,0.08)',
  },
  templatePickerTitle: {
    fontSize: scaleFont(16),
    fontWeight: '800',
    color: TEXT_DARK,
  },
  templatePickerList: {
    paddingHorizontal: scaleWidth(12),
  },
  templatePickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleWidth(14),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(7,27,52,0.06)',
  },
  templatePickerItemActive: {
    backgroundColor: 'rgba(7,27,52,0.04)',
    borderRadius: scaleWidth(10),
  },
  templatePickerItemText: {
    fontSize: scaleFont(14),
    color: TEXT_DARK,
    fontWeight: '600',
    flex: 1,
  },
  templatePickerItemTextActive: {
    color: PANEL_ACCENT,
    fontWeight: '800',
  },
  templatePickerEmpty: {
    fontSize: scaleFont(13),
    color: TEXT_MUTED,
    textAlign: 'center',
    paddingVertical: scaleWidth(16),
  },
  inlineTemplateContainer: {
    marginTop: scaleWidth(6),
    marginBottom: scaleWidth(10),
    borderWidth: 1,
    borderColor: 'rgba(7,27,52,0.12)',
    borderRadius: scaleWidth(12),
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  inlineTemplateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleWidth(10),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(7,27,52,0.06)',
  },
  inlineTemplateItemActive: {
    backgroundColor: 'rgba(7,27,52,0.05)',
  },
  inlineTemplateTitle: {
    fontSize: scaleFont(13),
    fontWeight: '700',
    color: TEXT_DARK,
  },
  inlineTemplateSnippet: {
    fontSize: scaleFont(11),
    color: TEXT_MUTED,
    marginTop: 2,
  },
  templateChip: {
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleWidth(6),
    borderRadius: scaleWidth(16),
    backgroundColor: 'rgba(7,27,52,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(7,27,52,0.12)',
    marginRight: scaleWidth(8),
  },
  templateChipText: {
    fontSize: scaleFont(12),
    fontWeight: '600',
    color: TEXT_DARK,
  },
  modalActions: {
    flexDirection: 'row',
    gap: scaleWidth(10),
    marginTop: scaleWidth(18),
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: scaleWidth(12),
    borderRadius: scaleWidth(12),
    borderWidth: 1,
    borderColor: 'rgba(7,27,52,0.12)',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: scaleFont(14),
    fontWeight: '700',
    color: TEXT_DARK,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: scaleWidth(12),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: scaleFont(14),
    fontWeight: '800',
    color: '#fff',
  },
});
