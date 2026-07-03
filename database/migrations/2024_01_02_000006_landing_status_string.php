<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Frontend uses 'published'/'draft' for landing pages; widen from the active/inactive enum.
return new class extends Migration {
    public function up(): void
    {
        DB::statement("ALTER TABLE landing_pages MODIFY status VARCHAR(50) NOT NULL DEFAULT 'published'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE landing_pages MODIFY status ENUM('active','inactive') NOT NULL DEFAULT 'active'");
    }
};
