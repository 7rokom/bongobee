# BongoBee — Laravel Migration Change Index

**Project root:** `C:\laragon\www\bongobee-laravel`
**Migration:** React + Supabase → React + **Laravel API (MySQL, Sanctum)**. Every frontend data request now goes through the central client `src/lib/api.ts`; the entire `@supabase/supabase-js` SDK, `db.from()`, `storage.from()`, `.rpc()`, `functions.invoke()` and realtime `channel()` usage was removed.

> **Methodology note:** this project has **no git history** (`.git` absent), so Created / Modified / Deleted status is attributed from the migration work itself and verified against the current file tree. "Modified" frontend files previously called Supabase directly and were rewired to the Laravel API; "Created" backend files are the migration's frontend-schema controllers, services, and schema-alignment migrations.

---

## Legend
- **C** = Created · **M** = Modified · **D** = Deleted
- "Module" maps to the Phase-3 migration modules (Auth, Catalog, Orders, Reseller, Digital, Marketing, Settings, Accounts, Courier, Backup, Public Store).

---

# 1. Frontend

Central client and every store / library / page that was rewired from Supabase to the Laravel API.

## 1.1 Core API client

| File | C/M/D | Why | Module | Key exports | Endpoints |
|---|---|---|---|---|---|
| `src/lib/api.ts` | **C** | New central Laravel API client; replaces the Supabase SDK. Picks the correct Sanctum bearer token per path prefix; throws `ApiError`. | Core | `api.get/post/put/patch/del`, `setToken`, `getToken`, `clearToken`, `ApiError` | (all) base `/api` |

## 1.2 Stores (`src/stores/`) — all **Modified** (Supabase → `api`)

| File | Module | Role | Endpoints used |
|---|---|---|---|
| `useAdminStore.ts` | Auth | Admin/employee session + admin credential update | `/auth/admin/login`, `/admin/settings/credentials` |
| `useCategoryStore.ts` | Catalog | Category list/CRUD (+ hierarchy moved into table) | `/public/categories`, `/admin/categories` |
| `useProductStore.ts` | Catalog | Product list/CRUD (published vs all) | `/public/products`, `/admin/products` |
| `useVariationStore.ts` | Catalog | Variations CRUD | `/admin/variations` |
| `useCouponStore.ts` | Catalog | Coupon CRUD + validation | `/admin/coupons`, `/public/coupon/validate` |
| `useBlockStore.ts` | Fraud | Blocked customers | `/admin/blocked-customers`, `/public/check-blocked` |
| `useFraudSettingsStore.ts` | Fraud | Fraud/cooldown settings | `/public/fraud-settings`, `/admin/fraud-settings` |
| `useBlogStore.ts` | Content | Blog/pages CRUD | `/public/blog`, `/admin/blog` |
| `useLandingPageStore.ts` | Content | Landing pages CRUD | `/public/landing-pages`, `/admin/landing-pages` |
| `useOrderStore.ts` | Orders | Main orders (frontend schema, `#NN` code) | `/admin/fe-orders` (+`/update`,`/delete`,`/next-invoice`), `/public/checkout-order` |
| `useExpenseStore.ts` | Accounts | Expenses | `/admin/expenses` |
| `useDepositStore.ts` | Accounts | Deposits | `/admin/deposits` |
| `useStockStore.ts` | Accounts | Stock entries | `/admin/stock` |
| `useEmployeeStore.ts` | Team | Employees + activity log | `/admin/data/employees`, `/admin/data/employee-activities` |
| `useIncompleteOrderStore.ts` | Orders | Incomplete/abandoned orders (+ unload beacons → Laravel) | `/admin/data/incomplete-orders`, `/public/incomplete-orders` |
| `useFollowUpStore.ts` | Orders | Per-order follow-up / stock-type | `/admin/data/follow-ups` |
| `useResellerStore.ts` | Reseller | Resellers, reseller orders, payment requests, prices | `/rs/resellers`, `/rs/reseller-orders`, `/rs/payment-requests`, `/rs/product-prices`, `/rs/payment-methods` |
| `useDigitalAuthStore.ts` | Digital | Digital customer session (Sanctum) | `/auth/digital/*` |
| `useDigitalProductStore.ts` | Digital | Digital products | `/public/digital-fe/products`, `/admin/digital-fe/products` |
| `useDigitalCategoryStore.ts` | Digital | Digital categories | `/public/digital-fe/categories`, `/admin/digital-fe/categories` |
| `useDigitalPaymentMethodStore.ts` | Digital | Digital payment methods | `/public/digital-fe/payment-methods`, `/admin/digital-fe/payment-methods` |
| `useDigitalOrderStore.ts` | Digital | Digital orders | `/public/digital-fe/orders`, `/admin/digital-fe/orders` |
| `useDigitalBlockStore.ts` | Digital | Digital blocked users | `/public/digital-fe/blocks`, `/admin/digital-fe/blocks` |
| `useSiteSettingsStore.ts` | Settings | Site settings blob | `/public/site-settings`, `/admin/settings/frontend` |
| `useYouTubeSourceStore.ts` | Marketing | YouTube auto-import sources | `/admin/mk/youtube-sources` |
| `useCourierRatioStore.ts` | Courier | BDCourier ratio cache (realtime channel → focus refresh) | `/admin/data/courier-ratio-all`, `/public/courier-ratio`, `/admin/data/courier-check` |
| `useSteadfastStore.ts` | Courier | Steadfast settings + dispatch cache | `/admin/data/courier-settings/steadfast`, `/admin/data/courier-dispatch` |
| `useCarrybeeStore.ts` | Courier | CarryBee settings + dispatch cache | `/admin/data/courier-settings/carrybee`, `/admin/data/courier-dispatch` |

