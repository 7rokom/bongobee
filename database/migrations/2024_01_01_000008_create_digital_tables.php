<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // digital_categories
        Schema::create('digital_categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('image')->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // digital_products
        Schema::create('digital_products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->decimal('price', 12, 2)->default(0);
            $table->decimal('original_price', 12, 2)->nullable();
            $table->json('images')->nullable();
            $table->string('featured_image')->nullable();
            $table->uuid('category_id')->nullable();
            $table->enum('product_type', ['download', 'link', 'code', 'mixed'])->default('link');
            $table->string('download_file_path')->nullable();
            $table->string('access_link')->nullable();
            $table->string('access_code')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->string('meta_description')->nullable();
            $table->timestamps();
            $table->foreign('category_id')->references('id')->on('digital_categories')->nullOnDelete();
        });

        // digital_payment_methods
        Schema::create('digital_payment_methods', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('method_name'); // bkash|nagad|rocket|bank
            $table->string('account_number');
            $table->string('account_holder')->nullable();
            $table->string('instructions')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        // digital_customers
        Schema::create('digital_customers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('phone')->nullable();
            $table->string('password');
            $table->boolean('is_blocked')->default(false);
            $table->timestamps();
        });

        // digital_orders
        Schema::create('digital_orders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('customer_id')->nullable();
            $table->string('customer_name');
            $table->string('customer_email');
            $table->string('customer_phone')->nullable();
            $table->json('items')->nullable(); // [{product_id, title, price}]
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->string('payment_method')->nullable();
            $table->string('payment_number')->nullable();
            $table->string('trx_id')->nullable();
            $table->string('screenshot_path')->nullable();
            $table->enum('status', ['pending', 'confirmed', 'rejected'])->default('pending');
            $table->text('admin_note')->nullable();
            $table->timestamps();
            $table->foreign('customer_id')->references('id')->on('digital_customers')->nullOnDelete();
            $table->index(['customer_id']);
            $table->index(['status']);
        });

        // digital_blocked_users
        Schema::create('digital_blocked_users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type'); // email|phone|ip
            $table->string('value');
            $table->string('reason')->nullable();
            $table->timestamps();
            $table->unique(['type', 'value']);
        });

        // digital_settings (header/footer/pixel code for digital store)
        Schema::create('digital_settings', function (Blueprint $table) {
            $table->string('id')->primary()->default('digital_settings');
            $table->text('header_code')->nullable();
            $table->text('body_code')->nullable();
            $table->text('footer_code')->nullable();
            $table->text('pixel_code')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('digital_settings');
        Schema::dropIfExists('digital_blocked_users');
        Schema::dropIfExists('digital_orders');
        Schema::dropIfExists('digital_customers');
        Schema::dropIfExists('digital_payment_methods');
        Schema::dropIfExists('digital_products');
        Schema::dropIfExists('digital_categories');
    }
};
