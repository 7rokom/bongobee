import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Category } from '@/data/store-data';
import { api } from '@/lib/api';

interface CategoryStore {
  categories: Category[];
  loading: boolean;
  fetchCategories: () => Promise<void>;
  addCategory: (cat: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
}

// Laravel row (snake_case) -> frontend Category (camelCase)
const mapRowToCategory = (r: any): Category => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  icon: r.icon || '',
  lucideIcon: r.lucide_icon || '',
  productCount: r.product_count || 0,
  parentId: r.parent_id ?? null,
  isMain: r.is_main ?? true,
  sortOrder: r.sort_order ?? 9999,
  customLink: r.custom_link || '',
});

// frontend Category (camelCase) -> Laravel payload (snake_case). Only defined keys.
const mapCategoryToPayload = (c: Partial<Category>) => {
  const p: Record<string, any> = {};
  if (c.name !== undefined) p.name = c.name;
  if (c.slug !== undefined) p.slug = c.slug;
  if (c.icon !== undefined) p.icon = c.icon;
  if (c.lucideIcon !== undefined) p.lucide_icon = c.lucideIcon;
  if (c.parentId !== undefined) p.parent_id = c.parentId ?? null;
  if (c.isMain !== undefined) p.is_main = c.isMain;
  if (c.customLink !== undefined) p.custom_link = c.customLink;
  if (c.sortOrder !== undefined) p.sort_order = c.sortOrder;
  if (c.productCount !== undefined) p.product_count = c.productCount;
  return p;
};

export const useCategoryStore = create<CategoryStore>()(
  persist(
    (set, get) => ({
      categories: [],
      loading: false,

      fetchCategories: async () => {
        // 5-minute cache TTL — categories rarely change. Skip network if fresh.
        const CACHE_TS_KEY = 'cache-categories-ts';
        const TTL_MS = 5 * 60 * 1000;
        try {
          const ts = parseInt(localStorage.getItem(CACHE_TS_KEY) || '0', 10);
          if (ts && Date.now() - ts < TTL_MS && get().categories.length > 0) return;
        } catch { /* ignore */ }

        set({ loading: true });
        try {
          // Public endpoint — works for both storefront and admin (no auth required).
          const data = await api.get('/public/categories');
          if (Array.isArray(data)) {
            set({ categories: data.map(mapRowToCategory) });
            try { localStorage.setItem(CACHE_TS_KEY, String(Date.now())); } catch { /* ignore */ }
          }
        } catch { /* keep cached */ }
        set({ loading: false });
      },

      addCategory: async (cat) => {
        try {
          // API assigns the real UUID id; use what it returns (ignore the temp client id).
          const created = await api.post('/admin/categories', mapCategoryToPayload(cat));
          set((s) => ({ categories: [...s.categories, mapRowToCategory(created)] }));
        } catch { /* surfaced by caller toast on failure path if needed */ }
      },

      updateCategory: async (id, updates) => {
        try {
          const updated = await api.put(`/admin/categories/${id}`, mapCategoryToPayload(updates));
          set((s) => ({ categories: s.categories.map((c) => (c.id === id ? mapRowToCategory(updated) : c)) }));
        } catch { /* ignore */ }
      },

      deleteCategory: async (id) => {
        try {
          await api.del(`/admin/categories/${id}`);
          // Detach any sub-categories of the deleted one (server has no cascade) — preserve UX.
          const children = get().categories.filter((c) => c.parentId === id);
          for (const child of children) {
            try { await api.put(`/admin/categories/${child.id}`, { parent_id: null, is_main: true }); } catch { /* ignore */ }
          }
          set((s) => ({
            categories: s.categories
              .filter((c) => c.id !== id)
              .map((c) => (c.parentId === id ? { ...c, parentId: null, isMain: true } : c)),
          }));
        } catch { /* ignore */ }
      },
    }),
    {
      name: 'cache-categories',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ categories: s.categories }),
    }
  )
);
