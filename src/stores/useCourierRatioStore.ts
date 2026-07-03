import { create } from 'zustand';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { normalizePhone } from '@/lib/order-validation';

export interface CourierRatioData {
  all: number;
  delivered: number;
  returned: number;
  loading: boolean;
}

interface CourierRatioStore {
  data: Record<string, CourierRatioData>;
  checkCounts: Record<string, number>;
  loaded: boolean;
  loading: boolean;
  loadCache: (force?: boolean) => Promise<void>;
  saveRatio: (phone: string, ratio: Pick<CourierRatioData, 'all' | 'delivered' | 'returned'>) => Promise<void>;
  checkRatio: (phone: string, apiKey?: string, force?: boolean) => Promise<void>;
  fetchRatioForPhone: (phone: string) => Promise<void>;
  getCheckCount: (phone: string) => number;
  getRatio: (phone: string) => CourierRatioData | undefined;
}

const MAX_CHECKS_PER_PHONE = 3;

type CourierRatioRow = Partial<Record<'all_count' | 'all' | 'delivered' | 'returned', number | string | null>>;

const toRatio = (row: CourierRatioRow): CourierRatioData => ({
  all: Number(row?.all_count ?? row?.all ?? 0),
  delivered: Number(row?.delivered ?? 0),
  returned: Number(row?.returned ?? 0),
  loading: false,
});

let realtimeSubscribed = false;
let focusRefreshSubscribed = false;

const rowPhoneKey = (phone?: string | null) => normalizePhone(phone || '') || String(phone || '');

// Realtime sync removed in Phase 3 — the focus-refresh listener below keeps data fresh.
const subscribeToCourierRatioRealtime = (_applyRow: (phone: string, row: CourierRatioRow) => void) => {
  if (realtimeSubscribed) return;
  realtimeSubscribed = true;
};

const subscribeToFocusRefresh = (refresh: () => void) => {
  if (focusRefreshSubscribed || typeof window === 'undefined') return;
  focusRefreshSubscribed = true;
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
};

const persistRatioToDb = async (
  phone: string,
  result: Pick<CourierRatioData, 'all' | 'delivered' | 'returned'>,
) => {
  try {
    await api.post('/public/courier-ratio', {
      phone,
      all_count: result.all,
      delivered: result.delivered,
      returned: result.returned,
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[courier-ratio cache] client upsert exception:', err);
  }
};

export const useCourierRatioStore = create<CourierRatioStore>()((set, get) => ({
  data: {},
  checkCounts: {},
  loaded: false,
  loading: false,

  loadCache: async (force = true) => {
    subscribeToCourierRatioRealtime((phone, row) => {
      set((s) => ({ data: { ...s.data, [phone]: toRatio(row) }, loaded: true }));
    });
    subscribeToFocusRefresh(() => {
      get().loadCache(true).catch((error) => console.warn('[courier-ratio cache] focus refresh failed:', error));
    });
    if (get().loading) return;
    if (get().loaded && force === false) return;
    set({ loading: true });
    try {
      const data = await api.get('/admin/data/courier-ratio-all').catch(() => []);
      const cached: Record<string, CourierRatioData> = {};
      (data || []).forEach((r: CourierRatioRow & { phone?: string }) => {
        const key = rowPhoneKey(r.phone);
        if (key) cached[key] = toRatio(r);
      });
      set((s) => ({ data: { ...s.data, ...cached }, loaded: true, loading: false }));
    } catch (e) {
      console.error('[courier-ratio cache] load exception:', e);
      set({ loading: false, loaded: true });
    }
  },

  getCheckCount: (phone: string) => get().checkCounts[normalizePhone(phone) || phone] || 0,

  getRatio: (phone: string) => {
    const key = rowPhoneKey(phone);
    return get().data[key];
  },

  // Pull a single phone's cached ratio from DB (used on-demand when not yet loaded)
  fetchRatioForPhone: async (rawPhone: string) => {
    const phone = rowPhoneKey(rawPhone);
    if (!phone) return;
    try {
      const data = await api.get(`/public/courier-ratio?phone=${encodeURIComponent(phone)}`).catch(() => null);
      if (data) {
        set((s) => ({ data: { ...s.data, [phone]: toRatio(data) } }));
      }
    } catch (e) {
      console.warn('[courier-ratio cache] fetchRatioForPhone exception:', e);
    }
  },

  saveRatio: async (rawPhone, ratio) => {
    const phone = rowPhoneKey(rawPhone);
    const result: CourierRatioData = {
      all: Number(ratio.all || 0),
      delivered: Number(ratio.delivered || 0),
      returned: Number(ratio.returned || 0),
      loading: false,
    };
    set((s) => ({ data: { ...s.data, [phone]: result } }));
    await persistRatioToDb(phone, result);
  },

  checkRatio: async (rawPhone: string, apiKey?: string, force?: boolean) => {
    const phone = rowPhoneKey(rawPhone);
    const existing = get().data[phone];
    const currentCount = get().checkCounts[phone] || 0;

    if (existing && !existing.loading && !force) return;

    if (currentCount >= MAX_CHECKS_PER_PHONE) {
      toast.error(`এই নম্বরের কুরিয়ার রেশিও সর্বোচ্চ ${MAX_CHECKS_PER_PHONE} বার চেক করা যায়`);
      return;
    }

    set((s) => ({
      data: { ...s.data, [phone]: { all: 0, delivered: 0, returned: 0, loading: true } },
      checkCounts: { ...s.checkCounts, [phone]: currentCount + 1 },
    }));

    try {
      const json = await api.post('/admin/data/courier-check', { phone, ...(apiKey ? { apiKey } : {}) });

      if (json.error) {
        set((s) => ({ data: { ...s.data, [phone]: { all: 0, delivered: 0, returned: 0, loading: false } } }));
        toast.error(json.error);
        return;
      }

      const result: CourierRatioData = {
        all: json.all || 0, delivered: json.delivered || 0, returned: json.returned || 0, loading: false,
      };

      await get().saveRatio(phone, result);

      if (!json.all && !json.delivered && !json.returned) {
        toast.error('এই নম্বরের কুরিয়ার ডাটা পাওয়া যায়নি');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'কুরিয়ার চেক ব্যর্থ হয়েছে';
      console.error('[courier-check] fetch failed', e);
      set((s) => ({ data: { ...s.data, [phone]: { all: 0, delivered: 0, returned: 0, loading: false } } }));
      toast.error(`কুরিয়ার চেক ব্যর্থ: ${msg}`);
    }
  },
}));
