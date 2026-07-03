import { create } from 'zustand';
import { api } from '@/lib/api';

export type DigitalOrderStatus = 'পেন্ডিং' | 'কনফার্মড' | 'বাতিল';

export interface DigitalOrderItem {
  productId: string | null;
  title: string;
  slug?: string;
  price: number;
  qty: number;
}

export interface DigitalOrder {
  id: string;
  orderNumber: string;
  userId: string | null;
  productId: string | null;
  productTitle: string;
  productSlug?: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress?: string;
  price: number;
  paymentMethod: string;
  paymentMethodId?: string | null;
  paymentMethodName?: string;
  paymentNumber?: string;
  bankName?: string;
  trxId: string;
  screenshotPath?: string | null;
  status: DigitalOrderStatus;
  createdAt: string;
  items?: DigitalOrderItem[];
  customerIp?: string;
  customerFingerprint?: string;
}


const map = (r: any): DigitalOrder => ({
  id: r.id,
  orderNumber: r.order_number,
  userId: r.user_id,
  productId: r.product_id,
  productTitle: r.product_title,
  productSlug: r.product_slug || undefined,
  customerName: r.customer_name,
  customerPhone: r.customer_phone,
  customerEmail: r.customer_email,
  customerAddress: r.customer_address || undefined,
  price: Number(r.price) || 0,
  paymentMethod: r.payment_method,
  paymentMethodId: r.payment_method_id || null,
  paymentMethodName: r.payment_method_name || undefined,
  paymentNumber: r.payment_number || undefined,
  bankName: r.bank_name || undefined,
  trxId: r.trx_id,
  screenshotPath: r.screenshot_path || null,
  status: r.status,
  createdAt: r.created_at,
  items: Array.isArray(r.items_json) ? r.items_json : undefined,
  customerIp: r.customer_ip || undefined,
  customerFingerprint: r.customer_fingerprint || undefined,
});

interface CreateInput {
  userId: string;
  productId: string | null;
  productTitle: string;
  productSlug?: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress?: string;
  price: number;
  paymentMethod: string;
  paymentMethodId?: string | null;
  paymentMethodName?: string;
  paymentNumber?: string;
  bankName?: string;
  trxId: string;
  screenshotPath?: string | null;
  items?: DigitalOrderItem[];
  customerIp?: string | null;
  customerFingerprint?: string | null;
}

interface Store {
  orders: DigitalOrder[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  fetchByUser: (userId: string) => Promise<DigitalOrder[]>;
  create: (data: CreateInput) => Promise<DigitalOrder | null>;
  updateStatus: (id: string, status: DigitalOrderStatus) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const newOrderNumber = () => {
  const d = new Date();
  const yymmdd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `DP-${yymmdd}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
};

export const useDigitalOrderStore = create<Store>((set, get) => ({
  orders: [],
  loading: false,

  fetchAll: async () => {
    set({ loading: true });
    try { const data = await api.get('/admin/digital-fe/orders'); if (Array.isArray(data)) set({ orders: data.map(map) }); } catch { /* ignore */ }
    set({ loading: false });
  },

  fetchByUser: async (userId) => {
    try { const data = await api.get(`/public/digital-fe/my-orders?user_id=${encodeURIComponent(userId)}`); return Array.isArray(data) ? data.map(map) : []; } catch { return []; }
  },

  create: async (input) => {
    const row = {
      order_number: newOrderNumber(),
      user_id: input.userId,
      product_id: input.productId,
      product_title: input.productTitle,
      product_slug: input.productSlug || null,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      customer_email: input.customerEmail,
      customer_address: input.customerAddress || null,
      price: input.price,
      payment_method: input.paymentMethod,
      payment_method_id: input.paymentMethodId || null,
      payment_method_name: input.paymentMethodName || null,
      payment_number: input.paymentNumber || null,
      bank_name: input.bankName || null,
      trx_id: input.trxId,
      screenshot_path: input.screenshotPath || null,
      items_json: input.items ? input.items : null,
      customer_ip: input.customerIp || null,
      customer_fingerprint: input.customerFingerprint || null,
      status: 'পেন্ডিং',
    };
    try {
      const data = await api.post('/public/digital-fe/orders', row);
      if (!data) return null;
      const o = map(data);
      set((s) => ({ orders: [o, ...s.orders] }));
      return o;
    } catch { return null; }
  },

  updateStatus: async (id, status) => {
    // On confirm, also clear the stored screenshot path (server keeps the file).
    const payload: any = { status };
    if (status === 'কনফার্মড') payload.screenshot_path = null;
    try {
      await api.put(`/admin/digital-fe/orders/${id}`, payload);
      set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, status, ...(status === 'কনফার্মড' ? { screenshotPath: null } : {}) } : o)) }));
    } catch { /* ignore */ }
  },

  remove: async (id) => {
    try { await api.del(`/admin/digital-fe/orders/${id}`); set((s) => ({ orders: s.orders.filter((o) => o.id !== id) })); } catch { /* ignore */ }
  },
}));
