# BongoBee — Known Issues & Roadmap

> **Scope:** This document covers the state of the project as of 2026-06-28, after the
> Phase 3 Supabase→Laravel migration is complete. All items below are observations from
> reading the live code. No application code was changed to produce this document.
>
> **Legend:** 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low · ✅ Informational

---

## Table of Contents

1. [Known Bugs](#1-known-bugs)
2. [Code TODOs](#2-code-todos)
3. [Endpoints Needing Improvement](#3-endpoints-needing-improvement)
4. [Security Improvements](#4-security-improvements)
5. [Performance Improvements](#5-performance-improvements)
6. [Database Improvements](#6-database-improvements)
7. [Code Quality Improvements](#7-code-quality-improvements)
8. [UX Improvements](#8-ux-improvements)
9. [Production Deployment Checklist](#9-production-deployment-checklist)
10. [Backup Strategy](#10-backup-strategy)
11. [Monitoring Recommendations](#11-monitoring-recommendations)
12. [Logging Recommendations](#12-logging-recommendations)
13. [Recommended Caching](#13-recommended-caching)
14. [Future Feature Ideas](#14-future-feature-ideas)
15. [Planned Features (detailed)](#15-planned-features-detailed)

---

## 1. Known Bugs

### BUG-01 🔴 `/admin/dashboard` returns HTTP 500 under MySQL `ONLY_FULL_GROUP_BY`

**File:** `app/Http/Controllers/Api/Admin/DashboardController.php:49`

The `revenue_trend` query uses:
```php
->selectRaw('DATE(created_at) as date, SUM(...) as revenue, COUNT(*) as orders')
->groupBy('date')
```
`groupBy('date')` references the alias `date`, which MySQL rejects in strict
`ONLY_FULL_GROUP_BY` mode (the default in MySQL 5.7.5+). The endpoint returns HTTP 500
on a standard Laragon/MySQL setup.

**Impact:** The React admin Dashboard page does not call this endpoint directly, so it is
not currently user-visible. However it blocks any admin tool that reads dashboard stats.

**Fix:** Change `->groupBy('date')` to `->groupBy(DB::raw('DATE(created_at)'))`.

---

### BUG-02 🔴 Duplicate route — `POST /api/public/incomplete-orders` registered twice

**File:** `routes/api.php:50` and `routes/api.php:60`

```php
Route::post('/incomplete-orders', [CheckoutController::class, 'saveIncompleteOrder']); // line 50
// ...
Route::post('/incomplete-orders', [FrontendDataController::class, 'storeIncompleteOrder']); // line 60
```

Laravel registers both; the **second registration wins**. `CheckoutController::saveIncompleteOrder()`
is therefore dead code — it is never reached. Any validation logic in that method (fraud
check, different field mapping) is silently bypassed.

**Fix:** Remove the duplicate. Decide which handler owns the public incomplete-order write
and delete the other route declaration.

---

### BUG-03 🟠 Order number padding overflows at 100 orders

**File:** `app/Http/Controllers/Api/Admin/FrontendOrderController.php:194`

```php
return '#' . str_pad((string) $value, 2, '0', STR_PAD_LEFT);
```

`str_pad(..., 2, ...)` means:
- Orders 1–9 → `#01`–`#09` ✅
- Orders 10–99 → `#10`–`#99` ✅
- Order 100 → `#100` (3 chars — padding is a minimum, not a fixed width)
- Order 1000 → `#1000`

The format string changes length at 100 orders and again at 1000. Downstream effects:
order code sorting becomes lexicographic rather than numeric (`#100` sorts before `#99`),
and SMS/tracking messages may look inconsistent.

Same issue applies to reseller orders:
`FrontendResellerController.php:112` → `RO` + `str_pad(2)` overflows at RO100.

Digital orders use `str_pad(3)` → `DO001`–`DO999` are clean but overflow at 1000.

**Fix:** See [Planned Feature — Fix Order Number Limit](#pf-01-fix-order-number-limit).

---

### BUG-04 🟠 Order tracking page cannot find Phase-3 orders

**File:** `app/Http/Controllers/Api/Public/CheckoutController.php:114`

```php
$order = Order::where('customer_phone', $request->phone)
    ->where('invoice_number', $request->invoice)
    ->first();
```

Phase-3 storefront orders use `order_code` (`#NN`) as their identifier, not
`invoice_number` (legacy `bigint`). Customer-facing order tracking passes `#NN` as the
invoice value but the query looks in the wrong column — it will never match.

**Fix:** Extend the query: `->where(fn($q) => $q->where('invoice_number', ...) ->orWhere('order_code', ...))`.

---

### BUG-05 🟠 Push notification HTTP fallback is broken

**File:** `app/Services/PushNotificationService.php:72`

```php
Http::withHeaders([
    'Authorization' => 'key=' . $this->vapidPublic, // FCM format, not VAPID
])->post($endpoint, ['message' => $payload]);
```

Web Push Protocol requires a JWT-signed VAPID Authorization header
(`vapid t=<JWT>,k=<public key>`). The `key=` format is FCM legacy HTTP, which modern
browsers reject entirely for web push endpoints. The HTTP fallback silently fails for
every subscriber when the `minishlink/web-push` library is not installed.

**Fix:** Either remove the HTTP fallback (make the library a hard dependency via Composer)
or implement proper VAPID JWT signing in the fallback path.

---

### BUG-06 🟡 `SmsService::queueForCampaign()` uses unqualified `\DB::` facade

**File:** `app/Services/SmsService.php:57`

```php
\DB::table('sms_queue')->insert($rows);
```

Uses the global root-namespace alias rather than the imported facade. This works at
runtime because the `DB` alias is registered globally in `config/app.php`, but the
inconsistency means static analysis tools (PHPStan, IDE) cannot resolve the type.

**Fix:** Add `use Illuminate\Support\Facades\DB;` at the top of `SmsService.php`.

---

### BUG-07 🟡 `customerList()` search OR clause escapes GROUP BY context

**File:** `app/Http/Controllers/Api/Admin/FraudController.php:147`

```php
$query->where('customer_phone', 'like', '%'.$request->search.'%')
      ->orWhere('customer_name', 'like', '%'.$request->search.'%');
```

On a grouped query (`GROUP BY customer_phone, customer_name`), the top-level `orWhere`
is not wrapped in a closure, so it applies outside the group. MySQL `ONLY_FULL_GROUP_BY`
may reject this query or return unexpected results.

**Fix:** Wrap in a closure: `->where(fn($q) => $q->where('customer_phone', ...) ->orWhere('customer_name', ...))`.

---

### BUG-08 🟡 `BackupController::cloudBackup()` defaults to hardcoded Supabase URL

**File:** `app/Http/Controllers/Api/Admin/BackupController.php:133`

```php
$url = env('CLOUD_BACKUP_URL', 'https://qsaqyoyyganjzezmfqod.supabase.co/functions/v1/auto-backup');
$key = env('CLOUD_BACKUP_KEY', 'sb_publishable_OoLb-i8gUZgQIHwyUZdiZQ_0dhvezQW');
```

If `CLOUD_BACKUP_URL` and `CLOUD_BACKUP_KEY` are not set in `.env`, every cloud backup
silently uploads the entire database to an external Supabase project with a public
publishable key embedded in source code. This is both a data-privacy risk and a supply
chain risk (the external endpoint is not under BongoBee's control).

**Fix:** Remove the hardcoded defaults. If the env vars are absent, return an error
instead of falling through to the external endpoint.

---

## 2. Code TODOs

| # | File | Line | TODO |
|---|------|------|------|
| T-01 | `app/Http/Controllers/Api/Admin/MarketingController.php` | 119 | `// TODO: dispatch SendPushNotificationJob` — Push campaign creation creates the DB record but never dispatches. Push notifications from `MarketingController::createPushCampaign()` are silently no-ops. |
| T-02 | `app/Http/Controllers/Api/Admin/FrontendMarketingController.php` | 182 | YouTube sync returns `{synced: 0, created: 0, message: 'Sync queued'}` even with `YOUTUBE_API_KEY` configured. The comment says "a scheduled job performs the heavy sync" but no such job exists. |
| T-03 | `app/Services/PushNotificationService.php` | 52 | `// Uses web-push-php library if available, otherwise basic HTTP` — the library path is conditional; see BUG-05. |
| T-04 | `app/Http/Controllers/Api/Admin/BackupController.php` | 133 | Cloud backup URL defaults to external Supabase — see BUG-08. |
| T-05 | `database/migrations/2024_01_02_000009_*` | — | Two migration files share the same timestamp prefix `000009`: `align_account_tables` and `align_reseller_to_frontend`. One of them needs to be renumbered. |

---

## 3. Endpoints Needing Improvement

### EP-01 🟠 `GET /admin/fe-orders` — no pagination

**Controller:** `FrontendOrderController::index()`

Returns all orders in a single response. With thousands of orders this will cause
slowdowns and memory spikes. The frontend currently loads all orders at startup and
filters client-side.

**Improvement:** Add `paginate(100)` with a `?per_page` override. The frontend store
needs a corresponding update to load incrementally (or prefetch all, depending on UX
requirements).

---

### EP-02 🟠 `GET /rs/reseller-orders` — no pagination

**Controller:** `FrontendResellerController::orders()`

Same issue as EP-01. All reseller orders returned at once. Reseller panels can
accumulate thousands of rows quickly.

---

### EP-03 🟡 `GET /admin/data/follow-ups` — no pagination

**Controller:** `FrontendDataController::followUps()`

`FollowUpData::get()` returns every follow-up row. There is one row per order, so this
grows proportionally with total orders.

---

### EP-04 🟡 `POST /admin/courier/steadfast` — no action for status_by_tracking_id

**Controller:** `FrontendCourierController::steadfast()`

The Steadfast API also supports `status_by_tracking_id` (by tracking/consignment ID),
but only `status_by_cid` is implemented. The tracking link feature (Planned Feature
PF-03) will need this action.

---

### EP-05 🟡 `POST /admin/data/cloud-backup` — large payload, no timeout guard

**Controller:** `BackupController::cloudBackup()`

The entire database JSON is POSTed through this endpoint. For large sites this payload
can exceed 10–50 MB. PHP's `max_input_vars`, `post_max_size`, and `memory_limit` must
all be large enough, and the 120-second `Http::timeout(120)` may still expire on a slow
connection.

**Improvement:** Stream the backup in chunks, or compress it server-side before
forwarding.

---

### EP-06 🟡 `POST /admin/data/backup-table` — no row limit

**Controller:** `BackupController::backupTable()`

`DB::table($table)->get()` returns all rows for large tables (orders, incomplete_orders,
sms_queue) in a single PHP array. For a table with 50,000 rows this can allocate several
hundred MB.

**Improvement:** Add `->chunk(500)` streaming or accept a `?limit=` / `?offset=`
parameter.

---

### EP-07 🟢 `GET /public/fraud-settings` — exposes internal fraud config publicly

**File:** `routes/api.php:54`

The full fraud settings blob (minimum delivery percentage, API keys for BDCourier, feature
flags) is readable by anyone without authentication. This tells a determined fraudster
exactly what thresholds they need to stay under.

**Improvement:** Return only the fields the storefront actually needs (e.g.,
`cooldown_minutes`, `block_enabled` booleans) from a separate slimmed endpoint.

---

## 4. Security Improvements

### SEC-01 🔴 SMS gateway routes are unauthenticated

**File:** `routes/api.php:348–351`

```php
Route::prefix('sms-gateway')->group(function () {
    Route::get('/pending', ...);  // lists undelivered SMS messages
    Route::post('/report', ...);  // marks any SMS as sent/failed
});
```

These routes have **no authentication middleware**. Anyone who discovers the URL can read
pending phone numbers and mark messages as sent without them being delivered, silently
sabotaging the SMS campaign system.

**Fix:** Add a shared secret header check (`X-Gateway-Key`) or move under admin middleware.

---

### SEC-02 🔴 `APP_DEBUG=true` in production `.env`

**File:** `.env:4`

`APP_DEBUG=true` is currently set. On production this exposes full stack traces (including
file paths, SQL queries, and config values) in every API error response.

**Fix:** Set `APP_DEBUG=false` and `APP_ENV=production` before going live.

---

### SEC-03 🟠 Audio file upload accepts any MIME type

**File:** `app/Http/Controllers/Api/Admin/FrontendDataController.php:250`

```php
$request->validate(['file' => 'required|file|max:20480']);
```

No MIME type restriction. An attacker with admin access could upload a `.php` file into
`storage/app/public/audio/` and, if the web server serves PHP from `storage/`, execute
arbitrary code.

**Fix:** Add `|mimes:mp3,wav,ogg,aac,m4a` to the validation rule and ensure the web
server does not execute scripts from the `storage/` directory.

---

### SEC-04 🟠 `audioDelete()` accepts user-supplied path without directory-traversal check

**File:** `app/Http/Controllers/Api/Admin/FrontendDataController.php:255`

```php
Storage::disk('public')->delete($request->input('path'));
```

The `path` value comes directly from the request body. A crafted path such as
`../../.env` (relative to the public disk root) could delete files outside the intended
`audio/` directory.

**Fix:** Validate that the resolved path starts with `audio/`:
```php
$path = $request->input('path');
if (!str_starts_with($path, 'audio/')) abort(422, 'Invalid path.');
```

---

### SEC-05 🟠 No rate limiting on public fraud/checkout endpoints

The following public endpoints have no throttle middleware and accept arbitrary payloads:

- `POST /api/public/check-blocked`
- `POST /api/public/order-cooldown`
- `POST /api/public/device-check`
- `POST /api/public/courier-check`
- `POST /api/public/coupon/validate`
- `POST /api/public/orders`

A bot can enumerate phone numbers, IP addresses, and device fingerprints against the
blocked list at will, or flood the checkout endpoint.

**Fix:** Add `->middleware('throttle:30,1')` (30 requests/minute) to the public fraud
routes, and `throttle:10,1` to `/public/orders`.

---

### SEC-06 🟠 `saveCourierRatio` (POST) is publicly writable

**File:** `routes/api.php:57`

```php
Route::post('/courier-ratio', [FrontendDataController::class, 'saveCourierRatio']);
```

This endpoint writes to the `courier_ratio_cache` table — the data used by the fraud
system's delivery-ratio check. An unauthenticated actor can write arbitrary ratio data
for any phone number, making legitimate customers appear fraudulent (or fraudulent ones
appear safe).

**Fix:** Move this route behind admin or employee auth middleware.

---

### SEC-07 🟡 `SiteSetting` endpoints accept `$request->all()` without validation

Multiple settings endpoints blindly store whatever JSON the admin sends:

- `SettingsController::updateGeneral()` — `SiteSetting::set('general', $request->all())`
- `SettingsController::updateHeaderFooter()`
- `FraudController::updateFraudSettings()`
- `FrontendDataController::saveCourierSettings()`

If admin credentials are ever compromised, an attacker can store arbitrary values (e.g.,
`<script>` in a site name) that will be rendered in the storefront without escaping.

**Fix:** Add `$request->validate([...])` with explicit field lists before storing.

---

### SEC-08 🟡 Admin password minimum length is 6 characters

**File:** `app/Http/Controllers/Api/Admin/SettingsController.php:19`

```php
$data = $request->validate(['email' => 'required|email', 'password' => 'required|string|min:6']);
```

6-character passwords are easily brute-forced.

**Fix:** Increase to `min:12` and add `confirmed` rule.

---

### SEC-09 🟡 Stale Supabase credentials remain in `.env`

**File:** `.env:59–60`

```
VITE_SUPABASE_URL="https://dlmrzkcuehhscqepxwjx.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI..."
```

These are now unused in frontend code (migration complete). However, the publishable key
for the old Supabase project is still in the repository's env file. If this file is ever
committed to version control, the key is exposed.

**Fix:** Remove both lines from `.env` and add a comment to `.env.example` that these
are no longer needed.

---

### SEC-10 🟡 CORS configuration not reviewed

The default Laravel CORS config (`config/cors.php`) likely allows all origins
(`'allowed_origins' => ['*']`). For a production e-commerce backend, CORS should be
restricted to the actual domain(s) where the React app is hosted.

**Fix:** Set `allowed_origins` to the production domain (e.g., `['https://bongobee.com']`).

---

## 5. Performance Improvements

### PERF-01 🟠 `SiteSetting::find($key)` — no caching, hits DB every call

**File:** `app/Models/SiteSetting.php`

`SiteSetting::get('general', [])` is called on nearly every page load (public shop
settings, fraud settings, site config). Each call issues a `SELECT` against `site_settings`.
On a busy storefront this adds 5–10 extra queries per request.

**Fix:** Wrap in Laravel's cache:
```php
public static function get(string $key, mixed $default = null): mixed {
    return Cache::remember("site_setting:$key", 300, function () use ($key, $default) {
        $row = static::find($key);
        return $row ? $row->value : $default;
    });
}
```
Invalidate the cache key in `SiteSetting::set()`.

---

### PERF-02 🟠 `PushSubscription::all()` in `sendToAll()` loads all subscribers into memory

**File:** `app/Services/PushNotificationService.php:21`

With 10,000 subscribers, `PushSubscription::all()` allocates 10K model objects in PHP
memory and then iterates one by one. Each push request is a separate HTTP call, making
this O(n) in wall time too.

**Fix:** Use `PushSubscription::cursor()` + batch the HTTP requests in parallel (Guzzle
pool), or use a proper queued job per subscriber batch.

---

### PERF-03 🟠 No pagination on order indexes — risk of memory spike

`FrontendOrderController::index()`, `FrontendResellerController::orders()`, and
`FrontendDataController::followUps()` each load their entire tables. On a store with
10,000+ orders this risks hitting PHP memory limits.

**Fix:** See EP-01, EP-02, EP-03.

---

### PERF-04 🟡 `Schema::getColumnListing($table)` called per-request in restore

**File:** `app/Http/Controllers/Api/Admin/BackupController.php:51`

`Schema::getColumnListing()` queries `information_schema` on every restore call. For a
full restore (30 tables × multiple chunks), this is 30+ information_schema queries.

**Fix:** Cache the column listing per table for the duration of the restore operation
(already in-request, but extract to a local variable before the loop).

---

### PERF-05 🟡 `CACHE_DRIVER=file` and `QUEUE_CONNECTION=database` — suboptimal for production

**File:** `.env:19–21`

File-based cache and database-based queue are fine for development but have known
scaling limits:
- File cache does not support cache tagging, is slow under concurrent writes.
- Database queue requires polling and adds DB load.

**Fix for production:** Use Redis (`CACHE_DRIVER=redis`, `QUEUE_CONNECTION=redis`). A
single Redis instance on the same server costs almost nothing and removes the bottleneck.

---

### PERF-06 🟢 Missing composite index on `orders(phone, created_at)`

`FraudController::orderCooldown()` queries:
```sql
WHERE created_at >= ? AND (phone = ? OR customer_ip = ? OR customer_fingerprint = ?)
```

The current indexes (`customer_phone`, `status`, `created_at`) are individual; none
covers the combined cooldown query efficiently.

**Fix:** Add a composite index:
```php
$table->index(['phone', 'created_at']);
$table->index(['customer_ip', 'created_at']);
$table->index(['customer_fingerprint', 'created_at']);
```

---

## 6. Database Improvements

### DB-01 🔴 Two migrations share the same timestamp `000009`

**Files:**
- `database/migrations/2024_01_02_000009_align_account_tables.php`
- `database/migrations/2024_01_02_000009_align_reseller_to_frontend.php`

Laravel identifies migrations by filename. On a fresh `php artisan migrate`, the ordering
between same-named migrations depends on filesystem sort order (OS-specific). One of them
will always appear to have already run when the other is next. This is a latent bug that
will surface the first time the application is deployed to a new server.

**Fix:** Rename one of them (e.g., change `000009` to `000009b` or renumber to `000010`).

---

### DB-02 🟠 `orders` table has redundant column pairs

The `orders` table contains both legacy columns and Phase-3 frontend columns that store
the same data in two places:

| Legacy | Phase-3 |
|--------|---------|
| `customer_name` | `customer` |
| `customer_phone` | `phone` |
| `customer_address` | `address` |
| `total_amount` | `total` |

`FrontendOrderController` mirrors values into both on every write, but queries may search
only one side, leading to inconsistency.

**Fix (long-term):** Migrate all references to the Phase-3 columns and drop the legacy
columns. Or add a DB trigger/generated column to keep them in sync automatically.

---

### DB-03 🟡 `StockEntry` has no foreign key to `products`

**File:** `app/Models/StockEntry.php`

Stock entries track purchases by `product_name` (a plain string), not a `product_id`
foreign key. This means:
- Renaming a product does not update stock entries.
- There is no way to calculate "units sold" or remaining inventory from the DB.
- The "Stock Calculation Fix" planned feature cannot be implemented without this link.

**Fix:** Add `product_id uuid nullable references products(id)` to `stock_entries`.

---

### DB-04 🟡 No soft deletes on critical models

Orders, Products, Resellers, Customers, and Categories use hard delete (`delete()`).
There is no `deleted_at` audit trail.

**Fix:** Add `SoftDeletes` to at least `Order`, `Product`, `Reseller`, and
`BlockedCustomer`.

---

### DB-05 🟡 `fraud_settings` table is a separate single-row table alongside `site_settings`

There are now two configuration stores: `fraud_settings` (a dedicated single-row table
created in migration `2024_01_01_000002`) and `site_settings` (the generic key-value
blob store). Fraud settings are read from both — `FraudController` uses the dedicated
table via `SiteSetting::get('fraud_settings', [])` (blob store), while the migration
created `fraud_settings` as a separate table that is now unused.

**Fix:** Confirm which table is live; drop the orphaned one; consolidate.

---

### DB-06 🟢 No full-text index on `products(title, name)` for search

`ShopController::products()` uses `LIKE '%keyword%'` for product search. On large
catalogs this performs a full table scan.

**Fix:** Add a MySQL `FULLTEXT` index on `(name, title, description)` and use
`MATCH(...) AGAINST(?)` instead of `LIKE`.

---

## 7. Code Quality Improvements

### CQ-01 🟡 No Form Request classes — all validation is inline

Every controller validates inline with `$request->validate([...])`. For complex payloads
(orders, reseller orders, digital orders) this makes controllers verbose and validation
logic untestable in isolation.

**Recommendation:** Extract high-complexity validations into dedicated Form Request classes
(`php artisan make:request PlaceOrderRequest`).

---

### CQ-02 🟡 Duplicate route for `/public/incomplete-orders`

See BUG-02. Also a code-quality issue — dead code that creates confusion.

---

### CQ-03 🟡 Duplicate employee routes under two prefixes

Employees are exposed under both:
- `GET /api/admin/employees` → `EmployeeController::index()`
- `GET /api/admin/data/employees` → `FrontendDataController::employees()`

Both hit the same `Employee` model. Any logic change must be applied twice.

**Fix:** Have the Phase-1 `EmployeeController` delegate to `FrontendDataController`, or
remove the Phase-1 route if it is no longer consumed.

---

### CQ-04 🟡 No PHP unit or feature tests

The project has no test suite. Regressions are detected only in the browser. Critical
paths (order creation, fraud check, coupon validation, auth) should have at minimum
feature tests.

---

### CQ-05 🟡 `FrontendCourierController` CarryBee paths are best-effort reconstructions

**File:** `app/Http/Controllers/Api/Admin/FrontendCourierController.php:97`

The original Supabase edge function source was not in the repository. The CarryBee proxy
was reconstructed from the frontend payload shapes and the public API documentation. The
base URL (`https://api.carrybee.com`) and endpoint paths (`/api/v1/orders`,
`/api/v1/stores`, `/api/v1/address-details`) may not match the live merchant account.

**Action required:** Verify against the live CarryBee merchant credentials before enabling.

---

### CQ-06 🟢 `FrontendMarketingController::youtubeSync()` is a stub that never acts

**File:** `app/Http/Controllers/Api/Admin/FrontendMarketingController.php:177`

When `YOUTUBE_API_KEY` is set the endpoint returns `{synced: 0, message: 'Sync queued'}`
but does not actually queue anything. The UI shows success incorrectly.

---

### CQ-07 🟢 Repeated `use App\Models\ResellerOrder` via FQCN in FrontendOrderController

**File:** `app/Http/Controllers/Api/Admin/FrontendOrderController.php:142,169`

`\App\Models\ResellerOrder::...` is used inline rather than imported at the top of the
file. Minor — but it makes IDE type resolution harder.

---

## 8. UX Improvements

### UX-01 🟠 Order tracking broken for Phase-3 orders

See BUG-04. Customers who placed orders after the Phase-3 migration cannot look up their
order via the tracking page because it searches `invoice_number` (legacy) rather than
`order_code` (`#NN`).

---

### UX-02 🟡 Audio upload has no MIME-type feedback

The admin audio file upload accepts any file type without client-side or server-side MIME
validation. Users can accidentally upload PDFs, images, or archives and receive no error.

**Fix:** Add `|mimes:mp3,wav,ogg,aac,m4a` on the backend and a matching `accept=` on the
`<input type="file">` in `AudioSettings.tsx`.

---

### UX-03 🟡 YouTube sync button shows success despite doing nothing

When clicked (with or without a key configured), the YouTube Sync page always receives
`{synced: 0}` with no error, making it look like a successful no-op rather than a
feature that requires setup.

**Fix:** When `YOUTUBE_API_KEY` is absent, return HTTP 503 with a message like
"YouTube API key not configured — set YOUTUBE_API_KEY in .env". The frontend can
display this clearly.

---

### UX-04 🟡 Push campaign creation (via `MarketingController`) is a no-op

**File:** `app/Http/Controllers/Api/Admin/MarketingController.php:119`

The admin Marketing module has a push campaign creator that saves to `push_campaigns`
but never delivers the notification (`// TODO: dispatch SendPushNotificationJob`). Users
see the campaign listed as "pending" forever.

**Fix:** Either implement the job dispatch or redirect admin users to the Phase-3
`/admin/mk/send-push` endpoint which does deliver via `FrontendMarketingController`.

---

### UX-05 🟢 `sms_gateway` route section has no UI

The SMS gateway routes (`/api/sms-gateway/pending`, `/api/sms-gateway/report`) are
designed for an Android relay app. There is no in-admin UI to monitor gateway status or
configure which device is acting as the relay.

---

## 9. Production Deployment Checklist

> Complete **every item** before going live. Items marked ✅ are informational —
> verify their current state on the target server.

### Environment & Config

- [ ] 🔴 `APP_DEBUG=false` in `.env`
- [ ] 🔴 `APP_ENV=production` in `.env`
- [ ] 🔴 `APP_KEY` is set and unique (run `php artisan key:generate` if fresh install)
- [ ] 🟠 Remove `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from `.env`
- [ ] 🟠 Set `CLOUD_BACKUP_URL` and `CLOUD_BACKUP_KEY` to a self-owned backup endpoint, or remove the default Supabase fallback from `BackupController`
- [ ] 🟠 Set `SESSION_DRIVER=cookie` or `redis` (file sessions do not work on multi-server setups)
- [ ] 🟡 Set `CACHE_DRIVER=redis` (recommended)
- [ ] 🟡 Set `QUEUE_CONNECTION=redis` (recommended)
- [ ] 🟡 Configure `LOG_CHANNEL=daily` and set `LOG_LEVEL=error` for production

### API Keys

- [ ] 🔴 `STEADFAST_API_KEY` + `STEADFAST_SECRET_KEY` — courier dispatch
- [ ] 🔴 `BULKSMS_API_KEY` — SMS notifications
- [ ] 🟠 `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` — push notifications (`php artisan vapid:generate` or generate externally)
- [ ] 🟠 `BDCOURIER_API_KEY` — fraud delivery ratio check
- [ ] 🟡 `YOUTUBE_API_KEY` — if YouTube Sync is to be used
- [ ] 🟡 CarryBee credentials (`clientId`, `clientSecret`, `clientContext`) saved in Admin → Settings → Courier Settings
- [ ] 🟡 `CLOUD_BACKUP_URL` + `CLOUD_BACKUP_KEY` — Google Drive cloud backup

### Server Setup

- [ ] 🔴 PHP ≥ 8.2 with extensions: `pdo_mysql`, `json`, `mbstring`, `openssl`, `tokenizer`, `xml`, `curl`, `fileinfo`, `intl`
- [ ] 🔴 Run `php artisan storage:link` (creates `public/storage` → `storage/app/public` symlink)
- [ ] 🔴 `storage/` and `bootstrap/cache/` directories have write permissions (`775` or `755` depending on web server user)
- [ ] 🔴 Web server document root points to `public/` not the project root
- [ ] 🔴 Run `php artisan migrate --force` on a fresh server
- [ ] 🔴 Run `php artisan config:cache` and `php artisan route:cache` (speeds up cold starts)
- [ ] 🔴 Run `npm run build` and deploy the `public/build/` output
- [ ] 🟠 Ensure `mysqldump` is in the server's `$PATH` (required by `BackupService`)
- [ ] 🟠 Set `post_max_size`, `upload_max_filesize`, `memory_limit` in `php.ini` (recommend ≥ 128M each)
- [ ] 🟠 Configure Nginx/Apache to NOT execute PHP files under `public/storage/`

### Scheduler & Queue

- [ ] 🔴 Add cron entry to run the Laravel scheduler every minute:
  ```
  * * * * * cd /path/to/bongobee-laravel && php artisan schedule:run >> /dev/null 2>&1
  ```
  This activates: `sms:process` (every 5 min) and `backup:auto` (daily 02:00).
- [ ] 🟠 If using database queue, run `php artisan queue:work --tries=3 --sleep=3` under a process manager (Supervisor recommended)
- [ ] 🟠 If using Redis queue, configure `QUEUE_RETRY_AFTER` appropriately

### HTTPS & Security

- [ ] 🔴 SSL certificate installed; all HTTP traffic redirected to HTTPS
- [ ] 🟠 `APP_URL` in `.env` uses `https://`
- [ ] 🟠 Set `CORS_ALLOWED_ORIGINS` to the actual production domain
- [ ] 🟡 Add `Strict-Transport-Security` header in Nginx/Apache config
- [ ] 🟡 Review and tighten CORS policy (`config/cors.php`)

### Code Fixes Before Go-Live (Recommended)

- [ ] 🔴 Fix `/admin/dashboard` HTTP 500 (BUG-01)
- [ ] 🔴 Fix duplicate `POST /public/incomplete-orders` route (BUG-02)
- [ ] 🟠 Fix order tracking for Phase-3 orders (BUG-04)
- [ ] 🟠 Add rate limiting to public fraud endpoints (SEC-05)
- [ ] 🟠 Move `POST /public/courier-ratio` behind auth (SEC-06)
- [ ] 🟠 Remove hardcoded Supabase URL from `cloudBackup()` (BUG-08)

### Post-Deploy Verification

- [ ] `php artisan route:list` returns expected routes with no errors
- [ ] Admin login works and JWT/Sanctum token is returned
- [ ] Reseller login and registration flow works
- [ ] `GET /api/public/settings` returns site settings
- [ ] `POST /api/public/orders` creates an order (test with dummy data)
- [ ] `GET /api/admin/dashboard` returns stats without 500 (after BUG-01 fix)
- [ ] SMS sends to a test number
- [ ] Storage upload test (audio file upload in Admin → Settings → Audio)

---

## 10. Backup Strategy

### Current State

The project has two parallel backup mechanisms:

**1. SQL Dump Backup (`BackupService`)** — `php artisan backup:auto` (runs daily at 02:00 via scheduler)
- Uses `mysqldump` CLI
- Stores `.sql` files in `storage/app/backups/`
- Retains last 10 backups only
- No off-site copy

**2. JSON Backup (`backup-utils.ts` + `BackupController`)** — manual, triggered from Admin UI
- Table-by-table JSON export via `GET /admin/data/backup-table`
- Downloadable as a `.json` file by the admin
- Optional cloud upload via `POST /admin/data/cloud-backup` → currently defaults to an external Supabase endpoint (see BUG-08/SEC-09)

### Recommended Backup Strategy

| Frequency | Method | Destination | Retention |
|-----------|--------|-------------|-----------|
| Every 6 hours | SQL dump (scheduler) | Local `storage/app/backups/` | 7 days |
| Daily | SQL dump (scheduler) | Off-site (S3, Google Drive, FTP) | 30 days |
| Weekly | JSON export (admin-triggered) | Admin downloads to local PC | Manual |
| Before any migration/deployment | SQL dump (manual) | Local PC | Keep indefinitely |

### Implementation Steps

1. **Fix the cloud backup default** (BUG-08) — set `CLOUD_BACKUP_URL` to a self-owned endpoint.
2. **Increase auto-backup retention** — change `BackupService::pruneOldBackups()` to keep 14 instead of 10.
3. **Add S3/off-site upload** — after `mysqldump`, copy the file to an S3 bucket or Google Drive using the Laravel `flysystem-s3` package.
4. **Alert on backup failure** — `BackupLog` records failures; add an email notification when `status = 'failed'`.
5. **Test restore monthly** — restore a backup to a staging server to confirm it actually works.

---

## 11. Monitoring Recommendations

### Application Health

| What to Monitor | How | Alert Threshold |
|----------------|-----|-----------------|
| API response time | Server-side logging (see §12) | > 2s average |
| HTTP 500 errors | Log aggregator | Any 500 in production |
| Failed login attempts | `admin_login` log channel | > 10 failures/minute |
| SMS send failures | `SmsService` error log | > 20% failure rate |
| Push notification failures | `PushNotificationService` log | > 30% failure rate |
| Scheduler last run | `BackupLog.created_at` | > 25 hours since last backup |
| Queue depth | `jobs` table row count | > 500 unprocessed jobs |
| Storage disk usage | Disk free % | < 20% free |

### Uptime Monitoring

- Set up an external uptime monitor (e.g., UptimeRobot, BetterUptime) on:
  - `GET /api/public/settings` (lightweight public endpoint — confirms Laravel is alive)
  - `GET /` (confirms Nginx + React SPA is serving)
- Alert response time > 5s or HTTP non-2xx.

### Business Metrics to Watch

- Orders placed per hour (sudden drop = storefront problem)
- Failed coupon validations (spike = scraping/abuse attempt)
- `incomplete_orders` row count per day (spike = checkout friction)
- `blocked_customers` growth rate (spike = fraud campaign underway)

---

## 12. Logging Recommendations

### Current State

`LOG_CHANNEL=stack` logs to `storage/logs/laravel.log` in development. There is no
structured logging, no log rotation, and no log shipping.

### Recommended Logging Setup

**`config/logging.php` additions:**

```php
'channels' => [
    // ...
    'daily' => [
        'driver' => 'daily',
        'path' => storage_path('logs/laravel.log'),
        'level' => env('LOG_LEVEL', 'error'),
        'days' => 14,
    ],
    'orders' => [
        'driver' => 'daily',
        'path' => storage_path('logs/orders.log'),
        'level' => 'info',
        'days' => 90,
    ],
    'fraud' => [
        'driver' => 'daily',
        'path' => storage_path('logs/fraud.log'),
        'level' => 'info',
        'days' => 180,
    ],
],
```

**What to log:**

| Event | Channel | Level |
|-------|---------|-------|
| New order placed | `orders` | info |
| Order status change | `orders` | info |
| Customer blocked | `fraud` | warning |
| Fraud check triggered | `fraud` | info |
| SMS send failed | `daily` | error |
| Push send failed | `daily` | warning |
| Backup started/completed/failed | `daily` | info/error |
| Admin login | `daily` | info |
| Courier API error | `daily` | error |

**In production:** ship logs to a centralized service (Papertrail, Logtail, Datadog,
or even a simple daily email digest of error-level entries) so that errors are visible
without SSH access.

---

## 13. Recommended Caching

### Priority 1 — SiteSetting (highest impact, trivial to implement)

See PERF-01. Wrap `SiteSetting::get()` in `Cache::remember()` with a 5-minute TTL
and call `Cache::forget("site_setting:$key")` in `SiteSetting::set()`.

Estimated improvement: removes 3–8 DB queries per public page request.

---

### Priority 2 — Public product catalog

`GET /api/public/products` and `GET /api/public/categories` are read on every storefront
load. Cache the paginated result for 2 minutes:

```php
$products = Cache::remember("public_products_{$page}_{$category}", 120, fn() =>
    Product::whereIn('status', ['published', 'active'])->paginate(24)
);
```

Invalidate all `public_products_*` keys whenever a product is created/updated/deleted.

---

### Priority 3 — Fraud settings

`FraudController::getFraudSettings()` is called on every checkout page load. Cache for
10 minutes.

---

### Priority 4 — Short link lookups

`ShopController::redirectShortLink()` is called every time a `/go/{slug}` URL is visited.
Cache the target URL for 5 minutes per slug.

---

### Priority 5 — Product page (individual)

`ShopController::product($slug)` — cache each individual product for 10 minutes.
Invalidate on product save.

---

### Cache Driver Recommendation

Use Redis for all caching (`CACHE_DRIVER=redis`). The file driver does not support
tagging (needed for bulk invalidation of product pages) and has locking issues under
concurrent load.

---

## 14. Future Feature Ideas

These are observations from using the system — not committed work items.

| Idea | Business Value | Notes |
|------|---------------|-------|
| Automated order confirmation SMS | High | Currently manual; the `confirmOrder` endpoint sets status but SMS must be triggered separately |
| Reseller dashboard reports (charts) | High | `ResellerPortalController::dashboard()` returns basic stats; no visual breakdown |
| Product variant-level stock tracking | High | Currently stock is tracked by product name string, not variant |
| Courier status webhook (inbound) | Medium | Steadfast can push status updates; currently the admin must pull manually |
| Email notifications for digital orders | Medium | Digital orders currently trigger no email to the customer |
| Abandoned cart recovery SMS | Medium | `incomplete_orders` table exists; no automated follow-up currently |
| Multi-image product upload (batch) | Medium | Current upload is one image at a time |
| Admin audit log | Medium | Who changed what order, when |
| Reseller commission report | Medium | Monthly PDF export of reseller earnings |
| A/B test landing pages | Low | Multiple variants of the same product landing page |
| Customer loyalty points | Low | Based on total order value or count |
| Bulk order import (CSV/Excel) | Low | Offline order entry from third parties |
| Mohasagor proxy route (server-side) | Low | Removes the CORS dependency on the external API; enables server-side caching |

---

## 15. Planned Features (Detailed)

---

### PF-01 Fix Order Number Limit (1000+ Orders) {#pf-01-fix-order-number-limit}

**Problem:** `bumpInvoiceCode()` uses `str_pad((string) $value, 2, '0', STR_PAD_LEFT)`, 
which overflows at 100 orders. At 100 orders the code becomes `#100`; at 1000 it becomes
`#1000`. Reseller order codes (`RO` prefix) have the same 2-char overflow. The format
inconsistency breaks string-based sorting and display expectations.

**Estimated Complexity:** Low  
**Risk Level:** Medium (changing the format requires updating all places that parse order codes)

#### Files Likely to Change

| Layer | File | Change |
|-------|------|--------|
| Backend | `app/Http/Controllers/Api/Admin/FrontendOrderController.php:194` | `str_pad(value, 2)` → `str_pad(value, 4)` (minimum `#0001`) |
| Backend | `app/Http/Controllers/Api/Admin/FrontendResellerController.php:112` | `str_pad(value, 2)` → `str_pad(value, 4)` (`RO0001`) |
| Frontend | `src/lib/order-utils.ts` (if exists) or `src/stores/useOrderStore.ts` | Any code that parses `#NN` format for display or sorting |
| Frontend | `src/pages/admin/Orders.tsx` | Sort/display logic based on order code string |
| Frontend | `src/pages/admin/AdminResellerOrders.tsx` | Same |

#### Controllers
- `FrontendOrderController::bumpInvoiceCode()`
- `FrontendResellerController::nextOrderId()`

#### React Stores
- `useOrderStore` — if order codes are compared or sorted client-side

#### API Endpoints
- `POST /api/admin/fe-orders/next-invoice`
- `POST /api/rs/reseller-orders/next-id`

#### Database Tables
- `orders.order_code` — existing rows keep old format; new rows use new format
- `reseller_orders.order_code` — same

#### Migration Needed
No schema migration. The `order_code` column is `varchar(50)` — already wide enough.
However, any sorting/filtering that assumes 2-char zero-padding must be updated.

#### Risk Factors
- Old orders (pre-fix) and new orders will have different padding lengths in the same table.
- Any frontend display logic that strips the `#` prefix and parses as an integer is unaffected.
- Any logic that relies on alphabetical sort of order codes will need to account for mixed lengths.

---

### PF-02 Homepage Redesign

**Problem:** The current homepage is rendered from site settings / landing page data.
A redesign implies changing the React component tree, possibly the data model for hero
sections, featured product carousels, and promotional banners.

**Estimated Complexity:** Medium  
**Risk Level:** Low (frontend only; no breaking API changes needed)

#### Files Likely to Change

| Layer | File | Change |
|-------|------|--------|
| Frontend | `src/pages/Index.tsx` or equivalent homepage component | Full rework of layout/sections |
| Frontend | `src/components/HomePage*.tsx` (hero, carousel, banner components) | New or refactored components |
| Frontend | `src/stores/useSiteSettingsStore.ts` | New fields if homepage sections are admin-configurable |
| Backend | `app/Http/Controllers/Api/Admin/SettingsController.php` | New settings keys for homepage layout |
| Backend | `app/Http/Controllers/Api/Public/ShopController.php:51` | `siteSettings()` may need to return new homepage blob keys |

#### Controllers
- `SettingsController` (if new admin-configurable fields are added)
- `ShopController::siteSettings()`

#### React Stores
- `useSiteSettingsStore`

#### API Endpoints
- `GET /api/public/site-settings` — may carry new homepage config keys
- `PUT /api/admin/site-settings` — to save new layout config

#### Database Tables
- `site_settings` — new keys in the `frontend_blob` JSON (no schema migration)

#### Risk Factors
- If the homepage references live product data (featured products, latest blog), these
  queries need indexes and caching to avoid slowing the first meaningful paint.
- Mobile responsiveness must be tested separately from the admin preview.

---

### PF-03 Steadfast Tracking Link Integration

**Problem:** After a Steadfast order is dispatched, the `consignment_id` is stored but
there is no in-admin link to the Steadfast tracking page. Admins must manually visit the
portal. Additionally, customers have no self-service tracking.

**Estimated Complexity:** Low-Medium  
**Risk Level:** Low

#### Files Likely to Change

| Layer | File | Change |
|-------|------|--------|
| Backend | `app/Http/Controllers/Api/Admin/FrontendCourierController.php` | Add `status_by_tracking_id` action to `steadfast()` |
| Backend | `app/Http/Controllers/Api/Public/CheckoutController.php:112` | `trackOrder()` — also return `tracking_url` if available |
| Frontend | `src/pages/admin/Orders.tsx` | Show Steadfast tracking link when `courier_invoice_id` is set |
| Frontend | `src/pages/admin/AdminResellerOrders.tsx` | Same for reseller orders |
| Frontend | `src/pages/OrderTracking.tsx` (if exists) | Show tracking link to customer |

#### Controllers
- `FrontendCourierController::steadfast()` — add `status_by_tracking_id` action
- `CheckoutController::trackOrder()` — return tracking URL alongside order status

#### React Stores
- `useOrderStore` — store/display `tracking_url` from order data

#### API Endpoints
- `POST /api/admin/courier/steadfast` (new action: `status_by_tracking_id`)
- `GET /api/public/order-tracking` (return `tracking_url` in response)

#### Database Tables
- `orders.tracking_url` — already exists; just needs to be populated on dispatch and returned in tracking API
- `courier_dispatch` — already stores `courier_invoice_id`; `tracking_url` can be derived: `https://steadfast.com.bd/t/{consignment_id}`

#### Risk Factors
- Steadfast tracking URL format may change; store the raw `consignment_id` and build the URL at display time rather than storing the full URL.
- The public tracking endpoint must not expose sensitive order details (admin notes, courier cost).

---

### PF-04 Stock Calculation Fix

**Problem:** Stock entries (`stock_entries` table) track purchases by product name string,
not by `product_id` foreign key. There is no way to compute "units in stock" = purchased
− sold because:
1. There is no link between `stock_entries` and `products`.
2. Sold quantities come from `orders.items` (a JSON array, not normalized).
3. The `products.in_stock` boolean is set manually by admins.

**Estimated Complexity:** High  
**Risk Level:** High (touches order data, product catalog, and UI simultaneously)

#### Files Likely to Change

| Layer | File | Change |
|-------|------|--------|
| Backend migration | `database/migrations/` | New migration: add `product_id` FK to `stock_entries`; add `stock_quantity` to `products` |
| Backend | `app/Models/StockEntry.php` | Add `product()` BelongsTo relationship |
| Backend | `app/Models/Product.php` | Add `stockEntries()` HasMany; add computed `available_stock` |
| Backend | `app/Http/Controllers/Api/Admin/AccountController.php` | `stockStore/stockUpdate` validate `product_id`; recalculate `products.stock_quantity` |
| Backend | `app/Http/Controllers/Api/Admin/FrontendOrderController.php` | On order status → ডেলিভারড, decrement `products.stock_quantity` for each item |
| Frontend | `src/stores/useStockStore.ts` | Store and display `product_id` |
| Frontend | `src/pages/admin/Stock.tsx` | Product picker; show available quantity |
| Frontend | `src/pages/admin/Products.tsx` | Show live stock count per product |

#### Controllers
- `AccountController` (`stockStore`, `stockUpdate`)
- `FrontendOrderController` (`update` — status change trigger)
- `ProductController` (`show/index` — return `stock_quantity`)

#### React Stores
- `useStockStore`
- `useProductStore`
- `useOrderStore` (to trigger stock recalc on delivery)

#### API Endpoints
- `POST /api/admin/stock` — accept `product_id`
- `PUT /api/admin/stock/{id}` — same
- `GET /api/admin/products` — return `stock_quantity`

#### Database Tables
- `stock_entries` — add `product_id uuid nullable FK`
- `products` — add `stock_quantity int default null` (null = unlimited)

#### Risk Factors
- Existing stock entries have no `product_id`; migration must handle them gracefully (nullable FK).
- Decrementing stock on delivery requires the order `items` JSON to be parsed reliably for `product_id`.
- Race conditions: two admins marking orders as delivered simultaneously must use DB-level atomic decrement.
- Returns/cancelled orders must increment stock back.

---

### PF-05 Landing Page HTML Builder

**Problem:** The current landing page system stores a `content` field (HTML/Markdown) that
must be hand-written. There is no drag-and-drop or block-based editor. Creating a
professional landing page requires HTML knowledge.

**Estimated Complexity:** High  
**Risk Level:** Medium (adds new UI surface; no breaking changes to existing landing pages)

#### Files Likely to Change

| Layer | File | Change |
|-------|------|--------|
| Frontend | `src/pages/admin/LandingPages.tsx` | Add builder mode alongside raw editor |
| Frontend | `src/components/builder/` (new directory) | Block components: Hero, Features, CTA, Gallery, Countdown, FAQ |
| Frontend | `src/stores/useLandingPageStore.ts` | Store block array `[{type, props}]` |
| Backend migration | `database/migrations/` | Add `blocks` JSON column to `landing_pages` |
| Backend | `app/Models/LandingPage.php` | Cast `blocks` as array |
| Backend | `app/Http/Controllers/Api/Admin/LandingPageController.php` | Accept `blocks` in create/update |
| Backend | `app/Http/Controllers/Api/Public/ShopController.php:80` | `landingPage()` — return `blocks` alongside existing `content` |
| Frontend | `src/pages/LandingPage.tsx` (public render) | Render blocks when `blocks` array is present; fall back to `content` HTML for old pages |

#### Controllers
- `LandingPageController` — accept and return `blocks`
- `ShopController::landingPage()` — return `blocks`

#### React Stores
- `useLandingPageStore` — manage block array, undo/redo

#### API Endpoints
- `POST /api/admin/landing-pages` — accept `blocks: [{type, props}]`
- `PUT /api/admin/landing-pages/{id}` — same
- `GET /api/public/landing-pages/{slug}` — return `blocks`

#### Database Tables
- `landing_pages` — add `blocks JSON nullable`
- Existing `content` column remains for backwards compatibility

#### Risk Factors
- Existing landing pages use raw HTML in `content`; must render without breaking.
- A block-based builder is a significant frontend investment — consider using an existing
  open-source editor (GrapesJS, Quill with blocks, or a headless CMS) before building from scratch.
- Mobile preview mode is essential; desktop-only builder will produce poor mobile layouts.
- Server-side rendering/SEO — blocks must be rendered server-side or included in meta tags
  for search engine indexing.

---

*End of KNOWN_ISSUES_AND_ROADMAP.md — Last updated 2026-06-28*
