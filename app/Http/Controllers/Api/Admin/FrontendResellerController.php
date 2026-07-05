<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Reseller;
use App\Models\ResellerOrder;
use App\Models\PaymentRequest;
use App\Models\ResellerProductPrice;
use App\Models\ResellerPaymentMethod;
use App\Models\Counter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Phase 3 — reseller data in the React frontend's exact schema. Reachable by admin,
 * employee, or reseller tokens (the React reseller store runs in both contexts).
 */
class FrontendResellerController extends Controller
{
    // ---- Resellers (id stays the real UUID) ----
    public function resellers(): JsonResponse
    {
        return response()->json(Reseller::orderBy('created_at')->get());
    }

    public function storeReseller(Request $request): JsonResponse
    {
        $data = $request->except(['id']);
        if ($request->filled('id')) $data['id'] = $request->input('id');
        if (!empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        }
        $reseller = Reseller::create($data);
        return response()->json($reseller, 201);
    }

    public function updateReseller(Request $request, string $id): JsonResponse
    {
        $reseller = Reseller::findOrFail($id);
        $data = $request->except(['id']);
        if (!empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        }
        $reseller->update($data);
        return response()->json($reseller->fresh());
    }

    // ---- Public (storefront reseller shop) ----
    public function publicReseller(string $ref): JsonResponse
    {
        $reseller = is_numeric($ref)
            ? Reseller::where('serial_number', (int) $ref)->first()
            : Reseller::find($ref);
        if (!$reseller) return response()->json(null);
        return response()->json($reseller->only([
            'id', 'name', 'serial_number', 'contact_phone', 'contact_whatsapp',
            'header_code', 'body_code', 'footer_code',
            'storefront_logo_url', 'storefront_favicon_url', 'storefront_bio',
            'storefront_address', 'storefront_phone', 'storefront_footer_credit',
            'storefront_legal_pages', 'storefront_facebook_url', 'storefront_youtube_url',
            'storefront_twitter_url', 'storefront_instagram_url',
            'storefront_name', 'storefront_primary_color',
            'storefront_hero_title', 'storefront_hero_subtitle', 'storefront_hero_image',
        ]));
    }

    // Public endpoint for customer checkout from a reseller storefront.
    // No auth required — reseller identity is validated by reseller_id lookup.
    public function publicStoreOrder(Request $request): JsonResponse
    {
        $resellerId = (string) $request->input('reseller_id');
        $reseller = Reseller::find($resellerId);
        if (!$reseller) {
            return response()->json(['message' => 'Reseller not found'], 404);
        }

        $code = DB::transaction(function () {
            $c = Counter::lockForUpdate()->find('reseller_order_number');
            if (!$c) $c = Counter::create(['id' => 'reseller_order_number', 'value' => 1000]);
            $c->increment('value');
            return '#RO' . $c->fresh()->value;
        });

        $data = $request->except(['reseller_id']);
        $data['reseller_id']   = $resellerId;
        $data['reseller_name'] = $reseller->name;
        $data['order_code']    = $code;
        $data['total_amount']  = $request->input('total_selling_price', 0);

        $order = ResellerOrder::create($data);
        return response()->json($this->presentOrder($order), 201);
    }

    public function publicResellerPrices(Request $request): JsonResponse
    {
        $q = ResellerProductPrice::query();
        if ($request->filled('reseller_id')) $q->where('reseller_id', $request->reseller_id);
        if ($request->filled('product_id')) $q->where('product_id', $request->product_id);
        return response()->json($q->get(['product_id', 'custom_price']));
    }

    // ---- Reseller orders (frontend id == order_code "#RO1001") ----
    private function presentOrder(ResellerOrder $o): array
    {
        $arr = $o->toArray();
        $code = $o->order_code ?: (string) $o->id;
        // Normalize legacy codes without # prefix (e.g. "RO1001" → "#RO1001").
        if (str_starts_with($code, 'RO')) {
            $code = '#' . $code;
        }
        $arr['id'] = $code;
        // Attach tracking URL from follow_up_data (saved by admin when dispatching to courier).
        $trackingUrl = DB::table('follow_up_data')
            ->where('order_id', 'reseller-' . $code)
            ->value('tracking_url');
        if ($trackingUrl) {
            $arr['tracking_url'] = $trackingUrl;
        }
        return $arr;
    }

    private function normalizeResellerCode(string $code): string
    {
        // Ensure the code has a # prefix. Accepts both "RO1001" and "#RO1001".
        return str_starts_with($code, '#') ? $code : '#' . $code;
    }

