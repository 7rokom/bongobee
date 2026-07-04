<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SiteSetting;
use App\Models\Employee;
use App\Models\EmployeeActivity;
use App\Models\IncompleteOrder;
use App\Models\FollowUpData;
use App\Models\CourierDispatch;
use App\Models\CourierRatioCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

// Phase 3 Modules 14/15 — courier, employees, incomplete orders, follow-ups, audio.
class FrontendDataController extends Controller
{
    // ---- Courier settings (blob per provider) ----
    public function courierSettings(string $provider): JsonResponse
    {
        return response()->json(SiteSetting::get("courier_$provider", new \stdClass()));
    }
    public function saveCourierSettings(Request $request, string $provider): JsonResponse
    {
        SiteSetting::set("courier_$provider", $request->all());
        return response()->json(['message' => 'Saved.']);
    }

    // ---- Courier dispatch ----
    public function courierDispatch(Request $request): JsonResponse
    {
        $q = CourierDispatch::query();
        if ($request->filled('courier_type')) $q->where('courier_type', $request->courier_type);
        return response()->json($q->get());
    }
    public function saveCourierDispatch(Request $request): JsonResponse
    {
        $row = CourierDispatch::updateOrCreate(
            ['order_id' => $request->input('order_id'), 'courier_type' => $request->input('courier_type')],
            $request->except(['id'])
        );
        return response()->json($row, 201);
    }
    public function deleteCourierDispatch(Request $request): JsonResponse
    {
        CourierDispatch::where('order_id', $request->input('order_id'))
            ->when($request->filled('courier_type'), fn ($q) => $q->where('courier_type', $request->courier_type))
            ->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    // Courier delivery-ratio check via bdcourier (server-side; replaces the edge fn).
    public function courierCheck(Request $request): JsonResponse
    {
        $phone = $request->input('phone');
        $apiKey = $request->input('apiKey')
            ?? (SiteSetting::get('fraud_settings', [])['bdcourierApiKey'] ?? '')
            ?: env('BDCOURIER_API_KEY', '');
        if (!$phone) return response()->json(['error' => 'phone required'], 422);
        if (!$apiKey) return response()->json(['all' => 0, 'delivered' => 0, 'returned' => 0, 'error' => 'API key সেট করা নেই']);
        try {
            // SSL: prefer CURL_CA_BUNDLE env → php.ini curl.cainfo → system default (true).
            // CURLOPT_IPRESOLVE: force IPv4 to avoid DNS resolution failures on Windows/Laragon.
            $caBundle = env('CURL_CA_BUNDLE') ?: ini_get('curl.cainfo') ?: true;
            $resp = \Illuminate\Support\Facades\Http::timeout(20)
                ->withOptions([
                    'verify' => $caBundle,
                    'curl' => [CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4],
                ])
                ->withHeaders(['Authorization' => 'Bearer ' . $apiKey, 'Accept' => 'application/json'])
                ->post('https://bdcourier.com/api/courier-check', ['phone' => $phone]);
            $j = $resp->json();
            $summary = $j['courierData']['summary'] ?? $j['summary'] ?? [];
            return response()->json([
                'all' => (int) ($summary['total_parcel'] ?? 0),
                'delivered' => (int) ($summary['success_parcel'] ?? 0),
                'returned' => (int) ($summary['cancelled_parcel'] ?? 0),
            ]);
        } catch (\Throwable $e) {
            return response()->json(['all' => 0, 'delivered' => 0, 'returned' => 0, 'error' => $e->getMessage()]);
        }
    }

    // Check if a customer has ANY previous order (any status) — used to suppress pixel events for repeat buyers.
    public function hasPreviousOrder(Request $request): JsonResponse
    {
        $fp = $request->input('fingerprint');
        $phone = $request->input('phone');
        $ip = $request->input('ip');
        if (!$fp && !$phone && !$ip) return response()->json(['has_previous' => false]);

        $found = \App\Models\Order::where(function ($q) use ($fp, $phone, $ip) {
            if ($phone) $q->orWhere('phone', $phone)->orWhere('customer_phone', $phone);
            if ($fp) $q->orWhere('customer_fingerprint', $fp);
            if ($ip) $q->orWhere('customer_ip', $ip);
        })->exists();

        if (!$found) {
            $found = \App\Models\ResellerOrder::where(function ($q) use ($fp, $phone, $ip) {
                if ($phone) $q->orWhere('customer_phone', $phone);
                if ($fp) $q->orWhere('customer_fingerprint', $fp);
                if ($ip) $q->orWhere('customer_ip', $ip);
            })->exists();
        }

        return response()->json(['has_previous' => $found]);
    }

    // Device/phone/ip active-order check (fraud) across orders + reseller_orders.
    public function deviceCheck(Request $request): JsonResponse
    {
        $fp = $request->input('fingerprint');
        $phone = $request->input('phone');
        $ip = $request->input('ip');
        if (!$fp && !$phone && !$ip) return response()->json(['blocked' => false]);

        $blocking = ['পেন্ডিং','হোল্ড','কনফার্ম','কনফার্মড','প্যাকেজিং','শিপমেন্ট','এসাইন','ক্যান্সেল','রিটার্ন','পেইড রিটার্ন','ফলোআপ','ফলোয়াপ'];

        $o = \App\Models\Order::whereIn('status', $blocking)->where(function ($q) use ($fp, $phone, $ip) {
            if ($fp) $q->orWhere('customer_fingerprint', $fp);
            if ($phone) $q->orWhere('phone', $phone);
            if ($ip) $q->orWhere('customer_ip', $ip);
        })->first();
        if ($o) return response()->json(['blocked' => true, 'status' => $o->status]);

        $ro = \App\Models\ResellerOrder::whereIn('status', $blocking)->where(function ($q) use ($fp, $phone, $ip) {
            if ($phone) $q->orWhere('customer_phone', $phone);
            if ($ip) $q->orWhere('customer_ip', $ip);
            if ($fp) $q->orWhere('customer_fingerprint', $fp);
        })->first();
        if ($ro) return response()->json(['blocked' => true, 'status' => $ro->status]);

        return response()->json(['blocked' => false]);
    }

    // Return-ledger expense/deposit upsert/delete by deterministic id.
    public function ledgerUpsert(Request $request): JsonResponse
    {
        $table = $request->input('table') === 'deposits' ? 'deposits' : 'expenses';
        $id = $request->input('id');
        $fields = $request->except(['table']);
        $fields['updated_at'] = now();
        $exists = DB::table($table)->where('id', $id)->exists();
        if ($exists) {
            DB::table($table)->where('id', $id)->update($fields);
        } else {
            $fields['created_at'] = now();
            DB::table($table)->insert($fields);
        }
        return response()->json(['ok' => true]);
    }
    public function ledgerDelete(Request $request): JsonResponse
    {
        $table = $request->input('table') === 'deposits' ? 'deposits' : 'expenses';
        DB::table($table)->where('id', $request->input('id'))->delete();
        return response()->json(['ok' => true]);
    }

    // ---- Courier ratio cache ----
    public function courierRatio(Request $request): JsonResponse
    {
        return response()->json(CourierRatioCache::where('phone', $request->input('phone'))->first());
    }
    public function courierRatioAll(): JsonResponse
    {
        return response()->json(CourierRatioCache::orderByDesc('updated_at')->get());
    }
    public function saveCourierRatio(Request $request): JsonResponse
    {
        $row = CourierRatioCache::updateOrCreate(['phone' => $request->input('phone')], $request->except(['id']));
        return response()->json($row, 201);
    }

    // ---- Employees ----
    public function employees(): JsonResponse
    {
        return response()->json(Employee::orderByDesc('created_at')->get());
    }
    public function storeEmployee(Request $request): JsonResponse
    {
        $data = $request->except(['id']);
        if (!empty($data['password'])) $data['password'] = Hash::make($data['password']);
        return response()->json(Employee::create($data), 201);
    }
    public function updateEmployee(Request $request, string $id): JsonResponse
    {
        $e = Employee::findOrFail($id);
        $data = $request->except(['id']);
        if (!empty($data['password'])) $data['password'] = Hash::make($data['password']);
        else unset($data['password']);
        $e->update($data);
        return response()->json($e->fresh());
    }
    public function deleteEmployee(string $id): JsonResponse
    {
        Employee::where('id', $id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }
    public function employeeActivities(Request $request): JsonResponse
    {
        $q = EmployeeActivity::query()->orderByDesc('created_at');
        if ($request->filled('employee_id')) $q->where('employee_id', $request->employee_id);
        return response()->json($q->limit(500)->get());
    }
    public function storeEmployeeActivity(Request $request): JsonResponse
    {
        return response()->json(EmployeeActivity::create($request->except(['id'])), 201);
    }

    // ---- Incomplete orders ----
    public function incompleteOrders(): JsonResponse
    {
        return response()->json(IncompleteOrder::orderByDesc('created_at')->get());
    }
    public function storeIncompleteOrder(Request $request): JsonResponse
    {
        // "incomplete" type: replace any existing entry for the same phone.
        if ($request->input('type') === 'incomplete' && $request->filled('phone')) {
            IncompleteOrder::where('type', 'incomplete')->where('phone', $request->input('phone'))->delete();
        }
        return response()->json(IncompleteOrder::create($request->all()), 201);
    }
    public function deleteIncompleteOrder(string $id): JsonResponse
    {
        IncompleteOrder::where('id', $id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }
    public function bulkDeleteIncomplete(Request $request): JsonResponse
    {
        IncompleteOrder::whereIn('id', (array) $request->input('ids', []))->delete();
        return response()->json(['message' => 'Deleted.']);
    }
    public function cancelIncomplete(string $id): JsonResponse
    {
        IncompleteOrder::where('id', $id)->update(['status' => 'cancelled']);
        return response()->json(['message' => 'Cancelled.']);
    }
    public function deleteIncompleteByPhone(Request $request): JsonResponse
    {
        IncompleteOrder::where('type', 'incomplete')->where('phone', $request->input('phone'))->delete();
        return response()->json(['message' => 'Deleted.']);
    }
    public function updateIncompleteNote(Request $request, string $id): JsonResponse
    {
        IncompleteOrder::where('id', $id)->update(['note' => $request->input('note')]);
        return response()->json(['message' => 'Updated.']);
    }

    // ---- Follow-up data (per order) ----
    public function followUps(): JsonResponse
    {
        return response()->json(FollowUpData::get());
    }
    public function saveFollowUp(Request $request): JsonResponse
    {
        $orderId = $request->input('order_id');
        $data = $request->except(['id']);
        try {
            $row = FollowUpData::updateOrCreate(['order_id' => $orderId], $data);
        } catch (\Illuminate\Database\QueryException $e) {
            // Concurrent INSERT race — another request won the INSERT, retry as UPDATE
            $updateData = collect($data)->except(['order_id'])->filter(fn($v) => !is_null($v))->toArray();
            if ($updateData) FollowUpData::where('order_id', $orderId)->update($updateData);
            $row = FollowUpData::where('order_id', $orderId)->first();
        }
        return response()->json($row, 201);
    }
    public function deleteFollowUp(Request $request): JsonResponse
    {
        FollowUpData::where('order_id', $request->input('order_id'))->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    // ---- Audio files (admin) ----
    public function audioList(): JsonResponse
    {
        $disk = \Illuminate\Support\Facades\Storage::disk('public');
        $files = $disk->files('audio');
        return response()->json(array_map(fn ($f) => [
            'name' => basename($f),
            'fullPath' => $f,
            'url' => '/storage/' . $f,
            'size' => $disk->size($f),
        ], $files));
    }
    public function audioUpload(Request $request): JsonResponse
    {
        $request->validate(['file' => 'required|file|max:20480']);
        $path = $request->file('file')->store('audio', 'public');
        // Return absolute URL so it works unchanged on reseller custom domains.
        return response()->json(['path' => url('storage/' . $path), 'fullPath' => $path]);
    }
    public function audioDelete(Request $request): JsonResponse
    {
        \Illuminate\Support\Facades\Storage::disk('public')->delete($request->input('path'));
        return response()->json(['message' => 'Deleted.']);
    }
}
