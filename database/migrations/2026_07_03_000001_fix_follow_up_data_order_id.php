<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Reseller order keys are 'reseller-<uuid>' (45 chars) — too long for the
// original char(36) column and not present in the orders table, so the FK
// rejects every reseller save. Drop the FK and widen to varchar(64).
return new class extends Migration {
    public function up(): void
    {
        DB::statement('ALTER TABLE follow_up_data DROP FOREIGN KEY follow_up_data_order_id_foreign');
        DB::statement('ALTER TABLE follow_up_data MODIFY COLUMN order_id VARCHAR(64) NOT NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE follow_up_data MODIFY COLUMN order_id CHAR(36) NOT NULL');
        DB::statement('ALTER TABLE follow_up_data ADD CONSTRAINT follow_up_data_order_id_foreign FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE');
    }
};
