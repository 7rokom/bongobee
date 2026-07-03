# BongoBee — Project Architecture

**Stack:** React 18 + Vite + TypeScript + Zustand + shadcn/ui (frontend) · Laravel 12 + Sanctum + MySQL 8 (backend) · single same-origin deployment (Laravel serves the built SPA).

**Project root:** `C:\laragon\www\bongobee-laravel`

---

## 1. Folder Structure

```
bongobee-laravel/
├── app/
│   ├── Console/Commands/        # AutoBackup.php (backup:auto), ProcessSmsQueue.php (sms:process)
│   ├── Http/
│   │   ├── Controllers/Api/
│   │   │   ├── Admin/           # Frontend* + Backup + resource controllers
│   │   │   ├── Auth/            # AdminLogin, ResellerAuth, DigitalAuth
│   │   │   ├── Public/          # ShopController, CheckoutController
│   │   │   ├── Reseller/        # ResellerPortalController
│   │   │   └── Digital/         # DigitalStoreController
│   │   └── Middleware/          # AdminAuth, ResellerAuth, DigitalCustomerAuth, EmployeePermission
│   ├── Models/                  # 37 Eloquent models
│   └── Services/                # SmsService, PushNotificationService, CourierService, FraudCheckService, BackupService
├── bootstrap/                   # app.php (bootstrap), cache/
├── config/                      # auth.php (4 guards), database, filesystems, sanctum…
├── database/migrations/         # Phase-1 base + 18 Phase-3 alignment migrations
├── public/
│   ├── index.php                # Laravel front controller (web root)
│   ├── build/                   # ← compiled React SPA (Vite output) + manifest
│   └── storage  ⇒ symlink → storage/app/public   # public uploads (audio, etc.)
├── resources/views/             # Blade shell that mounts the SPA
├── routes/
│   ├── api.php                  # ALL 282 API routes
│   └── console.php              # scheduler (sms:process /5min, backup:auto @02:00)
├── src/                         # ← React frontend SOURCE (TypeScript)
│   ├── lib/api.ts               # central Laravel API client
│   ├── stores/                  # Zustand domain stores (28 api-driven)
│   ├── pages/ , components/     # UI (admin, reseller, digital, public)
│   └── data/ , hooks/
├── storage/app/public/          # uploaded files (audio/, digital/) served via /storage
├── .env                         # config + API keys
├── composer.json / vendor/      # PHP deps (PHP ^8.2)
└── package.json / node_modules/ # build-time only (NOT needed at runtime)
```

---

## 2. Frontend Architecture

- **Build:** Vite → `public/build/` (hashed JS/CSS chunks + `manifest.json`). Laravel's Blade shell loads them; the SPA mounts client-side (React Router).
- **State:** **Zustand** stores, one per domain (`useProductStore`, `useOrderStore`, `useResellerStore`, …). Each store owns its slice + the `api` calls for it. UI components read/write stores; they almost never call `api` directly.
- **Data access:** the single client **`src/lib/api.ts`** (`api.get/post/put/patch/del`). Base URL `/api`. It picks the correct **Sanctum bearer token by path prefix** and throws `ApiError {status, errors, message}`.
- **Bootstrapping:** `DataInitializer` (public: products/categories/settings/fraud) and `AdminDataInitializer` (admin tier-1 data) fetch on mount. `SiteSettingsInitializer` caches header/footer/SEO for first-paint.
- **UI kit:** shadcn/ui (Radix) + Tailwind. Bengali (বাংলা) UI throughout.
- **No Supabase:** the SDK, `db.from`, `storage.from`, `rpc`, `functions.invoke`, and realtime `channel` were fully removed; everything goes through `api.ts`.

---

## 3. Backend Architecture

- **Framework:** Laravel 12 (PHP ^8.2), REST JSON API only (no Blade pages except the SPA shell).
- **Auth:** Laravel **Sanctum** with **4 guards** — `admin`, `employee`, `reseller`, `digital_customer` (bearer tokens).
- **Controllers (two layers):**
  - **`Frontend*Controller`** — speak the React frontend's *exact* schema (order_code `#NN` / `RO##`, camel↔snake). These carry the migration traffic.
  - **Resource controllers** (`ProductController`, `CategoryController`, …) — RESTful, used directly by stores for CRUD.