## 1.3 Libraries (`src/lib/`)

| File | C/M/D | Why | Module | Key functions | Endpoints |
|---|---|---|---|---|---|
| `fraud-check.ts` | **M** | Courier-ratio + device-block check via Laravel (was edge fn) | Fraud/Courier | `checkFraud`, `fetchAndCacheCourierRatio`, `checkDeviceBlocked` | `/public/courier-check`, `/public/device-check` |
| `order-cooldown.ts` | **M** | Server cooldown check (was `supabase.from('orders')`) | Fraud | `checkServerCooldown`, `isOrderCooldownActive` | `/public/order-cooldown` |
| `return-ledger.ts` | **M** | Auto expense/deposit ledger for returns (was `db.from`) | Accounts | `syncReturnLedger`, `backfillReturnLedger` | `/admin/data/ledger-upsert`, `/admin/data/ledger-delete` |
| `bulksms.ts` | **M** | SMS send + status SMS (was edge fn) | Marketing | `maybeSendStatusSms`, `buildMainOrderVars`, `buildResellerOrderVars` | `/admin/mk/send-sms`, `/public/send-sms`, `mark-sms-sent` |
| `push-subscribe.ts` | **M** | Web-push subscribe/check (was edge fn) | Marketing | `subscribeToPush`, `isSubscribed` | `/public/push-subscribe`, `/public/push-check` |
| `backup-utils.ts` | **M** | Full-site dump/restore loops (was per-table `db.from`) | Backup | `createFullBackup`, `restoreFullBackup`, `validateBackupFile`, `downloadBackupFile` | `/admin/data/backup-table`, `/admin/data/restore-table` |
| `backup-registry.ts` | **M** | Doc-comment cleanup (Supabase → database) | Backup | `BACKUP_GROUPS`, `ALL_BACKUP_TABLES` | — |
| `sql-dump.ts` | **M** | Doc-comment cleanup (removed supabase path) | Backup | `buildSqlDump` | — |
| `supabase-db.ts` | **D** | The `db = supabase` shim — deleted; nothing references it | Core | — | — |

## 1.4 Pages & components

