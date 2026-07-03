/**
 * Auto-ledger entries for MAIN order returns.
 *
 * Rules (per user spec):
 *  - Self stock + রিটার্ন        → expense = deliveryCharge (category: ডেলিভারি রিটার্ন লস)
 *  - Self stock + পেইড রিটার্ন   → if paid >= delivery: deposit (paid - delivery) as "পেইড রিটার্ন লাভ"
 *                                  else: expense (delivery - paid)
 *  - Vendor stock + রিটার্ন      → expense = deliveryCharge + 10 (packaging)
 *  - Vendor stock + পেইড রিটার্ন → cost = delivery + 10; if paid >= cost → deposit; else → expense
 *
 * Idempotent — uses a deterministic id derived from the order id, so re-syncing
 * the same order updates the existing row instead of creating duplicates.
 */

import { api } from '@/lib/api';
import { useExpenseStore } from '@/stores/useExpenseStore';
import { useDepositStore } from '@/stores/useDepositStore';

export const RETURN_LOSS_CATEGORY = 'ডেলিভারি রিটার্ন লস';
export const PAID_RETURN_PROFIT_SOURCE = 'পেইড রিটার্ন লাভ';

const VENDOR_PACKAGING = 10;

const expenseId = (orderId: string) => `ret-exp-${orderId}`;
const depositId = (orderId: string) => `ret-dep-${orderId}`;

interface OrderLike {
  id: string;
  status: string;
  customer?: string;
  deliveryCharge: number;
  paidReturnAmount?: number | null;
  isoDate?: string;
  date?: string;
}

async function refreshStores() {
  try { await useExpenseStore.getState().fetchExpenses(); } catch {}
  try { await useDepositStore.getState().fetchDeposits(); } catch {}
}

async function clearReturnEntries(orderId: string) {
  await api.post('/admin/data/ledger-delete', { table: 'expenses', id: expenseId(orderId) });
  await api.post('/admin/data/ledger-delete', { table: 'deposits', id: depositId(orderId) });
}

export async function syncReturnLedger(
  order: OrderLike,
  stockType: 'self' | 'vendor',
  opts: { silent?: boolean } = {}
) {
  const orderId = order.id;
  const status = order.status;
  const delivery = order.deliveryCharge || 0;
  const packaging = stockType === 'vendor' ? VENDOR_PACKAGING : 0;
  // Never fall back to today — order.date is a Bengali display string and cannot be parsed.
  // isoDate is always set by FrontendOrderController.present(); null means stale persisted data.
  const dateStr = order.isoDate ? order.isoDate.slice(0, 10) : null;
  if (!dateStr) {
    // Stale cached order without iso_date — skip to avoid wrong-dated entries.
    // The next fetch will populate isoDate and the backfill will create the entry correctly.
    if (!opts.silent) await refreshStores();
    return;
  }
  const who = order.customer ? ` — ${order.customer}` : '';
  const stockLabel = stockType === 'vendor' ? 'ভেন্ডর' : 'সেলফ';

  if (status === 'রিটার্ন') {
    const amount = delivery + packaging;
    await api.post('/admin/data/ledger-delete', { table: 'deposits', id: depositId(orderId) });
    await api.post('/admin/data/ledger-upsert', {
      table: 'expenses',
      id: expenseId(orderId),
      title: `অর্ডার ${orderId} রিটার্ন${who}`,
      category: RETURN_LOSS_CATEGORY,
      amount,
      note: `${stockLabel} স্টক রিটার্ন (ডেলিভারি ${delivery}${packaging ? ' + প্যাকেজিং ' + packaging : ''})`,
      date: dateStr,
    });
  } else if (status === 'পেইড রিটার্ন') {
    const paid = order.paidReturnAmount ?? 0;
    const cost = delivery + packaging;
    const net = paid - cost;
    if (net > 0) {
      await api.post('/admin/data/ledger-delete', { table: 'expenses', id: expenseId(orderId) });
      await api.post('/admin/data/ledger-upsert', {
        table: 'deposits',
        id: depositId(orderId),
        title: `অর্ডার ${orderId} পেইড রিটার্ন লাভ${who}`,
        source: PAID_RETURN_PROFIT_SOURCE,
        amount: net,
        note: `${stockLabel} স্টক — পেইড ${paid}, খরচ ${cost}`,
        date: dateStr,
      });
    } else if (net < 0) {
      await api.post('/admin/data/ledger-delete', { table: 'deposits', id: depositId(orderId) });
      await api.post('/admin/data/ledger-upsert', {
        table: 'expenses',
        id: expenseId(orderId),
        title: `অর্ডার ${orderId} পেইড রিটার্ন ঘাটতি${who}`,
        category: RETURN_LOSS_CATEGORY,
        amount: -net,
        note: `${stockLabel} স্টক — পেইড ${paid}, খরচ ${cost}`,
        date: dateStr,
      });
    } else {
      // net === 0 → no profit, no loss; clear any prior entries
      await clearReturnEntries(orderId);
    }
  } else {
    await clearReturnEntries(orderId);
  }

  if (!opts.silent) await refreshStores();
}

/**
 * Re-sync ledger entries for ALL main returns/paid-returns every time it's
 * called. No localStorage flag — this way, if an admin manually deletes a
 * "ডেলিভারি রিটার্ন লস" expense or "পেইড রিটার্ন লাভ" deposit, the next
 * page refresh re-creates it automatically (per user spec #3).
 */
export async function backfillReturnLedger(
  orders: OrderLike[],
  stockTypes: Record<string, string>
) {
  const targets = orders.filter(o => o.status === 'রিটার্ন' || o.status === 'পেইড রিটার্ন');
  for (const o of targets) {
    const st = (stockTypes[o.id] || 'self') as 'self' | 'vendor';
    try { await syncReturnLedger(o, st, { silent: true }); } catch (e) { console.warn('[return-ledger backfill]', o.id, e); }
  }
  await refreshStores();
}
