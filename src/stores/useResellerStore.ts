import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from '@/lib/api';
import { computeResellerBalance } from '@/lib/reseller-balance';

export interface Reseller {
  id: string; name: string; email: string; phone: string;
  password: string; isActive: boolean; createdAt: string; balance: number;
  approvalStatus?: string; deactivationNote?: string; serialNumber?: number;
  fingerprint?: string;
  contactPhone?: string;
  contactWhatsapp?: string;
  headerCode?: string;
  bodyCode?: string;
  footerCode?: string;
  smsPendingTemplate?: string;
  smsConfirmedTemplate?: string;
  smsShipmentTemplate?: string;
  smsFollowupTemplate?: string;
  storefrontLogoUrl?: string;
  storefrontFaviconUrl?: string;
  storefrontBio?: string;
  storefrontAddress?: string;
  storefrontPhone?: string;
  storefrontFooterCredit?: string;
  storefrontLegalPages?: Array<{ label: string; url: string; icon?: string }>;
  storefrontFacebookUrl?: string;
  storefrontYoutubeUrl?: string;
  storefrontTwitterUrl?: string;
  storefrontInstagramUrl?: string;
}

export interface ResellerOrder {
  id: string; resellerId: string; resellerName: string;
  customerName: string; customerPhone: string; customerAddress: string;
  items: { productId: string; productTitle: string; image: string; qty: number; resellerPrice: number; sellingPrice: number; profit: number; selectedColor?: string; selectedSize?: string; selectedWeight?: string; selectedVariations?: Record<string, string>; buyPrice?: number; stockProductName?: string; }[];
  deliveryCharge: number; packagingCharge?: number; codCharge?: number;
  totalSellingPrice: number; totalResellerCost: number; totalProfit: number;
  status: string; date: string; notes?: string[]; adminNote?: string;
  customerIp?: string; customerFingerprint?: string;
  paidReturnAmount?: number | null;
  assignedTo?: string;
  assignedToName?: string;
  confirmedBy?: string;
  smsSent?: Record<string, string>;
  source?: string;
}

export interface PaymentRequest {
  id: string; resellerId: string; resellerName: string; amount: number;
  method: string; accountNumber: string; status: 'পেন্ডিং' | 'অনুমোদিত' | 'বাতিল'; date: string;
}

interface ResellerStore {
  resellers: Reseller[];
  orders: ResellerOrder[];
  paymentRequests: PaymentRequest[];
  loading: boolean;
  fetchResellers: () => Promise<void>;
  fetchResellerOrders: () => Promise<void>;
  fetchPaymentRequests: () => Promise<void>;
  addReseller: (r: Reseller) => Promise<void>;
  updateReseller: (id: string, updates: Partial<Reseller>) => Promise<void>;
  loginReseller: (email: string, password: string) => Reseller | null;
  addResellerOrder: (order: ResellerOrder) => Promise<void>;
  updateResellerOrderStatus: (orderId: string, status: string, confirmerName?: string) => Promise<void>;
  updateResellerOrder: (orderId: string, updates: Partial<ResellerOrder>) => Promise<void>;
  deleteResellerOrder: (orderId: string) => Promise<void>;
  assignResellerOrder: (orderId: string, employeeId: string, employeeName: string) => Promise<void>;
  unassignResellerOrder: (orderId: string) => Promise<void>;
  addPaymentRequest: (req: PaymentRequest) => Promise<void>;
  updatePaymentRequest: (id: string, status: 'অনুমোদিত' | 'বাতিল') => Promise<void>;
  getResellerBalance: (resellerId: string) => number;
  getWithdrawableBalance: (resellerId: string) => number;
  getNextResellerOrderId: () => Promise<string>;
}

