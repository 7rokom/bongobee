# BongoBee — Installer Module Documentation

**Version:** 1.0.0  
**Date:** 2026-07-02  
**Supports:** Fresh Install + Restore From Backup  

---

## Overview

The BongoBee Installation Wizard is a browser-based setup tool that deploys the e-commerce platform to shared hosting (cPanel, DirectAdmin, VPS) without SSH access or manual Artisan commands.

---

## Architecture

```
public/install.php          ← Standalone installer (no Laravel dependency)
app/Http/Controllers/InstallerController.php  ← Laravel API complement
app/Http/Middleware/InstallGuard.php          ← Route guard
database/seeders/DefaultSettingsSeeder.php    ← Default data seeder
routes/api.php              ← Modified: added POST /api/install/* routes
routes/web.php              ← Modified: excluded install.php from SPA catch-all
bootstrap/app.php           ← Modified: registered InstallGuard middleware
database/seeders/DatabaseSeeder.php ← Modified: added DefaultSettingsSeeder
```

---

## New Files

### `public/install.php`

Self-contained PHP + HTML + JS. Works before `.env` exists.

- No Laravel dependency
- Handles all installer steps via `?action=` query parameter
- Returns JSON for AJAX calls, HTML for browser requests
- Automatically blocked after installation

**Actions:**
| Action | Method | Description |
|--------|--------|-------------|
| `requirements` | GET | Check PHP version, extensions, permissions |
| `test-db` | POST | Test MySQL connection and create DB if needed |
| `create-env` | POST | Write `.env` file from wizard inputs |
| `run-step` | POST | Execute an artisan step (key, migrate, seed, storage, cache) |
| `upload-backup` | POST | Accept and validate backup file upload |
| `validate-backup` | GET | Re-validate an already-uploaded backup |
| `restore-table` | POST | Restore one table from backup JSON |
| `repair-counters` | POST | Fix order/reseller/digital counters after restore |
| `set-site` | POST | Save site settings to DB via PDO |
| `finalize` | POST | Create `storage/framework/installed` marker |

### `app/Http/Controllers/InstallerController.php`

Laravel-native complement. Only reachable when Laravel can boot (i.e., after `.env` is created by `install.php`).

Routes: `POST /api/install/{requirements,check-db,install,restore,validate-backup}`

### `app/Http/Middleware/InstallGuard.php`

Runs on every request (web + API). Two-way gate:

1. **Not installed:** Allows only `/install.php` and `POST /api/install/*`. Returns HTTP 503 for all other routes.
2. **Already installed:** Blocks `POST /api/install/*` to prevent re-installation.

**Detection logic (priority order):**
1. `storage/framework/installed` file exists → installed
2. `.env` exists AND `APP_KEY` is set → installed (covers existing / dev environments)
3. Neither → not installed, show installer

### `database/seeders/DefaultSettingsSeeder.php`

Seeds all data required for first boot:
- Admin account (from `ADMIN_EMAIL/NAME/PASSWORD` env vars)
- Order/reseller/digital counters (starting at 1000)
- `general` site settings blob
- `fraud_settings` defaults
- `courier_steadfast` / `courier_carrybee` empty configs
- `sms_settings`, `push_settings`, `digital_settings`, `header_footer` defaults

---

## Modified Files

| File | Change |
|------|--------|
| `routes/api.php` | Added `Route::prefix('install')` group with 5 routes |
| `routes/web.php` | Excluded `install\.php` from SPA `{any?}` catch-all regex |
| `bootstrap/app.php` | Registered `InstallGuard` as global web + API middleware; aliased as `install.guard` |
| `database/seeders/DatabaseSeeder.php` | Added `DefaultSettingsSeeder::class` to call list |

---

## Installation Flow

### Fresh Install

```
1. User visits /install.php
2. Step 1 — Welcome: overview displayed
3. Step 2 — Requirements: PHP version, extensions, permissions checked
4. Step 3 — Database: host/port/name/user/pass collected, connection tested
   └── CREATE DATABASE IF NOT EXISTS (auto-creates DB if missing)
5. Step 4 — Mode: user selects "Fresh Install"
   └── Collects: site name, URL, timezone, currency, admin name/email/password
6. Step 5 — Install (sequential AJAX calls):
   ├── create-env      → writes .env with all configuration
   ├── run-step key    → php artisan key:generate --force
   ├── run-step migrate→ php artisan migrate --force (29 migrations)
   ├── run-step seed   → php artisan db:seed --class=AdminSeeder --force
   ├── run-step set-site → PDO INSERT into site_settings
   ├── run-step storage → php artisan storage:link --force
   ├── run-step cache  → optimize:clear + config:cache + route:cache + view:cache
   └── finalize        → creates storage/framework/installed
7. Finish screen shows site URL, admin URL, credentials reminder
```

### Restore From Backup

