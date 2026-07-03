import { create } from 'zustand';
import { api } from '@/lib/api';

export interface SteadfastOrderData {
  consignment_id?: number;
  tracking_code?: string;
  steadfast_status?: string;
  sent_at?: string;
}

interface SteadfastSettings {
  apiKey: string;
  secretKey: string;
}

interface SteadfastStore {
  settings: SteadfastSettings;
  orderData: Record<string, SteadfastOrderData>; // keyed by order id
  updateSettings: (s: Partial<SteadfastSettings>) => Promise<void>;
  fetchSettings: () => Promise<void>;
  setOrderData: (orderId: string, data: SteadfastOrderData) => void;
  removeOrderData: (orderId: string) => void;
  getOrderData: (orderId: string) => SteadfastOrderData | undefined;
  fetchDispatchData: () => Promise<void>;
}

export const useSteadfastStore = create<SteadfastStore>()((set, get) => ({
  settings: { apiKey: '', secretKey: '' },
  orderData: {},
  updateSettings: async (s) => {
    set((state) => ({ settings: { ...state.settings, ...s } }));
    const settings = get().settings;
    try { await api.put('/admin/data/courier-settings/steadfast', settings); }
    catch (e) { console.error('Steadfast settings save failed:', e); throw e; }
  },
  fetchSettings: async () => {
    const data = await api.get('/admin/data/courier-settings/steadfast').catch(() => null);
    if (data && Object.keys(data).length) set({ settings: data });
  },
  fetchDispatchData: async () => {
    const data = await api.get('/admin/data/courier-dispatch?courier_type=steadfast').catch(() => null);
    if (Array.isArray(data)) {
      const orderData: Record<string, SteadfastOrderData> = {};
      data.forEach((r: any) => {
        orderData[r.order_id] = {
          consignment_id: r.consignment_id ? Number(r.consignment_id) : undefined,
          tracking_code: r.tracking_code || undefined,
          steadfast_status: r.courier_status || undefined,
          sent_at: r.sent_at || undefined,
        };
      });
      set({ orderData });
    }
  },
  setOrderData: async (orderId, data) => {
    set((state) => ({ orderData: { ...state.orderData, [orderId]: { ...state.orderData[orderId], ...data } } }));
    try {
      await api.post('/admin/data/courier-dispatch', {
        order_id: orderId,
        courier_type: 'steadfast',
        consignment_id: String(data.consignment_id || ''),
        tracking_code: data.tracking_code || '',
        courier_status: data.steadfast_status || '',
        sent_at: data.sent_at || '',
      });
    } catch (e) { console.error('courier_dispatch upsert failed (steadfast):', e); }
  },
  removeOrderData: (orderId) => {
    set((state) => {
      const { [orderId]: _, ...rest } = state.orderData;
      return { orderData: rest };
    });
    api.post('/admin/data/courier-dispatch/delete', { order_id: orderId, courier_type: 'steadfast' }).catch(() => {});
  },
  getOrderData: (orderId) => get().orderData[orderId],
}));
