<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('resellers', function (Blueprint $table) {
            $table->string('storefront_name')->nullable()->after('storefront_instagram_url');
            $table->string('storefront_primary_color', 20)->nullable()->after('storefront_name');
            $table->string('storefront_hero_title')->nullable()->after('storefront_primary_color');
            $table->text('storefront_hero_subtitle')->nullable()->after('storefront_hero_title');
            $table->string('storefront_hero_image')->nullable()->after('storefront_hero_subtitle');
        });
    }

    public function down(): void
    {
        Schema::table('resellers', function (Blueprint $table) {
            $table->dropColumn([
                'storefront_name',
                'storefront_primary_color',
                'storefront_hero_title',
                'storefront_hero_subtitle',
                'storefront_hero_image',
            ]);
        });
    }
};
