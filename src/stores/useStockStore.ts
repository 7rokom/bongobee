import { create } from 'zustand';
import { api } from '@/lib/api';

export interface StockEntry {
  id: string;
  productName: string;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  supplier: string;
  note: string;
  date: string;
  damage?: number;
}

interface StockStore {
  stockEntries: StockEntry[];
  loading: boolean;
  fetchStockEntries: () => Promise<void>;
  addStockEntry: (entry: StockEntry) => Promise<void>;
  updateStockEntry: (id: string, updates: Partial<StockEntry>) => Promise<void>;
  deleteStockEntry: (id: string) => Promise<void>;
}

const mapRow = (r: any): StockEntry => ({
  id: r.id, productName: r.product_name, quantity: r.quantity,
  buyPrice: Number(r.buy_price), sellPrice: Number(r.sell_price),
  supplier: r.supplier || '', note: r.note || '', date: r.date || '',
  damage: r.damage || 0,
});

const toRow = (e: Partial<StockEntry>) => {
  const r: any = {};
  if (e.productName !== undefined) r.product_name = e.productName;
  if (e.quantity !== undefined) r.quantity = e.quantity;
  if (e.buyPrice !== undefined) r.buy_price = e.buyPrice;
  if (e.sellPrice !== undefined) r.sell_price = e.sellPrice;
  if (e.supplier !== undefined) r.supplier = e.supplier;
  if (e.note !== undefined) r.note = e.note;
  if (e.date !== undefined) r.date = e.date;
  if (e.damage !== undefined) r.damage = e.damage;
  return r;
};

export const useStockStore = create<StockStore>()((set) => ({
  stockEntries: [],
  loading: false,

  fetchStockEntries: async () => {
    set({ loading: true });
    try {
      const data = await api.get('/admin/stock');
      if (Array.isArray(data)) set({ stockEntries: data.map(mapRow) });
    } catch { /* ignore */ }
    set({ loading: false });
  },

  addStockEntry: async (entry) => {
    const created = await api.post('/admin/stock', toRow(entry));
    set((s) => ({ stockEntries: [mapRow(created), ...s.stockEntries] }));
  },

  updateStockEntry: async (id, updates) => {
    await api.put(`/admin/stock/${id}`, toRow(updates));
    set((s) => ({ stockEntries: s.stockEntries.map((e) => (e.id === id ? { ...e, ...updates } : e)) }));
  },

  deleteStockEntry: async (id) => {
    await api.del(`/admin/stock/${id}`);
    set((s) => ({ stockEntries: s.stockEntries.filter((e) => e.id !== id) }));
  },
}));
