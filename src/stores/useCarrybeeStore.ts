import { create } from 'zustand';
import { api } from '@/lib/api';

export interface CarrybeeOrderData {
  consignment_id?: string;
  transfer_status?: string;
  sent_at?: string;
  store_id?: string;
}

interface CarrybeeSettings {
  clientId: string;
  clientSecret: string;
  clientContext: string;
  defaultStoreId: string;
  defaultCityId: number;
  defaultZoneId: number;
}

interface CarrybeeStore {
  settings: CarrybeeSettings;
  orderData: Record<string, CarrybeeOrderData>;
  updateSettings: (s: Partial<CarrybeeSettings>) => Promise<void>;
  fetchSettings: () => Promise<void>;
  setOrderData: (orderId: string, data: CarrybeeOrderData) => void;
  removeOrderData: (orderId: string) => void;
  getOrderData: (orderId: string) => CarrybeeOrderData | undefined;
  fetchDispatchData: () => Promise<void>;
}

const isMissingOptionalColumnError = (error: any, column: string) => {
  const message = String(error?.message || '');
  return error?.code === '42703'
    || error?.code === 'PGRST204'
    || message.includes(column)
    || /column .* does not exist/i.test(message)
    || /could not find the .* column .* schema cache/i.test(message);
};

export const useCarrybeeStore = create<CarrybeeStore>()((set, get) => ({
  settings: { clientId: '', clientSecret: '', clientContext: '', defaultStoreId: '', defaultCityId: 0, defaultZoneId: 0 },
  orderData: {},
  updateSettings: async (s) => {
    set((state) => ({ settings: { ...state.settings, ...s } }));
    const settings = get().settings;
    try { await api.put('/admin/data/courier-settings/carrybee', settings); }
    catch (e) { console.error('Carrybee settings save failed:', e); throw e; }
  },
  fetchSettings: async () => {
    const data = await api.get('/admin/data/courier-settings/carrybee').catch(() => null);
    if (data && Object.keys(data).length) set({ settings: data });
  },
  fetchDispatchData: async () => {
    const data = await api.get('/admin/data/courier-dispatch?courier_type=carrybee').catch(() => null);
    if (Array.isArray(data)) {
      const orderData: Record<string, CarrybeeOrderData> = {};
      data.forEach((r: any) => {
        orderData[r.order_id] = {
          consignment_id: r.consignment_id || undefined,
          transfer_status: r.courier_status || undefined,
          sent_at: r.sent_at || undefined,
          store_id: r.store_id || undefined,
        };
      });
      set({ orderData });
    }
  },
  setOrderData: async (orderId, data) => {
    set((state) => ({ orderData: { ...state.orderData, [orderId]: { ...state.orderData[orderId], ...data } } }));
    const payload = {
      order_id: orderId,
      courier_type: 'carrybee',
      consignment_id: String(data.consignment_id || ''),
      tracking_code: '',
      courier_status: data.transfer_status || '',
      store_id: data.store_id || '',
      sent_at: data.sent_at || '',
      updated_at: new Date().toISOString(),
    };
    try { await api.post('/admin/data/courier-dispatch', payload); }
    catch (e) { console.error('courier_dispatch upsert failed (carrybee):', e); }
  },
  removeOrderData: (orderId) => {
    set((state) => {
      const { [orderId]: _, ...rest } = state.orderData;
      return { orderData: rest };
    });
    api.post('/admin/data/courier-dispatch/delete', { order_id: orderId, courier_type: 'carrybee' }).catch(() => {});
  },
  getOrderData: (orderId) => get().orderData[orderId],
}));
