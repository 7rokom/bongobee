<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // resellers
        Schema::create('resellers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('phone')->nullable();
            $table->string('shop_name')->nullable();
            $table->string('password');
            $table->enum('status', ['pending', 'active', 'inactive'])->default('active');
            $table->string('referral_code')->unique()->nullable();
            $table->string('contact_phone')->nullable();
            $table->string('contact_whatsapp')->nullable();
            $table->text('header_code')->nullable();
            $table->text('body_code')->nullable();
            $table->text('footer_code')->nullable();
            $table->string('sms_template_confirmed')->nullable();
            $table->string('sms_template_shipped')->nullable();
            $table->timestamps();
        });

        // reseller_payment_methods
        Schema::create('reseller_payment_methods', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('reseller_id');
            $table->string('method_name'); // bkash|nagad|bank
            $table->string('account_number');
            $table->string('account_holder')->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestamps();
            $table->foreign('reseller_id')->references('id')->on('resellers')->cascadeOnDelete();
        });

        // reseller_product_prices
        Schema::create('reseller_product_prices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('reseller_id');
            $table->uuid('product_id');
            $table->decimal('custom_price', 12, 2);
            $table->timestamps();
            $table->unique(['reseller_id', 'product_id']);
            $table->foreign('reseller_id')->references('id')->on('resellers')->cascadeOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
        });

        // reseller_orders
        Schema::create('reseller_orders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('reseller_id');
            $table->unsignedBigInteger('invoice_number')->nullable();
            $table->string('customer_name');
            $table->string('customer_phone');
            $table->string('customer_address')->nullable();
            $table->string('delivery_zone')->nullable();
            $table->json('items')->nullable();
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->decimal('delivery_charge', 10, 2)->default(0);
            $table->decimal('reseller_profit', 10, 2)->default(0);
            $table->decimal('paid_return_amount', 10, 2)->default(0);
            $table->string('status')->default('পেন্ডিং');
            $table->string('note')->nullable();
            $table->string('admin_note')->nullable();
            $table->string('tracking_url')->nullable();
            $table->string('courier_name')->nullable();
            $table->string('source')->default('reseller');
            $table->json('sms_sent')->nullable();
            $table->timestamps();
            $table->foreign('reseller_id')->references('id')->on('resellers')->cascadeOnDelete();
            $table->index(['reseller_id']);
            $table->index(['status']);
        });

        // payment_requests (reseller withdrawal requests)
        Schema::create('payment_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('reseller_id');
            $table->decimal('amount', 12, 2);
            $table->string('payment_method')->nullable();
            $table->string('account_number')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->string('admin_note')->nullable();
            $table->timestamps();
            $table->foreign('reseller_id')->references('id')->on('resellers')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_requests');
        Schema::dropIfExists('reseller_orders');
        Schema::dropIfExists('reseller_product_prices');
        Schema::dropIfExists('reseller_payment_methods');
        Schema::dropIfExists('resellers');
    }
};
