import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, setToken, clearToken, ApiError } from '@/lib/api';

const DEFAULT_ADMIN_EMAIL = '786.mahfuzurrahman@gmail.com';
const DEFAULT_ADMIN_PASSWORD = 'mdmahfuzurrahman';

interface AdminStore {
  isAuthenticated: boolean;
  adminEmail: string | null;
  userRole: 'admin' | 'employee' | null;
  permissions: string[];
  storedAdminEmail: string;
  storedAdminPassword: string;
  credentialsLoaded: boolean;
  credentialsLoading: boolean;
  fetchCredentials: (force?: boolean) => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  loginEmployee: (email: string, password: string, employees?: unknown) => Promise<boolean>;
  logout: () => Promise<void>;
  updateAdminCredentials: (email: string, password: string) => Promise<void>;
}

export const useAdminStore = create<AdminStore>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      adminEmail: null,
      userRole: null,
      permissions: [],
      storedAdminEmail: DEFAULT_ADMIN_EMAIL,
      storedAdminPassword: DEFAULT_ADMIN_PASSWORD,
      credentialsLoaded: true,
      credentialsLoading: false,

      // No longer needed for login (auth is server-side now). Kept as a no-op so
      // existing callers (login pages) don't break. Resolves immediately.
      fetchCredentials: async () => {
        set({ credentialsLoaded: true, credentialsLoading: false });
      },

      // Authenticates via Laravel Sanctum. The /auth/admin/login endpoint tries
      // the admin account first, then any active employee — so this single call
      // covers BOTH admin and team-member logins.
      login: async (email, password) => {
        try {
          const res = await api.post<{ token: string; user: { email: string; role: 'admin' | 'employee'; permissions?: string[] } }>(
            '/auth/admin/login',
            { email, password }
          );
          setToken('admin', res.token);
          set({
            isAuthenticated: true,
            adminEmail: res.user.email,
            userRole: res.user.role,
            permissions: res.user.permissions ?? [],
          });
          return true;
        } catch {
          return false;
        }
      },

      // The admin login endpoint already authenticates employees, so this simply
      // delegates. Signature keeps the optional 3rd arg for caller compatibility.
      loginEmployee: async (email, password) => {
        return get().login(email, password);
      },

      logout: async () => {
        try { await api.post('/auth/admin/logout'); } catch { /* token may already be gone */ }
        clearToken('admin');
        set({ isAuthenticated: false, adminEmail: null, userRole: null, permissions: [] });
      },

      // Updates the admin account (admins table) via Laravel.
      updateAdminCredentials: async (email, password) => {
        await api.post('/admin/update-credentials', { email, password });
        set({ storedAdminEmail: email, storedAdminPassword: password, credentialsLoaded: true });
      },
    }),
    {
      name: 'admin-auth-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        adminEmail: state.adminEmail,
        userRole: state.userRole,
        permissions: state.permissions,
        storedAdminEmail: state.storedAdminEmail,
        storedAdminPassword: state.storedAdminPassword,
      }),
    }
  )
);
