import { create } from 'zustand';
import { api } from '@/lib/api';

function getImpersonatedResellerId(): string | null {
  try {
    const auth = JSON.parse(localStorage.getItem('reseller-auth') || '{}');
    return auth?.impersonatedBy === 'admin' && auth?.id ? auth.id : null;
  } catch {
    return null;
  }
}

export interface ResellerDomain {
  id: number;
  reseller_id: string;
  domain: string;
  is_primary: boolean;
  status: 'pending' | 'verified' | 'failed' | 'inactive';
  ssl_status: string;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ResellerDomainStore {
  domain: ResellerDomain | null;
  loading: boolean;
  fetchDomain: () => Promise<void>;
  addDomain: (domain: string) => Promise<ResellerDomain>;
  removeDomain: (id: number) => Promise<void>;
  verifyDns: (id: number) => Promise<{ message: string; domain: ResellerDomain }>;
}

export const useResellerDomainStore = create<ResellerDomainStore>((set) => ({
  domain: null,
  loading: false,

  fetchDomain: async () => {
    set({ loading: true });
    try {
      const rid = getImpersonatedResellerId();
      const path = rid ? `/reseller/custom-domain?reseller_id=${encodeURIComponent(rid)}` : '/reseller/custom-domain';
      const data = await api.get(path);
      set({ domain: Array.isArray(data) && data.length > 0 ? data[0] : null });
    } catch {
      set({ domain: null });
    } finally {
      set({ loading: false });
    }
  },

  addDomain: async (domainName: string) => {
    const rid = getImpersonatedResellerId();
    const body: Record<string, string> = { domain: domainName };
    if (rid) body.reseller_id = rid;
    const data = await api.post('/reseller/custom-domain', body);
    set({ domain: data });
    return data;
  },

  removeDomain: async (id: number) => {
    const rid = getImpersonatedResellerId();
    const path = rid ? `/reseller/custom-domain/${id}?reseller_id=${encodeURIComponent(rid)}` : `/reseller/custom-domain/${id}`;
    await api.del(path);
    set({ domain: null });
  },

  verifyDns: async (id: number) => {
    const rid = getImpersonatedResellerId();
    const body = rid ? { reseller_id: rid } : {};
    const data = await api.post(`/reseller/custom-domain/${id}/verify`, body);
    set({ domain: data.domain });
    return data;
  },
}));
