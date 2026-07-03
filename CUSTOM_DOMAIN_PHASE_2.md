# Custom Domain Module — Phase 4.1 (Full Functionality)

Makes reseller custom domains fully operational end-to-end: shop, landing pages, checkout, order assignment, commission, tracking, SEO. Both the BongoBee URL and the custom domain serve identical content.

---

## How It Works

### Boot sequence (custom domain visit)

```
Customer opens shop.rahim.com
    │
    ├─ Vite: window.location.hostname !== VITE_APP_DOMAIN  →  ON_CUSTOM_DOMAIN = true
    │
    ├─ App.tsx renders <CustomDomainLayout /> (not the primary route tree)
    │
    ├─ CustomDomainLayout mounts:
    │     GET /api/public/domain-lookup?host=shop.rahim.com
    │     → { reseller: { id, ref, name } }
    │
    ├─ Fetch full reseller details:
    │     GET /api/public/reseller/{ref}
    │     → { id, contact_phone, header_code, body_code, footer_code, … }
    │
    ├─ localStorage.setItem('reseller_ref', resellerId)          ← checkout reads this
    │   localStorage.setItem('reseller_ref_contact', …)          ← checkout layout reads this
    │
    ├─ Provide ResellerRefContext (same context used by Checkout, ProductPage, etc.)
    │
    └─ Render the matched route:
          /              → Shop  (reseller products + prices)
          /product/:slug → ProductPage  (reseller branded)
          /lp/:slug      → LandingPage  (reseller branded)
          /cart          → Cart
          /checkout      → Checkout  (creates reseller order, assigns commission)
          /thank-you     → ThankYou
          /order-tracking → OrderTracking
```

### Checkout flow on custom domain

`Checkout.tsx` reads `resellerRef = useResellerRef()` from context. Because `CustomDomainLayout` provides `ResellerRefContext` with the resolved reseller ID, the checkout behaves exactly like a normal reseller checkout:
- Creates a **reseller order** (not a main order)
- Assigns reseller automatically
- Calculates commission using existing logic
- Navigates to `/r/thank-you` (aliased in `CustomDomainLayout` routes)

No changes to Checkout.tsx were required.

---

## Files Created

| File | Purpose |
|------|---------|
| `src/lib/custom-domain.ts` | `isOnCustomDomain()` — sync hostname check; `canonicalUrl()` helper |
| `src/components/layout/CustomDomainLayout.tsx` | Full layout + nested Routes for custom domain visits |

---

## Files Modified

| File | Change |
|------|--------|
| `.env` | Added `VITE_APP_DOMAIN=bongobee-laravel.test` |
| `src/App.tsx` | Imported `isOnCustomDomain` + `CustomDomainLayout`; added `ON_CUSTOM_DOMAIN` branch |
| `src/pages/reseller/ResellerShop.tsx` | `handleCopyLink` uses custom domain URL when reseller has a verified domain |
| `src/components/SEOHead.tsx` | `DOMAIN` constant is now `window.location.origin` (dynamic) — canonical + OG URL correct on custom domains; fixed typo `bongobe.com` → `bongobee.com` |
| `src/components/layout/ResellerPublicLayout.tsx` | Fixed undefined `error` variable bug (pre-existing, line 54) |

---

## Environment Variables

| Variable | Dev value | Prod value | Purpose |
|----------|-----------|------------|---------|
| `VITE_APP_DOMAIN` | `bongobee-laravel.test` | `bongobee.com` | Primary domain; anything else is treated as a custom domain |
| `CUSTOM_DOMAIN_CNAME` | `store.bongobee.com` | `store.bongobee.com` | Shown in DNS instructions to reseller |
| `CUSTOM_DOMAIN_SERVER_IP` | *(blank)* | `<your server IP>` | Shown in DNS instructions (A record) |

For production, set these in `.env.production` or your deployment env:
```
VITE_APP_DOMAIN=bongobee.com
CUSTOM_DOMAIN_SERVER_IP=1.2.3.4
```

---

## Route Mapping (Custom Domain)

