/**
 * CustomDomainLayout — renders the full reseller storefront when the SPA
 * is served from a reseller's custom domain (e.g. shop.rahim.com).
 *
 * Boot sequence:
 *   1. Call GET /api/public/domain-lookup?host={hostname}
 *   2. If verified reseller found → fetch full reseller details for tracking codes
 *   3. Set localStorage so checkout can find the reseller (same keys as ResellerPublicLayout)
 *   4. Provide ResellerRefContext to all nested routes
 *   5. Render the same page components as the regular reseller public routes
 *
 * The route tree mirrors the reseller public store (/r/:resellerId/*) but without
 * the reseller ID in the URL — the ID comes from the domain lookup instead.
 *
 * Checkout navigation (/r/thank-you, /r/confirm-order) is aliased here so
 * existing Checkout.tsx navigation paths work unchanged.
 */

import { useEffect, useState, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { api } from '@/lib/api';
import ResellerRefContext, { type ResellerRefValue } from '@/contexts/ResellerRefContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import WishlistDrawer from '@/components/WishlistDrawer';
import CartDrawer from '@/components/CartDrawer';
import { useResellerCodeOverrideStore } from '@/stores/useResellerCodeOverrideStore';
import PushNotificationPrompt from '@/components/PushNotificationPrompt';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';
import DataInitializer from '@/components/DataInitializer';
import DataLayerPageTracker from '@/components/DataLayerPageTracker';
import ScrollToTop from '@/components/ScrollToTop';

// Lazy-load page components (same ones used in the primary routing)
const ResellerHome  = lazy(() => import('@/pages/reseller/storefront/ResellerStorefrontHome'));
const Shop          = lazy(() => import('@/pages/Shop'));
const ProductPage   = lazy(() => import('@/pages/ProductPage'));
const LandingPage   = lazy(() => import('@/pages/LandingPage'));
const Cart          = lazy(() => import('@/pages/Cart'));
const Checkout      = lazy(() => import('@/pages/Checkout'));
const ThankYou      = lazy(() => import('@/pages/ThankYou'));
const FakeThankYou  = lazy(() => import('@/pages/FakeThankYou'));
const OrderTracking = lazy(() => import('@/pages/OrderTracking'));
const Blog          = lazy(() => import('@/pages/Blog'));
const NotFound      = lazy(() => import('@/pages/NotFound'));

// LocalStorage keys — must match ResellerPublicLayout
const STORAGE_KEY = 'reseller_ref';
const CONTACT_KEY = 'reseller_ref_contact';

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
  </div>
);

// Apply reseller tracking codes (GTM / Pixel / etc.) while mounted.
// Always sets override even when reseller has no codes, so admin codes are suppressed.
const useTrackingCodeInjection = (value: ResellerRefValue | null) => {
  useEffect(() => {
    if (!value) return;
    const h = value.headerCode || '';
    const b = value.bodyCode || '';
    const f = value.footerCode || '';
    const { setOverride } = useResellerCodeOverrideStore.getState();
    setOverride({ headerCode: h, bodyCode: b, footerCode: f });
    return () => setOverride(null);
  }, [value?.id, value?.headerCode, value?.bodyCode, value?.footerCode]);
};

// Apply reseller favicon override while on custom domain.
const useFaviconOverride = (faviconUrl?: string) => {
  useEffect(() => {
    if (!faviconUrl) return;
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    const prev = link.href;
    link.href = faviconUrl;
    return () => { if (link) link.href = prev; };
  }, [faviconUrl]);
};

// Convert a hex color (#rrggbb) to the "H S% L%" string the theme expects.
function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Override the CSS --primary variable with the reseller's brand color.
const usePrimaryColorOverride = (hex?: string) => {
  useEffect(() => {
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    const hsl = hexToHsl(hex);
    document.documentElement.style.setProperty('--primary', hsl);
    return () => document.documentElement.style.removeProperty('--primary');
  }, [hex]);
};

// Set document title to the reseller's store name.
const useStoreTitleOverride = (storeName?: string) => {
  useEffect(() => {
    if (!storeName) return;
    const prev = document.title;
    document.title = storeName;
    return () => { document.title = prev; };
  }, [storeName]);
};

// Shared page wrapper — header + main + footer + drawers
const PageShell = ({ children }: { children: React.ReactNode }) => {
  const pushEnabled = useSiteSettingsStore((s) => s.pushPromptResellerEnabled);
  return (
    <>
      <Header />
      <main className="min-h-screen">
        <Suspense fallback={<Spinner />}>{children}</Suspense>
      </main>
      <Footer />
      <WishlistDrawer />
      <CartDrawer />
      {pushEnabled && <PushNotificationPrompt />}
    </>
  );
};

