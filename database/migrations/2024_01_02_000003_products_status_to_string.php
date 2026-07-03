<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Frontend uses status values 'published'/'draft'; the original enum only allowed
// 'active'/'inactive'. Widen to a string so both vocabularies are accepted.
return new class extends Migration {
    public function up(): void
    {
        DB::statement("ALTER TABLE products MODIFY status VARCHAR(50) NOT NULL DEFAULT 'published'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE products MODIFY status ENUM('active','inactive') NOT NULL DEFAULT 'active'");
    }
};
