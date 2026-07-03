<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Phase 3 Module 15: align expenses/deposits/stock_entries to the frontend.
return new class extends Migration {
    public function up(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            if (!Schema::hasColumn('expenses', 'date')) $table->string('date')->nullable();
            if (!Schema::hasColumn('expenses', 'employee_id')) $table->string('employee_id', 36)->nullable();
        });
        Schema::table('deposits', function (Blueprint $table) {
            if (!Schema::hasColumn('deposits', 'date')) $table->string('date')->nullable();
        });
        Schema::table('stock_entries', function (Blueprint $table) {
            if (!Schema::hasColumn('stock_entries', 'date')) $table->string('date')->nullable();
            if (!Schema::hasColumn('stock_entries', 'sell_price')) $table->decimal('sell_price', 12, 2)->default(0);
            if (!Schema::hasColumn('stock_entries', 'damage')) $table->integer('damage')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('expenses', fn (Blueprint $t) => $t->dropColumn(['date', 'employee_id']));
        Schema::table('deposits', fn (Blueprint $t) => $t->dropColumn('date'));
        Schema::table('stock_entries', fn (Blueprint $t) => $t->dropColumn(['date', 'sell_price', 'damage']));
    }
};
