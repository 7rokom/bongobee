<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::statement("ALTER TABLE digital_products MODIFY product_type VARCHAR(50) NULL");
        DB::statement("ALTER TABLE digital_payment_methods MODIFY method_name VARCHAR(255) NULL");
    }

    public function down(): void {}
};
