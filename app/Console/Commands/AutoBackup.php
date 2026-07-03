<?php

namespace App\Console\Commands;

use App\Services\BackupService;
use Illuminate\Console\Command;

class AutoBackup extends Command
{
    protected $signature = 'backup:auto';
    protected $description = 'Create an automatic scheduled database backup';

    public function handle(BackupService $backupService): int
    {
        $this->info('Creating automatic database backup...');
        $result = $backupService->createDatabaseBackup('auto');

        if ($result['success']) {
            $this->info("Backup created: {$result['filename']} ({$result['size']} bytes)");
            return Command::SUCCESS;
        }

        $this->error("Backup failed: {$result['error']}");
        return Command::FAILURE;
    }
}
