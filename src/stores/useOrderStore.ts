import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Order, OrderItem } from '@/components/admin/OrderDetailDialog';

const toBanglaDate = (d: Date) => {
  const months = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const toBangla = (n: number) => n.toString().split('').map(ch => banglaDigits[parseInt(ch)]).join('');
  return `${toBangla(d.getDate())} ${months[d.getMonth()]} ${toBangla(d.getFullYear())}`;
};

const getBanglaDate = () => toBanglaDate(new Date());

const mapRow = (r: any): Order => ({
  id: r.id,
  customer: r.customer,
  phone: r.phone,
  address: r.address,
  items: r.items || [],
  deliveryCharge: Number(r.delivery_charge),
  originalDeliveryCharge: Number(r.original_delivery_charge),
  total: Number(r.total),
  status: r.status,
  date: r.date,
  isoDate: r.iso_date,
  confirmedBy: r.confirmed_by || '',
  assignedTo: r.assigned_to,
  assignedToName: r.assigned_to_name,
  customerIp: r.customer_ip,
  customerFingerprint: r.customer_fingerprint,
  note: r.note || '',
  paidReturnAmount: r.paid_return_amount ?? null,
  smsSent: r.sms_sent || {},
  source: r.source || undefined,
});

// Order object -> snake_case API payload.
const toRow = (o: Partial<Order>) => {
  const r: any = {};
  if (o.customer !== undefined) r.customer = o.customer;
  if (o.phone !== undefined) r.phone = o.phone;
  if (o.address !== undefined) r.address = o.address;
  if (o.items !== undefined) r.items = o.items;
  if (o.deliveryCharge !== undefined) r.delivery_charge = o.deliveryCharge;
  if (o.originalDeliveryCharge !== undefined) r.original_delivery_charge = o.originalDeliveryCharge;
  if (o.total !== undefined) r.total = o.total;
  if (o.status !== undefined) r.status = o.status;
  if (o.date !== undefined) r.date = o.date;
  if (o.isoDate !== undefined) r.iso_date = o.isoDate;
  if (o.confirmedBy !== undefined) r.confirmed_by = o.confirmedBy;
  if (o.assignedTo !== undefined) r.assigned_to = o.assignedTo;
  if (o.assignedToName !== undefined) r.assigned_to_name = o.assignedToName;
  if (o.customerIp !== undefined) r.customer_ip = o.customerIp;
  if (o.customerFingerprint !== undefined) r.customer_fingerprint = o.customerFingerprint;
  if (o.note !== undefined) r.note = o.note;
  if (o.paidReturnAmount !== undefined) r.paid_return_amount = o.paidReturnAmount;
  if (o.smsSent !== undefined) r.sms_sent = o.smsSent;
  if (o.source !== undefined) r.source = o.source;
  return r;
};

interface OrderStore {
  orders: Order[];
  nextOrderNumber: number;
  loading: boolean;
  fetchOrders: () => Promise<void>;
  addOrder: (order: Order) => Promise<Order | null>;
  updateOrder: (order: Order) => Promise<void>;
  updateStatus: (orderId: string, newStatus: string) => Promise<void>;
  assignOrder: (orderId: string, employeeId: string, employeeName: string) => Promise<void>;
  unassignOrder: (orderId: string) => Promise<void>;
  deleteOrders: (orderIds: Set<string>) => Promise<void>;
  getNextInvoiceId: () => Promise<string>;
  createOrderFromCheckout: (data: {
    name: string;
    phone: string;
    address: string;
    items: { title: string; quantity: number; price: number; image?: string; variations?: Record<string, string>; freeDelivery?: boolean; productId?: string; buyPrice?: number; resellerPriceSnapshot?: number; stockProductName?: string }[];
    deliveryCharge: number;
    subtotal: number;
    confirmedBy?: string;
    customerIp?: string;
    customerFingerprint?: string;
    orderNote?: string;
    source?: string;
  }) => Promise<string>;
}

