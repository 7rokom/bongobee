<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// The React order store uses order_code/customer/phone; the legacy NOT NULL
// invoice_number & customer_name must allow null.
return new class extends Migration {
    public function up(): void
    {
        DB::statement("ALTER TABLE orders MODIFY invoice_number BIGINT NULL");
        DB::statement("ALTER TABLE orders MODIFY customer_name VARCHAR(255) NULL");
        DB::statement("ALTER TABLE orders MODIFY customer_phone VARCHAR(255) NULL");
        DB::statement("ALTER TABLE orders MODIFY customer_address TEXT NULL");
    }

    public function down(): void
    {
        // no-op (kept nullable)
    }
};
