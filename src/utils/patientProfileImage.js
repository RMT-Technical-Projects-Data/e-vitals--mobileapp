import { API_CONFIG } from '../config/api';

const getApiOrigin = () => String(API_CONFIG.BASE_URL || '').replace(/\/api\/?$/, '');

/** Same path rules as the web app's resolvePatientProfileUrl. */
export function resolvePatientProfileUrl(profilePathRaw) {
  if (!profilePathRaw) return null;
  const raw = String(profilePathRaw).trim().replace(/\\/g, '/');
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) return raw;

  const origin = getApiOrigin();
  if (raw.startsWith('/api/uploads/')) return `${origin}${raw}`;
  if (raw.startsWith('/uploads/')) return `${origin}/api${raw}`;
  if (raw.startsWith('api/uploads/')) return `${origin}/${raw}`;
  if (raw.startsWith('uploads/')) return `${origin}/api/${raw}`;
  if (/^patient-images\//i.test(raw) || /^patient-documents\//i.test(raw)) {
    return `${origin}/api/uploads/${raw}`;
  }
  if (raw.includes('/uploads/')) {
    return `${origin}/api${raw.substring(raw.toLowerCase().indexOf('/uploads/'))}`;
  }
  return `${origin}/api/uploads/patient-images/${raw}`;
}
