/**
 * Canonical US state IDs matching web patient edit and backend usState.js.
 * IDs 1-50: NY = 32. DC/PR are 51/52 so they never shift saved ids.
 */

export const US_STATES = [
  { id: 1, code: 'AL', name: 'Alabama' },
  { id: 2, code: 'AK', name: 'Alaska' },
  { id: 3, code: 'AZ', name: 'Arizona' },
  { id: 4, code: 'AR', name: 'Arkansas' },
  { id: 5, code: 'CA', name: 'California' },
  { id: 6, code: 'CO', name: 'Colorado' },
  { id: 7, code: 'CT', name: 'Connecticut' },
  { id: 8, code: 'DE', name: 'Delaware' },
  { id: 9, code: 'FL', name: 'Florida' },
  { id: 10, code: 'GA', name: 'Georgia' },
  { id: 11, code: 'HI', name: 'Hawaii' },
  { id: 12, code: 'ID', name: 'Idaho' },
  { id: 13, code: 'IL', name: 'Illinois' },
  { id: 14, code: 'IN', name: 'Indiana' },
  { id: 15, code: 'IA', name: 'Iowa' },
  { id: 16, code: 'KS', name: 'Kansas' },
  { id: 17, code: 'KY', name: 'Kentucky' },
  { id: 18, code: 'LA', name: 'Louisiana' },
  { id: 19, code: 'ME', name: 'Maine' },
  { id: 20, code: 'MD', name: 'Maryland' },
  { id: 21, code: 'MA', name: 'Massachusetts' },
  { id: 22, code: 'MI', name: 'Michigan' },
  { id: 23, code: 'MN', name: 'Minnesota' },
  { id: 24, code: 'MS', name: 'Mississippi' },
  { id: 25, code: 'MO', name: 'Missouri' },
  { id: 26, code: 'MT', name: 'Montana' },
  { id: 27, code: 'NE', name: 'Nebraska' },
  { id: 28, code: 'NV', name: 'Nevada' },
  { id: 29, code: 'NH', name: 'New Hampshire' },
  { id: 30, code: 'NJ', name: 'New Jersey' },
  { id: 31, code: 'NM', name: 'New Mexico' },
  { id: 32, code: 'NY', name: 'New York' },
  { id: 33, code: 'NC', name: 'North Carolina' },
  { id: 34, code: 'ND', name: 'North Dakota' },
  { id: 35, code: 'OH', name: 'Ohio' },
  { id: 36, code: 'OK', name: 'Oklahoma' },
  { id: 37, code: 'OR', name: 'Oregon' },
  { id: 38, code: 'PA', name: 'Pennsylvania' },
  { id: 39, code: 'RI', name: 'Rhode Island' },
  { id: 40, code: 'SC', name: 'South Carolina' },
  { id: 41, code: 'SD', name: 'South Dakota' },
  { id: 42, code: 'TN', name: 'Tennessee' },
  { id: 43, code: 'TX', name: 'Texas' },
  { id: 44, code: 'UT', name: 'Utah' },
  { id: 45, code: 'VT', name: 'Vermont' },
  { id: 46, code: 'VA', name: 'Virginia' },
  { id: 47, code: 'WA', name: 'Washington' },
  { id: 48, code: 'WV', name: 'West Virginia' },
  { id: 49, code: 'WI', name: 'Wisconsin' },
  { id: 50, code: 'WY', name: 'Wyoming' },
  { id: 51, code: 'DC', name: 'District of Columbia' },
  { id: 52, code: 'PR', name: 'Puerto Rico' },
];

export const US_STATE_NAMES_BY_ID = Object.fromEntries(
  US_STATES.map((s) => [s.id, s.name])
);

export const US_STATE_CODES_MAP = Object.fromEntries(
  US_STATES.map((s) => [s.name, s.code])
);

export const US_STATE_NAMES_BY_CODE = Object.fromEntries(
  US_STATES.map((s) => [s.code.toUpperCase(), s.name])
);

const cleanText = (value) => {
  if (value == null) return '';
  if (typeof value === 'object') return '';
  const text = String(value).trim();
  if (!text || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') return '';
  return text;
};

export const extractRawState = (source) => {
  if (source == null) return '';
  if (typeof source === 'object') {
    return (
      source.state ??
      source.state_code ??
      source.name ??
      source.code ??
      source.label ??
      source.value ??
      source.state_id ??
      source.stateId ??
      source.address_state_id ??
      source.state_name ??
      source.id ??
      ''
    );
  }
  return source;
};

const canonicalStateName = (value) => {
  const text = cleanText(value);
  if (!text || /^\d+$/.test(text)) return '';
  const upper = text.toUpperCase();
  if (US_STATE_NAMES_BY_CODE[upper]) return US_STATE_NAMES_BY_CODE[upper];
  const byName = Object.values(US_STATE_NAMES_BY_ID).find(
    (name) => name.toLowerCase() === text.toLowerCase()
  );
  return byName || '';
};

const stateNameFromId = (value) => {
  const text = cleanText(value);
  if (!/^\d+$/.test(text)) return '';
  return US_STATE_NAMES_BY_ID[Number(text)] || '';
};

/**
 * Same rule as the web view API: a stored name/abbreviation wins over a numeric
 * id, because older rows used a different id scheme for the same state.
 */
export const resolveDisplayState = ({ state, stateId } = {}) => {
  const fromText = canonicalStateName(state);
  if (fromText) return fromText;
  return stateNameFromId(stateId) || stateNameFromId(state) || '';
};

/**
 * Resolves any US state input (id, code, or name) to the canonical full state name.
 * e.g. 43 -> 'Texas', 'TX' -> 'Texas', 'Texas' -> 'Texas'
 */
export const resolveStateName = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const fromRecord = resolveDisplayState({
      state: value.state ?? value.state_code ?? value.name,
      stateId: value.state_id ?? value.stateId ?? value.address_state_id,
    });
    if (fromRecord) return fromRecord;
  }

  const raw = extractRawState(value);
  if (raw == null) return '';
  const text = cleanText(raw);
  if (!text) return '';

  const fromText = canonicalStateName(text);
  if (fromText) return fromText;

  const fromId = stateNameFromId(text);
  if (fromId) return fromId;

  return text;
};

export default {
  US_STATES,
  US_STATE_NAMES_BY_ID,
  US_STATE_CODES_MAP,
  US_STATE_NAMES_BY_CODE,
  extractRawState,
  resolveDisplayState,
  resolveStateName,
};
