import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';
import { getMarkedUpResellerPrice } from '@/lib/reseller-markup';

const MOHASAGOR_DIRECT_URL = 'https://mohasagor.com.bd/api/reseller/product';
const MOHASAGOR_API_KEY = '6MlqpqvJVaVxWrtr';
const MOHASAGOR_SECRET_KEY = 'f8b6e061615acb263a8c0e75054b7b95a06168f09fa7553868e9d549f7509bbd';
import type { Product } from '@/data/store-data';

interface MohasagorStore {
  products: Product[];
  categories: string[];
  loading: boolean;
  error: string | null;
  fetched: boolean;
  lastFetchedAt: number;
  /** mirrors site_settings.mohasagorCacheVersion at the time products were fetched */
  cachedVersion: number;
  fetchProducts: (opts?: { force?: boolean }) => Promise<void>;
}

// Group product_variants ({attribute, variant}[]) into colors/sizes/weights + generic variations.
const parseVariants = (variants: any[]): {
  colors: string[];
  sizes: string[];
  weights: string[];
  variations: { name: string; options: string[] }[];
} => {
  const grouped: Record<string, string[]> = {};
  (variants || []).forEach((v: any) => {
    const attr = String(v?.attribute || '').trim();
    const value = String(v?.variant || '').trim();
    if (!attr || !value) return;
    if (!grouped[attr]) grouped[attr] = [];
    if (!grouped[attr].includes(value)) grouped[attr].push(value);
  });
  let colors: string[] = [];
  let sizes: string[] = [];
  let weights: string[] = [];
  const variations: { name: string; options: string[] }[] = [];
  Object.entries(grouped).forEach(([name, options]) => {
    const lower = name.toLowerCase();
    if (lower.includes('color') || lower.includes('colour') || lower.includes('রঙ')) colors = options;
    else if (lower.includes('size') || lower.includes('সাইজ')) sizes = options;
    else if (lower.includes('weight') || lower.includes('ওজন')) weights = options;
    else variations.push({ name, options });
  });
  return { colors, sizes, weights, variations };
};

