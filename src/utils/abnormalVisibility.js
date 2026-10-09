/** Abnormal readings stay visible for 24 hours, then drop off the mobile lists. */
export const ABNORMAL_VISIBLE_MS = 24 * 60 * 60 * 1000;

/**
 * Measurement times are stored as the clock the user entered, with no timezone.
 * Parse that wall time on this phone. Real timestamps (with a zone) use Date.
 */
export function parseAbnormalReadingTime(value) {
  const text = String(value || '').trim();
  if (!text) return null;

  const wall = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (wall) {
    const at = new Date(
      Number(wall[1]),
      Number(wall[2]) - 1,
      Number(wall[3]),
      Number(wall[4]),
      Number(wall[5]),
      Number(wall[6] || 0),
    ).getTime();
    return Number.isFinite(at) ? at : null;
  }

  const parsed = new Date(text).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function isWithinAbnormalVisibility(value, now = Date.now()) {
  const at = parseAbnormalReadingTime(value);
  if (at == null) return false;
  const age = now - at;
  return age >= -60 * 1000 && age <= ABNORMAL_VISIBLE_MS;
}

export function visibleAbnormalReadings(list, now = Date.now()) {
  return (list || []).filter((item) =>
    isWithinAbnormalVisibility(item?.reading_date || item?.assigned_at || item?.created_at, now),
  );
}
