import { create } from 'zustand';
import { api } from '@/lib/api';
import { generateFingerprint } from '@/lib/fingerprint';

export type BlockType = 'ip' | 'phone' | 'fingerprint' | 'user';

export interface DigitalBlock {
  id: string;
  userId: string | null;
  blockType: BlockType;
  blockValue: string;
  reason?: string;
  createdAt: string;
}

interface Identity {
  userId?: string | null;
  phone?: string | null;
  ip?: string | null;
  fingerprint?: string | null;
}

const map = (r: any): DigitalBlock => ({
  id: r.id,
  userId: r.user_id,
  blockType: r.block_type,
  blockValue: r.block_value,
  reason: r.reason || undefined,
  createdAt: r.created_at,
});

interface Store {
  blocks: DigitalBlock[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  add: (b: { userId?: string | null; blockType: BlockType; blockValue: string; reason?: string }) => Promise<{ ok: boolean; error?: string }>;
  remove: (id: string) => Promise<void>;
  isBlocked: (identity: Identity) => boolean;
  fetchAndCheck: (identity: Identity) => Promise<boolean>;
}

export const useDigitalBlockStore = create<Store>((set, get) => ({
  blocks: [],
  loading: false,

  fetchAll: async () => {
    set({ loading: true });
    try { const data = await api.get('/public/digital-fe/blocks'); if (Array.isArray(data)) set({ blocks: data.map(map) }); } catch { /* ignore */ }
    set({ loading: false });
  },

  add: async ({ userId, blockType, blockValue, reason }) => {
    if (!blockValue) return { ok: false, error: 'মান দিন' };
    try {
      const data = await api.post('/admin/digital-fe/blocks', { user_id: userId || null, block_type: blockType, block_value: blockValue, reason: reason || null });
      if (data) set((s) => ({ blocks: [map(data), ...s.blocks] }));
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e?.message || 'ব্যর্থ' }; }
  },

  remove: async (id) => {
    try { await api.del(`/admin/digital-fe/blocks/${id}`); set((s) => ({ blocks: s.blocks.filter((b) => b.id !== id) })); } catch { /* ignore */ }
  },

  isBlocked: ({ userId, phone, ip, fingerprint }) => {
    const blocks = get().blocks;
    return blocks.some((b) => {
      if (b.blockType === 'user' && userId && b.blockValue === userId) return true;
      if (b.blockType === 'phone' && phone && b.blockValue === phone) return true;
      if (b.blockType === 'ip' && ip && b.blockValue === ip) return true;
      if (b.blockType === 'fingerprint' && fingerprint && b.blockValue === fingerprint) return true;
      return false;
    });
  },

  fetchAndCheck: async (identity) => {
    await get().fetchAll();
    return get().isBlocked(identity);
  },
}));

// Helper: fetch public IP (cached in sessionStorage)
export const getClientIp = async (): Promise<string | null> => {
  try {
    const cached = sessionStorage.getItem('digital_client_ip');
    if (cached) return cached;
    const r = await fetch('https://api.ipify.org?format=json');
    const j = await r.json();
    if (j?.ip) {
      sessionStorage.setItem('digital_client_ip', j.ip);
      return j.ip;
    }
  } catch {}
  return null;
};

// Helper: get/cache fingerprint
export const getClientFingerprint = (): string => {
  let fp = sessionStorage.getItem('digital_client_fp');
  if (!fp) {
    fp = generateFingerprint();
    sessionStorage.setItem('digital_client_fp', fp);
  }
  return fp;
};
