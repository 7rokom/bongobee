import { create } from 'zustand';
import { api } from '@/lib/api';

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxUsage: number;
  usedCount: number;
  isActive: boolean;
  startDate: string;
  endDate: string;
  createdAt: string;
  productIds?: string[];
}

interface CouponStore {
  coupons: Coupon[];
  loading: boolean;
  fetchCoupons: () => Promise<void>;
  addCoupon: (coupon: Omit<Coupon, 'id' | 'usedCount' | 'createdAt'>) => Promise<void>;
  updateCoupon: (id: string, data: Partial<Coupon>) => Promise<void>;
  deleteCoupon: (id: string) => Promise<void>;
  toggleCoupon: (id: string) => Promise<void>;
  applyCoupon: (code: string, orderTotal: number, cartProductIds?: string[]) => { valid: boolean; discount: number; message: string };
  incrementUsage: (code: string) => Promise<void>;
}

const mapRow = (r: any): Coupon => ({
  id: r.id,
  code: r.code,
  discountType: r.discount_type,
  discountValue: Number(r.discount_value) || 0,
  minOrderAmount: Number(r.min_order_amount) || 0,
  maxUsage: Number(r.max_usage) || 0,
  usedCount: Number(r.used_count) || 0,
  isActive: !!r.is_active,
  startDate: r.start_date,
  endDate: r.end_date,
  createdAt: r.created_at,
  productIds: r.product_ids || [],
});

const toRow = (c: Partial<Coupon>) => {
  const row: any = {};
  if (c.code !== undefined) row.code = c.code;
  if (c.discountType !== undefined) row.discount_type = c.discountType;
  if (c.discountValue !== undefined) row.discount_value = c.discountValue;
  if (c.minOrderAmount !== undefined) row.min_order_amount = c.minOrderAmount;
  if (c.maxUsage !== undefined) row.max_usage = c.maxUsage;
  if (c.usedCount !== undefined) row.used_count = c.usedCount;
  if (c.isActive !== undefined) row.is_active = c.isActive;
  if (c.startDate !== undefined) row.start_date = c.startDate;
  if (c.endDate !== undefined) row.end_date = c.endDate;
  if (c.productIds !== undefined) row.product_ids = c.productIds;
  return row;
};

export const useCouponStore = create<CouponStore>()((set, get) => ({
  coupons: [],
  loading: false,

  fetchCoupons: async () => {
    set({ loading: true });
    try {
      const data = await api.get('/admin/coupons');
      if (Array.isArray(data)) set({ coupons: data.map(mapRow) });
    } catch { /* ignore */ }
    set({ loading: false });
  },

  addCoupon: async (coupon) => {
    const created = await api.post('/admin/coupons', toRow(coupon as Partial<Coupon>));
    set({ coupons: [mapRow(created), ...get().coupons] });
  },

  updateCoupon: async (id, data) => {
    const updated = await api.put(`/admin/coupons/${id}`, toRow(data));
    set({ coupons: get().coupons.map((c) => (c.id === id ? mapRow(updated) : c)) });
  },

  deleteCoupon: async (id) => {
    await api.del(`/admin/coupons/${id}`);
    set({ coupons: get().coupons.filter((c) => c.id !== id) });
  },

  toggleCoupon: async (id) => {
    const coupon = get().coupons.find((c) => c.id === id);
    if (!coupon) return;
    const newActive = !coupon.isActive;
    await api.put(`/admin/coupons/${id}`, { is_active: newActive });
    set({ coupons: get().coupons.map((c) => (c.id === id ? { ...c, isActive: newActive } : c)) });
  },

  applyCoupon: (code, orderTotal, cartProductIds) => {
    const coupon = get().coupons.find((c) => c.code.toLowerCase() === code.toLowerCase());
    if (!coupon) return { valid: false, discount: 0, message: 'কুপন কোড সঠিক নয়' };
    if (!coupon.isActive) return { valid: false, discount: 0, message: 'এই কুপনটি নিষ্ক্রিয়' };

    const now = new Date();
    if (new Date(coupon.startDate) > now) return { valid: false, discount: 0, message: 'এই কুপনটি এখনো শুরু হয়নি' };
    if (new Date(coupon.endDate) < now) return { valid: false, discount: 0, message: 'এই কুপনের মেয়াদ শেষ হয়ে গেছে' };

    if (coupon.maxUsage > 0 && coupon.usedCount >= coupon.maxUsage)
      return { valid: false, discount: 0, message: 'এই কুপনের ব্যবহার সীমা শেষ' };

    if (coupon.productIds && coupon.productIds.length > 0 && cartProductIds) {
      const hasMatchingProduct = cartProductIds.some(pid => coupon.productIds!.includes(pid));
      if (!hasMatchingProduct) return { valid: false, discount: 0, message: 'এই কুপনটি আপনার কার্টের প্রোডাক্টে প্রযোজ্য নয়' };
    }

    if (coupon.minOrderAmount > 0 && orderTotal < coupon.minOrderAmount)
      return { valid: false, discount: 0, message: `সর্বনিম্ন ৳${coupon.minOrderAmount} টাকার অর্ডারে এই কুপন প্রযোজ্য` };

    const discount =
      coupon.discountType === 'percentage'
        ? Math.round((orderTotal * coupon.discountValue) / 100)
        : coupon.discountValue;

    return { valid: true, discount: Math.min(discount, orderTotal), message: '✓ কুপন প্রয়োগ হয়েছে!' };
  },

  // Coupon usage is incremented server-side during order placement; keep local state in sync.
  incrementUsage: async (code) => {
    const coupon = get().coupons.find((c) => c.code.toLowerCase() === code.toLowerCase());
    if (!coupon) return;
    set({
      coupons: get().coupons.map((c) =>
        c.id === coupon.id ? { ...c, usedCount: c.usedCount + 1 } : c
      ),
    });
  },
}));
