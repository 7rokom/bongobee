<?php

namespace App\Console\Commands;

use App\Services\SmsService;
use Illuminate\Console\Command;

class ProcessSmsQueue extends Command
{
    protected $signature = 'sms:process {--limit=50 : Number of messages to process per run}';
    protected $description = 'Process pending SMS queue entries';

    public function handle(SmsService $smsService): int
    {
        $limit = (int) $this->option('limit');
        $this->info("Processing up to {$limit} pending SMS messages...");

        $results = $smsService->processPendingQueue($limit);

        $this->info("Sent: {$results['sent']}, Failed: {$results['failed']}");
        return Command::SUCCESS;
    }
}
