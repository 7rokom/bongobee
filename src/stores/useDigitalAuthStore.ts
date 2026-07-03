import { create } from 'zustand';
import { api, setToken, clearToken, getToken } from '@/lib/api';

export interface DigitalCustomer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
}

interface AuthStore {
  userId: string | null;
  email: string | null;
  profile: DigitalCustomer | null;
  ready: boolean;
  init: () => () => void;
  signUpAndCreateProfile: (input: {
    name: string; email: string; password: string; phone: string; address: string;
  }) => Promise<{ ok: boolean; userId?: string; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const toProfile = (c: any): DigitalCustomer => ({
  id: c.id,
  name: c.name,
  email: c.email,
  phone: c.phone || undefined,
  address: c.address || undefined,
});

export const useDigitalAuthStore = create<AuthStore>((set, get) => ({
  userId: null,
  email: null,
  profile: null,
  ready: false,

  // Restore session from a stored Sanctum token (replaces the previous auth
  // provider's onAuthStateChange/getSession). Returns a no-op cleanup for caller parity.
  init: () => {
    const token = getToken('digital');
    if (!token) {
      set({ userId: null, email: null, profile: null, ready: true });
      return () => {};
    }
    api.get('/auth/digital/me')
      .then((c: any) => {
        set({ userId: c.id, email: c.email, profile: toProfile(c), ready: true });
      })
      .catch(() => {
        clearToken('digital');
        set({ userId: null, email: null, profile: null, ready: true });
      });
    return () => {};
  },

  signUpAndCreateProfile: async ({ name, email, password, phone, address }) => {
    try {
      const res = await api.post<{ token: string; customer: any }>('/auth/digital/register', {
        name, email, phone, password, password_confirmation: password,
      });
      setToken('digital', res.token);
      const profile = { ...toProfile(res.customer), address: address || res.customer.address || undefined };
      set({ userId: res.customer.id, email: res.customer.email, profile });
      return { ok: true, userId: res.customer.id };
    } catch (e: any) {
      // Surface the email-already-exists message in the original Bengali UX
      if (e?.errors?.email) {
        return { ok: false, error: 'এই ইমেইলটি ইতিমধ্যে রেজিস্টার্ড। সঠিক পাসওয়ার্ড দিন।' };
      }
      return { ok: false, error: e?.message || 'রেজিস্ট্রেশন ব্যর্থ হয়েছে' };
    }
  },

  signIn: async (email, password) => {
    try {
      const res = await api.post<{ token: string; customer: any }>('/auth/digital/login', { email, password });
      setToken('digital', res.token);
      set({ userId: res.customer.id, email: res.customer.email, profile: toProfile(res.customer) });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'লগইন ব্যর্থ হয়েছে' };
    }
  },

  signOut: async () => {
    try { await api.post('/auth/digital/logout'); } catch { /* token may already be gone */ }
    clearToken('digital');
    set({ userId: null, email: null, profile: null });
  },

  refreshProfile: async () => {
    try {
      const c = await api.get('/auth/digital/me');
      set({ userId: c.id, email: c.email, profile: toProfile(c) });
    } catch { /* not logged in */ }
  },
}));