| File | C/M/D | Module | Role | Endpoints |
|---|---|---|---|---|
| `src/pages/admin/Orders.tsx` | **M** | Orders/Courier | Admin orders + Steadfast/CarryBee dispatch (raw edge-fn `fetch` → proxy) | `/admin/fe-orders`, `/admin/courier/steadfast`, `/admin/courier/carrybee`, `/admin/customer-devices` |
| `src/pages/admin/AdminResellerOrders.tsx` | **M** | Reseller/Courier | Admin view of reseller orders + dispatch | `/rs/*`, `/admin/courier/*` |
| `src/pages/admin/FraudSettings.tsx` | **M** | Fraud | Courier-check test (edge fn → API) | `/public/courier-check`, `/admin/fraud-settings` |
| `src/pages/admin/LinkShortener.tsx` | **M** | Marketing | Short-link CRUD | `/admin/mk/short-links` |
| `src/pages/admin/PushNotifications.tsx` | **M** | Marketing | Push campaigns + subscribers | `/admin/mk/push-*`, `/admin/mk/send-push` |
| `src/pages/admin/YouTubeSync.tsx` | **M** | Marketing | YouTube auto-import (edge fn → API) | `/admin/mk/youtube-sync`, `/admin/mk/youtube-sources` |
| `src/pages/admin/AudioSettings.tsx` | **M** | Settings | Audio upload/list/delete (storage → public disk) | `/admin/data/audio` (GET/POST/`/delete`) |
| `src/pages/admin/BackupRestore.tsx` | **M** | Backup | Local + Google-Drive backup/restore | `/admin/data/backup-table`, `/restore-table`, `/cloud-backup` |
| `src/pages/admin/DigitalUsers.tsx` | **M** | Digital | Digital customer admin | `/admin/digital-fe/users` |
| `src/pages/admin/DigitalProductForm.tsx` | **M** | Digital | Digital product create/edit + upload | `/admin/digital-fe/products`, `/public/digital-fe/upload` |
| `src/pages/ProductPage.tsx` | **M** | Public Store | Product detail + reseller price | `/public/products/{slug}`, `/public/reseller-prices` |
| `src/pages/Checkout.tsx` | **M** | Public Store | Checkout (via order store) | `/public/checkout-order` |
| `src/pages/LandingPage.tsx` | **M** | Public Store | Landing page render | `/public/landing-pages/{slug}` |
| `src/pages/GoLink.tsx` | **M** | Public Store | Short-link gateway (`rpc` → click endpoint) | `/public/short-links/{slug}`, `/{slug}/click` |
| `src/pages/ShortLinkRedirect.tsx` | **M** | Public Store | Short-link redirect (`rpc` → click endpoint) | `/public/short-links/{slug}`, `/{slug}/click` |
| `src/components/PostOrderPopup.tsx` | **M** | Orders | Post-order "ship directly" confirm | `/public/confirm-order` |
| `src/components/layout/ResellerPublicLayout.tsx` | **M** | Reseller | Public reseller storefront wrapper | `/public/reseller/{ref}`, `/public/reseller-prices` |
| `src/pages/reseller/ResellerLogin.tsx` | **M** | Reseller | Reseller login | `/auth/reseller/login` |
| `src/pages/reseller/ResellerShop.tsx` | **M** | Reseller | Reseller catalog + prices | `/public/reseller-prices`, `/public/products` |
| `src/pages/reseller/ResellerPlaceOrder.tsx` | **M** | Reseller | Place reseller order | `/rs/reseller-orders`, `/rs/product-prices` |
| `src/pages/reseller/ResellerOrders.tsx` | **M** | Reseller | Reseller order list | `/rs/reseller-orders` |
| `src/pages/reseller/ResellerPaymentMethods.tsx` | **M** | Reseller | Reseller payment methods | `/rs/payment-methods` |
| `src/pages/reseller/ResellerPayments.tsx` | **M** | Reseller | Reseller payment requests | `/rs/payment-requests` |
| `src/pages/digital/DigitalPayment.tsx` | **M** | Digital | Digital checkout payment methods | `/public/digital-fe/payment-methods` |

## 1.5 Cleanup-only (Supabase reference removed, no data-layer change)

| File | C/M/D | Why |
|---|---|---|
| `src/components/DataInitializer.tsx` | **M** | Removed `isSupabaseConfigured` import + no-op guard |
| `src/components/AdminDataInitializer.tsx` | **M** | Removed `isSupabaseConfigured` import + no-op guard |
| `src/pages/reseller/ResellerLayout.tsx` | **M** | Removed `isSupabaseConfigured` import + no-op guard |
| `src/components/SiteSettingsInitializer.tsx` | **M** | Comment cleanup (Supabase → API) |
| `src/stores/useMohasagorStore.ts` | **M** | Removed dead Supabase import + proxy constants (fetches Mohasagor directly) |
| `src/integrations/supabase/client.ts` | **D** | Supabase client shim — directory deleted |
| `src/integrations/supabase/types.ts` | **D** | Orphaned Supabase type defs — deleted |

---

# 2. Backend — Controllers

All under `app/Http/Controllers/Api/`.