- **Services:** encapsulate external integrations (`SmsService`, `PushNotificationService`, `CourierService`) and heavy logic (`BackupService`, `FraudCheckService`).
- **Settings store:** `SiteSetting` is a key→JSON blob table (`get()/set()`) used for site settings, fraud settings, courier credentials, etc.
- **Scheduler:** `routes/console.php` runs `sms:process` every 5 min and `backup:auto` daily.

---

## 4. Authentication Flow

```
React login page → store.login() → api.post('/auth/{guard}/login')
   → AuthController validates → Sanctum issues a bearer TOKEN (per guard)
   → store saves token via setToken(scope) → localStorage
       bongobee_admin_token | bongobee_reseller_token | bongobee_digital_token
   → every later api.* attaches "Authorization: Bearer <token>" based on path prefix
```

| Guard | Login endpoint | Token key | Notes |
|---|---|---|---|
| admin / employee | `POST /auth/admin/login` | `bongobee_admin_token` | role in response |
| reseller | `POST /auth/reseller/login` | `bongobee_reseller_token` | **approval-gated**: register sets `status=pending`; login returns **403 "Account is not active"** until an admin sets `status=active` |
| digital_customer | `POST /auth/digital/login` | `bongobee_digital_token` | self-service register |

**Path→token rule (`api.ts`):** `/reseller|/auth/reseller`→reseller · `/auth/digital|/digital/my-orders`→digital · `/admin|/auth/admin`→admin · `/rs/*`→admin **or** reseller **or** digital (shared) · `/public/*`→none.

---

## 5. Order Flow (main store)

```
Storefront Checkout → useOrderStore.createOrderFromCheckout()
   → api.post('/public/checkout-order')  [FrontendOrderController@checkout]
        → Counter (atomic invoice "#NN") → Order::create()
   ← returns order (#1017)
   → side effects: fraud/courier-ratio cache, post-order popup (/public/confirm-order)

Admin Orders page → useOrderStore
   GET  /admin/fe-orders                 list
   POST /admin/fe-orders                 create
   POST /admin/fe-orders/update {code}   update (status change triggers ↓)
   POST /admin/fe-orders/delete {codes}  delete
        on status change:
          → lib/bulksms.maybeSendStatusSms()   → /admin/mk/send-sms
          → lib/return-ledger.syncReturnLedger() → /admin/data/ledger-upsert|delete
          → courier dispatch (Steadfast/CarryBee) → /admin/courier/*
```

**Models:** `Order` (hasOne `FollowUpData`), `Counter`, `IncompleteOrder` (abandoned-cart capture via `/public/incomplete-orders` + unload `sendBeacon`).

---

## 6. Reseller Flow

```
Register  POST /auth/reseller/register   → Reseller (status=pending)
Approve   PUT  /rs/resellers/{id} {status:active}   (admin)
Login     POST /auth/reseller/login      → token (gated on active)
Shop      GET  /public/reseller-prices, /public/products
Place     POST /rs/reseller-orders/next-id → "RO##"
          POST /rs/reseller-orders        → ResellerOrder
Payout    POST /rs/payment-requests       → PaymentRequest (admin PUT status to approve)
```

`/rs/*` endpoints accept **admin OR reseller** tokens (shared), so the same store works in the admin back-office and the reseller portal. **Models:** `Reseller` hasMany `ResellerOrder`, `ResellerPaymentMethod`, `PaymentRequest`, `ResellerProductPrice`.

---

## 7. Digital Product Flow

```
Register/Login  /auth/digital/*                 → DigitalCustomer
Browse          GET /public/digital-fe/products|categories|payment-methods
Checkout        POST /public/digital-fe/orders   → DigitalOrder (order_number "DP###", price, trx_id)
Upload proof    POST /public/digital-fe/upload   → /storage/...
My orders       GET /public/digital-fe/my-orders (digital token)
Admin           GET/PUT/DELETE /admin/digital-fe/orders, products, categories, users, blocks
```

**Models:** `DigitalCustomer` hasMany `DigitalOrder`; `DigitalOrder` belongsTo `DigitalCustomer`; `DigitalProduct` belongsTo `DigitalCategory`.

