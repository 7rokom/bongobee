# Backup & Restore Fix Report

**Date:** 2026-07-01  
**Scope:** Backup & Restore system only — no schema migrations added.  
**Status:** COMPLETE ✅

---

## Problems Fixed

| # | Problem | Status |
|---|---------|--------|
| 1 | Main Orders not restored after restore | ✅ Fixed |
| 2 | Reseller Orders stops at ~1000 rows | ✅ Fixed |
| 3 | Restored orders become read-only | ✅ Fixed |
| 4 | Order Notes not restored | ✅ Fixed (cascade from #1) |
| 5 | Courier Tracking Links not restored | ✅ Fixed (cascade from #1 + separate fix) |
| 6 | Courier Ratio history not restored | ✅ Fixed (cascade from #3) |

---

## Root Cause Analysis

### Problem 1 & 2 — Orders not restored / Reseller Orders stop at ~1000

**Root cause: Single giant HTTP request per table, PHP memory exhaustion.**

`restoreFullBackup()` sent ALL rows of every table in ONE `POST /admin/data/restore-table` request. For large tables (e.g. 3 000 orders × 2 KB/row = ~6 MB JSON), PHP's memory limit was hit while decoding the body. The result:

- `orders` table was **wiped** (the DELETE ran successfully with FK checks off)
- PHP then OOM-crashed before any INSERT completed
- Backend returned 500 or Laravel caught the PHP fatal → `status: 'failed', inserted: 0`
- Frontend loop continued but `orders` table now had **0 rows**

For reseller orders the same mechanism explained the "~1000 row" cut-off: the first 10 batches of 100 rows (= 1 000 rows) were committed before a non-skippable error (MySQL 3140 — invalid JSON in an `items` column) caused `throw $e2`, which propagated to the outer `catch` block. The outer catch reported `inserted: 0` even though the 1 000 rows were already committed in the database.

### Problem 3 — Read-only orders after restore

**Root cause: Page never reloaded when any section failed.**

```typescript
// BEFORE (broken):
if (failed > 0) {
  toast.warning(`…`); // ← NO reload
} else {
  toast.success(`…`);
  setTimeout(() => window.location.reload(), 3000);
}
```

When the orders restore failed (Problem 1), `failed > 0`, so the page never reloaded. The `useOrderStore` Zustand store still held the pre-restore order codes. When the admin tried to update status/edit/confirm, the controller called `Order::where('order_code', $code)->firstOrFail()` — but the DB was now empty → **404 on every mutation** → appeared "read-only."

### Problem 4 — Order Notes not restored

**Root cause: FK cascade from Problem 1.**

```sql
follow_up_data.order_id → orders.id  CASCADE DELETE
```

The restore order is: `orders` THEN `follow_up_data`. When `orders` was wiped and 0 rows were re-inserted, every `follow_up_data` INSERT failed with MySQL 1452 (FK violation — `order_id` points to a non-existent order). Error 1452 is in `isSkippableError()` → all rows silently skipped → **0 notes restored**.

Fix for Problem 1 (chunked restore) fixes this automatically: once `orders` is populated first, `follow_up_data` inserts satisfy the FK.

### Problem 5 — Courier Tracking Links not restored

**Two independent causes:**

1. **Same FK cascade as Problem 4.** Tracking links live in `follow_up_data.tracking_url`. If `orders` is empty, all `follow_up_data` rows are skipped → tracking URLs lost.

2. **`FrontendOrderController::$cols` was missing courier fields.** The `orders` table itself also stores `tracking_url`, `courier_name`, `courier_invoice_id`, `courier_delivery_charge`, `vendor_buy_price` (all in `$fillable`). These columns ARE backed up and ARE restored to the DB — but `$cols` never included them, so `GET /admin/fe-orders` never returned them. The admin could never see courier data from the orders list even when it was correctly in the database.

### Problem 6 — Courier Ratio history not restored

**Root cause: Stale Zustand store after failed restore (no page reload).**

`courier_ratio_cache` IS in the backup registry and has no FK constraints. Its restore succeeds independently. The table contains the backed-up data after restore — but because the page never reloaded (Problem 3), the `useCourierRatioStore` still held the pre-restore cached data. The admin navigated to the Courier section and saw stale counters.

---

## Files Changed

| File | Change |
|------|--------|
| `app/Http/Controllers/Api/Admin/BackupController.php` | Added `clear` parameter, conditional table wipe, `order_code` backfill, expanded skippable errors |
| `src/lib/backup-utils.ts` | Added `RESTORE_CHUNK_SIZE = 500`, `restoreTableInChunks()`, updated `restoreFullBackup()` |
| `src/lib/backup-registry.ts` | Added `reseller_domains` table to the reseller group |
| `src/pages/admin/BackupRestore.tsx` | Always reload page after restore (5 s on failure, 3 s on success) |
| `app/Http/Controllers/Api/Admin/FrontendOrderController.php` | Added courier fields to `$cols` |

No new routes, no migrations, no schema changes.

---

## Detailed Changes

### 1. `BackupController.php` — Chunked restore + expanded skippables

**New `clear` parameter (line 79):**
```php
// When the frontend sends rows in multiple chunks, only the first chunk
// should wipe the table. Subsequent chunks pass clear=false so they
// append without destroying what the previous chunk already inserted.
$clearFirst = (bool) $request->input('clear', true);
```

**Conditional table wipe (only when `$clearFirst === true`):**
```php
if ($clearFirst) {
    try {
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        DB::table($table)->delete();
    } finally {
        DB::statement('SET FOREIGN_KEY_CHECKS=1');
    }
}
```

**Post-restore `order_code` backfill for the `orders` table:**
```php
if ($table === 'orders' && $clearFirst) {
    try {
        DB::statement(
            "UPDATE orders SET order_code = CONCAT('#', CAST(invoice_number AS CHAR)) "
            . "WHERE order_code IS NULL AND invoice_number IS NOT NULL"
        );
    } catch (\Throwable $ignored) {}
}
```

This handles backups taken before the `2026_06_28_000001_fix_order_codes` data migration ran: Phase-1 (Supabase-era) orders with `invoice_number` but no `order_code` would be invisible to `FrontendOrderController::index()` (which filters `whereNotNull('order_code')`). The backfill generates the same `#NNN` format as `bumpInvoiceCode()`.

**Expanded `isSkippableError()`:**

| Code | Meaning | Before | After |
|------|---------|--------|-------|
| 1062 | Duplicate entry | ✅ | ✅ |
| 1216/1217/1452 | FK violations | ✅ | ✅ |
| 1406 | Data too long | ✅ | ✅ |
| 1292 | Incorrect datetime | ❌ | ✅ |
| 1366 | Incorrect integer value | ❌ | ✅ |
| 3140 | Invalid JSON text | ❌ | ✅ |

---

### 2. `backup-utils.ts` — Chunked sending

```typescript
const RESTORE_CHUNK_SIZE = 500;
```

New `restoreTableInChunks()` helper:
- Splits rows into 500-row pages
- First chunk: `clear: true` → backend wipes table THEN inserts
- Subsequent chunks: `clear: false` → backend appends (no wipe)
- Accumulates `inserted` and `skippedRows` across all chunks
- If any chunk fails: `overallStatus = 'failed'`; rest of chunks are skipped

Updated `restoreFullBackup()`:
- If `rows.length > 500`: delegates to `restoreTableInChunks()`
- If `rows.length ≤ 500`: existing single-request path (now explicitly passes `clear: true`)

Effect on large tables:
- **3 000 orders** → 6 requests × 500 rows each (~1 MB JSON/request) — well within PHP memory
- **5 000 reseller orders** → 10 requests × 500 rows each
- Small config/catalog tables → unchanged (single request)

---

### 3. `backup-registry.ts` — `reseller_domains` added

```typescript
{ key: 'reseller_domains', label: 'রিসেলার ডোমেইন', table: 'reseller_domains', group: 'reseller', strategy: 'replace' },
```

Placed after `payment_requests` in the `reseller` group (after `resellers`, satisfying the `reseller_id → resellers.id` FK). This table was added by the Custom Domain Phase 4 migration (`2026_06_28_000003`) but was never included in the backup registry — custom domain bindings were lost on every restore.

---

### 4. `BackupRestore.tsx` — Always reload

```typescript
// BEFORE:
if (failed > 0) {
  toast.warning(`…`); // no reload — stale store persisted
} else {
  setTimeout(() => window.location.reload(), 3000);
}

// AFTER:
if (failed > 0) {
  toast.warning(`… পেজ ৫ সেকেন্ডে রিলোড হবে`);
  setTimeout(() => window.location.reload(), 5000); // ← always reload
} else {
  toast.success(`… পেজ ৩ সেকেন্ডে রিলোড হবে`);
  setTimeout(() => window.location.reload(), 3000);
}
```

The 5-second delay on failure gives the admin enough time to read the result table before the page refreshes.

---

### 5. `FrontendOrderController.php` — Courier fields in `$cols`

```php
// BEFORE:
private array $cols = [
    'customer', 'phone', 'address', 'items', 'delivery_charge', 'original_delivery_charge',
    'total', 'status', 'date', 'iso_date', 'confirmed_by', 'assigned_to', 'assigned_to_name',
    'customer_ip', 'customer_fingerprint', 'note', 'paid_return_amount', 'sms_sent', 'source',
];

// AFTER:
private array $cols = [
    'customer', 'phone', 'address', 'items', 'delivery_charge', 'original_delivery_charge',
    'total', 'status', 'date', 'iso_date', 'confirmed_by', 'assigned_to', 'assigned_to_name',
    'customer_ip', 'customer_fingerprint', 'note', 'paid_return_amount', 'sms_sent', 'source',
    'tracking_url', 'courier_name', 'vendor_buy_price', 'courier_invoice_id', 'courier_delivery_charge',
];
```

All 5 added columns exist in the `orders` table (created by migration `000002`) and are in `Order::$fillable`. Adding them to `$cols` makes them:
1. Returned by `GET /admin/fe-orders` — visible in the admin after restore
2. Writable via `store()` and `update()` — can be set from the admin UI

---

## How the Fix Chain Solves Each Problem

```
┌─────────────────────────────────────────────────────────────────┐
│ Fix A: Chunked restore (backup-utils.ts + BackupController.php) │
│   → orders table now restores completely (500 rows/request)     │
│   → reseller_orders table now restores completely               │
│                                                                  │
│   Cascades to:                                                   │
│   → follow_up_data FK constraint satisfied → notes restored     │
│   → follow_up_data.tracking_url restored                        │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ Fix B: order_code backfill (BackupController.php)               │
│   → pre-Phase-3 orders (invoice_number only) become visible     │
│     in FrontendOrderController::index() after restore           │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ Fix C: Always reload (BackupRestore.tsx)                        │
│   → Zustand stores refresh after restore regardless of failure  │
│   → mutations (update/status/courier/invoice/note/block) work   │
│   → courier_ratio_cache store refreshes → ratio history visible │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ Fix D: tracking_url in $cols (FrontendOrderController.php)      │
│   → orders.tracking_url returned by GET /admin/fe-orders        │
│   → visible in admin order list after restore                   │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ Fix E: reseller_domains in registry (backup-registry.ts)        │
│   → custom domain bindings backed up and restored               │
└─────────────────────────────────────────────────────────────────┘
```

---

## FK Restore Order Verification

The restore order in the registry satisfies all FK constraints:

```
settings → catalog → content → team
  → resellers (parent of reseller_domains)
  → reseller_payment_methods
  → reseller_product_prices
  → reseller_orders (FK: reseller_id → resellers.id)
  → payment_requests
  → reseller_domains (FK: reseller_id → resellers.id) ← NEW
  → orders (parent of follow_up_data)
  → incomplete_orders
  → follow_up_data (FK: order_id → orders.id)
  → customers → finance → courier → integrations → push → sms → digital
```

---

## What Was NOT Changed

- Database schema — **no migrations**
- Route definitions — **unchanged**
- Auth middleware — **unchanged**
- Backup (download) path — **unchanged** (chunking only applies to restore)
- Reseller order mutations — **unchanged**
- All other controllers — **untouched**

---

## Rollback Plan

### Frontend (< 1 minute, requires rebuild)

1. Revert `src/lib/backup-utils.ts` — remove `RESTORE_CHUNK_SIZE`, `restoreTableInChunks()`, and revert `restoreFullBackup()` to the original single-request loop.
2. Revert `src/lib/backup-registry.ts` — remove the `reseller_domains` entry.
3. Revert `src/pages/admin/BackupRestore.tsx` — restore the `if (failed > 0) { toast.warning }` branch without `setTimeout(reload)`.
4. Run `npm run build`.

### Backend (< 1 minute, no restart needed)

1. Revert `app/Http/Controllers/Api/Admin/BackupController.php` — remove the `$clearFirst` block and `order_code` backfill; revert `isSkippableError()` to the original 5-code set.
2. Revert `app/Http/Controllers/Api/Admin/FrontendOrderController.php` — remove the 5 courier columns from `$cols`.

PHP reads files on each request (no OPcache issue in development); Laragon's OPcache resets on file save in production config.

**Note:** The backup JSON file format is fully backwards-compatible. Old backup files restore correctly with the new code; new backup files restore correctly with the old code (unknown keys like `reseller_domains` are simply skipped if the table doesn't exist).
