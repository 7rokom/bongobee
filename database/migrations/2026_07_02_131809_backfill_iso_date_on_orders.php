<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Populate iso_date from created_at for all orders that have a null iso_date.
        // This fixes return-ledger expense entries being dated "today" instead of the
        // actual order creation date.
        DB::statement("
            UPDATE orders
            SET iso_date = DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z')
            WHERE iso_date IS NULL OR iso_date = ''
        ");
    }

    public function down(): void
    {
        // Not reversible — re-nullifying would break the fix.
    }
};
