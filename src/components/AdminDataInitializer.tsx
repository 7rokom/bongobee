import { useEffect, useRef } from 'react';
import { useOrderStore } from '@/stores/useOrderStore';
import { useEmployeeStore } from '@/stores/useEmployeeStore';
import { useResellerStore } from '@/stores/useResellerStore';
import { useIncompleteOrderStore } from '@/stores/useIncompleteOrderStore';
import { useFollowUpStore } from '@/stores/useFollowUpStore';
import { useVariationStore } from '@/stores/useVariationStore';
import { useDigitalOrderStore } from '@/stores/useDigitalOrderStore';
import { useStockStore } from '@/stores/useStockStore';
import { useProductStore } from '@/stores/useProductStore';
import { runIdle } from '@/lib/cached-fetch';

/**
 * ⚠️ EGRESS-CRITICAL FILE — see docs/EGRESS_GUARDS.md (Rule 5)
 *
 * Admin-only data initializer — lazy loaded inside AdminLayout.
 *
 * Three-tier load strategy to avoid the 6-connection browser cap:
 *  Tier 1 (immediate): orders + resellers + employees + incomplete orders
 *                       + products (with includeAll so admins see drafts)
 *  Tier 2 (~600 ms): reseller_orders, payment_requests, follow_up_data,
 *                     variations, stock entries
 *  Tier 3 (idle): all heavy/rarely-used data — handled by their own page
 *                  components on demand via useLazyFetch().
 *
 * ❌ DO NOT add expenses, deposits, blog, employee activity logs, courier
 *    dispatch, push notifications, or landing pages to Tier 1 / 2. Keep them
 *    in the page that needs them. Tier 1 is already the most aggressive
 *    fetch in the entire app — every byte here is paid per admin login.
 */
const AdminDataInitializer = () => {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Tier 1 — must-have for dashboard / orders pages.
    // Also re-fetch products with includeAll so admins see drafts too
    // (public DataInitializer fetches only published products to save egress).
    Promise.all([
      useOrderStore.getState().fetchOrders(),
      useResellerStore.getState().fetchResellers(),
      useEmployeeStore.getState().fetchEmployees(),
      useIncompleteOrderStore.getState().fetchOrders(),
      useProductStore.getState().fetchProducts({ force: true, includeAll: true }),
    ]).catch(() => {});

    // Tier 2 — secondary management data, give Tier 1 some breathing room
    setTimeout(() => {
      Promise.all([
        useResellerStore.getState().fetchResellerOrders(),
        useResellerStore.getState().fetchPaymentRequests(),
        useFollowUpStore.getState().fetchAll(),
        useVariationStore.getState().fetchVariations(),
        useStockStore.getState().fetchStockEntries(),
        useDigitalOrderStore.getState().fetchAll(),
      ]).then(async () => {
        // One-time backfill: auto-create expense / deposit entries for any
        // existing MAIN order returns / paid-returns. No-op after first run
        // (uses a localStorage flag).
        try {
          const { backfillReturnLedger } = await import('@/lib/return-ledger');
          const orders = useOrderStore.getState().orders;
          const stockTypes = useFollowUpStore.getState().stockTypes;
          await backfillReturnLedger(orders as any, stockTypes);
        } catch (e) { console.warn('[return-ledger backfill] skipped:', e); }
      }).catch(() => {});
    }, 600);

    // Tier 3 — purely on-demand. Pages that need expenses, deposits, blog,
    // employee activity logs, courier dispatch, etc. fetch them on mount.
    // Schedule a no-op idle hook so future preloads can hang here cheaply.
    runIdle(() => {});
  }, []);

  return null;
};

export default AdminDataInitializer;
