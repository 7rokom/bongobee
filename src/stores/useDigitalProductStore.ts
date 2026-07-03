import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from '@/lib/api';

export interface DigitalProduct {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  price: number;
  originalPrice?: number;
  featuredImage?: string;
  images: string[];
  productType: 'file' | 'link' | 'both';
  downloadFilePath?: string;
  accessLink?: string;
  accessCode?: string;
  metaDescription?: string;
  metaKeywords?: string;
  status: 'published' | 'draft';
  categories: string[];
  createdAt: string;
}

// DB stores categories in the `category` text column as a JSON array string.
// Backward-compatible: a plain string (legacy single-category) is treated as one item.
const parseCategories = (raw: any): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
  const s = String(raw).trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map(String).map((v) => v.trim()).filter(Boolean);
    } catch { /* fallthrough */ }
  }
  return [s];
};

const serializeCategories = (cats?: string[]): string | null => {
  if (!cats || cats.length === 0) return null;
  const clean = Array.from(new Set(cats.map((c) => c.trim()).filter(Boolean)));
  return clean.length ? JSON.stringify(clean) : null;
};

const TTL_MS = 5 * 60 * 1000; // 5 minutes

const map = (r: any): DigitalProduct => ({
  id: r.id,
  title: r.title,
  slug: r.slug,
  shortDescription: r.short_description || '',
  longDescription: r.long_description || '',
  price: Number(r.price) || 0,
  originalPrice: r.original_price ? Number(r.original_price) : undefined,
  featuredImage: r.featured_image || undefined,
  images: r.images || [],
  productType: (r.product_type || 'file') as DigitalProduct['productType'],
  downloadFilePath: r.download_file_path || undefined,
  accessLink: r.access_link || undefined,
  accessCode: r.access_code || undefined,
  metaDescription: r.meta_description || undefined,
  metaKeywords: r.meta_keywords || undefined,
  status: (r.status || 'published') as 'published' | 'draft',
  categories: parseCategories(r.category),
  createdAt: r.created_at,
});

const toRow = (p: Partial<DigitalProduct>) => {
  const row: any = {};
  if (p.id !== undefined) row.id = p.id;
  if (p.title !== undefined) row.title = p.title;
  if (p.slug !== undefined) row.slug = p.slug;
  if (p.shortDescription !== undefined) row.short_description = p.shortDescription;
  if (p.longDescription !== undefined) row.long_description = p.longDescription;
  if (p.price !== undefined) row.price = p.price;
  if (p.originalPrice !== undefined) row.original_price = p.originalPrice ?? null;
  if (p.featuredImage !== undefined) row.featured_image = p.featuredImage || null;
  if (p.images !== undefined) row.images = p.images;
  if (p.productType !== undefined) row.product_type = p.productType;
  if (p.downloadFilePath !== undefined) row.download_file_path = p.downloadFilePath || null;
  if (p.accessLink !== undefined) row.access_link = p.accessLink || null;
  if (p.accessCode !== undefined) row.access_code = p.accessCode || null;
  if (p.metaDescription !== undefined) row.meta_description = p.metaDescription || null;
  if (p.metaKeywords !== undefined) row.meta_keywords = p.metaKeywords || null;
  if (p.status !== undefined) row.status = p.status;
  if (p.categories !== undefined) row.category = serializeCategories(p.categories);
  return row;
};

interface Store {
  products: DigitalProduct[];
  loading: boolean;
  initialized: boolean;
  lastFetchedAt: number;
  fetch: (opts?: { force?: boolean; includeAll?: boolean }) => Promise<void>;
  fetchBySlug: (slug: string) => Promise<DigitalProduct | null>;
  add: (p: Omit<DigitalProduct, 'id' | 'createdAt'>) => Promise<DigitalProduct | null>;
  update: (id: string, p: Partial<DigitalProduct>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  getBySlug: (slug: string) => DigitalProduct | undefined;
}

export const useDigitalProductStore = create<Store>()(
  persist(
    (set, get) => ({
      products: [],
      loading: false,
      initialized: false,
      lastFetchedAt: 0,

      fetch: async (opts) => {
        const { loading, initialized, lastFetchedAt } = get();
        if (loading) return;
        if (!opts?.force && initialized && Date.now() - lastFetchedAt < TTL_MS) return;
        set({ loading: true });
        try {
          const path = opts?.includeAll ? '/public/digital-fe/products?includeAll=1' : '/public/digital-fe/products';
          const data = await api.get(path);
          if (Array.isArray(data)) set({ products: data.map(map), initialized: true, lastFetchedAt: Date.now() });
        } catch { /* ignore */ }
        set({ loading: false });
      },

      fetchBySlug: async (slug) => {
        const data = await api.get(`/public/digital-fe/products/${slug}`).catch(() => null);
        if (data && data.id) {
          const p = map(data);
          set((s) => {
            const idx = s.products.findIndex((x) => x.id === p.id);
            if (idx === -1) return { products: [...s.products, p] };
            const next = [...s.products]; next[idx] = p; return { products: next };
          });
          return p;
        }
        return get().products.find((p) => p.slug === slug) || null;
      },

      add: async (p) => {
        try {
          const data = await api.post('/admin/digital-fe/products', toRow(p));
          if (!data) return null;
          const mapped = map(data);
          set((s) => ({ products: [mapped, ...s.products] }));
          return mapped;
        } catch { return null; }
      },

      update: async (id, p) => {
        try {
          await api.put(`/admin/digital-fe/products/${id}`, toRow(p));
          set((s) => ({ products: s.products.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
        } catch { /* ignore */ }
      },

      remove: async (id) => {
        try {
          await api.del(`/admin/digital-fe/products/${id}`);
          set((s) => ({ products: s.products.filter((p) => p.id !== id) }));
        } catch { /* ignore */ }
      },

      getBySlug: (slug) => get().products.find((p) => p.slug === slug),
    }),
    {
      name: 'cache-digital-products',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ products: s.products, lastFetchedAt: s.lastFetchedAt, initialized: s.initialized }),
    }
  )
);
