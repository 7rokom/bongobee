import { create } from 'zustand';
import { normalizePhone } from '@/lib/order-validation';
import { api } from '@/lib/api';

export interface IncompleteOrder {
  id: string;
  name: string;
  phone: string;
  address: string;
  items: { title: string; quantity: number; price: number; image?: string; variations?: Record<string, string> }[];
  totalPrice: number;
  deliveryCharge: number;
  deliveryZone: string;
  grandTotal: number;
  date: string;
  type: 'blocked' | 'incomplete';
  blockReason?: string;
  status?: 'pending' | 'cancelled';
  customerIp?: string;
  customerFingerprint?: string;
  note?: string;
}

interface IncompleteOrderStore {
  orders: IncompleteOrder[];
  fetchOrders: () => Promise<void>;
  addOrder: (order: Omit<IncompleteOrder, 'id' | 'date'>) => void;
  removeOrder: (id: string) => void;
  removeOrders: (ids: Set<string>) => void;
  cancelOrder: (id: string) => void;
  removeByPhone: (phone: string) => void;
  updateNote: (id: string, note: string) => Promise<void>;
}

function buildPayload(order: Omit<IncompleteOrder, 'id' | 'date'>) {
  const id = 'INC' + Date.now().toString().slice(-6);
  const normalizedPhone = normalizePhone(order.phone);
  return {
    id,
    name: order.name || '',
    phone: normalizedPhone,
    address: order.address || '',
    items: order.items,
    total_price: order.totalPrice,
    delivery_charge: order.deliveryCharge,
    delivery_zone: order.deliveryZone,
    grand_total: order.grandTotal,
    type: order.type,
    block_reason: order.blockReason || null,
    status: order.status || 'pending',
    customer_ip: order.customerIp || null,
    customer_fingerprint: order.customerFingerprint || null,
    note: order.note || null,
  };
}

// Same-origin Laravel public endpoint (no apikey/auth needed). Used by the
// unload-time sendBeacon / keepalive helpers below.
const INCOMPLETE_URL = '/api/public/incomplete-orders';
const INCOMPLETE_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

// visibilitychange ও SPA cleanup এর জন্য — normal fetch, সব হেডারসহ
export function sendIncompleteOrderFetch(order: Omit<IncompleteOrder, 'id' | 'date'>) {
  try {
    const payload = buildPayload(order);
    fetch(INCOMPLETE_URL, {
      method: 'POST',
      headers: INCOMPLETE_HEADERS,
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    // Silent fail
  }
}

// beforeunload / pagehide এর জন্য — navigator.sendBeacon (সবচেয়ে নির্ভরযোগ্য unload এ)
export function sendBeaconIncompleteOrder(order: Omit<IncompleteOrder, 'id' | 'date'>) {
  try {
    const payload = buildPayload(order);
    const body = JSON.stringify(payload);

    // sendBeacon কাস্টম হেডার সাপোর্ট করে না — public endpoint এর কোনো হেডার লাগে না
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      const ok = navigator.sendBeacon(INCOMPLETE_URL, blob);
      if (ok) return;
    }

    // Fallback: fetch with keepalive
    fetch(INCOMPLETE_URL, {
      method: 'POST',
      headers: INCOMPLETE_HEADERS,
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Silent fail
  }
}

function mapRow(row: any): IncompleteOrder {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    items: row.items || [],
    totalPrice: Number(row.total_price) || 0,
    deliveryCharge: Number(row.delivery_charge) || 0,
    deliveryZone: row.delivery_zone || '',
    grandTotal: Number(row.grand_total) || 0,
    date: row.created_at,
    type: row.type,
    blockReason: row.block_reason,
    status: row.status,
    customerIp: row.customer_ip,
    customerFingerprint: row.customer_fingerprint,
    note: row.note || undefined,
  };
}

export const useIncompleteOrderStore = create<IncompleteOrderStore>()(
  (set) => ({
    orders: [],

    fetchOrders: async () => {
      const data = await api.get('/admin/data/incomplete-orders').catch(() => null);
      if (Array.isArray(data)) {
        set({ orders: data.map(mapRow) });
      }
    },

    addOrder: async (order) => {
      const normalizedPhone = normalizePhone(order.phone);
      const id = 'INC' + Date.now().toString().slice(-6);

      const payload = {
        id,
        name: order.name,
        phone: normalizedPhone,
        address: order.address,
        items: order.items,
        total_price: order.totalPrice,
        delivery_charge: order.deliveryCharge,
        delivery_zone: order.deliveryZone,
        grand_total: order.grandTotal,
        type: order.type,
        block_reason: order.blockReason || null,
        status: order.status || 'pending',
        customer_ip: order.customerIp || null,
        customer_fingerprint: order.customerFingerprint || null,
      };

      let error: any = null;
      try { await api.post('/public/incomplete-orders', payload); } catch (e) { error = e; }

      if (!error) {
        const newOrder: IncompleteOrder = {
          ...order,
          phone: normalizedPhone,
          id,
          date: new Date().toISOString(),
        };

        set((state) => {
          if (order.type === 'incomplete') {
            const filtered = state.orders.filter(
              (o) => !(o.type === 'incomplete' && normalizePhone(o.phone) === normalizedPhone)
            );
            return { orders: [newOrder, ...filtered] };
          }
          return { orders: [newOrder, ...state.orders] };
        });
      }
    },

    removeOrder: async (id) => {
      await api.del(`/admin/data/incomplete-orders/${id}`).catch(() => {});
      set((state) => ({ orders: state.orders.filter((o) => o.id !== id) }));
    },

    removeOrders: async (ids) => {
      const idArray = Array.from(ids);
      await api.post('/admin/data/incomplete-orders/bulk-delete', { ids: idArray }).catch(() => {});
      set((state) => ({ orders: state.orders.filter((o) => !ids.has(o.id)) }));
    },

    cancelOrder: async (id) => {
      await api.post(`/admin/data/incomplete-orders/${id}/cancel`).catch(() => {});
      set((state) => ({
        orders: state.orders.map((o) => o.id === id ? { ...o, status: 'cancelled' as const } : o),
      }));
    },

    removeByPhone: async (phone) => {
      const normalized = normalizePhone(phone);
      await api.post('/admin/data/incomplete-orders/delete-by-phone', { phone: normalized }).catch(() => {});
      set((state) => ({
        orders: state.orders.filter(
          (o) => !(o.type === 'incomplete' && normalizePhone(o.phone) === normalized)
        ),
      }));
    },

    updateNote: async (id, note) => {
      await api.put(`/admin/data/incomplete-orders/${id}/note`, { note }).catch(() => {});
      set((state) => ({
        orders: state.orders.map((o) => o.id === id ? { ...o, note } : o),
      }));
    },
  })
);