## 2.1 Created — "Frontend*" controllers (speak the React schema)

| File | C/M/D | Why | Module | Important methods | DB migrations |
|---|---|---|---|---|---|
| `Admin/FrontendOrderController.php` | **C** | Main orders in the frontend's exact schema (`#NN` order_code in body) | Orders | `orders`, `store`, `update`, `delete`, `checkout`, `confirmOrder`, `counterGet/Set/Next`, `customerHistory`, `customerDevices` | 000007, 000008 |
| `Admin/FrontendResellerController.php` | **C** | Resellers, reseller orders (`RO##`), payment requests, prices | Reseller | `resellers`, `storeReseller`, `updateReseller`, `orders`, `storeOrder`, `updateOrder`, `deleteOrder`, `nextOrderId`, `paymentRequests`, `productPrices`, `paymentMethods`, `publicReseller`, `publicResellerPrices` | 000009 (reseller), 000010 |
| `Admin/FrontendDigitalController.php` | **C** | Digital store products/orders/categories/blocks/users + upload | Digital | `products`, `productBySlug`, `storeProduct`, `categories`, `paymentMethods`, `orders`, `createOrder`, `blocks`, `users`, `myOrders`, `upload` | 000011, 000012 |
| `Admin/FrontendMarketingController.php` | **C** | Short links, YouTube sources, push subs/campaigns, SMS, sync | Marketing | `shortLinks`, `checkSlug`, `youtubeSources`, `pushSubscriptions(+count)`, `subscribe`, `pushCheck`, `pushCampaigns`, `sendPush`, `sendSms`, `markSmsSent`, `smsBalance`, `youtubeSync`, `deletePushSection` | 000013, 000014 |
| `Admin/FrontendDataController.php` | **C** | Courier settings/dispatch/ratio, ledger, employees, incomplete, follow-ups, audio, device/courier checks | Settings/Courier/Accounts/Team | `courierSettings`, `courierDispatch`, `courierCheck`, `deviceCheck`, `ledgerUpsert`, `ledgerDelete`, `courierRatio(All)`, `saveCourierRatio`, `employees(+CRUD)`, `employeeActivities`, `incompleteOrders(+ops)`, `followUps`, `audioList/Upload/Delete` | 000015, 000016, 000017 |
| `Admin/FrontendCourierController.php` | **C** | Steadfast / CarryBee dispatch proxy (replaces edge functions) | Courier | `steadfast`, `carrybee` | 000015 |
| `Admin/BackupController.php` | **C** | Generic per-table dump/restore + Google-Drive cloud-backup proxy | Backup | `backupTable`, `restoreTable`, `cloudBackup` | (all tables) |

## 2.2 Modified — existing controllers given frontend endpoints

| File | C/M/D | Why | Module | Methods added/changed | Endpoints |
|---|---|---|---|---|---|
| `Public/ShopController.php` | **M** | Short-link lookup returns `target_url`+`product_id`; split increment | Public Store | `redirectShortLink` (lookup-only), `incrementShortLinkClick` | `/public/short-links/{slug}`, `/{slug}/click` |
| `Admin/FraudController.php` | **M** | Added server-side order cooldown; serves public fraud endpoints | Fraud | `orderCooldown`, `checkBlocked`, `getFraudSettings`, `updateFraudSettings` | `/public/order-cooldown`, `/public/check-blocked`, `/public/fraud-settings` |
| `Admin/SettingsController.php` | **M** | Frontend settings blob + admin credential update | Settings | `getFrontendSettings`, `saveFrontendSettings`, `updateAdminCredentials` | `/public/site-settings`, `/admin/settings/frontend`, `/admin/settings/credentials` |
| `Admin/AccountController.php` | **M** | Accept frontend expense/deposit/stock fields; list returns arrays | Accounts | `expenseIndex`, `depositIndex`, `stockIndex`, `profitReport` | `/admin/expenses`, `/admin/deposits`, `/admin/stock`, `/admin/account-report` |
| `Public/CheckoutController.php` | **M** | Public checkout / incomplete / tracking / coupon | Public Store | `placeOrder`, `saveIncompleteOrder`, `trackOrder`, `validateCoupon` | `/public/orders`, `/public/incomplete-orders`, `/public/order-tracking`, `/public/coupon/validate` |
| `Auth/AdminLoginController.php` | **M** | Sanctum admin/employee login | Auth | `login`, `logout`, `me` | `/auth/admin/*` |
| `Auth/ResellerAuthController.php` | **M** | Reseller register (status=pending) + approval-gated login | Auth | `register`, `login`, `logout` | `/auth/reseller/*` |
| `Auth/DigitalAuthController.php` | **M** | Digital customer register/login (Sanctum) | Auth | `register`, `login`, `logout` | `/auth/digital/*` |

