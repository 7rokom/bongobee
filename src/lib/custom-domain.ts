// Detect whether the SPA is running at a custom reseller domain.
// In dev:  VITE_APP_DOMAIN=bongobee-laravel.test  (set in .env)
// In prod: VITE_APP_DOMAIN=bongobee.com            (set in .env.production)
//
// Any hostname that is NOT the primary domain, localhost, or 127.0.0.1
// is treated as a reseller custom domain. The CustomDomainLayout will
// then call /api/public/domain-lookup to verify and resolve the reseller.

const PRIMARY = (import.meta.env.VITE_APP_DOMAIN as string | undefined) ?? '';

export function isOnCustomDomain(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return false;
  if (!PRIMARY) return false;
  return h !== PRIMARY;
}

// Returns the canonical base URL for a given path on the current domain.
// On a custom domain: https://shop.rahim.com/product/watch
// On primary domain: https://bongobee.com/product/watch (uses window.location)
export function canonicalUrl(path = ''): string {
  return `${window.location.origin}${path.startsWith('/') ? path : '/' + path}`;
}
