<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('reseller_payment_methods', function (Blueprint $table) {
            if (!Schema::hasColumn('reseller_payment_methods', 'method_type')) $table->string('method_type')->nullable();
            if (!Schema::hasColumn('reseller_payment_methods', 'label')) $table->string('label')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('reseller_payment_methods', fn (Blueprint $t) => $t->dropColumn(['method_type', 'label']));
    }
};
