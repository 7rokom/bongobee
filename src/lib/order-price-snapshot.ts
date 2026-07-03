/**
 * Helpers for resolving the historical buy/reseller price of an order item.
 *
 * Background: previously, reports computed profit by looking up the
 * product's CURRENT `buyPrice` / `resellerPrice` from the products table.
 * If the admin later raised the buy price (e.g. restocked at a higher
 * cost), the profit on PAST delivered orders silently changed too.
 *
 * Fix: when an order is created, we snapshot the buyPrice (and reseller
 * price for main orders) onto each line item. Reports now prefer the
 * snapshotted value and only fall back to live product lookup for
 * legacy orders that pre-date this change.
 */

export interface PriceSnapshotItem {
  /** Price the customer paid. Already locked at order time. */
  price?: number;
  /** Snapshot of buy price (cost) at the moment the order was placed. */
  buyPrice?: number;
  /** Snapshot of reseller price at order time (for main orders). */
  resellerPriceSnapshot?: number;
}

/**
 * Returns the historical buy price for a line item.
 * Prefers the snapshotted value; falls back to a live lookup callback
 * (used for orders created before snapshotting was added).
 */
export function resolveItemBuyPrice(
  item: PriceSnapshotItem | undefined | null,
  fallback: () => number
): number {
  if (item && typeof item.buyPrice === 'number' && !isNaN(item.buyPrice)) {
    return item.buyPrice;
  }
  return fallback();
}
