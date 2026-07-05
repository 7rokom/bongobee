import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Product } from '@/data/store-data';
import { api } from '@/lib/api';

interface ProductStore {
  products: Product[];
  loading: boolean;
  initialized: boolean;
  lastFetchedAt: number;
  cachedVersion: number;
  fetchProducts: (opts?: { force?: boolean; includeAll?: boolean; expectedVersion?: number }) => Promise<void>;
  fetchProductBySlug: (slug: string) => Promise<Product | null>;
  fetchProductById: (id: string) => Promise<Product | null>;
  addProduct: (product: Product) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  getProductBySlug: (slug: string) => Product | undefined;
  getProductsByCategory: (categorySlug: string) => Product[];
  getRelatedProducts: (productId: string, category: string) => Product[];
}

export const mapRowToProduct = (row: any): Product => ({
  id: row.id,
  title: row.title || row.name || '',
  slug: row.slug,
  shortDescription: row.short_description || '',
  longDescription: row.long_description || '',
  price: Number(row.price),
  originalPrice: row.original_price ? Number(row.original_price) : undefined,
  buyPrice: row.buy_price ? Number(row.buy_price) : undefined,
  resellerPrice: row.reseller_price ? Number(row.reseller_price) : undefined,
  images: row.images || [],
  featuredImage: row.featured_image,
  featuredVideo: row.featured_video,
  category: row.category || '',
  colors: row.colors || [],
  sizes: row.sizes || [],
  weights: row.weights || [],
  variationPrices: row.variation_prices || [],
  variations: row.variations || [],
  metaDescription: row.meta_description,
  metaKeywords: row.meta_keywords,
  stockType: row.stock_type as 'self' | 'vendor' | undefined,
  stockProductName: row.stock_product_name,
  status: row.status as 'published' | 'draft' | undefined,
  inStock: row.in_stock ?? true,
  rating: Number(row.rating) || 0,
  reviewCount: row.review_count || 0,
  reviews: row.reviews || [],
  freeDelivery: row.free_delivery ?? false,
  isAffiliate: row.is_affiliate ?? false,
  affiliateUrl: row.affiliate_url || undefined,
  affiliateButtonText: row.affiliate_button_text || undefined,
});

const mapProductToRow = (p: Partial<Product>) => {
  const row: any = {};
  if (p.title !== undefined) row.title = p.title;
  if (p.slug !== undefined) row.slug = p.slug;
  if (p.shortDescription !== undefined) row.short_description = p.shortDescription;
  if (p.longDescription !== undefined) row.long_description = p.longDescription;
  if (p.price !== undefined) row.price = p.price;
  if (p.originalPrice !== undefined) row.original_price = p.originalPrice;
  if (p.buyPrice !== undefined) row.buy_price = p.buyPrice;
  if (p.resellerPrice !== undefined) row.reseller_price = p.resellerPrice;
  if (p.images !== undefined) row.images = p.images;
  if (p.featuredImage !== undefined) row.featured_image = p.featuredImage;
  if (p.featuredVideo !== undefined) row.featured_video = p.featuredVideo;
  if (p.category !== undefined) row.category = p.category;
  if (p.colors !== undefined) row.colors = p.colors;
  if (p.sizes !== undefined) row.sizes = p.sizes;
  if (p.weights !== undefined) row.weights = p.weights;
  if (p.variationPrices !== undefined) row.variation_prices = p.variationPrices;
  if (p.variations !== undefined) row.variations = p.variations;
  if (p.metaDescription !== undefined) row.meta_description = p.metaDescription;
  if (p.metaKeywords !== undefined) row.meta_keywords = p.metaKeywords;
  if (p.stockType !== undefined) row.stock_type = p.stockType;
  if (p.stockProductName !== undefined) row.stock_product_name = p.stockProductName;
  if (p.status !== undefined) row.status = p.status;
  if (p.inStock !== undefined) row.in_stock = p.inStock;
  if (p.rating !== undefined) row.rating = p.rating;
  if (p.reviewCount !== undefined) row.review_count = p.reviewCount;
  if (p.reviews !== undefined) row.reviews = p.reviews;
  if (p.freeDelivery !== undefined) row.free_delivery = p.freeDelivery;
  if (p.isAffiliate !== undefined) row.is_affiliate = p.isAffiliate;
  if (p.affiliateUrl !== undefined) row.affiliate_url = p.affiliateUrl || null;
  if (p.affiliateButtonText !== undefined) row.affiliate_button_text = p.affiliateButtonText || null;
  return row;
};

