<?php
require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// Find rows with courier_name but no tracking_url (would need "Add Link")
$noUrl = App\Models\FollowUpData::whereNotNull('courier_name')
    ->where('courier_name', '!=', '')
    ->where(function($q) { $q->whereNull('tracking_url')->orWhere('tracking_url', ''); })
    ->limit(5)->get(['order_id', 'courier_name', 'tracking_url']);
echo "Has courier_name, no tracking_url:\n";
foreach ($noUrl as $r) echo "  {$r->order_id}  courier={$r->courier_name}\n";
if ($noUrl->isEmpty()) echo "  (none)\n";

// Check if the orders table also has tracking_url column
$oCols = Illuminate\Support\Facades\Schema::getColumnListing('orders');
$hasTracking = in_array('tracking_url', $oCols);
echo "\norders.tracking_url column exists: " . ($hasTracking ? 'YES' : 'NO') . "\n";

// Check orders where tracking_url set in orders table
if ($hasTracking) {
    $withUrl = DB::table('orders')->whereNotNull('tracking_url')->where('tracking_url', '!=', '')->count();
    echo "orders with tracking_url in orders table: $withUrl\n";
}
