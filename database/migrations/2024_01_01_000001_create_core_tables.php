<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // admins
        Schema::create('admins', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->timestamps();
        });

        // site_settings (key-value JSON store)
        Schema::create('site_settings', function (Blueprint $table) {
            $table->string('id')->primary(); // e.g. 'general', 'seo', 'courier'
            $table->json('value')->nullable();
            $table->timestamps();
        });

        // counters
        Schema::create('counters', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->unsignedBigInteger('value')->default(0);
            $table->timestamps();
        });

        // categories
        Schema::create('categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('image')->nullable();
            $table->boolean('featured')->default(false);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        // variations
        Schema::create('variations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name'); // e.g. "Color", "Size"
            $table->json('options')->nullable(); // ["Red","Blue"]
            $table->timestamps();
        });

        // products
        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->uuid('category_id')->nullable();
            $table->string('brand')->nullable();
            $table->text('description')->nullable();
            $table->text('short_description')->nullable();
            $table->decimal('price', 12, 2)->default(0);
            $table->decimal('original_price', 12, 2)->nullable();
            $table->decimal('buy_price', 12, 2)->nullable(); // cost
            $table->decimal('reseller_price', 12, 2)->nullable();
            $table->json('images')->nullable(); // array of URLs
            $table->string('featured_image')->nullable();
            $table->string('featured_video')->nullable();
            $table->json('colors')->nullable();
            $table->json('sizes')->nullable();
            $table->json('weights')->nullable();
            $table->json('variations')->nullable(); // [{type, options}]
            $table->json('variation_prices')->nullable();
            $table->string('audio_url')->nullable();
            $table->string('stock_type')->default('unlimited'); // unlimited|specific
            $table->string('stock_product_name')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->boolean('in_stock')->default(true);
            $table->boolean('free_delivery')->default(false);
            $table->string('meta_description')->nullable();
            $table->string('meta_keywords')->nullable();
            $table->timestamps();
            $table->foreign('category_id')->references('id')->on('categories')->nullOnDelete();
        });

        // coupons
        Schema::create('coupons', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code')->unique();
            $table->enum('discount_type', ['percentage', 'fixed'])->default('fixed');
            $table->decimal('discount_value', 10, 2)->default(0);
            $table->decimal('min_order_amount', 10, 2)->default(0);
            $table->unsignedInteger('max_usage')->default(0); // 0=unlimited
            $table->unsignedInteger('used_count')->default(0);
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
        Schema::dropIfExists('variations');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('counters');
        Schema::dropIfExists('site_settings');
        Schema::dropIfExists('admins');
        Schema::dropIfExists('coupons');
    }
};
