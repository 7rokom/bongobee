# Reseller System Fix Report

**Date:** 2026-07-01  
**TypeScript:** 0 errors  
**Files changed:** 13 modified + 1 created

---

## Problems Fixed

### Problem 1 — Product copy link does not work

**Root causes:**
- `ProductCard.tsx` used hardcoded `/product/${slug}` in two `<Link>` components and two `navigate()` calls — these routes don't exist inside `/r/:resellerId`.
- `CartDrawer.tsx` navigate to `/checkout` and `<Link to="/cart">` were also hardcoded.
- `HeroSection.tsx` shop button was hardcoded to `/shop`.
- No index route existed under `/r/:resellerId`, so visiting the storefront homepage 404'd.

**Fix:** Made all navigation components context-aware. When `useResellerRef()` returns a reseller ID, every internal link is prefixed with `/r/${resellerId}`. Added an index route for `/r/:resellerId`.

---

### Problem 2 — Single product page shows "রিসেলার তথ্য লোড হচ্ছে..." and checkout never works

**Root causes:**
1. `CartDrawer.tsx` navigated to `/checkout` (main checkout) instead of `/r/checkout`. `ResellerCheckoutLayout` wraps `/r/checkout` — it reads `localStorage('reseller_ref')` to restore context. Without this, the spinner runs forever.
2. `Checkout.tsx` lines 167–172: when `window.location.pathname.startsWith('/r/')` AND `!resellerRef`, it fires the Bengali loading toast and blocks submission.
3. Even though `ResellerPublicLayout` sets `localStorage('reseller_ref')` on mount, the issue was that `CartDrawer` bypassed the reseller checkout route entirely.

**Fix:** `CartDrawer.tsx` now navigates to `resellerRef ? "/r/checkout" : "/checkout"`. Since `ResellerPublicLayout` already sets `localStorage('reseller_ref')` when the user visits any `/r/:resellerId/*` page, the checkout has the context it needs.

---

### Problem 3 — Custom Domain page returns Unauthenticated

**Root causes:**
1. Admin impersonation via `?as=<resellerId>` in `ResellerLayout.tsx` stores `impersonatedBy: 'admin'` in `localStorage('reseller-auth')` but never stores a `bongobee_reseller_token`. So API calls to `/reseller/custom-domain` sent no `Authorization` header.
2. `/reseller/custom-domain` routes only accepted `auth:reseller` — admin tokens were rejected.
3. `ResellerDomainController::resellerId()` only checked `Auth::guard('reseller')` — it had no mechanism to identify which reseller an admin was managing.
4. `useResellerDomainStore.ts` `fetchDomain()` called `/reseller/custom-domain` with no impersonation context.

**Fix (4 coordinated changes):**

| Layer | Change |
|---|---|
| `src/lib/api.ts` | When reseller scope has no token, fall back to admin token. Enables impersonated calls. |
| `routes/api.php` | Custom domain routes now accept `auth:admin,employee,reseller`. |
| `ResellerDomainController.php` | `resellerId()` checks admin/employee guards and reads `reseller_id` query/body param. |
| `useResellerDomainStore.ts` | All 4 methods read `localStorage('reseller-auth')` and append `?reseller_id=<id>` when impersonating. |

---

### Problem 4 — Default reseller domain (`/r/{id}`) is incomplete

**Root causes:**
- Only 3 child routes existed under `/r/:resellerId`: `product/:slug`, `lp/:slug`, `cart`.
- No homepage (index route), no shop, no blog, no digital shop, no order tracking, no pages.
- All navigation components (Header, Footer, HeroSection, Blog, ProductCard) used hardcoded paths, so clicking any link exited the reseller storefront.

**Fix:** Added 7 new routes and a storefront homepage. Fixed all navigation components to be reseller-aware.

---

## Route Table — Reseller Storefront

All routes are children of `/r/:resellerId` with `ResellerPublicLayout` as the parent.

| URL | Component | Notes |
|---|---|---|
| `/r/:resellerId` | `ResellerStorefrontHome` | NEW — hero + categories + products |
| `/r/:resellerId/shop` | `Shop` | Reused; category filters work via setSearchParams |
| `/r/:resellerId/blog` | `Blog` | Post links now reseller-prefixed |
| `/r/:resellerId/blog/:slug` | `BlogPost` | NEW route |
| `/r/:resellerId/digital-shop` | `DigitalShop` | NEW route |
| `/r/:resellerId/order-tracking` | `OrderTracking` | NEW route |
| `/r/:resellerId/page/:slug` | `PageView` | about-us, contact-us, privacy, terms, etc. |
| `/r/:resellerId/product/:slug` | `Product` | Existed; now navigated correctly |
| `/r/:resellerId/lp/:slug` | `LandingPage` | Existed |
| `/r/:resellerId/cart` | `Cart` | Existed; CartDrawer now links here |
| `/r/checkout` | `Checkout` | Under `ResellerCheckoutLayout` (shared route) |
| `/r/thank-you` | `ThankYou` | Under `ResellerCheckoutLayout` (shared route) |

