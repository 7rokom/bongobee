<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('push_campaigns', function (Blueprint $table) {
            if (!Schema::hasColumn('push_campaigns', 'failed_count')) {
                $table->unsignedInteger('failed_count')->default(0)->after('sent_count');
            }
        });
    }

    public function down(): void
    {
        Schema::table('push_campaigns', function (Blueprint $table) {
            $table->dropColumn('failed_count');
        });
    }
};
