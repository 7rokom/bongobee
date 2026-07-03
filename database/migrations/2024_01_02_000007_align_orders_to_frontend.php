<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Phase 3 Module 4: the React order model uses a "#01" invoice-string id and
// customer/phone/address/total field names. Add them so the store maps 1:1.
return new class extends Migration {
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'order_code')) $table->string('order_code', 50)->nullable()->unique()->after('id');
            if (!Schema::hasColumn('orders', 'customer')) $table->string('customer')->nullable()->after('order_code');
            if (!Schema::hasColumn('orders', 'phone')) $table->string('phone')->nullable()->after('customer');
            if (!Schema::hasColumn('orders', 'address')) $table->text('address')->nullable()->after('phone');
            if (!Schema::hasColumn('orders', 'total')) $table->decimal('total', 12, 2)->default(0)->after('address');
            if (!Schema::hasColumn('orders', 'original_delivery_charge')) $table->decimal('original_delivery_charge', 10, 2)->default(0)->after('delivery_charge');
            if (!Schema::hasColumn('orders', 'date')) $table->string('date')->nullable();
            if (!Schema::hasColumn('orders', 'iso_date')) $table->string('iso_date')->nullable();
            if (!Schema::hasColumn('orders', 'confirmed_by')) $table->string('confirmed_by')->nullable();
            if (!Schema::hasColumn('orders', 'assigned_to_name')) $table->string('assigned_to_name')->nullable();
            if (!Schema::hasColumn('orders', 'customer_ip')) $table->string('customer_ip')->nullable();
            if (!Schema::hasColumn('orders', 'customer_fingerprint')) $table->string('customer_fingerprint')->nullable();
            if (!Schema::hasColumn('orders', 'paid_return_amount')) $table->decimal('paid_return_amount', 12, 2)->nullable();
            $table->index('phone');
        });
        // status already varchar (Bengali); ensure customer_name/invoice_number not required.
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['order_code', 'customer', 'phone', 'address', 'total', 'original_delivery_charge', 'date', 'iso_date', 'confirmed_by', 'assigned_to_name', 'customer_ip', 'customer_fingerprint', 'paid_return_amount']);
        });
    }
};