> Resource controllers `Admin/CategoryController`, `ProductController`, `CouponController`, `VariationController`, `BlogController`, `LandingPageController`, `OrderController`, `EmployeeController`, `ResellerController`, `MarketingController`, `DigitalAdminController` back the corresponding frontend stores and were aligned to the frontend schema via the migrations below; their resource routes are consumed directly by the rewired stores.

---

# 3. Models (`app/Models/`)

Models were **Modified** to accept the React schema (expanded `$fillable` / `$guarded = []`, casts for JSON columns, removed colliding eager-loads, string-keyed PKs).

| Model | Module | Key change |
|---|---|---|
| `Product.php` | Catalog | title/long_description/category-slug/rating/affiliate fields, status as string |
| `Category.php` | Catalog | icon, lucide_icon, parent_id, is_main, custom_link, product_count |
| `Coupon.php` | Catalog | product_ids, discount_type/value |
| `Variation.php` | Catalog | type column |
| `BlockedCustomer.php` | Fraud | customer_name, blocked_at, linked_group |
| `BlogPost.php` | Content | date column, status string |
| `LandingPage.php` | Content | status as string |
| `Order.php` | Orders | order_code, customer/phone/address/total, customer_ip/fingerprint, sms_sent JSON |
| `Counter.php` | Orders | atomic order-number counters |
| `IncompleteOrder.php` | Orders | `incrementing=false`, string key, `$guarded=[]` |
| `FollowUpData.php` | Orders | status, note, courier_locked, stock_type |
| `Expense.php` / `Deposit.php` | Accounts | date, employee_id, string ids (return-ledger) |
| `StockEntry.php` | Accounts | sell_price, damage columns |
| `Employee.php` | Team | assigned/hidden_reseller_ids, auto_assign_main (+casts) |
| `EmployeeActivity.php` | Team | employee_name, order_id, timestamp |
| `Reseller.php` | Reseller | status (pending/active), serial_number, referral_code |
| `ResellerOrder.php` | Reseller | order_code, customer_*, totals, paid_return_amount |
| `ResellerPaymentMethod.php` | Reseller | method/payment_method columns |
| `ResellerProductPrice.php` | Reseller | reseller+product price upsert |
| `PaymentRequest.php` | Reseller | method↔payment_method, account_number |
| `DigitalProduct.php` | Digital | slug, product_type as VARCHAR |
| `DigitalCategory.php` / `DigitalPaymentMethod.php` | Digital | name-keyed, nullable method_name |
| `DigitalOrder.php` | Digital | `$guarded=[]`, order_number, price, trx_id |
| `DigitalCustomer.php` | Digital | Sanctum auth (digital_customer guard) |
| `ShortLink.php` | Marketing | target_url, product_id |
| `YoutubeSource.php` | Marketing | source_type/value, sync metadata |
| `PushSubscription.php` / `PushCampaign.php` | Marketing | section, is_active / campaign history |
| `SmsCampaign.php` / `SmsQueue.php` | Marketing | SMS history/queue |
| `CourierDispatch.php` | Courier | courier_type, courier_status, consignment_id, tracking_code |
| `CourierRatioCache.php` | Courier | all_count, delivered, returned, checked_at (removed datetime cast) |
| `SiteSetting.php` | Settings | key/value blob store (`get`/`set`) |
| `Admin.php` | Auth | email + Hash password, `$hidden=['password']` |
| `BackupLog.php` | Backup | backup run metadata |

---

# 4. Routes

| File | C/M/D | Why | Notes |
|---|---|---|---|
| `routes/api.php` | **M** | All migration endpoints registered | Groups: `public/*` (no auth), `admin/*` (`auth:admin,employee`), `admin/mk/*` (Marketing), `admin/data/*` (Data/Courier/Backup/Audio), `admin/courier/*` (dispatch proxy), `rs/*` (`auth:admin,employee,reseller` shared), `reseller/*` (portal), `auth/*` (4 guards). 282 routes total. |

