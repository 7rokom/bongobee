<?php

use Illuminate\Support\Facades\Schedule;

// Process SMS queue every 5 minutes
Schedule::command('sms:process --limit=100')->everyFiveMinutes();

// Auto backup every day at 2am
Schedule::command('backup:auto')->dailyAt('02:00');