const mapReseller = (r: any): Reseller => ({
  id: r.id, name: r.name, email: r.email, phone: r.phone || '',
  password: r.password || '', isActive: r.is_active ?? true, createdAt: r.created_at || '',
  balance: Number(r.balance) || 0,
  approvalStatus: r.approval_status || 'approved',
  deactivationNote: r.deactivation_note || '',
  serialNumber: r.serial_number || undefined,
  fingerprint: r.fingerprint || undefined,
  contactPhone: r.contact_phone || '',
  contactWhatsapp: r.contact_whatsapp || '',
  headerCode: r.header_code || '',
  bodyCode: r.body_code || '',
  footerCode: r.footer_code || '',
  smsPendingTemplate: r.sms_pending_template || '',
  smsConfirmedTemplate: r.sms_confirmed_template || '',
  smsShipmentTemplate: r.sms_shipment_template || '',
  smsFollowupTemplate: r.sms_followup_template || '',
  storefrontLogoUrl: r.storefront_logo_url || '',
  storefrontFaviconUrl: r.storefront_favicon_url || '',
  storefrontBio: r.storefront_bio || '',
  storefrontAddress: r.storefront_address || '',
  storefrontPhone: r.storefront_phone || '',
  storefrontFooterCredit: r.storefront_footer_credit || '',
  storefrontLegalPages: r.storefront_legal_pages || [],
  storefrontFacebookUrl: r.storefront_facebook_url || '',
  storefrontYoutubeUrl: r.storefront_youtube_url || '',
  storefrontTwitterUrl: r.storefront_twitter_url || '',
  storefrontInstagramUrl: r.storefront_instagram_url || '',
});

const mapOrder = (r: any): ResellerOrder => ({
  id: r.id, resellerId: r.reseller_id, resellerName: r.reseller_name || '',
  customerName: r.customer_name, customerPhone: r.customer_phone || '',
  customerAddress: r.customer_address || '', items: r.items || [],
  deliveryCharge: Number(r.delivery_charge), packagingCharge: r.packaging_charge ? Number(r.packaging_charge) : undefined,
  codCharge: r.cod_charge ? Number(r.cod_charge) : undefined,
  totalSellingPrice: Number(r.total_selling_price), totalResellerCost: Number(r.total_reseller_cost),
  totalProfit: Number(r.total_profit), status: r.status, date: r.date || '',
  notes: r.notes || [], adminNote: r.admin_note || '',
  customerIp: r.customer_ip || undefined,
  customerFingerprint: r.customer_fingerprint || undefined,
  paidReturnAmount: r.paid_return_amount != null ? Number(r.paid_return_amount) : null,
  assignedTo: r.assigned_to || undefined,
  assignedToName: r.assigned_to_name || undefined,
  confirmedBy: r.confirmed_by || undefined,
  smsSent: r.sms_sent || {},
  source: r.source || undefined,
});

const mapPayment = (r: any): PaymentRequest => ({
  id: r.id, resellerId: r.reseller_id, resellerName: r.reseller_name || '',
  amount: Number(r.amount), method: r.method || r.payment_method || '', accountNumber: r.account_number || '',
  status: r.status, date: r.date || '',
});

const orderToRow = (o: ResellerOrder) => ({
  reseller_id: o.resellerId, reseller_name: o.resellerName,
  customer_name: o.customerName, customer_phone: o.customerPhone, customer_address: o.customerAddress,
  items: o.items, delivery_charge: o.deliveryCharge, packaging_charge: o.packagingCharge ?? 0,
  cod_charge: o.codCharge ?? 0, total_selling_price: o.totalSellingPrice,
  total_reseller_cost: o.totalResellerCost, total_profit: o.totalProfit,
  status: o.status, date: o.date, notes: o.notes || [],
  customer_ip: o.customerIp ?? null, customer_fingerprint: o.customerFingerprint ?? null,
  source: o.source,
});

