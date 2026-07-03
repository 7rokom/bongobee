import { useEffect } from 'react';
import { useProductStore } from '@/stores/useProductStore';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';
import { useFraudSettingsStore } from '@/stores/useFraudSettingsStore';

/**
 * ⚠️ EGRESS-CRITICAL FILE — see docs/EGRESS_GUARDS.md (Rule 1)
 *
 * Public-only data initializer. ONLY these 4 stores are allowed here:
 *   - products (published-only, via fetchProducts() with NO args)
 *   - categories
 *   - siteSettings
 *   - fraudSettings
 *
 * ❌ DO NOT add useBlogStore, useCouponStore, useOrderStore, or any admin
 *    store here. Blog and coupons are page-lazy (Blog, BlogPost, Checkout,
 *    ExitIntentPopup load them on demand). Hoisting them here will multiply
 *    PostgREST egress by 10×+ because every visitor downloads everything.
 *
 * If you think you need to add another fetch here, re-read EGRESS_GUARDS.md
 * first.
 */
const DataInitializer = () => {
  const fetchProducts = useProductStore((s) => s.fetchProducts);
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const fetchSiteSettings = useSiteSettingsStore((s) => s.fetchSettings);
  const fetchFraudSettings = useFraudSettingsStore((s) => s.fetchSettings);

  useEffect(() => {
    // Settings are persisted in localStorage so the version is available
    // synchronously on cold load. Fire fetch immediately with the cached
    // version, then refetch after settings refresh from DB if version bumped.
    const initialVersion = useSiteSettingsStore.getState().productsCacheVersion ?? 1;

    fetchSiteSettings().then(() => {
      const newVersion = useSiteSettingsStore.getState().productsCacheVersion ?? 1;
      if (newVersion !== initialVersion) {
        // Admin pressed Refresh Cache — bust browser cache.
        fetchProducts({ expectedVersion: newVersion });
      }
    });
    fetchFraudSettings();

    fetchProducts({ expectedVersion: initialVersion });
    fetchCategories();
  }, []);

  return null;
};

export default DataInitializer;
