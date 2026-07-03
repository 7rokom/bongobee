<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // employees
        Schema::create('employees', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('phone')->nullable();
            $table->string('password');
            $table->string('role')->default('employee');
            $table->json('permissions')->nullable(); // ['orders','products',...]
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // employee_activities
        Schema::create('employee_activities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('employee_id');
            $table->string('action');
            $table->string('entity_type')->nullable(); // order|product|...
            $table->string('entity_id')->nullable();
            $table->text('details')->nullable();
            $table->timestamps();
            $table->foreign('employee_id')->references('id')->on('employees')->cascadeOnDelete();
            $table->index(['employee_id']);
            $table->index(['created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_activities');
        Schema::dropIfExists('employees');
    }
};
