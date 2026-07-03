import { create } from 'zustand';
import { api } from '@/lib/api';
import { normalizePhone } from '@/lib/order-validation';

// crypto.randomUUID() requires HTTPS. This works on both HTTP and HTTPS.
function generateUUID(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b).map(v => v.toString(16).padStart(2, '0'));
  return `${h.slice(0,4).join('')}-${h.slice(4,6).join('')}-${h.slice(6,8).join('')}-${h.slice(8,10).join('')}-${h.slice(10).join('')}`;
}

export type BlockType = 'phone' | 'ip' | 'fingerprint';

export interface BlockedEntry {
  id: string;
  type: BlockType;
  value: string;
  customer_name?: string;
  reason?: string;
  blocked_at: string;
  linked_group?: string;
}

interface BlockStore {
  blockedList: BlockedEntry[];
  loading: boolean;
  fetchBlocked: () => Promise<void>;
  blockCustomerFull: (data: { phone: string; ip?: string; fingerprint?: string; ips?: string[]; fingerprints?: string[]; customerName?: string; reason?: string }) => Promise<void>;
  blockCustomer: (entry: { type: BlockType; value: string; customerName?: string; reason?: string }) => Promise<void>;
  unblockCustomer: (id: string) => Promise<void>;
  unblockGroup: (groupId: string) => Promise<void>;
  isPhoneBlocked: (phone: string) => boolean;
  checkBlockedRemote: (phone: string, ip?: string, fingerprint?: string) => Promise<boolean>;
}

export const useBlockStore = create<BlockStore>()((set, get) => ({
  blockedList: [],
  loading: false,

  fetchBlocked: async () => {
    set({ loading: true });
    try {
      const data = await api.get('/admin/blocked-customers');
      set({ blockedList: Array.isArray(data) ? data : [], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  blockCustomer: async (entry) => {
    const existing = get().blockedList.find(b => b.type === entry.type && b.value === entry.value);
    if (existing) return;
    const created = await api.post('/admin/blocked-customers', {
      type: entry.type,
      value: entry.value,
      customer_name: entry.customerName || null,
      reason: entry.reason || null,
    });
    set(s => ({ blockedList: [created as BlockedEntry, ...s.blockedList] }));
  },

  blockCustomerFull: async ({ phone, ip, fingerprint, ips, fingerprints, customerName, reason }) => {
    const groupId = generateUUID();
    const now = new Date().toISOString();
    const list = get().blockedList;
    const entries: any[] = [];
    const normalizedPhone = phone ? normalizePhone(phone) || phone : '';

    const ipSet = new Set<string>();
    if (ip) ipSet.add(ip);
    (ips || []).forEach((v) => { if (v) ipSet.add(v); });
    const fpSet = new Set<string>();
    if (fingerprint) fpSet.add(fingerprint);
    (fingerprints || []).forEach((v) => { if (v) fpSet.add(v); });

    if (normalizedPhone && !list.some(b => b.type === 'phone' && b.value === normalizedPhone)) {
      entries.push({ type: 'phone', value: normalizedPhone, customer_name: customerName, reason, blocked_at: now, linked_group: groupId });
    }
    for (const v of ipSet) {
      if (!list.some(b => b.type === 'ip' && b.value === v)) {
        entries.push({ type: 'ip', value: v, customer_name: customerName, reason, blocked_at: now, linked_group: groupId });
      }
    }
    for (const v of fpSet) {
      if (!list.some(b => b.type === 'fingerprint' && b.value === v)) {
        entries.push({ type: 'fingerprint', value: v, customer_name: customerName, reason, blocked_at: now, linked_group: groupId });
      }
    }

    if (entries.length > 0) {
      const created = await api.post('/admin/blocked-customers', { entries });
      const rows = Array.isArray(created) ? created : entries;
      set(s => ({ blockedList: [...rows, ...s.blockedList] }));
    }
  },

  unblockCustomer: async (id) => {
    await api.del(`/admin/blocked-customers/${id}`);
    set(s => ({ blockedList: s.blockedList.filter(b => b.id !== id) }));
  },

  unblockGroup: async (groupId) => {
    await api.del(`/admin/blocked-customers/group/${groupId}`);
    set(s => ({ blockedList: s.blockedList.filter(b => b.linked_group !== groupId) }));
  },

  isPhoneBlocked: (phone) => {
    const normalized = phone ? normalizePhone(phone) || phone : '';
    return get().blockedList.some(b => b.type === 'phone' && (b.value === phone || b.value === normalized));
  },

  // Storefront pre-check (public endpoint).
  checkBlockedRemote: async (phone, ip, fingerprint) => {
    try {
      const normalizedPhone = phone ? normalizePhone(phone) : '';
      const res = await api.post('/public/check-blocked', {
        phone: normalizedPhone || phone,
        ip,
        fingerprint,
      });
      return !!res?.blocked;
    } catch {
      return false;
    }
  },
}));
