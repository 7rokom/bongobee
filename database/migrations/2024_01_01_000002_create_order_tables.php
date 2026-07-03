<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // orders
        Schema::create('orders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->unsignedBigInteger('invoice_number')->unique();
            $table->string('customer_name');
            $table->string('customer_phone');
            $table->string('customer_address')->nullable();
            $table->string('delivery_zone')->nullable();
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->decimal('delivery_charge', 10, 2)->default(0);
            $table->decimal('discount_amount', 10, 2)->default(0);
            $table->string('coupon_code')->nullable();
            $table->json('items')->nullable(); // [{product_id, name, qty, price, variation}]
            $table->string('status')->default('পেন্ডিং');
            $table->string('note')->nullable();
            $table->string('admin_note')->nullable();
            $table->uuid('assigned_to')->nullable(); // employee_id
            $table->string('source')->default('website'); // website|reseller|admin
            $table->string('device_fingerprint')->nullable();
            $table->string('ip_address')->nullable();
            $table->string('tracking_url')->nullable();
            $table->string('courier_name')->nullable();
            $table->decimal('vendor_buy_price', 10, 2)->nullable();
            $table->string('courier_invoice_id')->nullable();
            $table->decimal('courier_delivery_charge', 10, 2)->nullable();
            $table->json('sms_sent')->nullable();
            $table->timestamps();
            $table->index(['customer_phone']);
            $table->index(['status']);
            $table->index(['created_at']);
        });

        // incomplete_orders
        Schema::create('incomplete_orders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('customer_name')->nullable();
            $table->string('customer_phone');
            $table->string('customer_address')->nullable();
            $table->string('delivery_zone')->nullable();
            $table->json('items')->nullable();
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->decimal('delivery_charge', 10, 2)->default(0);
            $table->string('coupon_code')->nullable();
            $table->string('note')->nullable();
            $table->string('source')->default('website');
            $table->string('device_fingerprint')->nullable();
            $table->string('ip_address')->nullable();
            $table->boolean('fraud_blocked')->default(false);
            $table->timestamps();
            $table->index(['customer_phone']);
        });

        // follow_up_data (per-order tracking/follow-up info)
        Schema::create('follow_up_data', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('order_id')->unique();
            $table->string('tracking_url')->nullable();
            $table->string('courier_name')->nullable();
            $table->decimal('vendor_buy_price', 10, 2)->nullable();
            $table->string('stock_type')->nullable();
            $table->decimal('courier_delivery_charge', 10, 2)->nullable();
            $table->string('courier_invoice_id')->nullable();
            $table->timestamps();
            $table->foreign('order_id')->references('id')->on('orders')->cascadeOnDelete();
        });

        // blocked_customers
        Schema::create('blocked_customers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type'); // phone|ip|fingerprint|group
            $table->string('value');
            $table->string('reason')->nullable();
            $table->timestamps();
            $table->unique(['type', 'value']);
        });

        // fraud_settings
        Schema::create('fraud_settings', function (Blueprint $table) {
            $table->string('id')->primary()->default('fraud_settings');
            $table->string('bdcourier_api_key')->nullable();
            $table->unsignedInteger('min_delivery_percentage')->default(0);
            $table->boolean('fraud_check_enabled')->default(false);
            $table->boolean('device_block_enabled')->default(false);
            $table->timestamps();
        });

        // courier_settings
        Schema::create('courier_settings', function (Blueprint $table) {
            $table->string('id')->primary()->default('courier_settings');
            $table->string('steadfast_api_key')->nullable();
            $table->string('steadfast_secret_key')->nullable();
            $table->string('carrybee_client_id')->nullable();
            $table->string('carrybee_secret')->nullable();
            $table->string('carrybee_context')->nullable();
            $table->json('delivery_zones')->nullable(); // [{name, charge}]
            $table->timestamps();
        });

        // courier_dispatch
        Schema::create('courier_dispatch', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('order_id')->nullable();
            $table->string('courier')->nullable(); // steadfast|carrybee
            $table->string('consignment_id')->nullable();
            $table->string('status')->nullable();
            $table->json('response_data')->nullable();
            $table->timestamps();
            $table->index(['order_id']);
        });

        // courier_ratio_cache
        Schema::create('courier_ratio_cache', function (Blueprint $table) {
            $table->string('phone', 20)->primary();
            $table->decimal('delivery_ratio', 5, 2)->default(0);
            $table->unsignedInteger('total_orders')->default(0);
            $table->unsignedInteger('delivered_count')->default(0);
            $table->timestamp('cached_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('courier_ratio_cache');
        Schema::dropIfExists('courier_dispatch');
        Schema::dropIfExists('courier_settings');
        Schema::dropIfExists('fraud_settings');
        Schema::dropIfExists('blocked_customers');
        Schema::dropIfExists('follow_up_data');
        Schema::dropIfExists('incomplete_orders');
        Schema::dropIfExists('orders');
    }
};
