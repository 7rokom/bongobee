<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

// Phase 3 Module 11: align resellers, reseller_orders, payment_requests to the React schema.
return new class extends Migration {
    public function up(): void
    {
        Schema::table('resellers', function (Blueprint $table) {
            foreach ([
                'is_active' => fn () => $table->boolean('is_active')->default(true),
                'balance' => fn () => $table->decimal('balance', 12, 2)->default(0),
                'approval_status' => fn () => $table->string('approval_status')->default('approved'),
                'deactivation_note' => fn () => $table->string('deactivation_note')->nullable(),
                'serial_number' => fn () => $table->unsignedInteger('serial_number')->nullable(),
                'fingerprint' => fn () => $table->string('fingerprint')->nullable(),
                'sms_pending_template' => fn () => $table->text('sms_pending_template')->nullable(),
                'sms_confirmed_template' => fn () => $table->text('sms_confirmed_template')->nullable(),
                'sms_shipment_template' => fn () => $table->text('sms_shipment_template')->nullable(),
                'sms_followup_template' => fn () => $table->text('sms_followup_template')->nullable(),
            ] as $col => $add) {
                if (!Schema::hasColumn('resellers', $col)) $add();
            }
        });

        Schema::table('reseller_orders', function (Blueprint $table) {
            foreach ([
                'order_code' => fn () => $table->string('order_code', 50)->nullable()->unique(),
                'reseller_name' => fn () => $table->string('reseller_name')->nullable(),
                'packaging_charge' => fn () => $table->decimal('packaging_charge', 10, 2)->default(0),
                'cod_charge' => fn () => $table->decimal('cod_charge', 10, 2)->default(0),
                'total_selling_price' => fn () => $table->decimal('total_selling_price', 12, 2)->default(0),
                'total_reseller_cost' => fn () => $table->decimal('total_reseller_cost', 12, 2)->default(0),
                'total_profit' => fn () => $table->decimal('total_profit', 12, 2)->default(0),
                'date' => fn () => $table->string('date')->nullable(),
                'notes' => fn () => $table->json('notes')->nullable(),
                'customer_ip' => fn () => $table->string('customer_ip')->nullable(),
                'customer_fingerprint' => fn () => $table->string('customer_fingerprint')->nullable(),
                'assigned_to' => fn () => $table->string('assigned_to')->nullable(),
                'assigned_to_name' => fn () => $table->string('assigned_to_name')->nullable(),
                'confirmed_by' => fn () => $table->string('confirmed_by')->nullable(),
            ] as $col => $add) {
                if (!Schema::hasColumn('reseller_orders', $col)) $add();
            }
        });

        Schema::table('payment_requests', function (Blueprint $table) {
            if (!Schema::hasColumn('payment_requests', 'reseller_name')) $table->string('reseller_name')->nullable();
            if (!Schema::hasColumn('payment_requests', 'date')) $table->string('date')->nullable();
        });

        DB::statement("ALTER TABLE payment_requests MODIFY status VARCHAR(50) NOT NULL DEFAULT 'পেন্ডিং'");
        DB::statement("ALTER TABLE reseller_orders MODIFY invoice_number BIGINT NULL");
        DB::statement("ALTER TABLE reseller_orders MODIFY total_amount DECIMAL(12,2) NULL DEFAULT 0");
    }

    public function down(): void
    {
        // additive — left in place
    }
};