---

## 8. Product CRUD Flow

```
Read   useProductStore.fetchProducts() → GET /public/products[?per_page,includeAll]
Create useProductStore.addProduct()    → POST   /admin/products
Update                                  → PUT    /admin/products/{id}
Delete                                  → DELETE /admin/products/{id}
Controller: Admin/ProductController   Model: Product (belongsTo Category)
```
Public listing returns **published** only (egress guard); admin uses `includeAll` for drafts.

---

## 9. Category CRUD Flow

```
Read   useCategoryStore.fetchCategories() → GET /public/categories
Create / Update / Delete                  → POST/PUT/DELETE /admin/categories[/{id}]
Controller: Admin/CategoryController   Model: Category (hasMany Product)
```
Hierarchy fields (parent_id, is_main, lucide_icon, sort_order, custom_link) live **in the categories table** (migration `000001`), not in site-settings.

---

## 10. Stock Flow

```
useStockStore → GET/POST /admin/stock   Controller: AccountController@stockIndex   Model: StockEntry
Self vs Vendor stock tracked per product; lib/check-self-stock.ts guards courier dispatch
(blocks "send to courier" if a line is out of self-stock). Vendor returns add a 10৳ packaging
cost in the return-ledger.
```

---

## 11. Landing Page Flow

```
Public  GET /public/landing-pages/{slug}     ShopController@landingPage
Admin   GET/POST/PUT/DELETE /admin/landing-pages   LandingPageController
Store: useLandingPageStore   Model: LandingPage (belongsTo Product)
```
A landing page renders a single product with a custom one-page layout + its own checkout.

---

## 12. Blog Flow

```
Public  GET /public/blog , /public/blog/{slug}     ShopController@blog/blogPost
Admin   GET/POST/PUT/DELETE /admin/blog            BlogController
Store: useBlogStore   Model: BlogPost (type: post|page; status string)
Auto-import: YouTube sources → /admin/mk/youtube-sync creates BlogPosts from videos
(stub until YOUTUBE_API_KEY is configured; the link-gateway /go/{slug} also reads blog posts).
```

---

## 13. Notification Flow

**SMS (bulksmsbd):**
```
Status change → lib/bulksms.maybeSendStatusSms() → POST /admin/mk/send-sms
   FrontendMarketingController@sendSms → SmsService->send()  (https://bulksmsbd.net)
Bulk / queued → sms_queue table → scheduled `sms:process` (every 5 min) drains it
Balance → GET /admin/mk/sms-balance ;  mark sent → /public/mark-sms-sent
```
**Push (Web Push / VAPID):**
```
Browser subscribe → POST /public/push-subscribe → PushSubscription
Admin send → POST /admin/mk/send-push → PushNotificationService (VAPID keys) → records PushCampaign
Check → /public/push-check ; sections via /admin/mk/push-subscriptions[/count|/section/{s}]
```

---

## 14. Database Table Relationships

```
Category 1───* Product *───1 (LandingPage *───1 Product)
Order 1───1 FollowUpData
Reseller 1───* ResellerOrder
Reseller 1───* ResellerPaymentMethod
Reseller 1───* PaymentRequest
Reseller 1───* ResellerProductPrice ───1 Product
Employee 1───* EmployeeActivity
DigitalCustomer 1───* DigitalOrder
DigitalCategory 1───* DigitalProduct
```

| Relationship | Definition |
|---|---|
| `Category` → `Product` | hasMany |
| `Product` → `Category` | belongsTo |
| `Order` → `FollowUpData` | hasOne / belongsTo `Order` |
| `Reseller` → `ResellerOrder`/`ResellerPaymentMethod`/`PaymentRequest`/`ResellerProductPrice` | hasMany |
| `ResellerProductPrice` → `Product` | belongsTo |
| `Employee` → `EmployeeActivity` | hasMany / belongsTo |
| `DigitalCustomer` → `DigitalOrder` | hasMany / belongsTo |
| `DigitalProduct` → `DigitalCategory` | belongsTo |
| `LandingPage` → `Product` | belongsTo |

