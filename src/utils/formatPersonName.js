/** Web app display order: Last, First. */
export function formatLastFirstName(person, fallback = '') {
  if (person == null) return fallback;
  if (typeof person === 'string') {
    const raw = person.trim();
    return raw || fallback;
  }
  const last = String(person.last_name ?? person.lastName ?? '').trim();
  const first = String(person.first_name ?? person.firstName ?? '').trim();
  if (last && first) return `${last}, ${first}`;
  return last || first || fallback;
}
