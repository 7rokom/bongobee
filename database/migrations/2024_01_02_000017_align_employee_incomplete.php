<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            if (!Schema::hasColumn('employees', 'assigned_reseller_ids')) $table->json('assigned_reseller_ids')->nullable();
            if (!Schema::hasColumn('employees', 'hidden_reseller_ids')) $table->json('hidden_reseller_ids')->nullable();
            if (!Schema::hasColumn('employees', 'auto_assign_main')) $table->boolean('auto_assign_main')->default(true);
        });
        Schema::table('employee_activities', function (Blueprint $table) {
            if (!Schema::hasColumn('employee_activities', 'employee_name')) $table->string('employee_name')->nullable();
            if (!Schema::hasColumn('employee_activities', 'order_id')) $table->string('order_id')->nullable();
            if (!Schema::hasColumn('employee_activities', 'timestamp')) $table->string('timestamp')->nullable();
        });
        Schema::table('incomplete_orders', function (Blueprint $table) {
            foreach ([
                'name' => fn () => $table->string('name')->nullable(),
                'phone' => fn () => $table->string('phone')->nullable(),
                'address' => fn () => $table->text('address')->nullable(),
                'total_price' => fn () => $table->decimal('total_price', 12, 2)->default(0),
                'grand_total' => fn () => $table->decimal('grand_total', 12, 2)->default(0),
                'type' => fn () => $table->string('type')->nullable(),
                'block_reason' => fn () => $table->string('block_reason')->nullable(),
                'status' => fn () => $table->string('status')->nullable(),
                'customer_ip' => fn () => $table->string('customer_ip')->nullable(),
                'customer_fingerprint' => fn () => $table->string('customer_fingerprint')->nullable(),
            ] as $col => $add) {
                if (!Schema::hasColumn('incomplete_orders', $col)) $add();
            }
        });
        DB::statement("ALTER TABLE incomplete_orders MODIFY customer_name VARCHAR(255) NULL");
        DB::statement("ALTER TABLE incomplete_orders MODIFY customer_phone VARCHAR(255) NULL");
    }

    public function down(): void {}
};
