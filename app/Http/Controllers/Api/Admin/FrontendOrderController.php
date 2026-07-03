<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Counter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Phase 3 — serves orders in the React frontend's exact schema (order_code "#01"
 * id, customer/phone/address/total, sms_sent, Bengali date). order_code is passed
 * in the request body (it contains "#", which can't go in a URL path).
 */
class FrontendOrderController extends Controller
{
    // Column set the frontend reads/writes (snake_case).
    private array $cols = [
        'customer', 'phone', 'address', 'items', 'delivery_charge', 'original_delivery_charge',
        'total', 'status', 'date', 'iso_date', 'confirmed_by', 'assigned_to', 'assigned_to_name',
        'customer_ip', 'customer_fingerprint', 'note', 'paid_return_amount', 'sms_sent', 'source',
        'tracking_url', 'courier_name', 'vendor_buy_price', 'courier_invoice_id', 'courier_delivery_charge',
    ];

    private function present(Order $o): array
    {
        // Orders created before the order_code system get a generated fallback
        // so they are included in exports and are never silently dropped.
        $code = $o->order_code ?? ('#OD' . str_pad((string) $o->getKey(), 4, '0', STR_PAD_LEFT));
        $arr  = $o->only($this->cols);
        $arr['order_code'] = $code;
        $arr['id']         = $code;
        // Old orders may have iso_date = null in the DB. Always send a valid
        // ISO date so return-ledger.ts records expenses on the correct date.
        if (empty($arr['iso_date'])) {
            $arr['iso_date'] = $o->created_at
                ? $o->created_at->toIso8601String()
                : now()->toIso8601String();
        }
        return $arr;
    }

    public function index(): JsonResponse
    {
        $orders = Order::orderByDesc('created_at')->get();
        return response()->json($orders->map(fn ($o) => $this->present($o))->values());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->only($this->cols);
        $code = $request->input('id') ?: $request->input('order_code');
        if (!$code) $code = $this->bumpInvoiceCode();
        $data['order_code'] = $code;
        // Ensure iso_date is always persisted so return-ledger.ts gets the correct date.
        if (empty($data['iso_date'])) $data['iso_date'] = now()->toDateString();
        // keep legacy columns populated for cross-module queries
        $data['customer_name'] = $request->input('customer');
        $data['customer_phone'] = $request->input('phone');
        $data['customer_address'] = $request->input('address');
        $data['total_amount'] = $request->input('total', 0);

        $order = Order::updateOrCreate(['order_code' => $code], $data);
        return response()->json($this->present($order), 201);
    }

    public function update(Request $request): JsonResponse
    {
        $code = $request->input('code') ?: $request->input('id');
        $order = Order::where('order_code', $code)->firstOrFail();

        $data = $request->only($this->cols);
        // mirror to legacy columns when the frontend names are present
        if ($request->has('customer')) $data['customer_name'] = $request->input('customer');
        if ($request->has('phone')) $data['customer_phone'] = $request->input('phone');
        if ($request->has('address')) $data['customer_address'] = $request->input('address');
        if ($request->has('total')) $data['total_amount'] = $request->input('total');

        $order->update($data);
        return response()->json($this->present($order->fresh()));
    }

    public function bulkDelete(Request $request): JsonResponse
    {
        $codes = (array) $request->input('codes', []);
        Order::whereIn('order_code', $codes)->delete();
        return response()->json(['message' => 'Deleted.', 'count' => count($codes)]);
    }

    // Bumps the order_number counter and returns the formatted "#NN" code.
    public function nextInvoice(): JsonResponse
    {
        return response()->json(['invoice' => $this->bumpInvoiceCode()]);
    }

    // Generic counter bump (e.g. auto_assign_index). Returns the new value.
    public function counterNext(string $key): JsonResponse
    {
        $value = DB::transaction(function () use ($key) {
            $counter = Counter::lockForUpdate()->find($key);
            if (!$counter) $counter = Counter::create(['id' => $key, 'value' => 0]);
            $counter->increment('value');
            return $counter->fresh()->value;
        });
        return response()->json(['key' => $key, 'value' => $value]);
    }

    public function counterGet(string $key): JsonResponse
    {
        $counter = Counter::find($key);
        return response()->json(['key' => $key, 'value' => $counter?->value ?? 0]);
    }

    public function counterSet(Request $request, string $key): JsonResponse
    {
        $value = (int) $request->input('value', 0);
        Counter::updateOrCreate(['id' => $key], ['value' => $value]);
        return response()->json(['key' => $key, 'value' => $value]);
    }

    // Public storefront checkout: server-side counter bump + create. No auth.
    public function checkout(Request $request): JsonResponse
    {
        $code = $this->bumpInvoiceCode();
        $data = $request->only($this->cols);
        $data['order_code'] = $code;
        $data['customer_name'] = $request->input('customer');
        $data['customer_phone'] = $request->input('phone');
        $data['customer_address'] = $request->input('address');
        $data['total_amount'] = $request->input('total', 0);

        $order = Order::create($data);
        return response()->json($this->present($order), 201);
    }

    // Customer order history aggregated by phone (used by the admin Orders page).
    public function customerHistory(Request $request): JsonResponse
    {
        $phone = $request->input('phone');
        if (!$phone) return response()->json([]);
        $orders = Order::where('phone', $phone)->orWhere('customer_phone', $phone)
            ->orderByDesc('created_at')->get();
        return response()->json($orders->map(fn ($o) => $this->present($o))->values());
    }

    // Public (storefront) post-order "ship directly" confirm. Only flips an order to
    // কনফার্মড if it hasn't already been confirmed by someone (preserves manual confirmer).
    public function confirmOrder(Request $request): JsonResponse
    {
        $code = $request->input('code');
        if (!$code) return response()->json(null);

        if (str_starts_with((string) $code, 'RO') || str_starts_with((string) $code, '#RO')) {
            $ro = \App\Models\ResellerOrder::where('order_code', $code)
                ->orWhere('order_code', ltrim((string) $code, '#'))
                ->orWhere('order_code', (str_starts_with((string) $code, '#') ? $code : '#' . $code))
                ->orWhere('id', $code)
                ->first();
            if ($ro && (empty($ro->confirmed_by))) {
                $ro->update(['status' => 'কনফার্মড', 'confirmed_by' => 'অটোমেটিক']);
            }
            return response()->json($ro);
        }

        $o = Order::where('order_code', $code)->first();
        if ($o && empty($o->confirmed_by)) {
            $o->update(['status' => 'কনফার্মড', 'confirmed_by' => 'অটোমেটিক']);
        }
        return response()->json($o ? $this->present($o->fresh()) : null);
    }

    // Returns the first known ip/fingerprint for a phone (orders + incomplete_orders).
    public function customerDevices(Request $request): JsonResponse
    {
        $phone = $request->input('phone');
        if (!$phone) return response()->json([]);

        $hit = Order::where(fn ($q) => $q->where('phone', $phone)->orWhere('customer_phone', $phone))
            ->where(fn ($q) => $q->whereNotNull('customer_ip')->orWhereNotNull('customer_fingerprint'))
            ->first();
        if ($hit) {
            return response()->json(['ip' => $hit->customer_ip ?: null, 'fingerprint' => $hit->customer_fingerprint ?: null]);
        }

        $ro = \App\Models\ResellerOrder::where('customer_phone', $phone)
            ->where(fn ($q) => $q->whereNotNull('customer_ip')->orWhereNotNull('customer_fingerprint'))
            ->first();
        if ($ro) {
            return response()->json(['ip' => $ro->customer_ip ?: null, 'fingerprint' => $ro->customer_fingerprint ?: null]);
        }

        $inc = DB::table('incomplete_orders')
            ->where('customer_phone', $phone)
            ->where(fn ($q) => $q->whereNotNull('ip_address')->orWhereNotNull('device_fingerprint'))
            ->first();
        if ($inc) {
            return response()->json(['ip' => $inc->ip_address ?? null, 'fingerprint' => $inc->device_fingerprint ?? null]);
        }
        return response()->json([]);
    }

    private function bumpInvoiceCode(): string
    {
        $value = DB::transaction(function () {
            $counter = Counter::lockForUpdate()->find('order_number');
            if (!$counter) $counter = Counter::create(['id' => 'order_number', 'value' => 1000]);
            $counter->increment('value');
            return $counter->fresh()->value;
        });
        return '#' . $value;
    }
}
