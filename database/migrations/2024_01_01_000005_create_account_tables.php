<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // stock_entries
        Schema::create('stock_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('product_name');
            $table->unsignedInteger('quantity');
            $table->decimal('buy_price', 10, 2)->default(0);
            $table->decimal('total_cost', 10, 2)->default(0);
            $table->string('supplier')->nullable();
            $table->string('note')->nullable();
            $table->date('entry_date')->nullable();
            $table->timestamps();
        });

        // expenses
        Schema::create('expenses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->decimal('amount', 12, 2)->default(0);
            $table->string('category')->nullable();
            $table->string('note')->nullable();
            $table->date('expense_date')->nullable();
            $table->timestamps();
        });

        // deposits
        Schema::create('deposits', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->decimal('amount', 12, 2)->default(0);
            $table->string('source')->nullable();
            $table->string('note')->nullable();
            $table->date('deposit_date')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deposits');
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('stock_entries');
    }
};
