import { normalizePhone } from '@/lib/order-validation';

export type HistoryOrder = {
  id: string;
  type: 'main' | 'reseller';
  date: string;
  isoDate?: string;
  status: string;
  customer: string;
  phone: string;
  address?: string;
  items: Array<{ name: string; qty: number; price: number }>;
  total: number;
};

type MainOrder = {
  id: string; customer: string; phone: string; address?: string; date: string; isoDate?: string;
  status: string; total: number; customerIp?: string; customerFingerprint?: string;
  items: Array<{ name: string; qty: number; price: number }>;
};

type ResellerOrderLite = {
  id: string; customerName: string; customerPhone: string; customerAddress?: string; date: string;
  status: string; totalSellingPrice: number;
  customerIp?: string; customerFingerprint?: string;
  items: Array<{ name?: string; title?: string; qty?: number; quantity?: number; price?: number; sellingPrice?: number }>;
};

const norm = (p?: string) => (p ? normalizePhone(p) : '');

// Normalize address: lowercase, remove punctuation, collapse whitespace.
// Two addresses match if their normalized form is identical AND long enough
// to be meaningful (avoid empty / very short matches like "n/a").
export const normalizeAddress = (a?: string): string => {
  if (!a) return '';
  return a
    .toLowerCase()
    .replace(/[।,.;:?!\-_/\\()[\]{}'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const matches = (
  o: { phone?: string; ip?: string; fingerprint?: string; address?: string },
  ref: { phone?: string; ip?: string; fingerprint?: string; address?: string }
) => {
  if (ref.phone && o.phone && norm(o.phone) === norm(ref.phone)) return true;
  if (ref.ip && o.ip && o.ip === ref.ip) return true;
  if (ref.fingerprint && o.fingerprint && o.fingerprint === ref.fingerprint) return true;
  const refAddr = normalizeAddress(ref.address);
  const oAddr = normalizeAddress(o.address);
  if (refAddr && oAddr && refAddr.length >= 8 && refAddr === oAddr) return true;
  return false;
};

const parseTime = (iso?: string, date?: string) => {
  if (iso) { const t = Date.parse(iso); if (!isNaN(t)) return t; }
  if (date) { const t = Date.parse(date); if (!isNaN(t)) return t; }
  return 0;
};

export type HistoryRef = { phone?: string; ip?: string; fingerprint?: string; address?: string };

export function findCustomerHistory(
  currentOrderId: string,
  ref: HistoryRef,
  mainOrders: MainOrder[],
  resellerOrders: ResellerOrderLite[]
): HistoryOrder[] {
  const out: HistoryOrder[] = [];
  for (const o of mainOrders) {
    if (o.id === currentOrderId) continue;
    if (!matches({ phone: o.phone, ip: o.customerIp, fingerprint: o.customerFingerprint, address: o.address }, ref)) continue;
    out.push({
      id: o.id, type: 'main', date: o.date, isoDate: o.isoDate, status: o.status,
      customer: o.customer, phone: o.phone, address: o.address, total: o.total,
      items: (o.items || []).map(it => ({ name: it.name, qty: Number(it.qty) || 1, price: Number(it.price) || 0 })),
    });
  }
  for (const o of resellerOrders) {
    if (o.id === currentOrderId) continue;
    if (!matches({ phone: o.customerPhone, ip: o.customerIp, fingerprint: o.customerFingerprint, address: o.customerAddress }, ref)) continue;
    out.push({
      id: o.id, type: 'reseller', date: o.date, status: o.status,
      customer: o.customerName, phone: o.customerPhone, address: o.customerAddress,
      total: Number(o.totalSellingPrice) || 0,
      items: (o.items || []).map((it: any) => ({
        name: it.name || it.title || '',
        qty: Number(it.qty ?? it.quantity ?? 1) || 1,
        price: Number(it.price ?? it.sellingPrice ?? 0) || 0,
      })),
    });
  }
  return out.sort((a, b) => parseTime(b.isoDate, b.date) - parseTime(a.isoDate, a.date));
}

export function hasCustomerHistory(
  currentOrderId: string,
  ref: HistoryRef,
  mainOrders: MainOrder[],
  resellerOrders: ResellerOrderLite[]
): boolean {
  if (!ref.phone && !ref.ip && !ref.fingerprint && !ref.address) return false;
  for (const o of mainOrders) {
    if (o.id === currentOrderId) continue;
    if (matches({ phone: o.phone, ip: o.customerIp, fingerprint: o.customerFingerprint, address: o.address }, ref)) return true;
  }
  for (const o of resellerOrders) {
    if (o.id === currentOrderId) continue;
    if (matches({ phone: o.customerPhone, ip: o.customerIp, fingerprint: o.customerFingerprint, address: o.customerAddress }, ref)) return true;
  }
  return false;
}

/**
 * Collect ALL identifiers (ips, fingerprints, addresses) ever seen for a customer,
 * matching across main + reseller + incomplete orders by phone OR address.
 * Used when admin blocks a customer so we can block every IP / device they used.
 */
export function collectCustomerIdentifiers(
  ref: HistoryRef,
  mainOrders: MainOrder[],
  resellerOrders: ResellerOrderLite[],
  incompleteOrders?: Array<{ phone?: string; address?: string; customerIp?: string; customerFingerprint?: string }>
): { ips: string[]; fingerprints: string[]; addresses: string[] } {
  const ips = new Set<string>();
  const fps = new Set<string>();
  const addrs = new Set<string>();
  if (ref.ip) ips.add(ref.ip);
  if (ref.fingerprint) fps.add(ref.fingerprint);
  if (ref.address) addrs.add(ref.address);

  const consider = (o: { phone?: string; ip?: string; fingerprint?: string; address?: string }) => {
    if (!matches(o, ref)) return;
    if (o.ip) ips.add(o.ip);
    if (o.fingerprint) fps.add(o.fingerprint);
    if (o.address) addrs.add(o.address);
  };

  for (const o of mainOrders) {
    consider({ phone: o.phone, ip: o.customerIp, fingerprint: o.customerFingerprint, address: o.address });
  }
  for (const o of resellerOrders) {
    consider({ phone: o.customerPhone, ip: o.customerIp, fingerprint: o.customerFingerprint, address: o.customerAddress });
  }
  for (const o of incompleteOrders || []) {
    consider({ phone: o.phone, ip: o.customerIp, fingerprint: o.customerFingerprint, address: o.address });
  }

  return { ips: [...ips], fingerprints: [...fps], addresses: [...addrs] };
}