---

## Files Changed

### Modified

| File | What changed |
|---|---|
| `src/contexts/ResellerRefContext.tsx` | Added `name?: string` to `ResellerRefValue` interface |
| `src/components/layout/ResellerPublicLayout.tsx` | Both layouts include `name: d.name` in resolved context |
| `src/components/ProductCard.tsx` | All links and navigates use reseller-aware `productPath` |
| `src/components/CartDrawer.tsx` | Checkout navigate and cart link are reseller-aware |
| `src/components/HeroSection.tsx` | Shop button is reseller-aware |
| `src/components/layout/Header.tsx` | All nav items, search, logo, login button are reseller-aware via `rp()` helper |
| `src/components/layout/Footer.tsx` | Legal page URLs prefixed with `/r/${resellerId}/page` when in reseller context |
| `src/pages/Blog.tsx` | Post links prefixed with `/r/${resellerId}/blog/` when in reseller context |
| `src/App.tsx` | 7 new child routes under `/r/:resellerId` |
| `src/lib/api.ts` | Admin token fallback when reseller scope has no token |
| `routes/api.php` | Custom domain routes accept `auth:admin,employee,reseller` |
| `app/Http/Controllers/Api/Reseller/ResellerDomainController.php` | `resellerId()` handles admin/employee impersonation |
| `src/stores/useResellerDomainStore.ts` | All 4 store methods pass `reseller_id` when admin is impersonating |

### Created

| File | What it does |
|---|---|
| `src/pages/reseller/storefront/ResellerStorefrontHome.tsx` | Reseller storefront homepage: hero, categories grid, products grid, load-more |

---

## Key Design Decisions

**Reseller context propagation:** `ResellerPublicLayout` fetches `/public/reseller/{ref}` and provides `ResellerRefContext` to all child routes. Components read context via `useResellerRef()` (returns the UUID string) or `useResellerRefValue()` (returns the full object including `name`, `contactPhone`, etc.).

**`rp()` helper in Header:** `(path: string) => resellerRef ? '/r/${resellerRef}${path}' : path`. Keeps nav item definitions clean — one helper prefixes everything when in reseller mode.

**Digital products nav item:** The main site uses `/digital-products` but the reseller storefront uses `/digital-shop` (different route). This case uses an explicit conditional instead of `rp()` to avoid the path mismatch.

**Order tracking active state:** Changed `location.pathname === "/order-tracking"` to `location.pathname.endsWith("/order-tracking")` so the active indicator works for both `/order-tracking` and `/r/:resellerId/order-tracking`.

**Login button:** In reseller context, clicking Login navigates to `/reseller/login` (the reseller portal login page) instead of opening the customer login popup.

**Footer legal pages:** Non-external page URLs get prefixed as `/r/${resellerId}/page${url}`, routing through the `page/:slug` route which renders `PageView`. External URLs (starting with `http`) are left unchanged.

**Storefront home reuses existing components:** `HeroSection`, `ProductCard`, and category links are all the same components as the main homepage — they are now reseller-aware, so they work correctly in both contexts without duplication.

---

## Admin Impersonation Flow (Custom Domain)

1. Admin visits `/reseller/manage/<resellerId>?as=<resellerId>`
2. `ResellerLayout.tsx` reads `?as` param, stores `{ id: resellerId, impersonatedBy: 'admin' }` in `localStorage('reseller-auth')`
3. `useResellerDomainStore.fetchDomain()` calls `getImpersonatedResellerId()` → reads `localStorage('reseller-auth')` → returns `resellerId`
4. Store calls `/api/reseller/custom-domain?reseller_id=<resellerId>`
5. `api.ts` scope = `'reseller'`, no reseller token → falls back to admin token → sends `Authorization: Bearer <adminToken>`
6. `routes/api.php`: middleware `auth:admin,employee,reseller` — admin token accepted
7. `ResellerDomainController::resellerId()`: admin guard matches → reads `reseller_id` query param → returns it
8. Controller queries `ResellerDomain::where('reseller_id', <resellerId>)`

---

## TypeScript

```
tsc --noEmit: No errors
```

---

## Rollback

All changes are contained in the 14 files listed above. To roll back:

1. Revert `routes/api.php` custom domain middleware back to `['auth:reseller']`
2. Revert `ResellerDomainController.php::resellerId()` to use only `Auth::guard('reseller')->id()`
3. Revert `src/lib/api.ts` (remove admin token fallback)
4. Revert `src/stores/useResellerDomainStore.ts` (remove `getImpersonatedResellerId()` and its usages)
5. Revert navigation components (`Header`, `Footer`, `HeroSection`, `Blog`, `ProductCard`, `CartDrawer`) to hardcoded paths
6. Remove the 7 new routes from `src/App.tsx`
7. Delete `src/pages/reseller/storefront/ResellerStorefrontHome.tsx`
