<?php
require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// Check if tracking_url exists in follow_up_data table
$cols = Illuminate\Support\Facades\Schema::getColumnListing('follow_up_data');
echo "follow_up_data columns: " . implode(', ', $cols) . "\n\n";

// Check some sample follow-up records with tracking_url
$rows = App\Models\FollowUpData::whereNotNull('tracking_url')->where('tracking_url', '!=', '')->limit(3)->get(['order_id', 'courier_name', 'tracking_url']);
echo "Rows with tracking_url:\n";
foreach ($rows as $row) {
    echo "  order_id={$row->order_id}  courier={$row->courier_name}  url=" . substr($row->tracking_url, 0, 60) . "\n";
}
if ($rows->isEmpty()) echo "  (none)\n";
