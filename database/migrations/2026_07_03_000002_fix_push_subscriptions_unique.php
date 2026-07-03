<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Drop the old single-column unique on endpoint so the same device
        // can subscribe to multiple sections (e.g. admin + reseller).
        try {
            DB::statement('ALTER TABLE push_subscriptions DROP INDEX push_subscriptions_endpoint_unique');
        } catch (\Throwable) {
            // Already dropped or never existed — proceed
        }

        // Add composite unique (endpoint, section) — one row per device per section.
        try {
            DB::statement('ALTER TABLE push_subscriptions ADD UNIQUE INDEX push_subscriptions_endpoint_section_unique (endpoint(500), section)');
        } catch (\Throwable) {
            // Index already exists
        }
    }

    public function down(): void
    {
        try {
            DB::statement('ALTER TABLE push_subscriptions DROP INDEX push_subscriptions_endpoint_section_unique');
        } catch (\Throwable) {}
        try {
            DB::statement('ALTER TABLE push_subscriptions ADD UNIQUE INDEX push_subscriptions_endpoint_unique (endpoint(500))');
        } catch (\Throwable) {}
    }
};
