<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('follow_up_data', function (Blueprint $table) {
            if (!Schema::hasColumn('follow_up_data', 'status')) $table->string('status')->nullable();
            if (!Schema::hasColumn('follow_up_data', 'note')) $table->text('note')->nullable();
            if (!Schema::hasColumn('follow_up_data', 'courier_locked')) $table->boolean('courier_locked')->default(false);
        });
        Schema::table('courier_ratio_cache', function (Blueprint $table) {
            if (!Schema::hasColumn('courier_ratio_cache', 'all_count')) $table->integer('all_count')->default(0);
            if (!Schema::hasColumn('courier_ratio_cache', 'returned')) $table->integer('returned')->default(0);
            if (!Schema::hasColumn('courier_ratio_cache', 'delivered')) $table->integer('delivered')->default(0);
            if (!Schema::hasColumn('courier_ratio_cache', 'checked_at')) $table->string('checked_at')->nullable();
        });
    }

    public function down(): void {}
};
