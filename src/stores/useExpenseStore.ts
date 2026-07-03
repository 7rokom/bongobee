import { create } from 'zustand';
import { api } from '@/lib/api';

export interface Expense {
  id: string;
  title: string;
  category: string;
  amount: number;
  note: string;
  date: string;
  employeeId?: string;
}

export const DIGITAL_AD_EXPENSE_CATEGORY = 'ডিজিটাল প্রডাক্ট অ্যাড';

export const expenseCategories = [
  'বিজ্ঞাপন খরচ', 'কুরিয়ার খরচ', 'প্যাকেজিং খরচ', 'অফিস খরচ',
  'বেতন', 'ভাড়া', 'ইন্টারনেট ও ফোন', 'পণ্য ক্রয়', 'পরিবহন',
  'রক্ষণাবেক্ষণ', 'রিসেলার পেমেন্ট', 'টিম মেম্বার পেমেন্ট', 'ডেলিভারি রিটার্ন লস',
  DIGITAL_AD_EXPENSE_CATEGORY, 'অন্যান্য',
];

interface ExpenseStore {
  expenses: Expense[];
  loading: boolean;
  fetchExpenses: () => Promise<void>;
  addExpense: (expense: Expense) => Promise<void>;
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
}

const mapRow = (r: any): Expense => ({
  id: r.id, title: r.title, category: r.category || '', amount: Number(r.amount),
  note: r.note || '', date: r.date || '', employeeId: r.employee_id || undefined,
});

const toRow = (e: Partial<Expense>) => {
  const r: any = {};
  if (e.title !== undefined) r.title = e.title;
  if (e.category !== undefined) r.category = e.category;
  if (e.amount !== undefined) r.amount = e.amount;
  if (e.note !== undefined) r.note = e.note;
  if (e.date !== undefined) r.date = e.date;
  if (e.employeeId !== undefined) r.employee_id = e.employeeId;
  return r;
};

export const useExpenseStore = create<ExpenseStore>()((set) => ({
  expenses: [],
  loading: false,

  fetchExpenses: async () => {
    set({ loading: true });
    try {
      const data = await api.get('/admin/expenses');
      if (Array.isArray(data)) set({ expenses: data.map(mapRow) });
    } catch { /* ignore */ }
    set({ loading: false });
  },

  addExpense: async (expense) => {
    const created = await api.post('/admin/expenses', toRow(expense));
    set((s) => ({ expenses: [mapRow(created), ...s.expenses] }));
  },

  updateExpense: async (id, updates) => {
    await api.put(`/admin/expenses/${id}`, toRow(updates));
    set((s) => ({ expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...updates } : e)) }));
  },

  deleteExpense: async (id) => {
    await api.del(`/admin/expenses/${id}`);
    set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }));
  },
}));
