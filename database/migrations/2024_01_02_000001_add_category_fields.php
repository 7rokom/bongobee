<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Phase 3 Module 2: bring the full category model (display + hierarchy) into the
// categories table so the frontend no longer needs site_settings.categoryHierarchy.
return new class extends Migration {
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->string('icon')->nullable()->after('slug');        // background image URL
            $table->string('lucide_icon')->nullable()->after('icon'); // menu/sidebar icon name
            $table->string('parent_id', 36)->nullable()->after('lucide_icon');
            $table->boolean('is_main')->default(true)->after('parent_id');
            $table->string('custom_link')->nullable()->after('is_main');
            $table->unsignedInteger('product_count')->default(0)->after('custom_link');
            $table->index('parent_id');
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->dropIndex(['parent_id']);
            $table->dropColumn(['icon', 'lucide_icon', 'parent_id', 'is_main', 'custom_link', 'product_count']);
        });
    }
};
