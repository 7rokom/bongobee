<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Reseller;
use App\Models\ResellerOrder;
use App\Models\PaymentRequest;
use App\Models\ResellerProductPrice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class ResellerController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Reseller::orderByDesc('created_at')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string',
            'email' => 'required|email|unique:resellers',
            'phone' => 'nullable|string',
            'shop_name' => 'nullable|string',
            'password' => 'required|string|min:6',
            'status' => 'nullable|in:pending,active,inactive',
        ]);
        $data['password'] = Hash::make($data['password']);
        $data['referral_code'] = strtoupper(uniqid('R'));
        return response()->json(Reseller::create($data), 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $reseller = Reseller::findOrFail($id);
        $data = $request->validate([
            'name' => 'sometimes|string',
            'email' => 'sometimes|email|unique:resellers,email,'.$id,
            'phone' => 'nullable|string',
            'shop_name' => 'nullable|string',
            'password' => 'nullable|string|min:6',
            'status' => 'nullable|in:pending,active,inactive',
        ]);
        if (!empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }
        $reseller->update($data);
        return response()->json($reseller);
    }

    public function destroy(string $id): JsonResponse
    {
        Reseller::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    // Admin view of all reseller orders
    public function orders(Request $request): JsonResponse
    {
        $query = ResellerOrder::with('reseller');
        if ($request->filled('reseller_id')) $query->where('reseller_id', $request->reseller_id);
        if ($request->filled('status')) $query->where('status', $request->status);
        return response()->json($query->orderByDesc('created_at')->paginate(50));
    }

    public function updateOrder(Request $request, string $id): JsonResponse
    {
        $order = ResellerOrder::findOrFail($id);
        $order->update($request->validate([
            'status' => 'nullable|string',
            'admin_note' => 'nullable|string',
            'tracking_url' => 'nullable|string',
            'courier_name' => 'nullable|string',
        ]));
        return response()->json($order);
    }

    // Payment requests
    public function paymentRequests(Request $request): JsonResponse
    {
        $query = PaymentRequest::with('reseller');
        if ($request->filled('status')) $query->where('status', $request->status);
        return response()->json($query->orderByDesc('created_at')->paginate(50));
    }

    public function updatePaymentRequest(Request $request, string $id): JsonResponse
    {
        $pr = PaymentRequest::findOrFail($id);
        $pr->update($request->validate([
            'status' => 'required|in:approved,rejected',
            'admin_note' => 'nullable|string',
        ]));
        return response()->json($pr);
    }

    // Custom product prices per reseller
    public function getProductPrices(string $resellerId): JsonResponse
    {
        $prices = ResellerProductPrice::with('product')
            ->where('reseller_id', $resellerId)->get();
        return response()->json($prices);
    }

    public function setProductPrice(Request $request, string $resellerId): JsonResponse
    {
        $data = $request->validate([
            'product_id' => 'required|uuid|exists:products,id',
            'custom_price' => 'required|numeric|min:0',
        ]);
        $price = ResellerProductPrice::updateOrCreate(
            ['reseller_id' => $resellerId, 'product_id' => $data['product_id']],
            ['custom_price' => $data['custom_price']]
        );
        return response()->json($price);
    }

    // Reseller report
    public function report(Request $request): JsonResponse
    {
        $resellers = Reseller::withCount(['orders as total_orders'])
            ->with(['orders' => function ($q) {
                $q->where('status', 'ডেলিভারড')
                  ->selectRaw('reseller_id, SUM(reseller_profit) as total_profit')
                  ->groupBy('reseller_id');
            }])
            ->get();
        return response()->json($resellers);
    }
}
