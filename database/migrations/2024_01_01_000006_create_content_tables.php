<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // blog_posts (also used as pages)
        Schema::create('blog_posts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('excerpt')->nullable();
            $table->longText('content')->nullable();
            $table->string('image')->nullable();
            $table->json('gallery_images')->nullable();
            $table->string('author')->nullable();
            $table->string('category')->nullable();
            $table->enum('type', ['post', 'page', 'video'])->default('post');
            $table->enum('status', ['published', 'draft'])->default('draft');
            $table->string('meta_description')->nullable();
            $table->string('meta_keywords')->nullable();
            $table->string('video_url')->nullable();
            $table->string('youtube_video_id')->unique()->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->index(['type', 'status']);
            $table->index(['slug']);
        });

        // landing_pages
        Schema::create('landing_pages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->string('slug')->unique();
            $table->uuid('product_id')->nullable();
            $table->decimal('custom_price', 12, 2)->nullable();
            $table->decimal('custom_original_price', 12, 2)->nullable();
            $table->longText('content')->nullable();
            $table->string('image')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();
            $table->foreign('product_id')->references('id')->on('products')->nullOnDelete();
        });

        // youtube_sources
        Schema::create('youtube_sources', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->enum('source_type', ['channel', 'playlist', 'search', 'rss'])->default('channel');
            $table->string('source_value');
            $table->string('category')->nullable();
            $table->string('author')->nullable();
            $table->unsignedInteger('max_videos')->default(10);
            $table->boolean('exclude_shorts')->default(true);
            $table->boolean('enabled')->default(true);
            $table->timestamp('last_synced_at')->nullable();
            $table->unsignedInteger('last_sync_count')->default(0);
            $table->timestamps();
        });

        // short_links
        Schema::create('short_links', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('slug')->unique();
            $table->string('destination_url');
            $table->string('title')->nullable();
            $table->unsignedInteger('click_count')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('short_links');
        Schema::dropIfExists('youtube_sources');
        Schema::dropIfExists('landing_pages');
        Schema::dropIfExists('blog_posts');
    }
};