const CustomDomainLayout = () => {
  const [resolved, setResolved] = useState<ResellerRefValue | null>(null);
  const [status, setStatus]     = useState<'loading' | 'ok' | 'not-found'>('loading');

  useEffect(() => {
    const host = window.location.hostname;

    api.get(`/public/domain-lookup?host=${encodeURIComponent(host)}`)
      .then(async (data: any) => {
        if (!data?.reseller) { setStatus('not-found'); return; }

        const r = data.reseller;
        // Fetch full reseller details (tracking codes, contact info, storefront branding)
        let detail: any = null;
        try {
          detail = await api.get(`/public/reseller/${encodeURIComponent(r.ref ?? r.id)}`);
        } catch {
          // Fall back to minimal data from domain-lookup
          detail = { id: r.id, contact_phone: '', contact_whatsapp: '', header_code: '', body_code: '', footer_code: '' };
        }

        const value: ResellerRefValue = {
          id:             detail.id,
          serialNumber:   detail.serial_number    ?? undefined,
          contactPhone:   detail.contact_phone    || '',
          contactWhatsapp:detail.contact_whatsapp || '',
          headerCode:     detail.header_code      || '',
          bodyCode:       detail.body_code        || '',
          footerCode:     detail.footer_code      || '',
          noUrlPrefix:    true,
          branding: {
            logoUrl:      detail.storefront_logo_url     || undefined,
            faviconUrl:   detail.storefront_favicon_url  || undefined,
            bio:          detail.storefront_bio          || undefined,
            address:      detail.storefront_address      || undefined,
            phone:        detail.storefront_phone        || undefined,
            footerCredit: detail.storefront_footer_credit || undefined,
            legalPages:   detail.storefront_legal_pages  || undefined,
            facebookUrl:  detail.storefront_facebook_url || undefined,
            youtubeUrl:   detail.storefront_youtube_url  || undefined,
            twitterUrl:   detail.storefront_twitter_url  || undefined,
            instagramUrl: detail.storefront_instagram_url || undefined,
            storeName:     detail.storefront_name          || undefined,
            primaryColor:  detail.storefront_primary_color || undefined,
            heroTitle:     detail.storefront_hero_title    || undefined,
            heroSubtitle:  detail.storefront_hero_subtitle || undefined,
            heroImage:     detail.storefront_hero_image    || undefined,
          },
        };

        // Set localStorage so Checkout + ResellerCheckoutLayout can find the reseller
        localStorage.setItem(STORAGE_KEY, detail.id);
        localStorage.setItem(CONTACT_KEY, JSON.stringify(value));

        setResolved(value);
        setStatus('ok');
      })
      .catch(() => setStatus('not-found'));
  }, []);

  useTrackingCodeInjection(resolved);
  useFaviconOverride(resolved?.branding?.faviconUrl);
  usePrimaryColorOverride(resolved?.branding?.primaryColor);
  useStoreTitleOverride(resolved?.branding?.storeName);

  if (status === 'loading') return (
    <>
      <DataInitializer />
      <Spinner />
    </>
  );

  if (status === 'not-found') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center p-8">
        <h1 className="text-3xl font-bold">Store Not Found</h1>
        <p className="text-muted-foreground max-w-sm">
          This domain is not connected to any BongoBee reseller store, or the domain has not been verified yet.
        </p>
      </div>
    );
  }

  // All routes share the same ResellerRefContext so every page component
  // (ProductPage, LandingPage, Checkout, …) reads the reseller automatically.
  return (
    <ResellerRefContext.Provider value={resolved}>
      <DataInitializer />
      <DataLayerPageTracker />
      <ScrollToTop />
      <Routes>
        {/* Homepage with hero, categories and all products */}
        <Route path="/"               element={<PageShell><ResellerHome /></PageShell>} />
        {/* Shop with full category sidebar */}
        <Route path="/shop"           element={<PageShell><Shop /></PageShell>} />
        <Route path="/blog"           element={<PageShell><Blog /></PageShell>} />
        <Route path="/product/:slug"  element={<PageShell><ProductPage /></PageShell>} />
        <Route path="/lp/:slug"            element={<PageShell><LandingPage /></PageShell>} />
        {/* alias: full-domain links may include the /r/:id/ prefix — accept and ignore the id */}
        <Route path="/r/:resellerId/lp/:slug" element={<PageShell><LandingPage /></PageShell>} />

        {/* Cart & Checkout — also accept /r/* aliases because Checkout.tsx navigates
            to /r/thank-you and /r/confirm-order when resellerRef is set */}
        <Route path="/cart"            element={<PageShell><Cart /></PageShell>} />
        <Route path="/r/cart"          element={<PageShell><Cart /></PageShell>} />
        <Route path="/checkout"        element={<PageShell><Checkout /></PageShell>} />
        <Route path="/r/checkout"      element={<PageShell><Checkout /></PageShell>} />

        {/* Post-order pages */}
        <Route path="/thank-you"       element={<PageShell><ThankYou /></PageShell>} />
        <Route path="/r/thank-you"     element={<PageShell><ThankYou /></PageShell>} />
        <Route path="/order-confirmed" element={<PageShell><FakeThankYou /></PageShell>} />
        <Route path="/r/confirm-order" element={<PageShell><FakeThankYou /></PageShell>} />

        {/* Order tracking */}
        <Route path="/order-tracking"  element={<PageShell><OrderTracking /></PageShell>} />

        <Route path="*"                element={<PageShell><NotFound /></PageShell>} />
      </Routes>
    </ResellerRefContext.Provider>
  );
};

export default CustomDomainLayout;
