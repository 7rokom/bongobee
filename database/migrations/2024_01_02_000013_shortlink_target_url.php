<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('short_links', function (Blueprint $table) {
            if (!Schema::hasColumn('short_links', 'target_url')) $table->text('target_url')->nullable();
            if (!Schema::hasColumn('short_links', 'product_id')) $table->string('product_id', 36)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('short_links', fn (Blueprint $t) => $t->dropColumn(['target_url', 'product_id']));
    }
};
