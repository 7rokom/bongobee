<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Phase 3 Modules 5/6/8: align coupons, variations, blocked_customers to the frontend.
return new class extends Migration {
    public function up(): void
    {
        Schema::table('coupons', function (Blueprint $table) {
            if (!Schema::hasColumn('coupons', 'product_ids')) $table->json('product_ids')->nullable();
        });
        Schema::table('variations', function (Blueprint $table) {
            if (!Schema::hasColumn('variations', 'type')) $table->string('type')->nullable()->after('name'); // color|size|weight
        });
        Schema::table('blocked_customers', function (Blueprint $table) {
            if (!Schema::hasColumn('blocked_customers', 'customer_name')) $table->string('customer_name')->nullable()->after('value');
            if (!Schema::hasColumn('blocked_customers', 'blocked_at')) $table->timestamp('blocked_at')->nullable()->after('reason');
            if (!Schema::hasColumn('blocked_customers', 'linked_group')) $table->string('linked_group', 36)->nullable()->after('blocked_at');
        });
    }

    public function down(): void
    {
        Schema::table('coupons', fn (Blueprint $t) => $t->dropColumn('product_ids'));
        Schema::table('variations', fn (Blueprint $t) => $t->dropColumn('type'));
        Schema::table('blocked_customers', fn (Blueprint $t) => $t->dropColumn(['customer_name', 'blocked_at', 'linked_group']));
    }
};
