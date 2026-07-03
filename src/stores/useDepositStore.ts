import { create } from 'zustand';
import { api } from '@/lib/api';

export interface Deposit {
  id: string;
  title: string;
  source: string;
  amount: number;
  note: string;
  date: string;
}

export const depositSources = [
  'মূল ইনভেস্ট', 'সার্কেল ইনভেস্ট', 'নিজস্ব বিনিয়োগ', 'পার্টনার বিনিয়োগ', 'ব্যাংক লোন',
  'বিক্রয় আয়', 'রিটার্ন রিফান্ড', 'রিসেলিং করে লাভ', 'পেইড রিটার্ন লাভ', 'অন্যান্য',
];

export const RESELLING_PROFIT_SOURCE = 'রিসেলিং করে লাভ';

interface DepositStore {
  deposits: Deposit[];
  loading: boolean;
  fetchDeposits: () => Promise<void>;
  addDeposit: (deposit: Deposit) => Promise<void>;
  updateDeposit: (id: string, updates: Partial<Deposit>) => Promise<void>;
  deleteDeposit: (id: string) => Promise<void>;
}

const mapRow = (r: any): Deposit => ({
  id: r.id, title: r.title, source: r.source || '', amount: Number(r.amount),
  note: r.note || '', date: r.date || '',
});

const toRow = (d: Partial<Deposit>) => {
  const r: any = {};
  if (d.title !== undefined) r.title = d.title;
  if (d.source !== undefined) r.source = d.source;
  if (d.amount !== undefined) r.amount = d.amount;
  if (d.note !== undefined) r.note = d.note;
  if (d.date !== undefined) r.date = d.date;
  return r;
};

export const useDepositStore = create<DepositStore>()((set) => ({
  deposits: [],
  loading: false,

  fetchDeposits: async () => {
    set({ loading: true });
    try {
      const data = await api.get('/admin/deposits');
      if (Array.isArray(data)) set({ deposits: data.map(mapRow) });
    } catch { /* ignore */ }
    set({ loading: false });
  },

  addDeposit: async (deposit) => {
    const created = await api.post('/admin/deposits', toRow(deposit));
    set((s) => ({ deposits: [mapRow(created), ...s.deposits] }));
  },

  updateDeposit: async (id, updates) => {
    await api.put(`/admin/deposits/${id}`, toRow(updates));
    set((s) => ({ deposits: s.deposits.map((d) => (d.id === id ? { ...d, ...updates } : d)) }));
  },

  deleteDeposit: async (id) => {
    await api.del(`/admin/deposits/${id}`);
    set((s) => ({ deposits: s.deposits.filter((d) => d.id !== id) }));
  },
}));
