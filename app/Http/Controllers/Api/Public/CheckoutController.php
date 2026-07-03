<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\ResellerOrder;
use App\Models\IncompleteOrder;
use App\Models\Coupon;
use App\Models\BlockedCustomer;
use App\Models\SiteSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CheckoutController extends Controller
{
    public function validateCoupon(Request $request): JsonResponse
    {
        $request->validate(['code' => 'required|string', 'total' => 'required|numeric']);
        $coupon = Coupon::where('code', $request->code)->where('is_active', true)->first();

        if (!$coupon) {
            return response()->json(['valid' => false, 'message' => 'Invalid coupon code.'], 422);
        }
        if ($coupon->end_date && now()->isAfter($coupon->end_date)) {
            return response()->json(['valid' => false, 'message' => 'Coupon has expired.'], 422);
        }
        if ($coupon->max_usage > 0 && $coupon->used_count >= $coupon->max_usage) {
            return response()->json(['valid' => false, 'message' => 'Coupon usage limit reached.'], 422);
        }
        if ($request->total < $coupon->min_order_amount) {
            return response()->json(['valid' => false, 'message' => "Minimum order amount is {$coupon->min_order_amount}."], 422);
        }

        $discount = $coupon->discount_type === 'percentage'
            ? ($request->total * $coupon->discount_value / 100)
            : $coupon->discount_value;

        return response()->json(['valid' => true, 'discount' => round($discount, 2), 'coupon' => $coupon]);
    }

    public function placeOrder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'customer_name' => 'required|string',
            'customer_phone' => 'required|string',
            'customer_address' => 'required|string',
            'delivery_zone' => 'nullable|string',
            'items' => 'required|array',
            'total_amount' => 'required|numeric',
            'delivery_charge' => 'nullable|numeric',
            'discount_amount' => 'nullable|numeric',
            'coupon_code' => 'nullable|string',
            'note' => 'nullable|string',
            'device_fingerprint' => 'nullable|string',
            'ip_address' => 'nullable|string',
        ]);

        // Check if customer is blocked
        $phone = $data['customer_phone'];
        $blocked = BlockedCustomer::where(function ($q) use ($phone, $request) {
            $q->where('type', 'phone')->where('value', $phone);
            if ($request->device_fingerprint) {
                $q->orWhere(fn($q2) => $q2->where('type', 'fingerprint')->where('value', $request->device_fingerprint));
            }
            if ($request->ip()) {
                $q->orWhere(fn($q2) => $q2->where('type', 'ip')->where('value', $request->ip()));
            }
        })->exists();

        if ($blocked) {
            // Save as incomplete order
            IncompleteOrder::create([...$data, 'fraud_blocked' => true]);
            return response()->json(['message' => 'Order blocked.'], 403);
        }

        // Apply coupon
        if (!empty($data['coupon_code'])) {
            $coupon = Coupon::where('code', $data['coupon_code'])->where('is_active', true)->first();
            if ($coupon) {
                $coupon->increment('used_count');
            }
        }

        $data['invoice_number'] = DB::transaction(fn() => Order::nextInvoiceNumber());
        $data['source'] = 'website';
        $order = Order::create($data);

        return response()->json([
            'order' => $order,
            'invoice_number' => $order->invoice_number,
        ], 201);
    }

    public function saveIncompleteOrder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'customer_name' => 'nullable|string',
            'customer_phone' => 'required|string',
            'customer_address' => 'nullable|string',
            'delivery_zone' => 'nullable|string',
            'items' => 'nullable|array',
            'total_amount' => 'nullable|numeric',
            'delivery_charge' => 'nullable|numeric',
            'device_fingerprint' => 'nullable|string',
            'ip_address' => 'nullable|string',
        ]);
        $incomplete = IncompleteOrder::create($data);
        return response()->json($incomplete, 201);
    }

    public function trackOrder(Request $request): JsonResponse
    {
        $request->validate([
            'code'    => 'nullable|string',
            'phone'   => 'nullable|string',
            'invoice' => 'nullable|string', // legacy alias for code
        ]);

        $rawCode = $request->input('code') ?: $request->input('invoice');
        $phone   = $request->input('phone');

        if (!$rawCode && !$phone) {
            return response()->json(['message' => 'Provide an order code or phone number.'], 422);
        }

        $results = $rawCode
            ? $this->findByCode($rawCode, $phone)
            : $this->findByPhone($phone);

        if (empty($results)) {
            return response()->json(['message' => 'Order not found.'], 404);
        }

        return response()->json(['orders' => $results]);
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    /**
     * Find orders by code (with/without # prefix, handles RO prefix for reseller orders).
     * Optional $verifyPhone adds a phone-match guard (backwards-compat with old phone+invoice callers).
     */
    private function findByCode(string $raw, ?string $verifyPhone = null): array
    {
        $stripped = ltrim(trim($raw), '#');   // e.g. "1001" or "RO1001"
        $withHash = '#' . $stripped;          // e.g. "#1001" or "#RO1001"

        if (stripos($stripped, 'RO') === 0) {
            return $this->searchResellerOrders($stripped, $withHash, $verifyPhone);
        }

        return $this->searchMainOrders($stripped, $withHash, $verifyPhone);
    }

    private function searchMainOrders(string $stripped, string $withHash, ?string $phone): array
    {
        $query = Order::where(function ($q) use ($stripped, $withHash) {
            $q->where('order_code', $withHash)   // Phase-3: order_code = "#1001"
              ->orWhere('id', $withHash)          // Legacy: id was set to "#07"
              ->orWhere('id', $stripped);         // Legacy without #
            if (is_numeric($stripped)) {
                $q->orWhere('invoice_number', (int) $stripped); // very old format
            }
        });

        if ($phone) {
            $query->where(function ($q) use ($phone) {
                $q->where('phone', $phone)->orWhere('customer_phone', $phone);
            });
        }

        $order = $query->first();
        return $order ? [$this->presentMain($order)] : [];
    }

    private function searchResellerOrders(string $stripped, string $withHash, ?string $phone): array
    {
        $query = ResellerOrder::with('reseller')->where(function ($q) use ($stripped, $withHash) {
            $q->where('order_code', $withHash)   // Phase-3: "#RO1001"
              ->orWhere('order_code', $stripped)  // without #
              ->orWhere('id', $stripped);         // Legacy: id = "RO03"
        });

        if ($phone) {
            $query->where('customer_phone', $phone);
        }

        $order = $query->first();
        return $order ? [$this->presentReseller($order)] : [];
    }

    private function findByPhone(string $phone): array
    {
        $mainOrders = Order::where(function ($q) use ($phone) {
            $q->where('phone', $phone)->orWhere('customer_phone', $phone);
        })->get()->map(fn ($o) => $this->presentMain($o))->values()->toArray();

        $resellerOrders = ResellerOrder::with('reseller')->where('customer_phone', $phone)
            ->get()->map(fn ($o) => $this->presentReseller($o))->values()->toArray();

        return array_merge($mainOrders, $resellerOrders);
    }

    /** Normalise a main Order into the unified public tracking shape. */
    private function presentMain(Order $o): array
    {
        $id      = $o->order_code ?: $o->id; // Phase-3 uses order_code; legacy PK was the code
        $rawItems = is_array($o->items) ? $o->items : json_decode((string) ($o->items ?? '[]'), true) ?? [];

        return [
            'id'             => $id,
            'source'         => 'customer',
            'customer'       => $o->customer ?: $o->customer_name,
            'phone'          => $o->phone    ?: $o->customer_phone,
            'address'        => $o->address  ?: $o->customer_address,
            'items'          => array_values(array_map(fn ($it) => [
                'name'  => $it['name']  ?? ($it['title'] ?? ''),
                'qty'   => (int)   ($it['qty']   ?? $it['quantity']  ?? 1),
                'price' => (float) ($it['price'] ?? 0),
                'image' => $it['image'] ?? null,
            ], $rawItems)),
            'delivery_charge' => (float) ($o->delivery_charge ?? 0),
            'total'           => (float) ($o->total  ?: $o->total_amount),
            'status'          => $o->status,
            'date'            => $o->date,
        ];
    }

    /** Normalise a ResellerOrder into the unified public tracking shape. */
    private function presentReseller(ResellerOrder $o): array
    {
        $id = $o->order_code ?: $o->id;
        if ($id && !str_starts_with($id, '#')) {
            $id = '#' . $id;
        }
        $rawItems = is_array($o->items) ? $o->items : json_decode((string) ($o->items ?? '[]'), true) ?? [];

        $reseller = $o->reseller;

        return [
            'id'             => $id,
            'source'         => 'reseller',
            'customer'       => $o->customer_name,
            'phone'          => $o->customer_phone,
            'address'        => $o->customer_address,
            'items'          => array_values(array_map(fn ($it) => [
                'name'  => $it['productTitle'] ?? ($it['name']  ?? ''),
                'qty'   => (int)   ($it['qty']   ?? 1),
                'price' => (float) ($it['sellingPrice'] ?? $it['price'] ?? 0),
                'image' => $it['image'] ?? null,
            ], $rawItems)),
            'delivery_charge'    => (float) ($o->delivery_charge ?? 0),
            'total'              => (float) ($o->total_selling_price ?: $o->total_amount),
            'status'             => $o->status,
            'date'               => $o->date,
            'reseller_shop_name' => $reseller?->name ?? $o->reseller_name ?? null,
            'reseller_address'   => $reseller?->storefront_address ?? null,
            'reseller_phone'     => $reseller?->storefront_phone ?? null,
            'reseller_logo_url'  => $reseller?->storefront_logo_url ?? null,
        ];
    }
}