**Blob / standalone tables (no FK):** `SiteSetting` (key→JSON: site/fraud/courier settings), `Counter`, `Coupon`, `Variation`, `BlockedCustomer`, `ShortLink`, `IncompleteOrder`, `CourierDispatch`, `CourierRatioCache`, `Expense`, `Deposit`, `StockEntry`, `YoutubeSource`, `PushSubscription`, `PushCampaign`, `SmsCampaign`, `SmsQueue`, `BackupLog`, `Admin`.

---

## 15. API Endpoints grouped by Module

> 282 routes total. Prefix groups: `public` (38) · `admin` (143) · `admin/data` (30) · `admin/mk` (21) · `admin/courier` (2) · `rs` (16) · `reseller` (11) · `auth` (11).

**Auth** — `POST /auth/{admin|reseller|digital}/login|logout`, `/auth/{reseller|digital}/register`, `GET /auth/admin/me`

**Public Store** — `GET /public/settings|site-settings|categories|products|products/{slug}|blog|blog/{slug}|pages/{slug}|landing-pages/{slug}|short-links/{slug}|fraud-settings|order-tracking` · `POST /public/orders|checkout-order|confirm-order|coupon/validate|incomplete-orders|order-cooldown|check-blocked|courier-check|device-check|courier-ratio|short-links/{slug}/click|send-sms|mark-sms-sent|push-subscribe|push-check`

**Public Digital** — `GET /public/digital-fe/products|products/{slug}|categories|payment-methods|blocks|my-orders` · `POST /public/digital-fe/orders|upload`

**Admin – Catalog** — `… /admin/products`, `/admin/categories`, `/admin/variations`, `/admin/coupons` (index/show/store/update/destroy)

**Admin – Content** — `/admin/blog`, `/admin/landing-pages`

**Admin – Orders** — `GET /admin/orders`, `/admin/orders/{id}` · `POST /admin/fe-orders` (+`/update`,`/delete`,`/next-invoice`) · `/admin/counter/{key}` (get/put/`/next`) · `/admin/customer-history`, `/admin/customer-devices`

**Admin – Accounts/Team** — `/admin/expenses`, `/admin/deposits`, `/admin/stock`, `/admin/account-report`, `/admin/employees`, `/admin/employees/report`

**Admin – Fraud/Settings** — `/admin/fraud-settings`, `/admin/blocked-customers`, `/admin/settings/*` (frontend blob, credentials)

**Admin – Data (`/admin/data/*`)** — `courier-settings/{provider}`, `courier-dispatch` (+`/delete`), `courier-ratio`, `courier-ratio-all`, `courier-check`, `ledger-upsert`, `ledger-delete`, `employees` (+CRUD), `employee-activities`, `incomplete-orders` (+`/bulk-delete`,`/{id}`,`/{id}/cancel`,`/delete-by-phone`,`/{id}/note`), `follow-ups` (+`/delete`), `audio` (GET/POST/`/delete`), `backup-table`, `restore-table`, `cloud-backup`

**Admin – Marketing (`/admin/mk/*`)** — `short-links` (+`/check`,CRUD), `youtube-sources` (CRUD), `youtube-sync`, `push-subscriptions` (+`/count`,`/section/{s}`), `push-campaigns` (+`/section/{s}`,`/{id}`), `send-push`, `send-sms`, `mark-sms-sent`, `sms-balance`

**Admin – Courier (`/admin/courier/*`)** — `POST /steadfast`, `POST /carrybee`

**Admin – Digital (`/admin/digital-fe/*` + `/admin/digital/*`)** — products, categories, payment-methods, orders, users, blocks, report

**Reseller shared (`/rs/*`)** — `resellers` (+`/{id}`), `reseller-orders` (+`/update`,`/delete`,`/next-id`), `payment-requests` (+`/{id}`), `payment-methods` (+`/{id}`), `product-prices`

**Reseller portal (`/reseller/*`)** — `dashboard`, `balance`, `orders` (GET/POST), `products`, `landing-pages`, `payment-methods`, `payment-requests`, `settings`

---

## 16. React Store → API Endpoint Map

