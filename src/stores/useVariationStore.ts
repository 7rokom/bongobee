import { create } from 'zustand';
import { api } from '@/lib/api';

export interface VariationItem {
  id: string;
  name: string;
  type: 'color' | 'size' | 'weight';
}

interface VariationStore {
  items: VariationItem[];
  loading: boolean;
  fetchVariations: () => Promise<void>;
  addItem: (item: VariationItem) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  getByType: (type: 'color' | 'size' | 'weight') => VariationItem[];
}

export const useVariationStore = create<VariationStore>()((set, get) => ({
  items: [],
  loading: false,

  fetchVariations: async () => {
    set({ loading: true });
    try {
      const data = await api.get('/admin/variations');
      if (Array.isArray(data)) {
        set({ items: data.map((r: any) => ({ id: r.id, name: r.name, type: r.type })) });
      }
    } catch { /* ignore */ }
    set({ loading: false });
  },

  addItem: async (item) => {
    try {
      const created = await api.post('/admin/variations', { name: item.name, type: item.type });
      set((s) => ({ items: [...s.items, { id: created.id, name: created.name, type: created.type }] }));
    } catch { /* ignore */ }
  },

  deleteItem: async (id) => {
    try {
      await api.del(`/admin/variations/${id}`);
      set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
    } catch { /* ignore */ }
  },

  getByType: (type) => get().items.filter((i) => i.type === type),
}));
