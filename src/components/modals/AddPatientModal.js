import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Image,
  useWindowDimensions,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import apiService from '../../services/apiService';

const COLORS = {
  primary: '#0052CC',
  primaryLight: '#EFF6FF',
  textDark: '#111827',
  textMuted: '#475569',
  border: '#E2E8F0',
  borderActive: '#0052CC',
  bgInput: '#FFFFFF',
  bgCard: '#FFFFFF',
  btnCancelBg: '#F1F5F9',
  btnCancelText: '#0052CC',
  btnSaveBg: '#0052CC',
  btnSaveText: '#FFFFFF',
  errorRed: '#EF4444',
  errorBg: '#FEF2F2',
};

const ALL_50_US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' }
];

const TIME_ZONES = [
  'PST - Pacific Time',
  'MST - Mountain Time',
  'CST - Central Time',
  'EST - Eastern Time',
  'UTC-7',
  'UTC-5',
  'UTC-4 with DST (BR)',
  'UTC-3',
  'UTC-3 with DST (BR)',
  'UTC-2',
  'WET - Western European Time',
  'CET - Central European Time',
  'UTC+2',
  'UTC+2 - Moscow Time',
  'UTC+8',
  'UTC+9',
  'UTC'
];

const CHRONIC_CONDITIONS_LIST = [
  'Hypertension (High BP)',
  'Diabetes Mellitus',
  'Chronic Kidney Disease',
  'Congestive Heart Failure',
  'COPD / Asthma',
  'Hyperlipidemia',
  'Arthritis / Joint Disease',
  'Depression / Anxiety'
];

function isEvitalsMonitoringPractice(practiceOrValue) {
  if (!practiceOrValue) return true;
  const raw =
    typeof practiceOrValue === 'string' || typeof practiceOrValue === 'number'
      ? practiceOrValue
      : practiceOrValue?.evitals_monitoring ?? practiceOrValue?.evitalsMonitoring ?? practiceOrValue?.is_evital_monitoring;

  if (raw == null || String(raw).trim() === '') return true;

  const v = String(raw).trim().toLowerCase();
  if (v === 'no' || v === '0' || v === 'false' || v.startsWith('no')) return false;
  return v === 'yes' || v === '1' || v === 'true' || v.startsWith('yes');
}

const formatUSPhone = (value) => {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const formatSSN = (value) => {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
};

const parseYmdToDate = (ymd) => {
  if (!ymd) return new Date();
  const parts = String(ymd).split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month, day);
    }
  }
  return new Date();
};

