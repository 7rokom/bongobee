<?php

namespace App\Http\Controllers\Api\Digital;

use App\Http\Controllers\Controller;
use App\Models\DigitalProduct;
use App\Models\DigitalCategory;
use App\Models\DigitalOrder;
use App\Models\DigitalPaymentMethod;
use App\Models\SiteSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class DigitalStoreController extends Controller
{
    public function products(Request $request): JsonResponse
    {
        $query = DigitalProduct::with('category')->where('status', 'active');
        if ($request->filled('category_id')) $query->where('category_id', $request->category_id);
        if ($request->filled('search')) $query->where('title', 'like', '%'.$request->search.'%');
        return response()->json($query->orderByDesc('created_at')->paginate(24));
    }

    public function product(string $slug): JsonResponse
    {
        $product = DigitalProduct::with('category')->where('slug', $slug)->where('status', 'active')->firstOrFail();
        return response()->json($product);
    }

    public function categories(): JsonResponse
    {
        return response()->json(DigitalCategory::where('is_active', true)->orderBy('sort_order')->get());
    }

    public function paymentMethods(): JsonResponse
    {
        return response()->json(DigitalPaymentMethod::where('is_active', true)->orderBy('sort_order')->get());
    }

    public function storeSettings(): JsonResponse
    {
        return response()->json(SiteSetting::get('digital_settings', []));
    }

    public function placeOrder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'customer_name' => 'required|string',
            'customer_email' => 'required|email',
            'customer_phone' => 'nullable|string',
            'items' => 'required|array',
            'total_amount' => 'required|numeric',
            'payment_method' => 'required|string',
            'payment_number' => 'required|string',
            'trx_id' => 'required|string',
            'screenshot' => 'nullable|file|image|max:5120',
        ]);

        $screenshotPath = null;
        if ($request->hasFile('screenshot')) {
            $screenshotPath = $request->file('screenshot')->store('digital-screenshots', 'private');
        }

        $customer = $request->user('digital_customer');

        $order = DigitalOrder::create([
            ...$data,
            'customer_id' => $customer?->id,
            'screenshot_path' => $screenshotPath,
            'status' => 'pending',
        ]);

        return response()->json($order, 201);
    }

    public function myOrders(Request $request): JsonResponse
    {
        $customer = $request->user('digital_customer');
        $orders = DigitalOrder::where('customer_id', $customer->id)
            ->orderByDesc('created_at')->get();
        return response()->json($orders);
    }
}