| Store | Endpoints |
|---|---|
| `useAdminStore` | `/auth/admin/*`, `/admin/settings/credentials` |
| `useCategoryStore` | `/public/categories`, `/admin/categories` |
| `useProductStore` | `/public/products`, `/admin/products` |
| `useVariationStore` | `/admin/variations` |
| `useCouponStore` | `/admin/coupons`, `/public/coupon/validate` |
| `useBlockStore` | `/admin/blocked-customers`, `/public/check-blocked` |
| `useFraudSettingsStore` | `/public/fraud-settings`, `/admin/fraud-settings` |
| `useBlogStore` | `/public/blog`, `/admin/blog` |
| `useLandingPageStore` | `/public/landing-pages`, `/admin/landing-pages` |
| `useOrderStore` | `/admin/fe-orders*`, `/public/checkout-order` |
| `useIncompleteOrderStore` | `/admin/data/incomplete-orders*`, `/public/incomplete-orders` |
| `useFollowUpStore` | `/admin/data/follow-ups` |
| `useExpenseStore` / `useDepositStore` / `useStockStore` | `/admin/expenses` · `/admin/deposits` · `/admin/stock` |
| `useEmployeeStore` | `/admin/data/employees`, `/admin/data/employee-activities` |
| `useResellerStore` | `/rs/resellers`, `/rs/reseller-orders`, `/rs/payment-requests`, `/rs/product-prices`, `/rs/payment-methods` |
| `useDigitalAuthStore` | `/auth/digital/*` |
| `useDigitalProductStore` / `…Category` / `…PaymentMethod` / `…Order` / `…Block` | `/public/digital-fe/*` + `/admin/digital-fe/*` |
| `useSiteSettingsStore` | `/public/site-settings`, `/admin/settings/frontend` |
| `useYouTubeSourceStore` | `/admin/mk/youtube-sources` |
| `useCourierRatioStore` | `/admin/data/courier-ratio-all`, `/public/courier-ratio`, `/admin/data/courier-check` |
| `useSteadfastStore` / `useCarrybeeStore` | `/admin/data/courier-settings/{provider}`, `/admin/data/courier-dispatch` |
| *(libs)* `fraud-check` · `order-cooldown` · `return-ledger` · `bulksms` · `push-subscribe` · `backup-utils` | `/public/courier-check`,`/public/device-check` · `/public/order-cooldown` · `/admin/data/ledger-*` · `/admin/mk/send-sms` · `/public/push-*` · `/admin/data/backup-table`,`restore-table` |

---

## 17–18. Endpoint → Controller → Model

| Endpoint group | Controller | Primary Model(s) |
|---|---|---|
| `/auth/admin/*` | `Auth/AdminLoginController` | `Admin` |
| `/auth/reseller/*` | `Auth/ResellerAuthController` | `Reseller` |
| `/auth/digital/*` | `Auth/DigitalAuthController` | `DigitalCustomer` |
| `/public/products|categories|blog|pages|landing-pages|short-links|settings` | `Public/ShopController` | `Product`,`Category`,`BlogPost`,`LandingPage`,`ShortLink`,`SiteSetting` |
| `/public/orders|coupon|incomplete-orders|order-tracking` | `Public/CheckoutController` | `Order`,`Coupon`,`IncompleteOrder` |
| `/public/checkout-order|confirm-order`, `/admin/fe-orders*`, `/admin/counter*`, `/admin/customer-*` | `Admin/FrontendOrderController` | `Order`,`Counter`,`ResellerOrder` |
| `/public/check-blocked|fraud-settings|order-cooldown`, `/admin/fraud-settings` | `Admin/FraudController` | `BlockedCustomer`,`SiteSetting`,`Order` |
| `/admin/products` · `/admin/categories` · `/admin/variations` · `/admin/coupons` · `/admin/blog` · `/admin/landing-pages` | `ProductController` · `CategoryController` · `VariationController` · `CouponController` · `BlogController` · `LandingPageController` | `Product`·`Category`·`Variation`·`Coupon`·`BlogPost`·`LandingPage` |
| `/admin/expenses|deposits|stock|account-report` | `Admin/AccountController` | `Expense`,`Deposit`,`StockEntry`,`Order` |
| `/admin/employees*` | `Admin/EmployeeController` | `Employee`,`EmployeeActivity` |
| `/rs/*`, `/public/reseller*` | `Admin/FrontendResellerController` | `Reseller`,`ResellerOrder`,`PaymentRequest`,`ResellerPaymentMethod`,`ResellerProductPrice` |
| `/reseller/*` | `Reseller/ResellerPortalController` | `Reseller`,`ResellerOrder`,`PaymentRequest` |
| `/public/digital-fe/*`, `/admin/digital-fe/*` | `Admin/FrontendDigitalController` | `DigitalProduct`,`DigitalCategory`,`DigitalPaymentMethod`,`DigitalOrder`,`DigitalCustomer` |
| `/admin/digital/*` | `Admin/DigitalAdminController` | `DigitalProduct`,`DigitalOrder` |
| `/admin/mk/*`, `/public/{send-sms,mark-sms-sent,push-*}` | `Admin/FrontendMarketingController` | `ShortLink`,`YoutubeSource`,`PushSubscription`,`PushCampaign`,`Order`,`ResellerOrder` (+`SmsService`,`PushNotificationService`) |
| `/admin/data/*`, `/public/{courier-check,device-check,courier-ratio}` | `Admin/FrontendDataController` | `SiteSetting`,`CourierDispatch`,`CourierRatioCache`,`Employee`,`EmployeeActivity`,`IncompleteOrder`,`FollowUpData`,`Expense`,`Deposit`,`Order`,`ResellerOrder` |
| `/admin/courier/{steadfast,carrybee}` | `Admin/FrontendCourierController` | `SiteSetting` (creds) → external APIs |
| `/admin/data/{backup-table,restore-table,cloud-backup}` | `Admin/BackupController` | (all tables, generic) |