**Key endpoint families added by the migration:**
`/public/checkout-order`, `/public/confirm-order`, `/public/order-cooldown`, `/public/short-links/{slug}` (+`/click`), `/public/digital-fe/*`, `/public/courier-check`, `/public/device-check`, `/public/courier-ratio`, `/public/incomplete-orders`, `/public/send-sms`, `/public/push-subscribe`, `/public/push-check`, `/admin/fe-orders*`, `/admin/counter/{key}*`, `/admin/customer-history`, `/admin/customer-devices`, `/admin/mk/*`, `/admin/data/*` (courier-settings, courier-dispatch, courier-ratio, courier-check, ledger-upsert/delete, employees, employee-activities, incomplete-orders*, follow-ups, audio, backup-table, restore-table, cloud-backup), `/admin/courier/steadfast`, `/admin/courier/carrybee`, `/rs/*`, `/reseller/*`, `/auth/{admin,reseller,digital}/*`.

---

# 5. Migrations (`database/migrations/`) — all **Created**

| File | Module | Purpose |
|---|---|---|
| `2024_01_02_000001_add_category_fields.php` | Catalog | Category hierarchy: icon, lucide_icon, parent_id, is_main, custom_link, product_count |
| `2024_01_02_000002_align_products_to_frontend.php` | Catalog | Product title/long_description/category slug/rating/affiliate fields |
| `2024_01_02_000003_products_status_to_string.php` | Catalog | Widen product `status` enum → VARCHAR (published/draft) |
| `2024_01_02_000004_align_coupon_variation_block.php` | Catalog/Fraud | coupon.product_ids, variation.type, blocked_customers fields |
| `2024_01_02_000005_add_blog_date.php` | Content | blog_posts.date |
| `2024_01_02_000006_landing_status_string.php` | Content | Landing page `status` → VARCHAR |
| `2024_01_02_000007_align_orders_to_frontend.php` | Orders | orders: order_code, customer/phone/address/total, ip/fingerprint, sms_sent |
| `2024_01_02_000008_orders_legacy_nullable.php` | Orders | Make legacy `invoice_number`/`customer_name` nullable |
| `2024_01_02_000009_align_account_tables.php` | Accounts | expenses/deposits date+employee_id, stock sell_price/damage |
| `2024_01_02_000009_align_reseller_to_frontend.php` | Reseller | reseller_orders order_code/customer/totals; invoice_number nullable |
| `2024_01_02_000010_reseller_payment_method_cols.php` | Reseller | reseller payment method/payment_method columns |
| `2024_01_02_000011_align_digital_to_frontend.php` | Digital | digital products/orders/categories frontend fields |
| `2024_01_02_000012_digital_enum_fixes.php` | Digital | digital_products.product_type & payment method_name → VARCHAR nullable |
| `2024_01_02_000013_shortlink_target_url.php` | Marketing | short_links.target_url + product_id |
| `2024_01_02_000014_shortlink_dest_nullable.php` | Marketing | Make short_links.destination_url nullable |
| `2024_01_02_000015_courier_dispatch_cols.php` | Courier | courier_dispatch courier_type/status/consignment/tracking |
| `2024_01_02_000016_followup_ratio_cols.php` | Orders/Courier | follow_up_data status/note/courier_locked; courier_ratio_cache cols |
| `2024_01_02_000017_align_employee_incomplete.php` | Team/Orders | employees assigned/hidden_reseller_ids/auto_assign; incomplete_orders alignment |

---

# 6. Services (`app/Services/`)

Backend services that back the migrated endpoints (replacing Supabase Edge Functions).

| File | C/M/D | Why | Used by |
|---|---|---|---|
| `SmsService.php` | Used | bulksmsbd send (replaces `bulksms-send` edge fn) | `FrontendMarketingController@sendSms` |
| `PushNotificationService.php` | Used | Web-push send (replaces `send-push` edge fn) | `FrontendMarketingController@sendPush` |
| `FraudCheckService.php` | Used | Blocked/fraud helpers | `FraudController` |
| `BackupService.php` | Used | Backup helpers | Backup module |
| `CourierService.php` | Superseded | Phase-1 Steadfast/CarryBee dispatch; the frontend now uses `FrontendCourierController` (action proxy). Retained for non-frontend/server flows. | — |