// Mohasagor `details` arrives as one big blob with no paragraph structure.
// Insert line breaks before bullet-style emoji markers and known section labels
// so descriptions render in readable chunks instead of one giant paragraph.
const formatDetails = (raw: string): string => {
  if (!raw) return '';
  let s = raw.replace(/\r\n/g, '\n');
  s = s.replace(/([^\n])\s*(?=[✅✔🔥💧⭐🎯📌📍🛒🚚📦🎁⚡💡🔋📱💻⏰🌟❤♥🌀🟢🔴🟡🔵⚪⚫])/gu, '$1\n');
  s = s.replace(/([.!?])\s*(?=(Product'?s Details:|Description:|Specifications?:|Features?:|Items? in the Box:|Advantages?:))/g, '$1\n\n');
  s = s.replace(/\s+-\s+(?=[A-Za-zঅ-৯])/g, '\n- ');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
};

const mapProduct = (item: any): Product => {
  const resellingPrice = Number(item.reselling_price ?? item.sale_price ?? item.price) || 0;
  const originalPrice = Number(item.price) || 0;

  const images: string[] = [];
  if (Array.isArray(item.product_images)) {
    item.product_images.forEach((img: any) => {
      if (img?.product_image) images.push(img.product_image);
    });
  }
  if (Array.isArray(item.product_image)) {
    item.product_image.forEach((img: any) => {
      if (img?.product_image) images.push(img.product_image);
    });
  }
  const featuredImage = item.thumbnail_img || item.thumbnail_image || images[0] || '/placeholder.svg';
  const longDescription = formatDetails(String(item.details || item.description || ''));
  const category = item.category?.name || item.category || 'Mohasagor';
  const { colors, sizes, weights, variations } = parseVariants(item.product_variants || item.variants || []);

  return {
    id: `mohasagor-${item.id}`,
    title: item.name || '',
    slug: `m-${item.id}`,
    // Leave short empty so the product page doesn't repeat the long description as a wall of text.
    shortDescription: '',
    longDescription,
    price: originalPrice,
    originalPrice: originalPrice,
    resellerPrice: getMarkedUpResellerPrice(resellingPrice),
    images: images.length ? images : [featuredImage],
    featuredImage,
    category,
    colors: colors.length ? colors : undefined,
    sizes: sizes.length ? sizes : undefined,
    weights: weights.length ? weights : undefined,
    variations: variations.length ? variations : undefined,
    inStock: !item.status || item.status === 'active',
    rating: 4.5,
    reviewCount: 0,
    status: 'published',
  };
};

// ⚠️ EGRESS-CRITICAL — Mohasagor returns ~3000 products (~big payload).
// 20-day browser cache. Admin "Refresh Cache" button bumps
// site_settings.mohasagorCacheVersion to invalidate early.
const MOHASAGOR_TTL_MS = 5 * 60 * 1000; // 5 minutes

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, message: string) => {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

const extractItems = (data: any) => {
  const candidates = [
    data?.products,
    data?.products?.data,
    data?.data?.products,
    data?.data?.products?.data,
    data?.data?.data,
    data?.data,
    Array.isArray(data) ? data : null,
  ];
  return candidates.find(Array.isArray) || [];
};

export const useMohasagorStore = create<MohasagorStore>()(
  persist(
    (set, get) => ({
      products: [],
      categories: [],
      loading: false,
      error: null,
      fetched: false,
      lastFetchedAt: 0,
      cachedVersion: 0,

      fetchProducts: async (opts) => {
        const force = opts?.force === true;
        const { loading, products, lastFetchedAt, cachedVersion } = get();
        if (loading) return;

        // Read latest expected version from site settings (persisted in localStorage too)
        const expectedVersion =
          useSiteSettingsStore.getState().mohasagorCacheVersion ?? 1;
        const versionMismatch = expectedVersion !== cachedVersion;

        // Skip network entirely if cache is fresh AND version still matches
        if (
          !force &&
          !versionMismatch &&
          products.length > 0 &&
          Date.now() - lastFetchedAt < MOHASAGOR_TTL_MS
        ) {
          return;
        }

        set({ loading: true, error: null });
        try {
          let data: any = null;
          let apiError: string | undefined;

          // Load directly from Mohasagor API in the browser (direct, no proxy).
          // Try header-auth first, then query-param auth as a fallback.
          const tryFetch = async (url: string, init?: RequestInit) => {
            const res = await withTimeout(
              fetch(url, {
                ...init,
                headers: { 'Accept': 'application/json', ...(init?.headers || {}) },
              }),
              60000,
              'Mohasagor API timed out',
            );
            if (!res.ok) throw new Error(`Mohasagor API ${res.status}`);
            return res.json();
          };

          try {
            data = await tryFetch(MOHASAGOR_DIRECT_URL, {
              headers: {
                'api-key': MOHASAGOR_API_KEY,
                'secret-key': MOHASAGOR_SECRET_KEY,
              },
            });
          } catch (headerErr) {
            const directUrl = `${MOHASAGOR_DIRECT_URL}?api-key=${encodeURIComponent(MOHASAGOR_API_KEY)}&secret-key=${encodeURIComponent(MOHASAGOR_SECRET_KEY)}`;
            data = await tryFetch(directUrl);
          }
          apiError = data?.error as string | undefined;


          const items = extractItems(data);
          const mapped: Product[] = items.map(mapProduct);

          const categorySet = new Set<string>();
          mapped.forEach((p: Product) => {
            if (p.category && p.category !== 'Mohasagor') categorySet.add(p.category);
          });
          const categories = Array.from(categorySet).sort();
          mapped.reverse();

          // Never wipe a non-empty cache. Only overwrite when the new fetch
          // actually returned products. If the API returned 0 items, keep the
          // existing cache (better UX than blank shop).
          if (mapped.length === 0) {
            set({
              fetched: true,
              error: products.length > 0 ? null : (apiError || 'Mohasagor products could not be loaded'),
            });
          } else {
            set({
              products: mapped,
              categories,
              fetched: true,
              lastFetchedAt: Date.now(),
              cachedVersion: expectedVersion,
              error: null,
            });
          }
        } catch (err) {
          console.error('Failed to fetch Mohasagor products:', err);
          const message = err instanceof Error ? err.message : 'Mohasagor products could not be loaded';
          // Keep stale cache on error — never wipe the user's view.
          if (get().products.length > 0) {
            set({ error: null, fetched: true });
          } else {
            set({ error: message, fetched: true, products: [], categories: [] });
          }
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: 'cache-mohasagor-v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        products: s.products,
        categories: s.categories,
        lastFetchedAt: s.lastFetchedAt,
        cachedVersion: s.cachedVersion,
        fetched: s.fetched,
      }),
    },
  ),
);