```
1. Steps 1-3: same as Fresh Install (requirements + DB config)
4. Step 4 — Mode: user selects "Restore From Backup"
   └── Uploads .json or .zip backup file
   └── Backup is validated (version, table count, row count displayed)
   └── Admin fallback credentials collected (in case backup has no admins table)
5. Step 5 — Restore (sequential AJAX calls):
   ├── create-env       → writes .env (admin fields from fallback form)
   ├── run-step key     → php artisan key:generate --force
   ├── run-step migrate → php artisan migrate --force (creates schema)
   ├── restore-table    → (for each table in backup, in registry order):
   │     site_settings, fraud_settings, courier_settings, counters,
   │     categories, variations, products, stock_entries,
   │     blog_posts, landing_pages, coupons, short_links,
   │     employees, employee_activities,
   │     resellers, reseller_payment_methods, reseller_product_prices,
   │     reseller_orders, payment_requests, reseller_domains,
   │     orders, incomplete_orders, follow_up_data,
   │     blocked_customers, expenses, deposits,
   │     courier_dispatch, courier_ratio_cache, youtube_sources,
   │     push_subscriptions, push_campaigns,
   │     sms_campaigns, sms_queue,
   │     digital_categories, digital_products, digital_payment_methods,
   │     digital_customers, digital_orders, digital_blocked_users,
   │     admins
   ├── repair-counters  → fixes order/reseller/digital counters from max IDs
   ├── run-step storage → php artisan storage:link --force
   ├── run-step cache   → optimize + config + route + view cache
   └── finalize         → creates storage/framework/installed
6. Finish screen
```

---

## Backup Format Compatibility

The installer understands the BongoBee backup JSON format:

```json
{
  "version": "2.2",
  "createdAt": "2026-07-01T12:00:00.000Z",
  "siteName": "My Store",
  "counts": { "orders": 1542, "products": 87 },
  "data": {
    "orders": [ { "id": "...", "order_code": "#1001", ... } ],
    "products": [ ... ]
  }
}
```

**Supported versions:** 1.0, 2.0, 2.1, 2.2 (and unknown versions with correct structure)  
**Supported file types:** `.json`, `.zip` (ZIP must contain a `.json` file inside)  
**Max file size:** 200 MB  

**Restore strategies:**
- `replace` — delete all rows, insert backup rows
- `upsert` — merge by conflict key (used for `site_settings`, `counters`, `push_subscriptions`)

**FK handling:** `SET FOREIGN_KEY_CHECKS=0` during restore to avoid FK constraint ordering issues.  
**Special:** `orders.order_code` backfilled from `invoice_number` for legacy rows.

---

## Security

| Measure | Implementation |
|---------|---------------|
| Installer lockout | `storage/framework/installed` marker; installer redirects to `/` after install |
| Existing app bypass | `.env` + `APP_KEY` presence detected as "installed" (protects dev environments) |
| API route lockout | `InstallGuard` returns HTTP 403 for `/api/install/*` after installation |
| File type validation | Upload only accepts `.json` and `.zip` |
| Upload size limit | 200 MB hard limit in `install.php` |
| Path traversal | Table names are never interpolated from user input in restore (taken from backup's own keys, matched against known registry) |
| DB password | Never exposed in API responses; stored only in `.env` (server-side) |
| Temp file cleanup | `storage/framework/bb_backup/` and `bb_installer_data.json` deleted on finalize |
| .env APP_KEY | Generated server-side via `php artisan key:generate --force` |

---

## Production Server Setup

1. Upload all project files (including `public/`) to your server's web root
2. Set document root to the `public/` directory
3. Ensure `storage/` and `bootstrap/cache/` are writable by the web server
4. Visit `https://yourdomain.com/install.php`
5. Follow the wizard

**Required PHP extensions:** `pdo_mysql`, `openssl`, `mbstring`, `fileinfo`, `json`, `curl`, `tokenizer`  
**Optional:** `zip` (for backup ZIP upload)

---

## Maintenance

### Adding new tables to backup restore

Add the table to the `REGISTRY` array in the JS section of `install.php`:

```js
{key:'new_table', strategy:'replace'}
```

Match the key to the `key` field in `backup-registry.ts`.

### Re-running the installer

1. Delete `storage/framework/installed`
2. Also delete or rename `.env` to trigger the "not installed" state
3. Visit `/install.php`

> **Warning:** Re-running Fresh Install will wipe all data.  
> Use Restore Backup to import a previously exported backup.

### Changing the admin password after install

Via the admin panel: Admin → Settings → Credentials  
Or via Artisan: `php artisan tinker` → `Admin::first()->update(['password' => bcrypt('newpass')])`

---

## Supported Backup Versions

| Backup Version | From App Version | Compatible |
|----------------|-----------------|------------|
| 2.2 | Phase 3+ (Laravel) | ✅ Full |
| 2.0–2.1 | Phase 3 early | ✅ Full |
| 1.x | Phase 2 (Supabase era) | ✅ Partial (missing `order_code`, `custom_domain` tables) |
| Unknown | Any | ⚠️ Attempted if structure matches |

---

## Verification Checklist (post-install)

After installation, verify:

- [ ] `/` → main storefront loads
- [ ] `/admin` → admin login page loads
- [ ] Admin login works with provided credentials
- [ ] `GET /api/public/settings` → returns site settings JSON
- [ ] `GET /api/public/products` → returns products
- [ ] `POST /api/install/*` → returns HTTP 403 (installer locked)
- [ ] `/install.php` → redirects to `/` (installer locked)
- [ ] Storage uploads work (Admin → Settings → Audio)
- [ ] Reseller storefront (`/r/{ref}`) loads
- [ ] Digital store loads (if enabled)

---

*End of INSTALLER_MODULE.md*
