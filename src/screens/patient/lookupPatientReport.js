import { DEFAULT_VITAL_TARGETS, getMeasurementAlertStatus } from '../../utils/measurementUtils';

export const LOOKUP_COLUMNS = [
  'Status',
  'Vitals',
  'Name',
  'Systolic',
  'Diastolic',
  'Pulse',
  'Glucose',
  'Weight',
  'Last Upload',
  '# Readings',
  'Time',
];

const MANDATORY_COLUMNS = ['name', 'patient name'];

export const isMandatoryLookupColumn = (column) => (
  MANDATORY_COLUMNS.includes(String(column || '').toLowerCase().trim())
);

const statusLabel = (status) => {
  const raw = String(status ?? '').trim().toLowerCase();
  if (raw === '2' || raw === 'active' || raw === 'stable') return 'Active';
  if (raw === '3' || raw === 'pending' || raw === 'review') return 'Pending';
  if (raw === '4' || raw === '1' || raw === 'locked' || raw === 'inactive') return 'Locked';
  return raw ? String(status) : '-';
};

const formatUsDate = (value) => {
  if (value == null || value === '') return '';
  const raw = String(value).trim();
  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[1].padStart(2, '0')}/${us[2].padStart(2, '0')}/${us[3]}`;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`;
  const date = new Date(raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') : raw);
  if (Number.isNaN(date.getTime())) return raw;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}/${date.getFullYear()}`;
};

const patientName = (patient) => {
  const last = String(patient.last_name || patient.lastName || '').trim();
  const first = String(patient.first_name || patient.firstName || '').trim();
  if (last || first) return `${last}${last && first ? ', ' : ''}${first}`.trim();
  return String(patient.patientName || patient.name || 'Patient').trim();
};

const vitalList = (patient) => {
  const raw = patient.vitals || patient.measurement_types || '';
  if (Array.isArray(raw)) return raw.filter(Boolean).join(', ');
  const text = String(raw).trim();
  if (text && !text.includes('/')) return text;
  const pills = [];
  if (patient.last_systolic != null || patient.systolic != null || patient.latest_measurements?.blood_pressure) pills.push('BP');
  if (patient.last_glucose != null || patient.glucose != null || patient.latest_measurements?.blood_glucose) pills.push('BG');
  if (patient.last_weight != null || patient.weight != null || patient.latest_measurements?.weight) pills.push('WT');
  return pills.join(', ');
};

const numberedVital = (value, min, max, { round = true } = {}) => {
  const status = getMeasurementAlertStatus(value, min, max);
  if (status === 'missing') return '';
  const numeric = Number(value);
  const text = round ? String(Math.round(numeric)) : String(numeric);
  if (status === 'high') return `${text} (High)`;
  if (status === 'low') return `${text} (Low)`;
  if (status === 'normal') return `${text} (Normal)`;
  return text;
};

const cellValue = (patient, column, index) => {
  const latest = patient.latest_measurements || {};
  const bp = latest.blood_pressure || {};
  const bg = latest.blood_glucose || {};
  const wt = latest.weight || {};
  const targets = DEFAULT_VITAL_TARGETS;
  switch (column) {
    case '#':
      return String(index + 1);
    case 'Status':
      return statusLabel(patient.status ?? patient.status_id ?? patient.patient_status);
    case 'Vitals':
      return vitalList(patient);
    case 'Name':
      return patientName(patient);
    case 'Systolic':
      return numberedVital(bp.systolic_pressure ?? bp.systolic ?? patient.last_systolic ?? patient.systolic, targets.systolicMin, targets.systolicMax);
    case 'Diastolic':
      return numberedVital(bp.diastolic_pressure ?? bp.diastolic ?? patient.last_diastolic ?? patient.diastolic, targets.diastolicMin, targets.diastolicMax);
    case 'Pulse':
      return numberedVital(bp.pulse ?? patient.last_pulse ?? patient.pulse, targets.pulseMin, targets.pulseMax);
    case 'Glucose':
      return numberedVital(bg.blood_glucose_value_1 ?? bg.value ?? patient.last_glucose ?? patient.glucose, targets.glucoseMin, targets.glucoseMax);
    case 'Weight':
      return numberedVital(wt.weight ?? wt.weight_value ?? patient.last_weight ?? patient.weight, targets.weightMin, targets.weightMax, { round: false });
    case 'Last Upload':
      return formatUsDate(patient.last_upload_date || patient.last_vital_upload_at || patient.upload_date || '');
    case '# Readings':
      return String(patient.readings_count ?? patient.number_of_readings ?? patient.readings ?? 0);
    case 'Time':
      return String(patient.service_time ?? patient.total_service_time ?? 0);
    default:
      return '';
  }
};

export const buildLookupTable = (patients, selectedColumns = null) => {
  const selected = Array.isArray(selectedColumns) && selectedColumns.length > 0
    ? new Set(selectedColumns)
    : null;
  const headers = ['#', ...LOOKUP_COLUMNS].filter((header) => header === '#' || !selected || selected.has(header));
  const rows = (Array.isArray(patients) ? patients : []).map((patient, index) => (
    headers.map((header) => cellValue(patient, header, index))
  ));
  return { headers, rows };
};

const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const buildLookupCsv = (table) => {
  const lines = [table.headers, ...table.rows]
    .map((row) => row.map(escapeCsv).join(','));
  return `\uFEFF${lines.join('\r\n')}`;
};

export const buildLookupReportText = (table, meta = {}) => {
  const lines = [
    'Look up Patient',
    `Generated: ${meta.generatedAt || new Date().toLocaleString()}`,
    meta.user ? `User: ${meta.user}` : '',
    ...(Array.isArray(meta.criteria) ? meta.criteria : []),
    `Total records: ${table.rows.length}`,
    '',
    table.headers.join(' | '),
    ...table.rows.map((row) => row.join(' | ')),
    '',
    `Total Records: ${table.rows.length}`,
  ];
  return lines.filter((line) => line !== '').join('\n');
};

export const lookupExportFilename = (extension) => {
  const date = new Date().toISOString().split('T')[0];
  return `evitals-patient-lookup-${date}.${extension}`;
};

export const emailListError = (value, { required = false } = {}) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return required ? 'Email address is required' : '';
  const pattern = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{3,}$/;
  const emails = trimmed.split(',').map((email) => email.trim()).filter(Boolean);
  for (const email of emails) {
    if (!pattern.test(email)) {
      return 'Invalid email format. Use a valid domain extension (e.g., .com, .org, .net).';
    }
  }
  return '';
};
