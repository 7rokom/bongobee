import { createContext, useContext } from 'react';

export interface ResellerStorefrontBranding {
  logoUrl?: string;
  faviconUrl?: string;
  bio?: string;
  address?: string;
  phone?: string;
  footerCredit?: string;
  legalPages?: Array<{ label: string; url: string; icon?: string }>;
  facebookUrl?: string;
  youtubeUrl?: string;
  twitterUrl?: string;
  instagramUrl?: string;
}

export interface ResellerRefValue {
  id: string;
  serialNumber?: number;
  name?: string;
  contactPhone?: string;
  contactWhatsapp?: string;
  headerCode?: string;
  bodyCode?: string;
  footerCode?: string;
  /** On custom domains the domain itself identifies the reseller; suppress /r/ID/ URL prefix. */
  noUrlPrefix?: boolean;
  /** Reseller's own storefront branding — overrides site defaults on custom domains. */
  branding?: ResellerStorefrontBranding;
}

// Backwards-compat: the context value can be either the resolved reseller id
// string (legacy) or a ResellerRefValue object (new).
const ResellerRefContext = createContext<string | ResellerRefValue | null>(null);

export const useResellerRef = (): string | null => {
  const v = useContext(ResellerRefContext);
  if (!v) return null;
  return typeof v === 'string' ? v : v.id;
};

export const useResellerRefValue = (): ResellerRefValue | null => {
  const v = useContext(ResellerRefContext);
  if (!v) return null;
  return typeof v === 'string' ? { id: v } : v;
};

// Returns serial_number (1, 2, 3…) as string for URL building.
// Returns null on custom domains (noUrlPrefix) — the domain itself identifies the reseller.
// Falls back to UUID only if serial_number is not set.
export const useResellerSlug = (): string | null => {
  const v = useContext(ResellerRefContext);
  if (!v) return null;
  const obj = typeof v === 'string' ? { id: v, serialNumber: undefined, noUrlPrefix: false } : v;
  if (obj.noUrlPrefix) return null;
  return obj.serialNumber != null ? String(obj.serialNumber) : obj.id;
};

export default ResellerRefContext;
