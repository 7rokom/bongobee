<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\BlockedCustomer;
use App\Models\IncompleteOrder;
use App\Models\SiteSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FraudController extends Controller
{
    // Blocked Customers
    public function blockedCustomers(): JsonResponse
    {
        return response()->json(BlockedCustomer::orderByDesc('created_at')->get());
    }

    public function blockCustomer(Request $request): JsonResponse
    {
        // Supports a single entry OR a bulk { entries: [...] } payload (phone+ip+fingerprint group).
        $entries = $request->input('entries');
        if (is_array($entries) && count($entries)) {
            $created = [];
            foreach ($entries as $e) {
                if (empty($e['type']) || empty($e['value'])) continue;
                $created[] = BlockedCustomer::firstOrCreate(
                    ['type' => $e['type'], 'value' => $e['value']],
                    [
                        'customer_name' => $e['customer_name'] ?? null,
                        'reason' => $e['reason'] ?? null,
                        'blocked_at' => now(), // server timestamp (client ISO strings vary)
                        'linked_group' => $e['linked_group'] ?? null,
                    ]
                );
            }
            return response()->json($created, 201);
        }

        $data = $request->validate([
            'type' => 'required|in:phone,ip,fingerprint,group',
            'value' => 'required|string',
            'reason' => 'nullable|string',
            'customer_name' => 'nullable|string',
            'linked_group' => 'nullable|string',
        ]);
        $blocked = BlockedCustomer::firstOrCreate(
            ['type' => $data['type'], 'value' => $data['value']],
            [
                'customer_name' => $data['customer_name'] ?? null,
                'reason' => $data['reason'] ?? null,
                'blocked_at' => now(),
                'linked_group' => $data['linked_group'] ?? null,
            ]
        );
        return response()->json($blocked, 201);
    }

    public function unblockCustomer(string $id): JsonResponse
    {
        BlockedCustomer::findOrFail($id)->delete();
        return response()->json(['message' => 'Unblocked.']);
    }

    public function unblockGroup(string $group): JsonResponse
    {
        BlockedCustomer::where('linked_group', $group)->delete();
        return response()->json(['message' => 'Group unblocked.']);
    }

    // Public pre-check used by the storefront checkout (no auth).
    public function checkBlocked(Request $request): JsonResponse
    {
        $phone = $request->input('phone');
        $ip = $request->input('ip');
        $fingerprint = $request->input('fingerprint');

        $blocked = BlockedCustomer::where(function ($q) use ($phone, $ip, $fingerprint) {
            if ($phone) $q->orWhere(fn ($w) => $w->where('type', 'phone')->where('value', $phone));
            if ($ip) $q->orWhere(fn ($w) => $w->where('type', 'ip')->where('value', $ip));
            if ($fingerprint) $q->orWhere(fn ($w) => $w->where('type', 'fingerprint')->where('value', $fingerprint));
        })->exists();

        return response()->json(['blocked' => $blocked]);
    }

    // Public server-side order cooldown — has the customer ordered within the
    // last N minutes (by phone / ip / fingerprint)? Replaces the storefront's
    // direct Supabase orders query in src/lib/order-cooldown.ts.
    public function orderCooldown(Request $request): JsonResponse
    {
        $phone = $request->input('phone');
        $ip = $request->input('ip');
        $fingerprint = $request->input('fingerprint');
        $minutes = (int) ($request->input('minutes') ?: 10);
        if (!$phone && !$ip && !$fingerprint) return response()->json(['active' => false]);

        $cutoff = now()->subMinutes($minutes);
        $active = \App\Models\Order::where('created_at', '>=', $cutoff)
            ->where(function ($q) use ($phone, $ip, $fingerprint) {
                if ($phone) $q->orWhere('phone', $phone)->orWhere('customer_phone', $phone);
                if ($ip) $q->orWhere('customer_ip', $ip);
                if ($fingerprint) $q->orWhere('customer_fingerprint', $fingerprint);
            })
            ->exists();

        if (!$active) {
            $active = \App\Models\ResellerOrder::where('created_at', '>=', $cutoff)
                ->where(function ($q) use ($phone, $ip, $fingerprint) {
                    if ($phone) $q->orWhere('customer_phone', $phone);
                    if ($ip) $q->orWhere('customer_ip', $ip);
                    if ($fingerprint) $q->orWhere('customer_fingerprint', $fingerprint);
                })
                ->exists();
        }

        return response()->json(['active' => $active]);
    }

    // Incomplete Orders
    public function incompleteOrders(Request $request): JsonResponse
    {
        $query = IncompleteOrder::query();
        if ($request->filled('phone')) $query->where('customer_phone', 'like', '%'.$request->phone.'%');
        return response()->json($query->orderByDesc('created_at')->paginate(50));
    }

    public function destroyIncompleteOrder(string $id): JsonResponse
    {
        IncompleteOrder::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    // Fraud Settings
    public function getFraudSettings(): JsonResponse
    {
        // Returns the full settings blob (the frontend manages its own field set / defaults).
        return response()->json(SiteSetting::get('fraud_settings', []));
    }

    public function updateFraudSettings(Request $request): JsonResponse
    {
        // Merge the incoming (possibly partial) settings into the stored blob.
        $existing = SiteSetting::get('fraud_settings', []);
        $merged = array_merge(is_array($existing) ? $existing : [], $request->all());
        SiteSetting::set('fraud_settings', $merged);
        return response()->json(['message' => 'Saved.', 'data' => $merged]);
    }

    // Customer list (missing route from original - now implemented)
    public function customerList(Request $request): JsonResponse
    {
        $query = \App\Models\Order::selectRaw('customer_phone, customer_name, COUNT(*) as total_orders, MAX(created_at) as last_order_at')
            ->groupBy('customer_phone', 'customer_name');
        if ($request->filled('search')) {
            $query->where('customer_phone', 'like', '%'.$request->search.'%')
                  ->orWhere('customer_name', 'like', '%'.$request->search.'%');
        }
        return response()->json($query->orderByDesc('last_order_at')->paginate(50));
    }
}