---

## 19. Environment Variables

| Group | Keys |
|---|---|
| App | `APP_NAME`, `APP_ENV`, `APP_KEY`, `APP_DEBUG`, `APP_URL` |
| Logging | `LOG_CHANNEL`, `LOG_DEPRECATIONS_CHANNEL`, `LOG_LEVEL` |
| Database | `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` |
| Drivers | `BROADCAST_DRIVER`, `CACHE_DRIVER`, `FILESYSTEM_DISK`, `QUEUE_CONNECTION`, `SESSION_DRIVER`, `SESSION_LIFETIME` |
| Redis | `REDIS_HOST`, `REDIS_PASSWORD`, `REDIS_PORT` |
| Mail | `MAIL_MAILER`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_ENCRYPTION`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` |
| Sanctum / Admin seed | `SANCTUM_STATEFUL_DOMAINS`, `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` |
| **External services** | `BULKSMS_API_KEY` (SMS), `BDCOURIER_API_KEY` (fraud ratio), `STEADFAST_API_KEY`/`STEADFAST_SECRET_KEY`, `CARRYBEE_CLIENT_ID`/`CARRYBEE_SECRET`/`CARRYBEE_CONTEXT`, `YOUTUBE_API_KEY`, `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` (push), `GDRIVE_API_KEY` (cloud backup), `MOHASAGOR_API_KEY`/`MOHASAGOR_SECRET_KEY` (dropship) |
| Frontend (Vite) | `VITE_API_BASE_URL=/api` |
| ⚠️ Legacy (unused) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — **no longer referenced** after migration; safe to delete |

> Production reminder: set `APP_ENV=production`, `APP_DEBUG=false`.

---

## 20. Queue / Jobs / Scheduler

- **No `app/Jobs/` classes.** Async work is done by **scheduled Artisan commands** + a DB-backed SMS queue table.
- **Console commands** (`app/Console/Commands/`):
  - `sms:process {--limit}` → `ProcessSmsQueue` — drains the `sms_queue` table.
  - `backup:auto` → `AutoBackup` — creates an automatic DB backup.
- **Scheduler** (`routes/console.php`):
  ```php
  Schedule::command('sms:process --limit=100')->everyFiveMinutes();
  Schedule::command('backup:auto')->dailyAt('02:00');
  ```
- **Requirement:** a server cron entry running `php artisan schedule:run` every minute (standard Laravel). `QUEUE_CONNECTION` is configured but the app relies on the scheduler + custom queue table rather than queue workers.

---

## 21. Storage Locations