    private function findResellerOrder(string $code): ?ResellerOrder
    {
        $withHash = $this->normalizeResellerCode($code);
        $withoutHash = ltrim($code, '#');
        return ResellerOrder::where('order_code', $withHash)
            ->orWhere('order_code', $withoutHash)
            ->orWhere('id', $code)
            ->first();
    }

    public function orders(): JsonResponse
    {
        $orders = ResellerOrder::orderByDesc('created_at')->get();
        return response()->json($orders->map(fn ($o) => $this->presentOrder($o))->values());
    }

    public function storeOrder(Request $request): JsonResponse
    {
        $raw = $request->input('id') ?: $request->input('order_code');
        $code = $raw ? $this->normalizeResellerCode((string) $raw) : null;
        $data = $request->except(['id']);
        $data['order_code'] = $code;
        $data['customer_name'] = $request->input('customer_name');
        $data['total_amount'] = $request->input('total_selling_price', 0);
        // Look up by both formats so an upsert never creates a duplicate.
        $existing = $code ? $this->findResellerOrder($code) : null;
        if ($existing) {
            $existing->update($data);
            $order = $existing->fresh();
        } else {
            $order = ResellerOrder::create($data);
        }
        return response()->json($this->presentOrder($order), 201);
    }

    public function updateOrder(Request $request): JsonResponse
    {
        $code = $request->input('code') ?: $request->input('id');
        $order = $this->findResellerOrder((string) $code) ?? abort(404);
        $order->update($request->except(['id', 'code']));
        return response()->json($this->presentOrder($order->fresh()));
    }

    public function deleteOrder(Request $request): JsonResponse
    {
        $code = $request->input('code') ?: $request->input('id');
        $withHash = $this->normalizeResellerCode((string) $code);
        $withoutHash = ltrim((string) $code, '#');
        ResellerOrder::where('order_code', $withHash)
            ->orWhere('order_code', $withoutHash)
            ->orWhere('id', $code)
            ->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    public function nextOrderId(): JsonResponse
    {
        $value = DB::transaction(function () {
            $c = Counter::lockForUpdate()->find('reseller_order_number');
            if (!$c) $c = Counter::create(['id' => 'reseller_order_number', 'value' => 1000]);
            $c->increment('value');
            return $c->fresh()->value;
        });
        return response()->json(['id' => '#RO' . $value]);
    }

    // ---- Payment requests (method <-> payment_method) ----
    public function paymentRequests(): JsonResponse
    {
        return response()->json(PaymentRequest::orderByDesc('created_at')->get()->map(function ($p) {
            $a = $p->toArray();
            $a['method'] = $p->payment_method;
            return $a;
        })->values());
    }

    public function storePaymentRequest(Request $request): JsonResponse
    {
        $data = $request->except(['id', 'method']);
        if ($request->filled('id')) $data['id'] = $request->input('id');
        if ($request->filled('method')) $data['payment_method'] = $request->input('method');
        $req = PaymentRequest::create($data);
        return response()->json($req, 201);
    }

    public function updatePaymentRequest(Request $request, string $id): JsonResponse
    {
        $req = PaymentRequest::findOrFail($id);
        $data = $request->only(['status', 'admin_note']);
        if ($request->filled('method')) $data['payment_method'] = $request->input('method');
        $req->update($data);
        return response()->json($req->fresh());
    }

    // ---- Custom product prices ----
    public function productPrices(Request $request): JsonResponse
    {
        $q = ResellerProductPrice::query();
        if ($request->filled('reseller_id')) $q->where('reseller_id', $request->reseller_id);
        return response()->json($q->get());
    }

    public function setProductPrice(Request $request): JsonResponse
    {
        $data = $request->validate([
            'reseller_id' => 'required|string',
            'product_id' => 'required|string',
            'custom_price' => 'required|numeric',
        ]);
        $row = ResellerProductPrice::updateOrCreate(
            ['reseller_id' => $data['reseller_id'], 'product_id' => $data['product_id']],
            ['custom_price' => $data['custom_price']]
        );
        return response()->json($row);
    }

    // ---- Reseller payment methods ----
    public function paymentMethods(Request $request): JsonResponse
    {
        $q = ResellerPaymentMethod::query();
        if ($request->filled('reseller_id')) $q->where('reseller_id', $request->reseller_id);
        return response()->json($q->get());
    }

    public function storePaymentMethod(Request $request): JsonResponse
    {
        $data = $request->except(['id']);
        if ($request->filled('id')) $data['id'] = $request->input('id');
        $pm = ResellerPaymentMethod::create($data);
        return response()->json($pm, 201);
    }

    public function deletePaymentMethod(string $id): JsonResponse
    {
        ResellerPaymentMethod::where('id', $id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }
}
