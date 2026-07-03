# Custom Domain Module — Phase 4

Allows resellers to connect their own domain (e.g. `shop.rahim.com`) to their BongoBee reseller store, so both the original URL (`bongobee.com/r/<ref>`) and the custom domain work simultaneously.

---

## Files Created

### Backend (Laravel)

| File | Purpose |
|------|---------|
| `database/migrations/2026_06_28_000003_create_reseller_domains_table.php` | Creates `reseller_domains` table |
| `app/Models/ResellerDomain.php` | Eloquent model |
| `app/Http/Controllers/Api/Admin/ResellerDomainController.php` | Admin: list, approve, reject, disable, delete |
| `app/Http/Controllers/Api/Reseller/ResellerDomainController.php` | Reseller self-service: add, remove, DNS verify |
| `app/Http/Middleware/CustomDomainMiddleware.php` | Detects custom domain on incoming request, injects reseller context |

### Frontend (React/TypeScript)

| File | Purpose |
|------|---------|
| `src/stores/useResellerDomainStore.ts` | Zustand store for domain CRUD |
| `src/pages/reseller/ResellerCustomDomain.tsx` | Reseller dashboard page — My Store → Custom Domain |
| `src/pages/admin/ResellerDomains.tsx` | Admin page — view/approve/reject/disable/delete all domains |

---

## Files Modified

| File | Change |
|------|--------|
| `routes/api.php` | Added public domain-lookup endpoint + admin routes + reseller routes |
| `bootstrap/app.php` | Registered `CustomDomainMiddleware` as alias and global web middleware |
| `config/app.php` | Added `custom_domain_cname` and `custom_domain_server_ip` config keys |
| `.env` | Added `CUSTOM_DOMAIN_CNAME` and `CUSTOM_DOMAIN_SERVER_IP` env vars |
| `src/App.tsx` | Added lazy imports + routes for new pages |
| `src/pages/reseller/ResellerLayout.tsx` | Added "My Store" menu item with `Store` icon |
| `src/pages/admin/AdminLayout.tsx` | Added "কাস্টম ডোমেইন" under the Resellers group |

---

## Database Changes

### `reseller_domains` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | `bigint unsigned` AUTO_INCREMENT | Primary key |
| `reseller_id` | `char(36)` | FK → `resellers.id` (UUID), CASCADE DELETE |
| `domain` | `varchar(255)` UNIQUE | e.g. `shop.rahim.com` |
| `is_primary` | `tinyint(1)` DEFAULT `0` | Whether this is the primary custom domain |
| `status` | ENUM `pending\|verified\|failed\|inactive` DEFAULT `pending` | Lifecycle state |
| `ssl_status` | `varchar(255)` DEFAULT `none` | SSL state (architecture only — no Let's Encrypt yet) |
| `verified_at` | `timestamp` NULL | Set when status becomes `verified` |
| `created_at` | `timestamp` NULL | Standard Laravel timestamp |
| `updated_at` | `timestamp` NULL | Standard Laravel timestamp |

---

## API Endpoints

### Public (no auth)

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/api/public/domain-lookup?host={host}` | Returns reseller ref for a verified custom domain host. Used by the SPA on boot when running at a non-primary domain. |

### Reseller (auth: `reseller` guard)

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/api/reseller/custom-domain` | Get this reseller's domain |
| `POST` | `/api/reseller/custom-domain` | Add a domain (`{ domain: "shop.example.com" }`) |
| `DELETE` | `/api/reseller/custom-domain/{id}` | Remove the domain |
| `POST` | `/api/reseller/custom-domain/{id}/verify` | Trigger DNS verification (CNAME + A record check) |

### Admin (auth: `admin` or `employee` guard)

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/api/admin/reseller-domains` | List all domains (paginated, supports `?search=` and `?status=`) |
| `POST` | `/api/admin/reseller-domains/{id}/approve` | Set status → `verified` |
| `POST` | `/api/admin/reseller-domains/{id}/reject` | Set status → `failed` |
| `POST` | `/api/admin/reseller-domains/{id}/disable` | Set status → `inactive` |
| `DELETE` | `/api/admin/reseller-domains/{id}` | Delete the domain record |

---

## Middleware Flow

### `CustomDomainMiddleware`

Runs on every web request (registered as global web middleware in `bootstrap/app.php`).

```
Incoming request
    │
    ├── Is host == app primary domain? → skip, $next($request)
    │
    └── Query reseller_domains WHERE domain = $host AND status = 'verified'
            │
            ├── Not found → $next($request) (SPA loads normally, may show 404)
            │
            └── Found → set request attributes:
                  custom_domain_reseller = Reseller model
                  custom_domain_ref      = serial_number ?? reseller.id
                  Then $next($request)
```

The SPA reads the reseller context via the public `domain-lookup` API endpoint at boot time. When `window.location.hostname` is a registered custom domain, the SPA fetches the reseller ref and navigates internally to `/r/{ref}` (the reseller public storefront), keeping the URL as the custom domain.

---

## DNS Instructions (shown to resellers)

After adding a domain, resellers are shown:

| Type | Host / Name | Value / Target |
|------|-------------|----------------|
| CNAME | `shop` (subdomain part) | `store.bongobee.com` (config-driven) |
| A | `@` | `<server IP>` (config-driven) |

Config values come from `.env`:
```
CUSTOM_DOMAIN_CNAME=store.bongobee.com
CUSTOM_DOMAIN_SERVER_IP=<your server IPv4>
```

In `config/app.php`:
```php
'custom_domain_cname'     => env('CUSTOM_DOMAIN_CNAME', 'store.bongobee.com'),
'custom_domain_server_ip' => env('CUSTOM_DOMAIN_SERVER_IP', ''),
```

---

## Validation Rules

- One domain per reseller (enforced in `ResellerDomainController::store`)
- Domain must match regex `^[a-zA-Z0-9][a-zA-Z0-9\-\.]*\.[a-zA-Z]{2,}$`
- Domain must be globally unique (`unique:reseller_domains,domain`)
- Protocol (`https://`) and trailing slashes are stripped automatically

---

## SSL Architecture

SSL status is tracked in the `ssl_status` column (default: `none`). No certificate issuance is implemented in this phase. Future plan:

1. When admin approves a domain, trigger a Let's Encrypt ACME challenge via `acme.sh` or Certbot on the server
2. On success, update `ssl_status = 'active'` and record the expiry date
3. Set up a cron job to auto-renew 30 days before expiry and update `ssl_status`

Nginx config changes will also be required per domain to serve HTTPS. A separate `ResellerDomainSslCommand` artisan command is planned.

---

## Future: Custom Domain Routing in SPA

For production, when `shop.rahim.com` resolves to the server:

1. **Nginx** must have a wildcard server block (or per-domain blocks) that accepts the custom domain and proxies to the Laravel app
2. **`CustomDomainMiddleware`** detects the host, looks up the reseller, sets request attributes
3. **SPA boot**: `App.tsx` or a `CustomDomainBootstrap` component calls `GET /api/public/domain-lookup?host=shop.rahim.com`, gets the reseller ref, and navigates to `/r/{ref}` while keeping the browser URL as `shop.rahim.com`

This architecture ensures both URLs always serve the same reseller shop without a redirect.