export const useResellerStore = create<ResellerStore>()(
  persist(
    (set, get) => ({
      resellers: [],
      orders: [],
      paymentRequests: [],
      loading: false,

      fetchResellers: async () => {
        set({ loading: true });
        try {
          const data = await api.get('/rs/resellers');
          if (Array.isArray(data)) set({ resellers: data.map(mapReseller) });
        } catch { /* ignore */ }
        set({ loading: false });
      },

      fetchResellerOrders: async () => {
        try {
          const data = await api.get('/rs/reseller-orders');
          if (Array.isArray(data)) set({ orders: data.map(mapOrder) });
        } catch { /* ignore */ }
      },

      fetchPaymentRequests: async () => {
        try {
          const data = await api.get('/rs/payment-requests');
          if (Array.isArray(data)) set({ paymentRequests: data.map(mapPayment) });
        } catch { /* ignore */ }
      },

      addReseller: async (r) => {
        try {
          const created = await api.post('/rs/resellers', {
            id: r.id, name: r.name, email: r.email, phone: r.phone,
            password: r.password, is_active: r.isActive, balance: r.balance,
            approval_status: r.approvalStatus || 'pending', deactivation_note: r.deactivationNote || '',
            fingerprint: r.fingerprint || '',
          });
          set((s) => ({ resellers: [...s.resellers, mapReseller(created)] }));
        } catch { /* ignore */ }
      },

      updateReseller: async (id, updates) => {
        const row: any = {};
        if (updates.name !== undefined) row.name = updates.name;
        if (updates.email !== undefined) row.email = updates.email;
        if (updates.phone !== undefined) row.phone = updates.phone;
        if (updates.password !== undefined && updates.password) row.password = updates.password;
        if (updates.isActive !== undefined) row.is_active = updates.isActive;
        if (updates.balance !== undefined) row.balance = updates.balance;
        if (updates.approvalStatus !== undefined) row.approval_status = updates.approvalStatus;
        if (updates.deactivationNote !== undefined) row.deactivation_note = updates.deactivationNote;
        if (updates.contactPhone !== undefined) row.contact_phone = updates.contactPhone;
        if (updates.contactWhatsapp !== undefined) row.contact_whatsapp = updates.contactWhatsapp;
        if (updates.headerCode !== undefined) row.header_code = updates.headerCode;
        if (updates.bodyCode !== undefined) row.body_code = updates.bodyCode;
        if (updates.footerCode !== undefined) row.footer_code = updates.footerCode;
        if (updates.smsPendingTemplate !== undefined) row.sms_pending_template = updates.smsPendingTemplate;
        if (updates.smsConfirmedTemplate !== undefined) row.sms_confirmed_template = updates.smsConfirmedTemplate;
        if (updates.smsShipmentTemplate !== undefined) row.sms_shipment_template = updates.smsShipmentTemplate;
        if (updates.smsFollowupTemplate !== undefined) row.sms_followup_template = updates.smsFollowupTemplate;
        if (updates.storefrontLogoUrl !== undefined) row.storefront_logo_url = updates.storefrontLogoUrl;
        if (updates.storefrontFaviconUrl !== undefined) row.storefront_favicon_url = updates.storefrontFaviconUrl;
        if (updates.storefrontBio !== undefined) row.storefront_bio = updates.storefrontBio;
        if (updates.storefrontAddress !== undefined) row.storefront_address = updates.storefrontAddress;
        if (updates.storefrontPhone !== undefined) row.storefront_phone = updates.storefrontPhone;
        if (updates.storefrontFooterCredit !== undefined) row.storefront_footer_credit = updates.storefrontFooterCredit;
        if (updates.storefrontLegalPages !== undefined) row.storefront_legal_pages = updates.storefrontLegalPages;
        if (updates.storefrontFacebookUrl !== undefined) row.storefront_facebook_url = updates.storefrontFacebookUrl;
        if (updates.storefrontYoutubeUrl !== undefined) row.storefront_youtube_url = updates.storefrontYoutubeUrl;
        if (updates.storefrontTwitterUrl !== undefined) row.storefront_twitter_url = updates.storefrontTwitterUrl;
        if (updates.storefrontInstagramUrl !== undefined) row.storefront_instagram_url = updates.storefrontInstagramUrl;
        await api.put(`/rs/resellers/${id}`, row);
        set((s) => ({ resellers: s.resellers.map((r) => (r.id === id ? { ...r, ...updates } : r)) }));
      },

      loginReseller: (email, password) => {
        return get().resellers.find((r) => r.email === email && r.password === password && r.isActive && r.approvalStatus === 'approved') || null;
      },

      addResellerOrder: async (order) => {
        try {
          await api.post('/rs/reseller-orders', { id: order.id, ...orderToRow(order) });
          set((s) => ({ orders: [order, ...s.orders] }));
          try {
            const { fetchAndCacheCourierRatio } = await import('@/lib/fraud-check');
            fetchAndCacheCourierRatio(order.customerPhone).catch(() => {});
          } catch (e) { console.warn('[reseller courier-ratio prefetch] skipped:', e); }
          if (['পেন্ডিং', 'কনফার্মড', 'শিপমেন্ট', 'ফলোয়াপ'].includes(order.status)) {
            try {
              const { maybeSendStatusSms, buildResellerOrderVars } = await import('@/lib/bulksms');
              maybeSendStatusSms(order.status, order.customerPhone, buildResellerOrderVars(order), {
                orderId: order.id, orderType: 'reseller', resellerId: order.resellerId, smsSent: {},
                onMarked: (next) => set((s) => ({ orders: s.orders.map((o) => o.id === order.id ? { ...o, smsSent: next } : o) })),
              });
            } catch (e) { console.warn('[reseller auto-sms create] skipped:', e); }
          }
        } catch (e) { console.error('[addResellerOrder] error:', e); throw e; }
      },

      updateResellerOrderStatus: async (orderId, status, confirmerName) => {
        const existing = get().orders.find(o => o.id === orderId);
        const shouldSetConfirmer = status === 'কনফার্মড' && !existing?.confirmedBy && confirmerName;
        const shouldClearSms = existing && existing.status !== status && ['পেন্ডিং', 'হোল্ড'].includes(status);
        const cleanedSms = shouldClearSms ? (() => {
          const c = { ...(existing?.smsSent || {}) };
          delete c['কনফার্মড']; delete c['শিপমেন্ট']; delete c['ফলোয়াপ'];
          return c;
        })() : null;
        const payload: any = { code: orderId, status };
        if (cleanedSms) payload.sms_sent = cleanedSms;
        if (shouldSetConfirmer) payload.confirmed_by = confirmerName;
        try {
          await api.post('/rs/reseller-orders/update', payload);
          set((s) => ({ orders: s.orders.map((o) => (o.id === orderId ? { ...o, status, ...(cleanedSms ? { smsSent: cleanedSms } : {}), ...(shouldSetConfirmer ? { confirmedBy: confirmerName } : {}) } : o)) }));
          try {
            const order = get().orders.find((o) => o.id === orderId);
            if (order) {
              const { maybeSendStatusSms, buildResellerOrderVars } = await import('@/lib/bulksms');
              maybeSendStatusSms(status, order.customerPhone, buildResellerOrderVars(order), {
                orderId, orderType: 'reseller', resellerId: order.resellerId, smsSent: order.smsSent || {},
                onMarked: (next) => set((s) => ({ orders: s.orders.map((o) => o.id === orderId ? { ...o, smsSent: next } : o) })),
              });
            }
          } catch (e) { console.warn('[reseller auto-sms] skipped:', e); }
        } catch (e) { console.error('[updateResellerOrderStatus] error:', e); }
      },

      assignResellerOrder: async (orderId, employeeId, employeeName) => {
        try { await api.post('/rs/reseller-orders/update', { code: orderId, assigned_to: employeeId, assigned_to_name: employeeName }); } catch (e) { console.error('[assignResellerOrder] error:', e); }
        set((s) => ({ orders: s.orders.map((o) => (o.id === orderId ? { ...o, assignedTo: employeeId, assignedToName: employeeName } : o)) }));
      },

      unassignResellerOrder: async (orderId) => {
        try { await api.post('/rs/reseller-orders/update', { code: orderId, assigned_to: null, assigned_to_name: null }); } catch (e) { console.error('[unassignResellerOrder] error:', e); }
        set((s) => ({ orders: s.orders.map((o) => (o.id === orderId ? { ...o, assignedTo: undefined, assignedToName: undefined } : o)) }));
      },

      updateResellerOrder: async (orderId, updates) => {
        const row: any = { code: orderId };
        if (updates.customerName !== undefined) row.customer_name = updates.customerName;
        if (updates.customerPhone !== undefined) row.customer_phone = updates.customerPhone;
        if (updates.customerAddress !== undefined) row.customer_address = updates.customerAddress;
        if (updates.items !== undefined) row.items = updates.items;
        if (updates.totalSellingPrice !== undefined) row.total_selling_price = updates.totalSellingPrice;
        if (updates.totalResellerCost !== undefined) row.total_reseller_cost = updates.totalResellerCost;
        if (updates.totalProfit !== undefined) row.total_profit = updates.totalProfit;
        if (updates.deliveryCharge !== undefined) row.delivery_charge = updates.deliveryCharge;
        if (updates.packagingCharge !== undefined) row.packaging_charge = updates.packagingCharge;
        if (updates.codCharge !== undefined) row.cod_charge = updates.codCharge;
        if (updates.notes !== undefined) row.notes = updates.notes;
        if (updates.paidReturnAmount !== undefined) row.paid_return_amount = updates.paidReturnAmount;
        await api.post('/rs/reseller-orders/update', row);
        set((s) => ({ orders: s.orders.map((o) => (o.id === orderId ? { ...o, ...updates } : o)) }));
      },

      deleteResellerOrder: async (orderId) => {
        await api.post('/rs/reseller-orders/delete', { code: orderId });
        set((s) => ({ orders: s.orders.filter((o) => o.id !== orderId) }));
      },

      addPaymentRequest: async (req) => {
        try {
          await api.post('/rs/payment-requests', {
            id: req.id, reseller_id: req.resellerId, reseller_name: req.resellerName,
            amount: req.amount, method: req.method, account_number: req.accountNumber,
            status: req.status, date: req.date,
          });
          set((s) => ({ paymentRequests: [req, ...s.paymentRequests] }));
        } catch { /* ignore */ }
      },

      updatePaymentRequest: async (id, status) => {
        await api.put(`/rs/payment-requests/${id}`, { status });
        const s = get();
        const req = s.paymentRequests.find((p) => p.id === id);
        if (!req) return;
        const updated = s.paymentRequests.map((p) => (p.id === id ? { ...p, status } : p));
        if (status === 'অনুমোদিত' && req.status === 'পেন্ডিং') {
          const resellers = s.resellers.map((r) =>
            r.id === req.resellerId ? { ...r, balance: r.balance - req.amount } : r
          );
          const newBal = resellers.find(r => r.id === req.resellerId)?.balance;
          try { await api.put(`/rs/resellers/${req.resellerId}`, { balance: newBal }); } catch { /* ignore */ }
          set({ paymentRequests: updated, resellers });
        } else {
          set({ paymentRequests: updated });
        }
      },

      getResellerBalance: (resellerId) => {
        const orders = get().orders.filter((o) => o.resellerId === resellerId);
        const payments = get().paymentRequests.filter((p) => p.resellerId === resellerId);
        return computeResellerBalance(orders, payments).withdrawable;
      },

      getNextResellerOrderId: async () => {
        const res = await api.post('/rs/reseller-orders/next-id');
        return res?.id || ('#RO' + Date.now());
      },

      getWithdrawableBalance: (resellerId) => {
        const orders = get().orders.filter((o) => o.resellerId === resellerId);
        const payments = get().paymentRequests.filter((p) => p.resellerId === resellerId);
        return computeResellerBalance(orders, payments).withdrawable;
      },
    }),
    {
      name: 'cache-resellers',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ resellers: s.resellers, orders: s.orders, paymentRequests: s.paymentRequests }),
    }
  )
);
