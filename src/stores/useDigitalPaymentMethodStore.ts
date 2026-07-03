import { create } from 'zustand';
import { api } from '@/lib/api';

export type DigitalPaymentType = 'mobile' | 'bank';

export interface DigitalPaymentMethod {
  id: string;
  name: string;
  type: DigitalPaymentType;
  accountNumber?: string;
  instructions?: string;
  logoUrl?: string;
  isActive: boolean;
  sortOrder: number;
}

const map = (r: any): DigitalPaymentMethod => ({
  id: r.id,
  name: r.name,
  type: (r.type as DigitalPaymentType) || 'mobile',
  accountNumber: r.account_number || undefined,
  instructions: r.instructions || undefined,
  logoUrl: r.logo_url || undefined,
  isActive: !!r.is_active,
  sortOrder: r.sort_order ?? 0,
});

const toRow = (p: Partial<DigitalPaymentMethod>) => {
  const row: any = {};
  if (p.name !== undefined) row.name = p.name;
  if (p.type !== undefined) row.type = p.type;
  if (p.accountNumber !== undefined) row.account_number = p.accountNumber || null;
  if (p.instructions !== undefined) row.instructions = p.instructions || null;
  if (p.logoUrl !== undefined) row.logo_url = p.logoUrl || null;
  if (p.isActive !== undefined) row.is_active = p.isActive;
  if (p.sortOrder !== undefined) row.sort_order = p.sortOrder;
  return row;
};

interface Store {
  methods: DigitalPaymentMethod[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  fetchActive: () => Promise<void>;
  add: (m: Omit<DigitalPaymentMethod, 'id'>) => Promise<void>;
  update: (id: string, m: Partial<DigitalPaymentMethod>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useDigitalPaymentMethodStore = create<Store>((set) => ({
  methods: [],
  loading: false,
  fetchAll: async () => {
    set({ loading: true });
    try { const data = await api.get('/public/digital-fe/payment-methods'); if (Array.isArray(data)) set({ methods: data.map(map) }); } catch { /* ignore */ }
    set({ loading: false });
  },
  fetchActive: async () => {
    set({ loading: true });
    try { const data = await api.get('/public/digital-fe/payment-methods?activeOnly=1'); if (Array.isArray(data)) set({ methods: data.map(map) }); } catch { /* ignore */ }
    set({ loading: false });
  },
  add: async (m) => {
    try { const data = await api.post('/admin/digital-fe/payment-methods', toRow(m)); if (data) set((s) => ({ methods: [...s.methods, map(data)].sort((a, b) => a.sortOrder - b.sortOrder) })); } catch { /* ignore */ }
  },
  update: async (id, m) => {
    try { await api.put(`/admin/digital-fe/payment-methods/${id}`, toRow(m)); set((s) => ({ methods: s.methods.map((x) => (x.id === id ? { ...x, ...m } : x)) })); } catch { /* ignore */ }
  },
  remove: async (id) => {
    try { await api.del(`/admin/digital-fe/payment-methods/${id}`); set((s) => ({ methods: s.methods.filter((x) => x.id !== id) })); } catch { /* ignore */ }
  },
}));
