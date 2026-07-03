<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('resellers', function (Blueprint $table) {
            $table->string('storefront_logo_url')->nullable()->after('footer_code');
            $table->string('storefront_favicon_url')->nullable()->after('storefront_logo_url');
            $table->text('storefront_bio')->nullable()->after('storefront_favicon_url');
            $table->string('storefront_address')->nullable()->after('storefront_bio');
            $table->string('storefront_phone')->nullable()->after('storefront_address');
            $table->string('storefront_footer_credit')->nullable()->after('storefront_phone');
            $table->json('storefront_legal_pages')->nullable()->after('storefront_footer_credit');
            $table->string('storefront_facebook_url')->nullable()->after('storefront_legal_pages');
            $table->string('storefront_youtube_url')->nullable()->after('storefront_facebook_url');
            $table->string('storefront_twitter_url')->nullable()->after('storefront_youtube_url');
            $table->string('storefront_instagram_url')->nullable()->after('storefront_twitter_url');
        });
    }

    public function down(): void
    {
        Schema::table('resellers', function (Blueprint $table) {
            $table->dropColumn([
                'storefront_logo_url', 'storefront_favicon_url', 'storefront_bio',
                'storefront_address', 'storefront_phone', 'storefront_footer_credit',
                'storefront_legal_pages', 'storefront_facebook_url', 'storefront_youtube_url',
                'storefront_twitter_url', 'storefront_instagram_url',
            ]);
        });
    }
};
