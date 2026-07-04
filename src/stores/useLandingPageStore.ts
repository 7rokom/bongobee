import { create } from 'zustand';
import { api } from '@/lib/api';
import { useProductStore, mapRowToProduct } from './useProductStore';

export interface LandingPage {
  id: string;
  title: string;
  slug: string;
  productId: string;
  status: 'published' | 'draft';
  createdAt: string;
  customPrice?: number | null;
  customOriginalPrice?: number | null;
  customHtml?: string | null;
}

interface LandingPageStore {
  pages: LandingPage[];
  loading: boolean;
  fetchPages: () => Promise<void>;
  fetchPublicPage: (slug: string) => Promise<void>;
  addPage: (page: Omit<LandingPage, 'createdAt'>) => Promise<void>;
  updatePage: (id: string, data: Partial<LandingPage>) => Promise<void>;
  deletePage: (id: string) => Promise<void>;
  getPageBySlug: (slug: string) => LandingPage | undefined;
}

const mapRow = (r: any): LandingPage => ({
  id: r.id,
  title: r.title,
  slug: r.slug,
  productId: r.product_id,
  status: r.status || 'published',
  createdAt: r.created_at,
  customPrice: r.custom_price ?? null,
  customOriginalPrice: r.custom_original_price ?? null,
  customHtml: r.custom_html ?? null,
});

const toRow = (p: Partial<LandingPage>) => {
  const r: any = {};
  if (p.title !== undefined) r.title = p.title;
  if (p.slug !== undefined) r.slug = p.slug;
  if (p.productId !== undefined) r.product_id = p.productId;
  if (p.status !== undefined) r.status = p.status;
  if (p.customPrice !== undefined) r.custom_price = p.customPrice;
  if (p.customOriginalPrice !== undefined) r.custom_original_price = p.customOriginalPrice;
  if (p.customHtml !== undefined) r.custom_html = p.customHtml;
  return r;
};

export const useLandingPageStore = create<LandingPageStore>((set, get) => ({
  pages: [],
  loading: false,

  fetchPages: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/admin/landing-pages?per_page=10000');
      const rows = Array.isArray(res) ? res : (res?.data ?? []);
      set({ pages: rows.map(mapRow) });
    } catch { /* ignore */ }
    set({ loading: false });
  },

  fetchPublicPage: async (slug: string) => {
    set({ loading: true });
    try {
      const res = await api.get(`/public/landing-pages/${slug}`);
      if (res?.id) {
        const page = mapRow(res);
        set((s) => {
          const exists = s.pages.some((p) => p.slug === slug);
          return { pages: exists ? s.pages.map((p) => (p.slug === slug ? page : p)) : [...s.pages, page] };
        });
        if (res.product) {
          const product = mapRowToProduct(res.product);
          useProductStore.setState((s) => ({
            products: s.products.some((p) => p.id === product.id)
              ? s.products
              : [...s.products, product],
          }));
        }
      }
    } catch { /* ignore — shows not-found UI */ }
    set({ loading: false });
  },

  addPage: async (page) => {
    const created = await api.post('/admin/landing-pages', toRow(page));
    set((s) => ({ pages: [mapRow(created), ...s.pages] }));
  },

  updatePage: async (id, data) => {
    const updated = await api.put(`/admin/landing-pages/${id}`, toRow(data));
    set((s) => ({ pages: s.pages.map((p) => (p.id === id ? mapRow(updated) : p)) }));
  },

  deletePage: async (id) => {
    await api.del(`/admin/landing-pages/${id}`);
    set((s) => ({ pages: s.pages.filter((p) => p.id !== id) }));
  },

  getPageBySlug: (slug) => get().pages.find((p) => p.slug === slug),
}));