| URL on `shop.rahim.com` | Component | Notes |
|------------------------|-----------|-------|
| `/` | `Shop` | Reseller product list with reseller prices |
| `/product/:slug` | `ProductPage` | Reseller branded product, uses reseller ref for cart |
| `/lp/:slug` | `LandingPage` | Reseller landing page |
| `/cart` | `Cart` | Cart shared with reseller context |
| `/r/cart` | `Cart` | Alias — matches existing internal navigation |
| `/checkout` | `Checkout` | Creates reseller order |
| `/r/checkout` | `Checkout` | Alias |
| `/thank-you` | `ThankYou` | Post-order page |
| `/r/thank-you` | `ThankYou` | Alias — `Checkout.tsx` navigates here when `resellerRef` is set |
| `/order-confirmed` | `FakeThankYou` | |
| `/r/confirm-order` | `FakeThankYou` | Alias |
| `/order-tracking` | `OrderTracking` | Same tracker, reseller-branded header |
| `*` | `NotFound` | |

---

## Product URL Generation (Reseller Dashboard)

`ResellerShop.tsx` — `handleCopyLink` now checks for a verified custom domain:

```typescript
const link = (customDomain && customDomain.status === 'verified')
  ? `https://${customDomain.domain}/product/${slug}`       // custom domain
  : `${window.location.origin}/r/${ref}/product/${slug}`;  // BongoBee URL
```

The domain is fetched on mount via `useResellerDomainStore().fetchDomain()`.

---

## SEO

- **Canonical URL**: `SEOHead.tsx` defaults to `window.location.href`. On `shop.rahim.com/product/watch`, the canonical is `https://shop.rahim.com/product/watch` automatically — no code change needed.
- **OG URL**: Same — uses `window.location.href`.
- **`DOMAIN` export**: Changed from hardcoded `'https://bongobe.com'` to `window.location.origin`. Pages that use `DOMAIN` to build full URLs will now use the correct origin on custom domains.

---

## DNS Verification

Implemented in `ResellerDomainController::verifyDns()`. The "DNS যাচাই করুন" button in the reseller dashboard calls:

```
POST /api/reseller/custom-domain/{id}/verify
```

The backend uses PHP `dns_get_record()` to check:
1. CNAME record pointing to `config('app.custom_domain_cname')`
2. A record pointing to `config('app.custom_domain_server_ip')` (fallback)

---

## Middleware

`CustomDomainMiddleware` runs on every web request. When the host is a verified custom domain, it injects:
- `request->attributes->get('custom_domain_reseller')` — the `Reseller` model
- `request->attributes->get('custom_domain_ref')` — the reseller's serial number or UUID

Controllers can read these attributes for server-side logic (analytics, future SSR).

---

## Verification Checklist

| Check | How to verify |
|-------|---------------|
| ✓ Shop loads | Visit `shop.rahim.com/` → shows reseller's products and prices |
| ✓ Landing page loads | Visit `shop.rahim.com/lp/{slug}` → shows reseller's landing page |
| ✓ Checkout works | Add to cart → checkout → `POST /api/public/checkout-order` with reseller_id |
| ✓ Order belongs to reseller | Check `reseller_orders` table after placing order |
| ✓ Commission correct | Commission = (selling_price − reseller_price) × qty |
| ✓ Order tracking | `shop.rahim.com/order-tracking?phone=…` works |
| ✓ BongoBee URLs unaffected | `bongobee.com/r/{ref}/product/{slug}` still works (primary route tree unchanged) |
| ✓ Admin panel unaffected | `bongobee.com/admin` still works |
| ✓ Reseller dashboard unaffected | `bongobee.com/reseller` still works |

---

## Production Server Setup (Nginx)

To accept custom domain requests, add to your Nginx config:

```nginx
# Wildcard custom domain — accepts all non-primary hosts
server {
    listen 80;
    listen 443 ssl;
    server_name ~^.+$;          # catches all hostnames

    # SSL: use a wildcard cert or per-domain cert (Let's Encrypt)
    # ssl_certificate ...;

    root /var/www/bongobee/public;
    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

The `CustomDomainMiddleware` handles domain-to-reseller mapping inside Laravel. No per-domain Nginx block needed.

---

## Future: SSL Automation

When admin verifies a domain, trigger Let's Encrypt via Certbot:

```bash
certbot certonly --webroot -w /var/www/bongobee/public -d shop.rahim.com
```

Update `ssl_status` in `reseller_domains` after success. Add a cron job to auto-renew and update the DB record.