export const useOrderStore = create<OrderStore>()(
  persist(
    (set, get) => ({
      orders: [],
      nextOrderNumber: 1,
      loading: false,

      fetchOrders: async () => {
        set({ loading: true });
        try {
          const data = await api.get('/admin/fe-orders');
          if (Array.isArray(data)) {
            const orders = data.map(mapRow);
            let maxNum = 0;
            orders.forEach((o: Order) => {
              const num = parseInt(o.id.replace('#', ''));
              if (!isNaN(num) && num > maxNum) maxNum = num;
            });
            set({ orders, nextOrderNumber: maxNum + 1 });
          }
        } catch { /* keep cache */ }
        set({ loading: false });
      },

      addOrder: async (order) => {
        try {
          const created = await api.post('/admin/fe-orders', { id: order.id, ...toRow(order) });
          const newOrder = mapRow(created);
          set((state) => ({ orders: [newOrder, ...state.orders] }));
          return newOrder;
        } catch { /* ignore */ }
        return null;
      },

      updateOrder: async (updated) => {
        const prev = get().orders.find((o) => o.id === updated.id);
        const revertStatuses = ['পেন্ডিং', 'হোল্ড', 'ফলোয়াপ'];
        if (prev && prev.status !== updated.status && revertStatuses.includes(updated.status)) {
          const cleaned = { ...(updated.smsSent || prev.smsSent || {}) };
          delete cleaned['কনফার্মড'];
          delete cleaned['শিপমেন্ট'];
          updated = { ...updated, smsSent: cleaned };
        }
        try {
          await api.post('/admin/fe-orders/update', { code: updated.id, ...toRow(updated) });
          set((state) => ({ orders: state.orders.map((o) => (o.id === updated.id ? updated : o)) }));
          if (prev && prev.status !== updated.status) {
            try {
              const { maybeSendStatusSms, buildMainOrderVars } = await import('@/lib/bulksms');
              maybeSendStatusSms(updated.status, updated.phone, buildMainOrderVars(updated), {
                orderId: updated.id, orderType: 'main', smsSent: updated.smsSent || {},
                onMarked: (next) => set((s) => ({ orders: s.orders.map((o) => o.id === updated.id ? { ...o, smsSent: next } : o) })),
              });
            } catch (e) { console.warn('[order auto-sms updateOrder] skipped:', e); }
            try {
              const { syncReturnLedger } = await import('@/lib/return-ledger');
              const { useFollowUpStore } = await import('@/stores/useFollowUpStore');
              const st = (useFollowUpStore.getState().stockTypes[updated.id] || 'self') as 'self' | 'vendor';
              if (updated.status !== 'পেইড রিটার্ন') await syncReturnLedger(updated, st);
            } catch (e) { console.warn('[return-ledger updateOrder] skipped:', e); }
          }
        } catch (e) {
          toast.error('অর্ডার আপডেট ব্যর্থ হয়েছে');
          throw e;
        }
      },

      deleteOrders: async (orderIds) => {
        const codes = Array.from(orderIds);
        try {
          await api.post('/admin/fe-orders/delete', { codes });
          set((state) => ({ orders: state.orders.filter((o) => !orderIds.has(o.id)) }));
        } catch {
          toast.error('অর্ডার ডিলিট ব্যর্থ হয়েছে');
        }
      },

      updateStatus: async (orderId, newStatus) => {
        const prev = get().orders.find((o) => o.id === orderId);
        const revertStatuses = ['পেন্ডিং', 'হোল্ড', 'ফলোয়াপ'];
        const shouldClearSms = prev && prev.status !== newStatus && revertStatuses.includes(newStatus);
        const cleanedSms = shouldClearSms ? (() => {
          const c = { ...(prev?.smsSent || {}) };
          delete c['কনফার্মড'];
          delete c['শিপমেন্ট'];
          return c;
        })() : null;
        try {
          await api.post('/admin/fe-orders/update', { code: orderId, status: newStatus, ...(cleanedSms ? { sms_sent: cleanedSms } : {}) });
          set((state) => ({ orders: state.orders.map((o) => o.id === orderId ? { ...o, status: newStatus, ...(cleanedSms ? { smsSent: cleanedSms } : {}) } : o) }));
          try {
            const order = get().orders.find((o) => o.id === orderId);
            if (order) {
              const { maybeSendStatusSms, buildMainOrderVars } = await import('@/lib/bulksms');
              maybeSendStatusSms(newStatus, order.phone, buildMainOrderVars(order), {
                orderId, orderType: 'main', smsSent: order.smsSent || {},
                onMarked: (next) => set((s) => ({ orders: s.orders.map((o) => o.id === orderId ? { ...o, smsSent: next } : o) })),
              });
            }
          } catch (e) { console.warn('[order auto-sms] skipped:', e); }
          if (prev && prev.status !== newStatus) {
            try {
              const order = get().orders.find((o) => o.id === orderId);
              if (order) {
                const { syncReturnLedger } = await import('@/lib/return-ledger');
                const { useFollowUpStore } = await import('@/stores/useFollowUpStore');
                const st = (useFollowUpStore.getState().stockTypes[orderId] || 'self') as 'self' | 'vendor';
                if (newStatus !== 'পেইড রিটার্ন') await syncReturnLedger(order, st);
              }
            } catch (e) { console.warn('[return-ledger updateStatus] skipped:', e); }
          }
        } catch {
          toast.error('স্ট্যাটাস আপডেট ব্যর্থ হয়েছে');
        }
      },

      assignOrder: async (orderId, employeeId, employeeName) => {
        try {
          await api.post('/admin/fe-orders/update', { code: orderId, assigned_to: employeeId, assigned_to_name: employeeName });
          set((state) => ({ orders: state.orders.map((o) => o.id === orderId ? { ...o, assignedTo: employeeId, assignedToName: employeeName } : o) }));
        } catch { /* ignore */ }
      },

      unassignOrder: async (orderId) => {
        try {
          await api.post('/admin/fe-orders/update', { code: orderId, assigned_to: null, assigned_to_name: null });
          set((state) => ({ orders: state.orders.map((o) => o.id === orderId ? { ...o, assignedTo: undefined, assignedToName: undefined } : o) }));
        } catch { /* ignore */ }
      },

      getNextInvoiceId: async () => {
        const res = await api.post('/admin/fe-orders/next-invoice');
        const invoice = res?.invoice || ('#' + Date.now());
        const num = parseInt(invoice.replace('#', ''));
        if (!isNaN(num)) set({ nextOrderNumber: num + 1 });
        return invoice;
      },

      createOrderFromCheckout: async (data) => {
        const items: OrderItem[] = data.items.map((i) => ({
          name: i.title, qty: i.quantity, price: i.price, originalPrice: i.price,
          image: i.image || 'https://placehold.co/80x80', variations: i.variations,
          freeDelivery: i.freeDelivery || false,
          productId: i.productId,
          buyPrice: typeof i.buyPrice === 'number' ? i.buyPrice : undefined,
          resellerPriceSnapshot: typeof i.resellerPriceSnapshot === 'number' ? i.resellerPriceSnapshot : undefined,
          stockProductName: i.stockProductName,
        }));

        const payload = {
          customer: data.name,
          phone: data.phone,
          address: data.address,
          items,
          delivery_charge: data.deliveryCharge,
          original_delivery_charge: data.deliveryCharge,
          total: data.subtotal + data.deliveryCharge,
          status: data.confirmedBy ? 'কনফার্মড' : 'পেন্ডিং',
          date: getBanglaDate(),
          iso_date: new Date().toISOString(),
          confirmed_by: data.confirmedBy || '',
          customer_ip: data.customerIp,
          customer_fingerprint: data.customerFingerprint,
          note: data.orderNote || '',
          source: data.source,
        };

        // Server generates the invoice code atomically.
        const created = await api.post('/public/checkout-order', payload);
        const newOrder = mapRow(created);
        const num = parseInt(newOrder.id.replace('#', ''));

        set((state) => ({ orders: [newOrder, ...state.orders], nextOrderNumber: (isNaN(num) ? state.nextOrderNumber : num + 1) }));

        // Side-effects (still external services / not-yet-migrated libs).
        try {
          const { fetchAndCacheCourierRatio } = await import('@/lib/fraud-check');
          fetchAndCacheCourierRatio(newOrder.phone).catch(() => {});
        } catch (e) { console.warn('[order courier-ratio prefetch] skipped:', e); }
        if (newOrder.status === 'কনফার্মড') {
          try {
            const { maybeSendStatusSms, buildMainOrderVars } = await import('@/lib/bulksms');
            maybeSendStatusSms('কনফার্মড', newOrder.phone, buildMainOrderVars(newOrder), {
              orderId: newOrder.id, orderType: 'main', smsSent: {},
              onMarked: (next) => set((s) => ({ orders: s.orders.map((o) => o.id === newOrder.id ? { ...o, smsSent: next } : o) })),
            });
          } catch (e) { console.warn('[order auto-sms checkout] skipped:', e); }
        }
        return newOrder.id;
      },
    }),
    {
      name: 'cache-orders',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ orders: s.orders, nextOrderNumber: s.nextOrderNumber }),
    }
  )
);
