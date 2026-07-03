<?php

namespace App\Console\Commands;

use App\Models\Reseller;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class MigrateResellerPasswords extends Command
{
    protected $signature = 'reseller:migrate-passwords
                            {--dry-run : Preview which accounts would be migrated without making changes}';

    protected $description = 'One-time migration: rehash all plaintext reseller passwords to bcrypt';

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');

        if ($dryRun) {
            $this->warn('DRY RUN — no changes will be written.');
        }

        $resellers = Reseller::all();
        $migrated = 0;
        $skipped  = 0;

        foreach ($resellers as $reseller) {
            $stored = (string) $reseller->password;

            // Already a bcrypt/argon hash — nothing to do.
            if (str_starts_with($stored, '$2y$') || str_starts_with($stored, '$2b$') || str_starts_with($stored, '$argon')) {
                $skipped++;
                continue;
            }

            // Plaintext — hash and persist.
            $this->line("  [{$reseller->id}] {$reseller->email}");

            if (!$dryRun) {
                $reseller->password = Hash::make($stored);
                $reseller->save();
            }

            $migrated++;
        }

        $this->newLine();
        if ($dryRun) {
            $this->info("Would migrate: {$migrated} | Already hashed (skipped): {$skipped}");
        } else {
            $this->info("Migrated: {$migrated} | Already hashed (skipped): {$skipped}");
        }

        return Command::SUCCESS;
    }
}