const PRODUCTS_TTL_MS = 5 * 60 * 1000;

export const useProductStore = create<ProductStore>()(
  persist(
    (set, get) => ({
      products: [],
      loading: false,
      initialized: false,
      lastFetchedAt: 0,
      cachedVersion: 0,

      fetchProducts: async (opts) => {
        const force = opts?.force === true;
        const includeAll = opts?.includeAll === true;
        const expectedVersion = opts?.expectedVersion;
        const { initialized, lastFetchedAt, loading, cachedVersion } = get();
        if (loading) return;

        const versionMismatch = typeof expectedVersion === 'number' && expectedVersion !== cachedVersion;
        if (!force && !versionMismatch && initialized && Date.now() - lastFetchedAt < PRODUCTS_TTL_MS) return;

        const effectiveIncludeAll = includeAll && (
          typeof window === 'undefined' ||
          window.location.pathname.startsWith('/admin') ||
          window.location.pathname.startsWith('/reseller')
        );

        set({ loading: true });
        try {
          // Admin context fetches all statuses (incl. drafts); public fetches published only.
          const path = effectiveIncludeAll ? '/admin/products?per_page=10000' : '/public/products?per_page=10000';
          const res = await api.get(path);
          const rows = Array.isArray(res) ? res : (res?.data ?? []);
          const prev = new Map(get().products.map((p) => [p.id, p.longDescription]));
          const mapped = rows.map((row: any) =>
            mapRowToProduct({ ...row, long_description: row.long_description || prev.get(row.id) || '' })
          );
          set({
            products: mapped,
            initialized: true,
            lastFetchedAt: Date.now(),
            cachedVersion: typeof expectedVersion === 'number' ? expectedVersion : cachedVersion,
          });
        } catch { /* keep cache */ }
        set({ loading: false });
      },

      fetchProductBySlug: async (slug: string) => {
        try {
          const row = await api.get(`/public/products/${slug}`);
          if (row && row.id) {
            const product = mapRowToProduct(row);
            set((state) => {
              const idx = state.products.findIndex((p) => p.id === product.id);
              if (idx === -1) return { products: [...state.products, product] };
              const next = [...state.products];
              next[idx] = product;
              return { products: next };
            });
            return product;
          }
        } catch { /* fall through */ }
        return get().products.find((p) => p.slug === slug) || null;
      },

      fetchProductById: async (id: string) => {
        try {
          const row = await api.get(`/admin/products/${id}`);
          if (row && row.id) {
            const product = mapRowToProduct(row);
            set((state) => {
              const idx = state.products.findIndex((p) => p.id === product.id);
              if (idx === -1) return { products: [...state.products, product] };
              const next = [...state.products];
              next[idx] = product;
              return { products: next };
            });
            return product;
          }
        } catch { /* fall through */ }
        return get().products.find((p) => p.id === id) || null;
      },

      addProduct: async (product) => {
        const created = await api.post('/admin/products', mapProductToRow(product));
        set((state) => ({ products: [mapRowToProduct(created), ...state.products] }));
      },

      updateProduct: async (id, updates) => {
        const updated = await api.put(`/admin/products/${id}`, mapProductToRow(updates));
        set((state) => ({ products: state.products.map((p) => (p.id === id ? mapRowToProduct(updated) : p)) }));
      },

      deleteProduct: async (id) => {
        try {
          await api.del(`/admin/products/${id}`);
          set((state) => ({ products: state.products.filter((p) => p.id !== id) }));
        } catch { /* ignore */ }
      },

      getProductBySlug: (slug) => get().products.find((p) => p.slug === slug),
      getProductsByCategory: (categorySlug) => get().products.filter((p) => p.category === categorySlug),
      getRelatedProducts: (productId, category) =>
        get().products.filter((p) => p.category === category && p.id !== productId && !p.isAffiliate).slice(0, 6),
    }),
    {
      name: 'cache-products',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        products: s.products,
        lastFetchedAt: s.lastFetchedAt,
        cachedVersion: s.cachedVersion,
        initialized: s.initialized,
      }),
    }
  )
);
