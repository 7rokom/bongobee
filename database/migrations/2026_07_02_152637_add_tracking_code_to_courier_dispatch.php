<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('courier_dispatch', function (Blueprint $table) {
            if (!Schema::hasColumn('courier_dispatch', 'tracking_code')) {
                $table->string('tracking_code')->nullable()->after('consignment_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('courier_dispatch', function (Blueprint $table) {
            $table->dropColumn('tracking_code');
        });
    }
};