const formatDateToYmd = (date) => {
  if (!date || isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AddPatientModal({ visible, onClose, onSuccess, practiceId }) {
  const { width, height } = useWindowDimensions();
  const [currentStep, setCurrentStep] = useState(0);
  const isTablet = width >= 768;
  const isLargeTablet = width >= 1024;
  const modalWidth = isTablet
    ? Math.min(width - (isLargeTablet ? 72 : 40), isLargeTablet ? 1080 : 860)
    : width * 0.94;
  const modalHeight = isTablet
    ? Math.min(height - (isLargeTablet ? 72 : 48), isLargeTablet ? 900 : 780)
    : height * 0.86;
  const selectModalWidth = isLargeTablet ? 520 : isTablet ? 460 : width * 0.88;
  const stepperHeaderStyle = [styles.stepperHeader, isTablet && styles.stepperHeaderTablet];
  const stepperTitleStyle = [styles.stepperTitle, isTablet && styles.stepperTitleTablet];
  const stepperWrapperStyle = [styles.stepperWrapper, isTablet && styles.stepperWrapperTablet];
  const bodyContentStyle = [styles.bodyContent, isTablet && styles.bodyContentTablet];

  // Form State matching Web Dashboard
  const [formData, setFormData] = useState({
    // Personal Information
    title: 'Mr.',
    firstName: '',
    middleInitial: '',
    lastName: '',
    dateOfBirth: '1990-01-01',
    gender: 'Male',
    ssn: '',
    homePhone: '',
    cellPhone: '',
    fax: '',

    // Account Credentials
    username: '',
    email: '',
    password: '',
    confirmPassword: '',

    // Address & Location
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: 'NY',
    zipCode: '',
    timeZone: 'EST - Eastern Time',

    // Care Team & Settings
    status: 'Active',
    twoWayAuth: 'Enabled',
    mobileAppAccess: 'Enabled',
    providerId: '',
    systemCaregiverIds: [],
    practiceCaregiverIds: [],
    profilePicture: null,

    // Care Programs
    carePrograms: ['rpm', 'ccm'],

    // RPM Configuration
    rpmStartDate: new Date().toISOString().split('T')[0],
    monitoringTypes: ['Blood Pressure', 'Blood Glucose', 'Weight'],

    // CCM Configuration
    chronicConditions: ['Hypertension (High BP)', 'Diabetes Mellitus'],
    ccmConsentType: 'verbal',
    ccmVerbalChecklist: [true, true, true],
    careManagerId: '',

    // Insurance
    primaryInsuranceName: '',
    primarySubscriberId: '',
    primaryInsuredName: '',
    primaryGroupNo: '',
    secondaryInsuranceName: '',
    secondarySubscriberId: '',
    secondaryInsuredName: '',
    secondaryGroupNo: '',
  });

  // UI State for Modal Pickers & Toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [showRpmDatePicker, setShowRpmDatePicker] = useState(false);
  const [showStatePickerModal, setShowStatePickerModal] = useState(false);
  const [showTzPickerModal, setShowTzPickerModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [customPicUrl, setCustomPicUrl] = useState('');
  const [stateSearch, setStateSearch] = useState('');
  const [tzSearch, setTzSearch] = useState('');

  // Data Loading & Practice Monitoring Condition
  const [requiresSystemCaregiver, setRequiresSystemCaregiver] = useState(true);
  const [systemCaregiversLoading, setSystemCaregiversLoading] = useState(true);
  const [providersList, setProvidersList] = useState([]);
  const [practiceCaregivers, setPracticeCaregivers] = useState([]);
  const [systemCaregivers, setSystemCaregivers] = useState([]);

  // Validation & Availability States
  const [errors, setErrors] = useState({});
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [checkingSsn, setCheckingSsn] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Availability Timers
  const usernameTimer = useRef(null);
  const emailTimer = useRef(null);
  const ssnTimer = useRef(null);

  // Load Practice Details & Caregivers
  useEffect(() => {
    if (visible && practiceId) {
      setSystemCaregiversLoading(true);

      // 1. Providers
      apiService.getPracticeProviders(practiceId).then((res) => {
        if (res?.success && Array.isArray(res.data)) {
          setProvidersList(res.data);
        }
      }).catch(() => null);

      // 2. Practice Details -> Check eVitals Monitoring
      apiService.getPracticeDetails(practiceId).then((res) => {
        const pData = res?.data || res;
        const reqSys = isEvitalsMonitoringPractice(pData);
        setRequiresSystemCaregiver(reqSys);
      }).catch(() => {
        setRequiresSystemCaregiver(true);
      });

      // 3. Practice Caregivers
      apiService.getPracticeCaregivers(practiceId).then((res) => {
        if (res?.success && Array.isArray(res.data)) {
          setPracticeCaregivers(res.data);
        }
      }).catch(() => null);

      // 4. System Caregivers
      apiService.getSystemCaregivers(practiceId).then((res) => {
        const list = Array.isArray(res) ? res : (res?.data || res?.caregivers || []);
        setSystemCaregivers(Array.isArray(list) ? list : []);
      }).catch(() => {
        setSystemCaregivers([]);
      }).finally(() => {
        setSystemCaregiversLoading(false);
      });
    }
  }, [visible, practiceId]);

  useEffect(() => {
    if (providersList.length > 0 && !formData.providerId) {
      setFormData(prev => ({
        ...prev,
        providerId: String(providersList[0].id || providersList[0].provider_id),
      }));
    }
  }, [providersList, formData.providerId]);

  // Real-time Username Availability
  const handleUsernameChange = (text) => {
    const val = text.trim();
    setFormData(prev => ({ ...prev, username: val }));
    if (errors.username) setErrors(prev => ({ ...prev, username: null }));
    if (usernameTimer.current) clearTimeout(usernameTimer.current);

    if (!val) return;
    if (val.length < 3) {
      setErrors(prev => ({ ...prev, username: 'Username must be at least 3 characters' }));
      return;
    }

    setCheckingUsername(true);
    usernameTimer.current = setTimeout(async () => {
      try {
        const res = await apiService.checkUsername(val);
        if (res && (res.available === false || res.data?.available === false)) {
          setErrors(prev => ({ ...prev, username: 'This username is already taken. Please choose a different username.' }));
        }
      } catch (err) {
        if (err.message && err.message.toLowerCase().includes('taken')) {
          setErrors(prev => ({ ...prev, username: 'This username is already taken. Please choose a different username.' }));
        }
      } finally {
        setCheckingUsername(false);
      }
    }, 500);
  };

  // Real-time Email Availability
  const handleEmailChange = (text) => {
    const val = text.trim();
    setFormData(prev => ({ ...prev, email: val }));
    if (errors.email) setErrors(prev => ({ ...prev, email: null }));
    if (emailTimer.current) clearTimeout(emailTimer.current);

    if (!val) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) {
      setErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
      return;
    }

    setCheckingEmail(true);
    emailTimer.current = setTimeout(async () => {
      try {
        const res = await apiService.checkEmail(val);
        if (res && (res.available === false || res.data?.available === false)) {
          setErrors(prev => ({ ...prev, email: 'This email address is already registered. Please use a different email.' }));
        }
      } catch (err) {
        if (err.message && err.message.toLowerCase().includes('registered')) {
          setErrors(prev => ({ ...prev, email: 'This email address is already registered. Please use a different email.' }));
        }
      } finally {
        setCheckingEmail(false);
      }
    }, 500);
  };

  // Real-time SSN Availability
  const handleSsnChange = (text) => {
    const val = formatSSN(text);
    setFormData(prev => ({ ...prev, ssn: val }));
    if (errors.ssn) setErrors(prev => ({ ...prev, ssn: null }));
    if (ssnTimer.current) clearTimeout(ssnTimer.current);

    if (!val) return;

    setCheckingSsn(true);
    ssnTimer.current = setTimeout(async () => {
      try {
        const res = await apiService.checkSsn(val);
        if (res && (res.available === false || res.data?.available === false)) {
          setErrors(prev => ({ ...prev, ssn: 'This SSN is already registered to another patient.' }));
        }
      } catch (err) {
        if (err.message && err.message.toLowerCase().includes('ssn')) {
          setErrors(prev => ({ ...prev, ssn: 'This SSN is already registered to another patient.' }));
        }
      } finally {
        setCheckingSsn(false);
      }
    }, 500);
  };

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const toggleCaregiverId = (listName, id) => {
    setFormData(prev => {
      const current = prev[listName] || [];
      const exists = current.includes(id);
      const updated = exists ? current.filter(i => i !== id) : [...current, id];
      return { ...prev, [listName]: updated };
    });
  };

  const handleDobChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowDobPicker(false);
    if (selectedDate) {
      handleFieldChange('dateOfBirth', formatDateToYmd(selectedDate));
    }
  };

  const handleRpmDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowRpmDatePicker(false);
    if (selectedDate) {
      handleFieldChange('rpmStartDate', formatDateToYmd(selectedDate));
    }
  };

  const toggleMonitoringType = (type) => {
    setFormData(prev => {
      const exists = prev.monitoringTypes.includes(type);
      const next = exists ? prev.monitoringTypes.filter(t => t !== type) : [...prev.monitoringTypes, type];
      return { ...prev, monitoringTypes: next };
    });
  };

  const toggleChronicCondition = (cond) => {
    setFormData(prev => {
      const exists = prev.chronicConditions.includes(cond);
      const next = exists ? prev.chronicConditions.filter(c => c !== cond) : [...prev.chronicConditions, cond];
      return { ...prev, chronicConditions: next };
    });
  };

  const toggleVerbalCheck = (index) => {
    setFormData(prev => {
      const copy = [...prev.ccmVerbalChecklist];
      copy[index] = !copy[index];
      return { ...prev, ccmVerbalChecklist: copy };
    });
  };

  const toggleProgram = (prog) => {
    setFormData(prev => {
      const exists = prev.carePrograms.includes(prog);
      const next = exists ? prev.carePrograms.filter(p => p !== prog) : [...prev.carePrograms, prog];
      return { ...prev, carePrograms: next };
    });
  };

  // Dynamic Stepper Steps depending on enrolled programs
  const stepperSteps = useMemo(() => {
    const steps = [
      { id: 'demographics', label: 'Demographics' },
      { id: 'programs', label: 'Programs' },
    ];
    if (formData.carePrograms.includes('rpm')) {
      steps.push({ id: 'rpm', label: 'RPM' });
    }
    if (formData.carePrograms.includes('ccm')) {
      steps.push({ id: 'ccm', label: 'CCM' });
    }
    return steps.map((s, idx) => ({ ...s, index: idx }));
  }, [formData.carePrograms]);

  const activeStep = stepperSteps[currentStep] || stepperSteps[0];

  const validateCurrentStep = () => {
    const newErrors = {};

    if (currentStep === 0) {
      if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
      if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
      if (!formData.dateOfBirth.trim()) newErrors.dateOfBirth = 'Date of birth is required';
      
      if (!formData.email.trim()) {
        newErrors.email = 'Email address is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
        newErrors.email = 'Please enter a valid email address';
      }

      if (!formData.username.trim()) {
        newErrors.username = 'Username is required';
      }

      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else if (formData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters long';
      }

      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    if (errors.username) newErrors.username = errors.username;
    if (errors.email) newErrors.email = errors.email;
    if (errors.ssn) newErrors.ssn = errors.ssn;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) {
      Alert.alert('Validation Error', 'Please fill in all required fields correctly before saving.');
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        title: formData.title,
        first_name: formData.firstName,
        middle_name: formData.middleInitial,
        last_name: formData.lastName,
        date_of_birth: formData.dateOfBirth,
        gender: formData.gender,
        status: formData.status,
        time_zone: formData.timeZone,
        rpm_start_date: formData.rpmStartDate,

        address_line_1: formData.addressLine1,
        address_line_2: formData.addressLine2,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zipCode,

        home_phone: formData.homePhone.replace(/\D/g, ''),
        cell_phone: formData.cellPhone.replace(/\D/g, ''),
        fax: formData.fax.replace(/\D/g, ''),
        email: formData.email,
        ssn: formData.ssn,

        username: formData.username,
        password: formData.password,
        provider_id: formData.providerId ? Number(formData.providerId) : null,
        system_caregiver_ids: formData.systemCaregiverIds,
        practice_caregiver_ids: formData.practiceCaregiverIds,

        primary_insurance_name: formData.primaryInsuranceName,
        primary_subscriber_id: formData.primarySubscriberId,
        primary_insured_name: formData.primaryInsuredName,
        primary_group_no: formData.primaryGroupNo,

        secondary_insurance_name: formData.secondaryInsuranceName,
        secondary_subscriber_id: formData.secondarySubscriberId,
        secondary_insured_name: formData.secondaryInsuredName,
        secondary_group_no: formData.secondaryGroupNo,

        care_programs: formData.carePrograms,
        monitoring_types: formData.monitoringTypes,
        chronic_conditions: formData.chronicConditions,
        ccm_consent_type: formData.ccmConsentType,
        ccm_verbal_checklist: formData.ccmVerbalChecklist,
      };

      const result = await apiService.createPatient(practiceId, payload);

      if (result && (result.success || result.data || result.id)) {
        Alert.alert('Success', 'Patient created successfully!');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        throw new Error(result?.message || 'Failed to create patient');
      }
    } catch (err) {
      console.log('Error creating patient:', err);
      const msg = err?.message || 'Failed to add patient. Please try again.';
      if (msg.toLowerCase().includes('username')) {
        setErrors(prev => ({ ...prev, username: 'This username is already taken. Please choose a different username.' }));
      }
      if (msg.toLowerCase().includes('email')) {
        setErrors(prev => ({ ...prev, email: 'This email address is already registered. Please use a different email.' }));
      }
      Alert.alert('Registration Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  const filteredStates = ALL_50_US_STATES.filter(
    s => s.name.toLowerCase().includes(stateSearch.toLowerCase()) || s.code.toLowerCase().includes(stateSearch.toLowerCase())
  );

  const filteredTz = TIME_ZONES.filter(
    tz => tz.toLowerCase().includes(tzSearch.toLowerCase())
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}>
          <View
            style={[
              styles.contentCard,
              {
                width: modalWidth,
                height: modalHeight,
                borderRadius: isTablet ? 18 : 12,
              },
            ]}
          >
            {/* Stepper Header Matching Web Design C */}
            <View style={stepperHeaderStyle}>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} disabled={submitting}>
                <MaterialIcons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>

              <Text style={stepperTitleStyle}>Add Patient</Text>

              {/* Dynamic Stepper Wizard Bar */}
              <View style={stepperWrapperStyle}>
                {stepperSteps.map((step, idx) => {
                  const isCompleted = currentStep > step.index;
                  const isActive = currentStep === step.index;

                  return (
                    <React.Fragment key={step.id}>
                      <TouchableOpacity
                        style={styles.stepperItem}
                        onPress={() => {
                          if (step.index <= currentStep || validateCurrentStep()) {
                            setCurrentStep(step.index);
                          }
                        }}>
                        <View style={[
                          styles.stepperCircle,
                          isCompleted && styles.stepperCircleCompleted,
                          isActive && styles.stepperCircleActive,
                        ]}>
                          {isCompleted ? (
                            <MaterialIcons name="check" size={14} color="#FFFFFF" />
                          ) : isActive ? (
                            <View style={styles.stepperCircleInner} />
                          ) : null}
                        </View>
                          <Text
                            style={[
                              styles.stepperLabel,
                              isTablet && styles.stepperLabelTablet,
                              isActive && styles.stepperLabelActive,
                            ]}
                          >
                            {step.label}
                          </Text>
                      </TouchableOpacity>

                      {idx < stepperSteps.length - 1 && (
                        <View style={[styles.stepperLine, isCompleted && styles.stepperLineActive]} />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
            </View>

            {/* Form Scrollable Body */}
            <ScrollView
              style={styles.bodyScroll}
              contentContainerStyle={bodyContentStyle}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={true}>

              {/* STEP 1: DEMOGRAPHICS */}
              {activeStep.id === 'demographics' && (
                <View style={styles.stepContainer}>
                  {/* 1. PERSONAL INFORMATION */}
                  <View style={styles.sectionLabelBar}>
                    <Text style={styles.sectionLabelText}>Personal Information</Text>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Title</Text>
                    <View style={styles.chipRow}>
                      {['Mr.', 'Ms.', 'Mrs.', 'Dr.'].map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={[styles.chip, formData.title === t && styles.chipSelected]}
                          onPress={() => handleFieldChange('title', t)}>
                          <Text style={[styles.chipText, formData.title === t && styles.chipTextSelected]}>{t}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>First Name *</Text>
                    <TextInput
                      style={[styles.input, errors.firstName && styles.inputInvalid]}
                      value={formData.firstName}
                      onChangeText={(t) => handleFieldChange('firstName', t)}
                      placeholder="e.g. John"
                      placeholderTextColor="#94A3B8"
                    />
                    {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
                  </View>

                  <View style={styles.gridRow}>
                    <View style={[styles.formGroup, { width: '30%', marginRight: 10 }]}>
                      <Text style={styles.label}>Middle Name</Text>
                      <TextInput
                        style={styles.input}
                        value={formData.middleInitial}
                        onChangeText={(t) => handleFieldChange('middleInitial', t)}
                        placeholder="M.I."
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Last Name *</Text>
                      <TextInput
                        style={[styles.input, errors.lastName && styles.inputInvalid]}
                        value={formData.lastName}
                        onChangeText={(t) => handleFieldChange('lastName', t)}
                        placeholder="e.g. Doe"
                        placeholderTextColor="#94A3B8"
                      />
                      {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Gender *</Text>
                    <View style={styles.chipRow}>
                      {['Male', 'Female'].map((g) => (
                        <TouchableOpacity
                          key={g}
                          style={[styles.chip, formData.gender === g && styles.chipSelected]}
                          onPress={() => handleFieldChange('gender', g)}>
                          <Text style={[styles.chipText, formData.gender === g && styles.chipTextSelected]}>{g}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Date of Birth *</Text>
                    <TouchableOpacity
                      style={[styles.dropdownSelectInput, errors.dateOfBirth && styles.inputInvalid]}
                      onPress={() => setShowDobPicker(true)}>
                      <Text style={styles.dropdownSelectText}>{formData.dateOfBirth || 'Select Date of Birth'}</Text>
                      <MaterialIcons name="event" size={20} color="#0052CC" />
                    </TouchableOpacity>
                    {errors.dateOfBirth && <Text style={styles.errorText}>{errors.dateOfBirth}</Text>}
                  </View>

                  <View style={styles.formGroup}>
                    <View style={styles.labelRow}>
                      <Text style={styles.label}>SSN (Social Security Number) *</Text>
                      {checkingSsn && <ActivityIndicator size="small" color="#0052CC" style={{ marginLeft: 6 }} />}
                    </View>
                    <TextInput
                      style={[styles.input, errors.ssn && styles.inputInvalid]}
                      value={formData.ssn}
                      onChangeText={handleSsnChange}
                      placeholder="000-00-0000"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                    />
                    {errors.ssn && <Text style={styles.errorText}>{errors.ssn}</Text>}
                  </View>

                  <View style={styles.gridRow}>
                    <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                      <Text style={styles.label}>Home Phone</Text>
                      <TextInput
                        style={styles.input}
                        value={formData.homePhone}
                        onChangeText={(t) => handleFieldChange('homePhone', formatUSPhone(t))}
                        placeholder="(000) 000-0000"
                        placeholderTextColor="#94A3B8"
                        keyboardType="phone-pad"
                      />
                    </View>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Cell Phone *</Text>
                      <TextInput
                        style={styles.input}
                        value={formData.cellPhone}
                        onChangeText={(t) => handleFieldChange('cellPhone', formatUSPhone(t))}
                        placeholder="(000) 000-0000"
                        placeholderTextColor="#94A3B8"
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Fax</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.fax}
                      onChangeText={(t) => handleFieldChange('fax', formatUSPhone(t))}
                      placeholder="(000) 000-0000"
                      placeholderTextColor="#94A3B8"
                      keyboardType="phone-pad"
                    />
                  </View>

                  {/* 2. ACCOUNT CREDENTIALS */}
                  <View style={[styles.sectionLabelBar, { marginTop: 16 }]}>
                    <Text style={styles.sectionLabelText}>Account Credentials</Text>
                  </View>

                  <View style={styles.formGroup}>
                    <View style={styles.labelRow}>
                      <Text style={styles.label}>Username *</Text>
                      {checkingUsername && <ActivityIndicator size="small" color="#0052CC" style={{ marginLeft: 6 }} />}
                    </View>
                    <TextInput
                      style={[styles.input, errors.username && styles.inputInvalid]}
                      value={formData.username}
                      onChangeText={handleUsernameChange}
                      placeholder="e.g., john.doe"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                    />
                    {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
                  </View>

                  <View style={styles.formGroup}>
                    <View style={styles.labelRow}>
                      <Text style={styles.label}>Email *</Text>
                      {checkingEmail && <ActivityIndicator size="small" color="#0052CC" style={{ marginLeft: 6 }} />}
                    </View>
                    <TextInput
                      style={[styles.input, errors.email && styles.inputInvalid]}
                      value={formData.email}
                      onChangeText={handleEmailChange}
                      placeholder="e.g., patient@example.com"
                      placeholderTextColor="#94A3B8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Password *</Text>
                    <View style={styles.passwordWrap}>
                      <TextInput
                        style={[styles.input, errors.password && styles.inputInvalid, { paddingRight: 40 }]}
                        value={formData.password}
                        onChangeText={(t) => handleFieldChange('password', t)}
                        placeholder="Enter at least 8 characters"
                        placeholderTextColor="#94A3B8"
                        secureTextEntry={!showPassword}
                      />
                      <TouchableOpacity
                        style={styles.eyeBtn}
                        onPress={() => setShowPassword(!showPassword)}>
                        <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={20} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                    {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Confirm Password *</Text>
                    <View style={styles.passwordWrap}>
                      <TextInput
                        style={[styles.input, errors.confirmPassword && styles.inputInvalid, { paddingRight: 40 }]}
                        value={formData.confirmPassword}
                        onChangeText={(t) => handleFieldChange('confirmPassword', t)}
                        placeholder="Enter at least 8 characters"
                        placeholderTextColor="#94A3B8"
                        secureTextEntry={!showConfirmPassword}
                      />
                      <TouchableOpacity
                        style={styles.eyeBtn}
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                        <MaterialIcons name={showConfirmPassword ? 'visibility-off' : 'visibility'} size={20} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                    {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
                  </View>

                  {/* 3. ADDRESS & LOCATION */}
                  <View style={[styles.sectionLabelBar, { marginTop: 16 }]}>
                    <Text style={styles.sectionLabelText}>Address & Location</Text>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Address Line 1 *</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.addressLine1}
                      onChangeText={(t) => handleFieldChange('addressLine1', t)}
                      placeholder="e.g., 123 Main St"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Address Line 2</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.addressLine2}
                      onChangeText={(t) => handleFieldChange('addressLine2', t)}
                      placeholder="e.g., Apt 4B"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={styles.gridRow}>
                    <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                      <Text style={styles.label}>City *</Text>
                      <TextInput
                        style={styles.input}
                        value={formData.city}
                        onChangeText={(t) => handleFieldChange('city', t)}
                        placeholder="New York"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    {/* State Dropdown Modal Trigger */}
                    <View style={[styles.formGroup, { width: 100, marginRight: 8 }]}>
                      <Text style={styles.label}>State *</Text>
                      <TouchableOpacity
                        style={styles.dropdownSelectInput}
                        onPress={() => setShowStatePickerModal(true)}>
                        <Text style={styles.dropdownSelectText}>{formData.state || 'State'}</Text>
                        <MaterialIcons name="arrow-drop-down" size={20} color="#64748B" />
                      </TouchableOpacity>
                    </View>

                    <View style={[styles.formGroup, { width: 95 }]}>
                      <Text style={styles.label}>Zip Code *</Text>
                      <TextInput
                        style={styles.input}
                        value={formData.zipCode}
                        onChangeText={(t) => handleFieldChange('zipCode', t)}
                        placeholder="10001"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        maxLength={5}
                      />
                    </View>
                  </View>

                  {/* Time Zone Dropdown Modal Trigger */}
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Time Zone *</Text>
                    <TouchableOpacity
                      style={styles.dropdownSelectInput}
                      onPress={() => setShowTzPickerModal(true)}>
                      <Text style={styles.dropdownSelectText}>{formData.timeZone}</Text>
                      <MaterialIcons name="arrow-drop-down" size={20} color="#64748B" />
                    </TouchableOpacity>
                  </View>

                  {/* 4. CARE TEAM & SETTINGS */}
                  <View style={[styles.sectionLabelBar, { marginTop: 16 }]}>
                    <Text style={styles.sectionLabelText}>Care Team & Settings</Text>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Status *</Text>
                    <View style={styles.chipRow}>
                      {['Active', 'Pending', 'Locked'].map(st => (
                        <TouchableOpacity
                          key={st}
                          style={[styles.chip, formData.status === st && styles.chipSelected]}
                          onPress={() => handleFieldChange('status', st)}>
                          <Text style={[styles.chipText, formData.status === st && styles.chipTextSelected]}>{st}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Two Way Authentication *</Text>
                    <View style={styles.chipRow}>
                      {['Enabled', 'Disabled'].map(auth => (
                        <TouchableOpacity
                          key={auth}
                          style={[styles.chip, formData.twoWayAuth === auth && styles.chipSelected]}
                          onPress={() => handleFieldChange('twoWayAuth', auth)}>
                          <Text style={[styles.chipText, formData.twoWayAuth === auth && styles.chipTextSelected]}>{auth}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Mobile App Access</Text>
                    <View style={styles.chipRow}>
                      {['Enabled', 'Disabled'].map(acc => (
                        <TouchableOpacity
                          key={acc}
                          style={[styles.chip, formData.mobileAppAccess === acc && styles.chipSelected]}
                          onPress={() => handleFieldChange('mobileAppAccess', acc)}>
                          <Text style={[styles.chipText, formData.mobileAppAccess === acc && styles.chipTextSelected]}>
                            {acc === 'Enabled' ? 'On' : 'Off'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Primary Provider */}
                  {providersList.length > 0 && (
                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Primary Provider *</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {providersList.map((p) => {
                          const pId = String(p.id || p.provider_id);
                          const pName = p.name || `Dr. ${p.first_name || ''} ${p.last_name || ''}`;
                          const isSelected = formData.providerId === pId;
                          return (
                            <TouchableOpacity
                              key={pId}
                              style={[styles.chip, isSelected && styles.chipSelected]}
                              onPress={() => handleFieldChange('providerId', pId)}>
                              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{pName}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {/* System Caregivers */}
                  {requiresSystemCaregiver && (
                    <View style={styles.formGroup}>
                      <Text style={styles.label}>System Caregivers (eVitals Monitoring)</Text>
                      {systemCaregiversLoading ? (
                        <ActivityIndicator size="small" color="#0052CC" style={{ alignSelf: 'flex-start', marginVertical: 4 }} />
                      ) : systemCaregivers.length === 0 ? (
                        <Text style={styles.subtextMuted}>No system caregivers assigned to this practice</Text>
                      ) : (
                        <View style={styles.chipRow}>
                          {systemCaregivers.map((cg) => {
                            const cgId = String(cg.id || cg.user_id);
                            const cgName = `${cg.first_name || ''} ${cg.last_name || ''}`.trim() || cg.username;
                            const isSelected = formData.systemCaregiverIds.includes(cgId);
                            return (
                              <TouchableOpacity
                                key={cgId}
                                style={[styles.chip, isSelected && styles.chipSelected]}
                                onPress={() => toggleCaregiverId('systemCaregiverIds', cgId)}>
                                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                                  {isSelected ? `✓ ${cgName}` : `+ ${cgName}`}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Practice Caregivers */}
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Practice Caregivers</Text>
                    {practiceCaregivers.length === 0 ? (
                      <Text style={styles.subtextMuted}>No practice caregivers available</Text>
                    ) : (
                      <View style={styles.chipRow}>
                        {practiceCaregivers.map((cg) => {
                          const cgId = String(cg.id || cg.user_id);
                          const cgName = `${cg.first_name || ''} ${cg.last_name || ''}`.trim() || cg.username;
                          const isSelected = formData.practiceCaregiverIds.includes(cgId);
                          return (
                            <TouchableOpacity
                              key={cgId}
                              style={[styles.chip, isSelected && styles.chipSelected]}
                              onPress={() => toggleCaregiverId('practiceCaregiverIds', cgId)}>
                              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                                {isSelected ? `✓ ${cgName}` : `+ ${cgName}`}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  {/* Upload Picture */}
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Upload Profile Picture</Text>
                    <View style={styles.uploadRow}>
                      <TouchableOpacity
                        style={styles.uploadBtn}
                        onPress={() => setShowAvatarModal(true)}>
                        <MaterialIcons name="photo-camera" size={18} color="#FFFFFF" />
                        <Text style={styles.uploadBtnText}>Choose Avatar / Picture</Text>
                      </TouchableOpacity>

                      {formData.profilePicture ? (
                        <View style={styles.previewWrap}>
                          <Image source={{ uri: formData.profilePicture }} style={styles.avatarPreview} />
                          <TouchableOpacity onPress={() => handleFieldChange('profilePicture', null)}>
                            <Text style={styles.removePicBtn}>✕ Remove</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              )}

              {/* STEP 2: CARE PROGRAMS SELECTION */}
              {activeStep.id === 'programs' && (
                <View style={styles.stepContainer}>
                  <Text style={styles.sectionTitle}>Enroll in Care Programs *</Text>

                  <View style={styles.programStack}>
                    <TouchableOpacity
                      style={[styles.progCardModern, formData.carePrograms.includes('rpm') && styles.progCardModernSelected]}
                      onPress={() => toggleProgram('rpm')}>
                      <View style={styles.progCardContent}>
                        <MaterialIcons
                          name={formData.carePrograms.includes('rpm') ? 'check-box' : 'check-box-outline-blank'}
                          size={22}
                          color={formData.carePrograms.includes('rpm') ? '#0052CC' : '#94A3B8'}
                        />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.progName}>Remote Patient Monitoring (RPM)</Text>
                          <Text style={styles.progSub}>Monitor vital signs like BP, blood glucose, and weight remotely.</Text>
                        </View>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.progCardModern, formData.carePrograms.includes('ccm') && styles.progCardModernSelected]}
                      onPress={() => toggleProgram('ccm')}>
                      <View style={styles.progCardContent}>
                        <MaterialIcons
                          name={formData.carePrograms.includes('ccm') ? 'check-box' : 'check-box-outline-blank'}
                          size={22}
                          color={formData.carePrograms.includes('ccm') ? '#0052CC' : '#94A3B8'}
                        />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.progName}>Chronic Care Management (CCM)</Text>
                          <Text style={styles.progSub}>Comprehensive care coordination for chronic conditions.</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* STEP 3: RPM CONFIGURATION */}
              {activeStep.id === 'rpm' && (
                <View style={styles.stepContainer}>
                  <Text style={styles.sectionTitle}>RPM Configuration & Insurance</Text>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>RPM Start Date *</Text>
                    <TouchableOpacity
                      style={styles.dropdownSelectInput}
                      onPress={() => setShowRpmDatePicker(true)}>
                      <Text style={styles.dropdownSelectText}>{formData.rpmStartDate || 'Select RPM Start Date'}</Text>
                      <MaterialIcons name="event" size={20} color="#0052CC" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Type of Monitoring *</Text>
                    <View style={styles.chipRow}>
                      {['Blood Pressure', 'Blood Glucose', 'Weight'].map((type) => {
                        const isChecked = formData.monitoringTypes.includes(type);
                        return (
                          <TouchableOpacity
                            key={type}
                            style={[styles.chip, isChecked && styles.chipSelected]}
                            onPress={() => toggleMonitoringType(type)}>
                            <Text style={[styles.chipText, isChecked && styles.chipTextSelected]}>
                              {type === 'Blood Pressure' ? 'BP' : type === 'Blood Glucose' ? 'Glucose' : 'Weight'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* PRIMARY INSURANCE */}
                  <View style={[styles.sectionLabelBar, { marginTop: 16 }]}>
                    <Text style={styles.sectionLabelText}>Primary Insurance</Text>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Insurance Company Name</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.primaryInsuranceName}
                      onChangeText={(t) => handleFieldChange('primaryInsuranceName', t)}
                      placeholder="e.g. Medicare / Aetna"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={styles.gridRow}>
                    <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                      <Text style={styles.label}>Subscriber ID</Text>
                      <TextInput
                        style={styles.input}
                        value={formData.primarySubscriberId}
                        onChangeText={(t) => handleFieldChange('primarySubscriberId', t)}
                        placeholder="Subscriber ID"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Group Number</Text>
                      <TextInput
                        style={styles.input}
                        value={formData.primaryGroupNo}
                        onChangeText={(t) => handleFieldChange('primaryGroupNo', t)}
                        placeholder="Group No."
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>

                  {/* SECONDARY INSURANCE */}
                  <View style={[styles.sectionLabelBar, { marginTop: 16 }]}>
                    <Text style={styles.sectionLabelText}>Secondary Insurance</Text>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Insurance Company Name</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.secondaryInsuranceName}
                      onChangeText={(t) => handleFieldChange('secondaryInsuranceName', t)}
                      placeholder="e.g. Blue Cross"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={styles.gridRow}>
                    <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                      <Text style={styles.label}>Subscriber ID</Text>
                      <TextInput
                        style={styles.input}
                        value={formData.secondarySubscriberId}
                        onChangeText={(t) => handleFieldChange('secondarySubscriberId', t)}
                        placeholder="Subscriber ID"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Group Number</Text>
                      <TextInput
                        style={styles.input}
                        value={formData.secondaryGroupNo}
                        onChangeText={(t) => handleFieldChange('secondaryGroupNo', t)}
                        placeholder="Group No."
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* STEP 4: CCM CONFIGURATION */}
              {activeStep.id === 'ccm' && (
                <View style={styles.stepContainer}>
                  <Text style={styles.sectionTitle}>Chronic Care Management (CCM)</Text>

                  {/* Chronic Disease Selection */}
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Chronic Disease Selection (Min. 2) *</Text>
                    <View style={styles.chipRow}>
                      {CHRONIC_CONDITIONS_LIST.map((cond) => {
                        const isChecked = formData.chronicConditions.includes(cond);
                        return (
                          <TouchableOpacity
                            key={cond}
                            style={[styles.chip, isChecked && styles.chipSelected]}
                            onPress={() => toggleChronicCondition(cond)}>
                            <Text style={[styles.chipText, isChecked && styles.chipTextSelected]}>
                              {isChecked ? `✓ ${cond}` : `+ ${cond}`}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Patient Consent */}
                  <View style={[styles.sectionLabelBar, { marginTop: 16 }]}>
                    <Text style={styles.sectionLabelText}>Patient Consent</Text>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Consent Type</Text>
                    <View style={styles.chipRow}>
                      {['verbal', 'written'].map((type) => (
                        <TouchableOpacity
                          key={type}
                          style={[styles.chip, formData.ccmConsentType === type && styles.chipSelected]}
                          onPress={() => handleFieldChange('ccmConsentType', type)}>
                          <Text style={[styles.chipText, formData.ccmConsentType === type && styles.chipTextSelected]}>
                            {type === 'verbal' ? 'Verbal Consent' : 'Written Consent'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Verbal Consent Checklist */}
                  {formData.ccmConsentType === 'verbal' && (
                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Verbal Consent Checklist</Text>
                      {[
                        'Did you explain the CCM services, including availability of 24/7 access to care?',
                        'Did you inform the patient that only one practitioner can be paid for CCM services?',
                        'Did you inform the patient of their right to stop CCM services at any time?'
                      ].map((q, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={styles.ccmCheckRow}
                          onPress={() => toggleVerbalCheck(idx)}>
                          <MaterialIcons
                            name={formData.ccmVerbalChecklist[idx] ? 'check-box' : 'check-box-outline-blank'}
                            size={20}
                            color={formData.ccmVerbalChecklist[idx] ? '#0052CC' : '#94A3B8'}
                          />
                          <Text style={styles.ccmCheckText}>{q}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            {/* Stepper Footer Action Bar */}
            <View style={styles.pifFooter}>
              <TouchableOpacity style={styles.pifCancelBtn} onPress={onClose} disabled={submitting}>
                <Text style={styles.pifCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                {currentStep > 0 && (
                  <TouchableOpacity
                    style={styles.pifCancelBtn}
                    onPress={() => setCurrentStep(prev => prev - 1)}
                    disabled={submitting}>
                    <Text style={styles.pifCancelBtnText}>Back</Text>
                  </TouchableOpacity>
                )}

                {currentStep < stepperSteps.length - 1 ? (
                  <TouchableOpacity
                    style={styles.pifSaveBtn}
                    onPress={() => {
                      if (validateCurrentStep()) setCurrentStep(prev => prev + 1);
                    }}>
                    <Text style={styles.pifSaveBtnText}>Next</Text>
                    <MaterialIcons name="chevron-right" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.pifSaveBtn} onPress={handleSubmit} disabled={submitting}>
                    {submitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <MaterialIcons name="save" size={16} color="#FFFFFF" />
                        <Text style={styles.pifSaveBtnText}>Save Patient</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>

        {/* State Selection Modal */}
        <Modal visible={showStatePickerModal} animationType="fade" transparent onRequestClose={() => setShowStatePickerModal(false)}>
          <View style={styles.modalSelectOverlay}>
            <View style={[styles.modalSelectContent, { width: selectModalWidth, maxWidth: selectModalWidth }]}>
              <View style={styles.modalSelectHeader}>
                <Text style={styles.modalSelectTitle}>Select State</Text>
                <TouchableOpacity onPress={() => setShowStatePickerModal(false)}>
                  <MaterialIcons name="close" size={22} color="#94A3B8" />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search state or code..."
                placeholderTextColor="#94A3B8"
                value={stateSearch}
                onChangeText={setStateSearch}
              />
              <ScrollView style={{ maxHeight: 350 }}>
                {filteredStates.map((st) => (
                  <TouchableOpacity
                    key={st.code}
                    style={[styles.modalSelectItem, formData.state === st.code && styles.modalSelectItemActive]}
                    onPress={() => {
                      handleFieldChange('state', st.code);
                      setShowStatePickerModal(false);
                      setStateSearch('');
                    }}>
                    <Text style={[styles.modalSelectText, formData.state === st.code && styles.modalSelectTextActive]}>
                      {st.name} ({st.code})
                    </Text>
                    {formData.state === st.code && <MaterialIcons name="check" size={18} color="#0052CC" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Time Zone Selection Modal */}
        <Modal visible={showTzPickerModal} animationType="fade" transparent onRequestClose={() => setShowTzPickerModal(false)}>
          <View style={styles.modalSelectOverlay}>
            <View style={[styles.modalSelectContent, { width: selectModalWidth, maxWidth: selectModalWidth }]}>
              <View style={styles.modalSelectHeader}>
                <Text style={styles.modalSelectTitle}>Select Time Zone</Text>
                <TouchableOpacity onPress={() => setShowTzPickerModal(false)}>
                  <MaterialIcons name="close" size={22} color="#94A3B8" />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search time zone..."
                placeholderTextColor="#94A3B8"
                value={tzSearch}
                onChangeText={setTzSearch}
              />
              <ScrollView style={{ maxHeight: 350 }}>
                {filteredTz.map((tz) => (
                  <TouchableOpacity
                    key={tz}
                    style={[styles.modalSelectItem, formData.timeZone === tz && styles.modalSelectItemActive]}
                    onPress={() => {
                      handleFieldChange('timeZone', tz);
                      setShowTzPickerModal(false);
                      setTzSearch('');
                    }}>
                    <Text style={[styles.modalSelectText, formData.timeZone === tz && styles.modalSelectTextActive]}>{tz}</Text>
                    {formData.timeZone === tz && <MaterialIcons name="check" size={18} color="#0052CC" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Avatar / Profile Picture Selection Modal */}
        <Modal visible={showAvatarModal} animationType="fade" transparent onRequestClose={() => setShowAvatarModal(false)}>
          <View style={styles.modalSelectOverlay}>
            <View style={[styles.modalSelectContent, { width: Math.min(selectModalWidth, 560), maxWidth: Math.min(selectModalWidth, 560) }]}>
              <View style={styles.modalSelectHeader}>
                <Text style={styles.modalSelectTitle}>Choose Profile Picture / Avatar</Text>
                <TouchableOpacity onPress={() => setShowAvatarModal(false)}>
                  <MaterialIcons name="close" size={22} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <Text style={[styles.label, { marginBottom: 8 }]}>Preset Avatars</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 16 }}>
                {[
                  { label: 'Patient M', url: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.firstName || 'Male')}+${encodeURIComponent(formData.lastName || 'Patient')}&background=0052CC&color=fff&size=128` },
                  { label: 'Patient F', url: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.firstName || 'Female')}+${encodeURIComponent(formData.lastName || 'Patient')}&background=0284C7&color=fff&size=128` },
                  { label: 'Senior', url: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.firstName || 'Senior')}+${encodeURIComponent(formData.lastName || 'Care')}&background=16A34A&color=fff&size=128` },
                  { label: 'Default', url: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.firstName || 'User')}+${encodeURIComponent(formData.lastName || 'Vitals')}&background=1E293B&color=fff&size=128` },
                ].map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={{ alignItems: 'center', padding: 4 }}
                    onPress={() => {
                      handleFieldChange('profilePicture', item.url);
                      setShowAvatarModal(false);
                    }}>
                    <Image source={{ uri: item.url }} style={{ width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: '#0052CC' }} />
                    <Text style={{ fontSize: 11, color: '#334155', marginTop: 4, fontWeight: '600' }}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { marginBottom: 6 }]}>Or Enter Image URL</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="https://example.com/avatar.jpg"
                  placeholderTextColor="#94A3B8"
                  value={customPicUrl}
                  onChangeText={setCustomPicUrl}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.uploadBtn, { height: 42 }]}
                  onPress={() => {
                    if (customPicUrl.trim()) {
                      handleFieldChange('profilePicture', customPicUrl.trim());
                      setCustomPicUrl('');
                      setShowAvatarModal(false);
                    }
                  }}>
                  <Text style={styles.uploadBtnText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Date Pickers */}
        {showDobPicker && Platform.OS === 'ios' ? (
          <View style={styles.iosPickerSheet}>
            <View style={styles.iosPickerHeader}>
              <Text style={styles.iosPickerTitle}>Select Date of Birth</Text>
              <TouchableOpacity onPress={() => setShowDobPicker(false)}>
                <Text style={styles.iosPickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={parseYmdToDate(formData.dateOfBirth)}
              mode="date"
              display="spinner"
              themeVariant="light"
              textColor="#111827"
              accentColor="#0052CC"
              onChange={handleDobChange}
            />
          </View>
        ) : showDobPicker && Platform.OS === 'android' ? (
          <DateTimePicker
            value={parseYmdToDate(formData.dateOfBirth)}
            mode="date"
            display="default"
            themeVariant="light"
            onChange={handleDobChange}
          />
        ) : null}

        {showRpmDatePicker && Platform.OS === 'ios' ? (
          <View style={styles.iosPickerSheet}>
            <View style={styles.iosPickerHeader}>
              <Text style={styles.iosPickerTitle}>Select RPM Start Date</Text>
              <TouchableOpacity onPress={() => setShowRpmDatePicker(false)}>
                <Text style={styles.iosPickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={parseYmdToDate(formData.rpmStartDate)}
              mode="date"
              display="spinner"
              themeVariant="light"
              textColor="#111827"
              accentColor="#0052CC"
              onChange={handleRpmDateChange}
            />
          </View>
        ) : showRpmDatePicker && Platform.OS === 'android' ? (
          <DateTimePicker
            value={parseYmdToDate(formData.rpmStartDate)}
            mode="date"
            display="default"
            themeVariant="light"
            onChange={handleRpmDateChange}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentCard: {
    width: '94%',
    maxWidth: 620,
    height: '86%',
    maxHeight: 750,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  stepperHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  stepperHeaderTablet: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
    zIndex: 10,
  },
  stepperTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  stepperTitleTablet: {
    fontSize: 24,
    marginBottom: 18,
  },
  stepperWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  stepperWrapperTablet: {
    maxWidth: 820,
    alignSelf: 'center',
  },
  stepperItem: {
    alignItems: 'center',
    minWidth: 50,
  },
  stepperCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperCircleActive: {
    borderColor: COLORS.primary,
  },
  stepperCircleCompleted: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  stepperCircleInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  stepperLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#CBD5E1',
    marginTop: 4,
  },
  stepperLabelTablet: {
    fontSize: 12,
  },
  stepperLabelActive: {
    color: COLORS.primary,
  },
  stepperLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
    marginBottom: 14,
  },
  stepperLineActive: {
    backgroundColor: COLORS.primary,
  },
  bodyScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  bodyContent: {
    paddingVertical: 16,
    paddingBottom: 60,
  },
  bodyContentTablet: {
    paddingHorizontal: 8,
    paddingVertical: 20,
    paddingBottom: 84,
  },
  stepContainer: {
    width: '100%',
  },
  sectionLabelBar: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 12,
  },
  sectionLabelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  formGroup: {
    marginBottom: 14,
    width: '100%',
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
    textTransform: 'capitalize',
  },
  subtextMuted: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  input: {
    height: 42,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#334155',
  },
  passwordWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  dropdownSelectInput: {
    height: 42,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownSelectText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  inputInvalid: {
    borderColor: COLORS.errorRed,
    backgroundColor: COLORS.errorBg,
  },
  errorText: {
    fontSize: 11,
    color: COLORS.errorRed,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  chipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  chipText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  ccmCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  ccmCheckText: {
    fontSize: 13,
    color: '#334155',
    flex: 1,
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  uploadBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  previewWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarPreview: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  removePicBtn: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
    padding: 4,
  },
  programStack: {
    gap: 12,
  },
  progCardModern: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    marginBottom: 10,
  },
  progCardModernSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#F8FAFC',
  },
  progCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  progSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  pifFooter: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  pifCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  pifCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  pifSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 22,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  pifSaveBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalSelectOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSelectContent: {
    width: '88%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  modalSelectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalSelectTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  modalSearchInput: {
    height: 40,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#111827',
    marginBottom: 10,
  },
  modalSelectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalSelectItemActive: {
    backgroundColor: '#EFF6FF',
  },
  modalSelectText: {
    fontSize: 14,
    color: '#334155',
  },
  modalSelectTextActive: {
    color: '#0052CC',
    fontWeight: '700',
  },
  iosPickerSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
    zIndex: 99999,
    elevation: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  iosPickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  iosPickerDone: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
