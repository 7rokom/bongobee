<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Phase 3 Module 3: align the products table with the frontend's field names so the
// React store maps 1:1 (title, long_description, category slug, rating/reviews, affiliate).
return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'title')) $table->string('title')->nullable()->after('id');
            if (!Schema::hasColumn('products', 'long_description')) $table->longText('long_description')->nullable()->after('description');
            if (!Schema::hasColumn('products', 'category')) $table->string('category')->nullable()->after('category_id'); // category slug (denormalized, matches frontend)
            if (!Schema::hasColumn('products', 'rating')) $table->decimal('rating', 3, 2)->default(0)->after('status');
            if (!Schema::hasColumn('products', 'review_count')) $table->unsignedInteger('review_count')->default(0)->after('rating');
            if (!Schema::hasColumn('products', 'reviews')) $table->json('reviews')->nullable()->after('review_count');
            if (!Schema::hasColumn('products', 'is_affiliate')) $table->boolean('is_affiliate')->default(false)->after('reviews');
            if (!Schema::hasColumn('products', 'affiliate_url')) $table->string('affiliate_url')->nullable()->after('is_affiliate');
            if (!Schema::hasColumn('products', 'affiliate_button_text')) $table->string('affiliate_button_text')->nullable()->after('affiliate_url');
        });

        // name was required; frontend sends title instead — make it nullable.
        Schema::table('products', function (Blueprint $table) {
            $table->string('name')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['title', 'long_description', 'category', 'rating', 'review_count', 'reviews', 'is_affiliate', 'affiliate_url', 'affiliate_button_text']);
        });
    }
};
