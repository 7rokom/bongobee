<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reseller_domains', function (Blueprint $table) {
            $table->id();
            $table->char('reseller_id', 36);
            $table->string('domain')->unique();
            $table->boolean('is_primary')->default(false);
            $table->enum('status', ['pending', 'verified', 'failed', 'inactive'])->default('pending');
            $table->string('ssl_status')->default('none');
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();
            $table->foreign('reseller_id')->references('id')->on('resellers')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reseller_domains');
    }
};
