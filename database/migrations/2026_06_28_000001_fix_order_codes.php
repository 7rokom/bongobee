<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Fix two order-code bugs discovered during Phase-3 audit:
//
// 1. Main orders placed via the Phase-1 checkout (CheckoutController::placeOrder)
//    stored their sequential number in `invoice_number` but never set `order_code`.
//    FrontendOrderController::index() filters whereNotNull('order_code'), so those
//    orders are invisible in the admin UI. Backfill order_code from invoice_number.
//
// 2. Reseller order codes were generated without the leading '#' (e.g. "RO1001").
//    The expected format is "#RO1001". Normalize all existing reseller codes.
return new class extends Migration {
    public function up(): void
    {
        // Backfill order_code for main orders that only have invoice_number.
        // Skips rows where order_code already exists (Phase-3 orders).
        // Skips if the derived code would collide with an existing order_code.
        DB::statement("
            UPDATE orders AS o
            JOIN (
                SELECT id, CONCAT('#', CAST(invoice_number AS CHAR)) AS derived
                FROM orders
                WHERE order_code IS NULL
                  AND invoice_number IS NOT NULL
            ) AS cand ON o.id = cand.id
            LEFT JOIN (SELECT order_code FROM orders WHERE order_code IS NOT NULL) AS existing
              ON existing.order_code = cand.derived
            SET o.order_code = cand.derived
            WHERE existing.order_code IS NULL
        ");

        // Normalize reseller order codes: 'RO1001' → '#RO1001'.
        // The unique constraint is preserved because all existing codes are distinct.
        DB::statement("
            UPDATE reseller_orders
            SET order_code = CONCAT('#', order_code)
            WHERE order_code IS NOT NULL
              AND order_code NOT LIKE '#%'
        ");

        // Align the reseller counter baseline to 1000 (matching main order numbering)
        // so the first new reseller order is #RO1001, not #RO1 or #RO3.
        DB::statement("
            UPDATE counters
            SET value = 1000
            WHERE id = 'reseller_order_number' AND value < 1000
        ");
    }

    public function down(): void
    {
        // Strip # from reseller order codes (reverse normalization).
        DB::statement("
            UPDATE reseller_orders
            SET order_code = SUBSTRING(order_code, 2)
            WHERE order_code LIKE '#RO%'
        ");

        // Remove backfilled order_code values (Phase-1 orders had NULL originally).
        // This is a best-effort reversal; it only removes codes we added in up().
        // We identify them by the presence of a matching invoice_number.
        DB::statement("
            UPDATE orders AS o
            JOIN (
                SELECT id
                FROM orders
                WHERE order_code IS NOT NULL
                  AND invoice_number IS NOT NULL
                  AND order_code = CONCAT('#', CAST(invoice_number AS CHAR))
            ) AS was_backfilled ON o.id = was_backfilled.id
            SET o.order_code = NULL
        ");
    }
};
