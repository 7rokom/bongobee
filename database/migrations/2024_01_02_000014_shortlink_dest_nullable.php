<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::statement("ALTER TABLE short_links MODIFY destination_url TEXT NULL");
    }

    public function down(): void {}
};
