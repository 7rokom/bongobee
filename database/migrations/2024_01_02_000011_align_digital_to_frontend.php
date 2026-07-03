<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

// Phase 3 Module 12: align digital_* tables to the React frontend schema.
return new class extends Migration {
    public function up(): void
    {
        Schema::table('digital_products', function (Blueprint $table) {
            if (!Schema::hasColumn('digital_products', 'long_description')) $table->longText('long_description')->nullable();
            if (!Schema::hasColumn('digital_products', 'category')) $table->string('category')->nullable();
            if (!Schema::hasColumn('digital_products', 'meta_keywords')) $table->string('meta_keywords')->nullable();
        });
        DB::statement("ALTER TABLE digital_products MODIFY category_id CHAR(36) NULL");
        DB::statement("ALTER TABLE digital_products MODIFY status VARCHAR(50) NOT NULL DEFAULT 'published'");

        Schema::table('digital_payment_methods', function (Blueprint $table) {
            if (!Schema::hasColumn('digital_payment_methods', 'name')) $table->string('name')->nullable();
            if (!Schema::hasColumn('digital_payment_methods', 'type')) $table->string('type')->nullable();
            if (!Schema::hasColumn('digital_payment_methods', 'logo_url')) $table->string('logo_url')->nullable();
        });

        Schema::table('digital_orders', function (Blueprint $table) {
            foreach ([
                'order_number' => fn () => $table->string('order_number')->nullable(),
                'user_id' => fn () => $table->string('user_id', 36)->nullable(),
                'product_id' => fn () => $table->string('product_id', 36)->nullable(),
                'product_title' => fn () => $table->string('product_title')->nullable(),
                'product_slug' => fn () => $table->string('product_slug')->nullable(),
                'customer_address' => fn () => $table->text('customer_address')->nullable(),
                'price' => fn () => $table->decimal('price', 12, 2)->default(0),
                'payment_method_id' => fn () => $table->string('payment_method_id', 36)->nullable(),
                'payment_method_name' => fn () => $table->string('payment_method_name')->nullable(),
                'bank_name' => fn () => $table->string('bank_name')->nullable(),
                'items_json' => fn () => $table->json('items_json')->nullable(),
                'customer_ip' => fn () => $table->string('customer_ip')->nullable(),
                'customer_fingerprint' => fn () => $table->string('customer_fingerprint')->nullable(),
            ] as $col => $add) {
                if (!Schema::hasColumn('digital_orders', $col)) $add();
            }
        });
        DB::statement("ALTER TABLE digital_orders MODIFY status VARCHAR(50) NOT NULL DEFAULT 'পেন্ডিং'");
        DB::statement("ALTER TABLE digital_orders MODIFY total_amount DECIMAL(12,2) NULL DEFAULT 0");

        Schema::table('digital_blocked_users', function (Blueprint $table) {
            if (!Schema::hasColumn('digital_blocked_users', 'user_id')) $table->string('user_id', 36)->nullable();
            if (!Schema::hasColumn('digital_blocked_users', 'block_type')) $table->string('block_type')->nullable();
            if (!Schema::hasColumn('digital_blocked_users', 'block_value')) $table->string('block_value')->nullable();
        });
    }

    public function down(): void {}
};
