<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('courier_dispatch', function (Blueprint $table) {
            foreach ([
                'courier_type' => fn () => $table->string('courier_type')->nullable(),
                'courier_status' => fn () => $table->string('courier_status')->nullable(),
                'transfer_status' => fn () => $table->string('transfer_status')->nullable(),
                'sent_at' => fn () => $table->string('sent_at')->nullable(),
                'store_id' => fn () => $table->string('store_id')->nullable(),
            ] as $col => $add) {
                if (!Schema::hasColumn('courier_dispatch', $col)) $add();
            }
        });
    }

    public function down(): void {}
};
