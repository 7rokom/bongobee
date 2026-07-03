<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // sms_campaigns
        Schema::create('sms_campaigns', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->text('message');
            $table->enum('target', ['all', 'delivered', 'custom'])->default('custom');
            $table->json('phone_numbers')->nullable();
            $table->unsignedInteger('total_count')->default(0);
            $table->unsignedInteger('sent_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->enum('status', ['pending', 'processing', 'completed', 'failed'])->default('pending');
            $table->timestamps();
        });

        // sms_queue
        Schema::create('sms_queue', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('campaign_id')->nullable();
            $table->string('phone', 20);
            $table->text('message');
            $table->enum('status', ['pending', 'sent', 'failed', 'gateway_pending'])->default('pending');
            $table->string('response_code')->nullable();
            $table->string('error_message')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();
            $table->index(['status']);
            $table->index(['campaign_id']);
        });

        // push_subscriptions
        Schema::create('push_subscriptions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('endpoint')->unique();
            $table->string('p256dh_key')->nullable();
            $table->string('auth_key')->nullable();
            $table->string('section')->default('all');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index(['section', 'is_active']);
        });

        // push_campaigns
        Schema::create('push_campaigns', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->text('body');
            $table->string('image_url')->nullable();
            $table->string('click_url')->nullable();
            $table->string('section')->default('all');
            $table->unsignedInteger('total_count')->default(0);
            $table->unsignedInteger('sent_count')->default(0);
            $table->enum('status', ['pending', 'sent', 'failed'])->default('pending');
            $table->timestamps();
        });

        // backup_log
        Schema::create('backup_log', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->enum('type', ['auto', 'manual'])->default('manual');
            $table->enum('status', ['started', 'completed', 'failed'])->default('started');
            $table->string('file_name')->nullable();
            $table->string('drive_file_id')->nullable();
            $table->text('error_message')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('backup_log');
        Schema::dropIfExists('push_campaigns');
        Schema::dropIfExists('push_subscriptions');
        Schema::dropIfExists('sms_queue');
        Schema::dropIfExists('sms_campaigns');
    }
};
