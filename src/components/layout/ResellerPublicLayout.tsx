import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import ResellerRefContext, { ResellerRefValue } from '@/contexts/ResellerRefContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import WishlistDrawer from '@/components/WishlistDrawer';
import CartDrawer from '@/components/CartDrawer';
import { Outlet } from 'react-router-dom';
import { api } from '@/lib/api';
import { useResellerCodeOverrideStore } from '@/stores/useResellerCodeOverrideStore';

// Apply reseller's tracking codes (GTM / FB Pixel / etc.) on ALL reseller
// public pages — shop, single product, checkout, thank-you — not just the
// single product page. Suppresses admin's main pixels while mounted.
const useResellerCodeInjection = (value: ResellerRefValue | null) => {
  useEffect(() => {
    if (!value) return;
    const h = value.headerCode || '';
    const b = value.bodyCode || '';
    const f = value.footerCode || '';
    // Always set override on reseller pages — even when the reseller has no
    // custom codes — so the admin's site-wide pixels are suppressed.
    // Without this, admin codes would run on every reseller storefront.
    const { setOverride } = useResellerCodeOverrideStore.getState();
    setOverride({ headerCode: h, bodyCode: b, footerCode: f });
    return () => setOverride(null);
  }, [value?.id, value?.headerCode, value?.bodyCode, value?.footerCode]);
};

const STORAGE_KEY = 'reseller_ref';
const CONTACT_KEY = 'reseller_ref_contact';

const ResellerPublicLayout = () => {
  const { resellerId } = useParams(); // serial_number OR id
  const [resolved, setResolved] = useState<ResellerRefValue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!resellerId) { setLoading(false); return; }
    const runFetch = async () => {
      let data: any = null;
      try { data = await api.get(`/public/reseller/${encodeURIComponent(resellerId)}`); } catch { data = null; }
      if (data) {
        const d: any = data;
        const value: ResellerRefValue = {
          id: d.id,
          serialNumber: d.serial_number ?? undefined,
          name: d.name || '',
          contactPhone: d.contact_phone || '',
          contactWhatsapp: d.contact_whatsapp || '',
          headerCode: d.header_code || '',
          bodyCode: d.body_code || '',
          footerCode: d.footer_code || '',
        };
        setResolved(value);
        localStorage.setItem(STORAGE_KEY, d.id);
        localStorage.setItem(CONTACT_KEY, JSON.stringify(value));
      }
      setLoading(false);
    };
    runFetch();
  }, [resellerId]);

  useResellerCodeInjection(resolved);


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <ResellerRefContext.Provider value={resolved}>
      <Header />
      <main className="min-h-screen">
        <Outlet />
      </main>
      <Footer />
      <WishlistDrawer />
      <CartDrawer />
      <ResellerPushMount />
    </ResellerRefContext.Provider>
  );
};

/**
 * Layout for /r/checkout, /r/thank-you, /r/confirm-order
 * Reads reseller ref from localStorage (set when browsing reseller product pages)
 */
export const ResellerCheckoutLayout = () => {
  const [resolved, setResolved] = useState<ResellerRefValue | null>(null);

  useEffect(() => {
    const id = localStorage.getItem(STORAGE_KEY);
    if (!id) return;
    let cached: ResellerRefValue = { id };
    try {
      const raw = localStorage.getItem(CONTACT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.id === id) cached = parsed;
      }
    } catch { /* ignore */ }
    setResolved(cached);
    // Refresh from DB in the background — include tracking codes so reseller's
    // GTM / Pixel codes also fire on checkout and thank-you pages.
    (async () => {
      let data: any = null;
      try { data = await api.get(`/public/reseller/${encodeURIComponent(id)}`); } catch { data = null; }
      if (data && data.id) {
        const d: any = data;
        const value: ResellerRefValue = {
          id: d.id,
          serialNumber: d.serial_number ?? undefined,
          name: d.name || '',
          contactPhone: d.contact_phone || '',
          contactWhatsapp: d.contact_whatsapp || '',
          headerCode: d.header_code || '',
          bodyCode: d.body_code || '',
          footerCode: d.footer_code || '',
        };
        setResolved(value);
        localStorage.setItem(CONTACT_KEY, JSON.stringify(value));
      }
    })();
  }, []);

  useResellerCodeInjection(resolved);


  if (!resolved) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <ResellerRefContext.Provider value={resolved}>
      <Header />
      <main className="min-h-screen">
        <Outlet />
      </main>
      <Footer />
      <WishlistDrawer />
      <CartDrawer />
      <ResellerPushMount />
    </ResellerRefContext.Provider>
  );
};

// Mount push prompt only when admin enables it for reseller pages
import PushNotificationPrompt from '@/components/PushNotificationPrompt';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';
const ResellerPushMount = () => {
  const enabled = useSiteSettingsStore((s) => s.pushPromptResellerEnabled);
  if (!enabled) return null;
  return <PushNotificationPrompt />;
};

export default ResellerPublicLayout;
