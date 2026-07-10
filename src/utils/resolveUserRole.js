export function resolveUserRole(user) {
  const roleId = Number(user?.role_id);
  if (roleId === 4) {
    return 'provider';
  }
  if (roleId === 5 || roleId === 7) {
    return 'caregiver';
  }
  return 'patient';
}
