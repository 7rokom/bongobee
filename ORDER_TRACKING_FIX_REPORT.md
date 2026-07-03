# Order Tracking Fix Report

**Date:** 2026-07-01  
**Scope:** Order tracking system only — no other modules modified.  
**Status:** COMPLETE ✅

---

## Root Cause

Two independent failures made order tracking non-functional for all users:

### 1. Backend — `CheckoutController::trackOrder()` (primary bug)

```php
// BEFORE (broken):
$order = Order::where('customer_phone', $request->phone)
    ->where('invoice_number', $request->invoice)
    ->first();
```

- Only queried the `orders` table — `reseller_orders` was never searched.
- Used `invoice_number` (a legacy bigint column) — Phase-3 orders set `order_code` (`#1001` format) and leave `invoice_number` NULL. Every Phase-3 order lookup returned 404.
- Required both `phone` **and** `invoice` — but the tracking UI has a code-only search mode that sends only the order code.

### 2. Frontend — `OrderTracking.tsx` (secondary bug)

The component fetched order data through **admin-protected store endpoints**:

```typescript
// BEFORE (broken — requires auth tokens):
await Promise.all([fetchOrders(), fetchResellerOrders()]);
// fetchOrders()        → GET /admin/fe-orders       (requires admin token)
// fetchResellerOrders() → GET /rs/reseller-orders    (requires reseller/admin token)
```

A public customer visiting `/order-tracking` has no Sanctum token. Both API calls silently return `[]` (stores catch 401 and swallow the error). The search then runs over two empty arrays → always "not found."

Even if the backend had been correct, the frontend would still have found nothing.

---

## Files Changed

| File | Change |
|------|--------|
| `app/Http/Controllers/Api/Public/CheckoutController.php` | Rewrote `trackOrder()` + added 5 private helper methods; added `ResellerOrder` import |
| `src/pages/OrderTracking.tsx` | Removed admin-protected store fetches; added direct `GET /api/public/order-tracking` call |

No new routes, no migrations, no schema changes.

---

## API Changes

### Endpoint (unchanged)
```
GET /api/public/order-tracking
```

### Request parameters (new — fully backwards-compatible)

| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | string | Order code in any format: `1001`, `#1001`, `RO1001`, `#RO1001` |
| `phone` | string | Customer phone — returns all orders for that phone |
| `invoice` | string | Legacy alias for `code` (old callers that sent `invoice=777`) |

At least one of `code`, `phone`, or `invoice` is required (422 if none provided).  
When `code` is provided, `phone` acts as an optional verification filter (backwards-compat with old `phone+invoice` callers).

### Response (new unified format)

```json
{
  "orders": [
    {
      "id": "#1001",
      "source": "customer",
      "customer": "Karim",
      "phone": "01711000001",
      "address": "Dhaka",
      "items": [
        { "name": "Product A", "qty": 2, "price": 350, "image": null }
      ],
      "delivery_charge": 60,
      "total": 760,
      "status": "পেন্ডিং",
      "date": "১ জুলাই ২০২৬"
    }
  ]
}
```

`source` is `"customer"` for main orders and `"reseller"` for reseller orders. The customer UI treats both identically.

**Error responses (unchanged):**
- `404` — order not found
- `422` — no search parameters provided

---

## Code Search Logic

### Order code normalization

```
Input       → strip leading "#" → is_numeric or "RO" prefix?
─────────────────────────────────────────────────────────────
"1001"      → "1001"   → numeric  → search orders  (order_code="#1001", id="#1001", invoice_number=1001)
"#1001"     → "1001"   → numeric  → search orders  (same)
"RO1001"    → "RO1001" → RO prefix → search reseller_orders (order_code="#RO1001", order_code="RO1001", id="RO1001")
"#RO1001"   → "RO1001" → RO prefix → search reseller_orders (same)
"ro1001"    → "ro1001" → stripos case-insensitive → search reseller_orders (same)
```

### Main order lookup (`orders` table)
Searches in priority order, stops at first match:
1. `order_code = '#1001'` — Phase-3 format
2. `id = '#1001'` — Legacy Phase-1 (PK was the order code including `#`)
3. `id = '1001'` — Legacy without `#`
4. `invoice_number = 1001` — Very old format (numeric input only)

