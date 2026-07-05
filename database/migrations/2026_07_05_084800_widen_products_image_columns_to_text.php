<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// featured_image and featured_video were VARCHAR(255), truncating long CDN URLs.
// Widen both to TEXT so any URL length is accepted.
return new class extends Migration {
    public function up(): void
    {
        DB::statement('ALTER TABLE products MODIFY COLUMN featured_image TEXT NULL');
        DB::statement('ALTER TABLE products MODIFY COLUMN featured_video TEXT NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE products MODIFY COLUMN featured_image VARCHAR(255) NULL');
        DB::statement('ALTER TABLE products MODIFY COLUMN featured_video VARCHAR(255) NULL');
    }
};
