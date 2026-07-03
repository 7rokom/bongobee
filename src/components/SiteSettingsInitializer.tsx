import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSiteSettingsStore } from '@/stores/useSiteSettingsStore';
import { useResellerCodeOverrideStore } from '@/stores/useResellerCodeOverrideStore';
import { isInternalUser } from '@/lib/is-internal-user';

const SiteSettingsInitializer = () => {
  const location = useLocation();
  const { siteName, primaryColor, secondaryColor, faviconUrl, headerCode: adminHeader, bodyCode: adminBody, footerCode: adminFooter, digitalHeaderCode, digitalBodyCode, digitalFooterCode, siteMetaDescription, googleVerificationCode } = useSiteSettingsStore();
  const override = useResellerCodeOverrideStore((s) => s.override);

  // Digital section has its own pixel setup — replace admin pixels on digital routes.
  const isDigitalRoute =
    location.pathname.startsWith('/digital-product') ||
    location.pathname.startsWith('/digital-products') ||
    location.pathname.startsWith('/digital/');

  // Reseller public routes: suppress admin codes immediately (before the reseller
  // API call completes and sets the override), so admin pixels never fire on
  // reseller storefronts — even for the brief loading window.
  const isResellerPublicRoute = location.pathname.startsWith('/r/');

  // When a reseller has their own tracking codes on their product page,
  // fully replace admin pixels with reseller's codes (do not run both).
  const headerCode = (override || isResellerPublicRoute) ? (override?.headerCode ?? '') : (isDigitalRoute ? digitalHeaderCode : adminHeader);
  const bodyCode   = (override || isResellerPublicRoute) ? (override?.bodyCode   ?? '') : (isDigitalRoute ? digitalBodyCode   : adminBody);
  const footerCode = (override || isResellerPublicRoute) ? (override?.footerCode ?? '') : (isDigitalRoute ? digitalFooterCode : adminFooter);

  // Suppress 3rd-party scripts for admin/reseller logged-in users to keep
  // analytics clean — UNLESS a reseller-page override is active, in which
  // case the reseller's own pixels MUST fire (they're for the reseller's
  // own analytics on their public pages).
  const isAdminOrReseller =
    !override && (
      location.pathname.startsWith('/admin') ||
      location.pathname.startsWith('/reseller') ||
      isInternalUser()
    );


  // NOTE: per-page <title> is owned by react-helmet-async via <SEOHead />.
  // Do NOT overwrite document.title here — it would clobber blog/product titles
  // and cause Google to show the sitewide brand title for every page.

  // Persist header/body/footer + Google verification to a static cache that is
  // read synchronously by the inline script in index.html on the next page load.
  // This way, even if the API is slow, Google Search Console / AdSense crawlers
  // still see the verification tag in <head> on first paint.
  useEffect(() => {
    try {
      // Cache both admin and digital codes so the index.html bootstrap can
      // pick the right set on next page load based on the route.
      const cache = {
        headerCode: adminHeader || '',
        bodyCode: adminBody || '',
        footerCode: adminFooter || '',
        digitalHeaderCode: digitalHeaderCode || '',
        digitalBodyCode: digitalBodyCode || '',
        digitalFooterCode: digitalFooterCode || '',
        googleVerificationCode: googleVerificationCode || '',
      };
      localStorage.setItem('static-inject-cache', JSON.stringify(cache));
    } catch {
      /* ignore quota / privacy mode errors */
    }
  }, [adminHeader, adminBody, adminFooter, digitalHeaderCode, digitalBodyCode, digitalFooterCode, googleVerificationCode]);

  // NOTE: per-page <meta name="description"> is owned by react-helmet-async via
  // <SEOHead />. The sitewide fallback lives in index.html. Don't override it
  // here or per-page descriptions will be lost.

  useEffect(() => {
    // Migrate legacy colors to new brand defaults
    const LEGACY_GREEN = '130 100% 28%';
    const LEGACY_ORANGE = '32 100% 55%';
    const effectivePrimary = (primaryColor === LEGACY_GREEN || primaryColor === LEGACY_ORANGE) ? '156 99% 36%' : primaryColor;
    const effectiveSecondary = secondaryColor || '160 53% 35%';
    document.documentElement.style.setProperty('--primary', effectivePrimary);
    document.documentElement.style.setProperty('--ring', effectivePrimary);
    document.documentElement.style.setProperty('--sidebar-primary', effectivePrimary);
    document.documentElement.style.setProperty('--sidebar-ring', effectivePrimary);
    document.documentElement.style.setProperty('--secondary', effectiveSecondary);
  }, [primaryColor, secondaryColor]);

  // Google Search Console verification
  useEffect(() => {
    if (!googleVerificationCode) return;
    let meta = document.querySelector('meta[name="google-site-verification"]') as HTMLMetaElement;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'google-site-verification';
      document.head.appendChild(meta);
    }
    meta.content = googleVerificationCode;
  }, [googleVerificationCode]);

  useEffect(() => {
    if (!faviconUrl) return;
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = faviconUrl;
  }, [faviconUrl]);

  // Helper: remove the static-injected nodes (placed by index.html bootstrap)
  // so React's authoritative version doesn't duplicate scripts/pixels.
  const removeStaticNode = (id: string) => {
    const node = document.getElementById(id);
    if (node?.getAttribute('data-static-inject') === '1') node.remove();
  };
  const removeStaticHeadNodes = () => {
    document.querySelectorAll('[data-static-inject-section="header"]').forEach((node) => node.remove());
  };
  const removeCustomHeadNodes = () => {
    document.querySelectorAll('[data-custom-inject-section="header"]').forEach((node) => node.remove());
  };

  const injectHtml = (parent: HTMLElement, html: string, section?: string) => {
    const template = document.createElement('template');
    template.innerHTML = html;
    Array.from(template.content.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) return;
      if (node.nodeName.toLowerCase() === 'script') {
        const oldScript = node as HTMLScriptElement;
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach((attr) => newScript.setAttribute(attr.name, attr.value));
        newScript.textContent = oldScript.textContent;
        if (section) newScript.setAttribute('data-custom-inject-section', section);
        parent.appendChild(newScript);
        return;
      }
      const nextNode = node.cloneNode(true) as ChildNode;
      if (section && nextNode instanceof HTMLElement) nextNode.setAttribute('data-custom-inject-section', section);
      parent.appendChild(nextNode);
    });
  };

  // Track first injection per section, so the initial paint (where index.html's
  // inline bootstrap already injected the same code synchronously) does NOT
  // re-inject — otherwise Facebook/GTM pixels fire PageView twice.
  const headerInitDone = useRef(false);
  const bodyInitDone = useRef(false);
  const footerInitDone = useRef(false);

  // Force a hard reload when crossing the digital ↔ non-digital boundary.
  // SPA navigation can't undo a Facebook Pixel that was already initialised
  // with a different pixel ID (window.fbq state survives DOM cleanup),
  // so the only safe way to switch pixel sets is a full page load.
  const prevIsDigital = useRef<boolean | null>(null);
  useEffect(() => {
    if (isAdminOrReseller) { prevIsDigital.current = isDigitalRoute; return; }
    if (prevIsDigital.current === null) {
      prevIsDigital.current = isDigitalRoute;
      return;
    }
    if (prevIsDigital.current !== isDigitalRoute) {
      prevIsDigital.current = isDigitalRoute;
      window.location.reload();
    }
  }, [isDigitalRoute, isAdminOrReseller]);

  // Inject header code into <head> — skip on admin/reseller
  useEffect(() => {
    if (!headerInitDone.current) {
      headerInitDone.current = true;
      // Static bootstrap already injected on first paint. Adopt those nodes
      // (rename the marker so removeCustomHeadNodes can clean them up later)
      // and skip re-injection to avoid duplicate pixel events.
      const staticNodes = document.querySelectorAll('[data-static-inject-section="header"]');
      if (staticNodes.length > 0) {
        staticNodes.forEach((n) => {
          n.removeAttribute('data-static-inject-section');
          n.setAttribute('data-custom-inject-section', 'header');
        });
        return;
      }
    }
    removeStaticHeadNodes();
    removeCustomHeadNodes();
    if (!headerCode || isAdminOrReseller) return;
    injectHtml(document.head, headerCode, 'header');
  }, [headerCode, isAdminOrReseller]);

  // Inject body code at start of body — skip on admin/reseller
  useEffect(() => {
    if (!bodyInitDone.current) {
      bodyInitDone.current = true;
      const staticEl = document.getElementById('static-body-code');
      if (staticEl) {
        // Adopt — rename id so future updates target the same node.
        staticEl.id = 'custom-body-code';
        staticEl.removeAttribute('data-static-inject');
        return;
      }
    }
    removeStaticNode('static-body-code');
    const id = 'custom-body-code';
    let el = document.getElementById(id);
    if (!bodyCode || isAdminOrReseller) { el?.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      document.body.insertBefore(el, document.body.firstChild);
    }
    el.innerHTML = bodyCode;
  }, [bodyCode, isAdminOrReseller]);

  // Inject footer code at end of body — skip on admin/reseller
  useEffect(() => {
    if (!footerInitDone.current) {
      footerInitDone.current = true;
      const staticEl = document.getElementById('static-footer-code');
      if (staticEl) {
        staticEl.id = 'custom-footer-code';
        staticEl.removeAttribute('data-static-inject');
        return;
      }
    }
    removeStaticNode('static-footer-code');
    const id = 'custom-footer-code';
    let el = document.getElementById(id);
    if (!footerCode || isAdminOrReseller) { el?.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      document.body.appendChild(el);
    }
    el.innerHTML = footerCode;
    el.querySelectorAll('script').forEach(oldScript => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });
  }, [footerCode, isAdminOrReseller]);

  return null;
};

export default SiteSettingsInitializer;