> The courier proxy logic the React frontend calls lives in `FrontendCourierController` (action-based, credentials in body), not in `CourierService`.

---

# 7. Middleware (`app/Http/Middleware/`)

Sanctum guard middleware enforcing the four token scopes used by the migrated API.

| File | C/M/D | Why | Guard |
|---|---|---|---|
| `AdminAuth.php` | Used | Admin/employee API auth | `auth:admin,employee` |
| `ResellerAuth.php` | Used | Reseller portal + shared `/rs/*` | `auth:...,reseller` |
| `DigitalCustomerAuth.php` | Used | Digital customer endpoints | `auth:digital_customer` |
| `EmployeePermission.php` | Used | Per-employee permission gates | admin/employee |

---

# 8. Config (`config/`)

| File | C/M/D | Why | Detail |
|---|---|---|---|
| `config/auth.php` | **M** | Defines the four Sanctum guards the migrated API relies on | Guards: `admin`, `employee`, `reseller`, `digital_customer` (driver `sanctum`) |
| `.env` | **M** | API base + optional external-service keys | `VITE_API_BASE_URL=/api`; optional `STEADFAST_*`, `CARRYBEE_API_BASE`, `BULKSMS_API_KEY`, `BDCOURIER_API_KEY`, `YOUTUBE_API_KEY`, `CLOUD_BACKUP_URL/KEY`, VAPID keys |

---

# 9. Assets

| Item | C/M/D | Why |
|---|---|---|
| `public/storage` (symlink) | **C** | `php artisan storage:link` — public disk for audio/digital uploads, replacing Supabase Storage. Uploads return `/storage/...` paths. |
| `public/build/*` | **M** | Compiled SPA (Vite). Regenerated by `npm run build`; contains **0** Supabase references. |

---

# 10. Totals

> Counts reflect files attributable to the Supabase→Laravel migration (no git history available). Backend resource controllers and pre-existing models/services that were *aligned* are counted under Modified; tables created purely as alignment migrations are counted once as migration files.

### Files Created
- **Backend controllers:** 7 (`FrontendOrderController`, `FrontendResellerController`, `FrontendDigitalController`, `FrontendMarketingController`, `FrontendDataController`, `FrontendCourierController`, `BackupController`)
- **Frontend:** 1 (`src/lib/api.ts`)
- **Migrations:** 18
- **Assets:** 1 (`public/storage` symlink)

**Total files created: 27**

**Frontend (65):**
- **Stores:** 29 (28 rewired to `api` + `useMohasagorStore` cleanup)
- **Libraries:** 8 (`fraud-check`, `order-cooldown`, `return-ledger`, `bulksms`, `push-subscribe`, `backup-utils`, `backup-registry`, `sql-dump`)
- **Pages/components:** 28 (24 rewired to `api` + 4 cleanup: `DataInitializer`, `AdminDataInitializer`, `ResellerLayout`, `SiteSettingsInitializer`)

**Backend (~38):**
- **Controllers:** 8 directly modified (`ShopController`, `FraudController`, `SettingsController`, `AccountController`, `CheckoutController`, `AdminLoginController`, `ResellerAuthController`, `DigitalAuthController`) + ~11 resource controllers aligned to the frontend schema
- **Models:** ~35 aligned (`$fillable` / casts / keys)

**Routes / Config / Assets (4):** `routes/api.php`, `config/auth.php`, `.env`, `public/build`

**Total files modified: ~122** (65 frontend + ~19 controllers + ~35 models + 3 routes/config/assets)

### Files Deleted
- `src/lib/supabase-db.ts`
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`

**Total files deleted: 3**

---

## Final verification snapshot
- Source audit (`src/`): `db.from()` **0**, `supabase.auth` **0**, `storage.from()` **0**, `rpc()` **0**, `functions.invoke()` **0**, `channel()` **0**, Supabase SDK imports **0**, any `supabase` string **0**.
- `@supabase/supabase-js` removed from `package.json`; `src/integrations/` directory deleted.
- Build: ✅ `npm run build` green; compiled bundle contains **0** Supabase references.
- One intentionally retained external service: the optional **Google-Drive cloud backup**, now proxied server-side via `/admin/data/cloud-backup` (the browser only talks to Laravel).

*Generated as documentation only — no application logic was modified.*
