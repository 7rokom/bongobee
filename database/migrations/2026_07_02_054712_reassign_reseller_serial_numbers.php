<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Assign sequential serial_numbers (1, 2, 3…) ordered by created_at.
        $resellers = DB::table('resellers')
            ->orderBy('created_at')
            ->pluck('id');

        foreach ($resellers as $i => $id) {
            DB::table('resellers')
                ->where('id', $id)
                ->update(['serial_number' => $i + 1]);
        }
    }

    public function down(): void
    {
        DB::table('resellers')->update(['serial_number' => null]);
    }
};