| Path | Purpose | Public URL |
|---|---|---|
| `storage/app/public/audio/` | Voice/audio files (Audio Settings) | `/storage/audio/...` |
| `storage/app/public/` (digital uploads) | Digital order proof / product files | `/storage/...` |
| `public/storage` → symlink → `storage/app/public` | Exposes the public disk | created by `php artisan storage:link` |
| `public/build/` | Compiled SPA assets | served directly |
| `storage/logs/`, `storage/framework/` | Laravel logs/cache/sessions | internal |

- Disk: `FILESYSTEM_DISK` (public). Uploads return `/storage/...` paths (no signed URLs — replaced Supabase Storage).
- ⚠️ On hosting, re-create the symlink (`storage:link`) — symlinks don't survive FTP/zip.

---

## 22. External APIs

| Service | Where | Purpose | Credentials |
|---|---|---|---|
| **Steadfast** | `FrontendCourierController@steadfast` → `portal.steadfast.com.bd/api/v1` | Courier consignment create / status / balance | `apiKey`+`secretKey` (body or `courier_steadfast` setting / env) |
| **CarryBee** | `FrontendCourierController@carrybee` (base overridable via `courier_carrybee.apiBase`) | Stores, address lookup, order create | `clientId`/`clientSecret`/`clientContext` |
| **bulksmsbd** | `SmsService` ← `FrontendMarketingController@sendSms` | Transactional/bulk SMS | `BULKSMS_API_KEY` |
| **Web Push (VAPID)** | `PushNotificationService` ← `@sendPush` | Browser push notifications | `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` |
| **BDCourier** | `FrontendDataController@courierCheck` ← `/public/courier-check` | Customer delivery-ratio (fraud) | `BDCOURIER_API_KEY` |
| **Google Drive (cloud backup)** | `BackupController@cloudBackup` (server-side proxy) | Off-site backup upload | `CLOUD_BACKUP_URL`/`CLOUD_BACKUP_KEY` (external uploader) |
| **YouTube Data API** | `FrontendMarketingController@youtubeSync` | Auto-import videos → blog posts | `YOUTUBE_API_KEY` |
| **Mohasagor** | `useMohasagorStore` (browser, direct) | Dropship product catalog | `MOHASAGOR_API_KEY`/`SECRET` |

> All courier/SMS/push/Drive calls are **server-side** (browser only talks to Laravel). Mohasagor is fetched directly in the browser (cached, no proxy).

---

## Dependency Diagram (request lifecycle)

```
┌─────────────────────────────────────────────────────────────────┐
│  React Component   (e.g. Orders.tsx, Checkout.tsx)               │
│        │  reads/writes state, calls a store action               │
│        ▼                                                          │
│  Zustand Store     (e.g. useOrderStore)                          │
│        │  builds payload (camel→snake), calls the client         │
│        ▼                                                          │
│  API Client        (src/lib/api.ts)                              │
│        │  attaches Sanctum bearer token by path prefix           │
│        │  fetch(`/api` + path)                                   │
│        ▼                                                          │
╞═══════════════════════ HTTP  (same origin) ═════════════════════╡
│        ▼                                                          │
│  Laravel Route     (routes/api.php — group + middleware guard)   │
│        │  auth:admin|employee|reseller|digital_customer          │
│        ▼                                                          │
│  Controller        (Admin/FrontendOrderController@checkout)      │
│        │  validate, orchestrate                                  │
│        ▼                                                          │
│  Service           (SmsService / PushNotificationService /       │
│        │            CourierService / BackupService)  [optional]  │
│        │            └─▶ External API (Steadfast, bulksmsbd, …)   │
│        ▼                                                          │
│  Model             (Order, Counter, Product, Reseller…)          │
│        │  Eloquent                                               │
│        ▼                                                          │
│  MySQL             (bongobee_laravel)                            │
└─────────────────────────────────────────────────────────────────┘
        ▲                                                  │
        └────────────── JSON response back up the stack ◀──┘
```

**Concrete example — placing an order:**
```
Checkout.tsx
  → useOrderStore.createOrderFromCheckout()
    → api.post('/public/checkout-order', payload)
      → Route: POST /api/public/checkout-order  (public, no auth)
        → FrontendOrderController@checkout
          → Counter::next()  +  Order::create()
            → MySQL  orders / counters
          ← Order JSON  →  store updates  →  UI shows "#1017"
```

---

*Documentation only — no application code was modified.*