### Reseller order lookup (`reseller_orders` table)
1. `order_code = '#RO1001'` — Phase-3 format
2. `order_code = 'RO1001'` — without `#`
3. `id = 'RO1001'` — Legacy (PK was `RO03` style)

### Phone search
Searches `orders.phone OR orders.customer_phone` (covers both Phase-3 and legacy columns), plus `reseller_orders.customer_phone`. Returns all matches across both tables.

### Items normalization (server-side)

Main order items (`{name, qty, price, image}`) and reseller order items (`{productTitle, qty, sellingPrice, image}`) are both mapped to the unified response format `{name, qty, price, image}` before returning.

---

## Database Impact

- **No schema changes.** Zero migrations added or modified.
- Reads from `orders` and `reseller_orders` tables already in use.
- Phone search on `orders` uses both `phone` and `customer_phone` columns — covered by existing single-column indexes. No new indexes needed for the test data volumes; a composite index `(phone, customer_phone)` or covering index on `customer_phone` can be added if the table grows large (noted as future optimization, not a blocker).

---

## Test Results

All 14 automated API tests passed against `http://bongobee-laravel.test`.

| # | Test | Input | Expected | Result |
|---|------|-------|----------|--------|
| T01 | Main order — with `#` prefix | `code=#TEST-MAIN-001` | 200, source=customer | **PASS** |
| T02 | Main order — without `#` prefix | `code=TEST-MAIN-001` | 200, source=customer | **PASS** |
| T03 | Legacy main — `id` column as order code | `code=#LEGACY-07` | 200, source=customer | **PASS** |
| T04 | Legacy main — `invoice_number` search | `code=777` | 200, source=customer | **PASS** |
| T05 | Phone search → main order | `phone=01711000001` | 200, source=customer | **PASS** |
| T06 | Phone search → legacy `customer_phone` | `phone=01722000001` | 200, source=customer | **PASS** |
| T07 | Reseller order — with `#RO` prefix | `code=#ROTEST001` | 200, source=reseller | **PASS** |
| T08 | Reseller order — without `#` prefix | `code=ROTEST001` | 200, source=reseller | **PASS** |
| T09 | Reseller order — lowercase `ro` | `code=rotest001` | 200, source=reseller | **PASS** |
| T10 | Old-style reseller — `id` column | `code=RO-OLD-03` | 200, source=reseller | **PASS** |
| T11 | Phone search → reseller order | `phone=01733000001` | 200, source=reseller | **PASS** |
| T12 | Phone search → old-style reseller | `phone=01744000001` | 200, source=reseller | **PASS** |
| T13 | Non-existent order | `code=#FAKE-ZZZZ` | 404 | **PASS** |
| T14 | No parameters | *(none)* | 422 | **PASS** |

TypeScript check: `npx tsc --noEmit` → **0 errors**.

---

## What Was NOT Changed

- Route: `GET /api/public/order-tracking` — **unchanged**
- No auth requirements added or removed
- Admin order views (`/admin/fe-orders`) — **untouched**
- Reseller order views (`/rs/reseller-orders`) — **untouched**
- `useOrderStore`, `useResellerStore` — **untouched** (still used by admin/reseller panels)
- All other controllers, models, middleware — **untouched**
- Database schema — **no migrations**

---

## Rollback Plan

### Backend rollback (< 1 minute)

Revert `app/Http/Controllers/Api/Public/CheckoutController.php` — replace the new `trackOrder()` and helpers with the original:

```php
public function trackOrder(Request $request): JsonResponse
{
    $request->validate(['phone' => 'required|string', 'invoice' => 'required']);
    $order = Order::where('customer_phone', $request->phone)
        ->where('invoice_number', $request->invoice)
        ->first();
    if (!$order) {
        return response()->json(['message' => 'Order not found.'], 404);
    }
    return response()->json($order);
}
```

Remove `use App\Models\ResellerOrder;` import.

### Frontend rollback (requires rebuild)

Revert `src/pages/OrderTracking.tsx` to restore the original imports and `handleSearch` function that read from `useOrderStore` and `useResellerStore`. Run `npm run build` to regenerate `public/build/`.

**Note:** Rolling back the frontend restores the previous broken behaviour (store fetches fail without auth tokens → always "not found"). The backend rollback is safe to do alone without breaking anything further.
