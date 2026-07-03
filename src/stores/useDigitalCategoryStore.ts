import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from '@/lib/api';

interface Store {
  categories: string[]; // names (unique, sorted)
  loading: boolean;
  initialized: boolean;
  fetch: (opts?: { force?: boolean }) => Promise<void>;
  add: (name: string) => Promise<void>;
  remove: (name: string) => Promise<void>;
}

const TTL_MS = 5 * 60 * 1000; // 5 minutes
let lastFetched = 0;

export const useDigitalCategoryStore = create<Store>()(
  persist(
    (set, get) => ({
      categories: [],
      loading: false,
      initialized: false,

      fetch: async (opts) => {
        const { loading, initialized } = get();
        if (loading) return;
        if (!opts?.force && initialized && Date.now() - lastFetched < TTL_MS) return;
        set({ loading: true });
        try {
          const data = await api.get('/public/digital-fe/categories');
          if (Array.isArray(data)) {
            const names = Array.from(new Set(data.map((r: any) => String(r.name).trim()).filter(Boolean))).sort() as string[];
            set({ categories: names, initialized: true });
            lastFetched = Date.now();
          }
        } catch { /* ignore */ }
        set({ loading: false });
      },

      add: async (name) => {
        const clean = name.trim();
        if (!clean) return;
        if (get().categories.includes(clean)) return;
        try { await api.post('/admin/digital-fe/categories', { name: clean }); } catch { /* ignore dup */ }
        set((s) => ({ categories: Array.from(new Set([...s.categories, clean])).sort() }));
      },

      remove: async (name) => {
        try { await api.post('/admin/digital-fe/categories/remove', { name }); } catch { /* ignore */ }
        set((s) => ({ categories: s.categories.filter((c) => c !== name) }));
      },
    }),
    {
      name: 'cache-digital-categories',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ categories: s.categories, initialized: s.initialized }),
    }
  )
);
