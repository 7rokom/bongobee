/**
 * Detects whether the current visitor is an internal user
 * (logged-in admin / employee / reseller).
 *
 * Used to suppress ads, page-view tracking, and 3rd-party scripts
 * for internal users so admins don't pollute analytics or see ads.
 */
export function isInternalUser(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // Admin / employee — zustand persist key
    const adminRaw = localStorage.getItem('admin-auth-storage');
    if (adminRaw) {
      const parsed = JSON.parse(adminRaw);
      if (parsed?.state?.isAuthenticated) return true;
    }
  } catch {
    /* ignore parse errors */
  }
  try {
    // Reseller — plain JSON object set on login
    const resellerRaw = localStorage.getItem('reseller-auth');
    if (resellerRaw) {
      const parsed = JSON.parse(resellerRaw);
      if (parsed?.id) return true;
    }
  } catch {
    /* ignore parse errors */
  }
  return false;
}