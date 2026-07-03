<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Frontend stores a free-form display `date` string on blog posts.
return new class extends Migration {
    public function up(): void
    {
        Schema::table('blog_posts', function (Blueprint $table) {
            if (!Schema::hasColumn('blog_posts', 'date')) $table->string('date')->nullable()->after('category');
        });
    }

    public function down(): void
    {
        Schema::table('blog_posts', fn (Blueprint $t) => $t->dropColumn('date'));
    }
};
