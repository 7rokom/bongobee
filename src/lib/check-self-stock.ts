// Self-stock availability checker — used before sending an order to courier
// with stock_type = 'self'. Blocks dispatch if any item in the order lacks
// enough physical stock (based on stock_entries minus committed/delivered qty).

import { useStockStore } from '@/stores/useStockStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { useResellerStore } from '@/stores/useResellerStore';
import { useProductStore } from '@/stores/useProductStore';
import { useFollowUpStore } from '@/stores/useFollowUpStore';
import {
  buildStockProductMap,
  isConsumedSelfStockStatus,
  isSelfFulfilledOrder,
  resolveStockName as resolveMappedStockName,
} from '@/lib/stock-calculation';

export interface StockProblem {
  name: string;            // displayed product name
  stockName: string;       // mapped stock product name (or empty if unmapped)
  needed: number;
  available: number;
  reason: 'no-stock-mapping' | 'insufficient';
}

export interface CheckResult {
  ok: boolean;
  problems: StockProblem[];
}

interface OrderItemLike {
  name?: string;
  productTitle?: string;
  productId?: string;
  qty?: number;
  stockProductName?: string;
}

/**
 * Check that every item in `items` is available in self-stock.
 * `excludeOrderKey` (optional) should be the follow-up store key of the
 * current order — its qty is excluded from the "in shipment" count so an
 * order being re-sent doesn't double-deduct itself.
 */
export function checkSelfStockForItems(
  items: OrderItemLike[],
  excludeOrderKey?: string,
): CheckResult {
  const products = useProductStore.getState().products;
  const stockEntries = useStockStore.getState().stockEntries;
  const orders = useOrderStore.getState().orders;
  const resellerOrders = useResellerStore.getState().orders;
  const { stockTypes, courierNames } = useFollowUpStore.getState();

  const stockProductMap = buildStockProductMap(products);

  const resolveStockName = (item: OrderItemLike): string | undefined => {
    return resolveMappedStockName(item, stockProductMap);
  };

  const totals: Record<string, { bought: number; damage: number; consumed: number }> = {};
  stockEntries.forEach((e) => {
    if (!totals[e.productName]) totals[e.productName] = { bought: 0, damage: 0, consumed: 0 };
    totals[e.productName].bought += e.quantity;
    totals[e.productName].damage += e.damage || 0;
  });

  orders.forEach((o: any) => {
    if (excludeOrderKey && o.id === excludeOrderKey) return;
    if (!isSelfFulfilledOrder(o.id, stockTypes, courierNames, o.source)) return;
    if (!isConsumedSelfStockStatus(o.status, o.id, courierNames)) return;
    (o.items || []).forEach((item: any) => {
      const sn = resolveStockName(item);
      if (!sn) return;
      if (!totals[sn]) totals[sn] = { bought: 0, damage: 0, consumed: 0 };
      totals[sn].consumed += item.qty || 1;
    });
  });

  resellerOrders.forEach((o: any) => {
    const key = `reseller-${o.id}`;
    if (excludeOrderKey && key === excludeOrderKey) return;
    if (!isSelfFulfilledOrder(key, stockTypes, courierNames, o.source)) return;
    if (!isConsumedSelfStockStatus(o.status, key, courierNames)) return;
    (o.items || []).forEach((item: any) => {
      const sn = resolveStockName(item);
      if (!sn) return;
      if (!totals[sn]) totals[sn] = { bought: 0, damage: 0, consumed: 0 };
      totals[sn].consumed += item.qty || 1;
    });
  });

  // Aggregate needed qty per stock-name for the current order
  const needed: Record<string, { qty: number; displayName: string }> = {};
  const problems: StockProblem[] = [];

  items.forEach((item) => {
    const displayName = item.name || item.productTitle || '(unknown)';
    const qty = item.qty || 1;
    const sn = resolveStockName(item);
    if (!sn) {
      problems.push({
        name: displayName,
        stockName: '',
        needed: qty,
        available: 0,
        reason: 'no-stock-mapping',
      });
      return;
    }
    if (!needed[sn]) needed[sn] = { qty: 0, displayName };
    needed[sn].qty += qty;
  });

  Object.entries(needed).forEach(([sn, info]) => {
    const t = totals[sn] || { bought: 0, damage: 0, consumed: 0 };
    const available = Math.max(0, t.bought - t.damage - t.consumed);
    if (available < info.qty) {
      problems.push({
        name: info.displayName,
        stockName: sn,
        needed: info.qty,
        available,
        reason: 'insufficient',
      });
    }
  });

  return { ok: problems.length === 0, problems };
}

/** Format a problems array into a single human-readable Bangla toast message. */
export function formatStockProblems(problems: StockProblem[]): string {
  return problems
    .map((p) => {
      if (p.reason === 'no-stock-mapping') {
        return `"${p.name}" — স্টকে ম্যাপ করা নেই (প্রোডাক্ট এডিট করে স্টক প্রোডাক্ট সিলেক্ট করুন)`;
      }
      return `"${p.name}" — দরকার ${p.needed}, স্টকে আছে ${p.available}`;
    })
    .join(' • ');
}
